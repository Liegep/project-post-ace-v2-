# Textos V2

## Objetivo

Criar uma area de `Textos` na area admin para clientes que aprovam ou acompanham conteudos longos, como:

- artigos de blog
- pautas longas
- roteiros
- textos institucionais
- newsletters

A ideia nao e parecer um editor tecnico. Deve parecer uma experiencia editorial premium, com leitura muito confortavel e visual refinado.

## Estrutura da tela

### Cabecalho do workspace

- voltar para o cliente/conta
- nome da conta atual
- seletor de idioma da conta
- botao `Visualizar como cliente`
- botao `Nova pauta`
- botao principal `Novo texto`

### Abas da area admin

- Quadro
- Arquivados
- Textos
- Calendario
- Atividades
- Brand Brain

## Layout principal

### Coluna principal

Area grande de leitura e edicao com:

- breadcrumb do texto
- titulo
- chips de contexto
  - tipo do conteudo
  - status
  - idioma
  - tempo de leitura
- capa opcional
- texto formatado de forma bonita
- titulos
- paragrafos respirados
- citacoes
- listas
- destaques
- anotacoes de revisao da equipe

Essa coluna precisa funcionar como um `preview editorial`, para que o cliente leia com prazer e sem poluicao visual.

### Sidebar lateral

Blocos operacionais com:

- `Aprovacao do cliente`
- `Permissoes deste cliente`
- `Versoes e traducoes`
- `Resumo rapido`

## Regras funcionais

### Aprovacao

O texto pode passar por estados como:

- rascunho
- em revisao
- enviado para aprovacao
- aprovado
- agendado
- publicado

### Traducoes

Cada conta pode ter idioma principal definido no cadastro.

Idiomas prioritarios ja mapeados:

- portugues
- ingles
- italiano
- espanhol
- sueco

O admin enxerga status por idioma, por exemplo:

- pronto
- pendente
- nao ativo

### Permissoes do cliente

A area deve ser montada de forma adaptativa, com on/off por conta, inclusive para textos:

- pode ver textos
- pode comentar
- pode editar legenda
- pode baixar PDF

## Experiencia do cliente

Quando o cliente acessar esse tipo de conteudo, o foco deve ser:

- leitura bonita
- entendimento rapido
- comentarios claros
- acoes simples

Se o cliente for de um modo mais simples, ele pode receber apenas:

- preview do texto
- comentarios
- aprovar
- solicitar alteracao

## Direcao visual

- glassmorphism leve
- fundo claro com degradê suave
- paineis brancos transluidos
- tipografia elegante para titulos
- tipografia muito legivel para corpo de texto
- destaque visual no conteudo, nao nos controles

## Relacao com o restante do sistema

A area `Textos` faz parte da visao admin da conta e complementa:

- o `Quadro`, para cards e fluxo operacional
- o `Calendario`, para planejamento por data
- `Atividades`, para historico do que o cliente fez
- `Brand Brain`, para consistencia de linguagem e identidade
