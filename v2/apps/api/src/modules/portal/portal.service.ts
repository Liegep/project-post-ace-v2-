import type { FastifyInstance } from "fastify";
import {
  findClientAccountById,
  findClientPermissionsByAccountId,
} from "../clients/clients.repository.js";
import { listColumnsByClientAccountId } from "../columns/columns.repository.js";
import { listCardsByClientAccountId } from "../cards/cards.repository.js";
import { listCalendarEvents } from "../calendar/calendar.repository.js";
import { listScheduledPublicationsForClient } from "../meta/meta.repository.js";
import type { PortalBoardQueryInput } from "./portal.schemas.js";
import type { PortalAccessLevel } from "../auth/auth.types.js";
import { instantToWallClock, zonedWallClockToIso } from "../../lib/zoned-date-time.js";

function parseArchivedValue(value: PortalBoardQueryInput["archived"]) {
  if (!value) return undefined;
  return value === "1" || value === "true";
}

function currentDateKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function calendarDateKey(value: string | Date | null | undefined) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? "").slice(0, 10);
}

function calendarDateTime(publishDate: string | Date, publishTime: string | null) {
  const date = calendarDateKey(publishDate);
  const time = String(publishTime ?? "12:00").slice(0, 5) || "12:00";
  return `${date}T${time}:00`;
}

function calendarPostSignature(title: string, value: string | Date | null | undefined, timeZone?: string | null) {
  const localValue = value && timeZone ? instantToWallClock(value, timeZone) : value;
  return `${title.trim().toLocaleLowerCase()}|${calendarDateKey(localValue)}`;
}

type PortalCard = Awaited<ReturnType<typeof listCardsByClientAccountId>>[number];
type PortalMetaPublication = Awaited<ReturnType<typeof listScheduledPublicationsForClient>>[number];

export function composePortalMetaCalendarCards(portalCards: PortalCard[], metaPublications: PortalMetaPublication[]) {
  const metaCalendarCards = composePortalMetaCalendarCards(portalCards, metaPublications);

  const metaCalendarCardIds = new Set(metaCalendarCards.map((card) => card.id));
  const calendarPosts = [
    ...nativeCalendarCards.filter((card) => !metaCalendarCardIds.has(card.id)),
    ...metaCalendarCards,
    ...importedCalendarCards,
  ];
  const upcomingCards = client.show_upcoming_posts ? calendarPosts : [];
  const upcomingItems = upcomingCards
    .filter((card) => !card.archived && !card.publishedAt)
    .filter((card) => Boolean(card.scheduledAt))
    .filter((card) => {
      const instant = new Date(card.scheduledAt as string | Date).getTime();
      return !Number.isNaN(instant) && instant >= now;
    })
    .sort((a, b) => {
      const left = new Date(a.scheduledAt as string | Date).getTime();
      const right = new Date(b.scheduledAt as string | Date).getTime();
      return left - right;
    })
    .slice(0, 60)
    .map((card) => ({
      id: card.id,
      title: card.title,
      scheduledAt: card.scheduledAt,
      channel: "",
      mediaUrl: card.primaryMediaUrl ?? card.mediaUrls[0] ?? null,
      cardId: "calendarOnly" in card && card.calendarOnly ? null : card.id,
    }));

  return {
    account: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      logoUrl: client.logo_url,
      locale: client.locale,
      portalTitle: client.portal_title,
      trackingEnabled: Boolean(client.tracking_enabled),
      trackingVisibleToClient: Boolean(client.tracking_visible_to_client),
      showArchivedToClient: Boolean(client.show_archived_to_client),
      showUpcomingPosts: Boolean(client.show_upcoming_posts),
    },
    permissions,
    accessLevel,
    widgets: {
      upcomingPosts: Boolean(client.show_upcoming_posts),
      tracking: Boolean(client.tracking_enabled && client.tracking_visible_to_client && permissions.allowClientViewTracking),
      invoices: permissions.allowClientViewInvoices,
      reports: permissions.allowClientViewReports,
      brandBrain: permissions.allowClientViewBrandBrain,
      search: permissions.allowClientSearch,
      texts: permissions.allowClientViewTexts,
    },
    upcomingItems,
    calendarPosts,
    postCreationColumns: permissions.allowClientCreatePost ? postCreationColumns.map((column) => ({ id: column.id, name: column.name, color: column.color })) : [],
  };
}

export async function getPortalBoard(
  app: FastifyInstance,
  clientAccountId: string,
  query: PortalBoardQueryInput,
  options: { canUseSearch: boolean },
) {
  const [client, permissions] = await Promise.all([
    findClientAccountById(app.db, clientAccountId),
    findClientPermissionsByAccountId(app.db, clientAccountId),
  ]);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
  }

  if (!permissions) {
    throw app.httpErrors.notFound("Permissões da conta não encontradas.");
  }

  const archivedRequested = parseArchivedValue(query.archived);
  const archived =
    archivedRequested === true
      ? Boolean(client.show_archived_to_client)
      : false;

  const search = permissions.allowClientSearch || options.canUseSearch
    ? query.search
    : undefined;

  const [columns, cards] = await Promise.all([
    listColumnsByClientAccountId(app.db, clientAccountId),
    listCardsByClientAccountId(app.db, clientAccountId, {
      archived,
      search,
    }),
  ]);

  return {
    account: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      locale: client.locale,
      portalTitle: client.portal_title,
    },
    permissions,
    filters: {
      archived,
      search: search ?? "",
    },
    board: groupPortalCards(columns, cards, archived),
  };
}
