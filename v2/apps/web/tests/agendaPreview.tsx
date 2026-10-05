import React from "react";
import { createRoot } from "react-dom/client";
import { AgendaWorkspace } from "../src/AgendaWorkspace";
import { dayKey } from "../src/socialCalendar";
import { zonedWallClockToIso } from "../../api/src/lib/zoned-date-time";
import "../src/styles.css";
const zone = "America/Sao_Paulo",
  day = dayKey(new Date(), zone);
const labels = [{ id: "label-1", name: "Reunião", color: "#c9f7df" }];
let items = Array.from({ length: 5 }, (_, i) => ({
  id: `event-${i}`,
  title:
    i === 0
      ? "Reunião de planejamento com título longo para conferir a leitura"
      : "Compromisso " + (i + 1),
  startsAt: zonedWallClockToIso(
    day + `T${String(9 + i).padStart(2, "0")}:00:00`,
    zone,
  ),
  timeZone: zone,
  recurrenceType: "none",
  isCompleted: i === 4,
  clientAccountId: "client-1",
  clientName: "Cliente de demonstração",
  labelId: "label-1",
  labelName: "Reunião",
  color: "#c9f7df",
}));
window.fetch = async (input, init) => {
  const url = String(input),
    method = init?.method ?? "GET",
    body = init?.body ? JSON.parse(String(init.body)) : {};
  let result: any;
  if (url.includes("/calendar/context"))
    result = { timeZone: zone, today: day };
  else if (url.includes("/agenda/events")) {
    if (method === "PATCH") {
      items = items.map((e) =>
        url.endsWith("/" + e.id)
          ? {
              ...e,
              ...body,
              startsAt: body.startsAt
                ? zonedWallClockToIso(body.startsAt, body.timeZone)
                : e.startsAt,
            }
          : e,
      );
      result = { ok: true };
    } else if (method === "POST") {
      items.push({
        ...items[0],
        ...body,
        id: crypto.randomUUID(),
        startsAt: zonedWallClockToIso(body.startsAt, body.timeZone),
      });
      result = { ok: true };
    } else if (method === "DELETE") {
      items = items.filter((e) => !url.endsWith("/" + e.id));
      result = { ok: true };
    } else result = { items };
  } else if (url.includes("/agenda/labels")) {
    if (method === "POST") {
      const label = { ...body, id: crypto.randomUUID() };
      labels.push(label);
      result = { label, ok: true };
    } else if (method === "DELETE") {
      result = { ok: true };
    } else result = { items: labels };
  } else
    result = { items: [{ id: "client-1", name: "Cliente de demonstração" }] };
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
};
createRoot(document.getElementById("root")!).render(
  <main className="main-column agenda-main-column" style={{ padding: 16 }}>
    <p>Prévia local · dados de demonstração · nenhuma alteração de produção</p>
    <AgendaWorkspace />
  </main>,
);
