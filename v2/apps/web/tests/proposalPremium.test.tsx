import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { JSDOM } from "jsdom";
import {
  acceptanceSelection,
  documentData,
  requireDocumentStorage,
} from "../../api/src/modules/proposals/proposal-documents.repository";
import {
  proposalDocumentSchema,
  updateProposalSchema,
} from "../../api/src/modules/proposals/proposals.schemas";
import { emptyProposalDocument } from "../src/proposalDocument";
const options = [
  {
    id: "31a948a4-61be-45a1-9a01-34e98cb7be2b",
    name: "Design Only",
    description: "Editorial design",
    items: ["Eight pages", "Two revisions"],
    value: 450,
    recommended: false,
  },
  {
    id: "88a948a4-61be-45a1-9a01-34e98cb7be2b",
    name: "Design + Copywriting",
    description: "Complete editorial project",
    items: ["Eight pages", "Copywriting"],
    value: 700,
    recommended: true,
  },
];
const document = {
  ...emptyProposalDocument(),
  title: "Your next chapter",
  summary: "A considered editorial experience.",
  mode: "alternatives" as const,
  options,
  deliverables: [{ name: "Print-ready PDF", description: "High resolution" }],
  timelineValue: "10",
  timelineStart: "After receipt of content and deposit.",
  paymentTerms: "50% upfront",
  terms: "Two revision rounds.",
  approvalText: "I approve the selected scope and terms.",
};
const proposal = {
  id: "proposal",
  token: "token",
  clientName: "Acme Studio",
  email: "",
  locale: "English",
  proposalType: "Projeto",
  plan: "",
  pieces: 8,
  scope: "Design an eight-page brochure.",
  investment: "",
  currency: "USD",
  expiresAt: "2099-12-31T23:59:59.000Z",
  status: "sent",
  services: [{ name: "Legacy value preserved", description: "", value: 999 }],
  document,
  revision: 3,
};
test("alternatives never sum; approval validates membership, revision, state, expiry and amount", () => {
  const accepted = acceptanceSelection(proposal, options[1].id, 3);
  assert.equal(accepted.value, 700);
  assert.equal(accepted.currency, "USD");
  assert.equal(accepted.revision, 3);
  assert.deepEqual(accepted.snapshot.document, document);
  for (const [p, id, revision] of [
    [proposal, undefined, 3],
    [proposal, "other-proposal-option", 3],
    [proposal, options[0].id, 2],
    [{ ...proposal, status: "accepted" }, options[0].id, 3],
    [{ ...proposal, status: "refused" }, options[0].id, 3],
    [{ ...proposal, status: "draft" }, options[0].id, 3],
    [{ ...proposal, expiresAt: "2000-01-01" }, options[0].id, 3],
  ] as const)
    assert.throws(() => acceptanceSelection(p, id, revision));
  const legacy = { ...proposal, document: undefined, revision: undefined };
  assert.equal(acceptanceSelection(legacy).value, 999);
  assert.throws(() => acceptanceSelection(legacy, options[0].id));
});
test("schema preserves omitted PATCH fields; validates option count, IDs and financial inputs", () => {
  assert.deepEqual(updateProposalSchema.parse({}), {});
  assert.equal(proposalDocumentSchema.parse(document).options[1].value, 700);
  for (const doc of [
    { ...document, options: [options[0]] },
    { ...document, options: [options[0], options[0]] },
    { ...document, deposit: 101 },
    { ...document, options: [options[0], { ...options[1], value: -1 }] },
    { ...document, timelineValue: "tomorrow" },
  ])
    assert.equal(proposalDocumentSchema.safeParse(doc).success, false);
});
test("legacy reads survive an unapplied migration; new saves fail clearly", async () => {
  const db: any = {
    query: async () => {
      throw Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
    },
  };
  assert.deepEqual(await documentData(db, "id"), {});
  await assert.rejects(requireDocumentStorage(db), /estrutura/);
});
test("public document and editor support premium data in all currencies and languages", async () => {
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { ProposalClientPreview } = await server.ssrLoadModule(
      "/src/proposalPresentation.tsx",
    );
    const { ProposalPremiumEditor } = await server.ssrLoadModule(
      "/src/ProposalPremiumEditor.tsx",
    );
    for (const locale of [
      "Português",
      "English",
      "Español",
      "Italiano",
      "Svenska",
    ])
      for (const currency of ["BRL", "USD", "EUR", "SEK"]) {
        const html = renderToStaticMarkup(
          <ProposalClientPreview
            proposal={{ ...proposal, locale, currency }}
          />,
        );
        const dom = new JSDOM(html);
        const text = dom.window.document.body.textContent!;
        assert.equal(
          dom.window.document.querySelectorAll(".proposal-option-card").length,
          2,
        );
        assert.ok(
          !dom.window.document.querySelector(
            ".proposal-document-investment-amount",
          ),
        );
        assert.ok(text.includes("Design Only"));
        assert.ok(!text.includes("999"));
        assert.ok(!text.includes("1,150"));
        assert.ok(!text.includes("1.150"));
        assert.ok(!text.includes("Optional Add-ons"));
        if (locale === "English") {
          assert.ok(!text.includes("Projeto"));
          assert.ok(!text.includes("Personalizado"));
          assert.ok(text.includes("Project Summary"));
        }
        dom.window.close();
      }
    const selected = new JSDOM(
      renderToStaticMarkup(
        <ProposalClientPreview
          proposal={proposal}
          selectedOptionId={options[0].id}
        />,
      ),
    );
    assert.match(
      selected.window.document.querySelector(
        ".proposal-document-investment-amount",
      )!.textContent!,
      /450/,
    );
    selected.window.close();
    const editor = new JSDOM(
      renderToStaticMarkup(
        <ProposalPremiumEditor draft={proposal} update={() => {}} />,
      ),
    );
    assert.equal(editor.window.document.querySelectorAll("details").length, 8);
    assert.equal(
      editor.window.document.querySelectorAll('select option[value="USD"]')
        .length,
      1,
    );
    editor.window.close();
  } finally {
    await server.close();
  }
});
test("transactional acceptance stores a snapshot once and serializes competing decisions", async () => {
  const { decideProposal, updateProposal } =
    await import("../../api/src/modules/proposals/proposals.repository");
  const row: any = {
    id: "proposal",
    token: "token",
    client_name: "Acme Studio",
    client_email: "",
    locale: "English",
    proposal_type: "Projeto",
    plan: "",
    pieces_quantity: 8,
    scope_description: "Original scope",
    investment_description: "Terms",
    currency: "USD",
    expires_at: proposal.expiresAt,
    status: "sent",
    services_json: JSON.stringify(proposal.services),
  };
  let acceptance: any = null,
    lock = Promise.resolve(),
    commits = 0,
    rollbacks = 0;
  const query = async (sql: string, values: any[] = []) => {
    if (sql.startsWith("SELECT document_json"))
      return [
        [{ document_json: document, revision: 3, acceptance_json: acceptance }],
      ];
    if (sql.startsWith("SELECT") && sql.includes("FROM proposals"))
      return [[{ ...row }]];
    if (sql.startsWith("INSERT INTO proposal_documents")) {
      acceptance = JSON.parse(values[3]);
      return [{}];
    }
    if (sql.startsWith("UPDATE proposals SET status=")) {
      row.status = values[0];
      return [{}];
    }
    return [[]];
  };
  const db: any = {
    query,
    getConnection: async () => {
      let release: () => void = () => {};
      return {
        query: async (sql: string, values: any[]) => {
          if (sql.includes("FOR UPDATE")) {
            const previous = lock;
            lock = new Promise<void>((resolve) => {
              release = resolve;
            });
            await previous;
          }
          return query(sql, values);
        },
        beginTransaction: async () => {},
        commit: async () => {
          commits++;
          release();
        },
        rollback: async () => {
          rollbacks++;
          release();
        },
        release: () => {},
      };
    },
  };
  const results = await Promise.allSettled([
    decideProposal(db, "token", "accepted", options[0].id, 3),
    decideProposal(db, "token", "accepted", options[1].id, 3),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(commits, 1);
  assert.equal(rollbacks, 1);
  assert.equal(acceptance.value, 450);
  assert.equal(acceptance.snapshot.scope, "Original scope");
  assert.equal(acceptance.optionId, options[0].id);
  await assert.rejects(
    updateProposal(db, "proposal", { scope: "Changed" }),
    /imutáveis/,
  );
  assert.equal(acceptance.snapshot.scope, "Original scope");
});
test("public approval requires an option and sends its ID and revision once", async () => {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { MemoryRouter, Routes, Route } = await import("react-router-dom");
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage,
    CustomEvent: globalThis.CustomEvent,
  };
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    server: { middlewareMode: true, hmr: false },
  });
  const root = createRoot(globalThis.document.getElementById("root")!);
  const decisions: any[] = [];
  globalThis.fetch = async (_url, init) => {
    if (!init?.method || init.method === "GET")
      return new Response(JSON.stringify({ proposal }));
    const body = JSON.parse(String(init.body));
    decisions.push(body);
    return new Response(
      JSON.stringify({
        proposal: {
          ...proposal,
          status: "accepted",
          acceptance: {
            optionId: body.optionId,
            value: 700,
            currency: "USD",
            revision: 3,
          },
        },
      }),
    );
  };
  try {
    const { PublicPremiumProposalPage } = await server.ssrLoadModule(
      "/src/PublicPremiumProposalPage.tsx",
    );
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/proposal/token"]}>
          <Routes>
            <Route
              path="/proposal/:token"
              element={<PublicPremiumProposalPage brandLogo="" />}
            />
          </Routes>
        </MemoryRouter>,
      );
      await new Promise((r) => setTimeout(r, 20));
    });
    const accept = [
      ...globalThis.document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent === "Accept proposal")!;
    assert.equal(accept.disabled, true);
    await act(async () => {
      globalThis.document
        .querySelectorAll<HTMLInputElement>("input[type=radio]")[1]
        .click();
    });
    assert.equal(accept.disabled, false);
    await act(async () => {
      accept.click();
      accept.click();
      await new Promise((r) => setTimeout(r, 10));
    });
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].optionId, options[1].id);
    assert.equal(decisions[0].revision, 3);
    assert.ok(
      globalThis.document.body.textContent!.includes("Proposal accepted"),
    );
    assert.match(
      globalThis.document.querySelector(".proposal-document-investment-amount")!
        .textContent!,
      /700/,
    );
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();
    Object.assign(globalThis, previous);
  }
});
test("all premium fields persist through create, update and reload without changing legacy amounts", async () => {
  const { createProposal, updateProposal, findProposal } =
    await import("../../api/src/modules/proposals/proposals.repository");
  const { createProposalSchema } =
    await import("../../api/src/modules/proposals/proposals.schemas");
  let row: any,
    stored: any,
    revision = 0;
  const db: any = {
    getConnection: async () => db,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql: string, values: any[] = []) => {
      if (sql.startsWith("INSERT INTO proposals")) {
        row = {
          id: values[0],
          token: values[1],
          client_name: values[2],
          client_email: values[3],
          locale: values[4],
          proposal_type: values[5],
          plan: values[6],
          pieces_quantity: values[7],
          scope_description: values[8],
          investment_description: values[9],
          currency: values[10],
          expires_at: values[11],
          status: values[12],
          services_json: values[13],
        };
        return [{}];
      }
      if (sql.startsWith("INSERT INTO proposal_documents")) {
        stored = JSON.parse(values[1]);
        revision++;
        return [{}];
      }
      if (sql.startsWith("SELECT document_json"))
        return [
          stored
            ? [{ document_json: stored, revision, acceptance_json: null }]
            : [],
        ];
      if (sql.includes("FROM proposals")) return [[row]];
      return [[]];
    },
  };
  const fullDocument = {
    ...document,
    addons: [
      { name: "Extra page", description: "Quoted separately", value: 100 },
    ],
    deposit: 50,
    balance: "Before delivery",
    paymentMethods: "Bank transfer",
    financialNotes: "No automatic currency conversion",
    objectives: "A clear story",
    included: "Design\nTypography",
    excluded: "Printing",
    clientMaterials: "Final images",
    timelineNotes: "Subject to feedback",
    deliverablesTitle: "Final files",
    timelineTitle: "Schedule",
    scopeTitle: "The brief",
  };
  const saved = await createProposal(
    db,
    "admin",
    createProposalSchema.parse({ ...proposal, document: fullDocument }),
  );
  assert.deepEqual(saved!.document, fullDocument);
  assert.equal(saved!.revision, 1);
  assert.equal(saved!.services[0].value, 999);
  const changed = {
    ...fullDocument,
    title: "Updated title",
    options: [...options].reverse(),
  };
  await updateProposal(db, saved!.id, { document: changed, revision: 1 });
  const reopened = await findProposal(db, saved!.id);
  assert.deepEqual(reopened!.document, changed);
  assert.equal(reopened!.revision, 2);
  assert.equal(reopened!.currency, "USD");
  assert.equal(reopened!.services[0].value, 999);
  await assert.rejects(
    updateProposal(db, saved!.id, { document: fullDocument, revision: 1 }),
    /outra sessão/,
  );
  assert.deepEqual(stored, changed);
});
