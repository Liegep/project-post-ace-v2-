import { useState } from "react";
import type { InternalApprovalRecord } from "./api";

const DISMISSED_INTERNAL_MESSAGES_KEY = "designhub-v2-dismissed-internal-messages";
const messageDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function DashboardInternalMessagesWidget({ items, onOpen }: {
  items: InternalApprovalRecord[];
  onOpen: (item: InternalApprovalRecord) => void;
}) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(DISMISSED_INTERNAL_MESSAGES_KEY) ?? "[]") as string[]; }
    catch { return []; }
  });
  const visibleItems = items.filter((item) => !dismissedIds.includes(item.id));
  if (!visibleItems.length) return null;

  return <section className="dashboard-widget dashboard-internal-messages">
    <header className="dashboard-widget-head">
      <div><p className="eyebrow">Equipe</p><h3>Mensagens internas</h3><small>Cards enviados para sua revisão</small></div>
      <span>{visibleItems.length}</span>
    </header>
    <div className="dashboard-internal-list">
      {visibleItems.slice(0, 5).map((item) => <div className="dashboard-internal-row" key={item.id}>
        <button type="button" className="dashboard-internal-open" onClick={() => onOpen(item)}>
          <span className="dashboard-item-bullet" aria-hidden="true" />
          <span className="internal-message-icon" aria-hidden="true">♙</span>
          <span className="dashboard-internal-copy">
            <strong title={item.cardTitle}>{item.cardTitle}</strong>
            <small>{item.message}</small>
            <time dateTime={item.createdAt}>{messageDate.format(new Date(item.createdAt))}</time>
          </span>
        </button>
        <button type="button" className="dashboard-internal-dismiss" aria-label="Fechar mensagem" title="Fechar mensagem" onClick={() => setDismissedIds((current) => {
          const next = [...current, item.id];
          window.localStorage.setItem(DISMISSED_INTERNAL_MESSAGES_KEY, JSON.stringify(next));
          return next;
        })}>×</button>
      </div>)}
    </div>
  </section>;
}
