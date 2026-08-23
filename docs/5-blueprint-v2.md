# 5. Blueprint da V2

Data deste blueprint: 20 de agosto de 2026

## Objetivo

Criar uma `v2` do app, sob seu controle, com estreia no seu proprio dominio em **janeiro de 2027**, depois das ferias de dezembro de 2026.

Este blueprint parte de uma decisao importante:

- a `v2` nao vai copiar tudo
- a `v2` vai nascer melhor, mais enxuta e mais facil de manter

## Visao do produto

A `v2` deve ser o sistema central da sua operacao com clientes, organizando:

- clientes
- planejamento editorial
- producao de conteudo
- aprovacao
- portal do cliente
- historico e rastreabilidade

O novo produto precisa resolver o essencial do seu dia de trabalho com menos complexidade acumulada.

## Principios da V2

1. o coracao do negocio vem primeiro
2. tudo que envolve cliente precisa ser simples e bonito
3. regras criticas ficam centralizadas no backend
4. modulos devem crescer sem virar telas-monstro
5. a versao 1 da `v2` precisa ser confiavel antes de ser completa

## Escopo da estreia

### Entra na estreia

1. autenticacao
2. perfis e permissoes
3. cadastro de clientes
4. dashboard principal
5. quadro de posts por cliente
6. comentarios internos
7. solicitacao de alteracoes
8. aprovacao do cliente
9. calendario editorial
10. uploads de imagem e video
11. briefs de conteudo
12. portal do cliente
13. notificacoes essenciais
14. historico basico das mudancas

### Fica para fase 2

1. propostas
2. contratos
3. relatorios
4. quick notes
5. ideias
6. design briefs avancados
7. biblioteca de links e assets

### Fica para fase 3

1. faturamento completo
2. social publishing automatizado
3. integracao Meta mais profunda
4. automacoes complexas
5. relatórios executivos avancados

## Perfis de usuario

### Super admin

- controla a operacao inteira
- ve todos os clientes
- configura acessos
- acompanha indicadores globais

### Admin

- gerencia clientes
- cria e organiza posts
- acompanha aprovacoes
- interage com equipe e cliente

### Colaborador

- produz conteudo
- comenta
- atualiza status
- envia itens para revisao

### Cliente

- acessa apenas o proprio portal
- comenta
- aprova
- pede alteracao
- visualiza calendario e materiais liberados

## Mapa de modulos

### Modulo 1: acesso

- login
- recuperar senha
- perfil
- sessao
- papeis

### Modulo 2: clientes

- lista de clientes
- criar cliente
- editar cliente
- branding do cliente
- membros vinculados

### Modulo 3: operacao de posts

- colunas
- cards
- anexos
- tags
- status
- comentarios
- historico

### Modulo 4: calendario

- visao mensal
- agendamentos
- filtro por cliente
- filtro por status

### Modulo 5: briefs

- criar brief
- anexar referencias
- atribuir responsavel
- acompanhar status

### Modulo 6: portal do cliente

- login do cliente
- feed de posts
- cards para aprovar
- comentarios
- calendario do cliente

### Modulo 7: notificacoes

- itens pendentes
- alteracao solicitada
- aprovacao recebida
- lembretes basicos

## Mapa de telas

### Backoffice

1. login
2. dashboard geral
3. lista de clientes
4. detalhe do cliente
5. board de posts do cliente
6. detalhe do post
7. calendario
8. briefs
9. detalhe do brief
10. equipe e acessos
11. perfil/configuracoes

### Portal do cliente

1. login do cliente
2. home do cliente
3. lista/board de posts
4. detalhe do post para aprovar
5. calendario do cliente
6. briefs visiveis ao cliente

## Fluxos principais

### Fluxo 1: criacao e aprovacao de post

1. admin ou colaborador cria post
2. adiciona titulo, legenda, midia e data
3. item vai para revisao interna
4. item e enviado para cliente
5. cliente aprova ou pede alteracao
6. item volta ajustado ou e concluido

### Fluxo 2: brief

1. equipe cria brief
2. define cliente, objetivo, data e anexos
3. atribui responsavel
4. responsavel executa
5. brief vira apoio para novo post

### Fluxo 3: cliente

1. cliente entra no portal
2. visualiza posts pendentes
3. abre detalhe
4. comenta ou aprova
5. acompanha calendario futuro

## Estrutura de dados inicial

### Tabelas centrais

- `users`
- `profiles`
- `roles`
- `clients`
- `client_members`
- `posts`
- `post_media`
- `post_comments`
- `post_status_history`
- `post_tags`
- `columns`
- `briefs`
- `brief_comments`
- `notifications`

### Tabelas de apoio

- `client_settings`
- `client_branding`
- `file_uploads`
- `audit_logs`

## Entidades mais importantes

### Cliente

- nome
- slug
- logo
- idioma
- configuracoes do portal

### Post

- cliente
- titulo
- legenda
- status interno
- status para cliente
- data
- coluna
- tags

### Brief

- cliente
- titulo
- descricao
- responsavel
- anexos
- status

## Regras de produto

1. cliente nunca ve o que nao foi liberado
2. comentarios precisam guardar autor e data
3. toda mudanca importante gera historico
4. upload de arquivos precisa estar desacoplado da tela
5. board e calendario precisam ler a mesma fonte de verdade

## Estrategia de migracao de dados

### Migrar na estreia

- usuarios ativos
- clientes ativos
- posts ativos e recentes
- comentarios essenciais
- briefs ativos
- anexos relevantes

### Migrar depois

- historico antigo profundo
- ideias antigas
- dados pouco acessados
- modulos descontinuados

### Regra de ouro

Nao migrar "tudo porque sim". Migrar o que sustenta a operacao e o contexto necessario.

## Stack recomendada

### Opcao mais equilibrada

- frontend moderno React/Next.js
- Postgres proprio
- auth propria ou stack compativel sob seu controle
- storage proprio
- deploy com dominio proprio

### Direcao de arquitetura

- backend modular
- servicos por dominio
- API clara
- permissao centralizada
- componentes menores e mais reaproveitaveis

## Roadmap proposto

### Fase 0: definicao

Periodo:

- 20 de agosto de 2026 a 31 de agosto de 2026

Entregas:

- blueprint fechado
- definicao do dominio
- definicao da stack
- escopo congelado da estreia

### Fase 1: fundacao

Periodo:

- 1 de setembro de 2026 a 30 de setembro de 2026

Entregas:

- auth
- usuarios
- permissoes
- clientes
- layout base
- design system glassmorphism

### Fase 2: nucleo operacional

Periodo:

- 1 de outubro de 2026 a 31 de outubro de 2026

Entregas:

- board de posts
- detalhe do post
- comentarios
- status
- uploads

### Fase 3: cliente e calendario

Periodo:

- 1 de novembro de 2026 a 30 de novembro de 2026

Entregas:

- portal do cliente
- aprovacao
- calendario editorial
- notificacoes essenciais

### Fase 4: briefs e preparo de corte

Periodo:

- 1 de dezembro de 2026 a 20 de dezembro de 2026

Entregas:

- briefs
- migracao inicial
- testes com base real
- ajustes finais

### Fase 5: pausa e estreia

Periodo:

- ferias em dezembro de 2026
- estreia em janeiro de 2027

Entregas:

- deploy no dominio proprio
- operacao assistida
- migracao complementar

## Riscos que precisamos evitar

1. tentar refazer financeiro e social publishing cedo demais
2. deixar escopo crescer durante a construcao
3. migrar todos os dados sem criterio
4. reproduzir telas gigantes do app atual
5. misturar regras do negocio na interface

## Criterios de sucesso da estreia

1. voce consegue operar clientes reais na `v2`
2. cliente consegue aprovar sem confusao
3. board, calendario e portal concordam entre si
4. arquivos funcionam sem sustos
5. acessos e permissoes estao seguros

## Minha recomendacao final

Se a meta e chegar bem em janeiro de 2027, a `v2` precisa ser tratada como um novo produto:

- mais bonito
- mais simples
- mais seu
- menos dependente de gambiarra acumulada

Este blueprint ja e uma base boa para virar:

1. mapa de telas detalhado
2. backlog
3. modelagem de banco
4. prototipo navegavel
