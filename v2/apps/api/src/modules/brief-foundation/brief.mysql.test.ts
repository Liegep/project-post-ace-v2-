import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import sharp from "sharp";
import { uploadRoutes } from "../uploads/uploads.routes.js";
import { BriefRepository } from "./brief.repository.js";
import { briefFoundationRoutes } from "./brief.routes.js";
import { designBriefRoutes } from "../design-briefs/design-briefs.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import {
  formSchema,
  instanceSchema,
  templateSchema,
  templateUpdateSchema,
  type BriefForm,
} from "./brief.schemas.js";
const socket = process.env.BRIEF_TEST_SOCKET;
if (socket !== "/tmp/briefs-mariadb-foundation/server.sock")
  throw new Error(
    "Somente a instância temporária local de briefs é permitida. Nenhum .env ou host de produção é utilizado.",
  );
const actor = randomUUID(),
  client = randomUUID(),
  foreign = randomUUID(),
  respondent = randomUUID();
const migration = readFileSync(
  new URL(
    "../../../../../database/migrations/20261005_design_briefs_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const database = `brief_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
let pool: Pool, repo: BriefRepository, server: mysql.Connection;
const form = (changes: Partial<BriefForm> = {}) =>
  formSchema.parse({
    title: "Identidade visual",
    fields: [
      { id: "name", type: "short", label: "Marca", required: true },
      { id: "references", type: "file", label: "Referências" },
    ],
    ...changes,
  });
async function draft(f = form()) {
  return repo.createInstance(
    actor,
    instanceSchema.parse({
      id: randomUUID(),
      clientAccountId: client,
      form: f,
    }),
  );
}
async function sent(f = form()) {
  const result = await draft(f);
  return repo.transition(result.brief.id, actor, "send", result.brief.version);
}
const tableNames = [
  "design_brief_template_metadata",
  "design_brief_template_versions",
  "design_brief_instances",
  "design_brief_responses",
  "design_brief_response_revisions",
  "design_brief_attachments",
  "design_brief_events",
];
before(async () => {
  server = await mysql.createConnection({
    socketPath: socket,
    user: "root",
    multipleStatements: true,
    charset: "utf8mb4",
    timezone: "Z",
  });
  await server.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  pool = mysql.createPool({
    socketPath: socket,
    user: "root",
    database,
    multipleStatements: true,
    charset: "utf8mb4",
    timezone: "Z",
    connectionLimit: 8,
  });
  repo = new BriefRepository(pool);
  await pool.query(
    readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8"),
  );
  await pool.query(
    "INSERT INTO users(id,full_name,email,password_hash,global_role,locale) VALUES(?,'Equipe','team@invalid.test','unused','super_admin','pt'),(?,'Cliente','client@invalid.test','unused','cliente','pt')",
    [actor, respondent],
  );
  await pool.query(
    "INSERT INTO client_accounts(id,name,slug,portal_title,locale) VALUES(?,'Cliente A','a','Portal','pt'),(?,'Cliente B','b','Portal','pt')",
    [client, foreign],
  );
  await pool.query(
    "INSERT INTO design_briefs(id,title,introduction,fields_json,answers_json,status) VALUES(?,'Legado','Histórico','[]','{\"original\":\"preservado\"}','completed')",
    [randomUUID()],
  );
});
after(async () => {
  await pool?.end();
  if (server) {
    await server.query(`DROP DATABASE \`${database}\``);
    await server.end();
  }
});
test("migration creates seven additive tables and can be repeated without touching legacy", async () => {
  const [before] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM design_briefs",
  );
  await pool.query(migration);
  await pool.query(migration);
  const [after] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM design_briefs",
  );
  assert.deepEqual(after, before);
  const [tables] = await pool.query<RowDataPacket[]>(
    "SELECT TABLE_NAME,ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN (?)",
    [database, tableNames],
  );
  assert.equal(tables.length, 7);
  for (const t of tables) {
    assert.equal(t.ENGINE, "InnoDB");
    assert.equal(t.TABLE_COLLATION, "utf8mb4_unicode_ci");
  }
  const [fks] = await pool.query<RowDataPacket[]>(
    "SELECT DELETE_RULE,UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME IN (?)",
    [database, tableNames],
  );
  assert.equal(fks.length, 17);
  assert.ok(
    fks.every(
      (f) =>
        ["RESTRICT", "SET NULL"].includes(f.DELETE_RULE) &&
        f.UPDATE_RULE === "CASCADE",
    ),
  );
  const [version] = await pool.query<RowDataPacket[]>(
    "SELECT VERSION() AS version",
  );
  writeFileSync(
    "/tmp/briefs-mariadb-foundation/result.json",
    JSON.stringify(
      {
        version: version[0].version,
        tables: tables.map((t) => t.TABLE_NAME),
        foreignKeys: fks.length,
        legacyUnchanged: true,
      },
      null,
      2,
    ),
  );
});
test("template versions and instance snapshot freeze; editing template never changes sent brief", async () => {
  const t = await repo.saveTemplate(
    actor,
    templateSchema.parse({ id: randomUUID(), name: "Logotipo", form: form() }),
  );
  let b = await repo.createInstance(
    actor,
    instanceSchema.parse({
      id: randomUUID(),
      clientAccountId: client,
      templateId: t.id,
      templateVersion: t.version,
      form: t.form,
    }),
  );
  b = await repo.transition(b.brief.id, actor, "send", b.brief.version);
  const snapshot = JSON.stringify(b.brief.form);
  const edited = await repo.saveTemplate(
    actor,
    templateUpdateSchema.parse({
      name: "Novo modelo",
      description: "Atualizado",
      expectedVersion: 1,
      form: form({
        title: "Novo",
        fields: [{ ...form().fields[0], label: "Nova pergunta" }],
      }),
    }),
    t.id,
  );
  assert.equal(edited.version, 2);
  assert.equal(
    JSON.stringify((await repo.getDetail(b.brief.id)).brief.form),
    snapshot,
  );
  await assert.rejects(
    repo.updateInstance(b.brief.id, actor, {
      expectedVersion: b.brief.version,
      clientAccountId: foreign,
      form: form({ title: "Alterado" }),
    }),
    { statusCode: 409 },
  );
  await assert.rejects(
    repo.saveTemplate(
      actor,
      templateUpdateSchema.parse({
        name: "Stale",
        expectedVersion: 1,
        form: form(),
      }),
      t.id,
    ),
    { statusCode: 409 },
  );
  await repo.archiveTemplate(t.id, actor, edited.version);
  await assert.rejects(
    repo.createInstance(
      actor,
      instanceSchema.parse({
        id: randomUUID(),
        clientAccountId: client,
        templateId: t.id,
        templateVersion: 3,
        form: t.form,
      }),
    ),
    { statusCode: 409 },
  );
  assert.equal(
    JSON.stringify((await repo.getDetail(b.brief.id)).brief.form),
    snapshot,
  );
});
test("draft response, submit, reopen and second revision preserve original answers and identity", async () => {
  let b = await sent();
  const id = b.brief.id;
  b = await repo.saveResponse(
    id,
    client,
    respondent,
    { expectedVersion: 1, answers: {} },
    false,
  );
  assert.equal(b.response?.status, "draft");
  assert.equal(b.revisions.length, 0);
  b = await repo.saveResponse(
    id,
    client,
    respondent,
    {
      expectedVersion: b.response!.version,
      answers: { name: "Primeira resposta" },
      idempotencyKey: randomUUID(),
    },
    true,
  );
  assert.equal(b.brief.status, "answered");
  assert.equal(b.revisions[0].submittedByUserId, respondent);
  assert.equal(b.revisions.length, 1);
  const old = JSON.stringify(b.revisions[0]);
  await assert.rejects(
    repo.saveResponse(
      id,
      client,
      respondent,
      { expectedVersion: b.response!.version, answers: { name: "Overwrite" } },
      false,
    ),
    { statusCode: 409 },
  );
  b = await repo.transition(id, actor, "reopen", b.brief.version);
  b = await repo.saveResponse(
    id,
    client,
    respondent,
    {
      expectedVersion: b.response!.version,
      answers: { name: "Segunda resposta" },
      idempotencyKey: randomUUID(),
    },
    true,
  );
  assert.equal(b.revisions.length, 2);
  assert.equal(JSON.stringify(b.revisions[1]), old);
  assert.equal(b.revisions[0].revision, 2);
  b = await repo.transition(id, actor, "archive", b.brief.version);
  assert.equal(b.brief.status, "archived");
  assert.equal(b.revisions.length, 2);
  assert.equal((await repo.getDetail(id, client)).revisions.length, 2);
  await assert.rejects(
    pool.query("DELETE FROM design_brief_instances WHERE id=?", [id]),
  );
});
test("draft concurrency, duplicate creation and submit retries are safe", async () => {
  const input = instanceSchema.parse({
    id: randomUUID(),
    clientAccountId: client,
    form: form(),
  });
  const [a, again] = await Promise.all([
    repo.createInstance(actor, input),
    repo.createInstance(actor, input),
  ]);
  assert.equal(a.brief.id, again.brief.id);
  const racing = await draft();
  const simultaneous = await Promise.allSettled([
    repo.transition(racing.brief.id, actor, "send", 1),
    repo.updateInstance(racing.brief.id, actor, {
      expectedVersion: 1,
      clientAccountId: client,
      form: form({ title: "Concurrent draft" }),
    }),
  ]);
  assert.equal(simultaneous.filter((r) => r.status === "fulfilled").length, 1);
  const raced = await repo.getDetail(racing.brief.id);
  if (raced.brief.status === "sent")
    assert.equal(raced.brief.form.title, "Identidade visual");
  else {
    assert.equal(raced.brief.form.title, "Concurrent draft");
    await repo.transition(raced.brief.id, actor, "send", raced.brief.version);
  }
  let b = await repo.transition(a.brief.id, actor, "send", a.brief.version);
  const writes = await Promise.allSettled([
    repo.saveResponse(
      b.brief.id,
      client,
      respondent,
      { expectedVersion: 1, answers: { name: "A" } },
      false,
    ),
    repo.saveResponse(
      b.brief.id,
      client,
      respondent,
      { expectedVersion: 1, answers: { name: "B" } },
      false,
    ),
  ]);
  assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
  b = await repo.getDetail(b.brief.id);
  const inputSubmit = {
    expectedVersion: b.response!.version,
    answers: { name: "Final" },
    idempotencyKey: randomUUID(),
  };
  const retries = await Promise.all([
    repo.saveResponse(b.brief.id, client, respondent, inputSubmit, true),
    repo.saveResponse(b.brief.id, client, respondent, inputSubmit, true),
  ]);
  assert.equal(retries[0].revisions.length, 1);
  assert.equal(retries[1].revisions.length, 1);
  await assert.rejects(
    repo.saveResponse(
      b.brief.id,
      client,
      respondent,
      { ...inputSubmit, answers: { name: "Changed" } },
      true,
    ),
    { statusCode: 409 },
  );
});
test("files belong to their response and field, preserve revisions and resist foreign access", async () => {
  let a = await sent(),
    b = await sent();
  const file = {
    id: randomUUID(),
    name: "Referência.pdf",
    key: `${randomUUID()}.pdf`,
    type: "application/pdf",
    size: 123,
  };
  a = await repo.attach(a.brief.id, client, respondent, "references", file, 1);
  assert.deepEqual(a.response!.answers.references, [file.id]);
  await assert.rejects(
    repo.attach(
      a.brief.id,
      client,
      respondent,
      "name",
      { ...file, id: randomUUID(), key: randomUUID() + ".pdf" },
      a.response!.version,
    ),
    { statusCode: 400 },
  );
  await assert.rejects(
    repo.saveResponse(
      b.brief.id,
      client,
      respondent,
      { expectedVersion: 1, answers: { name: "A", references: [file.id] } },
      false,
    ),
    { statusCode: 400 },
  );
  await assert.rejects(repo.getAttachment(a.brief.id, file.id, foreign), {
    statusCode: 404,
  });
  a = await repo.saveResponse(
    a.brief.id,
    client,
    respondent,
    {
      expectedVersion: a.response!.version,
      answers: { name: "A", references: [file.id] },
      idempotencyKey: randomUUID(),
    },
    true,
  );
  assert.deepEqual(a.revisions[0].answers.references, [file.id]);
  assert.equal(
    (await repo.getAttachment(a.brief.id, file.id, client)).original_name,
    file.name,
  );
});
test("portal endpoints isolate clients, reject viewers, validate answers and allow independent brief upload", async () => {
  let b = await sent();
  const app = Fastify();
  app.decorate("db", pool);
  app.decorate("appEnv", {
    UPLOAD_DIR: "/tmp/briefs-mariadb-foundation/uploads",
  } as any);
  await app.register(httpErrorsPluginRegistered);
  let auth: any = {
    user: { id: respondent, globalRole: "cliente" },
    memberships: [
      {
        clientAccountId: client,
        membershipRole: "cliente",
        portalAccessLevel: "approver",
      },
    ],
  };
  app.addHook("onRequest", async (request) => {
    request.auth = auth;
  });
  await app.register(briefFoundationRoutes);
  await app.register(designBriefRoutes);
  await app.register(uploadRoutes);
  const base = `/portal/accounts/${client}/briefs/${b.brief.id}`;
  try {
    assert.equal((await app.inject({ url: base })).statusCode, 200);
    assert.equal(
      (
        await app.inject({
          url: `/portal/accounts/${foreign}/briefs/${b.brief.id}`,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: base + "/submit",
          payload: {
            expectedVersion: 1,
            answers: {},
            idempotencyKey: randomUUID(),
          },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: base + "/response",
          payload: { expectedVersion: "wrong", answers: {} },
        })
      ).statusCode,
      400,
    );
    auth.memberships[0].portalAccessLevel = "viewer";
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: base + "/response",
          payload: { expectedVersion: 1, answers: { name: "A" } },
        })
      ).statusCode,
      403,
    );
    auth.memberships[0].portalAccessLevel = "approver";
    const boundary = "testboundary",
      body = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Ref.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n%%EOF\r\n--${boundary}--\r\n`,
      );
    const upload = await app.inject({
      method: "POST",
      url: base + "/fields/references/attachments",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "x-brief-response-version": "1",
      },
      payload: body,
    });
    assert.equal(upload.statusCode, 200, upload.body);
    const attachment = upload.json().attachments[0];
    assert.ok(attachment.id);
    const download = await app.inject({
      url: base + "/attachments/" + attachment.id,
    });
    assert.equal(download.statusCode, 200);
    assert.equal(download.headers["cache-control"], "private, no-store");
    const stored = await repo.getAttachment(b.brief.id, attachment.id, client);
    assert.equal(
      (await app.inject({ url: "/uploads/" + stored.storage_key })).statusCode,
      404,
    );
    const foreignBrief = await draft();
    await pool.query(
      "UPDATE design_brief_instances SET client_account_id=? WHERE id=?",
      [foreign, foreignBrief.brief.id],
    );
    await repo.transition(foreignBrief.brief.id, actor, "send", 1);
    assert.equal(
      (
        await app.inject({
          url: `/portal/accounts/${client}/briefs/${foreignBrief.brief.id}`,
        })
      ).statusCode,
      404,
    );
    const png = await sharp({
      create: { width: 1, height: 1, channels: 4, background: "#fff" },
    })
      .png()
      .toBuffer();
    const imageBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Imagem.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const imageUpload = await app.inject({
      method: "POST",
      url: base + "/fields/references/attachments",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "x-brief-response-version": "2",
      },
      payload: imageBody,
    });
    assert.equal(imageUpload.statusCode, 200, imageUpload.body);
    const image = imageUpload
      .json()
      .attachments.find((a: any) => a.name === "Imagem.png");
    const imageDownload = await app.inject({
      url: base + "/attachments/" + image.id,
    });
    assert.deepEqual(imageDownload.rawPayload, png);
    const revisionVersion = imageUpload.json().response.version;
    await repo.saveResponse(
      b.brief.id,
      client,
      respondent,
      {
        expectedVersion: revisionVersion,
        answers: { name: "Final", references: [image.id] },
        idempotencyKey: randomUUID(),
      },
      true,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: base + "/fields/references/attachments",
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
            "x-brief-response-version": String(revisionVersion + 1),
          },
          payload: body,
        })
      ).statusCode,
      409,
    );
    assert.equal((await app.inject({ url: "/briefs" })).statusCode, 403);
    auth = null;
    assert.equal((await app.inject({ url: base })).statusCode, 401);
    const old = (
      await pool.query<RowDataPacket[]>("SELECT id FROM design_briefs")
    )[0][0].id;
    auth = { user: { id: actor, globalRole: "super_admin" }, memberships: [] };
    assert.equal(
      (await app.inject({ method: "DELETE", url: `/design-briefs/${old}` }))
        .statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/design-briefs/${old}`,
          payload: { answers: {} },
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});
