# 2. Plano tecnico para migrar para um novo Supabase seu

Data desta analise: 20 de agosto de 2026

## Objetivo

Levar este app para um novo ambiente sob seu controle, com a menor reescrita possivel e com corte seguro.

## Recomendacao principal

Para este projeto, a melhor rota e:

- criar um novo projeto Supabase seu

ou

- subir Supabase self-hosted em VPS

Isso reduz o risco porque o codigo atual ja foi construido em volta do modelo do Supabase.

Bases oficiais:

- [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting)
- [Supabase self-hosting com Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)

## O que este app precisa no novo ambiente

### Banco

- PostgreSQL
- schema atual das migrations
- RLS e policies
- funcoes SQL e RPCs
- extensoes usadas pelas migrations

### Auth

- usuarios
- hashes de senha
- sessoes novas apos o corte

### Storage

- bucket `media`
- bucket `app-branding`

### Edge Functions

Estas funcoes existem no projeto e precisam ser reimplantadas:

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

### Realtime

O app usa realtime ao menos para:

- `social_posts`
- `posts`
- `admin_notifications`
- `post_feedback`

## Segredos a recriar

No novo ambiente, voce vai precisar reconfigurar pelo menos:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `LOVABLE_API_KEY`

Observacao:

`LOVABLE_API_KEY` sugere uma dependencia externa no fluxo de similaridade de brief. Vale revisar se voce quer manter isso ou trocar depois.

## Mudancas no app

### Variaveis do frontend

O frontend depende de:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Arquivos principais:

- [client.ts](/Users/liegipaschoalini/Desktop/project-post-ace/src/integrations/supabase/client.ts)
- [MetaConnectPanel.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/components/social/MetaConnectPanel.tsx)
- [SocialPostDialog.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/components/social/SocialPostDialog.tsx)
- [useSocialPosts.ts](/Users/liegipaschoalini/Desktop/project-post-ace/src/hooks/useSocialPosts.ts)
- [SocialCallbackPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/SocialCallbackPage.tsx)

### O que muda no codigo

Se o novo destino continuar sendo Supabase:

- quase nada no frontend
- troca de variaveis
- redeploy
- validacao

Se o novo destino nao for Supabase:

- quase tudo do backend muda
- parte do frontend tambem muda
- risco sobe bastante

## Sequencia de migracao recomendada

### Fase A - Novo ambiente

1. criar o novo projeto ou VPS
2. criar buckets
3. aplicar migrations
4. implantar funcoes
5. configurar segredos

### Fase B - Restauracao

1. restaurar schema
2. restaurar dados
3. restaurar `auth`
4. subir arquivos
5. revisar policies e RPCs

### Fase C - Configuracao do app

1. preparar novo `.env`
2. trocar `VITE_SUPABASE_*`
3. publicar ambiente de teste
4. validar fluxos

### Fase D - Corte

1. congelar escrita no ambiente antigo
2. backup final
3. restaurar delta final
4. trocar producao
5. monitorar

## Checklist de testes do app

### Login e usuarios

- login admin
- login equipe
- login cliente
- reset de senha
- convite de admin
- criacao de membro
- alteracao de papeis
- remocao de usuario

### Clientes e operacao

- listar clientes
- criar cliente
- editar cliente
- anexar logo
- configurar acessos

### Conteudo e midia

- criar post
- subir imagem
- editar post
- aprovar post
- mover status
- verificar historico

### Publico externo

- abrir proposta publica
- aceitar proposta
- abrir brief publico
- enviar brief com anexo

### Financeiro

- listar invoices
- criar invoice
- anexar arquivo
- gerar recorrencia

### Social

- conectar Meta
- listar paginas
- criar social post
- aprovar
- agendar
- publicar

## Ordem de implantacao sugerida

1. banco e auth
2. storage
3. functions
4. realtime
5. cron
6. frontend

## Decisao recomendada para este projeto

### Melhor caminho de curto prazo

Criar um novo Supabase seu e apontar o app para ele.

### Melhor caminho de independencia total

Subir Supabase self-hosted em VPS sob sua conta.

### Caminho que eu nao recomendo agora

Migrar direto para banco solto + backend proprio + auth propria, porque o app esta muito acoplado ao Supabase.

## Resultado esperado

Se essa migracao for feita nessa ordem:

- usuarios mantem senha
- arquivos continuam acessiveis
- o frontend quase nao precisa de reescrita
- o risco de parada e bem menor
