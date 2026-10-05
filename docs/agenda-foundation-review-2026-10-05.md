# Agenda — revisão da fundação funcional

Branch: `codex/agenda-foundation`, baseada em `2647e1ca` (main com Briefs aprovado). Apenas trabalho local; sem push, merge, deploy ou acesso de escrita à produção.

## Comportamento

- Mês/ano navegam com âncora no primeiro dia, incluindo bissextos e virada do ano.
- Contexto e timezone vêm de `/api/calendar/context`; o carregamento e a criação ficam indisponíveis enquanto essa configuração não for obtida.
- Apresentação, agrupamento, contagem e consultas usam o fuso da operação.
- Séries preservam o relógio e a regra do fuso original, inclusive em horário de verão; suas ocorrências são selecionadas pelo intervalo operacional. Isso mantém a intenção das séries existentes, sem reinterpretar seu dia da semana no fuso do dispositivo.
- Série sem término aparece como “Sem data de término” e não recebe limite artificial. Expansão percorre somente os dias próximos ao intervalo solicitado.
- Todas as ocorrências são ordenadas por instante, com desempate estável por identidade. Início inclusivo, fim exclusivo.
- “+N mais” é botão acessível, recebe o dia diretamente e abre os mesmos itens da grade, sem consulta adicional nem interpretação do cabeçalho.
- Contador mensal considera apenas o mês selecionado e os filtros ativos; grade continua mostrando os 42 dias. Dia mostra todos os itens; semana e mês usam três mais a lista do dia.
- Compromissos, etiquetas e clientes carregam de forma independente, com avisos por fonte, preservação dos dados disponíveis e retry. Respostas de períodos antigos são ignoradas após navegar.
- Filtros de cliente, etiqueta e conclusão são locais.
- Cor manual mantém a etiqueta. Selecionar etiqueta sugere sua cor; eventos antigos não são recoloridos.
- Passado pendente e concluído têm labels e classes distintas. Apenas concluído recebe tachado.
- Edição completa usa o PATCH existente. Datas são digitadas no fuso operacional e convertidas para o fuso original antes de persistir. Uma mudança de início preserva a duração quando houver término. Salvar outros campos não altera data/fuso.
- Editar uma ocorrência recorrente abre o início original da série e avisa “Esta alteração será aplicada à série inteira”. Arrastar também avisa. Não foram criadas exceções por ocorrência.

## Integridade e escopo

Nenhuma alteração em rotas, schema, banco ou permissões. O wrapper frontend de PATCH agora aceita fuso explícito e término, ambos já suportados pela API. Consumidores antigos continuam compatíveis. Etiquetas permanecem pessoais com criação/exclusão existentes; edição de nome/cor da etiqueta não foi necessária para este fluxo e não recebeu novo endpoint.

O componente global AgendaOverflowViewer foi removido. Auxiliares legados utilizados pelo calendário do portal foram preservados; regras de composição do Calendário social continuam intactas.

## Validação

- 449 testes principais: 434 anteriores + 15 da Agenda (9 funções, 6 integração contando o grupo).
- 19 testes do Radar.
- Typecheck API/web e build API/web.
- Testes de mudança mensal, timezone em dispositivos distintos, DST, série aberta, fim explícito, padrões semanais/mensais, ordenação, duração, filtros, contagem, cor/etiqueta e passado/concluído.
- Interações do modal/lista do dia, ausência de nova consulta, edição com fuso original, falhas parciais e recuperação.
- Prévia local: 1024 px, agenda vertical em 390/320 px sem overflow horizontal. Modal limitado à viewport, com ação final acessível por teclado e rolagem (em 320×740, botão final em y=693 após foco).

## Revisão local

`http://127.0.0.1:4182/tests/agenda-preview.html`

A prévia tem somente dados fictícios, interceptação de API local e não participa do bundle de produção. O visual final glass/pastel continua fora desta etapa.

Evidências: `agenda-foundation-review/day-list-desktop.png` e `agenda-foundation-review/mobile-last-action-320.png`.
