# 11. Brand Brain, troca de conta e refinamentos do portal

Data deste documento: 20 de agosto de 2026

## Ajuste visual imediato

Voce tem razao:

- nao precisa repetir a cliente no topo e embaixo do mesmo jeito

Na `v2`, eu faria assim:

### No topo

Manter:

- avatar
- nome
- papel
- seletor de conta

### No bloco inferior

Trocar o card da pessoa por um bloco mais funcional:

- `Il mio profilo`
- `Cambia password`
- `Brand Brain`
- `Cambia account`
- `Esci`

Ou seja:

- menos repeticao
- mais utilidade

## Brand Brain no portal do cliente

Isso esta muito alinhado com o sistema atual.

Hoje o codigo ja mostra que existe:

- permissao `allow_client_edit_brand_brain`
- rota do cliente para `brand-brain`
- controle de edicao por cliente

Referencias:

- [AdminPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/AdminPage.tsx)
- [BrandBrainPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/BrandBrainPage.tsx)

Na `v2`, eu colocaria isso no portal como:

### Menu lateral

- `Brand Brain`

ou, se voce quiser manter o menu mais limpo:

- dentro de `Il mio profilo`

## Minha recomendacao

Como o Brand Brain e bem importante e nao e so configuracao pessoal, eu prefiro:

- `Brand Brain` como item proprio de navegacao

E dentro dele:

- leitura
- comentarios
- edicao, se permitido

## O que o cliente pode fazer no Brand Brain

Dependendo da permissao:

### Somente leitura

- ver pilares
- ver voz da marca
- ver paleta
- ver tipografia
- ver vocabulos e expressoes

### Edicao permitida

- ajustar conteudos
- atualizar termos
- editar direcoes visuais
- atualizar prompts e referencias

## Troca de conta com um login so

Isso tambem faz muito sentido.

E combina bastante com o modelo atual de:

- `user_client_assignments`

Ou seja:

- um usuario pode estar ligado a mais de um cliente/conta

## O que isso significa na V2

O login deve abrir a sessao do usuario, nao de uma conta unica.

Depois disso, o usuario escolhe qual conta quer ver.

## Como eu desenharia isso

### No topo do portal

Ao lado do nome da pessoa:

- nome da conta atual
- avatar/logo da conta
- dropdown `Mudar conta`

### No mobile

- seletor no topo
- ou na folha lateral do perfil

## Exemplo de uso

Uma pessoa entra com um login e ve:

- `Marca principal`
- `Conta de anúncios`

Ela toca e troca entre as duas sem sair do sistema.

## Regra importante de permissao

Cada conta precisa carregar com suas proprias configuracoes:

- idioma
- widgets
- colunas visiveis
- Brand Brain
- faturas
- relatorios
- permissoes

Ou seja:

- a troca de conta tambem troca o portal inteiro

## Minha recomendacao de UX

### Se so houver uma conta

- esconder o seletor

### Se houver duas ou mais

- mostrar claramente `Mudar conta`

## Estrutura recomendada do bloco inferior esquerdo

Em vez do card atual com nome repetido, eu faria um bloco assim:

- `Il mio profilo`
- `Cambia password`
- `Brand Brain`
- `Cambia account`
- `Esci`

Se houver varias contas:

- mostrar a conta atual como chip ou mini seletor

## Como isso conversa com o admin

No admin, isso tambem reforca a necessidade de:

- `Visualizar como cliente`
- ver exatamente uma conta especifica

Especialmente quando um mesmo usuario cliente tiver acesso a duas contas diferentes.

## Conclusao

Esses tres ajustes deixam o portal muito mais maduro:

1. tirar duplicacao visual da cliente
2. incluir o `Brand Brain` como area real do portal
3. permitir `Mudar conta` sem novo login

Isso resolve muito bem o seu tipo de operacao, onde um mesmo contato pode ter acesso a mais de uma conta separada.
