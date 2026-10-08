export class AiProviderError extends Error {
  constructor(public readonly code: "timeout" | "unavailable" | "refusal" | "incomplete" | "invalid_response", public readonly statusCode = 502) {
    super({ timeout: "A análise excedeu o tempo limite. Tente novamente.", unavailable: "O serviço de IA está indisponível. Tente novamente.", refusal: "A IA não pôde atender a esta solicitação.", incomplete: "A resposta da IA ficou incompleta. Tente uma quantidade menor.", invalid_response: "A IA retornou dados inválidos. Tente novamente." }[code]);
  }
}
export type AiUsage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export type StructuredRequest = { apiKey: string; model: string; input: unknown[]; schema: Record<string, unknown>; name: string; maxOutputTokens: number; timeoutMs: number };
export type StructuredProvider = (request: StructuredRequest) => Promise<{ value: unknown; usage: AiUsage; model: string }>;
export function openAiResponses(fetcher: typeof fetch = fetch): StructuredProvider {
  return async (request) => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = async () => {
        const response = await fetcher("https://api.openai.com/v1/responses", { method: "POST", signal: controller.signal,
          headers: { Authorization: `Bearer ${request.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: request.model, input: request.input, store: false, max_output_tokens: request.maxOutputTokens,
            text: { format: { type: "json_schema", name: request.name, strict: true, schema: request.schema } } }) });
        if (!response.ok) throw new AiProviderError("unavailable", 503);
        let data: any; try { data = await response.json(); } catch { throw new AiProviderError("invalid_response"); }
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new AiProviderError("invalid_response");
        const content = Array.isArray(data.output) ? data.output.flatMap((item: { content?: unknown[] } | null) => item && Array.isArray(item.content) ? item.content.filter(content => content && typeof content === "object") : []) : [];
        if (content.some((item: { type?: string; refusal?: unknown }) => item.type === "refusal" || item.refusal)) throw new AiProviderError("refusal");
        if (data.status !== "completed" || data.incomplete_details) throw new AiProviderError("incomplete");
        const texts = content.filter((item: { type?: string }) => item.type === "output_text");
        if (texts.length !== 1 || typeof texts[0].text !== "string" || texts[0].text.length > 200000) throw new AiProviderError("invalid_response");
        let value: unknown; try { value = JSON.parse(texts[0].text); } catch { throw new AiProviderError("invalid_response"); }
        const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295 ? value : null;
        return { value, model: typeof data.model === "string" && /^[\w.:-]{1,120}$/.test(data.model) ? data.model : request.model,
          usage: { inputTokens: count(data.usage?.input_tokens), outputTokens: count(data.usage?.output_tokens), totalTokens: count(data.usage?.total_tokens) } };
      };
      return await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AiProviderError("timeout", 504)); }, request.timeoutMs); })]);
    } catch (error) { if (error instanceof AiProviderError) throw error; throw new AiProviderError("unavailable", 503); }
    finally { clearTimeout(timer); }
  };
}

// Report analysis reuses the canonical transport; injected providers retain an abortable test boundary.
export type Usage = { input_tokens: number | null; output_tokens: number | null; total_tokens: number | null };
export class ResponsesError extends Error {
  constructor(public code: 'timeout' | 'provider_error' | 'invalid_response', public usage?: Usage) { super(code); }
}
export type ResponsesRequest = { model: string; input: unknown[]; schema: object; name: string; maxOutputTokens: number; timeoutMs: number };
export type ResponsesProvider = (request: ResponsesRequest, signal: AbortSignal) => Promise<{ text: string; usage?: Usage; model?: string }>;
export function createResponsesProvider(apiKey: string, transport: typeof fetch = fetch): ResponsesProvider {
  const provider = openAiResponses(transport);
  return async request => {
    try {
      const result = await provider({ ...request, apiKey, schema: request.schema as Record<string, unknown> });
      return { text: JSON.stringify(result.value), model: result.model, usage: { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, total_tokens: result.usage.totalTokens } };
    } catch (error) { throw new ResponsesError(error instanceof AiProviderError && error.code === 'timeout' ? 'timeout' : error instanceof AiProviderError && ['refusal', 'incomplete', 'invalid_response'].includes(error.code) ? 'invalid_response' : 'provider_error'); }
  };
}
export async function requestResponses(provider: ResponsesProvider, request: ResponsesRequest) {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ResponsesError('timeout')); }, request.timeoutMs); });
  try { return await Promise.race([provider(request, controller.signal), timeout]); }
  finally { clearTimeout(timer); }
}
