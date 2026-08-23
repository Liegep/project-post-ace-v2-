# Schema Inicial V2

## Objetivo

Definir a espinha dorsal do banco da V2 para começar a reconstrução localmente, sem depender do app atual e já pensando em uso futuro na Hostinger.

## Premissa adotada

Como a Hostinger informou suporte nativo mais alinhado com `MySQL/MariaDB`, este schema inicial foi pensado para ser:

- simples
- robusto
- compatível com banco relacional tradicional
- fiel as regras do seu sistema

## Niveis de acesso

Os niveis principais da V2 ficam assim:

- `super_admin`
- `admin`
- `colaborador`
- `cliente`

## Regra estrutural importante

Na V2, o `card` continua sendo a entidade central.

Entao o banco precisa ser muito bom em guardar:

- conta
- coluna
- card
- comentarios
- agendamento
- visibilidade
- login vinculado

## Tabelas principais desta primeira versao

### 1. users

Guarda a identidade global do usuario.

Campos principais:

- id
- full_name
- email
- password_hash
- global_role
- avatar_url
- locale
- is_active
- last_login_at
- created_at
- updated_at

### 2. client_accounts

Cada cliente ou conta operacional do sistema.

Campos principais:

- id
- name
- slug
- owner_user_id
- logo_url
- locale
- portal_title
- require_login
- link_expiration_days
- show_archived_to_client
- show_upcoming_posts
- tracking_enabled
- tracking_visible_to_client
- calendar_color
- is_active
- created_at
- updated_at

### 3. client_memberships

Liga usuarios a contas.

Serve para:

- multiconta
- admins com clientes proprios e atribuidos
- colaboradores em contas especificas
- clientes acessando apenas a propria area

Campos principais:

- id
- user_id
- client_account_id
- membership_role
- assigned_by_user_id
- is_primary
- created_at

### 4. client_permissions

Permissoes finas por conta.

Campos principais:

- id
- client_account_id
- allow_client_edit_caption
- allow_client_create_post
- allow_client_create_tags
- allow_client_download
- allow_client_edit_brand_brain
- allow_client_search
- allow_client_view_invoices
- allow_client_view_reports
- allow_client_view_brand_brain
- allow_client_view_tracking
- created_at
- updated_at

### 5. kanban_columns

Colunas do quadro de cada conta.

Campos principais:

- id
- client_account_id
- name
- color
- position
- visible_to_client
- auto_created
- created_at
- updated_at

### 6. kanban_cards

Tabela principal dos posts/cards.

Campos principais:

- id
- client_account_id
- column_id
- title
- caption
- media_type
- primary_media_url
- media_urls_json
- art_type
- status_json
- tags_json
- deadline_at
- scheduled_at
- published_at
- archived
- archived_at
- client_label
- event_color
- comments_count_cache
- created_by_user_id
- created_at
- updated_at

### 7. card_comments

Comentarios dos cards.

Campos principais:

- id
- card_id
- user_id
- author_name
- author_role
- comment_text
- is_internal
- created_at
- updated_at

### 8. card_calendar_events

Eventos de calendario ligados a cards ou criados na conta.

Campos principais:

- id
- client_account_id
- card_id
- title
- caption
- media_type
- media_urls_json
- publish_date
- publish_time
- status
- event_color
- created_by_user_id
- created_at
- updated_at

### 9. approval_links

Links temporarios de aprovacao sem login.

Campos principais:

- id
- client_account_id
- card_id
- token
- expires_at
- is_active
- viewed_at
- approved_at
- created_by_user_id
- created_at

### 10. kanban_automations

Automacoes por conta.

Campos principais:

- id
- client_account_id
- name
- trigger_type
- trigger_value
- action_type
- action_value
- is_active
- created_by_user_id
- created_at
- updated_at

## Tabelas que eu considero segunda camada

Essas podem entrar depois da base principal:

- brand_brain_sections
- invoices
- invoice_items
- reports
- report_files
- quick_notes
- quick_links
- client_notes
- text_contents
- text_content_comments
- audit_logs

## Regras de modelagem importantes

### Regra 1: login global, acesso por conta

O usuario existe uma vez em `users`.

O acesso a contas vive em `client_memberships`.

Isso resolve:

- multiconta
- um cliente com mais de uma conta
- um admin com clientes proprios e atribuidos
- um colaborador com acesso restrito

### Regra 2: super admin nao depende de atribuicao

Quem for `super_admin` tem escopo global.

### Regra 3: cliente nunca entra na area interna

Mesmo que exista em `users`, o papel `cliente` so deve navegar pelo portal do cliente e pelas contas vinculadas a ele.

### Regra 4: cards ativos e arquivados ficam na mesma tabela

Nao criar tabela separada para arquivados.

Usar:

- `archived`
- `archived_at`

### Regra 5: comentarios internos e externos na mesma tabela

Usar `card_comments` com marcador:

- `is_internal`

Assim:

- comentario interno da equipe
- comentario do cliente

continuam no mesmo historico do card.

### Regra 6: status e tags flexiveis

Como seu sistema trabalha com multiplos status e tags ao mesmo tempo, a primeira versao pode guardar isso em JSON.

Depois, se quiser, a gente pode normalizar mais.

### Regra 7: calendario pode existir com ou sem card

Alguns eventos podem nascer do proprio card.

Outros podem ser planejamentos independentes.

Por isso `card_id` deve poder ser nulo em `card_calendar_events`.

## Fluxos que esse schema ja suporta

- super admin com visao global
- admin com clientes proprios e atribuidos
- colaborador com clientes atribuidos
- cliente com uma ou mais contas
- criacao de colunas
- exclusao de colunas
- cards ativos
- cards arquivados
- comentarios internos
- comentarios do cliente
- calendario por conta
- link temporario de aprovacao
- automacoes por conta

## Decisoes que deixei simples de proposito

### Senha

Guardei como `password_hash` e nao amarrei tecnologia.

### Tags e status

Na primeira versao, em JSON.

### Midia

Na primeira versao:

- `primary_media_url`
- `media_urls_json`

Isso simplifica bastante o inicio da reconstrução.

## O que eu recomendo fazer depois deste schema

1. revisar se esta faltando alguma regra central
2. transformar isso em SQL inicial
3. criar o banco local
4. depois mapear a migracao origem -> destino

## Resultado esperado

Depois desse passo, a V2 deixa de ser apenas conceito e passa a ter uma estrutura de banco concreta, pronta para virar implementação real.
