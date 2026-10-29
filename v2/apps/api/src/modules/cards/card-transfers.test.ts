import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { cardTransferRoutes } from "./card-transfers.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";

const input={operationKey:"55555555-5555-4555-8555-555555555555",sourceCardId:"11111111-1111-4111-8111-111111111111",targetClientId:"22222222-2222-4222-8222-222222222222",columnId:null,mode:"copy"};
const source="33333333-3333-4333-8333-333333333333";
for(const scenario of ["disabled","anonymous","invalid","schema-absent"] as const) test(`transfer boundary: ${scenario}`,async()=>{
  const app=Fastify();let reads=0;
  app.decorate("appEnv",{CARD_TRANSFERS_ENABLED:scenario==="schema-absent"} as never);
  app.decorate("db",{query:async()=>{reads++;return [[]];},getConnection:()=>{throw Error("Must never mutate");}} as never);
  await app.register(httpErrorsPluginRegistered);
  app.addHook("onRequest",async request=>{request.auth=scenario==="anonymous"?null:{user:{id:"user",globalRole:"super_admin"},memberships:[]} as never;});
  await app.register(cardTransferRoutes,{prefix:"/api"});
  const response=await app.inject({method:"POST",url:`/api/clients/${source}/card-transfers/reserve`,payload:scenario==="invalid"?{...input,operationKey:"not-a-uuid"}:input});
  assert.equal(response.statusCode,scenario==="anonymous"?401:scenario==="invalid"?400:503,response.body);
  assert.equal(reads,scenario==="schema-absent"?2:0);
  await app.close();
});
