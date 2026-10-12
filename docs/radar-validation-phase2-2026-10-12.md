# Radares — correção de validação e diagnóstico (fase 2)

## Problema e resultado

Nomes canônicos de pilares entre 121 e 240 caracteres eram cortados pelo próprio contexto e depois comparados exatamente com a saída completa da IA. Regras editoriais posteriores à oitava entrada ou com mais de 180 caracteres também eram cortadas na validação. Falhas de schema, pilar, vocabulário e consistência do Radar recebiam o mesmo `invalid_response`.

Esta alteração preserva a identidade completa dos pilares, valida o vocabulário contra todas as entradas publicadas e distingue os quatro motivos de falha. A correção é compartilhada por Radar e Brand Brain AI, preservando os contratos de score, conteúdo, acesso e persistência.

Referência: relatório da fase 1 `docs/radar-mcp-audit-2026-10-12.md` (branch local `codex/radar-audit`, commit `8884c1d6`). Esta branch de implementação parte diretamente de `main` no commit `19c2d9be4a44ec72a5f7d8c5a8c0b5c9ef0011f1`, sem incluir o commit da auditoria.

O diagnóstico de produção informado pelo usuário em 12/10/2026 registra Kynagogi com dez sucessos e duas falhas, Patrícia com zero sucessos e uma falha, e nenhuma execução dessas tabelas para Minas Home ou Easy2Work. As três falhas têm `invalid_response` nos dois ledgers e modelo `gpt-4.1-mini-2025-04-14`. Esse código histórico não permite atribuir retroativamente um motivo específico. Não foram feitas novas consultas de produção nesta fase.

## Causas e soluções

| Problema | Solução |
| --- | --- |
| Comparação com nome cortado a 120 caracteres; somente oito pilares disponíveis | Snapshot interno com todos os nomes canônicos completos, sem truncamento e sem aproximação. A IA recebe todos os nomes exatos; somente o foco e demais textos de apresentação continuam compactados. Nomes divergentes/abreviados não são remapeados. |
| Validação usando somente as oito primeiras entradas de `avoidWords`, cortadas a 180 caracteres | Snapshot integral das palavras/expressões publicadas, separado do prompt compacto. Mantidos NFKC, comparação sem distinção de caixa, escaping e limites de palavra. Um prefixo compactado não se torna uma nova regra proibida. |
| Erros locais agrupados em `invalid_response` | `schema_invalid`, `pillar_not_published`, `editorial_term_violation` e `radar_output_inconsistent`, com mensagens fixas sem valores privados. |
| Conversão final para sugestão tratava ZodError como falha de armazenamento | `safeParse` classifica essa falha como `schema_invalid` antes de persistir sugestão. |
| Auditoria MCP sem motivo específico | Campo adicional `errorCode` dentro do JSON existente, limitado a uma lista explícita de códigos públicos conhecidos. Nenhuma alteração de schema. |
| Memória vazia sem indicação determinística de limitação | Metadado adicional `personalization` com `status` e nomes dos campos editoriais ausentes, no contexto/capabilities e nos novos resultados created/no_op. Memória incompleta não bloqueia o Radar; não preenche marca com suposições. |

O snapshot integral vive em `WeakMap`, associado ao objeto interno de contexto. Não é serializado no prompt, na resposta pública ou nos logs. Ele guarda o ID do cliente, nomes completos e termos integrais em estruturas imutáveis. A comparação de cliente verifica o ID interno e o ID apresentado antes da chamada ao provedor. Contextos destacados/clonados não podem substituir a memória de validação.

O hash passa a incluir as regras integrais: uma alteração em uma regra omitida no prompt ainda altera o hash. A versão do contexto é `compact-v3`. A identidade da fonte e as restrições UNIQUE continuam iguais.

## Diagnóstico e privacidade

As validações locais no serviço de IA encerram `brand_brain_ai_runs` com o código específico; o mesmo erro é propagado ao MCP, que marca `radar_source_runs` e registra o código permitido na auditoria MCP. A conversão final para o schema de armazenamento, quando falha após uma resposta de IA válida, marca o ledger da fonte; o sucesso da análise de IA permanece distinto da persistência posterior.

Não são gravados outputs brutos, prompts, termos proibidos, nomes de pilares inválidos, mensagens Zod ou mensagens brutas do provedor. O diagnóstico novo usa somente códigos fixos, IDs/hash/status e a telemetria numérica/modelo já existente.

As classificações existentes de timeout, indisponibilidade, recusa, resposta incompleta, transporte inválido, autenticação, consentimento, cliente, configuração e armazenamento permanecem. O `invalid_response` do transporte continua aplicável quando não há saída estruturada que possa ser validada localmente.

## Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.context.ts` | Identidade integral, snapshot privado, hash/versão e personalização limitada. |
| `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.service.ts` | Validação por snapshot integral, vínculo ao cliente, códigos/mensagens e instrução de nomes exatos. |
| `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.test.ts` | Regressões de todas as operações, hash, privacidade e imutabilidade. |
| `v2/apps/api/src/modules/mcp/mcp.radar.service.ts` | Classificação da conversão final e metadado adicional de personalização. |
| `v2/apps/api/src/modules/mcp/mcp.radar.test.ts` | Fixtures sintéticas representativas, persistência de códigos, MCP real em memória e proteções de segurança. |
| `v2/apps/api/src/modules/mcp/mcp.repository.ts` | Allowlist de códigos na auditoria JSON existente. |
| `v2/apps/api/src/modules/mcp/mcp.server.ts` | Mensagens específicas seguras e inclusão do código na auditoria de falha. |
| `docs/radar-validation-phase2-2026-10-12.md` | Causas, solução, validação, impacto e limites. |

## Testes e verificação

Node 22.23.3. Todas as chamadas de IA nos testes usam provedores simulados. As fixtures usam textos e IDs sintéticos; preservam somente formas representativas: cinco pilares com descrição no nome e 99 regras (Patrícia), seis pilares longos e 68 regras (Minas Home), nove pilares estruturados e dez regras (Kynagogi).

Cobertura adicional: nomes longos até o limite existente de 240 caracteres, nomes com prefixo comum, pilar inventado/abreviado/traduzido, memória vazia, regras além da oitava entrada, expressões acima de 180 caracteres, prefixos que não devem ser rejeitados, Unicode/pontuação/limites de palavra, campos ausentes/nulos/extras, scores inválidos, decisão inconsistente, resposta válida, `no_op`, bloqueio das fontes falhadas, códigos nos dois ledgers e auditoria sanitizada.

As regressões existentes de autenticação, consentimento interno, concorrência, deduplicação, isolamento e criação apenas pendente continuam na suíte. A verificação dos métodos de repositório usa conexão falsa e examina somente os parâmetros das operações; não executa SQL em um banco real.

Comandos executados em `v2/`, sob Node 22:

- `npm --workspace @design-hub-v2/api test`
- `npm run check`
- `npm run build`
- `git diff --check`

Resultado final: **600 testes passaram**, sem falhas, testes ignorados ou TODOs. Typecheck e build de API/web passaram. Foram adicionados 21 testes em relação a `main`. O build mantém o aviso existente de chunks maiores que 500 kB; não há falha de compilação. `git diff --check` passou.

## Impacto e limites

- Nenhum pilar, peso, preferência ou registro existente de cliente é reescrito. Não há migrations, alteração de banco, nova chamada real à IA ou reprocessamento nesta entrega.
- Fontes antigas em `failed` continuam bloqueadas, inclusive as três com `invalid_response`. `completed`, `no_op` e fontes já registradas preservam a idempotência. Não existe nova ação de recuperação.
- Nomes completos legítimos deixam de falhar pelo corte de 120 caracteres. Permanece o contrato de saída/coluna `pillar` de até 240 caracteres; nomes acima desse limite não são cortados para caber, nem interpretados semanticamente, e exigem uma decisão de contrato em outra etapa.
- Regras antes omitidas passam a ser aplicadas. Alguns conteúdos podem ser rejeitados corretamente por regras que antes escapavam ao recorte; não houve relaxamento para aumentar aprovação.
- Regras narrativas de voz e evidência continuam sendo instruções ao modelo. A validação determinística integral aqui cobre a identidade dos pilares e todas as palavras/expressões publicadas em `avoidWords`; não introduz um classificador semântico nem promete verificar automaticamente toda nuance narrativa.
- Há um pequeno aumento do contexto enviado à IA por manter nomes completos e todos os pilares. A quantidade de chamadas, modelo configurado e limites de saída permanecem iguais. Nenhuma chamada adicional de validação ou retry foi adicionada.
- `personalization` é informação adicional de novas análises/resultados; não recalcula nem altera sugestões históricas retornadas por deduplicação. Campos ausentes não equivalem a falta de autorização.
- O PR deve ser revisado antes de qualquer merge/deploy. A recuperação manual das falhas pertence à próxima etapa, conforme solicitado.
