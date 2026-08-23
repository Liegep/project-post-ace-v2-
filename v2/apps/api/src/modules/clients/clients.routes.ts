import type { FastifyPluginAsync } from "fastify";
import {
  assertCanCreateClients,
  assertClientAccess,
  assertInternalAccess,
  getClientScope,
  hasGlobalRole,
} from "../auth/auth.access.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  createClientAccountSchema,
  upsertClientMembershipSchema,
  updateClientAccountSchema,
  updateClientTrackerSchema,
} from "./clients.schemas.js";
import {
  attachUserToClient,
  createClientAccount,
  getClientAccessList,
} from "./clients.service.js";
import { findClientAccountById, findClientPermissionsByAccountId } from "./clients.repository.js";
import { listColumnsByClientAccountId } from "../columns/columns.repository.js";

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/brand-brain", async (request) => {
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]);
    const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
    if (request.auth?.user.globalRole === "cliente" && !permissions?.allowClientViewBrandBrain) throw app.httpErrors.forbidden("Brand Brain não está disponível para este cliente.");
    const [rows] = await app.db.query<Array<RowDataPacket & { workspace_drawer_json: { brandBrain?: unknown } | null }>>("SELECT workspace_drawer_json FROM client_accounts WHERE id = ?", [clientAccountId]);
    return { data: rows[0]?.workspace_drawer_json?.brandBrain ?? null };
  });

  app.put("/clients/:clientAccountId/brand-brain", async (request) => {
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]);
    const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
    if (request.auth?.user.globalRole === "cliente" && !permissions?.allowClientEditBrandBrain) throw app.httpErrors.forbidden("Este cliente não pode editar o Brand Brain.");
    const [rows] = await app.db.query<Array<RowDataPacket & { workspace_drawer_json: Record<string, unknown> | null }>>("SELECT workspace_drawer_json FROM client_accounts WHERE id = ?", [clientAccountId]);
    const body = request.body as { data?: unknown };
    await app.db.query("UPDATE client_accounts SET workspace_drawer_json = ? WHERE id = ?", [JSON.stringify({ ...(rows[0]?.workspace_drawer_json ?? {}), brandBrain: body.data ?? {} }), clientAccountId]);
    return { ok: true };
  });

  app.get("/clients/:clientAccountId/activities", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    const [rows] = await app.db.query<Array<RowDataPacket & { id: string; title: string; detail: string; type: string; occurred_at: string }>>(
      [
        "SELECT id, title, 'Card criado' AS detail, 'card' AS type, created_at AS occurred_at FROM kanban_cards WHERE client_account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)",
        "UNION ALL SELECT id, title, 'Card atualizado' AS detail, 'card' AS type, updated_at AS occurred_at FROM kanban_cards WHERE client_account_id = ? AND updated_at > created_at AND updated_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)",
        "UNION ALL SELECT al.id, kc.title, CASE WHEN al.approved_at IS NOT NULL THEN 'Aprovado pelo cliente' WHEN al.viewed_at IS NOT NULL THEN 'Aprovação visualizada' ELSE 'Pedido de aprovação enviado' END, 'approval', COALESCE(al.approved_at, al.viewed_at, al.created_at) FROM approval_links al INNER JOIN kanban_cards kc ON kc.id = al.card_id WHERE al.client_account_id = ? AND COALESCE(al.approved_at, al.viewed_at, al.created_at) >= DATE_SUB(NOW(), INTERVAL 15 DAY)",
        "ORDER BY occurred_at DESC LIMIT 120",
      ].join(" "),
      [clientAccountId, clientAccountId, clientAccountId],
    );
    return { items: rows.map((row) => ({ id: `${row.type}-${row.id}-${row.occurred_at}`, title: row.title, detail: row.detail, type: row.type, occurredAt: row.occurred_at })) };
  });

  app.get("/clients", async (request) => {
    assertInternalAccess(request);

    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);

    let sql = [
      "SELECT id, name, slug, logo_url, locale, portal_title, tracking_enabled, tracking_visible_to_client, owner_user_id, created_at,",
      "(SELECT COUNT(*) FROM client_memberships cm WHERE cm.client_account_id = client_accounts.id) AS access_count",
      "FROM client_accounts",
    ].join(" ");
    const params: string[] = [];

    if (scope.mode === "scoped") {
      if (scope.clientIds.length === 0) {
        return { items: [] };
      }
      sql += ` WHERE id IN (${scope.clientIds.map(() => "?").join(", ")})`;
      params.push(...scope.clientIds);
    }

    sql += " ORDER BY created_at DESC";

    const [rows] = await app.db.query<RowDataPacket[]>(sql, params);
    return {
      items: rows,
      scope,
    };
  });

  app.get("/dashboard/overview", async (request) => {
    assertInternalAccess(request);

    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
    if (scope.mode === "scoped" && scope.clientIds.length === 0) {
      return { dueTasks: [], upcomingPosts: [], agendaToday: [], clientSubmissions: [] };
    }

    const scopeSql = scope.mode === "global"
      ? ""
      : ` AND c.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")})`;
    const params = scope.mode === "global" ? [] : scope.clientIds;
    const [dueTasks] = await app.db.query<RowDataPacket[]>(
      [
        "SELECT c.id, c.title, c.deadline_at AS deadlineAt, c.client_label AS clientLabel,",
        "a.name AS clientName, a.logo_url AS clientLogoUrl",
        "FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id",
        "WHERE c.archived = 0 AND c.deadline_at IS NOT NULL", scopeSql,
        "ORDER BY c.deadline_at ASC LIMIT 4",
      ].join(" "),
      params,
    );
    const [clientSubmissions] = await app.db.query<RowDataPacket[]>(
      [
        "SELECT c.id, c.title, c.created_at AS createdAt, a.name AS clientName, a.logo_url AS clientLogoUrl",
        "FROM kanban_cards c JOIN users u ON u.id = c.created_by_user_id",
        "JOIN client_accounts a ON a.id = c.client_account_id",
        "WHERE c.archived = 0 AND u.global_role = 'cliente'", scopeSql,
        "ORDER BY c.created_at DESC LIMIT 4",
      ].join(" "),
      params,
    );
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysEnd = new Date(todayStart); threeDaysEnd.setDate(threeDaysEnd.getDate() + 3);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const [upcomingPosts] = await app.db.query<RowDataPacket[]>(
      ["SELECT c.id, c.title, c.scheduled_at AS scheduledAt, c.client_label AS clientLabel, a.name AS clientName, a.logo_url AS clientLogoUrl FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id WHERE c.archived = 0 AND c.scheduled_at >= ? AND c.scheduled_at < ?", scopeSql, "ORDER BY c.scheduled_at ASC LIMIT 6"].join(" "),
      [todayStart, threeDaysEnd, ...params],
    );
    const [agendaToday] = await app.db.query<RowDataPacket[]>(
      ["SELECT e.id, e.title, e.task_description AS taskDescription, e.starts_at AS startsAt, e.color, e.is_completed AS isCompleted, a.name AS clientName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id WHERE e.starts_at >= ? AND e.starts_at < ?", scope.mode === "global" ? "" : ` AND (e.client_account_id IS NULL OR e.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")}))`, "ORDER BY e.starts_at ASC LIMIT 6"].join(" "),
      [todayStart, tomorrowStart, ...(scope.mode === "global" ? [] : scope.clientIds)],
    );
    return { dueTasks, upcomingPosts, agendaToday, clientSubmissions };
  });

  app.get("/portal/accounts", async (request) => {
    if (!request.auth) {
      throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    }

    const auth = request.auth;
    // Internal roles can preview every client account they manage; clients remain scoped to their own portal.
    const items = auth.memberships
      .filter((membership) => auth.user.globalRole !== "cliente" || membership.membershipRole === "cliente")
      .map((membership) => ({
        clientAccountId: membership.clientAccountId,
        clientName: membership.clientName,
        clientSlug: membership.clientSlug,
        isPrimary: membership.isPrimary,
      }));

    return { items };
  });

  app.post("/clients", async (request) => {
    assertCanCreateClients(request);
    const input = createClientAccountSchema.parse(request.body);

    return {
      ok: true,
      client: await createClientAccount(app, input, request.auth!.user.id),
    };
  });

  app.get("/clients/:clientAccountId/tracker-settings", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin"]);

    const [client, permissions, columns] = await Promise.all([
      findClientAccountById(app.db, clientAccountId),
      findClientPermissionsByAccountId(app.db, clientAccountId),
      listColumnsByClientAccountId(app.db, clientAccountId),
    ]);
    if (!client || !permissions) throw app.httpErrors.notFound("Configurações do cliente não encontradas.");

    return {
      settings: {
        locale: client.locale,
        trackingEnabled: Boolean(client.tracking_enabled),
        trackingVisibleToClient: Boolean(client.tracking_visible_to_client),
        showUpcomingPosts: Boolean(client.show_upcoming_posts),
        showArchivedToClient: Boolean(client.show_archived_to_client),
        clientPermissions: permissions,
        columns: columns.map((column) => ({ id: column.id, name: column.name, visibleToClient: column.visibleToClient })),
      },
    };
  });

  app.patch("/clients/:clientAccountId/tracker-settings", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin"]);
    const input = updateClientTrackerSchema.parse(request.body);

    const [client] = await app.db.query<RowDataPacket[]>("SELECT id FROM client_accounts WHERE id = ? LIMIT 1", [clientAccountId]);
    if (!client[0]) throw app.httpErrors.notFound("Cliente não encontrado.");

    const permissions = input.clientPermissions;
    await app.db.query(
      "UPDATE client_accounts SET locale = ?, tracking_enabled = ?, tracking_visible_to_client = ?, show_upcoming_posts = ?, show_archived_to_client = ? WHERE id = ?",
      [input.locale, input.trackingEnabled ? 1 : 0, input.trackingVisibleToClient ? 1 : 0, input.showUpcomingPosts ? 1 : 0, input.showArchivedToClient ? 1 : 0, clientAccountId],
    );
    await app.db.query(
      [
        "UPDATE client_permissions SET",
        "allow_client_edit_caption = ?, allow_client_create_post = ?, allow_client_create_tags = ?, allow_client_download = ?,",
        "allow_client_edit_brand_brain = ?, allow_client_search = ?, allow_client_view_invoices = ?, allow_client_view_reports = ?,",
        "allow_client_view_brand_brain = ?, allow_client_view_tracking = ?",
        "WHERE client_account_id = ?",
      ].join(" "),
      [
        permissions.allowClientEditCaption ? 1 : 0,
        permissions.allowClientCreatePost ? 1 : 0,
        permissions.allowClientCreateTags ? 1 : 0,
        permissions.allowClientDownload ? 1 : 0,
        permissions.allowClientEditBrandBrain ? 1 : 0,
        permissions.allowClientSearch ? 1 : 0,
        permissions.allowClientViewInvoices ? 1 : 0,
        permissions.allowClientViewReports ? 1 : 0,
        permissions.allowClientViewBrandBrain ? 1 : 0,
        permissions.allowClientViewTracking ? 1 : 0,
        clientAccountId,
      ],
    );
    await app.db.query(
      `UPDATE kanban_columns SET visible_to_client = CASE WHEN id IN (${input.visibleColumnIds.length ? input.visibleColumnIds.map(() => "?").join(", ") : "''"}) THEN 1 ELSE 0 END WHERE client_account_id = ?`,
      [...input.visibleColumnIds, clientAccountId],
    );

    return { ok: true };
  });

  app.patch("/clients/:clientAccountId", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin"]);
    const input = updateClientAccountSchema.parse(request.body);
    const [sameSlug] = await app.db.query<RowDataPacket[]>(
      "SELECT id FROM client_accounts WHERE slug = ? AND id <> ? LIMIT 1",
      [input.slug, clientAccountId],
    );
    if (sameSlug.length > 0) throw app.httpErrors.conflict("Ja existe uma conta com esse identificador.");
    const [result] = await app.db.query<ResultSetHeader>(
      "UPDATE client_accounts SET name = ?, slug = ?, locale = ?, portal_title = ?, logo_url = ? WHERE id = ?",
      [input.name, input.slug, input.locale, input.portalTitle, input.logoUrl ?? null, clientAccountId],
    );
    if (result.affectedRows === 0) throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
    return { ok: true };
  });

  app.delete("/clients/:clientAccountId", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden("Apenas o super admin pode excluir clientes.");
    }
    const { clientAccountId } = request.params as { clientAccountId: string };
    const [result] = await app.db.query<ResultSetHeader>("DELETE FROM client_accounts WHERE id = ?", [clientAccountId]);
    if (result.affectedRows === 0) throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
    return { ok: true };
  });

  app.get("/clients/:clientAccountId/accesses", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);

    return getClientAccessList(app, params.clientAccountId);
  });

  app.get("/clients/:clientAccountId/workspace-drawer", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const [rows] = await app.db.query<Array<RowDataPacket & { workspace_drawer_json: unknown }>>(
      "SELECT workspace_drawer_json FROM client_accounts WHERE id = ? LIMIT 1",
      [params.clientAccountId],
    );
    return { data: rows[0]?.workspace_drawer_json ?? null };
  });

  app.put("/clients/:clientAccountId/workspace-drawer", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const body = request.body as { data?: unknown };
    await app.db.query("UPDATE client_accounts SET workspace_drawer_json = ? WHERE id = ?", [JSON.stringify(body.data ?? {}), params.clientAccountId]);
    return { ok: true };
  });

  app.get("/clients/:clientAccountId/kanban-automations", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const [rows] = await app.db.query<Array<RowDataPacket & { kanban_automations_json: unknown }>>("SELECT kanban_automations_json FROM client_accounts WHERE id = ? LIMIT 1", [params.clientAccountId]);
    return { items: rows[0]?.kanban_automations_json ?? [] };
  });

  app.put("/clients/:clientAccountId/kanban-automations", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const body = request.body as { items?: unknown[] };
    await app.db.query("UPDATE client_accounts SET kanban_automations_json = ? WHERE id = ?", [JSON.stringify(body.items ?? []), params.clientAccountId]);
    return { ok: true };
  });

  app.post("/clients/:clientAccountId/accesses", async (request) => {
    if (!request.auth) {
      throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    }
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden(
        "Apenas o super admin pode vincular acessos.",
      );
    }

    const params = request.params as { clientAccountId: string };
    const input = upsertClientMembershipSchema.parse(request.body);
    const accesses = await attachUserToClient(
      app,
      params.clientAccountId,
      input,
      request.auth.user.id,
    );

    return {
      ok: true,
      accesses,
    };
  });
};
