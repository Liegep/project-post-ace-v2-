# Checkpoint 3 — Brand Brain AI

Implementado na branch `codex/radar-suggestions-foundation`, a partir do Checkpoint 2 aprovado (`eda2077ad260bf70da64fba6bd24e65fcc734db6`). Sem alteração de MCP, Radar periódico, produção, legado ou executor automático.

## Comportamento

- Pautas: botão **Gerar com Brand Brain**, formulário de objetivo/quantidade/formato/tema/observações, cards de prévia, seleção múltipla e refinamento com direções rápidas ou personalizada.
- Editor: **Analisar com Brand Brain**, painel somente leitura; verificação sem IA preservada. Resultado é invalidado quando o texto muda. Estimativa Alta/Média/Baixa explicita que não garante aprovação.
- Nenhuma chamada paga ao abrir Dashboard, Pautas ou drawer. A consulta de disponibilidade/completude é somente leitura.
- Geração/refinamento não persistem pautas. Adição explícita reutiliza o POST seguro existente, salva `draft` / `createdBy: ai_brand_brain`, preserva metadados e usa o UUID da prévia. Retry sob lock devolve o registro existente e preserva edições humanas. Não cria card nem envia ao cliente.
- Pautas de origem AI não são associadas a cards por título. O envio humano já existente permanece disponível separadamente.
- `generateRadarSuggestion()` existe apenas no serviço interno, aceita descoberta e pode retornar `shouldCreate: false`; não possui endpoint, não persiste sugestão e não está conectado a executor ou MCP.

## Endpoints

Todos exigem acesso interno e autorização `admin`/`colaborador` no cliente (superadmin mantém acesso global). Portal não tem acesso.

- `GET /api/clients/:clientId/brand-brain-ai/context`: disponibilidade/motivo, completude, hash e versão compacta. Não devolve a memória integral e não chama IA.
- `POST /api/clients/:clientId/brand-brain-ai/analyze`
- `POST /api/clients/:clientId/brand-brain-ai/generate`
- `POST /api/clients/:clientId/brand-brain-ai/refine`

Entradas/saídas estritas estão em `brand-brain-ai.schemas.ts`. Erros de input: 400; autorização: 401/403; cliente ausente: 404; concorrência no processo: 409; indisponibilidade: 503; timeout: 504; saída inválida/refusal/incompleta: 502. Não há retries automáticos.

## Contexto e segurança

O repositório consulta somente `workspace_drawer_json.brandBrain`, que é o conteúdo publicado pelo fluxo oficial. Não consulta tabelas de revisões/comentários/histórico. Usa locale e identidade do cliente autorizado; até 20 pautas recentes dentre 30 posições do drawer, com textos limitados. Campos estratégicos: 700 caracteres; listas: até 8 itens de 180 caracteres; pilares: até 8, nome 120/foco 240. Direção visual entra quando o formato exige contexto visual. Hash SHA-256 e `compact-v1` identificam o contexto utilizado.

Completude usa os mesmos dez grupos em frontend/backend por um helper compartilhado. Memória pouco preenchida avisa sem bloquear. Nome, produto, slogan e expressão oficial devem ser preservados no idioma registrado.

Responses API com `store:false`, structured output estrito e validação Zod local. JSON inválido, campos extras/ausentes, score/arrays inválidos, refusal, truncamento, pilar inventado e vocabulário proibido em texto proposto são rejeitados. As fontes são dados não confiáveis em mensagem separada das instruções; provider não expõe ferramentas. Analisar/gerar/refinar/Radar não possuem métodos de escrita editorial. Estes controles reduzem o risco de injection; testes mockados verificam o isolamento e contrato, não medem comportamento semântico de um modelo real.

O transporte de Responses foi extraído para `lib/openai-responses.ts` e reutilizado nos Relatórios. Mantidos modelo e schema dos Relatórios, agora com timeout, rejeição de saída incompleta/refusal e erros sanitizados; removido o log do corpo de erro externo.

## Configuração (somente servidor)

- `OPENAI_API_KEY`: existente; nunca exposta na interface/logs.
- `BRAND_BRAIN_AI_ENABLED`: precisa ser exatamente `true`; ausente/default = desativado.
- `BRAND_BRAIN_AI_MODEL`: default `gpt-4.1-mini`.
- `BRAND_BRAIN_AI_MAX_OUTPUT_TOKENS`: default 6000, intervalo 512–16000.
- `BRAND_BRAIN_AI_TIMEOUT_MS`: default 30000, intervalo 1000–120000.

O frontend aguarda até 130 segundos, acima do timeout máximo do servidor, para não abortar uma solicitação válida após o limite genérico de 20 segundos. Timeout/refusal não provocam nova tentativa automática. Um pedido simultâneo por cliente é permitido por instância do serviço; esse controle de custo não é um lock distribuído. A persistência da pauta usa lock/transação do banco, inclusive entre processos.

## Migração / reversão

`v2/database/migrations/20261007_brand_brain_ai_runs.sql`: somente CREATE TABLE IF NOT EXISTS; 13 colunas, PK `id`, índice `idx_brand_ai_client_created`, FK `fk_brand_ai_client` com RESTRICT no DELETE/UPDATE, dois CHECKs de operação/status. InnoDB/utf8mb4_unicode_ci; hash ascii_bin; TIMESTAMP(3); contagens unsigned. Não altera tabela/registro existente, não transforma legado, não é executada no startup.

Aplicar somente após revisão, antes de habilitar a IA. Sem a tabela, a operação falha antes de chamar o provider. Custo estimado permanece NULL: não há tabela de preços confiável configurada. Métricas guardam apenas cliente/operação/modelo/tempo/tokens/hash/status/código de erro, sem prompt, pauta ou segredo.

Reversão segura: desabilitar `BRAND_BRAIN_AI_ENABLED`, retornar ao código anterior e preservar a tabela. Se for necessário retirar a tabela do namespace após interromper chamadas, arquivá-la com backup e RENAME TABLE (sem excluir histórico). Nenhum rollback destrutivo foi executado.

O pacote do backend deve incluir `v2/shared/brand-brain-completion.mjs` na estrutura relativa do projeto. Importação do serviço compilado verificada após build; frontend incorpora o helper no bundle.

## Validação executada

- Específicos Brand Brain AI: **24/24**, provider e transporte mockados, sem chave real.
- Suíte principal: **491/491** (467 anteriores preservados + 24 novos).
- Radar sazonal: **19/19**.
- MariaDB temporário **10.11.19**, socket local, sem credenciais de produção: **3/3** novos testes de migração/contexto/telemetria/concorrência e preservação do drawer.
- Radar Suggestions no mesmo MariaDB: **10/10** regressões.
- Typecheck e build aprovados; aviso de tamanho de bundle já existente.
- Prévia manual mockada: desktop 1280, mobile 390 e 320, sem overflow; drawer, seleção, ações acessíveis, footer separado da rolagem e painel somente leitura conferidos.

## Teste real futuro — NÃO executado

Após autorização específica, aplicar a migration em staging, configurar a chave exclusivamente no servidor e habilitar a flag. Usar cliente de teste com Brand Brain publicado e locale definidos. Acionar analisar, gerar 3 ideias e refinar manualmente; conferir idioma/nomes/termos/alinhamento e registros de uso. Adicionar uma prévia e confirmar draft/sem card/sem envio. Desativar a flag ao terminar. Custos reais e qualidade editorial ainda precisam dessa avaliação autorizada.

## Arquivos criados

- `v2/apps/api/src/lib/openai-responses.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.context.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.schemas.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.repository.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.service.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.routes.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.test.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.mysql.test.ts`
- `v2/apps/web/src/BrandBrainAiWorkspace.tsx`
- `v2/apps/web/src/BrandBrainAiWorkspace.css`
- `v2/apps/web/tests/brandBrainAi.test.tsx`
- `v2/apps/web/tests/brand-brain-ai-preview.html`
- `v2/shared/brand-brain-completion.mjs`
- `v2/shared/brand-brain-completion.d.mts`
- `v2/database/migrations/20261007_brand_brain_ai_runs.sql`
- Este documento.

## Arquivos alterados

- `v2/.env.example`, `v2/.env.staging.example`
- `v2/apps/api/package.json` (scripts/cobertura)
- `v2/apps/api/src/app.ts` (registro das rotas)
- `v2/apps/api/src/config/env.ts`
- `v2/apps/api/src/modules/clients/clients.routes.ts` (retry de prévia AI preserva pauta existente)
- `v2/apps/api/src/modules/reports/reports.routes.ts` (adapter compartilhado)
- `v2/apps/web/src/App.tsx` (ações manuais, completude, proteção contra associação por título)
- `v2/apps/web/src/api.ts` (contratos/métodos)
