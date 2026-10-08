import assert from 'node:assert/strict';
import test from 'node:test';
import { createResponsesProvider, type ResponsesRequest } from '../../lib/openai-responses.js';
import { analyzeReport, buildAnalysisContext, type AnalysisConfig } from './report-analysis.service.js';
import { reportAnalysisJsonSchema, reportAnalysisSchemaForEvidence } from './report-analysis.schemas.js';

// Fictional values/identity/notes: representative of the DJ report's shape, not a production export.
const report = {
  id: 'fixture-report', clientAccountId: 'fixture-client', metaDestinationId: null, metaDestinationName: null,
  title: 'Relatório sintético de eventos', periodStart: '2026-09-07', periodEnd: '2026-10-04', status: 'published' as const,
  metrics: {
    instagram: { reach: 18000, impressions: 100000, engagement: 500, followers: 2700, followersGained: 60, followersLost: 20, followersNet: 40, visits: 700, clicks: 4 },
    facebook: { reach: 22000, impressions: 35000, engagement: 450, followers: 4300, followersGained: 10, followersLost: 1, followersNet: 9, visits: 240, clicks: null, posts: 10, reactions: 12, comments: 0, shares: 0 },
  },
  highlights: [{ channel: 'instagram' as const, title: 'Conteúdo fictício A', value: 90, metricLabel: 'interactions' as const }],
  evidenceUrls: [], notes: '<p>PRIVATE MANUAL NOTES</p>', createdAt: '', updatedAt: '', publishedAt: null,
};
const sources = { previous: undefined, assets: null, brain: { positioning: 'PRIVATE BRAIN' } };
const config: AnalysisConfig = { REPORT_AI_ENABLED: true, OPENAI_API_KEY: 'PRIVATE KEY', REPORT_AI_MODEL: 'gpt-4.1-mini', REPORT_AI_MAX_OUTPUT_TOKENS: 4000, REPORT_AI_TIMEOUT_MS: 1000 };
const analysis = () => ({
  executiveSummary: 'O alcance do Instagram foi de 18.000 no período.',
  keyFindings: [{ title: 'Alcance', finding: '18.000 contas alcançadas.', type: 'fact', evidence: 'PRIVATE RESPONSE', evidenceRefs: ['current.instagram.reach'] }],
  whatWorked: [], attentionPoints: [], platformComparison: null,
  contentInsights: [{ contentTitle: null, insight: 'O destaque registrou 90 interações.', evidence: '90', evidenceRefs: ['current.highlights.0'] }],
  nextSteps: [{ action: 'Testar CTA', reason: 'Há 4 cliques e 700 visitas; testar a passagem de visita para clique.', priority: 'high', evidence: '4', evidenceRefs: ['current.instagram.clicks', 'current.instagram.visits'] }],
  experiments: [], confidenceNotes: [],
});
const usage = { input_tokens: 2000, output_tokens: 700, total_tokens: 2700 };
const envelope = (value: unknown = analysis()) => ({ id: 'resp_fixture001', model: 'gpt-4.1-mini-2025-04-14', status: 'completed', incomplete_details: null, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage });
async function run(body: unknown, httpStatus = 200) {
  const logs: Record<string, any>[] = []; let calls = 0; let request: any;
  const provider = createResponsesProvider('PRIVATE KEY', async (_url, init) => {
    calls++; request = JSON.parse(String(init?.body));
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: httpStatus });
  });
  let result; let failure: any;
  try { result = await analyzeReport({ report, config, sources, provider, log: entry => logs.push(entry) }); }
  catch (error) { failure = error; }
  assert.equal(calls, 1); assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE|Conteúdo fictício/);
  assert.doesNotMatch(String(failure), /PRIVATE/);
  assert.equal(request.store, false); assert.equal(request.max_output_tokens, 4000); assert.equal(request.model, 'gpt-4.1-mini');
  assert.equal(request.text.format.type, 'json_schema'); assert.equal(request.text.format.strict, true); assert.ok(!request.tools);
  return { result, failure, log: logs[0], request };
}

test('representative valid response: complete pipeline and metadata, explicit IDs and schema enums', async () => {
  const r = await run(envelope()); assert.ok(r.result); assert.equal(r.failure, undefined);
  assert.equal(r.log.responseId, 'resp_fixture001'); assert.equal(r.log.providerHttpStatus, 200);
  assert.equal(r.log.responseStatus, 'completed'); assert.equal(r.log.refusalPresent, false);
  assert.deepEqual(r.log.outputItemTypes, ['message', 'output_text']); assert.equal(r.log.totalTokens, 2700);
  assert.equal(r.log.model, 'gpt-4.1-mini-2025-04-14'); assert.equal(r.result.telemetry.totalTokens, 2700);
  const context = JSON.parse(r.request.input[1].content);
  assert.deepEqual(context.availableEvidenceIds, Object.keys(context.evidence));
  assert.ok(!context.availableEvidenceIds.includes('current.facebook.clicks'));
  assert.match(r.request.input[0].content, /Copie esses IDs literalmente/);
  assert.deepEqual(r.request.text.format.schema.properties.keyFindings.items.properties.evidenceRefs.items.enum, context.availableEvidenceIds);
});

test('unknown evidence is rejected at exact array path; tokens survive failure', async () => {
  const a = analysis(); a.keyFindings[0].evidenceRefs = ['PRIVATE UNKNOWN ID'];
  const r = await run(envelope(a)); assert.equal(r.failure.code, 'evidence_validation_error');
  assert.equal(r.log.validationErrorCode, 'unknown_evidence_ref'); assert.equal(r.log.validationPath, 'keyFindings[0].evidenceRefs[0]');
  assert.equal(r.log.inputTokens, 2000); assert.equal(r.log.outputTokens, 700); assert.equal(r.log.totalTokens, 2700);
});

test('required, invalid enum and forbidden null produce schema diagnostics without values', async () => {
  const missing: any = analysis(); delete missing.executiveSummary;
  const badEnum: any = analysis(); badEnum.keyFindings[0].type = 'PRIVATE INVALID ENUM';
  const badNull = { ...analysis(), executiveSummary: null };
  for (const [value, path, code] of [[missing, 'executiveSummary', 'invalid_type'], [badEnum, 'keyFindings[0].type', 'invalid_value'], [badNull, 'executiveSummary', 'invalid_type']] as const) {
    const r = await run(envelope(value)); assert.equal(r.failure.code, 'schema_validation_error');
    assert.equal(r.log.validationPath, path); assert.equal(r.log.validationErrorCode, code); assert.equal(r.log.totalTokens, 2700);
  }
});

test('allowed nulls remain valid; all required nullable fields must still be present', async () => {
  const a: any = analysis(); a.platformComparison = { instagram: 'Alcance 18.000.', facebook: null, evidenceRefs: ['current.instagram.reach'] };
  assert.ok((await run(envelope(a))).result);
  delete a.contentInsights[0].contentTitle;
  const r = await run(envelope(a)); assert.equal(r.failure.code, 'schema_validation_error'); assert.equal(r.log.validationPath, 'contentInsights[0].contentTitle');
});

test('refusal preserves response status/model/usage, never refusal text', async () => {
  const r = await run({ ...envelope(), output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'PRIVATE REFUSAL' }] }] });
  assert.equal(r.failure.code, 'refusal'); assert.equal(r.log.refusalPresent, true); assert.equal(r.log.totalTokens, 2700);
  assert.deepEqual(r.log.outputItemTypes, ['message', 'refusal']); assert.equal(r.log.responseStatus, 'completed');
});

test('incomplete output limit is distinct before parsing, including partial/refused text and tokens', async () => {
  const r = await run({ ...envelope(), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'message', content: [{ type: 'output_text', text: '{PRIVATE TRUNCATED' }] }] });
  assert.equal(r.failure.code, 'incomplete'); assert.equal(r.log.incompleteReason, 'max_output_tokens'); assert.equal(r.log.responseStatus, 'incomplete'); assert.equal(r.log.totalTokens, 2700);
});

test('empty/malformed output and malformed envelope have distinct parsing diagnostics', async () => {
  for (const [body, code] of [[{ ...envelope(), output: [] }, 'output_missing'], [{ ...envelope(), output: [{ type: 'message', content: [{ type: 'output_text', text: '{PRIVATE BROKEN' }] }] }, 'structured_output_parse_error'], ['PRIVATE NON JSON', 'response_json_parse_error']] as const) {
    const r = await run(body); assert.equal(r.failure.code, 'parse_error'); assert.equal(r.log.validationErrorCode, code);
    assert.equal(r.log.providerHttpStatus, 200); if (typeof body !== 'string') assert.equal(r.log.totalTokens, 2700);
  }
});

test('HTTP errors and failed response status remain provider errors; sanitize reasons', async () => {
  const r = await run({ ...envelope(), status: 'failed', error: { code: 'rate_limit_exceeded', message: 'PRIVATE ERROR' } }, 429);
  assert.equal(r.failure.code, 'provider_error'); assert.equal(r.log.providerHttpStatus, 429); assert.equal(r.log.failureReason, 'rate_limit_exceeded'); assert.equal(r.log.totalTokens, 2700);
  const failed = await run({ ...envelope(), status: 'failed', error: { code: 'PRIVATE REASON' } });
  assert.equal(failed.failure.code, 'provider_error'); assert.equal(failed.log.failureReason, 'provider_failure');
});

test('all analysis array caps and string limits still reject locally with specific field paths', async () => {
  const caps = { keyFindings: 5, whatWorked: 4, attentionPoints: 4, contentInsights: 5, nextSteps: 5, experiments: 3, confidenceNotes: 8 };
  const points: any = { keyFindings: analysis().keyFindings[0], whatWorked: { title: 't', explanation: 'e', evidence: 'e', evidenceRefs: ['current.instagram.reach'] }, attentionPoints: { title: 't', explanation: 'e', evidence: 'e', evidenceRefs: ['current.instagram.reach'] }, contentInsights: analysis().contentInsights[0], nextSteps: analysis().nextSteps[0], experiments: { test: 't', expectedLearning: 'e', evidence: 'e', evidenceRefs: ['current.instagram.reach'] }, confidenceNotes: 'n' };
  for (const [key, cap] of Object.entries(caps)) {
    const r = await run(envelope({ ...analysis(), [key]: Array(cap + 1).fill(points[key]) }));
    assert.equal(r.failure.code, 'schema_validation_error'); assert.equal(r.log.validationErrorCode, 'too_big'); assert.equal(r.log.validationPath, key);
  }
  const r = await run(envelope({ ...analysis(), executiveSummary: 'x'.repeat(901) })); assert.equal(r.log.validationErrorCode, 'too_big'); assert.equal(r.log.validationPath, 'executiveSummary');
});

test('JSON schema audit: closed objects, required fields, nullable unions, caps, enums, no transformations', () => {
  const context = buildAnalysisContext(report, undefined, sources);
  const schema: any = reportAnalysisSchemaForEvidence(context.availableEvidenceIds);
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') { assert.equal(node.additionalProperties, false); assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort()); }
    if (node.properties?.evidenceRefs) assert.deepEqual(node.properties.evidenceRefs.items.enum, context.availableEvidenceIds);
    for (const key of ['allOf', 'not', 'dependentRequired', 'dependentSchemas', 'if', 'then', 'else']) assert.ok(!(key in node));
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else visit(value);
  };
  visit(schema); assert.equal(schema.type, 'object'); assert.ok(!schema.anyOf);
  assert.deepEqual(schema.properties.keyFindings.items.properties.type.enum, ['fact', 'interpretation', 'hypothesis']);
  assert.deepEqual(schema.properties.nextSteps.items.properties.priority.enum, ['high', 'medium', 'low']);
  assert.equal(schema.properties.platformComparison.anyOf[1].type, 'null');
  assert.equal(schema.properties.contentInsights.items.properties.contentTitle.anyOf[1].type, 'null');
  assert.ok(!(reportAnalysisJsonSchema as any).properties.keyFindings.items.properties.evidenceRefs.items.enum);
});

test('no available evidence: no fabricated IDs; valid empty analysis remains possible', async () => {
  const schema: any = reportAnalysisSchemaForEvidence([]);
  assert.equal(schema.properties.keyFindings.maxItems, 0);
  assert.equal(schema.properties.keyFindings.items.properties.evidenceRefs.minItems, 1);
  assert.equal(schema.properties.platformComparison.type, 'null');
  const empty = { ...analysis(), keyFindings: [], contentInsights: [], nextSteps: [] };
  const emptyReport = { ...report, metrics: { instagram: Object.fromEntries(Object.keys(report.metrics.instagram).map(key => [key, null])), facebook: Object.fromEntries(Object.keys(report.metrics.facebook).map(key => [key, null])) }, highlights: [] } as unknown as Parameters<typeof analyzeReport>[0]['report'];
  const logs: any[] = [];
  const result = await analyzeReport({ report: emptyReport, config, sources, provider: async (_request: ResponsesRequest) => ({ text: JSON.stringify(empty) }), log: entry => logs.push(entry) });
  assert.equal(result.analysis.nextSteps.length, 0); assert.equal(logs[0].status, 'success');
});
