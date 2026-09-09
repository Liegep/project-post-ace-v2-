import { buildApp } from "./app.js";

async function start() {
  const app = await buildApp();

  const closeGracefully = async (signal: string) => {
    app.log.info({ signal }, "Shutting down gracefully");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Graceful shutdown failed");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => { void closeGracefully("SIGTERM"); });
  process.once("SIGINT", () => { void closeGracefully("SIGINT"); });

  try {
    await app.listen({
      port: app.appEnv.API_PORT,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start().catch((error: unknown) => {
  console.error("Unable to initialize the API", error);
  process.exit(1);
});
