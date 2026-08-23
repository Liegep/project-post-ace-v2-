import fp from "fastify-plugin";
import mysql from "mysql2/promise";
import type { FastifyInstance } from "fastify";

async function dbPlugin(app: FastifyInstance) {
  const pool = mysql.createPool({
    host: app.appEnv.DB_HOST,
    port: app.appEnv.DB_PORT,
    user: app.appEnv.DB_USER,
    password: app.appEnv.DB_PASSWORD,
    database: app.appEnv.DB_NAME,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
  });

  app.decorate("db", pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });
}

export const dbPluginRegistered = fp(dbPlugin, {
  name: "db-plugin"
});
