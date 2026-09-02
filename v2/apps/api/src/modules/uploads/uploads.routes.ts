import crypto from "node:crypto";
import { mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import { assertClientAccess, assertInternalAccess, assertPortalAccessLevel } from "../auth/auth.access.js";
import { findClientPermissionsByAccountId } from "../clients/clients.repository.js";
import { getUploadDirectory } from "./uploads.storage.js";

export { getUploadDirectory } from "./uploads.storage.js";

const allowedTypes = new Map<string, { kind: "image" | "video"; extension: string; contentType: string }>([
  ["image/jpeg", { kind: "image", extension: "webp", contentType: "image/webp" }],
  ["image/png", { kind: "image", extension: "webp", contentType: "image/webp" }],
  ["image/webp", { kind: "image", extension: "webp", contentType: "image/webp" }],
  ["image/gif", { kind: "image", extension: "webp", contentType: "image/webp" }],
  ["video/mp4", { kind: "video", extension: "mp4", contentType: "video/mp4" }],
  ["video/webm", { kind: "video", extension: "webm", contentType: "video/webm" }],
  ["video/quicktime", { kind: "video", extension: "mov", contentType: "video/quicktime" }],
]);
const maxImageSize = 12 * 1024 * 1024;
const maxVideoSize = 20 * 1024 * 1024;
const maxLegacyChunkSize = 10 * 1024 * 1024;
const legacyFileTypes = new Map<string, string>([
  ["webp", "image/webp"], ["png", "image/png"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"],
  ["mp4", "video/mp4"], ["webm", "video/webm"], ["mov", "video/quicktime"],
  ["pdf", "application/pdf"], ["svg", "image/svg+xml"],
]);

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: {
      fileSize: maxVideoSize,
      files: 1,
    },
  });

  const storeUpload = async (request: FastifyRequest) => {
    const file = await request.file();
    if (!file) {
      throw app.httpErrors.badRequest("Escolha uma imagem para enviar.");
    }

    const format = allowedTypes.get(file.mimetype);
    if (!format) {
      throw app.httpErrors.badRequest("Envie uma imagem JPG, PNG, WEBP ou GIF.");
    }

    const buffer = await file.toBuffer();
    if (buffer.length === 0) {
      throw app.httpErrors.badRequest("O arquivo enviado esta vazio.");
    }
    if (format.kind === "image" && buffer.length > maxImageSize) {
      throw app.httpErrors.badRequest("Imagens podem ter no máximo 12 MB.");
    }
    if (format.kind === "video" && buffer.length > maxVideoSize) {
      throw app.httpErrors.badRequest("Vídeos podem ter no máximo 20 MB.");
    }

    const directory = getUploadDirectory(app.appEnv.UPLOAD_DIR);
    await mkdir(directory, { recursive: true });

    const fileName = `${crypto.randomUUID()}.${format.extension}`;
    let output = buffer;
    if (format.kind === "image") {
      try {
        output = await sharp(buffer, { animated: file.mimetype === "image/gif" })
          .webp({ quality: 84, effort: 4 })
          .toBuffer();
      } catch {
        throw app.httpErrors.badRequest(
          `Não foi possível converter “${file.filename}” para WebP. Verifique se a imagem não está corrompida.`,
        );
      }
    }
    await writeFile(path.join(directory, fileName), output);

    return {
      ok: true,
      url: `/api/uploads/${fileName}`,
      fileName,
    };
  };

  app.post("/uploads", async (request) => {
    assertInternalAccess(request);
    return storeUpload(request);
  });

  app.post("/uploads/legacy-import", async (request) => {
    assertInternalAccess(request);
    if (!request.headers.authorization?.startsWith("Bearer ") || request.auth?.user.globalRole !== "super_admin") {
      throw app.httpErrors.forbidden("A importação legada exige uma sessão de super admin.");
    }
    const objectKey = String(request.headers["x-legacy-object-key"] ?? "").trim();
    const extension = String(request.headers["x-legacy-extension"] ?? "").trim().toLowerCase();
    const chunkIndex = Number(request.headers["x-legacy-chunk-index"]);
    const chunkTotal = Number(request.headers["x-legacy-chunk-total"]);
    const offset = Number(request.headers["x-legacy-offset"]);
    const totalSize = Number(request.headers["x-legacy-total-size"]);
    if (!objectKey || objectKey.length > 1200 || !legacyFileTypes.has(extension)) {
      throw app.httpErrors.badRequest("Identificação de arquivo legado inválida.");
    }
    if (![chunkIndex, chunkTotal, offset, totalSize].every(Number.isSafeInteger) || chunkIndex < 0 || chunkTotal < 1 || chunkIndex >= chunkTotal || offset < 0 || totalSize < 1) {
      throw app.httpErrors.badRequest("Informações de bloco inválidas.");
    }

    const file = await request.file({ limits: { fileSize: maxLegacyChunkSize, files: 1 } });
    if (!file) throw app.httpErrors.badRequest("Bloco de arquivo ausente.");
    const buffer = await file.toBuffer();
    if (!buffer.length || buffer.length > maxLegacyChunkSize || offset + buffer.length > totalSize) {
      throw app.httpErrors.badRequest("Bloco de arquivo inválido.");
    }

    const directory = getUploadDirectory(app.appEnv.UPLOAD_DIR);
    await mkdir(directory, { recursive: true });
    const digest = crypto.createHash("sha256").update(`${objectKey}|${extension}`).digest("hex");
    const fileName = `${digest}.${extension}`;
    const destination = path.join(directory, fileName);
    const temporary = path.join(directory, `.${fileName}.part`);
    try {
      const existing = await stat(destination);
      if (existing.isFile() && existing.size === totalSize) {
        return { ok: true, complete: true, url: `/api/uploads/${fileName}`, fileName };
      }
    } catch {
      // The destination does not exist yet.
    }

    const handle = await open(temporary, chunkIndex === 0 ? "w" : "r+");
    try {
      await handle.write(buffer, 0, buffer.length, offset);
    } finally {
      await handle.close();
    }
    const received = (await stat(temporary)).size;
    const complete = chunkIndex === chunkTotal - 1 && received === totalSize;
    if (complete) await rename(temporary, destination);
    return { ok: true, complete, received, url: `/api/uploads/${fileName}`, fileName };
  });

  app.post("/portal/accounts/:clientAccountId/uploads", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientCreatePost) {
      throw app.httpErrors.forbidden("O envio de artes não está habilitado para este cliente.");
    }
    return storeUpload(request);
  });

  app.get("/uploads/:fileName", async (request, reply) => {
    const params = request.params as { fileName: string };
    const match = /^([a-f0-9-]+)\.(webp|png|jpg|jpeg|mp4|webm|mov|pdf|svg)$/.exec(params.fileName);
    if (!match) {
      throw app.httpErrors.notFound("Arquivo não encontrado.");
    }

    const contentType = legacyFileTypes.get(match[2]);
    if (!contentType) {
      throw app.httpErrors.notFound("Arquivo não encontrado.");
    }

    try {
      const file = await readFile(path.join(getUploadDirectory(app.appEnv.UPLOAD_DIR), params.fileName));
      const query = request.query as { download?: string };
      if (query.download === "png") {
        if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
          throw app.httpErrors.badRequest("Apenas imagens podem ser baixadas em PNG.");
        }
        const png = await sharp(file).png().toBuffer();
        return reply
          .header("Content-Disposition", `attachment; filename="designhub-${match[1]}.png"`)
          .type("image/png")
          .send(png);
      }
      return reply.type(contentType).send(file);
    } catch {
      throw app.httpErrors.notFound("Arquivo não encontrado.");
    }
  });
};
