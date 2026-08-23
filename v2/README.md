# Design Hub V2

## Objetivo

Esta pasta e a base local da V2.

Ela existe separada do app atual para que a reconstrução aconteca com seguranca, sem mexer em producao e sem misturar o legado com o novo sistema.

## Principios

- nao tocar no app atual
- construir tudo localmente primeiro
- manter a V2 organizada desde o inicio
- preparar a base para migracao curada depois

## Estrutura inicial

- `apps/api`
- `apps/web`
- `database/schema.sql`
- `docs`

## Escopo desta primeira montagem

Aqui vamos concentrar:

- schema do banco da V2
- arquitetura inicial
- base para backend
- base para frontend
- documentacao de implementacao

## Stack assumida por enquanto

- frontend React + TypeScript + Vite
- backend Node.js
- banco relacional na Hostinger

## Proximos passos

1. validar schema inicial
2. definir bootstrap do backend
3. definir bootstrap do frontend
4. preparar ambiente local
5. iniciar implementacao por modulos
