# Migracao do Supabase do Lovable com risco minimo

Data desta analise: 20 de agosto de 2026

## Resumo direto

Este app nao usa apenas banco de dados do Supabase. Pelo codigo, ele depende de:

- banco PostgreSQL
- autenticacao de usuarios
- buckets de arquivos
- funcoes de servidor
- RPCs SQL
- realtime
- politicas de acesso no banco

Por isso, a saida com menor risco nao e migrar direto para um banco solto da Hostinger e reescrever todo o backend de uma vez.

O caminho mais seguro e:

1. recuperar acesso administrativo ao projeto atual do Supabase
2. fazer backup completo de banco, auth e arquivos
3. subir um novo ambiente compativel
4. trocar o app para esse novo ambiente
5. so depois, se quiser, reduzir a dependencia do Supabase aos poucos

## Bloqueador principal

Sem acesso administrativo ao projeto atual do Supabase, nao existe garantia real de migracao sem perda.

O codigo local mostra a estrutura do app, mas nao entrega com seguranca:

- dados reais de todas as tabelas
- usuarios de login e hashes de senha
- arquivos dos buckets
- segredos das funcoes
- configuracoes de auth, storage e realtime

Se hoje voce nao tem a senha do projeto do Lovable, a primeira acao critica e recuperar esse acesso antes de cancelar de vez qualquer coisa ligada ao ambiente atual.

## O que este app usa hoje

### Cliente Supabase no frontend

O frontend cria um cliente direto para o Supabase em:

- [client.ts](/Users/liegipaschoalini/Desktop/project-post-ace/src/integrations/supabase/client.ts)

Ele depende de:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- em alguns pontos tambem `VITE_SUPABASE_PROJECT_ID`

### Recursos acoplados ao Supabase encontrados no codigo

- dezenas de consultas `supabase.from(...)`
- login e sessao com `supabase.auth`
- upload e leitura de arquivos com `supabase.storage`
- chamadas de funcao com `supabase.functions.invoke(...)`
- chamadas HTTP diretas para `https://<project>.supabase.co/functions/v1/...`
- escuta em tempo real com `supabase.channel(...)`
- chamadas RPC como `has_role`, `accept_proposal`, `get_public_brief_by_token`

### Buckets de arquivos identificados

- `media`
- `app-branding`

### Funcoes de servidor identificadas

- `accept-admin-invite`
- `bootstrap-admin`
- `check-brief-similarity`
- `cleanup-expired-files`
- `cleanup-old-logs`
- `cleanup-orphaned-files`
- `create-client-user`
- `create-team-member`
- `deadline-notifications`
- `delete-auth-user`
- `generate-recurring-invoices`
- `meta-auth`
- `notify-proposal-accepted`
- `send-admin-invite`
- `social-publish`
- `social-scheduler`
- `update-user-role`

### RPCs identificadas no codigo

- `accept_proposal`
- `get_approval_token_by_token`
- `get_client_by_approval_token`
- `get_proposal_by_token`
- `get_public_brief_by_token`
- `has_role`
- `mark_proposal_expired`
- `mark_proposal_viewed`
- `submit_public_brief_by_token`

### Tabelas mais usadas no app

As mais frequentes no codigo sao:

- `clients`
- `posts`
- `user_client_assignments`
- `profiles`
- `appointments`
- `invoices`
- `content_briefs`
- `user_roles`
- `admin_notifications`
- `social_reports`
- `social_posts`
- `calendar_posts`
- `ideas`
- `comments`

Tambem existem varias tabelas auxiliares para aprovacoes, billing, briefs, contratos, links, branding e automacoes.

## O que isso significa para a Hostinger

### O que a Hostinger oferece hoje

Pelas paginas oficiais consultadas em 20 de agosto de 2026:

- PostgreSQL na Hostinger e oferecido em VPS, nao em hospedagem web/cloud comum
- a abordagem da Hostinger para PostgreSQL e auto-gerenciada
- a Hostinger tambem oferece Docker e instalacao one-click de PostgreSQL/pgAdmin em VPS

Fontes:

- [Hostinger: suporte a bancos](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/)
- [Hostinger: PostgreSQL em VPS](https://www.hostinger.com/applications/postgresql)
- [Hostinger: pgAdmin em VPS](https://www.hostinger.com/applications/pgadmin)

### Conclusao pratica

Se a sua "hospedagem Hostinger" hoje for hospedagem comum com MySQL/MariaDB, isso nao e equivalente ao que seu app usa.

Para este projeto, a Hostinger so faz sentido em um destes cenarios:

1. VPS com Supabase self-hosted
2. VPS com PostgreSQL + backend proprio + storage proprio + auth propria

O cenario 2 e bem mais trabalhoso e arriscado no curto prazo.

## Opcao recomendada

### Melhor equilibrio entre seguranca e independencia

Subir um **Supabase self-hosted em uma VPS da Hostinger**.

Por que essa e a melhor rota:

- preserva o modelo atual do app
- reduz reescrita do frontend
- permite migrar banco, auth, storage e parte do comportamento com menos ruptura
- deixa os dados sob sua infraestrutura

Base oficial:

- [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting)
- [Supabase self-hosting com Docker](https://supabase.com/docs/guides/self-hosting/docker)

Observacao importante:

Mesmo com self-hosted, ainda existe trabalho tecnico. Mas ele e muito menor do que trocar tudo para um backend novo agora.

## Opcao mais barata em codigo, nao necessariamente em manutencao

Migrar para:

- PostgreSQL na Hostinger
- backend proprio em Node
- auth propria
- storage proprio
- jobs/cron proprios

Essa rota so faz sentido se voce realmente quiser sair do ecossistema Supabase de vez. Para o seu caso, eu nao recomendo como primeira etapa porque aumenta muito o risco operacional.

## Plano de migracao sem perda

### Fase 0 - Garantir acesso antes de tudo

Voce precisa obter:

- acesso ao dashboard do projeto Supabase atual
- `project ref`
- `database connection string` ou credenciais do Postgres
- chaves anon/public e service role
- acesso aos buckets de storage
- lista de variaveis de ambiente das Edge Functions

Sem isso, pare aqui. O risco de perda e alto demais.

### Fase 1 - Congelamento e backup

Antes da migracao final:

- marcar uma janela de manutencao
- evitar novos cadastros e uploads durante o corte
- exportar banco completo
- exportar usuarios de auth
- exportar arquivos dos buckets
- salvar segredos e configuracoes das funcoes

Documentacao oficial util:

- [Supabase backup/restore com CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Migrating auth users between Supabase projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

### Fase 2 - Subir o novo ambiente

Opcao A, recomendada:

- VPS na Hostinger
- Docker
- stack self-hosted do Supabase

Opcao B:

- PostgreSQL na Hostinger
- backend proprio
- servico de arquivos

### Fase 3 - Restaurar estrutura

Aplicar no novo ambiente:

- schema do banco
- migrations existentes da pasta `supabase/migrations`
- funcoes da pasta `supabase/functions`
- buckets de storage
- politicas e permissoes
- auth users

### Fase 4 - Restaurar dados

Restaurar:

- dados das tabelas
- arquivos
- usuarios
- configuracoes do sistema

Depois conferir contagem por tabela e amostras dos registros mais importantes.

### Fase 5 - Teste paralelo

Antes de apontar o app para o novo ambiente, testar:

- login
- convite de usuarios
- criacao e edicao de clientes
- criacao e aprovacao de posts
- upload de midia
- propostas publicas
- briefs publicos
- faturamento
- relatorios
- automacoes
- notificacoes

### Fase 6 - Corte final

No dia do corte:

1. congelar gravacoes no ambiente antigo
2. fazer backup final incremental
3. restaurar delta no novo ambiente
4. trocar variaveis `VITE_SUPABASE_*`
5. publicar o app
6. monitorar erros e acessos

## O que nao fazer

- nao troque para MySQL/MariaDB agora
- nao reescreva auth, storage e backend tudo no mesmo fim de semana
- nao corte o Supabase antigo antes de exportar arquivos e usuarios
- nao confie apenas nas migrations locais como se fossem o backup dos dados

## Recomendacao objetiva

Se o objetivo e sair do Lovable com o menor risco para o seu trabalho:

1. recupere acesso ao Supabase atual
2. migre primeiro para um novo Supabase sob seu controle
3. se quiser, hospede esse novo Supabase em uma VPS da Hostinger
4. so depois avalie remover Supabase por partes

## Proximo passo recomendado

Assim que voce tiver acesso ao projeto atual, o trabalho tecnico ideal e:

1. fazer um inventario final no dashboard atual
2. montar o ambiente novo
3. preparar scripts de export/import
4. trocar as variaveis do app para o novo projeto
5. validar tudo com checklist de corte

Se voce quiser, no proximo passo eu posso fazer uma destas duas coisas:

1. preparar neste projeto um plano tecnico de migracao executavel, com checklist e ordem exata dos comandos
2. com as credenciais do ambiente atual e do novo, ja adaptar o app para o novo destino e montar a sequencia de corte

## Guias detalhados criados neste projeto

- [1-recuperar-acesso-e-exportar.md](/Users/liegipaschoalini/Desktop/project-post-ace/docs/1-recuperar-acesso-e-exportar.md)
- [2-plano-novo-supabase.md](/Users/liegipaschoalini/Desktop/project-post-ace/docs/2-plano-novo-supabase.md)
- [3-avaliacao-hostinger.md](/Users/liegipaschoalini/Desktop/project-post-ace/docs/3-avaliacao-hostinger.md)
