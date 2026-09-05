import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { tokenHash } from "./mcp.security.js";

type ClientRow = RowDataPacket & {
  client_id: string;
  client_name: string;
  redirect_uris_json: string | string[];
};

type CodeRow = RowDataPacket & {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string;
  expires_at_ms: number | string;
  used_at_ms: number | string | null;
};

type RefreshRow = RowDataPacket & {
  client_id: string;
  user_id: string;
  scope: string;
  resource: string;
  expires_at_ms: number | string;
  revoked_at_ms: number | string | null;
};

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function ensureMcpStorage(db: Pool) {
  await db.query([
    "CREATE TABLE IF NOT EXISTS mcp_oauth_clients (",
    "client_id VARCHAR(190) NOT NULL PRIMARY KEY, client_name VARCHAR(190) NOT NULL, redirect_uris_json JSON NOT NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS mcp_oauth_codes (",
    "code_hash CHAR(64) NOT NULL PRIMARY KEY, client_id VARCHAR(190) NOT NULL, user_id CHAR(36) NOT NULL, redirect_uri VARCHAR(1000) NOT NULL,",
    "code_challenge VARCHAR(128) NOT NULL, scope VARCHAR(255) NOT NULL, resource VARCHAR(1000) NOT NULL, expires_at_ms BIGINT UNSIGNED NOT NULL, used_at_ms BIGINT UNSIGNED NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_mcp_codes_expiry (expires_at_ms),",
    "CONSTRAINT fk_mcp_codes_client FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients (client_id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_mcp_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS mcp_oauth_refresh_tokens (",
    "token_hash CHAR(64) NOT NULL PRIMARY KEY, client_id VARCHAR(190) NOT NULL, user_id CHAR(36) NOT NULL, scope VARCHAR(255) NOT NULL, resource VARCHAR(1000) NOT NULL,",
    "expires_at_ms BIGINT UNSIGNED NOT NULL, revoked_at_ms BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "KEY idx_mcp_refresh_expiry (expires_at_ms),",
    "CONSTRAINT fk_mcp_refresh_client FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients (client_id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_mcp_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS mcp_audit_log (",
    "id CHAR(36) NOT NULL PRIMARY KEY, user_id CHAR(36) NULL, oauth_client_id VARCHAR(190) NOT NULL, tool_name VARCHAR(120) NOT NULL,",
    "success TINYINT(1) NOT NULL, arguments_json JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "KEY idx_mcp_audit_created (created_at), KEY idx_mcp_audit_user_created (user_id, created_at),",
    "CONSTRAINT fk_mcp_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query("DELETE FROM mcp_oauth_codes WHERE expires_at_ms < ? OR used_at_ms IS NOT NULL", [Date.now()]);
  await db.query("DELETE FROM mcp_oauth_refresh_tokens WHERE expires_at_ms < ? OR revoked_at_ms IS NOT NULL", [Date.now()]);
}

export async function createMcpClient(db: Pool, input: { name: string; redirectUris: string[] }) {
  const clientId = `mcp_${crypto.randomBytes(24).toString("base64url")}`;
  await db.query(
    "INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris_json) VALUES (?, ?, ?)",
    [clientId, input.name, JSON.stringify(input.redirectUris)],
  );
  return { clientId, clientName: input.name, redirectUris: input.redirectUris };
}

export async function findMcpClient(db: Pool, clientId: string) {
  const [rows] = await db.query<ClientRow[]>(
    "SELECT client_id, client_name, redirect_uris_json FROM mcp_oauth_clients WHERE client_id = ? LIMIT 1",
    [clientId],
  );
  const row = rows[0];
  return row ? { clientId: row.client_id, clientName: row.client_name, redirectUris: parseStringArray(row.redirect_uris_json) } : null;
}

export async function saveAuthorizationCode(db: Pool, input: { code: string; clientId: string; userId: string; redirectUri: string; codeChallenge: string; scope: string; resource: string }) {
  await db.query(
    "INSERT INTO mcp_oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [tokenHash(input.code), input.clientId, input.userId, input.redirectUri, input.codeChallenge, input.scope, input.resource, Date.now() + 5 * 60 * 1000],
  );
}

export async function consumeAuthorizationCode(db: Pool, code: string) {
  const hash = tokenHash(code);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<CodeRow[]>(
      "SELECT client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at_ms, used_at_ms FROM mcp_oauth_codes WHERE code_hash = ? FOR UPDATE",
      [hash],
    );
    const row = rows[0];
    if (!row || row.used_at_ms !== null || Number(row.expires_at_ms) <= Date.now()) {
      await connection.rollback();
      return null;
    }
    await connection.query("UPDATE mcp_oauth_codes SET used_at_ms = ? WHERE code_hash = ?", [Date.now(), hash]);
    await connection.commit();
    return { clientId: row.client_id, userId: row.user_id, redirectUri: row.redirect_uri, codeChallenge: row.code_challenge, scope: row.scope, resource: row.resource };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveRefreshToken(db: Pool, input: { token: string; clientId: string; userId: string; scope: string; resource: string; expiresAtMs: number }) {
  await db.query(
    "INSERT INTO mcp_oauth_refresh_tokens (token_hash, client_id, user_id, scope, resource, expires_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
    [tokenHash(input.token), input.clientId, input.userId, input.scope, input.resource, input.expiresAtMs],
  );
}

export async function rotateRefreshToken(db: Pool, token: string) {
  const hash = tokenHash(token);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RefreshRow[]>(
      "SELECT client_id, user_id, scope, resource, expires_at_ms, revoked_at_ms FROM mcp_oauth_refresh_tokens WHERE token_hash = ? FOR UPDATE",
      [hash],
    );
    const row = rows[0];
    if (!row || row.revoked_at_ms !== null || Number(row.expires_at_ms) <= Date.now()) {
      await connection.rollback();
      return null;
    }
    await connection.query("UPDATE mcp_oauth_refresh_tokens SET revoked_at_ms = ? WHERE token_hash = ?", [Date.now(), hash]);
    await connection.commit();
    return { clientId: row.client_id, userId: row.user_id, scope: row.scope, resource: row.resource };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeRefreshToken(db: Pool, token: string, clientId: string) {
  await db.query(
    "UPDATE mcp_oauth_refresh_tokens SET revoked_at_ms = COALESCE(revoked_at_ms, ?) WHERE token_hash = ? AND client_id = ?",
    [Date.now(), tokenHash(token), clientId],
  );
}

export async function recordMcpAudit(db: Pool, input: { userId: string; clientId: string; toolName: string; success: boolean; args: unknown }) {
  await db.query(
    "INSERT INTO mcp_audit_log (id, user_id, oauth_client_id, tool_name, success, arguments_json) VALUES (?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), input.userId, input.clientId, input.toolName, input.success ? 1 : 0, JSON.stringify(input.args ?? {})],
  );
}
