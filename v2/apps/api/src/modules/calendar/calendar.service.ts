import type { FastifyInstance } from "fastify";
import { getClientScope } from "../auth/auth.access.js";
import type { AuthContext } from "../auth/auth.types.js";
import { findClientAccountById } from "../clients/clients.repository.js";
import { listCalendarEvents } from "./calendar.repository.js";
import type { CalendarQueryInput } from "./calendar.schemas.js";

export function calendarToday(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function normalizeCalendarRange(query: CalendarQueryInput, today: string) {
  return {
    from: query.from ?? today,
    to: query.to,
    status: query.status,
  };
}

function buildCalendarMeta(events: Awaited<ReturnType<typeof listCalendarEvents>>, today: string) {
  const upcoming = events.filter((event) => event.publishDate >= today).length;
  const past = events.filter((event) => event.publishDate < today).length;

  return {
    totalEvents: events.length,
    upcomingEvents: upcoming,
    pastEvents: past,
  };
}

export async function getInternalClientCalendar(
  app: FastifyInstance,
  clientAccountId: string,
  query: CalendarQueryInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
  }

  const range = normalizeCalendarRange(query, calendarToday(app.appEnv.APP_TIMEZONE));
  const events = await listCalendarEvents(app.db, {
    fallbackTimeZone: app.appEnv.APP_TIMEZONE,
    clientAccountIds: [clientAccountId],
    from: range.from,
    to: range.to,
    status: range.status,
  });

  return {
    client: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      locale: client.locale,
      portalTitle: client.portal_title,
    },
    range,
    meta: buildCalendarMeta(events, calendarToday(app.appEnv.APP_TIMEZONE)),
    events,
  };
}

export async function getScopedInternalCalendarOverview(
  app: FastifyInstance,
  auth: AuthContext,
  query: CalendarQueryInput,
) {
  const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
  const range = normalizeCalendarRange(query, calendarToday(app.appEnv.APP_TIMEZONE));

  const events = await listCalendarEvents(app.db, {
    fallbackTimeZone: app.appEnv.APP_TIMEZONE,
    clientAccountIds: scope.mode === "global" ? undefined : scope.clientIds,
    from: range.from,
    to: range.to,
    status: range.status,
  });

  return {
    scope,
    range,
    meta: buildCalendarMeta(events, calendarToday(app.appEnv.APP_TIMEZONE)),
    events,
  };
}

export async function getPortalCalendar(
  app: FastifyInstance,
  clientAccountId: string,
  query: CalendarQueryInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
  }

  const range = normalizeCalendarRange(query, calendarToday(app.appEnv.APP_TIMEZONE));
  const events = await listCalendarEvents(app.db, {
    fallbackTimeZone: app.appEnv.APP_TIMEZONE,
    clientAccountIds: [clientAccountId],
    from: range.from,
    to: range.to,
    status: range.status,
  });

  return {
    account: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      locale: client.locale,
      portalTitle: client.portal_title,
    },
    range,
    meta: buildCalendarMeta(events, calendarToday(app.appEnv.APP_TIMEZONE)),
    events,
  };
}
