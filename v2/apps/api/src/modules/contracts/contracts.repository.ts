import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CreateContractInput, CreateContractTemplateInput, UpdateContractInput } from "./contracts.schemas.js";

type ContractDb = Pick<Pool, "query">;

export class ContractConflict extends Error {
  statusCode = 409;
}

export function portalContract<T extends { notes: string }>(contract: T | null) {
  if (!contract) return null;
  const { notes: _internal, ...publicDocument } = contract;
  return publicDocument;
}

type ContractRow = RowDataPacket & {
  id: string; client_account_id: string; client_name: string; client_slug: string; title: string; body_html: string;
  language: string; contract_type: string; start_date: string | Date | null; end_date: string | Date | null;
  contract_value: string; scope_text: string; notes: string; status: "pending" | "accepted" | "cancelled";
  created_at: string; updated_at: string; accepted_at: string | null; accepted_by_user_id: string | null;
};
type TemplateRow = RowDataPacket & { id: string; name: string; body_html: string; language: string; description: string; draft_json: unknown; created_at: string; updated_at: string };
const dateOnly = (value: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
const parse = <T>(value: unknown, fallback: T): T => { if (typeof value === "string") { try { return JSON.parse(value) as T; } catch { return fallback; } } return (value as T) ?? fallback; };

export async function ensureContractTables(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS contracts (
    id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, title VARCHAR(255) NOT NULL, body_html LONGTEXT NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'Português', contract_type VARCHAR(120) NOT NULL DEFAULT 'Prestação de serviços',
    start_date DATE NULL, end_date DATE NULL, contract_value VARCHAR(255) NOT NULL DEFAULT '', scope_text LONGTEXT NOT NULL, notes TEXT NOT NULL,
    status ENUM('pending','accepted','cancelled') NOT NULL DEFAULT 'pending', created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_contracts_legacy_id (legacy_id), KEY idx_contracts_account_status (client_account_id, status),
    CONSTRAINT fk_contracts_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_contracts_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS contract_acceptances (
    id CHAR(36) NOT NULL PRIMARY KEY, contract_id CHAR(36) NOT NULL, user_id CHAR(36) NULL, accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(100) NOT NULL DEFAULT '', legacy_id VARCHAR(120) NULL, UNIQUE KEY uq_contract_acceptances_legacy_id (legacy_id),
    UNIQUE KEY uq_contract_acceptance_user (contract_id, user_id), KEY idx_contract_acceptances_contract (contract_id, accepted_at),
    CONSTRAINT fk_contract_acceptances_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_contract_acceptances_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS contract_templates (
    id CHAR(36) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, body_html LONGTEXT NOT NULL, language VARCHAR(50) NOT NULL DEFAULT 'Português',
    description VARCHAR(500) NOT NULL DEFAULT '', draft_json JSON NULL, created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_contract_templates_legacy_id (legacy_id), CONSTRAINT fk_contract_templates_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

const contractColumns = `c.id,c.client_account_id,a.name client_name,a.slug client_slug,c.title,c.body_html,c.language,c.contract_type,c.start_date,c.end_date,c.contract_value,c.scope_text,c.notes,c.status,c.created_at,c.updated_at,
  (SELECT ca.accepted_at FROM contract_acceptances ca WHERE ca.contract_id=c.id ORDER BY ca.accepted_at LIMIT 1) accepted_at,
  (SELECT ca.user_id FROM contract_acceptances ca WHERE ca.contract_id=c.id ORDER BY ca.accepted_at LIMIT 1) accepted_by_user_id`;
const mapContract = (row: ContractRow) => ({ id: row.id, clientAccountId: row.client_account_id, clientName: row.client_name, clientSlug: row.client_slug, title: row.title, bodyHtml: row.body_html, language: row.language, contractType: row.contract_type, startDate: dateOnly(row.start_date), endDate: dateOnly(row.end_date), contractValue: row.contract_value, scope: row.scope_text, notes: row.notes, status: row.accepted_at ? "accepted" : row.status, createdAt: row.created_at, updatedAt: row.updated_at, acceptedAt: row.accepted_at, acceptedByUserId: row.accepted_by_user_id });

export async function listContracts(db: Pool, clientIds: string[] | null) {
  const where = clientIds ? clientIds.length ? ` WHERE c.client_account_id IN (${clientIds.map(() => "?").join(",")})` : " WHERE 1=0" : "";
  const [rows] = await db.query<ContractRow[]>(`SELECT ${contractColumns} FROM contracts c JOIN client_accounts a ON a.id=c.client_account_id${where} ORDER BY c.created_at DESC`, clientIds ?? []);
  return rows.map(mapContract);
}
export async function findContract(db: ContractDb, id: string) { const [rows] = await db.query<ContractRow[]>(`SELECT ${contractColumns} FROM contracts c JOIN client_accounts a ON a.id=c.client_account_id WHERE c.id=? LIMIT 1`, [id]); return rows[0] ? mapContract(rows[0]) : null; }
export async function findPendingContract(db: Pool, clientAccountId: string) { const [rows] = await db.query<ContractRow[]>(`SELECT ${contractColumns} FROM contracts c JOIN client_accounts a ON a.id=c.client_account_id WHERE c.client_account_id=? AND c.status='pending' AND NOT EXISTS (SELECT 1 FROM contract_acceptances ca WHERE ca.contract_id=c.id) ORDER BY c.created_at LIMIT 1`, [clientAccountId]); return rows[0] ? mapContract(rows[0]) : null; }

// Every mutation locks the parent document, so edit/delete and acceptance cannot race.
async function mutateContract<T>(db: Pool, id: string, operation: (connection: ContractDb, row: { client_account_id: string; status: string }, accepted: boolean) => Promise<T>) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>("SELECT client_account_id,status FROM contracts WHERE id=? FOR UPDATE", [id]);
    if (!rows[0]) throw Object.assign(new Error("Contrato não encontrado."), { statusCode: 404 });
    const [acceptances] = await connection.query<RowDataPacket[]>("SELECT id FROM contract_acceptances WHERE contract_id=? LIMIT 1", [id]);
    const result = await operation(connection, rows[0] as { client_account_id: string; status: string }, acceptances.length > 0);
    await connection.commit();
    return result;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function createContract(db: Pool, userId: string, input: CreateContractInput) {
  const id = input.publicationId ?? crypto.randomUUID();
  try {
    await db.query("INSERT INTO contracts (id,client_account_id,title,body_html,language,contract_type,start_date,end_date,contract_value,scope_text,notes,status,created_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [id,input.clientAccountId,input.title,input.bodyHtml,input.language,input.contractType,input.startDate,input.endDate,input.contractValue,input.scope,input.notes,"pending",userId]);
  } catch (error) {
    if (!input.publicationId || (error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
    const existing = await findContract(db, id);
    const keys = ["clientAccountId","title","bodyHtml","language","contractType","startDate","endDate","contractValue","scope","notes"] as const;
    if (!existing || keys.some((key) => existing[key] !== input[key])) throw new ContractConflict("Esta publicação já existe com conteúdo diferente. Crie uma nova versão.");
    return existing; // Retry after a lost response: never edit or create a second document.
  }
  return findContract(db,id);
}
export async function updateContract(db: Pool, id: string, input: UpdateContractInput) {
  return mutateContract(db, id, async (connection, row, accepted) => {
    if (accepted || row.status === "accepted") throw new ContractConflict("Contrato aceito é imutável. Crie um novo documento para alterar os termos.");
    if (input.status === "accepted") throw new ContractConflict("O aceite deve ser registrado pela área do cliente.");
    const fields:string[]=[]; const values:unknown[]=[];
    const entries:Array<[keyof UpdateContractInput,string]>=[["clientAccountId","client_account_id"],["title","title"],["bodyHtml","body_html"],["language","language"],["contractType","contract_type"],["startDate","start_date"],["endDate","end_date"],["contractValue","contract_value"],["scope","scope_text"],["notes","notes"],["status","status"]];
    for(const [key,column] of entries) if(typeof input[key]!=="undefined"){fields.push(`${column}=?`);values.push(input[key]);}
    if(fields.length){values.push(id);await connection.query(`UPDATE contracts SET ${fields.join(",")} WHERE id=?`,values);}
    return findContract(connection,id);
  });
}
export async function deleteContract(db: Pool,id:string){
  return mutateContract(db, id, async (connection, row, accepted) => {
    if (accepted || row.status === "accepted") throw new ContractConflict("Contrato aceito e seu histórico não podem ser excluídos.");
    const [result]=await connection.query<ResultSetHeader>("DELETE FROM contracts WHERE id=?",[id]);return result.affectedRows>0;
  });
}
export async function acceptContract(db: Pool, contractId: string, clientAccountId: string, userId: string, ipAddress: string) {
  return mutateContract(db, contractId, async (connection, row, accepted) => {
    if (row.client_account_id !== clientAccountId) throw Object.assign(new Error("Contrato não encontrado nesta conta."), { statusCode: 404 });
    if (row.status !== "pending" || accepted) throw new ContractConflict("Este contrato não está pendente de aceite.");
    await connection.query("INSERT INTO contract_acceptances (id,contract_id,user_id,ip_address) VALUES (?,?,?,?)",[crypto.randomUUID(),contractId,userId,ipAddress.slice(0,100)]);
    // The existing document is the preserved snapshot; no historical data is rewritten.
    return findContract(connection,contractId);
  });
}

const mapTemplate=(row:TemplateRow)=>({id:row.id,name:row.name,bodyHtml:row.body_html,language:row.language,description:row.description,draft:parse(row.draft_json,{}),custom:true,createdAt:row.created_at,updatedAt:row.updated_at});
export async function listContractTemplates(db:Pool){const [rows]=await db.query<TemplateRow[]>("SELECT id,name,body_html,language,description,draft_json,created_at,updated_at FROM contract_templates ORDER BY created_at DESC");return rows.map(mapTemplate);}
export async function createContractTemplate(db:Pool,userId:string,input:CreateContractTemplateInput){const id=crypto.randomUUID();await db.query("INSERT INTO contract_templates (id,name,body_html,language,description,draft_json,created_by_user_id) VALUES (?,?,?,?,?,?,?)",[id,input.name,input.bodyHtml,input.language,input.description,JSON.stringify(input.draft),userId]);const [rows]=await db.query<TemplateRow[]>("SELECT id,name,body_html,language,description,draft_json,created_at,updated_at FROM contract_templates WHERE id=?",[id]);return mapTemplate(rows[0]);}
export async function deleteContractTemplate(db:Pool,id:string){const [result]=await db.query<ResultSetHeader>("DELETE FROM contract_templates WHERE id=?",[id]);return result.affectedRows>0;}
