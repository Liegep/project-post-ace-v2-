import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess, getClientScope } from "../auth/auth.access.js";
import { findClientPermissionsByAccountId } from "../clients/clients.repository.js";
import { createInvoice, deleteInvoice, ensureInvoiceTables, findInvoice, listInvoices, updateInvoice } from "./invoices.repository.js";
import { createInvoiceSchema, updateInvoiceSchema } from "./invoices.schemas.js";

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  await ensureInvoiceTables(app.db);
  app.get("/invoices", async (request) => { assertInternalAccess(request); const auth = request.auth!; const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships); return { items: await listInvoices(app.db, scope.mode === "global" ? null : scope.clientIds) }; });
  app.post("/invoices", async (request) => { assertInternalAccess(request); const input = createInvoiceSchema.parse(request.body); if (input.clientAccountId) assertClientAccess(request, input.clientAccountId, ["admin", "colaborador"]); return { invoice: await createInvoice(app.db, request.auth!.user.id, input) }; });
  app.patch("/invoices/:invoiceId", async (request) => { assertInternalAccess(request); const { invoiceId } = request.params as { invoiceId: string }; const current = await findInvoice(app.db, invoiceId); if (!current) throw app.httpErrors.notFound("Fatura não encontrada."); if (current.clientAccountId) assertClientAccess(request, current.clientAccountId, ["admin", "colaborador"]); const input = updateInvoiceSchema.parse(request.body); if (input.clientAccountId) assertClientAccess(request, input.clientAccountId, ["admin", "colaborador"]); return { invoice: await updateInvoice(app.db, invoiceId, request.auth!.user.id, input) }; });
  app.delete("/invoices/:invoiceId", async (request) => { assertInternalAccess(request); const { invoiceId } = request.params as { invoiceId: string }; const current = await findInvoice(app.db, invoiceId); if (!current) throw app.httpErrors.notFound("Fatura não encontrada."); if (current.clientAccountId) assertClientAccess(request, current.clientAccountId, ["admin", "colaborador"]); return { ok: await deleteInvoice(app.db, invoiceId) }; });
  app.get("/portal/accounts/:clientAccountId/invoices", async (request) => { const { clientAccountId } = request.params as { clientAccountId: string }; assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]); const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId); if (!permissions?.allowClientViewInvoices) throw app.httpErrors.forbidden("Faturas não estão liberadas para este cliente."); return { items: await listInvoices(app.db, [clientAccountId], true) }; });
};
