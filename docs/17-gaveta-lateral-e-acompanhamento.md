# Gaveta Lateral e Acompanhamento

## Gaveta lateral do Kanban

Dentro do Kanban de cada cliente, a V2 deve manter uma gaveta lateral direita.

Ela nao e so um detalhe visual. Ela funciona como uma area de apoio rapido para o trabalho operacional daquele cliente/conta.

## Objetivo

A gaveta lateral deve:

- trazer praticidade
- concentrar atalhos uteis
- evitar trocar de tela toda hora
- dar personalidade ao produto

## Estrutura da gaveta

A gaveta lateral pode ter abas ou blocos equivalentes para:

- `Recados`
- `Rascunhos`
- `Links`
- `Rapidos`

## Conteudo de cada bloco

### Recados

Bloco simples para avisos internos daquele cliente/conta.

Exemplos:

- pendencias
- observacoes importantes
- lembretes de entrega
- orientacoes da conta

### Rascunhos

Espaco para notas soltas e anotacoes rapidas.

Pode servir para:

- ideias de copy
- mini roteiros
- anotacoes provisórias
- lembretes de ajustes

### Links

Lista de links uteis daquele cliente.

Exemplos:

- Drive
- pasta do cliente
- pasta de materiais
- documentos compartilhados
- links de aprovacao importantes

### Rapidos

Area de programas e acessos externos frequentes.

Exemplos mostrados pela Liege:

- E-mail
- Freepik
- ChatGPT
- Instagram
- Facebook
- LinkedIn
- Business Suite
- Loft
- PayPal
- Google Drive
- PromoRepublic
- Spotify
- Keyframe Audio

## Regra de contexto

Esses itens podem ser:

- globais da operacao
- ou configurados por cliente/conta

Idealmente, a V2 deve permitir que a gaveta seja util para aquele cliente especifico, e nao apenas uma lista generica.

## Posicionamento visual

A gaveta deve ficar no lado direito do Kanban.

Pode funcionar:

- recolhida
- semiaberta
- aberta

Ela deve parecer leve e charmosa, como a Liege comentou, sem pesar no quadro principal.

## Widget de acompanhamento

Dentro do Kanban de cada cliente existe tambem o widget de `Acompanhamento`.

## Funcao do acompanhamento

Esse widget permite acompanhar partes do projeto, por exemplo:

- post feito
- reels feito
- highlights feito
- copy por fazer
- design pronto
- revisao pendente

Ou seja, ele funciona como um resumo operacional de progresso daquele cliente/conta.

## Controle on/off

O acompanhamento precisa ser controlado por duas regras:

### 1. Habilitacao do recurso

No admin, a Liege pode ligar ou desligar o acompanhamento daquela conta.

Quando ligado:

- o widget passa a existir para aquela conta
- a equipe pode usar os itens de acompanhamento

Quando desligado:

- o widget some do workspace daquela conta

### 2. Visibilidade para o cliente

Separadamente, existe o `olhinho` para definir se o cliente pode ver esse acompanhamento.

Quando o olho estiver ligado:

- o widget aparece na area do cliente

Quando o olho estiver desligado:

- o widget continua podendo existir no admin
- mas nao aparece para o cliente

## Regra de produto

Sao dois controles diferentes:

- `acompanhamento ativo`
- `acompanhamento visivel para o cliente`

Isso permite usar o acompanhamento apenas internamente, quando necessario.

## Impacto no design da V2

No desenho do Kanban admin, a gaveta lateral direita deve acomodar:

- recados
- rascunhos
- links
- rapidos
- acompanhamento

Sem competir com o quadro principal.

No desenho da area do cliente, o acompanhamento so aparece se:

- estiver habilitado
- e estiver marcado como visivel para o cliente
