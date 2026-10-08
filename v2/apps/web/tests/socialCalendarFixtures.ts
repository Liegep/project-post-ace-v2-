import type { AgendaEvent, GlobalMetaScheduledPublication } from "../src/api";
import type { CalendarEvent } from "../src/types";
export const socialPost = (
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id: "internal-1",
  cardId: "card-1",
  clientAccountId: "client-a",
  clientSlug: "aurora",
  clientName: "Aurora",
  title:
    "Campanha com título longo que precisa continuar legível no calendário",
  publishDate: "2026-10-04",
  publishTime: "09:00:00",
  scheduledAt: "2026-10-04T12:00:00Z",
  scheduledTimeZone: "America/Sao_Paulo",
  status: "published",
  ...overrides,
});
export const socialPublication = (
  overrides: Partial<GlobalMetaScheduledPublication> = {},
): GlobalMetaScheduledPublication => ({
  id: "meta-1",
  cardId: "card-1",
  cardTitle: "Campanha Aurora",
  clientAccountId: "client-a",
  clientSlug: "aurora",
  clientName: "Aurora",
  destinationId: "destination-a",
  destinationName: "Aurora principal",
  platform: "instagram",
  scheduledAt: "2026-10-04T12:00:00Z",
  timezone: "America/Sao_Paulo",
  caption: "Legenda",
  mediaUrl: null,
  mediaUrls: [],
  mediaType: "image",
  reelCoverUrl: null,
  locationId: null,
  locationName: null,
  instagramUserTags: [],
  status: "published",
  attemptCount: 1,
  publishedMetaId: "remote-id",
  publishedPermalink: null,
  lastError: null,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-04T12:00:00Z",
  publishedAt: "2026-10-04T12:00:00Z",
  ...overrides,
});
export const socialAppointment = (
  overrides: Partial<AgendaEvent> = {},
): AgendaEvent => ({
  id: "appointment-1",
  title: "Reunião editorial",
  startsAt: "2026-10-04T11:00:00Z",
  timeZone: "Europe/Stockholm",
  recurrenceType: "none",
  color: "#c9f7df",
  isCompleted: false,
  clientAccountId: "client-a",
  clientName: "Aurora",
  ...overrides,
});
export function socialFixture(failure = "") {
  const calls: Array<{
    path: string;
    query: string;
    method: string;
    body: any;
  }> = [];
  const posts = [
    socialPost(),
    socialPost({
      id: "internal-2",
      cardId: "card-2",
      title: "Segundo post interno",
      status: "approved",
      scheduledAt: "2026-10-04T14:00:00Z",
    }),
    socialPost({
      id: "internal-3",
      cardId: "card-3",
      title: "Terceiro post interno",
      status: "scheduled",
      scheduledAt: "2026-10-04T16:00:00Z",
    }),
    socialPost({
      id: "internal-4",
      cardId: "card-4",
      title: "Post do outro cliente",
      clientAccountId: "client-b",
      clientName: "Lume",
      clientSlug: "lume",
      scheduledAt: "2026-10-04T18:00:00Z",
    }),
    socialPost({
      id: "border",
      cardId: "border",
      title: "Post do mês seguinte",
      scheduledAt: "2026-11-01T12:00:00Z",
      publishDate: "2026-11-01",
    }),
  ];
  const appointments = [
    socialAppointment(),
    socialAppointment({
      id: "appointment-2",
      title: "Revisão da tarde",
      startsAt: "2026-10-04T15:00:00Z",
    }),
    socialAppointment({
      id: "border-agenda",
      title: "Compromisso do mês anterior",
      startsAt: "2026-09-30T12:00:00Z",
    }),
  ];
  const publications = [
    socialPublication(),
    socialPublication({
      id: "meta-2",
      platform: "facebook",
      status: "failed",
      publishedAt: null,
      publishedMetaId: null,
      lastError: "Falha controlada no Facebook",
    }),
  ];
  let broken = failure;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    calls.push({
      path: url.pathname,
      query: url.search,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    let payload: any;
    if (url.pathname.includes(broken) && broken)
      return new Response(JSON.stringify({ message: "Fonte indisponível" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname === "/api/calendar/context")
      payload = { timeZone: "America/Sao_Paulo", today: "2026-10-04" };
    else if (url.pathname === "/api/calendar/overview")
      payload = { events: posts, range: {}, meta: { totalEvents: 999 } };
    else if (url.pathname === "/api/agenda/events")
      payload =
        method === "POST" ? { item: appointments[0] } : { items: appointments };
    else if (url.pathname === "/api/meta/publications")
      payload = { publications, total: publications.length, summary: {} };
    else if (url.pathname === "/api/clients")
      payload = {
        items: [
          { id: "client-a", name: "Aurora", slug: "aurora" },
          { id: "client-b", name: "Lume", slug: "lume" },
        ],
      };
    else if (url.pathname === "/api/agenda/labels") payload = { items: [] };
    else throw new Error("Unexpected fixture URL: " + url.pathname);
    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    fetch: fetcher,
    calls,
    posts,
    appointments,
    publications,
    setFailure: (value: string) => {
      broken = value;
    },
  };
}
