import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

export type BrandBrainData = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

export async function ensureBrandBrainTables(db: Pool) {
  await db.query([
    "CREATE TABLE IF NOT EXISTS brand_brain_revisions (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, proposed_data_json JSON NOT NULL,",
    "status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', summary VARCHAR(500) NULL,",
    "created_by_user_id CHAR(36) NULL, author_name VARCHAR(190) NOT NULL, author_role VARCHAR(40) NOT NULL,",
    "reviewed_by_user_id CHAR(36) NULL, reviewer_name VARCHAR(190) NULL, reviewed_at DATETIME NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "KEY idx_brand_revision_account_status (client_account_id, status, created_at),",
    "CONSTRAINT fk_brand_revision_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_brand_revision_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,",
    "CONSTRAINT fk_brand_revision_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS brand_brain_versions (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, version_number INT NOT NULL, data_json JSON NOT NULL,",
    "created_by_user_id CHAR(36) NULL, author_name VARCHAR(190) NOT NULL, source_revision_id CHAR(36) NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "UNIQUE KEY uq_brand_version_account_number (client_account_id, version_number), KEY idx_brand_version_account_created (client_account_id, created_at),",
    "CONSTRAINT fk_brand_version_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_brand_version_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,",
    "CONSTRAINT fk_brand_version_revision FOREIGN KEY (source_revision_id) REFERENCES brand_brain_revisions (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS brand_brain_comments (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, revision_id CHAR(36) NULL, section_key VARCHAR(80) NOT NULL DEFAULT 'general',",
    "comment_text TEXT NOT NULL, created_by_user_id CHAR(36) NULL, author_name VARCHAR(190) NOT NULL, author_role VARCHAR(40) NOT NULL, is_internal TINYINT(1) NOT NULL DEFAULT 0,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "KEY idx_brand_comment_account_created (client_account_id, created_at),",
    "CONSTRAINT fk_brand_comment_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_brand_comment_revision FOREIGN KEY (revision_id) REFERENCES brand_brain_revisions (id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_brand_comment_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
}

const mapRevision = (row: RowDataPacket) => ({
  id: row.id, status: row.status, summary: row.summary, data: parseJson<BrandBrainData>(row.proposed_data_json, {}),
  authorName: row.author_name, authorRole: row.author_role, reviewerName: row.reviewer_name,
  createdAt: row.created_at, reviewedAt: row.reviewed_at,
});

export async function getBrandBrainSnapshot(db: Pool, clientAccountId: string, includeInternal: boolean) {
  const [accounts] = await db.query<Array<RowDataPacket & { workspace_drawer_json: unknown }>>("SELECT workspace_drawer_json FROM client_accounts WHERE id = ?", [clientAccountId]);
  const drawer = parseJson<Record<string, unknown>>(accounts[0]?.workspace_drawer_json, {});
  const [versions] = await db.query<RowDataPacket[]>("SELECT id, version_number, author_name, created_at FROM brand_brain_versions WHERE client_account_id = ? ORDER BY version_number DESC LIMIT 12", [clientAccountId]);
  const [revisions] = await db.query<RowDataPacket[]>(`SELECT * FROM brand_brain_revisions WHERE client_account_id = ? ${includeInternal ? "" : "AND (author_role = 'cliente' OR status <> 'pending')"} ORDER BY created_at DESC LIMIT 20`, [clientAccountId]);
  const [comments] = await db.query<RowDataPacket[]>(`SELECT id, revision_id, section_key, comment_text, author_name, author_role, is_internal, created_at FROM brand_brain_comments WHERE client_account_id = ? ${includeInternal ? "" : "AND is_internal = 0"} ORDER BY created_at DESC LIMIT 80`, [clientAccountId]);
  return {
    data: (drawer.brandBrain as BrandBrainData | undefined) ?? null,
    meta: { version: Number(versions[0]?.version_number ?? 0), updatedAt: versions[0]?.created_at ?? null, updatedBy: versions[0]?.author_name ?? null },
    revisions: revisions.map(mapRevision),
    history: versions.map((row) => ({ id: row.id, version: Number(row.version_number), authorName: row.author_name, createdAt: row.created_at })),
    comments: comments.map((row) => ({ id: row.id, revisionId: row.revision_id, sectionKey: row.section_key, commentText: row.comment_text, authorName: row.author_name, authorRole: row.author_role, isInternal: Boolean(row.is_internal), createdAt: row.created_at })),
  };
}

export async function saveOfficialBrandBrain(db: Pool, input: { clientAccountId: string; data: BrandBrainData; userId: string; authorName: string; sourceRevisionId?: string | null }) {
  const [rows] = await db.query<Array<RowDataPacket & { workspace_drawer_json: unknown }>>("SELECT workspace_drawer_json FROM client_accounts WHERE id = ?", [input.clientAccountId]);
  const drawer = parseJson<Record<string, unknown>>(rows[0]?.workspace_drawer_json, {});
  await db.query("UPDATE client_accounts SET workspace_drawer_json = ? WHERE id = ?", [JSON.stringify({ ...drawer, brandBrain: input.data }), input.clientAccountId]);
  const [versionRows] = await db.query<Array<RowDataPacket & { nextVersion: number }>>("SELECT COALESCE(MAX(version_number), 0) + 1 AS nextVersion FROM brand_brain_versions WHERE client_account_id = ?", [input.clientAccountId]);
  const version = Number(versionRows[0]?.nextVersion ?? 1);
  await db.query("INSERT INTO brand_brain_versions (id, client_account_id, version_number, data_json, created_by_user_id, author_name, source_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [crypto.randomUUID(), input.clientAccountId, version, JSON.stringify(input.data), input.userId, input.authorName, input.sourceRevisionId ?? null]);
  return version;
}

export async function createBrandBrainRevision(db: Pool, input: { clientAccountId: string; data: BrandBrainData; summary?: string | null; userId: string; authorName: string; authorRole: string }) {
  const id = crypto.randomUUID();
  await db.query("INSERT INTO brand_brain_revisions (id, client_account_id, proposed_data_json, summary, created_by_user_id, author_name, author_role) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, input.clientAccountId, JSON.stringify(input.data), input.summary?.trim() || null, input.userId, input.authorName, input.authorRole]);
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM brand_brain_revisions WHERE id = ?", [id]);
  return mapRevision(rows[0]);
}

export async function decideBrandBrainRevision(db: Pool, input: { clientAccountId: string; revisionId: string; approved: boolean; userId: string; reviewerName: string }) {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM brand_brain_revisions WHERE id = ? AND client_account_id = ?", [input.revisionId, input.clientAccountId]);
  if (!rows[0]) return null;
  const status = input.approved ? "approved" : "rejected";
  await db.query("UPDATE brand_brain_revisions SET status = ?, reviewed_by_user_id = ?, reviewer_name = ?, reviewed_at = NOW() WHERE id = ?", [status, input.userId, input.reviewerName, input.revisionId]);
  let version: number | null = null;
  if (input.approved) version = await saveOfficialBrandBrain(db, { clientAccountId: input.clientAccountId, data: parseJson<BrandBrainData>(rows[0].proposed_data_json, {}), userId: input.userId, authorName: input.reviewerName, sourceRevisionId: input.revisionId });
  return { status, version };
}

export async function addBrandBrainComment(db: Pool, input: { clientAccountId: string; revisionId?: string | null; sectionKey?: string; commentText: string; userId: string; authorName: string; authorRole: string; isInternal: boolean }) {
  const id = crypto.randomUUID();
  await db.query("INSERT INTO brand_brain_comments (id, client_account_id, revision_id, section_key, comment_text, created_by_user_id, author_name, author_role, is_internal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, input.clientAccountId, input.revisionId ?? null, input.sectionKey ?? "general", input.commentText.trim(), input.userId, input.authorName, input.authorRole, input.isInternal ? 1 : 0]);
  return { id };
}
