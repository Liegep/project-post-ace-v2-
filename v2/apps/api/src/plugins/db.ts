import fp from "fastify-plugin";
import mysql from "mysql2/promise";
import type { PoolConnection as CallbackPoolConnection } from "mysql2";
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
    connectionLimit: 5,
    maxIdle: 5,
    idleTimeout: 3_600_000,
    connectTimeout: 5_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    waitForConnections: true,
    // Never let an unavailable database build an unlimited in-memory queue.
    queueLimit: 50
  });

  // Hostinger's global wait_timeout is only 20 seconds. Raise it for each
  // pooled session so connections are reused instead of reopened after a brief pause.
  pool.on("connection", (connection) => {
    (connection as unknown as CallbackPoolConnection).query("SET SESSION wait_timeout = 3600", (error) => {
      if (error) app.log.warn(error, "Unable to extend database session timeout");
    });
  });

  app.decorate("db", pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });
}

export const dbPluginRegistered = fp(dbPlugin, {
  name: "db-plugin"
});
