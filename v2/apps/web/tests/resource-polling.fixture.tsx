import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useInternalApprovalInbox } from "../src/useInternalApprovalInbox";
import { TextCoverPersistence } from "../src/TextCoverPersistence";
import { ACCESS_TOKEN_KEY } from "../src/authApi";
import type { SessionUser } from "../src/types";

const state = {
  requests: [] as string[], failInbox: false, holdInbox: false,
  release: null as (() => void) | null,
  items: [{ id: "approval-a", createdAt: "2026-11-25T10:00:00Z" }],
  setConsumers: (_count: number) => {}, setSession: (_id: string, _role = "super_admin") => {},
};
Object.assign(window, { resourceFixture: state });
localStorage.setItem(ACCESS_TOKEN_KEY, "token-a");
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const method = init?.method ?? "GET";
  state.requests.push(`${method} ${url.pathname}`);
  if (url.pathname === "/api/internal-approvals/inbox") {
    const items = [...state.items];
    if (state.holdInbox) await new Promise<void>(resolve => { state.release = resolve; });
    return new Response(JSON.stringify({ items }), { status: state.failInbox ? 503 : 200 });
  }
  const items = url.pathname === "/api/clients" ? [{ id: "client-a", slug: "fixture-client", name: "Synthetic" }]
    : url.pathname.endsWith("/texts") ? [{ id: "text-a", coverImageUrl: null }] : [];
  return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
};
function Consumer({ session, index }: { session: SessionUser; index: number }) {
  const inbox = useInternalApprovalInbox(session);
  return <output data-consumer={index}>{inbox?.map(item => item.id).join(",") ?? "loading"}</output>;
}
function Harness() {
  const [count, setCount] = useState(2);
  const [session, setSession] = useState({ id: "a", role: "super_admin", source: "api" } as SessionUser);
  localStorage.setItem("designhub-v2-session", JSON.stringify(session));
  state.setConsumers = setCount;
  state.setSession = (id, role = "super_admin") => {
    localStorage.setItem(ACCESS_TOKEN_KEY, `token-${id}`);
    setSession({ id, role, source: "api" } as SessionUser);
  };
  return <>{Array.from({ length: count }, (_, index) => <Consumer key={index} session={session} index={index} />)}{count > 0 && <TextCoverPersistence />}</>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Harness /></React.StrictMode>);
