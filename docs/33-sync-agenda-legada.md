# Sync da Agenda Legada

## Objetivo

Trazer os compromissos da agenda do app antigo (`v2`, tabela `agenda_events`) para a agenda atual do Supabase (`appointments`).

Quando os compromissos entram em `appointments`, eles passam a aparecer automaticamente em:

- `Agenda`
- widget `Agenda de hoje` no dashboard

## Arquivos

- `v2/apps/api/src/scripts/sync-legacy-agenda-to-supabase.ts`
- `supabase/migrations/20260822153000_add_legacy_sync_fields_to_appointments.sql`

## Como o sync identifica os eventos

Cada compromisso importado recebe:

- `legacy_source = design_hub_v2_agenda`
- `legacy_event_id = id` do `agenda_events`

Isso permite rodar a importacao de novo sem duplicar itens.

## Variaveis aceitas

### Do app atual

- `VITE_SUPABASE_URL` ou `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` ou `SUPABASE_PUBLISHABLE_KEY`

### Login no app atual

Uma sessao autenticada e necessaria para obedecer as politicas de acesso da tabela `appointments`.

Pode usar:

- `SYNC_SUPABASE_EMAIL`
- `SYNC_SUPABASE_PASSWORD`

ou:

- `EXPORT_ADMIN_EMAIL`
- `EXPORT_ADMIN_PASSWORD`

ou:

- `MIGRATION_ADMIN_EMAIL`
- `MIGRATION_ADMIN_PASSWORD`

### Do app antigo

Ja lidas de `v2/.env`:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

### Filtro da agenda legada

Por padrao, o script tenta localizar no app antigo o mesmo email usado no login do Supabase.

Se precisar forcar:

- `LEGACY_AGENDA_EMAIL`
- `LEGACY_AGENDA_USER_ID`

## Uso recomendado

### Conferencia

Rodar primeiro em modo de teste:

`npm --workspace @design-hub-v2/api run sync:agenda:legacy -- --dry-run`

### Importacao real

Depois da conferencia:

`npm --workspace @design-hub-v2/api run sync:agenda:legacy`

### Override manual

Exemplo conceitual quando o email do app antigo for diferente:

`npm --workspace @design-hub-v2/api run sync:agenda:legacy -- --legacy-user-email=seu-email-antigo@dominio.com`

## Observacoes

- O script importa apenas eventos criados pelo usuario legado filtrado.
- O dashboard nao precisa de ajuste extra para mostrar os itens importados.
- Se o login do Supabase e o usuario do app antigo forem pessoas diferentes, informe o filtro legado explicitamente.
