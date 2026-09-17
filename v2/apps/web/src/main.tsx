import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AdminKanbanSearch } from "./AdminKanbanSearch";
import { AgendaOverflowViewer } from "./AgendaOverflowViewer";
import { RoleAccessGuard } from "./RoleAccessGuard";
import { TeamPasswordReset } from "./TeamPasswordReset";
import { SessionMembershipSync } from "./SessionMembershipSync";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <AdminKanbanSearch />
      <AgendaOverflowViewer />
      <RoleAccessGuard />
      <TeamPasswordReset />
      <SessionMembershipSync />
    </HashRouter>
  </React.StrictMode>,
);
