# Calendário social — fundação funcional para revisão

Branch: `codex/social-calendar-foundation`.
Base: `eb5d2a1eb6dfed9f59349c5db7bb345c417e7d7a`.

Implementação local, anterior ao redesign final. Nenhum push, merge, deploy, migração ou acesso ao banco de produção foi realizado nesta etapa.

## Composição e identidade

A página compõe três fontes independentes: eventos de `card_calendar_events`, compromissos da Agenda e publicações Meta. O componente foi extraído de `App.tsx`, mantendo a estrutura visual existente.

A composição Meta reaproveita `composeClientMetaCalendarEvents`, agora com opções específicas para o calendário global. Primeiro separa os dados por `clientAccountId`; associa interno e Meta pelo `cardId` e minuto do agendamento, mantendo destinos distintos. Identidades de eventos sem card não colidem com identidades de publicações Meta. Título e dia nunca são chaves de deduplicação. Publicações canceladas são visíveis nesta página; o comportamento padrão do calendário do cliente continua preservado.

O estado editorial vem do evento interno. `published` interno aparece como **Concluído internamente**, acompanhado da explicação de que isso não confirma publicação nas redes. A execução Meta é calculada dos registros por plataforma. Instagram publicado + Facebook falhou resulta em **Publicação parcial**. A confirmação completa identifica explicitamente as plataformas confirmadas. Destinos distintos aparecem como itens distintos, identificados pelo nome do destino.

Na falta de permissão ou na falha da fonte Meta, a execução aparece como **Não disponível**, sem inferir ausência de agendamento ou publicação.

## Datas, grade e contagens

A navegação altera mês/ano a partir do primeiro dia, sem transportar o dia 31 para fevereiro. As visões de dia, semana, mês e ano mantêm o contexto na URL.

O novo endpoint somente de leitura `GET /api/calendar/context` fornece `APP_TIMEZONE` e o dia atual da operação. Substituiu-se o “hoje” fixo do serviço de calendário. Os eventos internos recebem o fuso original e a identidade do cliente na resposta. Fusos ausentes ou inválidos usam o fuso configurado da operação.

A grade mensal mantém seis semanas. As consultas internas usam uma pequena margem de datas para abranger diferenças entre o fuso de origem e o da operação; o frontend filtra os instantes normalizados antes de renderizar. O total mensal conta exclusivamente o mês selecionado, após composição e filtros. Dias dos meses vizinhos permanecem visíveis na grade, mas não entram nesse total. A lista mobile usa o período selecionado, com posts e compromissos intercalados pelo mesmo instante cronológico.

Para Agenda, consultas ISO usam intervalo **[início, fim)**. Consultas com datas sem horário continuam aceitando a data final inclusiva, convertida para a meia-noite seguinte no fuso da operação. A busca SQL mantém a margem já existente; eventos não recorrentes são filtrados novamente após a conversão para UTC. As sementes de recorrência são preservadas para expansão no frontend. Recorrências mantêm o horário local no fuso original, inclusive após horário de verão, sem o antigo limite de expansão de um ano.

Novos compromissos criados nesta página enviam explicitamente o fuso da operação; os demais consumidores da API preservam o comportamento anterior quando não fornecem esse campo. O detalhe exibe horário no fuso da operação e o fuso original quando diferente.

A página não utiliza prazo editorial como data de publicação. Cards sem um agendamento confiável não são convertidos em eventos. A futura área **Programação pendente** não foi implementada nem ganhou uma nova API.

## Interações e resiliência

Compromissos são efetivamente renderizados na grade desktop. O limite de três itens por célula é apenas visual: **+N mais** abre a lista completa do dia, e cada item abre seu detalhe.

**Abrir card** utiliza a rota e o editor existentes. Mês, visualização, cliente e conteúdo ficam na URL; a posição da página é restaurada ao voltar pelo histórico do navegador. O detalhe tem fechamento por Escape, contenção de foco e isolamento do conteúdo de fundo.

Uma fonte com erro não elimina as fontes que responderam. Avisos identificam Calendário interno, Agenda, Meta, Clientes ou Etiquetas, com ação para tentar novamente. A paginação Meta percorre todas as páginas do intervalo, em lotes de até 200; não usa apenas a primeira página.

Atualização leve: a cada dois minutos enquanto a página está visível, ou ao recuperar foco/visibilidade, com intervalo mínimo de um minuto entre atualizações automáticas. O mesmo período mantém os dados exibidos durante a atualização. Um detalhe Meta já aberto recebe os novos estados retornados.

## Permissões preservadas

| Perfil | Calendário interno | Agenda | Meta global |
| --- | --- | --- | --- |
| Superadmin | Todos os clientes autorizados pela API global | Inclui compromissos sem cliente | Consulta global existente |
| Admin | Clientes próprios/atribuídos conforme escopo existente | Clientes no mesmo escopo; sem ampliar acesso a compromissos sem cliente | Não consultada; aviso explícito |
| Colaborador | Clientes com vínculo existente | Clientes no mesmo escopo | Não consultada; aviso explícito |
| Cliente | Sem acesso ao Calendário social interno | Sem acesso a esta página | Sem acesso global |

O endpoint de contexto usa a mesma exigência de acesso interno. Nenhuma regra de autorização Meta foi alterada.

## API e banco

Mudanças aditivas de leitura: contexto da operação, `clientAccountId` e `scheduledTimeZone` na resposta do calendário. Correção dos limites e normalização dos fusos da Agenda. Não há novos modelos, tabelas, migrations ou alterações de dados.

Uma futura publicação precisa incluir API e frontend, pois a página usa o novo endpoint de contexto. As rotinas de inicialização da Agenda que já existiam antes desta branch não foram criadas nem executadas contra produção neste trabalho.

## Validação

- Suíte configurada da API, incluindo os novos testes web/API: **417 testes passaram**.
- Suíte de interação do Radar/widget: **19 testes passaram**.
- Total: **436 testes passaram**, sem falhas ou testes ignorados.
- Typecheck de API e web: aprovado.
- Build de API e web: aprovado. O build mantém o aviso de tamanho dos bundles, sem erro de compilação.
- Verificação de whitespace do diff: aprovada.

Cobertura específica: janeiro/fevereiro/março, bissextos, dezembro/janeiro, interno + Meta, clientes distintos, destinos distintos, publicação parcial, cancelamento, compromissos desktop, intercalação mobile, lista +N, abrir/retornar do card com filtros e posição, falhas de fontes, paginação acima de 200, fuso da operação/origem, horário de verão, recorrência antiga, limites exatos do intervalo, contagem mensal e atualização ao recuperar foco.

Prévia local com dados controlados, sem consultar ou escrever produção:
`http://127.0.0.1:4182/tests/social-calendar-preview.html?shell=1` (página completa, com banner e navegação do app).

Sem `shell=1`, a prévia isolada permite testar os demais perfis e falhas de fontes.

Parâmetros de revisão: `?failure=%2Fmeta%2Fpublications`, `?failure=%2Fagenda%2Fevents`, `?role=admin`, `?role=colaborador`, `?view=day`.

Inspeção no navegador: desktop 1440 px e 1024 px, mobile 390 px e 320 px, sem overflow horizontal; detalhe e lista do dia acessíveis. As capturas estão em `docs/social-calendar-foundation-preview` no workspace original de revisão.

Os testes de endpoints usam injeção Fastify e repositório controlado. Não representam uma validação contra o banco ou as credenciais Meta de produção. A validação em produção fica para depois da revisão e autorização de publicação.
