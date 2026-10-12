import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { BrandBrainAiRepository } from "../brand-brain-ai/brand-brain-ai.repository.js";
import { BrandBrainAiService, BrandBrainAiError } from "../brand-brain-ai/brand-brain-ai.service.js";
import { RadarRecoveryRepository } from "./radar-recovery.repository.js";
import { RadarRecoveryService } from "./radar-recovery.service.js";
export const radarRecoveryRoutes:FastifyPluginAsync<{service?:RadarRecoveryService}> = async(app,options)=>{
  const service=options.service ?? new RadarRecoveryService(new RadarRecoveryRepository(app.db),new BrandBrainAiService(new BrandBrainAiRepository(app.db,true),app.appEnv),app.appEnv.BRAND_BRAIN_AI_MODEL,app.appEnv.RADAR_RECOVERY_ENABLED);
  // No DDL, backfill, scheduler, retry loop, or MCP write tool. Explicit administrator POST only.
  app.get("/clients/:clientId/radar-recovery",async request=>{
    const parsed=z.object({clientId:z.string().uuid()}).strict().safeParse(request.params);
    if(!parsed.success) throw new BrandBrainAiError(400,"invalid_input","Cliente inválido.");
    return service.list(request.auth,parsed.data.clientId.toLowerCase());
  });
  app.post("/clients/:clientId/radar-recovery/:runId",{bodyLimit:64*1024},async request=>service.recover(request.auth,request.params,request.body));
};
