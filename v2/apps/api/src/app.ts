import Fastify from "fastify";
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
import { calendarRoutes } from "./modules/calendar/calendar.routes.js";
import { demoRoutes } from "./modules/demo/demo.routes.js";
import { uploadRoutes } from "./modules/uploads/uploads.routes.js";
import { tagRoutes } from "./modules/tags/tags.routes.js";
import { hashtagRoutes } from "./modules/hashtags/hashtags.routes.js";
import { agendaRoutes } from "./modules/agenda/agenda.routes.js";
import { textRoutes } from "./modules/texts/texts.routes.js";
import { reportRoutes } from "./modules/reports/reports.routes.js";
import { archiveCardsDueForPublication } from "./modules/cards/cards.service.js";

export async function buildApp() {
  const appEnv = loadEnv();
  const app = Fastify({
    logger: appEnv.NODE_ENV === "development"
  });

  app.decorate("appEnv", appEnv);

  await app.register(httpErrorsPluginRegistered);

  if (appEnv.DEMO_MODE) {
    await app.register(demoRoutes, { prefix: "/api" });
  } else {
    await app.register(dbPluginRegistered);
    await app.register(authPluginRegistered);

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

    const archiveDueCards = async () => {
      try {
        const archived = await archiveCardsDueForPublication(app);
        if (archived > 0) app.log.info({ archived }, "Scheduled cards archived automatically");
      } catch (error) {
        app.log.error(error, "Unable to archive scheduled cards");
      }
    };
    await archiveDueCards();
    // Keep scheduled publication responsive without requiring a browser refresh.
    const scheduler = setInterval(() => { void archiveDueCards(); }, 5_000);
    scheduler.unref();
    app.addHook("onClose", async () => clearInterval(scheduler));
  }

  app.get("/", async () => {
    return {
      ok: true,
      service: appEnv.APP_NAME,
      api: appEnv.API_URL,
      demoMode: appEnv.DEMO_MODE,
    };
  });

  return app;
}
