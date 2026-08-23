# Auth e Acesso Bootstrap

## O que foi montado

O backend da V2 agora tem um bootstrap de acesso baseado em:

- usuario global
- memberships por conta
- escopo por perfil

## Perfis assumidos

- `super_admin`
- `admin`
- `colaborador`
- `cliente`

## Regra aplicada

### Super admin

- escopo global
- ve tudo
- pode criar clientes
- cria todos os acessos do sistema

### Admin

- ve clientes proprios
- ve clientes atribuidos
- acessa area interna
- pode criar clientes
- nao cria logins
- nao tem escopo global

### Colaborador

- ve apenas clientes atribuidos
- acessa area interna
- nao cria clientes
- nao cria logins

### Cliente

- nao acessa area interna
- ve apenas contas do portal vinculadas a ele

## Como o bootstrap atual identifica o usuario

Neste momento, para desenvolvimento local, o backend usa:

- header `x-user-id`

Esse header carrega:

- usuario
- memberships
- escopo

## Rotas preparadas

### `POST /api/auth/login`

- login com email e senha
- sem cadastro aberto
- sem login social
- retorna token de acesso

### `GET /api/auth/session`

Retorna:

- usuario autenticado
- memberships
- escopo
- capacidades principais

### `POST /api/auth/users`

- criacao interna de usuario
- bloqueada para qualquer perfil que nao seja `super_admin`
- pensada para acesso criado apenas por voce

### `GET /api/clients`

- exige area interna
- super admin ve tudo
- admin ve clientes proprios e atribuidos
- colaborador ve clientes atribuidos
- cliente nao entra

### `GET /api/portal/accounts`

- retorna apenas contas do portal para memberships de cliente

### `POST /api/clients`

- reservado para criacao de clientes
- ja bloqueia perfis sem permissao

## O que isso resolve agora

- base de permissao real
- separacao de escopo
- diferenca clara entre area interna e portal
- preparacao para implementar login completo depois

## O que vem depois

1. trocar bootstrap por sessao completa ou cookie se quisermos
2. memberships reais nas consultas de cards, colunas e calendario
3. regras de criacao de cliente e atribuicao
4. telas internas para criar acessos

## Regra fixa da autenticacao da V2

O login da V2 sera sempre interno.

Isso significa:

- sem Google
- sem Facebook
- sem Apple
- sem qualquer login social
- sem cadastro aberto

Todos os usuarios devem ser criados por voce ou por fluxo interno autorizado.

No bootstrap atual, o fluxo interno autorizado foi travado para uso exclusivo do `super_admin`.
