# 10. Portal do cliente: idioma, preview e cards do conteúdo

Data deste documento: 20 de agosto de 2026

## O que precisa entrar na V2

Com base no que voce descreveu e no que o app atual ja sinaliza, o portal do cliente da `v2` precisa ter estes pilares:

1. troca de senha pelo proprio cliente
2. idioma definido por cliente
3. preview fiel do que o cliente ve a partir do admin
4. posts mostrados como cards elasticos com foco total no conteudo

## Troca de senha

Isso faz todo sentido e combina com o fluxo atual.

O app atual ja tem mudanca de senha na area do cliente em [ClientPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/ClientPage.tsx), com dialog proprio e uso de `supabase.auth.updateUser`.

Na `v2`, eu manteria isso como:

- item `Meu perfil`
- acao `Alterar senha`

No mobile:

- tela simples
- campos grandes
- confirmacao clara

## Idioma por cliente

Isso tambem esta muito bem alinhado ao que ja existe no projeto.

Hoje ja existe:

- `locale` no cliente
- idiomas `pt`, `en`, `it`, `es`, `sv`
- base de traducoes em [translations.ts](/Users/liegipaschoalini/Desktop/project-post-ace/src/i18n/translations.ts)

Entao a regra da `v2` deve ser:

### No cadastro do cliente

O admin define:

- lingua principal do portal do cliente

### No portal

O cliente entra e ve tudo no idioma definido para ele:

- menu
- widgets
- botoes
- status
- comentarios do sistema
- labels de acao

## Regra importante de UX

Para esses clientes, a traducao precisa ser consistente, como voce falou.

Isso significa:

- nada de misturar portugues com italiano
- nada de labels internas aparecendo cruas
- nada de status tecnicos vazando

## Minha recomendacao

Na `v2`, eu trataria o idioma como parte central do modelo do cliente:

- nao opcional
- nao improvisado

## Preview do que o cliente ve

Isso tambem ja conversa com o app atual.

Hoje o admin ja tem acao de:

- `Ver portal do cliente`

em [AdminDashboard.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/AdminDashboard.tsx)

Na `v2`, eu tornaria isso ainda melhor:

### No admin

Botao claro:

- `Visualizar como cliente`

### O que ele faz

- abre o portal daquele cliente
- respeita idioma do cliente
- respeita colunas visiveis
- respeita toggles on/off
- respeita widgets condicionais

Ou seja:

- o admin nao vê uma simulacao generica
- ele vê exatamente a experiencia final

## Cards do conteudo como protagonista

Esse ponto e muito importante.

Voce tem razao: o destaque principal nao e o texto explicativo da interface.

O destaque principal e:

- o post
- a arte
- o video
- o material entregue

Entao no portal da `v2` eu faria os posts como:

- cards visuais
- elasticos
- adaptados ao formato do conteudo

## Comportamento dos cards

### Se a peca for quadrada

- card quadrado

### Se a peca for vertical

- card mais alto

### Se a peca for horizontal

- card mais largo

### Se for conteudo menor

- card mais compacto

Ou seja:

- o container se adapta ao asset
- sem distorcer
- sem matar o impacto visual

## Referencia ideal

Sim, esse comportamento deve lembrar um Trello ou um board de cards:

- flexivel
- visual
- rapido de ler

Mas com acabamento muito mais premium.

## Como isso afeta o portal

### Home do cliente

Eu deixaria widgets mais resumidos, mas com preview de card quando fizer sentido.

### Aprovações

Eu faria uma grade ou lista de cards com:

- miniatura forte
- titulo
- status
- data
- CTA `Ver`

### Detalhe do post

O card ou midia precisa dominar a tela:

- grande no desktop
- dominante no mobile

O resto apoia:

- legenda
- comentarios
- aprovar
- solicitar alteracao

## Mobile first de verdade

Se muitos acessam no celular, entao o card precisa ser ainda melhor no mobile.

Minha recomendacao:

### No mobile

- feed de cards
- uma coluna
- sem excesso de informacao lateral
- CTA sempre visivel

### Na tela de detalhe

- midia primeiro
- legenda depois
- comentarios abaixo
- barra fixa inferior com acoes

## Estrutura ideal do portal

### Sidebar ou menu

- `Aprovações`
- `Pautas`
- `Próximos posts`
- `Arquivos`
- `Faturas`
- `Relatórios`
- `Meu perfil`

### Meu perfil

- alterar senha
- ver idioma

Observacao:

Eu deixaria o idioma travado pelo admin por padrao, mas com possibilidade futura de override se um dia fizer sentido.

## Conclusao

O portal do cliente da `v2` deve ser:

- traduzido corretamente por cliente
- fiel ao que o admin configurou
- visualmente centrado nos cards do conteudo
- forte no celular

Em resumo:

- menos interface competindo com o trabalho entregue
- mais foco no produto visual que o cliente precisa aprovar
