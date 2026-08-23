import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const LEGACY_SOURCE = "design_hub_v2_agenda";

type EnvMap = Record<string, string>;

type LegacyEventRow = {
  id: string;
  title: string;
  taskDescription: string | null;
  appointmentDate: string;
  appointmentTime: string;
  color: string | null;
  isCompleted: number;
  labelName: string | null;
};

type SupabaseAuthResponse = {
  access_token: string;
  user: {
    id: string;
    email?: string;
  };
};

type SyncOptions = {
  dryRun: boolean;
  legacyUserEmail?: string;
  legacyUserId?: string;
  supabaseEmail?: string;
  supabasePassword?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "../..");
const v2Root = path.resolve(apiRoot, "../..");
const projectRoot = path.resolve(v2Root, "..");

function parseEnvFile(text: string): EnvMap {
  const env: EnvMap = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function readEnvFile(filePath: string): Promise<EnvMap> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return parseEnvFile(text);
  } catch {
    return {};
  }
}

async function loadEnv(): Promise<EnvMap> {
  const [rootEnv, v2Env] = await Promise.all([
    readEnvFile(path.join(projectRoot, ".env")),
    readEnvFile(path.join(v2Root, ".env")),
  ]);
  return {
    ...rootEnv,
    ...v2Env,
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
  };
}

function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = { dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--legacy-user-email" && next) {
      options.legacyUserEmail = next;
      i += 1;
      continue;
    }
    if (arg === "--legacy-user-id" && next) {
      options.legacyUserId = next;
      i += 1;
      continue;
    }
    if (arg === "--supabase-email" && next) {
      options.supabaseEmail = next;
      i += 1;
      continue;
    }
    if (arg === "--supabase-password" && next) {
      options.supabasePassword = next;
      i += 1;
      continue;
    }
  }

  return options;
}

function requireEnv(env: EnvMap, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${key}`);
  return value;
}

async function supabaseAuth(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<SupabaseAuthResponse> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no login do Supabase: ${response.status} ${text}`);
  }

  return response.json() as Promise<SupabaseAuthResponse>;
}

async function supabaseFetch<T>(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  resource: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no Supabase REST (${resource}): ${response.status} ${text}`);
  }

  if (response.status === 204) return [] as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : []) as T;
}

async function findLegacyUserId(
  db: mysql.Pool,
  legacyUserId?: string,
  legacyUserEmail?: string,
): Promise<{ id: string; email: string; fullName: string }> {
  if (legacyUserId) {
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT id, email, full_name AS fullName FROM users WHERE id = ? LIMIT 1",
      [legacyUserId],
    );
    if (rows.length === 0) throw new Error(`Usuario legado nao encontrado para id ${legacyUserId}`);
    return rows[0] as { id: string; email: string; fullName: string };
  }

  if (!legacyUserEmail) {
    throw new Error("Informe --legacy-user-email ou --legacy-user-id para filtrar a agenda do app antigo.");
  }

  const [rows] = await db.query<mysql.RowDataPacket[]>(
    "SELECT id, email, full_name AS fullName FROM users WHERE email = ? LIMIT 1",
    [legacyUserEmail],
  );
  if (rows.length === 0) throw new Error(`Usuario legado nao encontrado para email ${legacyUserEmail}`);
  return rows[0] as { id: string; email: string; fullName: string };
}

async function fetchLegacyEvents(db: mysql.Pool, legacyUserId: string): Promise<LegacyEventRow[]> {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `
      SELECT
        e.id,
        e.title,
        e.task_description AS taskDescription,
        DATE_FORMAT(e.starts_at, '%Y-%m-%d') AS appointmentDate,
        DATE_FORMAT(e.starts_at, '%H:%i:%s') AS appointmentTime,
        e.color,
        e.is_completed AS isCompleted,
        l.name AS labelName
      FROM agenda_events e
      LEFT JOIN agenda_labels l ON l.id = e.agenda_label_id
      WHERE e.created_by_user_id = ?
      ORDER BY e.starts_at ASC
    `,
    [legacyUserId],
  );

  return rows as LegacyEventRow[];
}

type ExistingAppointment = {
  title: string;
  description: string;
  appointment_date: string;
  appointment_time: string;
};

function appointmentSignature(appointment: ExistingAppointment): string {
  return JSON.stringify([
    appointment.title,
    appointment.description,
    appointment.appointment_date,
    appointment.appointment_time,
  ]);
}

async function fetchExistingAppointments(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  targetUserId: string,
): Promise<{ legacyIds: Set<string>; signatures: Set<string>; supportsTracking: boolean }> {
  try {
    const rows = await supabaseFetch<Array<{ legacy_event_id: string | null }>>(
      supabaseUrl,
      anonKey,
      accessToken,
      `appointments?select=legacy_event_id&user_id=eq.${encodeURIComponent(targetUserId)}&legacy_source=eq.${LEGACY_SOURCE}&limit=10000`,
    );
    return {
      legacyIds: new Set(rows.map((row) => row.legacy_event_id).filter((value): value is string => Boolean(value))),
      signatures: new Set(),
      supportsTracking: true,
    };
  } catch (error) {
    // The remote migration can lag behind the code. Fall back to exact event matching.
    if (!(error instanceof Error) || !error.message.includes("column appointments.legacy_event_id does not exist")) {
      throw error;
    }
  }

  const rows = await supabaseFetch<ExistingAppointment[]>(
    supabaseUrl,
    anonKey,
    accessToken,
    `appointments?select=title,description,appointment_date,appointment_time&user_id=eq.${encodeURIComponent(targetUserId)}&limit=10000`,
  );
  return {
    legacyIds: new Set(),
    signatures: new Set(rows.map(appointmentSignature)),
    supportsTracking: false,
  };
}

async function insertAppointments(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  payload: Array<Record<string, unknown>>,
  supportsTracking: boolean,
): Promise<void> {
  await supabaseFetch(
    supabaseUrl,
    anonKey,
    accessToken,
    supportsTracking ? "appointments?on_conflict=user_id,legacy_source,legacy_event_id" : "appointments",
    {
      method: "POST",
      headers: {
        Prefer: supportsTracking ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
      },
      body: JSON.stringify(payload),
    },
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = await loadEnv();

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL/chave publishable nao encontrados.");
  }

  const supabaseEmail =
    options.supabaseEmail ||
    env.SYNC_SUPABASE_EMAIL ||
    env.EXPORT_ADMIN_EMAIL ||
    env.MIGRATION_ADMIN_EMAIL;
  const supabasePassword =
    options.supabasePassword ||
    env.SYNC_SUPABASE_PASSWORD ||
    env.EXPORT_ADMIN_PASSWORD ||
    env.MIGRATION_ADMIN_PASSWORD;

  if (!supabaseEmail || !supabasePassword) {
    throw new Error("Informe um login do Supabase via --supabase-email/--supabase-password ou variaveis SYNC_SUPABASE_EMAIL/SYNC_SUPABASE_PASSWORD.");
  }

  const legacyUserEmail =
    options.legacyUserEmail ||
    env.LEGACY_AGENDA_EMAIL ||
    supabaseEmail;
  const legacyUserId = options.legacyUserId || env.LEGACY_AGENDA_USER_ID;

  const db = mysql.createPool({
    host: requireEnv(env, "DB_HOST"),
    port: Number(requireEnv(env, "DB_PORT")),
    database: requireEnv(env, "DB_NAME"),
    user: requireEnv(env, "DB_USER"),
    password: requireEnv(env, "DB_PASSWORD"),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

  try {
    const auth = await supabaseAuth(supabaseUrl, supabaseAnonKey, supabaseEmail, supabasePassword);
    const legacyUser = await findLegacyUserId(db, legacyUserId, legacyUserEmail);
    const legacyEvents = await fetchLegacyEvents(db, legacyUser.id);
    const existingAppointments = await fetchExistingAppointments(
      supabaseUrl,
      supabaseAnonKey,
      auth.access_token,
      auth.user.id,
    );

    const rowsToInsert = legacyEvents
      .filter((event) => {
        if (existingAppointments.supportsTracking) return !existingAppointments.legacyIds.has(event.id);
        return !existingAppointments.signatures.has(appointmentSignature({
          title: event.title,
          description: event.taskDescription ?? "",
          appointment_date: event.appointmentDate,
          appointment_time: event.appointmentTime,
        }));
      })
      .map((event) => ({
        user_id: auth.user.id,
        title: event.title,
        description: event.taskDescription ?? "",
        appointment_date: event.appointmentDate,
        appointment_time: event.appointmentTime,
        category: event.labelName ?? "agenda antiga",
        completed: Boolean(event.isCompleted),
        completed_at: event.isCompleted ? new Date().toISOString() : null,
        ...(existingAppointments.supportsTracking ? {
          legacy_source: LEGACY_SOURCE,
          legacy_event_id: event.id,
        } : {}),
      }));

    console.log(JSON.stringify({
      legacyUser,
      totalLegacyEvents: legacyEvents.length,
      alreadyImported: legacyEvents.length - rowsToInsert.length,
      pendingImport: rowsToInsert.length,
      duplicateProtection: existingAppointments.supportsTracking ? "legacy IDs" : "exact event match",
      dryRun: options.dryRun,
    }, null, 2));

    if (options.dryRun || rowsToInsert.length === 0) return;

    for (let i = 0; i < rowsToInsert.length; i += 200) {
      await insertAppointments(
        supabaseUrl,
        supabaseAnonKey,
        auth.access_token,
        rowsToInsert.slice(i, i + 200),
        existingAppointments.supportsTracking,
      );
    }

    console.log(`Importacao concluida: ${rowsToInsert.length} compromissos inseridos.`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
