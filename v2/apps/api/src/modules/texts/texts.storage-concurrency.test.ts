import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "mysql2/promise";
import { listTexts } from "./texts.repository.js";

test("concurrent first reads share schema preparation and all return content",async()=>{
  let cover=false, additions=0;
  const db={query:async(sql:string)=>{
    await new Promise(resolve=>setTimeout(resolve,2));
    if(sql.includes("SHOW COLUMNS"))return [[...(sql.includes("tags_json")||cover?[{Field:"present"}]:[])]];
    if(sql.startsWith("ALTER")){additions++;if(cover)throw Object.assign(Error("duplicate"),{code:"ER_DUP_FIELDNAME"});cover=true;return [{}];}
    return [[]];
  }} as unknown as Pool;
  const results=await Promise.all(Array.from({length:8},()=>listTexts(db,"synthetic")));
  assert.equal(additions,1);assert.ok(results.every(rows=>rows.length===0));
});
test("a verified cross-pool duplicate race is recoverable",async()=>{
  let wonElsewhere=false;
  const db={query:async(sql:string)=>{
    if(sql.includes("SHOW COLUMNS"))return [[...(sql.includes("tags_json")||wonElsewhere?[{Field:"present"}]:[])]];
    if(sql.startsWith("ALTER")){wonElsewhere=true;throw Object.assign(Error("duplicate"),{code:"ER_DUP_FIELDNAME"});}
    return [[]];
  }} as unknown as Pool;
  assert.deepEqual(await listTexts(db,"synthetic"),[]);
});
test("DDL permission errors propagate and failed preparation can be retried",async()=>{
  let allowed=false, attempts=0;
  const db={query:async(sql:string)=>{
    if(sql.includes("SHOW COLUMNS"))return [[...(sql.includes("tags_json")?[{Field:"present"}]:[])]];
    if(sql.startsWith("ALTER")){attempts++;if(!allowed)throw Object.assign(Error("denied"),{code:"ER_TABLEACCESS_DENIED_ERROR"});return [{}];}
    return [[]];
  }} as unknown as Pool;
  await assert.rejects(listTexts(db,"synthetic"),{code:"ER_TABLEACCESS_DENIED_ERROR"});allowed=true;
  assert.deepEqual(await listTexts(db,"synthetic"),[]);assert.equal(attempts,2);
});
