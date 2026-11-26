import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { JSDOM } from "jsdom";
import {
  emptyProposalDocument,
  proposalTimelineStages,
} from "../src/proposalDocument";
import {
  proposalDocumentSchema,
  createProposalSchema,
  updateProposalSchema,
} from "../../api/src/modules/proposals/proposals.schemas";
import { acceptanceSelection } from "../../api/src/modules/proposals/proposal-documents.repository";

const stages = [
  {
    id: "77777777-7777-4777-8777-777777777777",
    title: "Discovery",
    description: "Brief and research\nCreative direction",
    value: "3",
    unit: "business" as const,
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    title: "Design",
    description: "Visual exploration",
    value: "7",
    unit: "calendar" as const,
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    title: "Delivery",
    description: "Final files",
    value: "2028-02-29",
    unit: "date" as const,
  },
];
const legacy = {
  ...emptyProposalDocument(),
  timelineTitle: "Project schedule",
  timelineValue: "10",
  timelineStart: "After deposit",
  timelineNotes: "Feedback required",
  approvalText: "Approved scope",
};
const proposal = {
  id: "timeline",
  token: "token",
  clientName: "Studio",
  email: "",
  locale: "English",
  proposalType: "Projeto",
  plan: "",
  pieces: 0,
  scope: "Design",
  investment: "",
  currency: "USD",
  expiresAt: "2099-01-01T00:00:00.000Z",
  status: "sent",
  services: [{ name: "Design", description: "", value: 500 }],
  revision: 1,
  document: legacy,
};

test("optional JSON stages preserve old documents and distinguish removal from legacy fallback", () => {
  const before = JSON.stringify(legacy);
  assert.deepEqual(proposalDocumentSchema.parse(legacy), legacy);
  assert.equal(proposalTimelineStages(legacy)[0].value, "10");
  assert.deepEqual(
    proposalTimelineStages({ ...legacy, timelineStages: [] }),
    [],
  );
  assert.deepEqual(proposalTimelineStages(null), []);
  assert.equal(JSON.stringify(legacy), before);
  const document = { ...legacy, timelineStages: stages };
  assert.deepEqual(
    createProposalSchema.parse({ ...proposal, document }).document,
    document,
  );
  assert.deepEqual(updateProposalSchema.parse({ document }).document, document);
  assert.deepEqual(updateProposalSchema.parse({}), {});
  assert.equal(
    acceptanceSelection({ ...proposal, document }, undefined, 1).value,
    500,
  );
  assert.deepEqual(
    acceptanceSelection({ ...proposal, document }, undefined, 1).snapshot
      .document,
    document,
  );
});

test("stage validation rejects invalid deadlines, duplicate IDs, unknown units and oversized lists", () => {
  for (const patch of [
    { value: "-1" },
    { value: "1.5" },
    { value: "tomorrow" },
    { unit: "weeks" },
    { id: "bad" },
    { title: "x".repeat(256) },
    { description: "x".repeat(50001) },
    { value: "2027-02-29", unit: "date" },
    { value: "2028-04-31", unit: "date" },
  ]) {
    const result = proposalDocumentSchema.safeParse({
      ...legacy,
      timelineStages: [{ ...stages[0], ...patch }],
    });
    assert.equal(result.success, false, JSON.stringify(patch).slice(0, 100));
  }
  assert.equal(
    proposalDocumentSchema.safeParse({
      ...legacy,
      timelineStages: [stages[0], stages[0]],
    }).success,
    false,
  );
  assert.equal(
    proposalDocumentSchema.safeParse({
      ...legacy,
      timelineStages: Array(101).fill(stages[0]),
    }).success,
    false,
  );
  assert.equal(
    proposalDocumentSchema.safeParse({ ...legacy, timelineStages: stages })
      .success,
    true,
  );
  assert.equal(
    proposalDocumentSchema.safeParse({
      ...legacy,
      timelineStages: [{ ...stages[0], title: "", value: "" }],
    }).success,
    true,
  );
});

test("public preview presents every stage in order, localized estimates and general conditions; legacy survives", async () => {
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { ProposalClientPreview } = await server.ssrLoadModule(
      "/src/proposalPresentation.tsx",
    );
    for (const [locale, days] of [
      ["English", "business days"],
      ["Português", "dias úteis"],
      ["Español", "días laborables"],
      ["Svenska", "arbetsdagar"],
      ["Italiano", "giorni lavorativi"],
    ]) {
      const current = {
        ...proposal,
        locale,
        document: { ...legacy, timelineStages: stages },
      };
      const before = JSON.stringify(current);
      const dom = new JSDOM(
        renderToStaticMarkup(<ProposalClientPreview proposal={current} />),
      );
      assert.deepEqual(
        [
          ...dom.window.document.querySelectorAll(
            ".proposal-timeline-stage-content h3",
          ),
        ].map((n) => n.textContent),
        ["Discovery", "Design", "Delivery"],
      );
      assert.ok(
        dom.window.document
          .querySelector(".proposal-timeline-value")!
          .textContent!.includes(days),
      );
      assert.ok(
        dom.window.document
          .querySelector(".proposal-timeline-general")!
          .textContent!.includes("After deposit"),
      );
      assert.ok(
        dom.window.document.body.textContent!.includes("Feedback required"),
      );
      assert.equal(JSON.stringify(current), before);
      dom.window.close();
    }
    for (const [document, count] of [
      [legacy, 1],
      [{ ...legacy, timelineStages: [] }, 0],
      [{ ...legacy, timelineValue: "", timelineStages: [] }, 0],
    ] as const) {
      const dom = new JSDOM(
        renderToStaticMarkup(
          <ProposalClientPreview proposal={{ ...proposal, document }} />,
        ),
      );
      assert.equal(
        dom.window.document.querySelectorAll(".proposal-timeline-stages > li")
          .length,
        count,
      );
      assert.ok(
        dom.window.document.body.textContent!.includes("After deposit"),
      );
      dom.window.close();
    }
    const dom = new JSDOM(
      renderToStaticMarkup(
        <ProposalClientPreview
          proposal={{
            ...proposal,
            document: {
              ...legacy,
              timelineStages: [
                {
                  ...stages[0],
                  title: "<script>bad</script>",
                  description: "<img src=x onerror=bad>",
                },
              ],
            },
          }}
        />,
      ),
    );
    assert.equal(
      dom.window.document.querySelectorAll("script,img[src=x]").length,
      0,
    );
    dom.window.close();
  } finally {
    await server.close();
  }
});
