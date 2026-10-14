import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { findCardById, updateCard } from "../cards/cards.repository.js";
import { updateCardSchema } from "../cards/cards.schemas.js";
import { editorialBriefSchema, readEditorialBrief } from "../cards/editorial-brief.js";
import { inferredApprovalState } from "../approvals/approval-state.js";
import { recordApprovalEvent } from "../approvals/approval-history.repository.js";
import { preservesApprovedPauta } from "./pauta-edit.policy.js";

const clientFields = ["title", "caption", "description", "concept", "hook", "rationale", "objective", "cta", "sourceTitle", "sourceSummary", "sourceUrl", "sourceDate", "mediaUrls"];

/** Update a human-edited pauta and its sent briefing as one guarded revision. */
export async function editPautaIdea(app: FastifyInstance, clientId: string, ideaId: string, rawPatch: Record<string, unknown>, actor: {id:string;fullName:string;globalRole:string}) {
  const {expectedApprovalRevision, ...patch} = rawPatch;
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    const [rows] = await db.query<RowDataPacket[]>("SELECT workspace_drawer_json FROM client_accounts WHERE id=? FOR UPDATE", [clientId]);
    if (!rows[0]) throw app.httpErrors.notFound("Cliente não encontrado.");
    const raw = rows[0].workspace_drawer_json;
    const drawer = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!drawer || !Array.isArray(drawer.pautaIdeas)) throw app.httpErrors.notFound("Pauta não encontrada.");
    const existing = drawer.pautaIdeas.find((item: Record<string, unknown>) => item?.id === ideaId);
    if (!existing) throw app.httpErrors.notFound("Pauta não encontrada.");
    if (!preservesApprovedPauta(existing, patch)) throw app.httpErrors.conflict("O conteúdo desta pauta já foi aprovado e está preservado.");
    const changedField = (key: string) => key in patch && JSON.stringify(existing[key] ?? (key === "mediaUrls" ? [] : null)) !== JSON.stringify(patch[key] ?? (key === "mediaUrls" ? [] : null));
    const changed = clientFields.some(changedField);
    const editedBrief = editorialBriefSchema.safeParse(Object.fromEntries(clientFields.filter(key => changedField(key) && key in editorialBriefSchema.shape).map(key => [key,patch[key]])));
    if (!editedBrief.success) throw app.httpErrors.badRequest("Verifique os campos do briefing, a URL e a data da fonte.");
    const idea = {...existing, ...patch, id:ideaId};
    let updatedCard: Awaited<ReturnType<typeof findCardById>> = null;
    if (changed && existing.cardId) {
      // Lock the real card: the bank's status can be stale after a client decision.
      const [locked] = await db.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE id=? AND client_account_id=? FOR UPDATE", [existing.cardId,clientId]);
      if (!locked[0]) throw app.httpErrors.conflict("O vínculo desta pauta precisa ser revisado.");
      const before = (await findCardById(db, existing.cardId))!;
      if (inferredApprovalState(before) === "approved") throw app.httpErrors.conflict("O briefing aprovado está preservado. Reabra a aprovação antes de editar.");
      if (expectedApprovalRevision !== before.approvalRevision) throw app.httpErrors.conflict("A aprovação mudou. Reabra a pauta antes de salvar esta versão.");
      if (patch.cardId !== undefined && patch.cardId !== existing.cardId) throw app.httpErrors.conflict("Não é possível trocar o vínculo ao editar o conteúdo enviado.");
      const briefInput = before.editorialBrief
        ? {...before.editorialBrief, ...editedBrief.data}
        : idea;
      const input = updateCardSchema.parse({
        ...(changedField("title") ? {title:idea.title} : {}),
        ...(changedField("caption") || (changedField("description") && !idea.caption) ? {caption:idea.caption || idea.description || null} : {}),
        editorialBrief:readEditorialBrief(briefInput),
        ...(changedField("mediaUrls") ? {mediaUrls:idea.mediaUrls ?? [],primaryMediaUrl:idea.mediaUrls?.[0] ?? null} : {}),
        expectedApprovalRevision:before.approvalRevision,
      });
      if (input.caption !== undefined && input.caption !== before.caption) await db.query("INSERT INTO card_caption_versions(id,card_id,caption,author_user_id,author_name,author_role) VALUES(?,?,?,?,?,?)",[randomUUID(),before.id,before.caption,actor.id,actor.fullName,actor.globalRole]);
      await updateCard(db,before.id,input);
      const decision = inferredApprovalState(before) ?? "pending";
      await db.query("UPDATE kanban_cards SET approval_revision=approval_revision+1,approval_state=? WHERE id=?",[decision,before.id]);
      await db.query("UPDATE approval_links SET is_active=0 WHERE card_id=? AND is_active=1",[before.id]);
      const after = (await findCardById(db,before.id))!;
      updatedCard = after;
      await recordApprovalEvent(db,{cardId:before.id,revision:after.approvalRevision,action:"brief_updated",decision,source:"admin",
        actor:{userId:actor.id,name:actor.fullName,role:actor.globalRole},before,after});
    }
    if (!updatedCard && existing.cardId) {
      const current = await findCardById(db, existing.cardId);
      if (current?.clientAccountId === clientId) updatedCard = current;
    }
    const nextIdeas = drawer.pautaIdeas.map((item:Record<string,unknown>) => item?.id === ideaId ? idea : item);
    await db.query("UPDATE client_accounts SET workspace_drawer_json=? WHERE id=?",[JSON.stringify({...drawer,pautaIdeas:nextIdeas}),clientId]);
    await db.commit(); return {ok:true,idea,...(updatedCard ? {card:updatedCard} : {})};
  } catch (error) {await db.rollback();throw error;} finally {db.release();}
}
