import type { PoolConnection, RowDataPacket } from "mysql2/promise";
const LOCK_NAME = "designhub-invoice-generation";

export async function acquireInvoiceNumberLock(connection: PoolConnection, waitSeconds: number) {
  const [rows] = await connection.query<(RowDataPacket & { acquired: number | null })[]>(
    "SELECT GET_LOCK(?, ?) AS acquired", [LOCK_NAME, waitSeconds],
  );
  return Number(rows[0]?.acquired) === 1;
}
export async function releaseInvoiceNumberLock(connection: PoolConnection) {
  await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
}
