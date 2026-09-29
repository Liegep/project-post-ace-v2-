import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
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
