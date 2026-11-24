# Diagnóstico do recebimento de pautas — 24/11/2026

Base: `main`/`origin/main` em `770cc38c3e4a4a574164c625a8823568392dfd85`, conferida com `git ls-remote`. O checkout originalmente aberto está em `12820ded`, com alterações de outros trabalhos, e não representa a integração atual. Inspeção em worktree isolada. PR #54 apenas consultado: aberto, draft, branch `codex/brief-client-withdrawal`; nenhuma alteração nele.

## Conclusão antes da implementação

**A causa da interrupção em produção permanece não confirmada.** Código e testes locais não comprovam o estado de um deploy, credenciais ou execuções externas. Não acessamos Hostinger, banco remoto, arquivos de ambiente, secrets ou tokens; não chamamos ferramentas Design Hub, pois até consultas MCP registram auditoria no banco e o cliente pode renovar OAuth automaticamente.

Há duas divergências confirmadas no repositório: o widget não consulta novas sugestões enquanto o Dashboard permanece aberto e focado; a documentação de conexão diz somente leitura, enquanto as tools atuais incluem criação. Os checkpoints 4/5 também contêm instruções OAuth anteriores ao consentimento interno. A correção mínima proposta é atualizar a listagem por GET periódico/retorno à aba e corrigir o guia operacional, preservando autenticação, decisões humanas, idempotência e banco. Isso corrige apresentação e orientação; **não comprova nem restaura sozinho um emissor externo parado**.

## 1. Mapa atual

```text
Radar/automação externa (executor não encontrado neste repositório)
  → descoberta com clientId UUID, sourceTitle e sourceSummary
  → ChatGPT/cliente MCP → POST /mcp
  → JWT MCP válido + super_admin ativo + limite de 60 requisições/minuto
  → tools/list: create_radar_suggestion somente com pauta:create + consentimento interno
  → McpRadarService.create: autorização, schema e acesso ao cliente
  → disponibilidade do Brand Brain AI
  → fonte já existente? retorna existing, inclusive accepted/dismissed
  → contexto publicado do cliente + claim único em radar_source_runs
  → BrandBrainAiService.generateRadarSuggestion
      → beginRun em brand_brain_ai_runs antes da chamada paga
      → OpenAI Responses, schema estrito, timeout, validação editorial/pilar
  → shouldCreate=false: ledger no_op, nenhuma sugestão
  → shouldCreate=true: transação insere radar_suggestions pending e encerra ledger
  → auditoria MCP; resposta created/existing/no_op/processing
  → GET /api/radar-suggestions → widget Radar de Pautas no Dashboard
  → POST /api/clients/:clientId/radar-suggestions/:id/accept
      → transação bloqueia cliente e sugestão
      → pauta draft em client_accounts.workspace_drawer_json.pautaIdeas
      → sugestão accepted; sem card nem envio ao cliente
  → Banco de Pautas → ação humana posterior de envio/aprovação → Kanban
```

Fluxos distintos: `create_pauta_draft` grava diretamente um rascunho mediante confirmação explícita; Brand Brain AI `generate` retorna ideias para revisão; Radar sazonal usa calendário/datas e não é o executor externo de notícias. Receber uma sugestão pending não deve fazê-la aparecer automaticamente no Banco de Pautas ou Kanban.

Evidências de código (caminhos relativos à raiz):

| Etapa | Fonte |
| --- | --- |
| Ferramentas e gates | `v2/apps/api/src/modules/mcp/mcp.server.ts` |
| Transporte e autenticação | `mcp.routes.ts`, `mcp.security.ts`, `mcp.oauth.routes.ts` no mesmo diretório |
| Orquestração e dedupe | `mcp.radar.service.ts`, `mcp.radar.repository.ts` |
| Contexto e geração | `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.{service,context,repository}.ts` |
| Criação/listagem/aceitação | `v2/apps/api/src/modules/radar-suggestions/radar-suggestions.{routes,service,repository}.ts` |
| Apresentação | `v2/apps/web/src/RadarSuggestionsWidget.tsx`, `api.ts`, `App.tsx` |
| Ausência de executor no pacote | `docs/71-radar-mcp-checkpoint4.md`, seção Executor, e plugins registrados em `v2/apps/api/src/app.ts` |

## 2. Funcionando, falhando e desconhecido

| Item | Evidência e alcance |
| --- | --- |
| Implementação do receptor existe | Tool registrada e serviço com provider injetável, persistência transacional e testes SDK em memória. Não falta um serviço chamado agente dentro do backend. |
| Executor externo | Não há crawler/scheduler editorial neste projeto. Diretório local padrão de automações Codex não existe nesta máquina. Isso não comprova inexistência de tarefas no ChatGPT, noutro host ou noutro serviço. |
| Conector desta sessão | Catálogo disponibiliza `create_radar_suggestion` e consultas, mas não as duas tools de diagnóstico que existem na main (`get_radar_connection_status`, `validate_radar_source`). Pode ser catálogo do plugin, snapshot ou deploy diferente; não prova desconexão. Nenhuma tool foi chamada. |
| Apresentação desatualizada | Widget só busca ao montar, em `window.focus` e após decidir; sem polling, visibilitychange ou assinatura de recebimento. Lista vazia oculta o widget inteiro. |
| Documentação desatualizada | `v2/docs/chatgpt-mcp-connection.md` afirma tools exclusivamente de leitura; checkpoints 4/5 indicam `radar:suggest` como autorização suficiente, o que não vale no código atual. |
| Configuração efetiva | Não verificada. Não sabemos se chave está presente/válida, flag ativa, tabelas migradas ou OAuth válido em produção. |
| Entrega real | Sem timestamps de execuções externas, status HTTP e contagens sanitizadas, não é possível distinguir ausência de envio, recusa OAuth, falha de IA ou pending não aceito. |

## 3. Configuração e autorização

- `OPENAI_API_KEY`: opcional no parser, mínimo 20 caracteres quando fornecida. Presença não comprova validade, quota ou acesso ao modelo. Não foi lida.
- `BRAND_BRAIN_AI_ENABLED`: default false; apenas boolean true ou string exata `true` habilita. `1` não habilita esta flag. IA de Relatórios possui outra flag: funcionar em Relatórios não comprova Radar ativo.
- Modelo default `gpt-4.1-mini`, timeout 30000 ms, saída máxima 6000 tokens; sem fallback. Valores efetivos não consultados.
- Configuração carrega `APP_ENV_FILE` ou `../../.env`; verificar diretório de execução e arquivo efetivamente usado, sem abrir/copiar secrets nesta investigação.
- `API_URL` define issuer/resource OAuth e host MCP; mudar domínio ou `JWT_SECRET` pode invalidar tokens existentes. `APP_URL` também deve corresponder ao frontend servido.
- `planning:read` obrigatório; `pauta:create` + claim assinada `radar_ai_authorized=true` obrigatórios para tool Radar. `radar:suggest` permanece aceito por compatibilidade e não substitui essas condições.
- Código OAuth: cinco minutos/uso único/PKCE S256. Access JWT: uma hora. Refresh: 30 dias, rotação, escopos somente mantidos/reduzidos, consentimento preservado. Refresh não concede consentimento novo.
- Migration `20261008_mcp_radar_internal_consent.sql`: duas colunas default 0. Autorizações anteriores continuam sem consentimento. Não inferir permissão nem corrigir via UPDATE manual.
- Cliente: UUID de `client_accounts`, não nome/slug nem OAuth client_id. Serviço normaliza UUID para minúsculas, verifica acesso e vincula contexto ao mesmo cliente. Brand Brain vem de `workspace_drawer_json.brandBrain`; revisões não publicadas não substituem esse contexto. Memória incompleta sinaliza personalização limitada, sem bloquear por si só.

## 4. Histórico e primeiro commit relevante

| Commit | Relevância |
| --- | --- |
| `eda2077a` — 07/10 | Introduz widget e atualização apenas por montagem/foco/decisão. Primeiro commit do defeito de atualização ao vivo confirmado; não é regressão recente. |
| `c26cddcd` — 07/10 | Introduz receptor MCP Radar, ledger único e política de não repetir fontes. Não adiciona executor. |
| `6d4658c4` — 08/10 | Muda pedido/consentimento OAuth para Radar; etapa anterior ao contrato atual. |
| `a985dc59` — 08/10 | Introduz consentimento interno independente dos scopes; candidato inicial se a interrupção coincidiu com este deploy e grants antigos. Mudança intencional de autorização, não autorização para removê-la. |
| `edb1cb7c`, `7a56e7ea` | Correção CSP OAuth e regressões para origens de redirecionamento. |
| `e3ae8b6c` — 12/10, PR #36 | Corrige nomes de pilares truncados e discrimina validações. Falhas antigas continuam no ledger; não são reexecutadas pelo fix. |
| `e289a7be` — PR #37 | Adiciona diagnóstico e recuperação manual limitada, sem cron/retry automático. |
| `f40b36c5` — PR #38 | Preserva briefing editorial ao longo do fluxo; última alteração em `mcp.radar.service.ts` na main inspecionada. |

Últimos PRs mesclados #58–65 são de propostas; histórico não mostra retirada recente das tools Radar. Não consultamos logs de deploy Hostinger e não sabemos qual SHA está servido. Documentos de outubro relatam sucessos/falhas históricos: não são medição da situação em 24/11. Sem data do primeiro evento perdido e SHA implantado, não há primeiro commit de regressão de produção confirmado.

## 5. Erros e visibilidade

| Situação | Comportamento atual |
| --- | --- |
| Flag off / chave ausente | Ambos usam código `disabled` no serviço; availability/context fornece razões textuais distintas. MCP junta os dois em uma mensagem. Antes de claim/IA/gravação de sugestão. |
| OAuth ausente/inválido/expirado | HTTP 401 genérico com WWW-Authenticate; não distingue expiração de assinatura inválida na resposta. Refresh inválido/expirado: `invalid_grant`. |
| Permissão/conta insuficiente | HTTP 403 para conta inativa/não superadmin; falta de scope/consentimento oculta tool; serviço também verifica `missing_scope`/`missing_radar_consent`. |
| Rede/provedor/API key inválida | Agregados em `unavailable` para Radar. Helper do provider tem metadados sanitizados de status, mas o ledger Brand Brain guarda somente código/modelo/uso/duração. Não há separação completa de rede, 401 OpenAI e quota na tela. |
| Timeout | `timeout`, run failed, sem repetição paga automática. Proxy pode encerrar antes do backend: conferir ambos os limites. |
| Saída inválida | `invalid_response` para envelope/transporte; `schema_invalid`, `pillar_not_published`, `editorial_term_violation`, `radar_output_inconsistent` para validação local; recusa/incompleta separadas. |
| Repetida/já processada | `existing`, `no_op`, `processing` ou `source_failed`; existing accepted/dismissed não reaparece como pending. É dedupe, não perda de transmissão. |
| Banco indisponível | Erros dentro do bloco principal viram `storage_unavailable`; leituras/claim anteriores ao try do serviço podem cair na mensagem MCP genérica. Auditoria depois de commit pode falhar e devolver erro apesar de sugestão já criada. Conferir ledger/sugestão antes de repetir. |
| Sugestão criada, não exibida | Consulta somente pending e clientes autorizados, três por página. Sem aceitação não entra no Banco. Widget não atualiza continuamente na base; requisições de leitura/decisão falhadas mostram alerta, não removem item otimisticamente. |
| Administração | Dashboard não mostra um painel de falhas de geração; lista apenas pendências. Falhas do emissor podem ficar visíveis somente no run externo/MCP e tabelas. Vazio não atesta saúde da integração. |

## 6. Correção mínima recomendada e Hostinger

1. Corrigir somente atualização de leitura do widget e guia OAuth/documentação em PR isolado. Sem migration/flag/token/IA real. Polling visível proposto: 60 segundos, pausado durante decisão, detalhe ou paginação; retorno à aba também atualiza. Não reseta fontes nem aceita sugestões automaticamente.
2. Conferir manualmente o emissor e correlacionar a última tentativa com logs/contagens abaixo. Se não houve envio, corrigir a automação existente; não inventar/agregar agente sem conhecer a tarefa pretendida.
3. Se grant antigo sem consentimento for confirmado, propor nova autorização explícita em etapa separada. Não renovar/reautorizar agora e não ampliar scopes silenciosamente.
4. Se flag/chave/DDL/deploy divergirem, planejar somente a mudança comprovadamente necessária. **Nenhuma alteração de ambiente Hostinger está indicada sem essa evidência.** Uma futura liberação do fix visual exigiria deploy revisado, mas não novas variáveis de ambiente nem alteração de banco.
5. Fonte failed/processing não deve ser apagada, ter URL/hash inventado ou ser repetida automaticamente. Recuperação existente exige revisão explícita; não foi executada.

## 7. Verificações manuais exatas — somente leitura

Não é necessário enviar dumps, `.env`, HAR ou JWT. Faça a inspeção dentro dos painéis autorizados e compartilhe apenas resultados sanitizados.

1. **Emissor externo:** listar tarefas/agentes esperados, plataforma, ativo/pausado, fuso, horário programado, última execução e próximo horário. Na última execução, conferir se buscou oportunidades, se encontrou algo, se chamou `create_radar_suggestion` ou só escreveu texto, e resultado `created/existing/no_op/processing/isError`. Ocultar prompt, conteúdo, nomes privados, URLs e identificadores; usar rótulos Cliente A/B. Nenhuma execução manual/replay.
2. **Deploy Hostinger:** registrar SHA, data/hora com fuso, domínio/API/resource públicos corretos, diretório e comando de inicialização. Conferir no painel somente presença da chave (sim/não), flag literal habilitada/desabilitada, modelo e timeout numérico. Não revelar valor/comprimento/prefixo/sufixo da chave, path privado completo ou qualquer outra credencial; não salvar alterações.
3. **Logs existentes, janela da última tentativa ±5 min:** método/path/status/latência para `/mcp`, `/oauth/token`, `/api/radar-suggestions`; códigos de erro allowlisted. Não provocar OAuth/refresh para obter logs. Separar erro HTTP de erro MCP `isError` dentro de HTTP 200. Não compartilhar headers, bodies, query strings OAuth, cookies, tokens, authorization codes, hashes de tokens ou stack traces com conexão de banco.
4. **OAuth:** no painel ou consulta local somente de colunas não secretas, conferir scope, consentimento booleano, expirado/revogado sim/não e conta ativa/superadmin. Não selecionar `token_hash`, `code_hash`, JWT, code, token, cookies ou secret; não fazer decode de token real nesta conversa. Comparar por conexão correta, não pelo consentimento de outra conexão.
5. **Schema:** conferir via information_schema existência de `radar_suggestions`, `radar_source_runs`, `brand_brain_ai_runs`, `brand_brain_versions`, `mcp_oauth_codes`, `mcp_oauth_refresh_tokens`, `mcp_audit_log`; conferir coluna `radar_ai_authorized` nas duas tabelas OAuth. Comparar metadados com migrations, sem aplicar nada. Preflight do código verifica apenas quatro tabelas, não colunas/índices/permissão de escrita nem sucesso do provider.
6. **Contagens:** executar SELECTs agregados abaixo numa sessão já autorizada, no banco correto, sem importar/conectar este computador. Por cliente afetado, aplicar internamente `WHERE client_account_id = ?` com UUID conferido no painel. Não exportar dados editoriais. Falha de SELECT por tabela ausente já é evidência: não executar DDL para continuar.

```sql
SELECT status, error_code, COUNT(*) AS total, MAX(updated_at) AS last_update
FROM radar_source_runs GROUP BY status, error_code;

SELECT operation, status, error_code, COUNT(*) AS total, MAX(created_at) AS last_run
FROM brand_brain_ai_runs WHERE operation = 'radar'
GROUP BY operation, status, error_code;

SELECT status, COUNT(*) AS total, MAX(created_at) AS last_created
FROM radar_suggestions GROUP BY status;

SELECT tool_name, success, COUNT(*) AS total, MAX(created_at) AS last_call
FROM mcp_audit_log
WHERE tool_name IN ('create_radar_suggestion', 'create_pauta_draft')
GROUP BY tool_name, success;
```

Os totais históricos não comprovam atividade recente; comparar timestamps com a tentativa externa e, se necessário, aplicar uma janela temporal parametrizada em cada SELECT. Sem auditoria não se pode concluir que não houve request: autenticação pode falhar antes da auditoria, ou a própria auditoria pode falhar depois do commit. Sem ledger não se pode concluir que a IA falhou: autorização/configuração/input podem impedir claim. Ledger failed + run AI success sugere validação final/persistência posterior; ledger completed + sugestão pending + GET sem item orienta inspeção de cliente/filtros/UI. `no_op` é decisão editorial válida.

## 8. Regressão necessária

Executar isoladamente: matriz de scopes/consentimento, JWT aplicação vs MCP, expiração e refresh sem ampliação, isolamento de cliente, disabled/key ausente sem chamada paga, timeout/recusa/schema/pilar/regras, dedupe e concorrência, transação de aceitação e preservação de drawer, status accepted/dismissed, paginação, falhas de GET/POST visíveis, chegada assíncrona em Dashboard focado/retorno à aba, cleanup e nenhuma atualização durante decisão. Todos com provider e armazenamento sintéticos; não executar testes MySQL contra bancos existentes.

Resultados novos e reproduções serão registrados em `validation.md`. Não há conclusão de teste integrado em produção nem de saúde da conexão real.
