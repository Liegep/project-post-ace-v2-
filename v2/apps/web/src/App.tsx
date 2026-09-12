import { PortalAccountPicker } from "./PortalAccountPicker";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { zipSync } from "fflate";
import webPackage from "../package.json";
import { CardTimeTracker, TimeTrackingWorkspace } from "./TimeTrackingWorkspace";
import {
  addAdminCardCommentBySlug,
  addPortalCardCommentBySlug,
  createAdminColumnBySlug,
  createAdminCardBySlug,
  deleteAdminColumnBySlug,
  deleteAdminCardBySlug,
  loadAdminCardDetailBySlug,
  loadAdminWorkspaceBySlug,
  loadClientPortalBySlug,
  loadPortalCardDetailBySlug,
  loadPortalArchivedCardsBySlug,
  searchPortalCardsBySlug,
  submitAdminCardDecisionBySlug,
  submitPortalCardDecisionBySlug,
  updateAdminColumnBySlug,
  updateAdminCardBySlug,
  listAdminCaptionVersionsBySlug,
  restoreAdminCaptionVersionBySlug,
  type CaptionVersion,
  createAdminApprovalLinkBySlug,
  moveAdminCardBySlug,
  reorderAdminColumnsBySlug,
  archiveAdminCardBySlug,
  setAdminCardArchivedBySlug,
  listAdminClients,
  createAdminClient,
  updateAdminClient,
  deleteAdminClient,
  createManagedClientUser,
  createManagedUser,
  loadClientAccesses,
  loadClientAccessesBySlug,
  createClientPortalAccessBySlug,
  updateClientPortalAccessBySlug,
  removeClientAccessBySlug,
  listManagedUsers,
  updateManagedUser,
  deactivateManagedUser,
  resetManagedUserPassword,
  shareClientWithMember,
  loadPublicApproval,
  submitPublicApproval,
  createAdminTagBySlug,
  listAdminTagsBySlug,
  type ClientTagDefinition,
  createAdminHashtagGroupBySlug,
  deleteAdminHashtagGroupBySlug,
  listAdminHashtagGroupsBySlug,
  type HashtagGroup,
  loadDashboardOverview,
  loadDashboardNotes,
  createDashboardNote,
  updateDashboardNote,
  deleteDashboardNote,
  type DashboardNote,
  type DashboardNoteColor,
  listAdminProposals,
  createAdminProposal,
  updateAdminProposal,
  deleteAdminProposal,
  loadPublicProposal,
  decidePublicProposal,
  type ProposalRecord,
  listAdminDesignBriefs,
  createAdminDesignBrief,
  updateAdminDesignBrief,
  deleteAdminDesignBrief,
  listAdminDesignBriefTemplates,
  createAdminDesignBriefTemplate,
  deleteAdminDesignBriefTemplate,
  type DesignBriefFieldRecord,
  type DesignBriefRecord,
  type DesignBriefTemplateRecord,
  type DashboardSubmission,
  type DashboardClientActivity,
  type DashboardUpcomingPost,
  type DashboardTodayPost,
  type DashboardApprovedPauta,
  type AgendaEvent,
  type AgendaLabel,
  type AgendaRecurrence,
  createAgendaEvent,
  updateAgendaEvent,
  deleteAgendaEvent,
  loadAgendaEvents,
  loadCalendarOverview,
  loadAdminClientCalendarBySlug,
  loadAdminKanbanActivitiesBySlug,
  type KanbanActivity,
  loadBrandBrainBySlug,
  saveBrandBrainBySlug,
  decideBrandBrainRevisionBySlug,
  addBrandBrainCommentBySlug,
  loadPortalBrandBrainBySlug,
  savePortalBrandBrainBySlug,
  addPortalBrandBrainCommentBySlug,
  type BrandBrain,
  type BrandBrainSnapshot,
  createAgendaLabel,
  deleteAgendaLabel,
  loadAgendaLabels,
  type AdminClientOption,
  type ClientAccess,
  type PortalAccessLevel,
  type ManagedUser,
  type ClientTrackerSettings,
  uploadAdminMedia,
  uploadPortalMediaBySlug,
  createPortalPostBySlug,
  updatePortalCardCaptionBySlug,
  listPortalTagsBySlug,
  createPortalTagBySlug,
  updatePortalCardTagsBySlug,
  loadAdminWorkspaceDrawerBySlug,
  saveAdminWorkspaceDrawerBySlug,
  loadAdminGlobalQuickLinks,
  saveAdminGlobalQuickLinks,
  loadAdminKanbanAutomationsBySlug,
  saveAdminKanbanAutomationsBySlug,
  loadAdminTrackerSettingsBySlug,
  saveAdminTrackerSettingsBySlug,
  updateMyProfile,
  changeMyPassword,
  addAdminTextCommentBySlug,
  createAdminTextBySlug,
  deleteAdminTextBySlug,
  listAdminTextCommentsBySlug,
  listAdminTextsBySlug,
  sendAdminTextToClientBySlug,
  updateAdminTextBySlug,
  listPortalTextsBySlug,
  updatePortalTextBySlug,
  listPortalTextCommentsBySlug,
  addPortalTextCommentBySlug,
  submitPortalTextDecisionBySlug,
  listPortalAppointmentsBySlug,
  listPortalReportsBySlug,
  listPortalInvoicesBySlug,
  listAdminContracts,
  createAdminContract,
  listAdminContractTemplates,
  createAdminContractTemplate,
  loadPendingPortalContractBySlug,
  acceptPortalContractBySlug,
  type ContractRecord as ApiContractRecord,
  type TextComment,
  type TextDocument,
  type TextTag,
} from "./api";
import { ACCESS_TOKEN_KEY, completePasswordResetWithApi, loginWithApi, requestPasswordResetWithApi, restoreApiSession } from "./authApi";
import { demoUsers } from "./mockData";
import type {
  AdminWorkspacePreview,
  BoardCard,
  BoardColumn,
  CardPriority,
  CardDetail,
  CalendarEvent,
  ClientPortalPreview,
  SessionUser,
} from "./types";

function normalizeTextTags(tags: unknown): TextTag[] {
  if (!Array.isArray(tags)) return [];
  return tags.flatMap((tag) => typeof tag === "string" && tag.trim()
    ? [{ name: tag.trim(), color: "#7568dc" }]
    : tag && typeof tag === "object" && "name" in tag && typeof tag.name === "string"
      ? [{ name: tag.name, color: "color" in tag && typeof tag.color === "string" ? tag.color : "#7568dc" }]
      : []);
}
import { usePreviewResource } from "./usePreviewResource";
import { PortalReports, ReportsWorkspace } from "./ReportsWorkspace";
import { BILLING_PENDING_LINE_KEY, BillingInvoiceDocument, BillingWorkspace, formatBillingDate, formatBillingMoney, getBillingInvoiceTotal, type BillingInvoice, type BillingLineRequest } from "./BillingWorkspace";
import liegePaschoaliniLogo from "./assets/liege-paschoalini-logo.png";
import designHubV2Logo from "./assets/design-hub-v2-logo.png";
import { normalizePortalLocale, portalLocaleTag, portalText, type PortalLocale } from "./portalI18n";

const SESSION_KEY = "designhub-v2-session";
const DEV_USER_ID_KEY = "designhub-v2-dev-user-id";
const MAX_MEDIA_FILE_SIZE = 12 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 20 * 1024 * 1024;
const PortalLocaleContext = createContext<PortalLocale>("pt");
function usePortalTranslation() {
  const locale = useContext(PortalLocaleContext);
  return { locale, localeTag: portalLocaleTag(locale), t: (source: string) => portalText(locale, source) };
}
const CARD_STATUS_OPTIONS = [
  "Entrada",
  "Em Desenvolvimento",
  "Escrevendo Legenda",
  "Design Pronto",
  "Enviar para Cliente",
  "Aprovado pela boss ❤️",
  "Finalizado",
  "Alteração Solicitada",
  "Agendado",
];
const ART_TYPE_OPTIONS = ["Post único", "Carrossel", "Reels", "Story", "Logotipo", "Cartão de visita", "Texto", "Outros"];
type ClientForm = {
  name: string; slug: string; locale: string; email: string; password: string;
  greetingName: string;
  instagram: string; facebook: string; tiktok: string; youtube: string; linkedin: string; x: string; website: string;
};
type EditClientForm = ClientForm & { portalTitle: string; clientUserId: string };
type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error" | "recovered";

function readRecoveryDraft<T>(key: string): T | null {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function AutosaveIndicator({ state, savedAt, savedLabel = "Salvo" }: { state: AutosaveState; savedAt?: Date | null; savedLabel?: string }) {
  const label = state === "pending" ? "Alterações pendentes"
    : state === "saving" ? "Salvando…"
      : state === "error" ? "Não foi possível salvar"
        : state === "recovered" ? "Rascunho recuperado"
          : state === "saved" && savedAt ? `${savedLabel} às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : "Tudo salvo";
  return <span className={`autosave-indicator is-${state}`} role="status" aria-live="polite"><i />{label}</span>;
}

function normalizeArtType(value: string) {
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (normalized.includes("carrossel") || normalized.includes("carousel")) return "Carrossel";
  if (normalized.includes("reel")) return "Reels";
  if (normalized.includes("story")) return "Story";
  if (normalized.includes("logo")) return "Logotipo";
  if (normalized.includes("cart")) return "Cartão de visita";
  if (normalized.includes("texto")) return "Texto";
  if (normalized.includes("post")) return "Post único";
  return ART_TYPE_OPTIONS.includes(value) ? value : "Outros";
}

function compactArtTypeLabel(value: string) {
  const normalized = normalizeArtType(value);
  return normalized === "Post único" ? "Único" : normalized;
}

function cardStatusLabel(value: string) {
  if (!value.includes("_")) return value;
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  const legacyLabels: Record<string, string> = {
    aprovado_boss: "Aprovado pela boss",
    alteracao_solicitada: "Alteração solicitada",
    changes_requested: "Alteração solicitada",
    design_finalizado: "Design finalizado",
    em_aprovacao: "Em aprovação",
    em_desenvolvimento: "Em desenvolvimento",
    enviar_para_cliente: "Enviar para cliente",
    in_review: "Em revisão",
    legenda_aprovada: "Legenda aprovada",
    legenda_pronta: "Legenda pronta",
    not_approved: "Não aprovado",
    single_post: "Post único",
  };
  if (legacyLabels[normalized]) return legacyLabels[normalized];
  const readable = value.trim().replace(/_+/g, " ").replace(/\s+/g, " ");
  return readable.charAt(0).toLocaleUpperCase("pt-BR") + readable.slice(1);
}

function cardTagColor(value: string, color?: string) {
  const normalized = value.trim().toLocaleLowerCase("pt-BR").replace(/[_\s-]+/g, "_");
  if (normalized === "alterado" || normalized === "alteracao_solicitada" || normalized === "changes_requested") return "#ef3340";
  return color || "#8263e8";
}

function formatScheduledCardDate(value: string) {
  // Preserve the stored wall-clock time while presenting a concise, localized label.
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) return `Agendado: ${match[3]}/${match[2]} às ${match[4]}:${match[5]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agendado";
  return `Agendado: ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(",", " às")}`;
}

function formatCalendarSchedule(date: string, time?: string | null) {
  const parsed = new Date(date);
  const formattedDate = Number.isNaN(parsed.getTime())
    ? date.slice(0, 10).split("-").reverse().join("/")
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(parsed);
  return `Agendado: ${formattedDate} às ${time?.slice(0, 5) ?? "--:--"}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function statusTone(status: string) {
  const normalized = status.toLocaleLowerCase("pt-BR");
  if (/(aprov|finaliz|pronto|public)/.test(normalized)) return "approved";
  if (/(pend|rascunho|aguard)/.test(normalized)) return "pending";
  return "progress";
}

const emptyAdminWorkspace: AdminWorkspacePreview = {
  clientName: "",
  clientSlug: "",
  accountSwitcher: [],
  columns: [],
  withoutColumn: [],
  calendarEvents: [],
  drawerNotes: [],
  quickLinks: [],
  quickApps: [],
  trackingItems: [],
  tagDefinitions: [],
};

const emptyClientPortal: ClientPortalPreview = {
  accountName: "",
  locale: "",
  accessLevel: "approver",
  trackingEnabled: false,
  showArchivedToClient: false,
  widgets: {
    upcomingPosts: false,
    tracking: false,
    invoices: false,
    reports: false,
    brandBrain: false,
    search: false,
    texts: false,
  },
  permissions: {
    allowClientEditCaption: false,
    allowClientCreatePost: false,
    allowClientCreateTags: false,
    allowClientDownload: false,
    allowClientEditBrandBrain: false,
    allowClientSearch: false,
    allowClientViewTexts: true,
    allowClientViewInvoices: false,
    allowClientViewReports: false,
    allowClientViewBrandBrain: false,
    allowClientViewTracking: false,
  },
  boardColumns: [],
  postCreationColumns: [],
  withoutColumn: [],
  calendarEvents: [],
  calendarPosts: [],
  upcomingItems: [],
};

function readStoredSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function readStoredAccessToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim() ?? "";
}

function persistSession(session: SessionUser | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(DEV_USER_ID_KEY);
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.source === "api" && session.accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    window.localStorage.removeItem(DEV_USER_ID_KEY);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.setItem(DEV_USER_ID_KEY, session.id);
}

function roleLabel(role: SessionUser["role"]) {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "admin":
      return "Admin";
    case "collaborator":
      return "Colaborador";
    case "client":
      return "Cliente";
    default:
      return role;
  }
}

function getDefaultRoute(session: SessionUser | null) {
  if (!session) return "/login";
  if (session.role === "client") {
    if (new Set(session.assignedPortalSlugs).size !== 1) return "/contas";
    return `/portal/${encodeURIComponent(session.assignedPortalSlugs[0])}`;
  }
  return "/dashboard";
}

function canAccessAdmin(session: SessionUser, slug: string) {
  if (session.role === "client") return false;
  if (session.role === "super_admin") return true;
  return session.assignedAdminSlugs.includes(slug);
}

function canAccessPortal(session: SessionUser, slug: string) {
  if (session.role !== "client") return true;
  return session.assignedPortalSlugs.includes(slug);
}

function AppHeader({
  session,
  onLogout,
}: {
  session: SessionUser | null;
  onLogout: () => void;
}) {
  return (
    <header className="topbar glass">
      <div className="brand-lockup">
        <div className="brand-badge"><img src={designHubV2Logo} alt="Design Hub" /></div>
        <div>
          <p className="eyebrow">Preview local da V2</p>
          <h1>Design Hub</h1>
        </div>
      </div>

      <nav className="topnav">
        {session ? (
          <>
            {session.role !== "client" ? (
              <NavLink
                to={`/admin/${session.assignedAdminSlugs[0] ?? "aplikasi"}`}
                className={({ isActive }) => navClass(isActive)}
              >
                Area admin
              </NavLink>
            ) : null}
            <NavLink
              to={`/portal/${session.assignedPortalSlugs[0] ?? "serena-genovese"}`}
              className={({ isActive }) => navClass(isActive)}
            >
              Area do cliente
            </NavLink>
            <div className="session-chip">
              <div>
                <strong>{session.name}</strong>
                <span>{roleLabel(session.role)}</span>
              </div>
              <button className="ghost-button compact-button" onClick={onLogout}>
                Sair
              </button>
            </div>
          </>
        ) : (
          <NavLink to="/login" className={({ isActive }) => navClass(isActive)}>
            Entrar
          </NavLink>
        )}
      </nav>
    </header>
  );
}

function navClass(isActive: boolean) {
  return isActive ? "topnav-link active" : "topnav-link";
}

type PageMetric = { label: string; value: string | number; note: string; icon: ReactNode; tone?: string };

function WorkspaceNavbar({ session, onLogout, clientKanban = false, workspaceContext, utilityAction }: { session: SessionUser; onLogout: () => void; clientKanban?: boolean; workspaceContext?: ReactNode; utilityAction?: ReactNode }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messages, setMessages] = useState<InternalApprovalRecord[]>(() => loadInternalApprovalMessages(session.id));
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => { try { return JSON.parse(window.localStorage.getItem(`designhub-v2-read-notifications:${session.id}`) ?? "[]") as string[]; } catch { return []; } });
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const unreadMessages = messages.filter((item) => !readNotificationIds.includes(item.id));
  useEffect(() => { const sync = () => { setMessages(loadInternalApprovalMessages(session.id)); try { setReadNotificationIds(JSON.parse(window.localStorage.getItem(`designhub-v2-read-notifications:${session.id}`) ?? "[]") as string[]); } catch { setReadNotificationIds([]); } }; window.addEventListener("storage", sync); const timer = window.setInterval(sync, 5_000); return () => { window.removeEventListener("storage", sync); window.clearInterval(timer); }; }, [session.id]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!notificationMenuRef.current?.contains(event.target as Node)) setNotificationsOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setNotificationsOpen(false); }; document.addEventListener("mousedown", close); document.addEventListener("keydown", escape); return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); }; }, []);
  const markNotificationRead = (id: string) => { setReadNotificationIds((current) => { if (current.includes(id)) return current; const next = [...current, id]; window.localStorage.setItem(`designhub-v2-read-notifications:${session.id}`, JSON.stringify(next)); return next; }); };
  return <div className={`dashboard-nav workspace-navbar${clientKanban ? " client-kanban-navbar" : ""}`}>
    {!clientKanban ? <NavLink to="/dashboard" className="dashboard-nav-brand" aria-label="Abrir dashboard"><span className="brand-badge"><img src={designHubV2Logo} alt="Design Hub" /></span><strong>Design Hub</strong></NavLink> : null}
    {workspaceContext}
    <div className="dashboard-user">{utilityAction}<div className="notification-menu" ref={notificationMenuRef}><button className={`dashboard-icon-button ${unreadMessages.length ? "has-notification" : ""}`} type="button" aria-label="Notificações" onClick={() => setNotificationsOpen((open) => !open)}><UiIcon name="bell" />{unreadMessages.length ? <span aria-hidden="true">{unreadMessages.length > 9 ? "9+" : unreadMessages.length}</span> : null}</button>{notificationsOpen ? <div className="notification-popover"><header><strong>Notificações</strong><b>{unreadMessages.length}</b></header>{messages.length ? messages.slice(0, 5).map((item) => <button key={item.id} className={readNotificationIds.includes(item.id) ? "read" : ""} onClick={() => { markNotificationRead(item.id); if (item.clientSlug) window.location.hash = `/admin/${item.clientSlug}`; setNotificationsOpen(false); }}><span>♙</span><div><strong>{readNotificationIds.includes(item.id) ? "Aprovação interna" : "Nova aprovação interna"}</strong><small>{item.cardTitle}</small></div></button>) : <p>Nenhuma notificação nova.</p>}</div> : null}</div><ProfileMenu session={session} onLogout={onLogout} /></div>
  </div>;
}

function PageContextBanner({ eyebrow, title, description, metrics, action, titleClassName, titleIcon }: { eyebrow: string; title: ReactNode; description: string; metrics: PageMetric[]; action?: ReactNode; titleClassName?: string; titleIcon?: ReactNode }) {
  return <section className="page-context-banner">
    <div className="page-context-copy"><p className="eyebrow">{eyebrow}</p><div className={`page-context-title${titleClassName ? ` ${titleClassName}` : ""}`}>{titleIcon}{title}</div><p>{description}</p></div>
    <div className="page-context-aside"><div className="dashboard-orbs page-context-orbs" aria-hidden="true"><i /><i /><i /></div><div className="dashboard-metrics dashboard-metrics-inline">{metrics.map((metric) => <article className={metric.tone ?? ""} key={metric.label}>{metric.icon}<div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div></article>)}</div>{action}</div>
  </section>;
}

function WorkspaceSelector({ clientName, slug, options }: { clientName: string; slug: string; options: AdminClientOption[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const currentClient = options.find((client) => client.slug === slug);
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const setSelectorOpen = (next: boolean) => {
    setOpen(next);
  };

  return <div className="workspace-selector workspace-selector-banner">
    <button className="workspace-chip glass-subtle" onClick={() => setSelectorOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
      <div className="workspace-avatar">{initials(clientName)}{currentClient?.logo_url ? <img src={currentClient.logo_url} alt={`Logo ${clientName}`} onError={(event) => event.currentTarget.remove()} /> : null}</div>
      <div className="workspace-copy"><strong>{clientName}</strong><span>Workspace atual</span></div>
      <UiIcon name="chevron-down" className="workspace-caret" />
    </button>
    {open ? <div className="workspace-selector-menu" role="listbox">{options.length ? options.map((client) => {
      const isCurrentClient = client.slug === slug;
      return <button key={client.id} className={isCurrentClient ? "selected" : ""} onClick={() => { setSelectorOpen(false); navigate(isCurrentClient ? `/portal/${client.slug}` : `/admin/${client.slug}`); }} title={isCurrentClient ? "Abrir área do cliente" : "Abrir Kanban deste cliente"}>
        <span>{initials(client.name)}{client.logo_url ? <img src={client.logo_url} alt="" onError={(event) => event.currentTarget.remove()} /> : null}</span><strong>{client.name}</strong>{isCurrentClient ? <em>Ver área do cliente</em> : null}
      </button>;
    }) : <p>Nenhum outro cliente disponível.</p>}</div> : null}
  </div>;
}

function UiIcon({
  name,
  className,
}: {
  name:
    | "plus"
    | "grid"
    | "layers"
    | "file"
    | "download"
    | "calendar"
    | "users"
    | "clock"
    | "check"
    | "spark"
    | "help"
    | "chevron-left"
    | "filter"
    | "search"
    | "tag"
    | "image"
    | "inbox"
    | "comment"
    | "eye"
    | "bell"
    | "chevron-down"
    | "more"
    | "trash"
    | "pencil"
    | "receipt"
    | "brush"
    | "chevron-right"
    | "send"
    | "copy"
    | "link"
    | "lightbulb"
    | "settings";
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 4 4 8l8 4 8-4-8-4Z" />
          <path d="m4 12 8 4 8-4" />
          <path d="m4 16 8 4 8-4" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20" />
          <path d="M16 5.5a3 3 0 0 1 0 5.7M20.5 20v-1.5a5.5 5.5 0 0 0-3.4-5.1" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12 2.3 2.3 4.7-5" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
          <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9a3 3 0 1 1 5 2.2c-.8.6-1.2 1-1.2 2" />
          <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 5h16l-6 7v6l-4 1v-7L4 5Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M20 12 12 20 4 12l8-8h6l2 2v6Z" />
          <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" stroke="none" />
          <path d="m6 16 4-4 3 3 3-4 2 5" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" />
          <path d="M4 13h4l2 3h4l2-3h4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3" />
          <path d="M6 7l1 13h10l1-13" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="m4 20 4.1-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          <path d="m13.5 7.5 3 3" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3h12v18H6z" />
          <path d="M9 8h6M9 12h6M10 16h4" />
          <path d="M8 3v2M16 3v2" />
        </svg>
      );
    case "brush":
      return (
        <svg {...common}>
          <path d="m14.5 4.5 5 5-9.7 9.7a3.5 3.5 0 0 1-5 0l-.3-.3a3.5 3.5 0 0 1 0-5Z" />
          <path d="m12.2 6.8 5 5" />
          <path d="M4 20c2.3 0 3.6-.8 4-2.4" />
        </svg>
      );
    case "chevron-right":
      return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case "send":
      return (
        <svg {...common}>
          <path d="m21 3-7.4 18-3.9-7.7L2 9.4 21 3Z" />
          <path d="m9.7 13.3 4-4" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
        </svg>
      );
    case "link":
      return <svg {...common}><path d="M10 13.5 14 9.5" /><path d="m8.2 16.2-1.4 1.4a3.2 3.2 0 0 1-4.5-4.5l3.1-3.1a3.2 3.2 0 0 1 4.5 0" /><path d="m15.8 7.8 1.4-1.4a3.2 3.2 0 0 1 4.5 4.5l-3.1 3.1a3.2 3.2 0 0 1-4.5 0" /></svg>;
    case "lightbulb":
      return <svg {...common}><path d="M9 18h6M10 21h4" /><path d="M8.2 15.3A6.5 6.5 0 1 1 15.8 15c-.7.6-1.1 1.4-1.2 2.3H9.4c-.1-.8-.5-1.5-1.2-2Z" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-2.1 2.1-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65v.08h-3v-.08a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.05.05-2.1-2.1.05-.05A1.8 1.8 0 0 0 6.8 15a1.8 1.8 0 0 0-1.65-1.08h-.08v-3h.08A1.8 1.8 0 0 0 6.8 9.84a1.8 1.8 0 0 0-.36-1.98l-.05-.05 2.1-2.1.05.05a1.8 1.8 0 0 0 1.98.36 1.8 1.8 0 0 0 1.08-1.65v-.08h3v.08a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.05-.05 2.1 2.1-.05.05a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.08h.08v3h-.08A1.8 1.8 0 0 0 19.4 15Z" /></svg>;
    case "comment":
      return (
        <svg {...common}>
          <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M15 17H9l-1-2V11a4 4 0 1 1 8 0v4l-1 2Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function Sidebar({ session }: { session: SessionUser }) {
  const items = [
    "Dashboard",
    "Equipe",
    "Social",
    "Ideias de pauta",
    "Calendário",
    "Pautas",
    "Relatórios",
    "Faturamento",
    session.role === "super_admin" ? "Visão global" : "Espaco pessoal",
  ];

  return (
    <aside className="sidebar glass">
      <div className="sidebar-title">Workspace</div>
      <div className="sidebar-group">
        {items.map((item, index) => (
          <button key={item} className={index === 0 ? "sidebar-item active" : "sidebar-item"}>
            {item}
          </button>
        ))}
      </div>
      <p className="sidebar-hint">
        {session.role === "super_admin"
          ? "Controle total da operação."
          : session.role === "admin"
            ? "Acesso aos clientes atribuídos e páginas pessoais."
            : "Acesso apenas aos clientes atribuídos e sem criação de clientes."}
      </p>
    </aside>
  );
}

function AdminRail({ session, onCreateClient }: { session: SessionUser; onCreateClient?: () => void }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("designhub-v2-admin-rail-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const items = [
    { icon: "grid" as const, to: "/dashboard", label: "Dashboard" },
    { icon: "file" as const, to: "/area/relatorios", label: "Relatórios" },
    { icon: "clock" as const, to: "/area/controle-de-tempo", label: "Controle de tempo" },
    ...(session.role === "super_admin" || session.role === "admin" ? [
      { icon: "receipt" as const, to: "/area/faturamento", label: "Faturamento" },
      { icon: "send" as const, to: "/area/propostas", label: "Propostas" },
      { icon: "check" as const, to: "/area/contratos", label: "Contratos" },
    ] : []),
    { icon: "spark" as const, to: "/area/datas-comemorativas", label: "Datas comemorativas" },
    { icon: "brush" as const, to: "/area/briefs-design", label: "Briefs de design" },
    { icon: "calendar" as const, to: "/area/calendario-social", label: "Calendário social" },
    { icon: "users" as const, to: "/area/equipe", label: "Equipe" },
  ];

  const toggleRail = () => {
    setIsCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("designhub-v2-admin-rail-collapsed", next ? "1" : "0");
      } catch {
        // The control still works when browser storage is unavailable.
      }
      return next;
    });
  };

  useEffect(() => {
    if (!aboutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAboutOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [aboutOpen]);

  return (
    <><aside className={isCollapsed ? "admin-rail glass collapsed" : "admin-rail glass"}>
      <div className="admin-rail-stack">
        {items.map((item) => (
          (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => isActive ? "admin-rail-button active" : "admin-rail-button"}
              aria-label={`Ir para ${item.label}`}
              title={item.label}
            >
              <UiIcon name={item.icon} className="admin-rail-glyph" />
            </NavLink>
          )
        ))}
        {session.role === "super_admin" || session.role === "admin" ? (
          onCreateClient ? <button
            type="button"
            className="admin-rail-button admin-rail-create-client"
            onClick={onCreateClient}
            aria-label="Adicionar novo cliente"
            title="Adicionar novo cliente"
          ><UiIcon name="plus" className="admin-rail-glyph" /></button> : <NavLink
            to="/dashboard?createClient=1"
            className="admin-rail-button admin-rail-create-client"
            aria-label="Adicionar novo cliente"
            title="Adicionar novo cliente"
          ><UiIcon name="plus" className="admin-rail-glyph" /></NavLink>
        ) : null}
        <button
          type="button"
          className={aboutOpen ? "admin-rail-button active" : "admin-rail-button"}
          onClick={() => setAboutOpen(true)}
          aria-label="Abrir Sobre"
          title="Sobre"
        ><UiIcon name="help" className="admin-rail-glyph" /></button>
      </div>
      <div className="admin-rail-foot">
        <button
          type="button"
          className="admin-rail-button admin-rail-toggle"
          onClick={toggleRail}
          aria-label={isCollapsed ? "Abrir barra lateral" : "Recolher barra lateral"}
          title={isCollapsed ? "Abrir barra lateral" : "Recolher barra lateral"}
          aria-expanded={!isCollapsed}
        >
          <UiIcon name="chevron-left" className="admin-rail-glyph" />
        </button>
      </div>
    </aside>{aboutOpen ? createPortal(<div className="modal-backdrop about-modal-backdrop" onClick={() => setAboutOpen(false)}><section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-modal-title" onClick={(event) => event.stopPropagation()}><button className="icon-close about-modal-close" aria-label="Fechar Sobre" onClick={() => setAboutOpen(false)}>×</button><AboutWorkspace compact titleId="about-modal-title" /></section></div>, document.body) : null}</>
  );
}

function AgendaTopNavigation({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  return <WorkspaceNavbar session={session} onLogout={onLogout} />;
}

function AdminUtilityBar() {
  const items = [
    { label: "Filtros", icon: "filter" as const },
    { label: "Buscar", icon: "search" as const },
    { label: "Etiquetas", icon: "tag" as const },
    { label: "Mídia", icon: "image" as const },
    { label: "Bandeja", icon: "inbox" as const },
  ];

  return (
    <aside className="admin-utility-bar">
      <button className="admin-utility-collapse">
        <UiIcon name="chevron-left" className="admin-utility-glyph" />
      </button>
      {items.map((item) => (
        <button key={item.label} className="admin-utility-item">
          <span className="admin-utility-icon">
            <UiIcon name={item.icon} className="admin-utility-glyph" />
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  );
}

type DrawerLink = { id: string; type: "heading" | "link"; title: string; url?: string };
type DrawerAttachment = { type: "link" | "image" | "video" | "pdf"; url: string; name: string };
type DrawerDraft = { id: string; text: string; attachmentUrl?: string; createdAt?: string; color?: string };
type DrawerNote = { id: string; text: string; createdAt: string; color: string; authorName?: string; attachments?: DrawerAttachment[] };
type PautaIdea = { id: string; title: string; description: string; caption: string; createdAt: string; updatedAt?: string; plannedDate?: string | null; contentType?: string; internalNotes?: string; mediaUrls?: string[]; status?: "draft" | "sent" | "approved"; cardId?: string };
type WorkspaceDrawerData = { notes: DrawerNote[]; links: DrawerLink[]; quick: DrawerLink[]; draftsByUser: Record<string, DrawerDraft[]>; pautaIdeas: PautaIdea[] };
type KanbanAutomation = { id: string; name: string; enabled: boolean; triggerType: "tag_added" | "column_moved"; triggerValue: string; actionType: "add_tag" | "move_column" | "change_color"; actionValue: string };

const EMPTY_DRAWER: WorkspaceDrawerData = { notes: [], links: [], quick: [], draftsByUser: {}, pautaIdeas: [] };
const DEFAULT_DRAWER_NOTE_COLOR = "#fff6cf";
const DRAWER_NOTE_COLORS = [
  { value: "#fff6cf", label: "Amarelo" },
  { value: "#dff5ff", label: "Azul" },
  { value: "#e2f7e9", label: "Verde" },
  { value: "#f0e7ff", label: "Lilás" },
  { value: "#ffe5ec", label: "Rosa" },
  { value: "#f0f2f6", label: "Cinza" },
];

function normalizeDrawerNotes(value: unknown): DrawerNote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === "string") return [{ id: `legacy-note-${index}`, text: item, createdAt: "", color: DEFAULT_DRAWER_NOTE_COLOR }];
    if (!item || typeof item !== "object") return [];
    const note = item as Partial<DrawerNote>;
    if (typeof note.text !== "string" || !note.text.trim()) return [];
    return [{
      id: typeof note.id === "string" && note.id ? note.id : `legacy-note-${index}`,
      text: note.text,
      createdAt: typeof note.createdAt === "string" ? note.createdAt : "",
      color: typeof note.color === "string" && note.color ? note.color : DEFAULT_DRAWER_NOTE_COLOR,
      authorName: typeof note.authorName === "string" ? note.authorName : undefined,
      attachments: Array.isArray(note.attachments) ? note.attachments.flatMap((attachment) => {
        if (!attachment || typeof attachment !== "object") return [];
        const item = attachment as Partial<DrawerAttachment>;
        if (typeof item.url !== "string" || !item.url) return [];
        return [{ type: ["image", "video", "pdf"].includes(String(item.type)) ? item.type as DrawerAttachment["type"] : "link", url: item.url, name: typeof item.name === "string" && item.name ? item.name : "Anexo" }];
      }) : [],
    }];
  });
}

function normalizeDrawerDrafts(value: unknown): Record<string, DrawerDraft[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([userId, items]) => [userId, Array.isArray(items) ? items.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const draft = item as Partial<DrawerDraft>;
    if (typeof draft.text !== "string" || !draft.text.trim()) return [];
    return [{ id: typeof draft.id === "string" && draft.id ? draft.id : `legacy-draft-${index}`, text: draft.text, attachmentUrl: typeof draft.attachmentUrl === "string" ? draft.attachmentUrl : undefined, createdAt: typeof draft.createdAt === "string" ? draft.createdAt : undefined, color: typeof draft.color === "string" ? draft.color : undefined }];
  }) : []]));
}

function WorkspaceDrawer({ slug, userId, initialQuickLinks, columns, tags, canManageAccess, onPautaCountChange }: { slug: string; userId: string; initialQuickLinks: Array<{ label: string; href: string }>; columns: BoardColumn[]; tags: ClientTagDefinition[]; canManageAccess: boolean; onPautaCountChange?: (count: number) => void }) {
  const [tab, setTab] = useState<"notes" | "drafts" | "links" | "quick" | "ideas" | "tracker" | "progress">("quick");
  const [isOpen, setIsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState<WorkspaceDrawerData>(EMPTY_DRAWER);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [noteColor, setNoteColor] = useState(DEFAULT_DRAWER_NOTE_COLOR);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [trackerFilterOpen, setTrackerFilterOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automations, setAutomations] = useState<KanbanAutomation[]>([]);
  const [trackingActive, setTrackingActive] = useState(false);
  const [ideaFormOpen, setIdeaFormOpen] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [ideaCaption, setIdeaCaption] = useState("");
  const [ideaSaved, setIdeaSaved] = useState(false);
  useEffect(() => {
    if (!isOpen && !mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); setMobileMenuOpen(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, mobileMenuOpen]);
  useEffect(() => { let active = true; Promise.all([loadAdminWorkspaceDrawerBySlug(slug), loadAdminGlobalQuickLinks()]).then(([result, quickResult]) => {
    if (!active) return;
    const saved = result.data as Partial<WorkspaceDrawerData> | null;
    const globalQuick = Array.isArray(quickResult.items) && quickResult.items.length > 0
      ? quickResult.items as DrawerLink[]
      : initialQuickLinks.map((link) => ({ id: crypto.randomUUID(), type: "link" as const, title: link.label, url: link.href }));
    setDrawer({ ...EMPTY_DRAWER, ...saved, notes: normalizeDrawerNotes(saved?.notes), quick: globalQuick, draftsByUser: normalizeDrawerDrafts(saved?.draftsByUser), pautaIdeas: saved?.pautaIdeas ?? [] }); setLoaded(true);
  }).catch(() => setLoaded(true)); return () => { active = false; }; }, [slug]);
  useEffect(() => { if (loaded) onPautaCountChange?.(drawer.pautaIdeas.length); }, [drawer.pautaIdeas.length, loaded, onPautaCountChange]);
  useEffect(() => { loadAdminKanbanAutomationsBySlug(slug).then((result) => setAutomations((result.items as KanbanAutomation[]) ?? [])).catch(() => setAutomations([])); }, [slug]);
  useEffect(() => { loadAdminTrackerSettingsBySlug(slug).then((result) => setTrackingActive(result.settings.trackingEnabled)).catch(() => setTrackingActive(false)); }, [slug]);
  const persist = (next: WorkspaceDrawerData) => {
    const quickChanged = JSON.stringify(next.quick) !== JSON.stringify(drawer.quick);
    setDrawer(next);
    // Keeps the dashboard shortcut in sync with the Kanban's single link source.
    window.dispatchEvent(new CustomEvent("design-hub:workspace-links-updated", { detail: { slug, links: next.links } }));
    void saveAdminWorkspaceDrawerBySlug(slug, next);
    if (quickChanged && canManageAccess) void saveAdminGlobalQuickLinks(next.quick);
  };
  const items = tab === "quick" ? drawer.quick : tab === "links" ? drawer.links : [];
  const drafts = drawer.draftsByUser[userId] ?? [];
  const resetTextEditor = () => { setText(""); setNoteColor(DEFAULT_DRAWER_NOTE_COLOR); setEditingNoteIndex(null); setEditingDraftId(null); };
  const saveText = () => {
    const value = text.trim();
    if (!value) return;
    if (tab === "notes") {
      const notes = editingNoteIndex === null
        ? [{ id: crypto.randomUUID(), text: value, createdAt: new Date().toISOString(), color: noteColor }, ...drawer.notes]
        : drawer.notes.map((note, index) => index === editingNoteIndex ? { ...note, text: value, color: noteColor } : note);
      persist({ ...drawer, notes });
    }
    if (tab === "drafts") {
      const nextDrafts = editingDraftId === null
        ? [{ id: crypto.randomUUID(), text: value, createdAt: new Date().toISOString() }, ...drafts]
        : drafts.map((draft) => draft.id === editingDraftId ? { ...draft, text: value } : draft);
      persist({ ...drawer, draftsByUser: { ...drawer.draftsByUser, [userId]: nextDrafts } });
    }
    resetTextEditor();
  };
  const editNote = (note: DrawerNote, index: number) => { setText(note.text); setNoteColor(note.color); setEditingNoteIndex(index); };
  const editDraft = (draft: DrawerDraft) => { setText(draft.text); setEditingDraftId(draft.id); };
  const deleteNote = (index: number) => persist({ ...drawer, notes: drawer.notes.filter((_, noteIndex) => noteIndex !== index) });
  const deleteDraft = (id: string) => persist({ ...drawer, draftsByUser: { ...drawer.draftsByUser, [userId]: drafts.filter((draft) => draft.id !== id) } });
  const addDraftAttachment = async (file: File | null) => { if (!file) return; const attachmentUrl = await uploadAdminMedia(file); persist({ ...drawer, draftsByUser: { ...drawer.draftsByUser, [userId]: [{ id: crypto.randomUUID(), text: text.trim() || file.name, attachmentUrl, createdAt: new Date().toISOString() }, ...drafts] } }); setText(""); };
  const addLink = (type: "heading" | "link") => { const title = type === "heading" ? "Novo título" : "Novo link"; const next = [...items, { id: crypto.randomUUID(), type, title, url: type === "link" ? "https://" : undefined }]; persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const updateLink = (id: string, changes: Partial<DrawerLink>) => { const next = items.map((item) => item.id === id ? { ...item, ...changes } : item); persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const deleteLink = (id: string) => { const next = items.filter((item) => item.id !== id); persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const moveLink = (id: string, direction: -1 | 1) => { const index = items.findIndex((item) => item.id === id); const target = index + direction; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const saveIdea = () => { if (!ideaTitle.trim()) return; persist({ ...drawer, pautaIdeas: [{ id: crypto.randomUUID(), title: ideaTitle.trim(), description: ideaDescription.trim(), caption: ideaCaption.trim(), createdAt: new Date().toISOString() }, ...drawer.pautaIdeas] }); setIdeaTitle(""); setIdeaDescription(""); setIdeaCaption(""); setIdeaFormOpen(false); setIdeaSaved(true); window.setTimeout(() => setIdeaSaved(false), 3200); };
  const formatNoteDate = (value: string) => {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
      : "Data não registrada";
  };
  const tabs = [{ id: "notes" as const, icon: "comment" as const, label: "Recados" }, { id: "drafts" as const, icon: "pencil" as const, label: "Rascunhos" }, { id: "links" as const, icon: "link" as const, label: "Links" }, { id: "ideas" as const, icon: "lightbulb" as const, label: "Ideias de Pauta" }, { id: "quick" as const, icon: "spark" as const, label: "Rápidos" }, ...(trackingActive ? [{ id: "progress" as const, icon: "clock" as const, label: "Acompanhamento" }] : []), { id: "tracker" as const, icon: "settings" as const, label: "Configurações" }];
  const selectTab = (nextTab: typeof tab) => { setTab(nextTab); setMobileMenuOpen(false); setIsOpen(true); };
  return <>
    {createPortal(<>{mobileMenuOpen ? <button type="button" className="workspace-drawer-mobile-dismiss" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu de ferramentas" /> : null}
    <aside className={`workspace-drawer-shell${isOpen ? " open" : ""}${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
    <button type="button" className="workspace-drawer-mobile-trigger" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? "Fechar menu de ferramentas" : "Abrir menu de ferramentas"}><span aria-hidden="true"><i /><i /><i /></span></button>
    <div className="workspace-drawer-rail"><button className="automation-rail-button" onClick={() => { setMobileMenuOpen(false); setAutomationOpen(true); }} title="Automações"><span>ϟ</span><b>Automações</b></button>{tabs.map((item) => <button key={item.id} className={isOpen && tab === item.id ? "active" : ""} onClick={() => selectTab(item.id)} title={item.label}><UiIcon name={item.icon} className="workspace-drawer-icon" /><b>{item.label}</b></button>)}</div>
    </aside></>, document.body)}
    {isOpen ? createPortal(<div className="workspace-drawer-modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}><section className="workspace-drawer-panel workspace-drawer-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-drawer-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h3 id="workspace-drawer-modal-title">{tabs.find((item) => item.id === tab)?.label}{tab === "progress" ? <span className="drawer-title-count">{columns.reduce((count, column) => count + column.cards.length, 0)}</span> : null}</h3><div>{tab === "progress" ? <button className="tracker-header-filter" onClick={() => setTrackerFilterOpen((value) => !value)} title="Filtrar o que o cliente vê" aria-label="Filtrar o que o cliente vê">⌕</button> : <small>{loaded ? "Equipe interna" : "Carregando..."}</small>}<button className="workspace-drawer-close" onClick={() => setIsOpen(false)} aria-label="Fechar janela">×</button></div></header>
      {tab === "tracker" ? <ClientSettingsPanel slug={slug} canManageAccess={canManageAccess} onTrackingChange={setTrackingActive} /> : tab === "progress" ? <ProjectTrackerPanel slug={slug} columns={columns} filterOpen={trackerFilterOpen} /> : tab === "ideas" ? <section className="drawer-ideas"><div className="drawer-ideas-count"><span>💡</span><div><strong>{drawer.pautaIdeas.length} {drawer.pautaIdeas.length === 1 ? "pauta" : "pautas"}</strong><small>salvas para este cliente</small></div></div><p className="drawer-helper">Registre uma ideia rápida aqui. A organização e o envio ficam na aba Pautas.</p><button className="gradient-button drawer-ideas-create" type="button" onClick={() => { setIdeaSaved(false); setIdeaFormOpen(true); }}>+ Nova ideia de pauta</button>{ideaSaved ? <p className="drawer-idea-success">Pauta enviada para a aba Pautas.</p> : null}{ideaFormOpen ? <div className="drawer-ideas-form"><label>Título<input autoFocus value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Ex.: Carrossel com mitos e verdades" /></label><label>Descrição<textarea value={ideaDescription} onChange={(event) => setIdeaDescription(event.target.value)} placeholder="Contexto e objetivo da pauta" /></label><label>Legenda sugerida<textarea value={ideaCaption} onChange={(event) => setIdeaCaption(event.target.value)} placeholder="Primeira direção para a legenda" /></label><div><button type="button" onClick={saveIdea}>Enviar para Pautas</button><button type="button" className="drawer-secondary-action" onClick={() => setIdeaFormOpen(false)}>Cancelar</button></div></div> : null}</section> : (tab === "notes" || tab === "drafts") ? <>
        <p className="drawer-helper">{tab === "notes" ? "Recados são visíveis para toda a equipe." : "Rascunhos e anexos são visíveis somente para você."}</p>
        <div className="drawer-compose"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={tab === "notes" ? "Escreva um recado para a equipe" : "Escreva uma anotação privada"} />{tab === "notes" ? <div className="drawer-note-color-picker"><span>Cor da notinha</span>{DRAWER_NOTE_COLORS.map((color) => <button type="button" key={color.value} className={noteColor === color.value ? "selected" : ""} style={{ "--drawer-note-color": color.value } as CSSProperties} onClick={() => setNoteColor(color.value)} aria-label={`Usar fundo ${color.label}`} title={color.label} />)}</div> : null}<div><button onClick={saveText}>{editingNoteIndex !== null || editingDraftId !== null ? "Salvar alterações" : tab === "notes" ? "Publicar recado" : "Salvar rascunho"}</button>{(editingNoteIndex !== null || editingDraftId !== null) ? <button className="drawer-secondary-action" onClick={resetTextEditor}>Cancelar</button> : null}{tab === "drafts" ? <label className="drawer-attachment">Anexar foto<input type="file" accept="image/*" onChange={(event) => void addDraftAttachment(event.target.files?.[0] ?? null)} /></label> : null}</div></div>
        {tab === "notes" ? <div className="drawer-card-list drawer-note-list">{drawer.notes.map((note, index) => <article className="drawer-note" key={note.id} style={{ "--drawer-note-color": note.color } as CSSProperties}>{note.authorName ? <small className="drawer-note-author">{note.authorName}</small> : null}<p>{note.text}</p>{note.attachments?.length ? <div className="drawer-note-attachments">{note.attachments.map((attachment, attachmentIndex) => <a key={`${attachment.url}-${attachmentIndex}`} href={attachment.url} target="_blank" rel="noreferrer">{attachment.name || "Ver anexo"} ↗</a>)}</div> : null}<footer className="drawer-note-footer"><div className="drawer-item-actions"><button onClick={() => editNote(note, index)}>Editar</button><button className="danger" onClick={() => deleteNote(index)}>Excluir</button></div><time dateTime={note.createdAt || undefined}>{formatNoteDate(note.createdAt)}</time></footer></article>)}</div> : <div className="drawer-card-list">{drafts.map((draft) => <article key={draft.id} className={draft.color ? "drawer-draft-colored" : undefined} style={draft.color ? { "--drawer-note-color": draft.color } as CSSProperties : undefined}><p>{draft.text}</p>{draft.attachmentUrl ? <a href={draft.attachmentUrl} target="_blank" rel="noreferrer">Ver anexo</a> : null}<footer className="drawer-note-footer"><div className="drawer-item-actions"><button onClick={() => editDraft(draft)}>Editar</button><button className="danger" onClick={() => deleteDraft(draft.id)}>Excluir</button></div>{draft.createdAt ? <time dateTime={draft.createdAt}>{formatNoteDate(draft.createdAt)}</time> : null}</footer></article>)}</div>}
      </> : <>
        <p className="drawer-helper">{tab === "links" ? "Crie títulos para organizar os links compartilhados da equipe." : "Acesse os atalhos mais usados do workspace."}</p>
        <div className="drawer-link-actions"><button onClick={() => setEditingLinks((value) => !value)}>{editingLinks ? "Concluir edição" : "Organizar links"}</button>{editingLinks ? <><button onClick={() => addLink("heading")}>+ Adicionar título</button><button onClick={() => addLink("link")}>+ Adicionar link</button></> : null}</div><div className="drawer-link-list">{items.map((item) => item.type === "heading" ? <h4 key={item.id}>{editingLinks ? <><input value={item.title} onChange={(event) => updateLink(item.id, { title: event.target.value })} /><button className="drawer-inline-delete" onClick={() => deleteLink(item.id)}>Excluir</button></> : item.title}</h4> : <article key={item.id}>{editingLinks ? <><input value={item.title} onChange={(event) => updateLink(item.id, { title: event.target.value })} /><input value={item.url ?? ""} onChange={(event) => updateLink(item.id, { url: event.target.value })} /><button onClick={() => moveLink(item.id, -1)}>↑</button><button onClick={() => moveLink(item.id, 1)}>↓</button><button className="danger" onClick={() => deleteLink(item.id)}>Excluir</button></> : <a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a>}</article>)}</div>
      </>}
    </section></div>, document.body) : null}
    <AutomationModal open={automationOpen} automations={automations} columns={columns} tags={tags} onClose={() => setAutomationOpen(false)} onChange={(items) => { setAutomations(items); void saveAdminKanbanAutomationsBySlug(slug, items); }} />
  </>;
}

const PORTAL_ACCESS_COPY: Record<PortalAccessLevel, { label: string; description: string }> = {
  admin: { label: "Administrador", description: "Aprova, comenta e usa as ferramentas liberadas no portal." },
  approver: { label: "Aprovador", description: "Aprova, comenta e usa as ferramentas que você liberar." },
  viewer: { label: "Somente visualização", description: "Pode consultar o portal, sem comentar ou aprovar." },
};

function ClientSettingsPanel({ slug, canManageAccess, onTrackingChange }: { slug: string; canManageAccess: boolean; onTrackingChange: (active: boolean) => void }) {
  const [section, setSection] = useState<"people" | "portal">("portal");
  return <div className="client-settings-panel">
    <nav className="client-settings-tabs" aria-label="Configurações do cliente">
      <button className={section === "portal" ? "active" : ""} onClick={() => setSection("portal")}><UiIcon name="settings" />Kanban e portal</button>
      <button className={section === "people" ? "active" : ""} onClick={() => setSection("people")}><UiIcon name="users" />Pessoas e acessos</button>
    </nav>
    {section === "people" ? <ClientPeopleAccessPanel slug={slug} canManage={canManageAccess} /> : <ClientTrackerPanel slug={slug} onTrackingChange={onTrackingChange} />}
  </div>;
}

function ClientPeopleAccessPanel({ slug, canManage }: { slug: string; canManage: boolean }) {
  const [accesses, setAccesses] = useState<ClientAccess[]>([]);
  const [clientLocale, setClientLocale] = useState("pt");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", portalAccessLevel: "approver" as PortalAccessLevel });
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await loadClientAccessesBySlug(slug);
      setAccesses(result.accesses);
      setClientLocale(result.client.locale || "pt");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os acessos.");
    } finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);
  const portalUsers = accesses.filter((access) => access.globalRole === "cliente");
  const internalUsers = accesses.filter((access) => access.globalRole !== "cliente");

  const createAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || form.password.length < 8) return;
    setSaving("create"); setError(""); setMessage("");
    try {
      const result = await createClientPortalAccessBySlug(slug, { ...form, fullName: form.fullName.trim(), email: form.email.trim(), locale: clientLocale });
      setAccesses(result.accesses); setForm({ fullName: "", email: "", password: "", portalAccessLevel: "approver" }); setFormOpen(false); setMessage("Acesso criado com sucesso.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar o acesso."); }
    finally { setSaving(""); }
  };

  const changeLevel = async (access: ClientAccess, portalAccessLevel: PortalAccessLevel) => {
    setSaving(access.membershipId); setError(""); setMessage("");
    try {
      const result = await updateClientPortalAccessBySlug(slug, access, portalAccessLevel);
      setAccesses(result.accesses); setMessage(`Nível de ${access.fullName} atualizado.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível alterar o nível."); }
    finally { setSaving(""); }
  };

  const savePassword = async (access: ClientAccess) => {
    if (newPassword.length < 8) return;
    setSaving(access.membershipId); setError(""); setMessage("");
    try { await resetManagedUserPassword(access.userId, newPassword); setPasswordFor(null); setNewPassword(""); setMessage(`Senha de ${access.fullName} atualizada.`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível redefinir a senha."); }
    finally { setSaving(""); }
  };

  const removeAccess = async (access: ClientAccess) => {
    if (!window.confirm(`Remover o acesso de ${access.fullName} a este cliente?`)) return;
    setSaving(access.membershipId); setError(""); setMessage("");
    try { const result = await removeClientAccessBySlug(slug, access.membershipId); setAccesses(result.accesses); setMessage("Acesso removido."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível remover o acesso."); }
    finally { setSaving(""); }
  };

  return <section className="client-people-settings">
    <div className="client-people-intro"><div><h4>Pessoas do cliente</h4><p>Cada pessoa usa seu próprio e-mail e senha.</p></div>{canManage ? <button className="gradient-button" onClick={() => setFormOpen((open) => !open)}>{formOpen ? "Cancelar" : "+ Adicionar pessoa"}</button> : null}</div>
    {!canManage ? <p className="client-access-notice">Somente o super admin pode alterar acessos.</p> : null}
    {formOpen ? <form className="client-access-form" onSubmit={createAccess}><label>Nome completo<input autoFocus value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Senha inicial<input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 8 caracteres" /></label><label>Nível de acesso<select value={form.portalAccessLevel} onChange={(event) => setForm({ ...form, portalAccessLevel: event.target.value as PortalAccessLevel })}>{Object.entries(PORTAL_ACCESS_COPY).map(([value, copy]) => <option key={value} value={value}>{copy.label}</option>)}</select><small>{PORTAL_ACCESS_COPY[form.portalAccessLevel].description}</small></label><button className="gradient-button" disabled={saving === "create"}>{saving === "create" ? "Criando..." : "Criar acesso"}</button></form> : null}
    {loading ? <p className="drawer-helper">Carregando pessoas...</p> : <div className="client-access-people-list">{portalUsers.length === 0 ? <p className="client-access-empty">Nenhuma pessoa do cliente adicionada.</p> : portalUsers.map((access) => { const level = access.portalAccessLevel || "approver"; return <article key={access.membershipId}><span className="client-access-avatar">{access.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div className="client-access-person"><strong>{access.fullName}</strong><small>{access.email}</small><p>{PORTAL_ACCESS_COPY[level].description}</p>{passwordFor === access.membershipId ? <div className="client-access-password"><input autoFocus type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha" /><button disabled={newPassword.length < 8 || saving === access.membershipId} onClick={() => void savePassword(access)}>Salvar</button><button onClick={() => { setPasswordFor(null); setNewPassword(""); }}>Cancelar</button></div> : null}</div><div className="client-access-actions"><select aria-label={`Nível de acesso de ${access.fullName}`} value={level} disabled={!canManage || saving === access.membershipId} onChange={(event) => void changeLevel(access, event.target.value as PortalAccessLevel)}>{Object.entries(PORTAL_ACCESS_COPY).map(([value, copy]) => <option key={value} value={value}>{copy.label}</option>)}</select>{canManage ? <div><button onClick={() => { setPasswordFor(access.membershipId); setNewPassword(""); }}>Nova senha</button><button className="danger" disabled={saving === access.membershipId} onClick={() => void removeAccess(access)}>Remover</button></div> : null}</div></article>; })}</div>}
    {internalUsers.length ? <details className="client-internal-accesses"><summary>Equipe interna com acesso ({internalUsers.length})</summary>{internalUsers.map((access) => <p key={access.membershipId}><span>{access.fullName}</span><b>{access.membershipRole === "admin" ? "Admin" : "Colaborador"}</b></p>)}</details> : null}
    {message ? <p className="client-access-message">{message}</p> : null}{error ? <p className="tracker-error">{error}</p> : null}
  </section>;
}

function ClientTrackerPanel({ slug, onTrackingChange }: { slug: string; onTrackingChange: (active: boolean) => void }) {
  const [settings, setSettings] = useState<ClientTrackerSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  useEffect(() => {
    let active = true;
    loadAdminTrackerSettingsBySlug(slug)
      .then((result) => { if (active) setSettings(result.settings); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar as configurações."); });
    return () => { active = false; };
  }, [slug]);
  const save = async (next: ClientTrackerSettings) => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await saveAdminTrackerSettingsBySlug(slug, next);
      const result = await loadAdminTrackerSettingsBySlug(slug);
      setSettings(result.settings);
      onTrackingChange(result.settings.trackingEnabled);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar as configurações.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  const togglePermission = (key: keyof ClientTrackerSettings["clientPermissions"]) => {
    if (!settings) return;
    void save({ ...settings, clientPermissions: { ...settings.clientPermissions, [key]: !settings.clientPermissions[key] } });
  };
  if (!settings) return <p className="drawer-helper">{error || "Carregando configurações do cliente..."}</p>;
  const actions: Array<[keyof ClientTrackerSettings["clientPermissions"], string]> = [
    ["allowClientEditCaption", "Editar textos e legendas"], ["allowClientCreatePost", "Criar posts"], ["allowClientCreateTags", "Criar etiquetas"], ["allowClientDownload", "Baixar conteúdo"], ["allowClientEditBrandBrain", "Editar Brand Brain"],
  ];
  const views: Array<[keyof ClientTrackerSettings["clientPermissions"], string]> = [
    ["allowClientViewTexts", "Ver textos"], ["allowClientSearch", "Usar pesquisa"], ["allowClientViewInvoices", "Ver faturas"], ["allowClientViewReports", "Ver relatórios"], ["allowClientViewBrandBrain", "Ver Brand Brain"], ["allowClientViewTracking", "Ver acompanhamento"],
  ];
  return <div className="tracker-settings">
    <label className="tracker-locale">Idioma do portal<select disabled={saving} value={settings.locale} onChange={(event) => void save({ ...settings, locale: event.target.value })}><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option><option value="it">🇮🇹 Italiano</option><option value="sv">🇸🇪 Svenska</option></select></label>
    <TrackerToggle disabled={saving} label="Acompanhamento ativo" checked={settings.trackingEnabled} onChange={() => void save({ ...settings, trackingEnabled: !settings.trackingEnabled })} />
    <section><h4>O que ele pode fazer</h4>{actions.map(([key, label]) => <TrackerToggle disabled={saving} key={key} label={label} checked={settings.clientPermissions[key]} onChange={() => togglePermission(key)} />)}</section>
    <section><h4>O que ele vê</h4><TrackerToggle disabled={saving} label="Acompanhamento visível" checked={settings.trackingVisibleToClient} onChange={() => void save({ ...settings, trackingVisibleToClient: !settings.trackingVisibleToClient })} /><TrackerToggle disabled={saving} label="Próximos posts" checked={settings.showUpcomingPosts} onChange={() => void save({ ...settings, showUpcomingPosts: !settings.showUpcomingPosts })} /><TrackerToggle disabled={saving} label="Arquivados" checked={settings.showArchivedToClient} onChange={() => void save({ ...settings, showArchivedToClient: !settings.showArchivedToClient })} />{views.map(([key, label]) => <TrackerToggle disabled={saving} key={key} label={label} checked={settings.clientPermissions[key]} onChange={() => togglePermission(key)} />)}</section>
    <section><h4>Colunas visíveis</h4>{settings.columns.map((column) => <TrackerToggle disabled={saving} key={column.id} label={column.name} checked={column.visibleToClient} onChange={() => void save({ ...settings, columns: settings.columns.map((item) => item.id === column.id ? { ...item, visibleToClient: !item.visibleToClient } : item) })} />)}</section>
    {saving ? <p className="drawer-helper" role="status">Salvando configuração...</p> : null}
    {error ? <p className="tracker-error">{error}</p> : null}
  </div>;
}

function TrackerToggle({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return <label className="tracker-toggle"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><i /></label>;
}

function ProjectTrackerPanel({ slug, columns, filterOpen }: { slug: string; columns: BoardColumn[]; filterOpen: boolean }) {
  const [filteredColumns, setFilteredColumns] = useState(columns);
  useEffect(() => setFilteredColumns(columns), [columns]);
  const total = filteredColumns.reduce((count, column) => count + column.cards.length, 0);
  const completed = filteredColumns.flatMap((column) => column.cards).filter((card) => /(finaliz|conclu)/i.test(card.statusBadges.join(" "))).length;
  const toggleColumn = (column: BoardColumn) => {
    const visibleToClient = !column.visibleToClient;
    setFilteredColumns((current) => current.map((item) => item.id === column.id ? { ...item, visibleToClient } : item));
    void updateAdminColumnBySlug(slug, column.id, { visibleToClient });
  };
  const toggleCard = (columnId: string, card: BoardCard) => {
    const visible = card.statusBadges.includes("Enviar para Cliente");
    const status = visible ? card.statusBadges.filter((item) => item !== "Enviar para Cliente") : [...card.statusBadges, "Enviar para Cliente"];
    setFilteredColumns((current) => current.map((column) => column.id !== columnId ? column : { ...column, cards: column.cards.map((item) => item.id === card.id ? { ...item, statusBadges: status } : item) }));
    void updateAdminCardBySlug(slug, card.id, { status });
  };
  const tone = (card: BoardCard) => /(finaliz|conclu)/i.test(card.statusBadges.join(" ")) ? "done" : /(design pronto)/i.test(card.statusBadges.join(" ")) ? "design" : /(alteração|alteracao)/i.test(card.statusBadges.join(" ")) ? "revision" : /(legenda)/i.test(card.statusBadges.join(" ")) ? "copy" : /(desenvolvimento|criação|criacao)/i.test(card.statusBadges.join(" ")) ? "working" : "waiting";
  return <div className="project-tracker">
    <div className="project-tracker-legend"><b>Legenda</b><span className="done">Finalizado</span><span className="design">Design pronto</span><span className="working">Em desenvolvimento</span><span className="copy">Escrevendo legenda</span><span className="revision">Alteração solicitada</span><span className="waiting">Aguardando</span></div>
    {filterOpen ? <section className="project-tracker-filter"><strong>Visível para o cliente</strong>{filteredColumns.map((column) => <div key={column.id}><label><input type="checkbox" checked={column.visibleToClient} onChange={() => toggleColumn(column)} /> {column.name}</label>{column.cards.map((card) => <label key={card.id} className="project-filter-card"><input type="checkbox" checked={card.statusBadges.includes("Enviar para Cliente")} onChange={() => toggleCard(column.id, card)} /> {card.title}</label>)}</div>)}</section> : null}
    <p className="project-tracker-progress">{completed}/{total} tarefas finalizadas. O filtro altera apenas o que o cliente vê.</p>
    {filteredColumns.map((column) => <section key={column.id} className="project-tracker-stage"><h4>{column.name}<span>{column.cards.length}</span></h4>{column.cards.map((card) => <div key={card.id} className={`project-tracker-task ${tone(card)}`}><i>{/(finaliz|conclu)/i.test(card.statusBadges.join(" ")) ? "✓" : ""}</i><div><strong>{card.title}</strong>{card.statusBadges.filter((item) => item !== "Enviar para Cliente").map((item) => <small key={item}>{cardStatusLabel(item)}</small>)}</div><em /></div>)}</section>)}
  </div>;
}

function AutomationModal({ open, automations, columns, tags, onClose, onChange }: { open: boolean; automations: KanbanAutomation[]; columns: BoardColumn[]; tags: ClientTagDefinition[]; onClose: () => void; onChange: (items: KanbanAutomation[]) => void }) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<KanbanAutomation["triggerType"]>("tag_added");
  const [triggerValue, setTriggerValue] = useState("");
  const [actionType, setActionType] = useState<KanbanAutomation["actionType"]>("add_tag");
  const [actionValue, setActionValue] = useState("");
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  const triggerOptions = triggerType === "tag_added" ? tags.map((tag) => ({ value: tag.name, label: tag.name })) : columns.map((column) => ({ value: column.id, label: column.name }));
  const actionOptions = actionType === "add_tag" ? tags.map((tag) => ({ value: tag.name, label: tag.name })) : actionType === "move_column" ? columns.map((column) => ({ value: column.id, label: column.name })) : [{ value: "#3b82f6", label: "Azul" }, { value: "#22c55e", label: "Verde" }, { value: "#f59e0b", label: "Laranja" }, { value: "#ef4444", label: "Vermelho" }];
  const create = () => { if (!name.trim() || !triggerValue || !actionValue) return; onChange([{ id: crypto.randomUUID(), name: name.trim(), enabled: true, triggerType, triggerValue, actionType, actionValue }, ...automations]); setName(""); setTriggerValue(""); setActionValue(""); };
  const describe = (rule: KanbanAutomation) => { const trigger = rule.triggerType === "tag_added" ? `Adicionar etiqueta “${rule.triggerValue}”` : `Mover para ${columns.find((column) => column.id === rule.triggerValue)?.name ?? "coluna"}`; const action = rule.actionType === "add_tag" ? `Adicionar etiqueta “${rule.actionValue}”` : rule.actionType === "move_column" ? `Mover para ${columns.find((column) => column.id === rule.actionValue)?.name ?? "coluna"}` : "Alterar cor do card"; return { trigger, action }; };
  return <div className="automation-modal-backdrop" onMouseDown={onClose}><section className="automation-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><header><div><span>ϟ</span><h3>Automações do Kanban</h3><p>Válidas somente para este cliente.</p></div><button onClick={onClose} aria-label="Fechar">×</button></header><div className="automation-list">{automations.map((rule) => { const description = describe(rule); return <article key={rule.id}><div><strong>{rule.name}</strong><p>Quando: {description.trigger}</p><p>Ação: {description.action}</p></div><label className="automation-switch"><input type="checkbox" checked={rule.enabled} onChange={() => onChange(automations.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item))} /><span /></label><button className="automation-delete" onClick={() => onChange(automations.filter((item) => item.id !== rule.id))}>⌫</button></article>; })}{automations.length === 0 ? <p className="automation-empty">Nenhuma automação criada para este Kanban.</p> : null}</div><section className="automation-create"><h4>Nova automação</h4><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Auto-tag Urgente" /></label><label>Gatilho<select value={triggerType} onChange={(event) => { setTriggerType(event.target.value as KanbanAutomation["triggerType"]); setTriggerValue(""); }}><option value="tag_added">Quando adicionar etiqueta</option><option value="column_moved">Quando mover para uma coluna</option></select></label><label>{triggerType === "tag_added" ? "Etiqueta de gatilho" : "Coluna de gatilho"}<select value={triggerValue} onChange={(event) => setTriggerValue(event.target.value)}><option value="">Selecione uma opção</option>{triggerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Ação<select value={actionType} onChange={(event) => { setActionType(event.target.value as KanbanAutomation["actionType"]); setActionValue(""); }}><option value="add_tag">Adicionar etiqueta</option><option value="move_column">Mover para coluna</option><option value="change_color">Alterar cor</option></select></label><label>{actionType === "add_tag" ? "Etiqueta" : actionType === "move_column" ? "Coluna de destino" : "Cor"}<select value={actionValue} onChange={(event) => setActionValue(event.target.value)}><option value="">Selecione uma opção</option>{actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="gradient-button" onClick={create}>+ Criar automação</button></section></section></div>;
}

function AccessDenied({
  title,
  body,
  backHref,
}: {
  title: string;
  body: string;
  backHref: string;
}) {
  return (
    <main className="center-shell">
      <section className="glass access-card">
        <p className="eyebrow">Acesso controlado</p>
        <h2>{title}</h2>
        <p className="hero-copy">{body}</p>
        <NavLink to={backHref} className="topnav-link active">
          Voltar
        </NavLink>
      </section>
    </main>
  );
}

function StatusBanner({
  source,
  loading,
  message,
}: {
  source: "backend" | "error";
  loading: boolean;
  message: string;
}) {
  return (
    <div className="status-banner glass-subtle">
      <span className={source === "backend" ? "status-dot live" : "status-dot"} />
      <strong>{source === "backend" ? "Banco real da V2" : "Erro de carregamento"}</strong>
      <span>{loading ? "Carregando..." : message}</span>
    </div>
  );
}

function flattenWorkspaceCards(data: AdminWorkspacePreview | ClientPortalPreview) {
  const groupedCards =
    "columns" in data
      ? data.columns.flatMap((column) => column.cards)
      : data.boardColumns.flatMap((column) => column.cards);

  return [...groupedCards, ...data.withoutColumn];
}

function buildFallbackCardDetail(card: BoardCard): CardDetail {
  return {
    card,
    comments: [],
    approvalLinks: [],
  };
}

function CommentAvatar({ name, url }: { name: string; url?: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="comment-avatar">{url ? <img src={url} alt="" /> : initials}</span>;
}

function useCardDetail<T extends AdminWorkspacePreview | ClientPortalPreview>(
  dataset: T,
  selectedCardId: string | null,
  loader: (cardId: string) => Promise<CardDetail>,
  refreshKey: number,
) {
  const fallbackCard = useMemo(() => {
    if (!selectedCardId) return null;
    return flattenWorkspaceCards(dataset).find((card) => card.id === selectedCardId) ?? null;
  }, [dataset, selectedCardId]);

  const [state, setState] = useState<{
    data: CardDetail | null;
    loading: boolean;
    source: "backend" | "error";
  }>({
    data: fallbackCard ? buildFallbackCardDetail(fallbackCard) : null,
    loading: false,
    source: "backend",
  });

  useEffect(() => {
    let active = true;

    if (!selectedCardId) {
      setState({
        data: null,
        loading: false,
        source: "backend",
      });
      return;
    }

    setState((current) => {
      // Background refreshes must not replace an already-open card with the
      // comment-free list preview while its full detail is being requested.
      if (current.data?.card.id === selectedCardId) return current;
      return {
        data: fallbackCard ? buildFallbackCardDetail(fallbackCard) : null,
        loading: true,
        source: "backend",
      };
    });

    loader(selectedCardId)
      .then((data) => {
        if (!active) return;
        setState({
          data,
          loading: false,
          source: "backend",
        });
      })
      .catch(() => {
        if (!active) return;
        setState((current) => ({
          data: current.data?.card.id === selectedCardId
            ? current.data
            : fallbackCard ? buildFallbackCardDetail(fallbackCard) : null,
          loading: false,
          source: "error",
        }));
      });

    return () => {
      active = false;
    };
  }, [fallbackCard, loader, refreshKey, selectedCardId]);

  return state;
}

function DashboardRoutePage({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.role === "client") return <Navigate to={getDefaultRoute(session)} replace />;
  return <DashboardPage session={session} onLogout={onLogout} />;
}

type CommemorativeHoliday = {
  id: string;
  date: string;
  name: string;
  localName: string;
  countryCode: string;
  countryName: string;
};

type CommemorativeCountry = { countryCode: string; name: string };

const COMMEMORATIVE_COUNTRIES_KEY = "designhub-v2-commemorative-countries";
const DEFAULT_COMMEMORATIVE_COUNTRIES: string[] = [];
const COMMON_COMMEMORATIVE_COUNTRIES: CommemorativeCountry[] = [
  { countryCode: "BR", name: "Brasil" },
  { countryCode: "PT", name: "Portugal" },
  { countryCode: "IT", name: "Itália" },
  { countryCode: "ES", name: "Espanha" },
  { countryCode: "FR", name: "França" },
  { countryCode: "US", name: "Estados Unidos" },
  { countryCode: "GB", name: "Reino Unido" },
  { countryCode: "DE", name: "Alemanha" },
  { countryCode: "AR", name: "Argentina" },
  { countryCode: "CL", name: "Chile" },
  { countryCode: "MX", name: "México" },
];

function readCommemorativeCountries() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(COMMEMORATIVE_COUNTRIES_KEY) ?? "null");
    return Array.isArray(saved) && saved.every((item) => typeof item === "string")
      ? saved as string[]
      : DEFAULT_COMMEMORATIVE_COUNTRIES;
  } catch {
    return DEFAULT_COMMEMORATIVE_COUNTRIES;
  }
}

async function loadCommemorativeCountries() {
  const response = await fetch("https://date.nager.at/api/v3/AvailableCountries");
  if (!response.ok) throw new Error("Não foi possível carregar a lista de países.");
  const countries = await response.json() as CommemorativeCountry[];
  return countries.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

async function loadCommemorativeHolidays(year: number, countryCodes: string[], countryDirectory = COMMON_COMMEMORATIVE_COUNTRIES) {
  const results = await Promise.all(countryCodes.map(async (countryCode) => {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    if (!response.ok) throw new Error("Não foi possível carregar as datas comemorativas.");
    const holidays = await response.json() as Array<{ date: string; name: string; localName: string; global: boolean; types?: string[] }>;
    const countryName = countryDirectory.find((country) => country.countryCode === countryCode)?.name ?? countryCode;
    return holidays.map((holiday) => ({
      id: `${countryCode}-${holiday.date}-${holiday.name}`,
      date: holiday.date,
      name: holiday.name,
      localName: holiday.localName || holiday.name,
      countryCode,
      countryName,
    }));
  }));
  return results.flat().sort((left, right) => left.date.localeCompare(right.date));
}

function formatCommemorativeDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date(`${date}T12:00:00`));
}

function daysUntilDate(date: string) {
  const today = new Date();
  const target = new Date(`${date}T12:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function DashboardCommemorativeWidget({ clients }: { clients: AdminClientOption[] }) {
  const [holidays, setHolidays] = useState<CommemorativeHoliday[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<CommemorativeHoliday | null>(null);
  const [selectedClientSlug, setSelectedClientSlug] = useState(clients[0]?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedClientSlug((current) => current || clients[0]?.slug || "");
  }, [clients]);

  useEffect(() => {
    let active = true;
    const countryCodes = readCommemorativeCountries();
    loadCommemorativeHolidays(new Date().getFullYear(), countryCodes)
      .then((items) => { if (active) setHolidays(items.filter((item) => daysUntilDate(item.date) === 4)); })
      .catch(() => { if (active) setHolidays([]); });
    return () => { active = false; };
  }, []);

  const createPauta = async () => {
    if (!selectedHoliday || !selectedClientSlug || saving) return;
    setSaving(true);
    try {
      await createAdminCardBySlug(selectedClientSlug, {
        columnId: null,
        title: `${selectedHoliday.localName} · ${selectedHoliday.countryName}`,
        caption: `Sugestão de pauta para a data comemorativa de ${formatCommemorativeDate(selectedHoliday.date)}. Criar conteúdo relacionado para aprovação do cliente.`,
        primaryMediaUrl: null,
        externalLinkUrl: null,
        artType: "Post",
        status: ["Entrada"],
        tags: ["Data comemorativa"],
        clientLabel: "Pendente",
        isBriefApproval: true,
        deadlineAt: selectedHoliday.date,
      });
      setCreatedIds((current) => [...current, `${selectedHoliday.id}-${selectedClientSlug}`]);
      setSelectedHoliday(null);
    } finally {
      setSaving(false);
    }
  };

  if (holidays.length === 0) return null;
  return <>
    <section className="dashboard-tasks-widget commemorative-dashboard-widget">
      <header><div><span className="dashboard-task-icon">✦</span><h3>Datas comemorativas</h3></div><span className="dashboard-task-count">Em 4 dias</span></header>
      <div className="dashboard-task-rows">
        {holidays.map((holiday) => {
          const isCreated = createdIds.some((id) => id.startsWith(`${holiday.id}-`));
          return <article key={holiday.id}>
            <span className="dashboard-task-dot commemorative-dot" />
            <span className="commemorative-date-box">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${holiday.date}T12:00:00`))}</span>
            <div><strong>{holiday.localName}</strong><small>{holiday.countryName}</small></div>
            <button className="dashboard-brief-button" disabled={isCreated || clients.length === 0} onClick={() => setSelectedHoliday(holiday)}>{isCreated ? "Pauta criada" : "Virar pauta"}</button>
          </article>;
        })}
      </div>
      <NavLink to="/area/datas-comemorativas" className="dashboard-task-link">Gerenciar monitoramento <span>→</span></NavLink>
    </section>
    {selectedHoliday ? <div className="modal-backdrop" onClick={() => setSelectedHoliday(null)}><section className="commemorative-pauta-modal" onClick={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">Nova pauta</p><h3>{selectedHoliday.localName}</h3></div><button className="icon-close" onClick={() => setSelectedHoliday(null)}>×</button></header>
      <p>{selectedHoliday.countryName} · {formatCommemorativeDate(selectedHoliday.date)}</p>
      <label className="field-stack">Cliente<select value={selectedClientSlug} onChange={(event) => setSelectedClientSlug(event.target.value)}>{clients.map((client) => <option key={client.slug} value={client.slug}>{client.name}</option>)}</select></label>
      <small>A pauta será criada como pendente, pronta para o cliente aprovar no Kanban.</small>
      <footer><button className="drawer-secondary-action" onClick={() => setSelectedHoliday(null)}>Cancelar</button><button className="gradient-button" disabled={saving || !selectedClientSlug} onClick={() => void createPauta()}>{saving ? "Criando..." : "Criar pauta para aprovação"}</button></footer>
    </section></div> : null}
  </>;
}

function CommemorativeDatesWorkspace() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>(readCommemorativeCountries);
  const [countries, setCountries] = useState<CommemorativeCountry[]>(COMMON_COMMEMORATIVE_COUNTRIES);
  const [holidays, setHolidays] = useState<CommemorativeHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadCommemorativeCountries().then(setCountries).catch(() => setCountries(COMMON_COMMEMORATIVE_COUNTRIES));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COMMEMORATIVE_COUNTRIES_KEY, JSON.stringify(selectedCodes));
    let active = true;
    setLoading(true); setError("");
    loadCommemorativeHolidays(new Date().getFullYear(), selectedCodes, countries)
      .then((items) => { if (active) setHolidays(items.filter((item) => daysUntilDate(item.date) >= 0)); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar as datas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedCodes, countries]);

  const addCountry = (countryCode: string) => setSelectedCodes((current) => current.includes(countryCode) ? current : [...current, countryCode]);
  const removeCountry = (countryCode: string) => setSelectedCodes((current) => current.filter((code) => code !== countryCode));
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const countryResults = normalizedQuery
    ? countries.filter((country) => `${country.name} ${country.countryCode}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)).slice(0, 12)
    : [];
  const monitoredCountries = countries.filter((country) => selectedCodes.includes(country.countryCode));

  return <section className="commemorative-workspace glass">
    <div className="commemorative-workspace-head"><div><p className="eyebrow">Monitoramento</p><h2>Encontre os países que quer acompanhar</h2><p>Busque um país e adicione-o. O dashboard avisa quatro dias antes para você transformar a oportunidade em pauta.</p></div><span className="commemorative-monitor-count">{selectedCodes.length} {selectedCodes.length === 1 ? "país monitorado" : "países monitorados"}</span></div>
    <div className="commemorative-country-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar país para adicionar..." aria-label="Buscar país para adicionar" /><span>{loading ? "Atualizando datas..." : `${holidays.length} próximas datas`}</span></div>
    {normalizedQuery ? <div className="commemorative-search-results">{countryResults.length ? countryResults.map((country) => { const active = selectedCodes.includes(country.countryCode); return <div key={country.countryCode} className="commemorative-search-result"><span>{country.countryCode}</span><strong>{country.name}</strong><button className={active ? "monitored" : ""} disabled={active} onClick={() => addCountry(country.countryCode)}>{active ? "Monitorando" : "Adicionar"}</button></div>; }) : <p className="commemorative-empty">Nenhum país encontrado.</p>}</div> : null}
    <div className="commemorative-monitored"><header><h3>Países monitorados</h3><span>Adicione apenas os que você selecionar na busca</span></header>{monitoredCountries.length ? <div className="commemorative-monitored-list">{monitoredCountries.map((country) => <div key={country.countryCode} className="commemorative-monitored-chip"><span>{country.countryCode}</span><strong>{country.name}</strong><button onClick={() => removeCountry(country.countryCode)} aria-label={`Remover ${country.name}`}>×</button></div>)}</div> : <p className="commemorative-empty">Nenhum país monitorado. Use a busca acima para adicionar.</p>}</div>
    {error ? <p className="form-feedback error-text">{error}</p> : null}
    <div className="commemorative-list"><header><h3>Próximas datas monitoradas</h3><span>O aviso aparece no dashboard 4 dias antes</span></header>{holidays.length ? holidays.slice(0, 24).map((holiday) => <article key={holiday.id}><time>{formatCommemorativeDate(holiday.date)}</time><div><strong>{holiday.localName}</strong><span>{holiday.countryName}</span></div><em>{daysUntilDate(holiday.date)} dias</em></article>) : <p className="commemorative-empty">Nenhuma data encontrada para os países selecionados.</p>}</div>
  </section>;
}

type InternalApprovalRecord = { id: string; cardId: string; clientSlug?: string; cardTitle: string; recipients: string[]; message: string; createdAt: string };
const INTERNAL_APPROVALS_STORAGE_KEY = "designhub-v2-internal-approvals";
const DISMISSED_INTERNAL_MESSAGES_KEY = "designhub-v2-dismissed-internal-messages";
function loadInternalApprovalMessages(userId?: string) {
  try { const records = JSON.parse(window.localStorage.getItem(INTERNAL_APPROVALS_STORAGE_KEY) ?? "[]") as InternalApprovalRecord[]; return userId ? records.filter((record) => record.recipients.includes(userId)) : records; } catch { return []; }
}

function DashboardInternalMessagesWidget({ items, onOpen }: { items: InternalApprovalRecord[]; onOpen: (item: InternalApprovalRecord) => void }) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => { try { return JSON.parse(window.localStorage.getItem(DISMISSED_INTERNAL_MESSAGES_KEY) ?? "[]") as string[]; } catch { return []; } });
  const visibleItems = items.filter((item) => !dismissedIds.includes(item.id));
  if (!visibleItems.length) return null;
  return <section className="dashboard-widget dashboard-internal-messages"><header className="dashboard-widget-head"><div><p className="eyebrow">Equipe</p><h3>Mensagens internas</h3><small>Cards enviados para sua revisão</small></div><span>{visibleItems.length}</span></header>{visibleItems.length ? <div className="dashboard-internal-list">{visibleItems.slice(0, 5).map((item) => <div className="dashboard-internal-row" key={item.id}><button className="dashboard-internal-open" onClick={() => onOpen(item)}><span className="dashboard-item-bullet" aria-hidden="true" /><span className="internal-message-icon">♙</span><div><strong>{item.cardTitle}</strong><small>{item.message}</small></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></button><button className="dashboard-internal-dismiss" aria-label="Fechar mensagem" title="Fechar mensagem" onClick={() => setDismissedIds((current) => { const next = [...current, item.id]; window.localStorage.setItem(DISMISSED_INTERNAL_MESSAGES_KEY, JSON.stringify(next)); return next; })}>×</button></div>)}</div> : <div className="dashboard-internal-empty">Nenhuma mensagem interna por enquanto.</div>}</section>;
}

function DashboardPage({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [upcomingPosts, setUpcomingPosts] = useState<DashboardUpcomingPost[]>([]);
  const [postsToday, setPostsToday] = useState<DashboardTodayPost[]>([]);
  const [agendaToday, setAgendaToday] = useState<AgendaEvent[]>([]);
  const [clientSubmissions, setClientSubmissions] = useState<DashboardSubmission[]>([]);
  const [clientActivities, setClientActivities] = useState<DashboardClientActivity[]>([]);
  const [approvedPautas, setApprovedPautas] = useState<DashboardApprovedPauta[]>([]);
  const [internalMessages, setInternalMessages] = useState<InternalApprovalRecord[]>(() => loadInternalApprovalMessages(session.id));
  const [scheduleActivity, setScheduleActivity] = useState<DashboardClientActivity | null>(null);
  const [scheduledNotice, setScheduledNotice] = useState<{ title: string; clientName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [clientFilter, setClientFilter] = useState<"all" | "mine" | "shared">("all");
  const [editClient, setEditClient] = useState<AdminClientOption | null>(null);
  const [shareClient, setShareClient] = useState<AdminClientOption | null>(null);
  const [clientAccesses, setClientAccesses] = useState<ClientAccess[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [clientActionError, setClientActionError] = useState("");
  const [clientActionSaving, setClientActionSaving] = useState(false);
  const [clientCardsRevision, setClientCardsRevision] = useState(0);
  const [editForm, setEditForm] = useState<EditClientForm>({ name: "", slug: "", locale: "pt", greetingName: "", portalTitle: "", email: "", password: "", clientUserId: "", instagram: "", facebook: "", tiktok: "", youtube: "", linkedin: "", x: "", website: "" });
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editDrawerData, setEditDrawerData] = useState<Record<string, unknown>>({});
  const [shareUserId, setShareUserId] = useState("");
  const [shareRole, setShareRole] = useState<"admin" | "colaborador">("colaborador");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", locale: "pt", greetingName: "", email: "", password: "",
    instagram: "", facebook: "", tiktok: "", youtube: "", linkedin: "", x: "", website: "",
  });
  const [linksOpen, setLinksOpen] = useState(false);
  const [kanbanLinks, setKanbanLinks] = useState<Array<{ slug: string; clientName: string; links: DrawerLink[] }>>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("createClient") !== "1") return;
    setCreateOpen(true);
    navigate("/dashboard", { replace: true });
  }, [location.search, navigate]);
  useEffect(() => {
    if (!scheduledNotice) return;
    const timeout = window.setTimeout(() => setScheduledNotice(null), 2_300);
    return () => window.clearTimeout(timeout);
  }, [scheduledNotice]);

  const greeting = currentTime.getHours() < 12 ? "Bom dia" : currentTime.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const refreshKanbanLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const entries = await Promise.all(clients.map(async (client) => {
        const result = await loadAdminWorkspaceDrawerBySlug(client.slug);
        const saved = result.data as Partial<WorkspaceDrawerData> | null;
        return { slug: client.slug, clientName: client.name, links: saved?.links ?? [] };
      }));
      setKanbanLinks(entries);
    } catch {
      setKanbanLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }, [clients]);

  useEffect(() => {
    if (!linksOpen) return;
    void refreshKanbanLinks();
  }, [linksOpen, refreshKanbanLinks]);

  useEffect(() => {
    const syncLinks = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string; links: DrawerLink[] }>).detail;
      if (!detail) return;
      setKanbanLinks((current) => current.map((entry) => entry.slug === detail.slug ? { ...entry, links: detail.links } : entry));
    };
    window.addEventListener("design-hub:workspace-links-updated", syncLinks);
    return () => window.removeEventListener("design-hub:workspace-links-updated", syncLinks);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshClients = () => listAdminClients()
      .then(({ items }) => { if (active) setClients(items); })
      .catch(() => { if (active) setClients([]); })
      .finally(() => { if (active) setLoading(false); });
    const refreshOverview = () => loadDashboardOverview()
      .then((overview) => {
        if (!active) return;
        setUpcomingPosts(overview.upcomingPosts);
        setPostsToday(overview.postsToday ?? []);
        setAgendaToday(overview.agendaToday);
        setClientSubmissions(overview.clientSubmissions);
        setClientActivities(overview.clientActivities ?? []);
        setApprovedPautas(overview.approvedPautas ?? []);
        setInternalMessages(loadInternalApprovalMessages(session.id));
      })
      .catch(() => undefined);
    const refreshDashboard = () => Promise.all([refreshClients(), refreshOverview()]);
    void refreshDashboard();
    let lastRefreshAt = Date.now();
    const refreshOnFocus = () => {
      if (Date.now() - lastRefreshAt < 10 * 60_000) return;
      lastRefreshAt = Date.now();
      void refreshDashboard();
    };
    const refreshOnVisibility = () => { if (document.visibilityState === "visible") refreshOnFocus(); };
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") refreshOnFocus(); }, 10 * 60_000);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refreshOnFocus); document.removeEventListener("visibilitychange", refreshOnVisibility); };
  }, []);
  useEffect(() => { const sync = () => setInternalMessages(loadInternalApprovalMessages(session.id)); window.addEventListener("storage", sync); const timer = window.setInterval(sync, 5_000); return () => { window.removeEventListener("storage", sync); window.clearInterval(timer); }; }, [session.id]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" && !current.slug ? { slug: slugify(value) } : {}),
    }));
  };

  const myClients = clients.filter((client) => client.owner_user_id === session.id);
  // A aba compartilhados inclui clientes recebidos e também clientes próprios
  // que já foram compartilhados com pelo menos outro membro da equipe.
  const sharedClients = clients.filter((client) => client.owner_user_id !== session.id || (client.access_count ?? 0) > 1);
  const visibleClients = clientFilter === "mine" ? myClients : clientFilter === "shared" ? sharedClients : clients;

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError("");
  };

  const refreshClients = async () => {
    const { items } = await listAdminClients();
    setClients(items);
  };

  const openEditClient = async (client: AdminClientOption) => {
    setEditClient(client); setClientActionError(""); setClientAccesses([]);
    setEditLogoFile(null); setEditDrawerData({});
    setEditForm({ name: client.name, slug: client.slug, locale: client.locale ?? "pt", greetingName: client.portal_title ?? client.name, portalTitle: client.portal_title ?? client.name, email: "", password: "", clientUserId: "", instagram: "", facebook: "", tiktok: "", youtube: "", linkedin: "", x: "", website: "" });
    try {
      const [result, drawerResult] = await Promise.all([loadClientAccesses(client.id), loadAdminWorkspaceDrawerBySlug(client.slug)]);
      setClientAccesses(result.accesses);
      const portalUser = result.accesses.find((access) => access.globalRole === "cliente");
      const drawer = drawerResult.data && typeof drawerResult.data === "object" ? drawerResult.data as Record<string, unknown> : {};
      const socialLinks = drawer.socialLinks && typeof drawer.socialLinks === "object" ? drawer.socialLinks as Record<string, unknown> : {};
      setEditDrawerData(drawer);
      setEditForm((current) => ({
        ...current,
        clientUserId: portalUser?.userId ?? "",
        email: portalUser?.email ?? "",
        instagram: typeof socialLinks.instagram === "string" ? socialLinks.instagram : "",
        facebook: typeof socialLinks.facebook === "string" ? socialLinks.facebook : "",
        tiktok: typeof socialLinks.tiktok === "string" ? socialLinks.tiktok : "",
        youtube: typeof socialLinks.youtube === "string" ? socialLinks.youtube : "",
        linkedin: typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : "",
        x: typeof socialLinks.x === "string" ? socialLinks.x : "",
        website: typeof socialLinks.website === "string" ? socialLinks.website : "",
      }));
    } catch (caught) { setClientActionError(caught instanceof Error ? caught.message : "Não foi possível carregar os acessos."); }
  };

  const saveEditedClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editClient) return;
    setClientActionSaving(true); setClientActionError("");
    try {
      const logoUrl = editLogoFile ? await uploadAdminMedia(editLogoFile) : editClient.logo_url ?? null;
      await updateAdminClient(editClient.id, {
        name: editForm.name.trim(),
        slug: slugify(editForm.slug),
        locale: editForm.locale,
        portalTitle: editForm.greetingName.trim() || editForm.name.trim(),
        logoUrl,
      });
      await saveAdminWorkspaceDrawerBySlug(slugify(editForm.slug), {
        ...editDrawerData,
        socialLinks: {
          instagram: editForm.instagram.trim(), facebook: editForm.facebook.trim(), tiktok: editForm.tiktok.trim(),
          youtube: editForm.youtube.trim(), linkedin: editForm.linkedin.trim(), x: editForm.x.trim(), website: editForm.website.trim(),
        },
      });
      if (editForm.password) {
        if (!editForm.clientUserId) throw new Error("Este cliente ainda não possui um login para trocar a senha.");
        await resetManagedUserPassword(editForm.clientUserId, editForm.password);
      }
      await refreshClients();
      setClientCardsRevision((value) => value + 1);
      setEditClient(null);
    } catch (caught) { setClientActionError(caught instanceof Error ? caught.message : "Não foi possível salvar o cliente."); }
    finally { setClientActionSaving(false); }
  };

  const openShareClient = async (client: AdminClientOption) => {
    setShareClient(client); setClientActionError(""); setClientAccesses([]); setManagedUsers([]); setShareUserId("");
    try {
      const [accessResult, usersResult] = await Promise.all([loadClientAccesses(client.id), listManagedUsers()]);
      setClientAccesses(accessResult.accesses); setManagedUsers(usersResult.items.filter((user) => user.globalRole !== "cliente"));
    } catch (caught) { setClientActionError(caught instanceof Error ? caught.message : "Não foi possível carregar a equipe."); }
  };

  const shareSelectedClient = async () => {
    if (!shareClient || !shareUserId) return;
    setClientActionSaving(true); setClientActionError("");
    try {
      const result = await shareClientWithMember(shareClient.id, { userId: shareUserId, membershipRole: shareRole });
      setClientAccesses(result.accesses); setShareUserId("");
    } catch (caught) { setClientActionError(caught instanceof Error ? caught.message : "Não foi possível compartilhar o cliente."); }
    finally { setClientActionSaving(false); }
  };

  const removeClient = async (client: AdminClientOption) => {
    if (!window.confirm(`Excluir ${client.name}? Esta ação remove também o Kanban, posts e permissões desta conta.`)) return;
    try { await deleteAdminClient(client.id); await refreshClients(); }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : "Não foi possível excluir o cliente."); }
  };

  const submitClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    const name = form.name.trim();
    const slug = slugify(form.slug);
    const email = form.email.trim();
    const password = form.password;

    if (!name || !slug) { setCreateError("Preencha o nome e a URL do cliente."); return; }
    if ((email && !password) || (!email && password)) { setCreateError("Preencha e-mail e senha para criar o login do cliente."); return; }
    if (email && session.role !== "super_admin") { setCreateError("Somente o super admin pode criar login para clientes."); return; }

    setCreating(true);
    try {
      const logoUrl = logoFile ? await uploadAdminMedia(logoFile) : null;
      const client = await createAdminClient({ name, slug, locale: form.locale, portalTitle: form.greetingName.trim() || name, logoUrl, ownerUserId: session.id });
      await saveAdminWorkspaceDrawerBySlug(client.slug, {
        socialLinks: {
          instagram: form.instagram.trim(), facebook: form.facebook.trim(), tiktok: form.tiktok.trim(),
          youtube: form.youtube.trim(), linkedin: form.linkedin.trim(), x: form.x.trim(), website: form.website.trim(),
        },
      });
      if (email && password) {
        await createManagedClientUser({ fullName: name, email, password, locale: form.locale, clientAccountId: client.id });
      }
      setClients((current) => [client, ...current]);
      setForm({ name: "", slug: "", locale: "pt", greetingName: "", email: "", password: "", instagram: "", facebook: "", tiktok: "", youtube: "", linkedin: "", x: "", website: "" });
      setLogoFile(null);
      setCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Não foi possível criar o cliente.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-grid admin-layout dashboard-layout">
      <AdminRail session={session} onCreateClient={() => setCreateOpen(true)} />
      <main className="main-column">
        <section className="dashboard-shell">
          <div className="dashboard-hero-panel">
            <WorkspaceNavbar session={session} onLogout={onLogout} utilityAction={<button className="dashboard-icon-button dashboard-clients-trigger" type="button" aria-label="Ver clientes cadastrados" title="Ver clientes" onClick={() => document.getElementById("dashboard-clients")?.scrollIntoView({ behavior: "smooth", block: "start" })}><UiIcon name="users" /></button>} />
            <div className="dashboard-welcome">
              <div className="dashboard-liquid-field" aria-hidden="true"><i /><i /><i /></div>
              <div className="dashboard-welcome-copy"><p className="eyebrow">Seu estúdio hoje</p><h1>{greeting}, {session.name.split(" ")[0]}</h1><p className="dashboard-date">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(currentTime)}</p></div>
              <div className="dashboard-welcome-aside"><div className="dashboard-orbs" aria-hidden="true"><i /><i /><i /></div><div className="dashboard-metrics dashboard-metrics-inline"><article className="dashboard-metric clients"><UiIcon name="users" /><div><span>Clientes ativos</span><strong>{loading ? "-" : clients.length}</strong><small>Contas em andamento</small></div></article><article className="dashboard-metric posts"><UiIcon name="calendar" /><div><span>Posts este mês</span><strong>128</strong><small>+18% vs mês anterior</small></div></article><article className="dashboard-metric pending"><UiIcon name="clock" /><div><span>Pendentes</span><strong>24</strong><small className="dashboard-alert">8 vencem hoje</small></div></article><article className="dashboard-metric approved"><UiIcon name="check" /><div><span>Aprovados</span><strong>88</strong><small>+20% vs mês anterior</small></div></article></div></div>
            </div>
          </div>

          <div className="dashboard-grid">
            <DashboardClockWidget currentTime={currentTime} />
            <DashboardNotesWidget userId={session.id} canPersist={session.source === "api"} />
            {upcomingPosts.length > 0 ? <DashboardTasksWidget posts={upcomingPosts} /> : null}
            {agendaToday.length > 0 ? <DashboardAgendaWidget
              events={agendaToday}
              canPersist={session.source === "api"}
              onCreated={(created) => {
                if (localDateKey(new Date(created.startsAt)) !== localDateKey(new Date())) return;
                setAgendaToday((current) => [...current, created].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
              }}
              onCompleted={(eventId) => setAgendaToday((current) => current.map((event) => event.id === eventId ? { ...event, isCompleted: true } : event))}
              onRescheduled={(eventId, startsAt) => setAgendaToday((current) => current
                .map((event) => event.id === eventId ? { ...event, startsAt } : event)
                .filter((event) => localDateKey(new Date(event.startsAt)) === localDateKey(new Date()))
                .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()))}
              onDeleted={(eventId) => setAgendaToday((current) => current.filter((event) => event.id !== eventId))}
            /> : null}
            <DashboardCommemorativeWidget clients={clients} />
            {postsToday.length > 0 ? <DashboardTodayPostsWidget items={postsToday} /> : null}
            {approvedPautas.length > 0 ? <DashboardApprovedPautasWidget items={approvedPautas} /> : null}
            {clientActivities.length > 0 ? <DashboardClientActivitiesWidget items={clientActivities} userId={session.id} onSchedule={setScheduleActivity} /> : null}
            {internalMessages.length > 0 ? <DashboardInternalMessagesWidget items={internalMessages} onOpen={(item) => { if (item.clientSlug) window.location.hash = `/admin/${item.clientSlug}`; }} /> : null}
            {clientSubmissions.length > 0 ? <DashboardClientSubmissionsWidget items={clientSubmissions} userId={session.id} /> : null}
          </div>
          <div className="dashboard-section-divider" aria-hidden="true"><span /></div>
          <section id="dashboard-clients" className="dashboard-clients-panel dashboard-clients-full">
            <div className="dashboard-section-head"><div><p className="eyebrow">Projetos</p><h2>Clientes</h2></div></div>
            <div className="dashboard-client-tabs" role="tablist" aria-label="Filtrar clientes">
              <button className={clientFilter === "all" ? "active" : ""} onClick={() => setClientFilter("all")}>Todos <span>({clients.length})</span></button>
              <button className={clientFilter === "mine" ? "active" : ""} onClick={() => setClientFilter("mine")}>Meus <span>({myClients.length})</span></button>
              <button className={clientFilter === "shared" ? "active" : ""} onClick={() => setClientFilter("shared")}>⌯ Compartilhados <span>({sharedClients.length})</span></button>
            </div>
            {loading ? <p className="dashboard-empty">Carregando clientes...</p> : visibleClients.length === 0 ? <p className="dashboard-empty">Não há clientes neste filtro.</p> : <div className="dashboard-clients">
              {visibleClients.map((client) => <DashboardClientCard key={client.id} client={client} socialRevision={clientCardsRevision} onEdit={() => void openEditClient(client)} onDelete={() => void removeClient(client)} onShare={() => void openShareClient(client)} />)}
            </div>}
          </section>
          {scheduledNotice ? <div className="dashboard-scheduled-notice" role="status" aria-live="polite"><span className="dashboard-scheduled-calendar"><UiIcon name="calendar" /><i>✓</i></span><div><strong>Post agendado!</strong><small>{scheduledNotice.title} · {scheduledNotice.clientName}</small></div><span className="dashboard-scheduled-spark one" /><span className="dashboard-scheduled-spark two" /><span className="dashboard-scheduled-spark three" /></div> : null}
        </section>
        {createOpen ? <CreateClientModal form={form} logoFile={logoFile} creating={creating} error={createError} onChange={updateForm} onLogoChange={setLogoFile} onClose={closeCreate} onSubmit={submitClient} /> : null}
        {editClient ? <EditClientModal client={editClient} form={editForm} logoFile={editLogoFile} accesses={clientAccesses} saving={clientActionSaving} error={clientActionError} onChange={(key, value) => setEditForm((current) => ({ ...current, [key]: value }))} onLogoChange={setEditLogoFile} onClose={() => setEditClient(null)} onSubmit={saveEditedClient} /> : null}
        {shareClient ? <ShareClientModal client={shareClient} accesses={clientAccesses} users={managedUsers} userId={shareUserId} role={shareRole} saving={clientActionSaving} error={clientActionError} onUserChange={setShareUserId} onRoleChange={setShareRole} onClose={() => setShareClient(null)} onShare={() => void shareSelectedClient()} /> : null}
        {scheduleActivity ? <DashboardScheduleModal activity={scheduleActivity} onClose={() => setScheduleActivity(null)} onScheduled={() => { setClientActivities((current) => current.filter((item) => item.cardId !== scheduleActivity.cardId)); setScheduledNotice({ title: scheduleActivity.title, clientName: scheduleActivity.clientName }); setScheduleActivity(null); }} /> : null}
      </main>
    </div>
  );
}

function DashboardClockWidget({ currentTime }: { currentTime: Date }) {
  const seconds = currentTime.getSeconds();
  const minutes = currentTime.getMinutes() + seconds / 60;
  const hours = (currentTime.getHours() % 12) + minutes / 60;
  const clockStyle = {
    "--clock-hour": `${hours * 30}deg`,
    "--clock-minute": `${minutes * 6}deg`,
    "--clock-second": `${seconds * 6}deg`,
  } as CSSProperties;
  return <article className="dashboard-clock-widget dashboard-first-row-widget">
    <div className="dashboard-clock-face" style={clockStyle} aria-label={`Agora são ${currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}>
      {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--clock-mark": `${index * 30}deg` } as CSSProperties} />)}
      <span className="dashboard-clock-hand hour" /><span className="dashboard-clock-hand minute" /><span className="dashboard-clock-hand second" /><b />
    </div>
    <div className="dashboard-clock-copy"><small>Horário local</small><strong>{currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{currentTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}</span></div>
  </article>;
}

const DASHBOARD_NOTE_COLORS: Array<{ value: DashboardNoteColor; label: string }> = [
  { value: "yellow", label: "Amarelo" }, { value: "pink", label: "Rosa" }, { value: "blue", label: "Azul" }, { value: "green", label: "Verde" }, { value: "lavender", label: "Lilás" },
];

function DashboardNotesWidget({ userId, canPersist }: { userId: string; canPersist: boolean }) {
  const storageKey = `designhub-v2-dashboard-notes:${userId}`;
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [text, setText] = useState("");
  const [color, setColor] = useState<DashboardNoteColor>("yellow");
  const [reminderDate, setReminderDate] = useState("");
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<DashboardNote | null>(null);
  const [allNotesOpen, setAllNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const writeLocal = (next: DashboardNote[]) => {
    setNotes(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep notes available for this visit. */ }
  };

  useEffect(() => {
    let active = true;
    const localNotes = () => {
      try { return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as DashboardNote[]; } catch { return []; }
    };
    if (!canPersist) { setNotes(localNotes()); return () => { active = false; }; }
    void loadDashboardNotes().then(({ items }) => { if (active) { setNotes(items); window.localStorage.setItem(storageKey, JSON.stringify(items)); } }).catch(() => { if (active) setNotes(localNotes()); });
    return () => { active = false; };
  }, [canPersist, storageKey]);

  useEffect(() => {
    const openComposer = () => { setEditingId(null); setText(""); setReminderDate(""); setColor("yellow"); setError(""); setComposing(true); };
    window.addEventListener("design-hub:open-dashboard-note", openComposer);
    return () => window.removeEventListener("design-hub:open-dashboard-note", openComposer);
  }, []);

  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true); setError("");
    try {
      if (editingId && canPersist) {
        const { note } = await updateDashboardNote(editingId, { text: text.trim(), color, reminderDate: reminderDate || null });
        writeLocal(notes.map((item) => item.id === editingId ? note : item));
      } else if (editingId) {
        writeLocal(notes.map((item) => item.id === editingId ? { ...item, text: text.trim(), color, reminderDate: reminderDate || null, updatedAt: new Date().toISOString() } : item));
      } else if (canPersist) {
        const { note } = await createDashboardNote({ text: text.trim(), color, reminderDate: reminderDate || null });
        writeLocal([note, ...notes]);
      } else {
        const now = new Date().toISOString();
        writeLocal([{ id: crypto.randomUUID(), text: text.trim(), color, reminderDate: reminderDate || null, createdAt: now, updatedAt: now }, ...notes]);
      }
      setText(""); setReminderDate(""); setColor("yellow"); setEditingId(null); setComposing(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o lembrete."); }
    finally { setSaving(false); }
  };

  const removeNote = async (note: DashboardNote) => {
    const next = notes.filter((item) => item.id !== note.id);
    if (viewingNote?.id === note.id) setViewingNote(null);
    writeLocal(next);
    if (canPersist) try { await deleteDashboardNote(note.id); } catch { writeLocal(notes); }
  };

  const cycleColor = async (note: DashboardNote) => {
    const index = DASHBOARD_NOTE_COLORS.findIndex((item) => item.value === note.color);
    const nextColor = DASHBOARD_NOTE_COLORS[(index + 1) % DASHBOARD_NOTE_COLORS.length].value;
    writeLocal(notes.map((item) => item.id === note.id ? { ...item, color: nextColor } : item));
    if (canPersist) try { await updateDashboardNote(note.id, { color: nextColor }); } catch { writeLocal(notes); }
  };

  const editNote = (note: DashboardNote) => {
    setViewingNote(null);
    setAllNotesOpen(false);
    setText(note.text); setColor(note.color); setReminderDate(note.reminderDate ?? ""); setEditingId(note.id); setError(""); setComposing(true);
  };

  const closeComposer = () => {
    setText(""); setReminderDate(""); setColor("yellow"); setEditingId(null); setError(""); setComposing(false);
  };

  const formatReminder = (value: string | null) => {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    const today = new Date(); const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    if (value === localDateKey(today)) return "Hoje";
    if (value === localDateKey(tomorrow)) return "Amanhã";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
  };

  const openNote = (note: DashboardNote) => {
    setAllNotesOpen(false);
    setViewingNote(note);
  };

  const renderNote = (note: DashboardNote) => <section className={`dashboard-postit ${note.color}`} key={note.id} role="button" tabIndex={0} aria-label={`Ler lembrete: ${note.text}`} onClick={() => openNote(note)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openNote(note); } }}>
    <span className="dashboard-postit-pin" />
    <div className="dashboard-postit-actions"><button type="button" onClick={(event) => { event.stopPropagation(); editNote(note); }} title="Editar lembrete" aria-label="Editar lembrete">✎</button><button type="button" onClick={(event) => { event.stopPropagation(); void cycleColor(note); }} title="Trocar cor" aria-label="Trocar cor">●</button><button type="button" onClick={(event) => { event.stopPropagation(); void removeNote(note); }} title="Remover lembrete" aria-label="Remover lembrete">×</button></div>
    <p>{note.text}</p>
    {note.reminderDate ? <time dateTime={note.reminderDate}>{formatReminder(note.reminderDate)}</time> : <small>Sem data</small>}
  </section>;

  return <>
    <section className="dashboard-postits-board dashboard-first-row-widget" aria-label="Meus lembretes"><header><div><span className="dashboard-notes-icon">✦</span><h3>Meus lembretes</h3></div><button type="button" onClick={() => window.dispatchEvent(new Event("design-hub:open-dashboard-note"))} aria-label="Criar nova nota" title="Nova nota">＋</button></header>{notes.length ? <><div className="dashboard-notes-list">{notes.slice(0, 2).map(renderNote)}</div>{notes.length > 2 ? <button className="dashboard-notes-more" type="button" onClick={() => setAllNotesOpen(true)}>+ {notes.length - 2} {notes.length - 2 === 1 ? "lembrete" : "lembretes"}</button> : null}</> : <button className="dashboard-notes-empty" type="button" onClick={() => window.dispatchEvent(new Event("design-hub:open-dashboard-note"))}><span>＋</span><strong>Crie um lembrete</strong><small>Fixe aqui algo que não pode esquecer</small></button>}</section>
    {allNotesOpen ? createPortal(<div className="modal-backdrop dashboard-note-backdrop" onMouseDown={() => setAllNotesOpen(false)}><section className="dashboard-note-modal dashboard-notes-library" role="dialog" aria-modal="true" aria-labelledby="dashboard-notes-library-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="dashboard-notes-icon">✦</span><div><small>LEMBRETES PESSOAIS</small><h2 id="dashboard-notes-library-title">Todos os post-its</h2></div></div><button type="button" className="icon-close" onClick={() => setAllNotesOpen(false)} aria-label="Fechar">×</button></header><div className="dashboard-notes-library-list">{notes.map(renderNote)}</div><footer><button type="button" className="ghost-button" onClick={() => setAllNotesOpen(false)}>Fechar</button><button type="button" className="gradient-button" onClick={() => { setAllNotesOpen(false); window.dispatchEvent(new Event("design-hub:open-dashboard-note")); }}>Nova nota</button></footer></section></div>, document.body) : null}
    {viewingNote ? createPortal(<div className="modal-backdrop dashboard-note-backdrop" onMouseDown={() => setViewingNote(null)}><section className={`dashboard-note-modal dashboard-note-view ${viewingNote.color}`} role="dialog" aria-modal="true" aria-labelledby="dashboard-note-view-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="dashboard-notes-icon">✦</span><div><small>LEMBRETE PESSOAL</small><h2 id="dashboard-note-view-title">Meu post-it</h2></div></div><button type="button" className="icon-close" onClick={() => setViewingNote(null)} aria-label="Fechar">×</button></header><div className="dashboard-note-view-copy"><p>{viewingNote.text}</p>{viewingNote.reminderDate ? <time dateTime={viewingNote.reminderDate}>{formatReminder(viewingNote.reminderDate)}</time> : <small>Sem data</small>}</div><footer><button type="button" className="ghost-button" onClick={() => setViewingNote(null)}>Fechar</button><button type="button" className="gradient-button" onClick={() => editNote(viewingNote)}>Editar nota</button></footer></section></div>, document.body) : null}
    {composing ? createPortal(<div className="modal-backdrop dashboard-note-backdrop" onMouseDown={() => { if (!saving) closeComposer(); }}><section className="dashboard-note-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-note-modal-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="dashboard-notes-icon">✦</span><div><small>LEMBRETE PESSOAL</small><h2 id="dashboard-note-modal-title">{editingId ? "Editar post-it" : "Novo post-it"}</h2></div></div><button type="button" className="icon-close" onClick={closeComposer} aria-label="Fechar">×</button></header><form className="dashboard-note-compose" onSubmit={addNote}><textarea autoFocus maxLength={500} value={text} onChange={(event) => setText(event.target.value)} placeholder="O que você não pode esquecer?" /><div><label>Quando<input type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} /></label><fieldset aria-label="Cor da nota">{DASHBOARD_NOTE_COLORS.map((item) => <button key={item.value} type="button" className={`${item.value} ${color === item.value ? "active" : ""}`} title={item.label} aria-label={item.label} onClick={() => setColor(item.value)} />)}</fieldset><button className="dashboard-note-save" type="submit" disabled={saving || !text.trim()}>{saving ? "Salvando..." : editingId ? "Salvar nota" : "Fixar nota"}</button></div>{error ? <p>{error}</p> : null}</form></section></div>, document.body) : null}
  </>;
}

function DashboardTasksWidget({ posts }: { posts: DashboardUpcomingPost[] }) {
  const [expanded, setExpanded] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(() => Math.min(3, posts.length));
  const widgetRef = useRef<HTMLElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const postCount = posts.length;
  useEffect(() => {
    const widget = widgetRef.current;
    const rows = rowsRef.current;
    if (!widget || !rows || expanded) return;

    const fitRows = () => {
      const firstRow = rows.querySelector<HTMLElement>("article");
      if (!firstRow) return;
      const widgetRect = widget.getBoundingClientRect();
      const rowsRect = rows.getBoundingClientRect();
      const styles = window.getComputedStyle(widget);
      const bottomPadding = Number.parseFloat(styles.paddingBottom) || 0;
      const gap = Number.parseFloat(window.getComputedStyle(rows).rowGap) || 0;
      const rowHeight = firstRow.getBoundingClientRect().height;
      const availableWithoutButton = widgetRect.bottom - bottomPadding - rowsRect.top;
      const allRowsHeight = posts.length * rowHeight + Math.max(0, posts.length - 1) * gap;
      if (allRowsHeight <= availableWithoutButton + 1) {
        setVisibleLimit(posts.length);
        return;
      }
      const moreButtonSpace = 34;
      const availableWithButton = Math.max(rowHeight, availableWithoutButton - moreButtonSpace);
      setVisibleLimit(Math.max(1, Math.min(posts.length, Math.floor((availableWithButton + gap) / (rowHeight + gap)))));
    };

    fitRows();
    const observer = new ResizeObserver(fitRows);
    observer.observe(widget);
    return () => observer.disconnect();
  }, [expanded, posts]);
  const displayedPosts = expanded ? posts : posts.slice(0, visibleLimit);
  const hiddenCount = Math.max(0, posts.length - displayedPosts.length);
  return <section className="dashboard-tasks-widget dashboard-first-row-widget" ref={widgetRef}>
    <header><div><span className="dashboard-task-icon">◴</span><h3>Próximos posts</h3></div><span className="dashboard-task-count">Próximos 3 dias ({postCount})</span></header>
    <div className="dashboard-task-rows" ref={rowsRef}>
      {displayedPosts.map((post) => <article key={post.id}>
        <span className="dashboard-task-dot" />
        <span className="dashboard-task-avatar">{post.clientLogoUrl ? <img src={post.clientLogoUrl} alt="" /> : post.clientName.slice(0, 2).toUpperCase()}</span>
        <div><strong>{post.title}</strong><small>{post.clientName}</small></div>
        <span className="dashboard-task-status">⌁ {post.clientLabel || "Agendado"}</span>
        <span className="dashboard-task-date">◷ {formatDashboardDate(post.scheduledAt)}</span>
      </article>)}
      {displayedPosts.length === 0 ? <p className="dashboard-upcoming-empty">Nenhum post previsto para os próximos 3 dias.</p> : null}
    </div>
    {hiddenCount > 0 ? <button className="dashboard-task-link" type="button" onClick={() => setExpanded(true)}>Ver mais...</button> : null}
  </section>;
}

function DashboardAgendaWidget({ events, canPersist, onCreated, onCompleted, onRescheduled, onDeleted }: { events: AgendaEvent[]; canPersist: boolean; onCreated: (event: AgendaEvent) => void; onCompleted: (eventId: string) => void; onRescheduled: (eventId: string, startsAt: string) => void; onDeleted: (eventId: string) => void }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [eventAction, setEventAction] = useState<"" | "reschedule" | "delete">("");
  const [labels, setLabels] = useState<AgendaLabel[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [labelId, setLabelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quickOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setQuickOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [quickOpen, saving]);

  const openQuickCreate = () => {
    const next = new Date();
    next.setMinutes(Math.ceil((next.getMinutes() + 1) / 15) * 15, 0, 0);
    setTitle(""); setDescription(""); setStartsAt(toDateTimeLocal(next.toISOString())); setLabelId(""); setError("");
    setQuickOpen(true);
    void loadAgendaLabels().then((result) => setLabels(result.items)).catch(() => setLabels([]));
  };

  const submitQuickEvent = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!canPersist) { setError("Entre com seu e-mail e senha para salvar compromissos no banco."); return; }
    if (!title.trim() || !startsAt) { setError("Preencha o nome e a data do compromisso."); return; }
    setSaving(true); setError("");
    try {
      const selectedLabel = labels.find((label) => label.id === labelId);
      const result = await createAgendaEvent({ title: title.trim(), taskDescription: description.trim() || null, startsAt, color: selectedLabel?.color ?? "#c9f7df", labelId: labelId || null, recurrenceType: "none" });
      onCreated({ id: result.id, title: title.trim(), taskDescription: description.trim() || null, startsAt, color: selectedLabel?.color ?? "#c9f7df", isCompleted: false, labelId: labelId || null, labelName: selectedLabel?.name ?? null });
      setQuickOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o compromisso."); }
    finally { setSaving(false); }
  };

  const completeEvent = async (agendaEvent: AgendaEvent) => {
    if (!canPersist || completingId) return;
    setCompletingId(agendaEvent.id); setError("");
    try { await updateAgendaEvent(agendaEvent.sourceEventId ?? agendaEvent.id, { isCompleted: true }); onCompleted(agendaEvent.id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir o compromisso."); }
    finally { setCompletingId(""); }
  };

  const openEventActions = (agendaEvent: AgendaEvent) => {
    setSelectedEvent(agendaEvent);
    setRescheduleDate(localDateKey(new Date(agendaEvent.startsAt)));
    setError("");
  };

  const rescheduleEvent = async () => {
    if (!selectedEvent || !rescheduleDate || !canPersist || eventAction) return;
    const currentLocal = toDateTimeLocal(selectedEvent.startsAt);
    const nextStartsAt = `${rescheduleDate}T${currentLocal.slice(11, 16)}`;
    setEventAction("reschedule"); setError("");
    try {
      await updateAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id, { startsAt: nextStartsAt });
      onRescheduled(selectedEvent.id, nextStartsAt);
      setSelectedEvent(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível reagendar o compromisso."); }
    finally { setEventAction(""); }
  };

  const removeEvent = async () => {
    if (!selectedEvent || !canPersist || eventAction) return;
    if (!window.confirm("Excluir este compromisso? Esta ação não pode ser desfeita.")) return;
    setEventAction("delete"); setError("");
    try {
      await deleteAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id);
      onDeleted(selectedEvent.id);
      setSelectedEvent(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível excluir o compromisso."); }
    finally { setEventAction(""); }
  };

  return <>
    <section className="dashboard-tasks-widget dashboard-agenda-widget dashboard-first-row-widget">
      <header><div><span className="dashboard-task-icon">▣</span><h3>Agenda de hoje</h3></div><div className="dashboard-agenda-header-actions"><button type="button" className="dashboard-agenda-add" onClick={openQuickCreate}><span>＋</span>Novo</button><span className="dashboard-task-count">{events.length} {events.length === 1 ? "compromisso" : "compromissos"}</span></div></header>
      {events.length ? <div className="dashboard-task-rows">{events.map((agendaEvent) => <article key={agendaEvent.id} className={agendaEvent.isCompleted ? "completed dashboard-agenda-event-row" : "dashboard-agenda-event-row"} role="button" tabIndex={0} onClick={() => openEventActions(agendaEvent)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEventActions(agendaEvent); } }}><span className="dashboard-task-dot" style={{ backgroundColor: agendaEvent.isCompleted ? "#35b987" : agendaEvent.color }} /><span className="agenda-time">{formatAgendaTime(agendaEvent.startsAt)}</span><div><strong>{agendaEvent.title}</strong><small>{agendaEvent.taskDescription || agendaEvent.labelName || agendaEvent.clientName || "Compromisso"}{agendaEvent.isCompleted ? " · Concluído" : ""}</small></div><button type="button" className={agendaEvent.isCompleted ? "dashboard-agenda-complete completed" : "dashboard-agenda-complete"} disabled={agendaEvent.isCompleted || completingId === agendaEvent.id} onClick={(event) => { event.stopPropagation(); void completeEvent(agendaEvent); }} aria-label={agendaEvent.isCompleted ? `${agendaEvent.title} concluído` : `Marcar ${agendaEvent.title} como feito`} title={agendaEvent.isCompleted ? "Compromisso concluído" : "Marcar como feito"}><UiIcon name="check" /></button></article>)}</div> : <p className="dashboard-agenda-empty">Nenhum compromisso para hoje.</p>}
      {error && !quickOpen ? <p className="dashboard-agenda-error">{error}</p> : null}
      <NavLink to="/agenda" className="dashboard-task-link dashboard-agenda-link"><UiIcon name="calendar" /><strong>Ver agenda completa</strong><span>→</span></NavLink>
    </section>
    {quickOpen ? createPortal(<div className="modal-backdrop dashboard-agenda-quick-backdrop" onMouseDown={() => { if (!saving) setQuickOpen(false); }}><form className="dashboard-agenda-quick-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submitQuickEvent}><header><div><p className="eyebrow">Agenda de hoje</p><h2>Novo compromisso rápido</h2></div><button type="button" className="icon-close" onClick={() => { if (!saving) setQuickOpen(false); }} aria-label="Fechar">×</button></header><label className="field-stack"><span>Nome</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Revisar calendário do cliente" required /></label><label className="field-stack"><span>Descrição</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes ou observações do compromisso" /></label><div className="dashboard-agenda-quick-grid"><label className="field-stack"><span>Data e horário</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label className="field-stack"><span>Etiqueta</span><select value={labelId} onChange={(event) => setLabelId(event.target.value)}><option value="">Sem etiqueta</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label></div>{error ? <p className="form-feedback error-text">{error}</p> : null}<footer><button type="button" className="ghost-button" disabled={saving} onClick={() => setQuickOpen(false)}>Cancelar</button><button type="submit" className="gradient-button" disabled={saving}>{saving ? "Salvando..." : "Adicionar compromisso"}</button></footer></form></div>, document.body) : null}
    {selectedEvent ? createPortal(<div className="modal-backdrop dashboard-agenda-quick-backdrop" onMouseDown={() => { if (!eventAction) setSelectedEvent(null); }}><section className="dashboard-agenda-action-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Compromisso</p><h2>{selectedEvent.title}</h2></div><button type="button" className="icon-close" onClick={() => setSelectedEvent(null)} aria-label="Fechar">×</button></header><p>{selectedEvent.taskDescription || selectedEvent.labelName || selectedEvent.clientName || "Sem descrição."}</p><div className="dashboard-agenda-current-date"><UiIcon name="calendar" /><span><small>Data atual</small><strong>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedEvent.startsAt))}</strong></span></div>{selectedEvent.recurrenceType && selectedEvent.recurrenceType !== "none" ? <small className="agenda-series-note">Este compromisso é recorrente; a alteração será aplicada à série.</small> : null}<label className="field-stack dashboard-agenda-date-picker"><span>Escolha o novo dia</span><input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} /></label>{error ? <p className="form-feedback error-text">{error}</p> : null}<footer><button type="button" className="danger-button" disabled={Boolean(eventAction)} onClick={() => void removeEvent()}>{eventAction === "delete" ? "Excluindo..." : "Excluir"}</button><button type="button" className="gradient-button" disabled={Boolean(eventAction) || !rescheduleDate} onClick={() => void rescheduleEvent()}>{eventAction === "reschedule" ? "Reagendando..." : "Reagendar"}</button></footer></section></div>, document.body) : null}
  </>;
}

function formatDashboardDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--/--" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}
function formatAgendaTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "--:--" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date); }

function useCalendarArtworkHover() {
  const [artwork, setArtwork] = useState<{ url: string; title: string; x: number; y: number } | null>(null);
  const position = (event: React.MouseEvent<HTMLElement>, url: string, title: string) => {
    if (!url) return;
    const width = 270;
    const height = 245;
    const x = Math.max(12, Math.min(event.clientX + 18, window.innerWidth - width - 12));
    const y = event.clientY + height + 18 > window.innerHeight ? Math.max(12, event.clientY - height - 14) : event.clientY + 18;
    setArtwork({ url, title, x, y });
  };
  return {
    show: position,
    move: position,
    hide: () => setArtwork(null),
    preview: artwork ? createPortal(<figure className="calendar-artwork-preview" style={{ left: artwork.x, top: artwork.y }}><img src={artwork.url} alt={`Prévia de ${artwork.title}`} /><figcaption>{artwork.title}</figcaption></figure>, document.body) : null,
  };
}

function AgendaPage({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  const [month, setMonth] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("month");
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [labels, setLabels] = useState<AgendaLabel[]>([]);
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [clientAccountId, setClientAccountId] = useState("");
  const [color, setColor] = useState("#c9f7df");
  const [recurrenceType, setRecurrenceType] = useState<AgendaRecurrence>("none");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [meetLinkEdit, setMeetLinkEdit] = useState("");
  const [clientAccountIdEdit, setClientAccountIdEdit] = useState("");
  const [labelId, setLabelId] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4285f4");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [draggedAgendaEvent, setDraggedAgendaEvent] = useState<AgendaEvent | null>(null);
  const [agendaDropDay, setAgendaDropDay] = useState("");
  const range = useMemo(() => agendaViewRange(month, calendarView), [month, calendarView]);

  const [clientsError, setClientsError] = useState("");
  useEffect(() => {
    if (!session) return;
    void loadAgendaEvents(range.from, range.to).then((agenda) => setEvents(agenda.items)).catch(() => setEvents([]));
    void listAdminClients().then((result) => { setClients(result.items); setClientsError(""); }).catch((cause) => setClientsError(cause instanceof Error ? cause.message : "Não foi possível carregar a lista de clientes."));
    void loadAgendaLabels().then((result) => setLabels(result.items)).catch(() => setLabels([]));
  }, [range.from, range.to, refresh, session]);
  useEffect(() => {
    if (!createOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCreateOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [createOpen]);

  if (!session || session.role === "client") return <Navigate to="/login" replace />;

  async function submitAgendaEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (session?.source !== "api") {
      setError("Esta é uma sessão de demonstração. Saia e entre novamente com seu e-mail e senha para salvar no banco.");
      return;
    }
    if (!title.trim() || !startsAt) {
      setError("Informe o compromisso e a data com horário.");
      return;
    }
    try {
      await createAgendaEvent({ title: title.trim(), taskDescription: taskDescription.trim() || null, startsAt, color, clientAccountId: clientAccountId || null, labelId: labelId || null, recurrenceType, repeatUntil: repeatUntil || null, meetLink: meetLink.trim() || null });
      setTitle(""); setTaskDescription(""); setStartsAt(""); setClientAccountId(""); setLabelId(""); setRecurrenceType("none"); setRepeatUntil(""); setMeetLink("");
      setCreateOpen(false); setRefresh((value) => value + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível criar o compromisso.";
      setError(message === "Sessão obrigatória." || message === "Token inválido ou expirado." ? "Sua sessão expirou. Saia e entre novamente para salvar no banco." : message);
    }
  }

  function openAgendaDay(day: Date) {
    const selected = new Date(day);
    selected.setHours(9, 0, 0, 0);
    setStartsAt(toDateTimeLocal(selected.toISOString()));
    setTitle(""); setTaskDescription(""); setClientAccountId(""); setLabelId(""); setColor("#c9f7df"); setRecurrenceType("none"); setRepeatUntil(""); setMeetLink(""); setError("");
    setCreateOpen(true);
  }

  async function addAgendaLabel() {
    if (!newLabelName.trim()) return;
    try {
      const result = await createAgendaLabel({ name: newLabelName.trim(), color: newLabelColor });
      setLabels((current) => [...current, result.label]);
      setNewLabelName("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar a etiqueta."); }
  }

  async function removeAgendaLabel(id: string) {
    try { await deleteAgendaLabel(id); setLabels((current) => current.filter((label) => label.id !== id)); if (labelId === id) setLabelId(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível excluir a etiqueta."); }
  }

  async function dropAgendaEvent(day: Date) {
    const agendaEvent = draggedAgendaEvent;
    setDraggedAgendaEvent(null); setAgendaDropDay("");
    if (!agendaEvent || calendarView === "day") return;
    const destination = localDateKey(day);
    if (destination === localDateKey(new Date(agendaEvent.startsAt))) return;
    const currentLocal = toDateTimeLocal(agendaEvent.startsAt);
    const nextStartsAt = `${destination}T${currentLocal.slice(11, 16)}`;
    const sourceId = agendaEvent.sourceEventId ?? agendaEvent.id;
    setEvents((current) => current.map((item) => item.id === sourceId ? { ...item, startsAt: nextStartsAt } : item));
    setError("");
    try {
      await updateAgendaEvent(sourceId, { startsAt: nextStartsAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível mover o compromisso.");
      setRefresh((value) => value + 1);
    }
  }

  const visibleEvents = expandAgendaEvents(events, range.from, range.to);
  const eventsByDay = new Map<string, AgendaEvent[]>();
  visibleEvents.forEach((event) => {
    const key = localDateKey(new Date(event.startsAt));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  });
  const mobileAgendaDays = calendarView === "month"
    ? range.days.filter((day) => day.getMonth() === month.getMonth() && day.getFullYear() === month.getFullYear())
    : range.days;

  return <div className="page-grid admin-layout agenda-layout">
    <AdminRail session={session} />
    <main className="main-column agenda-main-column">
      <AgendaTopNavigation session={session} onLogout={onLogout} />
      <PageContextBanner eyebrow="Agenda" title="Planejamento da equipe" description="Organize compromissos, prazos e rotinas de cada cliente." metrics={[{ label: "Visão atual", value: calendarView === "day" ? "Dia" : calendarView === "week" ? "Semana" : "Mês", note: "Período selecionado", icon: <UiIcon name="calendar" />, tone: "posts" }, { label: "Compromissos", value: visibleEvents.length, note: "No período", icon: <UiIcon name="clock" />, tone: "pending" }]} titleClassName="billing-banner-title" titleIcon={<UiIcon name="calendar" />} />
      <section className="agenda-page">
        <header className="agenda-toolbar">
          <button className="ghost-button" onClick={() => setMonth(new Date())}>Hoje</button>
          <div className="agenda-month-nav"><button aria-label="Período anterior" onClick={() => setMonth((date) => moveAgendaDate(date, calendarView, -1))}>‹</button><strong>{formatAgendaRangeTitle(month, calendarView)}</strong><button aria-label="Próximo período" onClick={() => setMonth((date) => moveAgendaDate(date, calendarView, 1))}>›</button></div>
          <div className="agenda-view-switch"><button className={calendarView === "day" ? "active" : ""} onClick={() => setCalendarView("day")}>▣ Dia</button><button className={calendarView === "week" ? "active" : ""} onClick={() => setCalendarView("week")}>▣ Semana</button><button className={calendarView === "month" ? "active" : ""} onClick={() => setCalendarView("month")}>▣ Mês</button></div>
          <button className="ghost-button agenda-labels-button" onClick={() => { setError(""); setLabelsOpen(true); }}>◇ Etiquetas</button>
          <button className="gradient-button" onClick={() => setCreateOpen(true)}>＋ Novo compromisso</button>
        </header>
        <section className={`agenda-calendar agenda-calendar-${calendarView}`}>
          {calendarView !== "day" ? <div className="agenda-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <strong key={day}>{day}</strong>)}</div> : null}
          <div className="agenda-month-grid">{range.days.map((day) => {
            const key = localDateKey(day); const dayEvents = eventsByDay.get(key) ?? []; const isCurrentMonth = calendarView !== "month" || day.getMonth() === month.getMonth();
            const dropActive = agendaDropDay === key;
            return <article key={key} className={`${isCurrentMonth ? "agenda-day" : "agenda-day muted"}${dropActive ? " agenda-day-drop-active" : ""}`} onClick={() => openAgendaDay(day)} onDragOver={(event) => { if (!draggedAgendaEvent || calendarView === "day") return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (agendaDropDay !== key) setAgendaDropDay(key); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAgendaDropDay(""); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void dropAgendaEvent(day); }}><time>{day.getDate()}</time>{dayEvents.slice(0, 3).map((item) => <div className={`agenda-event-pill${draggedAgendaEvent?.id === item.id ? " dragging" : ""}`} key={item.id} draggable={calendarView !== "day"} style={{ backgroundColor: item.color, color: calendarTextColor(item.color) }} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.sourceEventId ?? item.id); setDraggedAgendaEvent(item); }} onDragEnd={() => { setDraggedAgendaEvent(null); setAgendaDropDay(""); }} onClick={(event) => { event.stopPropagation(); setSelectedEvent(item); setRescheduleAt(toDateTimeLocal(item.startsAt)); setMeetLinkEdit(item.meetLink ?? ""); setClientAccountIdEdit(item.clientAccountId ?? ""); }}><span>{formatAgendaTime(item.startsAt)}</span> {item.title}</div>)}{dayEvents.length > 3 ? <span className="agenda-more">+{dayEvents.length - 3} mais</span> : null}</article>;
          })}</div>
        </section>
        <div className="social-calendar-mobile agenda-mobile-list">
          {mobileAgendaDays.map((day) => {
            const key = localDateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === localDateKey(new Date());
            return <article className={`social-agenda-day${isToday ? " today" : ""}`} key={key}>
              <header><div><time>{day.getDate()}</time><span><strong>{new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(day)}</strong><small>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(day)}</small></span></div><button type="button" onClick={() => openAgendaDay(day)} aria-label={`Adicionar compromisso em ${new Intl.DateTimeFormat("pt-BR").format(day)}`}>＋</button></header>
              <div className="social-agenda-items">
                {dayEvents.map((item) => <button key={item.id} type="button" className="social-agenda-item appointment" style={{ "--calendar-event-color": item.color } as CSSProperties} onClick={() => { setSelectedEvent(item); setRescheduleAt(toDateTimeLocal(item.startsAt)); setMeetLinkEdit(item.meetLink ?? ""); setClientAccountIdEdit(item.clientAccountId ?? ""); }}><span className="social-agenda-time">{formatAgendaTime(item.startsAt)}</span><i><UiIcon name="clock" /></i><span><strong>{item.title}</strong><small>{item.taskDescription || item.labelName || item.clientName || "Compromisso"}</small></span><b>›</b></button>)}
                {dayEvents.length === 0 ? <button type="button" className="social-agenda-empty" onClick={() => openAgendaDay(day)}>＋ Adicionar compromisso</button> : null}
              </div>
            </article>;
          })}
        </div>
      </section>
      {createOpen ? <div className="modal-backdrop agenda-modal-backdrop" onMouseDown={() => setCreateOpen(false)}>
        <form className="agenda-create-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submitAgendaEvent}>
          <div className="column-editor-head"><div><p className="eyebrow">Agenda</p><h3>Novo compromisso</h3></div><button type="button" className="icon-close" onClick={() => setCreateOpen(false)}>×</button></div>
          <label className="field-stack">Compromisso<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Reunião com cliente" /></label>
          <label className="field-stack">Tarefa a realizar<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Ex.: Preparar pauta, revisar design e enviar para aprovação." rows={4} /></label>
          <label className="field-stack">Data e horário<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label className="field-stack">Repetição<select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as AgendaRecurrence)}><option value="none">Uma vez</option><option value="weekdays">De segunda a sexta</option><option value="weekly">Toda semana</option><option value="monthly_nth_weekday">Uma vez por mês, no mesmo dia da semana</option></select></label>
          {recurrenceType !== "none" ? <label className="field-stack">Repetir até<input type="date" value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} /></label> : null}
          <label className="field-stack">Cliente<select value={clientAccountId} onChange={(event) => setClientAccountId(event.target.value)}><option value="">Sem cliente específico</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>{clientsError ? <em>{clientsError}</em> : null}</label>
          <label className="field-stack">Etiqueta<select value={labelId} onChange={(event) => { const nextId = event.target.value; setLabelId(nextId); const label = labels.find((item) => item.id === nextId); if (label) setColor(label.color); }}><option value="">Sem etiqueta</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
          <label className="field-stack">Cor<input type="color" value={color} onChange={(event) => { setColor(event.target.value); setLabelId(""); }} /></label>
          <label className="field-stack">Link do Google Meet (opcional)<input value={meetLink} onChange={(event) => setMeetLink(event.target.value)} placeholder="https://meet.google.com/..." /></label>
          {error ? <p className="form-feedback error-text">{error}</p> : null}<button className="gradient-button" type="submit">Criar compromisso</button>
        </form>
      </div> : null}
      {labelsOpen ? <div className="modal-backdrop" onClick={() => setLabelsOpen(false)}><section className="agenda-label-modal" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Agenda</p><h3>Gerenciar etiquetas</h3></div><button className="icon-close" onClick={() => setLabelsOpen(false)}>×</button></header><div className="agenda-label-create"><input value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} placeholder="Nome da etiqueta" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addAgendaLabel(); } }} /><input type="color" value={newLabelColor} onChange={(event) => setNewLabelColor(event.target.value)} /><button className="gradient-button" onClick={() => void addAgendaLabel()} aria-label="Criar etiqueta">＋</button></div><div className="agenda-label-list">{labels.length === 0 ? <p>Crie sua primeira etiqueta para usar em tarefas recorrentes.</p> : labels.map((label) => <article key={label.id} style={{ "--agenda-label-color": label.color } as CSSProperties}><span /><strong>{label.name}</strong><button onClick={() => void removeAgendaLabel(label.id)} aria-label={`Excluir ${label.name}`}>×</button></article>)}</div></section></div> : null}
      {selectedEvent ? <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}><section className="agenda-detail-modal" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Compromisso</p><h3>{selectedEvent.title}</h3></div><button className="icon-close" onClick={() => setSelectedEvent(null)}>×</button></header><p>{selectedEvent.taskDescription || "Sem tarefa detalhada."}</p><dl><div><dt>Quando</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedEvent.startsAt))}</dd></div><div><dt>Cliente</dt><dd>{selectedEvent.clientName || "Sem cliente específico"}</dd></div><div><dt>Etiqueta</dt><dd>{selectedEvent.labelName || "Sem etiqueta"}</dd></div><div><dt>Repetição</dt><dd>{selectedEvent.recurrenceType === "weekdays" ? "Segunda a sexta" : selectedEvent.recurrenceType === "weekly" ? "Toda semana" : selectedEvent.recurrenceType === "monthly_nth_weekday" ? "Mensal, no mesmo dia da semana" : "Uma vez"}</dd></div></dl>{selectedEvent.meetLink ? <a className="ghost-button" href={selectedEvent.meetLink} target="_blank" rel="noreferrer"><UiIcon name="link" />Entrar no Google Meet</a> : null}{selectedEvent.recurrenceType !== "none" ? <p className="agenda-series-note">Este é um compromisso recorrente: reagendar ou excluir altera toda a série.</p> : null}<label className="field-stack agenda-reschedule-field">Reagendar para<input type="datetime-local" value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} /></label><label className="field-stack">Cliente<select value={clientAccountIdEdit} onChange={(event) => setClientAccountIdEdit(event.target.value)}><option value="">Sem cliente específico</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="field-stack">Link do Google Meet<input value={meetLinkEdit} onChange={(event) => setMeetLinkEdit(event.target.value)} placeholder="https://meet.google.com/..." /></label><div className="agenda-detail-actions"><button className="ghost-button" onClick={async () => { if (!rescheduleAt) return; await updateAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id, { startsAt: rescheduleAt }); setSelectedEvent(null); setRefresh((value) => value + 1); }}>Salvar nova data</button><button className="ghost-button" onClick={async () => { await updateAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id, { clientAccountId: clientAccountIdEdit || null }); setSelectedEvent(null); setRefresh((value) => value + 1); }}>Salvar cliente</button><button className="ghost-button" onClick={async () => { await updateAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id, { meetLink: meetLinkEdit.trim() || null }); setSelectedEvent(null); setRefresh((value) => value + 1); }}>Salvar link do Meet</button><button className="danger-button" onClick={async () => { if (!window.confirm("Excluir este compromisso? Uma repetição excluirá a série inteira.")) return; await deleteAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id); setSelectedEvent(null); setRefresh((value) => value + 1); }}>Excluir</button></div></section></div> : null}
    </main>
  </div>;
}
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function moveAgendaDate(date: Date, view: "day" | "week" | "month", direction: -1 | 1) { const next = new Date(date); if (view === "month") next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + (view === "week" ? 7 : 1) * direction); return next; }
function formatAgendaRangeTitle(anchor: Date, view: "day" | "week" | "month") { const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }); if (view === "day") return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(anchor); if (view === "week") { const range = agendaViewRange(anchor, "week"); return `${date.format(range.days[0])} - ${date.format(range.days[6])}`; } return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(anchor); }
function agendaViewRange(anchor: Date, view: "day" | "week" | "month") { const first = new Date(anchor.getFullYear(), anchor.getMonth(), view === "month" ? 1 : anchor.getDate()); const start = new Date(first); const count = view === "day" ? 1 : view === "week" ? 7 : 42; if (view === "month") start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); else if (view === "week") start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); const days = Array.from({ length: count }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); const end = new Date(days[days.length - 1]); end.setDate(end.getDate() + 1); return { from: start.toISOString(), to: end.toISOString(), days }; }
function expandAgendaEvents(events: AgendaEvent[], from: string, to: string) { const rangeStart = new Date(from); const rangeEnd = new Date(to); const items: AgendaEvent[] = []; for (const event of events) { const start = new Date(event.startsAt); const until = event.repeatUntil ? new Date(`${event.repeatUntil}T23:59:59`) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()); const recurring = event.recurrenceType && event.recurrenceType !== "none"; for (let day = new Date(start); day < rangeEnd && day <= until; day.setDate(day.getDate() + 1)) { const eligible = !recurring ? day.getTime() === start.getTime() : event.recurrenceType === "weekdays" ? day.getDay() >= 1 && day.getDay() <= 5 : event.recurrenceType === "weekly" ? day.getDay() === start.getDay() : day.getDay() === start.getDay() && Math.ceil(day.getDate() / 7) === Math.ceil(start.getDate() / 7); if (eligible && day >= rangeStart) { const occurrence = new Date(day); occurrence.setHours(start.getHours(), start.getMinutes(), 0, 0); items.push({ ...event, id: `${event.id}:${localDateKey(day)}`, sourceEventId: event.id, startsAt: occurrence.toISOString() }); } if (!recurring) break; } } return items; }

function DashboardTodayPostsWidget({ items }: { items: DashboardTodayPost[] }) {
  const [expanded, setExpanded] = useState(false);
  const initialLimit = 3;
  const displayedItems = expanded ? items : items.slice(0, initialLimit);
  const hasMore = items.length > initialLimit;
  const time = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "--:--" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  };
  return <section className="dashboard-list dashboard-today-posts"><header><div><UiIcon name="calendar" /><h3>Posts para Hoje</h3></div><span>{items.length}</span></header>{displayedItems.length ? <div>{displayedItems.map((item) => <article key={item.id}><span className="dashboard-list-dot" /><img src={item.clientLogoUrl || item.mediaUrl || ""} alt="" /><div><strong>{item.title}</strong><small>{item.clientName}</small></div><time>{time(item.scheduledAt)}</time></article>)}</div> : <p className="dashboard-today-empty">Nenhum post previsto para hoje.</p>}{hasMore ? <button type="button" className="dashboard-link" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>{expanded ? "Ver menos" : "Ver mais..."}</button> : null}</section>;
}

function DashboardClientSubmissionsWidget({ items, userId }: { items: DashboardSubmission[]; userId: string }) {
  const storageKey = `designhub-v2-dismissed-client-suggestions:${userId}`;
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [expanded, setExpanded] = useState(false);
  const formatSubmissionDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Hoje";
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? "Hoje"
      : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
  };
  const visibleItems = items.filter((item) => !dismissedIds.includes(item.id));
  const displayedItems = expanded ? visibleItems : visibleItems.slice(0, 3);
  const hiddenCount = Math.max(0, visibleItems.length - displayedItems.length);
  const dismissSuggestion = (id: string) => {
    setDismissedIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Keep the dismissal working for the current visit if storage is unavailable.
      }
      return next;
    });
  };

  if (visibleItems.length === 0) return null;

  return <section className="dashboard-list dashboard-client-submissions compact">
    <header className="dashboard-submissions-head"><h3>Sugestões dos clientes</h3><span>{visibleItems.length}</span></header>
    <div className="dashboard-submission-list">{displayedItems.map((item) => <article key={item.id}>
      <span className="dashboard-item-bullet" aria-hidden="true" />
      <span className="dashboard-submission-avatar">
        {item.clientLogoUrl ? <img src={item.clientLogoUrl} alt={`Logo de ${item.clientName}`} /> : item.clientName.slice(0, 2).toUpperCase()}
      </span>
      <div className="dashboard-submission-copy"><strong>{item.clientName}</strong><p>Sugeriu “{item.title}”</p></div>
      <small>{formatSubmissionDate(item.createdAt)}</small>
      <button className="dashboard-submission-dismiss" type="button" onClick={() => dismissSuggestion(item.id)} aria-label={`Remover sugestão de ${item.clientName}`} title="Já vi esta sugestão">×</button>
    </article>)}</div>
    {hiddenCount > 0 ? <button className="dashboard-link dashboard-submissions-more" type="button" onClick={() => setExpanded(true)}>Ver mais...</button> : null}
  </section>;
}

function DashboardApprovedPautasWidget({ items }: { items: DashboardApprovedPauta[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayedItems = expanded ? items : items.slice(0, 4);
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Aprovada" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
  };
  return <section className="dashboard-list dashboard-approved-pautas compact">
    <header className="dashboard-submissions-head"><div><h3>Pautas aprovadas</h3><small>Ideias aprovadas pelos clientes, separadas dos feedbacks de posts</small></div><span>{items.length}</span></header>
    <div className="dashboard-approved-pautas-list">{displayedItems.map((item) => <button type="button" key={item.id} onClick={() => { window.location.hash = `/admin/${encodeURIComponent(item.clientSlug)}`; }}>
      <span className="dashboard-approved-pauta-icon">✓</span>
      <span><strong>{item.title}</strong><small>{item.clientName}</small></span>
      <time>{formatDate(item.approvedAt)}</time>
    </button>)}</div>
    {items.length > 4 ? <button type="button" className="dashboard-link" onClick={() => setExpanded((current) => !current)}>{expanded ? "Ver menos" : "Ver todas"}</button> : null}
  </section>;
}

function DashboardClientActivitiesWidget({ items, userId, onSchedule }: { items: DashboardClientActivity[]; userId: string; onSchedule: (item: DashboardClientActivity) => void }) {
  const storageKey = `designhub-v2-dismissed-client-feedback:${userId}`;
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [expanded, setExpanded] = useState(false);
  const isNotApproved = (item: DashboardClientActivity) => item.activityType === "comment" && /^(n[aã]o|nao aprovado|não aprovado|reprovad|not approved)\b/i.test(item.detail.trim());
  const activityTone = (item: DashboardClientActivity) => item.activityType === "approved" || item.activityType === "contract_accepted" || item.activityType === "proposal_accepted" ? "approved" : item.activityType === "changes_requested" ? "changes_requested" : isNotApproved(item) ? "not_approved" : item.activityType;
  const activityLabel = (item: DashboardClientActivity) => item.activityType === "approved" ? "Aprovou o conteúdo" : item.activityType === "changes_requested" ? "Solicitou alterações" : item.activityType === "brand_brain" ? "Sugeriu uma atualização da marca" : item.activityType === "contract_accepted" ? "Aceitou o contrato" : item.activityType === "proposal_accepted" ? "Aceitou a proposta" : isNotApproved(item) ? "Não aprovou o conteúdo" : "Deixou um feedback";
  const activityTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Agora";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date).replace(",", " ·");
  };
  const decisionCardIds = new Set(items.filter((item) => item.cardId && (item.activityType === "approved" || item.activityType === "changes_requested")).map((item) => item.cardId));
  const latestCommentByCard = new Map<string, DashboardClientActivity>();
  items.forEach((item) => {
    if (item.cardId && item.activityType === "comment" && !latestCommentByCard.has(item.cardId)) latestCommentByCard.set(item.cardId, item);
  });
  const mergedItems = items
    .filter((item) => !(item.activityType === "comment" && item.cardId && decisionCardIds.has(item.cardId)))
    .map((item) => {
      if (!item.cardId || (item.activityType !== "approved" && item.activityType !== "changes_requested")) return item;
      return { ...item, detail: latestCommentByCard.get(item.cardId)?.detail ?? "" };
    });
  const visibleItems = mergedItems.filter((item) => !dismissedIds.includes(item.id));
  const displayedItems = expanded ? visibleItems : visibleItems.slice(0, 3);
  const hiddenCount = Math.max(0, visibleItems.length - displayedItems.length);
  const dismissFeedback = (id: string) => {
    setDismissedIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // A remoção continua valendo enquanto a página estiver aberta.
      }
      return next;
    });
  };
  const openCard = (item: DashboardClientActivity) => {
    if (!item.cardId) return;
    window.location.hash = `/admin/${encodeURIComponent(item.clientSlug)}?card=${encodeURIComponent(item.cardId)}`;
  };

  if (visibleItems.length === 0) return null;

  return <section className="dashboard-list dashboard-client-activities compact">
    <header className="dashboard-submissions-head"><div><h3>Feedback dos clientes</h3><small>Comentários, aprovações, aceites e alterações</small></div><span>{visibleItems.length}</span></header>
    <div className="dashboard-activity-list">{displayedItems.map((item) => {
      const tone = activityTone(item);
      return <article key={item.id} className={`dashboard-activity-row ${tone}`}>
        <span className="dashboard-item-bullet" aria-hidden="true" />
        <span className="dashboard-submission-avatar">{item.clientLogoUrl ? <img src={item.clientLogoUrl} alt={`Logo de ${item.clientName}`} /> : item.clientName.slice(0, 2).toUpperCase()}</span>
        <div className="dashboard-activity-copy"><span className="dashboard-activity-kind">{tone === "approved" ? "✓" : tone === "changes_requested" ? "↻" : tone === "not_approved" ? "×" : item.activityType === "brand_brain" ? "✦" : "💬"} {activityLabel(item)}</span><strong>{item.title}</strong><small>{item.clientName}</small>{item.detail ? <p>“{item.detail}”</p> : <p className="dashboard-feedback-empty">Sem comentário adicional.</p>}</div>
        <div className="dashboard-activity-actions"><time title="Data do retorno do cliente">{activityTime(item.occurredAt)}</time>{item.activityType === "brand_brain" ? <button type="button" onClick={() => { window.location.hash = `/admin/${item.clientSlug}?view=brand`; }}><UiIcon name="spark" />Revisar</button> : item.activityType === "contract_accepted" ? <button type="button" onClick={() => { window.location.hash = "/area/contratos"; }}><UiIcon name="eye" />Ver</button> : item.activityType === "proposal_accepted" ? <button type="button" onClick={() => { window.location.hash = "/area/propostas"; }}><UiIcon name="eye" />Ver</button> : item.activityType === "changes_requested" || tone === "not_approved" ? <button type="button" onClick={() => openCard(item)}><UiIcon name="eye" />Ver</button> : <button type="button" onClick={() => onSchedule(item)}><UiIcon name="calendar" />Agendar</button>}</div>
        <button className="dashboard-activity-dismiss" type="button" onClick={() => dismissFeedback(item.id)} aria-label={`Remover feedback de ${item.clientName}`} title="Marcar como visualizado">×</button>
      </article>;
    })}</div>
    {hiddenCount > 0 ? <button className="dashboard-link dashboard-submissions-more" type="button" onClick={() => setExpanded(true)}>Ver mais...</button> : null}
  </section>;
}

function DashboardScheduleModal({ activity, onClose, onScheduled }: { activity: DashboardClientActivity; onClose: () => void; onScheduled: () => void }) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!activity.cardId) {
      setError("Este retorno não está ligado a um post agendável.");
      setLoading(false);
      return () => { active = false; };
    }
    void loadAdminCardDetailBySlug(activity.clientSlug, activity.cardId)
      .then((response) => {
        if (!active) return;
        setDetail(response);
        const current = toDateTimeLocal(response.card.scheduledAt);
        if (current) {
          setScheduleDate(current.slice(0, 10));
          setScheduleTime(current.slice(11, 16));
        } else {
          const nextHour = new Date();
          nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
          const suggested = toDateTimeLocal(nextHour.toISOString());
          setScheduleDate(suggested.slice(0, 10));
          setScheduleTime(suggested.slice(11, 16));
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o post."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activity]);

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activity.cardId) { setError("Este retorno não está ligado a um post agendável."); return; }
    if (!scheduleDate || !scheduleTime) { setError("Escolha a data e o horário."); return; }
    setSaving(true); setError("");
    try {
      await updateAdminCardBySlug(activity.clientSlug, activity.cardId, { scheduledAt: `${scheduleDate}T${scheduleTime}`, scheduledTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      onScheduled();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível agendar o post.");
    } finally {
      setSaving(false);
    }
  };

  const copyCaption = async () => {
    const caption = detail?.card.subtitle?.trim() ?? "";
    if (!caption) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(caption);
      } else {
        const helper = document.createElement("textarea");
        helper.value = caption;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      setCaptionCopied(true);
      window.setTimeout(() => setCaptionCopied(false), 1800);
    } catch {
      window.prompt("Copie a legenda:", caption);
    }
  };

  return <div className="modal-backdrop dashboard-schedule-backdrop" onMouseDown={onClose}>
    <form className="dashboard-schedule-modal" onSubmit={saveSchedule} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">Agendamento pelo dashboard</p><h2>{activity.title}</h2><p>{activity.clientName} · feedback em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(activity.occurredAt))}</p></div><button type="button" className="icon-close" onClick={onClose}>×</button></header>
      {loading ? <p className="dashboard-schedule-loading">Carregando conteúdo...</p> : detail ? <div className="dashboard-schedule-layout">
        <section className="dashboard-schedule-preview"><h3>Prévia do post</h3>{portalCardAssets(detail.card).length ? <ClosedCardMedia card={detail.card} /> : <div className="dashboard-schedule-no-media"><UiIcon name="image" />Sem arte cadastrada</div>}</section>
        <section className="dashboard-schedule-content"><div className="dashboard-schedule-caption portal-summary-card"><div className="portal-summary-heading"><span><UiIcon name="file" /></span><div><small>CONTEÚDO DO POST</small><div className="dashboard-caption-title"><h4>Legenda</h4><button type="button" className="portal-caption-edit-button dashboard-caption-copy-button" disabled={!detail.card.subtitle?.trim()} onClick={() => void copyCaption()} aria-label={captionCopied ? "Legenda copiada" : "Copiar legenda"} title={captionCopied ? "Legenda copiada" : "Copiar legenda"} aria-live="polite"><UiIcon name={captionCopied ? "check" : "copy"} /></button></div></div></div><PortalFormattedCaption text={detail.card.subtitle ?? ""} /></div><div className="dashboard-schedule-feedback"><span>{activity.activityType === "approved" ? "✓" : activity.activityType === "changes_requested" ? "↻" : "💬"}</span><div><small>Retorno do cliente</small><strong>{activity.detail}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(activity.occurredAt))}</time></div></div><div className="dashboard-schedule-fields"><label>Data da publicação<input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required /></label><label>Horário<input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} required /></label></div></section>
      </div> : null}
      {error ? <p className="form-feedback error-text">{error}</p> : null}
      <footer><NavLink to={`/admin/${activity.clientSlug}`} className="ghost-button">Abrir no Kanban</NavLink><button type="button" className="ghost-button" onClick={onClose}>Cancelar</button><button type="submit" className="gradient-button" disabled={saving || loading || !detail}><UiIcon name="calendar" />{saving ? "Agendando..." : "Confirmar agendamento"}</button></footer>
    </form>
  </div>;
}

function DashboardClientCard({ client, socialRevision, onEdit, onDelete, onShare }: { client: AdminClientOption; socialRevision: number; onEdit: () => void; onDelete: () => void; onShare: () => void }) {
  const localeLabel = client.locale === "en" ? "English" : client.locale === "es" ? "Español" : client.locale === "it" ? "Italiano" : client.locale === "sv" ? "Svenska" : "Português";
  const localeFlag = client.locale === "en" ? "🇺🇸" : client.locale === "es" ? "🇪🇸" : client.locale === "it" ? "🇮🇹" : client.locale === "sv" ? "🇸🇪" : "🇧🇷";
  const [copied, setCopied] = useState(false);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  useEffect(() => { let active = true; void loadAdminWorkspaceDrawerBySlug(client.slug).then((result) => { const data = result.data as { socialLinks?: Record<string, unknown> } | null; const links = data?.socialLinks ?? {}; if (active) setSocialLinks(Object.fromEntries(Object.entries(links).filter(([, value]) => typeof value === "string" && value.trim()).map(([key, value]) => [key, String(value)]))); }).catch(() => undefined); return () => { active = false; }; }, [client.slug, socialRevision]);
  const copyPortalLink = async () => {
    const portalUrl = `${window.location.origin}${window.location.pathname}#/portal/${encodeURIComponent(client.slug)}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(portalUrl);
      else {
        const helper = document.createElement("textarea");
        helper.value = portalUrl;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { window.prompt("Copie o endereço do portal do cliente:", portalUrl); }
  };
  return <article className="client-showcase-card">
    <div className="client-showcase-head">
      <div className="client-showcase-logo">{client.logo_url ? <img src={client.logo_url} alt={`Logo ${client.name}`} /> : client.name.slice(0, 2).toUpperCase()}</div>
      <div><div className="client-showcase-title"><h3>{client.name}</h3><button className="client-copy-button" type="button" title={copied ? "Endereço copiado" : "Copiar endereço do portal"} aria-label={copied ? "Endereço copiado" : "Copiar endereço do portal"} onClick={() => void copyPortalLink()}>{copied ? <UiIcon name="check" /> : <UiIcon name="copy" />}</button></div><p>{localeFlag} {localeLabel} <span>♙ {Number(client.access_count ?? 0)}</span></p></div>
    </div>
    <div className="client-showcase-social">{(["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "website"] as const).filter((network) => socialLinks[network]).map((network) => <a key={network} className={`client-social-link ${network}`} href={socialLinks[network]} target="_blank" rel="noreferrer" title={`Abrir ${network === "website" ? "site" : network}`} aria-label={`Abrir ${network === "website" ? "site" : network}`}><SocialNetworkIcon network={network} /></a>)}</div>
    <div className="client-showcase-actions">
      <NavLink to={`/admin/${client.slug}`} className="gradient-button">Gerenciar</NavLink>
      <NavLink to={`/portal/${client.slug}`} className="client-icon-action" title="Ver portal"><UiIcon name="eye" /></NavLink>
      <button type="button" className="client-icon-action" title="Editar cliente" onClick={onEdit}><UiIcon name="pencil" /></button>
      <button type="button" className="client-icon-action danger" title="Excluir cliente" onClick={onDelete}><UiIcon name="trash" /></button>
      <button type="button" className="client-icon-action" title="Compartilhar cliente com a equipe" onClick={onShare}><UiIcon name="send" /></button>
    </div>
  </article>;
}

function SocialNetworkIcon({ network }: { network: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "x" | "website" }) {
  if (network === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.25" /><circle className="social-icon-fill" cx="17.4" cy="6.7" r="1" /></svg>;
  if (network === "facebook") return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M13.7 21v-8h2.8l.5-3.2h-3.3V7.7c0-.9.3-1.6 1.7-1.6h1.8V3.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.3V13h2.9v8h3.5Z" /></svg>;
  if (network === "tiktok") return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M15.1 3c.3 2.4 1.7 3.9 4 4.1v3.1a8.4 8.4 0 0 1-4-1.2v6.1a6.1 6.1 0 1 1-5.3-6v3.2a3 3 0 1 0 2.2 2.9V3h3.1Z" /></svg>;
  if (network === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8.1a3 3 0 0 0-2.1-2.2C17 5.4 12 5.4 12 5.4s-5 0-6.9.5A3 3 0 0 0 3 8.1a31 31 0 0 0 0 7.8 3 3 0 0 0 2.1 2.2c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 0-7.8Z" /><path className="social-icon-fill" d="m10 15.2 5.2-3.2L10 8.8v6.4Z" /></svg>;
  if (network === "linkedin") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle className="social-icon-fill" cx="7.6" cy="8" r="1.35" /><path className="social-icon-fill" d="M6.4 10.2h2.4v7.4H6.4v-7.4Zm4 0h2.3v1c.8-.9 1.7-1.3 2.8-1.3 2.1 0 3.1 1.4 3.1 3.8v3.9h-2.4v-3.7c0-1.2-.4-1.9-1.5-1.9-1.2 0-1.8.8-1.8 2.2v3.4h-2.5v-7.4Z" /></svg>;
  if (network === "x") return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="social-icon-fill" d="M4.2 4h4.5l4.1 5.5L17.6 4h2.1l-5.9 6.9L20.6 20h-4.5l-4.7-6.3L6 20H3.9l6.5-7.7L4.2 4Zm3.5 1.7 9.2 12.6h1.9L9.6 5.7H7.7Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3.5 12h17M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.5-3.7-9S9.6 5.5 12 3Z" /></svg>;
}

function EditClientModal({ client, form, logoFile, accesses, saving, error, onChange, onLogoChange, onClose, onSubmit }: { client: AdminClientOption; form: EditClientForm; logoFile: File | null; accesses: ClientAccess[]; saving: boolean; error: string; onChange: (key: keyof EditClientForm, value: string) => void; onLogoChange: (file: File | null) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const portalUsers = accesses.filter((access) => access.globalRole === "cliente");
  const socialFields: Array<[keyof EditClientForm, string, string]> = [["instagram", "Instagram", "https://instagram.com/..."], ["facebook", "Facebook", "https://facebook.com/..."], ["tiktok", "TikTok", "https://tiktok.com/@..."], ["youtube", "YouTube", "https://youtube.com/..."], ["linkedin", "LinkedIn", "https://linkedin.com/..."], ["x", "X", "https://x.com/..."], ["website", "Site", "https://meusite.com.br"]];
  return <div className="client-modal-backdrop" onMouseDown={onClose}><form className="client-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}><header><div><p className="eyebrow">Detalhes do cliente</p><h2>Editar Cliente</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><label>Nome do Cliente<input required value={form.name} onChange={(event) => onChange("name", event.target.value)} /></label><label>Nome para saudação no portal<input required value={form.greetingName} onChange={(event) => onChange("greetingName", event.target.value)} placeholder="Ex: Liege" /></label><label>Slug (URL)<span className="slug-input"><em>/client/</em><input required value={form.slug} onChange={(event) => onChange("slug", event.target.value)} /></span></label><label>Idioma do Cliente<select value={form.locale} onChange={(event) => onChange("locale", event.target.value)}><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option><option value="it">🇮🇹 Italiano</option><option value="sv">🇸🇪 Svenska</option></select></label><label>Título do portal<input required value={form.portalTitle} onChange={(event) => onChange("portalTitle", event.target.value)} /></label><label>Logo<span className="logo-picker"><input type="file" accept="image/*" onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} /><strong>{logoFile ? logoFile.name : client.logo_url ? "▧ Manter logo atual" : "▧ Selecionar logo"}</strong></span></label><fieldset><legend>Redes Sociais</legend>{socialFields.map(([key, label, placeholder]) => <label key={key} className="social-field"><span>{label}</span><input type="url" value={form[key]} onChange={(event) => onChange(key, event.target.value)} placeholder={placeholder} /></label>)}</fieldset><fieldset className="client-login"><legend>Login do Cliente</legend>{portalUsers.length === 0 ? <p>Esta conta ainda não possui login de cliente.</p> : <><label>Login<select value={form.clientUserId} onChange={(event) => onChange("clientUserId", event.target.value)}>{portalUsers.map((user) => <option key={user.userId} value={user.userId}>{user.fullName} · {user.email}</option>)}</select></label><label>E-mail do cliente<input value={form.email} disabled /></label><label>Nova senha <small>Deixe em branco para manter a atual.</small><input type="password" minLength={8} value={form.password} onChange={(event) => onChange("password", event.target.value)} placeholder="Mínimo de 8 caracteres" /></label></>}</fieldset>{error ? <p className="form-error">{error}</p> : null}<button className="gradient-button client-submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></form></div>;
}

function ShareClientModal({ client, accesses, users, userId, role, saving, error, onUserChange, onRoleChange, onClose, onShare }: { client: AdminClientOption; accesses: ClientAccess[]; users: ManagedUser[]; userId: string; role: "admin" | "colaborador"; saving: boolean; error: string; onUserChange: (value: string) => void; onRoleChange: (value: "admin" | "colaborador") => void; onClose: () => void; onShare: () => void }) {
  const internalAccesses = accesses.filter((access) => access.globalRole !== "cliente");
  return createPortal(<div className="client-modal-backdrop" onMouseDown={onClose}><section className="client-modal client-share-modal" role="dialog" aria-modal="true" aria-label={`Compartilhar ${client.name}`} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Equipe</p><h2>Compartilhar {client.name}</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><p>Escolha quem poderá abrir e trabalhar neste Kanban.</p><div className="share-controls"><select value={userId} onChange={(event) => onUserChange(event.target.value)}><option value="">Selecionar membro</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.globalRole}</option>)}</select><select value={role} onChange={(event) => onRoleChange(event.target.value as "admin" | "colaborador")}><option value="colaborador">Colaborador</option><option value="admin">Admin</option></select><button className="gradient-button" disabled={!userId || saving} onClick={onShare}>{saving ? "Adicionando..." : "Compartilhar"}</button></div>{error ? <p className="form-error">{error}</p> : null}<div className="client-access-list"><h3>Já têm acesso</h3>{internalAccesses.length === 0 ? <p>Nenhum membro interno atribuído.</p> : internalAccesses.map((access) => <article key={access.membershipId}><div><strong>{access.fullName}</strong><small>{access.email}</small></div><span>{access.membershipRole}</span></article>)}</div></section></div>, document.body);
}

function CreateClientModal({ form, logoFile, creating, error, onChange, onLogoChange, onClose, onSubmit }: { form: ClientForm; logoFile: File | null; creating: boolean; error: string; onChange: (key: keyof ClientForm, value: string) => void; onLogoChange: (file: File | null) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const socialFields: Array<[keyof typeof form, string, string]> = [["instagram", "Instagram", "https://instagram.com/..."], ["facebook", "Facebook", "https://facebook.com/..."], ["tiktok", "TikTok", "https://tiktok.com/@..."], ["youtube", "YouTube", "https://youtube.com/..."], ["linkedin", "LinkedIn", "https://linkedin.com/..."], ["x", "X", "https://x.com/..."], ["website", "Site", "https://meusite.com.br"]];
  return <div className="client-modal-backdrop" role="presentation"><form className="client-modal" onSubmit={onSubmit}><header><h2>Novo Cliente</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><label>Nome do Cliente<input required value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Ex: Empresa XYZ" /></label><label>Nome para saudação no portal<input required value={form.greetingName} onChange={(event) => onChange("greetingName", event.target.value)} placeholder="Ex: Liege" /></label><label>Slug (URL)<span className="slug-input"><em>/client/</em><input required value={form.slug} onChange={(event) => onChange("slug", event.target.value)} placeholder="empresa-xyz" /></span></label><label>Idioma do Cliente<select value={form.locale} onChange={(event) => onChange("locale", event.target.value)}><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option><option value="it">🇮🇹 Italiano</option><option value="sv">🇸🇪 Svenska</option></select></label><label>Logo<span className="logo-picker"><input type="file" accept="image/*" onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} /><strong>{logoFile ? logoFile.name : "▧ Selecionar logo"}</strong></span></label><fieldset><legend>Redes Sociais</legend>{socialFields.map(([key, label, placeholder]) => <label key={key} className="social-field"><span>{label}</span><input type="url" value={form[key]} onChange={(event) => onChange(key, event.target.value)} placeholder={placeholder} /></label>)}</fieldset><fieldset className="client-login"><legend>Login do Cliente</legend><p>Crie um acesso para o cliente visualizar seus conteúdos.</p><label>E-mail do cliente<input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} placeholder="cliente@empresa.com" /></label><label>Senha<input type="password" minLength={8} value={form.password} onChange={(event) => onChange("password", event.target.value)} placeholder="Mínimo de 8 caracteres" /></label></fieldset>{error ? <p className="form-error">{error}</p> : null}<button className="gradient-button client-submit" disabled={creating}>{creating ? "Criando..." : "Criar Cliente"}</button></form></div>;
}

function AdminRoutePage({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  const { slug = "aplikasi" } = useParams();
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === "client") {
    return <Navigate to={getDefaultRoute(session)} replace />;
  }

  if (!canAccessAdmin(session, slug)) {
    return (
      <AccessDenied
        title="Essa conta não está atribuída a este perfil"
        body="Admins e colaboradores só podem abrir os clientes ligados ao próprio usuário."
        backHref={getDefaultRoute(session)}
      />
    );
  }

  return <AdminWorkspacePage session={session} slug={slug} onLogout={onLogout} />;
}

function ProfileMenu({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<"profile" | "password" | "accounts" | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(session.avatarUrl ?? null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setDialog(null); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
  const show = (next: typeof dialog) => { setOpen(false); setDialog(next); setMessage(""); };
  const saveAvatar = async (file: File | null) => {
    if (!file) return;
    setSaving(true); setMessage("");
    try { const url = await uploadAdminMedia(file); await updateMyProfile({ avatarUrl: url }); setAvatarUrl(url); setMessage("Foto atualizada."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a foto."); }
    finally { setSaving(false); }
  };
  const savePassword = async () => {
    setSaving(true); setMessage("");
    try { await changeMyPassword({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setMessage("Senha atualizada com sucesso."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a senha."); }
    finally { setSaving(false); }
  };
  const initials = session.name.slice(0, 2).toUpperCase();
  return (
    <div className="profile-menu" ref={menuRef}>
      <button className="session-note glass-subtle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        <span className="session-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span>
        <span className="session-copy"><strong>{session.name}</strong><span>{roleLabel(session.role)}</span></span>
        <UiIcon name="chevron-down" className="session-caret" />
      </button>
      {open ? (
        <div className="profile-popover" role="menu">
          <button onClick={() => show("profile")}><span>♙</span>Meu Perfil</button>
          <button onClick={() => show("password")}><span>⚿</span>Alterar Senha</button>
          <NavLink to="/agenda" onClick={() => setOpen(false)}><span>▣</span>Agenda</NavLink>
          <button onClick={() => show("accounts")}><span>♧</span>Trocar de conta</button>
          <hr />
          <button className="profile-logout" onClick={onLogout}><span>⇥</span>Sair</button>
        </div>
      ) : null}
      {dialog ? createPortal((
        <div className="profile-modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="admin-profile-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h3 id="admin-profile-dialog-title">{dialog === "profile" ? "Meu Perfil" : dialog === "password" ? "Alterar Senha" : "Trocar de conta"}</h3>
              <button onClick={() => setDialog(null)} aria-label="Fechar">×</button>
            </header>
            {dialog === "profile" ? <div className="profile-edit"><span className="profile-photo-large">{avatarUrl ? <img src={avatarUrl} alt="Foto de perfil" /> : initials}</span><strong>{session.name}</strong><small>{session.email}</small><label className="profile-upload">{saving ? "Enviando foto..." : "Escolher nova foto"}<input type="file" accept="image/*" disabled={saving} onChange={(event) => void saveAvatar(event.target.files?.[0] ?? null)} /></label></div> : null}
            {dialog === "password" ? <div className="profile-form"><label>Senha atual<input name="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>Nova senha<input name="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><button className="gradient-button" disabled={saving || !currentPassword || newPassword.length < 8} onClick={() => void savePassword()}>{saving ? "Salvando..." : "Salvar nova senha"}</button></div> : null}
            {dialog === "accounts" ? <div className="profile-agenda">{session.assignedAdminSlugs.map((account) => <a key={account} href={`/admin/${account}`}>{account.replace(/-/g, " ")}</a>)}</div> : null}
            {message ? <p className="profile-message">{message}</p> : null}
          </section>
        </div>
      ), document.body) : null}
    </div>
  );
}

function AdminWorkspacePage({
  session,
  slug,
  onLogout,
}: {
  session: SessionUser;
  slug: string;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [boardView, setBoardView] = useState<"board" | "archived" | "texts" | "calendar" | "activities" | "brand" | "pautas">(() => window.location.hash.includes("view=brand") ? "brand" : "board");
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [kanbanScrollMetrics, setKanbanScrollMetrics] = useState({ left: 0, max: 0 });
  const workspaceMode = boardView === "archived" ? "archived" : "board";
  const workspaceResource = usePreviewResource(
    { mode: workspaceMode, data: emptyAdminWorkspace },
    async () => ({
      mode: workspaceMode,
      data: await loadAdminWorkspaceBySlug(slug, { archived: workspaceMode === "archived" }),
    }), [
    slug,
    refreshKey,
    workspaceMode,
  ]);
  const resource = {
    ...workspaceResource,
    data: workspaceResource.data.data,
    setData: (update: AdminWorkspacePreview | ((current: AdminWorkspacePreview) => AdminWorkspacePreview)) => {
      workspaceResource.setData((current) => ({
        ...current,
        data: typeof update === "function" ? update(current.data) : update,
      }));
    },
  };
  const workspaceViewChanging = workspaceResource.data.mode !== workspaceMode;
  const data = resource.data;
  useEffect(() => {
    if (boardView !== "board") return;

    let lastRefreshAt = 0;
    const refreshScheduledCards = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshAt < 5_000) return;
      lastRefreshAt = Date.now();
      setRefreshKey((value) => value + 1);
    };
    const refreshOnVisibility = () => { if (document.visibilityState === "visible") refreshScheduledCards(); };
    const interval = window.setInterval(refreshScheduledCards, 30 * 60_000);
    window.addEventListener("focus", refreshScheduledCards);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refreshScheduledCards); document.removeEventListener("visibilitychange", refreshOnVisibility); };
  }, [boardView]);
  useEffect(() => {
    if (boardView !== "board") return;
    const scroller = kanbanScrollRef.current;
    if (!scroller) return;
    const updateMetrics = () => setKanbanScrollMetrics({ left: scroller.scrollLeft, max: Math.max(0, scroller.scrollWidth - scroller.clientWidth) });
    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(scroller);
    const content = scroller.firstElementChild;
    if (content) observer.observe(content);
    window.addEventListener("resize", updateMetrics);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateMetrics); };
  }, [boardView, data.columns.length, resource.loading]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => new URLSearchParams(location.search).get("card"));
  const [editingColumn, setEditingColumn] = useState<BoardColumn | "new" | null>(null);
  const [invoiceLineDialog, setInvoiceLineDialog] = useState<BillingLineRequest | null>(null);
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [newCardTarget, setNewCardTarget] = useState<{ columnId: string | null } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [bulkColumnDialog, setBulkColumnDialog] = useState<"copy" | "move" | null>(null);
  const [cardMenu, setCardMenu] = useState<{ card: BoardCard; columnId: string | null; x: number; y: number; openLeft: boolean } | null>(null);
  const [cardColumnDialog, setCardColumnDialog] = useState<{ card: BoardCard; mode: "copy" | "move" } | null>(null);
  const [cardClientDialog, setCardClientDialog] = useState<BoardCard | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<BoardCard | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; columnId: string | null } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ columnId: string | null; index: number } | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [columnDropIndex, setColumnDropIndex] = useState<number | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ urls: string[]; title: string; index: number } | null>(null);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const tagFilterPanelRef = useRef<HTMLElement>(null);
  const tagFilterButtonRef = useRef<HTMLButtonElement>(null);
  const [clientOptions, setClientOptions] = useState<AdminClientOption[]>([]);
  const [sectionCounts, setSectionCounts] = useState({ archived: 0, texts: 0, pautas: 0 });
  const openCardContextMenu = useCallback((event: React.MouseEvent, card: BoardCard, columnId: string | null) => {
    const viewportGap = 12;
    const menuWidth = Math.min(320, window.innerWidth - viewportGap * 2);
    // Reserva espaço também para os submenus, para que nenhuma opção fique
    // atrás da borda inferior da janela.
    const safeMenuHeight = Math.min(540, window.innerHeight - viewportGap * 2);
    const submenuWidth = 302;
    const openLeft = event.clientX + menuWidth + submenuWidth > window.innerWidth - viewportGap;
    const minX = openLeft ? viewportGap + submenuWidth : viewportGap;
    const maxX = Math.max(minX, window.innerWidth - menuWidth - viewportGap);

    setCardMenu({
      card,
      columnId,
      x: Math.min(Math.max(event.clientX, minX), maxX),
      y: Math.min(Math.max(event.clientY, viewportGap), Math.max(viewportGap, window.innerHeight - safeMenuHeight - viewportGap)),
      openLeft,
    });
  }, []);
  const updateTextsCount = useCallback((texts: number) => setSectionCounts((current) => current.texts === texts ? current : { ...current, texts }), []);
  const updatePautasCount = useCallback((pautas: number) => setSectionCounts((current) => current.pautas === pautas ? current : { ...current, pautas }), []);
  useEffect(() => {
    if (!tagFilterOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!tagFilterPanelRef.current?.contains(target) && !tagFilterButtonRef.current?.contains(target)) setTagFilterOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setTagFilterOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [tagFilterOpen]);
  useEffect(() => { if (boardView !== "board") setTagFilterOpen(false); }, [boardView]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      loadAdminWorkspaceBySlug(slug, { archived: true }),
      listAdminTextsBySlug(slug),
      loadAdminWorkspaceDrawerBySlug(slug),
    ]).then(([archivedWorkspace, textsResult, drawerResult]) => {
      if (!active) return;
      const drawer = drawerResult.data as Partial<WorkspaceDrawerData> | null;
      setSectionCounts({
        archived: flattenWorkspaceCards(archivedWorkspace).length,
        texts: textsResult.items.length,
        pautas: drawer?.pautaIdeas?.length ?? 0,
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [slug, refreshKey]);
  useEffect(() => {
    const cardId = new URLSearchParams(location.search).get("card");
    if (!cardId) return;
    setBoardView("board");
    setSelectedCardId(cardId);
  }, [location.search, slug]);
  useEffect(() => {
    listAdminClients().then((result) => setClientOptions(result.items)).catch(() => setClientOptions([]));
  }, []);
  const loadCardDetail = useCallback(
    (cardId: string) => loadAdminCardDetailBySlug(slug, cardId),
    [slug],
  );
  const openMediaPreview = (card: BoardCard) => {
    const urls = card.mediaUrls?.length ? card.mediaUrls : card.mediaUrl ? [card.mediaUrl] : [];
    if (urls.length) setPreviewMedia({ urls, title: card.title, index: 0 });
  };
  const detail = useCardDetail(data, selectedCardId, loadCardDetail, refreshKey);
  const selectedCards = [...data.columns.flatMap((column) => column.cards), ...data.withoutColumn]
    .filter((card) => selectedCardIds.includes(card.id));
  const archivedCards = [...data.columns.flatMap((column) => column.cards), ...data.withoutColumn];
  const archiveColumnCurrentMonth = async (column: BoardColumn) => {
    const now = new Date();
    const cardsThisMonth = column.cards.filter((card) => {
      if (!card.scheduledAt) return false;
      const scheduled = new Date(card.scheduledAt);
      return !Number.isNaN(scheduled.getTime())
        && scheduled.getFullYear() === now.getFullYear()
        && scheduled.getMonth() === now.getMonth();
    });
    if (!cardsThisMonth.length) {
      window.alert("Não há cards agendados para o mês atual nesta coluna.");
      return;
    }
    const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now);
    if (!window.confirm(`Arquivar ${cardsThisMonth.length} ${cardsThisMonth.length === 1 ? "card" : "cards"} de ${monthName} nesta coluna? Eles poderão ser restaurados em Arquivados.`)) return;
    setOpenColumnMenuId(null);
    await Promise.all(cardsThisMonth.map((card) => archiveAdminCardBySlug(slug, card.id)));
    setRefreshKey((value) => value + 1);
  };
  const filteredTagDefinitions = data.tagDefinitions.filter((tag) => tag.name.toLocaleLowerCase("pt-BR").includes(tagQuery.toLocaleLowerCase("pt-BR")));
  const filterCardsByTags = (cards: BoardCard[]) => selectedTagFilters.length === 0 ? cards : cards.filter((card) => selectedTagFilters.some((tag) => card.tags.includes(tag)));
  const removeTagFromCard = async (card: BoardCard, tag: string) => {
    const tags = card.tags.filter((item) => item !== tag);
    resource.setData((current) => ({
      ...current,
      columns: current.columns.map((column) => ({
        ...column,
        cards: column.cards.map((item) => item.id === card.id ? { ...item, tags } : item),
      })),
      withoutColumn: current.withoutColumn.map((item) => item.id === card.id ? { ...item, tags } : item),
    }));
    try {
      await updateAdminCardBySlug(slug, card.id, { tags });
    } catch {
      // The request failed, so fetch the server version rather than leaving a false local state.
      setRefreshKey((value) => value + 1);
    }
  };
  const toggleCardSelection = (cardId: string) => setSelectedCardIds((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  const finishBulkAction = () => {
    setSelectedCardIds([]);
    setSelectionMode(false);
    setRefreshKey((value) => value + 1);
  };
  const moveDraggedCard = async (columnId: string | null, index: number) => {
    if (!draggedCard) return;
    const sourceCards = draggedCard.columnId
      ? data.columns.find((column) => column.id === draggedCard.columnId)?.cards ?? []
      : data.withoutColumn;
    const sourceIndex = sourceCards.findIndex((card) => card.id === draggedCard.cardId);
    const position = draggedCard.columnId === columnId && sourceIndex >= 0 && sourceIndex < index ? index - 1 : index;
    if (draggedCard.columnId === columnId && sourceIndex === position) {
      setDraggedCard(null);
      setDropTarget(null);
      return;
    }
    resource.setData((current) => {
      const movedCard = [...current.columns.flatMap((column) => column.cards), ...current.withoutColumn]
        .find((card) => card.id === draggedCard.cardId);
      if (!movedCard) return current;

      const columns = current.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => card.id !== movedCard.id),
      }));
      const withoutColumn = current.withoutColumn.filter((card) => card.id !== movedCard.id);

      if (columnId === null) {
        withoutColumn.splice(position, 0, movedCard);
      } else {
        const targetColumn = columns.find((column) => column.id === columnId);
        targetColumn?.cards.splice(position, 0, movedCard);
      }

      return { ...current, columns, withoutColumn };
    });
    setDraggedCard(null);
    setDropTarget(null);

    try {
      await moveAdminCardBySlug(slug, draggedCard.cardId, columnId, position);
    } catch {
      setRefreshKey((value) => value + 1);
    }
  };

  const getColumnDropIndex = (event: React.DragEvent<HTMLDivElement>) => {
    const columnSlots = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-column-drag-slot]"));
    const nextIndex = columnSlots.findIndex((slot) => {
      const bounds = slot.getBoundingClientRect();
      return event.clientX < bounds.left + bounds.width / 2;
    });
    return nextIndex === -1 ? columnSlots.length : nextIndex;
  };

  useEffect(() => {
    const scroller = kanbanScrollRef.current;
    if (!scroller || boardView !== "board") return;

    const handleWheel = (event: WheelEvent) => {
      if (scroller.scrollWidth <= scroller.clientWidth) return;

      const modeMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 24
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? scroller.clientWidth
          : 1;
      // Preserve the gesture axis reported by the trackpad/Magic Mouse. A
      // vertical gesture reaching the end of a column must not unexpectedly
      // turn into horizontal board navigation.
      const horizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (horizontalGesture && Math.abs(event.deltaX) > 0.1) {
        event.preventDefault();
        scroller.scrollLeft += event.deltaX * modeMultiplier * 2.15;
        return;
      }

      // Vertical scrolling belongs to the card column (or its ancestor). At
      // the boundary we deliberately let it stop instead of moving the board.
    };

    scroller.addEventListener("wheel", handleWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", handleWheel);
  }, [boardView, data.columns.length]);

  const handleKanbanHorizontalKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if ((event.target as Element).closest("input, textarea, select, [contenteditable='true']")) return;

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    event.currentTarget.scrollBy({ left: direction * 376, behavior: "smooth" });
  };

  const moveDraggedColumn = async (index: number) => {
    if (!draggedColumnId) return;
    const sourceIndex = data.columns.findIndex((column) => column.id === draggedColumnId);
    if (sourceIndex < 0) return;
    const position = sourceIndex < index ? index - 1 : index;
    if (sourceIndex === position) {
      setDraggedColumnId(null);
      setColumnDropIndex(null);
      return;
    }

    const orderedColumns = data.columns.filter((column) => column.id !== draggedColumnId);
    const movedColumn = data.columns[sourceIndex];
    orderedColumns.splice(position, 0, movedColumn);
    resource.setData((current) => ({ ...current, columns: orderedColumns }));
    setDraggedColumnId(null);
    setColumnDropIndex(null);

    try {
      await reorderAdminColumnsBySlug(slug, orderedColumns.map((column) => column.id));
    } catch {
      setRefreshKey((value) => value + 1);
    }
  };

  const createQuickCard = async (columnId: string, title: string) => {
    await createAdminCardBySlug(slug, {
      columnId,
      title,
      caption: null,
      primaryMediaUrl: null,
      externalLinkUrl: null,
      artType: "Post único",
      status: ["Pendente"],
      tags: [],
    });
    setRefreshKey((value) => value + 1);
  };

  const kanbanCards = [...data.columns.flatMap((column) => column.cards), ...data.withoutColumn];
  const unassignedCards = filterCardsByTags(data.withoutColumn);
  const pendingPosts = kanbanCards.filter((card) => {
    const statusText = [card.clientLabel, ...card.statusBadges]
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    return /(pend|rascunho|aguard|alterac)/.test(statusText);
  }).length;

  return (
    <div className="page-grid admin-layout kanban-admin-layout">
      <AdminRail session={session} />

      <main className="main-column">
        <WorkspaceNavbar session={session} onLogout={onLogout} clientKanban workspaceContext={<PageContextBanner eyebrow="Social" title={<><span className="client-context-logo"><img src={designHubV2Logo} alt="Design Hub" /></span><WorkspaceSelector clientName={data.clientName} slug={slug} options={clientOptions} /></>} description="" metrics={[{ label: "Colunas", value: data.columns.length, note: "Etapas do fluxo", icon: <UiIcon name="layers" />, tone: "posts" }, { label: "Posts", value: data.columns.reduce((total, column) => total + column.cards.length, 0), note: "No quadro atual", icon: <UiIcon name="file" />, tone: "clients" }, { label: "Pendentes", value: pendingPosts, note: "Aguardando ação", icon: <UiIcon name="clock" />, tone: "pending" }]} />} />

        <section className="workspace">
          <div className="board-shell glass">
            <div className="board-topbar">
              <div className="tab-strip">
                <button className={boardView === "board" ? "tab active" : "tab"} onClick={() => setBoardView("board")}>Quadro</button>
                <button className={boardView === "archived" ? "tab active" : "tab"} onClick={() => setBoardView("archived")}>Arquivados <span className="tab-count">{sectionCounts.archived}</span></button>
                <button className={boardView === "texts" ? "tab active" : "tab"} onClick={() => setBoardView("texts")}>Textos <span className="tab-count">{sectionCounts.texts}</span></button>
                <button className={boardView === "calendar" ? "tab active" : "tab"} onClick={() => setBoardView("calendar")}>Calendário</button>
                <button className={boardView === "activities" ? "tab active" : "tab"} onClick={() => setBoardView("activities")}>Atividades</button>
                <button className={boardView === "brand" ? "tab active" : "tab"} onClick={() => setBoardView("brand")}>Brand Brain</button>
                <button className={boardView === "pautas" ? "tab active" : "tab"} onClick={() => setBoardView("pautas")}>Pautas <span className="tab-count">{sectionCounts.pautas}</span></button>
              </div>
              {boardView === "board" ? <div className="board-actions">
                <button className={selectionMode ? "ghost-button active" : "ghost-button"} onClick={() => {
                  setSelectionMode((active) => !active);
                  setSelectedCardIds([]);
                }}>Selecionar</button>
                <button ref={tagFilterButtonRef} className={tagFilterOpen || selectedTagFilters.length ? "ghost-button active" : "ghost-button"} onClick={() => setTagFilterOpen((open) => !open)}>Etiquetas{selectedTagFilters.length ? ` (${selectedTagFilters.length})` : ""}</button>
                <button className="ghost-button" onClick={() => setEditingColumn("new")}>
                  Criar coluna
                </button>
                <button
                  className="gradient-button"
                  onClick={() => setNewCardTarget({ columnId: data.columns[0]?.id ?? null })}
                >
                  Novo post
                </button>
              </div> : null}
              {boardView === "board" && tagFilterOpen ? <section ref={tagFilterPanelRef} className="tag-filter-panel">
                <div className="tag-filter-search"><span>⌕</span><input autoFocus value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Buscar..." /><button type="button" className="tag-filter-close" onClick={() => setTagFilterOpen(false)} aria-label="Fechar etiquetas">×</button></div>
                <div className="tag-filter-tabs"><button className="active">Todas</button><button onClick={() => setSelectedTagFilters([])}>Limpar seleção</button></div>
                <div className="tag-filter-list">{filteredTagDefinitions.map((tag) => { const selected = selectedTagFilters.includes(tag.name); return <button key={tag.id} className={selected ? "selected" : ""} onClick={() => setSelectedTagFilters((current) => selected ? current.filter((item) => item !== tag.name) : [...current, tag.name])}><span className="tag-filter-check">{selected ? "✓" : ""}</span><span className="tag-filter-dot" style={{ backgroundColor: tag.color }} /><strong>{tag.name}</strong></button>; })}{filteredTagDefinitions.length === 0 ? <p>Nenhuma etiqueta encontrada.</p> : null}</div>
              </section> : null}
            </div>

            <div className="board-layout">
              {boardView === "texts" ? <AdminTextsView clientName={data.clientName} slug={slug} onCountChange={updateTextsCount} /> : boardView === "calendar" ? <ClientKanbanCalendar slug={slug} /> : boardView === "activities" ? <KanbanActivities slug={slug} /> : boardView === "brand" ? <BrandBrainWorkspaceV2 slug={slug} clientName={data.clientName} /> : boardView === "pautas" ? <PautasWorkspace slug={slug} clientName={data.clientName} columns={data.columns} onSent={() => setRefreshKey((value) => value + 1)} onCountChange={updatePautasCount} /> : boardView === "archived" && (workspaceViewChanging || resource.loading) ? <div className="archived-empty">Carregando cards arquivados...</div> : boardView === "archived" ? <ArchivedCardsView
                cards={archivedCards}
                onOpenCard={setSelectedCardId}
                onPreviewMedia={openMediaPreview}
                onRemoveTag={removeTagFromCard}
                onRestore={setRestoreDialog}
                onDelete={(cardId) => {
                  if (window.confirm("Excluir este card definitivamente? Esta ação não pode ser desfeita.")) {
                    deleteAdminCardBySlug(slug, cardId).then(() => setRefreshKey((value) => value + 1));
                  }
                }}
              /> : workspaceViewChanging ? <div className="archived-empty">Carregando quadro...</div> : <><nav className="kanban-mobile-column-nav" aria-label="Ir para uma coluna">
                {data.columns.map((column, columnIndex) => <button
                  key={column.id}
                  type="button"
                  onClick={(event) => {
                    const scroller = event.currentTarget.closest(".board-layout")?.querySelector<HTMLElement>(".columns-scroll");
                    const target = scroller?.querySelector<HTMLElement>(`[data-column-index="${columnIndex}"]`);
                    if (scroller && target) scroller.scrollTo({ left: target.offsetLeft - scroller.offsetLeft, behavior: "smooth" });
                  }}
                ><i style={{ backgroundColor: column.color }} /><span>{column.name}</span><b>{column.cards.length}</b></button>)}
              </nav><div
                ref={kanbanScrollRef}
                className={draggedColumnId ? "columns-scroll columns-reordering" : "columns-scroll"}
                tabIndex={0}
                role="region"
                aria-label="Colunas do Kanban. Use as setas para navegar."
                onKeyDown={handleKanbanHorizontalKeys}
                onScroll={(event) => setKanbanScrollMetrics({ left: event.currentTarget.scrollLeft, max: Math.max(0, event.currentTarget.scrollWidth - event.currentTarget.clientWidth) })}
                onDragOver={(event) => {
                  if (!draggedColumnId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setColumnDropIndex(getColumnDropIndex(event));
                }}
                onDrop={(event) => {
                  if (!draggedColumnId) return;
                  event.preventDefault();
                  void moveDraggedColumn(getColumnDropIndex(event));
                }}
              >
                {data.columns.map((column, columnIndex) => (
                  <div
                    key={column.id}
                    data-column-drag-slot
                    data-column-index={columnIndex}
                    className={draggedColumnId === column.id ? "column-drag-slot dragging" : "column-drag-slot"}
                  >
                    {columnDropIndex === columnIndex ? <div className="column-drop-indicator"><span>Soltar coluna aqui</span></div> : null}
                    <BoardColumnView
                    column={{ ...column, cards: filterCardsByTags(column.cards) }}
                    onOpenCard={setSelectedCardId}
                    onBill={() => { setOpenColumnMenuId(null); setInvoiceLineDialog({ clientName: data.clientName, description: `👉 ${column.name}`, quantity: 1, unitPrice: 0, notes: "" }); }}
                    menuOpen={openColumnMenuId === column.id}
                    onToggleMenu={() =>
                      setOpenColumnMenuId((current) => (current === column.id ? null : column.id))
                    }
                    onEdit={() => {
                      setEditingColumn(column);
                      setOpenColumnMenuId(null);
                    }}
                    onChangeColor={(color) => {
                      setOpenColumnMenuId(null);
                      resource.setData((current) => ({
                        ...current,
                        columns: current.columns.map((item) => item.id === column.id ? { ...item, color } : item),
                      }));
                      void updateAdminColumnBySlug(slug, column.id, { color })
                        .catch(() => setRefreshKey((value) => value + 1));
                    }}
                    onToggleVisibility={() => {
                      setOpenColumnMenuId(null);
                      const visibleToClient = !column.visibleToClient;
                      resource.setData((current) => ({
                        ...current,
                        columns: current.columns.map((item) => item.id === column.id ? { ...item, visibleToClient } : item),
                      }));
                      void updateAdminColumnBySlug(slug, column.id, { visibleToClient })
                        .catch(() => setRefreshKey((value) => value + 1));
                    }}
                    onDelete={() => {
                      setOpenColumnMenuId(null);
                      if (
                        window.confirm(
                          `Excluir a coluna “${column.name}”? Os cards dela permanecem salvos em Sem coluna.`,
                        )
                      ) {
                        deleteAdminColumnBySlug(slug, column.id).then(() =>
                          setRefreshKey((value) => value + 1),
                        );
                      }
                    }}
                    onArchiveCurrentMonth={() => void archiveColumnCurrentMonth(column)}
                    onAddCard={() => setNewCardTarget({ columnId: column.id })}
                    onQuickAddCard={(title) => createQuickCard(column.id, title)}
                    selectionMode={selectionMode}
                    selectedCardIds={selectedCardIds}
                    onToggleCardSelection={toggleCardSelection}
                    dragEnabled={selectedTagFilters.length === 0}
                    onRemoveTag={removeTagFromCard}
                    onPreviewMedia={openMediaPreview}
                    draggedCardId={draggedCard?.cardId ?? null}
                    dropIndex={dropTarget?.columnId === column.id ? dropTarget.index : null}
                    onDragStart={(cardId) => setDraggedCard({ cardId, columnId: column.id })}
                    onDragOver={(event, index) => {
                      if (!draggedCard) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTarget({ columnId: column.id, index });
                    }}
                    onDrop={(index) => void moveDraggedCard(column.id, index)}
                    onDragEnd={() => { setDraggedCard(null); setDropTarget(null); }}
                    columnDragEnabled={!selectionMode && selectedTagFilters.length === 0}
                    onColumnDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", column.id);
                      setDraggedColumnId(column.id);
                      setDraggedCard(null);
                      setDropTarget(null);
                    }}
                    onColumnDragEnd={() => {
                      setDraggedColumnId(null);
                      setColumnDropIndex(null);
                    }}
                    onCardContextMenu={(event, card) => {
                      event.preventDefault();
                      openCardContextMenu(event, card, column.id);
                    }}
                    />
                    {columnIndex === data.columns.length - 1 && columnDropIndex === data.columns.length ? <div className="column-drop-indicator column-drop-indicator-after"><span>Soltar coluna aqui</span></div> : null}
                  </div>
                ))}

                {unassignedCards.length > 0 || draggedCard ? (
                  <section className={dropTarget?.columnId === null ? "kanban-column card-drop-column-active" : "kanban-column"}>
                    <header className="column-head" style={{ color: "#7a86a9" }}>
                      <div>
                        <p className="column-kicker">Área solta</p>
                        <h3>Sem coluna</h3>
                      </div>
                    </header>
                    <div
                      className="column-cards-scroll"
                      onDragOver={(event) => {
                        if (!draggedCard) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTarget({ columnId: null, index: unassignedCards.length });
                      }}
                      onDrop={(event) => {
                        if (!draggedCard) return;
                        event.preventDefault();
                        void moveDraggedCard(null, unassignedCards.length);
                      }}
                    >
                      {unassignedCards.map((card, index) => (
                        <div
                          key={card.id}
                          className={draggedCard?.cardId === card.id ? "card-drag-wrap dragging" : "card-drag-wrap"}
                          onDragOver={(event) => {
                            if (!draggedCard) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = "move";
                            const cardBounds = event.currentTarget.querySelector<HTMLElement>(".content-card")?.getBoundingClientRect()
                              ?? event.currentTarget.getBoundingClientRect();
                            setDropTarget({ columnId: null, index: event.clientY > cardBounds.top + cardBounds.height / 2 ? index + 1 : index });
                          }}
                          onDrop={(event) => {
                            if (!draggedCard) return;
                            event.preventDefault();
                            event.stopPropagation();
                            const cardBounds = event.currentTarget.querySelector<HTMLElement>(".content-card")?.getBoundingClientRect()
                              ?? event.currentTarget.getBoundingClientRect();
                            void moveDraggedCard(null, event.clientY > cardBounds.top + cardBounds.height / 2 ? index + 1 : index);
                          }}
                        >
                          {dropTarget?.columnId === null && dropTarget.index === index ? <div className="card-drop-indicator"><span>Soltar aqui</span></div> : null}
                          <CardView
                            card={card}
                            onOpen={() => selectionMode ? toggleCardSelection(card.id) : setSelectedCardId(card.id)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              openCardContextMenu(event, card, null);
                            }}
                            selectionMode={selectionMode}
                            selected={selectedCardIds.includes(card.id)}
                            onToggleSelection={() => toggleCardSelection(card.id)}
                            onPreviewMedia={openMediaPreview}
                            onRemoveTag={removeTagFromCard}
                            draggable={selectedTagFilters.length === 0 && !selectionMode}
                            onDragStart={() => setDraggedCard({ cardId: card.id, columnId: null })}
                            onDragEnd={() => { setDraggedCard(null); setDropTarget(null); }}
                          />
                        </div>
                      ))}
                      {dropTarget?.columnId === null && dropTarget.index === unassignedCards.length ? <div className="card-drop-indicator"><span>Soltar aqui</span></div> : null}
                      {unassignedCards.length === 0 && draggedCard ? <p className="card-drop-empty-hint">Arraste para cá para deixar o card sem coluna</p> : null}
                    </div>
                  </section>
                ) : null}

                <section className="kanban-column column-add glass-subtle">
                  <button className="column-add-button" onClick={() => setEditingColumn("new")}>
                    + Criar nova coluna
                  </button>
                </section>
              </div>{kanbanScrollMetrics.max > 0 ? <div className="kanban-horizontal-control"><UiIcon name="chevron-left" /><input type="range" min="0" max={kanbanScrollMetrics.max} step="1" value={Math.min(kanbanScrollMetrics.left, kanbanScrollMetrics.max)} aria-label="Rolagem horizontal do Kanban" onInput={(event) => { const left = Number(event.currentTarget.value); if (kanbanScrollRef.current) kanbanScrollRef.current.scrollLeft = left; setKanbanScrollMetrics((current) => ({ ...current, left })); }} /><UiIcon name="chevron-right" /></div> : null}</>}

              <WorkspaceDrawer slug={slug} userId={session.id} initialQuickLinks={data.quickLinks} columns={data.columns} tags={data.tagDefinitions} canManageAccess={session.role === "super_admin"} onPautaCountChange={updatePautasCount} />
              {/*
              <aside className="drawer glass-subtle">
                <div className="drawer-tabs">
                  {data.quickApps.map((item, index) => (
                    <span key={item} className={index === 3 ? "drawer-tab active" : "drawer-tab"}>
                      {item}
                    </span>
                  ))}
                </div>

                <div className="drawer-section">
                  <h3>Calendário da conta</h3>
                  <div className="widget-list">
                    {data.calendarEvents.map((event) => (
                      <article key={event.id} className="list-item">
                        <div>
                          <strong>{event.title}</strong>
                          <p>{formatCalendarSchedule(event.publishDate, event.publishTime)}</p>
                        </div>
                        <span>{event.publishTime?.slice(0, 5) ?? "--:--"}</span>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="drawer-section">
                  <h3>Links rapidos</h3>
                  <div className="quick-links-list">
                    {data.quickLinks.map((link) => (
                      <a key={link.label} href={link.href} className="quick-link-card">
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="drawer-section">
                  <h3>Recados</h3>
                  <ul className="notes-list">
                    {data.drawerNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>

                <div className="drawer-section tracking-panel">
                  <div className="tracking-head">
                    <h3>Acompanhamento</h3>
                    <span>
                      {data.trackingItems.filter((item) => item.done).length}/
                      {data.trackingItems.length}
                    </span>
                  </div>
                  <div className="tracking-items">
                    {data.trackingItems.map((item) => (
                      <div key={item.id} className="tracking-item">
                        <div className={item.done ? "tracking-dot done" : "tracking-dot"} />
                        <div>
                          <strong>{item.title}</strong>
                          <div className="badge-row compact">
                            {item.badges.map((badge) => (
                              <span key={badge} className="mini-badge status">
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
              */}
            </div>
          </div>
        </section>
      </main>

      <CardDetailModal
        mode="admin"
        titlePrefix="Card administrativo"
        detail={detail.data}
        loading={detail.loading}
        source={detail.source}
        onAddComment={(cardId, commentText) =>
          addAdminCardCommentBySlug(slug, cardId, { commentText, isInternal: true })
        }
        onApprove={(cardId, commentText) =>
          submitAdminCardDecisionBySlug(slug, cardId, "approved").then(async () => {
            if (commentText.trim()) {
              await addAdminCardCommentBySlug(slug, cardId, {
                commentText,
                isInternal: true,
              });
            }
          })
        }
        onRequestChanges={(cardId, commentText) =>
          submitAdminCardDecisionBySlug(slug, cardId, "changes_requested").then(async () => {
            if (commentText.trim()) {
              await addAdminCardCommentBySlug(slug, cardId, {
                commentText,
                isInternal: true,
              });
            }
          })
        }
        onRefresh={() => setRefreshKey((value) => value + 1)}
        onClose={() => { setSelectedCardId(null); if (location.search) navigate(`/admin/${slug}`, { replace: true }); }}
        adminContext={{ slug, columns: data.columns }}
      />

      <MediaPreviewModal media={previewMedia} onClose={() => setPreviewMedia(null)} onNavigate={(direction) => setPreviewMedia((current) => current ? { ...current, index: Math.max(0, Math.min(current.index + direction, current.urls.length - 1)) } : null)} />

      {cardMenu ? (
        <CardContextMenu
          card={cardMenu.card}
          position={cardMenu}
          tags={data.tagDefinitions}
          clients={clientOptions.filter((client) => client.slug !== slug)}
          onClose={() => setCardMenu(null)}
          onUpdateStatus={(status) => updateAdminCardBySlug(slug, cardMenu.card.id, {
            status: status
              ? [status, ...cardMenu.card.statusBadges.slice(1)]
              : [],
          }).then(() => setRefreshKey((value) => value + 1))}
          onToggleTag={(tag) => updateAdminCardBySlug(slug, cardMenu.card.id, {
            tags: cardMenu.card.tags.includes(tag)
              ? cardMenu.card.tags.filter((item) => item !== tag)
              : [...cardMenu.card.tags, tag],
          }).then(() => setRefreshKey((value) => value + 1))}
          onCopyToColumn={() => {
            setCardColumnDialog({ card: cardMenu.card, mode: "copy" });
            setCardMenu(null);
          }}
          onMoveToColumn={() => {
            setCardColumnDialog({ card: cardMenu.card, mode: "move" });
            setCardMenu(null);
          }}
          onCopyToClient={() => { setCardClientDialog(cardMenu.card); setCardMenu(null); }}
          onArchive={() => archiveAdminCardBySlug(slug, cardMenu.card.id).then(() => setRefreshKey((value) => value + 1))}
          onDelete={() => deleteAdminCardBySlug(slug, cardMenu.card.id).then(() => setRefreshKey((value) => value + 1))}
        />
      ) : null}
      {cardClientDialog ? <CardClientDialog card={cardClientDialog} clients={clientOptions.filter((client) => client.slug !== slug)} onClose={() => setCardClientDialog(null)} onConfirm={async (targetSlug, mode, columnId) => { await createAdminCardBySlug(targetSlug, { columnId, title: `${cardClientDialog.title}${mode === "copy" ? " (copia)" : ""}`, caption: cardClientDialog.subtitle ?? null, primaryMediaUrl: cardClientDialog.mediaUrl ?? null, externalLinkUrl: cardClientDialog.externalLinkUrl ?? null, artType: cardClientDialog.typeLabel, status: cardClientDialog.statusBadges, tags: cardClientDialog.tags, mediaUrls: cardClientDialog.mediaUrls, hashtags: cardClientDialog.hashtags, deadlineAt: cardClientDialog.deadlineAt, scheduledAt: cardClientDialog.scheduledAt, clientLabel: cardClientDialog.clientLabel }); if (mode === "move") await deleteAdminCardBySlug(slug, cardClientDialog.id); setRefreshKey((value) => value + 1); }} /> : null}

      {selectionMode ? <BulkActionBar
        selectedCount={selectedCards.length}
        onCancel={() => { setSelectionMode(false); setSelectedCardIds([]); }}
        onDelete={async () => {
          if (!window.confirm(`Excluir ${selectedCards.length} cards? Esta ação não pode ser desfeita.`)) return;
          await Promise.all(selectedCards.map((card) => deleteAdminCardBySlug(slug, card.id)));
          finishBulkAction();
        }}
        onArchive={async () => { await Promise.all(selectedCards.map((card) => archiveAdminCardBySlug(slug, card.id))); finishBulkAction(); }}
        onSendToClient={async () => { await Promise.all(selectedCards.map((card) => updateAdminCardBySlug(slug, card.id, { status: ["Enviar para Cliente", ...card.statusBadges.slice(1)] }))); finishBulkAction(); }}
        onStatus={async (status) => { await Promise.all(selectedCards.map((card) => updateAdminCardBySlug(slug, card.id, { status: status ? [status, ...card.statusBadges.slice(1)] : [] }))); finishBulkAction(); }}
        onCopy={() => setBulkColumnDialog("copy")}
        onMove={() => setBulkColumnDialog("move")}
      /> : null}

      {bulkColumnDialog ? <BulkColumnDialog mode={bulkColumnDialog} columns={data.columns} selectedCount={selectedCards.length} onClose={() => setBulkColumnDialog(null)} onConfirm={async (columnId) => {
        if (bulkColumnDialog === "move") {
          await Promise.all(selectedCards.map((card) => moveAdminCardBySlug(slug, card.id, columnId)));
        } else {
          await Promise.all(selectedCards.map((card) => createAdminCardBySlug(slug, {
            columnId, title: `${card.title} (copia)`, caption: card.subtitle ?? null, primaryMediaUrl: card.mediaUrl ?? null,
            externalLinkUrl: card.externalLinkUrl ?? null, artType: card.typeLabel, status: card.statusBadges, tags: card.tags,
            mediaUrls: card.mediaUrls, hashtags: card.hashtags, deadlineAt: card.deadlineAt, scheduledAt: card.scheduledAt, clientLabel: card.clientLabel,
          })));
        }
        setBulkColumnDialog(null);
        finishBulkAction();
      }} /> : null}

      {cardColumnDialog ? (
        <CardColumnDialog
          card={cardColumnDialog.card}
          columns={data.columns}
          mode={cardColumnDialog.mode}
          onClose={() => setCardColumnDialog(null)}
          onConfirm={(columnId) => {
            const card = cardColumnDialog.card;
            const action = cardColumnDialog.mode === "move"
              ? moveAdminCardBySlug(slug, card.id, columnId)
              : createAdminCardBySlug(slug, {
                  columnId,
                  title: `${card.title} (copia)`,
                  caption: card.subtitle ?? null,
                  primaryMediaUrl: card.mediaUrl ?? null,
                  externalLinkUrl: card.externalLinkUrl ?? null,
                  artType: card.typeLabel,
                  status: card.statusBadges,
                  tags: card.tags,
                  mediaUrls: card.mediaUrls,
                  hashtags: card.hashtags,
                  deadlineAt: card.deadlineAt,
                  scheduledAt: card.scheduledAt,
                  clientLabel: card.clientLabel,
                });
            return action.then(() => setRefreshKey((value) => value + 1));
          }}
        />
      ) : null}

      {restoreDialog ? <RestoreCardDialog
        card={restoreDialog}
        columns={data.columns}
        onClose={() => setRestoreDialog(null)}
        onConfirm={async (columnId) => {
          // Set the destination while the card is still archived, so a failure
          // cannot leave an active card detached from the selected column.
          await moveAdminCardBySlug(slug, restoreDialog.id, columnId);
          await setAdminCardArchivedBySlug(slug, restoreDialog.id, false);
          await moveAdminCardBySlug(slug, restoreDialog.id, columnId);
          const restoredCardId = restoreDialog.id;
          setRestoreDialog(null);
          setSelectedTagFilters([]);
          setBoardView("board");
          setSelectedCardId(restoredCardId);
          setRefreshKey((value) => value + 1);
        }}
      /> : null}

      <ColumnEditorModal
        column={editingColumn === "new" ? null : editingColumn}
        open={editingColumn !== null}
        onClose={() => setEditingColumn(null)}
        onSave={async (input) => {
          if (editingColumn === "new") {
            await createAdminColumnBySlug(slug, input);
          } else if (editingColumn) {
            await updateAdminColumnBySlug(slug, editingColumn.id, input);
          }
          setEditingColumn(null);
          setRefreshKey((value) => value + 1);
        }}
      />

      <CardEditorModal
        columns={data.columns}
        target={newCardTarget}
        onClose={() => setNewCardTarget(null)}
        onSave={async (input) => {
          await createAdminCardBySlug(slug, input);
          setNewCardTarget(null);
          setRefreshKey((value) => value + 1);
        }}
      />

      {invoiceLineDialog ? <BillingLineModal
        request={invoiceLineDialog}
        onClose={() => setInvoiceLineDialog(null)}
        onChange={setInvoiceLineDialog}
        onConfirm={(request) => {
          window.localStorage.setItem(BILLING_PENDING_LINE_KEY, JSON.stringify(request));
          setInvoiceLineDialog(null);
          navigate("/area/faturamento");
        }}
      /> : null}
    </div>
  );
}

function BillingLineModal({ request, onChange, onClose, onConfirm }: { request: BillingLineRequest; onChange: (request: BillingLineRequest) => void; onClose: () => void; onConfirm: (request: BillingLineRequest) => void }) {
  const total = request.quantity * request.unitPrice;
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal-panel glass billing-line-modal" onClick={(event) => event.stopPropagation()}>
      <header className="billing-line-modal-head">
        <div><p className="eyebrow">Faturamento · {request.clientName}</p><h2>Revisar item da fatura</h2><p>Confirme a quantidade e o preço antes de adicionar à fatura em aberto.</p></div>
        <button className="icon-close" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      <label>Descrição do item<input autoFocus value={request.description} onChange={(event) => onChange({ ...request, description: event.target.value })} /></label>
      <div className="billing-line-modal-grid">
        <label>Quantidade<input type="number" min="1" step="1" value={request.quantity} onChange={(event) => onChange({ ...request, quantity: Math.max(1, Number(event.target.value) || 1) })} /></label>
        <label>Preço unitário<input type="number" min="0" step="0.01" value={request.unitPrice} onChange={(event) => onChange({ ...request, unitPrice: Math.max(0, Number(event.target.value) || 0) })} /></label>
      </div>
      <label>Observações <span>(opcional)</span><textarea value={request.notes} onChange={(event) => onChange({ ...request, notes: event.target.value })} /></label>
      <div className="billing-line-total"><span>Total</span><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</strong></div>
      <footer className="billing-line-modal-actions"><button className="ghost-button" onClick={onClose}>Cancelar</button><button className="gradient-button" disabled={!request.description.trim()} onClick={() => onConfirm(request)}>▣ Adicionar à fatura</button></footer>
    </section>
  </div>;
}

function BoardColumnView({
  column,
  onOpenCard,
  onBill,
  menuOpen,
  onToggleMenu,
  onEdit,
  onChangeColor,
  onToggleVisibility,
  onDelete,
  onArchiveCurrentMonth,
  onAddCard,
  onQuickAddCard,
  onCardContextMenu,
  selectionMode,
  selectedCardIds,
  onToggleCardSelection,
  dragEnabled,
  onRemoveTag,
  onPreviewMedia,
  draggedCardId,
  dropIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  columnDragEnabled,
  onColumnDragStart,
  onColumnDragEnd,
}: {
  column: BoardColumn;
  onOpenCard: (cardId: string) => void;
  onBill: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onChangeColor: (color: string) => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onArchiveCurrentMonth: () => void;
  onAddCard: () => void;
  onQuickAddCard: (title: string) => Promise<void>;
  onCardContextMenu: (event: React.MouseEvent<HTMLButtonElement>, card: BoardCard) => void;
  selectionMode: boolean;
  selectedCardIds: string[];
  onToggleCardSelection: (cardId: string) => void;
  dragEnabled: boolean;
  onRemoveTag: (card: BoardCard, tag: string) => void;
  onPreviewMedia: (card: BoardCard) => void;
  draggedCardId: string | null;
  dropIndex: number | null;
  onDragStart: (cardId: string) => void;
  onDragOver: (event: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  columnDragEnabled: boolean;
  onColumnDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onColumnDragEnd: () => void;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");
  const columnHeadActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!columnHeadActionsRef.current?.contains(event.target as Node)) onToggleMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleMenu();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, onToggleMenu]);

  const submitQuickCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title || quickAddSaving) return;

    setQuickAddSaving(true);
    setQuickAddError("");
    try {
      await onQuickAddCard(title);
      setQuickTitle("");
      setQuickAddOpen(false);
    } catch (caught) {
      setQuickAddError(caught instanceof Error ? caught.message : "Não foi possível criar o card agora.");
    } finally {
      setQuickAddSaving(false);
    }
  };

  return (
    <section className={dropIndex !== null ? "kanban-column card-drop-column-active" : "kanban-column"}>
      <header className="column-head" style={{ color: column.color }}>
        <div
          className="column-title-row column-drag-handle"
          draggable={columnDragEnabled}
          onDragStart={onColumnDragStart}
          onDragEnd={onColumnDragEnd}
          title="Arraste para reorganizar a coluna"
        >
          <span className="column-grip" aria-hidden="true">⠿</span>
          <span className="column-dot" />
          <h3>{column.name}</h3>
        </div>
        <div className="column-head-actions" ref={columnHeadActionsRef}>
          <button
            type="button"
            className={column.visibleToClient ? "column-visibility visible" : "column-visibility"}
            title={column.visibleToClient ? "Visível para o cliente" : "Oculta para o cliente"}
            aria-label={column.visibleToClient ? "Ocultar coluna do cliente" : "Mostrar coluna para o cliente"}
            aria-pressed={column.visibleToClient}
            onClick={onToggleVisibility}
          >
            <UiIcon name="eye" className="column-action-icon" />
          </button>
          <span className="column-count" aria-label={`${column.cards.length} cards`}>({column.cards.length})</span>
          <button className="column-menu" onClick={onToggleMenu} aria-label={`Opções de ${column.name}`}>
            <UiIcon name="more" className="column-action-icon" />
          </button>
          {menuOpen ? (
            <div className="column-popover" role="menu" aria-label={`Ações da coluna ${column.name}`}>
              <button role="menuitem" onClick={onAddCard}>
                <UiIcon name="plus" />
                <span>Adicionar post</span>
              </button>
              <button role="menuitem" onClick={onEdit}>
                <UiIcon name="pencil" />
                <span>Editar</span>
              </button>
              <button role="menuitem" onClick={onBill}>
                <UiIcon name="receipt" />
                <span>Faturar</span>
              </button>
              <button
                role="menuitem"
                aria-expanded={colorMenuOpen}
                onClick={() => setColorMenuOpen((open) => !open)}
              >
                <UiIcon name="brush" />
                <span>Cor</span>
                <UiIcon name="chevron-right" className={colorMenuOpen ? "column-menu-chevron open" : "column-menu-chevron"} />
              </button>
              {colorMenuOpen ? (
                <div className="column-color-menu" aria-label="Escolher cor da coluna">
                  {columnColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={column.color === color ? "selected" : ""}
                      style={{ backgroundColor: color }}
                      aria-label={`Usar cor ${color}`}
                      onClick={() => onChangeColor(color)}
                    />
                  ))}
                </div>
              ) : null}
              <button role="menuitem" onClick={onArchiveCurrentMonth}>
                <UiIcon name="layers" />
                <span>Arquivar coluna</span>
              </button>
              <div className="column-popover-separator" role="separator" />
              <button className="column-popover-danger" role="menuitem" onClick={onDelete}>
                <UiIcon name="trash" />
                <span>Excluir</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="column-cards-scroll" onDragOver={(event) => { if (draggedCardId) onDragOver(event, column.cards.length); }} onDrop={(event) => { if (!draggedCardId) return; event.preventDefault(); onDrop(column.cards.length); }}>
        {column.cards.map((card, index) => (
          <div key={card.id} className={draggedCardId === card.id ? "card-drag-wrap dragging" : "card-drag-wrap"} onDragOver={(event) => { if (!draggedCardId) return; event.preventDefault(); event.stopPropagation(); const cardBounds = event.currentTarget.querySelector<HTMLElement>(".content-card")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect(); onDragOver(event, event.clientY > cardBounds.top + cardBounds.height / 2 ? index + 1 : index); }} onDrop={(event) => { if (!draggedCardId) return; event.preventDefault(); event.stopPropagation(); const cardBounds = event.currentTarget.querySelector<HTMLElement>(".content-card")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect(); onDrop(event.clientY > cardBounds.top + cardBounds.height / 2 ? index + 1 : index); }}>
            {dropIndex === index ? <div className="card-drop-indicator"><span>Soltar aqui</span></div> : null}
            <CardView card={card} onOpen={() => selectionMode ? onToggleCardSelection(card.id) : onOpenCard(card.id)} onContextMenu={(event) => onCardContextMenu(event, card)} selectionMode={selectionMode} selected={selectedCardIds.includes(card.id)} onToggleSelection={() => onToggleCardSelection(card.id)} onPreviewMedia={onPreviewMedia} onRemoveTag={onRemoveTag} draggable={dragEnabled && !selectionMode} onDragStart={() => onDragStart(card.id)} onDragEnd={onDragEnd} />
          </div>
        ))}
        {dropIndex === column.cards.length ? <div className="card-drop-indicator"><span>Soltar aqui</span></div> : null}
        {quickAddOpen ? (
          <form className="quick-card-form" onSubmit={submitQuickCard}>
            <input
              autoFocus
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuickAddOpen(false);
                  setQuickTitle("");
                  setQuickAddError("");
                }
              }}
              placeholder="Título do card"
              aria-label="Título do card"
            />
            <button type="submit" disabled={!quickTitle.trim() || quickAddSaving}>
              {quickAddSaving ? "Criando..." : "Criar"}
            </button>
            {quickAddError ? <p>{quickAddError}</p> : null}
          </form>
        ) : (
          <button className="add-card-inline" onClick={() => setQuickAddOpen(true)}>+ Adicionar card</button>
        )}
      </div>
    </section>
  );
}

function reorderMediaItems<T>(items: T[], from: number, dropIndex: number) {
  const position = from < dropIndex ? dropIndex - 1 : dropIndex;
  if (from === position) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(position, 0, moved);
  return next;
}

async function downloadEditorMedia(url: string, index: number) {
  const baseName = `midia-${index + 1}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download");
    const blob = await response.blob();
    triggerPortalDownload(blob, `${baseName}.${portalAssetExtension(url, blob.type)}`);
  } catch {
    const link = document.createElement("a");
    link.href = url;
    link.download = baseName;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
  }
}

function ReorderableMediaGrid({
  items,
  onReorder,
  onRemove,
}: {
  items: Array<{ id: string; url: string; isVideo: boolean }>;
  onReorder: (from: number, dropIndex: number) => void;
  onRemove: (index: number) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const finishDrop = (index: number) => {
    if (draggedIndex !== null) onReorder(draggedIndex, index);
    setDraggedIndex(null);
    setDropIndex(null);
  };

  return <div className="editor-media-grid reorderable-media-grid">
    {items.map((item, index) => <div className="media-order-slot" key={item.id}>
      {dropIndex === index ? <div className="media-order-indicator"><span>Soltar aqui</span></div> : null}
      <article
        className={draggedIndex === index ? "editor-media-thumb media-order-item dragging" : "editor-media-thumb media-order-item"}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", item.id);
          setDraggedIndex(index);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          const bounds = event.currentTarget.getBoundingClientRect();
          setDropIndex(event.clientX > bounds.left + bounds.width / 2 ? index + 1 : index);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          finishDrop(event.clientX > bounds.left + bounds.width / 2 ? index + 1 : index);
        }}
        onDragEnd={() => { setDraggedIndex(null); setDropIndex(null); }}
      >
        {item.isVideo ? <video src={item.url} muted preload="metadata" /> : <img src={item.url} alt={`Slide ${index + 1}`} loading="lazy" decoding="async" />}
        <span>{index === 0 ? "1 · Capa" : `Slide ${index + 1}`}</span>
        <i className="media-order-grip" aria-hidden="true">⠿</i>
        <button className="media-download-button" type="button" title={`Baixar slide ${index + 1}`} aria-label={`Baixar slide ${index + 1}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); void downloadEditorMedia(item.url, index); }}><UiIcon name="download" /></button>
        <button className="media-remove-button" type="button" title={`Remover slide ${index + 1}`} aria-label={`Remover slide ${index + 1}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRemove(index); }}>×</button>
      </article>
    </div>)}
    {dropIndex === items.length ? <div className="media-order-indicator media-order-indicator-end"><span>Soltar aqui</span></div> : null}
  </div>;
}

function CardEditorModal({
  columns,
  target,
  onClose,
  onSave,
}: {
  columns: BoardColumn[];
  target: { columnId: string | null } | null;
  onClose: () => void;
  onSave: (input: {
    columnId: string | null;
    title: string;
    caption: string | null;
    primaryMediaUrl: string | null;
    mediaUrls?: string[];
    mediaType?: string;
    externalLinkUrl: string | null;
    artType: string;
    status: string[];
    tags: string[];
  }) => Promise<void>;
}) {
  const [columnId, setColumnId] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMediaFiles] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const [externalLinkUrl, setExternalLinkUrl] = useState("");
  const [artType, setArtType] = useState("Post único");
  const [statusText, setStatusText] = useState("Pendente");
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setColumnId(target.columnId ?? "");
    setTitle("");
    setCaption("");
    setMediaFiles((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setExternalLinkUrl("");
    setArtType("Post único");
    setStatusText("Pendente");
    setTagsText("");
    setError("");
  }, [target]);

  if (!target) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Coloque um título para o post.");
      return;
    }

    const invalidMedia = mediaFiles.find(({ file }) => file.size > (file.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE));
    if (invalidMedia) {
      const { file } = invalidMedia;
      const fileLimit = file.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE;
      setError(
        `“${file.name}” tem ${formatFileSize(file.size)}. O limite para ${file.type.startsWith("video/") ? "vídeos e 20 MB" : "imagens e 12 MB"}.`,
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      const mediaUrls: string[] = [];
      for (const { file } of mediaFiles) mediaUrls.push(await uploadAdminMedia(file));
      await onSave({
        columnId: columnId || null,
        title: title.trim(),
        caption: caption.trim() || null,
        primaryMediaUrl: mediaUrls[0] ?? null,
        mediaUrls,
        mediaType: mediaFiles.some(({ file }) => file.type.startsWith("video/")) ? "video" : "image",
        externalLinkUrl: externalLinkUrl.trim() || null,
        artType,
        status: splitLabels(statusText),
        tags: splitLabels(tagsText),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o post agora.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="card-editor glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="column-editor-head">
          <div>
            <p className="eyebrow">Conteúdo da conta</p>
            <h3 id="card-editor-title">Novo post</h3>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <form className="card-editor-form" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Título</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Hidratação que transforma" />
          </label>

          <div className="card-form-grid">
            <label className="field-stack">
              <span>Coluna</span>
              <select value={columnId} onChange={(event) => setColumnId(event.target.value)}>
                <option value="">Sem coluna</option>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span>Formato</span>
              <select value={artType} onChange={(event) => setArtType(event.target.value)}>
                {ART_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div className="art-upload-field">
            <span>Slides do post <em>opcional</em></span>
            {mediaFiles.length ? <ReorderableMediaGrid
              items={mediaFiles.map((item) => ({ id: item.id, url: item.previewUrl, isVideo: item.file.type.startsWith("video/") }))}
              onReorder={(from, to) => setMediaFiles((current) => reorderMediaItems(current, from, to))}
              onRemove={(index) => setMediaFiles((current) => {
                const removed = current[index];
                if (removed) URL.revokeObjectURL(removed.previewUrl);
                return current.filter((_, itemIndex) => itemIndex !== index);
              })}
            /> : null}
            <label className="carousel-upload-button">
              {mediaFiles.length ? "+ Adicionar outros slides" : "+ Escolher imagens ou vídeos"}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files ?? []);
                const invalidFile = selectedFiles.find((file) => (!file.type.startsWith("image/") && !file.type.startsWith("video/")) || file.size > (file.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE));
                if (invalidFile) {
                  setError(`“${invalidFile.name}” não pôde ser adicionado. Confira o formato e o tamanho do arquivo.`);
                  event.target.value = "";
                  return;
                }
                setMediaFiles((current) => [...current, ...selectedFiles.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))]);
                setError("");
                event.target.value = "";
              }}
            />
            </label>
            <small>{mediaFiles.length ? "Arraste os slides para definir a ordem. O slide 1 será a capa." : "Você pode escolher vários arquivos. Imagens viram WebP automaticamente."}</small>
          </div>

          <label className="field-stack">
            <span>Link externo <em>opcional</em></span>
            <input
              type="url"
              value={externalLinkUrl}
              onChange={(event) => setExternalLinkUrl(event.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </label>

          <label className="field-stack">
            <span>Legenda ou observação</span>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Escreva a legenda, briefing ou uma nota sobre este post." />
          </label>

          <div className="card-form-grid">
            <label className="field-stack">
              <span>Status</span>
              <input value={statusText} onChange={(event) => setStatusText(event.target.value)} placeholder="Pendente, Design pronto" />
            </label>
            <label className="field-stack">
              <span>Tags</span>
              <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="Instagram, Campanha" />
            </label>
          </div>

          {error ? <p className="form-feedback error-text">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="gradient-button" disabled={saving}>{saving ? "Criando..." : "Criar post"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function splitLabels(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
}

const columnColors = ["#ed87bb", "#ff7929", "#5a9df6", "#40b969", "#8d6be8", "#d644df"];

function ColumnEditorModal({
  column,
  open,
  onClose,
  onSave,
}: {
  column: BoardColumn | null;
  open: boolean;
  onClose: () => void;
  onSave: (input: { name: string; color: string; visibleToClient: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(columnColors[0]);
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(column?.name ?? "");
    setColor(column?.color ?? columnColors[0]);
    setVisibleToClient(column?.visibleToClient ?? false);
    setSaving(false);
    setError("");
  }, [column, open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Escolha um nome para a coluna.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), color, visibleToClient });
    } catch {
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="column-editor glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="column-editor-head">
          <div>
            <p className="eyebrow">Kanban da conta</p>
            <h3 id="column-editor-title">{column ? "Editar coluna" : "Nova coluna"}</h3>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <form className="column-editor-form" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Nome da coluna</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Em aprovação"
            />
          </label>

          <div className="column-color-field">
            <span>Cor da coluna</span>
            <div className="column-color-options">
              {columnColors.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Usar cor ${option}`}
                  className={color === option ? "color-swatch selected" : "color-swatch"}
                  style={{ background: option }}
                  onClick={() => setColor(option)}
                />
              ))}
            </div>
          </div>

          <label className="visibility-setting">
            <input
              type="checkbox"
              checked={visibleToClient}
              onChange={(event) => setVisibleToClient(event.target.checked)}
            />
            <span>
              <strong>Mostrar para o cliente</strong>
              <small>O cliente podera ver esta coluna no portal dele.</small>
            </span>
          </label>

          {error ? <p className="form-feedback error-text">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="gradient-button" disabled={saving}>
              {saving ? "Salvando..." : column ? "Salvar alterações" : "Criar coluna"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CardContextMenu({
  card, position, tags, clients, onClose, onUpdateStatus, onToggleTag, onCopyToColumn, onMoveToColumn, onCopyToClient, onArchive, onDelete,
}: {
  card: BoardCard;
  position: { columnId: string | null; x: number; y: number; openLeft: boolean };
  tags: ClientTagDefinition[];
  clients: AdminClientOption[];
  onClose: () => void;
  onUpdateStatus: (status: string) => Promise<void>;
  onToggleTag: (tag: string) => Promise<void>;
  onCopyToColumn: () => void;
  onMoveToColumn: () => void;
  onCopyToClient: () => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<"status" | "tags" | "clients" | null>(null);
  const run = async (action: () => Promise<void>) => { await action(); onClose(); };
  return createPortal(
    <>
      <button className="card-menu-backdrop" aria-label="Fechar menu" onClick={onClose} />
      <section className={`card-context-menu${position.openLeft ? " opens-left" : ""}`} style={{ left: position.x, top: position.y }} aria-label={`Ações para ${card.title}`} onMouseLeave={() => setPanel(null)}>
        <button type="button" className={panel === "status" ? "active" : ""} aria-haspopup="menu" aria-expanded={panel === "status"} onPointerEnter={() => setPanel("status")} onClick={() => setPanel((current) => current === "status" ? null : "status")}>☷ <span>Status</span><b>›</b></button>
        {panel === "status" ? <div className="card-menu-submenu status-submenu"><button className={!card.statusBadges[0] ? "selected" : ""} onClick={() => run(() => onUpdateStatus(""))}>{!card.statusBadges[0] ? "✓ " : "○ "}Sem status</button>{CARD_STATUS_OPTIONS.map((status) => { const selected = card.statusBadges[0] === status; return <button key={status} className={selected ? "selected" : ""} onClick={() => run(() => onUpdateStatus(selected ? "" : status))}>{selected ? "✓ " : ""}{status}</button>; })}</div> : null}
        <button type="button" className={panel === "tags" ? "active" : ""} aria-haspopup="menu" aria-expanded={panel === "tags"} onPointerEnter={() => setPanel("tags")} onClick={() => setPanel((current) => current === "tags" ? null : "tags")}>◇ <span>Etiquetas</span><b>›</b></button>
        {panel === "tags" ? <div className="card-menu-submenu tags-submenu">{tags.map((tag) => <button key={tag.id} onClick={() => run(() => onToggleTag(tag.name))}>{card.tags.includes(tag.name) ? <b className="tag-menu-check">✓</b> : <i className="tag-menu-dot" style={{ backgroundColor: cardTagColor(tag.name, tag.color) }} />}{cardStatusLabel(tag.name)}</button>)}</div> : null}
        <hr />
        <button onClick={onCopyToColumn}>▣ <span>Copiar card</span></button>
        <button onClick={onMoveToColumn}>⇄ <span>Mover para coluna</span></button>
        <button onClick={onCopyToClient}>➤ <span>Enviar para outro cliente</span></button>
        <button onClick={() => run(onArchive)}>▱ <span>Arquivar</span></button>
        <hr />
        <button className="danger" onClick={() => { if (window.confirm(`Excluir o card “${card.title}”? Esta ação não pode ser desfeita.`)) run(onDelete); }}>♜ <span>Excluir</span></button>
      </section>
    </>,
    document.body,
  );
}

function CardColumnDialog({
  card, columns, mode, onClose, onConfirm,
}: {
  card: BoardCard;
  columns: BoardColumn[];
  mode: "copy" | "move";
  onClose: () => void;
  onConfirm: (columnId: string | null) => Promise<void>;
}) {
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const actionLabel = mode === "copy" ? "Copiar card" : "Mover card";
  return (
    <div className="card-column-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="card-column-modal" role="dialog" aria-modal="true" aria-labelledby="card-column-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="card-column-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        <h3 id="card-column-dialog-title">{actionLabel}</h3>
        <p>Para qual coluna deseja {mode === "copy" ? "copiar" : "mover"} <strong>“{card.title}”</strong>?</p>
        <label className="card-column-select-label">
          Coluna de destino
          <select value={columnId} onChange={(event) => setColumnId(event.target.value)}>
            {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
            <option value="">Sem coluna</option>
          </select>
        </label>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="gradient-button" disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onConfirm(columnId || null); onClose(); } finally { setSaving(false); }
          }}>{saving ? "Salvando..." : actionLabel}</button>
        </div>
      </section>
    </div>
  );
}

function CardClientDialog({ card, clients, onClose, onConfirm }: { card: BoardCard; clients: AdminClientOption[]; onClose: () => void; onConfirm: (targetSlug: string, mode: "copy" | "move", columnId: string | null) => Promise<void> }) {
  const [targetSlug, setTargetSlug] = useState(clients[0]?.slug ?? "");
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [columnId, setColumnId] = useState("");
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [saving, setSaving] = useState(false);
  useEffect(() => { let active = true; setColumns([]); setColumnId(""); if (!targetSlug) return; void loadAdminWorkspaceBySlug(targetSlug).then((result) => { if (active) { setColumns(result.columns); setColumnId(result.columns[0]?.id ?? ""); } }).catch(() => { if (active) setColumns([]); }); return () => { active = false; }; }, [targetSlug]);
  return <div className="card-column-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="card-column-modal card-client-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="card-column-modal-close" onClick={onClose} aria-label="Fechar">×</button><h3>Enviar card para outro cliente</h3><p>Escolha se deseja copiar ou transferir <strong>“{card.title}”</strong>.</p><fieldset className="card-transfer-options"><legend>Ação</legend><label><input type="radio" checked={mode === "copy"} onChange={() => setMode("copy")} />Copiar (duplicar)</label><label><input type="radio" checked={mode === "move"} onChange={() => setMode("move")} />Mover (transferir)</label></fieldset><label className="card-column-select-label">Cliente destino<select value={targetSlug} onChange={(event) => setTargetSlug(event.target.value)}>{clients.map((client) => <option key={client.id} value={client.slug}>{client.name}</option>)}</select></label><label className="card-column-select-label">Coluna destino<select value={columnId} onChange={(event) => setColumnId(event.target.value)}><option value="">Sem coluna</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label><div className="modal-actions"><button className="ghost-button" onClick={onClose} disabled={saving}>Cancelar</button><button className="gradient-button" disabled={saving || !targetSlug} onClick={async () => { setSaving(true); try { await onConfirm(targetSlug, mode, columnId || null); onClose(); } finally { setSaving(false); } }}>{saving ? "Enviando..." : mode === "copy" ? "Copiar card" : "Mover card"}</button></div></section></div>;
}

function BulkActionBar({ selectedCount, onCancel, onDelete, onArchive, onSendToClient, onStatus, onCopy, onMove }: {
  selectedCount: number; onCancel: () => void; onDelete: () => Promise<void>; onArchive: () => Promise<void>;
  onSendToClient: () => Promise<void>; onStatus: (status: string) => Promise<void>; onCopy: () => void; onMove: () => void;
}) {
  return <aside className="bulk-action-bar">
    <strong>{selectedCount} {selectedCount === 1 ? "card selecionado" : "cards selecionados"}</strong>
    <button disabled={!selectedCount} onClick={onCopy}>Copiar</button><button disabled={!selectedCount} onClick={onMove}>Mover</button>
    <button disabled={!selectedCount} onClick={() => void onSendToClient()}>Enviar para cliente</button>
    <select disabled={!selectedCount} defaultValue="" onChange={(event) => { if (event.target.value) { void onStatus(event.target.value === "__none__" ? "" : event.target.value); event.target.value = ""; } }}><option value="">Mudar status</option><option value="__none__">Sem status</option>{CARD_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
    <button disabled={!selectedCount} onClick={() => void onArchive()}>Arquivar</button><button className="danger" disabled={!selectedCount} onClick={() => void onDelete()}>Apagar</button>
    <button className="bulk-close" onClick={onCancel}>×</button>
  </aside>;
}

function BulkColumnDialog({ mode, columns, selectedCount, onClose, onConfirm }: { mode: "copy" | "move"; columns: BoardColumn[]; selectedCount: number; onClose: () => void; onConfirm: (columnId: string | null) => Promise<void> }) {
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const label = mode === "copy" ? "Copiar" : "Mover";
  return <div className="card-column-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="card-column-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <button className="card-column-modal-close" onClick={onClose} aria-label="Fechar">×</button><h3>{label} cards</h3>
    <p>Para qual coluna deseja {mode === "copy" ? "copiar" : "mover"} os <strong>{selectedCount} cards selecionados</strong>?</p>
    <label className="card-column-select-label">Coluna de destino<select value={columnId} onChange={(event) => setColumnId(event.target.value)}>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}<option value="">Sem coluna</option></select></label>
    <div className="modal-actions"><button className="ghost-button" onClick={onClose} disabled={saving}>Cancelar</button><button className="gradient-button" disabled={saving} onClick={async () => { setSaving(true); try { await onConfirm(columnId || null); } finally { setSaving(false); } }}>{saving ? "Salvando..." : `${label} cards`}</button></div>
  </section></div>;
}

function RestoreCardDialog({ card, columns, onClose, onConfirm }: { card: BoardCard; columns: BoardColumn[]; onClose: () => void; onConfirm: (columnId: string | null) => Promise<void> }) {
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="card-column-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="card-column-modal restore-card-modal" role="dialog" aria-modal="true" aria-labelledby="restore-card-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="card-column-modal-close" onClick={onClose} aria-label="Fechar">×</button>
      <h3 id="restore-card-dialog-title">Restaurar card</h3>
      <p>Em qual coluna deseja restaurar <strong>“{card.title}”</strong>?</p>
      <div className="restore-column-list" role="listbox" aria-label="Colunas disponíveis">
        {columns.map((column) => <button key={column.id} className={columnId === column.id ? "selected" : ""} onClick={() => setColumnId(column.id)}><span style={{ backgroundColor: column.color }} />{column.name}{columnId === column.id ? <b>✓</b> : null}</button>)}
        <button className={columnId === "" ? "selected" : ""} onClick={() => setColumnId("")}><span className="without-column-dot" />Sem coluna{columnId === "" ? <b>✓</b> : null}</button>
      </div>
      {error ? <p className="form-feedback error-text">{error}</p> : null}
      <div className="modal-actions"><button className="ghost-button" onClick={onClose} disabled={saving}>Cancelar</button><button className="gradient-button" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await onConfirm(columnId || null); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível restaurar o card."); } finally { setSaving(false); } }}>{saving ? "Restaurando..." : "Restaurar"}</button></div>
    </section>
  </div>;
}

function AdminTextsView({ clientName, slug, onCountChange }: { clientName: string; slug: string; onCountChange?: (count: number) => void }) {
  const contentTypes: TextDocument["contentType"][] = ["Blog", "Artigo", "Texto", "Copy", "Documento"];
  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<TextComment[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos os textos");
  const [actionMessage, setActionMessage] = useState("");
  const [contentTypeOpen, setContentTypeOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [autosavedAt, setAutosavedAt] = useState<Date | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const lastSavedTextRef = useRef("");
  const latestTextDraftRef = useRef("");
  const textSaveInFlightRef = useRef(false);
  const commentsRef = useRef<HTMLElement>(null);
  const studioRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagColor, setTagColor] = useState("#7568dc");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { onCountChange?.(documents.length); }, [documents.length, onCountChange]);
  const selected = documents.find((item) => item.id === selectedId) ?? null;
  const initials = (name: string) => name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const refreshTexts = async (selectId?: string) => {
    setLoading(true);
    try {
      const response = await listAdminTextsBySlug(slug);
      if (!response.items.length && !selectId) {
        const created = await createAdminTextBySlug(slug, { title: "Novo texto", contentType: "Texto" });
        setDocuments([created.text]);
        setSelectedId(created.text.id);
        setActionMessage("Novo texto pronto para edição.");
      } else {
        setDocuments(response.items);
        setSelectedId((current) => selectId ?? (response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null));
      }
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível carregar os textos."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refreshTexts(); }, [slug]);
  useEffect(() => {
    if (!selected) { setComments([]); return; }
    const recoveryKey = `designhub-v2-text-draft:${slug}:${selected.id}`;
    const recovered = readRecoveryDraft<Partial<TextDocument> & { contentHtml?: string }>(recoveryKey);
    const serverDraft = { title: selected.title, contentType: selected.contentType, plannedAt: selected.plannedAt, internalNotes: selected.internalNotes, status: selected.status, tags: selected.tags ?? [], contentHtml: selected.contentHtml };
    lastSavedTextRef.current = JSON.stringify(serverDraft);
    if (recovered) {
      setDocuments((items) => items.map((item) => item.id === selected.id ? { ...item, ...recovered, tags: normalizeTextTags(recovered.tags ?? selected.tags) } : item));
      setAutosaveState("recovered");
    } else {
      setAutosaveState("idle");
    }
    if (editorRef.current) editorRef.current.innerHTML = recovered?.contentHtml ?? selected.contentHtml;
    setEditorRevision((value) => value + 1);
    setCoverImage(window.localStorage.getItem(`designhub-text-cover:${slug}:${selected.id}`));
    void listAdminTextCommentsBySlug(slug, selected.id).then((result) => setComments(result.comments)).catch(() => setComments([]));
  }, [selected?.id, slug]);
  const updateLocal = (patch: Partial<TextDocument>) => selected && setDocuments((items) => items.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  const rememberEditorSelection = () => { const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null; if (range && editorRef.current?.contains(range.commonAncestorContainer)) editorSelectionRef.current = range.cloneRange(); };
  const formatDocument = (command: string, value?: string) => { editorRef.current?.focus(); if (editorSelectionRef.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(editorSelectionRef.current); } document.execCommand(command, false, value); rememberEditorSelection(); setEditorRevision((revision) => revision + 1); };
  const saveText = async (message = "Rascunho salvo.") => {
    if (!selected || textSaveInFlightRef.current) return false;
    const recoveryKey = `designhub-v2-text-draft:${slug}:${selected.id}`;
    const draft = { title: selected.title, contentType: selected.contentType, plannedAt: selected.plannedAt, internalNotes: selected.internalNotes, status: selected.status, tags: selected.tags ?? [], contentHtml: editorRef.current?.innerHTML ?? selected.contentHtml };
    const draftJson = JSON.stringify(draft);
    latestTextDraftRef.current = draftJson;
    if (draftJson === lastSavedTextRef.current) return true;
    textSaveInFlightRef.current = true;
    setSaving(true);
    setAutosaveState("saving");
    try {
      const response = await updateAdminTextBySlug(slug, selected.id, draft);
      updateLocal(response.text);
      setActionMessage(message);
      lastSavedTextRef.current = draftJson;
      if (latestTextDraftRef.current === draftJson) {
        try { window.localStorage.removeItem(recoveryKey); } catch { /* Recovery remains optional. */ }
      }
      setAutosavedAt(new Date());
      setAutosaveState(latestTextDraftRef.current === draftJson ? "saved" : "pending");
      if (latestTextDraftRef.current !== draftJson) setEditorRevision((revision) => revision + 1);
      return true;
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível salvar o texto."); }
    finally { textSaveInFlightRef.current = false; setSaving(false); }
    setAutosaveState("error");
    return false;
  };
  useEffect(() => {
    if (!selected) return;
    const recoveryKey = `designhub-v2-text-draft:${slug}:${selected.id}`;
    const draft = { title: selected.title, contentType: selected.contentType, plannedAt: selected.plannedAt, internalNotes: selected.internalNotes, status: selected.status, tags: selected.tags ?? [], contentHtml: editorRef.current?.innerHTML ?? selected.contentHtml };
    const draftJson = JSON.stringify(draft);
    latestTextDraftRef.current = draftJson;
    if (draftJson === lastSavedTextRef.current) return;
    try { window.localStorage.setItem(recoveryKey, draftJson); } catch { /* Recovery remains optional. */ }
    setAutosaveState((current) => current === "saving" ? current : "pending");
    const timeout = window.setTimeout(() => { if (document.visibilityState === "visible") void saveText("Salvo automaticamente."); }, 8_000);
    return () => window.clearTimeout(timeout);
  }, [editorRevision, selected?.contentType, selected?.internalNotes, selected?.plannedAt, selected?.status, selected?.tags, selected?.title, selected?.id, slug]);
  const addTextTag = () => { const name = tagDraft.trim().replace(/^#/, ""); if (!selected || !name || (selected.tags ?? []).some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) return; updateLocal({ tags: [...(selected.tags ?? []), { name, color: tagColor }].slice(0, 12) }); setTagDraft(""); };
  const removeTextTag = (tagName: string) => updateLocal({ tags: (selected?.tags ?? []).filter((item) => item.name !== tagName) });
  const updateTextTagColor = (tagName: string, color: string) => updateLocal({ tags: (selected?.tags ?? []).map((item) => item.name === tagName ? { ...item, color } : item) });
  const createText = async () => {
    try { const response = await createAdminTextBySlug(slug, { title: "Novo texto", contentType: "Texto" }); setDocuments((items) => [response.text, ...items]); setSelectedId(response.text.id); setActionMessage("Novo texto criado."); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível criar o texto."); }
  };
  const addEditorImage = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    try { const url = await uploadAdminMedia(file); const image = document.createElement("img"); image.src = url; image.alt = "Imagem inserida no texto"; image.className = "texts-inline-image"; editorRef.current?.append(image, document.createElement("p")); setEditorRevision((revision) => revision + 1); setActionMessage("Imagem adicionada. O texto será salvo automaticamente."); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem."); }
  };
  const addCoverImage = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/") || !selected) return;
    try {
      const url = await uploadAdminMedia(file);
      window.localStorage.setItem(`designhub-text-cover:${slug}:${selected.id}`, url);
      setCoverImage(url);
      setActionMessage("Banner adicionado ao texto.");
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível enviar o banner."); }
  };
  const downloadWord = () => {
    if (!selected) return;
    const banner = coverImage ? `<img src="${coverImage}" alt="Banner" style="display:block;width:100%;max-height:220px;object-fit:cover;margin-bottom:24px;" />` : "";
    const content = `<html><body>${banner}<h1>${selected.title}</h1>${editorRef.current?.innerHTML ?? selected.contentHtml}</body></html>`;
    const url = URL.createObjectURL(new Blob([content], { type: "application/msword" })); const link = document.createElement("a"); link.href = url; link.download = `${selected.title.slice(0, 55)}.doc`; link.click(); URL.revokeObjectURL(url); setActionMessage("Arquivo Word baixado.");
  };
  const downloadPdf = async () => {
    if (!selected || pdfSaving) return;
    setPdfSaving(true);
    const printable = document.createElement("div");
    printable.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;padding:32px;background:#fff;color:#192342;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.55;";
    printable.innerHTML = `${coverImage ? `<img src="${coverImage}" alt="Banner" style="display:block;width:100%;height:180px;object-fit:cover;border-radius:14px;margin-bottom:24px;" />` : ""}<h1 style="font-size:32px;margin:0 0 24px;">${selected.title}</h1><div>${editorRef.current?.innerHTML ?? selected.contentHtml}</div>`;
    document.body.appendChild(printable);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      await pdf.html(printable, { margin: [36, 36, 36, 36], autoPaging: "text", width: 523, windowWidth: 760 });
      pdf.save(`${selected.title.slice(0, 55)}.pdf`);
      setActionMessage("PDF baixado com banner e imagens do artigo.");
    } catch (error) {
      window.print();
      setActionMessage(error instanceof Error ? "A janela de impressão foi aberta para salvar o PDF." : "A janela de impressão foi aberta para salvar o PDF.");
    } finally { printable.remove(); setPdfSaving(false); }
  };
  const sendToClient = async () => {
    if (!selected) return;
    await saveText();
    try { const response = await sendAdminTextToClientBySlug(slug, selected.id); updateLocal(response.text); setActionMessage(`Texto enviado para a área de ${clientName}.`); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível enviar o texto."); }
  };
  const deleteSelectedText = async () => {
    if (!selected || !window.confirm(`Excluir “${selected.title}” permanentemente? Os comentários deste texto também serão apagados.`)) return;
    setSaving(true);
    try {
      await deleteAdminTextBySlug(slug, selected.id);
      const remaining = documents.filter((item) => item.id !== selected.id);
      setDocuments(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setActionMessage("Texto excluído permanentemente.");
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível excluir o texto."); }
    finally { setSaving(false); }
  };
  const submitComment = async () => {
    if (!selected || !commentDraft.trim()) return;
    try { const response = await addAdminTextCommentBySlug(slug, selected.id, { commentText: commentDraft.trim(), isInternal: false }); setComments((items) => [...items, response.comment]); setCommentDraft(""); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível enviar o comentário."); }
  };
  const textTagLibrary = Array.from(new Map(documents.flatMap((item) => item.tags ?? []).map((tag) => [tag.name.toLocaleLowerCase("pt-BR"), tag])).values());
  const visibleDocuments = documents.filter((item) => (filter === "Todos os textos" || item.status === filter) && item.title.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (!tagFilters.length || tagFilters.every((name) => item.tags?.some((tag) => tag.name === name))));
  const countFor = (label: string) => label === "Todos os textos" ? documents.length : documents.filter((item) => item.status === label).length;
  if (loading && !selected) return <section className="texts-studio"><div className="texts-loading">Carregando textos...</div></section>;
  if (!selected) return <section className="texts-studio"><div className="texts-loading"><p>Nenhum texto criado ainda.</p><button className="gradient-button" onClick={() => void createText()}>+ Criar primeiro texto</button></div></section>;
  return <section className="texts-studio" ref={studioRef} onScroll={(event) => { const next = event.currentTarget.scrollTop > 180; setShowScrollTop((current) => current === next ? current : next); }}>
    <aside className="texts-library">
      <div className="texts-library-head"><div><p className="column-kicker">Biblioteca</p><h3>Textos</h3></div><button className="texts-new-button" onClick={() => void createText()}>+ Novo texto</button></div>
      <label className="texts-search"><UiIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar textos" /></label>
      {textTagLibrary.length ? <div className="text-tag-filters"><header><span>Filtrar por etiquetas</span>{tagFilters.length ? <button type="button" onClick={() => setTagFilters([])}>Limpar</button> : null}</header><div>{textTagLibrary.map((tag) => { const active = tagFilters.includes(tag.name); return <button type="button" key={tag.name} className={active ? "active" : ""} style={{ backgroundColor: active ? tag.color : undefined, color: active ? calendarTextColor(tag.color) : undefined, borderColor: tag.color }} onClick={() => setTagFilters((items) => active ? items.filter((name) => name !== tag.name) : [...items, tag.name])}><i style={{ backgroundColor: tag.color }} />{tag.name}{active ? " ✓" : ""}</button>; })}</div></div> : null}
      <nav className="texts-nav" aria-label="Categorias de textos">{["Todos os textos", "Rascunho", "Em revisão", "Aprovado"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "Todos os textos" ? "▣" : item === "Rascunho" ? "◌" : item === "Em revisão" ? "◒" : "✓"} {item}<span>{countFor(item)}</span></button>)}</nav>
      <button className="texts-library-comments" onClick={() => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>▢ <span>Comentários</span><b>{comments.length}</b></button>
      <div className="texts-document-list">{visibleDocuments.map((item) => <button key={item.id} className={selected.id === item.id ? "selected" : ""} onClick={async () => { await saveText("Salvo antes de trocar de texto."); setSelectedId(item.id); }}><span>{item.contentType}</span><strong>{item.tags?.length ? <em className="text-title-tags">{item.tags.map((tag) => <i key={tag.name} style={{ backgroundColor: tag.color, color: calendarTextColor(tag.color) }}>{tag.name}</i>)}</em> : null}{item.title}</strong><small>{item.status}</small></button>)}</div>
    </aside>
    <article className="texts-document">
        <header className="texts-breadcrumb">Textos <span>›</span> {selected.contentType}</header>
      <div className="texts-paper">
        <div className="texts-rich-toolbar" role="toolbar" aria-label="Ferramentas de edição"><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("undo")} title="Desfazer">↶</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("redo")} title="Refazer">↷</button><i /><select title="Estilo do texto" aria-label="Estilo do texto" defaultValue="p" onChange={(event) => formatDocument("formatBlock", event.target.value)}><option value="p">Texto normal</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="blockquote">Citação</option></select><i /><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("bold")} title="Negrito"><b>B</b></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("italic")} title="Itálico"><em>I</em></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("underline")} title="Sublinhado"><u>U</u></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("insertUnorderedList")} title="Lista">☷</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("createLink", window.prompt("Cole o link") ?? "")} title="Inserir link">⌁</button><label title="Adicionar imagem">▧<input type="file" accept="image/*" onChange={(event) => addEditorImage(event.target.files?.[0] ?? null)} /></label></div>
        <div className="texts-rich-toolbar texts-rich-toolbar-advanced" role="toolbar" aria-label="Formatação avançada"><select title="Tamanho da fonte" aria-label="Tamanho da fonte" defaultValue="1" onChange={(event) => formatDocument("fontSize", event.target.value)}><option value="1">Pequena</option><option value="5">Grande</option><option value="7">Muito grande</option></select><label className="texts-color-tool" title="Cor do texto">A<input type="color" defaultValue="#263451" onMouseDown={rememberEditorSelection} onChange={(event) => formatDocument("foreColor", event.target.value)} /></label><label className="texts-color-tool highlight" title="Marca-texto">▰<input type="color" defaultValue="#fff1a8" onMouseDown={rememberEditorSelection} onChange={(event) => formatDocument("hiliteColor", event.target.value)} /></label><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("justifyLeft")} title="Alinhar à esquerda">≡</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("justifyCenter")} title="Centralizar">≡</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("justifyRight")} title="Alinhar à direita">≡</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("outdent")} title="Diminuir recuo">⇤</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("indent")} title="Aumentar recuo">⇥</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("insertHorizontalRule")} title="Inserir separador">―</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("insertHTML", "☐ ")} title="Checklist">☑</button></div>
        <header className="texts-paper-head"><div><span className="texts-status">{selected.status}</span>{selected.tags?.length ? <div className="text-heading-tags">{selected.tags.map((tag) => <span key={tag.name} style={{ backgroundColor: tag.color, color: calendarTextColor(tag.color) }}>{tag.name}</span>)}</div> : null}<textarea className="texts-title-input" rows={1} value={selected.title} onChange={(event) => updateLocal({ title: event.target.value.replace(/\n/g, " ") })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} aria-label="Título do texto" /><div className="texts-meta"><span>◇ {selected.contentType}</span><span>◷ Atualizado {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(selected.updatedAt))}</span></div></div></header>
        <div className={`texts-cover${coverImage ? " has-image" : ""}`} style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}>
          {!coverImage ? <><i /><b /></> : null}
          <label className="texts-cover-upload" title={coverImage ? "Trocar banner" : "Adicionar banner"}>
            <span>{coverImage ? "Trocar banner" : "Adicionar banner"}</span>
            <input type="file" accept="image/*" onChange={(event) => { void addCoverImage(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
          </label>
        </div>
        <div className="texts-copy texts-rich-editor" ref={editorRef} contentEditable suppressContentEditableWarning onMouseUp={rememberEditorSelection} onKeyUp={rememberEditorSelection} onInput={() => { rememberEditorSelection(); setEditorRevision((revision) => revision + 1); }} />
        <section className="texts-comments-section" ref={commentsRef}><header><div><span>Discussão</span><h2>Comentários ({comments.length})</h2></div></header><div className="texts-comment-list">{comments.map((comment) => <article key={comment.id}>{comment.authorAvatarUrl ? <span className="texts-comment-avatar"><img src={comment.authorAvatarUrl} alt="" /></span> : <span className="texts-comment-avatar">{initials(comment.authorName)}</span>}<div><strong>{comment.authorName}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.createdAt))}</time><p>{comment.commentText}</p></div></article>)}</div><div className="texts-comment-compose"><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Escreva um comentário para o cliente e a equipe..." /><button className="gradient-button" disabled={!commentDraft.trim()} onClick={() => void submitComment()}>Comentar</button></div></section>
      </div>
    </article>
    <aside className="texts-side-panel">
      <section className="texts-content-type"><span>Tipo de conteúdo</span><div><button className="texts-content-type-trigger" onClick={() => setContentTypeOpen((open) => !open)} aria-expanded={contentTypeOpen}>{selected.contentType}<b>⌄</b></button>{contentTypeOpen ? <div className="texts-content-type-options">{contentTypes.map((type) => <button key={type} className={type === selected.contentType ? "selected" : ""} onClick={() => { updateLocal({ contentType: type }); setContentTypeOpen(false); }}>{type === selected.contentType ? <b>✓</b> : null}{type}</button>)}</div> : null}</div></section>
      <section className="texts-tags-panel"><span>Etiquetas</span><div className="texts-tags-list">{(selected.tags ?? []).map((tag) => <div className="texts-tag-edit" key={tag.name} style={{ backgroundColor: tag.color, color: calendarTextColor(tag.color) }}><label title={`Alterar a cor de ${tag.name}`}><input type="color" value={tag.color} onChange={(event) => updateTextTagColor(tag.name, event.target.value)} /><i style={{ backgroundColor: tag.color }} /></label><span>{tag.name}</span><button type="button" onClick={() => removeTextTag(tag.name)} title={`Remover ${tag.name}`}>×</button></div>)}</div>{textTagLibrary.some((tag) => !selected.tags?.some((item) => item.name === tag.name)) ? <div className="texts-tag-reuse"><small>Reutilizar</small><div>{textTagLibrary.filter((tag) => !selected.tags?.some((item) => item.name === tag.name)).map((tag) => <button type="button" key={tag.name} style={{ borderColor: tag.color }} onClick={() => updateLocal({ tags: [...(selected.tags ?? []), tag].slice(0, 12) })}><i style={{ backgroundColor: tag.color }} />{tag.name}</button>)}</div></div> : null}<div className="texts-tag-create"><input value={tagDraft} maxLength={40} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTextTag(); } }} placeholder="Nova etiqueta" /><label className="texts-tag-color" title="Cor da nova etiqueta"><input type="color" value={tagColor} onChange={(event) => setTagColor(event.target.value)} /><i style={{ backgroundColor: tagColor }} /></label><button onClick={addTextTag} disabled={!tagDraft.trim()}>＋</button></div></section>
      <section className="texts-actions texts-admin-actions">
        <AutosaveIndicator state={autosaveState} savedAt={autosavedAt} />
        <button className="gradient-button" onClick={() => setShowPreview(true)}>◉ Pré-visualizar</button>
        <button className="ghost-button" disabled={pdfSaving} onClick={() => void downloadPdf()}>⇩ {pdfSaving ? "Gerando PDF..." : "Baixar PDF"}</button>
        <button className="ghost-button" onClick={downloadWord}>▣ Baixar Word</button>
        <button className="ghost-button" disabled={saving} onClick={() => void saveText()}>{saving ? "Salvando..." : "✎ Salvar rascunho"}</button>
        <button className="gradient-button texts-send-client" disabled={saving} onClick={() => void sendToClient()}>➤ Enviar para cliente</button>
        <button className="texts-delete-button" disabled={saving} onClick={() => void deleteSelectedText()}>♜ Excluir texto</button>
        {actionMessage ? <small className="texts-action-message">{actionMessage}</small> : null}
      </section>
      <section className="texts-planning"><h3>Planejamento</h3><label>Data planejada<input type="date" value={selected.plannedAt ?? ""} onChange={(event) => updateLocal({ plannedAt: event.target.value || null })} /></label><label>Observações<textarea value={selected.internalNotes ?? ""} onChange={(event) => updateLocal({ internalNotes: event.target.value || null })} placeholder="Notas internas ou observações..." /></label></section>
      <section className="texts-info"><h3>Informações</h3><p><span>◷</span><b>Última revisão</b><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(selected.updatedAt))}</small></p><p><span>◉</span><b>Responsável</b><small>Equipe de conteúdo</small></p><p><span>◌</span><b>Visibilidade</b><small>{selected.isSentToClient ? `Enviado para ${clientName}` : `Somente equipe até enviar para ${clientName}`}</small></p></section>
    </aside>
    {showScrollTop ? <button className="texts-scroll-top" onClick={() => studioRef.current?.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Voltar ao topo" title="Voltar ao topo">↑</button> : null}
    {showPreview ? <div className="profile-modal-backdrop" onMouseDown={() => setShowPreview(false)}><section className="profile-modal texts-preview-modal" onMouseDown={(event) => event.stopPropagation()}><header><h3>Pré-visualização</h3><button onClick={() => setShowPreview(false)}>×</button></header><article>{coverImage ? <div className="texts-preview-cover" style={{ backgroundImage: `url(${coverImage})` }} aria-label="Banner do texto" /> : null}<h1>{selected.title}</h1><div dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML ?? selected.contentHtml }} /></article></section></div> : null}
  </section>;
}

function ArchivedCardsView({ cards, onOpenCard, onPreviewMedia, onRemoveTag, onRestore, onDelete }: { cards: BoardCard[]; onOpenCard: (cardId: string) => void; onPreviewMedia: (card: BoardCard) => void; onRemoveTag: (card: BoardCard, tag: string) => void; onRestore: (card: BoardCard) => void; onDelete: (cardId: string) => void }) {
  const groups = new Map<string, BoardCard[]>();
  [...cards]
    .sort((left, right) => getArchiveGroupDate(right).getTime() - getArchiveGroupDate(left).getTime())
    .forEach((card) => {
      // Archived cards belong to the month in which they were scheduled to publish.
      // The archival timestamp is used only when scheduling was never configured.
      const date = getArchiveGroupDate(card);
      const key = date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date)
        : "Sem data de agendamento";
      groups.set(key, [...(groups.get(key) ?? []), card]);
    });

  return <section className="archived-board">
    <header className="archived-board-head"><div><p className="column-kicker">Histórico</p><h3>Arquivados</h3></div><span>{cards.length} {cards.length === 1 ? "card" : "cards"}</span></header>
    {cards.length === 0 ? <div className="archived-empty">Nenhum card arquivado ainda.</div> : <div className="archive-month-columns">{[...groups.entries()].map(([month, monthCards]) => <section className="archive-month" key={month}><header><h4>{month}</h4><span>({monthCards.length})</span></header><div className="archive-month-cards">{monthCards.map((card) => <article key={card.id} className="archived-card"><CardView card={card} onOpen={() => onOpenCard(card.id)} onPreviewMedia={onPreviewMedia} onRemoveTag={onRemoveTag} /><div className="archived-card-actions"><button className="restore-card-button" onClick={() => onRestore(card)}>↶ <span>Restaurar</span></button><button className="danger" title="Excluir definitivamente" aria-label={`Excluir ${card.title} definitivamente`} onClick={() => onDelete(card.id)}><UiIcon name="trash" /></button></div></article>)}</div></section>)}</div>}
  </section>;
}

function getArchiveGroupDate(card: BoardCard) {
  const source = card.publishedAt ?? card.scheduledAt ?? card.archivedAt;
  if (!source) return new Date(0);
  // SQL schedules arrive as YYYY-MM-DD HH:mm:ss. Parsing explicitly as local time
  // prevents a scheduled post from moving to the prior month in a negative timezone.
  const normalized = source.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function CardMediaFallback({ title, linked = false }: { title: string; linked?: boolean }) {
  return <div className="card-media-fallback" role="img" aria-label={`Prévia indisponível para ${title}`}>
    <span><UiIcon name="image" /></span>
    <strong>{linked ? "Material vinculado" : "Sem prévia"}</strong>
    <small>{linked ? "Abra o card para acessar" : "Mídia não disponível"}</small>
  </div>;
}

function ResilientCardMedia({ url, title, video = false, controls = false, onRatio, onMediaKind, onPlay }: { url: string; title: string; video?: boolean; controls?: boolean; onRatio?: (width: number, height: number) => void; onMediaKind?: (kind: "image" | "video") => void; onPlay?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [fallbackTried, setFallbackTried] = useState(false);
  const [mediaKind, setMediaKind] = useState<"image" | "video">(video ? "video" : "image");
  useEffect(() => {
    setFailed(false);
    setFallbackTried(false);
    setMediaKind(video ? "video" : "image");
  }, [url, video]);
  const linked = /(?:drive|docs)\.google\.com/i.test(url);
  const driveFileId = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/i)?.[1];
  const previewUrl = driveFileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1200` : url;
  const tryOtherMediaKind = () => {
    if (!fallbackTried && !driveFileId) {
      setFallbackTried(true);
      setMediaKind((current) => current === "video" ? "image" : "video");
      return;
    }
    setFailed(true);
  };
  if (failed || (linked && !driveFileId)) return <CardMediaFallback title={title} linked={linked} />;
  return mediaKind === "video" && !driveFileId
    ? <video src={previewUrl} controls={controls} playsInline preload="metadata" onPlay={onPlay} onError={tryOtherMediaKind} onLoadedMetadata={(event) => { onMediaKind?.("video"); onRatio?.(event.currentTarget.videoWidth, event.currentTarget.videoHeight); }} />
    : <img src={previewUrl} alt={title} draggable={false} loading="lazy" decoding="async" onError={tryOtherMediaKind} onLoad={(event) => { onMediaKind?.("image"); onRatio?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight); }} />;
}

function ArtworkCarousel({ urls, title, activeIndex, onIndexChange, fullscreen = false, compact = false, preserveMediaSize = false, mediaType, onOpenVideo }: { urls: string[]; title: string; activeIndex?: number; onIndexChange?: (index: number) => void; fullscreen?: boolean; compact?: boolean; preserveMediaSize?: boolean; mediaType?: string; onOpenVideo?: (url: string) => void }) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [mediaRatios, setMediaRatios] = useState<Record<number, number>>({});
  const [mediaKinds, setMediaKinds] = useState<Record<number, "image" | "video">>({});
  const [startedVideos, setStartedVideos] = useState<Record<number, boolean>>({});
  const pointerStart = useRef<number | null>(null);
  const swiped = useRef(false);
  const index = Math.max(0, Math.min(activeIndex ?? internalIndex, urls.length - 1));
  const setIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(next, urls.length - 1));
    if (onIndexChange) onIndexChange(clamped);
    else setInternalIndex(clamped);
  };
  const rememberRatio = (itemIndex: number, width: number, height: number) => {
    if (!width || !height) return;
    const ratio = width / height;
    setMediaRatios((current) => Math.abs((current[itemIndex] ?? 0) - ratio) < .001 ? current : { ...current, [itemIndex]: ratio });
  };

  useEffect(() => {
    if (activeIndex === undefined) setInternalIndex((current) => Math.min(current, Math.max(0, urls.length - 1)));
  }, [activeIndex, urls.length]);

  if (urls.length === 0) return null;
  const multiple = urls.length > 1;
  const activeUrlLooksLikeVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(urls[index] ?? "");
  const activeIsVideo = mediaKinds[index] === "video" || activeUrlLooksLikeVideo;
  const activeAspect = activeIsVideo && /reels?/i.test(mediaType ?? "") ? 9 / 16 : mediaRatios[index] ?? 1;
  return <div className={`artwork-carousel${multiple ? " has-multiple" : " single"}${fullscreen ? " fullscreen" : ""}${compact ? " compact" : ""}${preserveMediaSize ? " preserve-media-size" : ""}${/reels?/i.test(mediaType ?? "") ? " reel-media" : ""}`} style={compact || preserveMediaSize ? { "--artwork-aspect": activeAspect } as CSSProperties : undefined} aria-label={`${title}: ${urls.length} ${urls.length === 1 ? "arte" : "artes"}`}>
    <div
      className="artwork-carousel-viewport"
      onPointerDown={(event) => { pointerStart.current = event.clientX; swiped.current = false; }}
      onPointerUp={(event) => {
        if (pointerStart.current === null) return;
        const distance = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(distance) < 42) return;
        swiped.current = true;
        setIndex(index + (distance < 0 ? 1 : -1));
      }}
      onPointerCancel={() => { pointerStart.current = null; }}
      onClick={(event) => { if (swiped.current) { event.stopPropagation(); swiped.current = false; } }}
    >
      <div className="artwork-carousel-track" style={{ "--artwork-index": index } as CSSProperties}>
        {urls.map((url, itemIndex) => {
          const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url) || (urls.length === 1 && /video|reels?/i.test(mediaType ?? ""));
          const detectedKind = mediaKinds[itemIndex] ?? (isVideo ? "video" : undefined);
          return <figure className={`${itemIndex === index ? "artwork-carousel-slide active" : "artwork-carousel-slide"}${detectedKind === "video" ? " video" : ""}`} key={`${url}-${itemIndex}`} aria-hidden={itemIndex !== index}>
            <ResilientCardMedia
              url={url}
              title={`${title} - arte ${itemIndex + 1}`}
              video={isVideo}
              controls={itemIndex === index && !onOpenVideo}
              onRatio={(width, height) => rememberRatio(itemIndex, width, height)}
              onMediaKind={(kind) => setMediaKinds((current) => current[itemIndex] === kind ? current : { ...current, [itemIndex]: kind })}
              onPlay={() => setStartedVideos((current) => current[itemIndex] ? current : { ...current, [itemIndex]: true })}
            />
            {detectedKind === "video" && !startedVideos[itemIndex] && itemIndex === index ? <button type="button" className="artwork-video-play" aria-label="Reproduzir vídeo" onClick={(event) => { event.stopPropagation(); if (onOpenVideo) onOpenVideo(url); else void event.currentTarget.parentElement?.querySelector("video")?.play(); }}><span /></button> : null}
          </figure>;
        })}
      </div>
    </div>
    {multiple ? <>
      {compact ? <span role="button" tabIndex={index === 0 ? -1 : 0} className={`artwork-carousel-nav previous${index === 0 ? " disabled" : ""}`} onClick={(event) => { event.stopPropagation(); setIndex(index - 1); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setIndex(index - 1); } }} aria-label="Arte anterior" aria-disabled={index === 0}>‹</span> : <button className="artwork-carousel-nav previous" type="button" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Arte anterior">‹</button>}
      {compact ? <span role="button" tabIndex={index === urls.length - 1 ? -1 : 0} className={`artwork-carousel-nav next${index === urls.length - 1 ? " disabled" : ""}`} onClick={(event) => { event.stopPropagation(); setIndex(index + 1); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setIndex(index + 1); } }} aria-label="Próxima arte" aria-disabled={index === urls.length - 1}>›</span> : <button className="artwork-carousel-nav next" type="button" onClick={() => setIndex(index + 1)} disabled={index === urls.length - 1} aria-label="Próxima arte">›</button>}
      <div className="artwork-carousel-progress" aria-live="polite">
        <span>{index + 1} de {urls.length}</span>
        <div>{urls.map((_, dotIndex) => compact ? <i key={dotIndex} className={dotIndex === index ? "active" : ""} onClick={(event) => { event.stopPropagation(); setIndex(dotIndex); }} /> : <button key={dotIndex} className={dotIndex === index ? "active" : ""} type="button" onClick={() => setIndex(dotIndex)} aria-label={`Ver arte ${dotIndex + 1}`} />)}</div>
      </div>
    </> : null}
  </div>;
}

function ClosedCardMedia({ card, onPreview, showOverlay = false }: { card: BoardCard; onPreview?: () => void; showOverlay?: boolean }) {
  const urls = portalCardAssets(card);
  if (urls.length === 0) {
    return linkedCardMaterial(card)
      ? <div className="closed-card-media"><CardMediaFallback title={card.title} linked /></div>
      : null;
  }
  const multiple = urls.length > 1;
  return <div className={`closed-card-media${onPreview ? " card-media-zoom" : ""}${multiple ? " carousel" : ""}`} onClick={(event) => { if (!onPreview) return; event.stopPropagation(); onPreview(); }}>
    {showOverlay ? <div className="card-media-overlay"><span className="card-type">{compactArtTypeLabel(card.typeLabel)}</span><span className="card-media-menu">{onPreview ? "⌕" : "..."}</span></div> : null}
    {multiple ? <ArtworkCarousel urls={urls} title={card.title} compact /> : <div className={`media-frame ${card.mediaAspect}`}><ResilientCardMedia url={urls[0]} title={card.title} /></div>}
  </div>;
}

function MediaPreviewModal({ media, onClose, onNavigate }: { media: { urls: string[]; title: string; index: number } | null; onClose: () => void; onNavigate: (direction: -1 | 1) => void }) {
  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && media.index > 0) onNavigate(-1);
      if (event.key === "ArrowRight" && media.index < media.urls.length - 1) onNavigate(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media, onClose, onNavigate]);

  if (!media) return null;
  return <div className="media-preview-backdrop" onMouseDown={onClose} role="presentation"><section className="media-preview-modal" role="dialog" aria-modal="true" aria-label={`Visualização de ${media.title}`} onMouseDown={(event) => event.stopPropagation()}><button className="media-preview-close" onClick={onClose} aria-label="Fechar visualização">×</button><ArtworkCarousel urls={media.urls} title={media.title} activeIndex={media.index} onIndexChange={(next) => { if (next !== media.index) onNavigate(next > media.index ? 1 : -1); }} fullscreen /></section></div>;
}

function CardView({ card, onOpen, onContextMenu, selectionMode = false, selected = false, onToggleSelection, onPreviewMedia, onRemoveTag, draggable = false, onDragStart, onDragEnd }: { card: BoardCard; onOpen: () => void; onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void; selectionMode?: boolean; selected?: boolean; onToggleSelection?: () => void; onPreviewMedia?: (card: BoardCard) => void; onRemoveTag?: (card: BoardCard, tag: string) => void; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const primaryBadge = card.statusBadges[0] ?? null;
  const isInDevelopment = /^em desenvolvimento$/i.test(primaryBadge?.trim() ?? "");
  const isApprovedBrief = card.isBriefApproval && !isInDevelopment && /aprovad/i.test(`${card.clientLabel} ${card.statusBadges.join(" ")}`);
  const visibleBadge = (badge: string) => card.isBriefApproval && /^aprovado$/i.test(badge.trim()) ? "Pauta aprovada" : cardStatusLabel(badge);
  const priorityLabel: Record<CardPriority, string> = { high: "Alta prioridade", medium: "Média prioridade", normal: "Prioridade normal" };
  const cardClassName = ["content-card", "glass-subtle", "card-button", selected ? "selected" : "", isApprovedBrief ? "approved-brief-card" : "", card.eventColor ? "has-automation-color" : "", card.priorityLevel ? "has-priority" : ""].filter(Boolean).join(" ");

  return (
    <button className={cardClassName} style={card.eventColor ? { "--card-automation-color": card.eventColor } as CSSProperties : undefined} onClick={onOpen} onContextMenu={onContextMenu} draggable={draggable} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.id); onDragStart?.(); }} onDragEnd={onDragEnd}>
      {selectionMode ? <span className={selected ? "card-select-checkbox checked" : "card-select-checkbox"} onClick={(event) => { event.stopPropagation(); onToggleSelection?.(); }}>{selected ? "✓" : ""}</span> : null}
      {card.priorityLevel ? <span className={`card-priority-tab ${card.priorityLevel}`}>{priorityLabel[card.priorityLevel]}</span> : null}
      <div className="card-title-block">
        <h4>{card.title}</h4>
        {primaryBadge ? (
          <span className={`status-chip ${statusTone(primaryBadge)}`}>
            <span className="status-chip-dot" />
            {visibleBadge(primaryBadge)}
          </span>
        ) : null}
      </div>
      <ClosedCardMedia card={card} onPreview={onPreviewMedia ? () => onPreviewMedia(card) : undefined} showOverlay />

      <div className="card-meta">
        <div className="card-inline">
          {card.statusBadges.slice(1).map((badge) => (
            <span key={badge} className={card.isBriefApproval && /^aprovado$/i.test(badge.trim()) ? "mini-badge subtle approved-brief-badge" : "mini-badge subtle"}>{visibleBadge(badge)}</span>
          ))}
          {card.tags.map((tag) => { const tagColor = cardTagColor(tag, card.tagColors?.[tag]); return <span key={tag} className={onRemoveTag ? "mini-badge tag tag-filled removable" : "mini-badge tag tag-filled"} style={{ backgroundColor: tagColor, color: calendarTextColor(tagColor) }} onClick={(event) => { if (!onRemoveTag) return; event.stopPropagation(); onRemoveTag(card, tag); }}><span className="card-tag-dot" />{cardStatusLabel(tag)}{onRemoveTag ? <span className="card-tag-remove" aria-label={`Remover ${cardStatusLabel(tag)}`}>×</span> : null}</span>; })}
          {card.commentsCount > 0 ? <span className="card-comment-count" title={`${card.commentsCount} ${card.commentsCount === 1 ? "comentário" : "comentários"}`}><UiIcon name="comment" />{card.commentsCount}</span> : null}
        </div>
      </div>

      {card.publishedAt ? <div className="card-timeline-lines"><span className="published"><UiIcon name="check" />Publicado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(card.publishedAt))}</span>{card.archivedAt ? <span className="archived"><UiIcon name="layers" />Arquivado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(card.archivedAt))}</span> : null}</div> : card.scheduledAt ? <div className="card-schedule-line">{formatScheduledCardDate(card.scheduledAt)}</div> : card.archivedAt ? <div className="card-timeline-lines"><span className="archived"><UiIcon name="layers" />Arquivado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(card.archivedAt))}</span></div> : null}
    </button>
  );
}

function ClientPortalRoutePage({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  const { slug = "serena-genovese" } = useParams();
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessPortal(session, slug)) {
    return (
      <AccessDenied
        title="Essa área do cliente não pertence a este login"
        body="O cliente entra apenas nas contas vinculadas ao próprio acesso. A equipe interna pode abrir a visão do cliente para conferência."
        backHref={getDefaultRoute(session)}
      />
    );
  }

  return <ClientPortalWorkspacePage session={session} slug={slug} onLogout={onLogout} />;
}

function ClientProfileMenu({ session, slug, onLogout, clientLogoUrl, accountName }: { session: SessionUser; slug: string; onLogout: () => void; clientLogoUrl?: string | null; accountName: string }) {
  const { t } = usePortalTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<"password" | "accounts" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setLogoFailed(false), [clientLogoUrl]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setDialog(null); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
  const show = (next: typeof dialog) => { setOpen(false); setDialog(next); setMessage(""); };
  const savePassword = async () => {
    setSaving(true); setMessage("");
    try { await changeMyPassword({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setMessage(t("Senha atualizada com sucesso.")); }
    catch (error) { setMessage(error instanceof Error ? error.message : t("Não foi possível atualizar a senha.")); }
    finally { setSaving(false); }
  };
  const hasMultipleAccounts = session.assignedPortalSlugs.length > 1;
  const avatarFallback = (accountName || session.name || "Cliente").slice(0, 2).toUpperCase();
  return (
    <div className="profile-menu portal-user-card glass-subtle profile-menu-upward" ref={menuRef}>
      <button className="portal-user-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={`${t("Trocar de conta")}: ${accountName || session.name}`}>
        <span className="portal-client-avatar">{clientLogoUrl && !logoFailed ? <img src={clientLogoUrl} alt="" onError={() => setLogoFailed(true)} /> : avatarFallback}</span>
        <span className="session-copy"><strong>{accountName}</strong><span>{roleLabel(session.role)}</span></span>
        <UiIcon name="chevron-down" className="session-caret" />
      </button>
      {open ? (
        <div className="profile-popover profile-popover-up portal-profile-popover" role="menu">
          <button onClick={() => show("password")}><span>⚿</span>{t("Alterar Senha")}</button>
          {hasMultipleAccounts ? <button onClick={() => show("accounts")}><span>♧</span>{t("Trocar de conta")}</button> : null}
          <hr />
          <button className="profile-logout" onClick={onLogout}><span>⇥</span>{t("Sair")}</button>
        </div>
      ) : null}
      {dialog ? createPortal((
        <div className="profile-modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section className="profile-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h3>{dialog === "password" ? t("Alterar Senha") : t("Trocar de conta")}</h3>
              <button onClick={() => setDialog(null)} aria-label={t("Fechar")}>×</button>
            </header>
            {dialog === "password" ? (
              <div className="profile-form">
                <label>{t("Senha atual")}<input name="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                <label>{t("Nova senha")}<input name="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                <button className="gradient-button" disabled={saving || !currentPassword || newPassword.length < 8} onClick={() => void savePassword()}>{saving ? t("Salvando...") : t("Salvar nova senha")}</button>
              </div>
            ) : null}
            {dialog === "accounts" ? (
              <div className="profile-agenda">
                {session.assignedPortalSlugs.map((accountSlug) => (
                  <a key={accountSlug} href={`/portal/${accountSlug}`} onClick={(event) => { event.preventDefault(); setDialog(null); navigate(`/portal/${accountSlug}`); }} className={accountSlug === slug ? "selected" : ""}>
                    {accountSlug.replace(/-/g, " ")}{accountSlug === slug ? <small>{t("Conta atual")}</small> : null}
                  </a>
                ))}
              </div>
            ) : null}
            {message ? <p className="profile-message">{message}</p> : null}
          </section>
        </div>
      ), document.body) : null}
    </div>
  );
}

function ClientPortalInvoicesView({ invoices, onViewInvoice }: { invoices: BillingInvoice[]; onViewInvoice?: (invoiceId: string) => void }) {
  const { t, localeTag } = usePortalTranslation();
  const [previewInvoice, setPreviewInvoice] = useState<BillingInvoice | null>(null);
  const [printRequested, setPrintRequested] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const printInvoice = () => {
    const paper = invoiceRef.current?.querySelector(".invoice-paper");
    if (!paper) return;
    const headMarkup = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((el) => el.outerHTML).join("");
    const printWindow = window.open("", "_blank", "width=880,height=1120");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Fatura</title>${headMarkup}<style>html,body{margin:0;background:#fbfaf8;}body{display:flex;justify-content:center;padding:24px;}.invoice-paper{max-width:720px;min-height:0;margin:0;box-shadow:none;}@media print{@page{size:A4;margin:14mm;}body{padding:0;background:#fff;}.invoice-paper{max-width:none;}}</style></head><body>${paper.outerHTML}</body></html>`);
    printWindow.document.close();
    const triggerPrint = () => { printWindow.focus(); printWindow.print(); };
    printWindow.onload = triggerPrint;
    window.setTimeout(triggerPrint, 400);
  };
  useEffect(() => {
    if (!previewInvoice || !printRequested) return;
    const timer = window.setTimeout(() => {
      printInvoice();
      setPrintRequested(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [previewInvoice, printRequested]);
  const downloadInvoice = (invoice: BillingInvoice) => {
    onViewInvoice?.(invoice.id);
    setPreviewInvoice(invoice);
    setPrintRequested(true);
  };
  const previewInvoiceForClient = (invoice: BillingInvoice) => {
    onViewInvoice?.(invoice.id);
    setPreviewInvoice(invoice);
  };

  const date = (value: string) => new Intl.DateTimeFormat(localeTag).format(new Date(`${value.slice(0, 10)}T12:00:00`));
  return <section className="portal-invoices-view glass">
    <header className="portal-invoices-head"><div><p className="eyebrow">{t("Financeiro")}</p><h1>{t("Faturas")}</h1><p>{t("Consulte os lançamentos disponibilizados para sua conta.")}</p></div><span>{invoices.length} {t(invoices.length === 1 ? "fatura" : "faturas")}</span></header>
    {invoices.length ? <div className="portal-invoices-list">{invoices.map((invoice) => <article key={invoice.id} className="portal-invoice-row"><div className="portal-invoice-number">#{invoice.number}</div><div className="portal-invoice-main"><strong>{invoice.title}</strong><span>{t("Emitida em")} {date(invoice.issueDate)} · {t("Vencimento")} {date(invoice.dueDate)}</span></div><div className="portal-invoice-value"><strong>{formatBillingMoney(getBillingInvoiceTotal(invoice), invoice.currency)}</strong><em className={`invoice-status ${invoice.status}`}>{t(invoice.status === "paid" ? "Paga" : invoice.status === "overdue" ? "Atrasada" : invoice.status === "cancelled" ? "Cancelada" : "Aberta")}</em></div><div className="portal-invoice-actions"><button className="ghost-button" onClick={() => previewInvoiceForClient(invoice)}><UiIcon name="eye" />{t("Visualizar")}</button><button className="ghost-button" onClick={() => downloadInvoice(invoice)}><UiIcon name="file" />{t("Baixar")}</button></div></article>)}</div> : <div className="portal-invoices-empty"><span>▣</span><h2>{t("Nenhuma fatura disponível")}</h2><p>{t("Quando uma fatura for liberada para esta conta, ela aparecerá aqui.")}</p></div>}
    {previewInvoice ? <div className="modal-backdrop" onClick={() => setPreviewInvoice(null)}><section className="portal-invoice-preview-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">{t("Visualização da fatura")}</p><h2>{previewInvoice.title}</h2><span>{t("Fatura")} #{previewInvoice.number}</span></div><button className="icon-close" onClick={() => setPreviewInvoice(null)} aria-label={t("Fechar")}>×</button></header><div ref={invoiceRef}><BillingInvoiceDocument invoice={previewInvoice} /></div><footer><button className="ghost-button" onClick={() => setPreviewInvoice(null)}>{t("Fechar")}</button><button className="gradient-button" onClick={printInvoice}><UiIcon name="file" />{t("Baixar")}</button></footer></section></div> : null}
  </section>;
}

function awaitingApprovalLabel(locale: string) {
  const normalized = locale.toLocaleLowerCase("pt-BR");
  if (normalized.startsWith("it") || normalized.includes("ital")) return "In attesa di approvazione";
  if (normalized.startsWith("es") || normalized.includes("espa")) return "Esperando aprobación";
  if (normalized.startsWith("en") || normalized.includes("ingl")) return "Awaiting approval";
  if (normalized.startsWith("sv") || normalized.includes("suec")) return "Inväntar godkännande";
  return "Aguardando aprovação";
}

function isPortalApproved(card: BoardCard) {
  const statusText = [card.clientLabel, ...card.statusBadges].join(" ").toLocaleLowerCase("pt-BR");
  return /(aprovad|finalizad|publicad)/.test(statusText);
}

function isPortalApprovedColumn(name: string) {
  return /aprovados(?: pelo cliente)?/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

function portalCardAssets(card: BoardCard) {
  return Array.from(new Set([...(card.mediaUrls ?? []), ...(card.mediaUrl ? [card.mediaUrl] : [])]));
}

function linkedCardMaterial(card: BoardCard) {
  return card.externalLinkUrl ?? portalCardAssets(card).find((url) => /(?:drive|docs)\.google\.com/i.test(url)) ?? null;
}

function portalAssetExtension(url: string, contentType?: string | null) {
  const urlExtension = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (urlExtension) return urlExtension.toLocaleLowerCase();
  const byType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
  return byType[contentType?.split(";")[0] ?? ""] ?? "bin";
}

function portalDownloadName(card: BoardCard) {
  return card.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase() || "conteudo-aprovado";
}

function triggerPortalDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

async function downloadPortalCardAssets(card: BoardCard) {
  const assets = portalCardAssets(card);
  if (assets.length === 0) return;
  const baseName = portalDownloadName(card);

  if (assets.length === 1) {
    try {
      const response = await fetch(assets[0]);
      if (!response.ok) throw new Error("download");
      const blob = await response.blob();
      triggerPortalDownload(blob, `${baseName}.${portalAssetExtension(assets[0], blob.type)}`);
    } catch {
      const link = document.createElement("a");
      link.href = assets[0];
      link.download = baseName;
      link.target = "_blank";
      link.click();
    }
    return;
  }

  const files: Record<string, Uint8Array> = {};
  await Promise.all(assets.map(async (url, index) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Não foi possível baixar a arte ${index + 1}.`);
    const blob = await response.blob();
    files[`${baseName}-${index + 1}.${portalAssetExtension(url, blob.type)}`] = new Uint8Array(await blob.arrayBuffer());
  }));
  triggerPortalDownload(new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), `${baseName}.zip`);
}

function portalTextExcerpt(text: TextDocument) {
  return text.contentHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function ClientPortalRichTextEditor({ slug, text, availableTags, onSaved }: { slug: string; text: TextDocument; availableTags: TextTag[]; onSaved: (text: TextDocument) => void }) {
  const { t } = usePortalTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState<TextTag[]>(text.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [tagColor, setTagColor] = useState("#7568dc");
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = text.contentHtml;
    setTags(text.tags ?? []);
    setMessage("");
  }, [text.id, text.contentHtml]);
  const rememberSelection = () => { const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null; if (range && editorRef.current?.contains(range.commonAncestorContainer)) editorSelectionRef.current = range.cloneRange(); };
  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    if (editorSelectionRef.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(editorSelectionRef.current); }
    document.execCommand(command, false, value);
    rememberSelection();
  };
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await updatePortalTextBySlug(slug, text.id, { contentHtml: editorRef.current?.innerHTML ?? text.contentHtml, tags });
      onSaved(response.text);
      setMessage(t("Alterações salvas."));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t("Não foi possível salvar as alterações."));
    } finally {
      setSaving(false);
    }
  };
  const addTag = () => {
    const name = tagDraft.trim().replace(/^#/, "");
    if (!name || tags.some((tag) => tag.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")) || tags.length >= 12) return;
    setTags((items) => [...items, { name, color: tagColor }]);
    setTagDraft("");
  };
  return <section className="portal-text-doc-editor">
    <div className="portal-text-doc-toolbar" role="toolbar" aria-label={t("Ferramentas de edição")}>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("undo")} title={t("Desfazer")}>↶</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("redo")} title={t("Refazer")}>↷</button><i />
      <select aria-label={t("Estilo do texto")} defaultValue="p" onChange={(event) => format("formatBlock", event.target.value)}><option value="p">{t("Texto normal")}</option><option value="h2">{t("Título")}</option><option value="h3">{t("Subtítulo")}</option><option value="blockquote">{t("Citação")}</option></select><i />
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} title={t("Negrito")}><b>B</b></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} title={t("Itálico")}><em>I</em></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} title={t("Sublinhado")}><u>U</u></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")} title={t("Lista")}>☷</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("justifyLeft")} title={t("Alinhar à esquerda")}>≡</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("justifyCenter")} title={t("Centralizar")}>≡</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("justifyRight")} title={t("Alinhar à direita")}>≡</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("createLink", window.prompt(t("Cole o link")) ?? "")} title={t("Inserir link")}>⌁</button>
      <label className="texts-color-tool" title={t("Cor do texto")}>A<input type="color" defaultValue="#263451" onMouseDown={rememberSelection} onChange={(event) => format("foreColor", event.target.value)} /></label>
      <label className="texts-color-tool highlight" title={t("Marca-texto")}>▰<input type="color" defaultValue="#fff1a8" onMouseDown={rememberSelection} onChange={(event) => format("hiliteColor", event.target.value)} /></label>
    </div>
    <div className="portal-text-tag-editor">
      <span>{t("Etiquetas")}</span>
      <div className="texts-tags-list">{tags.map((tag) => <div className="texts-tag-edit" key={tag.name} style={{ backgroundColor: tag.color, color: calendarTextColor(tag.color) }}><label title={t("Alterar cor")}><input type="color" value={tag.color} onChange={(event) => setTags((items) => items.map((item) => item.name === tag.name ? { ...item, color: event.target.value } : item))} /><i style={{ backgroundColor: tag.color }} /></label><span>{tag.name}</span><button type="button" onClick={() => setTags((items) => items.filter((item) => item.name !== tag.name))} title={t("Remover")}>×</button></div>)}</div>
      {availableTags.some((tag) => !tags.some((item) => item.name === tag.name)) ? <div className="texts-tag-reuse"><small>{t("Reutilizar")}</small><div>{availableTags.filter((tag) => !tags.some((item) => item.name === tag.name)).map((tag) => <button type="button" key={tag.name} style={{ borderColor: tag.color }} onClick={() => setTags((items) => [...items, tag].slice(0, 12))}><i style={{ backgroundColor: tag.color }} />{tag.name}</button>)}</div></div> : null}
      <div className="texts-tag-create"><input value={tagDraft} maxLength={40} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder={t("Nova etiqueta")} /><label className="texts-tag-color" title={t("Cor da nova etiqueta")}><input type="color" value={tagColor} onChange={(event) => setTagColor(event.target.value)} /><i style={{ backgroundColor: tagColor }} /></label><button type="button" onClick={addTag} disabled={!tagDraft.trim() || tags.length >= 12}>＋</button></div>
    </div>
    <div ref={editorRef} className="portal-text-content portal-text-doc-paper" contentEditable suppressContentEditableWarning onMouseUp={rememberSelection} onKeyUp={rememberSelection} onInput={rememberSelection} />
    <footer><span>{message}</span><button type="button" className="gradient-button" disabled={saving} onClick={() => void save()}>{saving ? t("Salvando...") : t("Salvar alterações")}</button></footer>
  </section>;
}

function ClientApprovedPostsView({ cards, texts, allowDownload, onOpenCard, onOpenText }: { cards: BoardCard[]; texts: TextDocument[]; allowDownload: boolean; onOpenCard: (cardId: string) => void; onOpenText: (textId: string) => void }) {
  const { t } = usePortalTranslation();
  const approvedCards = cards.filter(isPortalApproved);
  const approvedTexts = texts.filter((text) => text.status === "Aprovado");
  const approvedCount = approvedCards.length + approvedTexts.length;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const download = async (card: BoardCard) => {
    setDownloadingId(card.id);
    setDownloadError("");
    try {
      await downloadPortalCardAssets(card);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : t("Não foi possível preparar o download."));
    } finally {
      setDownloadingId(null);
    }
  };
  return <section className="portal-approved-view glass">
    <header className="portal-approved-head"><div><p className="eyebrow">{t("Conteúdos aprovados")}</p><h1>{t("Aprovados")}</h1><p>{t("Consulte os posts e textos que já receberam aprovação.")}</p></div><span>{approvedCount} {t(approvedCount === 1 ? "conteúdo" : "conteúdos")}</span></header>
    {downloadError ? <p className="form-feedback error-text">{downloadError}</p> : null}
    {approvedCount ? <div className="portal-approved-list">{approvedCards.map((card) => { const assets = portalCardAssets(card); const downloading = downloadingId === card.id; return <article key={card.id} className="portal-approved-card"><div className="portal-approved-preview">{assets.length ? <ClosedCardMedia card={card} /> : <span>{t("Sem arte")}</span>}</div><div className="portal-approved-copy"><span className="portal-text-status approved">{t("Aprovado")}</span><h2>{card.title}</h2><p>{assets.length} {t(assets.length === 1 ? "arquivo disponível" : "arquivos disponíveis")}</p><div className="portal-approved-actions"><button type="button" className="ghost-button" onClick={() => onOpenCard(card.id)}><UiIcon name="image" />{t("Visualizar post")}</button>{allowDownload ? <button type="button" className="gradient-button" onClick={() => void download(card)} disabled={assets.length === 0 || downloading}><UiIcon name="download" />{t(downloading ? "Preparando download..." : assets.length > 1 ? "Baixar tudo em ZIP" : "Baixar conteúdo")}</button> : <span className="portal-view-only"><UiIcon name="eye" />{t("Somente visualização")}</span>}</div></div></article>; })}{approvedTexts.map((text) => <article key={`text-${text.id}`} className="portal-approved-card portal-approved-text-card"><div className="portal-approved-preview portal-approved-text-preview"><UiIcon name="file" /><small>{text.contentType}</small></div><div className="portal-approved-copy"><span className="portal-text-status approved">{t("Texto aprovado")}</span><h2>{text.title}</h2><p>{portalTextExcerpt(text) || t("Sem detalhes adicionais.")}</p><div className="portal-approved-actions"><button type="button" className="ghost-button" onClick={() => onOpenText(text.id)}><UiIcon name="eye" />{t("Visualizar texto")}</button></div></div></article>)}</div> : <div className="portal-approved-empty"><span>✓</span><h2>{t("Nenhum conteúdo aprovado ainda")}</h2><p>{t("Quando um post ou texto for aprovado, ele aparecerá aqui para consulta.")}</p></div>}
  </section>;
}

function getPortalSearchStatuses(card: BoardCard, t: (source: string) => string) {
  const combined = `${card.clientLabel} ${card.statusBadges.join(" ")}`;
  if (card.archivedAt) return [{ label: t("Arquivado"), tone: "archived" }];
  const statuses: Array<{ label: string; tone: string }> = [];
  if (card.scheduledAt) statuses.push({ label: t("Agendado"), tone: "scheduled" });
  if (isPortalApproved(card)) statuses.push({ label: t("Aprovado"), tone: "approved" });
  else if (/(alteração|alteracao|revis)/i.test(combined)) statuses.push({ label: t("Alteração solicitada"), tone: "revision" });
  else statuses.push({ label: t("Aguardando aprovação"), tone: "pending" });
  return statuses;
}

function getPortalCardLifecycle(card: BoardCard, t: (source: string) => string) {
  const combined = `${card.clientLabel} ${card.statusBadges.join(" ")}`;
  if (card.archivedAt) return { label: t("Arquivado"), tone: "archived", icon: "layers" as const };
  if (card.publishedAt) return { label: t("Publicado"), tone: "published", icon: "check" as const };
  if (card.scheduledAt) return { label: t("Agendado"), tone: "scheduled", icon: "calendar" as const };
  if (isPortalApproved(card)) return { label: t("Aprovado"), tone: "approved", icon: "check" as const };
  if (/(alteração|alteracao|revis)/i.test(combined)) return { label: t("Alteração solicitada"), tone: "revision", icon: "comment" as const };
  return { label: t("Aguardando aprovação"), tone: "pending", icon: "clock" as const };
}

function ClientPortalSearchView({ slug, onOpenCard }: { slug: string; onOpenCard: (cardId: string) => void }) {
  const { t, localeTag } = usePortalTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void searchPortalCardsBySlug(slug, trimmedQuery)
        .then((response) => { if (active) setResults(response.items); })
        .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : t("Não foi possível realizar a pesquisa.")); })
        .finally(() => { if (active) setLoading(false); });
    }, 280);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [slug, trimmedQuery]);

  return <section className={`portal-search-view ${trimmedQuery.length < 2 ? "initial" : ""}`}>
    <header className="portal-search-hero glass"><div><p className="eyebrow">{t("PESQUISA GLOBAL")}</p><h1>{t("Encontre qualquer conteúdo")}</h1><span>{t("Pesquise posts em aprovação, aprovados, agendados ou arquivados.")}</span></div><div className="portal-search-field"><label><UiIcon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Busque por título ou palavra da legenda")} /></label><small>{loading ? t("Buscando conteúdos...") : trimmedQuery.length >= 2 ? `${results.length} ${t(results.length === 1 ? "resultado encontrado" : "resultados encontrados")}` : t("Digite ao menos 2 letras para pesquisar")}</small></div></header>
    {error ? <div className="portal-search-state error glass">{error}</div> : trimmedQuery.length < 2 ? null : !loading && results.length === 0 ? <div className="portal-search-state glass"><span><UiIcon name="search" /></span><h2>{t("Nenhum conteúdo encontrado")}</h2><p>{t("Tente usar outra palavra ou uma parte menor do título.")}</p></div> : <div className="portal-search-results">{results.map((card) => <article key={card.id} className="portal-search-result glass"><div className="portal-search-result-media">{portalCardAssets(card).length ? <ClosedCardMedia card={card} /> : <span><UiIcon name="image" />{t("Sem arte")}</span>}</div><div className="portal-search-result-copy"><div className="portal-search-statuses">{getPortalSearchStatuses(card, t).map((status) => <span key={status.label} className={status.tone}>{status.label}</span>)}</div><h2>{card.title}</h2><p>{card.subtitle?.replace(/\*\*/g, "").slice(0, 180) || t("Sem legenda cadastrada.")}</p>{card.scheduledAt && !card.archivedAt ? <small><UiIcon name="calendar" />{new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.scheduledAt))}</small> : card.archivedAt ? <small><UiIcon name="clock" />{t("Arquivado em")} {new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(card.archivedAt))}</small> : null}<button type="button" className="ghost-button" onClick={() => onOpenCard(card.id)}><UiIcon name="eye" />{t("Abrir post")}</button></div></article>)}</div>}
  </section>;
}

function ClientPortalTrackerView({ columns, withoutColumn, onOpenCard }: { columns: BoardColumn[]; withoutColumn: BoardCard[]; onOpenCard: (cardId: string) => void }) {
  const { t, localeTag } = usePortalTranslation();
  const stages = [...columns, ...(withoutColumn.length ? [{ id: "without-column", name: t("Em andamento"), color: "#8c94a8", visibleToClient: true, cards: withoutColumn }] : [])];
  const cards = stages.flatMap((column) => column.cards);
  const isDone = (card: BoardCard) => isPortalApproved(card) || /(finaliz|conclu|publicad|entregue)/i.test(`${card.clientLabel} ${card.statusBadges.join(" ")}`);
  const completed = cards.filter(isDone).length;
  const progress = cards.length ? Math.round((completed / cards.length) * 100) : 0;
  const tone = (card: BoardCard) => isDone(card) ? "done" : /(alteração|alteracao|revis)/i.test(`${card.clientLabel} ${card.statusBadges.join(" ")}`) ? "revision" : /(design pronto)/i.test(card.statusBadges.join(" ")) ? "design" : /(legenda)/i.test(card.statusBadges.join(" ")) ? "copy" : /(desenvolvimento|criação|criacao)/i.test(card.statusBadges.join(" ")) ? "working" : "waiting";
  const visibleStatus = (card: BoardCard) => {
    const status = card.clientLabel && !/^pendente$/i.test(card.clientLabel)
      ? card.clientLabel
      : card.statusBadges.find((item) => item !== "Enviar para Cliente") ?? "Em andamento";
    return portalText(localeTag, cardStatusLabel(status));
  };

  return <section className="portal-tracker-view">
    <header className="portal-tracker-hero glass">
      <div><p className="eyebrow">{t("ACOMPANHAMENTO")}</p><h1>{t("Tracker de conteúdo")}</h1><span>{t("Acompanhe cada etapa dos posts em produção.")}</span></div>
      <div className="portal-tracker-progress-ring" style={{ "--tracker-progress": `${progress * 3.6}deg` } as CSSProperties}><strong>{progress}%</strong><small>{t("concluído")}</small></div>
    </header>
    <div className="portal-tracker-summary">
      <article><span><UiIcon name="layers" /></span><div><strong>{cards.length}</strong><small>{t(cards.length === 1 ? "conteúdo no tracker" : "conteúdos no tracker")}</small></div></article>
      <article><span className="done"><UiIcon name="check" /></span><div><strong>{completed}</strong><small>{t(completed === 1 ? "conteúdo concluído" : "conteúdos concluídos")}</small></div></article>
      <article><span className="working"><UiIcon name="clock" /></span><div><strong>{Math.max(cards.length - completed, 0)}</strong><small>{t("em andamento")}</small></div></article>
    </div>
    {cards.length ? <div className="portal-tracker-stages">{stages.map((column) => <section key={column.id} className="portal-tracker-stage glass"><header><i style={{ backgroundColor: column.color }} /><h2>{column.name}</h2><span>{column.cards.length}</span></header><div>{column.cards.length ? column.cards.map((card) => <button key={card.id} type="button" className={`portal-tracker-card ${tone(card)}`} onClick={() => onOpenCard(card.id)}><i>{isDone(card) ? "✓" : ""}</i><div><strong>{card.title}</strong><span>{visibleStatus(card)}</span>{card.scheduledAt ? <small><UiIcon name="calendar" />{new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.scheduledAt))}</small> : null}</div><em /></button>) : <p>{t("Nenhum conteúdo nesta etapa.")}</p>}</div></section>)}</div> : <div className="portal-tracker-empty glass"><span><UiIcon name="layers" /></span><h2>{t("O tracker está pronto")}</h2><p>{t("Os conteúdos aparecerão aqui conforme forem liberados pela equipe.")}</p></div>}
  </section>;
}

function ClientPortalArchivedView({ cards, loading, error, allowDownload, onOpenCard }: { cards: BoardCard[]; loading: boolean; error: string; allowDownload: boolean; onOpenCard: (cardId: string) => void }) {
  const { t, localeTag } = usePortalTranslation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const groups = new Map<string, BoardCard[]>();
  [...cards].sort((left, right) => getArchiveGroupDate(right).getTime() - getArchiveGroupDate(left).getTime()).forEach((card) => {
    const date = getArchiveGroupDate(card);
    const month = date.getTime() > 0 ? new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(date) : t("Sem data");
    groups.set(month, [...(groups.get(month) ?? []), card]);
  });
  const download = async (card: BoardCard) => {
    setDownloadingId(card.id);
    setDownloadError("");
    try {
      await downloadPortalCardAssets(card);
    } catch (caught) {
      setDownloadError(caught instanceof Error ? caught.message : t("Não foi possível preparar o download."));
    } finally {
      setDownloadingId(null);
    }
  };
  return <section className="portal-archive-view">
    <header className="portal-archive-head glass"><div><p className="eyebrow">{t("HISTÓRICO")}</p><h1>{t("Conteúdos arquivados")}</h1><span>{t("Consulte os mesmos conteúdos arquivados no Kanban.")}</span></div><b>{cards.length} {t(cards.length === 1 ? "conteúdo" : "conteúdos")}</b></header>
    {downloadError ? <p className="form-feedback error-text">{downloadError}</p> : null}
    {loading ? <div className="portal-archive-state glass">{t("Carregando conteúdos arquivados...")}</div> : error ? <div className="portal-archive-state error glass">{error}</div> : cards.length === 0 ? <div className="portal-archive-state glass"><span><UiIcon name="layers" /></span><h2>{t("Nenhum conteúdo arquivado")}</h2><p>{t("Quando um post for arquivado no Kanban, ele aparecerá aqui.")}</p></div> : <div className="portal-archive-groups">{[...groups.entries()].map(([month, monthCards]) => <section key={month}><header><h2>{month}</h2><span>{monthCards.length}</span></header><div className="portal-archive-grid">{monthCards.map((card) => <article key={card.id} className="portal-archive-card glass" role="button" tabIndex={0} onClick={() => onOpenCard(card.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenCard(card.id); } }}><div className="portal-archive-preview">{portalCardAssets(card).length ? <ClosedCardMedia card={card} /> : <span><UiIcon name="image" />{t("Sem arte")}</span>}</div>{allowDownload && portalCardAssets(card).length ? <button type="button" className="portal-archive-download" disabled={downloadingId === card.id} onClick={(event) => { event.stopPropagation(); void download(card); }}><UiIcon name="download" />{downloadingId === card.id ? "..." : "Download"}</button> : null}<div className="portal-archive-copy"><span>{t("Arquivado")}</span><h3>{card.title}</h3><div className="portal-archive-dates">{card.publishedAt ? <p className="published"><UiIcon name="check" />{t("Publicado em")} {new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(card.publishedAt))}</p> : null}{card.archivedAt ? <p><UiIcon name="layers" />{t("Arquivado em")} {new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(card.archivedAt))}</p> : !card.publishedAt ? <p>{t("Sem data registrada")}</p> : null}</div>{card.tags.length ? <div>{card.tags.slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}</div> : null}</div></article>)}</div></section>)}</div>}
  </section>;
}

function ClientUpcomingPostsWidget({ items, onSelectPost }: { items: ClientPortalPreview["upcomingItems"]; onSelectPost: (id: string) => void }) {
  const { t, localeTag } = usePortalTranslation();
  const [range, setRange] = useState<"week" | "month">("week");
  const visibleItems = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + (range === "week" ? 7 : 31));
    return items
      .filter((item) => {
        const scheduledAt = new Date(item.scheduledAt);
        return !Number.isNaN(scheduledAt.getTime()) && scheduledAt >= start && scheduledAt < end;
      })
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());
  }, [items, range]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { start: Date; end: Date; items: typeof visibleItems }>();
    for (const item of visibleItems) {
      const scheduledAt = new Date(item.scheduledAt);
      const weekStart = new Date(scheduledAt);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const key = localDateKey(weekStart);
      const group = grouped.get(key) ?? { start: weekStart, end: weekEnd, items: [] };
      group.items.push(item);
      grouped.set(key, group);
    }
    return Array.from(grouped.values());
  }, [visibleItems]);
  const shortDate = (date: Date) => new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "2-digit" }).format(date);

  return <section className="glass widget-card portal-upcoming-widget">
    <header className="portal-upcoming-head">
      <div><span><UiIcon name="calendar" /></span><h3>{t("Próximos posts")}</h3><b>{visibleItems.length}</b></div>
      <div className="portal-upcoming-range" role="group" aria-label={t("Período dos próximos posts")}>
        <button type="button" className={range === "week" ? "active" : ""} onClick={() => setRange("week")}>{t("Semana")}</button>
        <button type="button" className={range === "month" ? "active" : ""} onClick={() => setRange("month")}>{t("Mês")}</button>
      </div>
    </header>
    {groups.length ? <div className="portal-upcoming-groups">{groups.map((group) => <section key={localDateKey(group.start)}>
      <h4>{shortDate(group.start)} – {shortDate(group.end)}</h4>
      <div>{group.items.map((item) => {
        const scheduledAt = new Date(item.scheduledAt);
        return <button type="button" key={item.id} className={`portal-upcoming-post${item.cardId ? "" : " calendar-only"}`} onClick={() => { if (item.cardId) onSelectPost(item.cardId); }}>
          {item.mediaUrl ? <img src={item.mediaUrl} alt="" /> : <span className="portal-upcoming-placeholder"><UiIcon name="image" /></span>}
          <span className="portal-upcoming-copy"><strong>{item.title}</strong><small>{new Intl.DateTimeFormat(localeTag, { weekday: "long", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(scheduledAt)}</small></span>
          <i aria-hidden="true" />
          <em><UiIcon name="clock" />{shortDate(scheduledAt)}</em>
        </button>;
      })}</div>
    </section>)}</div> : <p className="widget-empty-copy">{t("Nenhum post agendado no momento.")}</p>}
  </section>;
}

type PortalPostDraft = { columnId: string; title: string; caption: string; commentText: string; artType: string; externalLinkUrl: string };

function ClientPostSuggestionModal({ draft, columns, files, submitting, error, onChange, onFilesChange, onClose, onSubmit }: { draft: PortalPostDraft; columns: Array<{ id: string; name: string; color: string }>; files: File[]; submitting: boolean; error: string; onChange: (field: keyof PortalPostDraft, value: string) => void; onFilesChange: (files: File[]) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { t } = usePortalTranslation();
  return <div className="modal-backdrop portal-post-modal-backdrop" onMouseDown={onClose}>
    <form className="portal-post-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">{t("Novo post")}</p><h2>{t("Criar post")}</h2><p>{t("Envie o conteúdo para a equipe. Ele ficará pendente até entrar no planejamento.")}</p></div><button type="button" onClick={onClose} aria-label={t("Fechar")}>×</button></header>
      <div className="portal-post-fields">
        <label>{t("Título do post *")}<input autoFocus value={draft.title} onChange={(event) => onChange("title", event.target.value)} placeholder={t("Ex.: Carrossel com dúvidas frequentes")} maxLength={255} /></label>
        <label>{t("Formato")}<select value={draft.artType} onChange={(event) => onChange("artType", event.target.value)}>{ART_TYPE_OPTIONS.map((option) => <option key={option}>{t(option)}</option>)}</select></label>
        <label className="wide">{t("Coluna do Kanban *")}<select required value={draft.columnId} onChange={(event) => onChange("columnId", event.target.value)}><option value="">{t("Escolha uma coluna")}</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select><small>{t("O post aparecerá nesta coluna na sua área do cliente.")}</small></label>
        <label className="wide">{t("Descrição ou legenda")}<textarea value={draft.caption} onChange={(event) => onChange("caption", event.target.value)} placeholder={t("Conte a ideia, o objetivo e qualquer orientação para a equipe...")} maxLength={5000} /></label>
        <label className="wide">{t("Comentário para a equipe")}<textarea value={draft.commentText} onChange={(event) => onChange("commentText", event.target.value)} placeholder={t("Adicione um comentário ou observação sobre este post...")} maxLength={5000} /></label>
        <label className="wide">{t("Link de referência")}<input type="url" value={draft.externalLinkUrl} onChange={(event) => onChange("externalLinkUrl", event.target.value)} placeholder="https://..." /></label>
        <label className="portal-post-files wide"><span>{t("Artes ou referências")}</span><input multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 20))} /><strong>{files.length ? `${files.length} ${t(files.length === 1 ? "arquivo selecionado" : "arquivos selecionados")}` : t("Escolher arquivos")}</strong><small>{t("Você pode enviar até 20 imagens ou vídeos.")}</small></label>
      </div>
      {files.length ? <div className="portal-post-file-list">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div> : null}
      {error ? <p className="form-feedback error-text">{error}</p> : null}
      <footer><button className="ghost-button" type="button" disabled={submitting} onClick={onClose}>{t("Cancelar")}</button><button className="gradient-button" type="submit" disabled={submitting || !draft.title.trim() || !draft.columnId}>{t(submitting ? "Criando post..." : "Criar post")}</button></footer>
    </form>
  </div>;
}

function ClientPortalWorkspacePage({
  session,
  slug,
  onLogout,
}: {
  session: SessionUser;
  slug: string;
  onLogout: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const resource = usePreviewResource(emptyClientPortal, () => loadClientPortalBySlug(slug), [
    slug,
    refreshKey,
  ]);
  useEffect(() => {
    // Portal settings may be changed from the admin view in another tab. Refresh
    // as soon as this portal becomes active again so its navigation never keeps
    // a stale permission snapshot.
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((value) => value + 1);
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
  const data = resource.data;
  const canRespondToClientContent = data.accessLevel !== "viewer";
  const canUseEnabledClientTools = data.accessLevel !== "viewer";
  const portalLocale = normalizePortalLocale(data.locale);
  const tr = (source: string) => portalText(portalLocale, source);
  const clientLocaleTag = portalLocaleTag(portalLocale);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [portalView, setPortalView] = useState<"board" | "approved" | "texts" | "reports" | "invoices" | "tracker" | "archived" | "search" | "brand">("board");
  const [portalMobileMenuOpen, setPortalMobileMenuOpen] = useState(false);
  const portalMobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const portalNavRef = useRef<HTMLElement>(null);
  const [boardSubView, setBoardSubView] = useState<"board" | "calendar">("board");
  const [portalAppointments, setPortalAppointments] = useState<AgendaEvent[]>([]);
  const [portalInvoices, setPortalInvoices] = useState<BillingInvoice[]>([]);
  const [viewedInvoiceIds, setViewedInvoiceIds] = useState<string[]>([]);
  const [portalReportsCount, setPortalReportsCount] = useState(0);
  const [portalTexts, setPortalTexts] = useState<TextDocument[]>([]);
  const [selectedPortalTextId, setSelectedPortalTextId] = useState<string | null>(null);
  const [portalTextTagFilters, setPortalTextTagFilters] = useState<string[]>([]);
  const [portalTextComments, setPortalTextComments] = useState<TextComment[]>([]);
  const [portalTextCommentDraft, setPortalTextCommentDraft] = useState("");
  const [portalTextSubmitting, setPortalTextSubmitting] = useState<"comment" | "approve" | "changes" | null>(null);
  const [portalTextFeedback, setPortalTextFeedback] = useState<string | null>(null);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [postDraft, setPostDraft] = useState<PortalPostDraft>({ columnId: "", title: "", caption: "", commentText: "", artType: "Post único", externalLinkUrl: "" });
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [approvedTransfer, setApprovedTransfer] = useState<{ title: string; targetX: number; targetY: number } | null>(null);
  const [locallyApprovedCardIds, setLocallyApprovedCardIds] = useState<string[]>([]);
  const [portalArchivedCards, setPortalArchivedCards] = useState<BoardCard[]>([]);
  const [portalArchivedLoading, setPortalArchivedLoading] = useState(false);
  const [portalArchivedError, setPortalArchivedError] = useState("");
  const loadCardDetail = useCallback(
    (cardId: string) => loadPortalCardDetailBySlug(slug, cardId),
    [slug],
  );
  const detail = useCardDetail(data, selectedCardId, loadCardDetail, refreshKey);
  useEffect(() => {
    const closePortalMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPortalMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closePortalMenu);
    return () => window.removeEventListener("keydown", closePortalMenu);
  }, []);
  useEffect(() => {
    if (!portalMobileMenuOpen) return;
    const closePortalMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!portalMobileMenuButtonRef.current?.contains(target) && !portalNavRef.current?.contains(target)) setPortalMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", closePortalMenu);
    return () => document.removeEventListener("mousedown", closePortalMenu);
  }, [portalMobileMenuOpen]);
  useEffect(() => {
    if (!data.accountName || !data.permissions.allowClientViewInvoices) {
      setPortalInvoices([]);
      return;
    }
    let active = true;
    listPortalInvoicesBySlug(slug).then(({ items }) => { if (active) setPortalInvoices(items); }).catch(() => { if (active) setPortalInvoices([]); });
    return () => { active = false; };
  }, [data.accountName, data.permissions.allowClientViewInvoices, refreshKey, slug]);
  useEffect(() => {
    try {
      setViewedInvoiceIds(JSON.parse(window.localStorage.getItem(`designhub-v2-viewed-invoices:${slug}`) ?? "[]") as string[]);
    } catch {
      setViewedInvoiceIds([]);
    }
  }, [slug]);
  const markInvoiceViewed = useCallback((invoiceId: string) => {
    setViewedInvoiceIds((current) => {
      if (current.includes(invoiceId)) return current;
      const next = [...current, invoiceId];
      window.localStorage.setItem(`designhub-v2-viewed-invoices:${slug}`, JSON.stringify(next));
      return next;
    });
  }, [slug]);
  useEffect(() => {
    if (resource.loading) return;
    const now = new Date();
    const from = localDateKey(new Date(now.getFullYear(), now.getMonth() - 3, 1));
    const to = localDateKey(new Date(now.getFullYear(), now.getMonth() + 4, 0));
    void listPortalAppointmentsBySlug(slug, from, to)
      .then((response) => setPortalAppointments(response.items))
      .catch(() => setPortalAppointments([]));
  }, [resource.loading, slug, refreshKey]);
  useEffect(() => {
    if (!data.permissions.allowClientViewReports) {
      setPortalReportsCount(0);
      return;
    }
    void listPortalReportsBySlug(slug)
      .then((response) => setPortalReportsCount(response.items.length))
      .catch(() => setPortalReportsCount(0));
  }, [data.permissions.allowClientViewReports, slug, refreshKey]);
  useEffect(() => {
    if ((portalView === "texts" && !data.permissions.allowClientViewTexts) || (portalView === "invoices" && !data.permissions.allowClientViewInvoices) || (portalView === "reports" && !data.permissions.allowClientViewReports) || (portalView === "brand" && !data.permissions.allowClientViewBrandBrain)) {
      setPortalView("board");
    }
  }, [data.permissions.allowClientViewBrandBrain, data.permissions.allowClientViewInvoices, data.permissions.allowClientViewReports, data.permissions.allowClientViewTexts, portalView]);
  useEffect(() => {
    if (resource.loading) return;
    if (!data.permissions.allowClientViewTexts) {
      setPortalTexts([]);
      setSelectedPortalTextId(null);
      return;
    }
    void listPortalTextsBySlug(slug).then((response) => {
      setPortalTexts(response.items);
      setSelectedPortalTextId((current) => response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null);
    }).catch(() => setPortalTexts([]));
  }, [data.permissions.allowClientViewTexts, resource.loading, slug, refreshKey]);
  const selectedPortalText = portalTexts.find((item) => item.id === selectedPortalTextId) ?? null;
  const portalTextTagLibrary = Array.from(new Map(portalTexts.flatMap((item) => item.tags ?? []).map((tag) => [tag.name.toLocaleLowerCase("pt-BR"), tag])).values());
  const filteredPortalTexts = portalTextTagFilters.length ? portalTexts.filter((item) => portalTextTagFilters.every((name) => item.tags?.some((tag) => tag.name === name))) : portalTexts;
  const selectedPortalTextBanner = selectedPortalText ? window.localStorage.getItem(`designhub-text-cover:${slug}:${selectedPortalText.id}`) : null;
  const portalCards = [...data.boardColumns.flatMap((column) => column.cards), ...data.withoutColumn];
  const portalCardsWithLocalApprovals = portalCards.map((card) => locallyApprovedCardIds.includes(card.id) ? { ...card, clientLabel: "Aprovado pelo cliente", statusBadges: Array.from(new Set([...card.statusBadges, "Aprovado"])) } : card);
  const approvedPortalCards = portalCardsWithLocalApprovals.filter(isPortalApproved);
  const approvedPortalTexts = portalTexts.filter((text) => text.status === "Aprovado");
  const approvalPortalCards = portalCardsWithLocalApprovals.filter((card) => !isPortalApproved(card));
  const pautaApprovalCards = approvalPortalCards.filter((card) => card.isBriefApproval);
  const contentApprovalCardIds = new Set(approvalPortalCards.filter((card) => !card.isBriefApproval).map((card) => card.id));
  const visiblePortalColumns = data.boardColumns.filter((column) => !isPortalApprovedColumn(column.name));
  const portalTrackerEnabled = data.widgets.tracking && data.permissions.allowClientViewTracking;
  const upcomingPortalAppointments = useMemo(() => {
    const now = new Date();
    const from = localDateKey(now);
    const to = localDateKey(new Date(now.getFullYear(), now.getMonth() + 2, 0));
    return expandAgendaEvents(portalAppointments, from, to)
      .filter((event) => new Date(event.startsAt).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 5);
  }, [portalAppointments]);
  useEffect(() => {
    if (portalView !== "texts" || !selectedPortalTextId) {
      setPortalTextComments([]);
      return;
    }
    setPortalTextComments([]);
    void listPortalTextCommentsBySlug(slug, selectedPortalTextId)
      .then((response) => setPortalTextComments(response.comments))
      .catch(() => setPortalTextComments([]));
  }, [portalView, selectedPortalTextId, slug]);
  useEffect(() => {
    if (!approvedTransfer) return;
    const timeout = window.setTimeout(() => setApprovedTransfer(null), 1_900);
    return () => window.clearTimeout(timeout);
  }, [approvedTransfer]);
  useEffect(() => {
    if (portalView !== "archived" || !data.showArchivedToClient) return;
    let active = true;
    setPortalArchivedLoading(true);
    setPortalArchivedError("");
    void loadPortalArchivedCardsBySlug(slug)
      .then((result) => { if (active) setPortalArchivedCards([...result.columns.flatMap((column) => column.cards), ...result.withoutColumn]); })
      .catch((error) => { if (active) setPortalArchivedError(error instanceof Error ? error.message : tr("Não foi possível carregar os arquivados.")); })
      .finally(() => { if (active) setPortalArchivedLoading(false); });
    return () => { active = false; };
  }, [portalView, data.showArchivedToClient, slug, refreshKey]);

  async function handlePortalTextAction(action: "comment" | "approve" | "changes") {
    if (!selectedPortalText || (action === "comment" && !portalTextCommentDraft.trim())) return;
    const commentText = portalTextCommentDraft.trim();
    setPortalTextSubmitting(action);
    setPortalTextFeedback(null);
    try {
      if (action === "comment") {
        await addPortalTextCommentBySlug(slug, selectedPortalText.id, commentText);
      } else {
        await submitPortalTextDecisionBySlug(slug, selectedPortalText.id, {
          approved: action === "approve",
          commentText,
        });
      }
      const [textsResponse, commentsResponse] = await Promise.all([
        listPortalTextsBySlug(slug),
        listPortalTextCommentsBySlug(slug, selectedPortalText.id),
      ]);
      setPortalTexts(textsResponse.items);
      setPortalTextComments(commentsResponse.comments);
      setPortalTextCommentDraft("");
      setPortalTextFeedback(
        action === "comment"
          ? tr("Comentário enviado.")
          : action === "approve"
            ? tr("Texto aprovado com sucesso.")
            : tr("Solicitação de alteração enviada."),
      );
    } catch (error) {
      setPortalTextFeedback(error instanceof Error ? error.message : tr("Não foi possível enviar o retorno."));
    } finally {
      setPortalTextSubmitting(null);
    }
  }

  async function submitPostSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!postDraft.title.trim() || !postDraft.columnId) return;
    setPostSubmitting(true);
    setPostError("");
    try {
      const mediaUrls: string[] = [];
      for (const file of postFiles) mediaUrls.push(await uploadPortalMediaBySlug(slug, file));
      await createPortalPostBySlug(slug, {
        columnId: postDraft.columnId,
        title: postDraft.title.trim(),
        caption: postDraft.caption.trim() || null,
        commentText: postDraft.commentText.trim() || null,
        artType: postDraft.artType,
        externalLinkUrl: postDraft.externalLinkUrl.trim() || null,
        mediaUrls,
      });
      setPostDraft({ columnId: "", title: "", caption: "", commentText: "", artType: "Post único", externalLinkUrl: "" });
      setPostFiles([]);
      setCreatePostOpen(false);
      setPostSuccess(tr("Post enviado. Ele já está no quadro da equipe com status pendente."));
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setPostError(error instanceof Error ? error.message : tr("Não foi possível enviar a sugestão."));
    } finally {
      setPostSubmitting(false);
    }
  }

  async function approvePortalCard(cardId: string, commentText: string) {
    const cardTitle = portalCards.find((card) => card.id === cardId)?.title ?? "Post";
    await submitPortalCardDecisionBySlug(slug, cardId, { approved: true, commentText });
    const approvedButton = document.querySelector<HTMLElement>('[data-portal-view="approved"]');
    const target = approvedButton?.getBoundingClientRect();
    setLocallyApprovedCardIds((current) => current.includes(cardId) ? current : [...current, cardId]);
    setSelectedCardId(null);
    setApprovedTransfer({
      title: cardTitle,
      targetX: target ? target.left + target.width / 2 - window.innerWidth / 2 : -Math.min(320, window.innerWidth * .35),
      targetY: target ? target.top + target.height / 2 - window.innerHeight / 2 : -Math.min(220, window.innerHeight * .3),
    });
  }

  return (
    <PortalLocaleContext.Provider value={portalLocale}>
    <div className="portal-page" lang={portalLocale}>
      <ClientContractAcceptance slug={slug} accountName={data.accountName} canAccept={canRespondToClientContent} />
      <aside className="portal-sidebar glass">
        <div className="portal-brand-zone">
          <div className="brand-lockup compact">
          <div className="brand-badge"><img src={designHubV2Logo} alt="Design Hub" /></div>
          <div>
            <p className="eyebrow">{tr("Portal do cliente")}</p>
          </div>
          </div>
        </div>

        <button ref={portalMobileMenuButtonRef} type="button" className="portal-mobile-nav-trigger" onClick={() => setPortalMobileMenuOpen((value) => !value)} aria-expanded={portalMobileMenuOpen} aria-controls="portal-navigation" aria-label={tr("Portal do cliente")}><span aria-hidden="true"><i /><i /><i /></span></button>

        <nav ref={portalNavRef} id="portal-navigation" className={`portal-nav${portalMobileMenuOpen ? " mobile-open" : ""}`}>
          {canUseEnabledClientTools && data.permissions.allowClientCreatePost ? <button type="button" className="portal-nav-item portal-nav-create" onClick={() => { setPostError(""); setCreatePostOpen(true); setPortalMobileMenuOpen(false); }}><span>{tr("Criar post")}</span><b aria-hidden="true">＋</b></button> : null}
          {[
            { view: "board" as const, label: tr("Aprovações"), count: approvalPortalCards.length },
            ...(data.permissions.allowClientViewTexts ? [{ view: "texts" as const, label: tr("Textos"), count: portalTexts.filter((item) => item.status !== "Aprovado").length }] : []),
            { view: "approved" as const, label: tr("Aprovados"), count: approvedPortalCards.length + approvedPortalTexts.length },
            ...(data.permissions.allowClientViewBrandBrain ? [{ view: "brand" as const, label: "Brand Brain", count: 0 }] : []),
            ...(data.permissions.allowClientSearch ? [{ view: "search" as const, label: tr("Pesquisa"), count: 0 }] : []),
            ...(portalTrackerEnabled ? [{ view: "tracker" as const, label: "Tracker", count: portalCardsWithLocalApprovals.length }] : []),
            ...(data.showArchivedToClient ? [{ view: "archived" as const, label: tr("Arquivados"), count: portalArchivedCards.length }] : []),
            ...(data.permissions.allowClientViewInvoices ? [{ view: "invoices" as const, label: tr("Faturas"), count: portalInvoices.filter((invoice) => !viewedInvoiceIds.includes(invoice.id)).length }] : []),
            ...(data.permissions.allowClientViewReports ? [{ view: "reports" as const, label: tr("Relatórios"), count: portalReportsCount }] : []),
          ].map(({ view, label, count }) => (
            <button key={view} data-portal-view={view === "approved" ? "approved" : undefined} onClick={() => { setPortalView(view); setPortalMobileMenuOpen(false); }} className={`${portalView === view ? "portal-nav-item active" : "portal-nav-item"}${view === "approved" && approvedTransfer ? " receiving-approval" : ""}`}>
              <span>{label}</span>
              {count > 0 ? <b className="portal-nav-count">{count}</b> : null}
            </button>
          ))}
        </nav>
        <ClientProfileMenu session={session} slug={slug} onLogout={onLogout} clientLogoUrl={data.clientLogoUrl} accountName={data.accountName} />
      </aside>

      <main className="portal-main">
        {portalView === "board" ? <section className="portal-welcome-banner" aria-label={tr("Boas-vindas")}>
          <div className="portal-welcome-avatar" aria-hidden="true">
            {data.clientLogoUrl ? <img src={data.clientLogoUrl} alt="" /> : <span>{(data.accountName || "C").slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="portal-welcome-copy">
            <p>{tr("Área do cliente")}</p>
            <h1>{tr("Olá")}, {data.accountName}! <span aria-hidden="true">👋</span></h1>
            <small>{tr("Bem-vindo à sua área do cliente. Aqui você acompanha conteúdos, aprovações e próximos passos.")}</small>
          </div>
          <span className="portal-welcome-spark" aria-hidden="true">✦</span>
        </section> : null}
        {postSuccess ? <div className="portal-post-success"><span>✓</span><p>{postSuccess}</p><button onClick={() => setPostSuccess("")} aria-label={tr("Fechar aviso")}>×</button></div> : null}
        {approvedTransfer ? <><span className="portal-approved-fly-to-nav" style={{ "--approved-target-x": `${approvedTransfer.targetX}px`, "--approved-target-y": `${approvedTransfer.targetY}px` } as CSSProperties} aria-hidden="true"><UiIcon name="send" /></span><div className="portal-approved-transfer" role="status" aria-live="polite"><div><strong>{tr("Enviado para Aprovados!")}</strong><small>{approvedTransfer.title}</small></div><span className="portal-approved-check">✓</span></div></> : null}

        {portalView === "brand" && data.permissions.allowClientViewBrandBrain ? <ClientBrandBrainView slug={slug} clientName={data.accountName} allowEdit={canUseEnabledClientTools && data.permissions.allowClientEditBrandBrain} /> : portalView === "search" && data.permissions.allowClientSearch ? <ClientPortalSearchView slug={slug} onOpenCard={setSelectedCardId} /> : portalView === "archived" && data.showArchivedToClient ? <ClientPortalArchivedView cards={portalArchivedCards} loading={portalArchivedLoading} error={portalArchivedError} allowDownload={data.permissions.allowClientDownload} onOpenCard={setSelectedCardId} /> : portalView === "tracker" && portalTrackerEnabled ? <ClientPortalTrackerView columns={data.boardColumns} withoutColumn={data.withoutColumn} onOpenCard={setSelectedCardId} /> : portalView === "approved" ? <ClientApprovedPostsView cards={portalCardsWithLocalApprovals} texts={portalTexts} allowDownload={data.permissions.allowClientDownload} onOpenCard={setSelectedCardId} onOpenText={(textId) => { setSelectedPortalTextId(textId); setPortalView("texts"); }} /> : portalView === "invoices" && data.permissions.allowClientViewInvoices ? <ClientPortalInvoicesView invoices={portalInvoices} onViewInvoice={markInvoiceViewed} /> : portalView === "reports" && data.permissions.allowClientViewReports ? <PortalReports slug={slug} clientName={data.accountName} locale={portalLocale} /> : portalView === "texts" ? <section className="portal-texts-view glass"><aside>{portalTextTagLibrary.length ? <div className="text-tag-filters portal-text-tag-filters"><header><span>{tr("Filtrar por etiquetas")}</span>{portalTextTagFilters.length ? <button type="button" onClick={() => setPortalTextTagFilters([])}>{tr("Limpar")}</button> : null}</header><div>{portalTextTagLibrary.map((tag) => { const active = portalTextTagFilters.includes(tag.name); return <button type="button" key={tag.name} className={active ? "active" : ""} style={{ backgroundColor: active ? tag.color : undefined, color: active ? calendarTextColor(tag.color) : undefined, borderColor: tag.color }} onClick={() => setPortalTextTagFilters((items) => active ? items.filter((name) => name !== tag.name) : [...items, tag.name])}><i style={{ backgroundColor: tag.color }} />{tag.name}{active ? " ✓" : ""}</button>; })}</div></div> : null}{filteredPortalTexts.map((item) => <button key={item.id} className={item.id === selectedPortalTextId ? "selected" : ""} onClick={() => { setSelectedPortalTextId(item.id); setPortalTextCommentDraft(""); setPortalTextFeedback(null); }}><small>{item.contentType}</small><strong>{item.tags?.length ? <em className="text-title-tags">{item.tags.map((tag) => <i key={tag.name} style={{ backgroundColor: tag.color, color: calendarTextColor(tag.color) }}>{tag.name}</i>)}</em> : null}{item.title}</strong></button>)}</aside><article>{selectedPortalText ? <><p className="eyebrow">{selectedPortalText.contentType}</p>{selectedPortalTextBanner ? <div className="portal-text-banner" style={{ backgroundImage: `url(${selectedPortalTextBanner})` }} aria-label={tr("Banner do texto")} /> : null}<div className="portal-text-heading"><div>{selectedPortalText.tags?.length ? <div className="text-heading-tags">{selectedPortalText.tags.map((tag) => <span key={tag.name} style={{ backgroundColor: tag.color, color: calendarTextColor(tag.color) }}>{tag.name}</span>)}</div> : null}<h1>{selectedPortalText.title}</h1><span className={`portal-text-status ${selectedPortalText.status === "Aprovado" ? "approved" : ""}`}>{tr(selectedPortalText.status)}</span></div></div>{canUseEnabledClientTools && data.permissions.allowClientEditCaption ? <ClientPortalRichTextEditor slug={slug} text={selectedPortalText} availableTags={portalTextTagLibrary} onSaved={(savedText) => setPortalTexts((items) => items.map((item) => item.id === savedText.id ? savedText : item))} /> : <div className="portal-text-content" dangerouslySetInnerHTML={{ __html: selectedPortalText.contentHtml }} />}{canRespondToClientContent ? <section className="portal-text-feedback"><h3>{tr("Seu feedback")}</h3><p>{tr("Comente sobre este texto ou escolha uma ação para enviar seu retorno à equipe.")}</p><textarea value={portalTextCommentDraft} onChange={(event) => setPortalTextCommentDraft(event.target.value)} placeholder={tr("Escreva aqui seu comentário sobre este texto")} /><div className="portal-text-actions"><button className="ghost-button" disabled={portalTextSubmitting !== null || !portalTextCommentDraft.trim()} onClick={() => void handlePortalTextAction("comment")}>{tr(portalTextSubmitting === "comment" ? "Enviando..." : "Adicionar comentário")}</button><button className="gradient-button" disabled={portalTextSubmitting !== null} onClick={() => void handlePortalTextAction("approve")}>{tr(portalTextSubmitting === "approve" ? "Enviando..." : "Aprovar")}</button><button className="danger-button" disabled={portalTextSubmitting !== null || !portalTextCommentDraft.trim()} onClick={() => void handlePortalTextAction("changes")}>{tr(portalTextSubmitting === "changes" ? "Enviando..." : "Pedir alteração")}</button></div>{portalTextFeedback ? <p className="portal-text-feedback-message">{portalTextFeedback}</p> : null}<div className="portal-text-comments"><h4>{tr("Comentários")} ({portalTextComments.length})</h4>{portalTextComments.map((comment) => <article key={comment.id}><div><strong>{comment.authorName}</strong><span>{comment.authorRole}</span></div><p>{comment.commentText}</p></article>)}</div></section> : <p className="client-access-notice">{tr("Acesso somente para visualização.")}</p>}</> : <p>{tr("Nenhum texto foi enviado para sua área ainda.")}</p>}</article></section> : <section className="portal-grid">
          <div className="portal-primary">
            <div className="glass board-shell">
              <div className="board-topbar">
                <div className="tab-strip">
                  <button type="button" className={boardSubView === "board" ? "tab active" : "tab"} onClick={() => setBoardSubView("board")}>{tr("Quadro do cliente")}</button>
                  <button type="button" className={boardSubView === "calendar" ? "tab active" : "tab"} onClick={() => setBoardSubView("calendar")}>{tr("Calendário")}</button>
                  {data.permissions.allowClientViewBrandBrain ? <button type="button" className="tab" onClick={() => setPortalView("brand")}>Brand Brain</button> : null}
                </div>
                {data.permissions.allowClientSearch ? <button type="button" className="search-box portal-search-shortcut" onClick={() => setPortalView("search")}><UiIcon name="search" /><span>{tr("Pesquisar conteúdos")}</span></button> : null}
              </div>

              {boardSubView === "calendar" ? (
                <ClientPortalCalendarView cards={data.calendarPosts} appointments={portalAppointments} onSelectCard={setSelectedCardId} />
              ) : (
              <div className="portal-approval-board">
                {pautaApprovalCards.length ? <section className="portal-pautas-approval">
                  <header>
                    <div><span>{tr("IDEIAS PARA REVISÃO")}</span><h2>{tr("Pautas para aprovação")}</h2><p>{tr("Revise a proposta, deixe um comentário e aprove para ela entrar no fluxo de criação.")}</p></div>
                    <b>{pautaApprovalCards.length} {tr(pautaApprovalCards.length === 1 ? "pauta" : "pautas")}</b>
                  </header>
                  <div className="portal-pauta-grid">{pautaApprovalCards.map((card) => <button key={card.id} type="button" className="portal-pauta-card" onClick={() => setSelectedCardId(card.id)}>
                    <span className="portal-pauta-icon"><UiIcon name="file" /></span>
                    <span className="portal-pauta-copy"><small>{tr("PAUTA")}</small><strong>{card.title}</strong><p>{card.subtitle || tr("Proposta de conteúdo enviada para sua avaliação.")}</p></span>
                    <span className="portal-pauta-review">{tr("Revisar")} <UiIcon name="eye" /></span>
                  </button>)}</div>
                </section> : null}

                {contentApprovalCardIds.size || visiblePortalColumns.length ? <section className="portal-content-approval">
                  <header><div><span>{tr("CONTEÚDOS VISUAIS")}</span><h2>{tr("Posts para aprovação")}</h2></div><b>{contentApprovalCardIds.size}</b></header>
                  <div className="portal-columns-scroll">
                    {visiblePortalColumns.map((column) => { const approvalCards = column.cards.filter((card) => contentApprovalCardIds.has(card.id)); return (
                      <section key={column.id} className="portal-column glass-subtle">
                        <header className="portal-column-head" style={{ borderColor: column.color }}><h3>{column.name}</h3><span>{approvalCards.length}</span></header>
                        {approvalCards.length ? <div className="portal-card-list">{approvalCards.map((card) => <button key={card.id} className="portal-card card-button" onClick={() => setSelectedCardId(card.id)}><ClosedCardMedia card={card} /><div className="portal-card-copy"><h4>{card.title}</h4>{card.scheduledAt ? <p>{new Intl.DateTimeFormat(clientLocaleTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.scheduledAt))}</p> : null}</div></button>)}</div> : <p className="portal-column-empty">{tr("Nenhum conteúdo nesta etapa.")}</p>}
                      </section>
                    ); })}

                    {data.withoutColumn.some((card) => contentApprovalCardIds.has(card.id)) ? <section className="portal-column glass-subtle">
                      <header className="portal-column-head" style={{ borderColor: "#7a86a9" }}><h3>{tr("Em criação")}</h3><span>{data.withoutColumn.filter((card) => contentApprovalCardIds.has(card.id)).length}</span></header>
                      <div className="portal-card-list">{data.withoutColumn.filter((card) => contentApprovalCardIds.has(card.id)).map((card) => <button key={card.id} className="portal-card card-button" onClick={() => setSelectedCardId(card.id)}><ClosedCardMedia card={card} /><div className="portal-card-copy"><h4>{card.title}</h4>{card.scheduledAt ? <p>{new Intl.DateTimeFormat(clientLocaleTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.scheduledAt))}</p> : null}</div></button>)}</div>
                    </section> : null}
                  </div>
                </section> : null}

                {!pautaApprovalCards.length && !contentApprovalCardIds.size && !visiblePortalColumns.length ? <section className="portal-approval-empty"><span>✓</span><h2>{tr("Tudo revisado")}</h2><p>{tr("Não há pautas ou posts aguardando sua aprovação agora.")}</p></section> : null}
              </div>
              )}
            </div>
          </div>

          <div className="portal-secondary">
            {data.widgets.upcomingPosts ? <ClientUpcomingPostsWidget items={data.upcomingItems} onSelectPost={setSelectedCardId} /> : null}
            {upcomingPortalAppointments.length > 0 ? (
              <section className="glass widget-card">
                <div className="widget-head">
                  <h3>{tr("Próximos compromissos")}</h3>
                  <span>{upcomingPortalAppointments.length}</span>
                </div>
                <div className="widget-list">
                  {upcomingPortalAppointments.map((event) => (
                    <article key={event.id} className="list-item appointment-item">
                      <div>
                        <strong>{event.title}</strong>
                        <p>{new Intl.DateTimeFormat(clientLocaleTag, { dateStyle: "short", timeStyle: "short" }).format(new Date(event.startsAt))}</p>
                      </div>
                      {event.meetLink ? <a className="ghost-button compact-button" href={event.meetLink} target="_blank" rel="noreferrer" onClick={(mouseEvent) => mouseEvent.stopPropagation()}><UiIcon name="link" />Meet</a> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {data.widgets.reports ? (
              <section className="glass widget-card">
                <div className="widget-head">
                  <h3>{tr("Relatórios")}</h3>
                  <span>{tr("Mensal")}</span>
                </div>
                <p className="widget-paragraph">
                  {tr("O cliente encontra aqui os relatórios liberados por permissão, sem ver nada do restante da operação interna.")}
                </p>
              </section>
            ) : null}
          </div>
        </section>}
      </main>

      <CardDetailModal
        mode="portal"
        titlePrefix={tr("Card do cliente")}
        detail={detail.data}
        loading={detail.loading}
        source={detail.source}
        onAddComment={(cardId, commentText) =>
          addPortalCardCommentBySlug(slug, cardId, { commentText })
        }
        onApprove={approvePortalCard}
        onRequestChanges={(cardId, commentText) =>
          submitPortalCardDecisionBySlug(slug, cardId, { approved: false, commentText })
        }
        canRespond={canRespondToClientContent}
        allowEditCaption={canUseEnabledClientTools && data.permissions.allowClientEditCaption}
        onUpdateCaption={(cardId, caption) => updatePortalCardCaptionBySlug(slug, cardId, caption)}
        allowManageTags={canUseEnabledClientTools && data.permissions.allowClientCreateTags}
        onLoadTags={() => listPortalTagsBySlug(slug)}
        onCreateTag={(input) => createPortalTagBySlug(slug, input)}
        onUpdateTags={(cardId, tags) => updatePortalCardTagsBySlug(slug, cardId, tags)}
        onRefresh={() => setRefreshKey((value) => value + 1)}
        onClose={() => setSelectedCardId(null)}
      />
      {createPostOpen ? <ClientPostSuggestionModal draft={postDraft} columns={data.postCreationColumns} files={postFiles} submitting={postSubmitting} error={postError} onChange={(field, value) => setPostDraft((current) => ({ ...current, [field]: value }))} onFilesChange={setPostFiles} onClose={() => { if (!postSubmitting) setCreatePostOpen(false); }} onSubmit={submitPostSuggestion} /> : null}
    </div>
    </PortalLocaleContext.Provider>
  );
}

function PortalFormattedCaption({ text }: { text: string }) {
  const { t } = usePortalTranslation();
  const hashtags = Array.from(new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? []));
  const body = text.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+([.,;:!?])/g, "$1").trim();
  const sections = body.split(/\n{2,}|(?=[📊👉💡✅🎯📌])/u).map((item) => item.trim()).filter(Boolean);
  const renderInline = (value: string) => value.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong> : <span key={`${part}-${index}`}>{part}</span>);

  return <div className="portal-caption-content">
    <div className="portal-caption-copy">{sections.length ? sections.map((section, index) => <p key={`${section.slice(0, 30)}-${index}`}>{renderInline(section)}</p>) : <p>{t("Sem legenda cadastrada ainda.")}</p>}</div>
    {hashtags.length ? <div className="portal-caption-hashtags" aria-label={t("Hashtags do post")}>{hashtags.map((hashtag) => <span key={hashtag}>{hashtag}</span>)}</div> : null}
  </div>;
}

function CardDetailModal({
  mode,
  titlePrefix,
  detail,
  loading,
  source,
  onAddComment,
  onApprove,
  onRequestChanges,
  canRespond = true,
  allowEditCaption,
  onUpdateCaption,
  allowManageTags,
  onLoadTags,
  onCreateTag,
  onUpdateTags,
  onRefresh,
  onClose,
  adminContext,
}: {
  mode: "admin" | "portal";
  titlePrefix: string;
  detail: CardDetail | null;
  loading: boolean;
  source: "backend" | "error";
  onAddComment: (cardId: string, commentText: string) => Promise<unknown>;
  onApprove: (cardId: string, commentText: string) => Promise<unknown>;
  onRequestChanges: (cardId: string, commentText: string) => Promise<unknown>;
  canRespond?: boolean;
  allowEditCaption?: boolean;
  onUpdateCaption?: (cardId: string, caption: string | null) => Promise<unknown>;
  allowManageTags?: boolean;
  onLoadTags?: () => Promise<{ items: ClientTagDefinition[] }>;
  onCreateTag?: (input: { name: string; color: string }) => Promise<{ ok: true; tag: ClientTagDefinition }>;
  onUpdateTags?: (cardId: string, tags: string[]) => Promise<unknown>;
  onRefresh: () => void;
  onClose: () => void;
  adminContext?: { slug: string; columns: BoardColumn[] };
}) {
  const { t, localeTag } = usePortalTranslation();
  const [commentDraft, setCommentDraft] = useState("");
  const [submitting, setSubmitting] = useState<"comment" | "approve" | "changes" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(detail?.card.subtitle ?? "");
  const [captionSaving, setCaptionSaving] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [portalTagLibrary, setPortalTagLibrary] = useState<ClientTagDefinition[]>([]);
  const [selectedPortalTags, setSelectedPortalTags] = useState<string[]>(detail?.card.tags ?? []);
  const [newPortalTagName, setNewPortalTagName] = useState("");
  const [newPortalTagColor, setNewPortalTagColor] = useState("#6f63dc");
  const [portalTagWorking, setPortalTagWorking] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!detail || editingCaption) return;
    setCaptionDraft(detail.card.subtitle ?? "");
  }, [detail?.card.id, detail?.card.subtitle, editingCaption]);
  useEffect(() => {
    setSelectedPortalTags(detail?.card.tags ?? []);
    setTagEditorOpen(false);
  }, [detail?.card.id, detail?.card.tags.join("|")]);
  useEffect(() => {
    if (!allowManageTags || !onLoadTags || !detail) return;
    void onLoadTags().then((result) => setPortalTagLibrary(result.items)).catch(() => setPortalTagLibrary([]));
  }, [allowManageTags, detail?.card.id, onLoadTags]);
  useEffect(() => {
    if (!detail || mode === "admin") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (videoPreviewUrl) setVideoPreviewUrl(null);
      else onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detail, mode, onClose, videoPreviewUrl]);

  if (!detail) return null;

  if (mode === "admin" && adminContext) {
    return (
      <AdminCardEditor
        detail={detail}
        columns={adminContext.columns}
        slug={adminContext.slug}
        onAddComment={onAddComment}
        onRefresh={onRefresh}
        onClose={onClose}
      />
    );
  }

  async function handleAction(
    action: "comment" | "approve" | "changes",
    runner: () => Promise<unknown>,
  ) {
    setSubmitting(action);
    setFeedback(null);

    try {
      await runner();
      setCommentDraft("");
      onRefresh();
      setFeedback(
        action === "comment"
          ? t("Comentário salvo.")
          : action === "approve"
            ? t("Card aprovado com sucesso.")
            : t("Solicitação de alteração enviada."),
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("Não foi possível concluir a ação."));
    } finally {
      setSubmitting(null);
    }
  }

  async function savePortalCaption() {
    if (!onUpdateCaption || !detail) return;
    setCaptionSaving(true);
    setFeedback(null);
    try {
      await onUpdateCaption(detail.card.id, captionDraft.trim() || null);
      setEditingCaption(false);
      onRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("Não foi possível salvar a legenda."));
    } finally {
      setCaptionSaving(false);
    }
  }

  async function createPortalTag() {
    const name = newPortalTagName.trim();
    if (!name || !onCreateTag) return;
    setPortalTagWorking(true);
    setFeedback(null);
    try {
      const result = await onCreateTag({ name, color: newPortalTagColor });
      if (result.tag) {
        setPortalTagLibrary((current) => [...current, result.tag].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedPortalTags((current) => current.includes(result.tag.name) ? current : [...current, result.tag.name]);
      }
      setNewPortalTagName("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("Não foi possível criar a etiqueta."));
    } finally {
      setPortalTagWorking(false);
    }
  }

  async function savePortalTags() {
    if (!detail || !onUpdateTags) return;
    setPortalTagWorking(true);
    setFeedback(null);
    try {
      await onUpdateTags(detail.card.id, selectedPortalTags);
      setTagEditorOpen(false);
      onRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("Não foi possível salvar as etiquetas."));
    } finally {
      setPortalTagWorking(false);
    }
  }
  const hasPortalVisualMedia = portalCardAssets(detail.card).length > 0;
  const lifecycle = getPortalCardLifecycle(detail.card, t);
  const clientResponseTone = /aprovad/i.test(detail.card.clientLabel)
    ? "approved"
    : /(alteração|alteracao|revis)/i.test(detail.card.clientLabel)
      ? "revision"
      : "pending";
  const relevantDate = detail.card.publishedAt ?? detail.card.scheduledAt ?? detail.card.archivedAt;
  const relevantDateLabel = detail.card.publishedAt
    ? t("Publicado em")
    : detail.card.scheduledAt
      ? t("Agendamento")
      : detail.card.archivedAt
        ? t("Arquivado em")
        : t("Agendamento");

  return (
    <div className={`modal-backdrop${mode === "portal" ? " portal-card-modal-backdrop" : ""}`} onClick={onClose}>
      <div className={`modal-panel glass${mode === "portal" ? ` portal-card-detail-modal${hasPortalVisualMedia ? "" : " no-media"}` : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{titlePrefix}</p>
            <h3>{detail.card.title}</h3>
          </div>
          <button className="ghost-button" onClick={onClose}>
            {t("Fechar")}
          </button>
        </div>

        {mode === "admin" ? <StatusBanner
          source={source}
          loading={loading}
          message={
            source === "backend"
              ? "Detalhe carregado da base real."
              : "Não consegui carregar este detalhe na API da V2."
          }
        /> : null}

        <div className="modal-grid">
          <div className="modal-media">
            {portalCardAssets(detail.card).length > 1 || (mode === "portal" && portalCardAssets(detail.card).length === 1) ? (
              <ArtworkCarousel urls={portalCardAssets(detail.card)} title={detail.card.title} preserveMediaSize={mode === "portal"} mediaType={`${detail.card.typeLabel} ${detail.card.mediaType ?? ""}`} onOpenVideo={mode === "portal" ? setVideoPreviewUrl : undefined} />
            ) : portalCardAssets(detail.card)[0] ? (
              <div className={`media-frame ${detail.card.mediaAspect}`}>
                <ResilientCardMedia url={portalCardAssets(detail.card)[0]} title={detail.card.title} />
              </div>
            ) : linkedCardMaterial(detail.card) ? <CardMediaFallback title={detail.card.title} linked /> : null}
            <div className="badge-row">
              {detail.card.statusBadges.map((badge) => (
                <span key={badge} className="mini-badge status">
                  {cardStatusLabel(badge)}
                </span>
              ))}
              {detail.card.tags.map((tag) => (
                <span key={tag} className="mini-badge tag tag-filled" style={{ backgroundColor: cardTagColor(tag, detail.card.tagColors?.[tag]), color: calendarTextColor(cardTagColor(tag, detail.card.tagColors?.[tag])) }}>
                  {cardStatusLabel(tag)}
                </span>
              ))}
            </div>
            {linkedCardMaterial(detail.card) ? (
              <a className="external-card-link" href={linkedCardMaterial(detail.card) ?? undefined} target="_blank" rel="noreferrer">
                {t("Abrir link externo ↗")}
              </a>
            ) : null}
          </div>

          <div className="modal-sidebar-copy">
            <section className="glass-subtle modal-card portal-summary-card">
              <header className="portal-summary-heading"><span><UiIcon name="file" /></span><div><small>{t("CONTEÚDO DO POST")}</small><h4>{t("Legenda")}</h4></div>{allowEditCaption && !editingCaption ? <button type="button" className="portal-caption-edit-button" onClick={() => setEditingCaption(true)}><UiIcon name="file" />{t("Editar legenda")}</button> : null}</header>
              {editingCaption ? <div className="portal-caption-editor"><label htmlFor={`portal-caption-${detail.card.id}`}>{t("Edite o texto abaixo")}</label><textarea id={`portal-caption-${detail.card.id}`} autoFocus value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} maxLength={5000} placeholder={t("Escreva a legenda do post...")} /><div className="portal-caption-editor-footer"><small>{captionDraft.length}/5000 {t("caracteres")}</small><div><button type="button" className="ghost-button" disabled={captionSaving} onClick={() => { setCaptionDraft(detail.card.subtitle ?? ""); setEditingCaption(false); }}>{t("Cancelar")}</button><button type="button" className="gradient-button" disabled={captionSaving} onClick={() => void savePortalCaption()}>{t(captionSaving ? "Salvando..." : "Salvar legenda")}</button></div></div></div> : <PortalFormattedCaption text={captionDraft} />}
              {allowManageTags ? <section className="portal-tag-manager"><header><div><small>{t("ETIQUETAS DO POST")}</small><strong>{selectedPortalTags.length ? `${selectedPortalTags.length} ${t(selectedPortalTags.length === 1 ? "etiqueta selecionada" : "etiquetas selecionadas")}` : t("Nenhuma etiqueta")}</strong></div><button type="button" onClick={() => setTagEditorOpen((open) => !open)}>{t(tagEditorOpen ? "Fechar" : "Gerenciar tags")}</button></header>{selectedPortalTags.length ? <div className="portal-tag-pills">{selectedPortalTags.map((name) => { const tag = portalTagLibrary.find((item) => item.name === name); return <span key={name} style={{ "--portal-tag-color": tag?.color ?? "#7568dc" } as CSSProperties}>{name}</span>; })}</div> : null}{tagEditorOpen ? <div className="portal-tag-editor"><div className="portal-tag-options">{portalTagLibrary.map((tag) => { const selected = selectedPortalTags.includes(tag.name); return <button key={tag.id} type="button" className={selected ? "selected" : ""} onClick={() => setSelectedPortalTags((current) => selected ? current.filter((name) => name !== tag.name) : [...current, tag.name])}><i style={{ backgroundColor: tag.color }} />{tag.name}<span>{selected ? "✓" : "+"}</span></button>; })}{portalTagLibrary.length === 0 ? <p>{t("Nenhuma tag criada. Crie a primeira abaixo.")}</p> : null}</div><div className="portal-tag-create"><input value={newPortalTagName} onChange={(event) => setNewPortalTagName(event.target.value)} maxLength={100} placeholder={t("Nome da nova tag")} /><input type="color" value={newPortalTagColor} onChange={(event) => setNewPortalTagColor(event.target.value)} aria-label={t("Cor da nova tag")} /><button type="button" disabled={portalTagWorking || !newPortalTagName.trim()} onClick={() => void createPortalTag()}>{t("+ Criar")}</button></div><div className="portal-tag-actions"><button type="button" className="ghost-button" disabled={portalTagWorking} onClick={() => { setSelectedPortalTags(detail.card.tags); setTagEditorOpen(false); }}>{t("Cancelar")}</button><button type="button" className="gradient-button" disabled={portalTagWorking} onClick={() => void savePortalTags()}>{t(portalTagWorking ? "Salvando..." : "Salvar etiquetas")}</button></div></div> : null}</section> : null}
              <div className="portal-card-meta-grid">
                <article className={`portal-card-meta status ${lifecycle.tone}`}>
                  <span><UiIcon name={lifecycle.icon} /></span>
                  <div><small>{t("Status atual")}</small><strong>{lifecycle.label}</strong></div>
                </article>
                <article className={`portal-card-meta client-response ${clientResponseTone}`}>
                  <span><UiIcon name={clientResponseTone === "approved" ? "check" : clientResponseTone === "revision" ? "comment" : "clock"} /></span>
                  <div><small>{t("Retorno do cliente")}</small><strong>{portalText(localeTag, detail.card.clientLabel)}</strong></div>
                </article>
                <article className="portal-card-meta schedule">
                  <span><UiIcon name="calendar" /></span>
                  <div><small>{relevantDateLabel}</small><strong>{relevantDate ? new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(relevantDate)) : t("Não agendado")}</strong></div>
                </article>
                <article className="portal-card-meta comments">
                  <span><UiIcon name="comment" /></span>
                  <div><small>{t("Comentários")}</small><strong>{detail.comments.length} {t(detail.comments.length === 1 ? "comentário" : "comentários")}</strong></div>
                </article>
              </div>
            </section>

            <section className="glass-subtle modal-card portal-feedback-card">
              <h4>{mode === "portal" ? t("Seu feedback") : "Comentários"}</h4>
              {mode === "portal" ? <p className="portal-feedback-helper">{t("Comente sobre este post ou escolha uma ação para enviar seu retorno à equipe.")}</p> : null}
              {canRespond ? <div className="comment-form">
                <textarea
                  className="comment-input"
                  placeholder={
                    mode === "admin"
                      ? "Escreva um comentário interno para este card"
                      : t("Escreva aqui seu comentário sobre este post")
                  }
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <div className="modal-actions">
                  <button
                    className="ghost-button"
                    disabled={submitting !== null || !commentDraft.trim()}
                    onClick={() =>
                      handleAction("comment", () =>
                        onAddComment(detail.card.id, commentDraft.trim()),
                      )
                    }
                  >
                    {t(submitting === "comment" ? "Salvando..." : "Adicionar comentário")}
                  </button>
                  <button
                    className="gradient-button"
                    disabled={submitting !== null}
                    onClick={() =>
                      handleAction("approve", () => onApprove(detail.card.id, commentDraft.trim()))
                    }
                  >
                    {t(submitting === "approve" ? "Enviando..." : "Aprovar")}
                  </button>
                  <button
                    className="danger-button"
                    disabled={submitting !== null}
                    onClick={() =>
                      handleAction("changes", () =>
                        onRequestChanges(detail.card.id, commentDraft.trim()),
                      )
                    }
                  >
                        {t(submitting === "changes" ? "Enviando..." : "Pedir alteração")}
                  </button>
                </div>
                {feedback ? <p className="form-feedback">{feedback}</p> : null}
              </div> : <p className="client-access-notice">{t("Acesso somente para visualização.")}</p>}
              <div className="comment-stack">
                {detail.comments.map((comment) => (
                  <article key={comment.id} className="comment-item">
                    <div className="comment-meta">
                      <CommentAvatar name={comment.authorName} url={comment.authorAvatarUrl} />
                      <div><strong>{comment.authorName}</strong><span>{comment.authorRole}</span></div>
                    </div>
                    <p>{comment.commentText}</p>
                  </article>
                ))}
              </div>
            </section>

            {mode === "admin" && detail.approvalLinks.length > 0 ? (
              <section className="glass-subtle modal-card">
                <h4>Links de aprovação</h4>
                <div className="comment-stack">
                  {detail.approvalLinks.map((link) => (
                    <article key={link.id} className="comment-item">
                      <div className="comment-meta">
                        <strong>{link.isActive ? "Ativo" : "Encerrado"}</strong>
                        <span>Expira em {link.expiresAt.slice(0, 10)}</span>
                      </div>
                      <p>Token: {link.token}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
        {mode === "portal" && canRespond ? <footer className="portal-card-sticky-actions">
          <div><strong>{t("Seu feedback")}</strong><small>{commentDraft.trim() ? t("Seu comentário será enviado junto com a decisão.") : t("Você pode aprovar agora ou escrever um comentário acima.")}</small></div>
          <button className="ghost-button" disabled={submitting !== null || !commentDraft.trim()} onClick={() => handleAction("comment", () => onAddComment(detail.card.id, commentDraft.trim()))}>{t(submitting === "comment" ? "Salvando..." : "Comentar")}</button>
          <button className="danger-button" disabled={submitting !== null} onClick={() => handleAction("changes", () => onRequestChanges(detail.card.id, commentDraft.trim()))}>{t(submitting === "changes" ? "Enviando..." : "Pedir alteração")}</button>
          <button className="gradient-button" disabled={submitting !== null} onClick={() => handleAction("approve", () => onApprove(detail.card.id, commentDraft.trim()))}>{t(submitting === "approve" ? "Enviando..." : "Aprovar")}</button>
        </footer> : null}
      </div>
      {videoPreviewUrl ? <div className="portal-video-player-backdrop" role="dialog" aria-modal="true" aria-label={t("Reproduzir vídeo")} onClick={(event) => { event.stopPropagation(); setVideoPreviewUrl(null); }}>
        <div className="portal-video-player" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="portal-video-player-close" aria-label={t("Fechar vídeo")} onClick={() => setVideoPreviewUrl(null)}>×</button>
          <video src={videoPreviewUrl} autoPlay controls playsInline preload="auto" />
        </div>
      </div> : null}
    </div>
  );
}

type CardRecoveryDraft = {
  title: string; caption: string; artType: string; columnId: string; status: string; clientLabel: string;
  priorityLevel: CardPriority | ""; tags: string; hashtags: string; scheduledAt: string; externalLinkUrl: string; mediaUrls: string[];
};

function AdminCardEditor({
  detail,
  columns,
  slug,
  onAddComment,
  onRefresh,
  onClose,
}: {
  detail: CardDetail;
  columns: BoardColumn[];
  slug: string;
  onAddComment: (cardId: string, commentText: string) => Promise<unknown>;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const card = detail.card;
  const recoveryKey = `designhub-v2-card-draft:${slug}:${card.id}`;
  const serverDraft = useMemo<CardRecoveryDraft>(() => ({
    title: card.title,
    caption: card.subtitle ?? "",
    artType: normalizeArtType(card.typeLabel),
    columnId: columns.find((column) => column.cards.some((item) => item.id === card.id))?.id ?? "",
    status: card.statusBadges[0] ?? "",
    clientLabel: card.clientLabel,
    priorityLevel: card.priorityLevel ?? "",
    tags: card.tags.join(", "),
    hashtags: (card.hashtags ?? []).join(", "),
    scheduledAt: toDateTimeLocal(card.scheduledAt),
    externalLinkUrl: card.externalLinkUrl ?? "",
    mediaUrls: card.mediaUrls ?? (card.mediaUrl ? [card.mediaUrl] : []),
  }), [card, columns]);
  const recoveredDraft = useMemo(() => readRecoveryDraft<CardRecoveryDraft>(recoveryKey), [recoveryKey]);
  const initialDraft = recoveredDraft ?? serverDraft;
  const [title, setTitle] = useState(initialDraft.title);
  const [caption, setCaption] = useState(initialDraft.caption);
  const [artType, setArtType] = useState(initialDraft.artType);
  const [columnId, setColumnId] = useState(initialDraft.columnId);
  const [status, setStatus] = useState(initialDraft.status);
  const [clientLabel, setClientLabel] = useState(initialDraft.clientLabel);
  const [priorityLevel, setPriorityLevel] = useState<CardPriority | "">(initialDraft.priorityLevel);
  const [tags, setTags] = useState(initialDraft.tags);
  const [tagLibrary, setTagLibrary] = useState<ClientTagDefinition[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#5e5cf1");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [hashtags, setHashtags] = useState(initialDraft.hashtags);
  const [hashtagGroups, setHashtagGroups] = useState<HashtagGroup[]>([]);
  const [hashtagPickerOpen, setHashtagPickerOpen] = useState(false);
  const [newHashtagGroupName, setNewHashtagGroupName] = useState("");
  const [newHashtagGroupText, setNewHashtagGroupText] = useState("");
  const [scheduledAt, setScheduledAt] = useState(initialDraft.scheduledAt);
  const [externalLinkUrl, setExternalLinkUrl] = useState(initialDraft.externalLinkUrl);
  const [mediaUrls, setMediaUrls] = useState(initialDraft.mediaUrls);
  const [commentDraft, setCommentDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approvalLinkCopied, setApprovalLinkCopied] = useState(false);
  const [creatingApprovalLink, setCreatingApprovalLink] = useState(false);
  const [internalApprovalOpen, setInternalApprovalOpen] = useState(false);
  const [internalUsers, setInternalUsers] = useState<ManagedUser[]>([]);
  const [internalRecipientIds, setInternalRecipientIds] = useState<string[]>([]);
  const [internalMessage, setInternalMessage] = useState("");
  const [internalSending, setInternalSending] = useState(false);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>(recoveredDraft ? "recovered" : "idle");
  const [autosavedAt, setAutosavedAt] = useState<Date | null>(null);
  const [captionHistoryOpen, setCaptionHistoryOpen] = useState(false);
  const [captionVersions, setCaptionVersions] = useState<CaptionVersion[]>([]);
  const [captionHistoryLoading, setCaptionHistoryLoading] = useState(false);
  const [restoringCaptionVersionId, setRestoringCaptionVersionId] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const captionCopiedTimerRef = useRef<number | null>(null);
  const editorMainRef = useRef<HTMLDivElement>(null);
  const editorSideRef = useRef<HTMLElement>(null);
  const saveInFlightRef = useRef(false);
  const lastSavedDraftRef = useRef(JSON.stringify(serverDraft));
  const savedColumnIdRef = useRef(serverDraft.columnId);
  const draft = useMemo<CardRecoveryDraft>(() => ({ title, caption, artType, columnId, status, clientLabel, priorityLevel, tags, hashtags, scheduledAt, externalLinkUrl, mediaUrls }), [artType, caption, clientLabel, columnId, externalLinkUrl, hashtags, mediaUrls, priorityLevel, scheduledAt, status, tags, title]);
  const latestDraftRef = useRef(draft);
  latestDraftRef.current = draft;

  useEffect(() => () => {
    if (captionCopiedTimerRef.current !== null) window.clearTimeout(captionCopiedTimerRef.current);
  }, []);

  useEffect(() => {
    editorMainRef.current?.scrollTo({ top: 0 });
    editorSideRef.current?.scrollTo({ top: 0 });
  }, [card.id]);

  useEffect(() => {
    listAdminTagsBySlug(slug).then((result) => setTagLibrary(result.items)).catch(() => undefined);
    listAdminHashtagGroupsBySlug(slug).then((result) => setHashtagGroups(result.items)).catch(() => undefined);
    listManagedUsers().then((result) => setInternalUsers(result.items.filter((user) => user.isActive && user.globalRole !== "cliente"))).catch(() => setInternalUsers([]));
  }, [slug]);

  useEffect(() => {
    const draftJson = JSON.stringify(draft);
    if (draftJson === lastSavedDraftRef.current) return;
    try { window.localStorage.setItem(recoveryKey, draftJson); } catch { /* Recovery remains optional. */ }
    setAutosaveState((current) => current === "saving" ? current : "pending");
  }, [draft, recoveryKey]);

  async function sendInternalApproval() {
    if (!internalRecipientIds.length || !internalMessage.trim()) return;
    setInternalSending(true);
    try {
      const recipients = internalUsers.filter((user) => internalRecipientIds.includes(user.id));
      await addAdminCardCommentBySlug(slug, card.id, { commentText: `Aprovação interna enviada para ${recipients.map((user) => user.fullName).join(", ")}.

${internalMessage.trim()}`, isInternal: true });
      const key = "designhub-v2-internal-approvals";
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown[];
      window.localStorage.setItem(key, JSON.stringify([{ id: crypto.randomUUID(), cardId: card.id, clientSlug: slug, cardTitle: title, recipients: recipients.map((user) => user.id), message: internalMessage.trim(), createdAt: new Date().toISOString() }, ...current]));
      setFeedback("Card enviado para aprovação interna."); setInternalApprovalOpen(false); setInternalMessage(""); setInternalRecipientIds([]);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível enviar para aprovação interna."); }
    finally { setInternalSending(false); }
  }

  async function toggleCaptionHistory() {
    const nextOpen = !captionHistoryOpen;
    setCaptionHistoryOpen(nextOpen);
    if (!nextOpen) return;
    setCaptionHistoryLoading(true);
    try {
      const result = await listAdminCaptionVersionsBySlug(slug, card.id);
      setCaptionVersions(result.items);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar o histórico da legenda.");
    } finally {
      setCaptionHistoryLoading(false);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionCopied(true);
      if (captionCopiedTimerRef.current !== null) window.clearTimeout(captionCopiedTimerRef.current);
      captionCopiedTimerRef.current = window.setTimeout(() => setCaptionCopied(false), 2_000);
    } catch {
      setCaptionCopied(false);
      setFeedback("Não foi possível copiar a legenda.");
    }
  }

  async function restoreCaptionVersion(version: CaptionVersion) {
    if (restoringCaptionVersionId || !window.confirm("Restaurar esta versão da legenda? A versão atual continuará disponível no histórico.")) return;
    if (saveInFlightRef.current) {
      setFeedback("Aguarde o salvamento atual terminar antes de restaurar uma versão.");
      return;
    }
    const draftSaved = await persistCard(false);
    if (!draftSaved) return;
    setRestoringCaptionVersionId(version.id);
    try {
      const result = await restoreAdminCaptionVersionBySlug(slug, card.id, version.id);
      const restoredCaption = result.card.caption ?? "";
      const restoredDraft = { ...latestDraftRef.current, caption: restoredCaption };
      lastSavedDraftRef.current = JSON.stringify(restoredDraft);
      latestDraftRef.current = restoredDraft;
      setCaption(restoredCaption);
      setCaptionVersions(result.versions);
      setAutosavedAt(new Date());
      setAutosaveState("saved");
      try { window.localStorage.removeItem(recoveryKey); } catch { /* Recovery remains optional. */ }
      setFeedback("Versão anterior da legenda restaurada.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível restaurar esta versão.");
    } finally {
      setRestoringCaptionVersionId(null);
    }
  }

  const splitValues = (value: string) =>
    value.split(",").map((item) => item.trim()).filter(Boolean);

  async function handleUpload(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    const invalidFile = selectedFiles.find((file) => file.size > (file.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE));
    if (invalidFile) {
      const max = invalidFile.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE;
      setFeedback(`“${invalidFile.name}” tem ${(invalidFile.size / 1024 / 1024).toFixed(1)} MB. O limite para ${invalidFile.type.startsWith("video/") ? "vídeos" : "imagens"} é ${Math.round(max / 1024 / 1024)} MB.`);
      return;
    }
    setUploading(true);
    setFeedback(null);
    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        uploadedUrls.push(await uploadAdminMedia(file));
      }
      setMediaUrls((current) => [...current, ...uploadedUrls]);
      setFeedback(`${uploadedUrls.length} ${uploadedUrls.length === 1 ? "arquivo enviado" : "arquivos enviados"} com sucesso.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function persistCard(closeAfterSave: boolean) {
    const currentDraft = latestDraftRef.current;
    const draftJson = JSON.stringify(currentDraft);
    if (!currentDraft.title.trim()) {
      setFeedback("Informe um título para salvar o card.");
      setAutosaveState("error");
      return false;
    }
    if (draftJson === lastSavedDraftRef.current) {
      if (closeAfterSave) { onRefresh(); onClose(); }
      return true;
    }
    if (saveInFlightRef.current) return false;
    saveInFlightRef.current = true;
    setSaving(true);
    setAutosaveState("saving");
    if (closeAfterSave) setFeedback(null);
    try {
      await updateAdminCardBySlug(slug, card.id, {
        title: currentDraft.title.trim(),
        caption: currentDraft.caption.trim() || null,
        artType: currentDraft.artType,
        mediaType: currentDraft.artType.toLowerCase().includes("video") ? "video" : "image",
        primaryMediaUrl: currentDraft.mediaUrls[0] ?? null,
        mediaUrls: currentDraft.mediaUrls,
        externalLinkUrl: currentDraft.externalLinkUrl.trim() || null,
        status: currentDraft.status ? [currentDraft.status, ...card.statusBadges.slice(1)] : [],
        tags: splitValues(currentDraft.tags),
        hashtags: splitValues(currentDraft.hashtags).map((item) => item.startsWith("#") ? item : `#${item}`),
        isBriefApproval: card.isBriefApproval ?? false,
        scheduledAt: currentDraft.scheduledAt || null,
        scheduledTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clientLabel: currentDraft.clientLabel.trim() || "Pendente",
        priorityLevel: currentDraft.priorityLevel || null,
      });
      if (currentDraft.columnId !== savedColumnIdRef.current) {
        await moveAdminCardBySlug(slug, card.id, currentDraft.columnId || null);
        savedColumnIdRef.current = currentDraft.columnId;
      }
      lastSavedDraftRef.current = draftJson;
      const hasNewerDraft = JSON.stringify(latestDraftRef.current) !== draftJson;
      if (!hasNewerDraft) {
        try { window.localStorage.removeItem(recoveryKey); } catch { /* Recovery remains optional. */ }
      }
      setAutosavedAt(new Date());
      setAutosaveState(hasNewerDraft ? "pending" : "saved");
      if (closeAfterSave && !hasNewerDraft) {
        setFeedback("Alterações salvas no card.");
        onRefresh();
        onClose();
      } else if (hasNewerDraft) {
        window.setTimeout(() => { void persistCard(closeAfterSave); }, 2_000);
      }
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
      setAutosaveState("error");
      return false;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function requestClose() {
    if (saving || uploading) return;
    if (JSON.stringify(latestDraftRef.current) !== lastSavedDraftRef.current) {
      await persistCard(true);
      return;
    }
    onRefresh();
    onClose();
  }

  useEffect(() => {
    const saveAndCloseOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void requestClose();
    };
    window.addEventListener("keydown", saveAndCloseOnEscape, true);
    return () => window.removeEventListener("keydown", saveAndCloseOnEscape, true);
  });

  async function sendComment() {
    if (!commentDraft.trim()) return;
    try {
      await onAddComment(card.id, commentDraft.trim());
      setCommentDraft("");
      setFeedback("Comentário enviado.");
      onRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível enviar o comentário.");
    }
  }

  async function createApprovalLink() {
    if (creatingApprovalLink) return;
    setCreatingApprovalLink(true);
    setApprovalLinkCopied(false);
    try {
      const result = await createAdminApprovalLinkBySlug(slug, card.id);
      const origin = window.location.origin;
      const link = `${origin}/#/approval/${result.approvalLink.token}`;
      await navigator.clipboard.writeText(link);
      setApprovalLinkCopied(true);
      setFeedback("Link de aprovação copiado. Ele é válido por 7 dias.");
      onRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar e copiar o link.");
    } finally {
      setCreatingApprovalLink(false);
    }
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) {
      setFeedback("Informe um nome para criar a etiqueta.");
      return;
    }
    setCreatingTag(true);
    try {
      const result = await createAdminTagBySlug(slug, { name, color: newTagColor });
      setTagLibrary((current) => [...current, result.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setTags((current) => splitValues(current).includes(name) ? current : [...splitValues(current), name].join(", "));
      setNewTagName("");
      setFeedback(`Etiqueta “${name}” criada.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar a etiqueta.");
    } finally {
      setCreatingTag(false);
    }
  }

  async function createHashtagGroup() {
    const name = newHashtagGroupName.trim();
    const values = newHashtagGroupText.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean).map((item) => item.startsWith("#") ? item : `#${item}`);
    if (!name || values.length === 0) {
      setFeedback("Informe o nome e ao menos uma hashtag para criar o grupo.");
      return;
    }
    try {
      const result = await createAdminHashtagGroupBySlug(slug, { name, hashtags: values });
      setHashtagGroups((current) => [...current, result.group].sort((a, b) => a.name.localeCompare(b.name)));
      setNewHashtagGroupName(""); setNewHashtagGroupText("");
      setFeedback(`Grupo “${name}” criado.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar o grupo.");
    }
  }

  function insertHashtagGroup(group: HashtagGroup) {
    const groupText = group.hashtags.join(" ");
    setCaption((current) => current.trim() ? `${current.trim()}\n\n${groupText}` : groupText);
    setHashtags(group.hashtags.join(", "));
    setHashtagPickerOpen(false);
    setFeedback(`Grupo “${group.name}” inserido na legenda.`);
  }

  async function removeHashtagGroup(group: HashtagGroup) {
    if (!window.confirm(`Excluir o grupo “${group.name}”?`)) return;
    try {
      await deleteAdminHashtagGroupBySlug(slug, group.id);
      setHashtagGroups((current) => current.filter((item) => item.id !== group.id));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o grupo.");
    }
  }

  return createPortal(
    <div className="admin-card-backdrop" onClick={() => void requestClose()}>
      <section className="admin-card-editor" role="dialog" aria-modal="true" aria-label={`Editar card ${title || card.title}`} onClick={(event) => event.stopPropagation()}>
        <button className="admin-card-close" onClick={() => void requestClose()} aria-label="Fechar card">×</button>
        <div className="admin-card-main" ref={editorMainRef}>
          <EditorField label="Título">
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </EditorField>
          <div className="editor-main-grid">
            <div>
              <EditorField label="Legenda" action={<span className="caption-field-actions"><button className={captionHistoryOpen ? "caption-history-button active" : "caption-history-button"} type="button" onClick={() => void toggleCaptionHistory()}>↶ Histórico</button><button className={captionCopied ? "caption-copy-button copied" : "caption-copy-button"} type="button" title={captionCopied ? "Legenda copiada" : "Copiar legenda"} aria-label={captionCopied ? "Legenda copiada" : "Copiar legenda"} aria-live="polite" onClick={() => void copyCaption()}><UiIcon name={captionCopied ? "check" : "copy"} />{captionCopied ? <span>Copiado!</span> : null}</button></span>}>
                <textarea className="admin-caption-editor" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Escreva a legenda do post" />
                {captionHistoryOpen ? <section className="caption-history-panel"><header><div><strong>Histórico da legenda</strong><small>As versões atuais e restauradas nunca são apagadas.</small></div><button type="button" onClick={() => setCaptionHistoryOpen(false)} aria-label="Fechar histórico">×</button></header>{captionHistoryLoading ? <p className="caption-history-empty">Carregando versões...</p> : captionVersions.length ? <div className="caption-history-list">{captionVersions.map((version) => <article key={version.id}><div><strong>{version.authorName}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(version.createdAt))}</time></div><p>{version.caption?.trim() || "Legenda vazia"}</p><button type="button" disabled={restoringCaptionVersionId !== null} onClick={() => void restoreCaptionVersion(version)}>{restoringCaptionVersionId === version.id ? "Restaurando..." : "Restaurar esta versão"}</button></article>)}</div> : <p className="caption-history-empty">Ainda não existem versões anteriores. A primeira será criada quando a legenda atual for alterada.</p>}</section> : null}
              </EditorField>
              <EditorField label="Mídia">
                <div className="media-editor-stack">
                  {mediaUrls.length ? <ReorderableMediaGrid
                    items={mediaUrls.map((url, index) => ({ id: `${url}-${index}`, url, isVideo: /\.(mp4|webm|mov)(\?|$)/i.test(url) }))}
                    onReorder={(from, to) => setMediaUrls((current) => reorderMediaItems(current, from, to))}
                    onRemove={(index) => setMediaUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  /> : null}
                  <label className="editor-add-media">
                    <input multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => handleUpload(event.target.files)} />
                    {uploading ? "Enviando..." : mediaUrls.length ? "+ Adicionar outros slides" : "+ Adicionar arquivos"}
                  </label>
                  {mediaUrls.length > 1 ? <small className="media-order-help">Arraste os slides para mudar a ordem. O primeiro será usado como capa.</small> : null}
                </div>
              </EditorField>
              <EditorField label="Ou usar link externo">
                <input type="url" value={externalLinkUrl} onChange={(event) => setExternalLinkUrl(event.target.value)} placeholder="https://drive.google.com/..." />
              </EditorField>
            </div>
            <section className="editor-comments">
            <h4>Comentários ({detail.comments.length})</h4>
            {detail.comments.map((comment) => (
              <article className="editor-comment" key={comment.id}>
                <div className="editor-comment-author"><CommentAvatar name={comment.authorName} url={comment.authorAvatarUrl} /><strong>{comment.authorName} <small>{comment.authorRole}</small></strong></div>
                <time>{new Date(comment.createdAt).toLocaleString("pt-BR")}</time>
                <p>{comment.commentText}</p>
              </article>
            ))}
            <div className="editor-comment-compose">
              <div className="comment-toolbar"><b>B</b><i>I</i><u>U</u><span>H2</span><span>Lista</span></div>
              <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Escrever um comentário" />
              <button className="gradient-button" onClick={sendComment} disabled={!commentDraft.trim()}>Enviar</button>
            </div>
            </section>
          </div>
        </div>
        <aside className="admin-card-side" ref={editorSideRef}>
          <CardTimeTracker slug={slug} cardId={card.id} cardTitle={title || card.title} />
          <ArtTypeSelect value={artType} onChange={setArtType} />
          <EditorSelect label="Status" value={status} onChange={setStatus} options={CARD_STATUS_OPTIONS} emptyLabel="Sem status" />
          <label className="editor-field"><span>Prioridade</span><select value={priorityLevel} onChange={(event) => setPriorityLevel(event.target.value as CardPriority | "")}><option value="">Sem prioridade</option><option value="high">Alta prioridade</option><option value="medium">Média prioridade</option><option value="normal">Prioridade normal</option></select></label>
          <EditorSelect label="Feedback do cliente" value={clientLabel} onChange={setClientLabel} options={["Pendente", "Aprovado", "Alteração solicitada"]} />
          <EditorField label="Agendamento"><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><small className="editor-field-hint">Na data e hora informadas, o card será movido para Arquivados.</small></EditorField>
          <label className="editor-field"><span>Coluna</span><select value={columnId} onChange={(event) => setColumnId(event.target.value)}><option value="">Sem coluna</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
          <section className="tag-library">
            <div className="tag-library-head"><span>Etiquetas</span></div>
            <div className="tag-selected-row">
              {splitValues(tags).map((name) => {
                const definition = tagLibrary.find((tag) => tag.name === name);
                const tagColor = cardTagColor(name, definition?.color);
                return <button key={name} type="button" className="tag-selected-pill" style={{ backgroundColor: tagColor, color: calendarTextColor(tagColor) }} onClick={() => setTags((current) => splitValues(current).filter((item) => item !== name).join(", "))}>{cardStatusLabel(name)}<span className="editor-tag-remove">×</span></button>;
              })}
              <button type="button" className="tag-picker-trigger" onClick={() => setTagPickerOpen((open) => !open)}>◇ Tags</button>
            </div>
            {tagPickerOpen ? <div className="tag-picker-popover">
              <div className="tag-picker-search"><span>⌕</span><input autoFocus value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Buscar etiqueta..." /></div>
              <div className="tag-picker-list">
                {tagLibrary.filter((tag) => tag.name.toLocaleLowerCase("pt-BR").includes(tagSearch.toLocaleLowerCase("pt-BR"))).map((tag) => {
                  const selected = splitValues(tags).includes(tag.name);
                  return <button key={tag.id} type="button" className={selected ? "tag-picker-item selected" : "tag-picker-item"} onClick={() => setTags((current) => selected ? splitValues(current).filter((item) => item !== tag.name).join(", ") : [...splitValues(current), tag.name].join(", "))}><i style={{ backgroundColor: cardTagColor(tag.name, tag.color) }} />{cardStatusLabel(tag.name)}<span>{selected ? "Selecionada" : ""}</span></button>;
                })}
                {tagLibrary.length === 0 ? <p className="tag-empty">Nenhuma etiqueta criada ainda.</p> : null}
                {tagLibrary.length > 0 && tagLibrary.filter((tag) => tag.name.toLocaleLowerCase("pt-BR").includes(tagSearch.toLocaleLowerCase("pt-BR"))).length === 0 ? <p className="tag-empty">Nenhuma etiqueta encontrada.</p> : null}
              </div>
              <div className="tag-create-row"><input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Nova etiqueta" /><input className="tag-color-input" type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} aria-label="Cor da etiqueta" /><button type="button" onClick={createTag} disabled={creatingTag}>{creatingTag ? "Criando..." : "+ Nova"}</button></div>
            </div> : null}
          </section>
          <section className="hashtag-library">
            <span>Hashtags</span>
            <button type="button" className="hashtag-trigger" onClick={() => setHashtagPickerOpen((open) => !open)}># Hashtags</button>
            {hashtagPickerOpen ? <div className="hashtag-popover">
              <header><strong>Grupos de Hashtags</strong><button type="button" onClick={() => setHashtagPickerOpen(false)}>×</button></header>
              <div className="hashtag-group-list">
                {hashtagGroups.map((group) => <article key={group.id} className="hashtag-group-card"><div><strong>{group.name}</strong><p>{group.hashtags.join(" ")}</p></div><div className="hashtag-group-actions"><button type="button" title="Copiar" onClick={() => navigator.clipboard.writeText(group.hashtags.join(" "))}>⧉</button><button type="button" title="Excluir" className="danger" onClick={() => removeHashtagGroup(group)}>♜</button></div><button type="button" className="insert-hashtags" onClick={() => insertHashtagGroup(group)}>Inserir na legenda</button></article>)}
                {hashtagGroups.length === 0 ? <p className="tag-empty">Nenhum grupo criado ainda.</p> : null}
              </div>
              <div className="hashtag-create"><input value={newHashtagGroupName} onChange={(event) => setNewHashtagGroupName(event.target.value)} placeholder="Nome do grupo" /><textarea value={newHashtagGroupText} onChange={(event) => setNewHashtagGroupText(event.target.value)} placeholder="#hashtag1 #hashtag2 #hashtag3" /><button type="button" onClick={createHashtagGroup}>+ Novo grupo</button></div>
            </div> : null}
          </section>
          <button type="button" className={`side-action approval-link-action${approvalLinkCopied ? " copied" : ""}`} onClick={() => void createApprovalLink()} disabled={creatingApprovalLink}><span className="side-action-icon">{approvalLinkCopied ? <UiIcon name="check" /> : "⌁"}</span>{creatingApprovalLink ? "Criando link..." : approvalLinkCopied ? "Link copiado" : "Enviar link para aprovação"}</button>
          <button className="side-action" onClick={() => setInternalApprovalOpen(true)}><span className="side-action-icon">♙</span>Aprovação interna</button>
          {internalApprovalOpen ? <div className="internal-approval-popover"><header><div><span>REVISÃO DA EQUIPE</span><h4>Enviar para aprovação interna</h4></div><button type="button" onClick={() => setInternalApprovalOpen(false)}>×</button></header><p>Escolha quem deve revisar este card. Clientes não aparecem nesta lista.</p><div className="internal-recipient-list">{internalUsers.length ? internalUsers.map((user) => <label key={user.id}><input type="checkbox" checked={internalRecipientIds.includes(user.id)} onChange={(event) => setInternalRecipientIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /><span><strong>{user.fullName}</strong><small>{user.globalRole} · {user.email}</small></span></label>) : <small>Nenhum membro interno disponível.</small>}</div><textarea value={internalMessage} onChange={(event) => setInternalMessage(event.target.value)} placeholder="Escreva uma mensagem para quem vai revisar..." /><footer><button type="button" className="ghost-button" onClick={() => setInternalApprovalOpen(false)}>Cancelar</button><button type="button" className="gradient-button" disabled={internalSending || !internalRecipientIds.length || !internalMessage.trim()} onClick={() => void sendInternalApproval()}>{internalSending ? "Enviando..." : "Enviar para revisão"}</button></footer></div> : null}
        </aside>
        <footer className="admin-card-footer">
          <div>{feedback ? <p className="editor-feedback">{feedback}</p> : null}<AutosaveIndicator state={autosaveState} savedAt={autosavedAt} /></div>
          <button type="button" className="ghost-button" onClick={() => void requestClose()} disabled={saving || uploading}>Cancelar</button>
          <button className="gradient-button editor-save" onClick={() => void persistCard(true)} disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar e fechar"}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function EditorField({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return <label className="editor-field"><span>{label}{action ? <em>{action}</em> : null}</span>{children}</label>;
}

function EditorSelect({ label, value, onChange, options, emptyLabel }: { label: string; value: string; onChange: (value: string) => void; options: string[]; emptyLabel?: string }) {
  return <label className="editor-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{emptyLabel ? <option value="">{emptyLabel}</option> : null}{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ArtTypeIcon({ type }: { type: string }) {
  const iconByType: Record<string, string> = {
    "Post único": "▧",
    Carrossel: "▱",
    Reels: "▦",
    Story: "⊙",
    Logotipo: "✧",
    "Cartão de visita": "▭",
    Texto: "▤",
    Outros: "◌",
  };
  return <i className={`art-type-icon ${type.toLocaleLowerCase("pt-BR").replace(/ /g, "-")}`} aria-hidden="true">{iconByType[type]}</i>;
}

function ArtTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="editor-field art-type-field">
      <span>Tipo de arte</span>
      <button type="button" className="art-type-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <ArtTypeIcon type={value} />
        <strong>{value}</strong>
        <b>⌄</b>
      </button>
      {open ? (
        <div className="art-type-options">
          {ART_TYPE_OPTIONS.map((option) => (
            <button key={option} type="button" className={option === value ? "selected" : ""} onClick={() => { onChange(option); setOpen(false); }}>
              <ArtTypeIcon type={option} />
              <span>{option}</span>
              {option === value ? <b>✓</b> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function LoginPage({
  session,
  onLogin,
}: {
  session: SessionUser | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  if (session) {
    return <Navigate to={getDefaultRoute(session)} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const ok = await onLogin(email.trim(), password);
    setSubmitting(false);
    if (!ok) {
      setError("Não consegui autenticar na API real nem no fallback local.");
      return;
    }
    setError("");
  }

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setRecoveryMessage("");
    try {
      const result = await requestPasswordResetWithApi(email.trim());
      setRecoveryMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar o e-mail de recuperação agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-shell">
      <section className="login-grid login-experience">
        <article className="glass login-panel login-primary">
          <div className="login-brand-mark" aria-label="Design Hub V2">
            <img src={designHubV2Logo} alt="Logo Design Hub V2" />
          </div>
          <div className="login-kicker"><span className="login-live-dot" />DESIGN HUB · SEU ESPAÇO CRIATIVO</div>
          <h1>{recovering ? "Recupere seu acesso." : "Bem-vindo ao seu espaço criativo."}</h1>
          <p className="hero-copy">
            {recovering ? "Digite seu e-mail e enviaremos um link temporário para você criar uma nova senha." : "Acesse para acompanhar projetos, conteúdos e aprovações em um só lugar."}
          </p>

          <form id={recovering ? "designhub-recovery" : "designhub-login"} name={recovering ? "password-recovery" : "login"} className="login-form" method="post" action={recovering ? "/api/auth/forgot-password" : "/api/auth/login"} autoComplete="on" onSubmit={recovering ? requestRecovery : submit}>
            <label className="field-stack" htmlFor="login-username">
              <span>E-mail</span>
              <input id="login-username" name="username" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" enterKeyHint="next" autoFocus placeholder="Digite seu e-mail" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {!recovering ? <label className="field-stack" htmlFor="login-password">
              <span>Senha</span>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label> : null}
            <button className="gradient-button login-submit" type="submit" disabled={submitting}>
              {submitting ? (recovering ? "Enviando..." : "Entrando...") : recovering ? <>Enviar link seguro <span aria-hidden="true">→</span></> : <>Entrar no Design Hub <span aria-hidden="true">→</span></>}
            </button>
            <button className="login-text-action" type="button" onClick={() => { setRecovering((current) => !current); setError(""); setRecoveryMessage(""); }}>
              {recovering ? "Voltar para o login" : "Esqueci minha senha"}
            </button>
            {recoveryMessage ? <p className="form-feedback success-text" role="status">{recoveryMessage}</p> : null}
            {error ? <p className="form-feedback error-text">{error}</p> : null}
          </form>
          <p className="login-security-note"><span aria-hidden="true">●</span> Acesso protegido ao seu workspace</p>
        </article>

        <aside className="glass login-panel login-demo-panel login-showcase-panel" aria-label="Visão geral do Design Hub">
          <span className="login-orb orb-a" /><span className="login-orb orb-b" /><span className="login-orb orb-c" />
          <div className="login-showcase-copy">
            <p className="eyebrow">VISÃO COMPLETA</p>
            <h2>Tudo em um só lugar.</h2>
            <p>Projetos, conteúdos e decisões organizados para uma experiência simples e transparente.</p>
          </div>
          <div className="login-product-preview" aria-hidden="true">
            <div className="login-preview-topbar"><span /><span /><span /><b>Design Hub</b><em>•••</em></div>
            <div className="login-preview-greeting"><small>HOJE</small><strong>Olá, seja bem-vindo</strong><span>Acompanhe tudo o que está acontecendo</span></div>
            <div className="login-preview-metrics">
              <div><span className="blue">12</span><small>Em criação</small></div>
              <div><span className="violet">5</span><small>Aprovações</small></div>
              <div><span className="green">8</span><small>Agendados</small></div>
            </div>
            <div className="login-preview-activity">
              <header><strong>Atividade recente</strong><small>AO VIVO</small></header>
              <div><i className="violet" /><span><b>Conteúdo aprovado</b><small>Novo Cliente · agora</small></span><em>✓</em></div>
              <div><i className="blue" /><span><b>Nova pauta adicionada</b><small>Equipe criativa · 8 min</small></span><em>→</em></div>
              <div><i className="orange" /><span><b>Alteração solicitada</b><small>Campanha de agosto · 14 min</small></span><em>↗</em></div>
            </div>
          </div>
          <div className="login-showcase-status"><span><i /> Sistema operacional</span><small>Design Hub 2.0</small></div>
        </aside>
      </section>
    </main>
  );
}

function PasswordResetPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get("token")?.trim() ?? "", [location.search]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("Este link não contém um código de recuperação válido.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await completePasswordResetWithApi(token, newPassword);
      setCompleted(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Não foi possível criar a nova senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="center-shell password-reset-shell">
    <section className="glass password-reset-card">
      <div className="login-brand-mark" aria-label="Design Hub V2"><img src={designHubV2Logo} alt="Logo Design Hub V2" /></div>
      <div className="login-kicker"><span className="login-live-dot" />DESIGN HUB · ACESSO SEGURO</div>
      {completed ? <>
        <h1>Senha criada com sucesso.</h1>
        <p className="hero-copy">Seu link já foi invalidado. Agora você pode entrar usando a nova senha.</p>
        <button className="gradient-button login-submit" type="button" onClick={() => navigate("/login", { replace: true })}>Ir para o login <span aria-hidden="true">→</span></button>
      </> : <>
        <h1>Crie sua nova senha.</h1>
        <p className="hero-copy">Use pelo menos 8 caracteres. Depois de salvar, este link não poderá ser usado novamente.</p>
        <form className="login-form" autoComplete="on" onSubmit={submit}>
          <label className="field-stack" htmlFor="reset-new-password"><span>Nova senha</span><input id="reset-new-password" name="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus /></label>
          <label className="field-stack" htmlFor="reset-confirm-password"><span>Confirme a nova senha</span><input id="reset-confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button className="gradient-button login-submit" type="submit" disabled={submitting}>{submitting ? "Salvando..." : <>Salvar nova senha <span aria-hidden="true">→</span></>}</button>
          {error ? <p className="form-feedback error-text" role="alert">{error}</p> : null}
        </form>
      </>}
    </section>
  </main>;
}

const INTERNAL_AREAS: Record<string, { title: string; description: string; restricted?: boolean }> = {
  relatorios: { title: "Relatórios", description: "Acompanhe os indicadores e resultados dos seus projetos." },
  faturamento: { title: "Faturamento", description: "Organize os lançamentos e cobranças da operação.", restricted: true },
  propostas: { title: "Propostas", description: "Centralize propostas comerciais em andamento.", restricted: true },
  contratos: { title: "Contratos", description: "Guarde e acompanhe os contratos da operação.", restricted: true },
  "controle-de-tempo": { title: "Controle de tempo", description: "Registre as horas investidas em cada cliente e tarefa." },
  "datas-comemorativas": { title: "Datas comemorativas", description: "Planeje campanhas e oportunidades importantes." },
  "briefs-design": { title: "Briefs de design", description: "Organize as referências e direcionamentos criativos." },
  "calendario-social": { title: "Calendário social", description: "Visualize o planejamento de conteúdo nas redes sociais." },
  equipe: { title: "Equipe", description: "Acompanhe as pessoas e responsabilidades do seu time." },
};

function AboutWorkspace({ compact = false, titleId }: { compact?: boolean; titleId?: string }) {
  const year = new Date().getFullYear();
  return <section className={`about-workspace glass${compact ? " compact" : ""}`}>
    <div className="about-workspace-mark"><img src={designHubV2Logo} alt="Design Hub" /></div>
    <div className="about-workspace-copy">
      <p className="eyebrow">DESIGN HUB</p>
      <h2 id={titleId}>Seu espaço de criação e gestão</h2>
      <p>Um ambiente pensado para organizar clientes, conteúdo, aprovações e toda a rotina criativa em um só lugar.</p>
      <div className="about-workspace-meta">
        <article><span>Versão do programa</span><strong>v{webPackage.version}</strong></article>
        <article><span>Ano</span><strong>{year}</strong></article>
      </div>
      <small>© {year} Design Hub. Todos os direitos reservados.</small>
    </div>
  </section>;
}

type DesignBriefFieldType = "short" | "long" | "choice" | "checklist" | "link" | "file";
type DesignBriefField = DesignBriefFieldRecord;
type DesignBriefDraft = Pick<DesignBriefRecord, "id" | "title" | "introduction" | "fields">;
type DesignBriefTemplate = DesignBriefTemplateRecord;

const DESIGN_BRIEF_RECOVERY_KEY = "designhub-v2-design-brief-current-draft";
const DESIGN_BRIEF_FIELD_LIBRARY: Array<{ type: DesignBriefFieldType; icon: string; label: string; defaultLabel: string }> = [
  { type: "short", icon: "T", label: "Resposta curta", defaultLabel: "Nome ou informação curta" },
  { type: "long", icon: "≡", label: "Texto longo", defaultLabel: "Conte um pouco mais" },
  { type: "choice", icon: "○", label: "Escolha única", defaultLabel: "Escolha uma opção" },
  { type: "checklist", icon: "✓", label: "Checklist", defaultLabel: "Selecione as opções" },
  { type: "link", icon: "↗", label: "Link", defaultLabel: "Link de referência" },
  { type: "file", icon: "↑", label: "Anexo", defaultLabel: "Envie seus arquivos" },
];

function createDesignBriefId() {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `brief-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeDesignBriefField(type: DesignBriefFieldType, label?: string, help = ""): DesignBriefField {
  return { id: createDesignBriefId(), type, label: label ?? DESIGN_BRIEF_FIELD_LIBRARY.find((item) => item.type === type)?.defaultLabel ?? "Novo campo", help, required: false, options: type === "choice" || type === "checklist" ? ["Opção 1", "Opção 2"] : [] };
}

function cloneDesignBriefFields(fields: DesignBriefField[]) {
  return fields.map((field) => ({ ...field, id: createDesignBriefId(), options: [...field.options] }));
}

function DesignBriefClientPaper({ title, introduction, fields, answers = {}, interactive = false, selectedFieldId, onSelectField }: { title: string; introduction: string; fields: DesignBriefField[]; answers?: Record<string, unknown>; interactive?: boolean; selectedFieldId?: string | null; onSelectField?: (id: string) => void }) {
  return <article className={`design-brief-paper${interactive ? " interactive" : ""}`}>
    <header><span className="design-brief-paper-logo"><UiIcon name="brush" /></span><div><small>BRIEF DE DESIGN</small><strong>Design Hub</strong></div></header>
    <section className="design-brief-paper-intro"><p>FORMULÁRIO CRIATIVO</p><h1>{title.trim() || "Título do seu brief"}</h1><span>{introduction.trim() || "Preencha as informações abaixo para que possamos transformar sua ideia em um projeto visual claro e consistente."}</span></section>
    <div className="design-brief-paper-fields">{fields.length ? fields.map((field, index) => <button type="button" key={field.id} className={`design-brief-paper-field${selectedFieldId === field.id ? " selected" : ""}`} onClick={() => onSelectField?.(field.id)} disabled={!interactive}>
      <span className="design-brief-field-number">{String(index + 1).padStart(2, "0")}</span>
      <div><label>{field.label || "Campo sem título"}{field.required ? <b> *</b> : null}</label>{field.help ? <small>{field.help}</small> : null}
        {Object.prototype.hasOwnProperty.call(answers, field.id) ? <span className={`design-brief-answer filled${field.type === "long" ? " long" : ""}`}>{Array.isArray(answers[field.id]) ? (answers[field.id] as unknown[]).join(", ") : typeof answers[field.id] === "boolean" ? (answers[field.id] ? "Sim" : "Não") : String(answers[field.id] ?? "")}</span> : field.type === "long" ? <span className="design-brief-answer long" /> : field.type === "choice" || field.type === "checklist" ? <span className="design-brief-options">{field.options.filter(Boolean).map((option) => <i key={option}><em>{field.type === "choice" ? "○" : "□"}</em>{option}</i>)}</span> : field.type === "file" ? <span className="design-brief-upload"><UiIcon name="download" />Clique ou arraste seus arquivos</span> : <span className="design-brief-answer">{field.type === "link" ? "https://" : "Sua resposta"}</span>}
      </div>
    </button>) : <div className="design-brief-paper-empty"><UiIcon name="plus" /><strong>Adicione o primeiro campo</strong><span>Use o painel ao lado para montar este brief.</span></div>}</div>
    <footer><span>DESIGN HUB · DIRECIONAMENTO CRIATIVO</span><b>{fields.length} {fields.length === 1 ? "pergunta" : "perguntas"}</b></footer>
  </article>;
}

function DesignBriefsWorkspace() {
  const recoveredDraft = useMemo(() => readRecoveryDraft<Partial<DesignBriefDraft> & { objective?: string; references?: string }>(DESIGN_BRIEF_RECOVERY_KEY), []);
  const migratedFields = useMemo(() => recoveredDraft?.fields?.length ? recoveredDraft.fields : [
    ...(recoveredDraft?.objective ? [makeDesignBriefField("long", "Objetivo", recoveredDraft.objective)] : []),
    ...(recoveredDraft?.references ? [makeDesignBriefField("long", "Referências e direcionamento", recoveredDraft.references)] : []),
  ], [recoveredDraft]);
  const [briefId, setBriefId] = useState(() => recoveredDraft?.id ?? createDesignBriefId());
  const [title, setTitle] = useState(recoveredDraft?.title ?? "");
  const [introduction, setIntroduction] = useState(recoveredDraft?.introduction ?? "");
  const [fields, setFields] = useState<DesignBriefField[]>(migratedFields);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [category, setCategory] = useState("custom");
  const [locale, setLocale] = useState<DesignBriefRecord["locale"]>("pt");
  const [briefs, setBriefs] = useState<DesignBriefRecord[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(migratedFields[0]?.id ?? null);
  const [templates, setTemplates] = useState<DesignBriefTemplate[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saved, setSaved] = useState(false);
  const [draftState, setDraftState] = useState<AutosaveState>(recoveredDraft ? "recovered" : "idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const committedDraftRef = useRef("");
  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;

  useEffect(() => {
    void Promise.all([listAdminDesignBriefs(), listAdminDesignBriefTemplates()])
      .then(([briefResult, templateResult]) => { setBriefs(briefResult.items); setTemplates(templateResult.items); })
      .catch(() => setDraftState("error"));
  }, []);

  useEffect(() => {
    const draft = { id: briefId, title, introduction, fields, updatedAt: new Date().toISOString() };
    const draftJson = JSON.stringify(draft);
    if (draftJson === committedDraftRef.current || (!title && !introduction && fields.length === 0)) return;
    setDraftState((current) => current === "recovered" ? current : "pending");
    const timeout = window.setTimeout(() => {
      try { window.localStorage.setItem(DESIGN_BRIEF_RECOVERY_KEY, draftJson); setDraftSavedAt(new Date()); setDraftState("saved"); }
      catch { setDraftState("error"); }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [briefId, fields, introduction, title]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPreviewOpen(false);
      setTemplateModalOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const markChanged = () => setSaved(false);
  const addField = (type: DesignBriefFieldType) => { const field = makeDesignBriefField(type); setFields((current) => [...current, field]); setSelectedFieldId(field.id); markChanged(); };
  const updateSelectedField = (patch: Partial<DesignBriefField>) => { if (!selectedFieldId) return; setFields((current) => current.map((field) => field.id === selectedFieldId ? { ...field, ...patch } : field)); markChanged(); };
  const removeSelectedField = () => { if (!selectedFieldId) return; const next = fields.filter((field) => field.id !== selectedFieldId); setFields(next); setSelectedFieldId(next[0]?.id ?? null); markChanged(); };
  const saveBrief = async () => {
    if (!title.trim()) return;
    setDraftState("saving");
    try {
      const payload = { clientAccountId: null, title: title.trim(), introduction: introduction.trim(), category, locale, status: "completed" as const, fields, answers };
      const existing = briefs.some((item) => item.id === briefId);
      const record = existing ? (await updateAdminDesignBrief(briefId, payload)).brief : (await createAdminDesignBrief(payload)).brief;
      setBriefId(record.id); setBriefs((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      committedDraftRef.current = JSON.stringify({ id: record.id, title: record.title, introduction: record.introduction, fields: record.fields, updatedAt: record.updatedAt });
      window.localStorage.removeItem(DESIGN_BRIEF_RECOVERY_KEY); setDraftSavedAt(new Date()); setDraftState("saved"); setSaved(true);
    } catch { setDraftState("error"); }
  };
  const clearBrief = async () => {
    if ((title || introduction || fields.length) && !window.confirm("Excluir este brief e começar uma folha vazia?")) return;
    if (briefs.some((item) => item.id === briefId)) {
      try { await deleteAdminDesignBrief(briefId); setBriefs((current) => current.filter((item) => item.id !== briefId)); }
      catch { setDraftState("error"); return; }
    }
    setBriefId(createDesignBriefId()); setTitle(""); setIntroduction(""); setFields([]); setAnswers({}); setCategory("custom"); setLocale("pt"); setSelectedFieldId(null); setSaved(false); setDraftState("idle"); setDraftSavedAt(null); committedDraftRef.current = ""; window.localStorage.removeItem(DESIGN_BRIEF_RECOVERY_KEY);
  };
  const saveTemplate = async () => {
    if (!templateName.trim() || fields.length === 0) return;
    try { const { template } = await createAdminDesignBriefTemplate({ name: templateName.trim(), introduction: introduction.trim(), fields: cloneDesignBriefFields(fields) }); setTemplates((current) => [template, ...current]); setTemplateName(""); setTemplateModalOpen(false); }
    catch { setDraftState("error"); }
  };
  const applyTemplate = (template: DesignBriefTemplate) => {
    const nextFields = cloneDesignBriefFields(template.fields); setBriefId(createDesignBriefId()); setTitle(template.name); setIntroduction(template.introduction); setFields(nextFields); setAnswers({}); setCategory("custom"); setLocale("pt"); setSelectedFieldId(nextFields[0]?.id ?? null); setSaved(false);
  };
  const deleteTemplate = async (id: string) => {
    if (!window.confirm("Excluir este template da biblioteca?")) return;
    try { await deleteAdminDesignBriefTemplate(id); setTemplates((current) => current.filter((template) => template.id !== id)); }
    catch { setDraftState("error"); }
  };
  const openBrief = (brief: DesignBriefRecord) => {
    setBriefId(brief.id); setTitle(brief.title); setIntroduction(brief.introduction); setFields(brief.fields); setAnswers(brief.answers); setCategory(brief.category); setLocale(brief.locale); setSelectedFieldId(brief.fields[0]?.id ?? null); setSaved(true); setDraftState("saved"); setDraftSavedAt(new Date(brief.updatedAt));
  };

  return <section className="design-brief-builder">
    <header className="design-brief-builder-toolbar"><div><p className="eyebrow">EDITOR DE BRIEF</p><h2>Monte o formulário do cliente</h2><AutosaveIndicator state={draftState} savedAt={draftSavedAt} savedLabel="Rascunho protegido" /></div><div><button className="ghost-button" onClick={() => setPreviewOpen(true)}><UiIcon name="eye" />Prévia</button><button className="design-brief-delete-button" onClick={clearBrief}><UiIcon name="trash" />Excluir</button><button className="ghost-button" disabled={fields.length === 0} onClick={() => { setTemplateName(title.trim() || "Novo modelo de brief"); setTemplateModalOpen(true); }}><UiIcon name="copy" />Salvar como template</button><button className="gradient-button" disabled={!title.trim()} onClick={saveBrief}>{saved ? "✓ Brief salvo" : "Salvar brief"}</button></div></header>
    <div className="design-brief-builder-grid">
      <aside className="design-brief-field-palette glass"><header><span>CAMPOS</span><h3>Adicionar à folha</h3><p>Clique em um tipo para incluir uma nova pergunta.</p></header><div>{DESIGN_BRIEF_FIELD_LIBRARY.map((item) => <button key={item.type} onClick={() => addField(item.type)}><b>{item.icon}</b><span>{item.label}</span><UiIcon name="plus" /></button>)}</div><section className="design-brief-document-settings"><span>DOCUMENTO</span><label>Título<input value={title} onChange={(event) => { setTitle(event.target.value); markChanged(); }} placeholder="Ex.: Identidade visual" /></label><label>Introdução<textarea value={introduction} onChange={(event) => { setIntroduction(event.target.value); markChanged(); }} placeholder="Uma breve orientação para o cliente..." /></label></section></aside>
      <main className="design-brief-canvas"><div className="design-brief-canvas-label"><span>PRÉVIA AO VIVO</span><small>Como o cliente receberá o brief</small></div><DesignBriefClientPaper title={title} introduction={introduction} fields={fields} answers={answers} interactive selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId} /></main>
      <aside className="design-brief-inspector glass"><header><span>PROPRIEDADES</span><h3>{selectedField ? "Editar campo" : "Selecione um campo"}</h3></header>{selectedField ? <div className="design-brief-inspector-form"><label>Pergunta<input value={selectedField.label} onChange={(event) => updateSelectedField({ label: event.target.value })} /></label><label>Texto de ajuda<textarea value={selectedField.help} onChange={(event) => updateSelectedField({ help: event.target.value })} placeholder="Explique o que precisa ser informado" /></label>{selectedField.type === "choice" || selectedField.type === "checklist" ? <label>Opções<textarea value={selectedField.options.join("\n")} onChange={(event) => updateSelectedField({ options: event.target.value.split("\n") })} placeholder={"Uma opção por linha"} /></label> : null}<label className="design-brief-required"><input type="checkbox" checked={selectedField.required} onChange={(event) => updateSelectedField({ required: event.target.checked })} /><span>Resposta obrigatória</span></label><button className="design-brief-remove-field" onClick={removeSelectedField}><UiIcon name="trash" />Remover este campo</button></div> : <p className="design-brief-inspector-empty">Clique em uma pergunta na folha para editar seus detalhes.</p>}<section className="design-brief-template-library design-brief-saved-library"><header><div><span>HISTÓRICO</span><h3>Briefs salvos</h3></div><b>{briefs.length}</b></header>{briefs.length ? <div>{briefs.map((brief) => <article key={brief.id}><button className={brief.id === briefId ? "active" : ""} onClick={() => openBrief(brief)}><strong>{brief.title}</strong><small>{brief.fields.length} campos · {new Date(brief.updatedAt).toLocaleDateString("pt-BR")}</small></button></article>)}</div> : <p>Os briefs salvos aparecerão aqui.</p>}</section><section className="design-brief-template-library"><header><div><span>BIBLIOTECA</span><h3>Templates</h3></div><b>{templates.length}</b></header>{templates.length ? <div>{templates.map((template) => <article key={template.id}><button onClick={() => applyTemplate(template)}><strong>{template.name}</strong><small>{template.fields.length} campos</small></button><button aria-label={`Excluir template ${template.name}`} title="Excluir template" onClick={() => void deleteTemplate(template.id)}>×</button></article>)}</div> : <p>Seus modelos reutilizáveis aparecerão aqui.</p>}</section></aside>
    </div>
    {previewOpen ? createPortal(<div className="modal-backdrop design-brief-preview-backdrop" onClick={() => setPreviewOpen(false)}><section className="design-brief-preview-modal" onClick={(event) => event.stopPropagation()}><header><div><span>PRÉVIA PARA O CLIENTE</span><h2>Como o brief será recebido</h2></div><button className="icon-close" aria-label="Fechar prévia" onClick={() => setPreviewOpen(false)}>×</button></header><div><DesignBriefClientPaper title={title} introduction={introduction} fields={fields} answers={answers} /></div><footer><button className="gradient-button" onClick={() => setPreviewOpen(false)}>Voltar para edição</button></footer></section></div>, document.body) : null}
    {templateModalOpen ? createPortal(<div className="modal-backdrop" onClick={() => setTemplateModalOpen(false)}><section className="design-brief-template-modal" onClick={(event) => event.stopPropagation()}><header><div><span>NOVO TEMPLATE</span><h2>Salvar na biblioteca</h2><p>Todos os campos desta folha poderão ser reutilizados.</p></div><button className="icon-close" aria-label="Fechar template" onClick={() => setTemplateModalOpen(false)}>×</button></header><label>Nome do template<input autoFocus value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ex.: Brief para identidade visual" /></label><footer><button className="ghost-button" onClick={() => setTemplateModalOpen(false)}>Cancelar</button><button className="gradient-button" disabled={!templateName.trim()} onClick={saveTemplate}>Salvar template</button></footer></section></div>, document.body) : null}
  </section>;
}

function ClientPortalCalendarView({ cards, appointments, onSelectCard }: { cards: BoardCard[]; appointments: AgendaEvent[]; onSelectCard: (id: string) => void }) {
  const { t, localeTag } = usePortalTranslation();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const artworkHover = useCalendarArtworkHover();

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(gridStart); day.setDate(day.getDate() + index); return day; });

  const rangeFrom = localDateKey(days[0]);
  const rangeTo = localDateKey(days[days.length - 1]);
  const expandedAppointments = useMemo(() => expandAgendaEvents(appointments, rangeFrom, rangeTo), [appointments, rangeFrom, rangeTo]);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag, { weekday: "short" }).format(new Date(2026, 7, 24 + index)));
  const postCalendarDate = (card: BoardCard) => new Date(card.scheduledAt || card.publishedAt || 0);
  const isPublishedPost = (card: BoardCard) => Boolean(card.publishedAt);

  const postsByDay = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const card of cards) {
      const calendarDate = postCalendarDate(card);
      if (Number.isNaN(calendarDate.getTime()) || calendarDate.getTime() === 0) continue;
      const key = localDateKey(calendarDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [cards]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const event of expandedAppointments) {
      const key = localDateKey(new Date(event.startsAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [expandedAppointments]);

  const mobileDays = days.filter((day) => {
    if (day.getMonth() !== monthDate.getMonth() || day.getFullYear() !== monthDate.getFullYear()) return false;
    const key = localDateKey(day);
    return (postsByDay.get(key)?.length ?? 0) + (eventsByDay.get(key)?.length ?? 0) > 0;
  });

  return (
    <div className="social-calendar-workspace glass-subtle">
      <div className="social-calendar-toolbar">
        <div className="social-calendar-month-nav">
          <button type="button" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} aria-label={t("Mês anterior")}>‹</button>
          <h2>{new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(monthDate)}</h2>
          <button type="button" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} aria-label={t("Próximo mês")}>›</button>
        </div>
        <div className="social-calendar-summary">
          <span><i className="scheduled" />{t("Posts agendados")}</span>
          <span><i className="published" />{t("Posts publicados")}</span>
          <span><i style={{ background: "#8b45dd" }} />{t("Compromissos")}</span>
        </div>
      </div>
      <div className="social-calendar-desktop portal-calendar-desktop">
        <div className="social-calendar-weekdays">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div>
        <div className="social-calendar-grid">
          {days.map((day) => {
            const key = localDateKey(day);
            const posts = postsByDay.get(key) ?? [];
            const events = eventsByDay.get(key) ?? [];
            const muted = day.getMonth() !== monthDate.getMonth();
            const visiblePosts = posts.slice(0, 2);
            const visibleEvents = events.slice(0, 2 - visiblePosts.length < 0 ? 0 : 2 - visiblePosts.length);
            const hiddenCount = posts.length + events.length - visiblePosts.length - visibleEvents.length;
            return (
              <div key={key} className={muted ? "social-calendar-day muted" : "social-calendar-day"}>
                <time>{day.getDate()}</time>
                {visiblePosts.map((card) => (
                  <button key={card.id} type="button" className={`social-calendar-event${isPublishedPost(card) ? " published" : ""}${card.calendarOnly ? " calendar-only" : ""}`} style={{ "--calendar-event-color": isPublishedPost(card) ? "#26ad78" : "#3c8ee9" } as CSSProperties} onMouseEnter={(event) => artworkHover.show(event, portalCardAssets(card)[0] ?? "", card.title)} onMouseMove={(event) => artworkHover.move(event, portalCardAssets(card)[0] ?? "", card.title)} onMouseLeave={artworkHover.hide} onClick={() => { if (!card.calendarOnly) onSelectCard(card.id); }}>
                    <span>{card.title}</span>
                    {isPublishedPost(card) ? <small>✓ {t("Publicado")}</small> : null}
                  </button>
                ))}
                {visibleEvents.map((event) => (
                  <button key={event.id} type="button" className="social-calendar-event" style={{ "--calendar-event-color": event.color || "#8b45dd" } as CSSProperties} onClick={() => setSelectedEvent(event)}>
                    <span>{event.meetLink ? "🎥 " : ""}{event.title}</span>
                    <small>{new Intl.DateTimeFormat(localeTag, { timeStyle: "short" }).format(new Date(event.startsAt))}</small>
                  </button>
                ))}
                {hiddenCount > 0 ? <span className="social-calendar-more">+{hiddenCount}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="social-calendar-mobile portal-calendar-mobile">
        {mobileDays.length ? mobileDays.map((day) => {
          const key = localDateKey(day);
          const posts = postsByDay.get(key) ?? [];
          const events = eventsByDay.get(key) ?? [];
          const isToday = key === localDateKey(new Date());
          return <article className={`social-agenda-day${isToday ? " today" : ""}`} key={key}>
            <header><div><time>{day.getDate()}</time><span><strong>{new Intl.DateTimeFormat(localeTag, { weekday: "long" }).format(day)}</strong><small>{new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(day)}</small></span></div></header>
            <div className="social-agenda-items">
              {posts.map((card) => { const imageUrl = portalCardAssets(card)[0] ?? ""; const calendarDate = postCalendarDate(card); const published = isPublishedPost(card); return <button key={card.id} type="button" className={`social-agenda-item post${published ? " published" : ""}${card.calendarOnly ? " calendar-only" : ""}`} onClick={() => { if (!card.calendarOnly) onSelectCard(card.id); }}><span className="social-agenda-time">{new Intl.DateTimeFormat(localeTag, { timeStyle: "short" }).format(calendarDate)}</span>{imageUrl ? <img src={imageUrl} alt="" /> : <i><UiIcon name={published ? "check" : "send"} /></i>}<span><strong>{card.title}</strong><small>{t(published ? "Publicado" : "Post agendado")}</small></span>{card.calendarOnly ? null : <b>›</b>}</button>; })}
              {events.map((event) => <button key={event.id} type="button" className="social-agenda-item appointment" style={{ "--calendar-event-color": event.color || "#8b45dd" } as CSSProperties} onClick={() => setSelectedEvent(event)}><span className="social-agenda-time">{new Intl.DateTimeFormat(localeTag, { timeStyle: "short" }).format(new Date(event.startsAt))}</span><i><UiIcon name={event.meetLink ? "link" : "clock"} /></i><span><strong>{event.title}</strong><small>{event.taskDescription || event.labelName || t("Compromisso")}</small></span><b>›</b></button>)}
            </div>
          </article>;
        }) : <div className="social-agenda-year-empty portal-calendar-empty"><UiIcon name="calendar" /><strong>{t("Nenhum item agendado neste mês.")}</strong><small>{t("Use as setas acima para consultar outro mês.")}</small></div>}
      </div>
      {selectedEvent ? (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <section className="agenda-detail-modal portal-agenda-detail-modal" onClick={(event) => event.stopPropagation()}>
            <header><div><p className="eyebrow">{t("Compromisso")}</p><h3>{selectedEvent.title}</h3></div><button className="icon-close" onClick={() => setSelectedEvent(null)} aria-label={t("Fechar")}>×</button></header>
            <p>{selectedEvent.taskDescription || t("Sem detalhes adicionais.")}</p>
            <dl><div><dt>{t("Quando")}</dt><dd>{new Intl.DateTimeFormat(localeTag, { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedEvent.startsAt))}</dd></div></dl>
            {selectedEvent.meetLink ? <div className="portal-meet-card"><span><UiIcon name="link" /></span><div><small>{t("VIDEOCHAMADA")}</small><strong>Google Meet</strong><p>{t("O link será aberto em uma nova aba.")}</p></div><a href={selectedEvent.meetLink} target="_blank" rel="noreferrer">{t("Entrar na reunião")} <UiIcon name="link" /></a></div> : null}
          </section>
        </div>
      ) : null}
      {artworkHover.preview}
    </div>
  );
}

function ClientKanbanCalendar({ slug }: { slug: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [posts, setPosts] = useState<CalendarEvent[]>([]);
  const [manualEvents, setManualEvents] = useState<AgendaEvent[]>([]);
  const [clientAccountId, setClientAccountId] = useState("");
  const [eventDay, setEventDay] = useState<Date | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventColor, setEventColor] = useState("#7c6cf2");
  const [savingEvent, setSavingEvent] = useState(false);
  const artworkHover = useCalendarArtworkHover();
  const range = agendaViewRange(month, "month");
  const refresh = () => { const from = range.from.slice(0, 10); const to = range.to.slice(0, 10); return Promise.all([loadAdminClientCalendarBySlug(slug, from, to), loadAgendaEvents(from, to)]).then(([calendar, agenda]) => { setClientAccountId(calendar.clientAccountId); setPosts(calendar.events); setManualEvents(agenda.items.filter((item) => item.clientAccountId === calendar.clientAccountId)); }).catch(() => { setPosts([]); setManualEvents([]); }); };
  useEffect(() => { void refresh(); }, [slug, range.from, range.to]);
  const eventsByDay = new Map<string, Array<{ id: string; title: string; type: "post" | "manual"; color?: string; imageUrl?: string }>>();
  posts.forEach((post) => { const key = post.publishDate.slice(0, 10); eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), { id: post.id, title: post.title, type: "post", color: post.color, imageUrl: post.mediaUrls?.[0] }]); });
  const uniqueManualEvents = manualEvents.filter((event, index, items) => items.findIndex((item) => item.title === event.title && localDateKey(new Date(item.startsAt)) === localDateKey(new Date(event.startsAt))) === index);
  uniqueManualEvents.forEach((event) => { const key = localDateKey(new Date(event.startsAt)); eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), { id: event.id, title: event.title, type: "manual", color: event.color }]); });
  const columnLegend = Array.from(new Map(posts.filter((post) => post.columnName).map((post) => [post.columnName as string, post.color ?? "#8278ef"])).entries());
  const saveManualEvent = async () => { if (savingEvent || !eventDay || !eventTitle.trim() || !clientAccountId) return; setSavingEvent(true); try { await createAgendaEvent({ title: eventTitle.trim(), startsAt: `${localDateKey(eventDay)}T09:00`, color: eventColor, clientAccountId }); setEventDay(null); setEventTitle(""); await refresh(); } finally { setSavingEvent(false); } };
  return <section className="client-kanban-calendar"><header><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>‹</button><h2>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month)}</h2><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>›</button></header>{columnLegend.length ? <div className="client-calendar-column-legend">{columnLegend.map(([name, color]) => <span key={name}><i style={{ backgroundColor: color }} />{name}</span>)}</div> : null}<div className="client-calendar-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div><div className="client-calendar-grid">{range.days.map((day) => { const key = localDateKey(day); const events = eventsByDay.get(key) ?? []; return <button key={key} className={day.getMonth() === month.getMonth() ? "client-calendar-day" : "client-calendar-day muted"} onClick={() => setEventDay(day)}><strong>{day.getDate()}</strong>{events.map((event) => <span key={event.id} className={event.type} style={{ backgroundColor: event.color, color: calendarTextColor(event.color) }} onMouseEnter={(mouseEvent) => event.imageUrl ? artworkHover.show(mouseEvent, event.imageUrl, event.title) : undefined} onMouseMove={(mouseEvent) => event.imageUrl ? artworkHover.move(mouseEvent, event.imageUrl, event.title) : undefined} onMouseLeave={artworkHover.hide}><b>{event.type === "post" ? "▧ Post" : "◷ Agenda"}</b><em>{event.title}</em></span>)}</button>; })}</div><p><i /> <strong>Post</strong> — conteúdo programado <i className="manual" /> <strong>Agenda</strong> — compromisso do cliente. Clique em um dia para adicionar um compromisso.</p>{eventDay ? <div className="modal-backdrop agenda-modal-backdrop" onClick={() => setEventDay(null)}><section className="client-calendar-event-modal" onClick={(event) => event.stopPropagation()}><h3>Novo evento</h3><p>{eventDay.toLocaleDateString("pt-BR", { dateStyle: "full" })}</p><input autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Nome do evento" /><label>Cor <input type="color" value={eventColor} onChange={(event) => setEventColor(event.target.value)} /></label><button className="gradient-button" disabled={savingEvent} onClick={() => void saveManualEvent()}>{savingEvent ? "Adicionando..." : "Adicionar evento"}</button></section></div> : null}{artworkHover.preview}</section>;
}

function calendarTextColor(color?: string) {
  const value = color?.trim() ?? "";
  let channels: [number, number, number] | null = null;
  const hex = value.replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    channels = [0, 1, 2].map((index) => Number.parseInt(hex[index] + hex[index], 16)) as [number, number, number];
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((part) => Number.parseInt(part, 16)) as [number, number, number];
  } else {
    const rgb = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (rgb) channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  if (!channels) return "#17213d";
  const [red, green, blue] = channels.map((channel) => Math.max(0, Math.min(255, channel))) as [number, number, number];
  const perceivedBrightness = Math.sqrt((0.299 * red ** 2) + (0.587 * green ** 2) + (0.114 * blue ** 2));
  return perceivedBrightness >= 155 ? "#111827" : "#ffffff";
}

function KanbanActivities({ slug }: { slug: string }) {
  const [items, setItems] = useState<KanbanActivity[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { loadAdminKanbanActivitiesBySlug(slug).then((result) => setItems(result.items)).catch(() => setError("Não foi possível carregar as atividades.")); }, [slug]);
  return <section className="kanban-activities"><header><div><h2>Atividades</h2><p>Histórico deste Kanban, mantido por 15 dias.</p></div><span>{items.length}</span></header>{error ? <p className="form-feedback error-text">{error}</p> : null}{items.length ? <div>{items.map((item) => <article key={item.id}><i className={item.type}>{item.type === "approval" ? "✓" : "•"}</i><div><strong>{item.detail}</strong><p>{item.title}</p></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.occurredAt))}</time></article>)}</div> : <p className="kanban-activities-empty">Ainda não há atividades nos últimos 15 dias.</p>}</section>;
}

const EMPTY_BRAND_BRAIN: BrandBrain = { mission: "", vision: "", positioning: "", brandPromise: "", audience: "", audiencePains: [], audienceDesires: [], voice: "", personalityTraits: [], voiceExamples: [], voiceAvoidExamples: [], visualNotes: "", typographyDisplay: "", typographyBody: "", typographyAccent: "", typographySample: "A identidade ganha voz quando cada detalhe fala a mesma língua.", approvedWords: [], avoidWords: [], expressions: [], colors: ["#5b5ce2", "#18b98b", "#f5a41a"], differentiators: [], proofPoints: [], references: [], pillars: [] };
function PautasWorkspace({ slug, clientName, columns, onSent, onCountChange }: { slug: string; clientName: string; columns: BoardColumn[]; onSent: () => void; onCountChange?: (count: number) => void }) {
  const [ideas, setIdeas] = useState<PautaIdea[]>([]); const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"all" | "draft" | "sent" | "approved">("all"); const [sending, setSending] = useState<string | null>(null);
  const [pautaCards, setPautaCards] = useState<BoardCard[]>([]);
  const [editing, setEditing] = useState<PautaIdea | null>(null); const [brainOpen, setBrainOpen] = useState(false); const [brain, setBrain] = useState<BrandBrain>(EMPTY_BRAND_BRAIN);
  const save = (next: PautaIdea[]) => {
    setIdeas(next);
    void loadAdminWorkspaceDrawerBySlug(slug).then((result) => {
      const saved = result.data as Partial<WorkspaceDrawerData> | null;
      return saveAdminWorkspaceDrawerBySlug(slug, { ...EMPTY_DRAWER, ...saved, pautaIdeas: next });
    }).catch(() => undefined);
  };
  useEffect(() => { loadAdminWorkspaceDrawerBySlug(slug).then((result) => { const data = result.data as Partial<WorkspaceDrawerData> | null; setIdeas(data?.pautaIdeas ?? []); }).catch(() => setIdeas([])); }, [slug]);
  useEffect(() => {
    let active = true;
    const refreshPautaCards = () => { void loadAdminWorkspaceBySlug(slug, { archived: false }).then((workspace) => { if (active) setPautaCards([...workspace.columns.flatMap((column) => column.cards), ...workspace.withoutColumn]); }).catch(() => undefined); };
    refreshPautaCards();
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    if (!pautaCards.length || !ideas.length) return;
    let changed = false;
    const next = ideas.map((idea) => {
      if ((idea.status ?? "draft") === "draft") return idea;
      const linkedCard = idea.cardId
        ? pautaCards.find((card) => card.id === idea.cardId)
        : pautaCards.find((card) => card.title === idea.title && (card.isBriefApproval || /aprovad/i.test(`${card.clientLabel} ${card.statusBadges.join(" ")}`)));
      if (!linkedCard) return idea;
      const approved = /aprovad/i.test(`${linkedCard.clientLabel} ${linkedCard.statusBadges.join(" ")}`);
      const status = approved ? "approved" as const : idea.status;
      if (idea.cardId === linkedCard.id && idea.status === status) return idea;
      changed = true;
      return { ...idea, cardId: linkedCard.id, status };
    });
    if (changed) save(next);
  }, [pautaCards, ideas]);
  useEffect(() => { onCountChange?.(ideas.length); }, [ideas.length, onCountChange]);
  useEffect(() => { loadBrandBrainBySlug(slug).then((result) => setBrain({ ...EMPTY_BRAND_BRAIN, ...(result.data ?? {}) })).catch(() => setBrain(EMPTY_BRAND_BRAIN)); }, [slug]);
  const visible = ideas.filter((idea) => (filter === "all" || (idea.status ?? "draft") === filter) && idea.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const send = async (idea: PautaIdea) => { const columnId = columns.find((column) => column.name.toLocaleLowerCase() === "pauta")?.id ?? columns[0]?.id ?? null; setSending(idea.id); try { const result = await createAdminCardBySlug(slug, { columnId, title: idea.title, caption: idea.caption || idea.description || null, primaryMediaUrl: null, externalLinkUrl: null, artType: "Post", status: ["Enviar para Cliente"], tags: [], clientLabel: "Pauta para aprovação", isBriefApproval: true }); save(ideas.map((item) => item.id === idea.id ? { ...item, status: "sent", cardId: result.card.id } : item)); onSent(); } finally { setSending(null); } };
  const saveEdit = () => { if (!editing?.title.trim()) return; save(ideas.map((idea) => idea.id === editing.id ? editing : idea)); setEditing(null); };
  const deleteIdea = (id: string) => { if (window.confirm("Excluir esta pauta?")) save(ideas.filter((idea) => idea.id !== id)); };
  const pautaTypeLabel = (value?: string) => ({ post: "Post", reels: "Reels", story: "Story", carousel: "Carrossel", article: "Artigo", video: "Vídeo", other: "Outro" }[value ?? "post"] ?? value ?? "Post");
  const text = `${editing?.title ?? ""} ${editing?.description ?? ""} ${editing?.caption ?? ""}`.toLocaleLowerCase(); const avoidHits = brain.avoidWords.filter((word) => text.includes(word.toLocaleLowerCase()));
  return <section className="pautas-workspace"><header><span>Banco interno</span><h2>Pautas de {clientName}</h2><p>Organize, revise e envie ideias para o quadro do cliente.</p></header><div className="pautas-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pauta" /><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todas</option><option value="draft">Rascunhos</option><option value="sent">Enviadas</option><option value="approved">Aprovadas</option></select></div><div className="pautas-table"><div className="pautas-row pautas-head"><span>Cliente</span><span>Título</span><span>Tipo</span><span>Data</span><span>Status</span><span>Ações</span></div>{visible.map((idea) => { const status = idea.status ?? "draft"; return <div className="pautas-row" key={idea.id}><span>{clientName}</span><strong>{idea.title}</strong><span>{pautaTypeLabel(idea.contentType)}</span><span>{new Date(idea.plannedDate || idea.createdAt).toLocaleDateString("pt-BR")}</span><span className={`pauta-status ${status}`}>{status === "approved" ? "Aprovada" : status === "sent" ? "Enviada" : "Rascunho"}</span><span className="pauta-actions"><button onClick={() => { setEditing({ ...idea }); setBrainOpen(false); }}>✎</button><button className="delete" onClick={() => deleteIdea(idea.id)}>⌫</button>{status === "draft" ? <button disabled={sending === idea.id} onClick={() => void send(idea)}>{sending === idea.id ? "..." : "Enviar"}</button> : status === "approved" ? <span className="pauta-approved-mark">✓ Aprovada</span> : "✓"}</span></div>; })}{visible.length === 0 ? <p className="pautas-empty">Nenhuma pauta encontrada. Use a lâmpada na lateral para criar uma.</p> : null}</div>{editing ? <div className="pauta-modal-backdrop" onMouseDown={() => setEditing(null)}><section className="pauta-modal" onMouseDown={(event) => event.stopPropagation()}><header><h3>Editar pauta</h3><button onClick={() => setEditing(null)}>×</button></header><label>Título<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label>Descrição<textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label><label>Legenda sugerida<textarea value={editing.caption} onChange={(event) => setEditing({ ...editing, caption: event.target.value })} /></label>{editing.internalNotes ? <label>Notas internas<textarea value={editing.internalNotes} onChange={(event) => setEditing({ ...editing, internalNotes: event.target.value })} /></label> : null}<button className="brain-check" onClick={() => setBrainOpen((open) => !open)}>✧ Brand Brain</button>{brainOpen ? <div className="brain-feedback">{avoidHits.length ? <p>Evite: {avoidHits.join(", ")}.</p> : <p>Sem termos a evitar encontrados.</p>}{brain.expressions.slice(0, 3).length ? <p>Expressões da marca: {brain.expressions.slice(0, 3).join(" · ")}</p> : null}</div> : null}<footer><button className="drawer-secondary-action" onClick={() => setEditing(null)}>Cancelar</button><button className="gradient-button" onClick={saveEdit}>Salvar alterações</button></footer></section></div> : null}</section>;
}
function BrandBrainWorkspace({ slug, clientName }: { slug: string; clientName: string }) {
  const [brain, setBrain] = useState<BrandBrain>(EMPTY_BRAND_BRAIN);
  const [section, setSection] = useState<"home" | "strategy" | "voice" | "vocabulary" | "avoid" | "visual">("home");
  const [saved, setSaved] = useState("");
  useEffect(() => { loadBrandBrainBySlug(slug).then((result) => setBrain({ ...EMPTY_BRAND_BRAIN, ...(result.data ?? {}) })).catch(() => setBrain(EMPTY_BRAND_BRAIN)); }, [slug]);
  const save = () => { void saveBrandBrainBySlug(slug, brain).then(() => setSaved("Salvo")); window.setTimeout(() => setSaved(""), 1800); };
  const words = (key: "approvedWords" | "avoidWords" | "expressions", label: string) => <label className="brand-field"><span>{label}</span><input value={brain[key].join(", ")} onChange={(event) => setBrain({ ...brain, [key]: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Separe por vírgulas" /></label>;
  return <section className="brand-brain"><header><div><span>✧ Brand Brain</span><h2>{clientName}</h2><p>Memória estratégica para manter todos os conteúdos consistentes.</p></div><button className="gradient-button" onClick={save}>{saved || "Salvar"}</button></header><nav>{([ ["home", "Home"], ["strategy", "Panorâmica"], ["vocabulary", "Vocabulário"], ["voice", "Voz"], ["avoid", "Da evitar"], ["visual", "Visual"] ] as const).map(([id, label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}</nav>{section === "home" ? <div className="brand-home"><article><small>MISSÃO</small><strong>{brain.mission || "Defina o propósito da marca."}</strong></article><article><small>VISÃO</small><strong>{brain.vision || "Defina onde a marca quer chegar."}</strong></article><article className="brand-pillars"><div><small>PILARES</small><strong>{brain.pillars.length} pilares</strong></div><div className="brand-pillar-bar">{brain.pillars.map((pillar, index) => <i key={pillar.name || index} style={{ width: `${pillar.weight || 10}%`, background: brain.colors[index % brain.colors.length] }} />)}</div>{brain.pillars.map((pillar, index) => <p key={`${pillar.name}-${index}`}><b style={{ background: brain.colors[index % brain.colors.length] }} />{pillar.name || "Novo pilar"}<span>{pillar.weight || 0}%</span></p>)}</article><div className="brand-stat-grid"><article><b>{brain.approvedWords.length}</b><span>Vocabulário</span></article><article><b>{brain.avoidWords.length}</b><span>Palavras a evitar</span></article><article><b>{brain.expressions.length}</b><span>Expressões</span></article></div></div> : <div className="brand-editor">{section === "strategy" ? <><label className="brand-field"><span>Missão</span><textarea value={brain.mission} onChange={(event) => setBrain({ ...brain, mission: event.target.value })} /></label><label className="brand-field"><span>Visão</span><textarea value={brain.vision} onChange={(event) => setBrain({ ...brain, vision: event.target.value })} /></label><label className="brand-field"><span>Pilares: nome | foco | peso</span><textarea value={brain.pillars.map((item) => `${item.name}|${item.focus}|${item.weight}`).join("\n")} onChange={(event) => setBrain({ ...brain, pillars: event.target.value.split("\n").filter(Boolean).map((item) => { const [name = "", focus = "", weight = "0"] = item.split("|"); return { name: name.trim(), focus: focus.trim(), weight: Number(weight) || 0 }; }) })} /></label></> : null}{section === "voice" ? <label className="brand-field"><span>Tom de voz</span><textarea value={brain.voice} onChange={(event) => setBrain({ ...brain, voice: event.target.value })} /></label> : null}{section === "vocabulary" ? <>{words("approvedWords", "Palavras aprovadas")}{words("expressions", "Expressões aprovadas")}</> : null}{section === "avoid" ? <>{words("avoidWords", "Palavras e termos a evitar")}<p className="brand-check-note">A verificação sem IA procura estes termos em legendas e pautas e sinaliza quando houver correspondência.</p></> : null}{section === "visual" ? <><label className="brand-field"><span>Direção visual</span><textarea value={brain.visualNotes} onChange={(event) => setBrain({ ...brain, visualNotes: event.target.value })} /></label><label className="brand-field"><span>Paleta</span><input value={brain.colors.join(", ")} onChange={(event) => setBrain({ ...brain, colors: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label></> : null}</div>}</section>;
}

type BrandBrainSection = "overview" | "essence" | "audience" | "voice" | "content" | "visual" | "history";

function normalizeBrandBrain(data?: Partial<BrandBrain> | null): BrandBrain {
  return {
    ...EMPTY_BRAND_BRAIN,
    ...(data ?? {}),
    audiencePains: data?.audiencePains ?? [], audienceDesires: data?.audienceDesires ?? [],
    personalityTraits: data?.personalityTraits ?? [], voiceExamples: data?.voiceExamples ?? [], voiceAvoidExamples: data?.voiceAvoidExamples ?? [],
    typographyDisplay: data?.typographyDisplay ?? "", typographyBody: data?.typographyBody ?? "", typographyAccent: data?.typographyAccent ?? "", typographySample: data?.typographySample || EMPTY_BRAND_BRAIN.typographySample,
    approvedWords: data?.approvedWords ?? [], avoidWords: data?.avoidWords ?? [], expressions: data?.expressions ?? [],
    differentiators: data?.differentiators ?? [], proofPoints: data?.proofPoints ?? [], references: data?.references ?? [],
    colors: data?.colors?.length ? data.colors : EMPTY_BRAND_BRAIN.colors, pillars: data?.pillars ?? [],
  };
}

function BrandBrainContentAudit({ brain }: { brain: BrandBrain }) {
  const { t } = usePortalTranslation();
  const [text, setText] = useState("");
  const normalized = text.toLocaleLowerCase("pt-BR");
  const includes = (value: string) => normalized.includes(value.toLocaleLowerCase("pt-BR"));
  const avoidHits = brain.avoidWords.filter((item) => item.trim() && includes(item));
  const preferredHits = brain.approvedWords.filter((item) => item.trim() && includes(item));
  const expressionHits = brain.expressions.filter((item) => item.trim() && includes(item));
  const pillarHits = brain.pillars.filter((pillar) => {
    const tokens = `${pillar.name} ${pillar.focus}`.toLocaleLowerCase("pt-BR").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 4);
    return tokens.some((token) => normalized.includes(token));
  });
  const score = text.trim() ? Math.max(0, Math.min(100, 72 - avoidHits.length * 22 + preferredHits.length * 5 + expressionHits.length * 7 + pillarHits.length * 6)) : null;
  const tone = score == null ? "idle" : score >= 85 ? "great" : score >= 65 ? "good" : "review";
  return <section className={`brand-v2-audit ${tone}`}><header><div><small>{t("VERIFICAÇÃO DE CONTEÚDO")}</small><h3>{t("Teste uma legenda")}</h3><p>{t("Cole o texto para conferir se ele conversa com a memória da marca.")}</p></div>{score != null ? <strong>{score}<small>/100</small></strong> : <span>✦</span>}</header><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={t("Cole aqui a legenda ou o texto que deseja revisar…")} />{score != null ? <div className="brand-v2-audit-results"><article className={avoidHits.length ? "warning" : "ok"}><b>{t(avoidHits.length ? "Ajustar" : "Tudo certo")}</b><span>{avoidHits.length ? `${t("Termos a evitar")}: ${avoidHits.join(", ")}` : t("Nenhum termo proibido encontrado.")}</span></article><article><b>{t("Vocabulário")}</b><span>{preferredHits.length || expressionHits.length ? [...preferredHits, ...expressionHits].join(" · ") : t("Nenhuma expressão característica apareceu ainda.")}</span></article><article><b>{t("Pilar relacionado")}</b><span>{pillarHits.length ? pillarHits.map((item) => item.name).join(" · ") : t("Não identificamos conexão clara com um pilar.")}</span></article><article><b>{t("Tom esperado")}</b><span>{brain.voice || t("Defina o tom de voz para receber uma orientação mais completa.")}</span></article></div> : <p className="brand-v2-audit-empty">{t("A análise acontece enquanto você escreve, sem alterar o conteúdo original.")}</p>}</section>;
}

function BrandBrainExperience({ slug, clientName, portal = false, allowEdit = true }: { slug: string; clientName: string; portal?: boolean; allowEdit?: boolean }) {
  const { t, localeTag } = usePortalTranslation();
  const recoveryKey = `designhub-v2-brand-brain-draft:${portal ? "portal" : "admin"}:${slug}`;
  const [snapshot, setSnapshot] = useState<BrandBrainSnapshot | null>(null);
  const [brain, setBrain] = useState<BrandBrain>(EMPTY_BRAND_BRAIN);
  const [section, setSection] = useState<BrandBrainSection>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [draftState, setDraftState] = useState<AutosaveState>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const publishedBrainRef = useRef("");
  const recoveryCheckedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = portal ? await loadPortalBrandBrainBySlug(slug) : await loadBrandBrainBySlug(slug);
      const publishedBrain = normalizeBrandBrain(result.data);
      publishedBrainRef.current = JSON.stringify(publishedBrain);
      const recovered = recoveryCheckedRef.current ? null : readRecoveryDraft<BrandBrain>(recoveryKey);
      recoveryCheckedRef.current = true;
      setSnapshot(result); setBrain(recovered ? normalizeBrandBrain(recovered) : publishedBrain);
      setDraftState(recovered ? "recovered" : "idle");
    } catch (error) { setMessage(error instanceof Error ? error.message : t("Não foi possível carregar o Brand Brain.")); }
    finally { setLoading(false); }
  }, [portal, recoveryKey, slug]);
  useEffect(() => { void load(); }, [load]);

  const importantValues = [brain.mission, brain.vision, brain.positioning, brain.brandPromise, brain.audience, brain.voice, brain.visualNotes, brain.pillars.length, brain.approvedWords.length, brain.differentiators.length];
  const completion = Math.round(importantValues.filter(Boolean).length / importantValues.length * 100);
  const pending = snapshot?.revisions.filter((item) => item.status === "pending") ?? [];
  const editable = !portal || allowEdit;
  const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t("Ainda não publicado");
  const setText = (key: keyof BrandBrain, value: string) => setBrain((current) => ({ ...current, [key]: value }));
  const setList = (key: keyof BrandBrain, value: string) => setBrain((current) => ({ ...current, [key]: value.split("\n").map((item) => item.trim()).filter(Boolean) }));
  const listValue = (key: keyof BrandBrain) => ((brain[key] as string[]) ?? []).join("\n");

  useEffect(() => {
    if (loading || !editable || !publishedBrainRef.current) return;
    const brainJson = JSON.stringify(brain);
    if (brainJson === publishedBrainRef.current) return;
    setDraftState((current) => current === "recovered" ? current : "pending");
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(recoveryKey, brainJson);
        setDraftSavedAt(new Date());
        setDraftState("saved");
      } catch {
        setDraftState("error");
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [brain, editable, loading, recoveryKey]);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const result = portal ? await savePortalBrandBrainBySlug(slug, brain, summary) : await saveBrandBrainBySlug(slug, brain, summary);
      setMessage(t(result.pending ? "Sugestão enviada para a equipe. Ela ficará pendente até a aprovação." : "Brand Brain atualizado e uma nova versão foi registrada."));
      try { window.localStorage.removeItem(recoveryKey); } catch { /* Recovery remains optional. */ }
      publishedBrainRef.current = JSON.stringify(brain);
      setDraftSavedAt(new Date());
      setDraftState("saved");
      setSummary(""); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : t("Não foi possível salvar.")); }
    finally { setSaving(false); }
  };
  const decide = async (revisionId: string, approved: boolean) => {
    setMessage("");
    try { await decideBrandBrainRevisionBySlug(slug, revisionId, approved); setMessage(approved ? "Sugestão aprovada e publicada como nova versão." : "Sugestão recusada."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a revisão."); }
  };
  const sendComment = async () => {
    if (!comment.trim()) return; setCommenting(true);
    try {
      if (portal) await addPortalBrandBrainCommentBySlug(slug, { commentText: comment.trim(), sectionKey: section });
      else await addBrandBrainCommentBySlug(slug, { commentText: comment.trim(), sectionKey: section });
      setComment(""); setMessage(t("Comentário enviado.")); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : t("Não foi possível comentar.")); }
    finally { setCommenting(false); }
  };
  const field = (key: keyof BrandBrain, label: string, hint: string, large = false) => <label className="brand-v2-field"><span>{t(label)}</span><small>{t(hint)}</small><textarea disabled={!editable} className={large ? "large" : ""} value={(brain[key] as string) ?? ""} onChange={(event) => setText(key, event.target.value)} /></label>;
  const listField = (key: keyof BrandBrain, label: string, hint: string) => <label className="brand-v2-field"><span>{t(label)}</span><small>{t(hint)}</small><textarea disabled={!editable} value={listValue(key)} onChange={(event) => setList(key, event.target.value)} placeholder={t("Um item por linha")} /></label>;

  if (loading) return <section className="brand-v2-loading">{t("Organizando a memória da marca…")}</section>;
  return <section className={`brand-v2 ${portal ? "portal-brand-brain" : ""}`}>
    <header className="brand-v2-hero">
      <div><span className="brand-v2-kicker">✦ Brand Brain</span><h1>{clientName}</h1><p>{t("A fonte de verdade da marca para estratégia, conteúdo e direção visual.")}</p><div className="brand-v2-meta"><b>{t("Versão")} {snapshot?.meta.version || t("inicial")}</b><span>{t("Atualizado")} {dateLabel(snapshot?.meta.updatedAt)}</span>{pending.length ? <em>{pending.length} {t(pending.length === 1 ? "sugestão pendente" : "sugestões pendentes")}</em> : <em className="ok">{t("Tudo alinhado")}</em>}</div></div>
      <div className="brand-v2-progress"><strong>{completion}%</strong><span>{t("da identidade preenchida")}</span><i><b style={{ width: `${completion}%` }} /></i></div>
    </header>
    <nav className="brand-v2-nav">{([ ["overview", "Visão geral"], ["essence", "Essência"], ["audience", "Público"], ["voice", "Voz"], ["content", "Conteúdo"], ["visual", "Visual"], ["history", "Histórico"] ] as Array<[BrandBrainSection, string]>).map(([id, label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{t(label)}{id === "history" && pending.length ? <b>{pending.length}</b> : null}</button>)}</nav>

    {section === "overview" ? <div className="brand-v2-overview">
      <article className="brand-v2-statement"><small>{t("POSICIONAMENTO")}</small><h2>{brain.positioning || t("Defina o espaço único que a marca deseja ocupar.")}</h2><p>{brain.brandPromise || t("A promessa central da marca aparecerá aqui.")}</p></article>
      <button className="brand-v2-voice-banner" onClick={() => setSection("voice")}><span>♬</span><div><small>{t("VOZ · PERSONALIDADE")}</small><strong>{brain.personalityTraits.length ? brain.personalityTraits.join(" / ") : brain.voice || t("Defina como a marca fala e se relaciona.")}</strong></div><em>{t("Abrir →")}</em></button>
      <article className="brand-v2-pillars brand-v2-pillars-chart"><header><div><span className="brand-v2-section-icon">▱</span><small>{t("PILARES")}</small><h3>{brain.pillars.length} {t(brain.pillars.length === 1 ? "pilar" : "pilares")}</h3></div><button onClick={() => setSection("content")}>{t("Abrir →")}</button></header>{brain.pillars.length ? <><div className="brand-v2-segmented-bar">{brain.pillars.map((pillar, index) => <i key={`${pillar.name}-${index}`} style={{ flex: Math.max(pillar.weight, 8), background: brain.colors[index % brain.colors.length] }} />)}</div><div className="brand-v2-pillar-list">{brain.pillars.map((pillar, index) => <div key={`${pillar.name}-${index}`}><i style={{ background: brain.colors[index % brain.colors.length] }} /><span><strong>{pillar.name}</strong><small>{pillar.focus}</small></span><em><b style={{ width: `${Math.min(100, Math.max(0, pillar.weight))}%`, background: brain.colors[index % brain.colors.length] }} /></em><strong>{pillar.weight}%</strong></div>)}</div></> : <p>{t("Nenhum pilar definido ainda.")}</p>}</article>
      <article className="brand-v2-visual-summary"><header><div><span className="brand-v2-section-icon">◉</span><small>{t("VISUAL")}</small></div><button onClick={() => setSection("visual")}>{t("Abrir →")}</button></header><h3>{t("Paleta")}</h3><div className="brand-v2-color-chips">{brain.colors.map((color) => <span key={color}><i style={{ background: color }} />{color}</span>)}</div><h3>{t("Tipografia")}</h3><div className="brand-v2-type-preview"><small>{[brain.typographyDisplay, brain.typographyBody, brain.typographyAccent].filter(Boolean).join(", ") || t("Tipografia ainda não definida")}</small><strong style={{ fontFamily: brain.typographyDisplay || undefined }}>{brain.typographyDisplay || t("Fonte de destaque")}</strong><p style={{ fontFamily: brain.typographyBody || undefined }}>{brain.typographySample}</p></div></article>
      <section className="brand-v2-explore"><h3>{t("Explore as seções")}</h3><div>{[
        { id: "content" as const, icon: "▤", count: brain.approvedWords.length, title: "Vocabulário", text: "Palavras e conceitos que representam a marca.", tone: "blue" },
        { id: "content" as const, icon: "▱", count: brain.pillars.length, title: "Pilares", text: "Os grandes temas que guiam os conteúdos.", tone: "purple" },
        { id: "voice" as const, icon: "♬", count: brain.personalityTraits.length, title: "Voz", text: "Tom, ritmo e personalidade da comunicação.", tone: "rose" },
        { id: "content" as const, icon: "⊘", count: brain.avoidWords.length, title: "A evitar", text: "Palavras e expressões que não combinam com a marca.", tone: "sand" },
        { id: "content" as const, icon: "❞", count: brain.expressions.length, title: "Expressões", text: "Frases e assinaturas aprovadas para uso.", tone: "mint" },
        { id: "visual" as const, icon: "◉", count: brain.colors.length + [brain.typographyDisplay, brain.typographyBody, brain.typographyAccent].filter(Boolean).length, title: "Visual", text: "Cores, tipografia, estilo e composição.", tone: "lilac" },
      ].map((item) => <button key={item.title} className={item.tone} onClick={() => setSection(item.id)}><span>{item.icon}</span><b>{item.count}</b><strong>{t(item.title)}</strong><p>{t(item.text)}</p></button>)}</div></section>
    </div> : null}

    {section === "essence" ? <div className="brand-v2-editor-grid">{field("mission", "Missão", "Por que a marca existe e que transformação deseja causar?", true)}{field("vision", "Visão", "Onde a marca quer chegar nos próximos anos?", true)}{field("positioning", "Posicionamento", "Qual espaço único a marca ocupa na mente do público?", true)}{field("brandPromise", "Promessa da marca", "O compromisso que deve estar presente em cada entrega.")}{listField("differentiators", "Diferenciais", "Razões concretas para escolher esta marca.")}{listField("proofPoints", "Provas e credenciais", "Resultados, números, experiência e fatos que sustentam a promessa.")}</div> : null}
    {section === "audience" ? <div className="brand-v2-editor-grid">{field("audience", "Público prioritário", "Descreva a pessoa, o contexto e o momento de compra.", true)}{listField("audiencePains", "Dores e tensões", "Problemas que o conteúdo precisa reconhecer.")}{listField("audienceDesires", "Desejos e objetivos", "O que esse público quer conquistar ou sentir.")}</div> : null}
    {section === "voice" ? <div className="brand-v2-editor-grid">{field("voice", "Tom de voz", "Como a marca fala, soa e se relaciona.", true)}{listField("personalityTraits", "Traços de personalidade", "Ex.: segura, próxima, sofisticada.")}{listField("voiceExamples", "Exemplos de como falar", "Frases que representam bem a marca.")}{listField("voiceAvoidExamples", "Exemplos de como não falar", "Construções que descaracterizam a marca.")}</div> : null}
    {section === "content" ? <div className="brand-v2-editor-grid">{listField("approvedWords", "Vocabulário preferido", "Palavras que reforçam a identidade.")}{listField("expressions", "Expressões da marca", "Frases ou assinaturas que podem se repetir.")}{listField("avoidWords", "Termos a evitar", "O sistema sinaliza estes termos nas pautas.")}<label className="brand-v2-field wide"><span>{t("Pilares: nome | foco | peso")}</span><small>{t("Um pilar por linha. Ex.: Educação | Ensinar com clareza | 40")}</small><textarea disabled={!editable} className="large" value={brain.pillars.map((item) => `${item.name} | ${item.focus} | ${item.weight}`).join("\n")} onChange={(event) => setBrain({ ...brain, pillars: event.target.value.split("\n").filter(Boolean).map((item) => { const [name = "", focus = "", weight = "0"] = item.split("|"); return { name: name.trim(), focus: focus.trim(), weight: Number(weight) || 0 }; }) })} /></label></div> : null}
    {section === "visual" ? <><div className="brand-v2-editor-grid">{field("visualNotes", "Direção visual", "Estilo fotográfico, composição, texturas e sensações.", true)}<label className="brand-v2-field"><span>{t("Cores da marca")}</span><small>{t("Use códigos hexadecimais separados por vírgula.")}</small><input disabled={!editable} value={brain.colors.join(", ")} onChange={(event) => setBrain({ ...brain, colors: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /><div className="brand-v2-color-preview">{brain.colors.map((color) => <i key={color} style={{ background: color }} />)}</div></label>{field("typographyDisplay", "Fonte de destaque", "Para títulos, chamadas e peças de impacto.")}{field("typographyBody", "Fonte de texto", "Para legendas, parágrafos e leitura contínua.")}{field("typographyAccent", "Fonte de apoio", "Opcional: itálicos, assinaturas ou pequenos destaques.")}{field("typographySample", "Texto de demonstração", "Frase usada na prévia tipográfica.", true)}{listField("references", "Referências", "Links, marcas e repertórios que ajudam a orientar a criação.")}</div><section className="brand-v2-typography-live"><small>{t("PRÉVIA TIPOGRÁFICA")}</small><div><span>{[brain.typographyDisplay, brain.typographyBody, brain.typographyAccent].filter(Boolean).join(" · ") || t("Defina as fontes acima")}</span><h2 style={{ fontFamily: brain.typographyDisplay || undefined }}>{brain.typographyDisplay || t("Título principal da marca")}</h2><p style={{ fontFamily: brain.typographyBody || undefined }}>{brain.typographySample}</p>{brain.typographyAccent ? <em style={{ fontFamily: brain.typographyAccent }}>{t("Detalhe ou assinatura em")} {brain.typographyAccent}</em> : null}</div></section></> : null}
    {section === "content" ? <BrandBrainContentAudit brain={brain} /> : null}
    {section === "history" ? <div className="brand-v2-history">
      {!portal && pending.length ? <section className="brand-v2-review"><header><div><small>AGUARDANDO SUA DECISÃO</small><h2>Sugestões do cliente</h2></div><b>{pending.length}</b></header>{pending.map((revision) => <article key={revision.id}><div><strong>{revision.authorName}</strong><time>{dateLabel(revision.createdAt)}</time></div><p>{revision.summary || "Sugeriu uma atualização no Brand Brain."}</p><div><button className="ghost-button" onClick={() => setBrain(normalizeBrandBrain(revision.data))}>Visualizar proposta</button><button className="danger-button" onClick={() => void decide(revision.id, false)}>Recusar</button><button className="gradient-button" onClick={() => void decide(revision.id, true)}>Aprovar e publicar</button></div></article>)}</section> : null}
      {portal && pending.length ? <section className="brand-v2-pending-note"><b>⏳</b><div><strong>{t("Sua sugestão está em análise")}</strong><p>{t("A equipe recebeu a atualização e você verá a nova versão aqui assim que ela for aprovada.")}</p></div></section> : null}
      <section className="brand-v2-version-list"><h3>{t("Versões publicadas")}</h3>{snapshot?.history.length ? snapshot.history.map((version) => <article key={version.id}><b>v{version.version}</b><div><strong>{version.authorName}</strong><span>{dateLabel(version.createdAt)}</span></div></article>) : <p>{t("A primeira versão será criada no próximo salvamento.")}</p>}</section>
    </div> : null}

    {editable && section !== "overview" && section !== "history" ? <footer className="brand-v2-save"><label><span>{t(portal ? "O que você está sugerindo?" : "Nota da atualização")}</span><input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={t(portal ? "Ex.: atualizamos nosso público e tom de voz" : "Ex.: revisão estratégica de agosto")} /></label><AutosaveIndicator state={draftState} savedAt={draftSavedAt} savedLabel={t("Rascunho protegido")} /><button className="gradient-button" disabled={saving} onClick={() => void save()}>{t(saving ? "Salvando…" : portal ? "Enviar sugestão" : "Publicar nova versão")}</button></footer> : null}
    <section className="brand-v2-comments"><header><div><small>{t("CONVERSA DA MARCA")}</small><h3>{t("Comentários")}</h3></div><span>{snapshot?.comments.length ?? 0}</span></header><div className="brand-v2-comment-form"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t(section === "overview" ? "Comente sobre o Brand Brain…" : "Comente sobre esta seção…")} /><button className="ghost-button" disabled={commenting || !comment.trim()} onClick={() => void sendComment()}>{t(commenting ? "Enviando…" : "Comentar")}</button></div>{snapshot?.comments.filter((item) => item.sectionKey === section || section === "overview").slice(0, 8).map((item) => <article key={item.id}><div><strong>{item.authorName}</strong><span>{t(item.authorRole === "cliente" ? "Cliente" : "Equipe")} · {dateLabel(item.createdAt)}</span></div><p>{item.commentText}</p></article>)}</section>
    {message ? <div className="brand-v2-message" role="status"><span>✓</span>{message}<button onClick={() => setMessage("")}>×</button></div> : null}
  </section>;
}

function BrandBrainWorkspaceV2({ slug, clientName }: { slug: string; clientName: string }) { return <BrandBrainExperience slug={slug} clientName={clientName} />; }
function ClientBrandBrainView({ slug, clientName, allowEdit }: { slug: string; clientName: string; allowEdit: boolean }) { return <BrandBrainExperience slug={slug} clientName={clientName} portal allowEdit={allowEdit} />; }

type ProposalStatus = ProposalRecord["status"];
type LocalProposal = ProposalRecord;
const proposalStatuses: Array<{ id: ProposalStatus; label: string; tone: string }> = [
  { id: "accepted", label: "Aceitas", tone: "accepted" },
  { id: "viewed", label: "Visualizadas", tone: "sent" },
  { id: "sent", label: "Enviadas", tone: "sent" },
  { id: "refused", label: "Recusadas", tone: "refused" },
  { id: "expired", label: "Expiradas", tone: "refused" },
  { id: "draft", label: "Rascunhos", tone: "draft" },
];

const proposalLocales = {
  "Português": { code: "pt-BR", label: "Português", commercial: "Proposta comercial", prepared: "Preparada para", plan: "Plano", validity: "Validade", pieces: "Peças", deliveries: "entregas", scope: "Escopo do projeto", investment: "Investimento", services: "Serviços inclusos", total: "Investimento total", until: "Válida até", continueTogether: "Vamos seguir juntos?", emptyScope: "Descreva o escopo, objetivos e entregas desta proposta.", emptyInvestment: "Detalhe aqui as condições comerciais e observações.", emptyServices: "Os serviços aparecerão aqui.", accept: "Aceitar proposta", refuse: "Não aceitar", accepted: "Proposta aceita", refused: "Proposta recusada", answer: "Sua resposta foi registrada. Nossa equipe entrará em contato em breve." },
  "English": { code: "en-US", label: "English", commercial: "Commercial proposal", prepared: "Prepared for", plan: "Plan", validity: "Validity", pieces: "Pieces", deliveries: "deliverables", scope: "Project scope", investment: "Investment", services: "Included services", total: "Total investment", until: "Valid until", continueTogether: "Shall we move forward together?", emptyScope: "Describe the scope, objectives and deliverables for this proposal.", emptyInvestment: "Add payment terms, notes and next steps here.", emptyServices: "Services will appear here.", accept: "Accept proposal", refuse: "Decline proposal", accepted: "Proposal accepted", refused: "Proposal declined", answer: "Your answer has been recorded. Our team will be in touch soon." },
  "Español": { code: "es-ES", label: "Español", commercial: "Propuesta comercial", prepared: "Preparada para", plan: "Plan", validity: "Validez", pieces: "Piezas", deliveries: "entregables", scope: "Alcance del proyecto", investment: "Inversión", services: "Servicios incluidos", total: "Inversión total", until: "Válida hasta", continueTogether: "¿Seguimos juntos?", emptyScope: "Describa el alcance, los objetivos y las entregas de esta propuesta.", emptyInvestment: "Detalle las condiciones de pago, observaciones y próximos pasos.", emptyServices: "Los servicios aparecerán aquí.", accept: "Aceptar propuesta", refuse: "No aceptar", accepted: "Propuesta aceptada", refused: "Propuesta rechazada", answer: "Su respuesta fue registrada. Nuestro equipo se pondrá en contacto pronto." },
  "Italiano": { code: "it-IT", label: "Italiano", commercial: "Proposta commerciale", prepared: "Preparata per", plan: "Piano", validity: "Validità", pieces: "Pezzi", deliveries: "consegne", scope: "Ambito del progetto", investment: "Investimento", services: "Servizi inclusi", total: "Investimento totale", until: "Valida fino al", continueTogether: "Andiamo avanti insieme?", emptyScope: "Descrivi l'ambito, gli obiettivi e le consegne di questa proposta.", emptyInvestment: "Inserisci le condizioni di pagamento, le note e i prossimi passi.", emptyServices: "I servizi appariranno qui.", accept: "Accetta proposta", refuse: "Rifiuta", accepted: "Proposta accettata", refused: "Proposta rifiutata", answer: "La tua risposta è stata registrata. Il nostro team ti contatterà presto." },
  "Svenska": { code: "sv-SE", label: "Svenska", commercial: "Kommersiellt förslag", prepared: "Förberett för", plan: "Plan", validity: "Giltighet", pieces: "Delar", deliveries: "leveranser", scope: "Projektets omfattning", investment: "Investering", services: "Inkluderade tjänster", total: "Total investering", until: "Giltigt till", continueTogether: "Ska vi gå vidare tillsammans?", emptyScope: "Beskriv omfattning, mål och leveranser för detta förslag.", emptyInvestment: "Lägg till betalningsvillkor, anteckningar och nästa steg här.", emptyServices: "Tjänsterna visas här.", accept: "Acceptera förslag", refuse: "Avböj", accepted: "Förslag accepterat", refused: "Förslag avböjt", answer: "Ditt svar har registrerats. Vårt team kontaktar dig snart." },
} as const;

function getProposalLocale(locale: string) { return proposalLocales[locale as keyof typeof proposalLocales] ?? proposalLocales["Português"]; }

function ProposalClientPreview({ proposal }: { proposal: LocalProposal }) {
  const total = proposal.services.reduce((sum, service) => sum + Number(service.value || 0), 0);
  const copy = getProposalLocale(proposal.locale);
  return <article className="proposal-client-preview">
    <div className="proposal-client-hero"><span>{copy.commercial}</span><h1>{proposal.proposalType || "Projeto criativo"}</h1><p className="proposal-client-name">{copy.prepared} {proposal.clientName || "..."}</p></div>
    <div className="proposal-client-content"><div className="proposal-client-meta"><span><b>{copy.plan}</b>{proposal.plan || "Personalizado"}</span><span><b>{copy.validity}</b>{copy.until} {new Date(proposal.expiresAt).toLocaleDateString(copy.code)}</span><span><b>{copy.pieces}</b>{proposal.pieces || 0} {copy.deliveries}</span></div>
    <section><small>{copy.scope}</small><div className="proposal-preview-text">{proposal.scope || copy.emptyScope}</div></section>
    <section><small>{copy.services}</small><div className="proposal-service-list">{proposal.services.filter((service) => service.name).map((service, index) => <div key={`${service.name}-${index}`}><span><b>{service.name}</b><small>{service.description}</small></span><strong>{proposal.currency} {Number(service.value || 0).toLocaleString(copy.code, { minimumFractionDigits: 2 })}</strong></div>)}{!proposal.services.some((service) => service.name) ? <p>{copy.emptyServices}</p> : null}</div></section>
    <section className="proposal-investment-card"><small>{copy.investment}</small><div className="proposal-investment-total"><span>{copy.total}</span><strong>{proposal.currency} {total.toLocaleString(copy.code, { minimumFractionDigits: 2 })}</strong></div><div className="proposal-preview-text">{proposal.investment || copy.emptyInvestment}</div></section></div>
  </article>;
}

function ProposalsWorkspace({ newProposalSignal = 0 }: { newProposalSignal?: number }) {
  const [proposals, setProposals] = useState<LocalProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const saveTimerRef = useRef<number | null>(null);
  const selected = proposals.find((proposal) => proposal.id === selectedId) ?? null;
  useEffect(() => { void listAdminProposals().then((result) => { setProposals(result.items); setSelectedId((current) => current ?? result.items[0]?.id ?? null); }).catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível carregar as propostas.")).finally(() => setLoading(false)); }, []);
  useEffect(() => () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); }, []);
  const create = async () => {
    setMessage("");
    try {
      const result = await createAdminProposal({ clientName: "", email: "", locale: "Português", proposalType: "Projeto", plan: "", pieces: 0, scope: "", investment: "", currency: "R$", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), status: "draft", services: [{ name: "", value: 0, description: "" }] });
      setProposals((current) => [result.proposal, ...current]); setSelectedId(result.proposal.id); setView("editor");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar a proposta."); }
  };
  useEffect(() => { if (newProposalSignal > 0) void create(); }, [newProposalSignal]);
  const update = (patch: Partial<LocalProposal>) => { if (!selected) return; const updated={...selected,...patch}; setProposals((current)=>current.map((proposal)=>proposal.id===selected.id?updated:proposal)); if(saveTimerRef.current) window.clearTimeout(saveTimerRef.current); saveTimerRef.current=window.setTimeout(()=>{const {id:_id,token:_token,acceptedAt:_acceptedAt,viewedAt:_viewedAt,createdAt:_createdAt,updatedAt:_updatedAt,...editable}=updated;void updateAdminProposal(selected.id,editable).catch((error)=>setMessage(error instanceof Error?error.message:"Não foi possível salvar a proposta."));},500); };
  const remove = async () => { if (!selected || !window.confirm("Excluir esta proposta?")) return; try { await deleteAdminProposal(selected.id); setProposals((current)=>current.filter((proposal)=>proposal.id!==selected.id)); setSelectedId(null); } catch(error){setMessage(error instanceof Error?error.message:"Não foi possível excluir a proposta.");} };
  const send = async () => { if (!selected) return; const patch={status:"sent" as const,expiresAt:new Date(Date.now()+7*86400000).toISOString()}; try { const result=await updateAdminProposal(selected.id,patch); setProposals((current)=>current.map((proposal)=>proposal.id===selected.id?result.proposal:proposal)); setView("preview"); } catch(error){setMessage(error instanceof Error?error.message:"Não foi possível enviar a proposta.");} };
  const copyLink = async () => { if (!selected) return; await navigator.clipboard?.writeText(`${window.location.origin}/#/proposta/${selected.token}`); };
  const editor = (field: "scope" | "investment", label: string, placeholder: string) => <label className="proposal-rich-field"><span>{label}</span><div className="proposal-rich-toolbar"><b>B</b><i>I</i><u>U</u><em>H2</em><em>Lista</em><em>Link</em></div><textarea value={selected?.[field] ?? ""} onChange={(event) => update({ [field]: event.target.value })} placeholder={placeholder} /></label>;
  useEffect(() => {
    if (view !== "preview") return;
    const elements = Array.from(document.querySelectorAll(".proposal-preview-shell .proposal-client-content > section, .proposal-preview-shell .public-proposal-decision"));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); } }), { threshold: 0.18 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [view, selectedId]);
  if (selected && view === "preview") return <section className="public-proposal-page proposal-preview-shell"><button className="proposal-preview-back" onClick={() => setView("editor")}>← Voltar ao editor</button><header className="public-proposal-brand"><img src={liegePaschoaliniLogo} alt="Liege Paschoalini Studio" /><div><b>LIEGE PASCHOALINI STUDIO</b></div></header><ProposalClientPreview proposal={selected} /><section className="public-proposal-decision"><p>{getProposalLocale(selected.locale).until} {new Date(selected.expiresAt).toLocaleDateString(getProposalLocale(selected.locale).code)}.</p><h2>{getProposalLocale(selected.locale).continueTogether}</h2><div><button className="gradient-button">{getProposalLocale(selected.locale).accept}</button><button className="public-proposal-refuse">{getProposalLocale(selected.locale).refuse}</button></div></section></section>;
  if (loading) return <section className="proposals-workspace"><p className="proposal-empty">Carregando propostas...</p></section>;
  return <section className="proposals-workspace">
    <div className={proposals.length ? "proposals-layout" : "proposals-layout empty-library"}>{proposals.length ? <aside className="proposal-library"><div><b>Biblioteca</b><button onClick={create}>+</button></div>{proposalStatuses.map((status) => <section key={status.id}><p>{status.label}<span>{proposals.filter((proposal) => proposal.status === status.id).length}</span></p>{proposals.filter((proposal) => proposal.status === status.id).map((proposal) => <button key={proposal.id} onClick={() => { setSelectedId(proposal.id); setView("editor"); }} className={selectedId === proposal.id ? "active" : ""}><strong>{proposal.clientName || "Nova proposta"}</strong><span className="proposal-library-meta"><small>{proposal.proposalType} · {new Date(proposal.expiresAt).toLocaleDateString("pt-BR")}</small>{proposal.acceptedAt ? <span className="proposal-accepted-badge">Aceita</span> : null}</span></button>)}</section>)}</aside> : null}
    <main className="proposal-stage">{!selected ? <div className="proposal-empty"><span>✦</span><h2>Comece por uma proposta</h2><p>Use o botão “Nova proposta” no banner para montar sua próxima proposta comercial.</p></div> : <><div className="proposal-stage-tabs"><button className="active">Editor</button><button onClick={() => setView("preview")}>Prévia do cliente</button><span>Válida por 7 dias</span></div><div className="proposal-editor"><div className="proposal-fields two"><label>Nome do cliente *<input value={selected.clientName} onChange={(event) => update({ clientName: event.target.value })} placeholder="Ex: Empresa ABC" /></label><label>E-mail<input type="email" value={selected.email} onChange={(event) => update({ email: event.target.value })} placeholder="email@cliente.com" /></label></div><div className="proposal-fields three"><label>Idioma<select value={selected.locale} onChange={(event) => update({ locale: event.target.value })}>{Object.values(proposalLocales).map((locale) => <option key={locale.label}>{locale.label}</option>)}</select></label><label>Tipo de proposta<select value={selected.proposalType} onChange={(event) => update({ proposalType: event.target.value })}><option>Projeto</option><option>Mensalidade</option><option>Consultoria</option></select></label><label>Plano<input value={selected.plan} onChange={(event) => update({ plan: event.target.value })} placeholder="Selecione..." /></label></div><label className="proposal-pieces">Qtd. de peças<input type="number" min="0" value={selected.pieces} onChange={(event) => update({ pieces: Number(event.target.value) })} /></label>{editor("scope", "Escopo do projeto", "Descreva o escopo dos serviços. Use títulos e listas para organizar.")}{editor("investment", "Descrição do investimento", "Condições de pagamento, observações e próximos passos...")}<div className="proposal-services"><header><div><span>Serviços</span><p>Monte os itens que fazem parte desta proposta.</p></div><button onClick={() => update({ services: [...selected.services, { name: "", value: 0, description: "" }] })}>+ Adicionar</button></header>{selected.services.map((service, index) => <div className="proposal-service-edit" key={index}><input value={service.name} onChange={(event) => update({ services: selected.services.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} placeholder="Nome do serviço" /><input type="number" value={service.value} onChange={(event) => update({ services: selected.services.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(event.target.value) } : item) })} placeholder="Valor" /><input value={service.description} onChange={(event) => update({ services: selected.services.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} placeholder="Descrição (opcional)" /><button onClick={() => update({ services: selected.services.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}</div></div></>}</main>
    <aside className="proposal-actions">{selected ? <><span className={`proposal-status ${selected.status}`}>{proposalStatuses.find((status) => status.id === selected.status)?.label.slice(0, -1) ?? "Rascunho"}</span><h3>{selected.clientName || "Nova proposta"}</h3><p>O link temporário e a proposta expiram automaticamente em 7 dias.</p><button onClick={() => setView("preview")}>◫ Ver prévia</button><button onClick={copyLink}>⌁ Copiar link</button><button className="proposal-send" onClick={() => void send()}>➜ Enviar proposta</button><button className="proposal-delete" onClick={() => void remove()}>Excluir proposta</button></> : null}</aside></div>{message ? <p className="time-error" role="alert">{message}</p> : null}
  </section>;
}

function PublicProposalPage() {
  const { token = "" } = useParams();
  const [proposal, setProposal] = useState<LocalProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "refused" | null>(null);
  useEffect(() => { setLoading(true); setLoadError(false); void loadPublicProposal(token).then((result)=>setProposal(result.proposal)).catch(()=>setLoadError(true)).finally(()=>setLoading(false)); }, [token]);
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".public-proposal-page .proposal-client-content > section, .public-proposal-decision"));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("in-view"); }), { threshold: 0.16 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [token, proposal?.id]);
  if (loading) return <main className="public-proposal-page"><section><span>DESIGN HUB</span><h1>Carregando proposta...</h1></section></main>;
  if (!proposal || loadError) return <main className="public-proposal-page"><section><span>DESIGN HUB</span><h1>Esta proposta não está disponível.</h1><p>O link pode ter expirado ou ter sido removido.</p></section></main>;
  const expired = proposal.status === "expired" || new Date(proposal.expiresAt).getTime() < Date.now();
  if (expired) return <main className="public-proposal-page"><section><span>DESIGN HUB</span><h1>Esta proposta expirou.</h1><p>Peça à equipe uma nova versão para continuar.</p></section></main>;
  const copy = getProposalLocale(proposal.locale);
  const decide = async (status: "accepted" | "refused") => {
    try { const result=await decidePublicProposal(token,status); setProposal(result.proposal); setDecision(status); }
    catch { setLoadError(true); }
  };
  return <main className="public-proposal-page"><div className="public-proposal-orb one" /><div className="public-proposal-orb two" /><header className="public-proposal-brand"><img src={liegePaschoaliniLogo} alt="Liege Paschoalini Studio" /><div><b>LIEGE PASCHOALINI STUDIO</b></div></header><ProposalClientPreview proposal={proposal} /><section className="public-proposal-decision">{decision || proposal.status === "accepted" || proposal.status === "refused" ? <><span className={decision ?? proposal.status}>✓</span><h2>{(decision ?? proposal.status) === "accepted" ? copy.accepted : copy.refused}</h2><p>{copy.answer}</p></> : <><p>{copy.until} {new Date(proposal.expiresAt).toLocaleDateString(copy.code)}.</p><h2>{copy.continueTogether}</h2><div><button className="gradient-button" onClick={() => void decide("accepted")}>{copy.accept}</button><button className="public-proposal-refuse" onClick={() => void decide("refused")}>{copy.refuse}</button></div></>}</section></main>;
}

type ContractDraft = { title: string; client: string; bodyHtml: string; language: string; type: string; startDate: string; endDate: string; value: string; scope: string; notes: string };
const emptyContractDraft = (): ContractDraft => ({ title: "", client: "", bodyHtml: "", language: "Português", type: "Prestação de serviços", startDate: "", endDate: "", value: "", scope: "", notes: "" });
type ContractRecord = ApiContractRecord;
type ContractTemplate = { id: string; name: string; bodyHtml?: string; language: string; description: string; draft: Partial<ContractDraft>; custom?: boolean };
const CONTRACT_MODELS: ContractTemplate[] = [
  { id: "services", name: "Prestação de serviços", language: "Português", description: "Modelo completo para projetos de conteúdo e design.", draft: { title: "Contrato de prestação de serviços", type: "Prestação de serviços", scope: "Objeto, escopo, prazos e entregas do projeto serão definidos entre as partes." } },
  { id: "monthly", name: "Contrato mensal", language: "Português", description: "Ideal para contratos recorrentes e gestão contínua.", draft: { title: "Contrato de serviços mensais", type: "Mensalidade", scope: "A contratada prestará serviços recorrentes conforme o plano e o calendário acordados." } },
  { id: "consulting", name: "Consultoria", language: "Português", description: "Base para projetos estratégicos e consultorias.", draft: { title: "Contrato de consultoria", type: "Consultoria", scope: "A consultoria será conduzida em encontros e entregas definidos no cronograma do projeto." } },
];
function contractRecordDraft(record: ContractRecord): ContractDraft { return { title: record.title, client: record.clientName, bodyHtml: record.bodyHtml, language: record.language, type: record.contractType, startDate: record.startDate ?? "", endDate: record.endDate ?? "", value: record.contractValue, scope: record.scope, notes: record.notes }; }
function sanitizedContractHtml(source: string) {
  const documentValue = new DOMParser().parseFromString(source, "text/html");
  documentValue.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((node) => node.remove());
  documentValue.querySelectorAll("*").forEach((node) => [...node.attributes].forEach((attribute) => {
    if (attribute.name.toLowerCase().startsWith("on") || /^(javascript|data):/i.test(attribute.value.trim())) node.removeAttribute(attribute.name);
  }));
  return documentValue.body.innerHTML;
}

function ContractDocumentPreview({ contract, clientName }: { contract: ContractDraft; clientName?: string }) {
  const legacyBody = useMemo(() => sanitizedContractHtml(contract.bodyHtml), [contract.bodyHtml]);
  return <article className="contract-document-preview"><header><span>DESIGN HUB · CONTRATO · {contract.language || "Português"}</span><h1>{contract.title || "Novo contrato"}</h1><p>Documento preparado para {clientName || contract.client || "seu cliente"}</p></header>{contract.bodyHtml ? <section className="contract-rich-body" dangerouslySetInnerHTML={{ __html: legacyBody }} /> : <><div className="contract-preview-meta"><div><small>Tipo</small><strong>{contract.type || "—"}</strong></div><div><small>Vigência</small><strong>{contract.startDate || "—"} {contract.endDate ? `até ${contract.endDate}` : ""}</strong></div><div><small>Valor</small><strong>{contract.value || "A definir"}</strong></div></div><section><small>ESCOPO E CONDIÇÕES</small><p>{contract.scope || "O escopo do contrato será apresentado aqui."}</p></section>{contract.notes ? <section><small>OBSERVAÇÕES</small><p>{contract.notes}</p></section> : null}</>}<footer><span>Li e aceito os termos deste contrato.</span><b>Assinatura digital</b></footer></article>;
}

function ContractRichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);
  const format = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  return <label className="contract-rich-field"><span>Texto do contrato</span><div className="contract-rich-toolbar" role="toolbar" aria-label="Formatação do texto do contrato"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} title="Negrito"><b>B</b></button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} title="Itálico"><i>I</i></button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} title="Sublinhado"><u>U</u></button><i /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "h2")} title="Título">H2</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "h3")} title="Subtítulo">H3</button><i /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")} title="Lista com marcadores">☷</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertOrderedList")} title="Lista numerada">☰</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "blockquote")} title="Citação">❞</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertHorizontalRule")} title="Separador">―</button><span className="contract-rich-toolbar-spacer" /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("undo")} title="Desfazer">↶</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("redo")} title="Refazer">↷</button></div><div ref={editorRef} className="contract-rich-editor" contentEditable suppressContentEditableWarning data-placeholder="Escreva ou selecione um modelo para carregar o texto completo do contrato." onInput={(event) => onChange(event.currentTarget.innerHTML)} /></label>;
}

function ContractsWorkspace({ newContractSignal = 0 }: { newContractSignal?: number }) {
  const recoveryKey = "designhub-v2-contract-current-draft";
  const recoveredDraft = useMemo(() => readRecoveryDraft<{ draft: ContractDraft; clientSlug: string; selectedModel: string }>(recoveryKey), []);
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [clientSlug, setClientSlug] = useState(recoveredDraft?.clientSlug ?? "");
  const [draft, setDraft] = useState<ContractDraft>(recoveredDraft?.draft ?? emptyContractDraft);
  const [records, setRecords] = useState<ContractRecord[]>([]);
  const [customTemplates, setCustomTemplates] = useState<ContractTemplate[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("Português");
  const [selectedModel, setSelectedModel] = useState(recoveredDraft?.selectedModel ?? "");
  const [saved, setSaved] = useState(false);
  const [draftState, setDraftState] = useState<AutosaveState>(recoveredDraft ? "recovered" : "idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const committedDraftRef = useRef("");
  useEffect(() => { void Promise.all([listAdminClients(), listAdminContracts(), listAdminContractTemplates()]).then(([clientResult, contractResult, templateResult]) => { setClients(clientResult.items); setClientSlug((current) => current || clientResult.items[0]?.slug || ""); setRecords(contractResult.items); setCustomTemplates(templateResult.items.map((template) => ({ id: template.id, name: template.name, bodyHtml: template.bodyHtml, language: template.language, description: template.description, draft: template.draft as Partial<ContractDraft>, custom: true }))); }).catch(() => { setClients([]); setRecords([]); setCustomTemplates([]); }); }, []);
  useEffect(() => { if (newContractSignal > 0) { setDraft(emptyContractDraft()); setSelectedModel(""); setSaved(false); setPreviewOpen(false); committedDraftRef.current = ""; try { window.localStorage.removeItem(recoveryKey); } catch { /* Recovery remains optional. */ } setDraftState("idle"); } }, [newContractSignal]);
  useEffect(() => {
    const draftJson = JSON.stringify({ draft, clientSlug, selectedModel });
    const isEmpty = !draft.title && !draft.scope && !draft.notes && !draft.value && !draft.startDate && !draft.endDate;
    if (draftJson === committedDraftRef.current || isEmpty) return;
    setDraftState((current) => current === "recovered" ? current : "pending");
    const timeout = window.setTimeout(() => {
      try { window.localStorage.setItem(recoveryKey, draftJson); setDraftSavedAt(new Date()); setDraftState("saved"); }
      catch { setDraftState("error"); }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [clientSlug, draft, recoveryKey, selectedModel]);
  const selectedClient = clients.find((client) => client.slug === clientSlug);
  const allTemplates = [...CONTRACT_MODELS, ...customTemplates];
  const applyModel = (modelId: string) => { setSelectedModel(modelId); const model = allTemplates.find((item) => item.id === modelId); if (model) setDraft({ ...emptyContractDraft(), ...model.draft, title: model.draft.title || model.name, bodyHtml: sanitizedContractHtml(model.bodyHtml || model.draft.bodyHtml || ""), language: model.language || model.draft.language || "Português" }); };
  const saveTemplate = async () => { if (!templateName.trim()) return; try { const response=await createAdminContractTemplate({name:templateName.trim(),bodyHtml:draft.bodyHtml,language:templateLanguage,description:"Modelo criado por você.",draft:{...draft,language:templateLanguage}}); const template:ContractTemplate={id:response.template.id,name:response.template.name,bodyHtml:response.template.bodyHtml,language:response.template.language,description:response.template.description,draft:response.template.draft as Partial<ContractDraft>,custom:true}; setCustomTemplates((current)=>[template,...current]); setSelectedModel(template.id); setTemplateName(""); setTemplateModalOpen(false); } catch { setSaved(false); } };
  const save = async () => { if (!draft.title.trim() || !selectedClient) return; try { const response=await createAdminContract({clientAccountId:selectedClient.id,title:draft.title.trim(),bodyHtml:draft.bodyHtml,language:draft.language,contractType:draft.type,startDate:draft.startDate||null,endDate:draft.endDate||null,contractValue:draft.value,scope:draft.scope,notes:draft.notes,status:"pending"}); setRecords((current)=>[response.contract,...current]); committedDraftRef.current=JSON.stringify({draft,clientSlug,selectedModel}); try{window.localStorage.removeItem(recoveryKey);}catch{/* Recovery remains optional. */} setDraftSavedAt(new Date());setDraftState("saved");setSaved(true); } catch { setDraftState("error"); setSaved(false); } };
  return <section className="contracts-workspace">
    <div className="contracts-workspace-grid">
      <aside className="contracts-sent"><header><div><span>ENVIADOS</span><h3>Contratos recentes</h3></div><b>{records.length}</b></header>{records.length ? records.map((record) => <div className="contracts-library-record" key={record.id}><strong>{record.title}</strong><div className="contracts-library-record-meta"><span>{record.clientName}</span><span className={`contract-record-status ${record.status}`}>{record.status === "accepted" ? "Aceito" : record.status === "cancelled" ? "Cancelado" : "Aguardando aceite"}</span></div></div>) : <p className="contracts-sent-empty">Nenhum contrato enviado ainda.</p>}</aside>
      <div className="contracts-form-card">
      <header><div><span>CONTRATO</span><h2>Novo contrato</h2><p>Preencha os dados abaixo para registrar um novo contrato na operação.</p></div><div className="contracts-form-mark">✦</div></header>
      <div className="contracts-form-grid two"><label>Título do contrato<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Contrato de gestão de conteúdo" /></label><label>Enviar para o cliente<select value={clientSlug} onChange={(event) => setClientSlug(event.target.value)}><option value="">Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.slug}>{client.name}</option>)}</select></label></div>
      <label className="contracts-model-picker">Usar um modelo pronto<select value={selectedModel} onChange={(event) => applyModel(event.target.value)}><option value="">Começar em branco</option>{allTemplates.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.language}</option>)}</select></label>
      <div className="contracts-form-grid three"><label>Idioma<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}><option>Português</option><option>English</option><option>Español</option><option>Français</option><option>Italiano</option><option>Deutsch</option><option>Svenska</option></select></label><label>Tipo<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>Prestação de serviços</option><option>Mensalidade</option><option>Consultoria</option><option>Parceria</option></select></label><label>Início<input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label></div><div className="contracts-form-grid two"><label>Vencimento<input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label><label>Valor contratado<input value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} placeholder="R$ 0,00" /></label></div>
      <div className="contracts-form-grid two"><label className="wide">Escopo resumido<textarea value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} placeholder="Descreva os serviços e entregas incluídos." /></label></div>
      <label className="contracts-notes">Observações internas<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Condições, responsáveis e observações importantes." /></label>
      <ContractRichEditor value={draft.bodyHtml} onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))} />
      <footer><AutosaveIndicator state={draftState} savedAt={draftSavedAt} savedLabel="Rascunho protegido" /><div><button className="ghost-button" onClick={() => setPreviewOpen(true)}>Visualizar prévia</button><button className="gradient-button" onClick={save} disabled={!draft.title.trim() || !clientSlug}>Salvar contrato</button></div></footer>
      {saved ? <p className="contracts-saved" role="status">✓ Contrato salvo como rascunho.</p> : null}
    </div><aside className="contracts-library"><header><div><span>BIBLIOTECA</span><h3>Modelos prontos</h3></div><b>{allTemplates.length}</b></header>{allTemplates.map((model) => <button key={model.id} className={selectedModel === model.id ? "selected" : ""} onClick={() => applyModel(model.id)}><strong>{model.name}</strong><small>{model.language} · {model.description}</small></button>)}<button className="contracts-create-template" onClick={() => setTemplateModalOpen(true)}>＋ Salvar formulário como modelo</button></aside></div>
    {previewOpen ? <div className="modal-backdrop" onClick={() => setPreviewOpen(false)}><section className="contract-preview-modal" onClick={(event) => event.stopPropagation()}><header><div><span>PRÉVIA PARA O CLIENTE</span><h2>Como o contrato será exibido</h2></div><button className="icon-close" onClick={() => setPreviewOpen(false)}>×</button></header><ContractDocumentPreview contract={draft} clientName={selectedClient?.name || draft.client} /><footer><button className="ghost-button" onClick={() => setPreviewOpen(false)}>Voltar para edição</button></footer></section></div> : null}
    {templateModalOpen ? <div className="modal-backdrop" onClick={() => setTemplateModalOpen(false)}><section className="contract-template-modal" onClick={(event) => event.stopPropagation()}><header><div><span>NOVO MODELO</span><h2>Salvar na biblioteca</h2><p>O formulário atual ficará disponível para reutilização.</p></div><button className="icon-close" onClick={() => setTemplateModalOpen(false)}>×</button></header><label>Nome do modelo<input autoFocus value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ex.: Contrato mensal em inglês" /></label><label>Idioma<select value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)}><option>Português</option><option>English</option><option>Español</option><option>Français</option><option>Italiano</option><option>Deutsch</option><option>Svenska</option></select></label><footer><button className="ghost-button" onClick={() => setTemplateModalOpen(false)}>Cancelar</button><button className="gradient-button" disabled={!templateName.trim()} onClick={saveTemplate}>Salvar modelo</button></footer></section></div> : null}
  </section>;
}

function ClientContractAcceptance({ slug, accountName, canAccept = true }: { slug: string; accountName: string; canAccept?: boolean }) {
  const { t } = usePortalTranslation();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    void loadPendingPortalContractBySlug(slug).then((response) => { setContract(response.contract); setAccepted(!response.contract); }).catch(() => setContract(null));
  }, [slug]);
  if (!canAccept || !contract || accepted) return null;
  const accept = () => {
    void acceptPortalContractBySlug(slug,contract.id).then(()=>setAccepted(true));
  };
  return <div className="contract-acceptance-backdrop"><section className="contract-acceptance-modal"><header><span>{t("PRIMEIRO ACESSO")}</span><h1>{t("Antes de começar, leia seu contrato")}</h1><p>{accountName}, {t("este documento foi disponibilizado para sua conta. Revise os termos com calma.")}</p></header><div className="contract-acceptance-paper"><ContractDocumentPreview contract={contractRecordDraft(contract)} clientName={accountName} /></div><footer><small>{t("Ao clicar, você confirma que leu e está de acordo com os termos apresentados.")}</small><button className="gradient-button" onClick={accept}>{t("Li e aceito o contrato")}</button></footer></section></div>;
}

function InternalAreaPage({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  const { area = "" } = useParams();
  const [reportCreationVersion, setReportCreationVersion] = useState(1);
  const [invoiceCreationVersion, setInvoiceCreationVersion] = useState(0);
  const [proposalCreationVersion, setProposalCreationVersion] = useState(1);
  const [contractCreationVersion, setContractCreationVersion] = useState(1);
  const [memberCreationVersion, setMemberCreationVersion] = useState(0);
  const page = INTERNAL_AREAS[area];
  if (!session || session.role === "client") return <Navigate to={getDefaultRoute(session)} replace />;
  if (!page || (page.restricted && session.role === "collaborator")) return <Navigate to="/dashboard" replace />;
  const metrics = area === "equipe" ? [{ label: "Papéis", value: "4", note: "Níveis de acesso", icon: <UiIcon name="users" />, tone: "clients" }, { label: "Clientes", value: "—", note: "Atribuições ativas", icon: <UiIcon name="link" />, tone: "posts" }] : area === "relatorios" ? [{ label: "Relatórios", value: "—", note: "Períodos disponíveis", icon: <UiIcon name="file" />, tone: "posts" }, { label: "Indicadores", value: "—", note: "Acompanhe resultados", icon: <UiIcon name="check" />, tone: "approved" }] : area === "faturamento" ? [{ label: "Faturas", value: "—", note: "Lançamentos da operação", icon: <UiIcon name="receipt" />, tone: "pending" }, { label: "Organização", value: "✓", note: "Cobranças centralizadas", icon: <UiIcon name="check" />, tone: "approved" }] : area === "controle-de-tempo" ? [{ label: "Cronômetro", value: "◷", note: "Continua após sair", icon: <UiIcon name="clock" />, tone: "posts" }, { label: "Relatórios", value: "✓", note: "Separados por cliente", icon: <UiIcon name="file" />, tone: "approved" }] : [{ label: "Em andamento", value: "—", note: "Dados desta área", icon: <UiIcon name="clock" />, tone: "pending" }, { label: "Organização", value: "✓", note: "Operação centralizada", icon: <UiIcon name="check" />, tone: "approved" }];
  const content = area === "relatorios" ? <ReportsWorkspace newReportSignal={reportCreationVersion} /> : area === "faturamento" ? <BillingWorkspace session={session} newInvoiceSignal={invoiceCreationVersion} /> : area === "controle-de-tempo" ? <TimeTrackingWorkspace /> : area === "propostas" ? <ProposalsWorkspace newProposalSignal={proposalCreationVersion} /> : area === "contratos" ? <ContractsWorkspace newContractSignal={contractCreationVersion} /> : area === "equipe" ? <TeamManagementWorkspace session={session} newMemberSignal={memberCreationVersion} /> : area === "datas-comemorativas" ? <CommemorativeDatesWorkspace /> : area === "calendario-social" ? <SocialCalendarWorkspace session={session} /> : area === "briefs-design" ? <DesignBriefsWorkspace /> : <section className="internal-area-card glass"><div className="internal-area-empty"><UiIcon name="spark" /><strong>Esta página é privada para o seu nível de acesso.</strong><span>O conteúdo desta área será organizado aqui.</span></div></section>;
  const action = area === "relatorios" ? <button className="gradient-button page-context-action" onClick={() => setReportCreationVersion((current) => current + 1)}>+ Novo relatório</button> : area === "faturamento" ? <button className="gradient-button page-context-action" onClick={() => setInvoiceCreationVersion((current) => current + 1)}>+ Nova fatura</button> : area === "propostas" ? <button className="gradient-button page-context-action" onClick={() => setProposalCreationVersion((current) => current + 1)}>+ Nova proposta</button> : area === "contratos" ? <button className="gradient-button page-context-action" onClick={() => setContractCreationVersion((current) => current + 1)}>+ Novo contrato</button> : area === "equipe" && session.role === "super_admin" ? <button className="gradient-button page-context-action" onClick={() => setMemberCreationVersion((current) => current + 1)}>+ Novo membro</button> : null;
  const titleIcon = area === "equipe" ? <UiIcon name="users" /> : area === "briefs-design" ? <UiIcon name="brush" /> : area === "relatorios" ? <UiIcon name="file" /> : area === "faturamento" ? <UiIcon name="receipt" /> : area === "controle-de-tempo" ? <UiIcon name="clock" /> : area === "propostas" ? <UiIcon name="send" /> : area === "contratos" ? <UiIcon name="check" /> : area === "calendario-social" ? <UiIcon name="calendar" /> : area === "datas-comemorativas" ? <UiIcon name="spark" /> : undefined;
  return <div className="page-grid admin-layout internal-area-layout"><AdminRail session={session} /><main className="main-column"><WorkspaceNavbar session={session} onLogout={onLogout} />{area !== "controle-de-tempo" ? <PageContextBanner eyebrow="Área da operação" title={page.title} description={page.description} metrics={metrics} action={action} titleClassName={["relatorios", "faturamento", "propostas", "equipe", "calendario-social", "briefs-design", "datas-comemorativas", "contratos"].includes(area) ? "billing-banner-title" : undefined} titleIcon={titleIcon} /> : null}{content}</main></div>;
}

type SocialCalendarView = "day" | "week" | "month" | "year";
type SocialCalendarContentFilter = "all" | "posts" | "appointments";

function socialCalendarRange(anchor: Date, view: SocialCalendarView) {
  if (view !== "year") return agendaViewRange(anchor, view);
  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear() + 1, 0, 1);
  const count = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const days = Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  return { from: start.toISOString(), to: end.toISOString(), days };
}

function moveSocialCalendarDate(date: Date, view: SocialCalendarView, direction: -1 | 1) {
  const next = new Date(date);
  if (view === "year") next.setFullYear(next.getFullYear() + direction);
  else if (view === "month") next.setMonth(next.getMonth() + direction);
  else next.setDate(next.getDate() + (view === "week" ? 7 : 1) * direction);
  return next;
}

function formatSocialCalendarTitle(anchor: Date, view: SocialCalendarView) {
  if (view === "year") return String(anchor.getFullYear());
  return formatAgendaRangeTitle(anchor, view);
}

function SocialCalendarWorkspace({ session }: { session: SessionUser }) {
  const [month, setMonth] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<SocialCalendarView>(() => window.matchMedia("(max-width: 820px)").matches ? "week" : "month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [appointments, setAppointments] = useState<AgendaEvent[]>([]);
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [labels, setLabels] = useState<AgendaLabel[]>([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [contentFilter, setContentFilter] = useState<SocialCalendarContentFilter>("all");
  const [selectedPost, setSelectedPost] = useState<CalendarEvent | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AgendaEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [clientAccountId, setClientAccountId] = useState("");
  const [labelId, setLabelId] = useState("");
  const [color, setColor] = useState("#c9f7df");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const artworkHover = useCalendarArtworkHover();
  const range = useMemo(() => socialCalendarRange(month, calendarView), [month, calendarView]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      loadCalendarOverview(range.from.slice(0, 10), range.to.slice(0, 10)),
      loadAgendaEvents(range.from, range.to),
      listAdminClients().catch(() => ({ items: [] })),
      loadAgendaLabels().catch(() => ({ items: [] })),
    ])
      .then(([calendar, agenda, clientResult, labelResult]) => {
        if (!active) return;
        setEvents(calendar.events);
        setAppointments(expandAgendaEvents(agenda.items, range.from, range.to));
        setClients(clientResult.items);
        setLabels(labelResult.items);
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
        setAppointments([]);
        setError("Não foi possível carregar os itens agora. Tente novamente em instantes.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to, refresh]);

  const selectedClientRecord = clients.find((client) => client.slug === selectedClient);
  const visibleEvents = events.filter((event) => (selectedClient === "all" || event.clientSlug === selectedClient) && contentFilter !== "appointments");
  const visibleAppointments = appointments.filter((event) => (selectedClient === "all" || event.clientAccountId === selectedClientRecord?.id) && contentFilter !== "posts");
  const eventsByDay = new Map<string, CalendarEvent[]>();
  const appointmentsByDay = new Map<string, AgendaEvent[]>();
  visibleEvents.forEach((event) => { const key = event.publishDate.slice(0, 10); eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]); });
  visibleAppointments.forEach((event) => { const key = localDateKey(new Date(event.startsAt)); appointmentsByDay.set(key, [...(appointmentsByDay.get(key) ?? []), event]); });
  const mobileDays = calendarView === "year"
    ? range.days.filter((day) => (eventsByDay.get(localDateKey(day))?.length ?? 0) + (appointmentsByDay.get(localDateKey(day))?.length ?? 0) > 0)
    : calendarView === "month"
      ? range.days.filter((day) => day.getMonth() === month.getMonth() && day.getFullYear() === month.getFullYear())
      : range.days;

  function openCreateForDay(day = new Date()) {
    const date = new Date(day);
    date.setHours(9, 0, 0, 0);
    setTitle(""); setDescription(""); setStartsAt(toDateTimeLocal(date.toISOString())); setClientAccountId(selectedClientRecord?.id ?? ""); setLabelId(""); setColor("#c9f7df"); setError(""); setCreateOpen(true);
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.source !== "api") { setError("Entre com sua conta para salvar este compromisso no calendário."); return; }
    if (!title.trim() || !startsAt) { setError("Informe o nome e a data do compromisso."); return; }
    setSaving(true); setError("");
    try {
      await createAgendaEvent({ title: title.trim(), taskDescription: description.trim() || null, startsAt, color, clientAccountId: clientAccountId || null, labelId: labelId || null, recurrenceType: "none" });
      setCreateOpen(false); setRefresh((value) => value + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar o compromisso."); }
    finally { setSaving(false); }
  }

  const totalVisible = visibleEvents.length + visibleAppointments.length;
  return <section className="social-calendar-workspace glass">
    <header className="social-calendar-toolbar">
      <div className="social-calendar-month-nav"><button onClick={() => setMonth((value) => moveSocialCalendarDate(value, calendarView, -1))} aria-label="Período anterior">‹</button><h2>{formatSocialCalendarTitle(month, calendarView)}</h2><button onClick={() => setMonth((value) => moveSocialCalendarDate(value, calendarView, 1))} aria-label="Próximo período">›</button></div>
      <div className="social-calendar-filters"><label>Cliente<select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}><option value="all">Todos os clientes</option>{clients.map((client) => <option key={client.id} value={client.slug}>{client.name}</option>)}</select></label><button className="ghost-button" onClick={() => setMonth(new Date())}>Hoje</button></div>
    </header>
    <nav className="social-calendar-view-switch" aria-label="Visualização do calendário">{(["day", "week", "month", "year"] as SocialCalendarView[]).map((view) => <button key={view} className={calendarView === view ? "active" : ""} onClick={() => setCalendarView(view)}>{view === "day" ? "Dia" : view === "week" ? "Semana" : view === "month" ? "Mês" : "Ano"}</button>)}</nav>
    <div className="social-calendar-summary"><span><i className="scheduled" /> Post agendado</span><span><i className="pending" /> Compromisso</span><strong>{loading ? "Carregando..." : `${totalVisible} ${totalVisible === 1 ? "item no período" : "itens no período"}`}</strong></div>
    <div className="social-calendar-mobile-filters"><label>Mostrar<select value={contentFilter} onChange={(event) => setContentFilter(event.target.value as SocialCalendarContentFilter)}><option value="all">Tudo</option><option value="posts">Posts</option><option value="appointments">Compromissos</option></select></label><button className="gradient-button" onClick={() => openCreateForDay()}>＋ Compromisso</button></div>
    {error && !createOpen ? <p className="form-feedback error-text">{error}</p> : null}
    <div className="social-calendar-desktop"><div className="social-calendar-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div><div className="social-calendar-grid">{range.days.map((day) => { const key = localDateKey(day); const dayEvents = eventsByDay.get(key) ?? []; const inMonth = day.getMonth() === month.getMonth(); return <article key={key} className={inMonth ? "social-calendar-day" : "social-calendar-day muted"}><time>{day.getDate()}</time>{dayEvents.slice(0, 4).map((event) => <button key={event.id} type="button" className="social-calendar-event" style={{ "--calendar-event-color": event.color ?? "#6861e8" } as CSSProperties} onMouseEnter={(mouseEvent) => event.mediaUrls?.[0] ? artworkHover.show(mouseEvent, event.mediaUrls[0], event.title) : undefined} onMouseMove={(mouseEvent) => event.mediaUrls?.[0] ? artworkHover.move(mouseEvent, event.mediaUrls[0], event.title) : undefined} onMouseLeave={artworkHover.hide} onClick={() => setSelectedPost(event)}><span>{event.title}</span><small>{event.clientName ?? "Cliente"}</small></button>)}{dayEvents.length > 4 ? <b className="social-calendar-more">+{dayEvents.length - 4} mais</b> : null}</article>; })}</div></div>
    <div className="social-calendar-mobile">{mobileDays.length ? mobileDays.map((day) => { const key = localDateKey(day); const dayPosts = eventsByDay.get(key) ?? []; const dayAppointments = appointmentsByDay.get(key) ?? []; const isToday = key === localDateKey(new Date()); return <article className={`social-agenda-day${isToday ? " today" : ""}`} key={key}><header><div><time>{day.getDate()}</time><span><strong>{new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(day)}</strong><small>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(day)}</small></span></div><button onClick={() => openCreateForDay(day)} aria-label={`Adicionar compromisso em ${new Intl.DateTimeFormat("pt-BR").format(day)}`}>＋</button></header><div className="social-agenda-items">{dayPosts.map((post) => <button key={post.id} className="social-agenda-item post" onClick={() => setSelectedPost(post)}><span className="social-agenda-time">{post.publishTime?.slice(0, 5) || "Post"}</span>{post.mediaUrls?.[0] ? <img src={post.mediaUrls[0]} alt="" /> : <i><UiIcon name="send" /></i>}<span><strong>{post.title}</strong><small>{post.clientName ?? "Cliente"} · Post agendado</small></span><b>›</b></button>)}{dayAppointments.map((appointment) => <button key={appointment.id} className="social-agenda-item appointment" style={{ "--calendar-event-color": appointment.color } as CSSProperties} onClick={() => setSelectedAppointment(appointment)}><span className="social-agenda-time">{formatAgendaTime(appointment.startsAt)}</span><i><UiIcon name="clock" /></i><span><strong>{appointment.title}</strong><small>{appointment.clientName || appointment.labelName || "Compromisso"}</small></span><b>›</b></button>)}{dayPosts.length + dayAppointments.length === 0 ? <button className="social-agenda-empty" onClick={() => openCreateForDay(day)}>＋ Adicionar compromisso</button> : null}</div></article>; }) : <div className="social-agenda-year-empty"><UiIcon name="calendar" /><strong>Nenhum item neste ano</strong><button className="gradient-button" onClick={() => openCreateForDay()}>Adicionar compromisso</button></div>}</div>
    {createOpen ? createPortal(<div className="modal-backdrop agenda-modal-backdrop" onMouseDown={() => { if (!saving) setCreateOpen(false); }}><form className="agenda-create-modal social-agenda-create-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submitAppointment}><div className="column-editor-head"><div><p className="eyebrow">Agenda social</p><h3>Novo compromisso</h3></div><button type="button" className="icon-close" onClick={() => setCreateOpen(false)} aria-label="Fechar">×</button></div><label className="field-stack">Nome<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Revisar pauta do cliente" /></label><label className="field-stack">Descrição<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detalhes do compromisso" /></label><label className="field-stack">Data e horário<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label className="field-stack">Cliente<select value={clientAccountId} onChange={(event) => setClientAccountId(event.target.value)}><option value="">Sem cliente específico</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="field-stack">Etiqueta<select value={labelId} onChange={(event) => { const next = event.target.value; setLabelId(next); const label = labels.find((item) => item.id === next); if (label) setColor(label.color); }}><option value="">Sem etiqueta</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>{error ? <p className="form-feedback error-text">{error}</p> : null}<button className="gradient-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Adicionar compromisso"}</button></form></div>, document.body) : null}
    {selectedPost ? createPortal(<div className="modal-backdrop" onMouseDown={() => setSelectedPost(null)}><section className="agenda-detail-modal social-agenda-detail-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Post agendado</p><h3>{selectedPost.title}</h3></div><button className="icon-close" onClick={() => setSelectedPost(null)} aria-label="Fechar">×</button></header>{selectedPost.mediaUrls?.[0] ? <img className="social-agenda-detail-image" src={selectedPost.mediaUrls[0]} alt={selectedPost.title} /> : null}<dl><div><dt>Quando</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(`${selectedPost.publishDate.slice(0, 10)}T12:00:00`))}{selectedPost.publishTime ? ` às ${selectedPost.publishTime.slice(0, 5)}` : ""}</dd></div><div><dt>Cliente</dt><dd>{selectedPost.clientName ?? "Cliente"}</dd></div><div><dt>Status</dt><dd>{selectedPost.status}</dd></div></dl></section></div>, document.body) : null}
    {selectedAppointment ? createPortal(<div className="modal-backdrop" onMouseDown={() => setSelectedAppointment(null)}><section className="agenda-detail-modal social-agenda-detail-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Compromisso</p><h3>{selectedAppointment.title}</h3></div><button className="icon-close" onClick={() => setSelectedAppointment(null)} aria-label="Fechar">×</button></header><p>{selectedAppointment.taskDescription || "Sem descrição."}</p><dl><div><dt>Quando</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedAppointment.startsAt))}</dd></div><div><dt>Cliente</dt><dd>{selectedAppointment.clientName || "Sem cliente específico"}</dd></div><div><dt>Etiqueta</dt><dd>{selectedAppointment.labelName || "Sem etiqueta"}</dd></div></dl></section></div>, document.body) : null}
    {artworkHover.preview}
  </section>;
}

type TeamRole = ManagedUser["globalRole"];
type TeamClient = { id: string; name: string; slug: string };

const TEAM_ROLE_COPY: Record<TeamRole, { label: string; tone: string }> = {
  super_admin: { label: "Super Admin", tone: "super-admin" },
  admin: { label: "Admin", tone: "admin" },
  colaborador: { label: "Colaborador", tone: "collaborator" },
  cliente: { label: "Cliente", tone: "client" },
};

const DEMO_TEAM_CLIENTS: TeamClient[] = [
  { id: "aplikasi", name: "Aplikasi", slug: "aplikasi" },
  { id: "minas-home-ads", name: "Minas Home ADS", slug: "minas-home-ads" },
  { id: "podcast-lider-de-elite", name: "Podcast Líder de Elite", slug: "podcast-lider-de-elite" },
  { id: "serena-genovese", name: "Serena Genovese", slug: "serena-genovese" },
];

function TeamManagementWorkspace({ session, newMemberSignal = 0 }: { session: SessionUser; newMemberSignal?: number }) {
  const demoMembers = (): ManagedUser[] => demoUsers.map((user) => ({
    id: user.id, fullName: user.name, email: user.email, globalRole: user.role === "collaborator" ? "colaborador" : user.role === "client" ? "cliente" : user.role,
    locale: user.locale, isActive: true, createdAt: "2026-08-23",
  }));
  const [members, setMembers] = useState<ManagedUser[]>(() => session.source === "api" ? [] : demoMembers());
  const [clients, setClients] = useState<TeamClient[]>(() => session.source === "api" ? [] : DEMO_TEAM_CLIENTS);
  const [assignments, setAssignments] = useState<Record<string, string[]>>(() => session.source === "api" ? {} : Object.fromEntries(demoUsers.map((user) => [user.id, [...user.assignedAdminSlugs, ...user.assignedPortalSlugs]])));
  const [filter, setFilter] = useState<"all" | TeamRole>("all");
  const [modal, setModal] = useState<"new" | "role" | "clients" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "colaborador" as TeamRole, clientIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refreshTeam = useCallback(async () => {
    const [users, clientResult] = await Promise.all([listManagedUsers(), listAdminClients()]);
    const nextClients = clientResult.items.map((client) => ({ id: client.id, name: client.name, slug: client.slug }));
    const accessLists = await Promise.all(nextClients.map((client) => loadClientAccesses(client.id)));
    const nextAssignments: Record<string, string[]> = {};
    accessLists.forEach((result) => result.accesses.forEach((access) => {
      nextAssignments[access.userId] = [...(nextAssignments[access.userId] ?? []), result.client.slug];
    }));
    setMembers(users.items.filter((user) => user.isActive));
    setClients(nextClients);
    setAssignments(nextAssignments);
  }, []);

  useEffect(() => {
    if (session.source !== "api") return;
    void refreshTeam().catch((cause) => {
      setMembers([]); setClients([]); setAssignments({});
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a equipe.");
    });
  }, [refreshTeam, session.source]);

  const selected = members.find((member) => member.id === selectedId) ?? null;
  const visibleMembers = filter === "all" ? members : members.filter((member) => member.globalRole === filter);
  const canManage = session.role === "super_admin";
  const assignedClients = (memberId: string) => (assignments[memberId] ?? []).map((slug) => clients.find((client) => client.slug === slug)).filter(Boolean) as TeamClient[];

  const openModal = (next: "new" | "role" | "clients", member?: ManagedUser) => {
    setError("");
    setSelectedId(member?.id ?? null);
    setForm(member ? { fullName: member.fullName, email: member.email, password: "", role: member.globalRole, clientIds: assignments[member.id] ?? [] } : { fullName: "", email: "", password: "", role: "colaborador", clientIds: [] });
    setModal(next);
  };

  useEffect(() => { if (newMemberSignal > 0) openModal("new"); }, [newMemberSignal]);

  const toggleClient = (slug: string) => setForm((current) => {
    const selectedIds = current.clientIds.includes(slug) ? current.clientIds.filter((item) => item !== slug) : [...current.clientIds, slug];
    return { ...current, clientIds: selectedIds };
  });

  const selectedClientDatabaseIds = () => form.clientIds.map((slug) => clients.find((client) => client.slug === slug)?.id).filter(Boolean) as string[];

  const save = async () => {
    if (!modal || saving) return;
    if (modal === "new" && (!form.fullName.trim() || !form.email.trim() || form.password.length < 8)) {
      setError("Preencha nome e e-mail e use uma senha com pelo menos 8 caracteres.");
      return;
    }
    setSaving(true); setError("");
    try {
      const clientAccountIds = form.role === "super_admin" ? [] : selectedClientDatabaseIds();
      if (modal === "new") {
        await createManagedUser({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password, globalRole: form.role, locale: "pt", clientAccountIds });
      } else if (selected) {
        await updateManagedUser(selected.id, { fullName: selected.fullName, globalRole: form.role, clientAccountIds });
      }
      await refreshTeam();
      setModal(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as alterações.");
    } finally { setSaving(false); }
  };

  const remove = async (member: ManagedUser) => {
    if (!window.confirm(`Remover ${member.fullName} da equipe?`)) return;
    setError("");
    try {
      await deactivateManagedUser(member.id);
      await refreshTeam();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover este acesso."); }
  };

  return <section className="team-management">
    <nav className="team-filters" aria-label="Filtrar membros por papel">
      {(["all", "super_admin", "admin", "colaborador", "cliente"] as const).map((role) => {
        const count = role === "all" ? members.length : members.filter((member) => member.globalRole === role).length;
        const label = role === "all" ? "Todos" : TEAM_ROLE_COPY[role].label;
        return <button key={role} className={filter === role ? "active" : ""} onClick={() => setFilter(role)}>{label} <span>{count}</span></button>;
      })}
    </nav>

    {error && !modal ? <p className="team-feedback error-text">{error}</p> : null}

    <div className="team-member-list">
      {visibleMembers.map((member) => {
        const role = TEAM_ROLE_COPY[member.globalRole];
        const memberClients = assignedClients(member.id);
        return <article key={member.id} className="team-member-card glass">
          <div className="team-member-summary"><div className="team-member-avatar">{member.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div><div className="team-member-name"><h2>{member.fullName}</h2><span className={`team-role-badge ${role.tone}`}>{role.label}</span></div><p>{member.email}</p><div className="team-client-chips">{member.globalRole === "super_admin" ? <span className="team-all-clients">Acesso a todos os clientes</span> : memberClients.length ? memberClients.map((client) => <span key={client.id}>{client.name}</span>) : <span className="team-no-clients">Nenhum cliente atribuído</span>}</div></div></div>
          {canManage && member.id !== session.id ? <div className="team-member-actions"><button onClick={() => openModal("role", member)}><UiIcon name="users" /> Papel</button><button onClick={() => openModal("clients", member)}><UiIcon name="pencil" /> Atribuir clientes</button><button className="danger" onClick={() => void remove(member)} aria-label={`Remover ${member.fullName}`}><UiIcon name="trash" /></button></div> : null}
        </article>;
      })}
    </div>

    {modal ? createPortal(<div className="modal-backdrop team-modal-backdrop" onMouseDown={() => setModal(null)}><section className="team-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">{modal === "new" ? "Novo acesso" : modal === "role" ? "Nível de acesso" : "Clientes atribuídos"}</p><h2>{modal === "new" ? "Adicionar membro" : selected?.fullName}</h2></div><button onClick={() => setModal(null)} aria-label="Fechar">×</button></header>
      {modal === "new" ? <div className="team-form-fields"><label>Nome completo<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Senha inicial<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div> : null}
      {modal !== "clients" ? <fieldset className="team-role-options"><legend>Papel</legend>{(Object.keys(TEAM_ROLE_COPY) as TeamRole[]).map((role) => <label key={role} className={form.role === role ? "selected" : ""}><input type="radio" checked={form.role === role} onChange={() => setForm((current) => ({ ...current, role, clientIds: role === "super_admin" ? [] : current.clientIds }))} /><span><b>{TEAM_ROLE_COPY[role].label}</b><small>{role === "super_admin" ? "Acesso total à operação" : role === "admin" ? "Gerencia clientes atribuídos" : role === "colaborador" ? "Trabalha nos clientes atribuídos" : "Acessa o próprio portal"}</small></span></label>)}</fieldset> : null}
      {form.role !== "super_admin" ? <fieldset className="team-client-options"><legend>Clientes atribuídos</legend>{clients.map((client) => <label key={client.id}><input type="checkbox" checked={form.clientIds.includes(client.slug)} onChange={() => toggleClient(client.slug)} /><span>{client.name}</span></label>)}</fieldset> : null}
      {error ? <p className="team-feedback error-text">{error}</p> : null}
      <footer><button className="team-cancel" disabled={saving} onClick={() => setModal(null)}>Cancelar</button><button className="gradient-button" disabled={saving} onClick={() => void save()}>{saving ? "Salvando..." : modal === "new" ? "Criar membro" : "Salvar alterações"}</button></footer>
    </section></div>, document.body) : null}
  </section>;
}

function PublicApprovalPage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<Awaited<ReturnType<typeof loadPublicApproval>> | null>(null);
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadPublicApproval(token).then(setView).catch((error) => setMessage(error instanceof Error ? error.message : "Link inválido."));
  }, [token]);

  async function decide(approved: boolean) {
    setWorking(true);
    setMessage("");
    try {
      await submitPublicApproval(token, { approved, commentText: comment.trim() || undefined, requesterName: name.trim() || undefined });
      setMessage(approved ? "Post aprovado. Obrigada pelo retorno!" : "Pedido de alteração enviado para a equipe.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar sua resposta.");
    } finally {
      setWorking(false);
    }
  }

  if (!view) return <main className="public-approval-page"><section className="public-approval-card"><h1>{message || "Abrindo seu post..."}</h1></section></main>;
  const card = mapPublicApprovalCard(view.card);
  return <main className="public-approval-page"><section className="public-approval-card"><p className="eyebrow">{view.account.name}</p><h1>{card.title}</h1>{card.mediaUrl ? <div className={`media-frame ${card.mediaAspect}`}><img src={card.mediaUrl} alt={card.title} /></div> : null}<div className="public-caption">{card.subtitle || "Sem legenda cadastrada."}</div><label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como prefere ser identificado?" /></label><label>Comentário<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Deixe uma observação, se desejar" /></label><div className="public-approval-actions"><button className="gradient-button" disabled={working} onClick={() => decide(true)}>Aprovar</button><button className="danger-button" disabled={working} onClick={() => decide(false)}>Solicitar alteração</button></div>{message ? <p className="form-feedback">{message}</p> : null}</section></main>;
}

function mapPublicApprovalCard(card: { id: string; title: string; caption: string | null; mediaType: string; primaryMediaUrl: string | null; mediaUrls: string[]; externalLinkUrl: string | null; artType: string; status: string[]; tags: string[]; commentsCount: number; scheduledAt: string | null; clientLabel: string }) {
  const descriptor = `${card.artType} ${card.mediaType}`.toLowerCase();
  return {
    title: card.title,
    subtitle: card.caption ?? undefined,
    mediaUrl: card.primaryMediaUrl ?? card.mediaUrls[0],
    mediaAspect: descriptor.includes("reels") || descriptor.includes("story") ? "portrait" as const : descriptor.includes("carrossel") || descriptor.includes("post") ? "square" as const : "landscape" as const,
  };
}

export function App() {
  const [session, setSession] = useState<SessionUser | null>(() => readStoredSession());
  const [bootingSession, setBootingSession] = useState(() => readStoredSession() === null && Boolean(readStoredAccessToken()));
  const [globalSuccess, setGlobalSuccess] = useState<{ id: string; title: string; detail: string; tone?: "success" | "neutral" } | null>(null);
  const showGlobalHeader = bootingSession;

  useEffect(() => {
    const showSuccess = (event: Event) => setGlobalSuccess((event as CustomEvent<{ id: string; title: string; detail: string; tone?: "success" | "neutral" }>).detail);
    window.addEventListener("design-hub:success", showSuccess);
    return () => window.removeEventListener("design-hub:success", showSuccess);
  }, []);
  useEffect(() => {
    if (!globalSuccess) return;
    const timeout = window.setTimeout(() => setGlobalSuccess(null), 2_600);
    return () => window.clearTimeout(timeout);
  }, [globalSuccess]);

  useEffect(() => {
    const closeTopModalOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('[class*="backdrop"]'))
        .filter((element) => element.getClientRects().length > 0)
        .map((element, index) => ({
          element,
          index,
          zIndex: Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0,
        }))
        .sort((left, right) => left.zIndex - right.zIndex || left.index - right.index);
      const overlay = overlays[overlays.length - 1]?.element;
      if (!overlay) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const closeButton = overlay.querySelector<HTMLButtonElement>(
        '[data-modal-close], button[aria-label^="Fechar"], .icon-close, .card-column-modal-close, .media-preview-close, header button',
      );
      if (closeButton) {
        closeButton.click();
        return;
      }
      overlay.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      overlay.click();
    };

    window.addEventListener("keydown", closeTopModalOnEscape, true);
    return () => window.removeEventListener("keydown", closeTopModalOnEscape, true);
  }, []);

  useEffect(() => {
    let active = true;
    const accessToken = readStoredAccessToken();
    const storedSession = readStoredSession();

    if (!accessToken) {
      setBootingSession(false);
      return;
    }

    restoreApiSession(accessToken)
      .then((restored) => {
        if (!active) return;
        if (restored) {
          setSession(restored);
          persistSession(restored);
        } else {
          setSession((current) => (current?.source === "demo" ? current : null));
          if (!storedSession || storedSession.source !== "demo") {
            persistSession(null);
          }
        }
      })
      .finally(() => {
        if (!active) return;
        setBootingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(email: string, password: string) {
    const apiSession = await loginWithApi(email, password).catch(() => null);
    if (apiSession) {
      setSession(apiSession);
      persistSession(apiSession);
      return true;
    }

    const matched = demoUsers.find((user) => user.email === email && user.password === password);
    if (!matched) return false;
    const demoSession = {
      ...matched,
      source: "demo" as const,
      accessToken: null,
    };
    setSession(demoSession);
    persistSession(demoSession);
    return true;
  }

  function handleLogout() {
    setSession(null);
    persistSession(null);
  }

  if (bootingSession) {
    return (
      <div className="app-shell">
        <div className="background-orb orb-one" />
        <div className="background-orb orb-two" />
        <AppHeader session={session} onLogout={handleLogout} />
        <main className="center-shell">
          <section className="glass access-card">
            <p className="eyebrow">Sessão da V2</p>
            <h2>Reconectando seu acesso</h2>
            <p className="hero-copy">
              Estou validando a sessão diretamente na API local para restaurar o perfil correto.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />
      {showGlobalHeader ? <AppHeader session={session} onLogout={handleLogout} /> : null}

      <Routes>
        <Route path="/" element={<Navigate to={getDefaultRoute(session)} replace />} />
        <Route path="/contas" element={<PortalAccountPicker session={session} onLogout={handleLogout} />} />
        <Route path="/login" element={<LoginPage session={session} onLogin={handleLogin} />} />
        <Route path="/reset-password" element={<PasswordResetPage />} />
        <Route path="/approval/:token" element={<PublicApprovalPage />} />
        <Route path="/proposta/:token" element={<PublicProposalPage />} />
        <Route path="/dashboard" element={<DashboardRoutePage session={session} onLogout={handleLogout} />} />
        <Route path="/admin/:slug" element={<AdminRoutePage session={session} onLogout={handleLogout} />} />
        <Route path="/area/:area" element={<InternalAreaPage session={session} onLogout={handleLogout} />} />
        <Route path="/portal/:slug" element={<ClientPortalRoutePage session={session} onLogout={handleLogout} />} />
        <Route path="/agenda" element={<AgendaPage session={session} onLogout={handleLogout} />} />
      </Routes>
      {globalSuccess ? <div key={globalSuccess.id} className={`global-success-notice ${globalSuccess.tone === "neutral" ? "is-neutral" : ""}`} role="status" aria-live="polite"><span className="global-success-icon"><UiIcon name="check" /></span><div><strong>{globalSuccess.title}</strong><small>{globalSuccess.detail}</small></div></div> : null}
    </div>
  );
}
