# Validação isolada

24/11/2026; base `770cc38c`. Node **22.23.5** (requisito do projeto: >=22 <23).
Dependências instaladas com `npm ci --ignore-scripts --no-audit --no-fund` na
worktree isolada, sem alteração do lockfile. Node do host é 24; as verificações
usaram explicitamente Node 22 via `npm exec --package=node@22`.

## Reprodução antes do fix

Adicionados testes de chegada de nova pendência com Dashboard focado e retorno
de visibilidade, mantendo o componente original. Ambos falharam: não havia timer
nem listener de visibilitychange. Dez verificações existentes passaram. O runner
contabilizou três falhas incluindo o teste pai, correspondentes a **dois
subtestes de regressão**. Não foi falha de API/IA: os dados sintéticos estavam
disponíveis no servidor simulado e o componente não os consultava.

## Resultado após o fix

**122 testes passaram, zero falhas/skips**, cobrindo:

- MCP SDK em memória, scopes, consentimento, isolamento e OAuth/PKCE/refresh;
- Brand Brain e Radar com provider injetado, zero chamadas reais à OpenAI;
- dedupe, concorrência, no_op, falhas e recuperação com armazenamento simulado;
- rotas de sugestões, aceitação/descarte e briefing editorial;
- widget JSDOM: chegada sem foco/remount, pausa quando oculto, retorno à aba,
  erro de GET visível sem perder itens, recuperação do GET, pausa durante detalhe
  e decisão, double-click, paginação preservada e cleanup em StrictMode.

Comando em `v2/`:

```sh
npm exec --yes --package=node@22 -- node node_modules/tsx/dist/cli.mjs --test \
  apps/api/src/modules/mcp/mcp.security.test.ts \
  apps/api/src/modules/mcp/mcp.oauth.csp.test.ts \
  apps/api/src/modules/mcp/mcp.radar.test.ts \
  apps/api/src/modules/mcp/mcp.radar-diagnostics.test.ts \
  apps/api/src/modules/brand-brain-ai/brand-brain-ai.test.ts \
  apps/api/src/modules/radar-suggestions/radar-suggestions.test.ts \
  apps/api/src/modules/radar-suggestions/radar-editorial.test.ts \
  apps/api/src/modules/radar-recovery/radar-recovery.test.ts \
  apps/api/src/modules/radar-recovery/radar-recovery.repository.test.ts \
  apps/web/tests/radarSuggestionsWidget.test.tsx
```

Typecheck API/web e build API/web passaram. Build mantém aviso de chunks acima
de 500 kB; não foi introduzido como parte deste fix. `git diff --check` passou.

## Limites e risco

Nenhum teste MySQL executado; nenhum banco, token ou chave real acessado. Não
iniciamos a aplicação completa, cujos plugins podem escrever no startup. Os
testes usam Fastify/SDK reais com stores/providers sintéticos e JSDOM; não houve
validação visual em navegador real nem ensaio de infraestrutura/proxy/produção.

Mudança funcional restrita a GET de resumos enquanto a tela está visível, a cada
60 segundos e ao retornar à aba/foco, sem concorrer com detalhe, decisão,
paginação ou outra atualização da lista. Atualização automática preserva a
quantidade carregada até o limite de 100 da API; não busca conteúdo integral de
cada sugestão. Impacto esperado: no máximo um polling/minuto por Dashboard
visível, além de eventos de retorno. Nenhuma chamada de IA ou POST novo.

Sem migration, alteração OAuth, relaxamento editorial, reset de ledger ou
aceitação automática. Não testado o emissor externo e não determinada a causa
da interrupção em produção. O PR corrige somente o defeito visual reproduzido e
o guia de conexão; não declara restabelecido o recebimento real.
