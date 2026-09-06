import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { loadEnv } from "../config/env.js";

type JsonRow = Record<string, unknown>;

type AuditSpec = {
  sourceFile: string;
  table: string;
  allowDestinationExtras?: boolean;
};

const AUDIT_SPECS: Record<string, AuditSpec> = {
  cards: { sourceFile: "posts.json", table: "kanban_cards", allowDestinationExtras: true },
  comments: { sourceFile: "comments.json", table: "card_comments" },
  calendar: { sourceFile: "calendar_posts.json", table: "card_calendar_events", allowDestinationExtras: true },
  invoices: { sourceFile: "invoices.json", table: "invoices" },
  invoiceItems: { sourceFile: "invoice_items.json", table: "invoice_items" },
  invoiceAttachments: { sourceFile: "invoice_attachments.json", table: "invoice_attachments" },
  contracts: { sourceFile: "contracts.json", table: "contracts" },
  contractAcceptances: { sourceFile: "contract_acceptances.json", table: "contract_acceptances" },
  contractTemplates: { sourceFile: "contract_templates.json", table: "contract_templates" },
  proposals: { sourceFile: "proposals.json", table: "proposals", allowDestinationExtras: true },
  reports: { sourceFile: "social_reports.json", table: "client_reports" },
  reportTemplates: { sourceFile: "social_report_templates.json", table: "report_templates" },
  designBriefs: { sourceFile: "design_briefs.json", table: "design_briefs" },
  texts: { sourceFile: "text_contents.json", table: "client_texts", allowDestinationExtras: true },
};

function parseArguments() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "../../../../..");
  return {
    inputDir:
      inputIndex >= 0 && args[inputIndex + 1]
        ? path.resolve(args[inputIndex + 1])
        : path.join(repositoryRoot, "migration-export/priority-clients"),
  };
}

async function readRows(inputDir: string, fileName: string) {
  const parsed: unknown = JSON.parse(await readFile(path.join(inputDir, fileName), "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${fileName} precisa conter uma lista JSON.`);
  return parsed as JsonRow[];
}

function textValue(row: JsonRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

async function main() {
  const { inputDir } = parseArguments();
  const env = loadEnv();
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 2,
  });

  const result: Record<string, unknown> = { inputDir, modules: {} };
  const modules = result.modules as Record<string, unknown>;
  let blockingDifferences = 0;

  try {
    const clients = await readRows(inputDir, "clients.json");
    const [destinationClients] = await pool.query<Array<RowDataPacket & { id: string; slug: string }>>(
      "SELECT id, slug FROM client_accounts",
    );
    const destinationClientIds = new Set(destinationClients.map((row) => row.id));
    const destinationClientSlugs = new Set(destinationClients.map((row) => row.slug));
    const missingClients = clients.filter(
      (client) =>
        !destinationClientIds.has(textValue(client, "id")) &&
        !destinationClientSlugs.has(textValue(client, "slug")),
    );
    modules.clients = {
      source: clients.length,
      destination: destinationClients.length,
      missing: missingClients.map((client) => ({ id: client.id, name: client.name, slug: client.slug })),
    };
    blockingDifferences += missingClients.length;

    const columns = await readRows(inputDir, "columns.json");
    const posts = await readRows(inputDir, "posts.json");
    const [destinationColumns] = await pool.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM kanban_columns");
    const destinationColumnIds = new Set(destinationColumns.map((row) => row.id));
    const usedColumnIds = new Set(posts.map((post) => textValue(post, "column_id")).filter(Boolean));
    const missingUsedColumns = columns.filter(
      (column) => !destinationColumnIds.has(textValue(column, "id")) && usedColumnIds.has(textValue(column, "id")),
    );
    const omittedEmptyColumns = columns.filter(
      (column) => !destinationColumnIds.has(textValue(column, "id")) && !usedColumnIds.has(textValue(column, "id")),
    );
    modules.columns = {
      source: columns.length,
      destination: destinationColumns.length,
      missingUsed: missingUsedColumns.map((column) => ({ id: column.id, name: column.name })),
      omittedEmpty: omittedEmptyColumns.map((column) => ({ id: column.id, name: column.name })),
    };
    blockingDifferences += missingUsedColumns.length;

    for (const [name, spec] of Object.entries(AUDIT_SPECS)) {
      const sourceRows = name === "cards" ? posts : await readRows(inputDir, spec.sourceFile);
      const [destinationRows] = await pool.query<Array<RowDataPacket & { id: string }>>(`SELECT id FROM ${spec.table}`);
      const destinationIds = new Set(destinationRows.map((row) => row.id));
      const missing = sourceRows.map((row) => textValue(row, "id")).filter((id) => id && !destinationIds.has(id));
      modules[name] = {
        source: sourceRows.length,
        destination: destinationRows.length,
        missing,
        destinationExtrasAllowed: Boolean(spec.allowDestinationExtras),
      };
      blockingDifferences += missing.length;
    }

    const orphanChecks: Record<string, string> = {
      cardColumns:
        "SELECT COUNT(*) count FROM kanban_cards card LEFT JOIN kanban_columns col ON col.id=card.column_id WHERE card.column_id IS NOT NULL AND col.id IS NULL",
      cardClients:
        "SELECT COUNT(*) count FROM kanban_cards card LEFT JOIN client_accounts client ON client.id=card.client_account_id WHERE client.id IS NULL",
      comments:
        "SELECT COUNT(*) count FROM card_comments comment LEFT JOIN kanban_cards card ON card.id=comment.card_id WHERE card.id IS NULL",
      calendarClients:
        "SELECT COUNT(*) count FROM card_calendar_events event LEFT JOIN client_accounts client ON client.id=event.client_account_id WHERE client.id IS NULL",
      memberships:
        "SELECT COUNT(*) count FROM client_memberships membership LEFT JOIN users user ON user.id=membership.user_id LEFT JOIN client_accounts client ON client.id=membership.client_account_id WHERE user.id IS NULL OR client.id IS NULL",
    };
    const orphans: Record<string, number> = {};
    for (const [name, query] of Object.entries(orphanChecks)) {
      const [rows] = await pool.query<Array<RowDataPacket & { count: number }>>(query);
      orphans[name] = Number(rows[0]?.count ?? 0);
      blockingDifferences += orphans[name];
    }

    const [permissionRows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      "SELECT COUNT(*) count FROM client_accounts client LEFT JOIN client_permissions permission ON permission.client_account_id=client.id WHERE permission.id IS NULL",
    );
    const clientsWithoutPermissions = Number(permissionRows[0]?.count ?? 0);
    blockingDifferences += clientsWithoutPermissions;

    result.integrity = { orphans, clientsWithoutPermissions };
    result.ready = blockingDifferences === 0;
    result.blockingDifferences = blockingDifferences;
    console.log(JSON.stringify(result, null, 2));
    if (blockingDifferences > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[audit-legacy-migration] Falha:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
