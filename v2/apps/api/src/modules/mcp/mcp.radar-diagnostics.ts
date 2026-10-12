import type { RowDataPacket } from "mysql2/promise";
import type { FastifyInstance } from "fastify";
import type { AuthContext } from "../auth/auth.types.js";
import { BrandBrainAiRepository } from "../brand-brain-ai/brand-brain-ai.repository.js";
import { radarInput } from "../brand-brain-ai/brand-brain-ai.schemas.js";
import { radarSourceKey } from "../radar-suggestions/radar-suggestions.service.js";
import { BrandBrainAiService, BrandBrainAiError } from "../brand-brain-ai/brand-brain-ai.service.js";
import { mcpClientRadarContext } from "./mcp.read.service.js";
import { MCP_PAUTA_CREATE_SCOPE, MCP_READ_SCOPE } from "./mcp.security.js";
export async function radarConnectionDiagnostics(app:FastifyInstance,auth:AuthContext,clientId:string,scopes:string[],consent:boolean) {
  if(!auth.user.isActive || auth.user.globalRole==="cliente") throw new Error("Sessão interna ativa obrigatória.");
  try {
  const context=await mcpClientRadarContext(app.db,auth,clientId);
  const requiredStorage=["radar_source_runs","radar_suggestions","brand_brain_ai_runs","brand_brain_versions"];
  const [tables]=await app.db.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?,?,?)",requiredStorage);
  const present=new Set(tables.map(t=>t.TABLE_NAME));
  const missingStorage=requiredStorage.filter(name=>!present.has(name));
  const availability=new BrandBrainAiService(new BrandBrainAiRepository(app.db),app.appEnv).availability();
  const createScope=scopes.includes(MCP_PAUTA_CREATE_SCOPE),readScope=scopes.includes(MCP_READ_SCOPE);
  const brain=context.brandBrain && typeof context.brandBrain==="object" ? context.brandBrain as Record<string,unknown> : {};
  const pillars=Array.isArray(brain.pillars) ? brain.pillars : [];
  return {
    client:context.client,clientAccessible:true,planningReadGranted:readScope,pautaCreateGranted:createScope,
    radarAiConsent:consent,creationToolAvailable:createScope && consent,
    aiEnabled:availability.enabled,aiConfigurationReason:availability.reason,
    canSubmit:readScope && createScope && consent && availability.enabled && !missingStorage.length,
    requiredTablesPresent:!missingStorage.length,missingStorage,databaseWritesTested:false,
    publishedPillarCount:pillars.filter(p=>p && typeof p.name==="string" && p.name.trim()).length,
    longPillarCount:pillars.filter(p=>p && typeof p.name==="string" && p.name.length>120).length,
    editorialRuleCount:Array.isArray(brain.avoidWords) ? brain.avoidWords.filter(t=>typeof t==="string" && t.trim()).length : 0,
    providerTested:false,sourceSubmitted:false,
    note:"Diagnóstico apenas desta conexão. Não testa o provedor, não chama IA e não comprova que outro Radar enviou uma fonte.",
  };
  }catch{throw new BrandBrainAiError(503,"preflight_unavailable","Não foi possível verificar o cliente ou o armazenamento desta conexão.");}
}

export async function radarSourcePreflight(app:FastifyInstance,auth:AuthContext,clientId:string,raw:unknown,scopes:string[],consent:boolean) {
  const parsed=radarInput.safeParse(raw);
  if(!parsed.success) throw new BrandBrainAiError(400,"invalid_input","Dados da fonte inválidos. Nenhuma análise ou sugestão foi feita.");
  if(parsed.data.sourceDate?.includes("T")) parsed.data.sourceDate=new Date(parsed.data.sourceDate).toISOString();
  const connection=await radarConnectionDiagnostics(app,auth,clientId,scopes,consent);
  return {mode:"validation_only",sourceValid:true,sourceHash:radarSourceKey(parsed.data),canSubmit:connection.canSubmit,connection,sourceSubmitted:false,providerTested:false};
}
