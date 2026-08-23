import { ACCESS_TOKEN_KEY } from "./authApi";
import type {
  AdminWorkspacePreview,
  ApprovalLink,
  BoardCard,
  BoardColumn,
  CalendarEvent,
  CardComment,
  CardDetail,
  ClientPortalPreview,
} from "./types";

export type AdminClientOption = {
  id: string;
  name: string;
  slug: string;
  locale?: string;
  portal_title?: string | null;
  logo_url?: string | null;
  owner_user_id?: string | null;
  access_count?: number;
};

export type CreateAdminClientInput = {
  name: string;
  slug: string;
  locale: string;
  portalTitle: string;
  logoUrl?: string | null;
  ownerUserId?: string | null;
};

export type CreateManagedClientUserInput = {
  fullName: string;
  email: string;
  password: string;
  locale: string;
  clientAccountId: string;
};

export type ClientAccess = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  globalRole: "super_admin" | "admin" | "colaborador" | "cliente";
  membershipRole: "admin" | "colaborador" | "cliente";
  isPrimary: boolean;
  createdAt: string;
};

export type ClientTrackerSettings = {
  locale: string;
  trackingEnabled: boolean;
  trackingVisibleToClient: boolean;
  showUpcomingPosts: boolean;
  showArchivedToClient: boolean;
  clientPermissions: {
    allowClientEditCaption: boolean;
    allowClientCreatePost: boolean;
    allowClientCreateTags: boolean;
    allowClientDownload: boolean;
    allowClientEditBrandBrain: boolean;
    allowClientSearch: boolean;
    allowClientViewInvoices: boolean;
    allowClientViewReports: boolean;
    allowClientViewBrandBrain: boolean;
    allowClientViewTracking: boolean;
  };
  columns: Array<{ id: string; name: string; visibleToClient: boolean }>;
};
export type KanbanActivity = { id: string; title: string; detail: string; type: "card" | "approval"; occurredAt: string };
export type BrandBrain = { mission: string; vision: string; voice: string; visualNotes: string; approvedWords: string[]; avoidWords: string[]; expressions: string[]; colors: string[]; pillars: Array<{ name: string; focus: string; weight: number }> };
export type ReportMetrics = Record<"instagram" | "facebook", Record<"reach" | "impressions" | "engagement" | "followers" | "visits" | "clicks", number>>;
export type ClientReport = { id: string; clientAccountId: string; title: string; periodStart: string; periodEnd: string; status: "draft" | "published"; metrics: ReportMetrics; highlights: Array<{ channel: "instagram" | "facebook"; title: string; value: number }>; evidenceUrls: string[]; notes: string | null; publishedAt: string | null; createdAt: string; updatedAt: string };

export type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  globalRole: "super_admin" | "admin" | "colaborador" | "cliente";
  locale: string;
  isActive: boolean;
  createdAt: string;
};

export type TextDocument = {
  id: string;
  clientAccountId: string;
  title: string;
  contentHtml: string;
  contentType: "Blog" | "Artigo" | "Texto" | "Copy" | "Documento";
  status: "Rascunho" | "Em revisão" | "Aprovado";
  plannedAt: string | null;
  internalNotes: string | null;
  isSentToClient: boolean;
  sentAt: string | null;
  updatedAt: string;
};

export type TextComment = {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  commentText: string;
  isInternal: boolean;
  createdAt: string;
};

type ApiPortalAccountItem = {
  clientAccountId: string;
  clientName: string;
  clientSlug: string;
  isPrimary: boolean;
};

type ApiBoardCard = {
  id: string;
  title: string;
  caption: string | null;
  mediaType: string;
  primaryMediaUrl: string | null;
  mediaUrls: string[];
  externalLinkUrl: string | null;
  artType: string;
  status: string[];
  tags: string[];
  hashtags?: string[];
  isBriefApproval?: boolean;
  keepFiles?: boolean;
  deadlineAt?: string | null;
  commentsCount: number;
  scheduledAt: string | null;
  scheduledTimeZone?: string | null;
  archivedAt?: string | null;
  clientLabel: string;
};

type ApiBoardColumn = {
  id: string;
  name: string;
  color: string | null;
  visibleToClient: boolean;
  cards: ApiBoardCard[];
};

type ApiAdminBoardResponse = {
  client: {
    id: string;
    name: string;
    slug: string;
  };
  board: {
    columns: ApiBoardColumn[];
    withoutColumn: {
      cards: ApiBoardCard[];
    };
  };
  tags?: ClientTagDefinition[];
};

type ApiPortalHomeResponse = {
  account: {
    name: string;
    locale: string;
    portalTitle?: string;
    logoUrl?: string | null;
  };
  widgets: ClientPortalPreview["widgets"];
  upcomingItems: ClientPortalPreview["upcomingItems"];
};

type ApiPortalBoardResponse = {
  board: {
    columns: ApiBoardColumn[];
    withoutColumn: {
      cards: ApiBoardCard[];
    };
  };
};

type ApiCalendarEvent = {
  id: string;
  title: string;
  publishDate: string;
  publishTime: string | null;
  status: string;
  eventColor?: string | null;
  columnName?: string | null;
  clientName?: string;
  clientSlug?: string;
};

type ApiCalendarResponse = {
  events: ApiCalendarEvent[];
};

type ApiComment = {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string | null;
  commentText: string;
  isInternal: boolean;
  createdAt: string;
};

type ApiApprovalLink = {
  id: string;
  token: string;
  expiresAt: string;
  isActive: boolean;
  viewedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

export type ClientTagDefinition = { id: string; name: string; color: string };
export type HashtagGroup = { id: string; name: string; hashtags: string[] };
export type DashboardTask = { id: string; title: string; deadlineAt: string; clientLabel: string; clientName: string; clientLogoUrl?: string | null };
export type DashboardSubmission = { id: string; title: string; createdAt: string; clientName: string; clientLogoUrl?: string | null };
export type DashboardUpcomingPost = { id: string; title: string; scheduledAt: string; clientLabel: string; clientName: string; clientLogoUrl?: string | null };
export type AgendaLabel = { id: string; name: string; color: string };
export type AgendaRecurrence = "none" | "weekdays" | "weekly" | "monthly_nth_weekday";
export type AgendaEvent = { id: string; sourceEventId?: string; title: string; taskDescription?: string | null; startsAt: string; endsAt?: string | null; recurrenceType?: AgendaRecurrence; repeatUntil?: string | null; color: string; isCompleted: boolean; clientAccountId?: string | null; clientName?: string | null; labelId?: string | null; labelName?: string | null };

type ApiCardDetailResponse = {
  card: ApiBoardCard;
  comments: ApiComment[];
  approvalLinks?: ApiApprovalLink[];
};

const adminDrawerNotes = [
  "Cliente prefere aprovar pelo celular.",
  "Equipe de anuncios acessa apenas as contas atribuidas.",
  "Links temporarios de aprovacao podem expirar em 7 dias.",
];

const adminQuickLinks = [
  { label: "Instagram", href: "#" },
  { label: "Business Suite", href: "#" },
  { label: "Google Drive", href: "#" },
  { label: "ChatGPT", href: "#" },
];

const adminQuickApps = ["Recados", "Rascunhos", "Links", "Rapidos"];

let adminClientsCache: { expiresAt: number; data: { items: AdminClientOption[] } } | null = null;
let adminClientsRequest: Promise<{ items: AdminClientOption[] }> | null = null;

async function getAdminClients() {
  if (adminClientsCache && adminClientsCache.expiresAt > Date.now()) {
    return adminClientsCache.data;
  }
  if (!adminClientsRequest) {
    adminClientsRequest = fetchJson<{ items: AdminClientOption[] }>("/api/clients")
      .then((data) => {
        adminClientsCache = { data, expiresAt: Date.now() + 60_000 };
        return data;
      })
      .finally(() => { adminClientsRequest = null; });
  }
  return adminClientsRequest;
}

const adminTrackingItems = [
  { id: "t1", title: "EP. 237 - Capas YT + Spotify", done: true, badges: ["Design pronto", "Aline aprovou"] },
  { id: "t2", title: "EP. 237 - Reels episodio 2", done: false, badges: ["Shorts prontos", "Alterado"] },
  { id: "t3", title: "EP. 237 - Artigo LinkedIn", done: false, badges: ["Artigo pronto"] },
];

function getApiBaseUrl() {
  const value = import.meta.env.VITE_V2_API_URL;
  return typeof value === "string" && value.length > 0 ? value : "";
}

function getDevUserId() {
  return window.localStorage.getItem("designhub-v2-dev-user-id")?.trim() ?? "";
}

function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim() ?? "";
}

async function fetchJson<T>(path: string): Promise<T> {
  return sendJson<T>(path, { method: "GET" });
}

async function sendJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  const devUserId = getDevUserId();
  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (devUserId) {
    headers.set("x-user-id", devUserId);
  }

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Falha ao salvar: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("O servidor demorou para responder. Tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function inferMediaAspect(card: ApiBoardCard): BoardCard["mediaAspect"] {
  const source = `${card.artType} ${card.mediaType}`.toLowerCase();
  if (source.includes("story") || source.includes("reels") || source.includes("short")) {
    return "portrait";
  }
  if (source.includes("landscape") || source.includes("youtube") || source.includes("wide")) {
    return "landscape";
  }
  if (source.includes("square") || source.includes("post")) {
    return "square";
  }
  return "portrait";
}

function mapCard(card: ApiBoardCard, tagColors: Record<string, string> = {}): BoardCard {
  return {
    id: card.id,
    title: card.title,
    subtitle: card.caption ?? undefined,
    mediaUrl:
      card.primaryMediaUrl ??
      card.mediaUrls[0],
    mediaUrls: card.mediaUrls,
    externalLinkUrl: card.externalLinkUrl ?? undefined,
    mediaAspect: inferMediaAspect(card),
    typeLabel: card.artType,
    statusBadges: card.status,
    tags: card.tags,
    tagColors,
    commentsCount: card.commentsCount,
    scheduledAt: card.scheduledAt ?? undefined,
    archivedAt: card.archivedAt ?? null,
    clientLabel: card.clientLabel,
    hashtags: card.hashtags ?? [],
    isBriefApproval: card.isBriefApproval ?? false,
    keepFiles: card.keepFiles ?? false,
    deadlineAt: card.deadlineAt,
  };
}

function mapColumns(columns: ApiBoardColumn[], tagColors: Record<string, string> = {}): BoardColumn[] {
  return columns.map((column) => ({
    id: column.id,
    name: column.name,
    color: column.color ?? "#5e5cf1",
    visibleToClient: column.visibleToClient,
    cards: column.cards.map((card) => mapCard(card, tagColors)),
  }));
}

function mapCalendarEvent(event: ApiCalendarEvent): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    publishDate: event.publishDate,
    publishTime: event.publishTime,
    status: event.status,
    color: event.eventColor ?? undefined,
    columnName: event.columnName ?? undefined,
    clientName: event.clientName,
    clientSlug: event.clientSlug,
  };
}

function mapComment(comment: ApiComment): CardComment {
  return {
    id: comment.id,
    authorName: comment.authorName,
    authorRole: comment.authorRole,
    authorAvatarUrl: comment.authorAvatarUrl ?? null,
    commentText: comment.commentText,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt,
  };
}

function mapApprovalLink(link: ApiApprovalLink): ApprovalLink {
  return {
    id: link.id,
    token: link.token,
    expiresAt: link.expiresAt,
    isActive: link.isActive,
    viewedAt: link.viewedAt,
    approvedAt: link.approvedAt,
    createdAt: link.createdAt,
  };
}

export async function loadAdminWorkspaceBySlug(slug: string, options: { archived?: boolean } = {}): Promise<AdminWorkspacePreview> {
  const clientsResponse = await getAdminClients();
  const matchedClient = clientsResponse.items.find((item) => item.slug === slug);
  if (!matchedClient) throw new Error(`Conta ${slug} nao encontrada.`);

  const boardResponse = await fetchJson<ApiAdminBoardResponse>(
    `/api/clients/${matchedClient.id}/board${options.archived ? "?archived=true" : ""}`,
  );
  const tagDefinitions = boardResponse.tags ?? [];
  const tagColors = Object.fromEntries(tagDefinitions.map((tag) => [tag.name, tag.color]));

  return {
    clientName: boardResponse.client.name,
    clientSlug: boardResponse.client.slug,
    accountSwitcher: clientsResponse.items.map((item) => item.name),
    columns: mapColumns(boardResponse.board.columns, tagColors),
    withoutColumn: boardResponse.board.withoutColumn.cards.map((card) => mapCard(card, tagColors)),
    // The calendar is not rendered in the admin board and used to delay every opening.
    calendarEvents: [],
    drawerNotes: adminDrawerNotes,
    quickLinks: adminQuickLinks,
    quickApps: adminQuickApps,
    trackingItems: adminTrackingItems,
    tagDefinitions,
  };
}

export async function listAdminTextsBySlug(slug: string) {
  const client = await findAdminClientBySlug(slug);
  return fetchJson<{ items: TextDocument[] }>(`/api/clients/${client.id}/texts`);
}

export async function createAdminTextBySlug(slug: string, input: { title?: string; contentHtml?: string; contentType?: TextDocument["contentType"] }) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ text: TextDocument }>(`/api/clients/${client.id}/texts`, { method: "POST", body: JSON.stringify(input) });
}

export async function updateAdminTextBySlug(slug: string, textId: string, input: Partial<Pick<TextDocument, "title" | "contentHtml" | "contentType" | "status" | "plannedAt" | "internalNotes">>) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ text: TextDocument }>(`/api/clients/${client.id}/texts/${textId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function sendAdminTextToClientBySlug(slug: string, textId: string) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ text: TextDocument }>(`/api/clients/${client.id}/texts/${textId}/send`, { method: "POST" });
}

export async function deleteAdminTextBySlug(slug: string, textId: string) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ ok: boolean }>(`/api/clients/${client.id}/texts/${textId}`, { method: "DELETE" });
}

export async function listAdminTextCommentsBySlug(slug: string, textId: string) {
  const client = await findAdminClientBySlug(slug);
  return fetchJson<{ comments: TextComment[] }>(`/api/clients/${client.id}/texts/${textId}/comments`);
}

export async function addAdminTextCommentBySlug(slug: string, textId: string, input: { commentText: string; isInternal?: boolean }) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ comment: TextComment }>(`/api/clients/${client.id}/texts/${textId}/comments`, { method: "POST", body: JSON.stringify(input) });
}

export async function listPortalTextsBySlug(slug: string) {
  const account = await findPortalAccountBySlug(slug);
  return fetchJson<{ items: TextDocument[] }>(`/api/portal/accounts/${account.clientAccountId}/texts`);
}

export async function listPortalTextCommentsBySlug(slug: string, textId: string) {
  const account = await findPortalAccountBySlug(slug);
  return fetchJson<{ comments: TextComment[] }>(`/api/portal/accounts/${account.clientAccountId}/texts/${textId}/comments`);
}

export async function addPortalTextCommentBySlug(slug: string, textId: string, commentText: string) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ comment: TextComment }>(`/api/portal/accounts/${account.clientAccountId}/texts/${textId}/comments`, {
    method: "POST",
    body: JSON.stringify({ commentText }),
  });
}

export async function submitPortalTextDecisionBySlug(slug: string, textId: string, input: { approved: boolean; commentText?: string }) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ text: TextDocument }>(`/api/portal/accounts/${account.clientAccountId}/texts/${textId}/decision`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listAdminReports(clientAccountId: string) { return fetchJson<{ items: ClientReport[] }>(`/api/clients/${clientAccountId}/reports`); }
export async function createAdminReport(clientAccountId: string, input: Omit<ClientReport, "id" | "clientAccountId" | "status" | "publishedAt" | "createdAt" | "updatedAt">) { return sendJson<{ report: ClientReport }>(`/api/clients/${clientAccountId}/reports`, { method: "POST", body: JSON.stringify(input) }); }
export async function updateAdminReport(clientAccountId: string, reportId: string, input: Partial<Omit<ClientReport, "id" | "clientAccountId" | "status" | "publishedAt" | "createdAt" | "updatedAt">>) { return sendJson<{ report: ClientReport }>(`/api/clients/${clientAccountId}/reports/${reportId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function publishAdminReport(clientAccountId: string, reportId: string) { return sendJson<{ report: ClientReport }>(`/api/clients/${clientAccountId}/reports/${reportId}/publish`, { method: "POST" }); }
export async function deleteAdminReport(clientAccountId: string, reportId: string) { return sendJson<{ ok: boolean }>(`/api/clients/${clientAccountId}/reports/${reportId}`, { method: "DELETE" }); }
export async function extractAdminReportMetrics(clientAccountId: string, evidenceUrls: string[]) { return sendJson<{ metrics: ReportMetrics; highlights: ClientReport["highlights"] }>(`/api/clients/${clientAccountId}/reports/extract`, { method: "POST", body: JSON.stringify({ evidenceUrls }) }); }
export async function listPortalReportsBySlug(slug: string) { const account = await findPortalAccountBySlug(slug); return fetchJson<{ items: ClientReport[] }>(`/api/portal/accounts/${account.clientAccountId}/reports`); }

export async function loadClientPortalBySlug(slug: string): Promise<ClientPortalPreview> {
  const accountsResponse = await fetchJson<{ items: ApiPortalAccountItem[] }>("/api/portal/accounts");
  const matchedAccount = await findPortalAccountBySlug(slug);

  const [homeResponse, boardResponse, calendarResponse] = await Promise.all([
    fetchJson<ApiPortalHomeResponse>(`/api/portal/accounts/${matchedAccount.clientAccountId}/home`),
    fetchJson<ApiPortalBoardResponse>(
      `/api/portal/accounts/${matchedAccount.clientAccountId}/board`,
    ),
    fetchJson<ApiCalendarResponse>(
      `/api/portal/accounts/${matchedAccount.clientAccountId}/calendar`,
    ),
  ]);

  return {
    accountName: homeResponse.account.name,
    clientGreetingName: homeResponse.account.portalTitle || homeResponse.account.name,
    clientLogoUrl: homeResponse.account.logoUrl ?? null,
    locale: homeResponse.account.locale,
    widgets: homeResponse.widgets,
    boardColumns: mapColumns(boardResponse.board.columns),
    withoutColumn: boardResponse.board.withoutColumn.cards.map((card) => mapCard(card)),
    calendarEvents: calendarResponse.events.map(mapCalendarEvent),
    upcomingItems: homeResponse.upcomingItems,
  };
}

export async function loadAdminCardDetailBySlug(
  slug: string,
  cardId: string,
): Promise<CardDetail> {
  const matchedClient = await findAdminClientBySlug(slug);

  const response = await fetchJson<ApiCardDetailResponse>(
    `/api/clients/${matchedClient.id}/cards/${cardId}`,
  );

  return {
    card: mapCard(response.card),
    comments: response.comments.map(mapComment),
    approvalLinks: (response.approvalLinks ?? []).map(mapApprovalLink),
  };
}

export async function loadPortalCardDetailBySlug(
  slug: string,
  cardId: string,
): Promise<CardDetail> {
  const matchedAccount = await findPortalAccountBySlug(slug);

  const response = await fetchJson<ApiCardDetailResponse>(
    `/api/portal/accounts/${matchedAccount.clientAccountId}/cards/${cardId}`,
  );

  return {
    card: mapCard(response.card),
    comments: response.comments.map(mapComment),
    approvalLinks: [],
  };
}

async function findAdminClientBySlug(slug: string) {
  const clientsResponse = await getAdminClients();
  const matchedClient = clientsResponse.items.find((item) => item.slug === slug);

  if (!matchedClient) {
    throw new Error(`Conta ${slug} nao encontrada.`);
  }

  return matchedClient;
}

async function findPortalAccountBySlug(slug: string) {
  const accountsResponse = await fetchJson<{ items: ApiPortalAccountItem[] }>(
    "/api/portal/accounts",
  );
  const matchedAccount = accountsResponse.items.find((item) => item.clientSlug === slug);

  if (!matchedAccount) {
    throw new Error(`Portal ${slug} nao encontrado.`);
  }

  return matchedAccount;
}

export async function addAdminCardCommentBySlug(
  slug: string,
  cardId: string,
  input: { commentText: string; isInternal?: boolean },
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitAdminCardDecisionBySlug(
  slug: string,
  cardId: string,
  decision: "approved" | "changes_requested",
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ decision }),
  });
}

export async function addPortalCardCommentBySlug(
  slug: string,
  cardId: string,
  input: { commentText: string },
) {
  const matchedAccount = await findPortalAccountBySlug(slug);
  return sendJson(`/api/portal/accounts/${matchedAccount.clientAccountId}/cards/${cardId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitPortalCardDecisionBySlug(
  slug: string,
  cardId: string,
  input: { approved: boolean; commentText?: string },
) {
  const matchedAccount = await findPortalAccountBySlug(slug);
  return sendJson(
    `/api/portal/accounts/${matchedAccount.clientAccountId}/cards/${cardId}/decision`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createAdminColumnBySlug(
  slug: string,
  input: { name: string; color: string; visibleToClient: boolean },
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/columns`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminColumnBySlug(
  slug: string,
  columnId: string,
  input: Partial<{ name: string; color: string; visibleToClient: boolean }>,
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminColumnBySlug(slug: string, columnId: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/columns/${columnId}`, {
    method: "DELETE",
  });
}

export async function createAdminCardBySlug(
  slug: string,
  input: {
    columnId: string | null;
    title: string;
    caption: string | null;
    primaryMediaUrl: string | null;
    externalLinkUrl: string | null;
    artType: string;
    status: string[];
    tags: string[];
    mediaType?: string;
    mediaUrls?: string[];
    hashtags?: string[];
    deadlineAt?: string | null;
    scheduledAt?: string | null;
    scheduledTimeZone?: string | null;
    clientLabel?: string;
    isBriefApproval?: boolean;
  },
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards`, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      mediaType: input.mediaType ?? "image",
      mediaUrls: input.mediaUrls ?? (input.primaryMediaUrl ? [input.primaryMediaUrl] : []),
      externalLinkUrl: input.externalLinkUrl,
      clientLabel: input.clientLabel ?? "Pendente",
      isBriefApproval: input.isBriefApproval ?? false,
    }),
  });
}

export async function updateAdminCardBySlug(
  slug: string,
  cardId: string,
  input: Partial<{
    title: string;
    caption: string | null;
    mediaType: string;
    primaryMediaUrl: string | null;
    mediaUrls: string[];
    externalLinkUrl: string | null;
    artType: string;
    status: string[];
    tags: string[];
    hashtags: string[];
    isBriefApproval: boolean;
    keepFiles: boolean;
    deadlineAt: string | null;
    scheduledAt: string | null;
    scheduledTimeZone: string | null;
    clientLabel: string;
  }>,
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function moveAdminCardBySlug(slug: string, cardId: string, columnId: string | null, position?: number) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}/move`, {
    method: "POST",
    body: JSON.stringify({ columnId, position }),
  });
}

export async function archiveAdminCardBySlug(slug: string, cardId: string) {
  return setAdminCardArchivedBySlug(slug, cardId, true);
}

export async function setAdminCardArchivedBySlug(slug: string, cardId: string, archived: boolean) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  });
}

export async function deleteAdminCardBySlug(slug: string, cardId: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}`, { method: "DELETE" });
}

export async function listAdminClients() {
  return getAdminClients();
}

export async function createAdminClient(input: CreateAdminClientInput) {
  const response = await sendJson<{ ok: true; client: AdminClientOption }>("/api/clients", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      showUpcomingPosts: false,
      showArchivedToClient: false,
      trackingEnabled: false,
      trackingVisibleToClient: false,
      clientPermissions: {},
    }),
  });
  adminClientsCache = null;
  return response.client;
}

export async function createManagedClientUser(input: CreateManagedClientUserInput) {
  return sendJson<{ ok: true }>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify({
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      globalRole: "cliente",
      locale: input.locale,
      memberships: [{
        clientAccountId: input.clientAccountId,
        membershipRole: "cliente",
        isPrimary: true,
      }],
    }),
  });
}

export async function updateAdminClient(clientId: string, input: { name: string; slug: string; locale: string; portalTitle: string; logoUrl?: string | null }) {
  const response = await sendJson<{ ok: true }>(`/api/clients/${clientId}`, { method: "PATCH", body: JSON.stringify(input) });
  adminClientsCache = null;
  return response;
}

export async function loadAdminTrackerSettingsBySlug(slug: string) {
  const client = await findAdminClientBySlug(slug);
  return fetchJson<{ settings: ClientTrackerSettings }>(`/api/clients/${client.id}/tracker-settings`);
}

export async function saveAdminTrackerSettingsBySlug(slug: string, settings: ClientTrackerSettings) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true }>(`/api/clients/${client.id}/tracker-settings`, {
    method: "PATCH",
    body: JSON.stringify({
      ...settings,
      visibleColumnIds: settings.columns.filter((column) => column.visibleToClient).map((column) => column.id),
    }),
  });
}

export async function deleteAdminClient(clientId: string) {
  const response = await sendJson<{ ok: true }>(`/api/clients/${clientId}`, { method: "DELETE" });
  adminClientsCache = null;
  return response;
}

export async function loadClientAccesses(clientId: string) {
  return fetchJson<{ client: AdminClientOption; accesses: ClientAccess[] }>(`/api/clients/${clientId}/accesses`);
}

export async function shareClientWithMember(clientId: string, input: { userId: string; membershipRole: "admin" | "colaborador"; isPrimary?: boolean }) {
  return sendJson<{ ok: true; accesses: ClientAccess[] }>(`/api/clients/${clientId}/accesses`, { method: "POST", body: JSON.stringify(input) });
}

export async function listManagedUsers() {
  return fetchJson<{ items: ManagedUser[] }>("/api/auth/users");
}

export async function resetManagedUserPassword(userId: string, newPassword: string) {
  return sendJson<{ ok: true }>(`/api/auth/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) });
}

export async function loadAdminWorkspaceDrawerBySlug(slug: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return fetchJson<{ data: unknown }>(`/api/clients/${matchedClient.id}/workspace-drawer`);
}

export async function saveAdminWorkspaceDrawerBySlug(slug: string, data: unknown) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/workspace-drawer`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

export async function loadAdminKanbanAutomationsBySlug(slug: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return fetchJson<{ items: unknown[] }>(`/api/clients/${matchedClient.id}/kanban-automations`);
}

export async function saveAdminKanbanAutomationsBySlug(slug: string, items: unknown[]) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/kanban-automations`, { method: "PUT", body: JSON.stringify({ items }) });
}

export async function createAdminApprovalLinkBySlug(slug: string, cardId: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; approvalLink: ApiApprovalLink }>(
    `/api/clients/${matchedClient.id}/cards/${cardId}/approval-links`,
    { method: "POST", body: JSON.stringify({ expiresInDays: 7 }) },
  );
}

export async function listAdminTagsBySlug(slug: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return fetchJson<{ items: ClientTagDefinition[] }>(`/api/clients/${matchedClient.id}/tags`);
}

export async function createAdminTagBySlug(slug: string, input: { name: string; color: string }) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; tag: ClientTagDefinition }>(`/api/clients/${matchedClient.id}/tags`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listAdminHashtagGroupsBySlug(slug: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return fetchJson<{ items: HashtagGroup[] }>(`/api/clients/${matchedClient.id}/hashtag-groups`);
}

export async function loadDashboardOverview() {
  return fetchJson<{ dueTasks: DashboardTask[]; upcomingPosts: DashboardUpcomingPost[]; agendaToday: AgendaEvent[]; clientSubmissions: DashboardSubmission[] }>("/api/dashboard/overview");
}

export async function loadAgendaEvents(from: string, to: string) { return fetchJson<{ items: AgendaEvent[] }>(`/api/agenda/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); }
export async function loadCalendarOverview(from: string, to: string) { const response = await fetchJson<ApiCalendarResponse & { meta?: { totalEvents?: number } }>(`/api/calendar/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); return { ...response, events: response.events.map(mapCalendarEvent) }; }
export async function loadAdminClientCalendarBySlug(slug: string, from: string, to: string) { const client = await findAdminClientBySlug(slug); const response = await fetchJson<ApiCalendarResponse>(`/api/clients/${client.id}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); return { clientAccountId: client.id, events: response.events.map(mapCalendarEvent) }; }
export async function loadAdminKanbanActivitiesBySlug(slug: string) { const client = await findAdminClientBySlug(slug); return fetchJson<{ items: KanbanActivity[] }>(`/api/clients/${client.id}/activities`); }
export async function loadBrandBrainBySlug(slug: string) { const client = await findAdminClientBySlug(slug); return fetchJson<{ data: BrandBrain | null }>(`/api/clients/${client.id}/brand-brain`); }
export async function saveBrandBrainBySlug(slug: string, data: BrandBrain) { const client = await findAdminClientBySlug(slug); return sendJson<{ ok: true }>(`/api/clients/${client.id}/brand-brain`, { method: "PUT", body: JSON.stringify({ data }) }); }
export async function createAgendaEvent(input: { title: string; taskDescription?: string | null; startsAt: string; endsAt?: string | null; color: string; clientAccountId?: string | null; labelId?: string | null; recurrenceType?: AgendaRecurrence; repeatUntil?: string | null }) { return sendJson<{ ok: true; id: string }>("/api/agenda/events", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAgendaEvent(eventId: string, input: Partial<{ title: string; taskDescription: string | null; startsAt: string; color: string; clientAccountId: string | null; labelId: string | null; recurrenceType: AgendaRecurrence; repeatUntil: string | null }>) { return sendJson<{ ok: true }>(`/api/agenda/events/${eventId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function deleteAgendaEvent(eventId: string) { return sendJson<{ ok: true }>(`/api/agenda/events/${eventId}`, { method: "DELETE" }); }
export async function loadAgendaLabels() { return fetchJson<{ items: AgendaLabel[] }>("/api/agenda/labels"); }
export async function createAgendaLabel(input: { name: string; color: string }) { return sendJson<{ ok: true; label: AgendaLabel }>("/api/agenda/labels", { method: "POST", body: JSON.stringify(input) }); }
export async function deleteAgendaLabel(labelId: string) { return sendJson<{ ok: true }>(`/api/agenda/labels/${labelId}`, { method: "DELETE" }); }
export async function createAdminHashtagGroupBySlug(slug: string, input: { name: string; hashtags: string[] }) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; group: HashtagGroup }>(`/api/clients/${matchedClient.id}/hashtag-groups`, { method: "POST", body: JSON.stringify(input) });
}
export async function deleteAdminHashtagGroupBySlug(slug: string, groupId: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true }>(`/api/clients/${matchedClient.id}/hashtag-groups/${groupId}`, { method: "DELETE" });
}

export async function loadPublicApproval(token: string) {
  const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/portal/approval/${token}`, { method: "GET" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Nao foi possivel abrir este link de aprovacao.");
  }
  return response.json() as Promise<{ account: { name: string }; card: ApiBoardCard; approvalLink: ApiApprovalLink }>;
}

export async function submitPublicApproval(token: string, input: { approved: boolean; commentText?: string; requesterName?: string }) {
  const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/portal/approval/${token}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Nao foi possivel registrar sua decisao.");
  }
  return response.json() as Promise<{ ok: true }>;
}

export async function uploadAdminMedia(file: File) {
  const headers = new Headers();
  const accessToken = getAccessToken();
  const devUserId = getDevUserId();

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (devUserId) headers.set("x-user-id", devUserId);

  const body = new FormData();
  body.set("file", file);
  const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/uploads`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error("O arquivo excede o limite permitido para este formato.");
    }
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Nao foi possivel enviar a imagem.");
  }

  const result = (await response.json()) as { url: string };
  return result.url;
}

export async function updateMyProfile(input: { avatarUrl: string | null }) {
  return sendJson<{ ok: true; user: { avatarUrl: string | null } }>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function changeMyPassword(input: { currentPassword: string; newPassword: string }) {
  return sendJson<{ ok: true }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
