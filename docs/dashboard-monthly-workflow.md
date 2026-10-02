# Dashboard: fluxo operacional do mês

Branch: `codex/dashboard-monthly-workflow`. Base: `be62d6efa95b5cbbb5c56c2f84cfad54ca791ab8` (origin/main verificado no início). Sem merge no main, sem deploy e sem alterações em dados de produção.

## Indicadores

**Clientes ativos | Posts do mês | Pendentes | Agendados | Publicados**

Clientes ativos mantém a contagem de clientes acessíveis usada anteriormente. Os outros indicadores contam cards de post, uma vez por ID, em todos os kanbans acessíveis ao usuário.

## Data operacional escolhida

Cada card recebe uma única data canônica e uma origem, por esta ordem:

| Prioridade | Origem | Data usada |
| --- | --- | --- |
| 1 | Publicação interna | `kanban_cards.published_at` |
| 2 | Agendamento interno | `kanban_cards.scheduled_at` |
| 3 | Meta com publicação concluída | `scheduled_at` do registro `published`, usando o primeiro horário entre os canais; `published_at` é apenas fallback para um registro sem data programada válida |
| 4 | Meta com agendamento ativo | Primeiro `scheduled_at` entre registros `scheduled` ou `publishing` |
| 5 | Prazo/data planejada | `kanban_cards.deadline_at` |
| 6 | Calendário vinculado ao card | `card_calendar_events.publish_date` + `publish_time`, quando houver |
| 7 | Último plano Meta sem agendamento ativo | Último `scheduled_at` entre registros `failed` ou `cancelled`, somente sem fonte melhor |

As etapas 1–2 são as datas internas do card; 3–4 são a programação Meta; 5 é o prazo; 6–7 são os demais posicionamentos operacionais existentes. `classifyDashboardPost` devolve `operationalDate` e `source` para verificar a decisão de cada card. O endpoint público retorna somente os agregados.

A programação Meta é armazenada em UTC e identifica o post planejado: uma execução atrasada de um canal continua ligada ao mês daquele plano. Assim, um post programado para 31/10 e executado em 01/11 permanece no plano de outubro, com estado publicado, quando a Meta é a fonte escolhida. Uma data interna válida continua tendo precedência.

Datas inválidas são ignoradas. Cards sem nenhuma data operacional não entram na contagem; não se inventa um mês pela criação. `created_at` não é lido nem usado pela rotina de estatísticas.

## Fuso horário e período

O frontend envia o fuso IANA do navegador em `/api/dashboard/overview?timeZone=...`. O backend calcula o mês atual nesse fuso, inclusive na virada do mês. Sem um fuso válido, usa o fallback já existente na aplicação: `America/Sao_Paulo`.

- Horários internos e eventos do calendário respeitam o `scheduled_timezone` salvo; se necessário, usam o fallback existente.
- Publicações históricas importadas sem fuso salvo mantêm a semântica UTC utilizada pelo importador.
- Horários Meta são convertidos de UTC para o fuso da consulta.
- Prazo e calendário sem horário são dias planejados, preservando o dia informado, sem convertê-lo indevidamente a partir de meia-noite UTC.

Também são calculados os totais do mês anterior com as mesmas regras. A interface usa os subtextos solicitados e não exibe comparações. O corte antigo em 01/10/2026 foi removido.

## Classificação e deduplicação

A prioridade de estado é independente da origem da data:

1. **Publicado:** publicação interna válida ou registro Meta `published` com data operacional válida.
2. **Agendado:** agendamento interno válido ou registro Meta `scheduled`/`publishing`, sem publicação concluída.
3. **Pendente:** post datado no mês sem publicação nem agendamento válido.

Facebook + Instagram contam **um post**. Agendamento interno + Meta também contam **um post**. Um canal publicado prevalece sobre qualquer agendamento do mesmo card. Status de aprovação, revisão ou alteração solicitada não substituem um agendamento.

As leituras de cards e publicações são separadas para evitar multiplicação por canal. Publicações só podem classificar um card do mesmo cliente. Um conjunto de IDs garante a contagem única, e cada card incrementa apenas um estado:

```text
postsThisMonth = pending + scheduled + published
```

## Exclusões

- Pautas (`is_brief_approval`) e tipos explícitos de pauta/brief não contam.
- Arquivados sem publicação interna ou evidência Meta ativa/concluída não contam.
- Publicados do mês preservados pelo arquivamento automático continuam contando como trabalho concluído.
- Registros históricos fora do mês ou sem data operacional não contam.
- Eventos de calendário importados sem vínculo com card e publicações Meta sem card válido não entram no agregado.
- `legacy_id` sozinho não elimina um post genuinamente retomado/planejado para o mês.

Uma publicação Meta cancelada ou falha não é um agendamento válido. Sua data antiga é somente o último fallback de planejamento, e um card não arquivado nessa situação pode ficar pendente.

## API, leitura e frontend

`statistics` retorna `timeZone`, `month`, `postsThisMonth`, `postsPreviousMonth`, `pending`, `scheduled`, `published` e `publishedPreviousMonth`. Os campos antigos de aprovação, vencimento e início da contagem foram removidos após substituir o consumidor no frontend. API e web devem ser disponibilizados juntos. Os demais widgets do overview foram preservados.

A consulta limita os candidatos às datas operacionais próximas do mês atual/anterior, com dois dias extras em cada limite para acomodar fusos. Essa janela larga só reduz a transferência de registros; a inclusão exata no mês é decidida depois da conversão. Todos os registros Meta desses candidatos continuam disponíveis para decidir a prioridade, inclusive publicações anteriores que prevalecem sobre agendamentos.

No desktop, os cinco cards ficam em linha. Em larguras intermediárias, o conjunto passa para baixo da saudação. No celular, são duas colunas e Publicados ocupa a última linha; em telas muito estreitas, uma coluna. As cores, tipografia e ícones existentes são reutilizados.

## Validação

- **278 testes aprovados**, incluindo **35 novos**: 33 backend e 2 frontend.
- Typecheck e build de API e web aprovados.
- Interface React real com dados simulados conferida em **1440 × 900** e **375 × 812**, sem overflow horizontal. Cinco cards em linha no desktop; 2 + 2 + 1 no celular.
- Cenários pedidos cobertos: pendente do mês, criação em outro mês, planejamento futuro, agendamento interno/Meta, múltiplos canais, combinação interno+Meta, publicação interna/Meta, publicado prevalecendo, pautas/briefs, histórico arquivado, soma dos estados e cinco indicadores.
- Cobertura adicional: fuso na virada do mês, datas sem horário, calendário como fallback, atraso de execução Meta, importação UTC, acesso por cliente, datas inválidas, falhas/cancelamentos e deduplicação independente da ordem dos canais.
- Nenhuma publicação, agendamento ou alteração de card foi executada durante os testes. Fixtures e servidor da prévia local removidos ao encerrar.

## Arquivos alterados

- `v2/apps/api/src/modules/clients/dashboard-statistics.ts`: seleção da data, estado, deduplicação e leitura com escopo.
- `v2/apps/api/src/modules/clients/dashboard-statistics.test.ts`: testes de regras e endpoint.
- `v2/apps/api/src/modules/clients/clients.routes.ts`: novo agregado no overview.
- `v2/apps/api/package.json`: inclusão dos testes.
- `v2/apps/web/src/DashboardMetrics.tsx`: cinco indicadores.
- `v2/apps/web/tests/dashboardMetrics.test.tsx`: apresentação e placeholders.
- `v2/apps/web/src/App.tsx`: uso dos novos indicadores.
- `v2/apps/web/src/api.ts`: contrato atualizado e fuso enviado ao backend.
- `v2/apps/web/src/styles.css`: layout responsivo.
- `docs/dashboard-monthly-workflow.md`: documentação da entrega.
