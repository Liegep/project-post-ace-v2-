import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { loadEnv } from "../config/env.js";
import { hashPassword } from "../modules/auth/auth.crypto.js";
import { ensureInvoiceTables } from "../modules/invoices/invoices.repository.js";
import { ensureContractTables } from "../modules/contracts/contracts.repository.js";
import { ensureProposalTables } from "../modules/proposals/proposals.repository.js";
import { ensureDesignBriefTables } from "../modules/design-briefs/design-briefs.repository.js";

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
  contracts: JsonRow[];
  contractAcceptances: JsonRow[];
  contractTemplates: JsonRow[];
  proposals: JsonRow[];
  proposalTemplates: JsonRow[];
  socialReports: JsonRow[];
  socialReportTemplates: JsonRow[];
  designBriefs: JsonRow[];
  briefTemplates: JsonRow[];
  textContents: JsonRow[];
  textContentComments: JsonRow[];
  brandBrains: JsonRow[];
  brandVocabulary: JsonRow[];
  brandVoices: JsonRow[];
  visualDirections: JsonRow[];
  wordsToAvoid: JsonRow[];
  approvedExpressions: JsonRow[];
  contentPillars: JsonRow[];
};

function parseArguments() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "../../../../..");
  return {
    commit: args.includes("--commit"),
    onlyInvoices: args.includes("--only-invoices"),
    onlyContracts: args.includes("--only-contracts"),
    onlyProposals: args.includes("--only-proposals"),
    onlyReports: args.includes("--only-reports"),
    onlyDesignBriefs: args.includes("--only-design-briefs"),
    onlyTexts: args.includes("--only-texts"),
    onlyBrandBrain: args.includes("--only-brand-brain"),
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
  const [clients, profiles, assignments, columns, posts, tags, comments, calendarPosts, mediaManifest, invoices, invoiceItems, invoiceAttachments, contracts, contractAcceptances, contractTemplates, proposals, proposalTemplates, socialReports, socialReportTemplates, designBriefs, briefTemplates, textContents, textContentComments, brandBrains, brandVocabulary, brandVoices, visualDirections, wordsToAvoid, approvedExpressions, contentPillars] =
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
      readOptionalRows(inputDir, "contracts.json"),
      readOptionalRows(inputDir, "contract_acceptances.json"),
      readOptionalRows(inputDir, "contract_templates.json"),
      readOptionalRows(inputDir, "proposals.json"),
      readOptionalRows(inputDir, "proposal_templates.json"),
      readOptionalRows(inputDir, "social_reports.json"),
      readOptionalRows(inputDir, "social_report_templates.json"),
      readOptionalRows(inputDir, "design_briefs.json"),
      readOptionalRows(inputDir, "brief_templates.json"),
      readOptionalRows(inputDir, "text_contents.json"),
      readOptionalRows(inputDir, "text_content_comments.json"),
      readOptionalRows(inputDir, "brand_brains.json"),
      readOptionalRows(inputDir, "brand_vocabulary.json"),
      readOptionalRows(inputDir, "brand_voice.json"),
      readOptionalRows(inputDir, "visual_directions.json"),
      readOptionalRows(inputDir, "words_to_avoid.json"),
      readOptionalRows(inputDir, "approved_expressions.json"),
      readOptionalRows(inputDir, "content_pillars.json"),
    ]);
  return { clients, profiles, assignments, columns, posts, tags, comments, calendarPosts, mediaManifest, invoices, invoiceItems, invoiceAttachments, contracts, contractAcceptances, contractTemplates, proposals, proposalTemplates, socialReports, socialReportTemplates, designBriefs, briefTemplates, textContents, textContentComments, brandBrains, brandVocabulary, brandVoices, visualDirections, wordsToAvoid, approvedExpressions, contentPillars };
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
  if (role === "client") return "cliente";
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
  const contractIds = new Set(bundle.contracts.map((row) => textValue(row, "id")));
  const textContentIds = new Set(bundle.textContents.map((row) => textValue(row, "id")));

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
    contracts: bundle.contracts,
    contractAcceptances: bundle.contractAcceptances,
    contractTemplates: bundle.contractTemplates,
    proposals: bundle.proposals,
    proposalTemplates: bundle.proposalTemplates,
    designBriefs: bundle.designBriefs,
    briefTemplates: bundle.briefTemplates,
    textContents: bundle.textContents,
    textContentComments: bundle.textContentComments,
    brandBrains: bundle.brandBrains,
    brandVocabulary: bundle.brandVocabulary,
    brandVoices: bundle.brandVoices,
    visualDirections: bundle.visualDirections,
    wordsToAvoid: bundle.wordsToAvoid,
    approvedExpressions: bundle.approvedExpressions,
    contentPillars: bundle.contentPillars,
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
  bundle.contracts.forEach((row) => { if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Contrato ${textValue(row, "id")} aponta para cliente ausente.`); });
  bundle.contractAcceptances.forEach((row) => { if (!contractIds.has(textValue(row, "contract_id"))) errors.push(`Aceite ${textValue(row, "id")} aponta para contrato ausente.`); });
  bundle.socialReports.forEach((row) => { if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Relatório ${textValue(row, "id")} aponta para cliente ausente.`); });
  bundle.designBriefs.forEach((row) => { const clientId = textValue(row, "client_id"); if (clientId && !clientIds.has(clientId)) errors.push(`Brief ${textValue(row, "id")} aponta para cliente ausente.`); });
  bundle.textContents.forEach((row) => { if (!clientIds.has(textValue(row, "client_id"))) errors.push(`Texto ${textValue(row, "id")} aponta para cliente ausente.`); });
  bundle.textContentComments.forEach((row) => { if (!textContentIds.has(textValue(row, "text_content_id"))) errors.push(`Comentário de texto ${textValue(row, "id")} aponta para texto ausente.`); });
  for (const [label, rows] of [["Brand Brain", bundle.brandBrains], ["Vocabulário", bundle.brandVocabulary], ["Voz", bundle.brandVoices], ["Direção visual", bundle.visualDirections], ["Palavra a evitar", bundle.wordsToAvoid], ["Expressão", bundle.approvedExpressions], ["Pilar", bundle.contentPillars]] as const) rows.forEach((row) => { if (!clientIds.has(textValue(row, "client_id"))) errors.push(`${label} ${textValue(row, "id")} aponta para cliente ausente.`); });
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
      contracts: bundle.contracts.length,
      contract_acceptances: bundle.contractAcceptances.length,
      contract_templates: bundle.contractTemplates.length,
      proposals: bundle.proposals.length,
      proposal_templates: bundle.proposalTemplates.length,
      social_reports: bundle.socialReports.length,
      social_report_templates: bundle.socialReportTemplates.length,
      design_briefs: bundle.designBriefs.length,
      brief_templates: bundle.briefTemplates.length,
      text_contents: bundle.textContents.length,
      text_content_comments: bundle.textContentComments.length,
      brand_brains: bundle.brandBrains.length,
      brand_vocabulary: bundle.brandVocabulary.length,
      brand_voice: bundle.brandVoices.length,
      visual_directions: bundle.visualDirections.length,
      words_to_avoid: bundle.wordsToAvoid.length,
      approved_expressions: bundle.approvedExpressions.length,
      content_pillars: bundle.contentPillars.length,
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

async function resolveExistingUsers(connection: PoolConnection, profiles: JsonRow[]) {
  const userMap = new Map<string, string>();
  for (const profile of profiles) {
    const legacyId=textValue(profile,"id"); const email=textValue(profile,"email").trim().toLowerCase();
    const [rows]=await connection.query<Array<RowDataPacket & {id:string}>>("SELECT id FROM users WHERE id=? OR email=? LIMIT 1",[legacyId,email]);
    if(rows[0]) userMap.set(legacyId,rows[0].id);
  }
  return userMap;
}

function normalizeContractStatus(value: unknown): "pending" | "accepted" | "cancelled" { const status=String(value??"").toLowerCase(); return status==="accepted"||status==="cancelled"?status:"pending"; }
function inferContractLanguage(titleValue: unknown) {
  const title = String(titleValue ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/\b(ACCORDO|TERMINI|SERVIZI|COLLABORAZIONE)\b/.test(title)) return "Italiano";
  if (/\b(TERMS|SERVICES|AGREEMENT|ACCEPTANCE)\b/.test(title)) return "English";
  if (/\b(TERMINOS|PRESTACION|ACEPTACION)\b/.test(title)) return "Español";
  if (/\b(VILLKOR|TJANSTER|DIGITALT|GODKANNANDE)\b/.test(title)) return "Svenska";
  return "Português";
}
async function importContractRecords(connection: PoolConnection,bundle:ExportBundle,clientMap:Map<string,string>,userMap:Map<string,string>){
  for(const contract of bundle.contracts){const legacyId=textValue(contract,"id");await connection.query(`INSERT INTO contracts (id,client_account_id,title,body_html,language,contract_type,start_date,end_date,contract_value,scope_text,notes,status,created_by_user_id,legacy_id,created_at,updated_at) VALUES (?,?,?,?,?,'',NULL,NULL,'','','',?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE client_account_id=VALUES(client_account_id),title=VALUES(title),body_html=VALUES(body_html),language=VALUES(language),status=VALUES(status),updated_at=VALUES(updated_at)`,[legacyId,clientMap.get(textValue(contract,"client_id")),textValue(contract,"title","Contrato"),textValue(contract,"body"),inferContractLanguage(contract.title),normalizeContractStatus(contract.status),userMap.get(textValue(contract,"created_by"))??null,legacyId,mysqlDateTime(contract.created_at),mysqlDateTime(contract.updated_at)]);}
  for(const acceptance of bundle.contractAcceptances){await connection.query("INSERT INTO contract_acceptances (id,contract_id,user_id,accepted_at,ip_address,legacy_id) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE accepted_at=VALUES(accepted_at),ip_address=VALUES(ip_address)",[textValue(acceptance,"id"),textValue(acceptance,"contract_id"),userMap.get(textValue(acceptance,"user_id"))??null,mysqlDateTime(acceptance.accepted_at)??new Date(),textValue(acceptance,"ip_address"),textValue(acceptance,"id")]);}
  for(const template of bundle.contractTemplates){const legacyId=textValue(template,"id");await connection.query("INSERT INTO contract_templates (id,name,body_html,language,description,draft_json,created_by_user_id,legacy_id,created_at,updated_at) VALUES (?,?,?,?,?,NULL,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE name=VALUES(name),body_html=VALUES(body_html),language=VALUES(language),updated_at=VALUES(updated_at)",[legacyId,textValue(template,"title","Modelo de contrato"),textValue(template,"body"),inferContractLanguage(template.title),"Modelo importado da V1.",userMap.get(textValue(template,"created_by"))??null,legacyId,mysqlDateTime(template.created_at),mysqlDateTime(template.updated_at)]);}
}

function proposalLocale(value: unknown) { const locale=String(value??"").toLowerCase(); return locale.startsWith("en")?"English":locale.startsWith("es")?"Español":locale.startsWith("it")?"Italiano":locale.startsWith("sv")?"Svenska":"Português"; }
function proposalCurrency(value: unknown) { const currency=String(value??"BRL").toUpperCase(); return currency==="EUR"?"€":currency==="USD"?"$":currency==="SEK"?"kr":"R$"; }
function proposalStatus(value: unknown) { const status=String(value??"draft").toLowerCase(); return ["draft","sent","viewed","accepted","expired"].includes(status)?status:"draft"; }
async function importProposalRecords(connection:PoolConnection,bundle:ExportBundle,userMap:Map<string,string>){
  for(const proposal of bundle.proposals){const legacyId=textValue(proposal,"id");await connection.query(`INSERT INTO proposals (id,token,client_name,client_email,locale,proposal_type,plan,pieces_quantity,scope_description,investment_description,currency,expires_at,status,services_json,accepted_at,viewed_at,created_by_user_id,legacy_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE client_name=VALUES(client_name),client_email=VALUES(client_email),locale=VALUES(locale),proposal_type=VALUES(proposal_type),plan=VALUES(plan),pieces_quantity=VALUES(pieces_quantity),scope_description=VALUES(scope_description),investment_description=VALUES(investment_description),currency=VALUES(currency),expires_at=VALUES(expires_at),status=VALUES(status),services_json=VALUES(services_json),accepted_at=VALUES(accepted_at),viewed_at=VALUES(viewed_at),updated_at=VALUES(updated_at)`,[legacyId,textValue(proposal,"token",crypto.randomBytes(24).toString("hex")),textValue(proposal,"client_name"),textValue(proposal,"client_email"),proposalLocale(proposal.locale),textValue(proposal,"proposal_type","Projeto"),textValue(proposal,"plan"),numberValue(proposal,"pieces_quantity"),textValue(proposal,"scope_description"),textValue(proposal,"investment_description"),proposalCurrency(proposal.currency),mysqlDateTime(proposal.expires_at)??new Date(Date.now()+7*86400000),proposalStatus(proposal.status),JSON.stringify(Array.isArray(proposal.services)?proposal.services:[]),mysqlDateTime(proposal.accepted_at),mysqlDateTime(proposal.viewed_at),userMap.get(textValue(proposal,"user_id"))??null,legacyId,mysqlDateTime(proposal.created_at),mysqlDateTime(proposal.updated_at)]);}
  for(const template of bundle.proposalTemplates){const legacyId=textValue(template,"id");await connection.query("INSERT INTO proposal_templates (id,name,locale,currency,scope_description,investment_description,services_json,created_by_user_id,legacy_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE name=VALUES(name),locale=VALUES(locale),currency=VALUES(currency),scope_description=VALUES(scope_description),investment_description=VALUES(investment_description),services_json=VALUES(services_json),updated_at=VALUES(updated_at)",[legacyId,textValue(template,"name","Modelo de proposta"),proposalLocale(template.locale),proposalCurrency(template.currency),textValue(template,"scope_description"),textValue(template,"investment_description"),JSON.stringify(Array.isArray(template.services)?template.services:[]),userMap.get(textValue(template,"user_id"))??null,legacyId,mysqlDateTime(template.created_at),mysqlDateTime(template.updated_at)]);}
}

function reportMetric(metrics: unknown, ...keys: string[]) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return 0;
  for (const key of keys) {
    const parsed = Number((metrics as JsonRow)[key]);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

function legacyReportNotes(report: JsonRow) {
  return [
    ["Observações", textValue(report, "observations")],
    ["Comentário estratégico", textValue(report, "strategic_comment")],
    ["Recomendações", textValue(report, "recommendations")],
    ["Melhor conteúdo", textValue(report, "best_content")],
    ["Formato de melhor desempenho", textValue(report, "best_format")],
    ["Conteúdo com menor desempenho", textValue(report, "worst_content")],
  ].filter(([, value]) => value).map(([label, value]) => `${label}:\n${value}`).join("\n\n") || null;
}

async function ensureReportMigrationTables(connection: PoolConnection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS report_templates (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    metric_fields_json JSON NOT NULL,
    created_by_user_id CHAR(36) NULL,
    legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_report_templates_legacy_id (legacy_id),
    CONSTRAINT fk_report_templates_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function importReportRecords(connection: PoolConnection, bundle: ExportBundle, clientMap: Map<string, string>, userMap: Map<string, string>) {
  await ensureReportMigrationTables(connection);
  for (const report of bundle.socialReports) {
    const legacyId = textValue(report, "id");
    const platform = textValue(report, "platform", "instagram").toLowerCase() === "facebook" ? "facebook" : "instagram";
    const metrics = report.metrics;
    const channelMetrics = {
      reach: reportMetric(metrics, "reach"),
      impressions: reportMetric(metrics, "impressions", "views"),
      engagement: reportMetric(metrics, "engagement", "content_interactions", "interactions"),
      followers: reportMetric(metrics, "followers", "followers_gained"),
      visits: reportMetric(metrics, "profile_visits"),
      clicks: reportMetric(metrics, "clicks", "link_clicks"),
    };
    const emptyChannel = { reach: 0, impressions: 0, engagement: 0, followers: 0, visits: 0, clicks: 0 };
    const normalizedMetrics = { instagram: platform === "instagram" ? channelMetrics : emptyChannel, facebook: platform === "facebook" ? channelMetrics : emptyChannel };
    const bestContent = textValue(report, "best_content");
    const highlights = bestContent ? [{ channel: platform, title: bestContent.slice(0, 255), value: channelMetrics.reach }] : [];
    const status = textValue(report, "status").toLowerCase() === "published" ? "published" : "draft";
    await connection.query(`INSERT INTO client_reports (id,client_account_id,title,period_start,period_end,status,metrics_json,highlights_json,evidence_urls_json,notes,created_by_user_id,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE client_account_id=VALUES(client_account_id),title=VALUES(title),period_start=VALUES(period_start),period_end=VALUES(period_end),status=VALUES(status),metrics_json=VALUES(metrics_json),highlights_json=VALUES(highlights_json),notes=VALUES(notes),published_at=VALUES(published_at),updated_at=VALUES(updated_at)`, [legacyId, clientMap.get(textValue(report, "client_id")), textValue(report, "title", "Relatório"), textValue(report, "period_start"), textValue(report, "period_end"), status, JSON.stringify(normalizedMetrics), JSON.stringify(highlights), JSON.stringify([]), legacyReportNotes(report), userMap.get(textValue(report, "created_by")) ?? null, status === "published" ? mysqlDateTime(report.updated_at) ?? new Date() : null, mysqlDateTime(report.created_at), mysqlDateTime(report.updated_at)]);
  }
  for (const template of bundle.socialReportTemplates) {
    const legacyId = textValue(template, "id");
    await connection.query("INSERT INTO report_templates (id,name,metric_fields_json,created_by_user_id,legacy_id,created_at) VALUES (?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE name=VALUES(name),metric_fields_json=VALUES(metric_fields_json)", [legacyId, textValue(template, "name", "Modelo de relatório"), JSON.stringify(Array.isArray(template.metric_fields) ? template.metric_fields : []), userMap.get(textValue(template, "created_by")) ?? null, legacyId, mysqlDateTime(template.created_at)]);
  }
}

const legacyBriefLabels: Record<string, string> = {
  company_name: "Qual é o nome da empresa ou profissional?",
  profile_name: "Qual é o nome do perfil?",
  social_networks: "Em quais redes sociais sua marca está presente?",
  main_objective: "Qual é o principal objetivo nas redes sociais?",
  target_audience: "Quem é o público-alvo?",
  products_to_promote: "Quais produtos ou serviços deseja promover?",
  tone_of_voice: "Qual tom de voz deve ser usado?",
  topics: "Quais assuntos devem aparecer no conteúdo?",
  topics_to_avoid: "Quais assuntos devem ser evitados?",
  differentials: "Quais são os principais diferenciais da marca?",
  competitors: "Quem são os principais concorrentes?",
  reference_profiles: "Quais perfis são referência para a marca?",
  posting_frequency: "Qual frequência de publicação deseja?",
  content_formats: "Quais formatos de conteúdo prefere?",
  campaigns_dates: "Existem campanhas ou datas importantes?",
  approval_process: "Como funciona o processo de aprovação?",
  cta: "Quais chamadas para ação devem ser usadas?",
  brand_info: "Há outras informações importantes sobre a marca?",
  final_notes: "Observações finais",
};

function briefAnswerObject(row: JsonRow) {
  const raw = row.answers;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  const fallback: Record<string, unknown> = {};
  for (const key of ["brand_name", "objectives", "target_audience", "style_preferences", "preferred_colors", "references_links", "additional_notes"]) {
    const value = row[key]; if (value !== null && value !== undefined && String(value).trim()) fallback[key] = value;
  }
  return fallback;
}

function briefFieldType(value: unknown): "short" | "long" | "choice" | "checklist" | "link" | "file" {
  if (Array.isArray(value)) return "checklist";
  if (typeof value === "boolean") return "choice";
  const text = String(value ?? "");
  if (/^https?:\/\//i.test(text)) return "link";
  return text.length > 120 || text.includes("\n") ? "long" : "short";
}

function normalizeLegacyBriefQuestion(question: unknown, index: number) {
  const item = question && typeof question === "object" ? question as Record<string, unknown> : {};
  const rawType = String(item.type ?? item.field_type ?? "short_text");
  const typeMap: Record<string, "short" | "long" | "choice" | "checklist" | "link" | "file"> = { short_text: "short", text: "short", long_text: "long", textarea: "long", multiple_choice: "choice", yes_no: "choice", checkbox: "checklist", checkboxes: "checklist", file_upload: "file", url: "link", link: "link" };
  return { id: String(item.id ?? item.key ?? `question-${index + 1}`), type: typeMap[rawType] ?? "short", label: String(item.label ?? item.question ?? item.title ?? `Pergunta ${index + 1}`), help: String(item.help ?? item.description ?? ""), required: Boolean(item.required), options: Array.isArray(item.options) ? item.options.map(String) : [] };
}

async function importDesignBriefRecords(connection: PoolConnection, bundle: ExportBundle, clientMap: Map<string, string>, userMap: Map<string, string>) {
  for (const brief of bundle.designBriefs) {
    const legacyId = textValue(brief, "id");
    const answers = briefAnswerObject(brief);
    const fields = Object.entries(answers).map(([key, value]) => ({ id: key, type: briefFieldType(value), label: legacyBriefLabels[key] ?? key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()), help: "", required: false, options: Array.isArray(value) ? value.map(String) : [] }));
    const rawLocale = textValue(brief, "locale", "pt");
    const locale = ["pt", "en", "es", "it", "sv"].includes(rawLocale) ? rawLocale : "pt";
    const status = ["completed", "submitted"].includes(textValue(brief, "status").toLowerCase()) ? "completed" : "draft";
    await connection.query(`INSERT INTO design_briefs (id,client_account_id,title,introduction,category,locale,status,fields_json,answers_json,submitted_at,created_by_user_id,legacy_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE client_account_id=VALUES(client_account_id),title=VALUES(title),category=VALUES(category),locale=VALUES(locale),status=VALUES(status),fields_json=VALUES(fields_json),answers_json=VALUES(answers_json),submitted_at=VALUES(submitted_at),updated_at=VALUES(updated_at)`, [legacyId, clientMap.get(textValue(brief, "client_id")) ?? null, textValue(brief, "title", "Brief de design"), "Brief importado da V1", textValue(brief, "category", "general"), locale, status, JSON.stringify(fields), JSON.stringify(answers), mysqlDateTime(brief.submitted_at), userMap.get(textValue(brief, "user_id")) ?? null, legacyId, mysqlDateTime(brief.created_at), mysqlDateTime(brief.updated_at)]);
  }
  for (const template of bundle.briefTemplates) {
    const legacyId = textValue(template, "id");
    const questions = Array.isArray(template.questions) ? template.questions : [];
    const fields = questions.map(normalizeLegacyBriefQuestion);
    await connection.query("INSERT INTO design_brief_templates (id,name,introduction,fields_json,created_by_user_id,legacy_id,created_at,updated_at) VALUES (?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE name=VALUES(name),introduction=VALUES(introduction),fields_json=VALUES(fields_json),updated_at=VALUES(updated_at)", [legacyId, textValue(template, "name", "Modelo de brief"), textValue(template, "description"), JSON.stringify(fields), userMap.get(textValue(template, "user_id")) ?? null, legacyId, mysqlDateTime(template.created_at), mysqlDateTime(template.updated_at)]);
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function legacyTextHtml(row: JsonRow) {
  const rawBody = textValue(row, "body");
  const body = /<\/?[a-z][\s\S]*>/i.test(rawBody)
    ? rawBody.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    : rawBody.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const subtitle = textValue(row, "subtitle").trim();
  const subtitleHtml = subtitle ? `<p><strong>${escapeHtml(subtitle)}</strong></p>` : "";
  const pdfUrl = textValue(row, "pdf_url").trim();
  const pdfHtml = /^https?:\/\//i.test(pdfUrl) ? `<p><a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(textValue(row, "pdf_name", "Abrir documento anexo"))}</a></p>` : "";
  return `${subtitleHtml}${body}${pdfHtml}`;
}

function normalizeTextStatus(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  if (["approved", "published"].includes(status)) return { label: "Aprovado", sent: 1 };
  if (["pending_approval", "rejected"].includes(status)) return { label: "Em revisão", sent: 1 };
  return { label: "Rascunho", sent: 0 };
}

function normalizeTextType(value: unknown) {
  const types: Record<string, string> = { blog: "Blog", artigo: "Artigo", texto: "Texto", copy: "Copy", documento: "Documento" };
  return types[String(value ?? "").toLowerCase()] ?? "Texto";
}

async function importTextRecords(connection: PoolConnection, bundle: ExportBundle, clientMap: Map<string, string>, userMap: Map<string, string>) {
  for (const text of bundle.textContents) {
    const id = textValue(text, "id");
    const normalizedStatus = normalizeTextStatus(text.status);
    await connection.query(`INSERT INTO client_texts (id,client_account_id,title,content_html,content_type,status,planned_at,internal_notes,is_sent_to_client,sent_at,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE client_account_id=VALUES(client_account_id),title=VALUES(title),content_html=VALUES(content_html),content_type=VALUES(content_type),status=VALUES(status),planned_at=VALUES(planned_at),internal_notes=VALUES(internal_notes),is_sent_to_client=VALUES(is_sent_to_client),sent_at=VALUES(sent_at),created_by_user_id=VALUES(created_by_user_id),updated_at=VALUES(updated_at)`, [id, clientMap.get(textValue(text, "client_id")), textValue(text, "title", "Sem título"), legacyTextHtml(text), normalizeTextType(text.content_type), normalizedStatus.label, nullableText(text, "planned_date"), nullableText(text, "observations"), normalizedStatus.sent, normalizedStatus.sent ? mysqlDateTime(text.updated_at) : null, userMap.get(textValue(text, "created_by")) ?? null, mysqlDateTime(text.created_at), mysqlDateTime(text.updated_at)]);
  }
  for (const comment of bundle.textContentComments) {
    const legacyUserId = textValue(comment, "user_id");
    await connection.query("INSERT INTO text_comments (id,text_id,user_id,author_name,author_role,comment_text,is_internal,created_at) VALUES (?,?,?,?,?,?,0,COALESCE(?,CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),author_name=VALUES(author_name),author_role=VALUES(author_role),comment_text=VALUES(comment_text)", [textValue(comment, "id"), textValue(comment, "text_content_id"), userMap.get(legacyUserId) ?? null, textValue(comment, "author_name", "Usuário legado"), normalizeCommentRole(comment.author_role), legacyCommentToPlainText(comment.message), mysqlDateTime(comment.created_at)]);
  }
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function detailText(label: string, value: unknown) {
  const text = Array.isArray(value) ? stringList(value).join(", ") : String(value ?? "").trim();
  return text ? `${label}: ${text}` : "";
}

function buildBrandBrainData(bundle: ExportBundle, clientId: string, brain: JsonRow) {
  const vocabulary = bundle.brandVocabulary.filter((row) => textValue(row, "client_id") === clientId);
  const voices = bundle.brandVoices.filter((row) => textValue(row, "client_id") === clientId);
  const visuals = bundle.visualDirections.filter((row) => textValue(row, "client_id") === clientId);
  const avoided = bundle.wordsToAvoid.filter((row) => textValue(row, "client_id") === clientId);
  const expressions = bundle.approvedExpressions.filter((row) => textValue(row, "client_id") === clientId);
  const sourcePillars = bundle.contentPillars.filter((row) => textValue(row, "client_id") === clientId);
  const approvedWords = uniqueStrings(vocabulary.filter((row) => row.can_be_used !== false).flatMap((row) => [textValue(row, "term"), ...stringList(row.approved_phrases)]));
  const voice = voices.map((row) => [detailText("Arquétipo", row.archetype), detailText("Tom emocional", row.emotional_tone), detailText("Formalidade", row.formality_level), detailText("Ritmo", row.writing_rhythm), detailText("Evitar", row.things_to_avoid)].filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
  const visualNotes = visuals.map((row) => [detailText("Categoria", row.category), detailText("Direção", row.direction), detailText("Estilo de imagem", row.image_style), detailText("Iluminação", row.lighting), detailText("Composição", row.composition), detailText("Tipografia", row.typography), detailText("Evitar", row.things_to_avoid)].filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
  const pillarCount = sourcePillars.length;
  const baseWeight = pillarCount ? Math.floor(100 / pillarCount) : 0;
  const pillars = sourcePillars.map((row, index) => ({ name: textValue(row, "name", `Pilar ${index + 1}`), focus: [textValue(row, "objective"), detailText("Temas", row.themes), detailText("Emoção", row.main_emotion), detailText("Frequência", row.suggested_frequency), textValue(row, "notes")].filter(Boolean).join(" · "), weight: baseWeight + (index < 100 - baseWeight * pillarCount ? 1 : 0) }));
  const typography = visuals.map((row) => textValue(row, "typography").trim()).find(Boolean) ?? "";
  return {
    mission: textValue(brain, "mission"), vision: textValue(brain, "vision"), positioning: textValue(brain, "summary"), brandPromise: "",
    audience: "", audiencePains: [], audienceDesires: [],
    voice, personalityTraits: uniqueStrings(voices.flatMap((row) => [textValue(row, "archetype"), textValue(row, "emotional_tone"), textValue(row, "formality_level")])),
    voiceExamples: uniqueStrings(voices.flatMap((row) => stringList(row.good_examples))), voiceAvoidExamples: uniqueStrings(voices.flatMap((row) => stringList(row.bad_examples))),
    visualNotes, typographyDisplay: typography, typographyBody: "", typographyAccent: "", typographySample: "A identidade ganha voz quando cada detalhe fala a mesma língua.",
    approvedWords, avoidWords: uniqueStrings(avoided.map((row) => textValue(row, "word"))), expressions: uniqueStrings(expressions.map((row) => textValue(row, "expression"))),
    colors: uniqueStrings(visuals.flatMap((row) => stringList(row.colors))).filter((color) => /^#[0-9a-f]{6}$/i.test(color)),
    differentiators: [], proofPoints: [], references: [], pillars,
  };
}

async function importBrandBrainRecords(connection: PoolConnection, bundle: ExportBundle, clientMap: Map<string, string>, userMap: Map<string, string>) {
  for (const brain of bundle.brandBrains) {
    const legacyClientId = textValue(brain, "client_id");
    const clientAccountId = clientMap.get(legacyClientId);
    if (!clientAccountId) continue;
    const data = buildBrandBrainData(bundle, legacyClientId, brain);
    const legacyId = textValue(brain, "id");
    const userId = userMap.get(textValue(brain, "updated_by")) ?? null;
    const [accounts] = await connection.query<Array<RowDataPacket & { workspace_drawer_json: unknown }>>("SELECT workspace_drawer_json FROM client_accounts WHERE id=?", [clientAccountId]);
    let drawer: Record<string, unknown> = {};
    try { drawer = typeof accounts[0]?.workspace_drawer_json === "string" ? JSON.parse(accounts[0].workspace_drawer_json as string) : (accounts[0]?.workspace_drawer_json as Record<string, unknown>) ?? {}; } catch { drawer = {}; }
    const [versions] = await connection.query<Array<RowDataPacket & { id: string; version_number: number }>>("SELECT id,version_number FROM brand_brain_versions WHERE client_account_id=? ORDER BY version_number DESC", [clientAccountId]);
    const existingLegacy = versions.find((row) => row.id === legacyId);
    if (versions.length === 0 || (existingLegacy && Number(versions[0].version_number) === 1)) await connection.query("UPDATE client_accounts SET workspace_drawer_json=? WHERE id=?", [JSON.stringify({ ...drawer, brandBrain: data }), clientAccountId]);
    if (versions.length === 0) {
      await connection.query("INSERT INTO brand_brain_versions (id,client_account_id,version_number,data_json,created_by_user_id,author_name,created_at) VALUES (?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP))", [legacyId, clientAccountId, 1, JSON.stringify(data), userId, "Importação V1", mysqlDateTime(brain.updated_at) ?? mysqlDateTime(brain.created_at)]);
    } else if (existingLegacy) {
      await connection.query("UPDATE brand_brain_versions SET data_json=?,created_by_user_id=?,author_name=? WHERE id=?", [JSON.stringify(data), userId, "Importação V1", legacyId]);
    }
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
  await importContractRecords(connection,bundle,clientMap,userMap);
  await importProposalRecords(connection,bundle,userMap);
  await importReportRecords(connection,bundle,clientMap,userMap);
  await importDesignBriefRecords(connection,bundle,clientMap,userMap);
  await importTextRecords(connection,bundle,clientMap,userMap);
  await importBrandBrainRecords(connection,bundle,clientMap,userMap);
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
  await ensureContractTables(pool);
  await ensureProposalTables(pool);
  await ensureDesignBriefTables(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (options.onlyInvoices) {
      const clientMap = await resolveExistingClients(connection, bundle.clients);
      await importInvoiceRecords(connection, bundle, clientMap);
    } else if (options.onlyContracts) {
      const clientMap=await resolveExistingClients(connection,bundle.clients);
      const userMap=await resolveExistingUsers(connection,bundle.profiles);
      await importContractRecords(connection,bundle,clientMap,userMap);
    } else if (options.onlyProposals) {
      const userMap=await resolveExistingUsers(connection,bundle.profiles);
      await importProposalRecords(connection,bundle,userMap);
    } else if (options.onlyReports) {
      const clientMap=await resolveExistingClients(connection,bundle.clients);
      const userMap=await resolveExistingUsers(connection,bundle.profiles);
      await importReportRecords(connection,bundle,clientMap,userMap);
    } else if (options.onlyDesignBriefs) {
      const clientMap=await resolveExistingClients(connection,bundle.clients);
      const userMap=await resolveExistingUsers(connection,bundle.profiles);
      await importDesignBriefRecords(connection,bundle,clientMap,userMap);
    } else if (options.onlyTexts) {
      const clientMap=await resolveExistingClients(connection,bundle.clients);
      const userMap=await resolveExistingUsers(connection,bundle.profiles);
      await importTextRecords(connection,bundle,clientMap,userMap);
    } else if (options.onlyBrandBrain) {
      const clientMap=await resolveExistingClients(connection,bundle.clients);
      const userMap=await resolveExistingUsers(connection,bundle.profiles);
      await importBrandBrainRecords(connection,bundle,clientMap,userMap);
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
