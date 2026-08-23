import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
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
  submitAdminCardDecisionBySlug,
  submitPortalCardDecisionBySlug,
  updateAdminColumnBySlug,
  updateAdminCardBySlug,
  createAdminApprovalLinkBySlug,
  moveAdminCardBySlug,
  archiveAdminCardBySlug,
  setAdminCardArchivedBySlug,
  listAdminClients,
  createAdminClient,
  updateAdminClient,
  deleteAdminClient,
  createManagedClientUser,
  loadClientAccesses,
  listManagedUsers,
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
  type DashboardSubmission,
  type DashboardUpcomingPost,
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
  type BrandBrain,
  createAgendaLabel,
  deleteAgendaLabel,
  loadAgendaLabels,
  type AdminClientOption,
  type ClientAccess,
  type ManagedUser,
  type ClientTrackerSettings,
  uploadAdminMedia,
  loadAdminWorkspaceDrawerBySlug,
  saveAdminWorkspaceDrawerBySlug,
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
  listPortalTextCommentsBySlug,
  addPortalTextCommentBySlug,
  submitPortalTextDecisionBySlug,
  listPortalReportsBySlug,
  type TextComment,
  type TextDocument,
} from "./api";
import { ACCESS_TOKEN_KEY, loginWithApi, restoreApiSession } from "./authApi";
import { demoUsers } from "./mockData";
import type {
  AdminWorkspacePreview,
  BoardCard,
  BoardColumn,
  CardDetail,
  CalendarEvent,
  ClientPortalPreview,
  SessionUser,
} from "./types";
import { usePreviewResource } from "./usePreviewResource";
import { PortalReports, ReportsWorkspace } from "./ReportsWorkspace";
import { BILLING_PENDING_LINE_KEY, BillingInvoiceDocument, BillingWorkspace, formatBillingDate, formatBillingMoney, getBillingInvoiceTotal, loadClientVisibleInvoices, type BillingInvoice, type BillingLineRequest } from "./BillingWorkspace";
import liegePaschoaliniLogo from "./assets/liege-paschoalini-logo.png";
import designHubV2Logo from "./assets/design-hub-v2-logo.png";

const SESSION_KEY = "designhub-v2-session";
const DEV_USER_ID_KEY = "designhub-v2-dev-user-id";
const MAX_MEDIA_FILE_SIZE = 12 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 20 * 1024 * 1024;
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
  widgets: {
    upcomingPosts: false,
    tracking: false,
    invoices: false,
    reports: false,
    brandBrain: false,
    search: false,
  },
  boardColumns: [],
  withoutColumn: [],
  calendarEvents: [],
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
    return `/portal/${session.assignedPortalSlugs[0] ?? "serena-genovese"}`;
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

function WorkspaceNavbar({ session, onLogout, onCreateClient, clientKanban = false, workspaceContext }: { session: SessionUser; onLogout: () => void; onCreateClient?: () => void; clientKanban?: boolean; workspaceContext?: ReactNode }) {
  return <div className={`dashboard-nav workspace-navbar${clientKanban ? " client-kanban-navbar" : ""}`}>
    {!clientKanban ? <NavLink to="/dashboard" className="dashboard-nav-brand" aria-label="Abrir dashboard"><span className="brand-badge"><img src={designHubV2Logo} alt="Design Hub" /></span><strong>Design Hub</strong></NavLink> : null}
    {workspaceContext}
    <nav className="dashboard-nav-links" aria-label="Navegação da operação"><NavLink to="/area/equipe">Equipe</NavLink><NavLink to={`/admin/${session.assignedAdminSlugs[0] ?? "aplikasi"}`}>Social</NavLink></nav>
    {onCreateClient ? <button className="gradient-button dashboard-create-button" onClick={onCreateClient}>＋ Clientes</button> : <NavLink className="gradient-button dashboard-create-button" to="/dashboard">Clientes</NavLink>}
    <div className="dashboard-user"><button className="dashboard-icon-button" type="button" aria-label="Links rápidos"><UiIcon name="link" /></button><button className="dashboard-icon-button has-notification" type="button" aria-label="Notificações"><UiIcon name="bell" /><span aria-hidden="true" /></button><ProfileMenu session={session} onLogout={onLogout} /></div>
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
  const setSelectorOpen = (next: boolean) => {
    setOpen(next);
  };

  return <div className="workspace-selector workspace-selector-banner">
    <button className="workspace-chip glass-subtle" onClick={() => setSelectorOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
      <div className="workspace-avatar">{clientName.slice(0, 2).toUpperCase()}</div>
      <div className="workspace-copy"><strong>{clientName}</strong><span>Workspace atual</span></div>
      <UiIcon name="chevron-down" className="workspace-caret" />
    </button>
    {open ? <div className="workspace-selector-menu" role="listbox">{options.length ? options.map((client) => {
      const isCurrentClient = client.slug === slug;
      return <button key={client.id} className={isCurrentClient ? "selected" : ""} onClick={() => { setSelectorOpen(false); navigate(isCurrentClient ? `/portal/${client.slug}` : `/admin/${client.slug}`); }} title={isCurrentClient ? "Abrir área do cliente" : "Abrir Kanban deste cliente"}>
        <span>{client.name.slice(0, 2).toUpperCase()}</span><strong>{client.name}</strong>{isCurrentClient ? <em>Ver área do cliente</em> : null}
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
    "Calendario",
    "Pautas",
    "Relatorios",
    "Faturamento",
    session.role === "super_admin" ? "Visao global" : "Espaco pessoal",
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
          ? "Controle total da operacao."
          : session.role === "admin"
            ? "Acesso aos clientes atribuidos e paginas pessoais."
            : "Acesso apenas aos clientes atribuidos e sem criacao de clientes."}
      </p>
    </aside>
  );
}

function AdminRail({ session }: { session: SessionUser }) {
  const items = [
    { icon: "grid" as const, to: "/dashboard", label: "Dashboard" },
    { icon: "file" as const, to: "/area/relatorios", label: "Relatórios" },
    ...(session.role === "super_admin" || session.role === "admin" ? [
      { icon: "clock" as const, to: "/area/faturamento", label: "Faturamento" },
      { icon: "send" as const, to: "/area/propostas", label: "Propostas" },
      { icon: "check" as const, to: "/area/contratos", label: "Contratos" },
    ] : []),
    { icon: "spark" as const, to: "/area/datas-comemorativas", label: "Datas comemorativas" },
    { icon: "file" as const, to: "/area/briefs-design", label: "Briefs de design" },
    { icon: "calendar" as const, to: "/area/calendario-social", label: "Calendário social" },
    { icon: "users" as const, to: "/area/equipe", label: "Equipe" },
  ];

  return (
    <aside className="admin-rail glass">
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
      </div>
      <div className="admin-rail-foot">
        <button className="admin-rail-button">
          <UiIcon name="chevron-left" className="admin-rail-glyph" />
        </button>
      </div>
    </aside>
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
    { label: "Midia", icon: "image" as const },
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
type DrawerDraft = { id: string; text: string; attachmentUrl?: string };
type PautaIdea = { id: string; title: string; description: string; caption: string; createdAt: string; status?: "draft" | "sent" };
type WorkspaceDrawerData = { notes: string[]; links: DrawerLink[]; quick: DrawerLink[]; draftsByUser: Record<string, DrawerDraft[]>; pautaIdeas: PautaIdea[] };
type KanbanAutomation = { id: string; name: string; enabled: boolean; triggerType: "tag_added" | "column_moved"; triggerValue: string; actionType: "add_tag" | "move_column" | "change_color"; actionValue: string };

const EMPTY_DRAWER: WorkspaceDrawerData = { notes: [], links: [], quick: [], draftsByUser: {}, pautaIdeas: [] };

function WorkspaceDrawer({ slug, userId, initialQuickLinks, columns, tags }: { slug: string; userId: string; initialQuickLinks: Array<{ label: string; href: string }>; columns: BoardColumn[]; tags: ClientTagDefinition[] }) {
  const [tab, setTab] = useState<"notes" | "drafts" | "links" | "quick" | "ideas" | "tracker" | "progress">("quick");
  const [isOpen, setIsOpen] = useState(false);
  const [drawer, setDrawer] = useState<WorkspaceDrawerData>(EMPTY_DRAWER);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
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
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);
  useEffect(() => { let active = true; loadAdminWorkspaceDrawerBySlug(slug).then((result) => {
    if (!active) return;
    const saved = result.data as Partial<WorkspaceDrawerData> | null;
    setDrawer({ ...EMPTY_DRAWER, ...saved, quick: saved?.quick ?? initialQuickLinks.map((link) => ({ id: crypto.randomUUID(), type: "link" as const, title: link.label, url: link.href })), draftsByUser: saved?.draftsByUser ?? {}, pautaIdeas: saved?.pautaIdeas ?? [] }); setLoaded(true);
  }).catch(() => setLoaded(true)); return () => { active = false; }; }, [slug]);
  useEffect(() => { loadAdminKanbanAutomationsBySlug(slug).then((result) => setAutomations((result.items as KanbanAutomation[]) ?? [])).catch(() => setAutomations([])); }, [slug]);
  useEffect(() => { loadAdminTrackerSettingsBySlug(slug).then((result) => setTrackingActive(result.settings.trackingEnabled)).catch(() => setTrackingActive(false)); }, [slug]);
  const persist = (next: WorkspaceDrawerData) => {
    setDrawer(next);
    // Keeps the dashboard shortcut in sync with the Kanban's single link source.
    window.dispatchEvent(new CustomEvent("design-hub:workspace-links-updated", { detail: { slug, links: next.links } }));
    void saveAdminWorkspaceDrawerBySlug(slug, next);
  };
  const items = tab === "quick" ? drawer.quick : tab === "links" ? drawer.links : [];
  const drafts = drawer.draftsByUser[userId] ?? [];
  const resetTextEditor = () => { setText(""); setEditingNoteIndex(null); setEditingDraftId(null); };
  const saveText = () => {
    const value = text.trim();
    if (!value) return;
    if (tab === "notes") {
      const notes = editingNoteIndex === null ? [value, ...drawer.notes] : drawer.notes.map((note, index) => index === editingNoteIndex ? value : note);
      persist({ ...drawer, notes });
    }
    if (tab === "drafts") {
      const nextDrafts = editingDraftId === null
        ? [{ id: crypto.randomUUID(), text: value }, ...drafts]
        : drafts.map((draft) => draft.id === editingDraftId ? { ...draft, text: value } : draft);
      persist({ ...drawer, draftsByUser: { ...drawer.draftsByUser, [userId]: nextDrafts } });
    }
    resetTextEditor();
  };
  const editNote = (note: string, index: number) => { setText(note); setEditingNoteIndex(index); };
  const editDraft = (draft: DrawerDraft) => { setText(draft.text); setEditingDraftId(draft.id); };
  const deleteNote = (index: number) => persist({ ...drawer, notes: drawer.notes.filter((_, noteIndex) => noteIndex !== index) });
  const deleteDraft = (id: string) => persist({ ...drawer, draftsByUser: { ...drawer.draftsByUser, [userId]: drafts.filter((draft) => draft.id !== id) } });
  const addDraftAttachment = async (file: File | null) => { if (!file) return; const attachmentUrl = await uploadAdminMedia(file); persist({ ...drawer, draftsByUser: { ...drawer.draftsByUser, [userId]: [{ id: crypto.randomUUID(), text: text.trim() || file.name, attachmentUrl }, ...drafts] } }); setText(""); };
  const addLink = (type: "heading" | "link") => { const title = type === "heading" ? "Novo título" : "Novo link"; const next = [...items, { id: crypto.randomUUID(), type, title, url: type === "link" ? "https://" : undefined }]; persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const updateLink = (id: string, changes: Partial<DrawerLink>) => { const next = items.map((item) => item.id === id ? { ...item, ...changes } : item); persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const deleteLink = (id: string) => { const next = items.filter((item) => item.id !== id); persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const moveLink = (id: string, direction: -1 | 1) => { const index = items.findIndex((item) => item.id === id); const target = index + direction; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; persist({ ...drawer, [tab === "quick" ? "quick" : "links"]: next }); };
  const saveIdea = () => { if (!ideaTitle.trim()) return; persist({ ...drawer, pautaIdeas: [{ id: crypto.randomUUID(), title: ideaTitle.trim(), description: ideaDescription.trim(), caption: ideaCaption.trim(), createdAt: new Date().toISOString() }, ...drawer.pautaIdeas] }); setIdeaTitle(""); setIdeaDescription(""); setIdeaCaption(""); setIdeaFormOpen(false); setIdeaSaved(true); window.setTimeout(() => setIdeaSaved(false), 3200); };
  const tabs = [{ id: "notes" as const, icon: "comment" as const, label: "Recados" }, { id: "drafts" as const, icon: "pencil" as const, label: "Rascunhos" }, { id: "links" as const, icon: "link" as const, label: "Links" }, { id: "ideas" as const, icon: "lightbulb" as const, label: "Ideias de Pauta" }, { id: "quick" as const, icon: "spark" as const, label: "Rápidos" }, ...(trackingActive ? [{ id: "progress" as const, icon: "clock" as const, label: "Acompanhamento" }] : []), { id: "tracker" as const, icon: "settings" as const, label: "Configurações" }];
  const selectTab = (nextTab: typeof tab) => { setTab(nextTab); setIsOpen(true); };
  return <>
    <aside className={`workspace-drawer-shell${isOpen ? " open" : ""}`}>
    <div className="workspace-drawer-rail"><button className="automation-rail-button" onClick={() => setAutomationOpen(true)} title="Automações"><span>ϟ</span><b>Automações</b></button>{tabs.map((item) => <button key={item.id} className={isOpen && tab === item.id ? "active" : ""} onClick={() => selectTab(item.id)} title={item.label}><UiIcon name={item.icon} className="workspace-drawer-icon" /><b>{item.label}</b></button>)}</div>
    {isOpen ? <section className="workspace-drawer-panel">
      <header><h3>{tabs.find((item) => item.id === tab)?.label}{tab === "progress" ? <span className="drawer-title-count">{columns.reduce((count, column) => count + column.cards.length, 0)}</span> : null}</h3><div>{tab === "progress" ? <button className="tracker-header-filter" onClick={() => setTrackerFilterOpen((value) => !value)} title="Filtrar o que o cliente vê" aria-label="Filtrar o que o cliente vê">⌕</button> : <small>{loaded ? "Equipe interna" : "Carregando..."}</small>}<button className="workspace-drawer-close" onClick={() => setIsOpen(false)} aria-label="Fechar gaveta">×</button></div></header>
      {tab === "tracker" ? <ClientTrackerPanel slug={slug} onTrackingChange={setTrackingActive} /> : tab === "progress" ? <ProjectTrackerPanel slug={slug} columns={columns} filterOpen={trackerFilterOpen} /> : tab === "ideas" ? <section className="drawer-ideas"><div className="drawer-ideas-count"><span>💡</span><div><strong>{drawer.pautaIdeas.length} {drawer.pautaIdeas.length === 1 ? "pauta" : "pautas"}</strong><small>salvas para este cliente</small></div></div><p className="drawer-helper">Registre uma ideia rápida aqui. A organização e o envio ficam na aba Pautas.</p><button className="gradient-button drawer-ideas-create" type="button" onClick={() => { setIdeaSaved(false); setIdeaFormOpen(true); }}>+ Nova ideia de pauta</button>{ideaSaved ? <p className="drawer-idea-success">Pauta enviada para a aba Pautas.</p> : null}{ideaFormOpen ? <div className="drawer-ideas-form"><label>Título<input autoFocus value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Ex.: Carrossel com mitos e verdades" /></label><label>Descrição<textarea value={ideaDescription} onChange={(event) => setIdeaDescription(event.target.value)} placeholder="Contexto e objetivo da pauta" /></label><label>Legenda sugerida<textarea value={ideaCaption} onChange={(event) => setIdeaCaption(event.target.value)} placeholder="Primeira direção para a legenda" /></label><div><button type="button" onClick={saveIdea}>Enviar para Pautas</button><button type="button" className="drawer-secondary-action" onClick={() => setIdeaFormOpen(false)}>Cancelar</button></div></div> : null}</section> : (tab === "notes" || tab === "drafts") ? <>
        <p className="drawer-helper">{tab === "notes" ? "Recados são visíveis para toda a equipe." : "Rascunhos e anexos são visíveis somente para você."}</p>
        <div className="drawer-compose"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={tab === "notes" ? "Escreva um recado para a equipe" : "Escreva uma anotação privada"} /><div><button onClick={saveText}>{editingNoteIndex !== null || editingDraftId !== null ? "Salvar alterações" : tab === "notes" ? "Publicar recado" : "Salvar rascunho"}</button>{(editingNoteIndex !== null || editingDraftId !== null) ? <button className="drawer-secondary-action" onClick={resetTextEditor}>Cancelar</button> : null}{tab === "drafts" ? <label className="drawer-attachment">Anexar foto<input type="file" accept="image/*" onChange={(event) => void addDraftAttachment(event.target.files?.[0] ?? null)} /></label> : null}</div></div>
        {tab === "notes" ? <div className="drawer-card-list">{drawer.notes.map((note, index) => <article key={`${note}-${index}`}><p>{note}</p><div className="drawer-item-actions"><button onClick={() => editNote(note, index)}>Editar</button><button className="danger" onClick={() => deleteNote(index)}>Excluir</button></div></article>)}</div> : <div className="drawer-card-list">{drafts.map((draft) => <article key={draft.id}><p>{draft.text}</p>{draft.attachmentUrl ? <a href={draft.attachmentUrl} target="_blank" rel="noreferrer">Ver anexo</a> : null}<div className="drawer-item-actions"><button onClick={() => editDraft(draft)}>Editar</button><button className="danger" onClick={() => deleteDraft(draft.id)}>Excluir</button></div></article>)}</div>}
      </> : <>
        <p className="drawer-helper">{tab === "links" ? "Crie títulos para organizar os links compartilhados da equipe." : "Acesse os atalhos mais usados do workspace."}</p>
        <div className="drawer-link-actions"><button onClick={() => setEditingLinks((value) => !value)}>{editingLinks ? "Concluir edição" : "Organizar links"}</button>{editingLinks ? <><button onClick={() => addLink("heading")}>+ Adicionar título</button><button onClick={() => addLink("link")}>+ Adicionar link</button></> : null}</div><div className="drawer-link-list">{items.map((item) => item.type === "heading" ? <h4 key={item.id}>{editingLinks ? <><input value={item.title} onChange={(event) => updateLink(item.id, { title: event.target.value })} /><button className="drawer-inline-delete" onClick={() => deleteLink(item.id)}>Excluir</button></> : item.title}</h4> : <article key={item.id}>{editingLinks ? <><input value={item.title} onChange={(event) => updateLink(item.id, { title: event.target.value })} /><input value={item.url ?? ""} onChange={(event) => updateLink(item.id, { url: event.target.value })} /><button onClick={() => moveLink(item.id, -1)}>↑</button><button onClick={() => moveLink(item.id, 1)}>↓</button><button className="danger" onClick={() => deleteLink(item.id)}>Excluir</button></> : <a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a>}</article>)}</div>
      </>}
    </section> : null}
    </aside>
    <AutomationModal open={automationOpen} automations={automations} columns={columns} tags={tags} onClose={() => setAutomationOpen(false)} onChange={(items) => { setAutomations(items); void saveAdminKanbanAutomationsBySlug(slug, items); }} />
  </>;
}

function ClientTrackerPanel({ slug, onTrackingChange }: { slug: string; onTrackingChange: (active: boolean) => void }) {
  const [settings, setSettings] = useState<ClientTrackerSettings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadAdminTrackerSettingsBySlug(slug)
      .then((result) => { if (active) setSettings(result.settings); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar as configurações."); });
    return () => { active = false; };
  }, [slug]);
  const save = (next: ClientTrackerSettings) => {
    setSettings(next);
    onTrackingChange(next.trackingEnabled);
    setError("");
    void saveAdminTrackerSettingsBySlug(slug, next).catch((caught) => setError(caught instanceof Error ? caught.message : "Não foi possível salvar as configurações."));
  };
  const togglePermission = (key: keyof ClientTrackerSettings["clientPermissions"]) => {
    if (!settings) return;
    save({ ...settings, clientPermissions: { ...settings.clientPermissions, [key]: !settings.clientPermissions[key] } });
  };
  if (!settings) return <p className="drawer-helper">{error || "Carregando configurações do cliente..."}</p>;
  const actions: Array<[keyof ClientTrackerSettings["clientPermissions"], string]> = [
    ["allowClientEditCaption", "Editar textos e legendas"], ["allowClientCreatePost", "Criar posts"], ["allowClientCreateTags", "Criar etiquetas"], ["allowClientDownload", "Baixar conteúdo"], ["allowClientEditBrandBrain", "Editar Brand Brain"],
  ];
  const views: Array<[keyof ClientTrackerSettings["clientPermissions"], string]> = [
    ["allowClientSearch", "Pesquisa"], ["allowClientViewInvoices", "Faturas"], ["allowClientViewReports", "Relatórios"], ["allowClientViewBrandBrain", "Brand Brain"], ["allowClientViewTracking", "Acompanhamento"],
  ];
  return <div className="tracker-settings">
    <label className="tracker-locale">Idioma do portal<select value={settings.locale} onChange={(event) => save({ ...settings, locale: event.target.value })}><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option><option value="it">🇮🇹 Italiano</option></select></label>
    <TrackerToggle label="Acompanhamento ativo" checked={settings.trackingEnabled} onChange={() => save({ ...settings, trackingEnabled: !settings.trackingEnabled })} />
    <section><h4>O que ele pode fazer</h4>{actions.map(([key, label]) => <TrackerToggle key={key} label={label} checked={settings.clientPermissions[key]} onChange={() => togglePermission(key)} />)}</section>
    <section><h4>O que ele vê</h4><TrackerToggle label="Acompanhamento visível" checked={settings.trackingVisibleToClient} onChange={() => save({ ...settings, trackingVisibleToClient: !settings.trackingVisibleToClient })} /><TrackerToggle label="Próximos posts" checked={settings.showUpcomingPosts} onChange={() => save({ ...settings, showUpcomingPosts: !settings.showUpcomingPosts })} /><TrackerToggle label="Arquivados" checked={settings.showArchivedToClient} onChange={() => save({ ...settings, showArchivedToClient: !settings.showArchivedToClient })} />{views.map(([key, label]) => <TrackerToggle key={key} label={label} checked={settings.clientPermissions[key]} onChange={() => togglePermission(key)} />)}</section>
    <section><h4>Colunas visíveis</h4>{settings.columns.map((column) => <TrackerToggle key={column.id} label={column.name} checked={column.visibleToClient} onChange={() => save({ ...settings, columns: settings.columns.map((item) => item.id === column.id ? { ...item, visibleToClient: !item.visibleToClient } : item) })} />)}</section>
    {error ? <p className="tracker-error">{error}</p> : null}
  </div>;
}

function TrackerToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="tracker-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={onChange} /><i /></label>;
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
    {filteredColumns.map((column) => <section key={column.id} className="project-tracker-stage"><h4>{column.name}<span>{column.cards.length}</span></h4>{column.cards.map((card) => <div key={card.id} className={`project-tracker-task ${tone(card)}`}><i>{/(finaliz|conclu)/i.test(card.statusBadges.join(" ")) ? "✓" : ""}</i><div><strong>{card.title}</strong>{card.statusBadges.filter((item) => item !== "Enviar para Cliente").map((item) => <small key={item}>{item}</small>)}</div><em /></div>)}</section>)}
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

    if (!selectedCardId || !fallbackCard) {
      setState({
        data: null,
        loading: false,
        source: "backend",
      });
      return;
    }

    setState({
      data: buildFallbackCardDetail(fallbackCard),
      loading: true,
      source: "backend",
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
        setState({
          data: buildFallbackCardDetail(fallbackCard),
          loading: false,
          source: "error",
        });
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

function DashboardPage({ session, onLogout }: { session: SessionUser; onLogout: () => void }) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [upcomingPosts, setUpcomingPosts] = useState<DashboardUpcomingPost[]>([]);
  const [agendaToday, setAgendaToday] = useState<AgendaEvent[]>([]);
  const [clientSubmissions, setClientSubmissions] = useState<DashboardSubmission[]>([]);
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
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

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
    Promise.all([listAdminClients(), loadDashboardOverview()])
      .then(([{ items }, overview]) => { if (active) { setClients(items); setUpcomingPosts(overview.upcomingPosts); setAgendaToday(overview.agendaToday); setClientSubmissions(overview.clientSubmissions); } })
      .catch(() => { if (active) setClients([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" && !current.slug ? { slug: slugify(value) } : {}),
    }));
  };

  const myClients = clients.filter((client) => client.owner_user_id === session.id);
  const sharedClients = clients.filter((client) => client.owner_user_id !== session.id);
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
      <AdminRail session={session} />
      <main className="main-column">
        <section className="dashboard-shell">
          <div className="dashboard-hero-panel">
            <WorkspaceNavbar session={session} onLogout={onLogout} onCreateClient={() => setCreateOpen(true)} />
            <div className="dashboard-welcome">
              <div className="dashboard-welcome-copy"><p className="eyebrow">Dashboard</p><h1>{greeting}, {session.name.split(" ")[0]}</h1><p className="dashboard-date">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(currentTime)}</p></div>
              <div className="dashboard-welcome-aside"><div className="dashboard-orbs" aria-hidden="true"><i /><i /><i /></div><div className="dashboard-metrics dashboard-metrics-inline"><article className="dashboard-metric clients"><UiIcon name="users" /><div><span>Clientes ativos</span><strong>{loading ? "-" : clients.length}</strong><small>Contas em andamento</small></div></article><article className="dashboard-metric posts"><UiIcon name="calendar" /><div><span>Posts este mês</span><strong>128</strong><small>+18% vs mês anterior</small></div></article><article className="dashboard-metric pending"><UiIcon name="clock" /><div><span>Pendentes</span><strong>24</strong><small className="dashboard-alert">8 vencem hoje</small></div></article><article className="dashboard-metric approved"><UiIcon name="check" /><div><span>Aprovados</span><strong>88</strong><small>+20% vs mês anterior</small></div></article></div></div>
            </div>
          </div>

          <div className="dashboard-grid">
            <DashboardCommemorativeWidget clients={clients} />
            {upcomingPosts.length > 0 ? <DashboardTasksWidget posts={upcomingPosts} /> : null}
            {agendaToday.length > 0 ? <DashboardAgendaWidget events={agendaToday} /> : null}
            <DashboardList title="Posts para Hoje" items={["02:00  EP. 237 - ÁUDIOS - Spotify", "02:00  EP. 237 - VÍDEOS - EP Youtube", "11:00  3 - Piccoli assaggi", "22:00  Viagem & Cia"]} action="Ver todos os posts" />
            <DashboardList title="Feedbacks dos clientes" items={["Podcast Lider de Elite", "Mattia's Bar", "Dj Per Eventi"]} action="Ver todos os feedbacks" compact />
            {clientSubmissions.length > 0 ? <DashboardList title="Posts enviados pelo cliente" items={clientSubmissions.map((item) => `${item.clientName} · ${item.title}`)} action="Ver todos os posts enviados" compact /> : null}
          </div>
          <section className="dashboard-clients-panel dashboard-clients-full">
            <div className="dashboard-section-head"><div><p className="eyebrow">Projetos</p><h2>Clientes</h2></div></div>
            <div className="dashboard-client-tabs" role="tablist" aria-label="Filtrar clientes">
              <button className={clientFilter === "all" ? "active" : ""} onClick={() => setClientFilter("all")}>Todos <span>({clients.length})</span></button>
              <button className={clientFilter === "mine" ? "active" : ""} onClick={() => setClientFilter("mine")}>Meus <span>({myClients.length})</span></button>
              <button className={clientFilter === "shared" ? "active" : ""} onClick={() => setClientFilter("shared")}>⌯ Compartilhados <span>({sharedClients.length})</span></button>
            </div>
            {loading ? <p className="dashboard-empty">Carregando clientes...</p> : visibleClients.length === 0 ? <p className="dashboard-empty">Não há clientes neste filtro.</p> : <div className="dashboard-clients">
              {visibleClients.map((client) => <DashboardClientCard key={client.id} client={client} onEdit={() => void openEditClient(client)} onDelete={() => void removeClient(client)} onShare={() => void openShareClient(client)} />)}
            </div>}
          </section>
        </section>
        {createOpen ? <CreateClientModal form={form} logoFile={logoFile} creating={creating} error={createError} onChange={updateForm} onLogoChange={setLogoFile} onClose={closeCreate} onSubmit={submitClient} /> : null}
        {editClient ? <EditClientModal client={editClient} form={editForm} logoFile={editLogoFile} accesses={clientAccesses} saving={clientActionSaving} error={clientActionError} onChange={(key, value) => setEditForm((current) => ({ ...current, [key]: value }))} onLogoChange={setEditLogoFile} onClose={() => setEditClient(null)} onSubmit={saveEditedClient} /> : null}
        {shareClient ? <ShareClientModal client={shareClient} accesses={clientAccesses} users={managedUsers} userId={shareUserId} role={shareRole} saving={clientActionSaving} error={clientActionError} onUserChange={setShareUserId} onRoleChange={setShareRole} onClose={() => setShareClient(null)} onShare={() => void shareSelectedClient()} /> : null}
      </main>
    </div>
  );
}

function DashboardTasksWidget({ posts }: { posts: DashboardUpcomingPost[] }) {
  const postCount = posts.length;
  return <section className="dashboard-tasks-widget">
    <header><div><span className="dashboard-task-icon">◴</span><h3>Próximos posts</h3></div><span className="dashboard-task-count">Próximos 3 dias ({postCount})</span></header>
    <div className="dashboard-task-rows">
      {posts.map((post) => <article key={post.id}>
        <span className="dashboard-task-dot" />
        <span className="dashboard-task-avatar">{post.clientLogoUrl ? <img src={post.clientLogoUrl} alt="" /> : post.clientName.slice(0, 2).toUpperCase()}</span>
        <div><strong>{post.title}</strong><small>{post.clientName}</small></div>
        <span className="dashboard-task-status">⌁ {post.clientLabel || "Agendado"}</span>
        <span className="dashboard-task-date">◷ {formatDashboardDate(post.scheduledAt)}</span>
      </article>)}
    </div>
    <button className="dashboard-task-link">Ver todas as tarefas <span>→</span></button>
  </section>;
}

function DashboardAgendaWidget({ events }: { events: AgendaEvent[] }) {
  return <section className="dashboard-tasks-widget dashboard-agenda-widget"><header><div><span className="dashboard-task-icon">▣</span><h3>Agenda de hoje</h3></div><span className="dashboard-task-count">{events.length} {events.length === 1 ? "compromisso" : "compromissos"}</span></header><div className="dashboard-task-rows">{events.map((event) => <article key={event.id}><span className="dashboard-task-dot" style={{ backgroundColor: event.color }} /><span className="agenda-time">{formatAgendaTime(event.startsAt)}</span><div><strong>{event.title}</strong><small>{event.clientName ?? "Compromisso"}</small></div><span className={event.isCompleted ? "agenda-state complete" : "agenda-state"}>{event.isCompleted ? "Concluído" : "Hoje"}</span></article>)}</div><NavLink to="/agenda" className="dashboard-task-link">Ver agenda completa <span>→</span></NavLink></section>;
}

function formatDashboardDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--/--" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}
function formatAgendaTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "--:--" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date); }

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
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [labelId, setLabelId] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4285f4");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const range = useMemo(() => agendaViewRange(month, calendarView), [month, calendarView]);

  useEffect(() => {
    if (!session) return;
    Promise.all([loadAgendaEvents(range.from, range.to), listAdminClients(), loadAgendaLabels()])
      .then(([agenda, clientResult, labelResult]) => { setEvents(agenda.items); setClients(clientResult.items); setLabels(labelResult.items); })
      .catch(() => setEvents([]));
  }, [range.from, range.to, refresh, session]);

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
      await createAgendaEvent({ title: title.trim(), taskDescription: taskDescription.trim() || null, startsAt, color, clientAccountId: clientAccountId || null, labelId: labelId || null, recurrenceType, repeatUntil: repeatUntil || null });
      setTitle(""); setTaskDescription(""); setStartsAt(""); setClientAccountId(""); setLabelId(""); setRecurrenceType("none"); setRepeatUntil("");
      setCreateOpen(false); setRefresh((value) => value + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível criar o compromisso.";
      setError(message === "Sessao obrigatoria." || message === "Token invalido ou expirado." ? "Sua sessão expirou. Saia e entre novamente para salvar no banco." : message);
    }
  }

  function openAgendaDay(day: Date) {
    const selected = new Date(day);
    selected.setHours(9, 0, 0, 0);
    setStartsAt(toDateTimeLocal(selected.toISOString()));
    setTitle(""); setTaskDescription(""); setClientAccountId(""); setLabelId(""); setColor("#c9f7df"); setRecurrenceType("none"); setRepeatUntil(""); setError("");
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

  const visibleEvents = expandAgendaEvents(events, range.from, range.to);
  const eventsByDay = new Map<string, AgendaEvent[]>();
  visibleEvents.forEach((event) => {
    const key = localDateKey(new Date(event.startsAt));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  });

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
            return <article key={key} className={isCurrentMonth ? "agenda-day" : "agenda-day muted"} onClick={() => openAgendaDay(day)}><time>{day.getDate()}</time>{dayEvents.slice(0, 3).map((item) => <div className="agenda-event-pill" key={item.id} style={{ backgroundColor: item.color }} onClick={(event) => { event.stopPropagation(); setSelectedEvent(item); setRescheduleAt(toDateTimeLocal(item.startsAt)); }}><span>{formatAgendaTime(item.startsAt)}</span> {item.title}</div>)}{dayEvents.length > 3 ? <span className="agenda-more">+{dayEvents.length - 3} mais</span> : null}</article>;
          })}</div>
        </section>
      </section>
      {createOpen ? <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
        <form className="agenda-create-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitAgendaEvent}>
          <div className="column-editor-head"><div><p className="eyebrow">Agenda</p><h3>Novo compromisso</h3></div><button type="button" className="icon-close" onClick={() => setCreateOpen(false)}>×</button></div>
          <label className="field-stack">Compromisso<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Reunião com cliente" /></label>
          <label className="field-stack">Tarefa a realizar<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Ex.: Preparar pauta, revisar design e enviar para aprovação." rows={4} /></label>
          <label className="field-stack">Data e horário<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label className="field-stack">Repetição<select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as AgendaRecurrence)}><option value="none">Uma vez</option><option value="weekdays">De segunda a sexta</option><option value="weekly">Toda semana</option><option value="monthly_nth_weekday">Uma vez por mês, no mesmo dia da semana</option></select></label>
          {recurrenceType !== "none" ? <label className="field-stack">Repetir até<input type="date" value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} /></label> : null}
          <label className="field-stack">Cliente<select value={clientAccountId} onChange={(event) => setClientAccountId(event.target.value)}><option value="">Sem cliente específico</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label className="field-stack">Etiqueta<select value={labelId} onChange={(event) => { const nextId = event.target.value; setLabelId(nextId); const label = labels.find((item) => item.id === nextId); if (label) setColor(label.color); }}><option value="">Sem etiqueta</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
          <label className="field-stack">Cor<input type="color" value={color} onChange={(event) => { setColor(event.target.value); setLabelId(""); }} /></label>
          {error ? <p className="form-feedback error-text">{error}</p> : null}<button className="gradient-button" type="submit">Criar compromisso</button>
        </form>
      </div> : null}
      {labelsOpen ? <div className="modal-backdrop" onClick={() => setLabelsOpen(false)}><section className="agenda-label-modal" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Agenda</p><h3>Gerenciar etiquetas</h3></div><button className="icon-close" onClick={() => setLabelsOpen(false)}>×</button></header><div className="agenda-label-create"><input value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} placeholder="Nome da etiqueta" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addAgendaLabel(); } }} /><input type="color" value={newLabelColor} onChange={(event) => setNewLabelColor(event.target.value)} /><button className="gradient-button" onClick={() => void addAgendaLabel()} aria-label="Criar etiqueta">＋</button></div><div className="agenda-label-list">{labels.length === 0 ? <p>Crie sua primeira etiqueta para usar em tarefas recorrentes.</p> : labels.map((label) => <article key={label.id} style={{ "--agenda-label-color": label.color } as CSSProperties}><span /><strong>{label.name}</strong><button onClick={() => void removeAgendaLabel(label.id)} aria-label={`Excluir ${label.name}`}>×</button></article>)}</div></section></div> : null}
      {selectedEvent ? <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}><section className="agenda-detail-modal" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Compromisso</p><h3>{selectedEvent.title}</h3></div><button className="icon-close" onClick={() => setSelectedEvent(null)}>×</button></header><p>{selectedEvent.taskDescription || "Sem tarefa detalhada."}</p><dl><div><dt>Quando</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedEvent.startsAt))}</dd></div><div><dt>Etiqueta</dt><dd>{selectedEvent.labelName || "Sem etiqueta"}</dd></div><div><dt>Repetição</dt><dd>{selectedEvent.recurrenceType === "weekdays" ? "Segunda a sexta" : selectedEvent.recurrenceType === "weekly" ? "Toda semana" : selectedEvent.recurrenceType === "monthly_nth_weekday" ? "Mensal, no mesmo dia da semana" : "Uma vez"}</dd></div></dl>{selectedEvent.recurrenceType !== "none" ? <p className="agenda-series-note">Este é um compromisso recorrente: reagendar ou excluir altera toda a série.</p> : null}<label className="field-stack agenda-reschedule-field">Reagendar para<input type="datetime-local" value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} /></label><div className="agenda-detail-actions"><button className="ghost-button" onClick={async () => { if (!rescheduleAt) return; await updateAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id, { startsAt: rescheduleAt }); setSelectedEvent(null); setRefresh((value) => value + 1); }}>Salvar nova data</button><button className="danger-button" onClick={async () => { if (!window.confirm("Excluir este compromisso? Uma repetição excluirá a série inteira.")) return; await deleteAgendaEvent(selectedEvent.sourceEventId ?? selectedEvent.id); setSelectedEvent(null); setRefresh((value) => value + 1); }}>Excluir</button></div></section></div> : null}
    </main>
  </div>;
}
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function moveAgendaDate(date: Date, view: "day" | "week" | "month", direction: -1 | 1) { const next = new Date(date); if (view === "month") next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + (view === "week" ? 7 : 1) * direction); return next; }
function formatAgendaRangeTitle(anchor: Date, view: "day" | "week" | "month") { const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }); if (view === "day") return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(anchor); if (view === "week") { const range = agendaViewRange(anchor, "week"); return `${date.format(range.days[0])} - ${date.format(range.days[6])}`; } return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(anchor); }
function agendaViewRange(anchor: Date, view: "day" | "week" | "month") { const first = new Date(anchor.getFullYear(), anchor.getMonth(), view === "month" ? 1 : anchor.getDate()); const start = new Date(first); const count = view === "day" ? 1 : view === "week" ? 7 : 42; if (view === "month") start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); else if (view === "week") start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); const days = Array.from({ length: count }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); const end = new Date(days[days.length - 1]); end.setDate(end.getDate() + 1); return { from: start.toISOString(), to: end.toISOString(), days }; }
function expandAgendaEvents(events: AgendaEvent[], from: string, to: string) { const rangeStart = new Date(from); const rangeEnd = new Date(to); const items: AgendaEvent[] = []; for (const event of events) { const start = new Date(event.startsAt); const until = event.repeatUntil ? new Date(`${event.repeatUntil}T23:59:59`) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()); const recurring = event.recurrenceType && event.recurrenceType !== "none"; for (let day = new Date(start); day < rangeEnd && day <= until; day.setDate(day.getDate() + 1)) { const eligible = !recurring ? day.getTime() === start.getTime() : event.recurrenceType === "weekdays" ? day.getDay() >= 1 && day.getDay() <= 5 : event.recurrenceType === "weekly" ? day.getDay() === start.getDay() : day.getDay() === start.getDay() && Math.ceil(day.getDate() / 7) === Math.ceil(start.getDate() / 7); if (eligible && day >= rangeStart) { const occurrence = new Date(day); occurrence.setHours(start.getHours(), start.getMinutes(), 0, 0); items.push({ ...event, id: `${event.id}:${localDateKey(day)}`, sourceEventId: event.id, startsAt: occurrence.toISOString() }); } if (!recurring) break; } } return items; }

function DashboardList({ title, items, action, compact = false }: { title: string; items: string[]; action: string; compact?: boolean }) {
  return <section className={`dashboard-list ${compact ? "compact" : ""}`}><h3>{title}</h3><div>{items.map((item) => <article key={item}><span className="dashboard-list-dot" /><p>{item}</p><small>Hoje</small></article>)}</div><button className="dashboard-link">{action} →</button></section>;
}

function DashboardClientCard({ client, onEdit, onDelete, onShare }: { client: AdminClientOption; onEdit: () => void; onDelete: () => void; onShare: () => void }) {
  const localeLabel = client.locale === "en" ? "English" : client.locale === "es" ? "Español" : client.locale === "it" ? "Italiano" : "Português";
  const localeFlag = client.locale === "en" ? "🇺🇸" : client.locale === "es" ? "🇪🇸" : client.locale === "it" ? "🇮🇹" : "🇧🇷";
  const [copied, setCopied] = useState(false);
  const copyPortalLink = async () => {
    const url = `${window.location.origin}/portal/${client.slug}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const helper = document.createElement("textarea");
        helper.value = url;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { window.prompt("Copie o link do portal:", url); }
  };
  return <article className="client-showcase-card">
    <div className="client-showcase-head">
      <div className="client-showcase-logo">{client.logo_url ? <img src={client.logo_url} alt={`Logo ${client.name}`} /> : client.name.slice(0, 2).toUpperCase()}</div>
      <div><h3>{client.name}</h3><p>{localeFlag} {localeLabel} <span>♙ {Number(client.access_count ?? 0)}</span></p></div>
    </div>
    <div className="client-showcase-social"><span>◎</span><span>f</span><span>◎</span><button type="button" title={copied ? "Link copiado" : "Copiar link do portal"} aria-label={copied ? "Link copiado" : "Copiar link do portal"} onClick={() => void copyPortalLink()}><UiIcon name="copy" /></button></div>
    <div className="client-showcase-actions">
      <NavLink to={`/admin/${client.slug}`} className="gradient-button">Gerenciar</NavLink>
      <NavLink to={`/portal/${client.slug}`} className="client-icon-action" title="Ver portal"><UiIcon name="eye" /></NavLink>
      <button type="button" className="client-icon-action" title="Editar cliente" onClick={onEdit}><UiIcon name="pencil" /></button>
      <button type="button" className="client-icon-action danger" title="Excluir cliente" onClick={onDelete}><UiIcon name="trash" /></button>
      <button type="button" className="client-icon-action" title="Compartilhar cliente com a equipe" onClick={onShare}><UiIcon name="send" /></button>
    </div>
  </article>;
}

function EditClientModal({ client, form, logoFile, accesses, saving, error, onChange, onLogoChange, onClose, onSubmit }: { client: AdminClientOption; form: EditClientForm; logoFile: File | null; accesses: ClientAccess[]; saving: boolean; error: string; onChange: (key: keyof EditClientForm, value: string) => void; onLogoChange: (file: File | null) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const portalUsers = accesses.filter((access) => access.globalRole === "cliente");
  const socialFields: Array<[keyof EditClientForm, string, string]> = [["instagram", "Instagram", "https://instagram.com/..."], ["facebook", "Facebook", "https://facebook.com/..."], ["tiktok", "TikTok", "https://tiktok.com/@..."], ["youtube", "YouTube", "https://youtube.com/..."], ["linkedin", "LinkedIn", "https://linkedin.com/..."], ["x", "X", "https://x.com/..."], ["website", "Site", "https://meusite.com.br"]];
  return <div className="client-modal-backdrop" onMouseDown={onClose}><form className="client-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}><header><div><p className="eyebrow">Detalhes do cliente</p><h2>Editar Cliente</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><label>Nome do Cliente<input required value={form.name} onChange={(event) => onChange("name", event.target.value)} /></label><label>Nome para saudação no portal<input required value={form.greetingName} onChange={(event) => onChange("greetingName", event.target.value)} placeholder="Ex: Liege" /></label><label>Slug (URL)<span className="slug-input"><em>/client/</em><input required value={form.slug} onChange={(event) => onChange("slug", event.target.value)} /></span></label><label>Idioma do Cliente<select value={form.locale} onChange={(event) => onChange("locale", event.target.value)}><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option><option value="it">🇮🇹 Italiano</option><option value="sv">🇸🇪 Svenska</option></select></label><label>Título do portal<input required value={form.portalTitle} onChange={(event) => onChange("portalTitle", event.target.value)} /></label><label>Logo<span className="logo-picker"><input type="file" accept="image/*" onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} /><strong>{logoFile ? logoFile.name : client.logo_url ? "▧ Manter logo atual" : "▧ Selecionar logo"}</strong></span></label><fieldset><legend>Redes Sociais</legend>{socialFields.map(([key, label, placeholder]) => <label key={key} className="social-field"><span>{label}</span><input type="url" value={form[key]} onChange={(event) => onChange(key, event.target.value)} placeholder={placeholder} /></label>)}</fieldset><fieldset className="client-login"><legend>Login do Cliente</legend>{portalUsers.length === 0 ? <p>Esta conta ainda não possui login de cliente.</p> : <><label>Login<select value={form.clientUserId} onChange={(event) => onChange("clientUserId", event.target.value)}>{portalUsers.map((user) => <option key={user.userId} value={user.userId}>{user.fullName} · {user.email}</option>)}</select></label><label>E-mail do cliente<input value={form.email} disabled /></label><label>Nova senha <small>Deixe em branco para manter a atual.</small><input type="password" minLength={8} value={form.password} onChange={(event) => onChange("password", event.target.value)} placeholder="Mínimo de 8 caracteres" /></label></>}</fieldset>{error ? <p className="form-error">{error}</p> : null}<button className="gradient-button client-submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></form></div>;
}

function ShareClientModal({ client, accesses, users, userId, role, saving, error, onUserChange, onRoleChange, onClose, onShare }: { client: AdminClientOption; accesses: ClientAccess[]; users: ManagedUser[]; userId: string; role: "admin" | "colaborador"; saving: boolean; error: string; onUserChange: (value: string) => void; onRoleChange: (value: "admin" | "colaborador") => void; onClose: () => void; onShare: () => void }) {
  const internalAccesses = accesses.filter((access) => access.globalRole !== "cliente");
  return <div className="client-modal-backdrop" onMouseDown={onClose}><section className="client-modal client-share-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Equipe</p><h2>Compartilhar {client.name}</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><p>Escolha quem poderá abrir e trabalhar neste Kanban.</p><div className="share-controls"><select value={userId} onChange={(event) => onUserChange(event.target.value)}><option value="">Selecionar membro</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.globalRole}</option>)}</select><select value={role} onChange={(event) => onRoleChange(event.target.value as "admin" | "colaborador")}><option value="colaborador">Colaborador</option><option value="admin">Admin</option></select><button className="gradient-button" disabled={!userId || saving} onClick={onShare}>{saving ? "Adicionando..." : "Compartilhar"}</button></div>{error ? <p className="form-error">{error}</p> : null}<div className="client-access-list"><h3>Já têm acesso</h3>{internalAccesses.length === 0 ? <p>Nenhum membro interno atribuído.</p> : internalAccesses.map((access) => <article key={access.membershipId}><div><strong>{access.fullName}</strong><small>{access.email}</small></div><span>{access.membershipRole}</span></article>)}</div></section></div>;
}

function CreateClientModal({ form, logoFile, creating, error, onChange, onLogoChange, onClose, onSubmit }: { form: ClientForm; logoFile: File | null; creating: boolean; error: string; onChange: (key: keyof ClientForm, value: string) => void; onLogoChange: (file: File | null) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const socialFields: Array<[keyof typeof form, string, string]> = [["instagram", "Instagram", "https://instagram.com/..."], ["facebook", "Facebook", "https://facebook.com/..."], ["tiktok", "TikTok", "https://tiktok.com/@..."], ["youtube", "YouTube", "https://youtube.com/..."], ["linkedin", "LinkedIn", "https://linkedin.com/..."], ["x", "X", "https://x.com/..."], ["website", "Site", "https://meusite.com.br"]];
  return <div className="client-modal-backdrop" role="presentation"><form className="client-modal" onSubmit={onSubmit}><header><h2>Novo Cliente</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><label>Nome do Cliente<input required value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Ex: Empresa XYZ" /></label><label>Nome para saudação no portal<input required value={form.greetingName} onChange={(event) => onChange("greetingName", event.target.value)} placeholder="Ex: Liege" /></label><label>Slug (URL)<span className="slug-input"><em>/client/</em><input required value={form.slug} onChange={(event) => onChange("slug", event.target.value)} placeholder="empresa-xyz" /></span></label><label>Idioma do Cliente<select value={form.locale} onChange={(event) => onChange("locale", event.target.value)}><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option><option value="it">🇮🇹 Italiano</option></select></label><label>Logo<span className="logo-picker"><input type="file" accept="image/*" onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} /><strong>{logoFile ? logoFile.name : "▧ Selecionar logo"}</strong></span></label><fieldset><legend>Redes Sociais</legend>{socialFields.map(([key, label, placeholder]) => <label key={key} className="social-field"><span>{label}</span><input type="url" value={form[key]} onChange={(event) => onChange(key, event.target.value)} placeholder={placeholder} /></label>)}</fieldset><fieldset className="client-login"><legend>Login do Cliente</legend><p>Crie um acesso para o cliente visualizar seus conteúdos.</p><label>E-mail do cliente<input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} placeholder="cliente@empresa.com" /></label><label>Senha<input type="password" minLength={8} value={form.password} onChange={(event) => onChange("password", event.target.value)} placeholder="Mínimo de 8 caracteres" /></label></fieldset>{error ? <p className="form-error">{error}</p> : null}<button className="gradient-button client-submit" disabled={creating}>{creating ? "Criando..." : "Criar Cliente"}</button></form></div>;
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
        title="Essa conta nao esta atribuida a este perfil"
        body="Admins e colaboradores so podem abrir os clientes ligados ao proprio usuario."
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
  return <div className="profile-menu" ref={menuRef}><button className="session-note glass-subtle" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span className="session-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span><span className="session-copy"><strong>{session.name}</strong><span>{roleLabel(session.role)}</span></span><UiIcon name="chevron-down" className="session-caret" /></button>{open ? <div className="profile-popover"><button onClick={() => show("profile")}><span>♙</span>Meu Perfil</button><button onClick={() => show("password")}><span>⚿</span>Alterar Senha</button><NavLink to="/agenda" onClick={() => setOpen(false)}><span>▣</span>Agenda</NavLink><button onClick={() => show("accounts")}><span>♧</span>Trocar de conta</button><hr /><button className="profile-logout" onClick={onLogout}><span>⇥</span>Sair</button></div> : null}{dialog ? <div className="profile-modal-backdrop" onMouseDown={() => setDialog(null)}><section className="profile-modal" onMouseDown={(event) => event.stopPropagation()}><header><h3>{dialog === "profile" ? "Meu Perfil" : dialog === "password" ? "Alterar Senha" : "Trocar de conta"}</h3><button onClick={() => setDialog(null)} aria-label="Fechar">×</button></header>{dialog === "profile" ? <div className="profile-edit"><span className="profile-photo-large">{avatarUrl ? <img src={avatarUrl} alt="Foto de perfil" /> : initials}</span><strong>{session.name}</strong><small>{session.email}</small><label className="profile-upload">{saving ? "Enviando foto..." : "Escolher nova foto"}<input type="file" accept="image/*" disabled={saving} onChange={(event) => void saveAvatar(event.target.files?.[0] ?? null)} /></label></div> : null}{dialog === "password" ? <div className="profile-form"><label>Senha atual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>Nova senha<input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><button className="gradient-button" disabled={saving || !currentPassword || newPassword.length < 8} onClick={() => void savePassword()}>{saving ? "Salvando..." : "Salvar nova senha"}</button></div> : null}{dialog === "accounts" ? <div className="profile-agenda">{session.assignedAdminSlugs.map((account) => <a key={account} href={`/admin/${account}`}>{account.replace(/-/g, " ")}</a>)}</div> : null}{message ? <p className="profile-message">{message}</p> : null}</section></div> : null}</div>;
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [boardView, setBoardView] = useState<"board" | "archived" | "texts" | "calendar" | "activities" | "brand" | "pautas">("board");
  const resource = usePreviewResource(emptyAdminWorkspace, () => loadAdminWorkspaceBySlug(slug, { archived: boardView === "archived" }), [
    slug,
    refreshKey,
    boardView,
  ]);
  const data = resource.data;
  const scheduledCardIds = [...data.columns.flatMap((column) => column.cards), ...data.withoutColumn]
    .filter((card) => card.scheduledAt)
    .map((card) => card.id)
    .join(",");
  useEffect(() => {
    if (boardView !== "board" || !scheduledCardIds) return;

    const refreshScheduledCards = () => {
      if (document.visibilityState === "visible") setRefreshKey((value) => value + 1);
    };
    const interval = window.setInterval(refreshScheduledCards, 5_000);
    return () => window.clearInterval(interval);
  }, [boardView, scheduledCardIds]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<BoardColumn | "new" | null>(null);
  const [invoiceLineDialog, setInvoiceLineDialog] = useState<BillingLineRequest | null>(null);
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [newCardTarget, setNewCardTarget] = useState<{ columnId: string | null } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [bulkColumnDialog, setBulkColumnDialog] = useState<"copy" | "move" | null>(null);
  const [cardMenu, setCardMenu] = useState<{ card: BoardCard; columnId: string | null; x: number; y: number } | null>(null);
  const [cardColumnDialog, setCardColumnDialog] = useState<{ card: BoardCard; mode: "copy" | "move" } | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<BoardCard | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; columnId: string | null } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ columnId: string | null; index: number } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ urls: string[]; title: string; index: number } | null>(null);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<AdminClientOption[]>([]);
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
                <button className={boardView === "archived" ? "tab active" : "tab"} onClick={() => setBoardView("archived")}>Arquivados</button>
                <button className={boardView === "texts" ? "tab active" : "tab"} onClick={() => setBoardView("texts")}>Textos</button>
                <button className={boardView === "calendar" ? "tab active" : "tab"} onClick={() => setBoardView("calendar")}>Calendário</button>
                <button className={boardView === "activities" ? "tab active" : "tab"} onClick={() => setBoardView("activities")}>Atividades</button>
                <button className={boardView === "brand" ? "tab active" : "tab"} onClick={() => setBoardView("brand")}>Brand Brain</button>
                <button className={boardView === "pautas" ? "tab active" : "tab"} onClick={() => setBoardView("pautas")}>Pautas</button>
              </div>
              {boardView === "board" ? <div className="board-actions">
                <button className={selectionMode ? "ghost-button active" : "ghost-button"} onClick={() => {
                  setSelectionMode((active) => !active);
                  setSelectedCardIds([]);
                }}>Selecionar</button>
                <button className={tagFilterOpen || selectedTagFilters.length ? "ghost-button active" : "ghost-button"} onClick={() => setTagFilterOpen((open) => !open)}>Etiquetas{selectedTagFilters.length ? ` (${selectedTagFilters.length})` : ""}</button>
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
              {boardView === "board" && tagFilterOpen ? <section className="tag-filter-panel">
                <div className="tag-filter-search"><span>⌕</span><input autoFocus value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Buscar..." /></div>
                <div className="tag-filter-tabs"><button className="active">Todas</button><button onClick={() => setSelectedTagFilters([])}>Limpar seleção</button></div>
                <div className="tag-filter-list">{filteredTagDefinitions.map((tag) => { const selected = selectedTagFilters.includes(tag.name); return <button key={tag.id} className={selected ? "selected" : ""} onClick={() => setSelectedTagFilters((current) => selected ? current.filter((item) => item !== tag.name) : [...current, tag.name])}><span className="tag-filter-check">{selected ? "✓" : ""}</span><span className="tag-filter-dot" style={{ backgroundColor: tag.color }} /><strong>{tag.name}</strong></button>; })}{filteredTagDefinitions.length === 0 ? <p>Nenhuma etiqueta encontrada.</p> : null}</div>
              </section> : null}
            </div>

            <div className="board-layout">
              {boardView === "texts" ? <AdminTextsView clientName={data.clientName} slug={slug} /> : boardView === "calendar" ? <ClientKanbanCalendar slug={slug} /> : boardView === "activities" ? <KanbanActivities slug={slug} /> : boardView === "brand" ? <BrandBrainWorkspace slug={slug} clientName={data.clientName} /> : boardView === "pautas" ? <PautasWorkspace slug={slug} clientName={data.clientName} columns={data.columns} onSent={() => setRefreshKey((value) => value + 1)} /> : boardView === "archived" ? <ArchivedCardsView
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
              /> : <div className="columns-scroll">
                {data.columns.map((column) => (
                  <BoardColumnView
                    key={column.id}
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
                    onDragOver={(event, index) => { event.preventDefault(); setDropTarget({ columnId: column.id, index }); }}
                    onDrop={(index) => void moveDraggedCard(column.id, index)}
                    onDragEnd={() => { setDraggedCard(null); setDropTarget(null); }}
                    onCardContextMenu={(event, card) => {
                      event.preventDefault();
                      setCardMenu({ card, columnId: column.id, x: event.clientX, y: event.clientY });
                    }}
                  />
                ))}

                {filterCardsByTags(data.withoutColumn).length > 0 ? (
                  <section className="kanban-column">
                    <header className="column-head" style={{ color: "#7a86a9" }}>
                      <div>
                        <p className="column-kicker">Area solta</p>
                        <h3>Sem coluna</h3>
                      </div>
                    </header>
                    <div className="column-cards-scroll">
                      {filterCardsByTags(data.withoutColumn).map((card) => (
                        <CardView
                          key={card.id}
                          card={card}
                          onOpen={() => setSelectedCardId(card.id)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setCardMenu({ card, columnId: null, x: event.clientX, y: event.clientY });
                          }}
                          selectionMode={selectionMode}
                          selected={selectedCardIds.includes(card.id)}
                          onToggleSelection={() => toggleCardSelection(card.id)}
                          onPreviewMedia={openMediaPreview}
                          onRemoveTag={removeTagFromCard}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="kanban-column column-add glass-subtle">
                  <button className="column-add-button" onClick={() => setEditingColumn("new")}>
                    + Criar nova coluna
                  </button>
                </section>
              </div>}

              <WorkspaceDrawer slug={slug} userId={session.id} initialQuickLinks={data.quickLinks} columns={data.columns} tags={data.tagDefinitions} />
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
                  <h3>Calendario da conta</h3>
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
        onClose={() => setSelectedCardId(null)}
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
            status: [status, ...cardMenu.card.statusBadges.slice(1)],
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
          onCopyToClient={(targetSlug) => createAdminCardBySlug(targetSlug, {
            columnId: null,
            title: `${cardMenu.card.title} (copia)`,
            caption: cardMenu.card.subtitle ?? null,
            primaryMediaUrl: cardMenu.card.mediaUrl ?? null,
            externalLinkUrl: cardMenu.card.externalLinkUrl ?? null,
            artType: cardMenu.card.typeLabel,
            status: cardMenu.card.statusBadges,
            tags: cardMenu.card.tags,
            mediaUrls: cardMenu.card.mediaUrls,
            hashtags: cardMenu.card.hashtags,
            deadlineAt: cardMenu.card.deadlineAt,
            scheduledAt: cardMenu.card.scheduledAt,
            clientLabel: cardMenu.card.clientLabel,
          }).then(() => setRefreshKey((value) => value + 1))}
          onArchive={() => archiveAdminCardBySlug(slug, cardMenu.card.id).then(() => setRefreshKey((value) => value + 1))}
          onDelete={() => deleteAdminCardBySlug(slug, cardMenu.card.id).then(() => setRefreshKey((value) => value + 1))}
        />
      ) : null}

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
        onStatus={async (status) => { await Promise.all(selectedCards.map((card) => updateAdminCardBySlug(slug, card.id, { status: [status, ...card.statusBadges.slice(1)] }))); finishBulkAction(); }}
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
          await setAdminCardArchivedBySlug(slug, restoreDialog.id, false);
          await moveAdminCardBySlug(slug, restoreDialog.id, columnId);
          setRestoreDialog(null);
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
    <section className="kanban-column">
      <header className="column-head" style={{ color: column.color }}>
        <div className="column-title-row">
          <span className="column-dot" />
          <h3>{column.name}</h3>
        </div>
        <div className="column-head-actions" ref={columnHeadActionsRef}>
          <button
            type="button"
            className={column.visibleToClient ? "column-visibility visible" : "column-visibility"}
            title={column.visibleToClient ? "Visivel para o cliente" : "Oculta para o cliente"}
            aria-label={column.visibleToClient ? "Ocultar coluna do cliente" : "Mostrar coluna para o cliente"}
            aria-pressed={column.visibleToClient}
            onClick={onToggleVisibility}
          >
            <UiIcon name="eye" className="column-action-icon" />
          </button>
          <span className="column-count" aria-label={`${column.cards.length} cards`}>({column.cards.length})</span>
          <button className="column-menu" onClick={onToggleMenu} aria-label={`Opcoes de ${column.name}`}>
            <UiIcon name="more" className="column-action-icon" />
          </button>
          {menuOpen ? (
            <div className="column-popover" role="menu" aria-label={`Acoes da coluna ${column.name}`}>
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
              <div className="column-popover-separator" role="separator" />
              <button className="column-popover-danger" role="menuitem" onClick={onDelete}>
                <UiIcon name="trash" />
                <span>Excluir</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="column-cards-scroll" onDragOver={(event) => onDragOver(event, column.cards.length)} onDrop={(event) => { event.preventDefault(); onDrop(column.cards.length); }}>
        {column.cards.map((card, index) => (
          <div key={card.id} className={draggedCardId === card.id ? "card-drag-wrap dragging" : "card-drag-wrap"} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); const bounds = event.currentTarget.getBoundingClientRect(); onDragOver(event, event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const bounds = event.currentTarget.getBoundingClientRect(); onDrop(event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index); }}>
            {dropIndex === index ? <div className="card-drop-indicator" /> : null}
            <CardView card={card} onOpen={() => selectionMode ? onToggleCardSelection(card.id) : onOpenCard(card.id)} onContextMenu={(event) => onCardContextMenu(event, card)} selectionMode={selectionMode} selected={selectedCardIds.includes(card.id)} onToggleSelection={() => onToggleCardSelection(card.id)} onPreviewMedia={onPreviewMedia} onRemoveTag={onRemoveTag} draggable={dragEnabled && !selectionMode} onDragStart={() => onDragStart(card.id)} onDragEnd={onDragEnd} />
          </div>
        ))}
        {dropIndex === column.cards.length ? <div className="card-drop-indicator" /> : null}
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
    externalLinkUrl: string | null;
    artType: string;
    status: string[];
    tags: string[];
  }) => Promise<void>;
}) {
  const [columnId, setColumnId] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
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
    setMediaFile(null);
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
      setError("Coloque um titulo para o post.");
      return;
    }

    const fileLimit = mediaFile?.type.startsWith("video/")
      ? MAX_VIDEO_FILE_SIZE
      : MAX_MEDIA_FILE_SIZE;
    if (mediaFile && mediaFile.size > fileLimit) {
      setError(
        `“${mediaFile.name}” tem ${formatFileSize(mediaFile.size)}. O limite para ${mediaFile.type.startsWith("video/") ? "videos e 20 MB" : "imagens e 12 MB"}.`,
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        columnId: columnId || null,
        title: title.trim(),
        caption: caption.trim() || null,
        primaryMediaUrl: mediaFile ? await uploadAdminMedia(mediaFile) : null,
        externalLinkUrl: externalLinkUrl.trim() || null,
        artType,
        status: splitLabels(statusText),
        tags: splitLabels(tagsText),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel criar o post agora.");
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
            <p className="eyebrow">Conteudo da conta</p>
            <h3 id="card-editor-title">Novo post</h3>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <form className="card-editor-form" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Titulo</span>
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

          <label className="art-upload-field">
            <span>Arte do post <em>opcional</em></span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setMediaFile(selectedFile);

                if (!selectedFile) {
                  setError("");
                  return;
                }

                const isImage = selectedFile.type.startsWith("image/");
                const isVideo = selectedFile.type.startsWith("video/");
                if (!isImage && !isVideo) {
                  setError(`“${selectedFile.name}” nao e um formato aceito. Envie imagem ou video.`);
                  return;
                }

                const sizeLimit = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE;
                if (selectedFile.size > sizeLimit) {
                  setError(
                    `“${selectedFile.name}” tem ${formatFileSize(selectedFile.size)}. O limite para ${isVideo ? "videos e 20 MB" : "imagens e 12 MB"}.`,
                  );
                  return;
                }

                setError("");
              }}
            />
            <small>{mediaFile ? `${mediaFile.name} (${mediaFile.type.startsWith("video/") ? "maximo 20 MB" : "maximo 12 MB"})` : "Imagens viram WebP automaticamente. Sem arte, o card ficara vazio."}</small>
          </label>

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
            <span>Legenda ou observacao</span>
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
      setError("Nao foi possivel salvar agora. Tente novamente.");
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
              placeholder="Ex.: Em aprovacao"
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
              {saving ? "Salvando..." : column ? "Salvar alteracoes" : "Criar coluna"}
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
  position: { columnId: string | null; x: number; y: number };
  tags: ClientTagDefinition[];
  clients: AdminClientOption[];
  onClose: () => void;
  onUpdateStatus: (status: string) => Promise<void>;
  onToggleTag: (tag: string) => Promise<void>;
  onCopyToColumn: () => void;
  onMoveToColumn: () => void;
  onCopyToClient: (targetSlug: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<"status" | "tags" | "clients" | null>(null);
  const run = async (action: () => Promise<void>) => { await action(); onClose(); };
  return (
    <>
      <button className="card-menu-backdrop" aria-label="Fechar menu" onClick={onClose} />
      <section className="card-context-menu" style={{ left: position.x, top: position.y }} aria-label={`Acoes para ${card.title}`} onMouseLeave={() => setPanel(null)}>
        <button className={panel === "status" ? "active" : ""} onMouseEnter={() => setPanel("status")}>☷ <span>Status</span><b>›</b></button>
        {panel === "status" ? <div className="card-menu-submenu status-submenu">{CARD_STATUS_OPTIONS.map((status) => <button key={status} onClick={() => run(() => onUpdateStatus(status))}>{card.statusBadges[0] === status ? "✓ " : ""}{status}</button>)}</div> : null}
        <button className={panel === "tags" ? "active" : ""} onMouseEnter={() => setPanel("tags")}>◇ <span>Etiquetas</span><b>›</b></button>
        {panel === "tags" ? <div className="card-menu-submenu tags-submenu">{tags.map((tag) => <button key={tag.id} onClick={() => run(() => onToggleTag(tag.name))}>{card.tags.includes(tag.name) ? <b className="tag-menu-check">✓</b> : <i className="tag-menu-dot" style={{ backgroundColor: tag.color }} />}{tag.name}</button>)}</div> : null}
        <hr />
        <button onClick={onCopyToColumn}>▣ <span>Copiar card</span></button>
        <button onClick={onMoveToColumn}>⇄ <span>Mover para coluna</span></button>
        <button className={panel === "clients" ? "active" : ""} onMouseEnter={() => setPanel("clients")}>➤ <span>Enviar para outro cliente</span><b>›</b></button>
        {panel === "clients" ? <div className="card-menu-submenu clients-submenu">{clients.map((client) => <button key={client.id} onClick={() => run(() => onCopyToClient(client.slug))}>{client.name}</button>)}</div> : null}
        <button onClick={() => run(onArchive)}>▱ <span>Arquivar</span></button>
        <hr />
        <button className="danger" onClick={() => { if (window.confirm(`Excluir o card “${card.title}”? Esta acao nao pode ser desfeita.`)) run(onDelete); }}>♜ <span>Excluir</span></button>
      </section>
    </>
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

function BulkActionBar({ selectedCount, onCancel, onDelete, onArchive, onSendToClient, onStatus, onCopy, onMove }: {
  selectedCount: number; onCancel: () => void; onDelete: () => Promise<void>; onArchive: () => Promise<void>;
  onSendToClient: () => Promise<void>; onStatus: (status: string) => Promise<void>; onCopy: () => void; onMove: () => void;
}) {
  return <aside className="bulk-action-bar">
    <strong>{selectedCount} {selectedCount === 1 ? "card selecionado" : "cards selecionados"}</strong>
    <button disabled={!selectedCount} onClick={onCopy}>Copiar</button><button disabled={!selectedCount} onClick={onMove}>Mover</button>
    <button disabled={!selectedCount} onClick={() => void onSendToClient()}>Enviar para cliente</button>
    <select disabled={!selectedCount} defaultValue="" onChange={(event) => { if (event.target.value) { void onStatus(event.target.value); event.target.value = ""; } }}><option value="">Mudar status</option>{CARD_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
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
      <div className="modal-actions"><button className="ghost-button" onClick={onClose} disabled={saving}>Cancelar</button><button className="gradient-button" disabled={saving} onClick={async () => { setSaving(true); try { await onConfirm(columnId || null); } finally { setSaving(false); } }}>{saving ? "Restaurando..." : "Restaurar"}</button></div>
    </section>
  </div>;
}

function AdminTextsView({ clientName, slug }: { clientName: string; slug: string }) {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const commentsRef = useRef<HTMLElement>(null);
  const studioRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const selected = documents.find((item) => item.id === selectedId) ?? null;
  const initials = (name: string) => name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const refreshTexts = async (selectId?: string) => {
    setLoading(true);
    try {
      const response = await listAdminTextsBySlug(slug);
      setDocuments(response.items);
      setSelectedId((current) => selectId ?? (response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null));
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível carregar os textos."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refreshTexts(); }, [slug]);
  useEffect(() => {
    if (!selected) { setComments([]); return; }
    if (editorRef.current) editorRef.current.innerHTML = selected.contentHtml;
    void listAdminTextCommentsBySlug(slug, selected.id).then((result) => setComments(result.comments)).catch(() => setComments([]));
  }, [selected?.id, slug]);
  const updateLocal = (patch: Partial<TextDocument>) => selected && setDocuments((items) => items.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  const formatDocument = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); };
  const saveText = async (message = "Rascunho salvo.") => {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await updateAdminTextBySlug(slug, selected.id, { title: selected.title, contentType: selected.contentType, plannedAt: selected.plannedAt, internalNotes: selected.internalNotes, status: selected.status, contentHtml: editorRef.current?.innerHTML ?? selected.contentHtml });
      updateLocal(response.text);
      setActionMessage(message);
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível salvar o texto."); }
    finally { setSaving(false); }
  };
  const createText = async () => {
    try { const response = await createAdminTextBySlug(slug, { title: "Novo texto", contentType: "Texto" }); setDocuments((items) => [response.text, ...items]); setSelectedId(response.text.id); setActionMessage("Novo texto criado."); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível criar o texto."); }
  };
  const addEditorImage = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    try { const url = await uploadAdminMedia(file); const image = document.createElement("img"); image.src = url; image.alt = "Imagem inserida no texto"; image.className = "texts-inline-image"; editorRef.current?.append(image, document.createElement("p")); setActionMessage("Imagem adicionada. Salve o texto para publicar a alteração."); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem."); }
  };
  const downloadWord = () => {
    if (!selected) return;
    const content = `<html><body><h1>${selected.title}</h1>${editorRef.current?.innerHTML ?? selected.contentHtml}</body></html>`;
    const url = URL.createObjectURL(new Blob([content], { type: "application/msword" })); const link = document.createElement("a"); link.href = url; link.download = `${selected.title.slice(0, 55)}.doc`; link.click(); URL.revokeObjectURL(url); setActionMessage("Arquivo Word baixado.");
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
  const visibleDocuments = documents.filter((item) => (filter === "Todos os textos" || item.status === filter) && item.title.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const countFor = (label: string) => label === "Todos os textos" ? documents.length : documents.filter((item) => item.status === label).length;
  if (loading && !selected) return <section className="texts-studio"><div className="texts-loading">Carregando textos...</div></section>;
  if (!selected) return <section className="texts-studio"><div className="texts-loading"><p>Nenhum texto criado ainda.</p><button className="gradient-button" onClick={() => void createText()}>+ Criar primeiro texto</button></div></section>;
  return <section className="texts-studio" ref={studioRef} onScroll={(event) => { const next = event.currentTarget.scrollTop > 180; setShowScrollTop((current) => current === next ? current : next); }}>
    <aside className="texts-library">
      <div className="texts-library-head"><div><p className="column-kicker">Biblioteca</p><h3>Textos</h3></div><button className="texts-new-button" onClick={() => void createText()}>+ Novo texto</button></div>
      <label className="texts-search"><UiIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar textos" /></label>
      <nav className="texts-nav" aria-label="Categorias de textos">{["Todos os textos", "Rascunho", "Em revisão", "Aprovado"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "Todos os textos" ? "▣" : item === "Rascunho" ? "◌" : item === "Em revisão" ? "◒" : "✓"} {item}<span>{countFor(item)}</span></button>)}</nav>
      <button className="texts-library-comments" onClick={() => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>▢ <span>Comentários</span><b>{comments.length}</b></button>
      <div className="texts-document-list">{visibleDocuments.map((item) => <button key={item.id} className={selected.id === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}><span>{item.contentType}</span><strong>{item.title}</strong><small>{item.status}</small></button>)}</div>
    </aside>
    <article className="texts-document">
        <header className="texts-breadcrumb">Textos <span>›</span> {selected.contentType}</header>
      <div className="texts-paper">
        <div className="texts-rich-toolbar" role="toolbar" aria-label="Ferramentas de edição"><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("undo")} title="Desfazer">↶</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("redo")} title="Refazer">↷</button><i /><select aria-label="Estilo do texto" defaultValue="p" onChange={(event) => formatDocument("formatBlock", event.target.value)}><option value="p">Texto normal</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="blockquote">Citação</option></select><i /><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("bold")} title="Negrito"><b>B</b></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("italic")} title="Itálico"><em>I</em></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("underline")} title="Sublinhado"><u>U</u></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("insertUnorderedList")} title="Lista">☷</button><button onMouseDown={(event) => event.preventDefault()} onClick={() => formatDocument("createLink", window.prompt("Cole o link") ?? "")} title="Inserir link">⌁</button><label title="Adicionar imagem">▧<input type="file" accept="image/*" onChange={(event) => addEditorImage(event.target.files?.[0] ?? null)} /></label></div>
        <header className="texts-paper-head"><div><span className="texts-status">{selected.status}</span><input className="texts-title-input" value={selected.title} onChange={(event) => updateLocal({ title: event.target.value })} aria-label="Título do texto" /><div className="texts-meta"><span>◇ {selected.contentType}</span><span>◷ Atualizado {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(selected.updatedAt))}</span></div></div><div className="texts-presence"><span>LP</span><span>AM</span></div></header>
        <div className="texts-cover" aria-hidden="true"><i /><b /></div>
        <div className="texts-copy texts-rich-editor" ref={editorRef} contentEditable suppressContentEditableWarning />
        <section className="texts-comments-section" ref={commentsRef}><header><div><span>Discussão</span><h2>Comentários ({comments.length})</h2></div></header><div className="texts-comment-list">{comments.map((comment) => <article key={comment.id}>{comment.authorAvatarUrl ? <span className="texts-comment-avatar"><img src={comment.authorAvatarUrl} alt="" /></span> : <span className="texts-comment-avatar">{initials(comment.authorName)}</span>}<div><strong>{comment.authorName}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.createdAt))}</time><p>{comment.commentText}</p></div></article>)}</div><div className="texts-comment-compose"><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Escreva um comentário para o cliente e a equipe..." /><button className="gradient-button" disabled={!commentDraft.trim()} onClick={() => void submitComment()}>Comentar</button></div></section>
      </div>
    </article>
    <aside className="texts-side-panel">
      <section className="texts-content-type"><span>Tipo de conteúdo</span><div><button className="texts-content-type-trigger" onClick={() => setContentTypeOpen((open) => !open)} aria-expanded={contentTypeOpen}>{selected.contentType}<b>⌄</b></button>{contentTypeOpen ? <div className="texts-content-type-options">{contentTypes.map((type) => <button key={type} className={type === selected.contentType ? "selected" : ""} onClick={() => { updateLocal({ contentType: type }); setContentTypeOpen(false); }}>{type === selected.contentType ? <b>✓</b> : null}{type}</button>)}</div> : null}</div></section>
      <section className="texts-actions texts-admin-actions">
        <button className="gradient-button" onClick={() => setShowPreview(true)}>◉ Pré-visualizar</button>
        <button className="ghost-button" onClick={() => { window.print(); setActionMessage("Use a janela de impressão para salvar em PDF."); }}>⇩ Baixar PDF</button>
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
    {showPreview ? <div className="profile-modal-backdrop" onMouseDown={() => setShowPreview(false)}><section className="profile-modal texts-preview-modal" onMouseDown={(event) => event.stopPropagation()}><header><h3>Pré-visualização</h3><button onClick={() => setShowPreview(false)}>×</button></header><article><h1>{selected.title}</h1><div dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML ?? selected.contentHtml }} /></article></section></div> : null}
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
  const source = card.scheduledAt ?? card.archivedAt;
  if (!source) return new Date(0);
  // SQL schedules arrive as YYYY-MM-DD HH:mm:ss. Parsing explicitly as local time
  // prevents a scheduled post from moving to the prior month in a negative timezone.
  const normalized = source.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
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
  const url = media.urls[media.index];
  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  const hasPrevious = media.index > 0;
  const hasNext = media.index < media.urls.length - 1;
  return <div className="media-preview-backdrop" onMouseDown={onClose} role="presentation"><section className="media-preview-modal" role="dialog" aria-modal="true" aria-label={`Visualização de ${media.title}`} onMouseDown={(event) => event.stopPropagation()}><button className="media-preview-close" onClick={onClose} aria-label="Fechar visualização">×</button>{media.urls.length > 1 ? <><button className="media-preview-nav previous" onClick={() => onNavigate(-1)} disabled={!hasPrevious} aria-label="Arquivo anterior">‹</button><button className="media-preview-nav next" onClick={() => onNavigate(1)} disabled={!hasNext} aria-label="Próximo arquivo">›</button><span className="media-preview-count">{media.index + 1} de {media.urls.length}</span></> : null}{isVideo ? <video key={url} src={url} controls autoPlay /> : <img key={url} src={url} alt={`${media.title} - arquivo ${media.index + 1}`} />}</section></div>;
}

function CardView({ card, onOpen, onContextMenu, selectionMode = false, selected = false, onToggleSelection, onPreviewMedia, onRemoveTag, draggable = false, onDragStart, onDragEnd }: { card: BoardCard; onOpen: () => void; onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void; selectionMode?: boolean; selected?: boolean; onToggleSelection?: () => void; onPreviewMedia?: (card: BoardCard) => void; onRemoveTag?: (card: BoardCard, tag: string) => void; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const primaryBadge = card.statusBadges[0] ?? null;

  return (
    <button className={selected ? "content-card glass-subtle card-button selected" : "content-card glass-subtle card-button"} onClick={onOpen} onContextMenu={onContextMenu} draggable={draggable} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; onDragStart?.(); }} onDragEnd={onDragEnd}>
      {selectionMode ? <span className={selected ? "card-select-checkbox checked" : "card-select-checkbox"} onClick={(event) => { event.stopPropagation(); onToggleSelection?.(); }}>{selected ? "✓" : ""}</span> : null}
      <div className="card-title-block">
        <h4>{card.title}</h4>
        {primaryBadge ? (
          <span className={`status-chip ${statusTone(primaryBadge)}`}>
            <span className="status-chip-dot" />
            {primaryBadge}
          </span>
        ) : null}
      </div>
      {card.mediaUrl ? (
        <div className={onPreviewMedia ? `media-frame ${card.mediaAspect} card-media-zoom` : `media-frame ${card.mediaAspect}`} onClick={(event) => { if (!onPreviewMedia) return; event.stopPropagation(); onPreviewMedia(card); }}>
          <div className="card-media-overlay">
            <span className="card-type">{card.typeLabel}</span>
            <span className="card-media-menu">{onPreviewMedia ? "⌕" : "..."}</span>
          </div>
          {card.mediaUrls && card.mediaUrls.length > 1 ? <span className="card-media-count">{card.mediaUrls.length}</span> : null}
          <img src={card.mediaUrl} alt={card.title} />
        </div>
      ) : null}

      <div className="card-meta">
        <div className="card-inline">
          {card.statusBadges.slice(1).map((badge) => (
            <span key={badge} className="mini-badge subtle">{badge}</span>
          ))}
          {card.tags.map((tag) => <span key={tag} className={onRemoveTag ? "mini-badge tag tag-filled removable" : "mini-badge tag tag-filled"} style={{ backgroundColor: card.tagColors?.[tag] ?? "#8263e8" }} onClick={(event) => { if (!onRemoveTag) return; event.stopPropagation(); onRemoveTag(card, tag); }}><span className="card-tag-dot" />{tag}{onRemoveTag ? <span className="card-tag-remove" aria-label={`Remover ${tag}`}>×</span> : null}</span>)}
          {card.commentsCount > 0 ? <span className="card-comment-count" title={`${card.commentsCount} ${card.commentsCount === 1 ? "comentário" : "comentários"}`}><UiIcon name="comment" />{card.commentsCount}</span> : null}
        </div>
      </div>

      {card.scheduledAt ? <div className="card-schedule-line">{formatScheduledCardDate(card.scheduledAt)}</div> : null}
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
        title="Essa area do cliente nao pertence a este login"
        body="O cliente entra apenas nas contas vinculadas ao proprio acesso. A equipe interna pode abrir a visao do cliente para conferencia."
        backHref={getDefaultRoute(session)}
      />
    );
  }

  return <ClientPortalWorkspacePage session={session} slug={slug} onLogout={onLogout} />;
}

function ClientProfileMenu({ session, slug, onLogout, clientLogoUrl, accountName }: { session: SessionUser; slug: string; onLogout: () => void; clientLogoUrl?: string | null; accountName: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<"password" | "accounts" | null>(null);
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
  const savePassword = async () => {
    setSaving(true); setMessage("");
    try { await changeMyPassword({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setMessage("Senha atualizada com sucesso."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a senha."); }
    finally { setSaving(false); }
  };
  const hasMultipleAccounts = session.assignedPortalSlugs.length > 1;
  return (
    <div className="profile-menu portal-user-card glass-subtle profile-menu-upward" ref={menuRef}>
      <button className="portal-user-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="portal-client-avatar">{clientLogoUrl ? <img src={clientLogoUrl} alt="" /> : accountName.slice(0, 2).toUpperCase()}</span>
        <span className="session-copy"><strong>{accountName}</strong><span>{roleLabel(session.role)}</span></span>
        <UiIcon name="chevron-down" className="session-caret" />
      </button>
      {open ? (
        <div className="profile-popover profile-popover-up">
          <button onClick={() => show("password")}><span>⚿</span>Alterar Senha</button>
          {hasMultipleAccounts ? <button onClick={() => show("accounts")}><span>♧</span>Trocar de conta</button> : null}
          <hr />
          <button className="profile-logout" onClick={onLogout}><span>⇥</span>Sair</button>
        </div>
      ) : null}
      {dialog ? (
        <div className="profile-modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section className="profile-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h3>{dialog === "password" ? "Alterar Senha" : "Trocar de conta"}</h3>
              <button onClick={() => setDialog(null)} aria-label="Fechar">×</button>
            </header>
            {dialog === "password" ? (
              <div className="profile-form">
                <label>Senha atual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                <label>Nova senha<input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                <button className="gradient-button" disabled={saving || !currentPassword || newPassword.length < 8} onClick={() => void savePassword()}>{saving ? "Salvando..." : "Salvar nova senha"}</button>
              </div>
            ) : null}
            {dialog === "accounts" ? (
              <div className="profile-agenda">
                {session.assignedPortalSlugs.map((accountSlug) => (
                  <a key={accountSlug} href={`/portal/${accountSlug}`} onClick={(event) => { event.preventDefault(); setDialog(null); navigate(`/portal/${accountSlug}`); }} className={accountSlug === slug ? "selected" : ""}>
                    {accountSlug.replace(/-/g, " ")}{accountSlug === slug ? <small>Conta atual</small> : null}
                  </a>
                ))}
              </div>
            ) : null}
            {message ? <p className="profile-message">{message}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ClientPortalInvoicesView({ invoices, onViewInvoice }: { invoices: BillingInvoice[]; onViewInvoice?: (invoiceId: string) => void }) {
  const [previewInvoice, setPreviewInvoice] = useState<BillingInvoice | null>(null);
  const [printRequested, setPrintRequested] = useState(false);
  useEffect(() => {
    if (!previewInvoice || !printRequested) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 120);
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

  return <section className="portal-invoices-view glass">
    <header className="portal-invoices-head"><div><p className="eyebrow">Financeiro</p><h1>Faturas</h1><p>Consulte os lançamentos disponibilizados para sua conta.</p></div><span>{invoices.length} {invoices.length === 1 ? "fatura" : "faturas"}</span></header>
    {invoices.length ? <div className="portal-invoices-list">{invoices.map((invoice) => <article key={invoice.id} className="portal-invoice-row"><div className="portal-invoice-number">#{invoice.number}</div><div className="portal-invoice-main"><strong>{invoice.title}</strong><span>Emitida em {formatBillingDate(invoice.issueDate)} · Vencimento {formatBillingDate(invoice.dueDate)}</span></div><div className="portal-invoice-value"><strong>{formatBillingMoney(getBillingInvoiceTotal(invoice), invoice.currency)}</strong><em className={`invoice-status ${invoice.status}`}>{invoice.status === "paid" ? "Paga" : invoice.status === "overdue" ? "Atrasada" : invoice.status === "cancelled" ? "Cancelada" : "Aberta"}</em></div><div className="portal-invoice-actions"><button className="ghost-button" onClick={() => previewInvoiceForClient(invoice)}><UiIcon name="eye" />Visualizar</button><button className="ghost-button" onClick={() => downloadInvoice(invoice)}><UiIcon name="file" />Baixar</button></div></article>)}</div> : <div className="portal-invoices-empty"><span>▣</span><h2>Nenhuma fatura disponível</h2><p>Quando uma fatura for liberada para esta conta, ela aparecerá aqui.</p></div>}
    {previewInvoice ? <div className="modal-backdrop" onClick={() => setPreviewInvoice(null)}><section className="portal-invoice-preview-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Visualização da fatura</p><h2>{previewInvoice.title}</h2><span>Fatura #{previewInvoice.number}</span></div><button className="icon-close" onClick={() => setPreviewInvoice(null)} aria-label="Fechar">×</button></header><BillingInvoiceDocument invoice={previewInvoice} /><footer><button className="ghost-button" onClick={() => setPreviewInvoice(null)}>Fechar</button><button className="gradient-button" onClick={() => window.print()}><UiIcon name="file" />Baixar</button></footer></section></div> : null}
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
  return /(aprov|finaliz|public)/.test(statusText);
}

function portalCardAssets(card: BoardCard) {
  return Array.from(new Set([...(card.mediaUrls ?? []), ...(card.mediaUrl ? [card.mediaUrl] : [])]));
}

async function downloadPortalCardAssets(card: BoardCard) {
  const assets = portalCardAssets(card);
  for (const [index, url] of assets.entries()) {
    const extension = url.split("?")[0].split(".").pop() || "jpg";
    const fileName = `${card.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase()}-${index + 1}.${extension}`;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.click();
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
}

function ClientApprovedPostsView({ cards }: { cards: BoardCard[] }) {
  const approvedCards = cards.filter(isPortalApproved);
  return <section className="portal-approved-view glass">
    <header className="portal-approved-head"><div><p className="eyebrow">Conteúdos aprovados</p><h1>Aprovados</h1><p>Baixe as artes que já receberam aprovação do cliente.</p></div><span>{approvedCards.length} {approvedCards.length === 1 ? "post" : "posts"}</span></header>
    {approvedCards.length ? <div className="portal-approved-list">{approvedCards.map((card) => { const assets = portalCardAssets(card); return <article key={card.id} className="portal-approved-card"><div className="portal-approved-preview">{card.mediaUrl ? <img src={card.mediaUrl} alt={card.title} /> : <span>Sem arte</span>}</div><div className="portal-approved-copy"><span className="portal-text-status approved">Aprovado</span><h2>{card.title}</h2><p>{assets.length} {assets.length === 1 ? "arte disponível" : "artes disponíveis"}</p><button className="gradient-button" onClick={() => void downloadPortalCardAssets(card)} disabled={assets.length === 0}>{assets.length > 1 ? "Baixar todas as artes" : "Baixar arte"}</button></div></article>; })}</div> : <div className="portal-approved-empty"><span>✓</span><h2>Nenhum post aprovado ainda</h2><p>Quando o cliente aprovar um post, ele aparecerá aqui para download.</p></div>}
  </section>;
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
  const data = resource.data;
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [portalView, setPortalView] = useState<"board" | "approved" | "texts" | "reports" | "invoices">("board");
  const [portalInvoices, setPortalInvoices] = useState<BillingInvoice[]>([]);
  const [viewedInvoiceIds, setViewedInvoiceIds] = useState<string[]>([]);
  const [portalReportsCount, setPortalReportsCount] = useState(0);
  const [portalTexts, setPortalTexts] = useState<TextDocument[]>([]);
  const [selectedPortalTextId, setSelectedPortalTextId] = useState<string | null>(null);
  const [portalTextComments, setPortalTextComments] = useState<TextComment[]>([]);
  const [portalTextCommentDraft, setPortalTextCommentDraft] = useState("");
  const [portalTextSubmitting, setPortalTextSubmitting] = useState<"comment" | "approve" | "changes" | null>(null);
  const [portalTextFeedback, setPortalTextFeedback] = useState<string | null>(null);
  const loadCardDetail = useCallback(
    (cardId: string) => loadPortalCardDetailBySlug(slug, cardId),
    [slug],
  );
  const detail = useCardDetail(data, selectedCardId, loadCardDetail, refreshKey);
  useEffect(() => {
    if (!data.accountName) return;
    setPortalInvoices(loadClientVisibleInvoices(data.accountName));
  }, [data.accountName, refreshKey]);
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
    void listPortalReportsBySlug(slug)
      .then((response) => setPortalReportsCount(response.items.length))
      .catch(() => setPortalReportsCount(0));
  }, [slug, refreshKey]);
  useEffect(() => {
    if (portalView !== "texts") return;
    void listPortalTextsBySlug(slug).then((response) => {
      setPortalTexts(response.items);
      setSelectedPortalTextId((current) => response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null);
    }).catch(() => setPortalTexts([]));
  }, [portalView, slug]);
  const selectedPortalText = portalTexts.find((item) => item.id === selectedPortalTextId) ?? null;
  const portalCards = [...data.boardColumns.flatMap((column) => column.cards), ...data.withoutColumn];
  const portalGreeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";
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
          ? "Comentário enviado."
          : action === "approve"
            ? "Texto aprovado com sucesso."
            : "Solicitação de alteração enviada.",
      );
    } catch (error) {
      setPortalTextFeedback(error instanceof Error ? error.message : "Não foi possível enviar o retorno.");
    } finally {
      setPortalTextSubmitting(null);
    }
  }

  return (
    <div className="portal-page">
      <aside className="portal-sidebar glass">
        <div className="portal-brand-zone">
          <div className="brand-lockup compact">
          <div className="brand-badge"><img src={designHubV2Logo} alt="Design Hub" /></div>
          <div>
            <p className="eyebrow">Portal do cliente</p>
          </div>
          </div>
        </div>

        <nav className="portal-nav">
          {[
            { label: "Aprovacoes", count: portalCards.length },
            { label: "Textos", count: 0 },
            { label: "Aprovados", count: 0 },
            { label: "Faturas", count: portalInvoices.filter((invoice) => !viewedInvoiceIds.includes(invoice.id)).length },
            { label: "Relatorios", count: portalReportsCount },
          ].map(({ label, count }) => (
            <button key={label} onClick={() => label === "Textos" ? setPortalView("texts") : label === "Relatorios" ? setPortalView("reports") : label === "Faturas" ? setPortalView("invoices") : label === "Aprovados" ? setPortalView("approved") : label === "Aprovacoes" ? setPortalView("board") : undefined} className={(label === "Textos" ? portalView === "texts" : label === "Relatorios" ? portalView === "reports" : label === "Faturas" ? portalView === "invoices" : label === "Aprovados" ? portalView === "approved" : label === "Aprovacoes" && portalView === "board") ? "portal-nav-item active" : "portal-nav-item"}>
              <span>{label}</span>
              {count > 0 ? <b className="portal-nav-count">{count}</b> : null}
            </button>
          ))}
        </nav>
        <ClientProfileMenu session={session} slug={slug} onLogout={onLogout} clientLogoUrl={data.clientLogoUrl} accountName={data.accountName} />
      </aside>

      <main className="portal-main">
        <section className="hero glass">
          <div>
            <p className="eyebrow">{data.locale}</p>
            <h2>{portalGreeting}, {data.clientGreetingName || data.accountName}</h2>
          </div>

          <div className="widget-flags">
            {Object.entries(data.widgets)
              .filter(([key, enabled]) => enabled && key !== "invoices")
              .map(([key]) => (
                <span key={key} className="pill active">
                  {labelForWidget(key)}
                </span>
              ))}
          </div>
        </section>

        {portalView === "approved" ? <ClientApprovedPostsView cards={portalCards} /> : portalView === "invoices" ? <ClientPortalInvoicesView invoices={portalInvoices} onViewInvoice={markInvoiceViewed} /> : portalView === "reports" ? <PortalReports slug={slug} clientName={data.accountName} locale={data.locale} /> : portalView === "texts" ? <section className="portal-texts-view glass"><aside>{portalTexts.map((item) => <button key={item.id} className={item.id === selectedPortalTextId ? "selected" : ""} onClick={() => { setSelectedPortalTextId(item.id); setPortalTextCommentDraft(""); setPortalTextFeedback(null); }}><small>{item.contentType}</small><strong>{item.title}</strong></button>)}</aside><article>{selectedPortalText ? <><p className="eyebrow">{selectedPortalText.contentType}</p><div className="portal-text-heading"><div><h1>{selectedPortalText.title}</h1><span className={`portal-text-status ${selectedPortalText.status === "Aprovado" ? "approved" : ""}`}>{selectedPortalText.status}</span></div></div><div className="portal-text-content" dangerouslySetInnerHTML={{ __html: selectedPortalText.contentHtml }} /><section className="portal-text-feedback"><h3>Seu feedback</h3><p>Comente sobre este texto ou escolha uma ação para enviar seu retorno à equipe.</p><textarea value={portalTextCommentDraft} onChange={(event) => setPortalTextCommentDraft(event.target.value)} placeholder="Escreva seu comentário sobre este texto..." /><div className="portal-text-actions"><button className="ghost-button" disabled={portalTextSubmitting !== null || !portalTextCommentDraft.trim()} onClick={() => void handlePortalTextAction("comment")}>{portalTextSubmitting === "comment" ? "Enviando..." : "Adicionar comentário"}</button><button className="gradient-button" disabled={portalTextSubmitting !== null || !portalTextCommentDraft.trim()} onClick={() => void handlePortalTextAction("approve")}>{portalTextSubmitting === "approve" ? "Enviando..." : "Aprovar"}</button><button className="danger-button" disabled={portalTextSubmitting !== null || !portalTextCommentDraft.trim()} onClick={() => void handlePortalTextAction("changes")}>{portalTextSubmitting === "changes" ? "Enviando..." : "Pedir alteração"}</button></div>{portalTextFeedback ? <p className="portal-text-feedback-message">{portalTextFeedback}</p> : null}<div className="portal-text-comments"><h4>Comentários ({portalTextComments.length})</h4>{portalTextComments.map((comment) => <article key={comment.id}><div><strong>{comment.authorName}</strong><span>{comment.authorRole}</span></div><p>{comment.commentText}</p></article>)}</div></section></> : <p>Nenhum texto foi enviado para sua área ainda.</p>}</article></section> : <section className="portal-grid">
          <div className="portal-primary">
            <div className="glass board-shell">
              <div className="board-topbar">
                <div className="tab-strip">
                  <span className="tab active">Quadro do cliente</span>
                  <span className="tab">Calendario</span>
                  <span className="tab">Brand Brain</span>
                </div>
                <label className="search-box" aria-label="Buscar post ou legenda"><UiIcon name="search" /><input type="search" aria-label="Buscar post ou legenda" /></label>
              </div>

              <div className="portal-columns-scroll">
                {data.boardColumns.map((column) => (
                  <section key={column.id} className="portal-column glass-subtle">
                    <header className="portal-column-head" style={{ borderColor: column.color }}>
                      <h3>{column.name}</h3>
                      <span>{column.cards.length}</span>
                    </header>

                    <div className="portal-card-list">
                      {column.cards.map((card) => (
                        <button
                          key={card.id}
                          className="portal-card card-button"
                          onClick={() => setSelectedCardId(card.id)}
                        >
                          {card.mediaUrl ? <div className={`media-frame ${card.mediaAspect}`}><img src={card.mediaUrl} alt={card.title} /></div> : null}
                          <div className="portal-card-copy">
                            <h4>{card.title}</h4>
                            {card.scheduledAt ? <p>{formatScheduledCardDate(card.scheduledAt)}</p> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}

                {data.withoutColumn.length > 0 ? (
                  <section className="portal-column glass-subtle">
                    <header className="portal-column-head" style={{ borderColor: "#7a86a9" }}>
                      <h3>{awaitingApprovalLabel(data.locale)}</h3>
                      <span>{data.withoutColumn.length}</span>
                    </header>
                    <div className="portal-card-list">
                      {data.withoutColumn.map((card) => (
                        <button
                          key={card.id}
                          className="portal-card card-button"
                          onClick={() => setSelectedCardId(card.id)}
                        >
                          {card.mediaUrl ? <div className={`media-frame ${card.mediaAspect}`}><img src={card.mediaUrl} alt={card.title} /></div> : null}
                          <div className="portal-card-copy">
                            <h4>{card.title}</h4>
                            {card.scheduledAt ? <p>{formatScheduledCardDate(card.scheduledAt)}</p> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <div className="portal-secondary">
            <section className="glass widget-card">
              <div className="widget-head">
                <h3>Próximos posts</h3>
                <span>{data.calendarEvents.length}</span>
              </div>
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
            </section>

            {data.widgets.upcomingPosts ? (
              <section className="glass widget-card">
                <div className="widget-head">
                  <h3>Proximos posts</h3>
                  <span>{data.upcomingItems.length}</span>
                </div>
                <div className="widget-list">
                  {data.upcomingItems.map((item) => (
                    <article key={item.id} className="list-item">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.channel}</p>
                      </div>
                      <span>{formatScheduledCardDate(item.scheduledAt)}</span>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {data.widgets.reports ? (
              <section className="glass widget-card">
                <div className="widget-head">
                  <h3>Relatorios</h3>
                  <span>Mensal</span>
                </div>
                <p className="widget-paragraph">
                  O cliente encontra aqui os relatórios liberados por permissão, sem ver nada do
                  restante da operacao interna.
                </p>
              </section>
            ) : null}
          </div>
        </section>}
      </main>

      <CardDetailModal
        mode="portal"
        titlePrefix="Card do cliente"
        detail={detail.data}
        loading={detail.loading}
        source={detail.source}
        onAddComment={(cardId, commentText) =>
          addPortalCardCommentBySlug(slug, cardId, { commentText })
        }
        onApprove={(cardId, commentText) =>
          submitPortalCardDecisionBySlug(slug, cardId, { approved: true, commentText })
        }
        onRequestChanges={(cardId, commentText) =>
          submitPortalCardDecisionBySlug(slug, cardId, { approved: false, commentText })
        }
        onRefresh={() => setRefreshKey((value) => value + 1)}
        onClose={() => setSelectedCardId(null)}
      />
    </div>
  );
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
  onRefresh: () => void;
  onClose: () => void;
  adminContext?: { slug: string; columns: BoardColumn[] };
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const [submitting, setSubmitting] = useState<"comment" | "approve" | "changes" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!detail) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detail, onClose]);

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
          ? "Comentario salvo."
          : action === "approve"
            ? "Card aprovado com sucesso."
            : "Solicitação de alteração enviada.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-panel glass${mode === "portal" ? " portal-card-detail-modal" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{titlePrefix}</p>
            <h3>{detail.card.title}</h3>
          </div>
          <button className="ghost-button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <StatusBanner
          source={source}
          loading={loading}
          message={
            source === "backend"
              ? "Detalhe carregado da base real."
              : "Nao consegui carregar este detalhe na API da V2."
          }
        />

        <div className="modal-grid">
          <div className="modal-media">
            {detail.card.mediaUrl ? (
              <div className={`media-frame ${detail.card.mediaAspect}`}>
                <img src={detail.card.mediaUrl} alt={detail.card.title} />
              </div>
            ) : null}
            <div className="badge-row">
              {detail.card.statusBadges.map((badge) => (
                <span key={badge} className="mini-badge status">
                  {badge}
                </span>
              ))}
              {detail.card.tags.map((tag) => (
                <span key={tag} className="mini-badge tag">
                  {tag}
                </span>
              ))}
            </div>
            {detail.card.externalLinkUrl ? (
              <a className="external-card-link" href={detail.card.externalLinkUrl} target="_blank" rel="noreferrer">
                Abrir link externo ↗
              </a>
            ) : null}
          </div>

          <div className="modal-sidebar-copy">
            <section className="glass-subtle modal-card">
              <h4>Resumo</h4>
              <p>{detail.card.subtitle ?? "Sem legenda cadastrada ainda."}</p>
              <div className="detail-list">
                <div>
                  <span>Status do cliente</span>
                  <strong>{detail.card.clientLabel}</strong>
                </div>
                <div>
                  <span>Agendamento</span>
                  <strong>{detail.card.scheduledAt ? formatScheduledCardDate(detail.card.scheduledAt) : "Nao agendado"}</strong>
                </div>
                <div>
                  <span>Comentarios</span>
                  <strong>{detail.comments.length}</strong>
                </div>
              </div>
            </section>

            <section className="glass-subtle modal-card portal-feedback-card">
              <h4>{mode === "portal" ? "Seu feedback" : "Comentários"}</h4>
              {mode === "portal" ? <p className="portal-feedback-helper">Comente sobre este post ou escolha uma ação para enviar seu retorno à equipe.</p> : null}
              <div className="comment-form">
                <textarea
                  className="comment-input"
                  placeholder={
                    mode === "admin"
                      ? "Escreva um comentário interno para este card"
                      : "Escreva aqui seu comentário sobre este post"
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
                    {submitting === "comment" ? "Salvando..." : "Adicionar comentário"}
                  </button>
                  <button
                    className="gradient-button"
                    disabled={submitting !== null}
                    onClick={() =>
                      handleAction("approve", () => onApprove(detail.card.id, commentDraft.trim()))
                    }
                  >
                    {submitting === "approve" ? "Enviando..." : "Aprovar"}
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
                        {submitting === "changes" ? "Enviando..." : "Pedir alteração"}
                  </button>
                </div>
                {feedback ? <p className="form-feedback">{feedback}</p> : null}
              </div>
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

            {detail.approvalLinks.length > 0 ? (
              <section className="glass-subtle modal-card">
                <h4>Links de aprovacao</h4>
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
      </div>
    </div>
  );
}

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
  const [title, setTitle] = useState(card.title);
  const [caption, setCaption] = useState(card.subtitle ?? "");
  const [artType, setArtType] = useState(normalizeArtType(card.typeLabel));
  const [columnId, setColumnId] = useState<string>("");
  const [status, setStatus] = useState(card.statusBadges[0] ?? "Entrada");
  const [clientLabel, setClientLabel] = useState(card.clientLabel);
  const [tags, setTags] = useState(card.tags.join(", "));
  const [tagLibrary, setTagLibrary] = useState<ClientTagDefinition[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#5e5cf1");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [hashtags, setHashtags] = useState((card.hashtags ?? []).join(", "));
  const [hashtagGroups, setHashtagGroups] = useState<HashtagGroup[]>([]);
  const [hashtagPickerOpen, setHashtagPickerOpen] = useState(false);
  const [newHashtagGroupName, setNewHashtagGroupName] = useState("");
  const [newHashtagGroupText, setNewHashtagGroupText] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocal(card.scheduledAt));
  const [externalLinkUrl, setExternalLinkUrl] = useState(card.externalLinkUrl ?? "");
  const [keepFiles, setKeepFiles] = useState(card.keepFiles ?? false);
  const [mediaUrls, setMediaUrls] = useState(card.mediaUrls ?? (card.mediaUrl ? [card.mediaUrl] : []));
  const [commentDraft, setCommentDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);

  useEffect(() => {
    const matching = columns.find((column) => column.cards.some((item) => item.id === card.id));
    setColumnId(matching?.id ?? "");
  }, [card.id, columns]);

  useEffect(() => {
    listAdminTagsBySlug(slug).then((result) => setTagLibrary(result.items)).catch(() => undefined);
    listAdminHashtagGroupsBySlug(slug).then((result) => setHashtagGroups(result.items)).catch(() => undefined);
  }, [slug]);

  const splitValues = (value: string) =>
    value.split(",").map((item) => item.trim()).filter(Boolean);

  async function handleUpload(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    const invalidFile = selectedFiles.find((file) => file.size > (file.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE));
    if (invalidFile) {
      const max = invalidFile.type.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_MEDIA_FILE_SIZE;
      setFeedback(`“${invalidFile.name}” tem ${(invalidFile.size / 1024 / 1024).toFixed(1)} MB. O limite para ${invalidFile.type.startsWith("video/") ? "videos" : "imagens"} e ${Math.round(max / 1024 / 1024)} MB.`);
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
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function saveCard() {
    if (!title.trim()) {
      setFeedback("Informe um titulo para salvar o card.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateAdminCardBySlug(slug, card.id, {
        title: title.trim(),
        caption: caption.trim() || null,
        artType,
        mediaType: artType.toLowerCase().includes("video") ? "video" : "image",
        primaryMediaUrl: mediaUrls[0] ?? null,
        mediaUrls,
        externalLinkUrl: externalLinkUrl.trim() || null,
        status: [status, ...card.statusBadges.slice(1)],
        tags: splitValues(tags),
        hashtags: splitValues(hashtags).map((item) => item.startsWith("#") ? item : `#${item}`),
        isBriefApproval: card.isBriefApproval ?? false,
        keepFiles,
        scheduledAt: scheduledAt || null,
        scheduledTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clientLabel: clientLabel.trim() || "Pendente",
      });
      await moveAdminCardBySlug(slug, card.id, columnId || null);
      setFeedback("Alteracoes salvas no card.");
      onRefresh();
      onClose();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel salvar as alteracoes.");
    } finally {
      setSaving(false);
    }
  }

  async function sendComment() {
    if (!commentDraft.trim()) return;
    try {
      await onAddComment(card.id, commentDraft.trim());
      setCommentDraft("");
      setFeedback("Comentario enviado.");
      onRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel enviar o comentario.");
    }
  }

  async function createApprovalLink() {
    try {
      const result = await createAdminApprovalLinkBySlug(slug, card.id);
      const origin = window.location.origin;
      setApprovalLink(`${origin}/#/approval/${result.approvalLink.token}`);
      setFeedback("Link de aprovacao criado por 7 dias.");
      onRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel criar o link.");
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
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel criar a etiqueta.");
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
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel criar o grupo.");
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
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel excluir o grupo.");
    }
  }

  return (
    <div className="admin-card-backdrop" onClick={onClose}>
      <section className="admin-card-editor" onClick={(event) => event.stopPropagation()}>
        <button className="admin-card-close" onClick={onClose} aria-label="Fechar card">×</button>
        <div className="admin-card-main">
          <EditorField label="Titulo">
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </EditorField>
          <div className="editor-main-grid">
            <div>
              <EditorField label="Legenda" action={<button className="caption-copy-button" type="button" title="Copiar legenda" aria-label="Copiar legenda" onClick={() => navigator.clipboard.writeText(caption)}><UiIcon name="copy" /></button>}>
                <textarea className="admin-caption-editor" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Escreva a legenda do post" />
              </EditorField>
              <EditorField label="Midia">
                <div className="editor-media-grid">
                  {mediaUrls.map((url, index) => (
                    <article className="editor-media-thumb" key={url}>
                      {url.match(/\.(mp4|webm|mov)(\?|$)/i) ? <video src={url} /> : <img src={url} alt={`Midia ${index + 1}`} />}
                      {index === 0 ? <span>Capa</span> : null}
                      <button onClick={() => setMediaUrls((items) => items.filter((item) => item !== url))}>×</button>
                    </article>
                  ))}
                  <label className="editor-add-media">
                    <input multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => handleUpload(event.target.files)} />
                    {uploading ? "Enviando..." : "+ Adicionar arquivos"}
                  </label>
                </div>
              </EditorField>
              <EditorField label="Ou usar link externo">
                <input type="url" value={externalLinkUrl} onChange={(event) => setExternalLinkUrl(event.target.value)} placeholder="https://drive.google.com/..." />
              </EditorField>
            </div>
            <section className="editor-comments">
            <h4>Comentarios ({detail.comments.length})</h4>
            {detail.comments.map((comment) => (
              <article className="editor-comment" key={comment.id}>
                <div className="editor-comment-author"><CommentAvatar name={comment.authorName} url={comment.authorAvatarUrl} /><strong>{comment.authorName} <small>{comment.authorRole}</small></strong></div>
                <time>{new Date(comment.createdAt).toLocaleString("pt-BR")}</time>
                <p>{comment.commentText}</p>
              </article>
            ))}
            <div className="editor-comment-compose">
              <div className="comment-toolbar"><b>B</b><i>I</i><u>U</u><span>H2</span><span>Lista</span></div>
              <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Escrever um comentario" />
              <button className="gradient-button" onClick={sendComment} disabled={!commentDraft.trim()}>Enviar</button>
            </div>
            </section>
          </div>
        </div>
        <aside className="admin-card-side">
          <ArtTypeSelect value={artType} onChange={setArtType} />
          <EditorSelect label="Status" value={status} onChange={setStatus} options={CARD_STATUS_OPTIONS} />
          <EditorSelect label="Feedback do cliente" value={clientLabel} onChange={setClientLabel} options={["Pendente", "Aprovado", "Alteracao solicitada"]} />
          <EditorField label="Agendamento"><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><small className="editor-field-hint">Na data e hora informadas, o card sera movido para Arquivados.</small></EditorField>
          <label className="editor-field"><span>Coluna</span><select value={columnId} onChange={(event) => setColumnId(event.target.value)}><option value="">Sem coluna</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
          <section className="tag-library">
            <div className="tag-library-head"><span>Etiquetas</span></div>
            <div className="tag-selected-row">
              {splitValues(tags).map((name) => {
                const definition = tagLibrary.find((tag) => tag.name === name);
                return <button key={name} type="button" className="tag-selected-pill" style={{ backgroundColor: definition?.color ?? "#8263e8" }} onClick={() => setTags((current) => splitValues(current).filter((item) => item !== name).join(", "))}>{name}<span className="editor-tag-remove">×</span></button>;
              })}
              <button type="button" className="tag-picker-trigger" onClick={() => setTagPickerOpen((open) => !open)}>◇ Tags</button>
            </div>
            {tagPickerOpen ? <div className="tag-picker-popover">
              <div className="tag-picker-search"><span>⌕</span><input autoFocus value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Buscar etiqueta..." /></div>
              <div className="tag-picker-list">
                {tagLibrary.filter((tag) => tag.name.toLocaleLowerCase("pt-BR").includes(tagSearch.toLocaleLowerCase("pt-BR"))).map((tag) => {
                  const selected = splitValues(tags).includes(tag.name);
                  return <button key={tag.id} type="button" className={selected ? "tag-picker-item selected" : "tag-picker-item"} onClick={() => setTags((current) => selected ? splitValues(current).filter((item) => item !== tag.name).join(", ") : [...splitValues(current), tag.name].join(", "))}><i style={{ backgroundColor: tag.color }} />{tag.name}<span>{selected ? "Selecionada" : ""}</span></button>;
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
          <button className="side-action" onClick={createApprovalLink}>⌁ Enviar link para cliente</button>
          {approvalLink ? <div className="approval-url"><input readOnly value={approvalLink} /><button onClick={() => navigator.clipboard.writeText(approvalLink)}>Copiar</button></div> : null}
          <button className="side-action">♙ Aprovacao interna</button>
          <label className="editor-check-card keep-files"><input type="checkbox" checked={keepFiles} onChange={(event) => setKeepFiles(event.target.checked)} /><span><strong>Manter arquivos</strong><small>Impede remocao automatica dos arquivos.</small></span></label>
          {feedback ? <p className="editor-feedback">{feedback}</p> : null}
          <button className="gradient-button editor-save" onClick={saveCard} disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar alteracoes"}</button>
        </aside>
      </section>
    </div>
  );
}

function EditorField({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return <label className="editor-field"><span>{label}{action ? <em>{action}</em> : null}</span>{children}</label>;
}

function EditorSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="editor-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
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

function labelForWidget(key: string) {
  switch (key) {
    case "upcomingPosts":
      return "Proximos posts";
    case "tracking":
      return "Acompanhamento";
    case "invoices":
      return "Faturas";
    case "reports":
      return "Relatorios";
    case "brandBrain":
      return "Brand Brain";
    case "search":
      return "Busca";
    default:
      return key;
  }
}

function LoginPage({
  session,
  onLogin,
}: {
  session: SessionUser | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState(demoUsers[0]?.email ?? "");
  const [password, setPassword] = useState(demoUsers[0]?.password ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to={getDefaultRoute(session)} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const ok = await onLogin(email.trim(), password);
    setSubmitting(false);
    if (!ok) {
      setError("Nao consegui autenticar na API real nem no fallback local.");
      return;
    }
    setError("");
  }

  return (
    <main className="center-shell">
      <section className="login-grid">
        <article className="glass login-panel">
          <div className="login-brand-mark" aria-label="Design Hub V2">
            <img src={designHubV2Logo} alt="Logo Design Hub V2" />
          </div>
          <p className="eyebrow">Acesso local da V2</p>
          <h2>Entrar no Design Hub V2</h2>
          <p className="hero-copy">
            Aqui o login continua totalmente controlado por voce, sem social login e sem cadastro aberto.
          </p>

          <form className="login-form" onSubmit={submit}>
            <label className="field-stack">
              <span>E-mail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-stack">
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="gradient-button" type="submit" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
            </button>
            {error ? <p className="form-feedback error-text">{error}</p> : null}
          </form>
        </article>

        <aside className="glass login-panel">
          <p className="eyebrow">Perfis demo</p>
          <h3>Escolha um perfil para testar</h3>
          <div className="demo-user-list">
            {demoUsers.map((user) => (
              <button
                key={user.id}
                className="demo-user-card"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(user.password);
                  setError("");
                }}
              >
                <div>
                  <strong>{user.name}</strong>
                  <p>{roleLabel(user.role)}</p>
                </div>
                <span>{user.email}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

const INTERNAL_AREAS: Record<string, { title: string; description: string; restricted?: boolean }> = {
  relatorios: { title: "Relatórios", description: "Acompanhe os indicadores e resultados dos seus projetos." },
  faturamento: { title: "Faturamento", description: "Organize os lançamentos e cobranças da operação.", restricted: true },
  propostas: { title: "Propostas", description: "Centralize propostas comerciais em andamento.", restricted: true },
  contratos: { title: "Contratos", description: "Guarde e acompanhe os contratos da operação.", restricted: true },
  "datas-comemorativas": { title: "Datas comemorativas", description: "Planeje campanhas e oportunidades importantes." },
  "briefs-design": { title: "Briefs de design", description: "Organize as referências e direcionamentos criativos." },
  "calendario-social": { title: "Calendário social", description: "Visualize o planejamento de conteúdo nas redes sociais." },
  equipe: { title: "Equipe", description: "Acompanhe as pessoas e responsabilidades do seu time." },
};

function ClientKanbanCalendar({ slug }: { slug: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [posts, setPosts] = useState<CalendarEvent[]>([]);
  const [manualEvents, setManualEvents] = useState<AgendaEvent[]>([]);
  const [clientAccountId, setClientAccountId] = useState("");
  const [eventDay, setEventDay] = useState<Date | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventColor, setEventColor] = useState("#7c6cf2");
  const [savingEvent, setSavingEvent] = useState(false);
  const range = agendaViewRange(month, "month");
  const refresh = () => { const from = range.from.slice(0, 10); const to = range.to.slice(0, 10); return Promise.all([loadAdminClientCalendarBySlug(slug, from, to), loadAgendaEvents(from, to)]).then(([calendar, agenda]) => { setClientAccountId(calendar.clientAccountId); setPosts(calendar.events); setManualEvents(agenda.items.filter((item) => item.clientAccountId === calendar.clientAccountId)); }).catch(() => { setPosts([]); setManualEvents([]); }); };
  useEffect(() => { void refresh(); }, [slug, range.from, range.to]);
  const eventsByDay = new Map<string, Array<{ id: string; title: string; type: "post" | "manual"; color?: string }>>();
  posts.forEach((post) => { const key = post.publishDate.slice(0, 10); eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), { id: post.id, title: post.title, type: "post", color: post.color }]); });
  const uniqueManualEvents = manualEvents.filter((event, index, items) => items.findIndex((item) => item.title === event.title && localDateKey(new Date(item.startsAt)) === localDateKey(new Date(event.startsAt))) === index);
  uniqueManualEvents.forEach((event) => { const key = localDateKey(new Date(event.startsAt)); eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), { id: event.id, title: event.title, type: "manual", color: event.color }]); });
  const columnLegend = Array.from(new Map(posts.filter((post) => post.columnName).map((post) => [post.columnName as string, post.color ?? "#8278ef"])).entries());
  const saveManualEvent = async () => { if (savingEvent || !eventDay || !eventTitle.trim() || !clientAccountId) return; setSavingEvent(true); try { await createAgendaEvent({ title: eventTitle.trim(), startsAt: `${localDateKey(eventDay)}T09:00`, color: eventColor, clientAccountId }); setEventDay(null); setEventTitle(""); await refresh(); } finally { setSavingEvent(false); } };
  return <section className="client-kanban-calendar"><header><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>‹</button><h2>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month)}</h2><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>›</button></header>{columnLegend.length ? <div className="client-calendar-column-legend">{columnLegend.map(([name, color]) => <span key={name}><i style={{ backgroundColor: color }} />{name}</span>)}</div> : null}<div className="client-calendar-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div><div className="client-calendar-grid">{range.days.map((day) => { const key = localDateKey(day); const events = eventsByDay.get(key) ?? []; return <button key={key} className={day.getMonth() === month.getMonth() ? "client-calendar-day" : "client-calendar-day muted"} onClick={() => setEventDay(day)}><strong>{day.getDate()}</strong>{events.map((event) => <span key={event.id} className={event.type} style={{ backgroundColor: event.color, color: calendarTextColor(event.color) }}>{event.title}</span>)}</button>; })}</div><p><i /> Post agendado <i className="manual" /> Evento manual. Clique em um dia para adicionar um evento deste cliente.</p>{eventDay ? <div className="modal-backdrop" onClick={() => setEventDay(null)}><section className="client-calendar-event-modal" onClick={(event) => event.stopPropagation()}><h3>Novo evento</h3><p>{eventDay.toLocaleDateString("pt-BR", { dateStyle: "full" })}</p><input autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Nome do evento" /><label>Cor <input type="color" value={eventColor} onChange={(event) => setEventColor(event.target.value)} /></label><button className="gradient-button" disabled={savingEvent} onClick={() => void saveManualEvent()}>{savingEvent ? "Adicionando..." : "Adicionar evento"}</button></section></div> : null}</section>;
}

function calendarTextColor(color?: string) { const value = color?.replace("#", ""); if (!value || value.length !== 6) return "#17213d"; const [red, green, blue] = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((part) => Number.parseInt(part, 16)); return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? "#17213d" : "#ffffff"; }

function KanbanActivities({ slug }: { slug: string }) {
  const [items, setItems] = useState<KanbanActivity[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { loadAdminKanbanActivitiesBySlug(slug).then((result) => setItems(result.items)).catch(() => setError("Não foi possível carregar as atividades.")); }, [slug]);
  return <section className="kanban-activities"><header><div><h2>Atividades</h2><p>Histórico deste Kanban, mantido por 15 dias.</p></div><span>{items.length}</span></header>{error ? <p className="form-feedback error-text">{error}</p> : null}{items.length ? <div>{items.map((item) => <article key={item.id}><i className={item.type}>{item.type === "approval" ? "✓" : "•"}</i><div><strong>{item.detail}</strong><p>{item.title}</p></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.occurredAt))}</time></article>)}</div> : <p className="kanban-activities-empty">Ainda não há atividades nos últimos 15 dias.</p>}</section>;
}

const EMPTY_BRAND_BRAIN: BrandBrain = { mission: "", vision: "", voice: "", visualNotes: "", approvedWords: [], avoidWords: [], expressions: [], colors: ["#5b5ce2", "#18b98b", "#f5a41a"], pillars: [] };
function PautasWorkspace({ slug, clientName, columns, onSent }: { slug: string; clientName: string; columns: BoardColumn[]; onSent: () => void }) {
  const [ideas, setIdeas] = useState<PautaIdea[]>([]); const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"all" | "draft" | "sent">("all"); const [sending, setSending] = useState<string | null>(null);
  const [editing, setEditing] = useState<PautaIdea | null>(null); const [brainOpen, setBrainOpen] = useState(false); const [brain, setBrain] = useState<BrandBrain>(EMPTY_BRAND_BRAIN);
  const save = (next: PautaIdea[]) => { setIdeas(next); void saveAdminWorkspaceDrawerBySlug(slug, { ...EMPTY_DRAWER, pautaIdeas: next }); };
  useEffect(() => { loadAdminWorkspaceDrawerBySlug(slug).then((result) => { const data = result.data as Partial<WorkspaceDrawerData> | null; setIdeas(data?.pautaIdeas ?? []); }).catch(() => setIdeas([])); }, [slug]);
  useEffect(() => { loadBrandBrainBySlug(slug).then((result) => setBrain({ ...EMPTY_BRAND_BRAIN, ...(result.data ?? {}) })).catch(() => setBrain(EMPTY_BRAND_BRAIN)); }, [slug]);
  const visible = ideas.filter((idea) => (filter === "all" || (idea.status ?? "draft") === filter) && idea.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const send = async (idea: PautaIdea) => { const columnId = columns.find((column) => column.name.toLocaleLowerCase() === "pauta")?.id ?? columns[0]?.id ?? null; setSending(idea.id); try { await createAdminCardBySlug(slug, { columnId, title: idea.title, caption: idea.caption || idea.description || null, primaryMediaUrl: null, externalLinkUrl: null, artType: "Post", status: ["Entrada"], tags: [], clientLabel: "Pendente", isBriefApproval: true }); save(ideas.map((item) => item.id === idea.id ? { ...item, status: "sent" } : item)); onSent(); } finally { setSending(null); } };
  const saveEdit = () => { if (!editing?.title.trim()) return; save(ideas.map((idea) => idea.id === editing.id ? editing : idea)); setEditing(null); };
  const deleteIdea = (id: string) => { if (window.confirm("Excluir esta pauta?")) save(ideas.filter((idea) => idea.id !== id)); };
  const text = `${editing?.title ?? ""} ${editing?.description ?? ""} ${editing?.caption ?? ""}`.toLocaleLowerCase(); const avoidHits = brain.avoidWords.filter((word) => text.includes(word.toLocaleLowerCase()));
  return <section className="pautas-workspace"><header><span>Banco interno</span><h2>Pautas de {clientName}</h2><p>Organize, revise e envie ideias para o quadro do cliente.</p></header><div className="pautas-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pauta" /><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todas</option><option value="draft">Rascunhos</option><option value="sent">Enviadas</option></select></div><div className="pautas-table"><div className="pautas-row pautas-head"><span>Cliente</span><span>Título</span><span>Tipo</span><span>Data</span><span>Status</span><span>Ações</span></div>{visible.map((idea) => <div className="pautas-row" key={idea.id}><span>{clientName}</span><strong>{idea.title}</strong><span>Post</span><span>{new Date(idea.createdAt).toLocaleDateString("pt-BR")}</span><span className={(idea.status ?? "draft") === "sent" ? "pauta-status sent" : "pauta-status"}>{(idea.status ?? "draft") === "sent" ? "Enviada" : "Rascunho"}</span><span className="pauta-actions"><button onClick={() => { setEditing({ ...idea }); setBrainOpen(false); }}>✎</button><button className="delete" onClick={() => deleteIdea(idea.id)}>⌫</button>{(idea.status ?? "draft") === "draft" ? <button disabled={sending === idea.id} onClick={() => void send(idea)}>{sending === idea.id ? "..." : "Enviar"}</button> : "✓"}</span></div>)}{visible.length === 0 ? <p className="pautas-empty">Nenhuma pauta encontrada. Use a lâmpada na lateral para criar uma.</p> : null}</div>{editing ? <div className="pauta-modal-backdrop" onMouseDown={() => setEditing(null)}><section className="pauta-modal" onMouseDown={(event) => event.stopPropagation()}><header><h3>Editar pauta</h3><button onClick={() => setEditing(null)}>×</button></header><label>Título<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label>Descrição<textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label><label>Legenda sugerida<textarea value={editing.caption} onChange={(event) => setEditing({ ...editing, caption: event.target.value })} /></label><button className="brain-check" onClick={() => setBrainOpen((open) => !open)}>✧ Brand Brain</button>{brainOpen ? <div className="brain-feedback">{avoidHits.length ? <p>Evite: {avoidHits.join(", ")}.</p> : <p>Sem termos a evitar encontrados.</p>}{brain.expressions.slice(0, 3).length ? <p>Expressões da marca: {brain.expressions.slice(0, 3).join(" · ")}</p> : null}</div> : null}<footer><button className="drawer-secondary-action" onClick={() => setEditing(null)}>Cancelar</button><button className="gradient-button" onClick={saveEdit}>Salvar alterações</button></footer></section></div> : null}</section>;
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

type ProposalStatus = "draft" | "sent" | "accepted" | "refused";
type LocalProposal = {
  id: string; token: string; clientName: string; email: string; locale: string; proposalType: string; plan: string;
  pieces: number; scope: string; investment: string; currency: string; expiresAt: string; status: ProposalStatus;
  services: Array<{ name: string; value: number; description: string }>;
};

const PROPOSALS_STORAGE_KEY = "designhub-v2-proposals";
const proposalStatuses: Array<{ id: ProposalStatus; label: string; tone: string }> = [
  { id: "accepted", label: "Aceitas", tone: "accepted" },
  { id: "sent", label: "Enviadas", tone: "sent" },
  { id: "refused", label: "Recusadas", tone: "refused" },
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

function readLocalProposals(): LocalProposal[] {
  try { return JSON.parse(window.localStorage.getItem(PROPOSALS_STORAGE_KEY) ?? "[]") as LocalProposal[]; }
  catch { return []; }
}

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
  const [proposals, setProposals] = useState<LocalProposal[]>(readLocalProposals);
  const [selectedId, setSelectedId] = useState<string | null>(proposals[0]?.id ?? null);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const selected = proposals.find((proposal) => proposal.id === selectedId) ?? null;
  const persist = (next: LocalProposal[]) => { setProposals(next); window.localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(next)); };
  const create = () => {
    const id = crypto.randomUUID();
    const proposal: LocalProposal = { id, token: crypto.randomUUID().split("-").join(""), clientName: "", email: "", locale: "Português", proposalType: "Projeto", plan: "", pieces: 0, scope: "", investment: "", currency: "R$", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), status: "draft", services: [{ name: "", value: 0, description: "" }] };
    persist([proposal, ...proposals]); setSelectedId(id); setView("editor");
  };
  useEffect(() => { if (newProposalSignal > 0) create(); }, [newProposalSignal]);
  const update = (patch: Partial<LocalProposal>) => { if (!selected) return; persist(proposals.map((proposal) => proposal.id === selected.id ? { ...proposal, ...patch } : proposal)); };
  const remove = () => { if (!selected) return; persist(proposals.filter((proposal) => proposal.id !== selected.id)); setSelectedId(null); };
  const send = () => { if (!selected) return; update({ status: "sent", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }); setView("preview"); };
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
  return <section className="proposals-workspace">
    <div className={proposals.length ? "proposals-layout" : "proposals-layout empty-library"}>{proposals.length ? <aside className="proposal-library"><div><b>Biblioteca</b><button onClick={create}>+</button></div>{proposalStatuses.map((status) => <section key={status.id}><p>{status.label}<span>{proposals.filter((proposal) => proposal.status === status.id).length}</span></p>{proposals.filter((proposal) => proposal.status === status.id).map((proposal) => <button key={proposal.id} onClick={() => { setSelectedId(proposal.id); setView("editor"); }} className={selectedId === proposal.id ? "active" : ""}><strong>{proposal.clientName || "Nova proposta"}</strong><small>{proposal.proposalType} · {new Date(proposal.expiresAt).toLocaleDateString("pt-BR")}</small></button>)}</section>)}</aside> : null}
    <main className="proposal-stage">{!selected ? <div className="proposal-empty"><span>✦</span><h2>Comece por uma proposta</h2><p>Use o botão “Nova proposta” no banner para montar sua próxima proposta comercial.</p></div> : <><div className="proposal-stage-tabs"><button className="active">Editor</button><button onClick={() => setView("preview")}>Prévia do cliente</button><span>Válida por 7 dias</span></div><div className="proposal-editor"><div className="proposal-fields two"><label>Nome do cliente *<input value={selected.clientName} onChange={(event) => update({ clientName: event.target.value })} placeholder="Ex: Empresa ABC" /></label><label>E-mail<input type="email" value={selected.email} onChange={(event) => update({ email: event.target.value })} placeholder="email@cliente.com" /></label></div><div className="proposal-fields three"><label>Idioma<select value={selected.locale} onChange={(event) => update({ locale: event.target.value })}>{Object.values(proposalLocales).map((locale) => <option key={locale.label}>{locale.label}</option>)}</select></label><label>Tipo de proposta<select value={selected.proposalType} onChange={(event) => update({ proposalType: event.target.value })}><option>Projeto</option><option>Mensalidade</option><option>Consultoria</option></select></label><label>Plano<input value={selected.plan} onChange={(event) => update({ plan: event.target.value })} placeholder="Selecione..." /></label></div><label className="proposal-pieces">Qtd. de peças<input type="number" min="0" value={selected.pieces} onChange={(event) => update({ pieces: Number(event.target.value) })} /></label>{editor("scope", "Escopo do projeto", "Descreva o escopo dos serviços. Use títulos e listas para organizar.")}{editor("investment", "Descrição do investimento", "Condições de pagamento, observações e próximos passos...")}<div className="proposal-services"><header><div><span>Serviços</span><p>Monte os itens que fazem parte desta proposta.</p></div><button onClick={() => update({ services: [...selected.services, { name: "", value: 0, description: "" }] })}>+ Adicionar</button></header>{selected.services.map((service, index) => <div className="proposal-service-edit" key={index}><input value={service.name} onChange={(event) => update({ services: selected.services.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} placeholder="Nome do serviço" /><input type="number" value={service.value} onChange={(event) => update({ services: selected.services.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(event.target.value) } : item) })} placeholder="Valor" /><input value={service.description} onChange={(event) => update({ services: selected.services.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} placeholder="Descrição (opcional)" /><button onClick={() => update({ services: selected.services.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}</div></div></>}</main>
    <aside className="proposal-actions">{selected ? <><span className={`proposal-status ${selected.status}`}>{proposalStatuses.find((status) => status.id === selected.status)?.label.slice(0, -1) ?? "Rascunho"}</span><h3>{selected.clientName || "Nova proposta"}</h3><p>O link temporário e a proposta expiram automaticamente em 7 dias.</p><button onClick={() => setView("preview")}>◫ Ver prévia</button><button onClick={copyLink}>⌁ Copiar link</button><button className="proposal-send" onClick={send}>➜ Enviar proposta</button><button className="proposal-delete" onClick={remove}>Excluir proposta</button></> : null}</aside></div>
  </section>;
}

function PublicProposalPage() {
  const { token = "" } = useParams();
  const proposal = readLocalProposals().find((item) => item.token === token);
  const [decision, setDecision] = useState<"accepted" | "refused" | null>(null);
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".public-proposal-page .proposal-client-content > section, .public-proposal-decision"));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("in-view"); }), { threshold: 0.16 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [token]);
  if (!proposal) return <main className="public-proposal-page"><section><span>DESIGN HUB</span><h1>Esta proposta não está disponível.</h1><p>O link pode ter expirado ou ter sido removido.</p></section></main>;
  const expired = new Date(proposal.expiresAt).getTime() < Date.now();
  if (expired) return <main className="public-proposal-page"><section><span>DESIGN HUB</span><h1>Esta proposta expirou.</h1><p>Peça à equipe uma nova versão para continuar.</p></section></main>;
  const copy = getProposalLocale(proposal.locale);
  const decide = (status: "accepted" | "refused") => { setDecision(status); const next = readLocalProposals().map((item) => item.id === proposal.id ? { ...item, status } : item); window.localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(next)); };
  return <main className="public-proposal-page"><div className="public-proposal-orb one" /><div className="public-proposal-orb two" /><header className="public-proposal-brand"><img src={liegePaschoaliniLogo} alt="Liege Paschoalini Studio" /><div><b>LIEGE PASCHOALINI STUDIO</b></div></header><ProposalClientPreview proposal={proposal} /><section className="public-proposal-decision">{decision ? <><span className={decision}>✓</span><h2>{decision === "accepted" ? copy.accepted : copy.refused}</h2><p>{copy.answer}</p></> : <><p>{copy.until} {new Date(proposal.expiresAt).toLocaleDateString(copy.code)}.</p><h2>{copy.continueTogether}</h2><div><button className="gradient-button" onClick={() => decide("accepted")}>{copy.accept}</button><button className="public-proposal-refuse" onClick={() => decide("refused")}>{copy.refuse}</button></div></>}</section></main>;
}

function InternalAreaPage({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  const { area = "" } = useParams();
  const [reportCreationVersion, setReportCreationVersion] = useState(0);
  const [invoiceCreationVersion, setInvoiceCreationVersion] = useState(0);
  const [proposalCreationVersion, setProposalCreationVersion] = useState(0);
  const [memberCreationVersion, setMemberCreationVersion] = useState(0);
  const page = INTERNAL_AREAS[area];
  if (!session || session.role === "client") return <Navigate to={getDefaultRoute(session)} replace />;
  if (!page || (page.restricted && session.role === "collaborator")) return <Navigate to="/dashboard" replace />;
  const metrics = area === "equipe" ? [{ label: "Papéis", value: "4", note: "Níveis de acesso", icon: <UiIcon name="users" />, tone: "clients" }, { label: "Clientes", value: "—", note: "Atribuições ativas", icon: <UiIcon name="link" />, tone: "posts" }] : area === "relatorios" ? [{ label: "Relatórios", value: "—", note: "Períodos disponíveis", icon: <UiIcon name="file" />, tone: "posts" }, { label: "Indicadores", value: "—", note: "Acompanhe resultados", icon: <UiIcon name="check" />, tone: "approved" }] : area === "faturamento" ? [{ label: "Faturas", value: "—", note: "Lançamentos da operação", icon: <UiIcon name="receipt" />, tone: "pending" }, { label: "Organização", value: "✓", note: "Cobranças centralizadas", icon: <UiIcon name="check" />, tone: "approved" }] : [{ label: "Em andamento", value: "—", note: "Dados desta área", icon: <UiIcon name="clock" />, tone: "pending" }, { label: "Organização", value: "✓", note: "Operação centralizada", icon: <UiIcon name="check" />, tone: "approved" }];
  const content = area === "relatorios" ? <ReportsWorkspace newReportSignal={reportCreationVersion} /> : area === "faturamento" ? <BillingWorkspace session={session} newInvoiceSignal={invoiceCreationVersion} /> : area === "propostas" ? <ProposalsWorkspace newProposalSignal={proposalCreationVersion} /> : area === "equipe" ? <TeamManagementWorkspace session={session} newMemberSignal={memberCreationVersion} /> : area === "datas-comemorativas" ? <CommemorativeDatesWorkspace /> : area === "calendario-social" ? <SocialCalendarWorkspace /> : <section className="internal-area-card glass"><div className="internal-area-empty"><UiIcon name="spark" /><strong>Esta página é privada para o seu nível de acesso.</strong><span>O conteúdo desta área será organizado aqui.</span></div></section>;
  const action = area === "relatorios" ? <button className="gradient-button page-context-action" onClick={() => setReportCreationVersion((current) => current + 1)}>+ Novo relatório</button> : area === "faturamento" ? <button className="gradient-button page-context-action" onClick={() => setInvoiceCreationVersion((current) => current + 1)}>+ Nova fatura</button> : area === "propostas" ? <button className="gradient-button page-context-action" onClick={() => setProposalCreationVersion((current) => current + 1)}>+ Nova proposta</button> : area === "equipe" && session.role === "super_admin" ? <button className="gradient-button page-context-action" onClick={() => setMemberCreationVersion((current) => current + 1)}>+ Novo membro</button> : null;
  const titleIcon = area === "equipe" ? <UiIcon name="users" /> : area === "relatorios" || area === "briefs-design" ? <UiIcon name="file" /> : area === "faturamento" ? <UiIcon name="receipt" /> : area === "propostas" ? <UiIcon name="send" /> : area === "contratos" ? <UiIcon name="check" /> : area === "calendario-social" ? <UiIcon name="calendar" /> : area === "datas-comemorativas" ? <UiIcon name="spark" /> : undefined;
  return <div className="page-grid admin-layout internal-area-layout"><AdminRail session={session} /><main className="main-column"><WorkspaceNavbar session={session} onLogout={onLogout} /><PageContextBanner eyebrow="Área da operação" title={page.title} description={page.description} metrics={metrics} action={action} titleClassName={["relatorios", "faturamento", "propostas", "equipe", "calendario-social", "briefs-design", "datas-comemorativas", "contratos"].includes(area) ? "billing-banner-title" : undefined} titleIcon={titleIcon} />{content}</main></div>;
}

function SocialCalendarWorkspace() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const range = agendaViewRange(month, "month");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadCalendarOverview(range.from.slice(0, 10), range.to.slice(0, 10))
      .then((result) => { if (active) setEvents(result.events); })
      .catch((caught) => { if (active) { setEvents([]); setError(caught instanceof Error ? caught.message : "Não foi possível carregar o calendário social."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to]);

  const clients = Array.from(new Map(events.filter((event) => event.clientSlug).map((event) => [event.clientSlug, event.clientName ?? event.clientSlug ?? "Cliente"])).entries());
  const visibleEvents = events.filter((event) => selectedClient === "all" || event.clientSlug === selectedClient);
  const eventsByDay = new Map<string, CalendarEvent[]>();
  visibleEvents.forEach((event) => { const key = event.publishDate.slice(0, 10); eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]); });

  return <section className="social-calendar-workspace glass">
    <header className="social-calendar-toolbar"><div className="social-calendar-month-nav"><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} aria-label="Mês anterior">‹</button><h2>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month)}</h2><button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} aria-label="Próximo mês">›</button></div><div className="social-calendar-filters"><label>Cliente<select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}><option value="all">Todos os clientes</option>{clients.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label><button className="ghost-button" onClick={() => setMonth(new Date())}>Hoje</button></div></header>
    <div className="social-calendar-summary"><span><i className="scheduled" /> Post agendado</span><span><i className="pending" /> Em planejamento</span><strong>{loading ? "Carregando..." : `${visibleEvents.length} ${visibleEvents.length === 1 ? "post no período" : "posts no período"}`}</strong></div>
    {error ? <p className="form-feedback error-text">{error}</p> : null}
    <div className="social-calendar-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="social-calendar-grid">{range.days.map((day) => { const key = localDateKey(day); const dayEvents = eventsByDay.get(key) ?? []; const inMonth = day.getMonth() === month.getMonth(); return <article key={key} className={inMonth ? "social-calendar-day" : "social-calendar-day muted"}><time>{day.getDate()}</time>{dayEvents.slice(0, 4).map((event) => <div key={event.id} className="social-calendar-event" style={{ "--calendar-event-color": event.color ?? "#6861e8" } as CSSProperties}><span>{event.title}</span><small>{event.clientName ?? "Cliente"}</small></div>)}{dayEvents.length > 4 ? <b className="social-calendar-more">+{dayEvents.length - 4} mais</b> : null}</article>; })}</div>
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
  const [members, setMembers] = useState<ManagedUser[]>(() => demoUsers.map((user) => ({
    id: user.id, fullName: user.name, email: user.email, globalRole: user.role === "collaborator" ? "colaborador" : user.role === "client" ? "cliente" : user.role,
    locale: user.locale, isActive: true, createdAt: "2026-08-23",
  })));
  const [clients, setClients] = useState<TeamClient[]>(DEMO_TEAM_CLIENTS);
  const [assignments, setAssignments] = useState<Record<string, string[]>>(() => Object.fromEntries(demoUsers.map((user) => [user.id, [...user.assignedAdminSlugs, ...user.assignedPortalSlugs]])));
  const [filter, setFilter] = useState<"all" | TeamRole>("all");
  const [modal, setModal] = useState<"new" | "role" | "clients" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "colaborador" as TeamRole, clientIds: [] as string[] });

  useEffect(() => {
    let active = true;
    Promise.all([listManagedUsers(), listAdminClients()])
      .then(async ([users, clientResult]) => {
        if (!active) return;
        const nextClients = clientResult.items.map((client) => ({ id: client.id, name: client.name, slug: client.slug }));
        setMembers(users.items);
        setClients(nextClients);
        const accessLists = await Promise.all(nextClients.map((client) => loadClientAccesses(client.id)));
        if (!active) return;
        const nextAssignments: Record<string, string[]> = {};
        accessLists.forEach((result) => result.accesses.forEach((access) => {
          nextAssignments[access.userId] = [...(nextAssignments[access.userId] ?? []), result.client.slug];
        }));
        setAssignments(nextAssignments);
      })
      .catch(() => {
        // The V2 login stays useful while its local API is offline.
      });
    return () => { active = false; };
  }, []);

  const selected = members.find((member) => member.id === selectedId) ?? null;
  const visibleMembers = filter === "all" ? members : members.filter((member) => member.globalRole === filter);
  const canManage = session.role === "super_admin";
  const assignedClients = (memberId: string) => (assignments[memberId] ?? []).map((slug) => clients.find((client) => client.slug === slug)).filter(Boolean) as TeamClient[];

  const openModal = (next: "new" | "role" | "clients", member?: ManagedUser) => {
    setSelectedId(member?.id ?? null);
    setForm(member ? { fullName: member.fullName, email: member.email, password: "", role: member.globalRole, clientIds: assignments[member.id] ?? [] } : { fullName: "", email: "", password: "", role: "colaborador", clientIds: [] });
    setModal(next);
  };

  useEffect(() => { if (newMemberSignal > 0) openModal("new"); }, [newMemberSignal]);

  const toggleClient = (slug: string) => setForm((current) => {
    const selectedIds = current.clientIds.includes(slug) ? current.clientIds.filter((item) => item !== slug) : [...current.clientIds, slug];
    return { ...current, clientIds: current.role === "cliente" ? selectedIds.slice(-1) : selectedIds };
  });

  const save = () => {
    if (modal === "new") {
      if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) return;
      const id = `local-${Date.now()}`;
      setMembers((current) => [{ id, fullName: form.fullName.trim(), email: form.email.trim(), globalRole: form.role, locale: "Português", isActive: true, createdAt: new Date().toISOString() }, ...current]);
      setAssignments((current) => ({ ...current, [id]: form.role === "super_admin" ? [] : form.clientIds }));
    }
    if (modal === "role" && selected) setMembers((current) => current.map((member) => member.id === selected.id ? { ...member, globalRole: form.role } : member));
    if (modal === "clients" && selected) setAssignments((current) => ({ ...current, [selected.id]: form.role === "super_admin" ? [] : form.clientIds }));
    setModal(null);
  };

  const remove = (member: ManagedUser) => {
    if (!window.confirm(`Remover ${member.fullName} da equipe?`)) return;
    setMembers((current) => current.filter((item) => item.id !== member.id));
    setAssignments((current) => { const next = { ...current }; delete next[member.id]; return next; });
  };

  return <section className="team-management">
    <nav className="team-filters" aria-label="Filtrar membros por papel">
      {(["all", "super_admin", "admin", "colaborador", "cliente"] as const).map((role) => {
        const count = role === "all" ? members.length : members.filter((member) => member.globalRole === role).length;
        const label = role === "all" ? "Todos" : TEAM_ROLE_COPY[role].label;
        return <button key={role} className={filter === role ? "active" : ""} onClick={() => setFilter(role)}>{label} <span>{count}</span></button>;
      })}
    </nav>

    <div className="team-member-list">
      {visibleMembers.map((member) => {
        const role = TEAM_ROLE_COPY[member.globalRole];
        const memberClients = assignedClients(member.id);
        return <article key={member.id} className="team-member-card glass">
          <div className="team-member-summary"><div className="team-member-avatar">{member.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div><div className="team-member-name"><h2>{member.fullName}</h2><span className={`team-role-badge ${role.tone}`}>{role.label}</span></div><p>{member.email}</p><div className="team-client-chips">{member.globalRole === "super_admin" ? <span className="team-all-clients">Acesso a todos os clientes</span> : memberClients.length ? memberClients.map((client) => <span key={client.id}>{client.name}</span>) : <span className="team-no-clients">Nenhum cliente atribuído</span>}</div></div></div>
          {canManage && member.id !== session.id ? <div className="team-member-actions"><button onClick={() => openModal("role", member)}><UiIcon name="users" /> Papel</button><button onClick={() => openModal("clients", member)}><UiIcon name="pencil" /> Atribuir clientes</button><button className="danger" onClick={() => remove(member)} aria-label={`Remover ${member.fullName}`}><UiIcon name="trash" /></button></div> : null}
        </article>;
      })}
    </div>

    {modal ? <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="team-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">{modal === "new" ? "Novo acesso" : modal === "role" ? "Nível de acesso" : "Clientes atribuídos"}</p><h2>{modal === "new" ? "Adicionar membro" : selected?.fullName}</h2></div><button onClick={() => setModal(null)} aria-label="Fechar">×</button></header>
      {modal === "new" ? <div className="team-form-fields"><label>Nome completo<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Senha inicial<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div> : null}
      {modal !== "clients" ? <fieldset className="team-role-options"><legend>Papel</legend>{(Object.keys(TEAM_ROLE_COPY) as TeamRole[]).map((role) => <label key={role} className={form.role === role ? "selected" : ""}><input type="radio" checked={form.role === role} onChange={() => setForm((current) => ({ ...current, role, clientIds: role === "super_admin" ? [] : current.clientIds }))} /><span><b>{TEAM_ROLE_COPY[role].label}</b><small>{role === "super_admin" ? "Acesso total à operação" : role === "admin" ? "Gerencia clientes atribuídos" : role === "colaborador" ? "Trabalha nos clientes atribuídos" : "Acessa o próprio portal"}</small></span></label>)}</fieldset> : null}
      {(modal === "clients" || modal === "new") && form.role !== "super_admin" ? <fieldset className="team-client-options"><legend>{form.role === "cliente" ? "Cliente do portal" : "Clientes atribuídos"}</legend>{clients.map((client) => <label key={client.id}><input type={form.role === "cliente" ? "radio" : "checkbox"} checked={form.clientIds.includes(client.slug)} onChange={() => toggleClient(client.slug)} /><span>{client.name}</span></label>)}</fieldset> : null}
      <footer><button className="team-cancel" onClick={() => setModal(null)}>Cancelar</button><button className="gradient-button" onClick={save}>{modal === "new" ? "Criar membro" : "Salvar alterações"}</button></footer>
    </section></div> : null}
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
    loadPublicApproval(token).then(setView).catch((error) => setMessage(error instanceof Error ? error.message : "Link invalido."));
  }, [token]);

  async function decide(approved: boolean) {
    setWorking(true);
    setMessage("");
    try {
      await submitPublicApproval(token, { approved, commentText: comment.trim() || undefined, requesterName: name.trim() || undefined });
      setMessage(approved ? "Post aprovado. Obrigada pelo retorno!" : "Pedido de alteracao enviado para a equipe.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel registrar sua resposta.");
    } finally {
      setWorking(false);
    }
  }

  if (!view) return <main className="public-approval-page"><section className="public-approval-card"><h1>{message || "Abrindo seu post..."}</h1></section></main>;
  const card = mapPublicApprovalCard(view.card);
  return <main className="public-approval-page"><section className="public-approval-card"><p className="eyebrow">{view.account.name}</p><h1>{card.title}</h1>{card.mediaUrl ? <div className={`media-frame ${card.mediaAspect}`}><img src={card.mediaUrl} alt={card.title} /></div> : null}<div className="public-caption">{card.subtitle || "Sem legenda cadastrada."}</div><label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como prefere ser identificado?" /></label><label>Comentario<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Deixe uma observacao, se desejar" /></label><div className="public-approval-actions"><button className="gradient-button" disabled={working} onClick={() => decide(true)}>Aprovar</button><button className="danger-button" disabled={working} onClick={() => decide(false)}>Solicitar alteracao</button></div>{message ? <p className="form-feedback">{message}</p> : null}</section></main>;
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
  const location = useLocation();
  const [session, setSession] = useState<SessionUser | null>(() => readStoredSession());
  const [bootingSession, setBootingSession] = useState(true);
  const showGlobalHeader = bootingSession || location.pathname === "/login";

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
            <p className="eyebrow">Sessao da V2</p>
            <h2>Reconectando seu acesso</h2>
            <p className="hero-copy">
              Estou validando a sessao diretamente na API local para restaurar o perfil correto.
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
        <Route path="/login" element={<LoginPage session={session} onLogin={handleLogin} />} />
        <Route path="/approval/:token" element={<PublicApprovalPage />} />
        <Route path="/proposta/:token" element={<PublicProposalPage />} />
        <Route path="/dashboard" element={<DashboardRoutePage session={session} onLogout={handleLogout} />} />
        <Route path="/admin/:slug" element={<AdminRoutePage session={session} onLogout={handleLogout} />} />
        <Route path="/area/:area" element={<InternalAreaPage session={session} onLogout={handleLogout} />} />
        <Route path="/portal/:slug" element={<ClientPortalRoutePage session={session} onLogout={handleLogout} />} />
        <Route path="/agenda" element={<AgendaPage session={session} onLogout={handleLogout} />} />
      </Routes>
    </div>
  );
}
