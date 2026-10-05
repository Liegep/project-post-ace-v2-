import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import {
  briefError,
  canonical,
  formSchema,
  validateAnswers,
  type BriefForm,
  type templateSchema,
  type templateUpdateSchema,
  type instanceSchema,
  type instanceUpdateSchema,
  type responseSchema,
  type submitSchema,
} from "./brief.schemas.js";
const parse = (value: unknown): any =>
  typeof value === "string" ? JSON.parse(value) : value;
async function rows(
  db: Pool | PoolConnection,
  sql: string,
  args: unknown[] = [],
) {
  return (await db.query<RowDataPacket[]>(sql, args))[0];
}
export class BriefRepository {
  constructor(readonly db: Pool) {}
  private async transaction<T>(
    fn: (db: PoolConnection) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const db = await this.db.getConnection();
      try {
        await db.beginTransaction();
        const result = await fn(db);
        await db.commit();
        return result;
      } catch (error) {
        await db.rollback();
        const code = (error as { code?: string }).code;
        if (
          attempt >= 2 ||
          ![
            "ER_LOCK_DEADLOCK",
            "ER_LOCK_WAIT_TIMEOUT",
            "ER_DUP_ENTRY",
          ].includes(code ?? "")
        )
          throw error;
      } finally {
        db.release();
      }
    }
  }
  private async instance(db: Pool | PoolConnection, id: string, lock = false) {
    const row = (
      await rows(
        db,
        `SELECT * FROM design_brief_instances WHERE id=?${lock ? " FOR UPDATE" : ""}`,
        [id],
      )
    )[0];
    if (!row) throw briefError("Brief não encontrado.", 404);
    return row;
  }
  private checkVersion(actual: number, expected: number) {
    if (actual !== expected)
      throw briefError(
        "O registro foi atualizado em outra sessão. Recarregue antes de salvar.",
      );
  }
  private async event(
    db: PoolConnection,
    id: string,
    actor: string,
    action: string,
    revision: number | null = null,
  ) {
    await db.query(
      "INSERT INTO design_brief_events(id,brief_id,actor_user_id,action,response_revision) VALUES(?,?,?,?,?)",
      [randomUUID(), id, actor, action, revision],
    );
  }
  private async template(db: Pool | PoolConnection, id: string, lock = false) {
    const row = (
      await rows(
        db,
        `SELECT t.*, COALESCE(m.category,'custom') AS category,COALESCE(m.description,'') AS description,COALESCE(m.locale,'pt') AS locale,COALESCE(m.version,1) AS version,COALESCE(m.status,'active') AS status FROM design_brief_templates t LEFT JOIN design_brief_template_metadata m ON m.template_id=t.id WHERE t.id=?${lock ? " FOR UPDATE" : ""}`,
        [id],
      )
    )[0];
    if (!row) throw briefError("Template não encontrado.", 404);
    return this.mapTemplate(row);
  }
  private mapTemplate(row: RowDataPacket) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      version: Number(row.version),
      status: row.status,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      form: {
        title: row.name,
        introduction: row.introduction,
        category: row.category,
        locale: row.locale,
        fields: parse(row.fields_json).map((field: any) => ({
          ...field,
          validation: field.validation ?? {},
        })),
      } as BriefForm,
    };
  }
  async listTemplates() {
    return (
      await rows(
        this.db,
        "SELECT t.*,COALESCE(m.category,'custom') AS category,COALESCE(m.description,'') AS description,COALESCE(m.locale,'pt') AS locale,COALESCE(m.version,1) AS version,COALESCE(m.status,'active') AS status FROM design_brief_templates t LEFT JOIN design_brief_template_metadata m ON m.template_id=t.id ORDER BY t.created_at DESC",
      )
    ).map((row) => this.mapTemplate(row));
  }
  async saveTemplate(
    actor: string,
    input:
      | z.infer<typeof templateSchema>
      | z.infer<typeof templateUpdateSchema>,
    id?: string,
  ) {
    return this.transaction(async (db) => {
      const templateId = id ?? ("id" in input ? input.id : randomUUID());
      let version = 1;
      const existing = (
        await rows(
          db,
          "SELECT id FROM design_brief_templates WHERE id=? FOR UPDATE",
          [templateId],
        )
      )[0];
      if (existing) {
        const previous = await this.template(db, templateId, true);
        if (!id) {
          if (
            canonical({
              name: previous.name,
              description: previous.description,
              form: previous.form,
            }) !==
            canonical({
              name: input.name,
              description: input.description,
              form: { ...input.form, title: input.name },
            })
          )
            throw briefError("Identificador já utilizado.");
          return previous;
        }
        this.checkVersion(
          previous.version,
          (input as z.infer<typeof templateUpdateSchema>).expectedVersion,
        );
        if (previous.status !== "active")
          throw briefError("Template arquivado.");
        await this.recordTemplateVersion(
          db,
          previous.id,
          previous.version,
          previous.form,
          actor,
        );
        version = previous.version + 1;
        await db.query(
          "UPDATE design_brief_templates SET name=?,introduction=?,fields_json=? WHERE id=?",
          [
            input.name,
            input.form.introduction,
            JSON.stringify(input.form.fields),
            templateId,
          ],
        );
      } else {
        if (id) throw briefError("Template não encontrado.", 404);
        await db.query(
          "INSERT INTO design_brief_templates(id,name,introduction,fields_json,created_by_user_id) VALUES(?,?,?,?,?)",
          [
            templateId,
            input.name,
            input.form.introduction,
            JSON.stringify(input.form.fields),
            actor,
          ],
        );
      }
      await db.query(
        "INSERT INTO design_brief_template_metadata(template_id,category,description,locale,version,status,updated_by_user_id) VALUES(?,?,?,?,?,'active',?) ON DUPLICATE KEY UPDATE category=VALUES(category),description=VALUES(description),locale=VALUES(locale),version=VALUES(version),updated_by_user_id=VALUES(updated_by_user_id),updated_at=CURRENT_TIMESTAMP(3)",
        [
          templateId,
          input.form.category,
          input.description,
          input.form.locale,
          version,
          actor,
        ],
      );
      await this.recordTemplateVersion(
        db,
        templateId,
        version,
        { ...input.form, title: input.name },
        actor,
      );
      return this.template(db, templateId);
    });
  }
  private async recordTemplateVersion(
    db: PoolConnection,
    id: string,
    version: number,
    form: BriefForm,
    actor: string,
  ) {
    await db.query(
      "INSERT IGNORE INTO design_brief_template_versions(template_id,version,snapshot_json,created_by_user_id) VALUES(?,?,?,?)",
      [id, version, JSON.stringify(form), actor],
    );
  }
  async archiveTemplate(id: string, actor: string, expected: number) {
    return this.transaction(async (db) => {
      const template = await this.template(db, id, true);
      this.checkVersion(template.version, expected);
      await db.query(
        "INSERT INTO design_brief_template_metadata(template_id,category,description,locale,version,status,updated_by_user_id) VALUES(?,?,?,?,?,'archived',?) ON DUPLICATE KEY UPDATE status='archived',version=version+1,updated_by_user_id=VALUES(updated_by_user_id),updated_at=CURRENT_TIMESTAMP(3)",
        [
          id,
          template.form.category,
          template.description,
          template.form.locale,
          template.version + 1,
          actor,
        ],
      );
      return this.template(db, id);
    });
  }
  async createInstance(actor: string, input: z.infer<typeof instanceSchema>) {
    return this.transaction(async (db) => {
      const existing = (
        await rows(
          db,
          "SELECT * FROM design_brief_instances WHERE id=? FOR UPDATE",
          [input.id],
        )
      )[0];
      if (existing) {
        if (
          existing.created_by_user_id !== actor ||
          canonical(parse(existing.snapshot_json)) !== canonical(input.form) ||
          existing.client_account_id !== input.clientAccountId ||
          existing.template_id !== input.templateId
        )
          throw briefError("Identificador já utilizado.");
        return this.detail(db, input.id);
      }
      if (input.templateId) {
        const template = await this.template(db, input.templateId, true);
        if (template.status !== "active")
          throw briefError("Template arquivado.");
        if (input.templateVersion !== template.version)
          throw briefError("O template foi atualizado. Recarregue o modelo.");
        await this.recordTemplateVersion(
          db,
          template.id,
          template.version,
          template.form,
          actor,
        );
      } else if (input.templateVersion !== null)
        throw briefError("Versão exige template.", 400);
      await db.query(
        "INSERT INTO design_brief_instances(id,client_account_id,template_id,template_version,snapshot_json,created_by_user_id) VALUES(?,?,?,?,?,?)",
        [
          input.id,
          input.clientAccountId,
          input.templateId,
          input.templateVersion,
          JSON.stringify(input.form),
          actor,
        ],
      );
      await this.event(db, input.id, actor, "created");
      return this.detail(db, input.id);
    });
  }
  async updateInstance(
    id: string,
    actor: string,
    input: z.infer<typeof instanceUpdateSchema>,
  ) {
    return this.transaction(async (db) => {
      const brief = await this.instance(db, id, true);
      this.checkVersion(brief.version, input.expectedVersion);
      if (brief.status !== "draft")
        throw briefError("O formulário enviado está congelado.");
      await db.query(
        "UPDATE design_brief_instances SET snapshot_json=?,client_account_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
        [JSON.stringify(input.form), input.clientAccountId, id],
      );
      await this.event(db, id, actor, "draft_updated");
      return this.detail(db, id);
    });
  }
  async transition(
    id: string,
    actor: string,
    action: "send" | "reopen" | "archive",
    expected: number,
  ) {
    return this.transaction(async (db) => {
      const brief = await this.instance(db, id, true);
      this.checkVersion(brief.version, expected);
      if (action === "send") {
        if (brief.status !== "draft" || !brief.client_account_id)
          throw briefError("Selecione um cliente para enviar um rascunho.");
        const form = formSchema.parse(parse(brief.snapshot_json));
        if (!form.fields.length)
          throw briefError("Adicione ao menos um campo.", 400);
        await db.query(
          "UPDATE design_brief_instances SET status='sent',sent_at=CURRENT_TIMESTAMP(3),sent_by_user_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
          [actor, id],
        );
        await db.query(
          "INSERT INTO design_brief_responses(id,brief_id,client_account_id,answers_json) VALUES(?,?,?,'{}')",
          [randomUUID(), id, brief.client_account_id],
        );
      } else if (action === "reopen") {
        if (brief.status !== "answered")
          throw briefError("Somente briefs respondidos podem ser reabertos.");
        await db.query(
          "UPDATE design_brief_instances SET status='reopened',version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
          [id],
        );
        await db.query(
          "UPDATE design_brief_responses SET status='draft',version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE brief_id=?",
          [id],
        );
      } else {
        if (brief.status === "archived")
          throw briefError("Brief já arquivado.");
        await db.query(
          "UPDATE design_brief_instances SET status='archived',version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
          [id],
        );
      }
      await this.event(db, id, actor, action);
      return this.detail(db, id);
    });
  }
  private mapInstance(row: RowDataPacket) {
    return {
      id: row.id,
      clientAccountId: row.client_account_id,
      templateId: row.template_id,
      templateVersion:
        row.template_version === null ? null : Number(row.template_version),
      form: parse(row.snapshot_json) as BriefForm,
      status: row.status,
      version: Number(row.version),
      sentAt: row.sent_at,
      sentByUserId: row.sent_by_user_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  async listInstances(client?: string) {
    const result = await rows(
      this.db,
      `SELECT * FROM design_brief_instances ${client ? "WHERE client_account_id=? AND sent_at IS NOT NULL" : ""} ORDER BY created_at DESC`,
      client ? [client] : [],
    );
    return result.map((row) => this.mapInstance(row));
  }
  private async detail(db: Pool | PoolConnection, id: string, client?: string) {
    const brief = await this.instance(db, id);
    if (client && (brief.client_account_id !== client || !brief.sent_at))
      throw briefError("Brief não encontrado.", 404);
    const response = (
      await rows(db, "SELECT * FROM design_brief_responses WHERE brief_id=?", [
        id,
      ])
    )[0];
    const revisions = response
      ? await rows(
          db,
          "SELECT id,revision,answers_json,submitted_by_user_id,submitted_at FROM design_brief_response_revisions WHERE response_id=? ORDER BY revision DESC",
          [response.id],
        )
      : [];
    const attachments = response
      ? await rows(
          db,
          "SELECT id,field_id,original_name,content_type,size_bytes,created_at FROM design_brief_attachments WHERE response_id=? ORDER BY created_at",
          [response.id],
        )
      : [];
    const events = await rows(
      db,
      "SELECT id,action,actor_user_id,response_revision,created_at FROM design_brief_events WHERE brief_id=? ORDER BY created_at,id",
      [id],
    );
    return {
      brief: this.mapInstance(brief),
      response: response
        ? {
            id: response.id,
            status: response.status,
            version: Number(response.version),
            answers: parse(response.answers_json) as Record<string, unknown>,
            respondentUserId: response.respondent_user_id,
            submittedAt: response.submitted_at,
            updatedAt: response.updated_at,
          }
        : null,
      revisions: revisions.map((row) => ({
        id: row.id,
        revision: Number(row.revision),
        answers: parse(row.answers_json),
        submittedByUserId: row.submitted_by_user_id,
        submittedAt: row.submitted_at,
      })),
      attachments: attachments.map((row) => ({
        id: row.id,
        fieldId: row.field_id,
        name: row.original_name,
        contentType: row.content_type,
        size: row.size_bytes,
        createdAt: row.created_at,
      })),
      events: events.map((row) => ({
        id: row.id,
        action: row.action,
        actorUserId: row.actor_user_id,
        revision: row.response_revision,
        createdAt: row.created_at,
      })),
    };
  }
  async getDetail(id: string, client?: string) {
    return this.detail(this.db, id, client);
  }
  async saveResponse(
    id: string,
    client: string,
    actor: string,
    input: z.infer<typeof responseSchema> | z.infer<typeof submitSchema>,
    submit: boolean,
  ) {
    return this.transaction(async (db) => {
      const brief = await this.instance(db, id, true);
      if (brief.client_account_id !== client || !brief.sent_at)
        throw briefError("Brief não encontrado.", 404);
      const response = (
        await rows(
          db,
          "SELECT * FROM design_brief_responses WHERE brief_id=? FOR UPDATE",
          [id],
        )
      )[0];
      if (!response) throw briefError("Resposta não disponível.", 404);
      const hash = createHash("sha256")
        .update(canonical(input.answers))
        .digest("hex");
      if (submit) {
        const previous = (
          await rows(
            db,
            "SELECT request_hash FROM design_brief_response_revisions WHERE response_id=? AND idempotency_key=?",
            [
              response.id,
              (input as z.infer<typeof submitSchema>).idempotencyKey,
            ],
          )
        )[0];
        if (previous) {
          if (previous.request_hash !== hash)
            throw briefError(
              "Chave de envio já utilizada para outras respostas.",
            );
          return this.detail(db, id, client);
        }
      }
      if (
        !["sent", "reopened"].includes(brief.status) ||
        response.status !== "draft"
      )
        throw briefError("Brief não está aberto para respostas.");
      this.checkVersion(response.version, input.expectedVersion);
      const form = formSchema.parse(parse(brief.snapshot_json));
      validateAnswers(form, input.answers, submit);
      for (const field of form.fields.filter(
        (field) => field.type === "file",
      )) {
        for (const attachmentId of (input.answers[field.id] ??
          []) as string[]) {
          const attachment = (
            await rows(
              db,
              "SELECT id FROM design_brief_attachments WHERE id=? AND response_id=? AND field_id=?",
              [attachmentId, response.id, field.id],
            )
          )[0];
          if (!attachment)
            throw briefError("Anexo não pertence a esta resposta/campo.", 400);
        }
      }
      let revision: number | null = null;
      if (submit) {
        const previous = (
          await rows(
            db,
            "SELECT COALESCE(MAX(revision),0) AS latest FROM design_brief_response_revisions WHERE response_id=?",
            [response.id],
          )
        )[0];
        revision = Number(previous.latest) + 1;
        await db.query(
          "INSERT INTO design_brief_response_revisions(id,response_id,revision,answers_json,submitted_by_user_id,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?)",
          [
            randomUUID(),
            response.id,
            revision,
            JSON.stringify(input.answers),
            actor,
            (input as z.infer<typeof submitSchema>).idempotencyKey,
            hash,
          ],
        );
        await db.query(
          "UPDATE design_brief_instances SET status='answered',version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
          [id],
        );
      }
      await db.query(
        `UPDATE design_brief_responses SET answers_json=?,status=?,respondent_user_id=?,version=version+1,${submit ? "submitted_at=CURRENT_TIMESTAMP(3)," : ""}updated_at=CURRENT_TIMESTAMP(3) WHERE id=?`,
        [
          JSON.stringify(input.answers),
          submit ? "submitted" : "draft",
          actor,
          response.id,
        ],
      );
      await this.event(
        db,
        id,
        actor,
        submit ? "submitted" : "response_draft_saved",
        revision,
      );
      return this.detail(db, id, client);
    });
  }
  async attach(
    id: string,
    client: string,
    actor: string,
    fieldId: string,
    file: { id: string; name: string; key: string; type: string; size: number },
    expected: number,
  ) {
    return this.transaction(async (db) => {
      const brief = await this.instance(db, id, true);
      if (brief.client_account_id !== client || !brief.sent_at)
        throw briefError("Brief não encontrado.", 404);
      if (!["sent", "reopened"].includes(brief.status))
        throw briefError("Brief fechado para anexos.");
      const response = (
        await rows(
          db,
          "SELECT * FROM design_brief_responses WHERE brief_id=? FOR UPDATE",
          [id],
        )
      )[0];
      this.checkVersion(response.version, expected);
      const form = formSchema.parse(parse(brief.snapshot_json));
      const field = form.fields.find((field) => field.id === fieldId);
      if (field?.type !== "file")
        throw briefError("Campo de anexo inválido.", 400);
      const answers = parse(response.answers_json);
      const ids: string[] = answers[fieldId] ?? [];
      if (ids.length >= (field.validation.maxFiles ?? 5))
        throw briefError("Limite de arquivos atingido.", 400);
      await db.query(
        "INSERT INTO design_brief_attachments(id,response_id,field_id,original_name,storage_key,content_type,size_bytes,uploaded_by_user_id) VALUES(?,?,?,?,?,?,?,?)",
        [
          file.id,
          response.id,
          fieldId,
          file.name,
          file.key,
          file.type,
          file.size,
          actor,
        ],
      );
      answers[fieldId] = [...ids, file.id];
      await db.query(
        "UPDATE design_brief_responses SET answers_json=?,version=version+1,respondent_user_id=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
        [JSON.stringify(answers), actor, response.id],
      );
      await this.event(db, id, actor, "attachment_added");
      return this.detail(db, id, client);
    });
  }
  async getAttachment(id: string, attachmentId: string, client?: string) {
    await this.getDetail(id, client);
    const attachment = (
      await rows(
        this.db,
        "SELECT a.* FROM design_brief_attachments a JOIN design_brief_responses r ON r.id=a.response_id WHERE a.id=? AND r.brief_id=?",
        [attachmentId, id],
      )
    )[0];
    if (!attachment) throw briefError("Anexo não encontrado.", 404);
    return attachment;
  }
}
