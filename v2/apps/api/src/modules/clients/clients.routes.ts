import type { FastifyPluginAsync } from "fastify";
import {
  assertCanCreateClients,
  assertClientAccess,
  assertInternalAccess,
  assertPortalAccessLevel,
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
import { ensureClientMembershipAccessLevels, findClientAccountById, findClientPermissionsByAccountId, removeClientMembership } from "./clients.repository.js";
import { listColumnsByClientAccountId } from "../columns/columns.repository.js";
import { ensureCardActivityEventsTable } from "../cards/card-activity.service.js";
import {
  addBrandBrainComment,
  createBrandBrainRevision,
  decideBrandBrainRevision,
  ensureBrandBrainTables,
  getBrandBrainSnapshot,
  saveOfficialBrandBrain,
} from "./brand-brain.service.js";
import { ensureClientFeedbackEventsTable, recordClientFeedbackEvent } from "./client-feedback.service.js";

function parseWorkspaceDrawer(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export const clientRoutes: FastifyPluginAsync = async (app) => {
  await ensureClientMembershipAccessLevels(app.db);
  await ensureBrandBrainTables(app.db);
  await ensureClientFeedbackEventsTable(app.db);
  await ensureCardActivityEventsTable(app.db);

  app.post("/portal/accounts/:clientAccountId/feedback-events", async (request) => {
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, clientAccountId, ["admin", "approver"]);
    const body = request.body as { sourceType?: string; sourceId?: string; activityType?: string; title?: string; detail?: string };
    if (body.sourceType !== "contract" || body.activityType !== "contract_accepted" || !body.sourceId?.trim() || !body.title?.trim()) throw app.httpErrors.badRequest("Evento de aceite inválido.");
    const account = await findClientAccountById(app.db, clientAccountId);
    if (!account) throw app.httpErrors.notFound("Cliente não encontrado.");
    await recordClientFeedbackEvent(app.db, { clientAccountId, clientName: account.name, sourceType: "contract", sourceId: body.sourceId, activityType: "contract_accepted", title: body.title, detail: body.detail });
    return { ok: true };
  });

  app.post("/public/client-feedback-events", async (request) => {
    const body = request.body as { sourceType?: string; sourceId?: string; activityType?: string; clientName?: string; title?: string; detail?: string };
    if (body.sourceType !== "proposal" || body.activityType !== "proposal_accepted" || !body.sourceId?.trim() || !body.clientName?.trim() || !body.title?.trim()) throw app.httpErrors.badRequest("Evento de aceite inválido.");
    const [accounts] = await app.db.query<RowDataPacket[]>("SELECT id, name FROM client_accounts WHERE LOWER(name) = LOWER(?) LIMIT 1", [body.clientName.trim()]);
    await recordClientFeedbackEvent(app.db, { clientAccountId: accounts[0]?.id ?? null, clientName: accounts[0]?.name ?? body.clientName, sourceType: "proposal", sourceId: body.sourceId, activityType: "proposal_accepted", title: body.title, detail: body.detail });
    return { ok: true };
  });
  app.get("/clients/:clientAccountId/brand-brain", async (request) => {
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]);
    const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
    if (request.auth?.user.globalRole === "cliente" && !permissions?.allowClientViewBrandBrain) throw app.httpErrors.forbidden("Brand Brain não está disponível para este cliente.");
    return getBrandBrainSnapshot(app.db, clientAccountId, request.auth?.user.globalRole !== "cliente");
  });

  app.put("/clients/:clientAccountId/brand-brain", async (request) => {
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, clientAccountId, ["admin", "approver"]);
    const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
    if (request.auth?.user.globalRole === "cliente" && !permissions?.allowClientEditBrandBrain) throw app.httpErrors.forbidden("Este cliente não pode editar o Brand Brain.");
    const body = request.body as { data?: Record<string, unknown>; summary?: string };
    const actor = request.auth!.user;
    if (actor.globalRole === "cliente") {
      const revision = await createBrandBrainRevision(app.db, { clientAccountId, data: body.data ?? {}, summary: body.summary, userId: actor.id, authorName: actor.fullName, authorRole: actor.globalRole });
      return { ok: true, pending: true, revision };
    }
    const version = await saveOfficialBrandBrain(app.db, { clientAccountId, data: body.data ?? {}, userId: actor.id, authorName: actor.fullName });
    return { ok: true, pending: false, version };
  });

  app.post("/clients/:clientAccountId/brand-brain/revisions/:revisionId/decision", async (request) => {
    const { clientAccountId, revisionId } = request.params as { clientAccountId: string; revisionId: string };
    assertInternalAccess(request); assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    const actor = request.auth!.user; const body = request.body as { approved?: boolean };
    const result = await decideBrandBrainRevision(app.db, { clientAccountId, revisionId, approved: Boolean(body.approved), userId: actor.id, reviewerName: actor.fullName });
    if (!result) throw app.httpErrors.notFound("Sugestão não encontrada.");
    return { ok: true, ...result };
  });

  app.post("/clients/:clientAccountId/brand-brain/comments", async (request) => {
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, clientAccountId, ["admin", "approver"]);
    const permissions = await findClientPermissionsByAccountId(app.db, clientAccountId);
    const actor = request.auth!.user;
    if (actor.globalRole === "cliente" && !permissions?.allowClientViewBrandBrain) throw app.httpErrors.forbidden("Brand Brain não está disponível para este cliente.");
    const body = request.body as { commentText?: string; revisionId?: string | null; sectionKey?: string; isInternal?: boolean };
    if (!body.commentText?.trim()) throw app.httpErrors.badRequest("Escreva um comentário.");
    const comment = await addBrandBrainComment(app.db, { clientAccountId, revisionId: body.revisionId, sectionKey: body.sectionKey, commentText: body.commentText, userId: actor.id, authorName: actor.fullName, authorRole: actor.globalRole, isInternal: actor.globalRole === "cliente" ? false : Boolean(body.isInternal) });
    return { ok: true, comment };
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
        "UNION ALL SELECT cae.id, kc.title, CONCAT(cae.actor_name, CASE WHEN cae.activity_type = 'client_approved' THEN ' aprovou o conteúdo' ELSE ' solicitou alterações' END) AS detail, 'approval' AS type, cae.occurred_at FROM card_activity_events cae INNER JOIN kanban_cards kc ON kc.id = cae.card_id WHERE cae.client_account_id = ? AND cae.occurred_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)",
        "UNION ALL SELECT ae.id, kc.title, CONCAT(ae.actor_name, CASE WHEN ae.action = 'resubmitted' THEN ' reenviou para aprovação' ELSE ' iniciou a aprovação do post após a pauta' END), 'approval', ae.created_at FROM card_approval_events ae INNER JOIN kanban_cards kc ON kc.id = ae.card_id WHERE kc.client_account_id = ? AND ae.action IN ('resubmitted', 'converted_to_post') AND ae.created_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)",
        "ORDER BY occurred_at DESC LIMIT 120",
      ].join(" "),
      [clientAccountId, clientAccountId, clientAccountId, clientAccountId, clientAccountId],
    );
    return { items: rows.map((row) => ({ id: `${row.type}-${row.id}-${row.occurred_at}`, title: row.title, detail: row.detail, type: row.type, occurredAt: row.occurred_at })) };
  });

  app.get("/clients", async (request) => {
    assertInternalAccess(request);

    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);

    let sql = [
      "SELECT a.id, a.name, a.slug, a.logo_url, a.locale, a.portal_title, a.tracking_enabled, a.tracking_visible_to_client, a.owner_user_id, a.created_at,",
      "COALESCE(m.access_count, 0) AS access_count",
      "FROM client_accounts a",
      "LEFT JOIN (SELECT client_account_id, COUNT(*) AS access_count FROM client_memberships GROUP BY client_account_id) m ON m.client_account_id = a.id",
    ].join(" ");
    const params: string[] = [];

    if (scope.mode === "scoped") {
      if (scope.clientIds.length === 0) {
        return { items: [] };
      }
      sql += ` WHERE a.id IN (${scope.clientIds.map(() => "?").join(", ")})`;
      params.push(...scope.clientIds);
    }

    sql += " ORDER BY a.created_at DESC";

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
      return { dueTasks: [], upcomingPosts: [], postsToday: [], agendaToday: [], clientSubmissions: [], clientActivities: [], approvedPautas: [] };
    }

    const scopeSql = scope.mode === "global"
      ? ""
      : ` AND c.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")})`;
    const params = scope.mode === "global" ? [] : scope.clientIds;
    const brandScopeSql = scope.mode === "global" ? "" : ` AND r.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")})`;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const upcomingEnd = new Date(todayStart); upcomingEnd.setDate(upcomingEnd.getDate() + 4);
    const [
      [dueTasks],
      [clientSubmissions],
      [clientActivities],
      [brandBrainActivities],
      [documentActivities],
      [upcomingPosts],
      [postsToday],
      [agendaToday],
      [approvedPautas],
    ] = await Promise.all([
      app.db.query<RowDataPacket[]>([
        "SELECT c.id, c.title, c.deadline_at AS deadlineAt, c.client_label AS clientLabel,",
        "a.name AS clientName, a.logo_url AS clientLogoUrl",
        "FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id",
        "WHERE c.archived = 0 AND c.deadline_at IS NOT NULL", scopeSql,
        "ORDER BY c.deadline_at ASC LIMIT 4",
      ].join(" "), params),
      app.db.query<RowDataPacket[]>([
        "SELECT c.id, c.title, c.created_at AS createdAt, a.name AS clientName, a.logo_url AS clientLogoUrl",
        "FROM kanban_cards c JOIN users u ON u.id = c.created_by_user_id",
        "JOIN client_accounts a ON a.id = c.client_account_id",
        "WHERE c.archived = 0 AND (u.global_role = 'cliente' OR c.status_json LIKE '%Sugestão do cliente%')", scopeSql,
        "ORDER BY c.created_at DESC LIMIT 4",
      ].join(" "), params),
      app.db.query<RowDataPacket[]>([
        "SELECT activity.* FROM (",
        "SELECT CONCAT('approval-event-', e.id) AS id, c.id AS cardId, c.title, e.created_at AS occurredAt,",
        "a.name AS clientName, a.slug AS clientSlug, a.logo_url AS clientLogoUrl, e.decision AS activityType,",
        "CASE WHEN e.source = 'legacy' THEN CONCAT('Estado anterior preservado: ', COALESCE(e.comment_text, '')) ELSE COALESCE(e.comment_text, '') END AS detail,",
        "1 AS recordedDecision, CASE WHEN e.revision = c.approval_revision AND c.approval_state = 'approved' AND c.archived = 0 AND c.scheduled_at IS NULL AND c.published_at IS NULL THEN 1 ELSE 0 END AS canSchedule",
        "FROM card_approval_events e JOIN kanban_cards c ON c.id = e.card_id JOIN client_accounts a ON a.id = c.client_account_id",
        "WHERE c.is_brief_approval = 0 AND e.decision IN ('approved', 'changes_requested')", scopeSql,
        "UNION ALL",
        "SELECT CONCAT('decision-', c.id, '-', UNIX_TIMESTAMP(c.updated_at)) AS id, c.id AS cardId, c.title, c.updated_at AS occurredAt,",
        "a.name AS clientName, a.slug AS clientSlug, a.logo_url AS clientLogoUrl,",
        "CASE WHEN LOWER(c.client_label) LIKE '%aprovad%' THEN 'approved' ELSE 'changes_requested' END AS activityType,",
        "CASE WHEN LOWER(c.client_label) LIKE '%aprovad%' THEN 'Conteúdo aprovado pelo cliente' ELSE 'Cliente solicitou alterações' END AS detail, 0 AS recordedDecision, 1 AS canSchedule",
        "FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id",
        "WHERE c.approval_revision = 0 AND c.archived = 0 AND c.is_brief_approval = 0 AND c.scheduled_at IS NULL AND (LOWER(c.client_label) LIKE '%aprovad%' OR LOWER(c.client_label) LIKE '%altera%')", scopeSql,
        "UNION ALL",
        "SELECT CONCAT('comment-', cc.id) AS id, c.id AS cardId, c.title, cc.created_at AS occurredAt,",
        "a.name AS clientName, a.slug AS clientSlug, a.logo_url AS clientLogoUrl, 'comment' AS activityType, LEFT(CASE WHEN cc.comment_text = 'Legenda editada pelo cliente.' THEN CONCAT('Nova legenda: ', COALESCE(NULLIF(c.caption, ''), 'sem texto')) ELSE cc.comment_text END, 240) AS detail, 0 AS recordedDecision, 0 AS canSchedule",
        "FROM card_comments cc JOIN kanban_cards c ON c.id = cc.card_id JOIN client_accounts a ON a.id = c.client_account_id",
        // A client response remains useful feedback even if the card was later
        // scheduled or archived. The dashboard's X control is what explicitly
        // marks it as viewed; card workflow changes must not hide it first.
        "WHERE c.is_brief_approval = 0 AND cc.is_internal = 0 AND cc.author_role IN ('cliente', 'guest') AND NOT EXISTS (SELECT 1 FROM card_approval_events ce WHERE ce.comment_id = cc.id)", scopeSql,
        ") activity ORDER BY activity.occurredAt DESC LIMIT 24",
      ].join(" "), [...params, ...params, ...params]),
      app.db.query<RowDataPacket[]>([
        "SELECT CONCAT('brand-revision-', r.id) AS id, NULL AS cardId, 'Sugestão para o Brand Brain' AS title, r.created_at AS occurredAt,",
        "a.name AS clientName, a.slug AS clientSlug, a.logo_url AS clientLogoUrl, 'brand_brain' AS activityType,",
        "COALESCE(r.summary, CONCAT(r.author_name, ' sugeriu uma atualização da marca')) AS detail",
        "FROM brand_brain_revisions r JOIN client_accounts a ON a.id = r.client_account_id",
        "WHERE r.status = 'pending' AND r.author_role = 'cliente'", brandScopeSql,
        "ORDER BY r.created_at DESC LIMIT 8",
      ].join(" "), params),
      app.db.query<RowDataPacket[]>([
        "SELECT CONCAT('document-', e.id) AS id, NULL AS cardId, e.title, e.occurred_at AS occurredAt,",
        "COALESCE(a.name, e.client_name) AS clientName, COALESCE(a.slug, '') AS clientSlug, a.logo_url AS clientLogoUrl,",
        "e.activity_type AS activityType, COALESCE(e.detail, '') AS detail",
        "FROM client_feedback_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id WHERE 1=1",
        scope.mode === "global" ? "" : `AND e.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")})`,
        "ORDER BY e.occurred_at DESC LIMIT 8",
      ].join(" "), params),
      app.db.query<RowDataPacket[]>(
        ["SELECT c.id, c.title, c.scheduled_at AS scheduledAt, a.name AS clientName, a.logo_url AS clientLogoUrl FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id WHERE c.archived = 0 AND c.scheduled_at >= ? AND c.scheduled_at < ?", scopeSql, "ORDER BY c.scheduled_at ASC LIMIT 20"].join(" "),
        [tomorrowStart, upcomingEnd, ...params],
      ),
      app.db.query<RowDataPacket[]>(
        ["SELECT c.id, c.title, c.scheduled_at AS scheduledAt, c.primary_media_url AS mediaUrl, a.name AS clientName, a.logo_url AS clientLogoUrl FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id WHERE c.archived = 0 AND c.scheduled_at >= ? AND c.scheduled_at < ?", scopeSql, "ORDER BY c.scheduled_at ASC, c.title ASC LIMIT 50"].join(" "),
        [todayStart, tomorrowStart, ...params],
      ),
      app.db.query<RowDataPacket[]>(
        ["SELECT e.id, e.title, e.task_description AS taskDescription, e.starts_at AS startsAt, e.color, e.is_completed AS isCompleted, e.agenda_label_id AS labelId, l.name AS labelName, a.name AS clientName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id LEFT JOIN agenda_labels l ON l.id = e.agenda_label_id WHERE e.starts_at >= ? AND e.starts_at < ?", scope.mode === "global" ? "" : ` AND (e.client_account_id IS NULL OR e.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")}))`, "ORDER BY e.starts_at ASC LIMIT 6"].join(" "),
        [todayStart, tomorrowStart, ...(scope.mode === "global" ? [] : scope.clientIds)],
      ),
      app.db.query<RowDataPacket[]>([
        "SELECT c.id, c.title, COALESCE(MAX(ae.created_at), MAX(al.approved_at), c.updated_at) AS approvedAt,",
        "a.name AS clientName, a.slug AS clientSlug, a.logo_url AS clientLogoUrl",
        "FROM kanban_cards c JOIN client_accounts a ON a.id = c.client_account_id",
        "LEFT JOIN approval_links al ON al.card_id = c.id AND al.approved_at IS NOT NULL",
        "LEFT JOIN card_approval_events ae ON ae.card_id = c.id AND ae.revision = c.approval_revision AND ae.action = 'approved'",
        "WHERE c.archived = 0 AND c.is_brief_approval = 1 AND (c.approval_state = 'approved' OR (c.approval_revision = 0 AND LOWER(c.client_label) NOT LIKE '%altera%' AND (LOWER(c.client_label) LIKE '%aprovad%' OR al.approved_at IS NOT NULL)))", scopeSql,
        "GROUP BY c.id, c.title, c.updated_at, a.name, a.slug, a.logo_url ORDER BY approvedAt DESC LIMIT 12",
      ].join(" "), params),
    ]);
    const combinedClientActivities = [...clientActivities, ...brandBrainActivities, ...documentActivities]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 24);
    return { dueTasks, upcomingPosts, postsToday, agendaToday, clientSubmissions, clientActivities: combinedClientActivities, approvedPautas };
  });

  app.get("/portal/accounts", async (request) => {
    if (!request.auth) {
      throw app.httpErrors.unauthorized("Sessão obrigatória.");
    }

    const auth = request.auth;
    // Super admins can preview every portal without needing an artificial
    // membership for each client. Other roles remain scoped to their assigned
    // accounts, and clients only receive their own portal memberships.
    if (auth.user.globalRole === "super_admin") {
      const [accounts] = await app.db.query<Array<RowDataPacket & {
        id: string;
        name: string;
        slug: string;
        is_primary: number;
      }>>(
        [
          "SELECT a.id, a.name, a.slug, COALESCE(cm.is_primary, 0) AS is_primary",
          "FROM client_accounts a",
          "LEFT JOIN client_memberships cm ON cm.client_account_id = a.id AND cm.user_id = ?",
          "ORDER BY cm.is_primary DESC, a.name ASC",
        ].join(" "),
        [auth.user.id],
      );

      return {
        items: accounts.map((account) => ({
          clientAccountId: account.id,
          clientName: account.name,
          clientSlug: account.slug,
          isPrimary: Boolean(account.is_primary),
        })),
      };
    }

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
    const connection = await app.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE client_accounts SET locale = ?, tracking_enabled = ?, tracking_visible_to_client = ?, show_upcoming_posts = ?, show_archived_to_client = ? WHERE id = ?",
        [input.locale, input.trackingEnabled ? 1 : 0, input.trackingVisibleToClient ? 1 : 0, input.showUpcomingPosts ? 1 : 0, input.showArchivedToClient ? 1 : 0, clientAccountId],
      );
      await connection.query(
        [
          "UPDATE client_permissions SET",
          "allow_client_edit_caption = ?, allow_client_create_post = ?, allow_client_create_tags = ?, allow_client_download = ?,",
          "allow_client_edit_brand_brain = ?, allow_client_search = ?, allow_client_view_texts = ?, allow_client_view_invoices = ?, allow_client_view_reports = ?,",
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
          permissions.allowClientViewTexts ? 1 : 0,
          permissions.allowClientViewInvoices ? 1 : 0,
          permissions.allowClientViewReports ? 1 : 0,
          permissions.allowClientViewBrandBrain ? 1 : 0,
          permissions.allowClientViewTracking ? 1 : 0,
          clientAccountId,
        ],
      );
      await connection.query(
        `UPDATE kanban_columns SET visible_to_client = CASE WHEN id IN (${input.visibleColumnIds.length ? input.visibleColumnIds.map(() => "?").join(", ") : "''"}) THEN 1 ELSE 0 END WHERE client_account_id = ?`,
        [...input.visibleColumnIds, clientAccountId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

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
    if (sameSlug.length > 0) throw app.httpErrors.conflict("Já existe uma conta com esse identificador.");
    const [result] = await app.db.query<ResultSetHeader>(
      "UPDATE client_accounts SET name = ?, slug = ?, locale = ?, portal_title = ?, logo_url = ? WHERE id = ?",
      [input.name, input.slug, input.locale, input.portalTitle, input.logoUrl ?? null, clientAccountId],
    );
    if (result.affectedRows === 0) throw app.httpErrors.notFound("Conta do cliente não encontrada.");
    return { ok: true };
  });

  app.delete("/clients/:clientAccountId", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden("Apenas o super admin pode excluir clientes.");
    }
    const { clientAccountId } = request.params as { clientAccountId: string };
    const [result] = await app.db.query<ResultSetHeader>("DELETE FROM client_accounts WHERE id = ?", [clientAccountId]);
    if (result.affectedRows === 0) throw app.httpErrors.notFound("Conta do cliente não encontrada.");
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

  app.get("/clients/workspace-quick-links", async (request) => {
    assertInternalAccess(request);
    const [rows] = await app.db.query<Array<RowDataPacket & { workspace_drawer_json: unknown }>>(
      "SELECT workspace_drawer_json FROM client_accounts WHERE workspace_drawer_json IS NOT NULL ORDER BY updated_at DESC",
    );
    for (const row of rows) {
      const quick = parseWorkspaceDrawer(row.workspace_drawer_json).quick;
      if (Array.isArray(quick) && quick.length > 0) return { items: quick };
    }
    return { items: [] };
  });

  app.put("/clients/workspace-quick-links", async (request) => {
    assertInternalAccess(request);
    if (!hasGlobalRole(request.auth!.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden("Apenas o super admin pode editar os links rápidos globais.");
    }
    const body = request.body as { items?: unknown };
    if (!Array.isArray(body.items)) throw app.httpErrors.badRequest("Lista de links rápidos inválida.");
    const [rows] = await app.db.query<Array<RowDataPacket & { id: string; workspace_drawer_json: unknown }>>(
      "SELECT id, workspace_drawer_json FROM client_accounts",
    );
    for (const row of rows) {
      const drawer = parseWorkspaceDrawer(row.workspace_drawer_json);
      await app.db.query("UPDATE client_accounts SET workspace_drawer_json = ? WHERE id = ?", [JSON.stringify({ ...drawer, quick: body.items }), row.id]);
    }
    return { ok: true, items: body.items };
  });

  app.put("/clients/:clientAccountId/workspace-drawer", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const body = request.body as { data?: unknown };
    const [rows] = await app.db.query<Array<RowDataPacket & { workspace_drawer_json: unknown }>>(
      "SELECT workspace_drawer_json FROM client_accounts WHERE id = ? LIMIT 1",
      [params.clientAccountId],
    );
    const current = parseWorkspaceDrawer(rows[0]?.workspace_drawer_json);
    const incoming = parseWorkspaceDrawer(body.data);
    // "Rápidos" is global. A client-specific drawer save must never replace it
    // with a stale copy loaded from another Kanban.
    const data = { ...incoming, quick: current.quick ?? incoming.quick ?? [] };
    await app.db.query("UPDATE client_accounts SET workspace_drawer_json = ? WHERE id = ?", [JSON.stringify(data), params.clientAccountId]);
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
      throw app.httpErrors.unauthorized("Sessão obrigatória.");
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

  app.delete("/clients/:clientAccountId/accesses/:membershipId", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden("Apenas o super admin pode remover acessos.");
    }
    const params = request.params as { clientAccountId: string; membershipId: string };
    const removed = await removeClientMembership(app.db, params.clientAccountId, params.membershipId);
    if (!removed) throw app.httpErrors.notFound("Acesso não encontrado.");
    return { ok: true, ...(await getClientAccessList(app, params.clientAccountId)) };
  });
};
