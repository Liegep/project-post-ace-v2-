// Shared Responses transport for report extraction and strategic analysis. No retries.
export class ResponsesError extends Error {
  constructor(public code: 'timeout' | 'provider_error' | 'invalid_response', public usage?: Usage) {
    super(code);
  }
}
export type Usage = { input_tokens: number; output_tokens: number; total_tokens: number };
export type ResponsesRequest = { model: string; input: unknown[]; schema: object; name: string; maxOutputTokens: number; timeoutMs: number };
export type ResponsesProvider = (request: ResponsesRequest, signal: AbortSignal) => Promise<{ text: string; usage?: Usage }>;
export function createResponsesProvider(apiKey: string, transport: typeof fetch = fetch): ResponsesProvider {
  return async (request, signal) => {
    const response = await transport('https://api.openai.com/v1/responses', {
      method: 'POST', signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: request.model, input: request.input, store: false, max_output_tokens: request.maxOutputTokens,
        text: { format: { type: 'json_schema', name: request.name, strict: true, schema: request.schema } } }),
    });
    if (!response.ok) throw new ResponsesError('provider_error');
    const result = await response.json() as { status?: string; output_text?: string; usage?: Usage; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
    const usage = result.usage && ['input_tokens', 'output_tokens', 'total_tokens'].every(key => Number.isFinite(result.usage?.[key as keyof Usage])) ? result.usage : undefined;
    if (result.status !== 'completed' || result.output?.some(item => item.type !== 'message' || item.content?.some(content => content.type === 'refusal'))) throw new ResponsesError('invalid_response', usage);
    const output = result.output_text ?? result.output?.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('');
    if (!output) throw new ResponsesError('invalid_response', usage);
    return { text: output, usage };
  };
}
export async function requestResponses(provider: ResponsesProvider, request: ResponsesRequest) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ResponsesError('timeout')); }, request.timeoutMs); });
  try { return await Promise.race([provider(request, controller.signal), timeout]); }
  finally { clearTimeout(timer); }
}
