// Explicit preview only. Never import the application, startup jobs or schema preparation.
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import mysql from "mysql2/promise";
import { buildProducedPostRepairPreview, readProducedPostRepairSnapshot } from "../modules/cards/produced-post-repair-preview.js";

async function main() {
  if (process.argv.slice(2).join(" ") !== "--preview" || !process.env.APP_ENV_FILE) {
    throw Error("Use --preview com APP_ENV_FILE explícito. Não existe modo de aplicação.");
  }
  const env=parse(readFileSync(process.env.APP_ENV_FILE));
  if (!env.DB_HOST || !env.DB_USER || !env.DB_NAME) throw Error("Configuração explícita do banco incompleta.");
  const db=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,connectTimeout:5000,jsonStrings:true});
  try {
    await db.query("SET SESSION TRANSACTION READ ONLY");
    await db.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    const [[check]]=await db.query<mysql.RowDataPacket[]>("SELECT @@tx_read_only AS readOnly");
    if (!Number(check.readOnly)) throw Error("Transação somente de leitura não confirmada.");
    const preview=buildProducedPostRepairPreview(await readProducedPostRepairSnapshot(db));
    console.log(JSON.stringify(preview,null,2));
    await db.rollback();
  } finally {await db.end();}
}
main().catch(error => {console.error(`Prévia não concluída (${error.code || "PREVIEW_BLOCKED"}). Nenhuma reparação foi solicitada.`);process.exitCode=1;});
