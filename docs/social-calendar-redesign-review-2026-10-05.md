# Calendário social — revisão visual

Branch: `codex/social-calendar-redesign`.
Base aprovada: `codex/social-calendar-foundation` (`4a59606b0ecf724105d34a354e22233dcbf239b8`).

## Entrega

Toolbar única com navegação, Hoje, Mês/Agenda, cliente, filtros com contador ativo e Compromisso. Fuso e contagem aparecem como informações secundárias. Dia/Semana/Ano permanecem no seletor compacto de período.

Grade mensal com divisórias leves, hoje sutil e dias adjacentes apagados. Cards priorizam horário, título limitado a duas linhas e cliente. Origem e execução usam texto, símbolos e cores; publicação parcial continua distinta de publicação confirmada. Os detalhes mantêm a explicação de conclusão editorial interna.

Filtros agrupados em drawer: cliente, tipo, origem, estado editorial, execução Meta e plataforma. Os filtros adicionais atuam somente na apresentação dos itens já compostos. Ficam na URL e sobrevivem ao fluxo de abrir/retornar do card.

Lista completa do dia via +N mais, drawer de detalhe com preview, dados editoriais e execução por plataforma, legenda e Abrir card. Mobile usa agenda cronológica e filtros em bottom sheet. O CTA de compromisso ocupa a largura disponível em telas pequenas.

Estilos legados da Agenda não interferem mais nas colunas dos cards nem nos cabeçalhos da agenda. Em 1024 px, uma regra restrita à página mantém a navegação lateral compacta em vez de empilhá-la antes do conteúdo. Outras páginas não recebem essa regra.

## Preservação da fundação

Nenhuma mudança em API, banco, schema, permissões ou serviços de composição. Os arquivos `api.ts`, `socialCalendar.ts`, `metaCalendar.ts` e toda a API são idênticos à base aprovada.

Permanecem: limites e timezone da operação, navegação por mês/ano, integração Interno + Agenda + Meta, deduplicação por vínculos, identidade do cliente, separação editorial/execução, publicação por plataforma, compromissos, contagem do período, +N mais, retorno do card, avisos por falha de fonte e atualização leve. Nenhuma associação ou importação de dados foi realizada.

## Validação

- Suíte principal: 420 testes aprovados, zero falhas ou testes ignorados.
- Radar/dashboard sazonal: 19 testes aprovados, zero falhas ou testes ignorados.
- Total: 439 testes aprovados.
- Typecheck da API e frontend: aprovado.
- Build da API e frontend: aprovado. Permanece o aviso de tamanho dos bundles do frontend; não bloqueia o build.
- Testes novos: filtros da apresentação sem mutação, preservação dos filtros ao abrir/retornar do card, alternância Mês/Agenda sem refazer a composição ou mudar as contagens.
- Testes existentes da fundação continuam passando: navegação, fontes, publicação parcial, compromissos, ordenação, +N, timezone, contagens, falha parcial e permissões.
- Validação no navegador em 1440, 1024, 768, 390 e 320 px: largura do documento igual à viewport, sem overflow horizontal. Grade no desktop, agenda nas larguras de até 820 px.
- Verificados visualmente: título longo, publicação parcial IG/FB, compromisso, lista do dia, detalhe e rolagem mobile, filtros, estado vazio e Mês/Agenda.

As prévias usam as fixtures locais existentes, com respostas simuladas no navegador. Não houve acesso nem alteração em produção.

## Prévia para revisão

URL local: http://127.0.0.1:4182/tests/social-calendar-preview.html?shell=1

Capturas locais: `/Users/liegipaschoalini/Desktop/project-post-ace/docs/social-calendar-redesign-preview/`.

Arquivos: `desktop-1440.png`, `desktop-1024.png`, `tablet-768.png`, `mobile-390.png`, `mobile-320.png`, `agenda-desktop.png`, `lista-do-dia.png`, `detalhe-plataformas.png`, `detalhe-mobile.png`, `filtros-desktop.png`, `filtros-mobile.png` e `estado-vazio.png`.

Sem push, merge ou deploy. Main e a branch da fundação permanecem inalterados. Aguardando revisão visual.

## Refinamentos após a primeira revisão visual

- Em até 1100 px, o cabeçalho do período ocupa sua própria linha; o mês não encolhe, e seus controles podem quebrar de linha sem comprimir o título.
- A segunda linha agrupa Mês/Agenda, cliente quando visível, Filtros e Compromisso. O CTA acompanha os controles em vez de ir para a extremidade direita. Em até 480 px, continua em largura total.
- A contagem mantém o valor calculado e simplifica sua apresentação para “6 itens” nos breakpoints menores. Em 768 e 1024 px, o badge mede aproximadamente 50 px.
- A toolbar mostra “Horários · São Paulo”. O identificador IANA permanece em tooltip, nome acessível, detalhe e cálculos. Outros fusos exibem o nome final do identificador sem underscores; isso não altera configurações nem conversões de data.
- A área de rolagem do calendário reserva `96px + env(safe-area-inset-bottom)` para a navegação inferior. O scroll padding também considera esse espaço.

Revalidação no navegador, com as mesmas fixtures locais:

| Largura | Título mensal | Overflow horizontal | Último item ao fim da rolagem |
| --- | --- | --- | --- |
| 1024 px | Uma linha | Nenhum | Grade desktop |
| 768 px | Uma linha | Nenhum | 55 px acima da barra inferior |
| 390 px | Uma linha | Nenhum | 53 px acima da barra inferior |
| 320 px | Uma linha | Nenhum | 53 px acima da barra inferior |

A verificação de espaço foi feita ao rolar a página até o fim. A safe-area retornou zero na prévia desktop; a expressão CSS inclui o valor informado pelo dispositivo. Nenhuma alegação de teste em aparelho físico.

Novas capturas em `social-calendar-redesign-preview/refinements/`: `desktop-1024.png`, `tablet-768.png`, `mobile-390.png`, `mobile-320.png`, `agenda-end-768.png`, `agenda-end-390.png` e `agenda-end-320.png`.

Suítes reexecutadas: 420 + 19 testes aprovados. Typecheck e build reexecutados e aprovados. Mantido somente o aviso de tamanho de bundle. Nenhuma mudança funcional, API, banco ou permissões. Sem push, merge ou deploy.
