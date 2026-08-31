import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

type ResetTokenRow = RowDataPacket & {
  user_id: string;
};

type LatestRequestRow = RowDataPacket & {
  created_at_ms: number | string;
};

let schemaPromise: Promise<void> | null = null;

export async function ensurePasswordResetTable(db: Pool) {
  if (!schemaPromise) {
    schemaPromise = db.query(
      [
        "CREATE TABLE IF NOT EXISTS password_reset_tokens (",
        "id CHAR(36) NOT NULL PRIMARY KEY,",
        "user_id CHAR(36) NOT NULL,",
        "token_hash CHAR(64) NOT NULL,",
        "expires_at_ms BIGINT UNSIGNED NOT NULL,",
        "used_at_ms BIGINT UNSIGNED NULL,",
        "created_at_ms BIGINT UNSIGNED NOT NULL,",
        "UNIQUE KEY uq_password_reset_token_hash (token_hash),",
        "KEY idx_password_reset_user_created (user_id, created_at_ms),",
        "KEY idx_password_reset_expiration (expires_at_ms),",
        "CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id)",
        "ON DELETE CASCADE ON UPDATE CASCADE",
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
      ].join(" "),
    ).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function getLatestPasswordResetRequestAt(db: Pool, userId: string) {
  const [rows] = await db.query<LatestRequestRow[]>(
    "SELECT created_at_ms FROM password_reset_tokens WHERE user_id = ? ORDER BY created_at_ms DESC LIMIT 1",
    [userId],
  );
  const value = rows[0]?.created_at_ms;
  return value === undefined ? null : Number(value);
}

export async function replacePasswordResetToken(
  db: Pool,
  input: { userId: string; tokenHash: string; expiresAtMs: number; createdAtMs: number },
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE password_reset_tokens SET used_at_ms = ? WHERE user_id = ? AND used_at_ms IS NULL",
      [input.createdAtMs, input.userId],
    );
    await connection.query(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at_ms, created_at_ms) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), input.userId, input.tokenHash, input.expiresAtMs, input.createdAtMs],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deletePasswordResetToken(db: Pool, tokenHash: string) {
  await db.query("DELETE FROM password_reset_tokens WHERE token_hash = ?", [tokenHash]);
}

export async function consumePasswordResetToken(
  db: Pool,
  input: { tokenHash: string; passwordHash: string; nowMs: number },
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<ResetTokenRow[]>(
      [
        "SELECT user_id FROM password_reset_tokens",
        "WHERE token_hash = ? AND used_at_ms IS NULL AND expires_at_ms > ?",
        "LIMIT 1 FOR UPDATE",
      ].join(" "),
      [input.tokenHash, input.nowMs],
    );
    const token = rows[0];
    if (!token) {
      await connection.rollback();
      return false;
    }
    await connection.query("UPDATE users SET password_hash = ? WHERE id = ? AND is_active = 1", [input.passwordHash, token.user_id]);
    await connection.query(
      "UPDATE password_reset_tokens SET used_at_ms = ? WHERE user_id = ? AND used_at_ms IS NULL",
      [input.nowMs, token.user_id],
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
