import Fastify from "fastify";
import { ensureApprovalStorage } from "./modules/approvals/approval-history.repository.js";
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
import { getClientScope } from "./modules/auth/auth.access.js";
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
import { ensureMcpStorage } from "./modules/mcp/mcp.repository.js";
import { mcpOAuthRoutes } from "./modules/mcp/mcp.oauth.routes.js";
import { mcpRoutes } from "./modules/mcp/mcp.routes.js";
import { timeTrackingRoutes } from "./modules/time-tracking/time-tracking.routes.js";
import { proposalRoutes } from "./modules/proposals/proposals.routes.js";
import { designBriefRoutes } from "./modules/design-briefs/design-briefs.routes.js";
import { dashboardNotesRoutes } from "./modules/dashboard-notes/dashboard-notes.routes.js";
import { scheduledCardArchiverPluginRegistered } from "./plugins/scheduled-card-archiver.js";
import { ensureCardTimeZoneStorage } from "./modules/cards/cards.storage.js";

export async function buildApp() {
  const appEnv = loadEnv();
  const app = Fastify({
    // Production failures need to reach the hosting logs as well.
    logger: true
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

    // Role boundaries that apply across more than one module live here so
    // they cannot be bypassed by navigating directly to a hidden frontend URL.
    app.addHook("preHandler", async (request) => {
      const auth = request.auth;
      if (!auth) return;
      const pathname = request.url.split("?", 1)[0];

      // Lower roles may read their client-scoped agenda data for the Social
      // Calendar, but writes to the private agenda remain super-admin only.
      if (
        auth.user.globalRole !== "super_admin" &&
        request.method !== "GET" &&
        (pathname.startsWith("/api/agenda/events") || pathname.startsWith("/api/agenda/labels"))
      ) {
        throw app.httpErrors.forbidden("A agenda pessoal é exclusiva do super admin.");
      }

      // Admins may assign people only inside client accounts that are already
      // in their scope. The legacy client route still checks for super_admin,
      // so elevate this single request after verifying the client boundary.
      if (auth.user.globalRole === "admin" && request.method === "POST") {
        const match = pathname.match(/^\/api\/clients\/([^/]+)\/accesses$/);
        if (match) {
          const clientAccountId = decodeURIComponent(match[1]);
          const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
          if (scope.mode !== "scoped" || !scope.clientIds.includes(clientAccountId)) {
            throw app.httpErrors.forbidden("Você só pode atribuir pessoas aos seus próprios clientes.");
          }
          request.auth = {
            ...auth,
            user: { ...auth.user, globalRole: "super_admin" },
          };
        }
      }
    });

    // The dashboard must not leak the super admin's personal agenda to lower
    // roles, even when an event has no client or references an assigned client.
    app.addHook("preSerialization", async (request, _reply, payload) => {
      if (
        request.url.split("?", 1)[0] === "/api/dashboard/overview" &&
        request.auth?.user.globalRole !== "super_admin" &&
        payload && typeof payload === "object" && !Array.isArray(payload)
      ) {
        return { ...(payload as Record<string, unknown>), agendaToday: [] };
      }
      return payload;
    });

    let databaseAvailableAtStartup = true;
    try {
      await ensureMcpStorage(app.db);
      await ensureCardTimeZoneStorage(app.db, appEnv.APP_TIMEZONE);
      await ensureApprovalStorage(app.db);
    } catch (error) {
      databaseAvailableAtStartup = false;
      app.log.error(error, "Database unavailable during startup; continuing with degraded API");
    }
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
    await app.register(scheduledCardArchiverPluginRegistered);

    if (databaseAvailableAtStartup) {
      try {
        const organized = await reconcileApprovedCardColumns(app);
        if (organized > 0) app.log.info({ organized }, "Approved cards organized into their client columns");
      } catch (error) {
        app.log.error(error, "Unable to organize approved cards");
      }
    }
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
