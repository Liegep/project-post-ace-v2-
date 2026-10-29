import { createHash } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { createCard, deleteCard, findCardById } from "./cards.repository.js";
import { createCardSchema } from "./cards.schemas.js";

const inputSchema = z.object({ operationKey: z.uuid().transform(value=>value.toLowerCase()), sourceCardId: z.uuid(), targetClientId: z.uuid(), columnId: z.uuid().nullable(), mode: z.enum(["copy", "move"]) });
type Operation = RowDataPacket & { operation_key:string; actor_user_id:string; source_client_id:string; source_card_id:string; target_client_id:string; target_column_id:string|null; mode:"copy"|"move"; source_fingerprint:string; status:"pending"|"completed"|"cancelled"; destination_card_id:string|null };
const result = (op:Operation) => ({ createdAt:op.created_at, operationKey:op.operation_key, sourceCardId:op.source_card_id, sourceClientId:op.source_client_id, targetClientId:op.target_client_id, columnId:op.target_column_id, mode:op.mode, status:op.status, destinationCardId:op.destination_card_id });
const fingerprint = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const cardTransferRoutes: FastifyPluginAsync = async app => {
  const guard = async (request:FastifyRequest, source:string, target?:string) => {
    assertInternalAccess(request);
    assertClientAccess(request,source,["admin","colaborador"]);
    if (target) assertClientAccess(request,target,["admin","colaborador"]);
    if (!app.appEnv.CARD_TRANSFERS_ENABLED) throw Object.assign(new Error("Transferências aguardam ativação segura. Nenhum cartão foi alterado."),{statusCode:503});
    const [tables]=await app.db.query<RowDataPacket[]>("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('card_transfer_operations','kanban_cards')");
    const [keys]=await app.db.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='card_transfer_operations' AND INDEX_NAME='PRIMARY'");
    if (tables.length!==2 || tables.some(table=>table.ENGINE!=="InnoDB") || keys.length!==1 || keys[0].COLUMN_NAME!=="operation_key") throw Object.assign(new Error("Esquema de transferências não está pronto. Nenhum cartão foi alterado."),{statusCode:503});
  };
  // Persistent recovery list: survives reloads and fresh login, including a removed move source.
  app.get("/clients/:clientAccountId/card-transfers", async request => {
    const {clientAccountId:source}=request.params as {clientAccountId:string}; await guard(request,source);
    const [rows]=await app.db.query<Operation[]>("SELECT * FROM card_transfer_operations WHERE actor_user_id=? AND source_client_id=? ORDER BY created_at DESC, operation_key DESC",[request.auth!.user.id,source]);
    const visible:Operation[]=[];
    for (const row of rows) { try { assertClientAccess(request,row.target_client_id,["admin","colaborador"]); visible.push(row); } catch { /* Revoked destinations must not leak results. */ } }
    return {items:visible.map(result)};
  });
  for (const action of ["reserve","execute","cancel"] as const) app.post(`/clients/:clientAccountId/card-transfers/${action}`,async (request,reply) => {
    const {clientAccountId:source}=request.params as {clientAccountId:string};
    assertInternalAccess(request);
    const parsed=inputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({message:"Dados da transferência inválidos."});
    const input=parsed.data; await guard(request,source,input.targetClientId);
    if (source===input.targetClientId) throw app.httpErrors.badRequest("Escolha outro cliente.");
    const db=await app.db.getConnection();
    try {
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await db.beginTransaction();
      // Cancellation only closes a reservation; a removed column must not strand it.
      if (action!=="cancel") {
      const [clients]=await db.query<RowDataPacket[]>("SELECT id FROM client_accounts WHERE id IN (?,?) LOCK IN SHARE MODE",[source,input.targetClientId]);
      if (clients.length!==2) throw app.httpErrors.notFound("Cliente de origem ou destino indisponível.");
      if (input.columnId) {
        const [columns]=await db.query<RowDataPacket[]>("SELECT id FROM kanban_columns WHERE id=? AND client_account_id=? LOCK IN SHARE MODE",[input.columnId,input.targetClientId]);
        if (!columns.length) throw app.httpErrors.badRequest("A coluna não pertence ao cliente de destino.");
      }
      }
      // Insert wins a unique-key lock; all repeats serialize on the same persistent record.
      const [existing]=await db.query<Operation[]>("SELECT * FROM card_transfer_operations WHERE operation_key=?",[input.operationKey]);
      if (!existing.length && action==="reserve") {
        const card=await findCardById(db,input.sourceCardId);
        if (!card || card.clientAccountId!==source) throw app.httpErrors.notFound("Cartão original não encontrado.");
        await db.query("INSERT INTO card_transfer_operations(operation_key,actor_user_id,source_client_id,source_card_id,target_client_id,target_column_id,mode,source_fingerprint) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE operation_key=operation_key",[input.operationKey,request.auth!.user.id,source,input.sourceCardId,input.targetClientId,input.columnId,input.mode,fingerprint(card)]);
      }
      const [operations]=await db.query<Operation[]>("SELECT * FROM card_transfer_operations WHERE operation_key=? FOR UPDATE",[input.operationKey]);
      const op=operations[0];
      if (!op || op.actor_user_id!==request.auth!.user.id) throw app.httpErrors.notFound("Operação não encontrada para este usuário.");
      if (op.source_client_id!==source || op.source_card_id!==input.sourceCardId || op.target_client_id!==input.targetClientId || op.target_column_id!==input.columnId || op.mode!==input.mode) throw app.httpErrors.conflict("Esta chave já identifica outra transferência.");
      if (action==="cancel" && op.status==="pending") {
        await db.query("UPDATE card_transfer_operations SET status='cancelled' WHERE operation_key=?",[input.operationKey]);op.status="cancelled";
      }
      if (action==="execute" && op.status==="cancelled") throw app.httpErrors.conflict("Operação encerrada. Inicie uma nova transferência com outra chave.");
      if (action==="execute" && op.status==="pending") {
        await db.query("SELECT id FROM kanban_cards WHERE id=? AND client_account_id=? FOR UPDATE",[input.sourceCardId,source]);
        const card=await findCardById(db,input.sourceCardId);
        if (!card || card.clientAccountId!==source) throw app.httpErrors.conflict("O original não está disponível. Nenhuma nova cópia foi criada.");
        if (fingerprint(card)!==op.source_fingerprint) throw app.httpErrors.conflict("O original mudou. Revise o cartão e inicie uma nova operação.");
        if (input.mode==="move") {
          const [meta]=await db.query<RowDataPacket[]>("SELECT id FROM meta_scheduled_publications WHERE card_id=? FOR UPDATE",[card.id]);
          const [links]=await db.query<RowDataPacket[]>("SELECT id FROM approval_links WHERE card_id=? AND is_active=1 FOR UPDATE",[card.id]);
          if (meta.length || links.length) throw app.httpErrors.conflict("O original possui publicação Meta ou aprovação ativa. Resolva esses vínculos antes de mover; copiar continua disponível.");
        }
        // Copy only content. Never bring schedules, publication state, jobs or approval credentials.
        const payload=createCardSchema.parse({columnId:input.columnId,title:card.title,caption:card.caption,editorialBrief:card.editorialBrief,mediaType:card.mediaType,primaryMediaUrl:card.primaryMediaUrl,mediaUrls:card.mediaUrls,externalLinkUrl:card.externalLinkUrl,artType:card.artType,status:card.status,tags:card.tags,hashtags:card.hashtags,deadlineAt:card.deadlineAt instanceof Date?card.deadlineAt.toISOString().slice(0,19).replace("T"," "):card.deadlineAt, ...(card.scheduledTimeZone?{scheduledTimeZone:card.scheduledTimeZone}:{}),clientLabel:card.clientLabel,priorityLevel:card.priorityLevel,eventColor:card.eventColor,keepFiles:card.keepFiles});
        const created=await createCard(db,input.targetClientId,request.auth!.user.id,payload);
        if (!created) throw new Error("Não foi possível criar o destino.");
        if (input.mode==="move" && !await deleteCard(db,card.id)) throw app.httpErrors.conflict("O original não pôde ser removido. A criação foi desfeita.");
        await db.query("UPDATE card_transfer_operations SET status='completed',destination_card_id=?,completed_at=CURRENT_TIMESTAMP(3) WHERE operation_key=?",[created.id,input.operationKey]);
        op.status="completed";op.destination_card_id=created.id;
      }
      await db.commit();return {ok:true,operation:result(op)};
    } catch(error) {
      try { await db.rollback(); } catch(rollbackError) { app.log.error({err:rollbackError,operationKey:input.operationKey},"Transfer rollback could not be confirmed"); }
      if ((error as {statusCode?:number}).statusCode) throw error;
      app.log.error({err:error,operationKey:input.operationKey},"Card transfer failed");
      throw Object.assign(new Error("Não foi possível confirmar a transferência. Consulte o histórico e retome a mesma operação.",{cause:error}),{statusCode:500});
    } finally {db.release();}
  });
};
