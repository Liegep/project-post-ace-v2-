import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { archiveCardsDueForPublication } from "../modules/cards/cards.service.js";

const ARCHIVE_CHECK_INTERVAL_MS = 60_000;

async function scheduledCardArchiverPlugin(app: FastifyInstance) {
  let running = false;
  let timer: NodeJS.Timeout | undefined;

  const archiveDueCards = async () => {
    if (running) return;
    running = true;

    try {
      const archived = await archiveCardsDueForPublication(app);
      if (archived > 0) {
        app.log.info({ archived }, "Scheduled cards archived after their publication time");
      }
    } catch (error) {
      // A temporary database failure must not stop the API or future checks.
      app.log.error(error, "Unable to archive scheduled cards");
    } finally {
      running = false;
    }
  };

  app.addHook("onReady", async () => {
    // Catch up immediately after a restart, then keep checking while the API is alive.
    await archiveDueCards();
    timer = setInterval(() => {
      void archiveDueCards();
    }, ARCHIVE_CHECK_INTERVAL_MS);
    timer.unref();
  });

  app.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
  });
}

export const scheduledCardArchiverPluginRegistered = fp(scheduledCardArchiverPlugin, {
  name: "scheduled-card-archiver-plugin",
  dependencies: ["db-plugin"],
});
