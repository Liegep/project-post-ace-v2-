# 3. Avaliacao da Hostinger para este app

Data desta avaliacao: 20 de agosto de 2026

## Resposta curta

Se a sua Hostinger atual for hospedagem comum, ela **nao** e o destino certo para este app do jeito que ele existe hoje.

Se voce usar **VPS na Hostinger**, ai sim ela pode servir bem.

## Por que isso importa

Seu app nao depende so de um banco relacional. Ele precisa de:

- PostgreSQL
- auth
- storage de arquivos
- funcoes de servidor
- realtime
- jobs agendados

## O que a Hostinger informa hoje

Segundo a documentacao oficial consultada em 20 de agosto de 2026:

- PostgreSQL e suportado em **VPS Hosting**
- PostgreSQL nao e a opcao natural da hospedagem Web/Cloud comum
- Web/Cloud usam MariaDB
- a Hostinger oferece Docker/VPS e catalogo de apps para infraestrutura auto-gerenciada

Fontes:

- [Which databases and data tools are supported at Hostinger](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/)
- [Which Database Management System is used at Hostinger](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/)
- [PostgreSQL on Hostinger VPS](https://www.hostinger.com/applications/postgresql)
- [Hostinger Docker catalog applications](https://www.hostinger.com/support/hostinger-docker-catalog-applications/)

## Traduzindo isso para o seu caso

### Se voce tem Hostinger Web Hosting ou Cloud Hosting

Nao recomendo migrar este app para la como backend principal agora, porque:

- o banco padrao tende a ser MariaDB
- isso nao substitui seu uso atual de PostgreSQL + auth + storage + functions
- voce teria que reescrever muita coisa

### Se voce tem Hostinger VPS

Ai existem duas opcoes viaveis:

1. VPS com Supabase self-hosted
2. VPS com stack propria em Node + Postgres + storage + auth

A opcao 1 e a mais segura para este projeto.

## Matriz de decisao

### Opcao A - Novo Supabase hospedado pela propria Supabase

Vantagens:

- menor risco
- migracao mais rapida
- menos manutencao

Desvantagens:

- voce continua usando Supabase como fornecedor

### Opcao B - Supabase self-hosted em VPS da Hostinger

Vantagens:

- dados sob seu controle
- baixo retrabalho no app
- boa compatibilidade com o projeto atual

Desvantagens:

- mais manutencao tecnica
- backup e monitoramento ficam com voce

### Opcao C - Banco da Hostinger + backend refeito

Vantagens:

- independencia mais ampla

Desvantagens:

- maior risco
- maior tempo
- maior custo de manutencao
- mais chance de regressao

## Minha recomendacao objetiva

Para o seu app de trabalho, eu faria assim:

1. curto prazo: novo projeto Supabase seu, para sair do risco atual rapido
2. medio prazo: decidir se quer ficar nesse novo Supabase ou mover para Supabase self-hosted em VPS da Hostinger

Se voce quer obrigatoriamente centralizar tudo na Hostinger, a recomendacao muda para:

1. contratar ou usar VPS
2. subir Supabase self-hosted
3. migrar com backup completo

## Como descobrir se a sua Hostinger atual serve

No painel da Hostinger, confira se o plano atual e:

- `Web Hosting`
- `Cloud Hosting`
- `VPS`

Se for `Web Hosting` ou `Cloud Hosting`:

- nao use esse plano como backend principal deste app

Se for `VPS`:

- o plano provavelmente serve como base
- ainda precisa validar memoria, CPU, disco e backup

## Minimo prudente para seguir com VPS

Antes de decidir a VPS, confirme:

- Docker liberado
- acesso root/SSH
- backup automatizado
- espaco para banco + uploads
- folga de memoria para Postgres, auth e functions

## Conclusao

Hostinger pode sim ser parte da solucao, mas **nao qualquer plano**.

Para este projeto, a Hostinger faz sentido se for usada como infraestrutura de VPS. Se for hospedagem comum, eu nao recomendo usar como destino direto desta migracao.
