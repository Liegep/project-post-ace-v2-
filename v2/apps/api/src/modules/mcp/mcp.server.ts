import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { FastifyInstance } from "fastify";
import type { AuthContext } from "../auth/auth.types.js";
import { recordMcpAudit } from "./mcp.repository.js";
import { mcpCardSummary, mcpClientRadarContext, mcpCreatePautaDraft, mcpListClients, mcpListDueCards, mcpListPendingApprovals, mcpListRecentClientComments, mcpWeeklyWorkload } from "./mcp.read.service.js";
import { MCP_PAUTA_CREATE_SCOPE } from "./mcp.security.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const createsDraft = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function validPeriod(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 31 * 24 * 60 * 60 * 1000) {
    throw new Error("O período deve ter entre 1 e 31 dias.");
  }
}

export function createPlanningMcpServer(app: FastifyInstance, auth: AuthContext, oauthClientId: string, scopes: string[] = []) {
  const server = new McpServer({ name: "design-hub-planning", version: "1.0.0" });
  const audited = <T extends Record<string, unknown>>(toolName: string, action: (input: T) => Promise<unknown>) => async (input: T) => {
    try {
      const data = await action(input);
      await recordMcpAudit(app.db, { userId: auth.user.id, clientId: oauthClientId, toolName, success: true, args: input });
      return result(data);
    } catch (error) {
      await recordMcpAudit(app.db, { userId: auth.user.id, clientId: oauthClientId, toolName, success: false, args: input }).catch(() => undefined);
      throw error;
    }
  };

  server.registerTool("list_clients", {
    title: "Listar clientes",
    description: "Lista somente os nomes e identificadores dos clientes acessíveis, sem contatos ou dados financeiros.",
    annotations: readOnly,
  }, audited("list_clients", async () => ({ clients: await mcpListClients(app.db, auth) })));

  server.registerTool("list_due_cards", {
    title: "Cards com prazo",
    description: "Lista cards e posts com prazo ou agendamento em um período de até 31 dias.",
    inputSchema: { dateFrom: isoDate, dateTo: isoDate, clientId: z.string().optional(), limit: z.number().int().min(1).max(200).default(100) },
    annotations: readOnly,
  }, audited("list_due_cards", async (input) => { validPeriod(input.dateFrom, input.dateTo); return { cards: await mcpListDueCards(app.db, auth, input) }; }));

  server.registerTool("list_pending_approvals", {
    title: "Aprovações pendentes",
    description: "Lista conteúdos ainda aguardando aprovação do cliente.",
    inputSchema: { clientId: z.string().optional(), limit: z.number().int().min(1).max(200).default(100) },
    annotations: readOnly,
  }, audited("list_pending_approvals", async (input) => ({ approvals: await mcpListPendingApprovals(app.db, auth, input) })));

  server.registerTool("list_recent_client_comments", {
    title: "Comentários recentes dos clientes",
    description: "Lista comentários visíveis feitos por clientes, sem incluir anotações internas.",
    inputSchema: { sinceDays: z.number().int().min(1).max(90).default(14), clientId: z.string().optional(), limit: z.number().int().min(1).max(200).default(100) },
    annotations: readOnly,
  }, audited("list_recent_client_comments", async (input) => ({ comments: await mcpListRecentClientComments(app.db, auth, input) })));

  server.registerTool("get_weekly_workload", {
    title: "Carga de trabalho da semana",
    description: "Resume cards, aprovações e compromissos para planejar a semana e proteger a sexta-feira.",
    inputSchema: { dateFrom: isoDate, dateTo: isoDate },
    annotations: readOnly,
  }, audited("get_weekly_workload", async (input) => { validPeriod(input.dateFrom, input.dateTo); return mcpWeeklyWorkload(app.db, auth, input); }));

  server.registerTool("get_card_summary", {
    title: "Resumo de um card",
    description: "Consulta status, prazo e comentários públicos de um card específico. Não retorna arquivos nem links privados.",
    inputSchema: { cardId: z.string().min(1).max(100) },
    annotations: readOnly,
  }, audited("get_card_summary", async ({ cardId }) => ({ card: await mcpCardSummary(app.db, auth, cardId) })));

  server.registerTool("get_client_radar_context", {
    title: "Consultar Radar do cliente",
    description: "Consulta o contexto de monitoramento, Brand Brain, links de referência e pautas existentes de um cliente para evitar sugestões duplicadas.",
    inputSchema: { clientId: z.string().min(1).max(100) },
    annotations: readOnly,
  }, audited("get_client_radar_context", async ({ clientId }) => mcpClientRadarContext(app.db, auth, clientId)));

  if (scopes.includes(MCP_PAUTA_CREATE_SCOPE)) server.registerTool("create_pauta_draft", {
    title: "Criar pauta aprovada pelo usuário",
    description: "Cria somente uma pauta em RASCUNHO no banco interno do cliente. Use exclusivamente depois de mostrar a pauta e receber confirmação explícita do usuário. Não envia ao cliente, não cria card, não move Kanban e não publica.",
    inputSchema: {
      clientId: z.string().min(1).max(100),
      title: z.string().min(1).max(240),
      description: z.string().max(6000).optional(),
      caption: z.string().max(10000).optional(),
      contentType: z.string().max(80).optional(),
      plannedDate: isoDate.optional(),
      radarSource: z.string().max(500).optional(),
      sourceUrl: z.string().url().max(2000).optional(),
      confirmed: z.literal(true).describe("Deve ser true somente após a confirmação explícita do usuário nesta conversa."),
      confirmationId: z.string().min(8).max(120).describe("Identificador único desta confirmação para impedir pautas duplicadas."),
    },
    annotations: createsDraft,
  }, audited("create_pauta_draft", async ({ confirmed: _confirmed, ...input }) => mcpCreatePautaDraft(app.db, auth, input)));

  return server;
}
