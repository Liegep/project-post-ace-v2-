import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { seasonalFixture } from "./seasonalFixtures";
import { SocialCalendarWorkspace } from "../src/SocialCalendarWorkspace";
import "../src/styles.css";
import { socialFixture } from "./socialCalendarFixtures";
const query = new URLSearchParams(window.location.search);
const fixture = socialFixture(query.get("failure") ?? "");
const fallback = seasonalFixture();
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const known = [
    "/api/calendar/context",
    "/api/calendar/overview",
    "/api/agenda/events",
    "/api/agenda/labels",
    "/api/meta/publications",
    "/api/clients",
  ];
  return known.includes(url.pathname)
    ? fixture.fetch(input, init)
    : fallback.fetch(input, init);
};
localStorage.setItem("designhub-v2-access-token", "local-preview-only");
if (query.get("shell") === "1") {
  localStorage.setItem(
    "designhub-v2-session",
    JSON.stringify({
      id: "preview-user",
      name: "Revisão funcional",
      email: "preview@invalid.test",
      password: "",
      role: "super_admin",
      assignedAdminSlugs: [],
      assignedPortalSlugs: [],
      locale: "pt",
      source: "api",
      accessToken: "local-preview-only",
    }),
  );
  window.location.hash =
    "/area/calendario-social?date=2026-10-04&view=" +
    (query.get("view") ?? "month");
  createRoot(document.getElementById("root")!).render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
} else
  createRoot(document.getElementById("root")!).render(
    <MemoryRouter
      initialEntries={[
        "/area/calendario-social?date=2026-10-04&view=" +
          (query.get("view") ?? "month"),
      ]}
    >
      <main style={{ padding: "clamp(12px, 2vw, 24px)", minHeight: "100vh" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Calendário social</h1>
        <SocialCalendarWorkspace
          session={{ role: query.get("role") ?? "super_admin" }}
        />
      </main>
    </MemoryRouter>,
  );
