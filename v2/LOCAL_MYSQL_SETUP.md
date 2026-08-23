# V2 local com MySQL

Esta V2 continua funcionando em preview local, mas agora tambem ja esta preparada para sair do `DEMO_MODE` e usar um banco MySQL real, no mesmo estilo que depois pode ir para a Hostinger.

## O que foi preparado

- schema real do banco em `apps/api/db/schema.sql`
- bootstrap inicial em `apps/api/src/scripts/bootstrap-local-db.ts`
- script pronto: `npm run db:bootstrap --workspace @design-hub-v2/api`
- login do frontend pronto para tentar a API real antes de cair no fallback local

## Quando voce tiver um MySQL disponivel

1. Ajuste o arquivo `v2/.env`

Use os dados reais do seu banco:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`

2. Rode o bootstrap da base

Isso cria as tabelas e os dados iniciais da V2.

3. Troque:

- `DEMO_MODE=true`

para:

- `DEMO_MODE=false`

4. Reinicie a API da V2

## Logins iniciais criados pelo bootstrap

- Super admin: `liege@designhub.local` / `DesignHub2026!`
- Admin: `aline@designhub.local` / `ClienteAline26!`
- Colaborador: `carlos@designhub.local` / `ColabCarlos26!`
- Cliente: `serena@designhub.local` / `SerenaCliente26!`

## Observacao importante

Nesta maquina eu nao consegui executar o bootstrap agora porque nao existe um cliente/servidor MySQL local disponivel neste ambiente. Entao a estrutura ficou pronta e validada em codigo, mas a rodada real depende de voce apontar para um MySQL acessivel.
