import type { FastifyInstance } from "fastify";
import {
  findClientAccountById,
  findClientPermissionsByAccountId,
} from "../clients/clients.repository.js";
import { listColumnsByClientAccountId } from "../columns/columns.repository.js";
import { listCardsByClientAccountId } from "../cards/cards.repository.js";
import type { PortalBoardQueryInput } from "./portal.schemas.js";

function parseArchivedValue(value: PortalBoardQueryInput["archived"]) {
  if (!value) return undefined;
  return value === "1" || value === "true";
}

function groupPortalCards(
  columns: Awaited<ReturnType<typeof listColumnsByClientAccountId>>,
  cards: Awaited<ReturnType<typeof listCardsByClientAccountId>>,
) {
  const visibleColumns = columns.filter((column) => column.visibleToClient);
  const cardsSentToClient = cards.filter((card) => card.status.includes("Enviar para Cliente"));
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
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
  if (!permissions) {
    throw app.httpErrors.notFound("Permissoes da conta nao encontradas.");
  }

  const upcomingCards = client.show_upcoming_posts
    ? await listCardsByClientAccountId(app.db, clientAccountId, { archived: false })
    : [];

  const today = new Date("2026-08-20T00:00:00");
  const upcomingItems = upcomingCards
    .filter((card) => Boolean(card.scheduledAt))
    .filter((card) => {
      const when = new Date(card.scheduledAt as string | Date);
      return !Number.isNaN(when.getTime()) && when >= today;
    })
    .sort((a, b) => {
      const left = new Date(a.scheduledAt as string | Date).getTime();
      const right = new Date(b.scheduledAt as string | Date).getTime();
      return left - right;
    })
    .slice(0, 8);

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
    widgets: {
      upcomingPosts: Boolean(client.show_upcoming_posts),
      tracking: Boolean(client.tracking_enabled && client.tracking_visible_to_client),
      invoices: permissions.allowClientViewInvoices,
      reports: permissions.allowClientViewReports,
      brandBrain: permissions.allowClientViewBrandBrain,
      search: permissions.allowClientSearch,
    },
    upcomingItems,
  };
}

export async function getPortalBoard(
  app: FastifyInstance,
  clientAccountId: string,
  query: PortalBoardQueryInput,
  options: { canUseSearch: boolean },
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
  if (!permissions) {
    throw app.httpErrors.notFound("Permissoes da conta nao encontradas.");
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
    board: groupPortalCards(columns, cards),
  };
}
