import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const DEFAULT_CLIENT_NAMES = [
  "Aplikasi",
  "Podcast Elite Leader",
  "Podcast Lider de Elite",
  "Minas Home",
  "Doutora Patricia",
];

function parseEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const envPath = path.join(projectRoot, ".env");
  const env = { ...process.env };
  try {
    const text = await fs.readFile(envPath, "utf8");
    Object.assign(env, parseEnvFile(text));
  } catch {
    // Ignore missing .env; process.env may still be enough.
  }
  return env;
}

function parseArgs(argv) {
  const options = {
    outDir: path.join(projectRoot, "migration-export", "priority-clients"),
    clients: [...DEFAULT_CLIENT_NAMES],
    dryRun: false,
    allClients: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out-dir" && argv[i + 1]) {
      options.outDir = path.resolve(projectRoot, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--clients" && argv[i + 1]) {
      options.clients = argv[i + 1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--all-clients") {
      options.allClients = true;
    }
  }

  return options;
}

function uniqueMediaUrls(rows, extractors) {
  const seen = new Map();
  for (const row of rows) {
    for (const extractor of extractors) {
      const items = extractor(row) || [];
      for (const item of items) {
        if (!item?.url) continue;
        if (!seen.has(item.url)) seen.set(item.url, item);
      }
    }
  }
  return [...seen.values()];
}

async function fetchAll(query, pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await query.range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchInBatches(values, buildQuery, chunkSize = 100) {
  const rows = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    rows.push(...await fetchAll(buildQuery(values.slice(index, index + chunkSize))));
  }
  return rows;
}

function pickAllowedProfiles(profiles, assignments) {
  const allowedUserIds = new Set(assignments.map((item) => item.user_id));
  return profiles.filter((profile) => allowedUserIds.has(profile.id));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const trace = (stage) => { if (process.env.EXPORT_DEBUG === "1") console.log(`stage:${stage}`); };
  const env = await loadEnv();

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL/chave publishable nao encontrados no ambiente.");
  }

  const accessToken = env.EXPORT_ACCESS_TOKEN?.trim();
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });

  const adminEmail = env.EXPORT_ADMIN_EMAIL || env.MIGRATION_ADMIN_EMAIL;
  const adminPassword =
    env.EXPORT_ADMIN_PASSWORD || env.MIGRATION_ADMIN_PASSWORD;

  let role = "anon";
  let currentUserId = null;

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) throw new Error(`Sessão autenticada inválida: ${error?.message ?? "usuário ausente"}`);
    currentUserId = data.user.id;
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, full_name, email").eq("id", currentUserId).maybeSingle();
    if (profileError) throw profileError;
    role = profile?.role ?? "authenticated";
  } else if (adminEmail && adminPassword) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (error) {
      throw new Error(`Falha ao autenticar com login admin: ${error.message}`);
    }

    currentUserId = data.user?.id ?? null;
    if (currentUserId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name, email")
        .eq("id", currentUserId)
        .maybeSingle();
      if (profileError) throw profileError;
      role = profile?.role ?? "authenticated";
    } else {
      role = "authenticated";
    }
  }
  trace("authenticated");

  let clientsQuery = supabase
    .from("clients")
    .select(
      [
        "id",
        "name",
        "slug",
        "logo_url",
        "locale",
        "client_portal_title",
        "tracking_enabled",
        "tracking_visible_to_client",
        "tracking_column_ids",
        "show_archived_to_client",
        "show_upcoming_posts",
        "allow_client_edit_caption",
        "allow_client_create_post",
        "allow_client_create_tags",
        "allow_client_download",
        "allow_client_edit_brand_brain",
        "require_login",
        "link_expiration_days",
        "calendar_color",
        "calendar_legend",
        "owner_id",
        "shared",
        "address",
        "country",
        "tax_id",
        "billing_currency",
        "billing_recurrence_active",
      ].join(","),
    );
  if (!options.allClients) clientsQuery = clientsQuery.in("name", options.clients);
  const { data: clients, error: clientError } = await clientsQuery.order("name");

  if (clientError) throw clientError;
  trace("clients");

  const foundClients = clients ?? [];
  const foundClientIds = foundClients.map((client) => client.id);

  const missingClients = options.allClients ? [] : options.clients.filter(
    (name) => !foundClients.some((client) => client.name === name),
  );

  const assignmentsQuery = supabase
    .from("user_client_assignments")
    .select("id, user_id, client_id, assigned_by, created_at")
    .in("client_id", foundClientIds);
  const assignments = foundClientIds.length ? await fetchAll(assignmentsQuery) : [];
  trace("assignments");

  const profileIds = [...new Set(assignments.map((item) => item.user_id))];
  const profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("id", profileIds);
  const profiles = profileIds.length ? await fetchAll(profilesQuery) : [];
  trace("profiles");

  const columnsQuery = supabase
    .from("columns")
    .select("id, client_id, name, position, color, visible_to_client, trello_list_id")
    .in("client_id", foundClientIds)
    .order("position");
  const columns = foundClientIds.length ? await fetchAll(columnsQuery) : [];
  trace("columns");

  const postsQuery = supabase
    .from("posts")
    .select(
      [
        "id",
        "client_id",
        "column_id",
        "title",
        "caption",
        "image_url",
        "media_type",
        "media_urls",
        "art_type",
        "tags",
        "status",
        "position",
        "deadline",
        "archived",
        "archived_at",
        "published_at",
        "event_color",
        "client_label",
        "retain_files",
        "created_at",
        "updated_at",
        "client_created_at",
        "client_unarchived_at",
        "is_pauta",
        "content_pillar_id",
        "trello_card_id",
      ].join(","),
    )
    .in("client_id", foundClientIds)
    .order("position");
  const posts = foundClientIds.length ? await fetchAll(postsQuery) : [];
  trace("posts");

  const defaultTagIds = ["seo", "alterado", "agendado", "publicado"];
  const tagsQuery = supabase
    .from("tags")
    .select("id, client_id, name, color, created_at")
    .or(`client_id.in.(${foundClientIds.join(",")}),id.in.(${defaultTagIds.join(",")})`)
    .order("name");
  const tags = foundClientIds.length ? await fetchAll(tagsQuery) : [];
  trace("tags");

  const postIds = posts.map((post) => post.id);
  const comments = await fetchInBatches(postIds, (ids) => supabase
    .from("comments")
    .select("id, post_id, author, text, user_id, created_at")
    .in("post_id", ids)
    .order("created_at"));
  trace("comments");

  const textContentsQuery = supabase.from("text_contents").select("id,client_id,content_type,title,subtitle,body,status,planned_date,observations,client_label,created_by,created_at,updated_at,pdf_url,pdf_name").in("client_id", foundClientIds).order("created_at");
  const textContents = foundClientIds.length ? await fetchAll(textContentsQuery) : [];
  trace("text-contents");
  const textContentIds = textContents.map((item) => item.id);
  const textContentComments = await fetchInBatches(textContentIds, (ids) => supabase.from("text_content_comments").select("id,text_content_id,user_id,author_name,author_role,message,created_at").in("text_content_id", ids).order("created_at"));
  trace("text-content-comments");

  const calendarPostsQuery = supabase
    .from("calendar_posts")
    .select(
      "id, client_id, title, caption, media_type, media_urls, publish_date, publish_time, status, event_color, created_by, created_at, updated_at",
    )
    .in("client_id", foundClientIds)
    .order("publish_date");
  const calendarPosts = foundClientIds.length ? await fetchAll(calendarPostsQuery) : [];
  trace("calendar");

  const appointments = await fetchAll(supabase.from("appointments").select("id,user_id,title,description,appointment_date,appointment_time,category,completed,completed_at,cancelled,cancelled_at,tag_id,created_at,updated_at").order("appointment_date"));
  trace("appointments");
  const appointmentTags = await fetchAll(supabase.from("appointment_tags").select("id,user_id,name,color,created_at").order("created_at"));
  trace("appointment-tags");

  const invoicesQuery = supabase
    .from("invoices")
    .select("id, client_id, client_visible, created_at, created_by, discount, due_date, invoice_number, issue_date, notes, paid_at, payment_details, payment_method, period_end, period_start, status, surcharge, title, updated_at")
    .in("client_id", foundClientIds)
    .order("invoice_number");
  const invoices = foundClientIds.length ? await fetchAll(invoicesQuery) : [];
  trace("invoices");
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const invoiceItems = await fetchInBatches(invoiceIds, (ids) => supabase.from("invoice_items").select("id, invoice_id, category, created_at, description, name, notes, post_id, quantity, service_date, total_price, unit_price").in("invoice_id", ids).order("created_at"));
  trace("invoice-items");
  const invoiceAttachments = await fetchInBatches(invoiceIds, (ids) => supabase.from("invoice_attachments").select("id, invoice_id, created_at, file_name, file_url, uploaded_by").in("invoice_id", ids).order("created_at"));
  trace("invoice-attachments");

  const contractsQuery = supabase.from("contracts").select("id, client_id, title, body, status, created_by, created_at, updated_at").in("client_id", foundClientIds).order("created_at");
  const contracts = foundClientIds.length ? await fetchAll(contractsQuery) : [];
  trace("contracts");
  const contractIds = contracts.map((contract) => contract.id);
  const contractAcceptances = await fetchInBatches(contractIds, (ids) => supabase.from("contract_acceptances").select("id, contract_id, user_id, accepted_at, ip_address").in("contract_id", ids).order("accepted_at"));
  trace("contract-acceptances");
  const contractTemplates = await fetchAll(supabase.from("contract_templates").select("id, title, body, created_by, created_at, updated_at").order("created_at"));
  trace("contract-templates");

  let proposalsQuery = supabase.from("proposals").select("id,user_id,client_name,client_email,services,total_value,currency,scope_description,investment_description,deadline_days,locale,proposal_type,plan,pieces_quantity,status,token,expires_at,viewed_at,accepted_at,accepted_name,accepted_signature,accepted_ip,accepted_email,created_at,updated_at").order("created_at");
  if (!options.allClients && foundClients.length) proposalsQuery = proposalsQuery.in("client_name", foundClients.map((client) => client.name));
  const proposals = await fetchAll(proposalsQuery);
  trace("proposals");
  const proposalTemplates = await fetchAll(supabase.from("proposal_templates").select("id,user_id,name,services,currency,scope_description,investment_description,locale,created_at,updated_at").order("created_at"));
  trace("proposal-templates");

  const socialReportsQuery = supabase.from("social_reports").select("id,client_id,created_by,title,period_start,period_end,platform,locale,status,metrics,previous_metrics,best_content,worst_content,best_format,strategic_comment,recommendations,observations,template_id,created_at,updated_at").in("client_id", foundClientIds).order("created_at");
  const socialReports = foundClientIds.length ? await fetchAll(socialReportsQuery) : [];
  trace("social-reports");
  const socialReportTemplates = await fetchAll(supabase.from("social_report_templates").select("id,name,created_by,metric_fields,created_at").order("created_at"));
  trace("social-report-templates");

  const designBriefs = await fetchAll(supabase.from("design_briefs").select("id,user_id,client_id,title,category,locale,status,answers,brand_name,objectives,target_audience,style_preferences,preferred_colors,references_links,additional_notes,respondent_name,respondent_email,submitted_at,created_at,updated_at").order("created_at"));
  trace("design-briefs");
  const briefTemplates = await fetchAll(supabase.from("brief_templates").select("id,user_id,name,description,category,locale,questions,active,created_at,updated_at").order("created_at"));
  trace("brief-templates");

  const mediaManifest = uniqueMediaUrls(
    [...posts, ...calendarPosts, ...invoiceAttachments, ...textContents],
    [
      (row) =>
        row.image_url
          ? [
              {
                url: row.image_url,
                source: "posts.image_url",
                client_id: row.client_id,
                post_id: row.id,
              },
            ]
          : [],
      (row) =>
        Array.isArray(row.media_urls)
          ? row.media_urls.map((url) => ({
              url,
              source: row.publish_date ? "calendar_posts.media_urls" : "posts.media_urls",
              client_id: row.client_id,
              post_id: row.publish_date ? null : row.id,
              calendar_post_id: row.publish_date ? row.id : null,
            }))
          : [],
      (row) => row.file_url ? [{ url: row.file_url, source: "invoice_attachments.file_url", invoice_attachment_id: row.id, invoice_id: row.invoice_id }] : [],
      (row) => row.pdf_url ? [{ url: row.pdf_url, source: "text_contents.pdf_url", text_content_id: row.id, client_id: row.client_id }] : [],
    ],
  );

  const summary = {
    generated_at: new Date().toISOString(),
    mode: options.dryRun ? "dry-run" : "export",
    authenticated_as: currentUserId,
    detected_role: role,
    requested_clients: options.allClients ? ["ALL"] : options.clients,
    found_clients: foundClients.map((client) => ({
      id: client.id,
      name: client.name,
      slug: client.slug,
    })),
    missing_clients: missingClients,
    counts: {
      clients: foundClients.length,
      profiles: profiles.length,
      assignments: assignments.length,
      columns: columns.length,
      posts: posts.length,
      tags: tags.length,
      archived_posts: posts.filter((post) => post.archived).length,
      active_posts: posts.filter((post) => !post.archived).length,
      comments: comments.length,
      text_contents: textContents.length,
      text_content_comments: textContentComments.length,
      calendar_posts: calendarPosts.length,
      appointments: appointments.length,
      appointment_tags: appointmentTags.length,
      invoices: invoices.length,
      invoice_items: invoiceItems.length,
      invoice_attachments: invoiceAttachments.length,
      contracts: contracts.length,
      contract_acceptances: contractAcceptances.length,
      contract_templates: contractTemplates.length,
      proposals: proposals.length,
      proposal_templates: proposalTemplates.length,
      social_reports: socialReports.length,
      social_report_templates: socialReportTemplates.length,
      design_briefs: designBriefs.length,
      brief_templates: briefTemplates.length,
      media_manifest: mediaManifest.length,
    },
  };

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await ensureDir(options.outDir);
  await writeJson(path.join(options.outDir, "summary.json"), summary);
  await writeJson(path.join(options.outDir, "clients.json"), foundClients);
  await writeJson(
    path.join(options.outDir, "profiles.json"),
    pickAllowedProfiles(profiles, assignments),
  );
  await writeJson(path.join(options.outDir, "user_client_assignments.json"), assignments);
  await writeJson(path.join(options.outDir, "columns.json"), columns);
  await writeJson(path.join(options.outDir, "posts.json"), posts);
  await writeJson(path.join(options.outDir, "tags.json"), tags);
  await writeJson(path.join(options.outDir, "comments.json"), comments);
  await writeJson(path.join(options.outDir, "text_contents.json"), textContents);
  await writeJson(path.join(options.outDir, "text_content_comments.json"), textContentComments);
  await writeJson(path.join(options.outDir, "calendar_posts.json"), calendarPosts);
  await writeJson(path.join(options.outDir, "appointments.json"), appointments);
  await writeJson(path.join(options.outDir, "appointment_tags.json"), appointmentTags);
  await writeJson(path.join(options.outDir, "invoices.json"), invoices);
  await writeJson(path.join(options.outDir, "invoice_items.json"), invoiceItems);
  await writeJson(path.join(options.outDir, "invoice_attachments.json"), invoiceAttachments);
  await writeJson(path.join(options.outDir, "contracts.json"), contracts);
  await writeJson(path.join(options.outDir, "contract_acceptances.json"), contractAcceptances);
  await writeJson(path.join(options.outDir, "contract_templates.json"), contractTemplates);
  await writeJson(path.join(options.outDir, "proposals.json"), proposals);
  await writeJson(path.join(options.outDir, "proposal_templates.json"), proposalTemplates);
  await writeJson(path.join(options.outDir, "social_reports.json"), socialReports);
  await writeJson(path.join(options.outDir, "social_report_templates.json"), socialReportTemplates);
  await writeJson(path.join(options.outDir, "design_briefs.json"), designBriefs);
  await writeJson(path.join(options.outDir, "brief_templates.json"), briefTemplates);
  await writeJson(path.join(options.outDir, "media-manifest.json"), mediaManifest);

  console.log(`Export concluido em: ${options.outDir}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[export-priority-clients] Falha:", JSON.stringify({ message: error?.message || String(error), code: error?.code, details: error?.details, hint: error?.hint }));
  process.exitCode = 1;
});
