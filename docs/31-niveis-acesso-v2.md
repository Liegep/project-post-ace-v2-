# Niveis de Acesso V2

## Regra geral

A V2 deve trabalhar com 4 niveis principais de acesso:

- `super admin`
- `admin`
- `colaborador`
- `cliente`

Esses niveis nao mudam apenas o que a pessoa pode clicar.

Eles mudam:

- o que a pessoa enxerga
- quais clientes ela pode administrar
- quais paginas do sistema ela pode usar
- quais dados ela pode criar
- quais dados ela pode ver

## Regra fixa de criacao de login

Na V2:

- nao existe cadastro publico
- nao existe auto cadastro
- nao existe login social
- nao existe criacao livre de conta pelo usuario final

Todos os acessos devem ser criados internamente por:

- super admin
- ou por fluxo interno autorizado da equipe, se voce permitir depois

Ou seja:

- cliente nao cria conta sozinho
- admin nao cria conta livremente se isso nao for permitido
- colaborador nao cria conta

## 1. Super Admin

Esse nivel e a Liege.

### Permissoes

- controle total do sistema
- pode criar clientes
- pode editar clientes
- pode ver todos os clientes
- pode ver clientes proprios e de qualquer pessoa
- pode atribuir clientes para admins e colaboradores
- pode ver todas as paginas do sistema
- pode ver todos os dados do sistema
- pode ver faturamento, pautas, ideias de pauta, relatorios, contratos, propostas, datas comemorativas, briefs e demais areas
- pode configurar permissoes
- pode controlar o que cada cliente ve
- pode controlar o que cada membro interno ve

### Visao

O super admin ve o sistema completo.

## 2. Admin

Admins podem administrar:

- os clientes proprios
- os clientes que forem atribuidos a eles

### Permissoes

- podem gerenciar clientes atribuidos
- podem trabalhar nos quadros desses clientes
- podem usar as paginas internas do sistema
- podem preencher os proprios dados e o proprio conteudo nas paginas internas
- nao podem ver os dados privados do super admin
- nao devem ter controle total global
- nao devem ver clientes que nao pertencem a eles nem os que nao foram atribuidos

### Restricoes

- nao podem ver tudo
- nao podem assumir controle global do sistema
- nao podem acessar dados do super admin

## 3. Colaborador

Colaboradores podem gerenciar apenas:

- os clientes atribuidos a eles

### Permissoes

- podem trabalhar nos clientes atribuidos
- podem usar as paginas internas do sistema para os dados deles
- podem preencher conteudo proprio dentro dessas paginas
- podem operar cards, colunas, comentarios e fluxo de trabalho dos clientes que receberam

### Restricoes

- nao podem criar clientes
- nao podem ver clientes fora da atribuicao deles
- nao podem ver dados do super admin
- nao devem ter controle global

## 4. Cliente

Cliente nao acessa a area interna.

### Permissoes

- pode ver apenas a propria area do cliente
- ve apenas as contas e conteudos designados para ele
- pode aprovar, comentar e usar o portal conforme as permissoes daquela conta

### Restricoes

- nao ve paginas internas do sistema
- nao ve dashboard interno
- nao ve equipe
- nao ve social
- nao ve ideias de pauta
- nao ve calendario interno
- nao ve pautas internas
- nao ve relatorios internos do admin
- nao ve faturamento interno do admin
- nao ve propostas internas
- nao ve contratos internos
- nao ve datas comemorativas internas
- nao ve briefs de design internos

## Navegacao interna do sistema

As paginas internas principais mostradas no menu sao:

- Dashboard
- Equipe
- Social
- Ideias de Pauta
- Calendario
- Pautas
- Relatorios
- Faturamento
- Propostas
- Contratos
- Datas Comemorativas
- Briefs de Design

## Regra de visibilidade por papel

### Super Admin

- ve todas essas paginas com dados completos do sistema

### Admin

- ve essas paginas
- mas com dados limitados ao proprio escopo
- pode ter paginas inicialmente vazias quando ainda nao houver dados dele ou dos clientes atribuidos
- nao pode ver dados do super admin

### Colaborador

- ve essas paginas
- mas apenas dentro do escopo atribuido
- pode ter paginas inicialmente vazias
- nao pode criar clientes
- nao pode ver dados do super admin

### Cliente

- nao ve essas paginas
- ve somente o portal do cliente

## Regra de escopo dos dados

### Super Admin

- escopo global

### Admin

- escopo dos clientes proprios
- mais clientes atribuidos

### Colaborador

- escopo apenas dos clientes atribuidos

### Cliente

- escopo apenas da propria area de cliente

## Impacto na V2

Esses niveis precisam refletir:

- login
- menu lateral
- rotas
- consultas do banco
- filtros de clientes
- visibilidade de dashboards
- criacao de clientes
- migracao de acessos

## Regra para migracao

Na migracao da V2, precisamos preservar:

- quem e super admin
- quem e admin
- quem e colaborador
- quais clientes estao atribuidos a cada pessoa
- quais logins sao de cliente

## Regra pratica de implementacao

Na V2, o sistema deve decidir sempre com base em:

- `papel do usuario`
- `clientes atribuidos`
- `tipo de area` que ele esta tentando acessar

Ou seja:

- nao basta saber se a pessoa esta logada
- o sistema precisa saber `quem ela e` e `qual escopo ela tem`
