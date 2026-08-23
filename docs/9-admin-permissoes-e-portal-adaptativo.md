# 9. Admin, permissões e portal adaptativo da V2

Data deste documento: 20 de agosto de 2026

## O que o app atual ja faz

Pelo codigo atual, o admin ja controla duas camadas muito importantes:

1. o que o cliente pode ver no fluxo
2. o que o cliente pode fazer no portal

Isso e excelente, porque essa precisa ser a base da `v2`.

## Camada 1: visibilidade por coluna

Hoje o sistema ja suporta colunas com visibilidade especifica para o cliente.

Isso aparece em:

- [AdminPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/AdminPage.tsx)
- [TrackingPanel.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/components/TrackingPanel.tsx)
- [PostsContext.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/context/PostsContext.tsx)
- [ClientPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/ClientPage.tsx)

O campo central e:

- `visible_to_client`

Na pratica:

- o admin marca o olhinho
- a coluna vira visivel para o cliente
- se nao estiver visivel, ela fica escondida no portal

## Camada 2: permissoes on/off por cliente

Hoje o cliente ja tem varias permissoes configuraveis no admin, incluindo:

- editar legenda
- criar posts
- baixar conteudo
- criar tags
- mostrar arquivados
- mostrar proximos posts
- tracking ativo
- tracking visivel
- mostrar invoices/faturas

Isso aparece especialmente em:

- [AdminPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/AdminPage.tsx)
- [ClientPage.tsx](/Users/liegipaschoalini/Desktop/project-post-ace/src/pages/ClientPage.tsx)
- [useBillingPermissions.ts](/Users/liegipaschoalini/Desktop/project-post-ace/src/hooks/useBillingPermissions.ts)

Campos importantes identificados:

- `allow_client_edit_caption`
- `allow_client_create_post`
- `allow_client_download`
- `allow_client_create_tags`
- `show_archived_to_client`
- `show_invoices_to_client`
- `show_upcoming_posts`
- `tracking_enabled`
- `tracking_visible_to_client`

## O que isso muda no design da V2

Isso confirma que o portal do cliente da `v2` nao deve ser rigido.

Ele deve ser:

- modular
- adaptativo
- orientado por permissao

Ou seja:

- o admin configura
- o portal do cliente se monta sozinho

## Modelo recomendado para a V2

### Nao criar um portal fixo

Eu nao recomendo desenhar um portal com sempre os mesmos menus e blocos para todos.

### Criar um portal por composicao

O ideal e o portal nascer a partir de:

1. colunas visiveis
2. features ligadas
3. permissoes especificas
4. tipo de cliente

## Como ficaria a logica de composicao

### Blocos de visualizacao

- `Aprovações`
- `Pautas`
- `Próximos posts`
- `Calendário`
- `Comentários`
- `Arquivos`
- `Faturas`
- `Notas fiscais`
- `Board`
- `Tracking`

### O que decide se aparece

- `show_upcoming_posts`
- `show_invoices_to_client`
- `tracking_visible_to_client`
- `allow_client_create_post`
- `allow_client_edit_caption`
- `allow_client_download`
- `visible_to_client` nas colunas

## Exemplo de clientes na V2

### Cliente simples

Vê:

- Aprovações
- Pautas
- Próximos posts
- Comentários

Nao vê:

- board
- criar post
- editar legenda
- faturas, se desligado

### Cliente que so ajusta legenda

Vê:

- Aprovações
- Pautas
- Próximos posts
- Comentários

Pode:

- editar legenda

Nao pode:

- criar post

### Cliente tipo Trello

Vê:

- Board
- colunas permitidas pelo admin
- tracking, se ativo e visivel

Pode:

- criar post, se habilitado
- comentar
- aprovar

### Cliente financeiro

Vê:

- Faturas
- Notas fiscais
- downloads

Somente se:

- `show_invoices_to_client` estiver ligado
- e as permissoes de billing estiverem ativas

## Minha recomendacao de design para o admin da V2

Eu criaria no admin uma area chamada:

- `Experiência do Cliente`

Dentro dela:

### Secao 1: o que ele ve

- ver board
- ver pautas
- ver próximos posts
- ver calendário
- ver tracking
- ver faturas
- ver notas fiscais
- ver arquivados

### Secao 2: o que ele pode fazer

- aprovar posts
- comentar
- editar legenda
- criar posts
- criar tags
- baixar arquivos

### Secao 3: colunas visiveis

- lista de colunas com olhinho

### Secao 4: modo do portal

- simples
- colaborativo
- board
- financeiro

Observacao:

Esse `modo` nao substitui os toggles. Ele so serve como preset inicial.

## Melhor forma de implementar na V2

### Presets + ajustes finos

Eu faria assim:

1. escolher um perfil base de cliente
2. ajustar os toggles individualmente

Isso resolve dois problemas:

- rapidez para configurar
- flexibilidade para excecoes

## Faturas e notas fiscais

Como voce mencionou isso explicitamente, eu colocaria no portal:

- um bloco `Financeiro`

Com:

- Faturas
- Notas fiscais
- baixar PDF
- status de pagamento

Mas esse bloco so aparece quando:

- o admin ligar
- e o cliente tiver permissao de billing

## Conclusao

O que voce descreveu nao e detalhe tecnico; e parte central do produto.

A `v2` precisa respeitar isso assim:

- portal do cliente orientado por permissao
- board filtrado por colunas visiveis
- funcoes on/off no admin
- blocos financeiros tambem condicionais

Em resumo:

- o admin monta a experiencia
- o cliente so ve o que faz sentido para ele
