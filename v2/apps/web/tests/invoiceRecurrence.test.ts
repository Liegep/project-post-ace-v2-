import assert from "node:assert/strict";
import test from "node:test";
import { invoiceRecurrenceLabel } from "../src/invoiceRecurrence";

test("pending current month and next generation reflect persisted backend state", () => {
  const recurrence = { eligible: true, currentPeriod: "2026-10", currentInvoiceId: null, nextIssueDate: "2026-11-01", timeZone: "America/Sao_Paulo" };
  assert.equal(invoiceRecurrenceLabel({ recurring: true, recurrence }), "Fatura de outubro aguardando geração");
  assert.equal(invoiceRecurrenceLabel({ recurring: true, recurrence: { ...recurrence, currentInvoiceId: "generated" } }), "Próxima geração: 1 de novembro de 2026");
  assert.equal(invoiceRecurrenceLabel({ recurring: true, recurrence: { ...recurrence, currentPeriod: "2026-12", currentInvoiceId: "generated", nextIssueDate: "2027-01-01" } }), "Próxima geração: 1 de janeiro de 2027");
});
test("future/disabled/generated invoices do not pretend to be pending active sources", () => {
  assert.equal(invoiceRecurrenceLabel({ recurring: false }), "Fatura avulsa.");
  assert.equal(invoiceRecurrenceLabel({ recurring: false, recurringSourceInvoiceId: "source", recurringPeriod: "2026-10" }), "Gerada por recorrência · 2026-10");
  assert.equal(invoiceRecurrenceLabel({ recurring: true }), "Recorrência ativa · aguardando atualização.");
  assert.equal(invoiceRecurrenceLabel({ recurring: true, recurrence: { eligible: false, currentPeriod: "2026-10", currentInvoiceId: null, nextIssueDate: "2026-12-01", timeZone: "UTC" } }), "Próxima geração: 1 de dezembro de 2026");
});
