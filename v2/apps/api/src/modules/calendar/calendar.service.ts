import type { FastifyInstance } from "fastify";
import { getClientScope } from "../auth/auth.access.js";
import type { AuthContext } from "../auth/auth.types.js";
import { findClientAccountById } from "../clients/clients.repository.js";
import { listCalendarEvents } from "./calendar.repository.js";
import type { CalendarQueryInput } from "./calendar.schemas.js";

const TODAY = "2026-08-20";

function normalizeCalendarRange(query: CalendarQueryInput) {
  return {
    from: query.from ?? TODAY,
    to: query.to,
    status: query.status,
  };
}

function buildCalendarMeta(events: Awaited<ReturnType<typeof listCalendarEvents>>) {
  const upcoming = events.filter((event) => event.publishDate >= TODAY).length;
  const past = events.filter((event) => event.publishDate < TODAY).length;

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
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const range = normalizeCalendarRange(query);
  const events = await listCalendarEvents(app.db, {
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
    meta: buildCalendarMeta(events),
    events,
  };
}

export async function getScopedInternalCalendarOverview(
  app: FastifyInstance,
  auth: AuthContext,
  query: CalendarQueryInput,
) {
  const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
  const range = normalizeCalendarRange(query);

  const events = await listCalendarEvents(app.db, {
    clientAccountIds: scope.mode === "global" ? undefined : scope.clientIds,
    from: range.from,
    to: range.to,
    status: range.status,
  });

  return {
    scope,
    range,
    meta: buildCalendarMeta(events),
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
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const range = normalizeCalendarRange(query);
  const events = await listCalendarEvents(app.db, {
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
    meta: buildCalendarMeta(events),
    events,
  };
}
