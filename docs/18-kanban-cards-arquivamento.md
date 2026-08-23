# Kanban V2: Cards e Arquivamento

## Direcao geral

O Kanban da V2 precisa ser o mais limpo possivel.

A Liege quer liberdade para criar as proprias colunas, sem uma coluna fixa de `Publicado`.

## Regra de arquivamento automatico

Quando o sistema identificar que chegou:

- a data
- e o horario

definidos no card, esse card deve sair do fluxo principal e ir automaticamente para `Arquivados`.

## Consequencia pratica

Isso significa:

- nao precisa existir uma coluna fixa `Publicado`
- o quadro principal fica mais limpo
- as colunas permanecem focadas no fluxo de trabalho real
- o historico de publicacoes continua preservado na aba `Arquivados`

## Papel da aba Arquivados

A aba `Arquivados` passa a ser o destino natural de cards que:

- ja foram publicados
- ja cumpriram sua data/hora
- sairam do fluxo ativo

## Regra de colunas

No Kanban principal:

- nao impor colunas padrao desnecessarias
- a Liege cria as colunas conforme a operacao de cada cliente
- o sistema so cria coluna automaticamente em fluxos especificos, como aprovacao, quando essa regra existir

## Cards com tamanho real da peca

Os cards precisam respeitar o formato real da arte.

Nao devem parecer miniaturas padronizadas e pequenas demais.

A referencia e:

- story/reels vertical: proporcao real tipo `1080 x 1920`
- post quadrado: proporcao quadrada real
- formatos horizontais: proporcao horizontal real
- pecas menores, como assinatura digital, devem aparecer menores sem distorcer

## Comportamento elastico

O card deve se adaptar ao formato da peca:

- se for story ou reels, fica alto
- se for quadrado, fica quadrado
- se for horizontal, fica mais baixo e largo
- se for uma peca compacta, continua pequena e legivel

O objetivo e bater o olho e entender a arte como ela realmente e.

## Bordas da arte

Os cantos arredondados fortes nao sao desejados na midia do card.

Diretriz:

- evitar arredondamento que corte a arte
- usar borda minima ou quase reta na area da midia
- se houver arredondamento, ele deve ser muito discreto

Os paineis do sistema podem manter suavidade, mas a arte precisa ser preservada.

## Resultado visual esperado

O quadro deve transmitir:

- limpeza
- fidelidade ao formato da peca
- leitura rapida
- menos enfeite desnecessario
- mais destaque ao que esta sendo entregue

## Impacto no desenho da V2

Esse ajuste aproxima a V2 do uso real da Liege:

- cards maiores quando a arte pede
- cards menores quando a peca pede
- sem coluna publicado poluindo o fluxo
- arquivamento automatico por agendamento/publicacao
