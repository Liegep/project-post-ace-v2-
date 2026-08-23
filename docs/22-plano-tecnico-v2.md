# Plano Tecnico V2

## Objetivo

Definir uma base tecnica realista para reconstruir a V2 do app com:

- controle proprio
- menos dependencia do Lovable
- migracao segura
- boa performance no desktop e no celular
- espaco para crescer sem virar bagunca

## Leitura do projeto atual

Pelo codigo atual, o app ja usa uma base moderna que vale a pena aproveitar como referencia:

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind
- componentes Radix/Shadcn

Tambem ja existe bastante logica pronta em torno de:

- cards e kanban
- textos
- brand brain
- agenda e calendario
- faturamento
- relatorios
- links do cliente
- automacoes
- multi-idioma

## Decisao principal

Para a V2, a melhor direcao tecnica e:

- manter frontend em `React + TypeScript + Vite`
- reorganizar a arquitetura do app
- tirar a dependencia do Supabase do Lovable
- usar banco proprio
- preparar tudo para PWA

## Stack recomendada para a V2

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Shadcn/Radix para base de interface

### Editor de texto

Como o projeto ja usa TipTap e isso combina com a tela de `Textos`, vale manter:

- TipTap

### Drag and drop do Kanban

Como o projeto atual ja usa e faz sentido para esse tipo de board:

- dnd-kit

### Graficos e relatorios

Para relatorios visuais:

- Recharts

### Validacao

- Zod
- React Hook Form

## Backend recomendado

Aqui esta a parte mais importante.

### O que eu recomendo

Para a V2, eu recomendo separar o backend do frontend e usar:

- `PostgreSQL` proprio
- `backend Node.js` com `NestJS` ou `Fastify`
- `ORM Prisma`

Entre as duas opcoes de backend:

- `NestJS` e melhor se voce quiser uma estrutura mais empresarial e organizada
- `Fastify` e melhor se voce quiser algo mais leve e rapido

Para o seu caso, eu recomendaria:

- `NestJS + Prisma + PostgreSQL`

porque o sistema ja tem muitas regras, permissoes, automacoes, perfis e fluxos.

## Banco de dados

### Melhor escolha

- PostgreSQL

Motivos:

- voce ja vem de uma base parecida
- suporta bem relacoes e regras do seu sistema
- excelente para filtros, agenda, historico e permissoes
- facilita a migracao conceitual do que hoje esta no Supabase

### Onde hospedar

Se quiser usar Hostinger, a melhor forma e:

- Hostinger VPS

Nao recomendo basear essa V2 em hospedagem compartilhada simples.

Se quiser algo ainda mais confortavel para banco, existe um caminho melhor:

- app em VPS
- banco PostgreSQL gerenciado fora

Mas se a prioridade for centralizar tudo na sua estrutura:

- VPS Hostinger resolve melhor do que plano simples

## Autenticacao

Hoje o app depende muito do auth do Supabase.

Na V2, a recomendacao e trazer isso para sua propria stack.

### Caminho recomendado

- login com email e senha
- sessao via cookie seguro
- refresh controlado no backend
- recuperacao de senha
- troca de senha
- login unico com multiconta

### Perfis de acesso

Modelar claramente:

- admin
- equipe interna
- cliente

E tambem:

- atribuicoes por conta
- o que cada cliente pode ver
- o que cada cliente pode editar

## Links temporarios

Os links temporarios de aprovacao devem virar um recurso nativo do backend.

### Regras

- token unico
- expira em 7 dias
- pode ser invalidado manualmente
- registra visualizacao
- registra comentario
- registra aprovacao

## Automacoes

As automacoes nao devem ficar espalhadas no frontend.

### Recomendacao

Criar um modulo proprio de automacoes no backend.

Ele pode reagir a eventos como:

- tag adicionada
- status alterado
- cliente aprovou
- data/hora chegou
- coluna mudou

### Exemplo

- se tag `Aline aprovou`, mover para coluna `Aprovados pelo cliente`
- se status `Design pronto`, atualizar acompanhamento
- se chegou a hora agendada, arquivar card

## Agendamento

O agendamento precisa existir em dois niveis:

### 1. Agendamento funcional

Salvar:

- data
- hora
- timezone
- estado do agendamento

### 2. Execucao automatica

Precisa de um processo de fundo para checar e executar a regra.

### Solucao recomendada

- cron job
- ou fila de tarefas com worker

Para a V2, a melhor base e:

- fila simples + worker

porque depois isso ajuda tambem em:

- envio de notificacoes
- vencimento de links
- automacoes
- arquivamento automatico
- geracao de faturas recorrentes

## Armazenamento de arquivos

Hoje o sistema usa storage do Supabase.

Na V2, recomendo separar isso tambem.

### Opcoes praticas

- S3 compatível
- Cloudflare R2
- Backblaze B2

Se a ideia for custo + simplicidade, eu recomendaria:

- Cloudflare R2

Motivos:

- bom custo
- funciona bem para midia
- bom para servir arquivos do app

## PWA

O projeto atual nao parece estar fechado como PWA ainda.

Na V2, isso deve entrar desde o inicio.

### Recomendacao

- Vite PWA plugin
- manifest
- icones proprios
- cache basico para shell do app
- instalacao no celular

### Cuidado

Nao exagerar em cache de dados dinamicos do Kanban.

O ideal e:

- cache de interface e assets
- dados sempre sincronizados com servidor

## Multi-idioma

Como o app ja tem estrutura de i18n, vale manter esse conceito.

### Recomendacao

- continuar com dicionarios por idioma
- centralizar chaves de traducao
- tratar idioma por conta no portal do cliente

Idiomas ja previstos:

- portugues
- ingles
- italiano
- espanhol
- sueco

## Estrutura de modulos recomendada

No backend, eu dividiria assim:

- auth
- users
- clients
- workspaces
- columns
- cards
- approvals
- temporary-links
- schedules
- tracking
- automations
- text-contents
- brand-brain
- billing
- reports
- files
- notifications
- audit-log

## Estrutura de frontend recomendada

No frontend, a V2 deve nascer mais modular que a atual.

### Sugestao

- `app`
- `modules`
- `shared`
- `ui`
- `lib`

### Exemplo de modulos

- `modules/admin`
- `modules/client-portal`
- `modules/kanban`
- `modules/cards`
- `modules/texts`
- `modules/brand-brain`
- `modules/billing`
- `modules/reports`
- `modules/auth`

## Estrategia de reconstrucao

Eu nao recomendo tentar reaproveitar o projeto inteiro como esta.

### Melhor caminho

Fazer uma reconstrução controlada:

1. manter o projeto atual como referencia funcional
2. extrair regras de negocio importantes
3. redesenhar o banco
4. criar a nova API
5. criar a nova interface por modulos
6. migrar dados
7. validar com ambiente paralelo
8. virar a chave quando estiver seguro

## Estrategia de migracao sem perda

### Fase 1

Congelar e mapear:

- tabelas
- buckets
- links
- usuarios
- permissoes
- relacoes

### Fase 2

Exportar:

- banco
- arquivos
- configuracoes principais

### Fase 3

Importar para a nova base com scripts controlados.

### Fase 4

Rodar validacoes:

- contagem de clientes
- contagem de cards
- contagem de arquivos
- contagem de textos
- contagem de faturas
- verificacao de links e permissoes

## Ordem recomendada de implementacao

Para reduzir risco, eu construiria nessa ordem:

1. auth e perfis
2. clientes e multiconta
3. kanban base
4. cards e comentarios
5. aprovacoes e links temporarios
6. agendamento e arquivamento
7. acompanhamento e automacoes
8. textos
9. brand brain
10. faturamento
11. relatorios
12. PWA e refinamentos finais

## Minha recomendacao final

Se a ideia e estrear um app novo no seu dominio, com seguranca e sem ficar presa a plataforma:

- manter React no frontend
- reconstruir o backend fora do Supabase do Lovable
- usar PostgreSQL proprio
- hospedar em VPS
- preparar desde o inicio para PWA
- migrar por etapas, sem desligar o atual cedo demais

## Resultado esperado

Com essa arquitetura, a V2 fica:

- sua de verdade
- mais profissional
- mais facil de evoluir
- menos vulneravel a bloqueios de plataforma
- pronta para crescer com mais clareza
