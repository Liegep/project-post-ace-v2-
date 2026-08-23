import type { FastifyPluginAsync } from "fastify";

const adminClientId = "client-aplikasi";
const portalClientId = "client-serena";

const boardColumns = [
  {
    id: "column-vtcards",
    name: "VT Cards",
    color: "#24a7e8",
    visibleToClient: false,
    cards: [
      {
        id: "card-vt-1",
        title: "Nao importa qual operadora seu colaborador usa",
        caption: "VT Cards",
        mediaType: "image",
        primaryMediaUrl:
          "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80",
        mediaUrls: [],
        artType: "post_unico",
        status: ["Legenda pronta", "Design finalizado", "Legenda aprovada"],
        tags: ["Alteracao solicitada"],
        commentsCount: 1,
        scheduledAt: "2026-08-23 10:00:00",
        clientLabel: "Pendente",
      },
      {
        id: "card-vt-2",
        title: "Beneficios da VT Card",
        caption: "Assinatura digital",
        mediaType: "image",
        primaryMediaUrl:
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        mediaUrls: [],
        artType: "card_curto",
        status: ["Design finalizado"],
        tags: ["Faturado"],
        commentsCount: 0,
        scheduledAt: null,
        clientLabel: "Pendente",
      },
    ],
  },
  {
    id: "column-aprovacao",
    name: "Em aprovacao",
    color: "#f7a31a",
    visibleToClient: true,
    cards: [
      {
        id: "card-aprovacao-1",
        title: "Antes de ligar o motor, ja estamos cuidando de voce",
        caption: "Seguranca",
        mediaType: "image",
        primaryMediaUrl:
          "https://images.unsplash.com/photo-1517142089942-ba376ce32a2e?auto=format&fit=crop&w=900&q=80",
        mediaUrls: [],
        artType: "reels",
        status: ["Design pronto", "Aline aprovou"],
        tags: ["Cliente revisando"],
        commentsCount: 2,
        scheduledAt: "2026-08-24 14:00:00",
        clientLabel: "Aguardando aprovacao",
      },
    ],
  },
  {
    id: "column-agendados",
    name: "Agendados",
    color: "#12bf83",
    visibleToClient: true,
    cards: [
      {
        id: "card-agendado-1",
        title: "Dois destinos. Qual voce escolhe?",
        caption: "Santa Sophia",
        mediaType: "image",
        primaryMediaUrl:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
        mediaUrls: [],
        artType: "reels",
        status: ["Agendado"],
        tags: ["Publicado no planner"],
        commentsCount: 0,
        scheduledAt: "2026-08-25 11:00:00",
        clientLabel: "Agendado",
      },
    ],
  },
];

const commentsByCardId: Record<string, Array<{
  id: string;
  authorName: string;
  authorRole: string;
  commentText: string;
  isInternal: boolean;
  createdAt: string;
}>> = {
  "card-vt-1": [
    {
      id: "comment-1",
      authorName: "Liege Paschoalini",
      authorRole: "super_admin",
      commentText: "Ajustar a chamada final para ficar ainda mais direta.",
      isInternal: true,
      createdAt: "2026-08-20T09:12:00",
    },
  ],
  "card-aprovacao-1": [
    {
      id: "comment-2",
      authorName: "Patricia Rodrigues",
      authorRole: "cliente",
      commentText: "Gostei muito. So sugiro deixar o subtitulo um pouco mais direto.",
      isInternal: false,
      createdAt: "2026-08-20T11:15:00",
    },
    {
      id: "comment-3",
      authorName: "Serena Genovese",
      authorRole: "cliente",
      commentText: "Perfetto, vou ajustar conforme combinado.",
      isInternal: false,
      createdAt: "2026-08-20T11:42:00",
    },
  ],
};

const approvalLinksByCardId: Record<string, Array<{
  id: string;
  token: string;
  expiresAt: string;
  isActive: boolean;
  viewedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}>> = {
  "card-aprovacao-1": [
    {
      id: "approval-1",
      token: "demo-token-approval-1",
      expiresAt: "2026-08-27T14:00:00",
      isActive: true,
      viewedAt: "2026-08-20T15:20:00",
      approvedAt: null,
      createdAt: "2026-08-20T15:00:00",
    },
  ],
};

const internalCalendarEvents = [
  {
    id: "calendar-1",
    title: "Destinos incriveis para 2027",
    publishDate: "2026-08-23",
    publishTime: "10:00:00",
    status: "scheduled",
    clientName: "Aplikasi",
    clientSlug: "aplikasi",
  },
  {
    id: "calendar-2",
    title: "Antes de ligar o motor, ja estamos cuidando de voce",
    publishDate: "2026-08-24",
    publishTime: "14:00:00",
    status: "scheduled",
    clientName: "Aplikasi",
    clientSlug: "aplikasi",
  },
  {
    id: "calendar-3",
    title: "Dois destinos. Qual voce escolhe?",
    publishDate: "2026-08-25",
    publishTime: "11:00:00",
    status: "scheduled",
    clientName: "Aplikasi",
    clientSlug: "aplikasi",
  },
];

function getPortalVisibleColumns() {
  return boardColumns.filter((column) => column.visibleToClient);
}

function getLooseCards() {
  return [
    {
      id: "card-solto-1",
      title: "Nova pauta para setembro",
      caption: "Ainda sem coluna",
      mediaType: "image",
      primaryMediaUrl:
        "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80",
      mediaUrls: [],
      artType: "ideia",
      status: ["Rascunho"],
      tags: ["Sem coluna"],
      commentsCount: 0,
      scheduledAt: null,
      clientLabel: "Novo",
    },
  ];
}

function allCards() {
  return [...boardColumns.flatMap((column) => column.cards), ...getLooseCards()];
}

function findCardById(cardId: string) {
  return boardColumns.flatMap((column) => column.cards).find((item) => item.id === cardId) ?? null;
}

function findColumnByCardId(cardId: string) {
  return boardColumns.find((column) => column.cards.some((card) => card.id === cardId)) ?? null;
}

function syncCardCommentCount(cardId: string) {
  const card = findCardById(cardId);
  if (!card) return;
  card.commentsCount = commentsByCardId[cardId]?.length ?? 0;
}

function ensureTag(cardId: string, tag: string) {
  const card = findCardById(cardId);
  if (!card) return;
  if (!card.tags.includes(tag)) {
    card.tags = [tag, ...card.tags];
  }
}

function ensureStatus(cardId: string, status: string) {
  const card = findCardById(cardId);
  if (!card) return;
  if (!card.status.includes(status)) {
    card.status = [status, ...card.status];
  }
}

function addComment(
  cardId: string,
  input: {
    authorName: string;
    authorRole: string;
    commentText: string;
    isInternal: boolean;
  },
) {
  const comment = {
    id: `comment-${Date.now()}`,
    authorName: input.authorName,
    authorRole: input.authorRole,
    commentText: input.commentText,
    isInternal: input.isInternal,
    createdAt: new Date().toISOString(),
  };

  commentsByCardId[cardId] = [comment, ...(commentsByCardId[cardId] ?? [])];
  syncCardCommentCount(cardId);
  return comment;
}

function ensureApprovedColumn() {
  let column = boardColumns.find((item) => item.name === "Aprovados pelo cliente");
  if (!column) {
    column = {
      id: "column-aprovados-cliente",
      name: "Aprovados pelo cliente",
      color: "#6bd631",
      visibleToClient: true,
      cards: [],
    };
    boardColumns.push(column);
  }
  return column;
}

function moveCardToColumn(cardId: string, targetColumnId: string) {
  const sourceColumn = findColumnByCardId(cardId);
  const targetColumn = boardColumns.find((column) => column.id === targetColumnId);
  if (!sourceColumn || !targetColumn || sourceColumn.id === targetColumn.id) return;

  const cardIndex = sourceColumn.cards.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) return;

  const [card] = sourceColumn.cards.splice(cardIndex, 1);
  targetColumn.cards.unshift(card);
}

function applyDecision(cardId: string, approved: boolean) {
  const card = findCardById(cardId);
  if (!card) return;

  if (approved) {
    card.clientLabel = "Aprovado pelo cliente";
    ensureTag(cardId, "Aprovado pelo cliente");
    ensureStatus(cardId, "Aprovado");
    moveCardToColumn(cardId, ensureApprovedColumn().id);
    return;
  }

  card.clientLabel = "Alteracao solicitada";
  ensureTag(cardId, "Alteracao solicitada");
  ensureStatus(cardId, "Revisao solicitada");
}

export const demoRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    ok: true,
    service: app.appEnv.APP_NAME,
    environment: app.appEnv.NODE_ENV,
    demoMode: true,
  }));

  app.get("/clients", async () => ({
    items: [
      { id: adminClientId, name: "Aplikasi", slug: "aplikasi" },
      { id: "client-minas-home", name: "Minas Home ADS", slug: "minas-home-ads" },
      { id: "client-podcast", name: "Podcast Lider de Elite", slug: "podcast-lider-de-elite" },
    ],
    scope: {
      mode: "global",
      clientIds: [],
    },
  }));

  app.get("/clients/:clientAccountId/board", async (request) => {
    const params = request.params as { clientAccountId: string };
    const client =
      params.clientAccountId === adminClientId
        ? { id: adminClientId, name: "Aplikasi", slug: "aplikasi" }
        : { id: params.clientAccountId, name: "Conta demo", slug: "conta-demo" };

    return {
      client,
      filters: {
        archived: false,
        search: "",
      },
      meta: {
        totalCards: 4,
        scheduledCards: 3,
        overdueCards: 0,
        archivedCards: 0,
      },
      board: {
        columns: boardColumns,
        withoutColumn: {
          id: "without-column",
          name: "Sem coluna",
          cards: getLooseCards(),
        },
      },
    };
  });

  app.get("/clients/:clientAccountId/cards/:cardId", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    const card = allCards().find((item) => item.id === params.cardId);

    return {
      card,
      comments: commentsByCardId[params.cardId] ?? [],
      approvalLinks: approvalLinksByCardId[params.cardId] ?? [],
    };
  });

  app.patch("/clients/:clientAccountId/cards/:cardId", async (request, reply) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    const body = (request.body ?? {}) as { decision?: "approved" | "changes_requested" };
    const card = findCardById(params.cardId);

    if (!card) {
      reply.code(404);
      return { message: "Card nao encontrado." };
    }

    if (body.decision === "approved") {
      applyDecision(params.cardId, true);
    }

    if (body.decision === "changes_requested") {
      applyDecision(params.cardId, false);
    }

    return {
      ok: true,
      card: findCardById(params.cardId),
    };
  });

  app.post("/clients/:clientAccountId/cards/:cardId/comments", async (request, reply) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    const body = (request.body ?? {}) as { commentText?: string; isInternal?: boolean };
    const card = findCardById(params.cardId);
    const commentText = body.commentText?.trim();

    if (!card) {
      reply.code(404);
      return { message: "Card nao encontrado." };
    }

    if (!commentText) {
      reply.code(400);
      return { message: "Comentario vazio." };
    }

    return {
      ok: true,
      comment: addComment(params.cardId, {
        authorName: "Liege Paschoalini",
        authorRole: "super_admin",
        commentText,
        isInternal: body.isInternal ?? true,
      }),
    };
  });

  app.get("/clients/:clientAccountId/calendar", async () => ({
    client: {
      id: adminClientId,
      name: "Aplikasi",
      slug: "aplikasi",
    },
    range: {
      from: "2026-08-20",
      to: null,
    },
    meta: {
      totalEvents: internalCalendarEvents.length,
      upcomingEvents: internalCalendarEvents.length,
      pastEvents: 0,
    },
    events: internalCalendarEvents,
  }));

  app.get("/calendar/overview", async () => ({
    scope: {
      mode: "global",
      clientIds: [],
    },
    range: {
      from: "2026-08-20",
      to: null,
    },
    meta: {
      totalEvents: internalCalendarEvents.length,
      upcomingEvents: internalCalendarEvents.length,
      pastEvents: 0,
    },
    events: internalCalendarEvents,
  }));

  app.get("/portal/accounts", async () => ({
    items: [
      {
        clientAccountId: portalClientId,
        clientName: "Serena Genovese",
        clientSlug: "serena-genovese",
        isPrimary: true,
      },
    ],
  }));

  app.get("/portal/accounts/:clientAccountId/home", async () => ({
    account: {
      id: portalClientId,
      name: "Serena Genovese",
      slug: "serena-genovese",
      locale: "Italiano",
      portalTitle: "Portal do Cliente",
      trackingEnabled: true,
      trackingVisibleToClient: true,
      showArchivedToClient: false,
      showUpcomingPosts: true,
    },
    permissions: {
      allowClientEditCaption: true,
      allowClientCreatePost: false,
      allowClientCreateTags: false,
      allowClientDownload: true,
      allowClientEditBrandBrain: true,
      allowClientSearch: true,
      allowClientViewInvoices: true,
      allowClientViewReports: true,
      allowClientViewBrandBrain: true,
      allowClientViewTracking: true,
    },
    widgets: {
      upcomingPosts: true,
      tracking: true,
      invoices: true,
      reports: true,
      brandBrain: true,
      search: true,
    },
    upcomingItems: [
      {
        id: "up-1",
        title: "Destinos incriveis para 2027",
        scheduledAt: "23/08/2026 10:00",
        channel: "Instagram, Facebook, LinkedIn",
      },
      {
        id: "up-2",
        title: "Feedback do cliente para novo post",
        scheduledAt: "24/08/2026 14:00",
        channel: "Instagram",
      },
    ],
  }));

  app.get("/portal/accounts/:clientAccountId/board", async () => ({
    account: {
      id: portalClientId,
      name: "Serena Genovese",
      slug: "serena-genovese",
      locale: "Italiano",
      portalTitle: "Portal do Cliente",
    },
    permissions: {
      allowClientEditCaption: true,
      allowClientCreatePost: false,
      allowClientCreateTags: false,
      allowClientDownload: true,
      allowClientEditBrandBrain: true,
      allowClientSearch: true,
      allowClientViewInvoices: true,
      allowClientViewReports: true,
      allowClientViewBrandBrain: true,
      allowClientViewTracking: true,
    },
    filters: {
      archived: false,
      search: "",
    },
    board: {
      columns: getPortalVisibleColumns(),
      withoutColumn: {
        id: "without-column",
        name: "Sem coluna",
        cards: [],
      },
    },
  }));

  app.get("/portal/accounts/:clientAccountId/cards/:cardId", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    const card = allCards().find((item) => item.id === params.cardId);

    return {
      card,
      comments: (commentsByCardId[params.cardId] ?? []).filter((comment) => !comment.isInternal),
    };
  });

  app.post("/portal/accounts/:clientAccountId/cards/:cardId/comments", async (request, reply) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    const body = (request.body ?? {}) as { commentText?: string };
    const card = findCardById(params.cardId);
    const commentText = body.commentText?.trim();

    if (!card) {
      reply.code(404);
      return { message: "Card nao encontrado." };
    }

    if (!commentText) {
      reply.code(400);
      return { message: "Comentario vazio." };
    }

    return {
      ok: true,
      comment: addComment(params.cardId, {
        authorName: "Serena Genovese",
        authorRole: "cliente",
        commentText,
        isInternal: false,
      }),
    };
  });

  app.post("/portal/accounts/:clientAccountId/cards/:cardId/decision", async (request, reply) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    const body = (request.body ?? {}) as { approved?: boolean; commentText?: string };
    const card = findCardById(params.cardId);

    if (!card) {
      reply.code(404);
      return { message: "Card nao encontrado." };
    }

    if (body.commentText?.trim()) {
      addComment(params.cardId, {
        authorName: "Serena Genovese",
        authorRole: "cliente",
        commentText: body.commentText.trim(),
        isInternal: false,
      });
    }

    applyDecision(params.cardId, Boolean(body.approved));

    return {
      ok: true,
      card: findCardById(params.cardId),
      comments: (commentsByCardId[params.cardId] ?? []).filter((comment) => !comment.isInternal),
    };
  });

  app.get("/portal/accounts/:clientAccountId/calendar", async () => ({
    account: {
      id: portalClientId,
      name: "Serena Genovese",
      slug: "serena-genovese",
      locale: "Italiano",
      portalTitle: "Portal do Cliente",
    },
    range: {
      from: "2026-08-20",
      to: null,
    },
    meta: {
      totalEvents: 2,
      upcomingEvents: 2,
      pastEvents: 0,
    },
    events: [
      {
        id: "portal-calendar-1",
        title: "Destinos incriveis para 2027",
        publishDate: "2026-08-23",
        publishTime: "10:00:00",
        status: "scheduled",
      },
      {
        id: "portal-calendar-2",
        title: "Antes de ligar o motor, ja estamos cuidando de voce",
        publishDate: "2026-08-24",
        publishTime: "14:00:00",
        status: "scheduled",
      },
    ],
  }));
};
