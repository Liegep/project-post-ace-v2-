import React, { type ReactNode } from "react";
import type { DashboardStatistics } from "./api";

type MetricIcon = "users" | "calendar" | "clock" | "send" | "check";
export function DashboardMetrics({ activeClients, statistics, loading, renderIcon }: {
  activeClients: number; statistics: DashboardStatistics; loading: boolean;
  renderIcon: (name: MetricIcon) => ReactNode;
}) {
  const metrics = [
    { key: "clients", label: "Clientes ativos", value: activeClients, detail: "Contas em andamento", icon: "users" },
    { key: "posts", label: "Posts do mês", value: statistics.postsThisMonth, detail: "Total planejado", icon: "calendar" },
    { key: "pending", label: "Pendentes", value: statistics.pending, detail: "Ainda precisam de ação", icon: "clock" },
    { key: "scheduled", label: "Agendados", value: statistics.scheduled, detail: "Prontos para publicar", icon: "send" },
    { key: "published", label: "Publicados", value: statistics.published, detail: "Já concluídos", icon: "check" },
  ] as const;
  return <div className="dashboard-metrics dashboard-metrics-inline dashboard-workflow-metrics" role="group" aria-label="Fluxo de posts do mês">
    {metrics.map((metric) => <article key={metric.key} className={`dashboard-metric ${metric.key}`}>
      {renderIcon(metric.icon)}<div><span>{metric.label}</span><strong>{loading ? "-" : metric.value}</strong><small>{metric.detail}</small></div>
    </article>)}
  </div>;
}
