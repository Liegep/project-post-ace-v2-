import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AdminKanbanSearch } from "./AdminKanbanSearch";
import { AgendaOverflowViewer } from "./AgendaOverflowViewer";
import { RoleAccessGuard } from "./RoleAccessGuard";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <AdminKanbanSearch />
      <AgendaOverflowViewer />
      <RoleAccessGuard />
    </HashRouter>
  </React.StrictMode>,
);
