import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import { ZodError } from "zod";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { ensureClientFeedbackEventsTable } from "../clients/client-feedback.service.js";
import { ensureProposalTables } from "./proposals.repository.js";
import { proposalRoutes } from "./proposals.routes.js";
const socketPath = process.env.PROPOSAL_TEST_SOCKET;
if (
  !socketPath ||
  !/^\/(?:private\/)?tmp\/proposal-mariadb-[^/]+\/server\.sock$/.test(
    socketPath,
  )
)
  throw Error(
    "Use somente PROPOSAL_TEST_SOCKET=/tmp/proposal-mariadb-*/server.sock; sem fallback para banco da aplicação.",
  );
const migration = readFileSync(
  new URL(
    "../../../../../database/migration-proposals/20261105_proposal_documents.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("../../../db/schema.sql", import.meta.url),
  "utf8",
);
const productionMode = "NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION";
const strictMode =
  "STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION";
let server: mysql.Connection;
const evidence: any = {
  migrationSha256: createHash("sha256").update(migration).digest("hex"),
  productionAccessed: false,
  syntheticDataOnly: true,
  modes: [productionMode, strictMode],
  passed: [],
};
before(async () => {
  server = await mysql.createConnection({
    socketPath,
    user: "root",
    multipleStatements: true,
    timezone: "Z",
  });
  const [rows] = await server.query<RowDataPacket[]>(
    "SELECT VERSION() version,@@version_comment versionComment,@@collation_server collationName,@@character_set_server charsetName,@@default_storage_engine engine,@@lower_case_table_names lowerCaseTableNames,@@time_zone timeZone,@@foreign_key_checks foreignKeys,@@check_constraint_checks jsonChecks,@@skip_networking skipNetworking",
  );
  evidence.server = rows[0];
  assert.match(rows[0].version, /^11\.8\.9-MariaDB/);
  assert.equal(rows[0].skipNetworking, 1);
});
after(async () => {
  await server?.end();
  if (process.env.PROPOSAL_TEST_REPORT)
    writeFileSync(
      process.env.PROPOSAL_TEST_REPORT,
      JSON.stringify(evidence, null, 2) + "\n",
    );
});
const document = () => ({
  title: "Editorial proposal",
  summary: "A synthetic project",
  scopeTitle: "Scope",
  objectives: "Clarity",
  included: "Eight pages\nTwo revisions",
  excluded: "Printing",
  mode: "alternatives",
  options: [
    {
      id: randomUUID(),
      name: "Design Only",
      description: "Design",
      items: ["Eight pages"],
      value: 450,
      recommended: false,
    },
    {
      id: randomUUID(),
      name: "Design + Copywriting",
      description: "Complete",
      items: ["Eight pages", "Copy"],
      value: 700,
      recommended: true,
    },
  ],
  deliverablesTitle: "Files",
  deliverables: [{ name: "Print PDF", description: "High resolution" }],
  timelineTitle: "Schedule",
  timelineValue: "10",
  timelineUnit: "business",
  timelineStart: "After deposit",
  timelineNotes: "Subject to feedback",
  addons: [
    { name: "Extra page", description: "Separate agreement", value: 100 },
  ],
  paymentTerms: "50% upfront",
  deposit: 50,
  balance: "Before delivery",
  paymentMethods: "Transfer",
  financialNotes: "No conversion",
  revisions: 2,
  terms: "Two revisions included.",
  clientMaterials: "Client provides images",
  approvalText: "I approve these terms.",
});
const input = (changes: Record<string, unknown> = {}) => ({
  clientName: "Synthetic Client",
  email: "synthetic@example.invalid",
  locale: "English",
  proposalType: "Editorial",
  plan: "",
  pieces: 8,
  scope: "Original scope",
  investment: "Original payment terms",
  currency: "USD",
  expiresAt: "2099-12-31T23:59:59.000Z",
  status: "draft",
  services: [
    { name: "Original service", description: "Preserve this", value: 123.45 },
  ],
  ...changes,
});
async function fixture(apply = true, mode = productionMode) {
  const name = "proposal_test_" + randomUUID().replace(/-/g, "");
  await server.query(
    `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  const pool = mysql.createPool({
    socketPath,
    user: "root",
    database: name,
    timezone: "Z",
    charset: "utf8mb4",
    multipleStatements: true,
    connectionLimit: 10,
  });
  pool.on("connection", (connection) => {
    connection.query("SET SESSION sql_mode=?", [mode]);
    connection.query("SET SESSION time_zone='+00:00'");
  });
  const app = Fastify();
  const userId = randomUUID();
  const rows = async (sql: string, params: unknown[] = []) =>
    (await pool.query<RowDataPacket[]>(sql, params))[0];
  const close = async () => {
    await app.close();
    await pool.end();
    await server.query(`DROP DATABASE \`${name}\``);
  };
  try {
    const session = await rows("SELECT @@sql_mode AS configuredMode");
    assert.deepEqual(String(session[0].configuredMode).split(",").sort(), mode.split(",").sort());
    for (const table of ["users", "client_accounts"])
      await pool.query(
        schema.match(
          new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?;`),
        )![0],
      );
    await pool.query(
      "INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES(?,'Synthetic admin','admin@example.invalid','unused','super_admin')",
      [userId],
    );
    await ensureProposalTables(pool);
    await ensureClientFeedbackEventsTable(pool);
    const legacyId = randomUUID(),
      historicalId = randomUUID();
    for (const [id, status] of [
      [legacyId, "sent"],
      [historicalId, "accepted"],
    ])
      await pool.query(
        "INSERT INTO proposals(id,token,client_name,locale,proposal_type,plan,pieces_quantity,scope_description,investment_description,currency,expires_at,status,services_json,created_by_user_id) VALUES(?,?,'Legacy client','English','Projeto','Old plan',8,'Original scope','Original terms','R$','2099-12-31 23:59:59',?,?,?)",
        [
          id,
          id,
          status,
          JSON.stringify([
            { name: "Legacy", description: "Keep", value: 250.25 },
          ]),
          userId,
        ],
      );
    if (apply) await pool.query(migration);
    app.decorate("db", pool);
    app.decorateRequest("auth", null);
    await app.register(httpErrorsPluginRegistered);
    app.addHook("preHandler", async (request) => {
      if (request.headers["x-test-role"])
        request.auth = {
          user: { id: userId, globalRole: request.headers["x-test-role"] },
          memberships: [],
        } as any;
    });
    app.setErrorHandler((error, request, reply) => {
      reply
        .code(
          error instanceof ZodError ? 400 : ((error as any).statusCode ?? 500),
        )
        .send({ message: error instanceof Error ? error.message : String(error) });
    });
    await app.register(proposalRoutes, { prefix: "/api" });
    await app.ready();
    const admin = (method: any, url: string, payload?: any) =>
      app.inject({
        method,
        url,
        headers: { "x-test-role": "super_admin" },
        ...(payload === undefined ? {} : { payload }),
      });
    const publicGet = (token: string) =>
      app.inject({ method: "GET", url: `/api/public/proposals/${token}` });
    const decide = (token: string, payload: any) =>
      app.inject({
        method: "POST",
        url: `/api/public/proposals/${token}/decision`,
        payload,
      });
    return {
      pool,
      rows,
      app,
      admin,
      publicGet,
      decide,
      close,
      legacyId,
      historicalId,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
const ok = (response: any) => {
  assert.equal(response.statusCode, 200, response.body);
  return response.json().proposal;
};
const pass = (name: string) => evidence.passed.push(name);
test("DDL in production and strict modes: historical bytes and table definitions unchanged; JSON/FK/PK enforced", async () => {
  for (const mode of [productionMode, strictMode]) {
    const f = await fixture(false, mode);
    try {
      const original = await f.rows("SELECT * FROM proposals ORDER BY id");
      const definition = await f.rows("SHOW CREATE TABLE proposals");
      await f.pool.query(migration);
      assert.deepEqual(
        await f.rows("SELECT * FROM proposals ORDER BY id"),
        original,
      );
      assert.deepEqual(await f.rows("SHOW CREATE TABLE proposals"), definition);
      const ddl = await f.rows("SHOW CREATE TABLE proposal_documents");
      assert.match(ddl[0]["Create Table"], /InnoDB/);
      assert.match(ddl[0]["Create Table"], /utf8mb4_unicode_ci/);
      assert.match(ddl[0]["Create Table"], /json_valid/i);
      await assert.rejects(
        f.pool.query(
          "INSERT INTO proposal_documents(proposal_id,document_json) VALUES(?,?)",
          [randomUUID(), "{}"],
        ),
        /foreign key/i,
      );
      await assert.rejects(
        f.pool.query(
          "INSERT INTO proposal_documents(proposal_id,document_json) VALUES(?,?)",
          [f.legacyId, "not json"],
        ),
        /CONSTRAINT/i,
      );
      await f.pool.query(
        "INSERT INTO proposal_documents(proposal_id,document_json) VALUES(?,?)",
        [f.legacyId, JSON.stringify(document())],
      );
      await assert.rejects(
        f.pool.query(
          "INSERT INTO proposal_documents(proposal_id,document_json) VALUES(?,?)",
          [f.legacyId, "{}"],
        ),
        /Duplicate entry/,
      );
      await assert.rejects(f.pool.query(migration), /already exists/);
      assert.deepEqual(
        await f.rows("SELECT * FROM proposals ORDER BY id"),
        original,
      );
    } finally {
      await f.close();
    }
  }
  pass(
    "DDL both modes; legacy rows/schema unchanged; FK/JSON/PK; repeat safely fails without changes",
  );
});
test("unapplied migration: legacy creation/edit/read work; premium writes and acceptance fail without partial state", async () => {
  const f = await fixture(false);
  try {
    const legacy = ok(await f.admin("POST", "/api/proposals", input()));
    ok(
      await f.admin("PATCH", `/api/proposals/${legacy.id}`, {
        scope: "Edited",
      }),
    );
    const before = (await f.rows("SELECT COUNT(*) n FROM proposals"))[0].n;
    assert.equal(
      (await f.admin("POST", "/api/proposals", input({ document: document() })))
        .statusCode,
      503,
    );
    assert.equal(
      (await f.rows("SELECT COUNT(*) n FROM proposals"))[0].n,
      before,
    );
    assert.equal(
      (await f.decide(f.legacyId, { status: "accepted" })).statusCode,
      503,
    );
    assert.equal(
      (await f.rows("SELECT status FROM proposals WHERE id=?", [f.legacyId]))[0]
        .status,
      "sent",
    );
    assert.equal(
      (await f.rows("SHOW TABLES LIKE 'proposal_documents'")).length,
      0,
    );
  } finally {
    await f.close();
  }
  pass("no migration fallback and atomic failure");
});
test("legacy proposal: edit preserves money and token; public view/accept records original value and terms; historical accepted row intact", async () => {
  const f = await fixture();
  try {
    const historical = await f.rows("SELECT * FROM proposals WHERE id=?", [
      f.historicalId,
    ]);
    const old = ok(await f.publicGet(f.legacyId));
    assert.equal(old.currency, "R$");
    const edited = ok(
      await f.admin("PATCH", `/api/proposals/${old.id}`, {
        scope: "Edited legacy scope",
      }),
    );
    assert.equal(edited.token, old.token);
    assert.deepEqual(edited.services, old.services);
    assert.equal(edited.currency, "R$");
    const accepted = ok(
      await f.decide(old.token, {
        status: "accepted",
        value: 0,
        currency: "EUR",
      }),
    );
    assert.equal(accepted.acceptance.value, 250.25);
    assert.equal(accepted.acceptance.currency, "R$");
    assert.equal(accepted.acceptance.snapshot.scope, "Edited legacy scope");
    assert.equal(accepted.acceptance.snapshot.investment, "Original terms");
    assert.equal(accepted.status, "accepted");
    assert.equal(
      (await f.decide(old.token, { status: "refused" })).statusCode,
      409,
    );
    assert.equal(
      (
        await f.admin("PATCH", `/api/proposals/${old.id}`, {
          scope: "Tampered",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await f.admin("DELETE", `/api/proposals/${old.id}`)).statusCode,
      409,
    );
    ok(await f.publicGet(f.historicalId));
    assert.deepEqual(
      await f.rows("SELECT * FROM proposals WHERE id=?", [f.historicalId]),
      historical,
    );
  } finally {
    await f.close();
  }
  pass("legacy CRUD/public acceptance, immutable history and server amount");
});
for (const currency of ["BRL", "USD", "EUR", "SEK"])
  for (const mode of ["single", "alternatives"])
    test(`${currency}/${mode}: create/edit/reload/public/accept and exact financial snapshot`, async () => {
      const f = await fixture(true, strictMode);
      try {
        const doc = { ...document(), mode };
        const created = ok(
          await f.admin(
            "POST",
            "/api/proposals",
            input({ currency, document: doc }),
          ),
        );
        assert.equal(created.revision, 1);
        const editedDoc = {
          ...doc,
          title: "Revised proposal",
          terms: "Final accepted terms",
          options: [...doc.options].reverse(),
        };
        const edited = ok(
          await f.admin("PATCH", `/api/proposals/${created.id}`, {
            document: editedDoc,
            revision: 1,
            status: "sent",
            expiresAt: "2098-11-05T18:42:13.123Z",
          }),
        );
        assert.equal(edited.revision, 2);
        assert.equal(edited.expiresAt, "2098-11-05T18:42:13.123Z");
        assert.deepEqual(edited.services, created.services);
        const peer = mysql.createPool({
          socketPath,
          user: "root",
          database: (await f.rows("SELECT DATABASE() name"))[0].name,
          timezone: "Z",
        });
        try {
          const [rows] = await peer.query<RowDataPacket[]>(
            "SELECT document_json,revision FROM proposal_documents WHERE proposal_id=?",
            [created.id],
          );
          assert.deepEqual(typeof rows[0].document_json === "string" ? JSON.parse(rows[0].document_json) : rows[0].document_json, editedDoc);
          assert.equal(rows[0].revision, 2);
        } finally {
          await peer.end();
        }
        const viewed = ok(await f.publicGet(created.token));
        assert.equal(viewed.status, "viewed");
        assert.equal(viewed.currency, currency);
        assert.equal(viewed.document.title, "Revised proposal");
        assert.equal(viewed.token, created.token);
        if (mode === "alternatives")
          assert.equal(
            (await f.decide(created.token, { status: "accepted", revision: 2 }))
              .statusCode,
            400,
          );
        assert.equal(
          (
            await f.decide(created.token, {
              status: "accepted",
              revision: 1,
              optionId: mode === "alternatives" ? doc.options[0].id : undefined,
            })
          ).statusCode,
          409,
        );
        const accepted = ok(
          await f.decide(created.token, {
            status: "accepted",
            revision: 2,
            ...(mode === "alternatives" ? { optionId: doc.options[0].id } : {}),
            value: 0,
          }),
        );
        assert.equal(
          accepted.acceptance.value,
          mode === "alternatives" ? 450 : 123.45,
        );
        assert.equal(accepted.acceptance.currency, currency);
        assert.equal(accepted.acceptance.revision, 2);
        assert.deepEqual(accepted.acceptance.snapshot.document, editedDoc);
        assert.equal(
          accepted.acceptance.snapshot.document.addons[0].value,
          100,
        );
        assert.equal(
          accepted.acceptance.snapshot.document.terms,
          "Final accepted terms",
        );
        assert.equal(
          accepted.acceptance.optionId,
          mode === "alternatives" ? doc.options[0].id : null,
        );
        const reloaded = ok(await f.publicGet(created.token));
        assert.deepEqual(reloaded.acceptance, accepted.acceptance);
        assert.equal(
          (
            await f.rows(
              "SELECT COUNT(*) n FROM client_feedback_events WHERE source_id=?",
              [created.id],
            )
          )[0].n,
          1,
        );
      } finally {
        await f.close();
      }
      pass(`${currency}/${mode}: full HTTP lifecycle and independent reload`);
    });
test("invalid/cross-proposal options, expiry, drafts, refusal and concurrent acceptance", async () => {
  const f = await fixture();
  try {
    const doc = document();
    const p = ok(
      await f.admin(
        "POST",
        "/api/proposals",
        input({ document: doc, status: "sent" }),
      ),
    );
    const foreign = ok(
      await f.admin(
        "POST",
        "/api/proposals",
        input({ document: document(), status: "sent" }),
      ),
    );
    for (const optionId of [randomUUID(), foreign.document.options[0].id])
      assert.equal(
        (await f.decide(p.token, { status: "accepted", optionId, revision: 1 }))
          .statusCode,
        400,
      );
    const responses = await Promise.all(
      doc.options.map((option) =>
        f.decide(p.token, {
          status: "accepted",
          optionId: option.id,
          revision: 1,
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
    const stored = ok(await f.publicGet(p.token));
    assert.ok([450, 700].includes(stored.acceptance.value));
    assert.notEqual(stored.acceptance.value, 1150);
    assert.equal(
      (
        await f.rows(
          "SELECT COUNT(*) n FROM client_feedback_events WHERE source_id=?",
          [p.id],
        )
      )[0].n,
      1,
    );
    const draft = ok(
      await f.admin("POST", "/api/proposals", input({ document: document() })),
    );
    assert.equal(
      (
        await f.decide(draft.token, {
          status: "accepted",
          optionId: draft.document.options[0].id,
          revision: 1,
        })
      ).statusCode,
      409,
    );
    const expired = ok(
      await f.admin(
        "POST",
        "/api/proposals",
        input({ status: "sent", expiresAt: "2000-01-01T00:00:00.000Z" }),
      ),
    );
    assert.equal(
      (await f.decide(expired.token, { status: "accepted" })).statusCode,
      400,
    );
    const refused = ok(
      await f.admin(
        "POST",
        "/api/proposals",
        input({ document: document(), status: "sent" }),
      ),
    );
    assert.equal(
      ok(await f.decide(refused.token, { status: "refused", revision: 1 }))
        .status,
      "refused",
    );
    assert.equal(
      (
        await f.decide(refused.token, {
          status: "accepted",
          optionId: refused.document.options[0].id,
          revision: 1,
        })
      ).statusCode,
      409,
    );
    assert.equal((await f.publicGet("unknown-token")).statusCode, 404);
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/proposals",
          payload: input(),
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/proposals",
          headers: { "x-test-role": "cliente" },
          payload: input(),
        })
      ).statusCode,
      403,
    );
  } finally {
    await f.close();
  }
  pass(
    "invalid and foreign options, two-connection locking, terminal states, expiry, authorization",
  );
});
test("real SQL failure rolls back document/status; rollback DDL preserves legacy rows", async () => {
  const f = await fixture();
  try {
    const p = ok(
      await f.admin(
        "POST",
        "/api/proposals",
        input({ document: document(), status: "sent" }),
      ),
    );
    const before = await f.rows("SELECT * FROM proposals WHERE id=?", [p.id]);
    await f.pool.query(
      "CREATE TRIGGER fail_proposal_snapshot BEFORE UPDATE ON proposal_documents FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'",
    );
    assert.equal(
      (
        await f.decide(p.token, {
          status: "accepted",
          optionId: p.document.options[0].id,
          revision: 1,
        })
      ).statusCode,
      500,
    );
    assert.deepEqual(
      await f.rows("SELECT * FROM proposals WHERE id=?", [p.id]),
      before,
    );
    assert.equal(
      (
        await f.rows(
          "SELECT acceptance_json FROM proposal_documents WHERE proposal_id=?",
          [p.id],
        )
      )[0].acceptance_json,
      null,
    );
    await f.pool.query("DROP TRIGGER fail_proposal_snapshot");
    const historical = await f.rows("SELECT * FROM proposals ORDER BY id");
    await f.pool.query("DROP TABLE proposal_documents");
    assert.deepEqual(
      await f.rows("SELECT * FROM proposals ORDER BY id"),
      historical,
    );
    assert.equal((await f.admin("GET", "/api/proposals")).statusCode, 200);
  } finally {
    await f.close();
  }
  pass(
    "trigger-forced transaction rollback and DDL rollback leave legacy intact",
  );
});
