import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, webcrypto } from "node:crypto";
const rootPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
test("brief authoring and portal responses preserve frozen forms, server drafts and retry identity", async (t) => {
  const dom = new JSDOM('<body><div id="root"></div></body>', {
    url: "http://localhost",
  });
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.assign(dom.window.HTMLElement.prototype, {
    attachEvent() {},
    detachEvent() {},
  });
  dom.window.confirm = () => true;
  const server = await createServer({
    root: rootPath,
    server: { middlewareMode: true, hmr: false },
  });
  let root = createRoot(document.getElementById("root")!);
  const { BriefsFoundationWorkspace, PortalBriefsFoundation } =
    await server.ssrLoadModule("/src/BriefFoundationWorkspace.tsx");
  const client = randomUUID(),
    id = randomUUID();
  const form = {
    title: "Identidade visual",
    introduction: "Instruções",
    category: "branding",
    locale: "pt",
    fields: [
      {
        id: "name",
        type: "short",
        label: "Marca",
        help: "",
        required: true,
        options: [],
        validation: {},
      },
    ],
  };
  const template = {
    id: randomUUID(),
    name: form.title,
    description: "Modelo",
    version: 1,
    status: "active",
    form,
  };
  let detail: any = {
    brief: {
      id,
      clientAccountId: client,
      templateId: template.id,
      templateVersion: 1,
      form,
      status: "draft",
      version: 1,
      sentAt: null,
    },
    response: null,
    revisions: [],
    attachments: [],
    events: [],
  };
  const calls: { url: string; method: string; body: any; headers: Headers }[] =
    [];
  let failSubmit = false;
  globalThis.fetch = async (input: any, init: any = {}) => {
    const url = String(input),
      method = init.method ?? "GET",
      body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url, method, body, headers: new Headers(init.headers) });
    let result: any;
    if (url.endsWith("/portal/accounts"))
      result = { items: [{ clientAccountId: client, clientSlug: "cliente" }] };
    else if (url.endsWith("/clients"))
      result = { items: [{ id: client, name: "Cliente", slug: "cliente" }] };
    else if (url.endsWith("/design-briefs")) result = { items: [] };
    else if (url.endsWith("/briefs/templates")) result = { items: [template] };
    else if (url.endsWith("/send")) {
      detail = {
        ...detail,
        brief: {
          ...detail.brief,
          status: "sent",
          version: 2,
          sentAt: "2026-10-05T10:00:00Z",
        },
        response: {
          id: randomUUID(),
          status: "draft",
          version: 1,
          answers: {},
        },
      };
      result = detail;
    } else if (url.includes("/fields/") && url.endsWith("/attachments")) {
      result = detail;
    } else if (url.endsWith("/response")) {
      detail = {
        ...detail,
        response: {
          ...detail.response,
          answers: body.answers,
          version: detail.response.version + 1,
        },
      };
      result = detail;
    } else if (url.endsWith("/submit")) {
      if (failSubmit)
        return new Response(JSON.stringify({ message: "Falha temporária" }), {
          status: 503,
        });
      detail = {
        ...detail,
        brief: { ...detail.brief, status: "answered" },
        response: {
          ...detail.response,
          status: "submitted",
          answers: body.answers,
          version: detail.response.version + 1,
        },
        revisions: [
          {
            id: randomUUID(),
            revision: 1,
            answers: body.answers,
            submittedAt: "2026-10-05T11:00:00Z",
            submittedByUserId: client,
          },
        ],
      };
      result = detail;
    } else if (url.endsWith("/briefs")) {
      if (method === "GET")
        result = {
          items:
            detail.brief.status === "draft" && url.includes("/portal/")
              ? []
              : [detail.brief],
        };
      else {
        detail = {
          ...detail,
          brief: { ...detail.brief, ...body, id: body.id ?? id },
        };
        result = detail;
      }
    } else if (url.endsWith(`/briefs/${detail.brief.id}`)) {
      if (method === "PATCH")
        detail = {
          ...detail,
          brief: {
            ...detail.brief,
            form: body.form,
            clientAccountId: body.clientAccountId,
            version: detail.brief.version + 1,
          },
        };
      result = detail;
    } else throw new Error(`Unexpected request ${method} ${url}`);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const flush = async () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
  const mount = async (component: any, props: any = {}) => {
    await act(async () => {
      root.unmount();
    });
    root = createRoot(document.getElementById("root")!);
    await act(async () => root.render(React.createElement(component, props)));
    await flush();
  };
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.trim() === text,
    )!;
  const change = async (
    element: HTMLInputElement | HTMLSelectElement,
    value: string,
  ) =>
    act(async () => {
      element.value = value;
      Simulate.change(element);
    });
  try {
    await t.test(
      "using a template keeps stable field IDs and saving a draft does not mark answered",
      async () => {
        await mount(BriefsFoundationWorkspace);
        await act(async () => button("Usar").click());
        const title = document.querySelector<HTMLInputElement>(
          ".brief-foundation-form input",
        )!;
        assert.equal(title.value, form.title);
        const select = [
          ...document.querySelectorAll<HTMLSelectElement>("select"),
        ].find((s) => s.textContent?.includes("Selecione"))!;
        await change(select, client);
        await act(async () => {
          button("Salvar rascunho").click();
          button("Salvar rascunho").click();
        });
        await flush();
        const writes = calls.filter(
          (c) => c.method === "POST" && c.url.endsWith("/briefs"),
        );
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.form.fields[0].id, "name");
        assert.equal(writes[0].body.clientAccountId, client);
        assert.equal("answers" in writes[0].body, false);
        assert.equal("status" in writes[0].body, false);
        assert.match(document.body.textContent!, /Rascunho salvo no servidor/);
      },
    );
    await t.test(
      "send freezes the editor and offers history instead of editable answers",
      async () => {
        await act(async () => button("Revisar e enviar").click());
        assert.equal(calls.filter((c) => c.url.endsWith("/send")).length, 0);
        await act(async () => button("Confirmar envio").click());
        await flush();
        assert.match(
          document.body.textContent!,
          /Este formulário não pode ser alterado/,
        );
        assert.equal(
          document.querySelector(".brief-foundation-form input"),
          null,
        );
        assert.equal(button("Revisar e enviar"), undefined);
        assert.equal(calls.filter((c) => c.url.endsWith("/send")).length, 1);
      },
    );
    await t.test(
      "portal drafts persist, failed submit retries the same key and submitted answers stay consultable",
      async () => {
        await mount(PortalBriefsFoundation, {
          slug: "cliente",
          canRespond: true,
        });
        await act(async () =>
          [...document.querySelectorAll<HTMLButtonElement>("button")]
            .find((b) => b.textContent?.includes("Identidade visual"))!
            .click(),
        );
        await flush();
        await change(
          document.querySelector<HTMLInputElement>(
            'input[aria-label="Marca"]',
          )!,
          "Minha marca",
        );
        await act(async () => button("Salvar rascunho").click());
        await flush();
        assert.equal(detail.response.answers.name, "Minha marca");
        assert.equal(detail.response.status, "draft");
        failSubmit = true;
        await act(async () => button("Enviar resposta").click());
        await flush();
        assert.match(document.body.textContent!, /Falha temporária/);
        const failed = calls.at(-1)!;
        failSubmit = false;
        await act(async () => button("Enviar resposta").click());
        await flush();
        const submission = calls
          .filter((c) => c.url.endsWith("/submit"))
          .at(-1)!;
        assert.equal(
          submission.body.idempotencyKey,
          failed.body.idempotencyKey,
        );
        assert.equal(button("Enviar resposta"), undefined);
        assert.match(document.body.textContent!, /Minha marca/);
        assert.match(document.body.textContent!, /Revisão 1/);
      },
    );
    await t.test(
      "viewer consults response but never receives write controls",
      async () => {
        detail.brief.status = "reopened";
        detail.response.status = "draft";
        await mount(PortalBriefsFoundation, {
          slug: "cliente",
          canRespond: false,
        });
        await act(async () =>
          [...document.querySelectorAll<HTMLButtonElement>("button")]
            .find((b) => b.textContent?.includes("Identidade visual"))!
            .click(),
        );
        await flush();
        assert.equal(button("Enviar resposta"), undefined);
        assert.equal(button("Salvar rascunho"), undefined);
        assert.match(document.body.textContent!, /Minha marca/);
      },
    );
    await t.test(
      "received responses expose immutable revisions separately from the frozen form",
      async () => {
        await mount(BriefsFoundationWorkspace);
        await act(async () =>
          [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
            .find((b) => b.textContent?.startsWith("Respostas recebidas"))!
            .click(),
        );
        assert.match(document.body.textContent!, /Nova resposta/);
        await act(async () => button("Ler resposta").click());
        await flush();
        assert.match(document.body.textContent!, /Minha marca/);
        assert.match(document.body.textContent!, /Revisão 1/);
        assert.equal(document.querySelector(".brief-client-paper input"), null);
        assert.equal(button("Enviar resposta"), undefined);
      },
    );
    await t.test(
      "visual builder reorders and duplicates stable field IDs without mutating the source template",
      async () => {
        const { BriefFormEditor } = await server.ssrLoadModule(
          "/src/briefsDesign.tsx",
        );
        let edited = structuredClone(form);
        const Builder = () => {
          const [value, setValue] = React.useState(edited);
          return React.createElement(BriefFormEditor, {
            form: value,
            onChange: (next: any) => {
              edited = next;
              setValue(next);
            },
          });
        };
        await mount(Builder);
        await act(async () =>
          document
            .querySelector<HTMLButtonElement>(
              '[aria-label="Duplicar pergunta 1"]',
            )!
            .click(),
        );
        assert.equal(edited.fields.length, 2);
        assert.equal(edited.fields[0].id, "name");
        assert.notEqual(edited.fields[1].id, "name");
        const copyId = edited.fields[1].id;
        await act(async () =>
          document
            .querySelector<HTMLButtonElement>(
              '[aria-label="Mover pergunta 2 para cima"]',
            )!
            .click(),
        );
        assert.equal(edited.fields[0].id, copyId);
        assert.equal(edited.fields[1].id, "name");
        assert.equal(template.form.fields.length, 1);
        const before = calls.length;
        await act(async () => button("Prévia do cliente").click());
        await change(
          document.querySelector<HTMLInputElement>(
            'input[aria-label="Marca"]',
          )!,
          "Só para testar",
        );
        assert.equal(calls.length, before);
        assert.equal("answers" in edited, false);
        await act(async () => button("Editar").click());
        assert.equal(edited.fields[1].id, "name");
      },
    );
    await t.test(
      "mobile field properties open in a focusable drawer with accessible reorder controls",
      async () => {
        const { BriefFormEditor } = await server.ssrLoadModule(
          "/src/briefsDesign.tsx",
        );
        Object.defineProperty(window, "innerWidth", {
          value: 390,
          configurable: true,
        });
        await mount(BriefFormEditor, { form, onChange: () => {} });
        await act(async () =>
          document
            .querySelector<HTMLButtonElement>(
              '[aria-label="Editar pergunta 1: Marca"]',
            )!
            .click(),
        );
        assert.ok(document.querySelector('[role="dialog"]'));
        assert.ok(document.querySelector('[role="dialog"] input'));
        assert.equal(document.body.style.overflow, "hidden");
        await act(async () => button("Concluir").click());
        assert.equal(document.querySelector('[role="dialog"]'), null);
        assert.equal(document.body.style.overflow, "");
      },
    );
    await t.test(
      "multipart attachments preserve the response version header without JSON content type",
      async () => {
        const api = await server.ssrLoadModule("/src/api.ts");
        const base = await api.briefPortalBase("cliente");
        await api.uploadBriefAttachment(
          base,
          detail,
          "references",
          new File(["%PDF-1.4"], "ref.pdf", { type: "application/pdf" }),
        );
        const upload = calls.at(-1)!;
        assert.equal(
          upload.headers.get("x-brief-response-version"),
          String(detail.response.version),
        );
        assert.equal(upload.headers.has("content-type"), false);
        assert.ok(upload.body instanceof FormData);
      },
    );
  } finally {
    await act(async () => root.unmount());
    await server.close();
    Object.assign(globalThis, saved);
    dom.window.close();
  }
});
