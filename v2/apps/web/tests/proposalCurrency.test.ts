import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProposalMoney, proposalCurrency } from '../src/proposalCurrency';
import { createProposalSchema, updateProposalSchema } from '../../api/src/modules/proposals/proposals.schemas';
import { createProposal, updateProposal } from '../../api/src/modules/proposals/proposals.repository';
for (const currency of ['BRL', 'USD', 'EUR', 'SEK']) test(`${currency}: create, edit, reload and copy preserve currency and amounts`, async () => {
 let row: any;
 const db: any = { getConnection: async () => db, beginTransaction: async()=>{}, commit: async()=>{}, rollback: async()=>{}, release:()=>{}, query: async (sql: string, values: any[]) => {
  if (sql.includes("proposal_documents")) return [[]];
  if (sql.startsWith('INSERT')) row = { id: values[0], token: values[1], client_name: values[2], client_email: values[3], locale: values[4], proposal_type: values[5], plan: values[6], pieces_quantity: values[7], scope_description: values[8], investment_description: values[9], expires_at: values[11], status: values[12], currency: values[10], services_json: values[13] };
  if (sql.startsWith('UPDATE')) row.currency = values[sql.slice(sql.indexOf('SET ') + 4, sql.indexOf(' WHERE')).split(',').findIndex((field) => field === 'currency=?')];
  return [[row]];
 } };
 const input = createProposalSchema.parse({ clientName: 'Test', expiresAt: new Date().toISOString(), currency, services: [{ name: 'Service', value: 1234.56 }] });
 const saved = await createProposal(db, 'user', input);
 assert.equal(saved?.currency, currency); assert.equal(saved?.services[0].value, 1234.56);
 const updated = await updateProposal(db, saved!.id, updateProposalSchema.parse({ currency }));
 assert.equal(updated?.currency, currency); assert.equal(updated?.services[0].value, 1234.56);
 const copied = await createProposal(db, 'user', createProposalSchema.parse(updated));
 assert.equal(copied?.currency, currency); assert.equal(copied?.services[0].value, 1234.56);
 assert.match(formatProposalMoney(1234.56, currency), { BRL: /R\$/, USD: /US\$/, EUR: /€/, SEK: /kr/ }[currency]!);
});
test('legacy fallback and symbols', () => {
 for (const legacy of [undefined, null, '', 'R$']) assert.equal(proposalCurrency(legacy), 'BRL');
 assert.equal(proposalCurrency('US$'), 'USD');
 assert.equal(updateProposalSchema.parse({}).currency, undefined);
});
test('client preview uses the selected currency in items and total', async () => {
 const { createServer } = await import('vite');
 const { renderToStaticMarkup } = await import('react-dom/server');
 const React = await import('react');
 const server = await createServer({ root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true, hmr: false } });
 try {
  const { ProposalClientPreview } = await server.ssrLoadModule('/src/proposalPresentation.tsx');
  for (const currency of ['BRL', 'USD', 'EUR', 'SEK']) {
   const html = renderToStaticMarkup(React.createElement(ProposalClientPreview, { brandLogo: '', proposal: { currency, locale: 'English', services: [{ name: 'Service', value: 1234.56 }], expiresAt: new Date().toISOString() } }));
   const symbol = { BRL: 'R$', USD: 'US$', EUR: '€', SEK: 'kr' }[currency]!;
   assert.ok(html.split(symbol).length >= 3, `${currency} in item and total`);
  }
 } finally { await server.close(); }
});
