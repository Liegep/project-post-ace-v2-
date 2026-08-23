# Mapa Exato de Extracao das Contas Prioritarias

## Objetivo

Definir exatamente o que extrair do banco atual para a primeira leva da migracao curada.

Contas prioritarias confirmadas:

- Aplikasi
- Podcast Elite Leader
- Podcast Lider de Elite
- Minas Home
- Doutora Patricia

## Escopo confirmado desta extracao

Extrair, para essas contas:

- dados da conta/cliente
- vinculos de login
- colunas
- posts ativos
- posts arquivados
- comentarios dos cards
- comentarios feitos por clientes, quando estiverem na mesma estrutura de comentarios
- calendarios ligados aos cards

Nao priorizar nesta fase:

- activity logs
- historico detalhado de eventos
- notificacoes administrativas
- auditoria completa

## Tabelas principais encontradas no projeto atual

Pelo schema atual, as tabelas centrais para esse recorte sao:

- `clients`
- `profiles`
- `user_client_assignments`
- `columns`
- `posts`
- `comments`
- `calendar_posts`

## O que extrair de cada tabela

### 1. clients

Tabela-base da conta/cliente.

### Campos mais importantes para esta migracao

- `id`
- `name`
- `slug`
- `logo_url`
- `locale`
- `client_portal_title`
- `tracking_enabled`
- `tracking_visible_to_client`
- `tracking_column_ids`
- `show_archived_to_client`
- `show_upcoming_posts`
- `allow_client_edit_caption`
- `allow_client_create_post`
- `allow_client_create_tags`
- `allow_client_download`
- `allow_client_edit_brand_brain`
- `require_login`
- `link_expiration_days`
- `calendar_color`
- `calendar_legend`
- `owner_id`
- `shared`

### Campos uteis, mas nao obrigatorios no primeiro momento

- links sociais
- dados de endereco
- dados de faturamento
- `trello_board_id`

## 2. profiles

Tabela de identidade dos usuarios.

### Extrair para usuarios ligados a essas contas

- `id`
- `full_name`
- `email`
- `avatar_url`
- `role`

### Observacao

Esses dados ajudam a recriar os acessos.

A senha nao deve ser esperada como recuperavel em texto legivel.

## 3. user_client_assignments

Tabela que liga usuario a cliente/conta.

### Extrair

- `id`
- `user_id`
- `client_id`
- `assigned_by`
- `created_at`

### Funcao dessa extracao

Permitir reconstruir:

- quem acessa qual conta
- usuarios com multiconta
- relacao entre cliente e login

## 4. columns

Tabela das colunas do Kanban.

### Extrair

- `id`
- `client_id`
- `name`
- `position`
- `color`
- `visible_to_client`
- `trello_list_id`

### Observacao

Mesmo que a V2 permita reorganizar colunas depois, vale trazer a estrutura atual dessas contas prioritarias.

## 5. posts

Tabela principal dos cards.

### Extrair obrigatoriamente

- `id`
- `client_id`
- `column_id`
- `title`
- `caption`
- `image_url`
- `media_type`
- `media_urls`
- `art_type`
- `tags`
- `status`
- `position`
- `deadline`
- `archived`
- `archived_at`
- `published_at`
- `event_color`
- `client_label`
- `retain_files`
- `created_at`
- `updated_at`

### Campos uteis adicionais

- `client_created_at`
- `client_unarchived_at`
- `is_pauta`
- `content_pillar_id`
- `trello_card_id`

### Regra pratica

Para essas contas prioritarias, trazer:

- posts ativos
- posts arquivados

## 6. comments

Tabela principal de comentarios dos cards.

### Extrair

- `id`
- `post_id`
- `author`
- `text`
- `user_id`
- `created_at`

### O que isso preserva

- comentarios internos
- comentarios feitos por cliente na mesma estrutura
- contexto do post

## 7. calendar_posts

Tabela de calendario ligada aos posts e ao planejamento visual.

### Extrair

- `id`
- `client_id`
- `title`
- `scheduled_date`
- `scheduled_time`, se existir na modelagem final do registro
- `media_urls`
- `status`
- `event_color`
- `created_at`
- `updated_at`, se existir

### Observacao pratica

Mesmo quando parte da logica de agenda tambem estiver refletida em `posts.deadline`, vale recuperar `calendar_posts` para preservar o calendario do Kanban de cada conta com o maximo de fidelidade possivel.

## Relacoes principais da extracao

### Relacao 1

- `clients.id` -> `columns.client_id`

### Relacao 2

- `clients.id` -> `posts.client_id`

### Relacao 3

- `columns.id` -> `posts.column_id`

### Relacao 4

- `posts.id` -> `comments.post_id`

### Relacao 5

- `clients.id` -> `user_client_assignments.client_id`

### Relacao 6

- `profiles.id` -> `user_client_assignments.user_id`

### Relacao 7

- `clients.id` -> `calendar_posts.client_id`

## Ordem recomendada de extracao

Para evitar confusao, a ordem ideal e:

1. `clients`
2. `profiles`
3. `user_client_assignments`
4. `columns`
5. `posts`
6. `comments`
7. `calendar_posts`

## Filtros principais da extracao

### Filtro por conta

Usar apenas os `client_id` das contas prioritarias.

### Filtro por posts

Dentro dessas contas, incluir:

- `archived = false`
- `archived = true`

Ou seja, ativos e arquivados.

## O que fica fora desta primeira extracao

Mesmo existindo no schema, estes itens nao entram como prioridade agora:

- `activity_logs`
- `admin_notifications`
- `post_status_history`
- `internal_approvals`
- `quick_notes`
- `client_links`
- `text_contents`
- `text_content_comments`
- faturamento
- relatorios

Eles podem virar segunda fase depois.

## Estrategia de importacao na V2

Depois da extracao, a ordem ideal de importacao seria:

1. criar clientes
2. criar usuarios/perfis
3. recriar atribuicoes de acesso
4. criar colunas
5. importar posts
6. importar comentarios
7. importar eventos de calendario
8. validar ativos x arquivados

## Checklist de validacao

Depois de importar, validar por conta:

- quantidade de colunas
- quantidade de posts ativos
- quantidade de posts arquivados
- quantidade de comentarios
- consistencia dos eventos de calendario
- consistencia de posicoes
- consistencia dos vinculos de login
- consistencia dos status e tags

## Resultado esperado

Ao final dessa primeira extracao, essas cinco contas prioritarias devem entrar na V2 com:

- identidade da conta preservada
- logins vinculados preservados
- quadro preservado
- posts preservados
- arquivados preservados
- comentarios preservados
- calendario preservado

Sem carregar o peso de atividades e logs que nao sao prioridade agora.
