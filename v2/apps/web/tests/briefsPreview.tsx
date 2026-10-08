import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "../src/App";
import { PortalBriefsFoundation } from "../src/BriefFoundationWorkspace";
import "../src/styles.css";
import { briefsFixture } from "./briefsFixtures";
const query = new URLSearchParams(location.search);
window.fetch = briefsFixture(query.get("scenario") === "empty").fetch;
localStorage.setItem("designhub-v2-access-token", "local-preview-only");
localStorage.setItem(
  "designhub-v2-session",
  JSON.stringify({
    id: "preview-user",
    name: "Revisão visual",
    email: "preview@invalid.test",
    role: "super_admin",
    assignedAdminSlugs: [],
    assignedPortalSlugs: [],
    locale: "pt",
    source: "api",
    accessToken: "local-preview-only",
  }),
);
window.location.hash = "/area/briefs-design";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      {query.has("portal") ? (
        <main
          style={{ padding: "20px", background: "#f7f8fc", minHeight: "100vh" }}
        >
          <PortalBriefsFoundation slug="casa-lume" canRespond />
        </main>
      ) : (
        <App />
      )}
    </HashRouter>
  </React.StrictMode>,
);
