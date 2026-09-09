import type { FastifyInstance } from "fastify";
import {
  findClientAccountById,
  findClientPermissionsByAccountId,
} from "../clients/clients.repository.js";
import { listColumnsByClientAccountId } from "../columns/columns.repository.js";
import { listCardsByClientAccountId } from "../cards/cards.repository.js";
import { listCalendarEvents } from "../calendar/calendar.repository.js";
import type { PortalBoardQueryInput } from "./portal.schemas.js";
import type { PortalAccessLevel } from "../auth/auth.types.js";

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

function calendarPostSignature(title: string, value: string | Date | null | undefined) {
  return `${title.trim().toLocaleLowerCase()}|${calendarDateKey(value)}`;
}

function groupPortalCards(
  columns: Awaited<ReturnType<typeof listColumnsByClientAccountId>>,
  cards: Awaited<ReturnType<typeof listCardsByClientAccountId>>,
  includeAllCards = false,
) {
  const visibleColumns = columns.filter((column) => column.visibleToClient);
  const cardsSentToClient = includeAllCards
    ? cards
    : cards.filter((card) => card.status.includes("Enviar para Cliente") || card.isBriefApproval);
  const visibleIds = new Set(visibleColumns.map((column) => column.id));
  const cardsByColumnId = new Map<string, typeof cards>();
  const withoutColumn: typeof cards = [];

  for (const card of cardsSentToClient) {
    if (!card.columnId || !visibleIds.has(card.columnId)) {
      withoutColumn.push(card);
      continue;
    }

    const current = cardsByColumnId.get(card.columnId) ?? [];
    current.push(card);
    cardsByColumnId.set(card.columnId, current);
  }

  return {
    columns: visibleColumns.map((column) => ({
      ...column,
      cards: cardsByColumnId.get(column.id) ?? [],
      cardsCount: (cardsByColumnId.get(column.id) ?? []).length,
    })),
    withoutColumn: {
      id: "without-column",
      name: "Sem coluna",
      cards: withoutColumn,
      cardsCount: withoutColumn.length,
    },
  };
}

export async function getPortalHome(
  app: FastifyInstance,
  clientAccountId: string,
  accessLevel: PortalAccessLevel = "approver",
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

  const [portalCards, legacyCalendarEvents, postCreationColumns] = await Promise.all([
    listCardsByClientAccountId(app.db, clientAccountId, {}),
    listCalendarEvents(app.db, { clientAccountIds: [clientAccountId] }),
    listColumnsByClientAccountId(app.db, clientAccountId),
  ]);
  const today = currentDateKey(app.appEnv.APP_TIMEZONE);
  const nativeCalendarCards = portalCards
    .filter((card) => Boolean(card.scheduledAt || card.publishedAt))
    .map((card) => {
      const calendarDate = card.scheduledAt || card.publishedAt;
      const isPast = String(calendarDate ?? "").slice(0, 10) < today;
      return isPast && !card.publishedAt ? { ...card, publishedAt: card.scheduledAt } : card;
    });
  const nativeCalendarSignatures = new Set(nativeCalendarCards.map((card) =>
    calendarPostSignature(card.title, card.scheduledAt || card.publishedAt),
  ));
  const importedCalendarCards = legacyCalendarEvents
    .filter((event) => !event.cardId)
    .filter((event) => !nativeCalendarSignatures.has(calendarPostSignature(event.title, event.publishDate)))
    .map((event) => {
      const scheduledAt = calendarDateTime(event.publishDate, event.publishTime);
      return {
        id: `calendar:${event.id}`,
        title: event.title,
        caption: event.caption,
        mediaType: event.mediaType,
        primaryMediaUrl: event.mediaUrls[0] ?? null,
        mediaUrls: event.mediaUrls,
        externalLinkUrl: null,
        artType: event.mediaType || "Post",
        status: [event.status],
        tags: [],
        hashtags: [],
        isBriefApproval: false,
        keepFiles: false,
        deadlineAt: null,
        scheduledAt,
        scheduledTimeZone: app.appEnv.APP_TIMEZONE,
        publishedAt: event.status === "published" || calendarDateKey(event.publishDate) < today ? scheduledAt : null,
        archived: false,
        archivedAt: null,
        clientLabel: "",
        priorityLevel: null,
        eventColor: event.eventColor,
        commentsCount: 0,
        createdByUserId: event.createdByUserId,
        position: 0,
        legacyId: event.id,
        calendarOnly: true,
      };
    });
  const calendarPosts = [...nativeCalendarCards, ...importedCalendarCards];
  const upcomingCards = client.show_upcoming_posts ? calendarPosts : [];
  const upcomingItems = upcomingCards
    .filter((card) => !card.archived && !card.publishedAt)
    .filter((card) => Boolean(card.scheduledAt))
    .filter((card) => {
      const scheduledDate = String(card.scheduledAt).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && scheduledDate >= today;
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
