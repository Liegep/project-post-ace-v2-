import { createHash } from "node:crypto";
import type { AuthContext } from "../auth/auth.types.js";
import { getClientScope, hasMembershipRole } from "../auth/auth.access.js";
import { BrandBrainAiService, BrandBrainAiError, brandBrainValidationError } from "../brand-brain-ai/brand-brain-ai.service.js";
import { AiProviderError } from "../../lib/openai-responses.js";
import { radarSourceKey } from "../radar-suggestions/radar-suggestions.service.js";
import { radarSuggestionInputSchema } from "../radar-suggestions/radar-suggestions.schemas.js";
import type { RadarRecoveryStore } from "./radar-recovery.repository.js";
import { recoveryError, RECOVERY_MAX_ATTEMPTS, RECOVERY_COOLDOWN_MS, RECOVERY_DAILY_CLIENT_LIMIT, type RecoveryAttempt } from "./radar-recovery.policy.js";
import { recoveryParams, recoveryRequest } from "./radar-recovery.schemas.js";
export function authorizeRecovery(auth:AuthContext|null,clientId:string) {
  if(!auth) throw new BrandBrainAiError(401,"unauthorized","Sessão administrativa obrigatória.");
  const scope=getClientScope(auth.user.globalRole,auth.user.id,auth.memberships);
  if(!auth.user.isActive || (auth.user.globalRole!=="super_admin" && (auth.user.globalRole!=="admin" || scope.mode!=="scoped" || !scope.clientIds.includes(clientId) || !hasMembershipRole(auth.memberships,clientId,["admin"])))) throw recoveryError("recovery_forbidden",403);
}
export function recoveryOutcome(a:RecoveryAttempt) {
  const outcome=a.status==="completed" ? (a.createdSuggestion?"created":"existing") : a.status;
  const messages={created:"Sugestão pendente criada para revisão.",existing:"Sugestão já existente; nenhuma duplicação.",no_op:"Nenhuma sugestão necessária.",failed:"A recuperação falhou. Consulte o código; uma nova tentativa exige nova revisão.",processing:"Recuperação em andamento. Não repita a chamada com outro identificador."};
  return {outcome,attemptId:a.id,attemptNumber:a.number,status:a.status,suggestionId:a.suggestionId,errorCode:a.errorCode,aiRunId:a.aiRunId,message:messages[outcome]};
}
export class RadarRecoveryService {
  constructor(private store:RadarRecoveryStore,private ai:BrandBrainAiService,private model:string,private enabled:boolean) {}
  async list(auth:AuthContext|null,clientId:string) {
    authorizeRecovery(auth,clientId);
    // Inspection remains possible after disabling writes; a missing table fails safely.
    try{return {enabled:this.enabled,requiresSourceResend:true,policy:{maxRecoveries:RECOVERY_MAX_ATTEMPTS,cooldownMs:RECOVERY_COOLDOWN_MS,dailyClientLimit:RECOVERY_DAILY_CLIENT_LIMIT},sources:await this.store.list(clientId)};}catch{throw recoveryError("recovery_storage_unavailable",503);}
  }
  async recover(auth:AuthContext|null,rawParams:unknown,rawBody:unknown) {
    const params=recoveryParams.safeParse(rawParams);
    if(!params.success) throw new BrandBrainAiError(400,"invalid_input","Cliente ou execução inválidos.");
    const clientId=params.data.clientId.toLowerCase(),runId=params.data.runId.toLowerCase();authorizeRecovery(auth,clientId);
    if(!this.enabled) throw recoveryError("recovery_disabled",503);
    const parsed=recoveryRequest.safeParse(rawBody);
    if(!parsed.success) throw new BrandBrainAiError(400,"invalid_input","Reenvie a fonte completa, revisão e consentimento explícitos.");
    const {source,expectedAttempts}=parsed.data;const requestId=parsed.data.requestId.toLowerCase();
    if(source.sourceDate?.includes("T")) source.sourceDate=new Date(source.sourceDate).toISOString();
    const available=this.ai.availability();
    if(!available.enabled) throw new BrandBrainAiError(503,"disabled",available.reason!);
    let context;
    try{context=await this.ai.context(clientId);}catch(e){if(e instanceof BrandBrainAiError) throw e;throw recoveryError("recovery_storage_unavailable",503);}
    const sourceHash=radarSourceKey(source);
    const inputHash=createHash("sha256").update(JSON.stringify(source)).digest("hex");
    let claim;
    try{claim=await this.store.claim({clientId,runId,sourceHash,inputHash,requestId,expectedAttempts,contextHash:context.contextHash,userId:auth!.user.id});}
    catch(e){if(e instanceof BrandBrainAiError) throw e;throw recoveryError("recovery_storage_unavailable",503);}
    if(!claim.owned) return "attempt" in claim ? recoveryOutcome(claim.attempt) : {outcome:"existing",attemptId:null,attemptNumber:null,errorCode:null,aiRunId:null,status:claim.existing.status,suggestionId:claim.existing.id,message:"Sugestão já existente; nenhuma nova chamada à IA."};
    const attemptId=claim.attempt.id;
    try {
      const result=await this.ai.generateRadarSuggestion({clientId,...source},context,id=>this.store.linkAi(clientId,attemptId,id));
      let suggestion=null;
      if(result.shouldCreate) {
        const {format,...fields}=result.suggestion;
        const {sourceSummary,...sourceMetadata}=source;
        const parsedSuggestion=radarSuggestionInputSchema.safeParse({...fields,contentType:format,...sourceMetadata,aiModel:this.model,brandBrainVersion:context.brandBrainVersion,brandBrainContextHash:context.contextHash});
        // sourceSummary is input only and must never be persisted as an extra suggestion field.
        if(!parsedSuggestion.success) throw brandBrainValidationError("schema_invalid");
        suggestion=parsedSuggestion.data;
      }
      return recoveryOutcome(await this.store.finish(clientId,attemptId,auth!.user.id,sourceHash,suggestion));
    }catch(e) {
      // A commit may have succeeded even if a subsequent read failed. Reconcile before marking failed.
      try{const saved=await this.store.result(clientId,attemptId);if(saved.status!=="processing") return recoveryOutcome(saved);}catch{throw recoveryError("recovery_storage_unavailable",503);}
      const code=e instanceof BrandBrainAiError || e instanceof AiProviderError ? e.code : "storage_unavailable";
      try{return recoveryOutcome(await this.store.fail(clientId,attemptId,code));}catch{throw recoveryError("recovery_storage_unavailable",503);}
    }
  }
}
