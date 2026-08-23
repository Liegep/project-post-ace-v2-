# Checklist Operacional da Migracao

## Objetivo

Executar a primeira leva da migracao curada da V2 com foco nas contas prioritarias:

- Aplikasi
- Podcast Elite Leader
- Podcast Lider de Elite
- Minas Home
- Doutora Patricia

## Escopo desta primeira leva

Migrar:

- dados da conta
- logins vinculados
- colunas
- posts ativos
- posts arquivados
- comentarios
- calendarios do Kanban

Nao migrar agora:

- atividades
- logs detalhados
- historico completo de auditoria

## Fase 1: Preparacao

### 1. Confirmar lista final de contas

- validar os nomes finais das contas prioritarias
- confirmar se existe alguma conta duplicada ou com nome parecido
- anotar slug e nome exato de cada uma

### 2. Criar pasta de controle da migracao

- separar um lugar para guardar exportacoes
- separar um lugar para guardar relatorios de validacao
- separar um lugar para guardar backups brutos

### 3. Definir regra de corte

- confirmar que o escopo inclui ativos + arquivados
- confirmar que inclui comentarios
- confirmar que inclui calendarios
- confirmar que nao inclui activities/logs

## Fase 2: Identificacao tecnica

### 4. Identificar os `client_id` das contas prioritarias

Precisamos localizar no banco atual:

- `id`
- `name`
- `slug`

da lista:

- Aplikasi
- Podcast Elite Leader
- Podcast Lider de Elite
- Minas Home
- Doutora Patricia

### 5. Identificar os usuarios ligados a essas contas

Buscar:

- perfis
- emails
- nomes
- atribuicoes em `user_client_assignments`

## Fase 3: Backup bruto antes de filtrar

### 6. Fazer backup bruto dos dados das contas prioritarias

Extrair sem transformar ainda:

- clientes
- perfis ligados
- atribuicoes
- colunas
- posts
- comentarios
- calendar_posts

### 7. Fazer backup bruto dos arquivos de midia ligados a esses posts

- imagens principais
- `media_urls`
- arquivos necessarios dos arquivados

### 8. Preservar esse backup antes de qualquer limpeza

- nao sobrescrever
- nao editar o bruto
- manter copia segura

## Fase 4: Extracao filtrada

### 9. Extrair dados de `clients`

Trazer:

- identidade da conta
- idioma
- configuracoes importantes do portal
- tracking
- permissoes principais

### 10. Extrair dados de `profiles`

Trazer:

- `id`
- `full_name`
- `email`
- `avatar_url`
- `role`

### 11. Extrair dados de `user_client_assignments`

Trazer:

- vinculos entre usuarios e contas
- casos de multiconta

### 12. Extrair dados de `columns`

Trazer:

- nome
- posicao
- cor
- visibilidade para cliente

### 13. Extrair dados de `posts`

Trazer:

- ativos
- arquivados
- coluna
- titulo
- legenda
- midia
- tags
- status
- datas
- horarios

### 14. Extrair dados de `comments`

Trazer:

- comentarios internos
- comentarios de clientes
- comentarios de cards arquivados, se existirem

### 15. Extrair dados de `calendar_posts`

Trazer:

- eventos de calendario
- datas
- horarios
- cores/eventos, se existirem

## Fase 5: Revisao da qualidade

### 16. Conferir contagem por conta

Para cada conta, conferir:

- numero de colunas
- numero de posts ativos
- numero de posts arquivados
- numero de comentarios
- numero de eventos de calendario

### 17. Conferir integridade de vinculos

- todo post deve apontar para uma conta valida
- todo post com coluna deve apontar para uma coluna valida
- todo comentario deve apontar para um post valido
- toda atribuicao deve apontar para usuario e conta validos

### 18. Conferir logins

- quais contas compartilham o mesmo login
- quais usuarios precisam ser recriados juntos
- quais acessos vao exigir redefinicao de senha

## Fase 6: Preparacao da V2

### 19. Criar estrutura base na V2

Antes de importar, a V2 precisa ter:

- tabela de clientes
- tabela de usuarios
- tabela de vinculos
- tabela de colunas
- tabela de posts
- tabela de comentarios
- tabela de calendario

### 20. Definir politica de senha

Como a senha atual provavelmente nao sera recuperada em texto legivel:

- decidir se vai haver senha provisoria
- ou fluxo de redefinicao de senha

## Fase 7: Importacao

### 21. Importar contas

- criar clientes
- preservar slug quando fizer sentido
- preservar idioma e permissoes importantes

### 22. Importar usuarios e vinculos

- criar perfis
- recriar acessos
- vincular os usuarios as contas certas

### 23. Importar colunas

- manter ordem
- manter cor
- manter visibilidade

### 24. Importar posts

- primeiro ativos
- depois arquivados
- manter coluna
- manter status
- manter tags
- manter data e hora

### 25. Importar comentarios

- preservar autor
- preservar data
- preservar ligacao com o card

### 26. Importar calendarios

- recriar eventos de calendario
- manter relacao com a conta
- manter data/hora

## Fase 8: Validacao final

### 27. Validar por conta

Abrir cada conta e conferir:

- colunas corretas
- posts corretos
- arquivados corretos
- comentarios corretos
- calendario coerente

### 28. Validar login

- usuario entra na conta certa
- multiconta aparece corretamente
- cliente certo enxerga a conta certa

### 29. Validar portal do cliente

- colunas visiveis corretas
- arquivados conforme permissao
- busca, se estiver habilitada
- comentarios aparecendo corretamente

## Fase 9: Virada segura

### 30. Manter legado intacto durante validacao

- nao desligar o sistema antigo cedo
- validar a V2 em paralelo

### 31. Fazer revisao final antes da estreia

- conferir as cinco contas prioritarias
- corrigir inconsistencias
- revisar acessos

### 32. So depois pensar na segunda leva

Segunda leva pode incluir:

- outras contas ativas
- contas para recriar depois
- modulos secundarios

## Resultado esperado

Ao final deste checklist, a V2 deve estrear com essas contas prioritarias ja operacionais e com o que realmente importa preservado:

- estrutura do Kanban
- posts
- arquivados
- comentarios
- calendario
- logins vinculados
