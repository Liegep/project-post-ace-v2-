import { useEffect, useRef } from "react";
import { ACCESS_TOKEN_KEY, restoreApiSession } from "./authApi";
import type { SessionUser } from "./types";

const SESSION_KEY = "designhub-v2-session";
const SYNC_INTERVAL_MS = 120_000;

function readStoredSession(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as SessionUser : null;
  } catch {
    return null;
  }
}

function sortStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sessionAccessChanged(current: SessionUser, fresh: SessionUser) {
  if (current.id !== fresh.id || current.role !== fresh.role) return true;
  if (JSON.stringify(sortStrings(current.assignedAdminSlugs ?? [])) !== JSON.stringify(sortStrings(fresh.assignedAdminSlugs ?? []))) return true;
  if (JSON.stringify(sortStrings(current.assignedPortalSlugs ?? [])) !== JSON.stringify(sortStrings(fresh.assignedPortalSlugs ?? []))) return true;

  const currentAccounts = (current.portalAccounts ?? []).map((item) => `${item.slug}:${item.name}`).sort();
  const freshAccounts = (fresh.portalAccounts ?? []).map((item) => `${item.slug}:${item.name}`).sort();
  return JSON.stringify(currentAccounts) !== JSON.stringify(freshAccounts);
}

export function SessionMembershipSync() {
  const syncingRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const sync = async () => {
      if (disposed || syncingRef.current || document.visibilityState === "hidden") return;
      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
      const current = readStoredSession();
      if (!token || !current || current.source !== "api") return;

      syncingRef.current = true;
      try {
        const fresh = await restoreApiSession(token);
        if (!fresh || disposed) return;
        if (!sessionAccessChanged(current, fresh)) return;

        window.localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
        window.location.reload();
      } catch {
        // A transient API failure must not log the user out or overwrite the last valid session.
      } finally {
        syncingRef.current = false;
      }
    };

    const onFocus = () => { void sync(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => { void sync(); }, SYNC_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
