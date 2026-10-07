# Checkpoint 4 — Radar + Brand Brain AI + MCP

Branch: `codex/radar-suggestions-foundation`. Base aprovada: `59cf9f31c2d3499db52175736a4cd4ea1e3f0195`.

## Fluxo implementado

ChatGPT/Radar fornece uma descoberta → acesso e scope validados → identidade da fonte normalizada → consulta/reserva persistente antes da IA → builder compacto publicado → `generateRadarSuggestion()` → zero registros se `shouldCreate:false`, ou uma sugestão `pending` → API/widget existente → decisão humana.

A tool retorna resultado (`created`, `existing`, `no_op` ou `processing`), hash da fonte, ID e resumo/status da sugestão quando disponível. Não pede confirmação de pauta porque cria somente pendência; a escolha de adicionar ao banco ocorre depois no Dashboard. Não cria PautaIdea, card, aprovação, agendamento ou publicação. Não altera Brand Brain. O widget e o frontend não foram modificados.

## OAuth e autorização

Novo scope: `radar:suggest`. Nova tool: `create_radar_suggestion`.

- Scopes suportados: `planning:read`, `pauta:create`, `radar:suggest`.
- Default anterior preservado: `planning:read pauta:create`. O novo scope nunca é adicionado por omissão ou refresh.
- Autorizações que pedem `radar:suggest` apresentam checkbox obrigatório, inicialmente desmarcado, explicando pendências e uso de IA; o POST exige `radar_consent=yes`.
- Refresh pode manter/reduzir scopes. Upgrade retorna `invalid_scope`, exige novo consentimento e não consome o refresh válido.
- Grant mantém validação de client/resource antes de consumir o refresh.
- Tool só é registrada quando o scope foi concedido; o serviço verifica novamente o scope e o acesso ao cliente antes de consultar dados ou chamar IA.
- `radar:suggest` não habilita `create_pauta_draft`. Essa tool continua exigindo o scope separado `pauta:create` e confirmação explícita.
- Restrição vigente do endpoint MCP a superadmin ativo foi preservada; não houve expansão para admin/colaborador/portal. O serviço também faz isolamento por cliente para reutilização segura.

Limitação existente do OAuth: access tokens são JWTs com validade de uma hora. Downscope afeta tokens renovados; um access token já emitido mantém seus scopes até expirar. Não foi introduzida revogação imediata de JWTs nesta etapa.

## Input

`clientId`, `sourceTitle`, `sourceSummary` obrigatórios. `sourceUrl` e `sourceDate` opcionais; ausentes ficam NULL. `radarName` opcional, default `Radar`. URLs somente HTTP/HTTPS sem credenciais; datas ISO válidas; campos limitados por Zod.

O schema de Radar do Checkpoint 3 foi reaproveitado e ampliado para esses opcionais. O serviço usa o builder compacto existente, client.locale e pautas recentes limitadas. A memória publicada e a última versão registrada são consultadas em uma leitura; o mesmo contexto preparado é usado na chamada e na telemetria. Um contexto de outro cliente é recusado antes da chamada paga.

## Deduplicação e custo

Política desta etapa: **uma tentativa por cliente e identidade de fonte**, independentemente de mudanças posteriores de resumo, pautas ou contexto.

1. URL canônica: remove fragmento e `utm_*`/`fbclid`/`gclid`, ordena query; usa a normalização do Radar existente. Sem URL: nome do Radar + título da fonte normalizados + data (NULL quando ausente). Datetimes são normalizados para UTC.
2. Consulta sugestões existentes pelo par cliente/source_key, inclusive accepted/dismissed. Nunca recria ou ressuscita uma decisão existente.
3. Reserva `radar_source_runs` com unique `(client_account_id, source_key)` antes da IA. Requisições concorrentes, inclusive em processos diferentes, retornam `processing` e não chamam o provider.
4. `shouldCreate:false` encerra como `no_op`, sem `radar_suggestion`. Esse resultado persiste entre logins/restarts e alterações de Brand Brain.
5. Resultado positivo: sugestão e conclusão do processamento são gravadas na mesma transação. Se uma sugestão manual da fonte surgiu durante a IA, é reutilizada sem duplicação e com seu status real.
6. Falha não gera sugestão incompleta. Timeout/refusal/saída inválida/falha de gravação não provocam retry pago automático; a tentativa fica `failed` quando o armazenamento está disponível.

Decisão conservadora: `failed` e `processing` interrompido não expiram automaticamente. Reanálise/recuperação exige política e revisão explícitas futuras. Não foi criado reset automático, endpoint de reanálise ou mudança de identidade por hash do Brand Brain. URLs continuamente atualizadas continuam sendo a mesma fonte; preferir a URL específica da descoberta. O hash registrado permite uma política futura sem custo automático agora.

Modelo: exclusivamente `BRAND_BRAIN_AI_MODEL`, defaults/timeout/output limit do Checkpoint 3; sem fallback de modelo. Flag desativada ou chave ausente devolve erro claro, sem reserva/sugestão/chamada paga e sem remover outras tools do MCP.

## Persistência, contexto e auditoria

Migração nova: `v2/database/migrations/20261007_radar_source_runs.sql`, aditiva/repetível. Uma tabela, nove colunas, PK, unique por cliente/fonte, índice de suggestion_id, duas FKs RESTRICT e CHECK de status. InnoDB, utf8mb4_unicode_ci, hashes ascii_bin e TIMESTAMP(3). Sem sourceSummary/prompt/conteúdo.

Requer também as migrations aprovadas de `radar_suggestions` e `brand_brain_ai_runs`. Nenhuma migration é aplicada no startup desta integração nem foi aplicada em produção. Reversão segura: voltar ao código anterior e manter a tabela/telemetria, sem excluir histórico.

Sugestão preserva campos editoriais, fontes, modelo, versão e hash. `brandBrainVersion` é a última versão registrada pelo fluxo oficial legado; esse fluxo atualiza memória e versão em operações separadas. O hash do conteúdo efetivamente enviado é a referência precisa, inclusive em uma eventual janela entre essas operações; não foi alterada a arquitetura de publicação do Brand Brain.

Auditoria MCP usa tabela existente, com allowlist para a nova tool: userId/tool/oauth client/timestamp nas colunas existentes; clientId, sourceHash, resultado, suggestionId e status no JSON. Nenhum prompt, segredo, memória completa, texto da fonte ou legenda é gravado. Há sanitização também no writer, além do wrapper da tool. Telemetria AI registra modelo/tokens/duração/status/contextHash conforme Checkpoint 3.

Fontes externas ficam em dados, separados das instruções do sistema. Sem tools/autorização de ações no provider. Schema estrito e validação local rejeitam saída inválida. Testes com injection comprovam estrutura, isolamento e ausência de ações; comportamento semântico real do modelo ainda depende de avaliação controlada.

## Executor

Não há crawler ou executor de Radar novo. A integração permite a entrega de descobertas via MCP. Workers existentes de publicação Meta, arquivamento de cards e faturas recorrentes são específicos de seus domínios e foram preservados; não são um scheduler editorial de buscas e não foram reaproveitados artificialmente.

## Validação

- Específicos MCP/Radar: **12/12**, com provider/transporte mockados.
- Suíte principal: **503/503**; 491 anteriores preservados + 12 novos.
- Radar sazonal: **19/19**.
- MariaDB temporário **10.11.19**, socket local, sem credenciais de produção: **6/6** novos; **10/10** Radar Suggestions; **3/3** Brand Brain AI.
- Typecheck e build aprovados. Aviso conhecido do Vite sobre tamanho do bundle continua.
- SDK MCP real em memória e API Fastify reais nos testes: tool → MariaDB → listagem Dashboard → detalhe → aceitar/descartar, sem segunda chamada de IA, card ou publicação.
- Nenhuma chamada real à OpenAI, aplicação de migration em produção, push, merge ou deploy.

## Teste real futuro — somente após autorização separada

1. Em ambiente de teste revisado, preparar as três migrations e **um cliente** com memória publicada e locale confirmados. Não usar a chave em frontend/logs.
2. Configurar modelo, flag e chave no servidor; registrar contagens iniciais de `brand_brain_ai_runs` e `radar_source_runs` desse cliente.
3. Fazer novo consentimento OAuth explícito para `planning:read radar:suggest`, sem conceder `pauta:create` para esse teste.
4. Submeter **uma fonte específica** à tool, **uma única vez**. Não acionar analisar/gerar/refinar separadamente. Orçamento: **no máximo uma chamada real de IA**; interromper se houver falha, sem tentar outra fonte.
5. Consultar duração, modelo e tokens reais na telemetria; verificar diferença de no máximo um run. Revisar idioma, fidelidade à marca, pilar, gancho, utilidade editorial e status. `shouldCreate:false` é resultado válido.
6. Se houver pendência, conferir o widget e Ler mais. A decisão humana pode adicionar/descartar; isso não chama IA. Não enviar ao cliente, criar card, agendar ou publicar.
7. Registrar a avaliação e desabilitar a flag ao terminar. Não foi executado este procedimento nesta entrega.

## Arquivos criados

- `v2/apps/api/src/modules/mcp/mcp.radar.repository.ts`
- `v2/apps/api/src/modules/mcp/mcp.radar.service.ts`
- `v2/apps/api/src/modules/mcp/mcp.radar.test.ts`
- `v2/apps/api/src/modules/mcp/mcp.radar.mysql.test.ts`
- `v2/database/migrations/20261007_radar_source_runs.sql`
- Este documento.

## Arquivos alterados

- `v2/apps/api/package.json`
- `v2/apps/api/src/modules/mcp/mcp.security.ts`
- `v2/apps/api/src/modules/mcp/mcp.oauth.routes.ts`
- `v2/apps/api/src/modules/mcp/mcp.repository.ts`
- `v2/apps/api/src/modules/mcp/mcp.routes.ts`
- `v2/apps/api/src/modules/mcp/mcp.server.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.context.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.repository.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.schemas.ts`
- `v2/apps/api/src/modules/brand-brain-ai/brand-brain-ai.service.ts`
- `v2/apps/api/src/modules/radar-suggestions/radar-suggestions.service.ts`
