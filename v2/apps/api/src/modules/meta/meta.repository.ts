import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ClientMetaAssetsInput } from "./meta.schemas.js";

type ConnectionRow = RowDataPacket & {
  access_token_encrypted: string;
  token_expires_at: Date | string | null;
  meta_user_id: string;
  meta_account_name: string | null;
};

type StateRow = RowDataPacket & { user_id: string; return_path: string; expires_at_ms: number | string };
type AssetsRow = RowDataPacket & {
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  meta_ad_account_id: string | null;
  meta_ad_account_name: string | null;
  updated_at: Date | string;
};

export type MetaScheduledPublicationStatus = "scheduled" | "publishing" | "published" | "failed" | "cancelled";

type ScheduledPublicationRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  card_id: string | null;
  platform: "instagram" | "facebook";
  meta_asset_id: string;
  scheduled_at: string;
  timezone: string;
  caption: string | null;
  media_url: string | null;
  media_urls_json: unknown;
  media_type: string | null;
  status: MetaScheduledPublicationStatus;
  attempt_count: number;
  idempotency_key: string;
  published_meta_id: string | null;
  published_permalink: string | null;
  last_error: string | null;
  created_by_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
};

const scheduledPublicationSelect = [
  "SELECT id, client_account_id, card_id, platform, meta_asset_id,",
  "DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS scheduled_at, timezone, caption, media_url, media_urls_json, media_type,",
  "status, attempt_count, idempotency_key, published_meta_id, published_permalink, last_error, created_by_user_id, created_at, updated_at, published_at",
  "FROM meta_scheduled_publications",
].join(" ");

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isoValue(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapScheduledPublication(row: ScheduledPublicationRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    cardId: row.card_id,
    platform: row.platform,
    metaAssetId: row.meta_asset_id,
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    caption: row.caption,
    mediaUrl: row.media_url,
    mediaUrls: parseStringArray(row.media_urls_json),
    mediaType: row.media_type,
    status: row.status,
    attemptCount: Number(row.attempt_count),
    idempotencyKey: row.idempotency_key,
    publishedMetaId: row.published_meta_id,
    publishedPermalink: row.published_permalink,
    lastError: row.last_error,
    createdByUserId: row.created_by_user_id,
    createdAt: isoValue(row.created_at)!,
    updatedAt: isoValue(row.updated_at)!,
    publishedAt: isoValue(row.published_at),
  };
}

function mysqlUtcDateTime(value: string) {
  return new Date(value).toISOString().replace("T", " ").replace("Z", "");
}

function stateHash(state: string) {
  return crypto.createHash("sha256").update(state).digest("hex");
}

export async function saveMetaOAuthState(db: Pool, input: { state: string; userId: string; returnPath: string }) {
  await db.query(
    "INSERT INTO meta_oauth_states (state_hash, user_id, return_path, expires_at_ms) VALUES (?, ?, ?, ?)",
    [stateHash(input.state), input.userId, input.returnPath, Date.now() + 10 * 60 * 1000],
  );
}

export async function consumeMetaOAuthState(db: Pool, state: string) {
  const hash = stateHash(state);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<StateRow[]>(
      "SELECT user_id, return_path, expires_at_ms FROM meta_oauth_states WHERE state_hash = ? FOR UPDATE",
      [hash],
    );
    const row = rows[0];
    if (!row || Number(row.expires_at_ms) <= Date.now()) {
      if (row) await connection.query("DELETE FROM meta_oauth_states WHERE state_hash = ?", [hash]);
      await connection.commit();
      return null;
    }
    await connection.query("DELETE FROM meta_oauth_states WHERE state_hash = ?", [hash]);
    await connection.commit();
    return { userId: row.user_id, returnPath: row.return_path };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function upsertMetaConnection(db: Pool, input: { userId: string; encryptedToken: string; expiresAt: Date | null; metaUserId: string; accountName: string | null }) {
  await db.query([
    "INSERT INTO meta_connections (id, user_id, access_token_encrypted, token_expires_at, meta_user_id, meta_account_name)",
    "VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_token_encrypted = VALUES(access_token_encrypted),",
    "token_expires_at = VALUES(token_expires_at), meta_user_id = VALUES(meta_user_id), meta_account_name = VALUES(meta_account_name), updated_at = CURRENT_TIMESTAMP",
  ].join(" "), [crypto.randomUUID(), input.userId, input.encryptedToken, input.expiresAt, input.metaUserId, input.accountName]);
}

export async function findMetaConnection(db: Pool, userId: string) {
  const [rows] = await db.query<ConnectionRow[]>(
    "SELECT access_token_encrypted, token_expires_at, meta_user_id, meta_account_name FROM meta_connections WHERE user_id = ? LIMIT 1",
    [userId],
  );
  const row = rows[0];
  return row ? {
    encryptedToken: row.access_token_encrypted,
    expiresAt: row.token_expires_at,
    metaUserId: row.meta_user_id,
    accountName: row.meta_account_name,
  } : null;
}

export async function findClientMetaAssets(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<AssetsRow[]>(
    "SELECT facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, meta_ad_account_id, meta_ad_account_name, updated_at FROM client_meta_assets WHERE client_account_id = ? LIMIT 1",
    [clientAccountId],
  );
  const row = rows[0];
  return row ? {
    facebookPageId: row.facebook_page_id,
    facebookPageName: row.facebook_page_name,
    instagramAccountId: row.instagram_account_id,
    instagramUsername: row.instagram_username,
    metaAdAccountId: row.meta_ad_account_id,
    metaAdAccountName: row.meta_ad_account_name,
    updatedAt: row.updated_at,
  } : null;
}

export async function upsertClientMetaAssets(db: Pool, clientAccountId: string, input: ClientMetaAssetsInput) {
  await db.query([
    "INSERT INTO client_meta_assets (id, client_account_id, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, meta_ad_account_id, meta_ad_account_name)",
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE facebook_page_id = VALUES(facebook_page_id), facebook_page_name = VALUES(facebook_page_name),",
    "instagram_account_id = VALUES(instagram_account_id), instagram_username = VALUES(instagram_username),",
    "meta_ad_account_id = VALUES(meta_ad_account_id), meta_ad_account_name = VALUES(meta_ad_account_name), updated_at = CURRENT_TIMESTAMP",
  ].join(" "), [
    crypto.randomUUID(), clientAccountId,
    input.facebookPageId ?? null, input.facebookPageName ?? null,
    input.instagramAccountId ?? null, input.instagramUsername ?? null,
    input.metaAdAccountId ?? null, input.metaAdAccountName ?? null,
  ]);
  return findClientMetaAssets(db, clientAccountId);
}

export type CreateScheduledPublicationInput = {
  clientAccountId: string;
  cardId: string | null;
  platform: "instagram" | "facebook";
  metaAssetId: string;
  scheduledAt: string;
  timezone: string;
  caption: string | null;
  mediaUrl: string;
  mediaUrls: string[];
  mediaType: "image";
  createdByUserId: string;
  idempotencyKey: string;
};

export async function createScheduledPublications(db: Pool, inputs: CreateScheduledPublicationInput[]) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const results = [];
    for (const input of inputs) {
      const id = crypto.randomUUID();
      try {
        await connection.query(
          [
            "INSERT INTO meta_scheduled_publications",
            "(id, client_account_id, card_id, platform, meta_asset_id, scheduled_at, timezone, caption, media_url, media_urls_json, media_type, status, created_by_user_id, idempotency_key)",
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
          ].join(" "),
          [
            id, input.clientAccountId, input.cardId, input.platform, input.metaAssetId,
            mysqlUtcDateTime(input.scheduledAt), input.timezone, input.caption, input.mediaUrl,
            JSON.stringify(input.mediaUrls), input.mediaType, input.createdByUserId, input.idempotencyKey,
          ],
        );
        const [rows] = await connection.query<ScheduledPublicationRow[]>(
          `${scheduledPublicationSelect} WHERE id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new Error("Scheduled Meta publication could not be loaded after insert");
        results.push({ publication: mapScheduledPublication(rows[0]), created: true });
      } catch (error) {
        if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
        const [rows] = await connection.query<ScheduledPublicationRow[]>(
          `${scheduledPublicationSelect} WHERE idempotency_key = ? LIMIT 1`,
          [input.idempotencyKey],
        );
        if (!rows[0]) throw error;
        results.push({ publication: mapScheduledPublication(rows[0]), created: false });
      }
    }
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findScheduledPublication(db: Pool, id: string, clientAccountId?: string) {
  const [rows] = await db.query<ScheduledPublicationRow[]>(
    `${scheduledPublicationSelect} WHERE id = ?${clientAccountId ? " AND client_account_id = ?" : ""} LIMIT 1`,
    clientAccountId ? [id, clientAccountId] : [id],
  );
  return rows[0] ? mapScheduledPublication(rows[0]) : null;
}

export async function listScheduledPublicationsForClient(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<ScheduledPublicationRow[]>(
    `${scheduledPublicationSelect} WHERE client_account_id = ? ORDER BY CASE WHEN status = 'scheduled' THEN 0 ELSE 1 END, scheduled_at ASC, created_at DESC`,
    [clientAccountId],
  );
  return rows.map(mapScheduledPublication);
}

export async function listDueScheduledPublications(db: Pool, limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const [rows] = await db.query<ScheduledPublicationRow[]>(
    `${scheduledPublicationSelect} WHERE status = 'scheduled' AND scheduled_at <= UTC_TIMESTAMP(3) ORDER BY scheduled_at ASC LIMIT ${safeLimit}`,
  );
  return rows.map(mapScheduledPublication);
}

export async function cancelScheduledPublication(db: Pool, id: string, clientAccountId: string) {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE meta_scheduled_publications SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND client_account_id = ? AND status IN ('scheduled', 'failed')",
    [id, clientAccountId],
  );
  return result.affectedRows === 1;
}

export async function markPublicationPublishing(db: Pool, id: string) {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE meta_scheduled_publications SET status = 'publishing', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled'",
    [id],
  );
  return result.affectedRows === 1;
}

export async function markPublicationPublished(db: Pool, id: string, input: { publishedMetaId: string; publishedPermalink: string | null }) {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE meta_scheduled_publications SET status = 'published', published_meta_id = ?, published_permalink = ?, published_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'publishing'",
    [input.publishedMetaId, input.publishedPermalink, id],
  );
  return result.affectedRows === 1;
}

export async function canArchiveScheduledPublicationCard(db: Pool, input: { clientAccountId: string; cardId: string; scheduledAt: string }) {
  const [rows] = await db.query<(RowDataPacket & { publication_count: number | string; published_count: number | string })[]>(
    [
      "SELECT COUNT(*) AS publication_count, SUM(status = 'published') AS published_count",
      "FROM meta_scheduled_publications",
      "WHERE client_account_id = ? AND card_id = ? AND scheduled_at = ? AND status <> 'cancelled'",
    ].join(" "),
    [input.clientAccountId, input.cardId, mysqlUtcDateTime(input.scheduledAt)],
  );
  const publicationCount = Number(rows[0]?.publication_count ?? 0);
  return publicationCount > 0 && Number(rows[0]?.published_count ?? 0) === publicationCount;
}

export async function markPublicationFailed(db: Pool, id: string, lastError: string) {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE meta_scheduled_publications SET status = 'failed', attempt_count = attempt_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'publishing'",
    [lastError.slice(0, 4000), id],
  );
  return result.affectedRows === 1;
}
