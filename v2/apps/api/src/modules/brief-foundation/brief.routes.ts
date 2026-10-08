import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import {
  assertSuperAdmin,
  assertClientAccess,
  assertPortalAccessLevel,
} from "../auth/auth.access.js";
import { getUploadDirectory } from "../uploads/uploads.storage.js";
import { BriefRepository } from "./brief.repository.js";
import {
  templateSchema,
  templateUpdateSchema,
  instanceSchema,
  instanceUpdateSchema,
  versionSchema,
  responseSchema,
  submitSchema,
  briefError,
} from "./brief.schemas.js";
const ids = z.object({
  briefId: z.string().uuid(),
  clientAccountId: z.string().uuid().optional(),
  attachmentId: z.string().uuid().optional(),
  fieldId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,120}$/)
    .optional(),
});
export const briefFoundationRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        message: "Formulário ou dados inválidos.",
        issues: error.issues,
      });
    const failure = error as { statusCode?: number; message?: string };
    const status = failure.statusCode ?? 500;
    if (status >= 500) app.log.error(error);
    return reply.code(status).send({
      message:
        status >= 500
          ? "Não foi possível concluir a operação."
          : failure.message,
    });
  });
  const repo = new BriefRepository(app.db);
  await app.register(multipart, {
    limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 0 },
  });
  const actor = (r: FastifyRequest) => r.auth!.user.id;
  const portal = (r: FastifyRequest, write = false) => {
    const params = ids.parse(r.params);
    assertClientAccess(r, params.clientAccountId!, [
      "admin",
      "colaborador",
      "cliente",
    ]);
    if (write)
      assertPortalAccessLevel(r, params.clientAccountId!, [
        "admin",
        "approver",
      ]);
    return params;
  };
  app.get("/briefs/templates", async (r) => {
    assertSuperAdmin(r);
    return { items: await repo.listTemplates() };
  });
  app.post("/briefs/templates", async (r) => {
    assertSuperAdmin(r);
    return {
      template: await repo.saveTemplate(actor(r), templateSchema.parse(r.body)),
    };
  });
  app.patch("/briefs/templates/:templateId", async (r) => {
    assertSuperAdmin(r);
    return {
      template: await repo.saveTemplate(
        actor(r),
        templateUpdateSchema.parse(r.body),
        z.object({ templateId: z.string().uuid() }).parse(r.params).templateId,
      ),
    };
  });
  app.post("/briefs/templates/:templateId/archive", async (r) => {
    assertSuperAdmin(r);
    return {
      template: await repo.archiveTemplate(
        z.object({ templateId: z.string().uuid() }).parse(r.params).templateId,
        actor(r),
        versionSchema.parse(r.body).expectedVersion,
      ),
    };
  });
  app.get("/briefs", async (r) => {
    assertSuperAdmin(r);
    return { items: await repo.listInstances() };
  });
  app.post("/briefs", async (r) => {
    assertSuperAdmin(r);
    return repo.createInstance(actor(r), instanceSchema.parse(r.body));
  });
  app.get("/briefs/:briefId", async (r) => {
    assertSuperAdmin(r);
    return repo.getDetail(ids.parse(r.params).briefId);
  });
  app.patch("/briefs/:briefId", async (r) => {
    assertSuperAdmin(r);
    return repo.updateInstance(
      ids.parse(r.params).briefId,
      actor(r),
      instanceUpdateSchema.parse(r.body),
    );
  });
  for (const action of ["send", "reopen", "archive"] as const)
    app.post(`/briefs/:briefId/${action}`, async (r) => {
      assertSuperAdmin(r);
      return repo.transition(
        ids.parse(r.params).briefId,
        actor(r),
        action,
        versionSchema.parse(r.body).expectedVersion,
      );
    });
  app.get("/portal/accounts/:clientAccountId/briefs", async (r) => {
    const { clientAccountId } = z
      .object({ clientAccountId: z.string().uuid() })
      .parse(r.params);
    assertClientAccess(r, clientAccountId);
    return { items: await repo.listInstances(clientAccountId) };
  });
  app.get("/portal/accounts/:clientAccountId/briefs/:briefId", async (r) => {
    const p = portal(r);
    return repo.getDetail(p.briefId, p.clientAccountId);
  });
  app.put(
    "/portal/accounts/:clientAccountId/briefs/:briefId/response",
    async (r) => {
      const p = portal(r, true);
      return repo.saveResponse(
        p.briefId,
        p.clientAccountId!,
        actor(r),
        responseSchema.parse(r.body),
        false,
      );
    },
  );
  app.post(
    "/portal/accounts/:clientAccountId/briefs/:briefId/submit",
    async (r) => {
      const p = portal(r, true);
      return repo.saveResponse(
        p.briefId,
        p.clientAccountId!,
        actor(r),
        submitSchema.parse(r.body),
        true,
      );
    },
  );
  const storage = () =>
    path.join(getUploadDirectory(app.appEnv.UPLOAD_DIR), "brief-private");
  app.post(
    "/portal/accounts/:clientAccountId/briefs/:briefId/fields/:fieldId/attachments",
    async (r) => {
      const p = portal(r, true);
      const expected = z.coerce
        .number()
        .int()
        .positive()
        .parse(r.headers["x-brief-response-version"]);
      // Reject foreign/closed briefs before accepting any file. Repeat under a lock when attaching.
      const detail = await repo.getDetail(p.briefId, p.clientAccountId);
      if (!["sent", "reopened"].includes(detail.brief.status))
        throw briefError("Brief fechado para anexos.");
      const file = await r.file();
      if (!file) throw briefError("Escolha um arquivo.", 400);
      const buffer = await file.toBuffer();
      if (!buffer.length) throw briefError("Arquivo vazio.", 400);
      let output: Buffer, extension: string, type: string;
      if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
        try {
          const image = sharp(buffer, { limitInputPixels: 40000000 });
          const metadata = await image.metadata();
          const formats: Record<string, { extension: string; type: string }> = {
            jpeg: { extension: "jpg", type: "image/jpeg" },
            png: { extension: "png", type: "image/png" },
            webp: { extension: "webp", type: "image/webp" },
          };
          const format = formats[metadata.format ?? ""];
          if (!format) throw new Error("Formato inválido.");
          await image.stats(); // Fully decode to reject corrupt images, preserving the original bytes.
          output = buffer;
          extension = format.extension;
          type = format.type;
        } catch {
          throw briefError("Imagem inválida.", 400);
        }
      } else if (
        file.mimetype === "application/pdf" &&
        buffer.subarray(0, 5).toString() === "%PDF-"
      ) {
        output = buffer;
        extension = "pdf";
        type = "application/pdf";
      } else throw briefError("Envie uma imagem JPG/PNG/WebP ou PDF.", 400);
      const id = randomUUID(),
        key = `${id}.${extension}`;
      await mkdir(storage(), { recursive: true });
      const destination = path.join(storage(), key);
      await writeFile(destination, output, { flag: "wx" });
      try {
        return await repo.attach(
          p.briefId,
          p.clientAccountId!,
          actor(r),
          p.fieldId!,
          {
            id,
            name:
              Array.from(
                path.basename(file.filename).replace(/[\x00-\x1f\x7f]/g, ""),
              )
                .slice(0, 255)
                .join("") || "Arquivo",
            key,
            type,
            size: output.length,
          },
          expected,
        );
      } catch (error) {
        await unlink(destination).catch(() => {});
        throw error;
      }
    },
  );
  async function download(r: FastifyRequest, client?: string) {
    const p = ids.parse(r.params);
    const file = await repo.getAttachment(p.briefId, p.attachmentId!, client);
    if (!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(file.storage_key))
      throw briefError("Arquivo inválido.", 404);
    return {
      file,
      data: await readFile(path.join(storage(), file.storage_key)),
    };
  }
  app.get(
    "/portal/accounts/:clientAccountId/briefs/:briefId/attachments/:attachmentId",
    async (r, reply) => {
      const p = portal(r);
      const { file, data } = await download(r, p.clientAccountId);
      return reply
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
        )
        .type(file.content_type)
        .send(data);
    },
  );
  app.get("/briefs/:briefId/attachments/:attachmentId", async (r, reply) => {
    assertSuperAdmin(r);
    const { file, data } = await download(r);
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      )
      .type(file.content_type)
      .send(data);
  });
};
