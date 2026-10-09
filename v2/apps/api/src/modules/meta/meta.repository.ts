import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ClientMetaAssetsInput, CreateMetaPublishDestinationInput, CreateMetaSavedLocationInput, UpdateMetaPublishDestinationInput, UpdateMetaSavedLocationInput } from "./meta.schemas.js";
import { parseMetaExpiryDiagnostics, type MetaExpiryDiagnostics } from "./meta-expiry.js";

type ConnectionRow = RowDataPacket & {
  access_token_encrypted: string;
  token_expires_at: Date | string | null;
  data_access_expires_at: Date | string | null;
  meta_user_id: string;
  meta_account_name: string | null;
  expiry_diagnostics_json: unknown;
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

type SavedLocationRow = RowDataPacket & {
  id: string;
  name: string;
  meta_place_id: string;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MetaPublishDestinationRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  name: string;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  is_default: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MetaScheduledPublicationStatus = "scheduled" | "publishing" | "published" | "failed" | "cancelled";

type ScheduledPublicationRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  card_id: string | null;
  destination_id: string | null;
  destination_name: string | null;
  platform: "instagram" | "facebook";
  meta_asset_id: string;
  scheduled_at: string;
  timezone: string;
  caption: string | null;
  media_url: string | null;
  media_urls_json: unknown;
  media_type: string | null;
  reel_cover_url: string | null;
  location_id: string | null;
  location_name: string | null;
  instagram_user_tags_json: unknown;
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
  card_title?: string | null;
};

const scheduledPublicationSelect = [
  "SELECT id, client_account_id, card_id, destination_id, destination_name, platform, meta_asset_id,",
  "DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS scheduled_at, timezone, caption, media_url, media_urls_json, media_type, reel_cover_url, location_id, location_name, instagram_user_tags_json,",
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

function parseInstagramUserTags(value: unknown) {
  if (!value) return [];
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as { username?: unknown; x?: unknown; y?: unknown };
      if (typeof candidate.username !== "string" || typeof candidate.x !== "number" || typeof candidate.y !== "number") return [];
      return [{ username: candidate.username, x: candidate.x, y: candidate.y }];
    });
  } catch {
    return [];
  }
}

function isoValue(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapSavedLocation(row: SavedLocationRow) {
  return {
    id: row.id,
    name: row.name,
    metaPlaceId: row.meta_place_id,
    notes: row.notes,
    createdAt: isoValue(row.created_at)!,
    updatedAt: isoValue(row.updated_at)!,
  };
}

function mapMetaPublishDestination(row: MetaPublishDestinationRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    name: row.name,
    facebookPageId: row.facebook_page_id,
    facebookPageName: row.facebook_page_name,
    instagramAccountId: row.instagram_account_id,
    instagramUsername: row.instagram_username,
    isDefault: Boolean(row.is_default),
    createdAt: isoValue(row.created_at)!,
    updatedAt: isoValue(row.updated_at)!,
  };
}

function mapScheduledPublication(row: ScheduledPublicationRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    cardId: row.card_id,
    destinationId: row.destination_id,
    destinationName: row.destination_name,
    platform: row.platform,
    metaAssetId: row.meta_asset_id,
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    caption: row.caption,
    mediaUrl: row.media_url,
    mediaUrls: parseStringArray(row.media_urls_json),
    mediaType: row.media_type,
    reelCoverUrl: row.reel_cover_url,
    locationId: row.location_id,
    locationName: row.location_name,
    instagramUserTags: parseInstagramUserTags(row.instagram_user_tags_json),
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
    cardTitle: row.card_title?.trim() || null,
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

export async function upsertMetaConnection(db: Pool, input: { userId: string; encryptedToken: string; expiresAt: Date | null; dataAccessExpiresAt: Date | null; metaUserId: string; accountName: string | null; expiryDiagnostics: MetaExpiryDiagnostics }) {
  await db.query([
    "INSERT INTO meta_connections (id, user_id, access_token_encrypted, token_expires_at, data_access_expires_at, meta_user_id, meta_account_name, expiry_diagnostics_json)",
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_token_encrypted = VALUES(access_token_encrypted),",
    "token_expires_at = VALUES(token_expires_at), data_access_expires_at = VALUES(data_access_expires_at), meta_user_id = VALUES(meta_user_id), meta_account_name = VALUES(meta_account_name),",
    "expiry_diagnostics_json = VALUES(expiry_diagnostics_json), updated_at = CURRENT_TIMESTAMP",
  ].join(" "), [crypto.randomUUID(), input.userId, input.encryptedToken, input.expiresAt, input.dataAccessExpiresAt, input.metaUserId, input.accountName, JSON.stringify(input.expiryDiagnostics)]);
}

export async function findMetaConnection(db: Pool, userId: string) {
  const [rows] = await db.query<ConnectionRow[]>(
    "SELECT access_token_encrypted, token_expires_at, data_access_expires_at, meta_user_id, meta_account_name, expiry_diagnostics_json FROM meta_connections WHERE user_id = ? LIMIT 1",
    [userId],
  );
  const row = rows[0];
  return row ? {
    encryptedToken: row.access_token_encrypted,
    expiresAt: row.token_expires_at,
    dataAccessExpiresAt: row.data_access_expires_at ?? null,
    metaUserId: row.meta_user_id,
    accountName: row.meta_account_name,
    expiryDiagnostics: parseMetaExpiryDiagnostics(row.expiry_diagnostics_json),
  } : null;
}

export async function findClientMetaAssets(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<AssetsRow[]>(
    [
      "SELECT CASE WHEN d.id IS NOT NULL THEN d.facebook_page_id ELSE a.facebook_page_id END AS facebook_page_id, CASE WHEN d.id IS NOT NULL THEN d.facebook_page_name ELSE a.facebook_page_name END AS facebook_page_name,",
      "CASE WHEN d.id IS NOT NULL THEN d.instagram_account_id ELSE a.instagram_account_id END AS instagram_account_id, CASE WHEN d.id IS NOT NULL THEN d.instagram_username ELSE a.instagram_username END AS instagram_username,",
      "a.meta_ad_account_id, a.meta_ad_account_name, COALESCE(d.updated_at, a.updated_at) AS updated_at",
      "FROM client_accounts c LEFT JOIN client_meta_assets a ON a.client_account_id = c.id",
      "LEFT JOIN meta_publish_destinations d ON d.client_account_id = c.id AND d.is_default = TRUE WHERE c.id = ? LIMIT 1",
    ].join(" "),
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

const metaPublishDestinationSelect = [
  "SELECT id, client_account_id, name, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, is_default, created_at, updated_at",
  "FROM meta_publish_destinations",
].join(" ");

export async function listMetaPublishDestinations(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<MetaPublishDestinationRow[]>(
    `${metaPublishDestinationSelect} WHERE client_account_id = ? ORDER BY is_default DESC, name ASC, created_at ASC`,
    [clientAccountId],
  );
  return rows.map(mapMetaPublishDestination);
}

export async function findMetaPublishDestination(db: Pool, destinationId: string, clientAccountId?: string) {
  const [rows] = await db.query<MetaPublishDestinationRow[]>(
    `${metaPublishDestinationSelect} WHERE id = ?${clientAccountId ? " AND client_account_id = ?" : ""} LIMIT 1`,
    clientAccountId ? [destinationId, clientAccountId] : [destinationId],
  );
  return rows[0] ? mapMetaPublishDestination(rows[0]) : null;
}

export async function findDefaultMetaPublishDestination(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<MetaPublishDestinationRow[]>(
    `${metaPublishDestinationSelect} WHERE client_account_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1`,
    [clientAccountId],
  );
  return rows[0] ? mapMetaPublishDestination(rows[0]) : null;
}

export async function findClientMetaInsightsContext(db: Pool, clientAccountId: string, destinationId?: string) {
  if (destinationId) {
    const destination = await findMetaPublishDestination(db, destinationId, clientAccountId);
    return destination ? {
      destinationId: destination.id,
      destinationName: destination.name,
      assets: {
        facebookPageId: destination.facebookPageId,
        facebookPageName: destination.facebookPageName,
        instagramAccountId: destination.instagramAccountId,
        instagramUsername: destination.instagramUsername,
      },
    } : null;
  }
  const destination = await findDefaultMetaPublishDestination(db, clientAccountId);
  if (destination) return {
    destinationId: destination.id,
    destinationName: destination.name,
    assets: {
      facebookPageId: destination.facebookPageId,
      facebookPageName: destination.facebookPageName,
      instagramAccountId: destination.instagramAccountId,
      instagramUsername: destination.instagramUsername,
    },
  };
  const legacy = await findClientMetaAssets(db, clientAccountId);
  return legacy ? {
    destinationId: null,
    destinationName: null,
    assets: {
      facebookPageId: legacy.facebookPageId,
      facebookPageName: legacy.facebookPageName,
      instagramAccountId: legacy.instagramAccountId,
      instagramUsername: legacy.instagramUsername,
    },
  } : null;
}

async function lockDestinationClient(connection: Awaited<ReturnType<Pool["getConnection"]>>, clientAccountId: string) {
  await connection.query("SELECT id FROM client_accounts WHERE id = ? FOR UPDATE", [clientAccountId]);
}

export async function createMetaPublishDestination(db: Pool, clientAccountId: string, input: CreateMetaPublishDestinationInput) {
  const connection = await db.getConnection();
  const id = crypto.randomUUID();
  try {
    await connection.beginTransaction();
    await lockDestinationClient(connection, clientAccountId);
    const [countRows] = await connection.query<(RowDataPacket & { total: number | string })[]>("SELECT COUNT(*) AS total FROM meta_publish_destinations WHERE client_account_id = ?", [clientAccountId]);
    const isDefault = input.isDefault === true || Number(countRows[0]?.total ?? 0) === 0;
    if (isDefault) await connection.query("UPDATE meta_publish_destinations SET is_default = FALSE WHERE client_account_id = ?", [clientAccountId]);
    await connection.query(
      [
        "INSERT INTO meta_publish_destinations",
        "(id, client_account_id, name, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, is_default)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
      [id, clientAccountId, input.name, input.facebookPageId ?? null, input.facebookPageName ?? null, input.instagramAccountId ?? null, input.instagramUsername ?? null, isDefault],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findMetaPublishDestination(db, id, clientAccountId);
}

export async function updateMetaPublishDestination(db: Pool, clientAccountId: string, destinationId: string, input: UpdateMetaPublishDestinationInput) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await lockDestinationClient(connection, clientAccountId);
    const [rows] = await connection.query<MetaPublishDestinationRow[]>(`${metaPublishDestinationSelect} WHERE id = ? AND client_account_id = ? FOR UPDATE`, [destinationId, clientAccountId]);
    if (!rows[0]) { await connection.rollback(); return null; }
    const normalizedInput = { ...input };
    if (input.isDefault === true) await connection.query("UPDATE meta_publish_destinations SET is_default = FALSE WHERE client_account_id = ?", [clientAccountId]);
    if (input.isDefault === false && Boolean(rows[0].is_default)) {
      const [replacementRows] = await connection.query<(RowDataPacket & { id: string })[]>(
        "SELECT id FROM meta_publish_destinations WHERE client_account_id = ? AND id <> ? ORDER BY created_at ASC LIMIT 1 FOR UPDATE",
        [clientAccountId, destinationId],
      );
      const replacementId = replacementRows[0]?.id;
      if (replacementId) await connection.query("UPDATE meta_publish_destinations SET is_default = TRUE WHERE id = ?", [replacementId]);
      else delete normalizedInput.isDefault;
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    const fieldMap = {
      name: "name", facebookPageId: "facebook_page_id", facebookPageName: "facebook_page_name",
      instagramAccountId: "instagram_account_id", instagramUsername: "instagram_username", isDefault: "is_default",
    } as const;
    for (const [key, column] of Object.entries(fieldMap) as Array<[keyof typeof fieldMap, string]>) {
      if (normalizedInput[key] !== undefined) { fields.push(`${column} = ?`); values.push(normalizedInput[key]); }
    }
    if (fields.length) await connection.query(`UPDATE meta_publish_destinations SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND client_account_id = ?`, [...values, destinationId, clientAccountId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findMetaPublishDestination(db, destinationId, clientAccountId);
}

export async function countActivePublicationsForDestination(db: Pool, clientAccountId: string, destinationId: string) {
  const [rows] = await db.query<(RowDataPacket & { total: number | string })[]>(
    "SELECT COUNT(*) AS total FROM meta_scheduled_publications WHERE client_account_id = ? AND destination_id = ? AND status IN ('scheduled', 'publishing', 'failed')",
    [clientAccountId, destinationId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function deleteMetaPublishDestination(db: Pool, clientAccountId: string, destinationId: string) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await lockDestinationClient(connection, clientAccountId);
    const [rows] = await connection.query<MetaPublishDestinationRow[]>(`${metaPublishDestinationSelect} WHERE id = ? AND client_account_id = ? FOR UPDATE`, [destinationId, clientAccountId]);
    const current = rows[0];
    if (!current) { await connection.rollback(); return false; }
    await connection.query("DELETE FROM meta_publish_destinations WHERE id = ? AND client_account_id = ?", [destinationId, clientAccountId]);
    if (Boolean(current.is_default)) {
      await connection.query(
        "UPDATE meta_publish_destinations SET is_default = TRUE WHERE client_account_id = ? ORDER BY created_at ASC LIMIT 1",
        [clientAccountId],
      );
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listMetaSavedLocations(db: Pool) {
  const [rows] = await db.query<SavedLocationRow[]>(
    "SELECT id, name, meta_place_id, notes, created_at, updated_at FROM meta_saved_locations ORDER BY name ASC, created_at ASC",
  );
  return rows.map(mapSavedLocation);
}

export async function findMetaSavedLocation(db: Pool, id: string) {
  const [rows] = await db.query<SavedLocationRow[]>(
    "SELECT id, name, meta_place_id, notes, created_at, updated_at FROM meta_saved_locations WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? mapSavedLocation(rows[0]) : null;
}

export async function createMetaSavedLocation(db: Pool, input: CreateMetaSavedLocationInput) {
  const id = crypto.randomUUID();
  await db.query(
    "INSERT INTO meta_saved_locations (id, name, meta_place_id, notes) VALUES (?, ?, ?, ?)",
    [id, input.name, input.metaPlaceId, input.notes ?? null],
  );
  return findMetaSavedLocation(db, id);
}

export async function updateMetaSavedLocation(db: Pool, id: string, input: UpdateMetaSavedLocationInput) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
  if (input.metaPlaceId !== undefined) { fields.push("meta_place_id = ?"); values.push(input.metaPlaceId); }
  if (input.notes !== undefined) { fields.push("notes = ?"); values.push(input.notes); }
  const [result] = await db.query<ResultSetHeader>(
    `UPDATE meta_saved_locations SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, id],
  );
  return result.affectedRows > 0 ? findMetaSavedLocation(db, id) : null;
}

export async function deleteMetaSavedLocation(db: Pool, id: string) {
  const [result] = await db.query<ResultSetHeader>("DELETE FROM meta_saved_locations WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export type CreateScheduledPublicationInput = {
  clientAccountId: string;
  cardId: string | null;
  destinationId: string | null;
  destinationName: string | null;
  platform: "instagram" | "facebook";
  metaAssetId: string;
  scheduledAt: string;
  timezone: string;
  caption: string | null;
  mediaUrl: string;
  mediaUrls: string[];
  mediaType: "image" | "carousel" | "reel" | "story";
  reelCoverUrl: string | null;
  locationId: string | null;
  locationName: string | null;
  instagramUserTags: Array<{ username: string; x: number; y: number }>;
  createdByUserId: string;
  idempotencyKey: string;
};

export async function createScheduledPublications(db: Pool, inputs: CreateScheduledPublicationInput[]) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Serialize creation per client before looking up absent keys. This avoids
    // InnoDB gap-lock/duplicate-key upgrade races, including multi-platform requests.
    for (const clientId of [...new Set(inputs.map((input) => input.clientAccountId))].sort()) {
      await connection.query("SELECT id FROM client_accounts WHERE id = ? FOR UPDATE", [clientId]);
    }
    const results = [];
    for (const input of inputs) {
      let idempotencyKey = input.idempotencyKey;
      let existing: ScheduledPublicationRow | undefined;
      while (true) {
        const [rows] = await connection.query<ScheduledPublicationRow[]>(
          `${scheduledPublicationSelect} WHERE idempotency_key = ? LIMIT 1 FOR UPDATE`,
          [idempotencyKey],
        );
        existing = rows[0];
        if (!existing || !["cancelled", "failed"].includes(existing.status)) break;
        // Persisted history determines the next generation. Concurrent replays
        // traverse the same chain and find the same active publication.
        idempotencyKey = crypto.createHash("sha256")
          .update(`${input.idempotencyKey}:after:${existing.id}`)
          .digest("hex");
      }
      if (existing) {
        // Published requests remain idempotent so replays cannot publish twice.
        results.push({ publication: mapScheduledPublication(existing), created: false });
        continue;
      }
      const id = crypto.randomUUID();
      await connection.query(
        [
          "INSERT INTO meta_scheduled_publications",
          "(id, client_account_id, card_id, destination_id, destination_name, platform, meta_asset_id, scheduled_at, timezone, caption, media_url, media_urls_json, media_type, reel_cover_url, location_id, location_name, instagram_user_tags_json, status, created_by_user_id, idempotency_key)",
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
        ].join(" "),
        [
          id, input.clientAccountId, input.cardId, input.destinationId, input.destinationName, input.platform, input.metaAssetId,
          mysqlUtcDateTime(input.scheduledAt), input.timezone, input.caption, input.mediaUrl,
          JSON.stringify(input.mediaUrls), input.mediaType, input.reelCoverUrl, input.locationId, input.locationName, JSON.stringify(input.instagramUserTags),
          input.createdByUserId, idempotencyKey,
        ],
      );
      const [rows] = await connection.query<ScheduledPublicationRow[]>(
        `${scheduledPublicationSelect} WHERE id = ? LIMIT 1`,
        [id],
      );
      if (!rows[0]) throw new Error("Scheduled Meta publication could not be loaded after insert");
      results.push({ publication: mapScheduledPublication(rows[0]), created: true });
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

export async function listScheduledPublicationsForClient(db: Pool, clientAccountId: string, range: { from?: string; to?: string } = {}) {
  const conditions = ["p.client_account_id = ?"];
  const params: unknown[] = [clientAccountId];
  if (range.from) { conditions.push("p.scheduled_at >= ?"); params.push(mysqlUtcDateTime(range.from)); }
  if (range.to) { conditions.push("p.scheduled_at < ?"); params.push(mysqlUtcDateTime(range.to)); }
  const [rows] = await db.query<ScheduledPublicationRow[]>(
    [
      "SELECT p.id, p.client_account_id, p.card_id, p.destination_id, p.destination_name, p.platform, p.meta_asset_id,",
      "DATE_FORMAT(p.scheduled_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS scheduled_at, p.timezone, p.caption, p.media_url, p.media_urls_json, p.media_type, p.reel_cover_url, p.location_id, p.location_name, p.instagram_user_tags_json,",
      "p.status, p.attempt_count, p.idempotency_key, p.published_meta_id, p.published_permalink, p.last_error, p.created_by_user_id, p.created_at, p.updated_at, p.published_at, k.title AS card_title",
      "FROM meta_scheduled_publications p LEFT JOIN kanban_cards k ON k.id = p.card_id",
      `WHERE ${conditions.join(" AND ")} ORDER BY p.scheduled_at ASC, p.created_at ASC`,
    ].join(" "),
    params,
  );
  return rows.map(mapScheduledPublication);
}

type GlobalScheduledPublicationRow = ScheduledPublicationRow & {
  client_name: string;
  client_slug: string;
  card_title: string | null;
};

export type GlobalMetaPublicationFilters = {
  clientAccountId?: string;
  platform?: "instagram" | "facebook";
  mediaType?: "image" | "carousel" | "reel" | "story";
  status?: MetaScheduledPublicationStatus;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

function globalPublicationWhere(filters: GlobalMetaPublicationFilters) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.clientAccountId) { conditions.push("p.client_account_id = ?"); params.push(filters.clientAccountId); }
  if (filters.platform) { conditions.push("p.platform = ?"); params.push(filters.platform); }
  if (filters.mediaType) { conditions.push("p.media_type = ?"); params.push(filters.mediaType); }
  if (filters.status) { conditions.push("p.status = ?"); params.push(filters.status); }
  if (filters.from) { conditions.push("p.scheduled_at >= ?"); params.push(mysqlUtcDateTime(filters.from)); }
  if (filters.to) { conditions.push("p.scheduled_at < ?"); params.push(mysqlUtcDateTime(filters.to)); }
  return { sql: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "", params };
}

export async function listGlobalScheduledPublications(db: Pool, filters: GlobalMetaPublicationFilters) {
  const where = globalPublicationWhere(filters);
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(filters.limit)));
  const safeOffset = Math.max(0, Math.trunc(filters.offset));
  const fields = [
    "p.id, p.client_account_id, p.card_id, p.destination_id, p.destination_name, p.platform, p.meta_asset_id,",
    "DATE_FORMAT(p.scheduled_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS scheduled_at, p.timezone, p.caption, p.media_url, p.media_urls_json, p.media_type, p.reel_cover_url, p.location_id, p.location_name, p.instagram_user_tags_json,",
    "p.status, p.attempt_count, p.idempotency_key, p.published_meta_id, p.published_permalink, p.last_error, p.created_by_user_id, p.created_at, p.updated_at, p.published_at,",
    "c.name AS client_name, c.slug AS client_slug, k.title AS card_title",
  ].join(" ");
  const joins = " FROM meta_scheduled_publications p INNER JOIN client_accounts c ON c.id = p.client_account_id LEFT JOIN kanban_cards k ON k.id = p.card_id";
  const [rows] = await db.query<GlobalScheduledPublicationRow[]>(
    `SELECT ${fields}${joins}${where.sql} ORDER BY p.scheduled_at ASC, p.created_at ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    where.params,
  );
  const [countRows] = await db.query<(RowDataPacket & { total: number | string })[]>(
    `SELECT COUNT(*) AS total${joins}${where.sql}`,
    where.params,
  );
  const [summaryRows] = await db.query<(RowDataPacket & { scheduled: number | string; publishing: number | string; published_today: number | string; failed: number | string })[]>([
    "SELECT SUM(status = 'scheduled') AS scheduled, SUM(status = 'publishing') AS publishing,",
    "SUM(status = 'published' AND published_at >= UTC_DATE()) AS published_today, SUM(status = 'failed') AS failed",
    "FROM meta_scheduled_publications",
  ].join(" "));
  return {
    items: rows.map((row) => ({
      ...mapScheduledPublication(row),
      clientName: row.client_name,
      clientSlug: row.client_slug,
      cardTitle: row.card_title?.trim() || "Publicação Meta",
    })),
    total: Number(countRows[0]?.total ?? 0),
    summary: {
      scheduled: Number(summaryRows[0]?.scheduled ?? 0),
      publishing: Number(summaryRows[0]?.publishing ?? 0),
      publishedToday: Number(summaryRows[0]?.published_today ?? 0),
      failed: Number(summaryRows[0]?.failed ?? 0),
    },
  };
}

async function lockScheduledPublications(connection: Awaited<ReturnType<Pool["getConnection"]>>, ids: string[]) {
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await connection.query<ScheduledPublicationRow[]>(
    `${scheduledPublicationSelect} WHERE id IN (${placeholders}) FOR UPDATE`,
    ids,
  );
  return rows;
}

export async function rescheduleScheduledPublications(db: Pool, input: { publicationIds: string[]; scheduledAt: string; timezone: string }) {
  const ids = [...new Set(input.publicationIds)];
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const rows = await lockScheduledPublications(connection, ids);
    if (rows.length !== ids.length || rows.some((row) => row.status !== "scheduled")) {
      await connection.rollback();
      return false;
    }
    const placeholders = ids.map(() => "?").join(", ");
    await connection.query(
      `UPDATE meta_scheduled_publications SET scheduled_at = ?, timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [mysqlUtcDateTime(input.scheduledAt), input.timezone, ...ids],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelScheduledPublicationGroup(db: Pool, publicationIds: string[]) {
  const ids = [...new Set(publicationIds)];
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const rows = await lockScheduledPublications(connection, ids);
    if (rows.length !== ids.length || rows.some((row) => !["scheduled", "failed"].includes(row.status))) {
      await connection.rollback();
      return null;
    }
    const placeholders = ids.map(() => "?").join(", ");
    await connection.query(
      `UPDATE meta_scheduled_publications SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ids,
    );
    await connection.commit();
    return rows.map(mapScheduledPublication);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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

export async function markStalePublishingFailed(db: Pool, input: { updatedBefore: string; lastError: string }) {
  const [result] = await db.query<ResultSetHeader>(
    [
      "UPDATE meta_scheduled_publications",
      "SET status = 'failed', attempt_count = attempt_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP",
      "WHERE status = 'publishing' AND updated_at < ?",
    ].join(" "),
    [input.lastError.slice(0, 4000), mysqlUtcDateTime(input.updatedBefore)],
  );
  return result.affectedRows;
}

export async function findMetaRoutingCard(db: Pool, cardId: string) {
  const [rows] = await db.query<(RowDataPacket & { id: string; client_account_id: string })[]>(
    "SELECT id, client_account_id FROM kanban_cards WHERE id = ? LIMIT 1", [cardId],
  );
  return rows[0] ? { id: rows[0].id, clientAccountId: rows[0].client_account_id } : null;
}

/** Audit both explicit destinations and legacy bindings, without rejecting shared assets. */
export async function findMetaCrossClientLinks(db: Pool, input: { clientAccountId: string; facebookPageId: string | null; instagramAccountId: string | null }) {
  const [rows] = await db.query<(RowDataPacket & {
    client_account_id: string; client_name: string; destination_id: string | null; destination_name: string | null;
    facebook_page_id: string | null; instagram_account_id: string | null;
  })[]>([
    "SELECT d.client_account_id, c.name AS client_name, d.id AS destination_id, d.name AS destination_name, d.facebook_page_id, d.instagram_account_id",
    "FROM meta_publish_destinations d INNER JOIN client_accounts c ON c.id = d.client_account_id",
    "WHERE d.client_account_id <> ? AND ((? IS NOT NULL AND d.facebook_page_id = ?) OR (? IS NOT NULL AND d.instagram_account_id = ?))",
    "UNION ALL",
    "SELECT a.client_account_id, c.name AS client_name, NULL AS destination_id, NULL AS destination_name, a.facebook_page_id, a.instagram_account_id",
    "FROM client_meta_assets a INNER JOIN client_accounts c ON c.id = a.client_account_id",
    "WHERE a.client_account_id <> ? AND ((? IS NOT NULL AND a.facebook_page_id = ?) OR (? IS NOT NULL AND a.instagram_account_id = ?))",
  ].join(" "), [input.clientAccountId, input.facebookPageId, input.facebookPageId, input.instagramAccountId, input.instagramAccountId,
    input.clientAccountId, input.facebookPageId, input.facebookPageId, input.instagramAccountId, input.instagramAccountId]);
  return rows.flatMap((row) => (["facebook", "instagram"] as const).flatMap((platform) => {
    const assetId = platform === "facebook" ? row.facebook_page_id : row.instagram_account_id;
    const expectedId = platform === "facebook" ? input.facebookPageId : input.instagramAccountId;
    return assetId && assetId === expectedId ? [{ platform, assetId, clientAccountId: row.client_account_id,
      clientName: row.client_name, destinationId: row.destination_id, destinationName: row.destination_name }] : [];
  }));
}
