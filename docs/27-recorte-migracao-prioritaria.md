# Recorte de Migracao Prioritaria

## Clientes confirmados pela Liege

Estes clientes/contas entram como prioridade de recuperacao:

- Aplikasi
- Podcast Elite Leader
- Podcast Lider de Elite
- Minas Home
- Doutora Patricia

## Escopo confirmado para esses clientes

Para esse grupo, a Liege quer recuperar:

- informacoes de login vinculadas as contas
- posts
- itens arquivados relacionados aos posts
- comentarios feitos nos cards
- calendarios de cada Kanban
- colunas
- estrutura do quadro relacionada aos posts

## O que nao precisa recuperar nesse grupo

Nao e prioridade recuperar:

- atividades
- historico de atividade
- log de acoes

## Leitura pratica

Para esses clientes, a migracao pode ser mais enxuta e objetiva:

- recriar cliente/conta
- recuperar dados de acesso vinculados
- recriar acessos necessarios
- trazer colunas
- trazer cards/posts
- trazer arquivados relevantes
- trazer os calendarios ligados aos posts
- trazer metadados importantes do post

## Informacoes de login: o que pode e o que nao pode

### O que normalmente pode ser recuperado

- email do usuario
- nome do usuario
- vinculo do usuario com a conta
- qual login esta ligado a qual cliente
- perfis e atribuicoes de acesso

### O que normalmente nao pode ser recuperado em texto legivel

- senha atual em texto aberto

Na pratica, a senha costuma nao ser exportavel do sistema antigo em formato legivel.

Entao a estrategia correta para a V2 e:

- recuperar os logins vinculados
- recriar os acessos dessas contas
- definir nova senha ou fluxo de redefinicao de senha

## Regra recomendada para essa primeira leva

Para esses clientes prioritarios:

- recuperar identidade de login
- manter o vinculo correto entre usuario e conta
- preparar redefinicao de senha no novo sistema, se necessario

## Metadados de post que continuam importantes

Ao recuperar os posts, vale manter junto tudo o que influencia o trabalho atual, como:

- titulo
- tipo de post
- midia
- legenda ou texto
- tags
- status
- data
- horario
- comentarios internos do Kanban
- comentarios feitos pelos clientes

## Arquivados

Para essa primeira leva, tambem vale recuperar os itens arquivados dessas contas quando eles estiverem ligados ao historico de posts.

Isso ajuda porque:

- preserva material antigo ainda util
- mantem consulta de conteudo passado
- evita perder referencia importante de clientes ativos

## Regra pratica para arquivados

Trazer:

- cards arquivados
- midias arquivadas vinculadas a posts
- legenda ou texto do post arquivado
- tags e status do card arquivado, se existirem
- data e horario, se existirem
- comentarios do card arquivado, se existirem

Nao priorizar:

- atividade detalhada do arquivamento
- log completo de tudo que aconteceu no passado

## Comentarios

Para essa primeira leva, vale manter comentarios sempre que for viavel recuperar.

### Tipos de comentario desejados

- comentarios internos no Kanban
- comentarios feitos pelos clientes
- comentarios em cards ativos
- comentarios em cards arquivados, se existirem

### Por que isso vale a pena

- preserva contexto de revisao
- ajuda a entender alteracoes pedidas
- mantem memoria do processo do post

### O que nao precisa virar prioridade absoluta

Se houver comentarios tecnicamente muito dificeis de recuperar em alguns casos isolados, eles podem virar item de segunda camada.

Mas o alvo principal desta migracao prioritaria passa a incluir comentarios, sim.

## Calendarios

Para essa primeira leva, tambem vale recuperar os calendarios de cada Kanban, sempre que estiverem ligados aos posts dessas contas.

### O que isso significa na pratica

Trazer:

- datas dos posts
- horarios dos posts
- eventos de calendario ligados aos cards
- cores/eventos do calendario, se existirem

### Por que isso vale a pena

- preserva o planejamento visual do cliente
- mantem coerencia com o agendamento dos cards
- ajuda a V2 a nascer mais pronta para uso

### Regra de prioridade

O calendario entra como parte util da estrutura operacional dessas contas, diferente de atividades detalhadas e logs antigos.

## Regra de prioridade

Esses clientes formam a primeira leva da migracao curada da V2.

## Ordem sugerida

1. Aplikasi
2. Podcast Elite Leader
3. Podcast Lider de Elite
4. Minas Home
5. Doutora Patricia

## Objetivo dessa primeira leva

Entrar na V2 com as contas mais relevantes ja funcionando, sem carregar modulos secundarios do legado que nao sao necessarios agora.
