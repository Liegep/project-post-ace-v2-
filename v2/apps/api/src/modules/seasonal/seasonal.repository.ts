import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { OpportunityInput } from "./seasonal.schemas.js";
import { OPERATION_WORKSPACE as workspace } from "./seasonal.types.js";
import type { EditorialClient, MonitoredCountry, RadarOccurrence } from "./seasonal.types.js";

function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
function timestamp(value: unknown) { return new Date(value as string | Date).toISOString(); }

export class SeasonalRepository {
  constructor(private readonly db: Pool) {}
  async monitoredCountries(): Promise<MonitoredCountry[]> {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT country_code, active, created_at, updated_at FROM seasonal_monitored_countries WHERE workspace_id = ? ORDER BY country_code", [workspace]);
    return rows.map((row) => ({ countryCode: row.country_code, active: !!row.active, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }));
  }
  async setMonitoredCountry(countryCode: string, active: boolean) {
    await this.db.query(`INSERT INTO seasonal_monitored_countries (workspace_id, country_code, active) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE active = VALUES(active), updated_at = CURRENT_TIMESTAMP(3)`, [workspace, countryCode, active ? 1 : 0]);
  }
  async categories(): Promise<Array<{ code: string; label: string }>> {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT code, label FROM seasonal_categories WHERE workspace_id = ? ORDER BY label", [workspace]);
    return rows.map((row) => ({ code: row.code, label: row.label }));
  }
  async addCategory(code: string, label: string) {
    await this.db.query("INSERT INTO seasonal_categories (workspace_id, code, label) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label)", [workspace, code, label]);
  }
  async clientExists(clientId: string) {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT id FROM client_accounts WHERE id = ?", [clientId]);
    return rows.length > 0;
  }
  async markets(clientId: string) {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT country_code, active, confirmed_by_user_id, created_at, updated_at FROM client_editorial_markets WHERE workspace_id = ? AND client_account_id = ? ORDER BY country_code", [workspace, clientId]);
    return rows.map((row) => ({ countryCode: row.country_code as string, active: !!row.active, confirmedByUserId: row.confirmed_by_user_id as string, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }));
  }
  async confirmMarkets(clientId: string, countryCodes: string[], userId: string) {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the client to serialize concurrent confirmations, including an initially empty market set.
      await connection.query("SELECT id FROM client_accounts WHERE id = ? FOR UPDATE", [clientId]);
      await connection.query("UPDATE client_editorial_markets SET active = 0 WHERE workspace_id = ? AND client_account_id = ?", [workspace, clientId]);
      for (const code of countryCodes) await connection.query(`INSERT INTO client_editorial_markets (workspace_id, client_account_id, country_code, active, confirmed_by_user_id)
        VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE active = 1, confirmed_by_user_id = VALUES(confirmed_by_user_id), updated_at = CURRENT_TIMESTAMP(3)`, [workspace, clientId, code, userId]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async editorialClients(allowedIds: string[] | null): Promise<EditorialClient[]> {
    if (allowedIds?.length === 0) return [];
    const scope = allowedIds ? ` AND c.id IN (${allowedIds.map(() => "?").join(",")})` : "";
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT c.id, c.name, c.slug, m.country_code FROM client_accounts c
      JOIN client_editorial_markets m ON m.client_account_id = c.id AND m.workspace_id = ? AND m.active = 1
      WHERE 1 = 1${scope} ORDER BY c.name, m.country_code`, [workspace, ...(allowedIds ?? [])]);
    const clients = new Map<string, EditorialClient>();
    for (const row of rows) {
      const client: EditorialClient = clients.get(row.id) ?? { id: row.id, name: row.name, slug: row.slug, countryCodes: [] };
      client.countryCodes.push(row.country_code); clients.set(row.id, client);
    }
    return [...clients.values()];
  }
  async createOpportunity(input: OpportunityInput) {
    const id = crypto.randomUUID();
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(`INSERT INTO seasonal_opportunities (id, workspace_id, title, description, category_code, origin, scope) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, workspace, input.title, input.description, input.categoryCode, input.origin, input.scope]);
      for (const code of input.countryCodes) await connection.query("INSERT INTO seasonal_opportunity_countries (workspace_id, opportunity_id, country_code) VALUES (?, ?, ?)", [workspace, id, code]);
      for (const occurrence of input.occurrences) await connection.query(`INSERT INTO seasonal_occurrences
        (id, workspace_id, opportunity_id, occurrence_date, external_source, external_reference, external_payload, country_codes_json, regional_scope_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), workspace, id, occurrence.date, occurrence.externalSource ?? null, occurrence.externalReference ?? null,
        occurrence.externalPayload ? JSON.stringify(occurrence.externalPayload) : null, occurrence.countryCodes ? JSON.stringify(occurrence.countryCodes) : null, occurrence.regionalScope ? JSON.stringify(occurrence.regionalScope) : null]);
      await connection.commit(); return id;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async occurrences(from: string, to: string): Promise<RadarOccurrence[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT o.id AS opportunity_id, o.title, o.description, o.category_code, o.origin, o.scope,
      r.id, DATE_FORMAT(r.occurrence_date, '%Y-%m-%d') AS date, r.occurrence_year, r.external_source, r.external_reference, r.country_codes_json, r.regional_scope_json
      FROM seasonal_occurrences r JOIN seasonal_opportunities o ON o.id = r.opportunity_id AND o.workspace_id = r.workspace_id
      WHERE r.workspace_id = ? AND r.occurrence_date BETWEEN ? AND ? ORDER BY r.occurrence_date, r.id`, [workspace, from, to]);
    const [countryRows] = await this.db.query<RowDataPacket[]>("SELECT opportunity_id, country_code FROM seasonal_opportunity_countries WHERE workspace_id = ?", [workspace]);
    const countries = new Map<string, string[]>();
    for (const row of countryRows) countries.set(row.opportunity_id, [...(countries.get(row.opportunity_id) ?? []), row.country_code]);
    return rows.map((row) => ({ id: row.id, opportunityId: row.opportunity_id, occurrenceId: row.id, title: row.title, description: row.description,
      categoryCode: row.category_code, origin: row.origin, scope: row.scope, countryCodes: json(row.country_codes_json, countries.get(row.opportunity_id) ?? []),
      date: row.date, year: row.occurrence_year, externalSource: row.external_source, externalReference: row.external_reference, regionalScope: json(row.regional_scope_json, null) }));
  }
}
export type SeasonalStore = Pick<SeasonalRepository, keyof SeasonalRepository>;
