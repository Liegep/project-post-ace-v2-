import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import { assertInternalAccess } from "../auth/auth.access.js";

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

function getUploadDirectory(uploadDir: string) {
  return path.resolve(process.cwd(), uploadDir);
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: {
      fileSize: maxVideoSize,
      files: 1,
    },
  });

  app.post("/uploads", async (request) => {
    assertInternalAccess(request);

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
      throw app.httpErrors.badRequest("Imagens podem ter no maximo 12 MB.");
    }
    if (format.kind === "video" && buffer.length > maxVideoSize) {
      throw app.httpErrors.badRequest("Videos podem ter no maximo 20 MB.");
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
          `Nao foi possivel converter “${file.filename}” para WebP. Verifique se a imagem nao esta corrompida.`,
        );
      }
    }
    await writeFile(path.join(directory, fileName), output);

    return {
      ok: true,
      url: `/api/uploads/${fileName}`,
      fileName,
    };
  });

  app.get("/uploads/:fileName", async (request, reply) => {
    const params = request.params as { fileName: string };
    const match = /^([a-f0-9-]+)\.(webp|mp4|webm|mov)$/.exec(params.fileName);
    if (!match) {
      throw app.httpErrors.notFound("Arquivo nao encontrado.");
    }

    const fileType = [...allowedTypes.values()].find((item) => item.extension === match[2]);
    if (!fileType) {
      throw app.httpErrors.notFound("Arquivo nao encontrado.");
    }

    try {
      const file = await readFile(path.join(getUploadDirectory(app.appEnv.UPLOAD_DIR), params.fileName));
      const query = request.query as { download?: string };
      if (query.download === "png") {
        if (fileType.kind !== "image") {
          throw app.httpErrors.badRequest("Apenas imagens podem ser baixadas em PNG.");
        }
        const png = await sharp(file).png().toBuffer();
        return reply
          .header("Content-Disposition", `attachment; filename="designhub-${match[1]}.png"`)
          .type("image/png")
          .send(png);
      }
      return reply.type(fileType.contentType).send(file);
    } catch {
      throw app.httpErrors.notFound("Arquivo nao encontrado.");
    }
  });
};
