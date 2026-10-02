import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { generateRecurringInvoices } from "../modules/invoices/invoice-recurring.service.js";

const RECURRING_CHECK_INTERVAL_MS = 60 * 60 * 1000;
async function invoiceRecurringWorker(app: FastifyInstance) {
  let running: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;
  const processDue = () => {
    if (running) return running;
    running = (async () => {
      try {
        const result = await generateRecurringInvoices(app.db, new Date(), app.appEnv.APP_TIMEZONE);
        if (result.failedSourceIds.length) app.log.error(result, "Some recurring invoices could not be generated; they will be retried");
        if (result.created > 0) app.log.info(result, "Recurring invoices generated");
      } catch (error) { app.log.error(error, "Unable to generate recurring invoices"); }
    })().finally(() => { running = undefined; });
    return running;
  };
  app.addHook("onReady", async () => {
    await processDue();
    timer = setInterval(() => void processDue(), RECURRING_CHECK_INTERVAL_MS);
    timer.unref();
  });
  app.addHook("onClose", async () => { if (timer) clearInterval(timer); await running; });
}
export const invoiceRecurringWorkerRegistered = fp(invoiceRecurringWorker, {
  name: "invoice-recurring-worker", dependencies: ["db-plugin"],
});
