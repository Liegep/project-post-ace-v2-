// Metadata is an allowlist: never retain request/response text, refusal text or provider messages.
export type ResponseDiagnostics = {
  responseId?: string; providerHttpStatus?: number; responseStatus?: string;
  incompleteReason?: string; failureReason?: string; refusalPresent?: boolean;
  outputItemTypes?: string[]; validationErrorCode?: string; validationPath?: string;
};
export type ResponseMetadata = ResponseDiagnostics & { model?: string; usage?: AiUsage };
const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295 ? value : null;
function responseMetadata(data: any, httpStatus: number): ResponseMetadata {
  const reasons = ['max_output_tokens', 'content_filter', 'server_error', 'rate_limit_exceeded', 'invalid_api_key', 'invalid_request_error', 'insufficient_quota', 'invalid_prompt'];
  const reason = (value: unknown) => typeof value === 'string' && reasons.includes(value) ? value : undefined;
  const types = ['message', 'reasoning', 'output_text', 'refusal', 'function_call', 'web_search_call', 'file_search_call', 'computer_call', 'image_generation_call'];
  const output = Array.isArray(data?.output) ? data.output : [];
  const content = output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []);
  return {
    providerHttpStatus: httpStatus,
    responseId: typeof data?.id === 'string' && /^resp_[a-zA-Z0-9]{1,100}$/.test(data.id) ? data.id : undefined,
    model: typeof data?.model === 'string' && /^(gpt-|o[134](?:-|$))[a-zA-Z0-9.:-]{0,100}$/.test(data.model) ? data.model : undefined,
    responseStatus: ['completed', 'incomplete', 'failed', 'cancelled', 'queued', 'in_progress'].includes(data?.status) ? data.status : undefined,
    incompleteReason: data?.incomplete_details ? reason(data.incomplete_details.reason) ?? 'unknown_reason' : undefined,
    failureReason: data?.error ? reason(data.error.code) ?? 'provider_failure' : undefined,
    refusalPresent: content.some((item: any) => item?.type === 'refusal' || Boolean(item?.refusal)),
    outputItemTypes: [...new Set<string>([...output, ...content].map(item => types.includes(item?.type) ? item.type : 'unknown'))].slice(0, 12),
    usage: { inputTokens: count(data?.usage?.input_tokens), outputTokens: count(data?.usage?.output_tokens), totalTokens: count(data?.usage?.total_tokens) },
  };
}
export class AiProviderError extends Error {
  constructor(public readonly code: "timeout" | "unavailable" | "refusal" | "incomplete" | "invalid_response", public readonly statusCode = 502, public readonly metadata: ResponseMetadata = {}) {
    super({ timeout: "A análise excedeu o tempo limite. Tente novamente.", unavailable: "O serviço de IA está indisponível. Tente novamente.", refusal: "A IA não pôde atender a esta solicitação.", incomplete: "A resposta da IA ficou incompleta. Tente uma quantidade menor.", invalid_response: "A IA retornou dados inválidos. Tente novamente." }[code]);
  }
}
export type AiUsage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export type StructuredRequest = { apiKey: string; model: string; input: unknown[]; schema: Record<string, unknown>; name: string; maxOutputTokens: number; timeoutMs: number };
export type StructuredProvider = (request: StructuredRequest) => Promise<{ value: unknown; usage: AiUsage; model: string; metadata?: ResponseMetadata }>;
export function openAiResponses(fetcher: typeof fetch = fetch): StructuredProvider {
  return async (request) => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = async () => {
        const response = await fetcher("https://api.openai.com/v1/responses", { method: "POST", signal: controller.signal,
          headers: { Authorization: `Bearer ${request.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: request.model, input: request.input, store: false, max_output_tokens: request.maxOutputTokens,
            text: { format: { type: "json_schema", name: request.name, strict: true, schema: request.schema } } }) });
        let data: any;
        try { data = await response.json(); } catch {
          throw new AiProviderError(response.ok ? 'invalid_response' : 'unavailable', response.ok ? 502 : 503,
            { providerHttpStatus: response.status, validationErrorCode: 'response_json_parse_error' });
        }
        const metadata = responseMetadata(data, response.status);
        const fail = (code: ConstructorParameters<typeof AiProviderError>[0], validationErrorCode?: string): never => {
          throw new AiProviderError(code, code === 'unavailable' ? 503 : 502, { ...metadata, validationErrorCode });
        };
        if (!response.ok) fail('unavailable', 'provider_http_error');
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalid_response', 'invalid_response_envelope');
        const content = Array.isArray(data.output) ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content.filter((value: any) => value && typeof value === 'object') : []) : [];
        if (metadata.refusalPresent) fail('refusal', 'refusal');
        if (data.status === 'incomplete' || data.incomplete_details) fail('incomplete', 'incomplete');
        if (data.status !== 'completed') fail('unavailable', 'unexpected_response_status');
        const texts = content.filter((item: any) => item.type === 'output_text');
        if (texts.length !== 1 || typeof texts[0].text !== 'string' || !texts[0].text.trim()) fail('invalid_response', 'output_missing');
        if (texts[0].text.length > 200000) fail('invalid_response', 'output_size_limit');
        let value: unknown;
        try { value = JSON.parse(texts[0].text); } catch { fail('invalid_response', 'structured_output_parse_error'); }
        return { value, model: metadata.model ?? request.model, usage: metadata.usage!, metadata };
      };
      return await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AiProviderError("timeout", 504)); }, request.timeoutMs); })]);
    } catch (error) { if (error instanceof AiProviderError) throw error; throw new AiProviderError("unavailable", 503); }
    finally { clearTimeout(timer); }
  };
}

// Report analysis reuses the canonical transport; injected providers retain an abortable test boundary.
export type Usage = { input_tokens: number | null; output_tokens: number | null; total_tokens: number | null };
export class ResponsesError extends Error {
  constructor(public code: 'timeout' | 'provider_error' | 'refusal' | 'incomplete' | 'parse_error' | 'schema_validation_error' | 'evidence_validation_error', public usage?: Usage, public metadata: ResponseMetadata = {}) { super(code); }
}
export type ResponsesRequest = { model: string; input: unknown[]; schema: object; name: string; maxOutputTokens: number; timeoutMs: number };
export type ResponsesProvider = (request: ResponsesRequest, signal: AbortSignal) => Promise<{ text: string; usage?: Usage; model?: string; metadata?: ResponseMetadata }>;
export function createResponsesProvider(apiKey: string, transport: typeof fetch = fetch): ResponsesProvider {
  const provider = openAiResponses(transport);
  return async request => {
    try {
      const result = await provider({ ...request, apiKey, schema: request.schema as Record<string, unknown> });
      return { text: JSON.stringify(result.value), model: result.model, metadata: result.metadata, usage: { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, total_tokens: result.usage.totalTokens } };
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw new ResponsesError('provider_error');
      const usage = error.metadata.usage;
      throw new ResponsesError(error.code === 'unavailable' ? 'provider_error' : error.code === 'invalid_response' ? 'parse_error' : error.code,
        usage ? { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, total_tokens: usage.totalTokens } : undefined, error.metadata);
    }
  };
}
export async function requestResponses(provider: ResponsesProvider, request: ResponsesRequest) {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ResponsesError('timeout')); }, request.timeoutMs); });
  try { return await Promise.race([provider(request, controller.signal), timeout]); }
  finally { clearTimeout(timer); }
}
