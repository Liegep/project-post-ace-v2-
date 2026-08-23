# Fluxo de Aprovacao, Links Temporarios e Agendamento

## Visao geral

O sistema precisa suportar dois fluxos principais de aprovacao:

- aprovacao com cliente logado
- aprovacao por link temporario, sem login

Em ambos os casos, o `card` e o objeto central do sistema. O card representa o post, concentra o conteudo, comentarios, status e agendamento.

## Fluxo 1: cliente logado

Na area admin, a Liege pode usar a acao `Enviar para o cliente`.

Quando isso acontece:

- o card aparece na area do cliente
- o cliente abre o card
- visualiza a peca
- le legenda ou texto
- comenta se quiser
- aprova ou pede alteracao

Se o cliente aprovar:

- o sistema move o card para a coluna de aprovados do Kanban daquele cliente
- se essa coluna nao existir, o sistema cria automaticamente
- a atividade fica registrada no historico
- o card continua com seus metadados de data e hora

## Fluxo 2: link temporario sem login

Cada card pode gerar um link temporario de aprovacao.

Regras desse link:

- validade de 7 dias
- acesso direto ao post especifico
- sem necessidade de login
- cliente pode visualizar
- cliente pode comentar
- cliente pode aprovar

Se houver aprovacao por esse link:

- o sistema atualiza o card original
- o card vai para a coluna de aprovados do cliente
- se a coluna nao existir, ela e criada
- a aprovacao entra no historico

## Agendamento

O agendamento deve existir como parte nativa do card, nao como uma tela separada obrigatoria.

Ou seja, dentro do proprio card ou de sua visualizacao detalhada, a Liege consegue definir:

- data
- horario
- tipo de publicacao, se necessario no futuro

Esse agendamento alimenta automaticamente:

- o calendario do cliente
- o calendario do workspace daquele cliente
- o calendario geral do dashboard com posts de todos os clientes

## Fluxo no widget de feedbacks

No widget de `Feedbacks dos clientes`, cada item pode ter pelo menos estas acoes:

- `Visualizar`
- `Agendar`

### Visualizar

Ao abrir `Visualizar`, a Liege ve:

- o post
- o texto
- opcao de copiar o texto
- comentarios feitos pelo cliente
- status atual

### Agendar

Ao clicar em `Agendar`, a Liege define:

- data
- horario

Depois disso:

- o card passa a aparecer no calendario do cliente
- o card passa a aparecer no calendario geral
- o dashboard mostra esse post na data correspondente

## Regras de produto

### Card como entidade principal

O card nao e apenas um bloco visual do Kanban. Ele e o proprio post.

Por isso, cada card deve poder concentrar:

- midia
- legenda ou texto
- comentarios
- status
- data
- horario
- cliente/conta
- link temporario
- historico de aprovacao

### Automacao de coluna

Quando uma aprovacao acontecer e a coluna de destino nao existir:

- o sistema cria a coluna automaticamente
- o nome da coluna deve seguir o status correspondente
- o card e movido para ela sem exigir acao manual

### Datas

As datas do card precisam ser coerentes em todos os lugares:

- board do cliente
- board admin
- dashboard geral
- widgets
- historico

## Impacto no desenho da V2

Esse fluxo reforca que a V2 precisa ser pensada como um sistema orientado a cards com:

- aprovacao embutida
- agendamento embutido
- historico embutido
- exibicao contextual por permissao
- acesso por login ou por link temporario
