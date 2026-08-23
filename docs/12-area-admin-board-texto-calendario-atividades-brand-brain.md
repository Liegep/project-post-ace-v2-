# 12. Area admin da V2: board, texto, calendario, atividades e Brand Brain

Data deste documento: 20 de agosto de 2026

## Estrutura da area admin

A area admin da `v2` precisa ser o seu painel operacional real.

Ela nao e o portal do cliente.

Ela e o lugar onde voce:

- produz
- organiza
- planeja
- acompanha
- ajusta o que o cliente vai ver

## Navegacao principal da conta/cliente no admin

Para cada cliente/conta, eu manteria uma estrutura parecida com a atual:

1. `Quadro`
2. `Arquivados`
3. `Textos`
4. `Calendário`
5. `Atividades`
6. `Brand Brain`

Isso faz sentido porque cada aba representa um tipo de trabalho diferente.

## 1. Quadro

Esse continua sendo o centro operacional.

### O que ele precisa ter

- colunas tipo Trello
- cards clicaveis
- cards com midia forte
- copy/move para outro cliente
- criar pauta
- criar post
- acompanhar status
- visibilidade por coluna
- acompanhamento/tracking

### Minha recomendacao de design

- manter estrutura de colunas
- elevar acabamento visual
- reforcar leitura de status
- deixar a imagem/conteudo continuar como protagonista do card

## 2. Textos

Esse ponto e muito importante e tem potencial para ficar melhor na `v2`.

Voce descreveu bem: alguns clientes precisam basicamente ler texto bem formatado.

Entao eu nao faria isso como um card seco com texto cru.

## Recomendacao para `Textos`

Eu faria uma experiencia tipo:

- leitura bonita
- tipografia forte
- espacamento editorial
- blocos bem formatados

Mais perto de:

- Google Docs bonito
- Notion mais limpo
- preview editorial de artigo/blog

## Modos de exibicao para texto

### No admin

Voce pode editar com:

- titulo
- subtitulo
- intertitulos
- paragrafos
- listas
- links
- destaques
- imagens de apoio
- CTA

### No cliente

O cliente pode ver em modo de leitura:

- layout limpo
- largura confortavel
- hierarquia tipografica forte
- comentarios se estiverem ligados

## Minha recomendacao de UX para `Textos`

### Duas visoes

1. `Editor`
2. `Pré-visualização do cliente`

Assim voce consegue:

- escrever
- revisar
- ver exatamente como o cliente le

## 3. Calendário

Esse calendario faz muito sentido continuar por cliente.

A logica certa e exatamente a que voce explicou:

- se estou dentro da Serena, vejo so os posts da Serena

## O que o calendario precisa fazer

- mostrar os posts daquele cliente
- marcar datas com status
- abrir post ao clicar
- criar novo post a partir da data
- mover planejamento com rapidez

## Minha recomendacao de design para `Calendário`

### Desktop

- calendario mensal principal
- cards/eventos com cor por status
- mini resumo lateral do dia selecionado

### Mobile

- agenda/lista por data
- alternancia para visao mensal simplificada

## 4. Atividades

Essa aba e excelente para rastreabilidade.

Ela deve concentrar tudo que aconteceu naquele cliente especifico.

### O que entra

- cliente aprovou
- cliente rejeitou
- cliente comentou
- cliente criou post
- cliente editou legenda
- cliente abriu pauta
- equipe moveu card
- equipe agendou

## Como eu faria `Atividades`

### Estrutura

- timeline limpa
- avatar/logo
- acao
- card relacionado
- data e hora

### Filtros

- tudo
- aprovacoes
- comentarios
- criacao
- alteracoes

## 5. Brand Brain

Esse modulo e muito mais do que uma configuracao.

Ele e memoria viva da marca.

## O que ele precisa conter

- pilares
- tom de voz
- palavras aprovadas
- palavras evitadas
- identidade visual
- paleta
- tipografia
- expressoes
- prompts
- direcoes criativas

## Edicao do cliente

Como voce explicou, o cliente tambem pode ajustar isso.

Entao eu faria:

### No admin

- edicao completa
- organizacao por secoes
- controle de consistencia

### No cliente

- leitura clara
- edicao se a permissao estiver ligada
- historico leve das alteracoes importantes

## Como isso tudo se conecta

A grande forca da `v2` esta aqui:

- o board gera o trabalho
- textos mostram o conteudo escrito de forma bonita
- calendario organiza o planejamento
- atividades mostram o historico real
- Brand Brain sustenta a consistencia da marca

## Minha recomendacao de produto

A area admin da `v2` deve ser tratada como um workspace por cliente/conta.

Nao apenas como uma pagina com abas.

Ou seja:

- cada cliente vira um workspace
- dentro dele voce tem os modulos do trabalho

## Resumo da direcao

### Quadro

operacao visual

### Textos

leitura editorial bonita para cliente

### Calendário

planejamento por cliente

### Atividades

timeline de tudo que o cliente fez

### Brand Brain

guia vivo da marca

## Proximo passo natural

Depois disso, o ideal e desenhar visualmente a `area admin/workspace` da `v2`, porque agora ja esta claro o que cada aba precisa representar.
