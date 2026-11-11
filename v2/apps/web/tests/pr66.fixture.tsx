import React from "react";
import { createRoot } from "react-dom/client";
import { BriefsFoundationWorkspace } from "../src/BriefFoundationWorkspace";
import "../src/styles.css";
import "../src/briefsDesign.css";
// Rendering harness only; every API request goes to the real local Fastify API.
createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 1280, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
    <BriefsFoundationWorkspace viewerId="pr66-synthetic-admin" />
  </main>,
);
