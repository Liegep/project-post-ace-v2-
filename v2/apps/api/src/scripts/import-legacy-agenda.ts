import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { loadEnv } from "../config/env.js";

type LegacyTag = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string | null;
};

type LegacyAppointment = {
  id: string;
  title: string;
  description: string | null;
  appointment_date: string;
  appointment_time: string | null;
  category: string | null;
  completed: boolean;
  cancelled: boolean;
  tag_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExportFile = {
  tables: {
    appointments?: { rows?: LegacyAppointment[] };
    appointment_tags?: { rows?: LegacyTag[] };
  };
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function mysqlDateTime(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace("T", " ").replace(/Z$/, "");
  return normalized.length >= 19 ? normalized.slice(0, 19) : `${normalized.slice(0, 10)} 00:00:00`;
}

function normalizeColor(value: string | null | undefined, fallback = "#c9f7df") {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : fallback;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function startsAt(appointment: LegacyAppointment) {
  const rawTime = appointment.appointment_time ?? "";
  const time = /^\d{2}:\d{2}:\d{2}$/.test(rawTime)
    ? rawTime
    : /^\d{2}:\d{2}$/.test(rawTime) ? `${rawTime}:00` : "09:00:00";
  return `${appointment.appointment_date} ${time}`;
}

async function main() {
  const input = path.resolve(argument("--input") ?? "");
  const reportPath = path.resolve(argument("--report") ?? path.join(path.dirname(input), "agenda-import-result.json"));
  if (!input) throw new Error("Informe --input com o database-export.json.");

  const exported = JSON.parse(await readFile(input, "utf8")) as ExportFile;
  const appointments = exported.tables.appointments?.rows ?? [];
  const legacyTags = exported.tables.appointment_tags?.rows ?? [];
  if (!appointments.length) throw new Error("Nenhum compromisso foi encontrado na exportação.");

  const env = loadEnv();
  const db = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  const [admins] = await db.query<Array<RowDataPacket & { id: string; email: string }>>(
    "SELECT id, email FROM users WHERE global_role = 'super_admin' AND is_active = 1 ORDER BY created_at ASC LIMIT 1",
  );
  const target = admins[0];
  if (!target) throw new Error("Nenhum super admin ativo foi encontrado na V2.");

  const tagByLegacyId = new Map<string, LegacyTag>(legacyTags.map((tag) => [tag.id, tag]));
  const labelIdByName = new Map<string, string>();
  const labelColorByName = new Map<string, string>();
  const [existingLabels] = await db.query<Array<RowDataPacket & { id: string; name: string; color: string }>>(
    "SELECT id, name, color FROM agenda_labels WHERE user_id = ?",
    [target.id],
  );
  for (const label of existingLabels) {
    labelIdByName.set(normalizeName(label.name), label.id);
    labelColorByName.set(normalizeName(label.name), label.color);
  }

  const requestedLabels = new Map<string, { name: string; color: string; preferredId?: string; createdAt?: string | null }>();
  for (const tag of legacyTags) {
    if (!tag.name.trim()) continue;
    requestedLabels.set(normalizeName(tag.name), {
      name: tag.name.trim(),
      color: normalizeColor(tag.color, "#5e5cf1"),
      preferredId: tag.id,
      createdAt: tag.created_at,
    });
  }
  for (const appointment of appointments) {
    const category = appointment.category?.trim();
    if (!category) continue;
    const key = normalizeName(category);
    if (!requestedLabels.has(key)) {
      requestedLabels.set(key, {
        name: category.charAt(0).toLocaleUpperCase("pt-BR") + category.slice(1),
        color: key === "reunião" ? "#3b82f6" : key === "último post" ? "#ff6bab" : "#c9f7df",
      });
    }
  }

  let labelsCreated = 0;
  await db.beginTransaction();
  try {
    for (const [key, label] of requestedLabels) {
      if (labelIdByName.has(key)) continue;
      const id = label.preferredId ?? crypto.randomUUID();
      await db.query(
        "INSERT INTO agenda_labels (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))",
        [id, target.id, label.name, label.color, mysqlDateTime(label.createdAt)],
      );
      labelIdByName.set(key, id);
      labelColorByName.set(key, label.color);
      labelsCreated += 1;
    }

    const [existingEvents] = await db.query<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM agenda_events WHERE id IN (${appointments.map(() => "?").join(",")})`,
      appointments.map((appointment) => appointment.id),
    );
    const existingIds = new Set(existingEvents.map((event) => event.id));
    let created = 0;
    let updated = 0;
    const cancelled: LegacyAppointment[] = [];

    for (const appointment of appointments) {
      if (appointment.cancelled) {
        cancelled.push(appointment);
        continue;
      }
      const tag = appointment.tag_id ? tagByLegacyId.get(appointment.tag_id) : undefined;
      const labelName = tag?.name.trim() || appointment.category?.trim() || "";
      const labelKey = labelName ? normalizeName(labelName) : "";
      const labelId = labelKey ? labelIdByName.get(labelKey) ?? null : null;
      const color = labelKey ? labelColorByName.get(labelKey) ?? "#c9f7df" : "#c9f7df";
      await db.query(
        [
          "INSERT INTO agenda_events",
          "(id, client_account_id, agenda_label_id, title, task_description, starts_at, ends_at, recurrence_type, repeat_until, color, is_completed, created_by_user_id, created_at, updated_at)",
          "VALUES (?, NULL, ?, ?, ?, ?, NULL, 'none', NULL, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))",
          "ON DUPLICATE KEY UPDATE agenda_label_id=VALUES(agenda_label_id), title=VALUES(title), task_description=VALUES(task_description), starts_at=VALUES(starts_at), color=VALUES(color), is_completed=VALUES(is_completed), created_by_user_id=VALUES(created_by_user_id), updated_at=VALUES(updated_at)",
        ].join(" "),
        [
          appointment.id,
          labelId,
          appointment.title.trim() || "Compromisso",
          appointment.description?.trim() || null,
          startsAt(appointment),
          color,
          appointment.completed ? 1 : 0,
          target.id,
          mysqlDateTime(appointment.created_at),
          mysqlDateTime(appointment.updated_at),
        ],
      );
      if (existingIds.has(appointment.id)) updated += 1;
      else created += 1;
    }

    await db.commit();
    const result = {
      targetUser: target.email,
      exported: appointments.length,
      imported: created + updated,
      created,
      updated,
      cancelledSkipped: cancelled.length,
      completedImported: appointments.filter((item) => !item.cancelled && item.completed).length,
      labelsCreated,
      labelsAvailable: labelIdByName.size,
      cancelledItems: cancelled.map((item) => ({ id: item.id, title: item.title, date: item.appointment_date })),
    };
    await writeFile(reportPath, JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("[import-legacy-agenda]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
