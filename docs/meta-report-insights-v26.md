# Relatórios Meta v26: seguidores e disponibilidade

Implementação na branch `codex/meta-report-insights-v26`, a partir de `origin/main` (`2508bffc`). Não houve merge nem publicação. O checkout original e seus arquivos modificados foram preservados.

## Resultado e limite da validação

As consultas usam Graph API `v26.0`. Os testes usam respostas simuladas e verificam o fluxo completo do serviço e do endpoint, além dos parsers. **Não houve consulta autenticada às contas reais:** a configuração local não contém `META_APP_ID`, `META_APP_SECRET` e `META_TOKEN_ENCRYPTION_KEY` suficientes. Portanto, nenhuma métrica nova pode ser declarada disponível, inválida ou deprecated em uma conta real a partir destes testes. O endpoint abaixo permite confirmar a disponibilidade após publicar a alteração no ambiente conectado.

As páginas oficiais de referência retornaram 429/erro de acesso nesta sessão. O SDK oficial confirma `follow_type`, `total_value`, `values` e os campos `followers_count`/`fan_count`, mas não comprova a disponibilidade de cada métrica de Page Insights em v26. As métricas candidatas são consultadas isoladamente e aceitas somente quando a API retorna números válidos.

Fontes primárias consultadas:

- [SDK oficial Meta: estrutura de insights e breakdowns](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/instagraminsightsresult.py)
- [SDK oficial Meta: campo Instagram followers_count](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/ig-user.js)
- [SDK oficial Meta: campos de Page](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/page.js)
- [Referência Instagram Insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights/) — acesso indisponível nesta sessão.
- [Referência Page Insights v26](https://developers.facebook.com/docs/graph-api/reference/v26.0/insights/) — acesso indisponível nesta sessão.

## Instagram

| Valor no contrato | Origem | Tratamento |
| --- | --- | --- |
| reach | reach | total do período |
| views | views | total do período; salva no campo legado impressions do relatório |
| followers | followers_count | snapshot atual da conta |
| profileViews | profile_views | consulta individual já existente; pode ser recusada pela API |
| interactions | total_interactions | total do período |
| linkClicks | profile_links_taps | mantém origem existente; não equivale necessariamente a cliques em URLs externas |
| accountsEngaged | accounts_engaged | total do período |
| followersGained / followersLost | follows_and_unfollows | consulta exclusiva com period=day, metric_type=total_value, breakdown=follow_type |
| followersNet | ganhos − perdas | null quando qualquer direção está ausente |

O parser trata `data[].total_value.breakdowns[].dimension_keys/results` e `data[].values[].value`, além de objetos diários com `follows`/`unfollows`. Reconhece follows/unfollows e FOLLOWER/NON_FOLLOWER somente no contexto da métrica de crescimento. Não transforma um total escalar sem breakdown em ganhos ou perdas. Não soma aggregate e daily ao mesmo tempo. Campos ausentes, categorias duplicadas, dimensões inesperadas, números inválidos e séries parcialmente ausentes não geram zeros fictícios.

## Facebook

| Valor no contrato | Origem | Tratamento |
| --- | --- | --- |
| reach | page_total_media_view_unique | mantém comportamento existente; metadado explicita soma de espectadores únicos diários, sem deduplicação mensal |
| views | page_media_view | soma diária; salva em impressions no relatório por compatibilidade |
| engagement / interactions | page_post_engagements | soma diária; alias adicional preserva contrato anterior |
| pageViews | page_views_total | soma diária |
| followers | followers_count | campo independente; não depende da disponibilidade de fan_count |
| followers (fallback) | page_follows | último snapshot dos últimos três dias, independente de períodos históricos do relatório; nunca soma snapshots |
| followersGained | page_daily_follows_unique | soma diária se a API aceitar e retornar valores |
| followersLost | page_daily_unfollows_unique | soma diária se a API aceitar e retornar valores |
| followersNet | ganhos − perdas | null quando qualquer direção está ausente |
| fans | fan_count | curtidas preservadas como campo separado; nunca substituem seguidores |
| impressions | null | preserva decisão anterior do backend sobre page_impressions; UI usa views |
| linkClicks | null | sem equivalente de cliques em links no período comprovado nesta sessão; origem indica not_queried, não apresenta uma recusa da API fictícia |

Não se introduziram métricas antigas como page_fans/page_fan_adds/page_impressions para tentar preencher os campos. Métricas de posts também são consultadas individualmente: a recusa de post_clicks não remove post_media_view. Os números lifetime dos destaques não são somados para inventar cliques, alcance ou interações do período inteiro. O ranking existente continua limitado às primeiras 100 publicações e informa essa limitação.

Uma métrica inválida gera warning seguro, `null` e status `invalid_metric`. Código 100 de parâmetro/data inválido continua `api_error`, evitando confundir erros gerais com depreciação. Os demais status são `available`, `empty`, `permission_error` e `api_error`. `invalid_metric` sozinho não comprova a causa específica de depreciação.

A autorização OAuth passou a solicitar `read_insights`. Conexões anteriores podem precisar de nova autorização para conceder essa permissão; isso depende das permissões aprovadas no app Meta.

## Diagnóstico temporário

`GET /api/meta/insights/debug?clientAccountId=CLIENT_ID&since=2026-09-01&until=2026-09-30&destinationId=DESTINATION_ID`

`destinationId` é opcional. Usa o destino padrão ou a associação legada quando não informado. Valida existência de cliente/destino. Retorna 401 sem sessão e 403 para qualquer papel diferente de `super_admin`, antes de ler dados ou chamar a Meta.

Retorno: versão, período e lista de métricas realmente consultadas. Cada item contém plataforma, nome da métrica, status, valor numérico seguro, agregação, código Meta numérico, follows/unfollows numéricos quando há breakdown válido e estrutura resumida (`entries`, `dailyValues`, `totalValue`, `breakdowns`). Não retorna payload bruto, mensagens de erro, tokens, segredos, provas de segredo, URLs, paginação, nomes das contas ou conteúdo de posts.

Estruturas descritas aqui são as cobertas pelos testes e pelo SDK; **a estrutura real de uma conta conectada ainda não foi capturada**. O diagnóstico foi feito para registrar seu resumo sem expor o conteúdo bruto.

## Relatórios e compatibilidade

Ganhos, perdas e saldo foram integrados à grade atual e ao PDF em português, inglês, espanhol, italiano e sueco. Ganhos/saldos positivos usam `+`; perdas e saldos negativos usam `−` na tela e `-` no PDF (fonte padrão). Ausência fica indisponível; ausência no período, métrica recusada e falha de consulta têm mensagens distintas. Os metadados ficam persistidos junto das métricas no JSON existente, sem migração de banco.

Os campos novos são opcionais para aceitar relatórios históricos. O backend recalcula o saldo ao salvar ganhos/perdas; a edição manual também o recalcula e remove o status importado dos campos editados. Não modifica os relatórios históricos salvos. Contas apenas de Instagram ou Facebook continuam usando o fluxo existente.

## Arquivos alterados

- `v2/apps/api/src/modules/meta/meta-insight-metrics.ts`: parsers, classificação e serialização segura.
- `v2/apps/api/src/modules/meta/meta-insight-metrics.test.ts`: parsers, serviço, erros, fallback e segurança do endpoint.
- `v2/apps/api/src/modules/meta/meta.service.ts`: consultas independentes, crescimento, origens, permissão e fallback.
- `v2/apps/api/src/modules/meta/meta.routes.ts`: endpoint de diagnóstico.
- `v2/apps/api/src/modules/reports/reports.schemas.ts`: validação/persistência dos campos opcionais e saldo.
- `v2/apps/api/package.json`: inclusão dos testes novos na suíte existente.
- `v2/apps/web/src/api.ts`: tipos compatíveis dos contratos.
- `v2/apps/web/src/ReportsWorkspace.tsx`: importação, grade, edição e PDF.
- `v2/apps/web/src/reportMetaDestinations.ts`: estados iniciais/reset de seguidores.
- `v2/apps/web/src/reportMetricPresentation.ts`: traduções, sinais e mensagens semânticas.
- `v2/apps/web/tests/reportMetricPresentation.test.ts`: apresentação, sinais, null e traduções.
- `docs/meta-report-insights-v26.md`: esta entrega e suas limitações.

## Verificação

- Suíte completa: 212 testes, incluindo 43 novos casos de métricas/apresentação e os testes existentes.
- Checagem TypeScript da API e web.
- Build da API e web.
- Verificação do relatório React real em desktop e mobile, com dados simulados: rótulos italianos, +12, −3, +9, estados de ausência e página sem overflow horizontal.
- Download real do PDF pelo navegador e inspeção visual da página renderizada: todos os campos visíveis, sem sobreposição; mensagens longas quebram linha dentro da coluna.
- Revisão de whitespace/diff.

Pendente para concluir a investigação operacional: executar o diagnóstico no ambiente com conexão Meta e anotar, por conta e período, quais métricas estão available/empty/invalid_metric/permission_error/api_error. Não se deve anunciar resultados reais antes desse passo.
