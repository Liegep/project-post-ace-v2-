# Radar de Pautas — Checkpoint 2

Branch: codex/radar-suggestions-foundation. Continuação do Checkpoint 1 aprovado em 82146fae7b9ad54c64d881155d9e980f529e2d52.

## Entrega

Widget Dashboard “✦ Radar de Pautas”, compacto, com nome do cliente, contagem real de pendências, formato, pilar e alinhamento quando disponíveis, fonte/data e ações Ler mais / Adicionar ao banco / Descartar. Não renderiza um widget vazio. Lista inicial de três resumos, com paginação “Ver mais sugestões”. Dados são lidos no servidor ao montar uma sessão e ao recuperar foco; não há estado de aprovação em localStorage nem polling. Falha de decisão mantém a sugestão e exibe erro; remoção só depois da confirmação do servidor.

Drawer com todos os campos editoriais, fonte, datas e fundamentos curtos em “Baseado em”. Detalhe buscado somente ao abrir. Escape, foco contido/restaurado, fechamento pelo backdrop e footer com safe-area; conteúdo longo rola separadamente das ações.

## API

Novos:
- POST /api/clients/:clientId/radar-suggestions/:id/accept
- POST /api/clients/:clientId/radar-suggestions/:id/dismiss

Ambos exigem acesso interno e permissão naquela conta; não aceitam alterações de conteúdo no corpo. Decisões incompatíveis retornam 409; IDs de outra conta não expõem dados.

Alterados:
- GET /api/radar-suggestions
- GET /api/clients/:clientId/radar-suggestions

Listas passam a retornar resumos (incluindo clientName) e total real, sem descrição/conceito/legenda/rationale. Detalhe continua em GET /api/clients/:clientId/radar-suggestions/:id.

## Integridade

A decisão abre uma transação, bloqueia primeiro o cliente e depois a sugestão. Adicionar cria uma PautaIdea draft no cliente correto, preservando title, description, caption, contentType, pillar, objective, radarSource, sourceTitle, sourceUrl, radarSuggestionId e createdBy=radar_ai. A mesma transação registra accepted_pauta_id, usuário e timestamp e muda o estado para accepted. Retry retorna a pauta existente, sem duplicação ou recriação. Uma sugestão dismissed não pode ser aceita; accepted não pode ser descartada. Descartar é idempotente, mantém histórico e não escreve no drawer.

A conversão preserva integralmente todas as seções do documento e as pautas existentes. Outros escritores relacionados foram protegidos:
- PUT workspace-drawer agora bloqueia e mescla apenas alterações; pautaIdeas, brandBrain e quick pertencem aos endpoints dedicados e não são substituídos por cópias antigas.
- Links rápidos e Brand Brain usam JSON_SET atômico da seção correspondente.
- Frontend envia somente seções efetivamente alteradas; editar cliente envia somente socialLinks.
- Ideias com radarSuggestionId não participam das duas buscas de cards por título em Pautas. Vínculos explícitos por cardId continuam funcionando no fluxo manual existente.

Nenhuma decisão cria card, envia ao cliente ou chama IA. Não há alteração MCP ou implementação do Checkpoint 3. Não foi criada nova migration: reutiliza as colunas do Checkpoint 1. Nenhum dado de produção/legado foi alterado.

## Arquivos

Criados:
- v2/apps/web/src/RadarSuggestionsWidget.tsx
- v2/apps/web/src/RadarSuggestionsWidget.css
- v2/apps/web/tests/radarSuggestionsWidget.test.tsx
- v2/apps/web/tests/radar-checkpoint2-preview.html (fixture local, sem conexão ao banco/API real)
- docs/radar-suggestions-checkpoint-2.md

Alterados:
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.repository.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.service.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.routes.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.schemas.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.test.ts
- v2/apps/api/src/modules/radar-suggestions/radar-suggestions.mysql.test.ts
- v2/apps/api/src/modules/clients/clients.routes.ts
- v2/apps/api/src/modules/clients/brand-brain.service.ts
- v2/apps/api/package.json
- v2/apps/web/src/api.ts
- v2/apps/web/src/App.tsx

## Validação

Node 22.23.2:
- Novos/testes específicos de revisão: 18 aprovados (7 backend + 11 frontend, contando o agrupador).
- Suíte principal: 467 aprovados, nenhum removido.
- Radar sazonal: 19 aprovados.
- MariaDB temporário 10.11.19: 10 aprovados.
- Typecheck e build API/web aprovados; permanece aviso de chunks grandes.

MariaDB: aceitação simultânea, retry, origem/metadados, draft, isolamento, descarte, rollback por trigger que simula falha, disputa aceitar/descartar, atualização de várias sugestões junto a seções do drawer, detalhe/resumo HTTP, autor/timestamp, ausência de cards e preservação de campos existentes. Frontend: vazio, cliente/contagem, detalhe on-demand, falhas, clique duplo, remoção confirmada, remount/reload, nova sessão autorizada e paginação. Nenhuma URL de IA/cards/envio/publicação é chamada na revisão.

Prévia local com fixture: desktop 1440, mobile 390 e 320 sem overflow horizontal. Drawer em 390 com ações visíveis e conteúdo rolável. Não substitui validação em produção, que não está autorizada nesta etapa.

## Compatibilidade / limites

O contrato de listagem agora é resumido; consumidores devem usar o endpoint de detalhe para conteúdo completo. PUT genérico do drawer não edita mais as três seções pertencentes a endpoints próprios; os chamadores web existentes foram ajustados. Se uma pauta aceita for posteriormente excluída por uma ação manual existente, retry do aceite retorna conflito em vez de recriá-la. A heurística antiga por título foi preservada apenas para pautas legadas sem identificação do Radar. O versionamento legado do Brand Brain continua fora desta etapa; a escrita da seção atual foi tornada atômica para preservar as pautas.

Sem push, merge ou deploy. Checkpoint 2 encerrado para revisão.
