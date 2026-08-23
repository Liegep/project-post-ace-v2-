# Card Detalhe Admin V2

## Papel da tela

Essa tela e o centro operacional do sistema.

Ela precisa reunir, em um unico lugar:

- visualizacao do conteudo
- texto/legenda
- comentarios
- historico
- envio para cliente
- link temporario
- aprovacao
- agendamento

Ou seja: o card nao e apenas um item do quadro. Ele e o proprio post em operacao.

## Estrutura principal

### Cabecalho

- breadcrumb do quadro atual
- cliente/conta
- botao `Visualizar como cliente`
- botao `Gerar link temporario`
- botao principal `Enviar para o cliente`

## Bloco 1: previa do card

Area principal com:

- midia no formato real do post
- comportamento elastico conforme formato
  - vertical
  - quadrado
  - horizontal
- canais/plataformas
- legenda ou texto
- botao para copiar texto
- tags

Essa area precisa ser o foco visual da tela.

## Bloco 2: coluna operacional

### Status do card

Exibe:

- status atual
- quando foi enviado
- historico rapido do status

### Acoes rapidas

Deve reunir:

- `Aprovar internamente`
- `Enviar para o cliente`
- `Gerar link de 7 dias`
- `Copiar texto`

### Agendamento

Agendamento nativo no proprio card com:

- data
- horario
- confirmacao da acao `Agendar post`

Regra importante:

- o agendamento precisa refletir no calendario do cliente
- no calendario da conta
- no dashboard geral

### Destino apos aprovacao

Mensagem clara de automacao:

- se a coluna `Aprovados pelo cliente` nao existir, ela sera criada automaticamente
- o card sera movido para essa coluna sem acao manual

### Calendarios impactados

Resumo visual de onde esse card aparece quando e agendado:

- calendario do cliente
- calendario da conta
- dashboard geral

## Bloco 3: conversa e rastreio

Abas:

- `Comentarios`
- `Historico`
- `Links enviados`

### Comentarios

Pode reunir:

- comentario do cliente
- comentario interno
- resposta
- campo para nova mensagem

### Historico

Timeline com eventos do card, por exemplo:

- criado
- editado
- enviado ao cliente
- comentario recebido
- aprovado
- agendado

### Links enviados

Cada card pode ter links temporarios de aprovacao.

Mostrar:

- status do link
- data de envio
- expiracao
- abrir link
- desativar link

## Regras de negocio reforcadas por essa tela

### Link temporario

- validade de 7 dias
- sem login
- permite ver o post
- permite comentar
- permite aprovar

### Aprovacao

Se o cliente aprovar:

- o card atualiza status
- vai para a coluna correta
- cria a coluna se nao existir
- registra atividade

### Card como fonte unica

Tudo parte do mesmo card:

- widgets
- calendario
- kanban
- links
- aprovacao
- status

## Direcao visual

- glassmorphism leve
- foco no conteudo
- paineis claros
- hierarquia muito bem definida
- experiencia premium, mas objetiva
- leitura confortavel

## Objetivo da V2

Essa tela deve reduzir a dispersao do sistema atual.

Em vez de espalhar a operacao em varios pontos, a V2 concentra o trabalho real no detalhe do card, e o restante da plataforma passa a refletir esse estado central.
