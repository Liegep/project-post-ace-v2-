import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { CardDetailModal } from "../src/App";
import "../src/styles.css";

const scenario = new URLSearchParams(location.search).get("scenario") ?? "super_admin";
const users = [
  { id: "admin", fullName: "Aline", email: "aline@example.test", globalRole: "admin" },
  { id: "collaborator", fullName: "Carlos", email: "carlos@designhub.local", globalRole: "colaborador" },
  { id: "super", fullName: "Liege", email: "hello@example.test", globalRole: "super_admin" },
  { id: "same-name", fullName: "Liege", email: "human@example.test", globalRole: "admin" },
];
const self = scenario === "super_admin" ? "super" : scenario === "colaborador" ? "collaborator" : "admin";
let reads = 0, release: (() => void) | undefined;
const items = scenario === "empty" ? [] : scenario === "one" ? [users[0]] : users.filter(user => user.id !== self);
const calls: any[] = [];
(window as any).reviewerFixture = { calls, items, release: () => release?.() };
window.fetch = async (input, init) => {
  const url = String(input), method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  calls.push({ url, method, body });
  let data: any;
  if (method === "GET" && url.endsWith("/internal-approval-reviewers")) {
    reads++;
    if (scenario === "retry" && reads === 1) return new Response(JSON.stringify({ message: "Unavailable" }), { status: 503 });
    if (scenario === "late" && reads === 1) {
      await new Promise<void>(resolve => { release = resolve; });
      data = { items: [users[0]] };
    } else data = { items };
  } else if (method === "GET" && url === "/api/clients") data = { items: [{ id: "client", slug: "synthetic", name: "Synthetic" }] };
  else if (method === "GET" && url.includes("time-entries")) data = { items: [], active: null, totalSeconds: 0 };
  else if (method === "GET" && /tags|hashtag/.test(url)) data = { items: [] };
  else if (method === "POST" && url.endsWith("/internal-approvals")) data = { ok: true, recipientIds: body.recipientIds, commentId: "comment" };
  else throw Error(`Unexpected request ${method} ${url}`);
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};
const card: any = { id: "card", title: "Synthetic card", caption: "Preserved caption", subtitle: "Preserved caption", typeLabel: "Post único", artType: "single_post", clientLabel: "Pendente", columnId: "work", status: [], statusBadges: [], tags: [], hashtags: [], mediaUrls: [], commentsCount: 1, approvalRevision: 1, isBriefApproval: false };
createRoot(document.getElementById("root")!).render(<MemoryRouter><CardDetailModal mode="admin" titlePrefix="Synthetic" detail={{ card, comments: [{ id: "existing", authorName: "Client", authorRole: "cliente", commentText: "Preserved comment", isInternal: false, createdAt: "2026-10-15" }], approvalLinks: [], approvalEvents: [] }} loading={false} source="backend" onAddComment={async () => {}} onRefresh={() => {}} onClose={() => {}} adminContext={{ slug: "synthetic", columns: [{ id: "work", name: "Work", cards: [], color: "#7568dc", visibleToClient: true }], canScheduleMeta: false }}/></MemoryRouter>);
