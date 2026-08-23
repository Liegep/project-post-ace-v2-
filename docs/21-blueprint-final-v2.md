# Blueprint Final V2

## Objetivo

Reconstruir o app em uma V2 propria, fora do Lovable, com identidade premium, operacao mais organizada e experiencia melhor tanto para a Liege quanto para os clientes.

Essa V2 deve manter o que funciona hoje, melhorar a usabilidade e reduzir a sensacao de sistema remendado.

## Estrutura geral da V2

A V2 se organiza em dois grandes lados:

- area admin
- area do cliente

Os dois lados compartilham a mesma base de dados e a mesma logica central, mas cada um mostra apenas o que faz sentido para seu perfil.

## Niveis de acesso

A V2 deve trabalhar com 4 niveis principais:

- super admin
- admin
- colaborador
- cliente

### Super admin

- controle total
- ve tudo
- cria clientes
- administra o sistema inteiro

### Admin

- administra clientes proprios
- administra clientes atribuidos
- nao ve dados privados do super admin

### Colaborador

- gerencia apenas clientes atribuidos
- nao cria clientes
- nao ve dados privados do super admin

### Cliente

- ve apenas a propria area de cliente
- nao acessa as paginas internas do sistema

## Regra de autenticacao

A autenticacao da V2 deve ser fechada.

Ou seja:

- sem login social
- sem cadastro publico
- sem criacao livre de conta

Todos os logins devem ser criados internamente pela operacao.

## Regra central do produto

O `card` e a entidade principal do sistema.

Cada card representa um post ou entrega e concentra:

- midia
- texto ou legenda
- comentarios
- tags
- status
- agendamento
- historico
- aprovacao
- link temporario
- cliente/conta

Quase todo o sistema passa a refletir o estado desse card.

## Area admin

### Papel

E a area operacional da Liege e da equipe.

Ali acontecem:

- criacao e organizacao do trabalho
- edicao dos cards
- aprovacao interna
- envio para cliente
- agendamento
- gestao de textos
- historico
- configuracoes de visibilidade e permissoes

### Navegacao principal

O admin deve ter barra lateral recolhivel com navegacao do ecossistema.

Itens principais:

- Workspace
- Pautas
- Faturamento
- Relatorios
- Biblioteca
- Clientes
- Configuracoes

### Workspace por cliente/conta

Dentro de cada cliente/conta, a navegacao principal fica em abas:

- Quadro
- Arquivados
- Textos
- Calendario
- Atividades
- Brand Brain

## Quadro admin

### Direcao visual

- fundo com degradê suave
- paineis claros
- glassmorphism leve
- aparencia premium, limpa e calma

### Regras do quadro

- sem coluna fixa `Publicado`
- a Liege cria as colunas que quiser
- a Liege pode deletar colunas
- precisa existir botao de `Criar coluna`
- cada coluna tem menu `...`

### Acoes da coluna

- faturar
- editar nome
- editar cor
- excluir
- adicionar post

### Comportamento

- a pagina pode rolar na horizontal se houver muitas colunas
- cada coluna rola verticalmente por dentro
- o quadro principal deve permanecer limpo

### Busca e filtros

Dentro do quadro de cada cliente precisa existir:

- busca de cards
- filtros

A busca deve ajudar a localizar por:

- titulo
- texto
- tags
- status

## Cards

### Regra visual

Os cards devem respeitar o formato real da arte.

Exemplos:

- story/reels alto
- post quadrado
- carrossel conforme formato
- peca pequena continua pequena

### Regras importantes

- pouca ou nenhuma borda arredondada agressiva na arte
- o sistema se adapta ao formato da peca
- a arte e o destaque central

### Informacoes do card

O card pode exibir:

- titulo
- tipo do post
- midia
- tags
- status
- data
- hora
- comentarios

## Fluxo de aprovacao

Existem dois modos:

### 1. Cliente logado

- a Liege envia o card para o cliente
- o cliente ve o card no portal
- comenta, aprova ou pede alteracao

### 2. Link temporario

- cada card pode gerar link temporario
- validade de 7 dias
- nao exige login
- cliente pode ver, comentar e aprovar

### Consequencia da aprovacao

Quando o cliente aprova:

- o card muda de estado
- vai para a coluna correta
- se a coluna de destino nao existir, o sistema cria
- tudo entra no historico

## Agendamento

O agendamento nasce no proprio card.

Campos minimos:

- data
- horario

Esse agendamento alimenta:

- calendario do cliente
- calendario da conta
- dashboard geral

### Arquivamento automatico

Quando chega a data e o horario definidos:

- o card sai do fluxo principal
- vai automaticamente para `Arquivados`

Isso evita poluir o quadro com uma coluna fixa de publicado.

## Status, tags e acompanhamento

### Status

Exemplos:

- pendente
- design pronto
- legenda pronta
- alterado
- artigo pronto
- shorts/reels pronto

### Tags

As tags ajudam a resumir o estado do trabalho e podem disparar automacoes.

### Acompanhamento

O widget de acompanhamento e alimentado pelos status e tags dos cards.

Ele pode mostrar:

- item do projeto
- etapas ativas
- etapas concluidas
- itens riscados/finalizados
- progresso visual

## Automacoes

Cada cliente/conta pode ter automacoes proprias.

Exemplos:

- se receber a tag X, mover para coluna Y
- se entrar em determinado status, atualizar acompanhamento
- se chegar a data/hora, arquivar
- se o cliente aprovar, mover para coluna de aprovados

## Gaveta lateral do workspace

No lado direito do quadro deve existir uma gaveta lateral charmosa e util.

Blocos ou abas:

- Recados
- Rascunhos
- Links
- Rapidos
- Acompanhamento

### Rapidos

Exemplos de acessos:

- E-mail
- ChatGPT
- Instagram
- Facebook
- LinkedIn
- Business Suite
- Google Drive
- Spotify

## Area do cliente

### Papel

E a area que o cliente usa para:

- ver cards
- aprovar
- pedir alteracao
- comentar
- acompanhar postagens
- ver textos
- ver faturas e relatorios, se permitido
- consultar Brand Brain, se permitido

### Direcao visual

- mesma linguagem premium da area admin
- mais limpa
- menos ruído
- foco no conteudo entregue

### Menu lateral

Itens possiveis:

- Visao geral
- Aprovacoes
- Proximos posts
- Textos
- Faturas
- Relatorios
- Brand Brain
- Perfil

### Regras adaptativas

Todos os widgets e areas devem aparecer apenas quando houver dado ou quando a permissao estiver ligada.

## Permissoes por cliente

Cada cliente/conta pode ter on/off para decidir o que ele:

- ve
- nao ve
- pode editar
- nao pode editar

Exemplos:

- editar legenda
- criar posts
- baixar conteudo
- ver arquivados
- ver proximos posts
- ver faturas
- ver relatorios
- editar Brand Brain
- usar busca
- ver acompanhamento

## Busca no portal do cliente

A busca no portal do cliente:

- existe apenas se estiver habilitada para aquela conta
- permite localizar cards e filtrar conteudos

## Textos

### Admin

Na area admin, `Textos` precisa ser uma experiencia editorial premium:

- boa leitura
- preview bonito
- aprovacao
- versoes
- traducoes

### Cliente

Na area do cliente, `Textos` deve ser mais simples:

- leitura bonita
- comentar
- aprovar
- pedir ajuste
- baixar PDF, se permitido

## Brand Brain

O Brand Brain faz parte da V2 e pode incluir:

- paleta
- tipografia
- palavras que usa
- palavras que evita
- pilares
- voz da marca
- prompts
- referencias visuais

Pode ser visivel e editavel pelo cliente apenas se a permissao estiver ligada.

## Multi-idioma

Cada conta deve ter idioma principal definido no cadastro.

Idiomas mapeados:

- portugues
- ingles
- italiano
- espanhol
- sueco

A interface do cliente deve abrir consistentemente no idioma configurado daquela conta.

## Multiconta

Um mesmo login pode acessar mais de uma conta.

O usuario escolhe ou troca de conta sem precisar fazer login de novo.

Isso atende clientes que tem:

- marcas separadas
- conta principal e conta de anuncios
- operacoes diferentes dentro do mesmo acesso

## Mobile first

A V2 precisa funcionar muito bem no celular.

Especialmente importantes no mobile:

- cards
- aprovacao
- textos
- comentarios
- busca
- troca de conta

## PWA

A V2 deve ser preparada para virar PWA.

Beneficios:

- instalacao no celular
- acesso rapido
- experiencia mais fluida

## O que ja esta fechado

Ja esta bem definido:

- direcao visual principal
- separacao admin x cliente
- card como centro do sistema
- quadro clean
- barra lateral recolhivel
- gaveta lateral de apoio
- fluxo de aprovacao
- link temporario
- agendamento
- arquivamento automatico
- textos
- brand brain
- acompanhamento
- automacoes
- permissoes por cliente
- multi-idioma
- multiconta

## Proximo ciclo

Agora a V2 pode seguir em camadas:

1. consolidar o blueprint funcional final
2. desenhar as ultimas telas-chave que faltarem
3. definir stack tecnica da reconstrução
4. mapear migracao de dados sem perda
5. iniciar implementacao do novo app
