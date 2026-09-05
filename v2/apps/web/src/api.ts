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

export type TimeEntry = {
  id: string;
  userId: string;
  userName: string;
  clientAccountId: string;
  clientName: string;
  cardId: string | null;
  cardTitle: string | null;
  description: string;
  startedAt: string;
  lastStartedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
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
  portalAccessLevel?: PortalAccessLevel;
};

export type PortalAccessLevel = "admin" | "approver" | "viewer";

export type ClientAccess = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  globalRole: "super_admin" | "admin" | "colaborador" | "cliente";
  membershipRole: "admin" | "colaborador" | "cliente";
  portalAccessLevel: PortalAccessLevel;
  isPrimary: boolean;
  createdAt: string;
};

export type CaptionVersion = {
  id: string;
  cardId: string;
  caption: string | null;
  authorUserId: string | null;
  authorName: string;
  authorRole: string;
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
    allowClientViewTexts: boolean;
    allowClientViewInvoices: boolean;
    allowClientViewReports: boolean;
    allowClientViewBrandBrain: boolean;
    allowClientViewTracking: boolean;
  };
  columns: Array<{ id: string; name: string; visibleToClient: boolean }>;
};
export type KanbanActivity = { id: string; title: string; detail: string; type: "card" | "approval"; occurredAt: string };
export type BrandBrain = {
  mission: string; vision: string; positioning: string; brandPromise: string;
  audience: string; audiencePains: string[]; audienceDesires: string[];
  voice: string; personalityTraits: string[]; voiceExamples: string[]; voiceAvoidExamples: string[];
  visualNotes: string; typographyDisplay: string; typographyBody: string; typographyAccent: string; typographySample: string;
  approvedWords: string[]; avoidWords: string[]; expressions: string[]; colors: string[];
  differentiators: string[]; proofPoints: string[]; references: string[];
  pillars: Array<{ name: string; focus: string; weight: number }>;
};
export type BrandBrainRevision = { id: string; status: "pending" | "approved" | "rejected"; summary: string | null; data: BrandBrain; authorName: string; authorRole: string; reviewerName: string | null; createdAt: string; reviewedAt: string | null };
export type BrandBrainComment = { id: string; revisionId: string | null; sectionKey: string; commentText: string; authorName: string; authorRole: string; isInternal: boolean; createdAt: string };
export type BrandBrainSnapshot = { data: BrandBrain | null; meta: { version: number; updatedAt: string | null; updatedBy: string | null }; revisions: BrandBrainRevision[]; history: Array<{ id: string; version: number; authorName: string; createdAt: string }>; comments: BrandBrainComment[] };
export type ReportMetrics = Record<"instagram" | "facebook", Record<"reach" | "impressions" | "engagement" | "followers" | "visits" | "clicks", number>>;
export type ClientReport = { id: string; clientAccountId: string; title: string; periodStart: string; periodEnd: string; status: "draft" | "published"; metrics: ReportMetrics; highlights: Array<{ channel: "instagram" | "facebook"; title: string; value: number }>; evidenceUrls: string[]; notes: string | null; publishedAt: string | null; createdAt: string; updatedAt: string };
export type BillingCurrency = "BRL" | "EUR" | "USD" | "SEK";
export type BillingInvoiceStatus = "open" | "paid" | "overdue" | "cancelled";
export type BillingInvoice = {
  id: string; clientAccountId: string | null; number: number; title: string; clientName: string; clientEmail: string;
  clientAddress: string; clientCountry: string; clientTaxId: string; issueDate: string; dueDate: string; period: string;
  currency: BillingCurrency; locale: "pt" | "en" | "it" | "es" | "sv"; status: BillingInvoiceStatus;
  recurring: boolean; fixedAmount: boolean; visibleToClient: boolean; sentToClient: boolean; notes: string;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number }>;
  attachments: Array<{ id: string; fileName: string; fileUrl: string }>;
  createdAt?: string; updatedAt?: string;
};
export type ContractRecord = {
  id: string; clientAccountId: string; clientName: string; clientSlug: string; title: string; bodyHtml: string;
  language: string; contractType: string; startDate: string | null; endDate: string | null; contractValue: string;
  scope: string; notes: string; status: "pending" | "accepted" | "cancelled"; createdAt: string; updatedAt: string;
  acceptedAt: string | null; acceptedByUserId: string | null;
};
export type ContractTemplateRecord = { id: string; name: string; bodyHtml: string; language: string; description: string; draft: Partial<Omit<ContractRecord, "id" | "clientAccountId" | "clientName" | "clientSlug" | "status" | "createdAt" | "updatedAt" | "acceptedAt" | "acceptedByUserId">>; custom: true; createdAt: string; updatedAt: string };
export type ProposalRecord = {
  id: string; token: string; clientName: string; email: string; locale: string; proposalType: string; plan: string;
  pieces: number; scope: string; investment: string; currency: string; expiresAt: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "refused" | "expired";
  services: Array<{ name: string; value: number; description: string }>;
  acceptedAt?: string | null; viewedAt?: string | null; createdAt?: string; updatedAt?: string;
};
export type DesignBriefFieldRecord = {
  id: string; type: "short" | "long" | "choice" | "checklist" | "link" | "file";
  label: string; help: string; required: boolean; options: string[];
};
export type DesignBriefRecord = {
  id: string; clientAccountId: string | null; title: string; introduction: string; category: string;
  locale: "pt" | "en" | "es" | "it" | "sv"; status: "draft" | "completed";
  fields: DesignBriefFieldRecord[]; answers: Record<string, unknown>; submittedAt: string | null;
  createdAt: string; updatedAt: string;
};
export type DesignBriefTemplateRecord = {
  id: string; name: string; introduction: string; fields: DesignBriefFieldRecord[]; createdAt: string; updatedAt: string;
};

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
  publishedAt?: string | null;
  scheduledTimeZone?: string | null;
  archivedAt?: string | null;
  clientLabel: string;
  priorityLevel?: "high" | "medium" | "normal" | null;
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
    trackingEnabled: boolean;
    showArchivedToClient: boolean;
  };
  permissions: ClientPortalPreview["permissions"];
  accessLevel: ClientPortalPreview["accessLevel"];
  widgets: ClientPortalPreview["widgets"];
  upcomingItems: ClientPortalPreview["upcomingItems"];
  calendarPosts: ApiBoardCard[];
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
  mediaType?: string;
  mediaUrls?: string[];
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
export type DashboardClientActivity = { id: string; cardId: string | null; title: string; occurredAt: string; clientName: string; clientSlug: string; clientLogoUrl?: string | null; activityType: "approved" | "changes_requested" | "comment" | "brand_brain" | "contract_accepted" | "proposal_accepted"; detail: string };
export type DashboardUpcomingPost = { id: string; title: string; scheduledAt: string; clientLabel: string; clientName: string; clientLogoUrl?: string | null };
export type DashboardTodayPost = { id: string; title: string; scheduledAt: string; clientName: string; clientLogoUrl?: string | null; mediaUrl?: string | null };
export type AgendaLabel = { id: string; name: string; color: string };
export type AgendaRecurrence = "none" | "weekdays" | "weekly" | "monthly_nth_weekday";
export type AgendaEvent = { id: string; sourceEventId?: string; title: string; taskDescription?: string | null; startsAt: string; endsAt?: string | null; recurrenceType?: AgendaRecurrence; repeatUntil?: string | null; color: string; isCompleted: boolean; clientAccountId?: string | null; clientName?: string | null; labelId?: string | null; labelName?: string | null; meetLink?: string | null };

type ApiCardDetailResponse = {
  card: ApiBoardCard;
  comments: ApiComment[];
  approvalLinks?: ApiApprovalLink[];
};

const adminDrawerNotes = [
  "Cliente prefere aprovar pelo celular.",
  "Equipe de anúncios acessa apenas as contas atribuídas.",
  "Links temporários de aprovação podem expirar em 7 dias.",
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
let portalAccountsCache: { authKey: string; expiresAt: number; data: { items: ApiPortalAccountItem[] } } | null = null;
let portalAccountsRequest: { authKey: string; promise: Promise<{ items: ApiPortalAccountItem[] }> } | null = null;

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

async function getPortalAccounts() {
  const authKey = getAccessToken();
  if (portalAccountsCache?.authKey === authKey && portalAccountsCache.expiresAt > Date.now()) {
    return portalAccountsCache.data;
  }
  if (portalAccountsRequest?.authKey === authKey) {
    return portalAccountsRequest.promise;
  }

  const promise = fetchJson<{ items: ApiPortalAccountItem[] }>("/api/portal/accounts")
    .then((data) => {
      portalAccountsCache = { authKey, data, expiresAt: Date.now() + 60_000 };
      return data;
    })
    .finally(() => {
      if (portalAccountsRequest?.authKey === authKey) portalAccountsRequest = null;
    });
  portalAccountsRequest = { authKey, promise };
  return promise;
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

  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    // Portal permissions and Kanban state are live settings. A cached GET here
    // can leave the client area showing an old permission snapshot even after
    // the admin has saved a change.
    cache: (init.method ?? "GET").toUpperCase() === "GET" ? "no-store" : init.cache,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Falha ao salvar: ${response.status}`);
  }

  const payload = await response.json() as T;
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    let body: Record<string, unknown> | null = null;
    if (typeof init.body === "string") {
      try { body = JSON.parse(init.body) as Record<string, unknown>; } catch { body = null; }
    }
    const isCardDecisionWithOwnAnimation = /\/cards\/[^/]+\/decision$/.test(path);
    const isScheduleWithOwnAnimation = typeof body?.scheduledAt === "string";
    if (!isCardDecisionWithOwnAnimation && !isScheduleWithOwnAnimation) {
      const feedback = path.includes("/comments")
        ? { title: "Feedback enviado", detail: "Seu comentário foi salvo com sucesso.", tone: "success" }
        : path.includes("/texts/") && path.endsWith("/decision")
          ? { title: "Feedback enviado", detail: "O retorno sobre o texto foi registrado.", tone: "success" }
          : method === "DELETE"
            ? { title: "Item removido", detail: "A alteração já foi aplicada.", tone: "neutral" }
            : method === "PATCH" || method === "PUT"
              ? { title: "Alterações salvas", detail: "Tudo foi atualizado corretamente.", tone: "success" }
              : path.endsWith("/cards")
                ? { title: "Conteúdo criado", detail: "O novo card já está disponível.", tone: "success" }
                : path.endsWith("/columns")
                  ? { title: "Coluna criada", detail: "A nova etapa já está no quadro.", tone: "success" }
                  : { title: "Tudo certo", detail: "A ação foi concluída com sucesso.", tone: "success" };
      window.dispatchEvent(new CustomEvent("design-hub:success", { detail: { ...feedback, id: `${Date.now()}-${Math.random()}` } }));
    }
  }
  return payload;
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
    publishedAt: card.publishedAt ?? null,
    archivedAt: card.archivedAt ?? null,
    clientLabel: card.clientLabel,
    priorityLevel: card.priorityLevel ?? null,
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
    mediaType: event.mediaType,
    mediaUrls: event.mediaUrls ?? [],
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
  if (!matchedClient) throw new Error(`Conta ${slug} não encontrada.`);

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
export async function listAdminInvoices() { return fetchJson<{ items: BillingInvoice[] }>("/api/invoices"); }
export async function createAdminInvoice(input: Omit<BillingInvoice, "id" | "number" | "createdAt" | "updatedAt">) { return sendJson<{ invoice: BillingInvoice }>("/api/invoices", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAdminInvoice(invoiceId: string, input: Partial<Omit<BillingInvoice, "id" | "number" | "createdAt" | "updatedAt">>) { return sendJson<{ invoice: BillingInvoice }>(`/api/invoices/${invoiceId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function deleteAdminInvoice(invoiceId: string) { return sendJson<{ ok: true }>(`/api/invoices/${invoiceId}`, { method: "DELETE" }); }
export async function listPortalInvoicesBySlug(slug: string) { const account = await findPortalAccountBySlug(slug); return fetchJson<{ items: BillingInvoice[] }>(`/api/portal/accounts/${account.clientAccountId}/invoices`); }
export async function listAdminContracts() { return fetchJson<{ items: ContractRecord[] }>("/api/contracts"); }
export async function createAdminContract(input: { clientAccountId: string; title: string; bodyHtml: string; language: string; contractType: string; startDate: string | null; endDate: string | null; contractValue: string; scope: string; notes: string; status: ContractRecord["status"] }) { return sendJson<{ contract: ContractRecord }>("/api/contracts", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAdminContract(contractId: string, input: Partial<{ clientAccountId: string; title: string; bodyHtml: string; language: string; contractType: string; startDate: string | null; endDate: string | null; contractValue: string; scope: string; notes: string; status: ContractRecord["status"] }>) { return sendJson<{ contract: ContractRecord }>(`/api/contracts/${contractId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function deleteAdminContract(contractId: string) { return sendJson<{ ok: boolean }>(`/api/contracts/${contractId}`, { method: "DELETE" }); }
export async function listAdminContractTemplates() { return fetchJson<{ items: ContractTemplateRecord[] }>("/api/contract-templates"); }
export async function createAdminContractTemplate(input: { name: string; bodyHtml: string; language: string; description: string; draft: ContractTemplateRecord["draft"] }) { return sendJson<{ template: ContractTemplateRecord }>("/api/contract-templates", { method: "POST", body: JSON.stringify(input) }); }
export async function deleteAdminContractTemplate(templateId: string) { return sendJson<{ ok: boolean }>(`/api/contract-templates/${templateId}`, { method: "DELETE" }); }
export async function loadPendingPortalContractBySlug(slug: string) { const account=await findPortalAccountBySlug(slug); return fetchJson<{ contract: ContractRecord | null }>(`/api/portal/accounts/${account.clientAccountId}/contracts/pending`); }
export async function acceptPortalContractBySlug(slug: string, contractId: string) { const account=await findPortalAccountBySlug(slug); return sendJson<{ ok: true; contract: ContractRecord }>(`/api/portal/accounts/${account.clientAccountId}/contracts/${contractId}/accept`, { method: "POST" }); }
export async function listAdminProposals() { return fetchJson<{ items: ProposalRecord[] }>("/api/proposals"); }
export async function createAdminProposal(input: Omit<ProposalRecord, "id" | "token" | "acceptedAt" | "viewedAt" | "createdAt" | "updatedAt">) { return sendJson<{ proposal: ProposalRecord }>("/api/proposals", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAdminProposal(proposalId: string, input: Partial<Omit<ProposalRecord, "id" | "token" | "acceptedAt" | "viewedAt" | "createdAt" | "updatedAt">>) { return sendJson<{ proposal: ProposalRecord }>(`/api/proposals/${proposalId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function deleteAdminProposal(proposalId: string) { return sendJson<{ ok: boolean }>(`/api/proposals/${proposalId}`, { method: "DELETE" }); }
export async function loadPublicProposal(token: string) { return fetchJson<{ proposal: ProposalRecord }>(`/api/public/proposals/${encodeURIComponent(token)}`); }
export async function decidePublicProposal(token: string, status: "accepted" | "refused") { return sendJson<{ proposal: ProposalRecord }>(`/api/public/proposals/${encodeURIComponent(token)}/decision`, { method: "POST", body: JSON.stringify({ status }) }); }
export async function listAdminDesignBriefs() { return fetchJson<{ items: DesignBriefRecord[] }>("/api/design-briefs"); }
export async function createAdminDesignBrief(input: Omit<DesignBriefRecord, "id" | "submittedAt" | "createdAt" | "updatedAt">) { return sendJson<{ brief: DesignBriefRecord }>("/api/design-briefs", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAdminDesignBrief(briefId: string, input: Partial<Omit<DesignBriefRecord, "id" | "submittedAt" | "createdAt" | "updatedAt">>) { return sendJson<{ brief: DesignBriefRecord }>(`/api/design-briefs/${briefId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function deleteAdminDesignBrief(briefId: string) { return sendJson<{ ok: boolean }>(`/api/design-briefs/${briefId}`, { method: "DELETE" }); }
export async function listAdminDesignBriefTemplates() { return fetchJson<{ items: DesignBriefTemplateRecord[] }>("/api/design-brief-templates"); }
export async function createAdminDesignBriefTemplate(input: { name: string; introduction: string; fields: DesignBriefFieldRecord[] }) { return sendJson<{ template: DesignBriefTemplateRecord }>("/api/design-brief-templates", { method: "POST", body: JSON.stringify(input) }); }
export async function deleteAdminDesignBriefTemplate(templateId: string) { return sendJson<{ ok: boolean }>(`/api/design-brief-templates/${templateId}`, { method: "DELETE" }); }

export async function loadClientPortalBySlug(slug: string): Promise<ClientPortalPreview> {
  const matchedAccount = await findPortalAccountBySlug(slug);

  // The portal navigation is controlled by the home response. A temporary
  // board failure must not replace valid permissions with the restrictive
  // fallback (which only exposes the three default portal entries).
  const homeResponse = await fetchJson<ApiPortalHomeResponse>(
    `/api/portal/accounts/${matchedAccount.clientAccountId}/home`,
  );
  const boardResponse = await fetchJson<ApiPortalBoardResponse>(
    `/api/portal/accounts/${matchedAccount.clientAccountId}/board`,
  ).catch((): ApiPortalBoardResponse => ({
    board: { columns: [], withoutColumn: { cards: [] } },
  }));

  return {
    accountName: homeResponse.account.name,
    clientGreetingName: homeResponse.account.portalTitle || homeResponse.account.name,
    clientLogoUrl: homeResponse.account.logoUrl ?? null,
    locale: homeResponse.account.locale,
    accessLevel: homeResponse.accessLevel ?? "approver",
    trackingEnabled: homeResponse.account.trackingEnabled,
    showArchivedToClient: homeResponse.account.showArchivedToClient,
    widgets: homeResponse.widgets,
    permissions: homeResponse.permissions,
    boardColumns: mapColumns(boardResponse.board.columns),
    withoutColumn: boardResponse.board.withoutColumn.cards.map((card) => mapCard(card)),
    calendarEvents: [],
    upcomingItems: homeResponse.upcomingItems,
    calendarPosts: homeResponse.calendarPosts.map((card) => mapCard(card)),
  };
}

export async function loadPortalArchivedCardsBySlug(slug: string) {
  const account = await findPortalAccountBySlug(slug);
  const response = await fetchJson<ApiPortalBoardResponse>(`/api/portal/accounts/${account.clientAccountId}/board?archived=true`);
  return {
    columns: mapColumns(response.board.columns),
    withoutColumn: response.board.withoutColumn.cards.map((card) => mapCard(card)),
  };
}

export async function searchPortalCardsBySlug(slug: string, query: string) {
  const account = await findPortalAccountBySlug(slug);
  const response = await fetchJson<{ items: ApiBoardCard[] }>(`/api/portal/accounts/${account.clientAccountId}/search?q=${encodeURIComponent(query)}`);
  return { items: response.items.map((card) => mapCard(card)) };
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
    throw new Error(`Conta ${slug} não encontrada.`);
  }

  return matchedClient;
}

async function findPortalAccountBySlug(slug: string) {
  const accountsResponse = await getPortalAccounts();
  const matchedAccount = accountsResponse.items.find((item) => item.clientSlug === slug);

  if (!matchedAccount) {
    throw new Error(`Portal ${slug} não encontrado.`);
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

export async function reorderAdminColumnsBySlug(slug: string, orderedColumnIds: string[]) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/columns/reorder`, {
    method: "POST",
    body: JSON.stringify({ orderedColumnIds }),
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
    priorityLevel?: "high" | "medium" | "normal" | null;
  },
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; card: ApiBoardCard }>(`/api/clients/${matchedClient.id}/cards`, {
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
    priorityLevel: "high" | "medium" | "normal" | null;
  }>,
) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson(`/api/clients/${matchedClient.id}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listAdminCaptionVersionsBySlug(slug: string, cardId: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return fetchJson<{ items: CaptionVersion[] }>(`/api/clients/${matchedClient.id}/cards/${cardId}/caption-versions`);
}

export async function restoreAdminCaptionVersionBySlug(slug: string, cardId: string, versionId: string) {
  const matchedClient = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; card: ApiBoardCard; versions: CaptionVersion[] }>(`/api/clients/${matchedClient.id}/cards/${cardId}/caption-versions/${versionId}/restore`, { method: "POST" });
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

export async function loadActiveTimeEntry() {
  return fetchJson<{ entry: TimeEntry | null }>("/api/time-tracking/active");
}

export async function listTimeEntries(input: { from: string; to: string; clientAccountId?: string }) {
  const query = new URLSearchParams({ from: input.from, to: input.to });
  if (input.clientAccountId) query.set("clientAccountId", input.clientAccountId);
  return fetchJson<{ items: TimeEntry[] }>(`/api/time-tracking/entries?${query}`);
}

export async function startTimeEntry(input: { clientAccountId: string; cardId?: string | null; description?: string }) {
  return sendJson<{ entry: TimeEntry }>("/api/time-tracking/start", { method: "POST", body: JSON.stringify(input) });
}

export async function startCardTimeEntryBySlug(slug: string, cardId: string, description?: string) {
  const client = await findAdminClientBySlug(slug);
  return startTimeEntry({ clientAccountId: client.id, cardId, description });
}

export async function stopTimeEntry(entryId: string) {
  return sendJson<{ entry: TimeEntry }>(`/api/time-tracking/${entryId}/stop`, { method: "POST" });
}

export async function resumeTimeEntry(entryId: string) {
  return sendJson<{ entry: TimeEntry }>(`/api/time-tracking/${entryId}/resume`, { method: "POST" });
}

export async function clearTimeEntries(input: { from: string; to: string; clientAccountId?: string }) {
  const query = new URLSearchParams({ from: input.from, to: input.to });
  if (input.clientAccountId) query.set("clientAccountId", input.clientAccountId);
  return sendJson<{ ok: true; removed: number }>(`/api/time-tracking/entries?${query}`, { method: "DELETE" });
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
        portalAccessLevel: input.portalAccessLevel ?? "approver",
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

export async function loadClientAccessesBySlug(slug: string) {
  const client = await findAdminClientBySlug(slug);
  return loadClientAccesses(client.id);
}

export async function createClientPortalAccessBySlug(slug: string, input: { fullName: string; email: string; password: string; locale: string; portalAccessLevel: PortalAccessLevel }) {
  const client = await findAdminClientBySlug(slug);
  await createManagedClientUser({ ...input, clientAccountId: client.id });
  return loadClientAccesses(client.id);
}

export async function updateClientPortalAccessBySlug(slug: string, access: ClientAccess, portalAccessLevel: PortalAccessLevel) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; accesses: ClientAccess[] }>(`/api/clients/${client.id}/accesses`, {
    method: "POST",
    body: JSON.stringify({ userId: access.userId, membershipRole: "cliente", portalAccessLevel, isPrimary: access.isPrimary }),
  });
}

export async function removeClientAccessBySlug(slug: string, membershipId: string) {
  const client = await findAdminClientBySlug(slug);
  return sendJson<{ ok: true; accesses: ClientAccess[] }>(`/api/clients/${client.id}/accesses/${membershipId}`, { method: "DELETE" });
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
  return fetchJson<{ dueTasks: DashboardTask[]; upcomingPosts: DashboardUpcomingPost[]; postsToday: DashboardTodayPost[]; agendaToday: AgendaEvent[]; clientSubmissions: DashboardSubmission[]; clientActivities: DashboardClientActivity[] }>("/api/dashboard/overview");
}

export async function recordPortalContractAcceptance(slug: string, input: { sourceId: string; title: string; detail?: string }) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ ok: true }>(`/api/portal/accounts/${account.clientAccountId}/feedback-events`, { method: "POST", body: JSON.stringify({ sourceType: "contract", activityType: "contract_accepted", ...input }) });
}

export async function recordPublicProposalAcceptance(input: { sourceId: string; clientName: string; title: string; detail?: string }) {
  return sendJson<{ ok: true }>("/api/public/client-feedback-events", { method: "POST", body: JSON.stringify({ sourceType: "proposal", activityType: "proposal_accepted", ...input }) });
}

export async function loadAgendaEvents(from: string, to: string) { return fetchJson<{ items: AgendaEvent[] }>(`/api/agenda/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); }
export async function loadCalendarOverview(from: string, to: string) { const response = await fetchJson<ApiCalendarResponse & { meta?: { totalEvents?: number } }>(`/api/calendar/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); return { ...response, events: response.events.map(mapCalendarEvent) }; }
export async function loadAdminClientCalendarBySlug(slug: string, from: string, to: string) { const client = await findAdminClientBySlug(slug); const response = await fetchJson<ApiCalendarResponse>(`/api/clients/${client.id}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); return { clientAccountId: client.id, events: response.events.map(mapCalendarEvent) }; }
export async function loadAdminKanbanActivitiesBySlug(slug: string) { const client = await findAdminClientBySlug(slug); return fetchJson<{ items: KanbanActivity[] }>(`/api/clients/${client.id}/activities`); }
export async function loadBrandBrainBySlug(slug: string) { const client = await findAdminClientBySlug(slug); return fetchJson<BrandBrainSnapshot>(`/api/clients/${client.id}/brand-brain`); }
export async function saveBrandBrainBySlug(slug: string, data: BrandBrain, summary?: string) { const client = await findAdminClientBySlug(slug); return sendJson<{ ok: true; pending: boolean; version?: number; revision?: BrandBrainRevision }>(`/api/clients/${client.id}/brand-brain`, { method: "PUT", body: JSON.stringify({ data, summary }) }); }
export async function decideBrandBrainRevisionBySlug(slug: string, revisionId: string, approved: boolean) { const client = await findAdminClientBySlug(slug); return sendJson<{ ok: true; status: string; version: number | null }>(`/api/clients/${client.id}/brand-brain/revisions/${revisionId}/decision`, { method: "POST", body: JSON.stringify({ approved }) }); }
export async function addBrandBrainCommentBySlug(slug: string, input: { commentText: string; revisionId?: string | null; sectionKey?: string; isInternal?: boolean }) { const client = await findAdminClientBySlug(slug); return sendJson<{ ok: true }>(`/api/clients/${client.id}/brand-brain/comments`, { method: "POST", body: JSON.stringify(input) }); }
export async function loadPortalBrandBrainBySlug(slug: string) { const account = await findPortalAccountBySlug(slug); return fetchJson<BrandBrainSnapshot>(`/api/clients/${account.clientAccountId}/brand-brain`); }
export async function savePortalBrandBrainBySlug(slug: string, data: BrandBrain, summary?: string) { const account = await findPortalAccountBySlug(slug); return sendJson<{ ok: true; pending: boolean; revision?: BrandBrainRevision }>(`/api/clients/${account.clientAccountId}/brand-brain`, { method: "PUT", body: JSON.stringify({ data, summary }) }); }
export async function addPortalBrandBrainCommentBySlug(slug: string, input: { commentText: string; revisionId?: string | null; sectionKey?: string }) { const account = await findPortalAccountBySlug(slug); return sendJson<{ ok: true }>(`/api/clients/${account.clientAccountId}/brand-brain/comments`, { method: "POST", body: JSON.stringify(input) }); }
export async function createAgendaEvent(input: { title: string; taskDescription?: string | null; startsAt: string; endsAt?: string | null; color: string; clientAccountId?: string | null; labelId?: string | null; recurrenceType?: AgendaRecurrence; repeatUntil?: string | null; meetLink?: string | null }) { return sendJson<{ ok: true; id: string }>("/api/agenda/events", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAgendaEvent(eventId: string, input: Partial<{ title: string; taskDescription: string | null; startsAt: string; color: string; clientAccountId: string | null; labelId: string | null; recurrenceType: AgendaRecurrence; repeatUntil: string | null; meetLink: string | null; isCompleted: boolean }>) { return sendJson<{ ok: true }>(`/api/agenda/events/${eventId}`, { method: "PATCH", body: JSON.stringify(input) }); }
export async function listPortalAppointmentsBySlug(slug: string, from: string, to: string) {
  const account = await findPortalAccountBySlug(slug);
  return fetchJson<{ items: AgendaEvent[] }>(`/api/portal/accounts/${account.clientAccountId}/appointments?from=${from}&to=${to}`);
}
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
    throw new Error(payload?.message ?? "Não foi possível abrir este link de aprovação.");
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
    throw new Error(payload?.message ?? "Não foi possível registrar sua decisão.");
  }
  return response.json() as Promise<{ ok: true }>;
}

export async function uploadAdminMedia(file: File) {
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

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
    throw new Error(payload?.message ?? "Não foi possível enviar o arquivo.");
  }

  const result = (await response.json()) as { url: string };
  return result.url;
}

export async function uploadPortalMediaBySlug(slug: string, file: File) {
  const account = await findPortalAccountBySlug(slug);
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const body = new FormData();
  body.set("file", file);
  const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/portal/accounts/${account.clientAccountId}/uploads`, { method: "POST", headers, body });
  if (!response.ok) {
    if (response.status === 413) throw new Error("O arquivo excede o limite permitido para este formato.");
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Não foi possível enviar o arquivo.");
  }
  return ((await response.json()) as { url: string }).url;
}

export async function createPortalPostBySlug(slug: string, input: { title: string; caption?: string | null; commentText?: string | null; artType: string; externalLinkUrl?: string | null; mediaUrls: string[] }) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ ok: true; card: ApiBoardCard }>(`/api/portal/accounts/${account.clientAccountId}/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePortalCardCaptionBySlug(slug: string, cardId: string, caption: string | null) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ ok: true; card: ApiBoardCard }>(`/api/portal/accounts/${account.clientAccountId}/cards/${cardId}/caption`, {
    method: "PATCH",
    body: JSON.stringify({ caption }),
  });
}

export async function listPortalTagsBySlug(slug: string) {
  const account = await findPortalAccountBySlug(slug);
  return fetchJson<{ items: ClientTagDefinition[] }>(`/api/portal/accounts/${account.clientAccountId}/tags`);
}

export async function createPortalTagBySlug(slug: string, input: { name: string; color: string }) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ ok: true; tag: ClientTagDefinition }>(`/api/portal/accounts/${account.clientAccountId}/tags`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePortalCardTagsBySlug(slug: string, cardId: string, tags: string[]) {
  const account = await findPortalAccountBySlug(slug);
  return sendJson<{ ok: true; card: ApiBoardCard }>(`/api/portal/accounts/${account.clientAccountId}/cards/${cardId}/tags`, {
    method: "PATCH",
    body: JSON.stringify({ tags }),
  });
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
