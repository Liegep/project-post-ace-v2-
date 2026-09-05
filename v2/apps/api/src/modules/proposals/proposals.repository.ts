import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CreateProposalInput, UpdateProposalInput } from "./proposals.schemas.js";

type ProposalRow = RowDataPacket & {
  id: string; token: string; client_name: string; client_email: string; locale: string; proposal_type: string;
  plan: string; pieces_quantity: number; scope_description: string; investment_description: string; currency: string;
  expires_at: Date | string; status: "draft" | "sent" | "viewed" | "accepted" | "refused" | "expired";
  services_json: unknown; accepted_at: Date | string | null; viewed_at: Date | string | null; created_at: Date | string; updated_at: Date | string;
};

const parseServices = (value: unknown) => { if (typeof value === "string") { try { return JSON.parse(value); } catch { return []; } } return Array.isArray(value) ? value : []; };
const mapProposal = (row: ProposalRow) => ({ id: row.id, token: row.token, clientName: row.client_name, email: row.client_email, locale: row.locale, proposalType: row.proposal_type, plan: row.plan, pieces: Number(row.pieces_quantity), scope: row.scope_description, investment: row.investment_description, currency: row.currency, expiresAt: row.expires_at, status: row.status, services: parseServices(row.services_json), acceptedAt: row.accepted_at, viewedAt: row.viewed_at, createdAt: row.created_at, updatedAt: row.updated_at });

export async function ensureProposalTables(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS proposals (
    id CHAR(36) NOT NULL PRIMARY KEY, token VARCHAR(160) NOT NULL, client_name VARCHAR(255) NOT NULL, client_email VARCHAR(320) NOT NULL DEFAULT '',
    locale VARCHAR(30) NOT NULL DEFAULT 'Português', proposal_type VARCHAR(120) NOT NULL DEFAULT 'Projeto', plan VARCHAR(255) NOT NULL DEFAULT '',
    pieces_quantity INT NOT NULL DEFAULT 0, scope_description LONGTEXT NOT NULL, investment_description LONGTEXT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'R$', expires_at DATETIME(3) NOT NULL,
    status ENUM('draft','sent','viewed','accepted','refused','expired') NOT NULL DEFAULT 'draft', services_json JSON NOT NULL,
    accepted_at DATETIME(3) NULL, viewed_at DATETIME(3) NULL, created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_proposals_token (token), UNIQUE KEY uq_proposals_legacy_id (legacy_id), KEY idx_proposals_status_created (status, created_at),
    CONSTRAINT fk_proposals_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS proposal_templates (
    id CHAR(36) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, locale VARCHAR(30) NOT NULL DEFAULT 'Português', currency VARCHAR(10) NOT NULL DEFAULT 'R$',
    scope_description LONGTEXT NOT NULL, investment_description LONGTEXT NOT NULL, services_json JSON NOT NULL,
    created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_proposal_templates_legacy_id (legacy_id),
    CONSTRAINT fk_proposal_templates_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

const columns = "id,token,client_name,client_email,locale,proposal_type,plan,pieces_quantity,scope_description,investment_description,currency,expires_at,status,services_json,accepted_at,viewed_at,created_at,updated_at";
export async function listProposals(db: Pool) { const [rows] = await db.query<ProposalRow[]>(`SELECT ${columns} FROM proposals ORDER BY created_at DESC`); return rows.map(mapProposal); }
export async function findProposal(db: Pool, id: string) { const [rows] = await db.query<ProposalRow[]>(`SELECT ${columns} FROM proposals WHERE id=? LIMIT 1`, [id]); return rows[0] ? mapProposal(rows[0]) : null; }
export async function findProposalByToken(db: Pool, token: string) { const [rows] = await db.query<ProposalRow[]>(`SELECT ${columns} FROM proposals WHERE token=? LIMIT 1`, [token]); return rows[0] ? mapProposal(rows[0]) : null; }
export async function createProposal(db: Pool, userId: string, input: CreateProposalInput) { const id=crypto.randomUUID(); const token=crypto.randomBytes(24).toString("hex"); await db.query("INSERT INTO proposals (id,token,client_name,client_email,locale,proposal_type,plan,pieces_quantity,scope_description,investment_description,currency,expires_at,status,services_json,created_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,token,input.clientName,input.email,input.locale,input.proposalType,input.plan,input.pieces,input.scope,input.investment,input.currency,input.expiresAt,input.status,JSON.stringify(input.services),userId]); return findProposal(db,id); }
export async function updateProposal(db: Pool,id:string,input:UpdateProposalInput){const fields:string[]=[];const values:unknown[]=[];const entries:Array<[keyof UpdateProposalInput,string]>=[["clientName","client_name"],["email","client_email"],["locale","locale"],["proposalType","proposal_type"],["plan","plan"],["pieces","pieces_quantity"],["scope","scope_description"],["investment","investment_description"],["currency","currency"],["expiresAt","expires_at"],["status","status"]];for(const [key,column] of entries)if(typeof input[key]!=="undefined"){fields.push(`${column}=?`);values.push(input[key]);}if(input.services){fields.push("services_json=?");values.push(JSON.stringify(input.services));}if(fields.length){values.push(id);await db.query(`UPDATE proposals SET ${fields.join(",")} WHERE id=?`,values);}return findProposal(db,id);}
export async function deleteProposal(db:Pool,id:string){const [result]=await db.query<ResultSetHeader>("DELETE FROM proposals WHERE id=?",[id]);return result.affectedRows>0;}
export async function markProposalViewed(db:Pool,token:string){await db.query("UPDATE proposals SET viewed_at=COALESCE(viewed_at,CURRENT_TIMESTAMP(3)), status=IF(status='sent','viewed',status) WHERE token=?",[token]);return findProposalByToken(db,token);}
export async function decideProposal(db:Pool,token:string,status:"accepted"|"refused"){await db.query("UPDATE proposals SET status=?, accepted_at=IF(?='accepted',CURRENT_TIMESTAMP(3),accepted_at) WHERE token=? AND status NOT IN ('expired')",[status,status,token]);return findProposalByToken(db,token);}
