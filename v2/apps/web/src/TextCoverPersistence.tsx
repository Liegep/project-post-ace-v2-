import { useEffect, useRef } from "react";
import { ACCESS_TOKEN_KEY } from "./authApi";

const SESSION_KEY = "designhub-v2-session";
const COVER_PREFIX = "designhub-text-cover:";

type StoredSession = {
  role?: "super_admin" | "admin" | "collaborator" | "client";
  source?: "demo" | "api";
};

type Account = {
  id: string;
  slug: string;
  portal: boolean;
};

type TextItem = {
  id: string;
  coverImageUrl?: string | null;
};

function apiBaseUrl() {
  const value = import.meta.env.VITE_V2_API_URL;
  return typeof value === "string" && value.length > 0 ? value.replace(/\/$/, "") : "";
}

function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as StoredSession : null;
  } catch {
    return null;
  }
}

function currentClientSlug() {
  const hash = decodeURIComponent(window.location.hash || "");
  const match = hash.match(/\/(?:admin|cliente|client|portal)\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function coverKey(slug: string, textId: string) {
  return `${COVER_PREFIX}${slug}:${textId}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function listAccounts(role: StoredSession["role"]): Promise<Account[]> {
  if (role === "client") {
    const response = await requestJson<{ items?: Array<{ clientAccountId: string; clientSlug: string }> }>("/api/portal/accounts");
    return (response.items ?? []).map((item) => ({ id: item.clientAccountId, slug: item.clientSlug, portal: true }));
  }
  const response = await requestJson<{ items?: Array<{ id: string; slug: string }> }>("/api/clients");
  return (response.items ?? []).map((item) => ({ id: item.id, slug: item.slug, portal: false }));
}

async function listTexts(account: Account) {
  const path = account.portal
    ? `/api/portal/accounts/${encodeURIComponent(account.id)}/texts`
    : `/api/clients/${encodeURIComponent(account.id)}/texts`;
  const response = await requestJson<{ items?: TextItem[] }>(path);
  return response.items ?? [];
}

async function saveCover(account: Account, textId: string, url: string) {
  if (account.portal) return;
  await requestJson(`/api/clients/${encodeURIComponent(account.id)}/texts/${encodeURIComponent(textId)}`, {
    method: "PATCH",
    body: JSON.stringify({ coverImageUrl: url }),
  });
}

export function TextCoverPersistence() {
  const accountsRef = useRef<Map<string, Account>>(new Map());
  const knownDbCoverRef = useRef<Map<string, string | null>>(new Map());
  const syncingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let reloadTimer: number | null = null;

    const sync = async () => {
      if (syncingRef.current) return;
      const session = readSession();
      if (!session || session.source !== "api" || !session.role) return;
      syncingRef.current = true;

      try {
        const accounts = await listAccounts(session.role);
        if (cancelled) return;
        accountsRef.current = new Map(accounts.map((account) => [account.slug, account]));

        const slug = currentClientSlug();
        const targets = slug ? accounts.filter((account) => account.slug === slug) : [];
        let needsReload = false;

        for (const account of targets) {
          const items = await listTexts(account);
          if (cancelled) return;

          for (const text of items) {
            const key = coverKey(account.slug, text.id);
            const localCover = window.localStorage.getItem(key);
            const knownBefore = knownDbCoverRef.current.get(key);
            const dbCover = text.coverImageUrl?.trim() || null;

            // If the user has just replaced a banner in this browser, prefer
            // that unsynced local value before accepting an older server value.
            if (!account.portal && knownBefore !== undefined && localCover && localCover !== knownBefore) {
              try {
                await saveCover(account, text.id, localCover);
                knownDbCoverRef.current.set(key, localCover);
              } catch {
                // Keep the local banner visible and retry on the next pass.
              }
              continue;
            }

            if (!dbCover && localCover && !account.portal) {
              // One-time migration from the legacy localStorage-only behavior.
              try {
                await saveCover(account, text.id, localCover);
                knownDbCoverRef.current.set(key, localCover);
              } catch {
                knownDbCoverRef.current.set(key, null);
              }
              continue;
            }

            knownDbCoverRef.current.set(key, dbCover);
            if (dbCover && localCover !== dbCover) {
              window.localStorage.setItem(key, dbCover);
              needsReload = true;
            }
          }
        }

        if (needsReload && !cancelled) {
          reloadTimer = window.setTimeout(() => window.location.reload(), 80);
        }
      } catch {
        // Banner persistence is additive; a temporary API failure must never
        // interfere with the rest of the application.
      } finally {
        syncingRef.current = false;
      }
    };

    const persistLocalChanges = async () => {
      const slug = currentClientSlug();
      if (!slug) return;
      const account = accountsRef.current.get(slug);
      if (!account || account.portal) return;

      for (const [key, knownCover] of knownDbCoverRef.current.entries()) {
        if (!key.startsWith(`${COVER_PREFIX}${slug}:`)) continue;
        const localCover = window.localStorage.getItem(key);
        if (!localCover || localCover === knownCover) continue;
        const textId = key.slice(`${COVER_PREFIX}${slug}:`.length);
        try {
          await saveCover(account, textId, localCover);
          knownDbCoverRef.current.set(key, localCover);
        } catch {
          // Retry automatically on the next interval/focus.
        }
      }
    };

    void sync();
    const persistTimer = window.setInterval(() => { void persistLocalChanges(); }, 1200);
    const refreshTimer = window.setInterval(() => { void sync(); }, 60_000);
    const onFocus = () => { void persistLocalChanges().then(() => sync()); };
    const onHashChange = () => { void sync(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("hashchange", onHashChange);

    return () => {
      cancelled = true;
      window.clearInterval(persistTimer);
      window.clearInterval(refreshTimer);
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return null;
}
