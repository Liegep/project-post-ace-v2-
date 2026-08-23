# Roteiro Tecnico de Extracao

## Objetivo

Definir como extrair os dados das contas prioritarias do ambiente atual sem depender do painel do Supabase.

Contas prioritarias:

- Aplikasi
- Podcast Elite Leader
- Podcast Lider de Elite
- Minas Home
- Doutora Patricia

## Cenario real atual

Hoje o projeto usa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Ou seja:

- o frontend ja sabe conversar com o Supabase
- o app atual consegue ler e gravar dados por meio do proprio login do sistema

## O que isso significa

Mesmo sem senha do painel do Supabase, ainda existem caminhos tecnicos reais para extrair os dados:

### Caminho 1

Usar o proprio acesso autenticado ao app atual.

### Caminho 2

Usar o que estiver liberado por leitura publica/anonima no schema atual.

### Caminho 3

Combinar os dois:

- dados publicos via chave publishable
- dados protegidos via sessao autenticada do app

## Caminho recomendado

O caminho mais seguro para esse projeto e:

- usar a chave que o app ja tem
- autenticar com um login admin valido no proprio app
- extrair por script

Assim:

- nao dependemos do painel do Supabase
- nao dependemos da senha do projeto
- aproveitamos as permissoes que ja existem no sistema

## O que precisa existir para a extracao

### Minimo necessario

- o projeto atual funcionando localmente
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- um login valido no app atual com acesso admin

## Dados que podem ser puxados

### Com sessao autenticada no app

Devemos conseguir puxar:

- `clients`
- `profiles`
- `user_client_assignments`
- `columns`
- `posts`
- `comments`
- `calendar_posts`

### Com chave publishable sem login

Pode ser possivel puxar parte de:

- `clients`
- `columns`
- `posts`
- `comments`

Mas isso depende do RLS e nao deve ser a estrategia principal para login e atribuicoes.

## Estrategia operacional recomendada

### Etapa 1

Rodar a extracao a partir de um script local separado do app visual.

### Etapa 2

Autenticar esse script com um usuario admin do proprio sistema.

### Etapa 3

Buscar primeiro os `client_id` das contas prioritarias.

### Etapa 4

Puxar em cascata os dados relacionados.

## Ordem tecnica da extracao

### 1. Buscar contas prioritarias

Tabela:

- `clients`

Filtro:

- `name`
- `slug`

Objetivo:

- descobrir os `id` reais dessas contas

### 2. Buscar usuarios vinculados

Tabelas:

- `user_client_assignments`
- `profiles`

Filtro:

- `client_id` das contas prioritarias

Objetivo:

- mapear login por conta
- mapear multiconta

### 3. Buscar colunas

Tabela:

- `columns`

Filtro:

- `client_id` das contas prioritarias

Objetivo:

- preservar a estrutura do quadro

### 4. Buscar posts

Tabela:

- `posts`

Filtro:

- `client_id` das contas prioritarias

Sem excluir:

- `archived = false`
- `archived = true`

Ou seja:

- ativos e arquivados

### 5. Buscar comentarios

Tabela:

- `comments`

Filtro:

- `post_id` dos posts extraidos

### 6. Buscar calendario

Tabela:

- `calendar_posts`

Filtro:

- `client_id` das contas prioritarias

## Campos exatos mais importantes

### clients

- `id`
- `name`
- `slug`
- `logo_url`
- `locale`
- `client_portal_title`
- `tracking_enabled`
- `tracking_visible_to_client`
- `tracking_column_ids`
- `show_archived_to_client`
- `show_upcoming_posts`
- `allow_client_edit_caption`
- `allow_client_create_post`
- `allow_client_create_tags`
- `allow_client_download`
- `allow_client_edit_brand_brain`
- `require_login`
- `link_expiration_days`
- `calendar_color`
- `calendar_legend`
- `owner_id`
- `shared`

### profiles

- `id`
- `full_name`
- `email`
- `avatar_url`
- `role`

### user_client_assignments

- `id`
- `user_id`
- `client_id`
- `assigned_by`
- `created_at`

### columns

- `id`
- `client_id`
- `name`
- `position`
- `color`
- `visible_to_client`
- `trello_list_id`

### posts

- `id`
- `client_id`
- `column_id`
- `title`
- `caption`
- `image_url`
- `media_type`
- `media_urls`
- `art_type`
- `tags`
- `status`
- `position`
- `deadline`
- `archived`
- `archived_at`
- `published_at`
- `event_color`
- `client_label`
- `retain_files`
- `created_at`
- `updated_at`

### comments

- `id`
- `post_id`
- `author`
- `text`
- `user_id`
- `created_at`

### calendar_posts

- `id`
- `client_id`
- `title`
- `caption`
- `media_type`
- `media_urls`
- `publish_date`
- `publish_time`
- `status`
- `event_color`
- `created_by`
- `created_at`
- `updated_at`

## Midia e arquivos

Para cada post, a extracao precisa mapear:

- `image_url`
- itens dentro de `media_urls`

Para cada evento de calendario:

- itens dentro de `media_urls`

## Regra importante sobre arquivos

Nao basta exportar apenas os dados de banco.

Tambem precisamos gerar uma lista de arquivos de midia associados a:

- posts ativos
- posts arquivados
- eventos de calendario

## Formato recomendado de saida

Para ficar limpo e auditavel, exportar em arquivos separados por tipo:

- `clients.json`
- `profiles.json`
- `user_client_assignments.json`
- `columns.json`
- `posts.json`
- `comments.json`
- `calendar_posts.json`
- `media-manifest.json`

## O que deve entrar no media-manifest

Lista unica com:

- URL original
- origem do arquivo
- tipo
- qual conta usa
- qual post usa

Exemplo de origem:

- `posts.image_url`
- `posts.media_urls`
- `calendar_posts.media_urls`

## Validacoes depois da extracao

### Validacao 1

Conferir se todas as contas prioritarias apareceram.

### Validacao 2

Conferir se todo `post.client_id` pertence a uma das contas escolhidas.

### Validacao 3

Conferir se todo `comment.post_id` pertence a um post extraido.

### Validacao 4

Conferir se os `user_client_assignments` batem com as contas extraidas.

### Validacao 5

Conferir se a lista de arquivos nao tem URLs quebradas ou vazias.

## Limites e cuidados

### Senhas

As senhas atuais nao devem ser esperadas como exportaveis em texto legivel.

### Painel do Supabase

Nao e necessario ter painel para essa etapa, se o login no app funcionar e as chaves do frontend continuarem validas.

### Sessao do app

Se o script usar login real do app, ele precisa:

- entrar
- manter sessao
- rodar a extracao

## Melhor forma de executar

Eu recomendo fazer isso em duas camadas:

### Camada 1: descoberta

- localizar as contas
- listar os volumes
- validar o acesso

### Camada 2: exportacao final

- exportar tudo em JSON
- salvar manifest de midia
- congelar copia do backup

## Resultado esperado

Ao fim desse roteiro, a gente deve ter uma extracao local independente do painel do Supabase, pronta para alimentar a primeira migracao da V2.
