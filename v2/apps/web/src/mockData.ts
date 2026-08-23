import type { AdminWorkspacePreview, ClientPortalPreview, SessionUser } from "./types";

const adminColumns = [
  {
    id: "vt-cards",
    name: "VT Cards",
    color: "#24a7e8",
    visibleToClient: false,
    cards: [
      {
        id: "card-1",
        title: "Nao importa qual operadora seu colaborador usa",
        subtitle: "VT Cards",
        mediaUrl:
          "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80",
        mediaAspect: "portrait" as const,
        typeLabel: "Post unico",
        statusBadges: ["Legenda pronta", "Design finalizado", "Legenda aprovada"],
        tags: ["Alteracao solicitada"],
        commentsCount: 1,
        scheduledAt: "2026-08-23 10:00",
        clientLabel: "Pendente",
      },
      {
        id: "card-2",
        title: "Beneficios da VT Card",
        subtitle: "Assinatura digital",
        mediaUrl:
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        mediaAspect: "landscape" as const,
        typeLabel: "Card curto",
        statusBadges: ["Design finalizado"],
        tags: ["Faturado"],
        commentsCount: 0,
        clientLabel: "Pendente",
      },
    ],
  },
  {
    id: "aprovacao",
    name: "Em aprovacao",
    color: "#f7a31a",
    visibleToClient: true,
    cards: [
      {
        id: "card-3",
        title: "Antes de ligar o motor, ja estamos cuidando de voce",
        subtitle: "Seguranca",
        mediaUrl:
          "https://images.unsplash.com/photo-1517142089942-ba376ce32a2e?auto=format&fit=crop&w=900&q=80",
        mediaAspect: "portrait" as const,
        typeLabel: "Reels",
        statusBadges: ["Design pronto", "Aline aprovou"],
        tags: ["Cliente revisando"],
        commentsCount: 2,
        scheduledAt: "2026-08-24 14:00",
        clientLabel: "Aguardando aprovacao",
      },
    ],
  },
  {
    id: "agendados",
    name: "Agendados",
    color: "#12bf83",
    visibleToClient: true,
    cards: [
      {
        id: "card-4",
        title: "Dois destinos. Qual voce escolhe?",
        subtitle: "Santa Sophia",
        mediaUrl:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
        mediaAspect: "portrait" as const,
        typeLabel: "Reels",
        statusBadges: ["Agendado"],
        tags: ["Publicado no planner"],
        commentsCount: 0,
        scheduledAt: "2026-08-25 11:00",
        clientLabel: "Agendado",
      },
    ],
  },
];

export const adminPreview: AdminWorkspacePreview = {
  clientName: "Aplikasi",
  clientSlug: "aplikasi",
  accountSwitcher: ["Aplikasi", "Minas Home ADS", "Podcast Lider de Elite"],
  tagDefinitions: [],
  columns: adminColumns,
  withoutColumn: [
    {
      id: "card-5",
      title: "Nova pauta para setembro",
      subtitle: "Ainda sem coluna",
      mediaUrl:
        "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80",
      mediaAspect: "square",
      typeLabel: "Ideia",
      statusBadges: ["Rascunho"],
      tags: ["Sem coluna"],
      commentsCount: 0,
      clientLabel: "Novo",
    },
  ],
  calendarEvents: [
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
  ],
  drawerNotes: [
    "Cliente prefere aprovar pelo celular.",
    "Equipe de anuncios so acessa a conta ADS.",
    "Links temporarios ficam ativos por 7 dias.",
  ],
  quickLinks: [
    { label: "Instagram", href: "#" },
    { label: "Business Suite", href: "#" },
    { label: "Google Drive", href: "#" },
    { label: "ChatGPT", href: "#" },
  ],
  quickApps: ["Recados", "Rascunhos", "Links", "Rapidos"],
  trackingItems: [
    { id: "t1", title: "EP. 237 - Capas YT + Spotify", done: true, badges: ["Design pronto", "Aline aprovou"] },
    { id: "t2", title: "EP. 237 - Reels episodio 2", done: false, badges: ["Shorts prontos", "Alterado"] },
    { id: "t3", title: "EP. 237 - Artigo LinkedIn", done: false, badges: ["Artigo pronto"] },
  ],
};

export const clientPreview: ClientPortalPreview = {
  accountName: "Serena Genovese",
  locale: "Italiano",
  widgets: {
    upcomingPosts: true,
    tracking: true,
    invoices: true,
    reports: true,
    brandBrain: true,
    search: true,
  },
  boardColumns: adminColumns
    .filter((column) => column.visibleToClient)
    .map((column) => ({
      ...column,
      cards: column.cards,
    })),
  withoutColumn: [],
  calendarEvents: [
    {
      id: "portal-calendar-1",
      title: "Destinos incriveis para 2027",
      publishDate: "2026-08-23",
      publishTime: "10:00:00",
      status: "scheduled",
    },
    {
      id: "portal-calendar-2",
      title: "Feedback do cliente para novo post",
      publishDate: "2026-08-24",
      publishTime: "14:00:00",
      status: "scheduled",
    },
  ],
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
};

export const demoUsers: SessionUser[] = [
  {
    id: "user-liege",
    name: "Liege Paschoalini",
    email: "liege@designhub.local",
    password: "DesignHub2026!",
    role: "super_admin",
    assignedAdminSlugs: ["aplikasi", "minas-home-ads", "podcast-lider-de-elite"],
    assignedPortalSlugs: ["serena-genovese"],
    locale: "Portuguese",
  },
  {
    id: "user-aline",
    name: "Aline Gestora",
    email: "aline@designhub.local",
    password: "ClienteAline26!",
    role: "admin",
    assignedAdminSlugs: ["aplikasi", "podcast-lider-de-elite"],
    assignedPortalSlugs: ["serena-genovese"],
    locale: "Portuguese",
  },
  {
    id: "user-carlos",
    name: "Carlos Colaborador",
    email: "carlos@designhub.local",
    password: "ColabCarlos26!",
    role: "collaborator",
    assignedAdminSlugs: ["aplikasi"],
    assignedPortalSlugs: [],
    locale: "Portuguese",
  },
  {
    id: "user-serena",
    name: "Serena Genovese",
    email: "serena@designhub.local",
    password: "SerenaCliente26!",
    role: "client",
    assignedAdminSlugs: [],
    assignedPortalSlugs: ["serena-genovese"],
    locale: "Italiano",
  },
];
