import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { BriefRepository } from "./brief.repository.js";
import { briefFoundationRoutes } from "./brief.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { templateDeleteSchema } from "./brief.schemas.js";
const id="11111111-1111-4111-8111-111111111111", actor="22222222-2222-4222-8222-222222222222";
function fixture(options:{dependency?:boolean;foreignKey?:boolean;missing?:boolean}={}) {
 const calls:string[]=[];
 const row:any={id,name:"Template",description:"Preserved",version:3,status:"archived",category:"branding",locale:"sv",introduction:"Instructions",fields_json:[{id:"q",type:"short",label:"Question",required:true,validation:{maxLength:100}}]};
 const db:any={getConnection:async()=>db,
  beginTransaction:async()=>{calls.push("BEGIN");},commit:async()=>{calls.push("COMMIT");},rollback:async()=>{calls.push("ROLLBACK");},release:()=>{calls.push("RELEASE");},
  query:async(sql:string,args:any[]=[])=>{
   calls.push(sql);
   if(sql.startsWith("SELECT t.*"))return [options.missing?[]:[structuredClone(row)]];
   if(sql.startsWith("SELECT id FROM design_brief_instances"))return [options.dependency?[{id:"dependency"}]:[]];
   if(sql.startsWith("INSERT INTO design_brief_template_metadata")){row.status=args[5];row.version++;}
   if(sql.startsWith("DELETE FROM design_brief_template_versions")&&options.foreignKey)throw Object.assign(Error("FK"),{code:"ER_ROW_IS_REFERENCED_2"});
   return [{affectedRows:1}];
  }
 };return {repo:new BriefRepository(db),db,calls};
}
test("restore preserves definitions and rejects stale versions before writing",async()=>{
 const {repo,calls}=fixture();const restored=await repo.restoreTemplate(id,actor,3);
 assert.equal(restored.status,"active");assert.equal(restored.version,4);assert.equal(restored.description,"Preserved");assert.equal(restored.form.locale,"sv");assert.deepEqual(restored.form.fields[0].validation,{maxLength:100});
 await assert.rejects(repo.archiveTemplate(id,actor,3),{statusCode:409});assert.equal(calls.at(-2),"ROLLBACK");
});
test("unused template is physically deleted in one transaction after dependency locking",async()=>{
 const {repo,calls}=fixture();assert.deepEqual(await repo.deleteTemplate(id,3),{ok:true});
 assert.match(calls[1],/FOR UPDATE$/);assert.match(calls[2],/design_brief_instances.*FOR UPDATE$/);
 assert.deepEqual(calls.slice(3),["DELETE FROM design_brief_template_metadata WHERE template_id=?","DELETE FROM design_brief_template_versions WHERE template_id=?","DELETE FROM design_brief_templates WHERE id=?","COMMIT","RELEASE"]);
});
test("dependencies block deletion before writes and FK failure rolls back the transaction",async()=>{
 const used=fixture({dependency:true});await assert.rejects(used.repo.deleteTemplate(id,3),{statusCode:409,message:/briefs vinculados/});assert.ok(!used.calls.some(c=>c.startsWith("DELETE")));assert.ok(used.calls.includes("ROLLBACK"));
 const fk=fixture({foreignKey:true});await assert.rejects(fk.repo.deleteTemplate(id,3),{statusCode:409,message:/registros vinculados/});assert.ok(fk.calls.includes("ROLLBACK"));assert.ok(!fk.calls.includes("COMMIT"));assert.ok(!fk.calls.includes("DELETE FROM design_brief_templates WHERE id=?"));
});
test("missing and stale templates cannot be deleted",async()=>{
 const stale=fixture();await assert.rejects(stale.repo.deleteTemplate(id,2),{statusCode:409});assert.ok(!stale.calls.some(c=>c.startsWith("DELETE")));
 const missing=fixture({missing:true});await assert.rejects(missing.repo.deleteTemplate(id,3),{statusCode:404});
});
test("DELETE payload requires explicit intent and positive current version",()=>{
 for(const input of [{expectedVersion:3},{expectedVersion:3,confirmation:false},{expectedVersion:0,confirmation:"DELETE"},{confirmation:"DELETE"}])assert.equal(templateDeleteSchema.safeParse(input).success,false);
 assert.ok(templateDeleteSchema.safeParse({expectedVersion:3,confirmation:"DELETE"}).success);
});
test("HTTP lifecycle endpoints authorize only super_admin before touching the database",async()=>{
 const {db,calls}=fixture();const app=Fastify();app.decorate("db",db);app.decorate("appEnv",{} as any);await app.register(httpErrorsPluginRegistered);
 let auth:any;app.addHook("onRequest",async r=>{r.auth=auth;});await app.register(briefFoundationRoutes);
 try {
  for(const role of [null,"cliente","colaborador","admin"]) {
   auth=role?{user:{id:actor,globalRole:role},memberships:[]}:null;
   for(const [method,url] of [["DELETE",`/briefs/templates/${id}`],["POST",`/briefs/templates/${id}/restore`],["POST",`/briefs/templates/${id}/archive`]] as const) {
    assert.equal((await app.inject({method,url,payload:{expectedVersion:3,confirmation:"DELETE"}})).statusCode,role?403:401);
   }
  }
  assert.equal(calls.length,0);
  auth={user:{id:actor,globalRole:"super_admin"},memberships:[]};
  assert.equal((await app.inject({method:"DELETE",url:`/briefs/templates/${id}`,payload:{expectedVersion:3}})).statusCode,400);
  assert.equal(calls.length,0);
  assert.equal((await app.inject({method:"DELETE",url:`/briefs/templates/${id}`,payload:{expectedVersion:3,confirmation:"DELETE"}})).statusCode,200);
 }finally{await app.close();}
});
