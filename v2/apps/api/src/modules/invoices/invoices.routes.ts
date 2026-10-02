import { generateRecurringInvoices } from "./invoice-recurring.service.js";
import { getReceiptSignature, setReceiptSignature } from "./billing-settings.repository.js";
import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertSuperAdmin } from "../auth/auth.access.js";
import { findClientPermissionsByAccountId } from "../clients/clients.repository.js";
import { createInvoice, deleteInvoice, ensureInvoiceTables, findInvoice, generateInvoiceReceipt, listInvoices, updateInvoice } from "./invoices.repository.js";
import { createInvoiceSchema, updateInvoiceSchema } from "./invoices.schemas.js";

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  await ensureInvoiceTables(app.db);
  app.get("/billing/settings", async (request) => { assertSuperAdmin(request); return { signatureUrl: await getReceiptSignature(app.db) }; });
  app.delete("/billing/settings/receipt-signature", async (request) => { assertSuperAdmin(request); await setReceiptSignature(app.db, null); return { signatureUrl: null }; });
  app.post("/invoices/recurring/generate", async (request) => { assertSuperAdmin(request); return generateRecurringInvoices(app.db, new Date(), app.appEnv.APP_TIMEZONE); });
  app.get("/invoices", async (request) => { assertSuperAdmin(request); return { items: await listInvoices(app.db, null, false, app.appEnv.APP_TIMEZONE) }; });
  app.post("/invoices", async (request) => { assertSuperAdmin(request); const input = createInvoiceSchema.parse(request.body); return { invoice: await createInvoice(app.db, request.auth!.user.id, input) }; });
  app.patch("/invoices/:invoiceId", async (request) => { assertSuperAdmin(request); const { invoiceId } = request.params as { invoiceId: string }; const current = await findInvoice(app.db, invoiceId); if (!current) throw app.httpErrors.notFound("Fatura não encontrada."); const input = updateInvoiceSchema.parse(request.body); if (current.recurringSourceInvoiceId && input.recurring === true) throw app.httpErrors.badRequest("Edite a recorrência na fatura-base."); return { invoice: await updateInvoice(app.db, invoiceId, request.auth!.user.id, input) }; });
  app.post("/invoices/:invoiceId/receipt", async (request) => { assertSuperAdmin(request); const { invoiceId } = request.params as { invoiceId: string }; const invoice = await generateInvoiceReceipt(app.db, invoiceId); if (!invoice) throw app.httpErrors.notFound("Fatura não encontrada."); return { invoice }; });
  app.delete("/invoices/:invoiceId", async (request) => { assertSuperAdmin(request); const { invoiceId } = request.params as { invoiceId: string }; const current = await findInvoice(app.db, invoiceId); if (!current) throw app.httpErrors.notFound("Fatura não encontrada."); return { ok: await deleteInvoice(app.db, invoiceId) }; });
  app.get("/portal/accounts/:clientAccountId/invoices", async (request) => { const { clientAccountId } = request.params as { clientAccountId: string }; assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]); const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId); if (!permissions?.allowClientViewInvoices) throw app.httpErrors.forbidden("Faturas não estão liberadas para este cliente."); const invoices = await listInvoices(app.db, [clientAccountId], true); return { items: invoices.map(({ paymentProofName: _paymentProofName, paymentProofUrl: _paymentProofUrl, ...invoice }) => invoice) }; });
};
