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
    // Hostinger limits how many new database connections this user may open
    // per hour. Keep a small, persistent pool and reuse it across requests.
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 3_600_000,
    connectTimeout: 5_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    waitForConnections: true,
    // Never let an unavailable database build an unlimited in-memory queue.
    queueLimit: 50
  });

  app.decorate("db", pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });
}

export const dbPluginRegistered = fp(dbPlugin, {
  name: "db-plugin"
});
