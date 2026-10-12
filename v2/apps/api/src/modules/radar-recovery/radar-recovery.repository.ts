import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { McpRadarRepository } from "../mcp/mcp.radar.repository.js";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { radarSuggestionKeys } from "../radar-suggestions/radar-suggestions.service.js";
import type { RadarSuggestionInput } from "../radar-suggestions/radar-suggestions.schemas.js";
import { assertRecoveryPolicy, recoveryError, type RecoveryAttempt } from "./radar-recovery.policy.js";
const selection = "*, UNIX_TIMESTAMP(created_at)*1000 AS created_ms, UNIX_TIMESTAMP(finished_at)*1000 AS finished_ms";
function mapAttempt(r: RowDataPacket): RecoveryAttempt {
  return { id:r.id, sourceRunId:r.source_run_id, clientId:r.client_account_id, requestId:r.request_id, inputHash:r.input_hash, number:Number(r.attempt_number), status:r.status, createdSuggestion:!!r.suggestion_created, errorCode:r.error_code, suggestionId:r.suggestion_id, aiRunId:r.ai_run_id, createdAtMs:Number(r.created_ms), finishedAtMs:r.finished_ms == null ? null : Number(r.finished_ms) };
}
export type RecoveryClaim = { owned:true; attempt:RecoveryAttempt } | { owned:false; attempt:RecoveryAttempt } | { owned:false; existing:{id:string;status:string} };
export class RadarRecoveryRepository {
  constructor(private db: Pool) {}
  async list(clientId: string) {
    // Metadata only, bounded. Original source ledger is never updated by recovery.
    const [runs] = await this.db.query<RowDataPacket[]>("SELECT id,source_key,status,error_code,UNIX_TIMESTAMP(created_at)*1000 AS created_ms FROM radar_source_runs WHERE client_account_id=? AND status='failed' ORDER BY created_at DESC,id LIMIT 100",[clientId]);
    const items=[];
    for (const r of runs) {
      const [rows]=await this.db.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_recovery_attempts WHERE client_account_id=? AND source_run_id=? ORDER BY attempt_number`,[clientId,r.id]);
      const attempts=rows.map(mapAttempt).map(({inputHash,requestId,...a})=>a);
      items.push({runId:r.id,sourceHash:r.source_key,originalStatus:r.status,originalErrorCode:r.error_code,createdAtMs:Number(r.created_ms),attempts});
    }
    return items;
  }
  async claim(input:{clientId:string;runId:string;sourceHash:string;contextHash:string;requestId:string;inputHash:string;expectedAttempts:number;userId:string}):Promise<RecoveryClaim> {
    const c=await this.db.getConnection();
    try {
      await c.beginTransaction();
      // The client lock serializes both reservation and completion across administrators/processes.
      const [clients]=await c.query<RowDataPacket[]>("SELECT id FROM client_accounts WHERE id=? FOR UPDATE",[input.clientId]);
      if (!clients[0]) throw recoveryError("source_not_found",404);
      const [runs]=await c.query<RowDataPacket[]>("SELECT id,status,error_code,source_key FROM radar_source_runs WHERE id=? AND client_account_id=? FOR UPDATE",[input.runId,input.clientId]);
      const run=runs[0]; if (!run) throw recoveryError("source_not_found",404);
      if (run.source_key!==input.sourceHash) throw recoveryError("source_mismatch",400);
      const [rows]=await c.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_recovery_attempts WHERE source_run_id=? AND client_account_id=? ORDER BY attempt_number`,[input.runId,input.clientId]);
      const attempts=rows.map(mapAttempt), replay=attempts.find(a=>a.requestId===input.requestId);
      if (replay) {
        if(replay.inputHash!==input.inputHash) throw recoveryError("recovery_request_conflict");
        await c.commit();return {owned:false,attempt:replay};
      }
      if(run.status!=="failed") throw recoveryError("source_not_failed");
      const existing=await new McpRadarRepository(c as unknown as Pool).existingSource(input.clientId,input.sourceHash);
      if(existing) {await c.commit();return {owned:false,existing};}
      const [budget]=await c.query<RowDataPacket[]>("SELECT SUM(status='processing') AS active, SUM(UNIX_TIMESTAMP(created_at)>=UNIX_TIMESTAMP()-86400) AS daily, UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000 AS now_ms FROM radar_recovery_attempts WHERE client_account_id=?",[input.clientId]);
      assertRecoveryPolicy({originalStatus:run.status,originalError:run.error_code,attempts,expectedAttempts:input.expectedAttempts,clientActive:Number(budget[0].active)>0,clientDaily:Number(budget[0].daily),nowMs:Number(budget[0].now_ms)});
      const id=randomUUID(),number=attempts.length+1;
      await c.query("INSERT INTO radar_recovery_attempts(id,source_run_id,client_account_id,request_id,attempt_number,input_hash,context_hash,created_by_user_id,ai_consent,source_reviewed) VALUES(?,?,?,?,?,?,?,?,1,1)",[id,input.runId,input.clientId,input.requestId,number,input.inputHash,input.contextHash,input.userId]);
      const [created]=await c.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_recovery_attempts WHERE id=? AND client_account_id=?`,[id,input.clientId]);
      await c.commit();return {owned:true,attempt:mapAttempt(created[0])};
    } catch(e){await c.rollback();throw e;}finally{c.release();}
  }
  async result(clientId:string,id:string) {
    const [rows]=await this.db.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_recovery_attempts WHERE id=? AND client_account_id=?`,[id,clientId]);
    if(!rows[0]) throw recoveryError("source_not_found",404);
    return mapAttempt(rows[0]);
  }
  async linkAi(clientId:string,id:string,aiRunId:string) {
    const [result]=await this.db.query<ResultSetHeader>("UPDATE radar_recovery_attempts a JOIN brand_brain_ai_runs b ON b.id=? AND b.client_account_id=a.client_account_id SET a.ai_run_id=b.id WHERE a.id=? AND a.client_account_id=? AND a.status='processing' AND a.ai_run_id IS NULL",[aiRunId,id,clientId]);
    if(result.affectedRows!==1) throw recoveryError("recovery_processing");
  }
  async finish(clientId:string,id:string,userId:string,sourceHash:string,suggestion:RadarSuggestionInput|null) {
    const c=await this.db.getConnection();
    try {
      await c.beginTransaction();
      await c.query("SELECT id FROM client_accounts WHERE id=? FOR UPDATE",[clientId]);
      const [attempts]=await c.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_recovery_attempts WHERE id=? AND client_account_id=? FOR UPDATE`,[id,clientId]);
      if(!attempts[0] || attempts[0].status!=="processing") throw recoveryError("recovery_processing");
      const [runs]=await c.query<RowDataPacket[]>("SELECT status,source_key FROM radar_source_runs WHERE id=? AND client_account_id=? FOR UPDATE",[attempts[0].source_run_id,clientId]);
      if(!runs[0] || runs[0].status!=="failed" || runs[0].source_key!==sourceHash) throw recoveryError("source_not_failed");
      let suggestionId:string|null=null,created=false;
      const existing=await new McpRadarRepository(c as unknown as Pool).existingSource(clientId,sourceHash);
      if(existing) suggestionId=existing.id;
      else if(suggestion) {
        if(radarSuggestionKeys(suggestion).sourceKey!==sourceHash) throw recoveryError("source_mismatch",400);
        const result=await new RadarSuggestionsRepository(c as unknown as Pool).createPending(clientId,userId,suggestion,radarSuggestionKeys(suggestion));
        suggestionId=result.suggestion.id;created=result.created;
      }
      await c.query("UPDATE radar_recovery_attempts SET status=?,suggestion_id=?,suggestion_created=?,finished_at=CURRENT_TIMESTAMP(3) WHERE id=? AND client_account_id=? AND status='processing'",[suggestionId?"completed":"no_op",suggestionId,created?1:0,id,clientId]);
      await c.commit();
    }catch(e){await c.rollback();throw e;}finally{c.release();}
    return this.result(clientId,id);
  }
  async fail(clientId:string,id:string,errorCode:string) {
    await this.db.query("UPDATE radar_recovery_attempts SET status='failed',error_code=?,finished_at=CURRENT_TIMESTAMP(3) WHERE id=? AND client_account_id=? AND status='processing'",[errorCode,id,clientId]);
    return this.result(clientId,id);
  }
}
export type RadarRecoveryStore = Pick<RadarRecoveryRepository,keyof RadarRecoveryRepository>;
