export type BoardCard = {
  id: string;
  title: string;
  subtitle?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  externalLinkUrl?: string;
  mediaAspect: "portrait" | "square" | "landscape" | "wide";
  typeLabel: string;
  statusBadges: string[];
  tags: string[];
  tagColors?: Record<string, string>;
  commentsCount: number;
  scheduledAt?: string;
  archivedAt?: string | null;
  clientLabel: string;
  hashtags?: string[];
  isBriefApproval?: boolean;
  keepFiles?: boolean;
  deadlineAt?: string | null;
};

export type UserRole = "super_admin" | "admin" | "collaborator" | "client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  assignedAdminSlugs: string[];
  assignedPortalSlugs: string[];
  locale: string;
  avatarUrl?: string | null;
  source?: "demo" | "api";
  accessToken?: string | null;
};

export type CardComment = {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string | null;
  commentText: string;
  isInternal: boolean;
  createdAt: string;
};

export type ApprovalLink = {
  id: string;
  token: string;
  expiresAt: string;
  isActive: boolean;
  viewedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

export type CardDetail = {
  card: BoardCard;
  comments: CardComment[];
  approvalLinks: ApprovalLink[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  publishDate: string;
  publishTime?: string | null;
  status: string;
  color?: string;
  columnName?: string;
  clientName?: string;
  clientSlug?: string;
};

export type BoardColumn = {
  id: string;
  name: string;
  color: string;
  visibleToClient: boolean;
  cards: BoardCard[];
};

export type ClientWidgetFlags = {
  upcomingPosts: boolean;
  tracking: boolean;
  invoices: boolean;
  reports: boolean;
  brandBrain: boolean;
  search: boolean;
};

export type ClientPortalPreview = {
  accountName: string;
  clientGreetingName?: string;
  clientLogoUrl?: string | null;
  locale: string;
  widgets: ClientWidgetFlags;
  boardColumns: BoardColumn[];
  withoutColumn: BoardCard[];
  calendarEvents: CalendarEvent[];
  upcomingItems: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    channel: string;
  }>;
};

export type AdminWorkspacePreview = {
  clientName: string;
  clientSlug: string;
  accountSwitcher: string[];
  columns: BoardColumn[];
  withoutColumn: BoardCard[];
  calendarEvents: CalendarEvent[];
  drawerNotes: string[];
  quickLinks: Array<{ label: string; href: string }>;
  quickApps: string[];
  trackingItems: Array<{
    id: string;
    title: string;
    done: boolean;
    badges: string[];
  }>;
  tagDefinitions: Array<{ id: string; name: string; color: string }>;
};
