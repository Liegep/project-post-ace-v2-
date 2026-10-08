import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { processDueMetaPublications } from "../modules/meta/meta.service.js";

const META_PUBLICATION_INTERVAL_MS = 60_000;

async function metaPublicationWorker(app: FastifyInstance) {
  let running = false;
  let timer: NodeJS.Timeout | undefined;

  const processDue = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processDueMetaPublications(app, 10);
      if (result.examined > 0) app.log.info(result, "Meta scheduled publications processed");
    } catch (error) {
      app.log.error(error, "Unable to process Meta scheduled publications");
    } finally {
      running = false;
    }
  };

  app.addHook("onReady", async () => {
    void processDue();
    timer = setInterval(() => void processDue(), META_PUBLICATION_INTERVAL_MS);
    timer.unref();
  });

  app.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
  });
}

export const metaPublicationWorkerRegistered = fp(metaPublicationWorker, {
  name: "meta-publication-worker",
  dependencies: ["db-plugin"],
});
