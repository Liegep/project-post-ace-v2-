import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../modules/auth/auth.crypto.js";
import { loadEnv } from "../config/env.js";

type SeedUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  globalRole: "super_admin" | "admin" | "colaborador" | "cliente";
  locale: string;
};

const users: SeedUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Liege Paschoalini",
    email: "liege@designhub.local",
    password: "DesignHub2026!",
    globalRole: "super_admin",
    locale: "pt",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    fullName: "Aline Gestora",
    email: "aline@designhub.local",
    password: "ClienteAline26!",
    globalRole: "admin",
    locale: "pt",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Carlos Colaborador",
    email: "carlos@designhub.local",
    password: "ColabCarlos26!",
    globalRole: "colaborador",
    locale: "pt",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    fullName: "Serena Genovese",
    email: "serena@designhub.local",
    password: "SerenaCliente26!",
    globalRole: "cliente",
    locale: "it",
  },
];

async function main() {
  const env = loadEnv();
  const rootDir = path.resolve(process.cwd(), "../..");
  const schemaPath = path.join(rootDir, "apps/api/db/schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");

  const adminConnection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  await adminConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await adminConnection.query(`USE \`${env.DB_NAME}\`; ${schemaSql}`);
  await adminConnection.end();

  const db = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  const [externalLinkColumn] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM kanban_cards LIKE 'external_link_url'",
  );
  if (externalLinkColumn.length === 0) {
    await db.query(
      "ALTER TABLE kanban_cards ADD COLUMN external_link_url VARCHAR(1024) NULL AFTER media_urls_json",
    );
  }

  const migrations = [
    ["hashtags_json", "ALTER TABLE kanban_cards ADD COLUMN hashtags_json JSON NULL AFTER tags_json"],
    ["is_brief_approval", "ALTER TABLE kanban_cards ADD COLUMN is_brief_approval TINYINT(1) NOT NULL DEFAULT 0 AFTER hashtags_json"],
    ["keep_files", "ALTER TABLE kanban_cards ADD COLUMN keep_files TINYINT(1) NOT NULL DEFAULT 0 AFTER is_brief_approval"],
    ["scheduled_timezone", "ALTER TABLE kanban_cards ADD COLUMN scheduled_timezone VARCHAR(64) NULL AFTER scheduled_at"],
  ] as const;
  for (const [column, statement] of migrations) {
    const [rows] = await db.query<RowDataPacket[]>(`SHOW COLUMNS FROM kanban_cards LIKE '${column}'`);
    if (rows.length === 0) await db.query(statement);
  }

  const [drawerColumn] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM client_accounts LIKE 'workspace_drawer_json'");
  if (drawerColumn.length === 0) {
    await db.query("ALTER TABLE client_accounts ADD COLUMN workspace_drawer_json JSON NULL AFTER tracking_visible_to_client");
  }

  const [automationsColumn] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM client_accounts LIKE 'kanban_automations_json'");
  if (automationsColumn.length === 0) {
    await db.query("ALTER TABLE client_accounts ADD COLUMN kanban_automations_json JSON NULL AFTER workspace_drawer_json");
  }

  await db.query(
    [
      "CREATE TABLE IF NOT EXISTS client_tags (",
      "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL,",
      "name VARCHAR(100) NOT NULL, color VARCHAR(20) NOT NULL DEFAULT '#5e5cf1', legacy_id VARCHAR(120) NULL,",
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
      "UNIQUE KEY uq_client_tags_account_name (client_account_id, name), KEY idx_client_tags_account (client_account_id),",
      "CONSTRAINT fk_client_tags_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE",
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ].join(" "),
  );
  await db.query(
    [
      "CREATE TABLE IF NOT EXISTS agenda_events (",
      "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NULL, agenda_label_id CHAR(36) NULL, title VARCHAR(255) NOT NULL, task_description TEXT NULL, starts_at DATETIME NOT NULL, ends_at DATETIME NULL, recurrence_type ENUM('none', 'weekdays', 'weekly', 'monthly_nth_weekday') NOT NULL DEFAULT 'none', repeat_until DATE NULL, color VARCHAR(20) NOT NULL DEFAULT '#c9f7df', is_completed TINYINT(1) NOT NULL DEFAULT 0, created_by_user_id CHAR(36) NULL,",
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
      "KEY idx_agenda_events_starts_at (starts_at), KEY idx_agenda_events_account (client_account_id),",
      "CONSTRAINT fk_agenda_events_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE SET NULL ON UPDATE CASCADE,",
      "CONSTRAINT fk_agenda_events_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ].join(" "),
  );
  const [agendaTaskColumn] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM agenda_events LIKE 'task_description'");
  if (agendaTaskColumn.length === 0) {
    await db.query("ALTER TABLE agenda_events ADD COLUMN task_description TEXT NULL AFTER title");
  }
  const [agendaLabelColumn] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM agenda_events LIKE 'agenda_label_id'");
  if (agendaLabelColumn.length === 0) {
    await db.query("ALTER TABLE agenda_events ADD COLUMN agenda_label_id CHAR(36) NULL AFTER client_account_id");
    await db.query("ALTER TABLE agenda_events ADD KEY idx_agenda_events_label (agenda_label_id)");
  }
  const agendaRecurrenceMigrations = [
    ["recurrence_type", "ALTER TABLE agenda_events ADD COLUMN recurrence_type ENUM('none', 'weekdays', 'weekly', 'monthly_nth_weekday') NOT NULL DEFAULT 'none' AFTER ends_at"],
    ["repeat_until", "ALTER TABLE agenda_events ADD COLUMN repeat_until DATE NULL AFTER recurrence_type"],
  ] as const;
  for (const [column, statement] of agendaRecurrenceMigrations) {
    const [rows] = await db.query<RowDataPacket[]>(`SHOW COLUMNS FROM agenda_events LIKE '${column}'`);
    if (rows.length === 0) await db.query(statement);
  }
  await db.query(
    "CREATE TABLE IF NOT EXISTS agenda_labels (id CHAR(36) NOT NULL PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, color VARCHAR(20) NOT NULL DEFAULT '#4285f4', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_agenda_labels_user_name (user_id, name), KEY idx_agenda_labels_user (user_id), CONSTRAINT fk_agenda_labels_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );
  await db.query(
    [
      "CREATE TABLE IF NOT EXISTS client_texts (",
      "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, title VARCHAR(255) NOT NULL, content_html LONGTEXT NOT NULL, content_type VARCHAR(40) NOT NULL DEFAULT 'Texto', status VARCHAR(40) NOT NULL DEFAULT 'Rascunho', planned_at DATE NULL, internal_notes TEXT NULL, is_sent_to_client TINYINT(1) NOT NULL DEFAULT 0, sent_at DATETIME NULL, created_by_user_id CHAR(36) NULL,",
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
      "KEY idx_client_texts_account_updated (client_account_id, updated_at), KEY idx_client_texts_account_sent (client_account_id, is_sent_to_client),",
      "CONSTRAINT fk_client_texts_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
      "CONSTRAINT fk_client_texts_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ].join(" "),
  );
  await db.query(
    [
      "CREATE TABLE IF NOT EXISTS text_comments (",
      "id CHAR(36) NOT NULL PRIMARY KEY, text_id CHAR(36) NOT NULL, user_id CHAR(36) NULL, author_name VARCHAR(190) NOT NULL, author_role ENUM('super_admin', 'admin', 'colaborador', 'cliente', 'guest') NOT NULL, comment_text TEXT NOT NULL, is_internal TINYINT(1) NOT NULL DEFAULT 0,",
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
      "KEY idx_text_comments_text_created (text_id, created_at),",
      "CONSTRAINT fk_text_comments_text FOREIGN KEY (text_id) REFERENCES client_texts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
      "CONSTRAINT fk_text_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ].join(" "),
  );
  await db.query(
    [
      "CREATE TABLE IF NOT EXISTS hashtag_groups (",
      "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, hashtags_json JSON NOT NULL, legacy_id VARCHAR(120) NULL,",
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
      "KEY idx_hashtag_groups_account (client_account_id),",
      "CONSTRAINT fk_hashtag_groups_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE",
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ].join(" "),
  );

  const [existingUsers] = await db.query<Array<RowDataPacket & { total: number }>>(
    "SELECT COUNT(*) AS total FROM users",
  );

  if ((existingUsers[0]?.total ?? 0) > 0) {
    console.log("Banco ja possui dados. Bootstrap ignorado para nao sobrescrever.");
    await db.end();
    return;
  }

  const passwordHashes = await Promise.all(
    users.map(async (user) => [user.id, await hashPassword(user.password)] as const),
  );
  const hashByUserId = new Map(passwordHashes);

  for (const user of users) {
    await db.query(
      [
        "INSERT INTO users",
        "(id, full_name, email, password_hash, global_role, locale, is_active)",
        "VALUES (?, ?, ?, ?, ?, ?, 1)",
      ].join(" "),
      [
        user.id,
        user.fullName,
        user.email,
        hashByUserId.get(user.id),
        user.globalRole,
        user.locale,
      ],
    );
  }

  const clientAplikasiId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const clientMinasId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const clientPodcastId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  await db.query(
    [
      "INSERT INTO client_accounts",
      "(id, name, slug, owner_user_id, locale, portal_title, show_upcoming_posts, show_archived_to_client, tracking_enabled, tracking_visible_to_client, calendar_color)",
      "VALUES",
      "(?, 'Aplikasi', 'aplikasi', ?, 'pt', 'Portal do Cliente', 1, 0, 1, 1, '#24a7e8'),",
      "(?, 'Minas Home ADS', 'minas-home-ads', ?, 'pt', 'Portal do Cliente', 0, 0, 0, 0, '#5e5cf1'),",
      "(?, 'Podcast Lider de Elite', 'podcast-lider-de-elite', ?, 'pt', 'Portal do Cliente', 0, 0, 0, 0, '#8d43df')",
    ].join(" "),
    [clientAplikasiId, users[0].id, clientMinasId, users[0].id, clientPodcastId, users[0].id],
  );

  await db.query(
    [
      "INSERT INTO client_permissions",
      "(id, client_account_id, allow_client_edit_caption, allow_client_download, allow_client_edit_brand_brain, allow_client_search, allow_client_view_invoices, allow_client_view_reports, allow_client_view_brand_brain, allow_client_view_tracking)",
      "VALUES",
      "(?, ?, 1, 1, 1, 1, 1, 1, 1, 1),",
      "(?, ?, 0, 0, 0, 0, 0, 0, 0, 0),",
      "(?, ?, 0, 0, 0, 0, 0, 0, 0, 0)",
    ].join(" "),
    [
      crypto.randomUUID(),
      clientAplikasiId,
      crypto.randomUUID(),
      clientMinasId,
      crypto.randomUUID(),
      clientPodcastId,
    ],
  );

  const memberships = [
    [users[0].id, clientAplikasiId, "admin", 1],
    [users[1].id, clientAplikasiId, "admin", 0],
    [users[2].id, clientAplikasiId, "colaborador", 0],
    [users[3].id, clientAplikasiId, "cliente", 1],
    [users[0].id, clientMinasId, "admin", 1],
    [users[0].id, clientPodcastId, "admin", 1],
    [users[1].id, clientPodcastId, "admin", 0],
  ] as const;

  for (const [userId, clientAccountId, membershipRole, isPrimary] of memberships) {
    await db.query(
      [
        "INSERT INTO client_memberships",
        "(id, user_id, client_account_id, membership_role, assigned_by_user_id, is_primary)",
        "VALUES (?, ?, ?, ?, ?, ?)",
      ].join(" "),
      [crypto.randomUUID(), userId, clientAccountId, membershipRole, users[0].id, isPrimary],
    );
  }

  const columns = [
    ["column-vtcards", "VT Cards", "#24a7e8", 0, 0],
    ["column-aprovacao", "Em aprovacao", "#f7a31a", 1, 1],
    ["column-agendados", "Agendados", "#12bf83", 2, 1],
  ] as const;

  for (const [id, name, color, position, visible] of columns) {
    await db.query(
      [
        "INSERT INTO kanban_columns",
        "(id, client_account_id, name, color, position, visible_to_client, auto_created)",
        "VALUES (?, ?, ?, ?, ?, ?, 0)",
      ].join(" "),
      [id, clientAplikasiId, name, color, position, visible],
    );
  }

  const cards = [
    {
      id: "card-vt-1",
      columnId: "column-vtcards",
      title: "Nao importa qual operadora seu colaborador usa",
      caption: "VT Cards",
      mediaType: "image",
      primaryMediaUrl:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80",
      mediaUrlsJson: JSON.stringify([]),
      artType: "post_unico",
      statusJson: JSON.stringify(["Legenda pronta", "Design finalizado", "Legenda aprovada"]),
      tagsJson: JSON.stringify(["Alteracao solicitada"]),
      scheduledAt: "2026-08-23 10:00:00",
      clientLabel: "Pendente",
      eventColor: "#24a7e8",
      position: 0,
    },
    {
      id: "card-aprovacao-1",
      columnId: "column-aprovacao",
      title: "Antes de ligar o motor, ja estamos cuidando de voce",
      caption: "Seguranca",
      mediaType: "image",
      primaryMediaUrl:
        "https://images.unsplash.com/photo-1517142089942-ba376ce32a2e?auto=format&fit=crop&w=900&q=80",
      mediaUrlsJson: JSON.stringify([]),
      artType: "reels",
      statusJson: JSON.stringify(["Design pronto", "Aline aprovou"]),
      tagsJson: JSON.stringify(["Cliente revisando"]),
      scheduledAt: "2026-08-24 14:00:00",
      clientLabel: "Aguardando aprovacao",
      eventColor: "#f7a31a",
      position: 0,
    },
    {
      id: "card-agendado-1",
      columnId: "column-agendados",
      title: "Dois destinos. Qual voce escolhe?",
      caption: "Santa Sophia",
      mediaType: "image",
      primaryMediaUrl:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
      mediaUrlsJson: JSON.stringify([]),
      artType: "reels",
      statusJson: JSON.stringify(["Agendado"]),
      tagsJson: JSON.stringify(["Publicado no planner"]),
      scheduledAt: "2026-08-25 11:00:00",
      clientLabel: "Agendado",
      eventColor: "#12bf83",
      position: 0,
    },
  ];

  for (const card of cards) {
    await db.query(
      [
        "INSERT INTO kanban_cards",
        "(id, client_account_id, column_id, title, caption, media_type, primary_media_url, media_urls_json, art_type, status_json, tags_json, scheduled_at, client_label, event_color, created_by_user_id, position)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
      [
        card.id,
        clientAplikasiId,
        card.columnId,
        card.title,
        card.caption,
        card.mediaType,
        card.primaryMediaUrl,
        card.mediaUrlsJson,
        card.artType,
        card.statusJson,
        card.tagsJson,
        card.scheduledAt,
        card.clientLabel,
        card.eventColor,
        users[0].id,
        card.position,
      ],
    );
  }

  const comments = [
    [
      "comment-1",
      "card-vt-1",
      users[0].id,
      "Liege Paschoalini",
      "super_admin",
      "Ajustar a chamada final para ficar ainda mais direta.",
      1,
    ],
    [
      "comment-2",
      "card-aprovacao-1",
      users[3].id,
      "Patricia Rodrigues",
      "cliente",
      "Gostei muito. So sugiro deixar o subtitulo um pouco mais direto.",
      0,
    ],
    [
      "comment-3",
      "card-aprovacao-1",
      users[3].id,
      "Serena Genovese",
      "cliente",
      "Perfetto, vou ajustar conforme combinado.",
      0,
    ],
  ] as const;

  for (const [id, cardId, userId, authorName, authorRole, commentText, isInternal] of comments) {
    await db.query(
      [
        "INSERT INTO card_comments",
        "(id, card_id, user_id, author_name, author_role, comment_text, is_internal)",
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
      [id, cardId, userId, authorName, authorRole, commentText, isInternal],
    );
  }

  await db.query(
    "UPDATE kanban_cards SET comments_count_cache = 1 WHERE id = 'card-vt-1'",
  );
  await db.query(
    "UPDATE kanban_cards SET comments_count_cache = 2 WHERE id = 'card-aprovacao-1'",
  );

  await db.query(
    [
      "INSERT INTO approval_links",
      "(id, client_account_id, card_id, token, expires_at, is_active, viewed_at, created_by_user_id)",
      "VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
    ].join(" "),
    [
      "approval-1",
      clientAplikasiId,
      "card-aprovacao-1",
      "demo-token-approval-1",
      "2026-08-27 14:00:00",
      "2026-08-20 15:20:00",
      users[0].id,
    ],
  );

  for (const card of cards) {
    const publishDate = card.scheduledAt.slice(0, 10);
    const publishTime = card.scheduledAt.slice(11, 19);

    await db.query(
      [
        "INSERT INTO card_calendar_events",
        "(id, client_account_id, card_id, title, caption, media_type, media_urls_json, publish_date, publish_time, status, event_color, created_by_user_id)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
      ].join(" "),
      [
        crypto.randomUUID(),
        clientAplikasiId,
        card.id,
        card.title,
        card.caption,
        card.mediaType,
        card.mediaUrlsJson,
        publishDate,
        publishTime,
        card.eventColor,
        users[0].id,
      ],
    );
  }

  await db.end();

  console.log("Banco local da V2 criado com sucesso.");
  console.log("Login super admin:", users[0].email, users[0].password);
  console.log("Login admin:", users[1].email, users[1].password);
  console.log("Login colaborador:", users[2].email, users[2].password);
  console.log("Login cliente:", users[3].email, users[3].password);
}

main().catch((error) => {
  console.error("Falha ao preparar o banco local da V2.");
  console.error(error);
  process.exit(1);
});
