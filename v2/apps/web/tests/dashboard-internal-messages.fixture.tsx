import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "../src/App";
import { DashboardInternalMessagesWidget } from "../src/DashboardInternalMessagesWidget";
import type { InternalApprovalRecord } from "../src/api";
import { seasonalFixture } from "./seasonalFixtures";
import "../src/styles.css";

const query = new URLSearchParams(location.search);
const count = Number(query.get("count") ?? 8);
const timestamp = "2026-10-15T09:30:00Z";
const titles = [
  "Revisão interna da campanha de lançamento com um título muito longo para verificar a leitura em duas linhas e preservar integralmente o conteúdo ao abrir o card",
  "TítuloSemEspaços".repeat(25),
  "Revisar arte",
];
const items: InternalApprovalRecord[] = Array.from({ length: count }, (_, i) => ({
  id: `message-${i}`, cardId: `card-${i}`, clientSlug: "fixture-client", cardTitle: titles[i % titles.length],
  recipients: ["fixture-user"], requestedByUserId: "requester", commentId: null,
  message: "Por favor, revise esta campanha e confirme os ajustes antes de enviar ao cliente. ".repeat(3), createdAt: timestamp,
}));
const state = window as typeof window & { smokeWrites: string[]; openedMessage: InternalApprovalRecord | null };
state.smokeWrites = [];
state.openedMessage = null;
const seasonal = seasonalFixture("widget");
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const method = init?.method ?? "GET";
  if (method !== "GET" || !url.pathname.startsWith("/api/")) {
    state.smokeWrites.push(`${method} ${url.pathname}`);
    throw Error("Fixture refuses mutations and external requests");
  }
  const row = { id: "fixture-card", title: titles[0], clientName: "Cliente demonstração", clientSlug: "fixture-client", scheduledAt: timestamp, approvedAt: timestamp, createdAt: timestamp };
  let data: unknown;
  if (url.pathname === "/api/internal-approvals/inbox") data = { items };
  else if (url.pathname === "/api/dashboard/overview") data = {
    statistics: { timeZone: "Europe/Stockholm", month: "2026-10", postsThisMonth: 1, postsPreviousMonth: 0, pending: 1, scheduled: 1, published: 0, publishedPreviousMonth: 0 },
    dueTasks: [], upcomingPosts: [row], postsToday: [row], agendaToday: [{ id: "event", title: "Revisão da equipe", startsAt: timestamp, color: "#6557d8", isCompleted: false }],
    clientSubmissions: [row], approvedPautas: [row], clientActivities: [{ ...row, cardId: row.id, occurredAt: timestamp, activityType: "comment", detail: "Revisar o conteúdo" }],
  };
  else if (url.pathname === "/api/meta/status") data = { connected: false };
  else return seasonal.fetch(url.pathname + url.search, init);
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};

localStorage.setItem("designhub-v2-session", JSON.stringify({ id: "fixture-user", name: "Equipe demonstração", email: "fixture@invalid.test", role: query.get("role") ?? "super_admin", source: "api", memberships: [] }));
localStorage.removeItem("designhub-v2-access-token");
if (!location.hash) location.hash = "/dashboard";

function IsolatedWidget() {
  const [opened, setOpened] = useState<InternalApprovalRecord | null>(null);
  return <div className="dashboard-layout" style={{ display: "block", width: query.get("containerWidth") ? `${query.get("containerWidth")}px` : "100%" }}>
    <div className="dashboard-grid">
      <DashboardInternalMessagesWidget items={items} onOpen={(item) => { state.openedMessage = item; setOpened(item); }} />
    </div>
    {opened ? <div role="dialog" aria-label="Card completo">{opened.cardTitle}</div> : null}
  </div>;
}

createRoot(document.getElementById("root")!).render(<HashRouter>{query.has("isolated") ? <IsolatedWidget /> : <App />}</HashRouter>);
