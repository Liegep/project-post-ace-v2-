# Backend Bootstrap

## O que foi criado

Base inicial do backend em:

- `apps/api`

## Estrutura

- `src/config/env.ts`
- `src/plugins/db.ts`
- `src/routes/health.ts`
- `src/modules/auth/auth.routes.ts`
- `src/modules/clients/clients.routes.ts`
- `src/app.ts`
- `src/server.ts`

## O que essa base ja faz

- sobe um servidor Fastify
- carrega variaveis de ambiente
- conecta no banco MySQL/MariaDB
- expõe rota de saude
- expõe rota-base de auth
- expõe rota-base de clients

## Regra de autenticacao da V2

Esta V2 nao deve usar:

- login social
- cadastro publico

O backend deve ser montado para:

- login com email e senha
- usuario criado internamente
- controle fechado dos acessos

## Rotas iniciais

- `GET /`
- `GET /api/health`
- `GET /api/auth/session`
- `GET /api/clients`

## Proximo passo tecnico

1. criar banco local da V2
2. carregar `database/schema.sql`
3. configurar `.env`
4. instalar dependencias da `v2`
5. rodar `dev:api`

## Observacao

Isso e apenas o bootstrap inicial.

Ainda faltam:

- autenticacao real
- controle de acesso por papel
- memberships por conta
- colunas
- cards
- comentarios
- calendario
- links temporarios
- automacoes
