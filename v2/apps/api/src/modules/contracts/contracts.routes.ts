import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertSuperAdmin } from "../auth/auth.access.js";
import { recordClientFeedbackEvent } from "../clients/client-feedback.service.js";
import { acceptContract, createContract, createContractTemplate, deleteContract, deleteContractTemplate, ensureContractTables, findContract, findPendingContract, listContracts, listContractTemplates, updateContract } from "./contracts.repository.js";
import { createContractSchema, createContractTemplateSchema, updateContractSchema } from "./contracts.schemas.js";

export const contractRoutes: FastifyPluginAsync = async (app) => {
  await ensureContractTables(app.db);
  app.get("/contracts", async (request) => { assertSuperAdmin(request); return {items:await listContracts(app.db,null)}; });
  app.post("/contracts", async (request) => { assertSuperAdmin(request); const input=createContractSchema.parse(request.body); return {contract:await createContract(app.db,request.auth!.user.id,input)}; });
  app.patch("/contracts/:contractId", async (request) => { assertSuperAdmin(request); const {contractId}=request.params as {contractId:string}; const current=await findContract(app.db,contractId); if(!current) throw app.httpErrors.notFound("Contrato não encontrado."); const input=updateContractSchema.parse(request.body); return {contract:await updateContract(app.db,contractId,input)}; });
  app.delete("/contracts/:contractId", async (request) => { assertSuperAdmin(request); const {contractId}=request.params as {contractId:string}; const current=await findContract(app.db,contractId); if(!current) throw app.httpErrors.notFound("Contrato não encontrado."); return {ok:await deleteContract(app.db,contractId)}; });
  app.get("/contract-templates", async (request) => { assertSuperAdmin(request); return {items:await listContractTemplates(app.db)}; });
  app.post("/contract-templates", async (request) => { assertSuperAdmin(request); return {template:await createContractTemplate(app.db,request.auth!.user.id,createContractTemplateSchema.parse(request.body))}; });
  app.delete("/contract-templates/:templateId", async (request) => { assertSuperAdmin(request); const {templateId}=request.params as {templateId:string}; return {ok:await deleteContractTemplate(app.db,templateId)}; });
  app.get("/portal/accounts/:clientAccountId/contracts/pending", async (request) => { const {clientAccountId}=request.params as {clientAccountId:string}; assertClientAccess(request,clientAccountId,["admin","colaborador","cliente"]); return {contract:await findPendingContract(app.db,clientAccountId)}; });
  app.post("/portal/accounts/:clientAccountId/contracts/:contractId/accept", async (request) => { const {clientAccountId,contractId}=request.params as {clientAccountId:string;contractId:string}; assertClientAccess(request,clientAccountId,["admin","colaborador","cliente"]); const current=await findContract(app.db,contractId); if(!current||current.clientAccountId!==clientAccountId) throw app.httpErrors.notFound("Contrato não encontrado nesta conta."); const contract=await acceptContract(app.db,contractId,request.auth!.user.id,request.ip); await recordClientFeedbackEvent(app.db,{clientAccountId,clientName:current.clientName,sourceType:"contract",sourceId:contractId,activityType:"contract_accepted",title:current.title,detail:current.contractType||"Contrato aceito pelo cliente"}); return {ok:true,contract}; });
};
