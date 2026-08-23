# 13. Quadro da V2: regras de comportamento

Data deste documento: 20 de agosto de 2026

## Estrutura base

O `Quadro` da `v2` deve nascer sem colunas fixas.

Regras:

- nenhuma coluna obrigatoria por padrao
- voce cria as colunas conforme a operacao pedir
- voce cria os cards conforme precisar
- o board se adapta ao seu processo, nao o contrario

## Rolagem

Esse ponto esta fechado como regra do produto:

- a pagina nao deve crescer verticalmente por causa das colunas
- cada coluna tem sua propria rolagem interna
- os cards rolam dentro da coluna
- o board pode rolar horizontalmente quando houver muitas colunas

## Estrutura visual da coluna

Cada coluna deve ter:

- cabecalho fixo
- nome da coluna
- cor da coluna
- contador de cards
- botao/menu de acoes
- area de cards rolavel
- acao de adicionar card

## Menu da coluna

Cada coluna criada deve ter um menu de `três pontinhos`.

Opcoes confirmadas para esse menu:

1. `Faturar`
2. `Editar`
3. `Excluir`
4. `Adicionar post`

## O que cada opcao faz

### Faturar

Serve para vincular a coluna a um fluxo de faturamento ou leitura financeira da operacao.

Mesmo que a logica tecnica ainda seja refinada depois, a opcao ja deve existir no produto.

### Editar

Abre uma edicao da coluna com:

- nome
- cor

### Excluir

Permite excluir a coluna.

Minha recomendacao:

- sempre com confirmacao

### Adicionar post

Cria um novo card direto naquela coluna.

## Regras de UX do menu

- menu simples e rapido
- opcoes claras
- icones consistentes
- sem esconder a acao de adicionar post

## Regras do board

### Cards

- cards visuais
- conteudo como protagonista
- imagem/video em destaque
- altura elastica conforme o conteudo

### Colunas

- largura consistente
- altura estavel
- rolagem interna

### Acoes do card

Mantem o espirito atual:

- abrir
- mover
- copiar
- enviar para outro cliente

## Conclusao

O `Quadro` da `v2` deve ser:

- flexivel
- visual
- sem colunas obrigatorias
- com rolagem interna por coluna
- com menu de tres pontinhos por coluna

Esse e o comportamento certo para preservar a liberdade operacional que voce ja usa hoje.
