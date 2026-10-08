import type {
  AgendaEvent,
  GlobalMetaScheduledPublication,
  MetaScheduledPublication,
} from "./api";
import type { CalendarEvent } from "./types";
import { composeClientMetaCalendarEvents } from "./metaCalendar";
import {
  instantToWallClock,
  validTimeZone,
  zonedWallClockToIso,
} from "../../api/src/lib/zoned-date-time";
export type CalendarView = "day" | "week" | "month" | "year";
export const editorialLabels: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  scheduled: "Agendado internamente",
  published: "Concluído internamente",
};
export const executionLabels: Record<string, string> = {
  not_scheduled: "Não agendado na Meta",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
  cancelled: "Cancelado",
  partial: "Publicação parcial",
};
export type SocialItem = {
  id: string;
  kind: "post" | "appointment";
  title: string;
  clientId?: string;
  clientSlug?: string;
  clientName?: string;
  cardId?: string | null;
  at: string;
  zone: string;
  source: "internal" | "meta" | "combined" | "agenda";
  editorial?: string;
  execution: string;
  platforms: Array<{
    platform: "instagram" | "facebook";
    status: MetaScheduledPublication["status"];
  }>;
  publications: MetaScheduledPublication[];
  destination?: string | null;
  color?: string;
  image?: string;
  description?: string;
  appointment?: AgendaEvent;
};
export function dayKey(instant: Date | string, zone: string) {
  return instantToWallClock(instant, zone).slice(0, 10);
}
export function validCalendarDay(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function shiftDay(day: string, count: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function moveAnchor(day: string, view: CalendarView, direction: number) {
  const d = new Date(`${day}T12:00:00Z`);
  if (view === "month") {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + direction);
  } else if (view === "year") {
    d.setUTCDate(1);
    d.setUTCMonth(0);
    d.setUTCFullYear(d.getUTCFullYear() + direction);
  } else d.setUTCDate(d.getUTCDate() + direction * (view === "week" ? 7 : 1));
  return d.toISOString().slice(0, 10);
}
export function calendarRange(
  anchor: string,
  view: CalendarView,
  zone: string,
) {
  let start = anchor;
  let end = shiftDay(start, 1);
  if (view === "month") {
    start = anchor.slice(0, 7) + "-01";
    end = moveAnchor(start, "month", 1);
  }
  if (view === "year") {
    start = anchor.slice(0, 4) + "-01-01";
    end = moveAnchor(start, "year", 1);
  }
  if (view === "week") {
    start = shiftDay(
      anchor,
      -((new Date(anchor + "T12:00:00Z").getUTCDay() + 6) % 7),
    );
    end = shiftDay(start, 7);
  }
  const gridStart =
    view === "month"
      ? shiftDay(start, -((new Date(start + "T12:00:00Z").getUTCDay() + 6) % 7))
      : start;
  const gridEnd = view === "month" ? shiftDay(gridStart, 42) : end;
  const days: string[] = [];
  for (let day = gridStart; day < gridEnd; day = shiftDay(day, 1))
    days.push(day);
  return {
    start,
    end,
    gridStart,
    gridEnd,
    days,
    from: zonedWallClockToIso(gridStart + "T00:00:00", zone)!,
    to: zonedWallClockToIso(gridEnd + "T00:00:00", zone)!,
  };
}
export function executionState(platforms: SocialItem["platforms"]) {
  if (!platforms.length) return "not_scheduled";
  if (platforms.every((p) => p.status === "published")) return "published";
  if (platforms.some((p) => p.status === "published")) return "partial";
  if (platforms.some((p) => p.status === "publishing")) return "publishing";
  if (platforms.some((p) => p.status === "failed")) return "failed";
  if (platforms.some((p) => p.status === "scheduled")) return "scheduled";
  return "cancelled";
}
export function composeSocialPosts(
  internal: CalendarEvent[],
  meta: GlobalMetaScheduledPublication[],
  zone: string,
): SocialItem[] {
  const clientKeys = new Set([
    ...internal.map(
      (p) => p.clientAccountId ?? p.clientSlug ?? `event:${p.id}`,
    ),
    ...meta.map((p) => p.clientAccountId),
  ]);
  return [...clientKeys]
    .flatMap((clientKey) => {
      const posts = internal
        .filter(
          (p) =>
            (p.clientAccountId ?? p.clientSlug ?? `event:${p.id}`) ===
            clientKey,
        )
        .map((p) => ({
          ...p,
          scheduledAt:
            p.scheduledAt ??
            zonedWallClockToIso(
              `${p.publishDate}T${p.publishTime || "00:00:00"}`,
              p.scheduledTimeZone ?? zone,
            ) ??
            undefined,
        }))
        .filter(
          (p) => p.scheduledAt && Number.isFinite(Date.parse(p.scheduledAt)),
        );
      const publications = meta.filter((p) => p.clientAccountId === clientKey);
      return composeClientMetaCalendarEvents(posts, publications, {
        includeCancelled: true,
        combineDestinations: true,
      }).map((event) => {
        const post =
          posts.find(
            (p) =>
              p.cardId &&
              p.cardId === event.cardId &&
              p.scheduledAt &&
              Math.floor(Date.parse(p.scheduledAt) / 60000) ===
                Math.floor(Date.parse(event.scheduledAt) / 60000),
          ) ?? posts.find((p) => event.id.startsWith(`internal:${p.id}:`));
        const publication = publications.find((p) =>
          event.publications.some((item) => item.id === p.id),
        );
        return {
          id: `${clientKey}:${event.id}`,
          kind: "post" as const,
          title: event.title,
          clientId: post?.clientAccountId ?? publication?.clientAccountId,
          clientSlug: post?.clientSlug ?? publication?.clientSlug,
          clientName: post?.clientName ?? publication?.clientName,
          cardId: event.cardId,
          at: event.scheduledAt,
          zone: publication?.timezone ?? post?.scheduledTimeZone ?? zone,
          source: event.source,
          editorial: post?.status,
          execution: executionState(event.platforms),
          platforms: event.platforms.map((p) => ({
            platform: p.platform,
            status: p.status,
          })),
          publications: event.publications,
          destination: event.destinationName,
          color: event.color,
          image: event.imageUrl,
          description: event.details,
        };
      });
    })
    .sort(compareItems);
}
export function expandAppointments(
  events: AgendaEvent[],
  from: string,
  to: string,
  operationZone: string,
): SocialItem[] {
  const items: SocialItem[] = [];
  for (const event of events) {
    const zone = validTimeZone(event.timeZone, operationZone);
    const wall = instantToWallClock(event.startsAt, zone);
    if (!wall) continue;
    const original = wall.slice(0, 10),
      time = wall.slice(11);
    const recurring = event.recurrenceType && event.recurrenceType !== "none";
    const first = recurring
      ? shiftDay(dayKey(from, zone), -1) > original
        ? shiftDay(dayKey(from, zone), -1)
        : original
      : original;
    const last = recurring
      ? shiftDay(dayKey(to, zone), 1)
      : shiftDay(original, 1);
    for (let day = first; day < last; day = shiftDay(day, 1)) {
      if (event.repeatUntil && day > event.repeatUntil.slice(0, 10)) break;
      const date = new Date(day + "T12:00:00Z"),
        base = new Date(original + "T12:00:00Z");
      const eligible =
        !recurring ||
        (event.recurrenceType === "weekdays" &&
          date.getUTCDay() > 0 &&
          date.getUTCDay() < 6) ||
        (event.recurrenceType === "weekly" &&
          date.getUTCDay() === base.getUTCDay()) ||
        (event.recurrenceType === "monthly_nth_weekday" &&
          date.getUTCDay() === base.getUTCDay() &&
          Math.ceil(date.getUTCDate() / 7) ===
            Math.ceil(base.getUTCDate() / 7));
      if (!eligible) continue;
      const at = recurring
        ? zonedWallClockToIso(day + "T" + time, zone)!
        : event.startsAt;
      if (Date.parse(at) < Date.parse(from) || Date.parse(at) >= Date.parse(to))
        continue;
      items.push({
        id: `agenda:${event.id}:${day}`,
        kind: "appointment",
        title: event.title,
        clientId: event.clientAccountId ?? undefined,
        clientName: event.clientName ?? undefined,
        at,
        zone,
        source: "agenda",
        execution: "not_scheduled",
        platforms: [],
        publications: [],
        description: event.taskDescription ?? undefined,
        color: event.color,
        appointment: event,
      });
    }
  }
  return items.sort(compareItems);
}
export function compareItems(a: SocialItem, b: SocialItem) {
  return Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id);
}
export function inPeriod(
  item: SocialItem,
  start: string,
  end: string,
  zone: string,
) {
  const key = dayKey(item.at, zone);
  return key >= start && key < end;
}
export async function loadAllMetaPages(
  load: (offset: number) => Promise<{
    publications: GlobalMetaScheduledPublication[];
    total: number;
  }>,
) {
  const result: GlobalMetaScheduledPublication[] = [];
  let offset = 0;
  while (true) {
    const page = await load(offset);
    result.push(...page.publications);
    offset += page.publications.length;
    if (offset >= page.total) break;
    if (!page.publications.length)
      throw new Error("A paginação Meta terminou antes do total informado.");
  }
  return result;
}
export async function independentSources<
  T extends Record<string, Promise<unknown>>,
>(requests: T) {
  const entries = Object.entries(requests);
  const results = await Promise.allSettled(
    entries.map(([, request]) => request),
  );
  return Object.fromEntries(entries.map(([key], i) => [key, results[i]])) as {
    [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>;
  };
}
