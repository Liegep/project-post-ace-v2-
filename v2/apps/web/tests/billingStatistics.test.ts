import assert from "node:assert/strict";
import test from "node:test";
import { calculateBillingStatistics } from "../src/billingStatistics";

const invoice = (status: string, amount: number, currency = "BRL") => ({ status, currency, lines: [{ quantity: 2, unitPrice: amount / 2 }] });

test("billed total includes open, paid and overdue, excluding cancelled and unknown statuses", () => {
  const totals = calculateBillingStatistics([
    invoice("open", 100), invoice("paid", 200), invoice("overdue", 50),
    invoice("cancelled", 900), invoice("unknown", 700),
  ]);
  assert.equal(totals.all.BRL, 350);
  assert.equal(totals.open.BRL, 100);
  assert.equal(totals.paid.BRL, 200);
  assert.equal(totals.overdue.BRL, 50);
  assert.equal(totals.all.BRL, totals.open.BRL + totals.paid.BRL + totals.overdue.BRL);
});

test("currency totals remain separate and keep the existing summary currency scope", () => {
  const totals = calculateBillingStatistics([
    invoice("paid", 10, "BRL"), invoice("open", 20, "USD"), invoice("overdue", 30, "EUR"),
    invoice("cancelled", 500, "EUR"), invoice("paid", 40, "SEK"),
  ]);
  assert.deepEqual(totals.all, { BRL: 10, USD: 20, EUR: 30 });
  assert.deepEqual(totals.paid, { BRL: 10, USD: 0, EUR: 0 });
  assert.deepEqual(totals.open, { BRL: 0, USD: 20, EUR: 0 });
  assert.deepEqual(totals.overdue, { BRL: 0, USD: 0, EUR: 30 });
});

test("cancelled invoices with historical payment and receipt stay untouched and excluded", () => {
  const historical = Object.freeze({
    ...invoice("cancelled", 450),
    lines: Object.freeze([Object.freeze({ quantity: 2, unitPrice: 225 })]),
    paidAt: "2026-09-28", paymentMethod: "Pix",
    receiptSnapshot: Object.freeze({ receiptNumber: "REC-TEST", total: 450 }),
  });
  const input = Object.freeze([historical]);
  const before = JSON.stringify(input);
  const totals = calculateBillingStatistics(input);
  assert.deepEqual(totals.all, { BRL: 0, USD: 0, EUR: 0 });
  assert.deepEqual(totals.paid, totals.all);
  assert.equal(JSON.stringify(input), before);
  assert.equal(input[0].receiptSnapshot.total, 450);
  assert.equal(input[0].lines[0].quantity * input[0].lines[0].unitPrice, 450);
});

test("recalculation after cancellation removes only that invoice's contribution", () => {
  const remaining = invoice("open", 60);
  assert.equal(calculateBillingStatistics([remaining, invoice("paid", 120)]).all.BRL, 180);
  const after = calculateBillingStatistics([remaining, invoice("cancelled", 120)]);
  assert.equal(after.all.BRL, 60);
  assert.equal(after.open.BRL, 60);
  assert.equal(after.paid.BRL, 0);
});

test("empty input and repeated calculations are stable", () => {
  assert.deepEqual(calculateBillingStatistics([]).all, { BRL: 0, USD: 0, EUR: 0 });
  const input = [invoice("open", 0), invoice("cancelled", 50)];
  assert.deepEqual(calculateBillingStatistics(input), calculateBillingStatistics(input));
});
