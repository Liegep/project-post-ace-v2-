import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyFormbody from "@fastify/formbody";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./config/env.js";
import { dbPluginRegistered } from "./plugins/db.js";
import { authPluginRegistered } from "./plugins/auth.js";
import { httpErrorsPluginRegistered } from "./plugins/http-errors.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { clientRoutes } from "./modules/clients/clients.routes.js";
import { columnRoutes } from "./modules/columns/columns.routes.js";
import { cardRoutes } from "./modules/cards/cards.routes.js";
import { portalRoutes } from "./modules/portal/portal.routes.js";
import { commentRoutes } from "./modules/comments/comments.routes.js";
import { approvalRoutes } from "./modules/approvals/approvals.routes.js";
import { reconcileApprovedCardColumns } from "./modules/approvals/approvals.service.js";
import { calendarRoutes } from "./modules/calendar/calendar.routes.js";
import { demoRoutes } from "./modules/demo/demo.routes.js";
import { uploadRoutes } from "./modules/uploads/uploads.routes.js";
import { prepareUploadStorage } from "./modules/uploads/uploads.storage.js";
import { tagRoutes } from "./modules/tags/tags.routes.js";
import { hashtagRoutes } from "./modules/hashtags/hashtags.routes.js";
import { agendaRoutes } from "./modules/agenda/agenda.routes.js";
import { textRoutes } from "./modules/texts/texts.routes.js";
import { reportRoutes } from "./modules/reports/reports.routes.js";
import { invoiceRoutes } from "./modules/invoices/invoices.routes.js";
import { contractRoutes } from "./modules/contracts/contracts.routes.js";
import { archiveCardsDueForPublication } from "./modules/cards/cards.service.js";
import { ensureMcpStorage } from "./modules/mcp/mcp.repository.js";
import { mcpOAuthRoutes } from "./modules/mcp/mcp.oauth.routes.js";
import { mcpRoutes } from "./modules/mcp/mcp.routes.js";
import { timeTrackingRoutes } from "./modules/time-tracking/time-tracking.routes.js";
import { proposalRoutes } from "./modules/proposals/proposals.routes.js";
import { designBriefRoutes } from "./modules/design-briefs/design-briefs.routes.js";
import { dashboardNotesRoutes } from "./modules/dashboard-notes/dashboard-notes.routes.js";

export async function buildApp() {
  const appEnv = loadEnv();
  const app = Fastify({
    logger: appEnv.NODE_ENV === "development"
  });

  app.decorate("appEnv", appEnv);

  await app.register(httpErrorsPluginRegistered);
  await app.register(fastifyFormbody);

  const uploadStorage = await prepareUploadStorage(appEnv.UPLOAD_DIR);
  if (appEnv.NODE_ENV === "production" && !uploadStorage.persistent) {
    app.log.warn("UPLOAD_DIR is release-local; configure an absolute directory before storing production media");
  }
  if (uploadStorage.migrated > 0) {
    app.log.info({ migrated: uploadStorage.migrated }, "Legacy uploads migrated to persistent storage");
  }

  if (appEnv.DEMO_MODE) {
    await app.register(demoRoutes, { prefix: "/api" });
  } else {
    await app.register(dbPluginRegistered);
    await app.register(authPluginRegistered);
    await ensureMcpStorage(app.db);
    await app.register(mcpOAuthRoutes);
    await app.register(mcpRoutes);

    await app.register(healthRoutes, { prefix: "/api" });
    await app.register(authRoutes, { prefix: "/api" });
    await app.register(clientRoutes, { prefix: "/api" });
    await app.register(columnRoutes, { prefix: "/api" });
    await app.register(cardRoutes, { prefix: "/api" });
    await app.register(portalRoutes, { prefix: "/api" });
    await app.register(commentRoutes, { prefix: "/api" });
    await app.register(approvalRoutes, { prefix: "/api" });
    await app.register(calendarRoutes, { prefix: "/api" });
    await app.register(uploadRoutes, { prefix: "/api" });
    await app.register(tagRoutes, { prefix: "/api" });
    await app.register(hashtagRoutes, { prefix: "/api" });
    await app.register(agendaRoutes, { prefix: "/api" });
    await app.register(textRoutes, { prefix: "/api" });
    await app.register(reportRoutes, { prefix: "/api" });
    await app.register(invoiceRoutes, { prefix: "/api" });
    await app.register(contractRoutes, { prefix: "/api" });
    await app.register(timeTrackingRoutes, { prefix: "/api" });
    await app.register(proposalRoutes, { prefix: "/api" });
    await app.register(designBriefRoutes, { prefix: "/api" });
    await app.register(dashboardNotesRoutes, { prefix: "/api" });

    const archiveDueCards = async () => {
      try {
        const archived = await archiveCardsDueForPublication(app);
        if (archived > 0) app.log.info({ archived }, "Scheduled cards archived automatically");
      } catch (error) {
        app.log.error(error, "Unable to archive scheduled cards");
      }
    };
    await archiveDueCards();
    try {
      const organized = await reconcileApprovedCardColumns(app);
      if (organized > 0) app.log.info({ organized }, "Approved cards organized into their client columns");
    } catch (error) {
      app.log.error(error, "Unable to organize approved cards");
    }
    // Keep scheduled publication responsive without requiring a browser refresh.
    const scheduler = setInterval(() => { void archiveDueCards(); }, 5_000);
    scheduler.unref();
    app.addHook("onClose", async () => clearInterval(scheduler));
  }

  if (appEnv.NODE_ENV === "production") {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const webDirectory = path.resolve(currentDirectory, "../../web/dist");

    await app.register(fastifyStatic, {
      root: webDirectory,
      prefix: "/",
      wildcard: false,
      index: false,
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api")) {
        return reply.type("text/html; charset=utf-8").sendFile("index.html");
      }
      throw app.httpErrors.notFound("Rota não encontrada.");
    });
  } else {
    app.get("/", async () => ({
      ok: true,
      service: appEnv.APP_NAME,
      api: appEnv.API_URL,
      demoMode: appEnv.DEMO_MODE,
    }));
  }

  return app;
}
