# Extrator das Contas Prioritarias

## Objetivo

Este extrator foi preparado para puxar a primeira leva de dados das contas prioritarias sem depender do painel do Supabase.

Arquivo:

- `scripts/export-priority-clients.mjs`

## O que ele busca

- `clients`
- `profiles`
- `user_client_assignments`
- `columns`
- `posts`
- `comments`
- `calendar_posts`
- `media-manifest`

## Contas padrao configuradas

- Aplikasi
- Podcast Elite Leader
- Podcast Lider de Elite
- Minas Home
- Doutora Patricia

## Como ele funciona

O script usa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

e pode autenticar com um login valido do proprio app se estas variaveis forem fornecidas:

- `EXPORT_ADMIN_EMAIL`
- `EXPORT_ADMIN_PASSWORD`

## Por que usar login admin

Com a chave publishable sozinha, parte da leitura pode depender das permissoes publicas do schema.

Com sessao autenticada de admin:

- a extracao fica mais confiavel
- aumenta a chance de puxar atribuicoes e perfis corretamente

## Saida esperada

Por padrao, a exportacao vai para:

- `migration-export/priority-clients`

Arquivos gerados:

- `summary.json`
- `clients.json`
- `profiles.json`
- `user_client_assignments.json`
- `columns.json`
- `posts.json`
- `comments.json`
- `calendar_posts.json`
- `media-manifest.json`

## Modo de teste

O script aceita `dry-run`.

Isso serve para:

- localizar as contas
- medir volume
- conferir role detectado
- ver se algo esta faltando

## Parametros previstos

- `--dry-run`
- `--clients`
- `--out-dir`

## Exemplo conceitual de uso

### Dry run

Rodar em modo de descoberta para ver:

- contas encontradas
- contas faltando
- quantidades de posts, comentarios, colunas e calendario

### Export final

Depois do dry run e da validacao do acesso:

- gerar os JSONs
- congelar o backup

## Importante

O script foi criado como base segura.

Ele nao substitui:

- validacao manual
- conferencia das contas
- revisao dos arquivos de midia

## Papel dos niveis de acesso

Na V2, os papeis fixos sao:

- super admin
- admin
- colaborador
- cliente

Na extracao, isso importa principalmente para:

- entender quem esta vinculado a cada conta
- preservar atribuicoes
- reconstruir login e escopo depois
