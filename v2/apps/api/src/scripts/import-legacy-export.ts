import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { loadEnv } from "../config/env.js";
import { hashPassword } from "../modules/auth/auth.crypto.js";
import { ensureInvoiceTables } from "../modules/invoices/invoices.repository.js";

type JsonRow = Record<string, unknown>;

type ExportBundle = {
  clients: JsonRow[];
  profiles: JsonRow[];
  assignments: JsonRow[];
  columns: JsonRow[];
  posts: JsonRow[];
  tags: JsonRow[];
  comments: JsonRow[];
  calendarPosts: JsonRow[];
  mediaManifest: JsonRow[];
  invoices: JsonRow[];
  invoiceItems: JsonRow[];
  invoiceAttachments: JsonRow[];
};

function parseArguments() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "../../../../..");
  return {
    commit: args.includes("--commit"),
    onlyInvoices: args.includes("--only-invoices"),
    inputDir:
      inputIndex >= 0 && args[inputIndex + 1]
        ? path.resolve(args[inputIndex + 1])
        : path.join(repositoryRoot, "migration-export/priority-clients"),
  };
}

async function resolveExistingClients(connection: PoolConnection, clients: JsonRow[]) {
  const clientMap = new Map<string, string>();
  for (const client of clients) {
    const legacyId = textValue(client, "id"); const slug = textValue(client, "slug", legacyId);
    const [rows] = await connection.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM client_accounts WHERE id = ? OR slug = ? LIMIT 1", [legacyId, slug]);
    if (!rows[0]) throw new Error(`O cliente “${textValue(client, "name", slug)}” ainda não existe na V2.`);
    clientMap.set(legacyId, rows[0].id);
  }
  return clientMap;
}

async function readRows(inputDir: string, fileName: string) {
  const contents = await readFile(path.join(inputDir, fileName), "utf8");
  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) throw new Error(`${fileName} precisa conter uma lista JSON.`);
  return parsed as JsonRow[];
}

async function readOptionalRows(inputDir: string, fileName: string) {
  try { return await readRows(inputDir, fileName); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

async function loadBundle(inputDir: string): Promise<ExportBundle> {
  const [clients, profiles, assignments, columns, posts, tags, comments, calendarPosts, mediaManifest, invoices, invoiceItems, invoiceAttachments] =
    await Promise.all([
      readRows(inputDir, "clients.json"),
      readRows(inputDir, "profiles.json"),
      readRows(inputDir, "user_client_assignments.json"),
      readRows(inputDir, "columns.json"),
      readRows(inputDir, "posts.json"),
      readRows(inputDir, "tags.json"),
      readRows(inputDir, "comments.json"),
      readRows(inputDir, "calendar_posts.json"),
      readRows(inputDir, "media-manifest.json"),
      readOptionalRows(inputDir, "invoices.json"),
      readOptionalRows(inputDir, "invoice_items.json"),
      readOptionalRows(inputDir, "invoice_attachments.json"),
    ]);
  return { clients, profiles, assignments, columns, posts, tags, comments, calendarPosts, mediaManifest, invoices, invoiceItems, invoiceAttachments };
}

function textValue(row: JsonRow, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

function nullableText(row: JsonRow, key: string) {
  const value = textValue(row, key).trim();
  return value || null;
}

function boolValue(row: JsonRow, key: string) {
  return row[key] === true || row[key] === 1 || row[key] === "1" ? 1 : 0;
}

function numberValue(row: JsonRow, key: string) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function jsonValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value ? [value] : []);
  return null;
}

function mysqlDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().replace("T", " ").replace(/Z$/, "");
  return normalized.length >= 19 ? normalized.slice(0, 19) : `${normalized.slice(0, 10)} 00:00:00`;
}

function normalizeGlobalRole(value: unknown): "super_admin" | "admin" | "colaborador" | "cliente" {
  const role = String(value ?? "").toLowerCase();
  if (role === "super_admin") return "super_admin";
  if (role === "admin") return "admin";
  if (["collaborator", "colaborador"].includes(role)) return "colaborador";
  return "cliente";
}

function normalizeMembershipRole(value: unknown): "admin" | "colaborador" | "cliente" {
  const role = normalizeGlobalRole(value);
  if (role === "super_admin" || role === "admin") return "admin";
  return role;
}

function normalizeCommentRole(value: unknown) {
  const role = String(value ?? "").toLowerCase();
  if (["super_admin", "admin", "colaborador", "cliente"].includes(role)) return role;
  if (role === "collaborator") return "colaborador";
  return "guest";
}

function legacyCommentToPlainText(value: unknown) {
  const source = String(value ?? "");
  if (!/<\/?[a-z][^>]*>/i.test(source)) return source.trim();
  const decoded = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/(li|p|div|h[1-6]|blockquote|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
  return decoded
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeCalendarStatus(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  if (["draft", "in_review", "approved", "scheduled", "published"].includes(status)) return status;
  const aliases: Record<string, string> = {
    rascunho: "draft",
    revisao: "in_review",
    "em revisão": "in_review",
    aprovado: "approved",
    agendado: "scheduled",
    publicado: "published",
  };
  return aliases[status] ?? "scheduled";
}

function validateBundle(bundle: ExportBundle) {
  const errors: string[] = [];
  const clientIds = new Set(bundle.clients.map((row) => textValue(row, "id")));
  const profileIds = new Set(bundle.profiles.map((row) => textValue(row, "id")));
  const columnIds = new Set(bundle.columns.map((row) => textValue(row, "id")));
  const postIds = new Set(bundle.posts.map((row) => textValue(row, "id")));
  const invoiceIds = new Set(bundle.invoices.map((row) => textValue(row, "id")));

  for (const [file, rows] of Object.entries({
    clients: bundle.clients,
    profiles: bundle.profiles,
    assignments: bundle.assignments,
    columns: bundle.columns,
    posts: bundle.posts,
    tags: bundle.tags,
    comments: bundle.comments,
    calendarPosts: bundle.calendarPosts,
    invoices: bundle.invoices,
    invoiceItems: bundle.invoiceItems,
    invoiceAttachments: bundle.invoiceAttachments,
  })) {
    rows.forEach((row, index) => {
      if (!textValue(row, "id")) errors.push(`${file}[${index}] não possui id.`);
    });
  }
  bundle.profiles.forEach((row) => {
    if (!textValue(row, "email").trim()) errors.push(`Perfil ${textValue(row, "id")} não possui email.`);
  });
  bundle.assignments.forEach((row) => {
    if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Vínculo ${textValue(row, "id")} aponta para cliente ausente.`);
    if (!profileIds.has(textValue(row, "user_id"))) errors.push(`Vínculo ${textValue(row, "id")} aponta para perfil ausente.`);
  });
  bundle.columns.forEach((row) => {
    if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Coluna ${textValue(row, "id")} aponta para cliente ausente.`);
  });
  bundle.posts.forEach((row) => {
    if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Card ${textValue(row, "id")} aponta para cliente ausente.`);
    const columnId = textValue(row, "column_id");
    if (columnId && !columnIds.has(columnId)) errors.push(`Card ${textValue(row, "id")} aponta para coluna ausente.`);
  });
  bundle.tags.forEach((row) => {
    const clientId = textValue(row, "client_id");
    if (clientId && !clientIds.has(clientId)) errors.push(`Etiqueta ${textValue(row, "id")} aponta para cliente ausente.`);
  });
  bundle.comments.forEach((row) => {
    if (!postIds.has(textValue(row, "post_id"))) errors.push(`Comentário ${textValue(row, "id")} aponta para card ausente.`);
  });
  bundle.calendarPosts.forEach((row) => {
    if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Calendário ${textValue(row, "id")} aponta para cliente ausente.`);
  });
  bundle.invoices.forEach((row) => { if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Fatura ${textValue(row, "id")} aponta para cliente ausente.`); });
  bundle.invoiceItems.forEach((row) => { if (!invoiceIds.has(textValue(row, "invoice_id"))) errors.push(`Item ${textValue(row, "id")} aponta para fatura ausente.`); });
  bundle.invoiceAttachments.forEach((row) => { if (!invoiceIds.has(textValue(row, "invoice_id"))) errors.push(`Anexo ${textValue(row, "id")} aponta para fatura ausente.`); });
  return errors;
}

function printSummary(bundle: ExportBundle, inputDir: string, commit: boolean) {
  console.log(JSON.stringify({
    mode: commit ? "commit" : "dry-run",
    input: inputDir,
    counts: {
      clients: bundle.clients.length,
      profiles: bundle.profiles.length,
      assignments: bundle.assignments.length,
      columns: bundle.columns.length,
      posts: bundle.posts.length,
      tags: bundle.tags.length,
      comments: bundle.comments.length,
      calendar_posts: bundle.calendarPosts.length,
      invoices: bundle.invoices.length,
      invoice_items: bundle.invoiceItems.length,
      invoice_attachments: bundle.invoiceAttachments.length,
      media_files_pending_copy: bundle.mediaManifest.length,
    },
  }, null, 2));
}

async function resolveUsers(connection: PoolConnection, profiles: JsonRow[]) {
  const userMap = new Map<string, string>();
  const roleByLegacyId = new Map<string, ReturnType<typeof normalizeGlobalRole>>();
  for (const profile of profiles) {
    const legacyId = textValue(profile, "id");
    const email = textValue(profile, "email").trim().toLowerCase();
    const role = normalizeGlobalRole(profile.role);
    const [existing] = await connection.query<Array<RowDataPacket & { id: string }>>(
      "SELECT id FROM users WHERE id = ? OR email = ? LIMIT 1",
      [legacyId, email],
    );
    const destinationId = existing[0]?.id ?? legacyId;
    userMap.set(legacyId, destinationId);
    roleByLegacyId.set(legacyId, role);
    if (existing.length > 0) {
      await connection.query(
        "UPDATE users SET full_name = ?, avatar_url = COALESCE(?, avatar_url), locale = COALESCE(NULLIF(?, ''), locale) WHERE id = ?",
        [textValue(profile, "full_name", email), nullableText(profile, "avatar_url"), textValue(profile, "locale", "pt"), destinationId],
      );
    } else {
      const unusablePassword = await hashPassword(crypto.randomBytes(32).toString("hex"));
      await connection.query(
        "INSERT INTO users (id, full_name, email, password_hash, global_role, avatar_url, locale, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
        [destinationId, textValue(profile, "full_name", email), email, unusablePassword, role, nullableText(profile, "avatar_url"), textValue(profile, "locale", "pt")],
      );
    }
  }
  return { userMap, roleByLegacyId };
}

async function importInvoiceRecords(connection: PoolConnection, bundle: ExportBundle, clientMap: Map<string, string>, userMap = new Map<string, string>()) {
  const clientsByLegacyId = new Map(bundle.clients.map((client) => [textValue(client, "id"), client]));
  for (const invoice of bundle.invoices) {
    const legacyId = textValue(invoice, "id"); const legacyClientId = textValue(invoice, "client_id"); const client = clientsByLegacyId.get(legacyClientId) ?? {};
    const currency = ["BRL", "EUR", "USD", "SEK"].includes(textValue(client, "billing_currency").toUpperCase()) ? textValue(client, "billing_currency").toUpperCase() : "BRL";
    const locale = ["pt", "en", "it", "es", "sv"].includes(textValue(client, "locale")) ? textValue(client, "locale") : "pt";
    const status = ["open", "paid", "overdue", "cancelled"].includes(textValue(invoice, "status")) ? textValue(invoice, "status") : "open";
    const period = [textValue(invoice, "period_start"), textValue(invoice, "period_end")].filter(Boolean).join(" - ");
    await connection.query(`INSERT INTO invoices (id, client_account_id, invoice_number, title, recipient_name, recipient_email, recipient_address, recipient_country, recipient_tax_id, issue_date, due_date, period_label, currency, locale, status, recurring, fixed_amount, visible_to_client, sent_at, notes, created_by_user_id, legacy_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE client_account_id=VALUES(client_account_id), invoice_number=VALUES(invoice_number), title=VALUES(title), due_date=VALUES(due_date), status=VALUES(status), visible_to_client=VALUES(visible_to_client), notes=VALUES(notes)`,
      [legacyId, clientMap.get(legacyClientId), numberValue(invoice, "invoice_number"), textValue(invoice, "title", "Fatura"), textValue(client, "name"), textValue(client, "address"), textValue(client, "country"), textValue(client, "tax_id"), textValue(invoice, "issue_date", new Date().toISOString().slice(0, 10)), textValue(invoice, "due_date", new Date().toISOString().slice(0, 10)), period, currency, locale, status, boolValue(client, "billing_recurrence_active"), boolValue(invoice, "client_visible"), boolValue(invoice, "client_visible") ? mysqlDateTime(invoice.updated_at) ?? new Date() : null, textValue(invoice, "notes"), userMap.get(textValue(invoice, "created_by")) ?? null, legacyId, mysqlDateTime(invoice.created_at), mysqlDateTime(invoice.updated_at)]);
  }
  for (const item of bundle.invoiceItems) {
    const description = textValue(item, "description") || textValue(item, "name", "Serviço");
    await connection.query("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, position, legacy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE description=VALUES(description), quantity=VALUES(quantity), unit_price=VALUES(unit_price)", [textValue(item, "id"), textValue(item, "invoice_id"), description, numberValue(item, "quantity") || 1, numberValue(item, "unit_price"), 0, textValue(item, "id"), mysqlDateTime(item.created_at)]);
  }
  for (const attachment of bundle.invoiceAttachments) {
    await connection.query("INSERT INTO invoice_attachments (id, invoice_id, file_name, file_url, uploaded_by_user_id, legacy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE file_name=VALUES(file_name), file_url=VALUES(file_url)", [textValue(attachment, "id"), textValue(attachment, "invoice_id"), textValue(attachment, "file_name", "Documento"), textValue(attachment, "file_url"), userMap.get(textValue(attachment, "uploaded_by")) ?? null, textValue(attachment, "id"), mysqlDateTime(attachment.created_at)]);
  }
}

async function importBundle(connection: PoolConnection, bundle: ExportBundle) {
  const { userMap, roleByLegacyId } = await resolveUsers(connection, bundle.profiles);
  const clientMap = new Map<string, string>();
  const legacyTagsById = new Map(bundle.tags.map((tag) => [textValue(tag, "id"), tag]));
  const defaultTagIds = new Set(["seo", "alterado", "agendado", "publicado"]);

  for (const client of bundle.clients) {
    const legacyId = textValue(client, "id");
    const slug = textValue(client, "slug", legacyId);
    const [existing] = await connection.query<Array<RowDataPacket & { id: string }>>(
      "SELECT id FROM client_accounts WHERE id = ? OR slug = ? LIMIT 1",
      [legacyId, slug],
    );
    const destinationId = existing[0]?.id ?? legacyId;
    clientMap.set(legacyId, destinationId);
    const values = [
      textValue(client, "name", slug), slug, userMap.get(textValue(client, "owner_id")) ?? null,
      nullableText(client, "logo_url"), textValue(client, "locale", "pt"),
      textValue(client, "client_portal_title", "Portal do Cliente"), boolValue(client, "show_upcoming_posts"),
      boolValue(client, "show_archived_to_client"), boolValue(client, "tracking_enabled"),
      boolValue(client, "tracking_visible_to_client"), nullableText(client, "calendar_color"), destinationId,
    ];
    if (existing.length > 0) {
      // The V2 account owns its portal configuration after the first import.
      // A legacy sync is only meant to bring over content, never to undo the
      // locale, portal visibility, tracking, or permissions configured here.
      await connection.query(
        "UPDATE client_accounts SET name = ?, logo_url = COALESCE(?, logo_url) WHERE id = ?",
        [textValue(client, "name", slug), nullableText(client, "logo_url"), destinationId],
      );
    } else {
      await connection.query("INSERT INTO client_accounts (name, slug, owner_user_id, logo_url, locale, portal_title, show_upcoming_posts, show_archived_to_client, tracking_enabled, tracking_visible_to_client, calendar_color, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values);
      await connection.query(
        "INSERT INTO client_permissions (id, client_account_id, allow_client_edit_caption, allow_client_create_post, allow_client_create_tags, allow_client_download, allow_client_edit_brand_brain, allow_client_view_invoices, allow_client_view_brand_brain, allow_client_view_tracking) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), destinationId, boolValue(client, "allow_client_edit_caption"), boolValue(client, "allow_client_create_post"), boolValue(client, "allow_client_create_tags"), boolValue(client, "allow_client_download"), boolValue(client, "allow_client_edit_brand_brain"), boolValue(client, "show_invoices_to_client"), boolValue(client, "allow_client_edit_brand_brain"), boolValue(client, "tracking_visible_to_client")],
      );
    }
  }

  for (const assignment of bundle.assignments) {
    const legacyUserId = textValue(assignment, "user_id");
    const userId = userMap.get(legacyUserId)!;
    const clientId = clientMap.get(textValue(assignment, "client_id"))!;
    await connection.query(
      "INSERT INTO client_memberships (id, user_id, client_account_id, membership_role, assigned_by_user_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE membership_role=VALUES(membership_role)",
      [textValue(assignment, "id"), userId, clientId, normalizeMembershipRole(roleByLegacyId.get(legacyUserId)), userMap.get(textValue(assignment, "assigned_by")) ?? null],
    );
  }

  for (const column of bundle.columns) {
    await connection.query(
      "INSERT INTO kanban_columns (id, client_account_id, name, color, position, visible_to_client) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), color=VALUES(color), position=VALUES(position)",
      [textValue(column, "id"), clientMap.get(textValue(column, "client_id")), textValue(column, "name", "Sem nome"), nullableText(column, "color"), numberValue(column, "position"), boolValue(column, "visible_to_client")],
    );
  }

  const tagsByClient = new Map<string, Map<string, JsonRow>>();
  for (const client of bundle.clients) {
    const legacyClientId = textValue(client, "id");
    const clientTags = new Map<string, JsonRow>();
    for (const tag of bundle.tags) {
      if (textValue(tag, "client_id") === legacyClientId || defaultTagIds.has(textValue(tag, "id"))) {
        clientTags.set(textValue(tag, "name").trim().toLocaleLowerCase(), tag);
      }
    }
    for (const post of bundle.posts.filter((item) => textValue(item, "client_id") === legacyClientId)) {
      const values = Array.isArray(post.tags) ? post.tags : [];
      for (const value of values) {
        const tag = legacyTagsById.get(String(value));
        if (tag) clientTags.set(textValue(tag, "name").trim().toLocaleLowerCase(), tag);
      }
    }
    tagsByClient.set(legacyClientId, clientTags);
  }

  for (const [legacyClientId, tags] of tagsByClient) {
    const clientAccountId = clientMap.get(legacyClientId);
    if (!clientAccountId) continue;
    for (const tag of tags.values()) {
      await connection.query(
        "INSERT INTO client_tags (id, client_account_id, name, color, legacy_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE color=VALUES(color), legacy_id=COALESCE(client_tags.legacy_id, VALUES(legacy_id))",
        [crypto.randomUUID(), clientAccountId, textValue(tag, "name", "Etiqueta"), textValue(tag, "color", "#5e5cf1"), textValue(tag, "id")],
      );
    }
  }

  for (const post of bundle.posts) {
    const mappedTags = (Array.isArray(post.tags) ? post.tags : []).map((value) => textValue(legacyTagsById.get(String(value)) ?? {}, "name", String(value)));
    await connection.query(
      "INSERT INTO kanban_cards (id, client_account_id, column_id, title, caption, media_type, primary_media_url, media_urls_json, art_type, status_json, tags_json, keep_files, deadline_at, published_at, archived, archived_at, client_label, event_color, position, legacy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE column_id=VALUES(column_id), title=VALUES(title), caption=VALUES(caption), media_type=VALUES(media_type), primary_media_url=VALUES(primary_media_url), media_urls_json=VALUES(media_urls_json), art_type=VALUES(art_type), status_json=VALUES(status_json), tags_json=VALUES(tags_json), keep_files=VALUES(keep_files), deadline_at=VALUES(deadline_at), published_at=VALUES(published_at), archived=VALUES(archived), archived_at=VALUES(archived_at), client_label=VALUES(client_label), event_color=VALUES(event_color), position=VALUES(position)",
      [textValue(post, "id"), clientMap.get(textValue(post, "client_id")), nullableText(post, "column_id"), textValue(post, "title", "Sem título"), nullableText(post, "caption"), textValue(post, "media_type", "image"), nullableText(post, "image_url"), jsonValue(post.media_urls), textValue(post, "art_type", "single_post"), jsonValue(post.status), jsonValue(mappedTags), boolValue(post, "retain_files"), mysqlDateTime(post.deadline), mysqlDateTime(post.published_at), boolValue(post, "archived"), mysqlDateTime(post.archived_at), textValue(post, "client_label", "pendente"), nullableText(post, "event_color"), numberValue(post, "position"), textValue(post, "id")],
    );
  }

  for (const comment of bundle.comments) {
    const legacyUserId = textValue(comment, "user_id");
    await connection.query(
      "INSERT INTO card_comments (id, card_id, user_id, author_name, author_role, comment_text, is_internal, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, COALESCE(?, CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE author_name=VALUES(author_name), comment_text=VALUES(comment_text)",
      [textValue(comment, "id"), textValue(comment, "post_id"), userMap.get(legacyUserId) ?? null, textValue(comment, "author", "Usuário legado"), normalizeCommentRole(roleByLegacyId.get(legacyUserId)), legacyCommentToPlainText(comment.text), mysqlDateTime(comment.created_at)],
    );
  }

  await connection.query("UPDATE kanban_cards card SET comments_count_cache = (SELECT COUNT(*) FROM card_comments comment WHERE comment.card_id = card.id) WHERE card.legacy_id IS NOT NULL");

  for (const event of bundle.calendarPosts) {
    await connection.query(
      "INSERT INTO card_calendar_events (id, client_account_id, card_id, title, caption, media_type, media_urls_json, publish_date, publish_time, status, event_color, created_by_user_id) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), caption=VALUES(caption), media_type=VALUES(media_type), media_urls_json=VALUES(media_urls_json), publish_date=VALUES(publish_date), publish_time=VALUES(publish_time), status=VALUES(status), event_color=VALUES(event_color)",
      [textValue(event, "id"), clientMap.get(textValue(event, "client_id")), textValue(event, "title", "Sem título"), nullableText(event, "caption"), textValue(event, "media_type", "image"), jsonValue(event.media_urls), textValue(event, "publish_date"), nullableText(event, "publish_time"), normalizeCalendarStatus(event.status), nullableText(event, "event_color"), userMap.get(textValue(event, "created_by")) ?? null],
    );
  }

  await importInvoiceRecords(connection, bundle, clientMap, userMap);
}

async function main() {
  const options = parseArguments();
  const bundle = await loadBundle(options.inputDir);
  const errors = validateBundle(bundle);
  printSummary(bundle, options.inputDir, options.commit);
  if (errors.length > 0) {
    console.error(JSON.stringify({ validation_errors: errors }, null, 2));
    throw new Error("A exportação possui referências inválidas e não pode ser importada.");
  }
  if (!options.commit) {
    console.log("Simulação concluída. Nenhum dado foi gravado. Use --commit somente após conferir o resumo.");
    return;
  }

  const env = loadEnv();
  const pool = mysql.createPool({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, connectionLimit: 2 });
  await ensureInvoiceTables(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (options.onlyInvoices) {
      const clientMap = await resolveExistingClients(connection, bundle.clients);
      await importInvoiceRecords(connection, bundle, clientMap);
    } else {
      await importBundle(connection, bundle);
    }
    await connection.commit();
    console.log("Importação concluída. Novos usuários foram mantidos inativos até a definição de senha.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[import-legacy-export] Falha:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
