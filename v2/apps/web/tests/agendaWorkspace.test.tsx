import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dayKey, shiftDay } from "../src/socialCalendar";
import { zonedWallClockToIso } from "../../api/src/lib/zoned-date-time";
test("Agenda workspace integrates loaded sources, accessible overflow, complete edits and frontend filters", async (t) => {
  const dom = new JSDOM('<body><div id="root"></div></body>', {
    url: "http://localhost",
  });
  const keys = [
    "window",
    "document",
    "HTMLElement",
    "localStorage",
    "fetch",
    "IS_REACT_ACT_ENVIRONMENT",
  ] as const;
  const saved = Object.fromEntries(
    keys.map((k) => [k, (globalThis as any)[k]]),
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const server = await createServer({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    server: { middlewareMode: true, hmr: false },
  });
  const { AgendaWorkspace } = await server.ssrLoadModule(
    "/src/AgendaWorkspace.tsx",
  );
  const root = createRoot(document.getElementById("root")!);
  const zone = "America/Sao_Paulo",
    day = dayKey(new Date(), zone),
    first = day.slice(0, 7) + "-01";
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: "event-" + i,
    title: "Compromisso " + i,
    taskDescription: "Detalhes " + i,
    startsAt: zonedWallClockToIso(
      day + `T${String(9 + i).padStart(2, "0")}:00:00`,
      zone,
    ),
    timeZone: i === 0 ? "Europe/Stockholm" : zone,
    recurrenceType: "none",
    color: "#c9f7df",
    isCompleted: i === 4,
    labelId: "label-1",
    labelName: "Reunião",
    clientAccountId: "client-1",
    clientName: "Aurora",
  }));
  items.push({
    ...items[0],
    id: "neighbor",
    title: "Outro mês",
    startsAt: zonedWallClockToIso(shiftDay(first, -1) + "T09:00:00", zone),
  });
  let fail = "",
    calls: Array<{ url: string; method: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any = {}) => {
    const u = String(url);
    calls.push({
      url: u,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(init.body) : null,
    });
    if (
      (fail === "events" &&
        u.includes("/agenda/events") &&
        (!init.method || init.method === "GET")) ||
      (fail === "labels" && u.endsWith("/agenda/labels"))
    )
      return new Response(JSON.stringify({ message: "Falha controlada" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    const result = u.includes("/calendar/context")
      ? { timeZone: zone, today: day }
      : init.method && init.method !== "GET"
        ? { ok: true, id: "new" }
        : u.includes("/agenda/events")
          ? { items }
          : u.endsWith("/agenda/labels")
            ? { items: [{ id: "label-1", name: "Reunião", color: "#c9f7df" }] }
            : { items: [{ id: "client-1", name: "Aurora" }] };
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const flush = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 35));
    });
  };
  const button = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (e) =>
        e.textContent?.trim() === name || e.getAttribute("aria-label") === name,
    )!;
  const click = async (name: string) => {
    assert.ok(button(name), name);
    await act(async () => button(name).click());
    await flush();
  };
  const change = async (selector: string, value: string) => {
    const el = document.querySelector<HTMLInputElement>(selector)!;
    assert.ok(el, selector);
    await act(async () => {
      el.value = value;
      Simulate.change(el);
    });
  };
  try {
    await act(async () => root.render(<AgendaWorkspace />));
    await flush();
    await flush();
    await t.test(
      "Monthly count excludes neighbors; +N is a button using loaded items without a fetch",
      async () => {
        assert.match(
          document.querySelector(".agenda-foundation-controls")!.textContent!,
          /5 compromissos no mês selecionado/,
        );
        const more =
          document.querySelector<HTMLButtonElement>("button.agenda-more")!;
        assert.ok(more);
        const before = calls.length;
        await act(async () => more.click());
        await flush();
        assert.equal(calls.length, before);
        const dialog = document.querySelector('[role="dialog"]')!;
        const rows = [
          ...dialog.querySelectorAll<HTMLButtonElement>(".agenda-event-pill"),
        ];
        assert.equal(rows.length, 5);
        assert.match(rows[0].textContent!, /09:00/);
        assert.match(rows[4].textContent!, /13:00/);
        await act(async () => rows[0].click());
        await flush();
        assert.match(
          document.querySelector('[role="dialog"]')!.textContent!,
          /Editar compromisso/,
        );
      },
    );
    await t.test(
      "Complete edit retains label on color override and original timezone when rescheduling",
      async () => {
        await change('input[type="color"]', "#123456");
        assert.equal(
          document.querySelector<HTMLSelectElement>('[role="dialog"] select')!
            .value,
          "client-1",
        );
        assert.equal(
          [
            ...document.querySelectorAll<HTMLSelectElement>(
              '[role="dialog"] select',
            ),
          ][1].value,
          "label-1",
        );
        await change(
          '[role="dialog"] input[type="datetime-local"]',
          day + "T10:30",
        );
        await act(async () =>
          Simulate.submit(document.querySelector('[role="dialog"] form')!),
        );
        await flush();
        const write = calls.find((c) => c.method === "PATCH")!;
        assert.equal(write.url, "/api/agenda/events/event-0");
        assert.equal(write.body.labelId, "label-1");
        assert.equal(write.body.color, "#123456");
        assert.equal(write.body.timeZone, "Europe/Stockholm");
        assert.equal(
          write.body.startsAt,
          zonedWallClockToIso(day + "T10:30", zone)
            ? (await import("../../api/src/lib/zoned-date-time"))
                .instantToWallClock(
                  zonedWallClockToIso(day + "T10:30", zone)!,
                  "Europe/Stockholm",
                )
                .replace(" ", "T")
            : "",
        );
      },
    );
    await t.test(
      "Filters use loaded data without queries and pending differs from completion",
      async () => {
        const before = calls.length;
        await change('select[aria-label="Filtrar por conclusão"]', "completed");
        await flush();
        assert.equal(calls.length, before);
        assert.match(
          document.querySelector(".agenda-foundation-controls")!.textContent!,
          /1 compromisso/,
        );
        assert.ok(document.querySelector(".is-completed"));
        await change('select[aria-label="Filtrar por conclusão"]', "pending");
        await flush();
        assert.match(
          document.querySelector(".agenda-foundation-controls")!.textContent!,
          /4 compromissos/,
        );
        await change('select[aria-label="Filtrar por conclusão"]', "");
      },
    );
    await t.test(
      "Label load failure keeps appointments and labels already loaded with explicit warning",
      async () => {
        fail = "labels";
        await click("＋ Novo compromisso");
        await act(async () =>
          Simulate.submit(document.querySelector('[role="dialog"] form')!),
        );
        await flush();
        // The required empty title is validated by the handler too; close and trigger a retry via a source error.
        await click("Fechar Novo compromisso");
        await click("Próximo período");
        assert.match(
          document.body.textContent!,
          /Não foi possível atualizar as etiquetas/,
        );
        assert.equal(
          document.querySelectorAll(
            'select[aria-label="Filtrar por etiqueta"] option',
          ).length,
          2,
        );
        await click("Período anterior");
        assert.match(
          document.querySelector(".agenda-foundation-controls")!.textContent!,
          /5 compromissos/,
        );
      },
    );
    await t.test(
      "Event source failure retains available appointments, separate warnings and recovery",
      async () => {
        fail = "events";
        await click("Próximo período");
        assert.match(
          document.body.textContent!,
          /Não foi possível atualizar os compromissos/,
        );
        await click("Período anterior");
        assert.match(
          document.querySelector(".agenda-foundation-controls")!.textContent!,
          /5 compromissos/,
        );
        fail = "";
        await click("Tentar novamente");
        assert.doesNotMatch(
          document.body.textContent!,
          /Não foi possível atualizar os compromissos|Não foi possível atualizar as etiquetas/,
        );
      },
    );
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();
    for (const k of keys) {
      if (saved[k] === undefined) delete (globalThis as any)[k];
      else (globalThis as any)[k] = saved[k];
    }
  }
});
