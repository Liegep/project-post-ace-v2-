import { useMemo, useSyncExternalStore } from "react";
import { listInternalApprovalInbox, type InternalApprovalRecord } from "./api";
import { ACCESS_TOKEN_KEY } from "./authApi";
import type { SessionUser } from "./types";

const POLL_MS = 30_000;
const IDLE_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
type Snapshot = InternalApprovalRecord[] | null;

// One feed per authenticated session in this browser tab, shared by navbar and Dashboard.
export function createInternalApprovalInboxStore(
  load: () => Promise<{ items: InternalApprovalRecord[] }>,
  isCurrentSession: () => boolean = () => true,
) {
  let snapshot: Snapshot = null;
  const listeners = new Set<() => void>();
  let timer: number | undefined;
  let pending = false;
  let nextAt = 0;
  let delay = POLL_MS;
  let lastActivity = Date.now();
  const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll"] as const;
  const clearTimer = () => { window.clearTimeout(timer); timer = undefined; };
  const eligible = () => listeners.size > 0 && isCurrentSession()
    && document.visibilityState === "visible" && Date.now() - lastActivity < IDLE_MS;
  const schedule = () => {
    clearTimer();
    if (eligible() && !pending) timer = window.setTimeout(() => { void refresh(); }, Math.max(0, nextAt - Date.now()));
  };
  const refresh = async () => {
    if (!eligible() || pending) return;
    if (Date.now() < nextAt) { schedule(); return; }
    pending = true;
    try {
      const result = await load();
      if (!listeners.size || !isCurrentSession()) return;
      snapshot = result.items;
      delay = POLL_MS;
      listeners.forEach(listener => listener());
    } catch {
      // Retain the last successful snapshot and avoid hammering a degraded server.
      delay = Math.min(delay * 2, MAX_BACKOFF_MS);
    } finally {
      pending = false;
      nextAt = Date.now() + delay;
      schedule();
    }
  };
  const onActivity = () => {
    const wasIdle = Date.now() - lastActivity >= IDLE_MS;
    lastActivity = Date.now();
    if (wasIdle) schedule();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") lastActivity = Date.now();
    schedule();
  };
  const onFocus = () => { lastActivity = Date.now(); schedule(); };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        lastActivity = Date.now();
        activityEvents.forEach(event => window.addEventListener(event, onActivity, { passive: true }));
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("focus", onFocus);
        void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        clearTimer();
        activityEvents.forEach(event => window.removeEventListener(event, onActivity));
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", onFocus);
      };
    },
  };
}

const emptyStore = { getSnapshot: (): Snapshot => null, subscribe: (_listener: () => void) => () => {} };
let current: { key: string; store: ReturnType<typeof createInternalApprovalInboxStore> } | undefined;

export function useInternalApprovalInbox(session: SessionUser) {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
  const store = useMemo(() => {
    if (session.role === "client") return emptyStore;
    const key = JSON.stringify([session.id, session.role, token]);
    if (current?.key !== key) {
      current = { key, store: createInternalApprovalInboxStore(listInternalApprovalInbox,
        () => current?.key === key && (window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? "") === token) };
    }
    return current.store;
  }, [session.id, session.role, token]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, emptyStore.getSnapshot);
}
