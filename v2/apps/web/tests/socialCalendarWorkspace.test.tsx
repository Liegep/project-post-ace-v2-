import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { socialFixture } from "./socialCalendarFixtures";
test("unified calendar interactions preserve source, scope and navigation context", async (t) => {
  const dom = new JSDOM('<body><div id="root"></div></body>', {
    url: "http://localhost",
  });
  const keys = [
    "window",
    "document",
    "HTMLElement",
    "localStorage",
    "sessionStorage",
    "CustomEvent",
    "fetch",
    "requestAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT",
  ] as const;
  const saved = Object.fromEntries(
    keys.map((k) => [k, (globalThis as any)[k]]),
  );
  let mobile = false;
  let scroll = 0;
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: (fn: () => void) => {
      fn();
      return 1;
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: mobile }),
    configurable: true,
  });
  window.scrollTo = (_x: any, y?: number) => {
    scroll = y ?? 0;
  };
  Object.defineProperty(window, "scrollY", { get: () => scroll });
  const server = await createServer({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    server: { middlewareMode: true, hmr: false },
  });
  const { SocialCalendarWorkspace } = await server.ssrLoadModule(
    "/src/SocialCalendarWorkspace.tsx",
  );
  let root = createRoot(document.getElementById("root")!);
  let fixture = socialFixture();
  const flush = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 35));
    });
  };
  const button = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (el) =>
        el.textContent?.trim() === name ||
        el.getAttribute("aria-label") === name,
    )!;
  const click = async (name: string) => {
    assert.ok(button(name), name);
    await act(async () => button(name).click());
    await flush();
  };
  const change = async (selector: string, value: string) => {
    const el = document.querySelector<HTMLInputElement>(selector)!;
    assert.ok(el);
    await act(async () => {
      el.value = value;
      Simulate.change(el);
    });
    await flush();
  };
  function Navigation() {
    const loc = useLocation(),
      nav = useNavigate();
    return (
      <>
        <output data-location>{loc.pathname + loc.search}</output>
        {loc.pathname.startsWith("/admin/") ? (
          <button onClick={() => nav(-1)}>Voltar do card</button>
        ) : null}
      </>
    );
  }
  const mount = async (
    role = "super_admin",
    failure = "",
    search = "?date=2026-10-04&view=month",
  ) => {
    await act(async () => root.unmount());
    root = createRoot(document.getElementById("root")!);
    fixture = socialFixture(failure);
    globalThis.fetch = fixture.fetch;
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/area/calendario-social" + search]}>
          <Navigation />
          <Routes>
            <Route
              path="/area/calendario-social"
              element={<SocialCalendarWorkspace session={{ role }} />}
            />
            <Route path="/admin/:slug" element={<p>Editor existente</p>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    await flush();
    await flush();
  };
  const text = () => document.body.textContent!;
  try {
    await t.test(
      "desktop renders commitments, counts only selected month and +N opens all items",
      async () => {
        await mount();
        assert.match(
          document.querySelector(".social-calendar-desktop")!.textContent!,
          /Reunião editorial/,
        );
        assert.match(text(), /6 itens no mês selecionado/);
        assert.match(text(), /Post do mês seguinte/);
        await click("+3 mais");
        const dialog = document.querySelector('[role="dialog"]')!;
        assert.equal(dialog.querySelectorAll(".social-agenda-item").length, 6);
        const entry = [
          ...dialog.querySelectorAll<HTMLButtonElement>(".social-agenda-item"),
        ].find((el) => el.textContent?.includes("Revisão da tarde"))!;
        await act(async () => entry.click());
        await flush();
        assert.match(
          document.querySelector('[role="dialog"]')!.textContent!,
          /America\/Sao_Paulo/,
        );
        await click("← Itens do dia");
        assert.equal(
          document.querySelectorAll('[role="dialog"] .social-agenda-item')
            .length,
          6,
        );
        await click("Fechar");
        assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
      },
    );
    await t.test(
      "platform partial publication is never shown as globally published",
      async () => {
        await mount();
        const entry = document.querySelector<HTMLButtonElement>(
          ".social-calendar-desktop .execution-partial",
        )!;
        await act(async () => entry.click());
        await flush();
        const detail = document.querySelector('[role="dialog"]')!.textContent!;
        assert.match(detail, /Publicação parcial/);
        assert.match(detail, /Instagram · Publicado/);
        assert.match(detail, /Facebook · Falhou/);
        assert.match(detail, /não confirma publicação/);
        assert.ok(button("Abrir card"));
      },
    );
    await t.test(
      "mobile interleaves appointments and posts by time and counts match desktop",
      async () => {
        mobile = true;
        await mount();
        const day = [...document.querySelectorAll(".social-agenda-day")].find(
          (el) => el.textContent?.includes("Reunião editorial"),
        )!;
        const titles = [
          ...day.querySelectorAll(".social-agenda-item>span"),
        ].map((el) => el.textContent!);
        assert.match(titles[0], /08:00 · Reunião editorial/);
        assert.match(titles[1], /09:00 · Campanha/);
        assert.match(titles[2], /11:00 · Segundo/);
        assert.match(titles[3], /12:00 · Revisão/);
        assert.equal(titles.length, 6);
        assert.match(text(), /6 itens no mês selecionado/);
        mobile = false;
      },
    );
    await t.test(
      "Agenda failure leaves posts; Meta failure leaves internal and appointments",
      async () => {
        await mount("super_admin", "/agenda/events");
        assert.match(text(), /Agenda indisponível/);
        assert.match(text(), /Campanha/);
        assert.match(text(), /4 itens no mês selecionado/);
        await mount("super_admin", "/meta/publications");
        assert.match(text(), /Meta indisponível/);
        assert.match(text(), /Reunião editorial/);
        assert.match(text(), /6 itens no mês selecionado/);
        assert.equal(
          document.querySelectorAll(".execution-published").length,
          0,
        );
        assert.doesNotMatch(text(), /Não agendado na Meta/);
        assert.match(text(), /Meta: Não disponível/);
        fixture.setFailure("");
        await click("Tentar novamente");
        assert.ok(document.querySelector(".execution-partial"));
      },
    );
    await t.test(
      "admin and collaborator never request global Meta and retain existing scope",
      async () => {
        for (const role of ["admin", "colaborador"]) {
          await mount(role);
          assert.match(text(), /apenas para superadmin/);
          assert.equal(
            fixture.calls.filter((c) => c.path === "/api/meta/publications")
              .length,
            0,
          );
          assert.match(text(), /Reunião editorial/);
        }
      },
    );
    await t.test(
      "monthly arrows handle January 31 and canonical URL persists filters/card return/scroll",
      async () => {
        await mount("super_admin", "", "?date=2026-01-31&view=month");
        await click("Próximo período");
        assert.match(
          document.querySelector("[data-location]")!.textContent!,
          /date=2026-02-01/,
        );
        await mount();
        await change(".social-calendar-filters select", "client-a");
        scroll = 340;
        await act(async () =>
          document
            .querySelector<HTMLButtonElement>(
              ".social-calendar-desktop .execution-partial",
            )!
            .click(),
        );
        await flush();
        await click("Abrir card");
        assert.equal(
          document.querySelector("[data-location]")!.textContent,
          "/admin/aurora?card=card-1",
        );
        scroll = 0;
        await click("Voltar do card");
        assert.match(
          document.querySelector("[data-location]")!.textContent!,
          /date=2026-10-04&view=month&client=client-a/,
        );
        assert.equal(
          document.querySelector<HTMLSelectElement>(
            ".social-calendar-filters select",
          )!.value,
          "client-a",
        );
        assert.equal(scroll, 340);
      },
    );
    await t.test(
      "new appointment uses operation timezone, not browser timezone",
      async () => {
        await mount();
        await click("＋ Compromisso");
        await change('[role="dialog"] input:not([type])', "Planejamento");
        await click("Adicionar compromisso");
        const post = fixture.calls.find((c) => c.method === "POST")!;
        assert.equal(post.body.timeZone, "America/Sao_Paulo");
        assert.equal(post.body.startsAt, "2026-10-04T09:00");
      },
    );
    await t.test(
      "focus refresh is throttled and updates an already open Meta detail",
      async () => {
        const realNow = Date.now;
        let now = realNow();
        Date.now = () => now;
        try {
          await mount();
          await act(async () =>
            document
              .querySelector<HTMLButtonElement>(
                ".social-calendar-desktop .execution-partial",
              )!
              .click(),
          );
          await flush();
          const before = fixture.calls.filter(
            (c) => c.path === "/api/meta/publications",
          ).length;
          fixture.publications[1].status = "published";
          await act(async () =>
            window.dispatchEvent(new window.Event("focus")),
          );
          await flush();
          assert.equal(
            fixture.calls.filter((c) => c.path === "/api/meta/publications")
              .length,
            before,
          );
          now += 60001;
          await act(async () =>
            window.dispatchEvent(new window.Event("focus")),
          );
          await flush();
          await flush();
          assert.equal(
            fixture.calls.filter((c) => c.path === "/api/meta/publications")
              .length,
            before + 1,
          );
          assert.doesNotMatch(
            document.querySelector('[role="dialog"]')!.textContent!,
            /Publicação parcial/,
          );
          assert.match(
            document.querySelector('[role="dialog"]')!.textContent!,
            /Facebook · Publicado/,
          );
        } finally {
          Date.now = realNow;
        }
      },
    );
    await t.test(
      "content filters apply to all views and count actual visible items",
      async () => {
        await mount();
        await change(".social-calendar-content-controls select", "appointment");
        assert.match(text(), /2 itens no mês selecionado/);
        assert.equal(
          document.querySelectorAll(
            ".social-calendar-desktop .social-calendar-event",
          ).length,
          3,
        );
      },
    );
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();
    for (const key of keys) (globalThis as any)[key] = saved[key];
  }
});
