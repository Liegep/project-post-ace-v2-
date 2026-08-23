import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { calendarQuerySchema } from "./calendar.schemas.js";
import {
  getInternalClientCalendar,
  getPortalCalendar,
  getScopedInternalCalendarOverview,
} from "./calendar.service.js";

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  app.get("/calendar/overview", async (request) => {
    assertInternalAccess(request);
    const query = calendarQuerySchema.parse(request.query);

    return getScopedInternalCalendarOverview(app, request.auth!, query);
  });

  app.get("/clients/:clientAccountId/calendar", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const query = calendarQuerySchema.parse(request.query);

    return getInternalClientCalendar(app, params.clientAccountId, query);
  });

  app.get("/portal/accounts/:clientAccountId/calendar", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    const query = calendarQuerySchema.parse(request.query);

    return getPortalCalendar(app, params.clientAccountId, query);
  });
};
