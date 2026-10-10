import React from "react";
import { createRoot } from "react-dom/client";
import { BrandBrainExperience } from "../src/App";
import "../src/styles.css";

const portal = new URLSearchParams(location.search).has("portal");
const fixtureWindow = window as typeof window & { smokeWrites: Array<{ url: string; method: string }> };
fixtureWindow.smokeWrites = [];
window.fetch = async (input, init) => {
  const url = String(input), method = init?.method || "GET";
  if (method !== "GET") {
    fixtureWindow.smokeWrites.push({ url, method });
    throw Error("No writes allowed in layout fixture");
  }
  let data: unknown;
  if (url === "/api/clients") {
    data = { items: [{ id: "fixture-client", slug: "fixture", name: "Cliente de demonstração" }] };
  } else if (url === "/api/portal/accounts") {
    data = { items: [{ clientAccountId: "fixture-client", clientSlug: "fixture" }] };
  } else if (url === "/api/clients/fixture-client/brand-brain") {
    data = {
      data: {
        mission: "Orientar com clareza",
        positioning: "Estratégia e clareza para decisões mais seguras.",
        brandPromise: "Conteúdo que traduz temas complexos com responsabilidade.",
        voice: "Humana e didática",
        pillars: [
          { name: "Educação", focus: "Ensinar com clareza", weight: 30 },
          { name: "Prevenção", focus: "Orientar antes do conflito", weight: 25 },
        ],
      },
      meta: { version: 11, updatedAt: "2026-10-09T13:06:53.000Z" },
      revisions: [], history: [], comments: [],
    };
  } else {
    throw Error(`Unexpected ${url}`);
  }
  return new Response(JSON.stringify(data));
};

const brain = <BrandBrainExperience slug="fixture" clientName="Cliente de demonstração" portal={portal} />;
createRoot(document.getElementById("root")!).render(portal ? brain : (
  <div className="page-grid admin-layout kanban-admin-layout">
    {/* Reserve the desktop rail column without unrelated fixed mobile controls. */}
    <aside className="admin-rail" aria-hidden="true" style={{ visibility: "hidden" }} />
    <main className="main-column">
      <section className="workspace">
        <div className="board-shell glass">
          <div className="board-topbar">
            <div className="tab-strip"><button className="tab active">Brand Brain</button></div>
          </div>
          <div className="board-layout" style={{ "--kanban-floating-actions-space": "12px" } as React.CSSProperties}>
            {brain}
          </div>
        </div>
      </section>
    </main>
  </div>
));
