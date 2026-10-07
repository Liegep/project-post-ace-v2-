# Radar de Pautas — Checkpoint 1

Branch: `codex/radar-suggestions-foundation`, baseada no main `5c6348678ff969578af827181108a5b911296481`.

## Escopo

Persistência e API interna para criar/listar/consultar sugestões pendentes. Não implementa IA, MCP, widget, aceite, descarte ou conversão em pauta. Não consulta ou altera workspace_drawer_json. Nenhum dado legado é convertido. Sem aplicação de migration em produção, push, merge ou deploy.

## Migration

`v2/database/migrations/20261007_radar_suggestions_foundation.sql` cria somente `radar_suggestions` (32 colunas), com CREATE TABLE IF NOT EXISTS. Sem ALTER/UPDATE/DELETE em tabelas existentes e sem DDL na inicialização da API.

- PK UUID; vínculo ao cliente com ON DELETE/UPDATE RESTRICT.
- Autoria e atores de decisões futuras com ON DELETE SET NULL, preservando o registro.
- Estado inicial pending; checks de estado e alinhamento de 0 a 100 (ou null).
- Datas técnicas TIMESTAMP(3); fonte guarda data ISO ou timestamp ISO em VARCHAR(40), preservando precisão e offset informados.
- JSON para basedOn; URL em TEXT; hashes ASCII de 64 caracteres.
- Unique cliente + dedupe_hash; índices para pendências, cronologia e fonte.
- Metadata AI/modelo/alinhamento pode ser null: nenhuma análise ou métrica é inventada nesta etapa.

Metadata adicional: basedOn, brandBrainVersion, brandBrainContextHash, sourceKey, dedupeHash, createdByUserId, acceptedPautaId, acceptedByUserId, dismissedByUserId, updatedAt. Os campos de decisão existem para a etapa seguinte, mas não podem ser enviados pelo chamador nem alterados pela API atual.

## API

- POST /api/clients/:clientId/radar-suggestions — corpo com título, conceito, gancho, descrição, contentType, objetivo, justificativa, sourceTitle e radarName; demais campos de conteúdo/metadados opcionais. 201 quando criado; 200 quando duplicata, com created=false e duplicatePrevented=true.
- GET /api/clients/:clientId/radar-suggestions — pendências do cliente.
- GET /api/clients/:clientId/radar-suggestions/:id — detalhe pendente do cliente.
- GET /api/radar-suggestions — pendências apenas dos clientes autorizados.

Listas: limit (padrão 25, máximo 100), offset, hasMore; ordenação createdAt/id descendente. Leituras não executam processamento. Erros de banco são propagados, não transformados em listas vazias.

Superadmin pode acessar todos os clientes. Admin/colaborador precisam de vínculo interno admin/colaborador naquela conta. Portal/cliente não tem acesso. UUIDs, parâmetros e corpo são validados; propriedades desconhecidas são rejeitadas. Um ID de sugestão de outro cliente nunca retorna seu detalhe.

## Deduplicação e concorrência

A identidade usa cliente + hash da fonte e do ângulo editorial normalizado (título, conceito, gancho, formato), sem relação com títulos de cards. URLs perdem fragmentos e parâmetros conhecidos de tracking; parâmetros de conteúdo são preservados e ordenados. Sem URL, a identidade da fonte usa radar, título da fonte e data.

O INSERT é atômico, arbitrado pela constraint UNIQUE no banco. ER_DUP_ENTRY recupera o registro original, sem UPDATE, alteração de conteúdo ou reativação. Uma falha posterior de leitura pode ser repetida com segurança. Não é necessário bloquear/escrever o documento do cliente.

## Arquivos

Criados:
- v2/database/migrations/20261007_radar_suggestions_foundation.sql
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.schemas.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.repository.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.service.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.routes.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.test.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.test-fixtures.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.mysql.test.ts
- docs/radar-suggestions-checkpoint-1.md

Alterados:
- v2/apps/api/src/app.ts — registro das rotas.
- v2/apps/api/package.json — inclusão dos testes e comando test:radar-suggestions:mysql.

## Validação

Node 22.23.2, versão principal requerida pelo projeto.

- Suíte principal: 456 aprovados (449 existentes + 7 novos), nenhum removido.
- Radar sazonal frontend: 19 aprovados.
- MariaDB temporário 10.11.19: 5 aprovados, modo estrito, sem rede, com schema real da aplicação.
- Typecheck API/web e build API/web aprovados. Build mantém aviso de chunks acima de 500 kB.

Testes novos: validação, autorização HTTP, isolamento, paginação, erro de fonte/banco, deduplicação, histórico resolvido sem reativação, 20 criações simultâneas em conexões diferentes, FKs/checks/defaults, Unicode e URL longa, migration reexecutada, preservação literal do drawer e timestamps com milissegundos sob driver em outro fuso. Bancos de teste são criados com nomes aleatórios e removidos ao finalizar; a suíte recusa credenciais/endereços de produção.

Checkpoint 1 encerrado para revisão. Não iniciar Checkpoint 2 sem aprovação.
