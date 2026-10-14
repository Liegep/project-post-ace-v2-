import type { FastifyInstance } from "fastify";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { createCard, findCardById } from "../cards/cards.repository.js";
import { readEditorialBrief } from "../cards/editorial-brief.js";
import { createCardSchema } from "../cards/cards.schemas.js";

/** Client-scoped reservation, card snapshot and bank link commit together. */
export async function sendPautaForApproval(app: FastifyInstance, clientId: string, ideaId: string, userId: string) {
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    const [rows] = await db.query<RowDataPacket[]>("SELECT workspace_drawer_json FROM client_accounts WHERE id=? FOR UPDATE", [clientId]);
    if (!rows[0]) throw app.httpErrors.notFound("Cliente não encontrado.");
    const raw = rows[0].workspace_drawer_json;
    const drawer = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!drawer || typeof drawer !== "object" || !Array.isArray(drawer.pautaIdeas)) throw app.httpErrors.notFound("Pauta não encontrada.");
    const idea = drawer.pautaIdeas.find((item: Record<string, unknown>) => item?.id === ideaId);
    if (!idea || typeof idea.title !== "string" || !idea.title.trim()) throw app.httpErrors.notFound("Pauta não encontrada.");
    if (idea.cardId) {
      const card = await findCardById(db, idea.cardId);
      if (!card || card.clientAccountId !== clientId) throw app.httpErrors.conflict("O vínculo desta pauta precisa ser revisado.");
      await db.commit(); return { card, created: false };
    }
    if (idea.status === "approved" || idea.status === "sent") throw app.httpErrors.conflict("Esta pauta já foi enviada. Revise seu vínculo antes de reenviar.");
    const [columns] = await db.query<RowDataPacket[]>("SELECT id,name FROM kanban_columns WHERE client_account_id=? ORDER BY position,id", [clientId]);
    const columnId = columns.find(column => column.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "pautas para aprovacao")?.id ?? null;
    const input = createCardSchema.parse({ columnId, title: idea.title, caption: idea.caption || idea.description || null,
      editorialBrief: readEditorialBrief(idea), mediaUrls: idea.mediaUrls ?? [], primaryMediaUrl: idea.mediaUrls?.[0] ?? null,
      artType: "Post", status: ["Enviar para Cliente"], clientLabel: "Pauta para aprovação", isBriefApproval: true });
    const card = await createCard(db as unknown as Pool, clientId, userId, input);
    if (!card) throw Error("Não foi possível preparar a aprovação.");
    const nextIdeas = drawer.pautaIdeas.map((item: Record<string, unknown>) => item?.id === ideaId ? { ...item, status: "sent", cardId: card.id } : item);
    await db.query("UPDATE client_accounts SET workspace_drawer_json=? WHERE id=?", [JSON.stringify({ ...drawer, pautaIdeas: nextIdeas }), clientId]);
    await db.commit(); return { card, created: true };
  } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
}
