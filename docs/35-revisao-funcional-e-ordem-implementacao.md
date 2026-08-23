# Revisao Funcional e Ordem de Implementacao

## O que o schema inicial ja resolve bem

O schema inicial da V2 ja cobre muito bem o nucleo do sistema:

- niveis de acesso
- multiconta
- clientes e atribuicoes
- quadro por cliente
- colunas personalizadas
- cards ativos
- cards arquivados
- comentarios
- calendario
- links temporarios
- automacoes

Ou seja: a base ficou boa para comecar a reconstrução sem gambiarra.

## O que eu considero correto manter

### 1. Login global + acesso por conta

Essa foi uma decisao muito boa.

Com isso:

- um usuario existe uma vez so
- o acesso real dele vem das contas atribuidas
- voce consegue multiconta com login unico

### 2. Cliente separado de permissao

Separar `client_accounts` de `client_permissions` foi uma boa escolha.

Isso deixa:

- o cadastro da conta limpo
- as permissoes organizadas
- o portal adaptativo mais facil

### 3. Cards ativos e arquivados na mesma tabela

Isso tambem esta certo.

Usar:

- `archived`
- `archived_at`

e melhor do que criar duas tabelas de cards.

### 4. Comentarios na mesma estrutura

Tambem esta certo manter:

- comentarios internos
- comentarios do cliente

na mesma tabela, com marcador.

Isso preserva contexto.

## Ajustes que eu recomendo antes de implementar

### 1. Papéis em dois niveis

Hoje o schema tem:

- `global_role` em `users`
- `membership_role` em `client_memberships`

Isso esta certo, mas a regra precisa ficar explicita:

### Regra recomendada

- `super_admin` existe so em `users.global_role`
- `admin`, `colaborador` e `cliente` podem existir em `client_memberships.membership_role`

Na pratica:

- o poder global vem do usuario
- o escopo por conta vem da membership

### 2. Owner da conta

Em `client_accounts`, o campo `owner_user_id` faz sentido.

Mas eu deixaria claro:

- owner nao substitui membership

Ou seja:

- todo owner tambem deve ter membership naquela conta

Isso evita regra escondida.

### 3. Status e tags em JSON

Para a primeira fase, esta bom.

Mas eu deixaria anotado desde ja:

- isso funciona rapido
- mas no futuro talvez valha normalizar tags

Para a V1 da V2, eu manteria como esta.

### 4. Coluna de busca

Como a busca vai ser importante, eu recomendaria prever no card:

- texto consolidado pesquisavel depois

Nao precisa fazer agora, mas vale pensar.

### 5. Comentario com papel do autor

`author_role` no comentario foi uma boa ideia.

Eu manteria.

Isso ajuda na exibicao:

- cliente
- equipe
- admin

## O que eu adicionaria ao schema em breve

Nao precisa entrar antes de tudo, mas eu colocaria na fila curta:

### client_search_settings

Ou simplesmente em `client_permissions`:

- `allow_client_search`

Isso ja foi pensado e eu manteria.

### card_visibility_flags

Se depois voce quiser esconder alguma coisa do card no portal, pode entrar depois.

Por enquanto nao precisa.

### imported_legacy_ref

Eu gosto de prever no banco novo um campo para mapear origem do legado.

Exemplo:

- `legacy_id`
- `legacy_source`

Especialmente em:

- client_accounts
- kanban_columns
- kanban_cards
- card_comments
- card_calendar_events

Isso ajuda muito na migracao e na auditoria.

## Ordem de implementacao recomendada

Aqui esta a ordem que eu usaria na pratica.

## Fase 1. Base de acesso

### 1. users

Primeiro criar:

- usuarios
- senha
- papel global

### 2. client_accounts

Depois criar as contas/clientes.

### 3. client_memberships

Depois ligar:

- quem acessa qual conta
- com qual papel naquela conta

### 4. client_permissions

Depois ligar o que o cliente pode ou nao pode ver/fazer.

## Fase 2. Base do Kanban

### 5. kanban_columns

Criar a estrutura do quadro.

### 6. kanban_cards

Criar os cards.

Essa e a tabela mais importante do sistema.

## Fase 3. Camada de contexto

### 7. card_comments

Para manter feedback, contexto e conversa.

### 8. card_calendar_events

Para o calendario por conta.

## Fase 4. Fluxos especiais

### 9. approval_links

Para aprovacao sem login.

### 10. kanban_automations

Para automacoes por cliente.

## Ordem de migracao dos dados

Depois de implementar as tabelas, eu migraria nessa ordem:

1. contas
2. usuarios
3. memberships
4. permissoes
5. colunas
6. cards ativos
7. cards arquivados
8. comentarios
9. calendario

## Ordem de telas para construir

Para a interface, eu construiria assim:

1. login
2. seletor de conta
3. quadro admin
4. detalhe do card
5. portal do cliente
6. comentarios
7. calendario
8. links temporarios
9. automacoes

## O que testar primeiro

Antes de pensar em tudo, eu testaria estes fluxos:

### Fluxo 1

- super admin entra
- cria conta
- cria coluna
- cria card

### Fluxo 2

- admin entra
- ve apenas clientes proprios/atribuidos
- nao ve escopo global

### Fluxo 3

- colaborador entra
- nao cria cliente
- opera apenas clientes atribuidos

### Fluxo 4

- cliente entra
- ve apenas o portal dele

### Fluxo 5

- gerar link temporario
- aprovar sem login
- mover card corretamente

## Minha leitura final

O schema inicial esta bom e funcional.

Eu nao faria uma grande revirada nele agora.

O que eu faria e:

- manter a espinha dorsal
- acrescentar `legacy_id` onde fizer sentido
- deixar bem clara a regra de papel global x papel por conta
- comecar a implementacao na ordem acima

## Resultado esperado

Se seguirmos essa ordem, a V2 vai nascer organizada:

- com acesso bem controlado
- com base de dados limpa
- com Kanban forte
- e pronta para receber a migracao curada depois
