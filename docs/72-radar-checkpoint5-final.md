# Checkpoint 5 — validação final e plano de deploy

Data: 07/10/2026. Branch: `codex/radar-suggestions-foundation`.
Código validado: `c26cddcd66e020beaa2e514e982b59af031c77b7` (Checkpoint 4 aprovado).

Esta etapa altera somente este relatório. Nenhuma alteração de código, schema ou migration; nenhuma chave local, chamada real de IA, conexão à Hostinger, aplicação em produção, push, merge ou deploy. O teste real foi transferido, por orientação do usuário, para um smoke test controlado em produção no futuro deploy. Este procedimento substitui os roteiros anteriores de teste real dos Checkpoints 3 e 4.

## Resultados locais

Execução com Node 22 e providers/transporte OpenAI mockados; nenhuma credencial real utilizada.

| Validação | Resultado |
| --- | --- |
| Suíte principal API + frontend (`npm --workspace @design-hub-v2/api test`) | 503/503, zero falhas/skips |
| Radar sazonal (`npm --workspace @design-hub-v2/web run test:seasonal`) | 19/19 |
| Cobertura sazonal combinada: serviço, datas e interface | 32/32; inclui testes já presentes nas suítes acima |
| MariaDB Radar Suggestions | 10/10 |
| MariaDB Brand Brain AI | 3/3 |
| MariaDB MCP/Radar | 6/6 |
| MariaDB Radar sazonal | 10/10 |
| Typecheck API/frontend (`npm run check`) | aprovado |
| Build API/frontend (`npm run build`) | aprovado |

As contagens complementares se sobrepõem parcialmente; não devem ser somadas como testes únicos. O build mantém o aviso conhecido de bundle maior que 500 kB, sem erro.

MariaDB local **10.11.19**, duas instâncias novas em diretórios temporários, sockets locais e `--skip-networking`; os testes criam e removem bancos aleatórios. Modo estrito: `STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION`.

A primeira execução conjunta de Radar/IA/MCP teve 18/19: o teste de timestamp insere uma data literal esperando sessão UTC, enquanto a instância iniciou com `SYSTEM` (fuso do computador, UTC+02). A leitura devolveu corretamente o instante correspondente, duas horas antes. Ajustado apenas `time_zone` GLOBAL da instância temporária para `+00:00`, a nova execução completa passou 19/19. Isso evidencia uma premissa UTC do fixture; não exigiu alteração no código. O repositório lê os instantes TIMESTAMP com `UNIX_TIMESTAMP`, independentemente do timezone de interpretação do driver. Na aplicação da migration e em smoke tests SQL futuros, usar sessão UTC; não alterar o fuso global da Hostinger.

Evidências de execução local: `/tmp/checkpoint5-main.log`, `/tmp/checkpoint5-seasonal19.log`, `/tmp/checkpoint5-seasonal-complete.log`, `/tmp/checkpoint5-mysql.log` (primeira rodada), `/tmp/checkpoint5-mysql-utc.log` (rodada final), `/tmp/checkpoint5-seasonal-mysql.log`, `/tmp/checkpoint5-check.log`, `/tmp/checkpoint5-build.log`. Arquivos temporários não fazem parte do pacote de deploy.

## Integridade e ausência de IA

Cobertura existente reexecutada comprova:

- Flag desativada ou chave ausente: erro claro, zero chamadas ao provider, zero reservas de fonte e zero sugestões incompletas. Abrir contexto/capabilities não é chamada paga.
- Interface permite fechar a área de IA e continuar operando. Dashboard/listagem/detalhe/aceitar/descartar não dependem do provider e não o chamam.
- OAuth preserva scopes legados; `radar:suggest` exige novo consentimento explícito. Conexões sem esse scope continuam com as tools autorizadas e não recebem a nova tool automaticamente. O endpoint MCP continua restrito a superadmin ativo.
- Isolamento de cliente antes da consulta/chamada, builder somente da memória publicada, locale preservado, saída validada e auditoria sanitizada.
- Fonte repetida, resultado negativo e concorrência entre serviços/processos não repetem IA. Falha não dispara retry pago automático.
- MCP → sugestão pending → Dashboard → detalhe → aceitar/descartar funciona com provider mockado, API e SDK reais, incluindo MariaDB.
- Aceitação cria uma única PautaIdea draft, preserva metadados e todos os demais campos do `workspace_drawer_json`; descarte preserva histórico. Não há criação de card, publicação nem envio ao cliente nesse fluxo.
- Suíte principal também revalida os domínios anteriores (Meta, portal, calendário, Agenda, Briefs, relatórios, contratos, propostas, faturamento e Dashboard).

Isso não significa que ações que explicitamente pedem IA funcionem sem configuração: elas devolvem indisponibilidade. A flag controla Brand Brain AI/Radar; a função de IA já existente em Relatórios tem configuração própria e também utiliza a chave do servidor.

## Migrations pendentes deste pacote e ordem

Aplicar explicitamente, somente após aprovação de merge/deploy, com backup e preflight. Não executar bootstrap nem aplicar todas as migrations da pasta por wildcard.

| Ordem | Arquivo em `v2/database/migrations` | Tabela | Colunas | FKs | CHECKs |
| --- | --- | --- | ---: | ---: | ---: |
| 1 | `20261007_radar_suggestions_foundation.sql` | `radar_suggestions` | 32 | 4 | 2 |
| 2 | `20261007_brand_brain_ai_runs.sql` | `brand_brain_ai_runs` | 13 | 1 | 2 |
| 3 | `20261007_radar_source_runs.sql` | `radar_source_runs` | 9 | 2 | 1 |

Total: **3 tabelas, 7 FKs, 5 CHECKs**. `radar_source_runs` depende de `radar_suggestions`. As duas primeiras dependem das tabelas existentes `client_accounts`/`users`; a telemetria deve existir antes de qualquer chamada paga. Conferir também a infraestrutura existente `brand_brain_versions` e OAuth/auditoria MCP usada pela integração. As rotas legadas já mantêm suas próprias rotinas de criação de tabelas; isso não é uma migration nova deste pacote.

Todas as três migrations contêm somente `CREATE TABLE IF NOT EXISTS`: nenhuma instrução INSERT/UPDATE/DELETE/ALTER em dados legados. InnoDB, `utf8mb4_unicode_ci`; hashes `CHAR(64)` em `ascii_bin`; IDs `CHAR(36)`; JSON em `based_on_json`; `TIMESTAMP(3)` e contagens unsigned. Não usam `GENERATED ALWAYS`. FKs de cliente usam RESTRICT em DELETE/UPDATE; usuários da sugestão usam SET NULL em DELETE e RESTRICT em UPDATE; vínculo do ledger com a sugestão usa RESTRICT. `accepted_pauta_id` identifica uma pauta no documento do cliente e não possui FK para uma tabela de pautas.

Índices declarados: três PKs; uniques `uq_radar_suggestion_client_dedupe`, `uq_radar_source_client`; índices `idx_radar_suggestion_client_status_created`, `idx_radar_suggestion_client_source`, `idx_radar_suggestion_status_created`, `idx_brand_ai_client_created`, `idx_radar_source_suggestion`. Conferir também os índices de suporte gerados pelo InnoDB para as FKs de usuários.

Reexecução testada sem apagar/alterar registros. `IF NOT EXISTS` não corrige uma tabela existente divergente: comparar `SHOW CREATE TABLE` e metadados antes de declarar sucesso. Não considerar um warning de tabela existente como validação do schema.

Hashes SHA-256 dos arquivos revisados:

```text
radar_suggestions_foundation: 2c5079d06cfbb74d465021fbda896937ecdc564f610b6aa96fecdad61f22b65c
brand_brain_ai_runs:          9f4af5edbb6dccb18e3ba12715b0b559bfe5b9da3a56eb31137da3b3c051a7e9
radar_source_runs:            2c1493c63c68779c8467227b7c1834f72954d343a10e69b4d428f2d0532adcb8
```

`20261007_dashboard_dismissals_item_types.sql` é de outro escopo e altera uma tabela existente. Não integra a sequência acima; confirmar seu histórico separadamente, sem reaplicá-la como parte do Radar.

## Checklist do futuro deploy

1. Aprovação de merge/deploy; conferir SHA final e empacotar `v2/shared/brand-brain-completion.mjs` no caminho relativo esperado pelo backend compilado.
2. Backup verificável; reconfirmar versão/configuração reais do banco e compatibilidade de IDs/collation/InnoDB, CHECKs habilitados, JSON e TIMESTAMP(3). O registro anterior aponta Hostinger **11.8.9-MariaDB-log**; não foi consultado novamente nesta etapa. O ensaio local foi em 10.11.19 e não substitui esse preflight.
3. Conferir ambiente exclusivamente no servidor, sem imprimir valores secretos; manter `BRAND_BRAIN_AI_ENABLED=false` durante preparação/aplicação.
4. Aplicar as três migrations na ordem indicada, na sessão UTC, mantendo `foreign_key_checks` e `check_constraint_checks` ativos. DDL tem commit implícito: não prometer rollback transacional.
5. Conferir três tabelas e seus defaults, índices, FKs, CHECKs, charset/collation. Comparar evidências das tabelas anteriores durante janela coordenada sem concorrência de escrita; confirmar nenhum import/conversão de legado e tabelas novas vazias antes de uso.
6. Publicar somente o pacote aprovado. Verificar health, login, Dashboard e fluxo manual de pautas com IA desativada; nenhuma ação de leitura pode acionar OpenAI.
7. Executar o único smoke test abaixo e registrar resultado. Se falhar, desativar a flag e interromper sem retry, outra fonte ou outro cliente. Manter funcionalidades manuais e examinar erro sanitizado.
8. Revisar resultado antes de habilitar uso geral de IA/Radar. Não executar smoke test com dados fictícios extensivos em produção.

### Variáveis de ambiente

| Variável | Conferência |
| --- | --- |
| `OPENAI_API_KEY` | Já configurada na Hostinger; verificar presença sem exibir valor. Nunca copiar para worktree, frontend, chat ou logs. |
| `BRAND_BRAIN_AI_ENABLED` | Default false; somente valor exato `true` habilita via env. Ativar apenas na janela controlada do teste. |
| `BRAND_BRAIN_AI_MODEL` | Confirmar acesso ao modelo escolhido; default `gpt-4.1-mini`. Sem fallback silencioso. |
| `BRAND_BRAIN_AI_MAX_OUTPUT_TOKENS` | Default 6000; intervalo 512–16000. |
| `BRAND_BRAIN_AI_TIMEOUT_MS` | Default 30000; intervalo 1000–120000. Não aumentar para contornar erro com nova chamada. |
| `APP_ENV_FILE` | Quando utilizado, apontar ao arquivo privado correto do servidor. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Confirmar banco/usuário correto e permissões para DDL explícito; não expor valores. |
| `APP_URL`, `APP_TIMEZONE`, `JWT_SECRET` | Preservar configuração existente; validar URL/resource OAuth e timezone da operação, sem rotacionar segredos neste escopo. |

Scopes OAuth são concessões, não uma flag de ambiente: solicitar `planning:read radar:suggest` com consentimento explícito; não conceder `pauta:create` para o smoke test.

## Smoke test controlado em produção — ainda NÃO executado

Orçamento absoluto: **1 cliente, 1 fonte, no máximo 1 chamada real de IA**. Coordenar uma janela sem outras ações de IA; não usar geração/análise/refino paralelos.

1. Escolher um cliente autorizado com Brand Brain publicado adequado e locale confirmado, preferencialmente Kynagogi. Se os dados não forem adequados, interromper e revisar; não completar/inferir memória automaticamente.
2. Selecionar uma fonte específica e verificável, com URL e data quando disponíveis. Conferir que o par cliente/fonte ainda não foi processado; fonte já registrada resulta em dedupe, não comprova chamada real. Não apagar ledger nem fabricar identidade para forçar chamada.
3. Registrar baseline dos runs desse cliente para conferência interna, sem exportar memória/prompt. Confirmar as migrations e disponibilidade antes de habilitar a flag.
4. Fazer consentimento MCP de superadmin para `planning:read radar:suggest`, sem `pauta:create`. Invocar **uma única vez** `create_radar_suggestion`, que chama `generateRadarSuggestion()` com contexto oficial. Não testar outros endpoints de IA.
5. Resultado `shouldCreate=false`/`no_op` é válido; resultado positivo deve produzir uma única sugestão pending. Consultar resumo/detalhe e telemetria, sem aceitar/adicionar ao banco. Não criar card, enviar, agendar ou publicar.
6. Confirmar incremento de no máximo um run e revisar o resultado editorial, incluindo idioma/pilar quando presentes. Reportar somente modelo real retornado, input/output/total tokens, duração, custo estimado e resultado editorial. Em erro, reportar somente código/mensagem sanitizados. Não copiar logs brutos, headers, prompt completo, Brand Brain completo ou dados sensíveis.
7. Custo estimado somente se houver preço oficial vigente verificável para o modelo e dados suficientes sobre tokens/cache. Registrar referência/data e premissas; caso contrário, informar indisponível. `estimated_cost_usd` permanece NULL no serviço atual: não inventar custo nem mudar schema para o teste.
8. Desativar novamente a flag ao encerrar o smoke test e conservar telemetria/ledger/pendência, se criada. Timeout, refusal, schema inválido ou erro de persistência encerram o teste, sem segunda chamada. `failed`/`processing` não recebem recuperação automática.

## Reversão e limites restantes

Desabilitar IA e voltar ao pacote anterior, preservando as tabelas e os registros. Nenhum DROP/TRUNCATE; não apagar sugestões aceitas/descartadas, ledger ou telemetria. Se houver aplicação parcial de DDL, conferir o estado e completar somente os objetos faltantes após revisão, com a flag desativada. Arquivamento por RENAME TABLE exigiria plano separado que considere a FK do ledger; não é necessário para a reversão de código.

O comportamento estrutural está validado por mocks e MariaDB. Qualidade editorial real, compatibilidade efetiva do structured output com o modelo configurado, latência e custo reais continuam pendentes do smoke test. O schema estrito e a validação local não garantem, por si só, que um modelo ignore semanticamente toda prompt injection. Nenhuma infraestrutura de crawler/scheduler foi adicionada. As limitações já documentadas de JWT ainda válido após downscope e de reservas failed/processing sem expiração automática permanecem.

Checkpoint 5 encerrado para revisão. Nenhuma autorização de merge/deploy foi presumida.
