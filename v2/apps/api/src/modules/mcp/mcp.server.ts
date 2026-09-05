import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { FastifyInstance } from "fastify";
import type { AuthContext } from "../auth/auth.types.js";
import { recordMcpAudit } from "./mcp.repository.js";
import { mcpCardSummary, mcpListClients, mcpListDueCards, mcpListPendingApprovals, mcpListRecentClientComments, mcpWeeklyWorkload } from "./mcp.read.service.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

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

export function createPlanningMcpServer(app: FastifyInstance, auth: AuthContext, oauthClientId: string) {
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

  return server;
}

