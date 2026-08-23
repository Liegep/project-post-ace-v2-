# 1. Recuperar acesso e exportar sem perder dados

Data desta analise: 20 de agosto de 2026

## Objetivo

Recuperar o controle do ambiente atual e sair dele com:

- banco completo
- usuarios de login
- arquivos dos buckets
- segredos das funcoes
- confirmacao de contagem dos dados

## O que ja sabemos deste projeto

O repositorio local mostra que o app atual usa um projeto Supabase com o `project_id`:

- `cidoydrpqzpiqewultok`

Origem:

- [config.toml](/Users/liegipaschoalini/Desktop/project-post-ace/supabase/config.toml)

## Primeiro caminho: tentar recuperar o proprio projeto atual

Se o projeto ainda existir no Supabase, tente nesta ordem:

1. entrar na conta de email usada no Lovable quando o projeto foi criado
2. tentar login no Lovable e ver se ainda existe referencia ao projeto
3. tentar login direto no Supabase com esse mesmo email
4. procurar no email por:
   - `Supabase`
   - `Lovable`
   - `project created`
   - `invite`
   - `organization`
5. procurar em gerenciador de senhas por `supabase.com`

Se houver acesso a alguma organizacao do Supabase, verificar:

- Settings > General
- Project Reference
- Database > Backups
- Database > Roles
- Authentication > Users
- Storage
- Edge Functions
- Project Settings > API

## Segundo caminho: pedir transferencia do projeto

Se o projeto esta em uma conta de terceiros, a melhor saida e pedir:

- transferencia do projeto para a sua organizacao no Supabase
- ou te adicionarem como admin temporariamente

Base oficial:

- [Supabase Project Transfers](https://supabase.com/docs/guides/platform/project-transfer)

## O que voce precisa obter do ambiente atual

Antes de mexer em qualquer migracao, voce precisa sair com estes itens:

### Acesso administrativo

- dashboard do Supabase
- permissao de admin/owner

### Credenciais

- `project ref`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` ou chave publishable
- `SUPABASE_SERVICE_ROLE_KEY`
- string de conexao do Postgres

### Dados e estrutura

- backup do banco
- usuarios de `auth`
- buckets e arquivos
- lista de variaveis de ambiente das Edge Functions
- agendamentos/cron

### Checklist funcional

- lista de usuarios ativos
- clientes principais
- ultimos posts
- uploads importantes
- propostas/briefs publicos

## Exportacao recomendada

### A. Banco

Melhor cenario:

- usar dashboard ou CLI com acesso ao banco

Documentacao oficial:

- [Supabase backup/restore com CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction)

Se voce tiver a string do banco, o fluxo seguro e:

1. exportar schema
2. exportar dados
3. exportar `auth`
4. guardar tudo fora do laptop tambem

Arquivos sugeridos:

- `schema.sql`
- `data.sql`
- `auth.sql`
- `storage-objects.csv` ou pasta dos arquivos

### B. Usuarios e senhas

Este ponto e critico.

O Supabase documenta que e possivel migrar as tabelas do schema `auth`, inclusive usuarios e hashes de senha, para outro projeto Supabase. Isso evita que seus usuarios precisem redefinir senha.

Base oficial:

- [Migrating Auth Users Between Supabase Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

Se voce **nao** exportar o `auth` corretamente:

- seus usuarios podem perder o login
- voce pode ser forcada a redefinir senhas manualmente

### C. Arquivos

Seu app usa pelo menos estes buckets:

- `media`
- `app-branding`

Pelo codigo, ha muitos uploads e leituras de `media`, entao o storage precisa ser exportado com tanta prioridade quanto o banco.

Sugestao pratica:

1. listar todos os objetos por bucket
2. baixar tudo para uma pasta espelho
3. salvar manifest com caminho, tamanho, mime type e data
4. verificar quantidade de arquivos antes e depois

### D. Variaveis secretas das funcoes

Pelo codigo, as funcoes dependem pelo menos destas variaveis:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `LOVABLE_API_KEY`

Se qualquer uma faltar na migracao, partes do app vao parar de funcionar.

## Ordem segura de backup

1. recuperar acesso admin
2. listar segredos e funcoes
3. exportar banco
4. exportar `auth`
5. exportar storage
6. registrar contagem por tabela
7. registrar contagem por bucket
8. congelar app para escrita no momento do corte
9. fazer backup final incremental

## Como validar que o backup esta completo

Antes de desligar o ambiente antigo, comparar:

- total de usuarios
- total de clientes
- total de posts
- total de briefs
- total de propostas
- total de invoices
- total de arquivos em `media`
- total de arquivos em `app-branding`

Tambem abrir manualmente:

- 3 clientes importantes
- 3 posts recentes
- 3 uploads de arquivo
- 1 proposta publica
- 1 brief publico

## Se voce nao conseguir acesso admin

Sem acesso admin, as opcoes mais realistas sao:

1. pedir exportacao ao dono atual do projeto
2. pedir transferencia do projeto
3. manter o ambiente atual no ar so para leitura e reconstruir por fora

Para o seu caso, a opcao 3 deve ser ultima alternativa, porque aumenta muito o risco e o retrabalho.

## Mensagem pronta para pedir acesso

Use algo assim:

:::writing{variant="chat_message" id="41280"}
Preciso de acesso administrativo temporario ao projeto Supabase deste app ou da transferencia dele para a minha conta. Vou migrar a infraestrutura para um ambiente sob meu controle e preciso fazer backup completo de banco, usuarios, arquivos, funcoes e segredos sem risco de perda. Se for mais simples, pode me adicionar como admin apenas pelo tempo necessario para exportar tudo com seguranca.
:::

## Saida desta etapa

Voce so pode considerar a etapa 1 concluida quando tiver:

- acesso admin
- dump do banco
- export do auth
- copia dos buckets
- segredos anotados
- contagens conferidas
