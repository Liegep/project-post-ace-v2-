import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
type Executor = Pool | PoolConnection;

export async function ensureBillingSettings(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS billing_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    receipt_signature_url VARCHAR(2000) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function getReceiptSignature(db: Executor): Promise<string | null> {
  const [rows] = await db.query<(RowDataPacket & { receipt_signature_url: string | null })[]>(
    "SELECT receipt_signature_url FROM billing_settings WHERE id = 1",
  );
  return rows[0]?.receipt_signature_url ?? null;
}

export async function setReceiptSignature(db: Executor, url: string | null) {
  // Only the current reference changes. Uploads referenced by issued receipts are retained.
  await db.query("INSERT INTO billing_settings (id, receipt_signature_url) VALUES (1, ?) ON DUPLICATE KEY UPDATE receipt_signature_url = VALUES(receipt_signature_url)", [url]);
}
