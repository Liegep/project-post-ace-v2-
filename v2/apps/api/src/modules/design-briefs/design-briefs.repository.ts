import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CreateDesignBriefInput, CreateDesignBriefTemplateInput, UpdateDesignBriefInput } from "./design-briefs.schemas.js";

type BriefRow = RowDataPacket & { id: string; client_account_id: string | null; title: string; introduction: string; category: string; locale: string; status: "draft" | "completed"; fields_json: unknown; answers_json: unknown; submitted_at: string | Date | null; created_at: string | Date; updated_at: string | Date };
type TemplateRow = RowDataPacket & { id: string; name: string; introduction: string; fields_json: unknown; created_at: string | Date; updated_at: string | Date };
const parse = <T>(value: unknown, fallback: T): T => { if (typeof value === "string") { try { return JSON.parse(value) as T; } catch { return fallback; } } return (value as T) ?? fallback; };
const mapBrief = (row: BriefRow) => ({ id: row.id, clientAccountId: row.client_account_id, title: row.title, introduction: row.introduction, category: row.category, locale: row.locale, status: row.status, fields: parse(row.fields_json, []), answers: parse(row.answers_json, {}), submittedAt: row.submitted_at, createdAt: row.created_at, updatedAt: row.updated_at });
const mapTemplate = (row: TemplateRow) => ({ id: row.id, name: row.name, introduction: row.introduction, fields: parse(row.fields_json, []), createdAt: row.created_at, updatedAt: row.updated_at });

export async function ensureDesignBriefTables(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS design_briefs (
    id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NULL, title VARCHAR(500) NOT NULL,
    introduction TEXT NOT NULL, category VARCHAR(100) NOT NULL DEFAULT 'custom', locale ENUM('pt','en','es','it','sv') NOT NULL DEFAULT 'pt',
    status ENUM('draft','completed') NOT NULL DEFAULT 'draft', fields_json JSON NOT NULL, answers_json JSON NOT NULL,
    submitted_at DATETIME(3) NULL, created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_design_briefs_legacy_id (legacy_id), KEY idx_design_briefs_client_created (client_account_id,created_at),
    CONSTRAINT fk_design_briefs_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_design_briefs_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS design_brief_templates (
    id CHAR(36) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, introduction TEXT NOT NULL, fields_json JSON NOT NULL,
    created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_design_brief_templates_legacy_id (legacy_id),
    CONSTRAINT fk_design_brief_templates_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

const briefColumns = "id,client_account_id,title,introduction,category,locale,status,fields_json,answers_json,submitted_at,created_at,updated_at";
export async function listDesignBriefs(db: Pool) { const [rows] = await db.query<BriefRow[]>(`SELECT ${briefColumns} FROM design_briefs ORDER BY created_at DESC`); return rows.map(mapBrief); }
export async function findDesignBrief(db: Pool, id: string) { const [rows] = await db.query<BriefRow[]>(`SELECT ${briefColumns} FROM design_briefs WHERE id=? LIMIT 1`, [id]); return rows[0] ? mapBrief(rows[0]) : null; }
export async function createDesignBrief(db: Pool, userId: string, input: CreateDesignBriefInput) { const id = crypto.randomUUID(); await db.query("INSERT INTO design_briefs (id,client_account_id,title,introduction,category,locale,status,fields_json,answers_json,submitted_at,created_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [id,input.clientAccountId??null,input.title,input.introduction,input.category,input.locale,input.status,JSON.stringify(input.fields),JSON.stringify(input.answers),input.status==="completed"?new Date():null,userId]); return findDesignBrief(db,id); }
export async function updateDesignBrief(db: Pool, id: string, input: UpdateDesignBriefInput) { const fields:string[]=[];const values:unknown[]=[];const entries:Array<[keyof UpdateDesignBriefInput,string,boolean]>=[["clientAccountId","client_account_id",false],["title","title",false],["introduction","introduction",false],["category","category",false],["locale","locale",false],["status","status",false],["fields","fields_json",true],["answers","answers_json",true]];for(const [key,column,json] of entries)if(typeof input[key]!=="undefined"){fields.push(`${column}=?`);values.push(json?JSON.stringify(input[key]):input[key]);}if(input.status==="completed"){fields.push("submitted_at=COALESCE(submitted_at,CURRENT_TIMESTAMP(3))");}if(fields.length){values.push(id);await db.query(`UPDATE design_briefs SET ${fields.join(",")} WHERE id=?`,values);}return findDesignBrief(db,id); }
export async function deleteDesignBrief(db: Pool,id:string){const [result]=await db.query<ResultSetHeader>("DELETE FROM design_briefs WHERE id=?",[id]);return result.affectedRows>0;}

const templateColumns="id,name,introduction,fields_json,created_at,updated_at";
export async function listDesignBriefTemplates(db:Pool){const [rows]=await db.query<TemplateRow[]>(`SELECT ${templateColumns} FROM design_brief_templates ORDER BY created_at DESC`);return rows.map(mapTemplate);}
export async function createDesignBriefTemplate(db:Pool,userId:string,input:CreateDesignBriefTemplateInput){const id=crypto.randomUUID();await db.query("INSERT INTO design_brief_templates (id,name,introduction,fields_json,created_by_user_id) VALUES (?,?,?,?,?)",[id,input.name,input.introduction,JSON.stringify(input.fields),userId]);const [rows]=await db.query<TemplateRow[]>(`SELECT ${templateColumns} FROM design_brief_templates WHERE id=?`,[id]);return mapTemplate(rows[0]);}
export async function deleteDesignBriefTemplate(db:Pool,id:string){const [result]=await db.query<ResultSetHeader>("DELETE FROM design_brief_templates WHERE id=?",[id]);return result.affectedRows>0;}
