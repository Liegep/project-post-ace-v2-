import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  formSchema,
  fieldSchema,
  validateAnswers,
  canonical,
  instanceUpdateSchema,
} from "./brief.schemas.js";
const field = (type: string, extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  type,
  label: "Pergunta",
  options: ["A", "B"],
  ...extra,
});
test("stable unique field IDs and form definitions validate server-side", () => {
  const a = field("short");
  assert.equal(
    fieldSchema.safeParse(field("short", { id: "__proto__" })).success,
    false,
  );
  assert.equal(
    formSchema.safeParse({ title: "Brief", fields: [a, a] }).success,
    false,
  );
  for (const type of [
    "short",
    "long",
    "choice",
    "checklist",
    "dropdown",
    "number",
    "date",
    "link",
    "scale",
    "file",
  ])
    assert.ok(fieldSchema.safeParse(field(type)).success, type);
  assert.equal(
    fieldSchema.safeParse(field("choice", { options: ["A", "A"] })).success,
    false,
  );
  assert.equal(
    fieldSchema.safeParse(field("number", { validation: { min: 4, max: 2 } }))
      .success,
    false,
  );
  assert.equal(
    fieldSchema.safeParse(field("scale", { validation: { min: 1.5 } })).success,
    false,
  );
  assert.equal(
    formSchema.safeParse({
      title: "Brief",
      fields: [field("short", { label: " " })],
    }).success,
    false,
  );
});
test("drafts permit missing required answers; submissions enforce required fields", () => {
  const f = formSchema.parse({
    title: "Brief",
    fields: [field("short", { id: "question", required: true })],
  });
  validateAnswers(f, {}, false);
  assert.throws(() => validateAnswers(f, {}, true), { statusCode: 400 });
  assert.throws(() => validateAnswers(f, { question: "   " }, true), {
    statusCode: 400,
  });
  validateAnswers(f, { question: "Resposta" }, true);
  assert.throws(() => validateAnswers(f, { unknown: "Resposta" }, false), {
    statusCode: 400,
  });
});
test("all field types reject invalid values and support real values", () => {
  const cases: [string, unknown, unknown, Record<string, unknown>?][] = [
    ["short", "Texto", 4],
    ["long", "Texto longo", {}],
    ["choice", "A", "C"],
    ["checklist", ["A"], ["C"]],
    ["dropdown", "B", ["B"]],
    ["number", 3, "3", { min: 1, max: 5 }],
    ["date", "2028-02-29", "2026-02-29"],
    ["link", "https://example.com", "javascript:alert(1)"],
    ["scale", 4, 4.5],
    ["file", [randomUUID()], ["https://example.com"]],
  ];
  for (const [type, valid, invalid, validation] of cases) {
    const f = formSchema.parse({
      title: "Brief",
      fields: [field(type, { id: "question", validation: validation ?? {} })],
    });
    validateAnswers(f, { question: valid }, true);
    assert.throws(() => validateAnswers(f, { question: invalid }, false), {
      statusCode: 400,
    });
  }
  const fileForm = formSchema.parse({
    title: "Brief",
    fields: [field("file", { id: "upload" })],
  });
  assert.throws(() => validateAnswers(fileForm, { upload: "" }, false), {
    statusCode: 400,
  });
  const f = formSchema.parse({
    title: "Brief",
    fields: [field("checklist", { id: "question" })],
  });
  assert.throws(() => validateAnswers(f, { question: ["A", "A"] }, true), {
    statusCode: 400,
  });
});
test("mutable instance input cannot change status, source version or submission metadata", () => {
  assert.equal(
    instanceUpdateSchema.safeParse({
      clientAccountId: null,
      form: { title: "Brief" },
      expectedVersion: 1,
      status: "answered",
    }).success,
    false,
  );
});
test("canonical idempotency hashing ignores object key ordering", () => {
  assert.equal(
    canonical({ b: { z: 1, a: 2 }, a: [2, 1] }),
    canonical({ a: [2, 1], b: { a: 2, z: 1 } }),
  );
  assert.notEqual(canonical({ a: [2, 1] }), canonical({ a: [1, 2] }));
});
