# 8. Portal do cliente: pautas, modos de uso e mobile first

Data deste documento: 20 de agosto de 2026

## Resposta curta

Sim para os tres pontos:

1. as `pautas para aprovação` cabem muito bem nesse portal
2. o portal pode ter modos diferentes por cliente
3. a `v2` pode e deve ser `mobile first`

## Onde entram as pautas para aprovação

No produto novo, eu nao colocaria `pautas` misturadas de forma confusa com `posts finais`.

Eu faria assim:

### No menu lateral do cliente

- `Aprovações`
- `Pautas`
- `Próximos posts`
- `Arquivos`
- `Faturas`
- `Relatórios`

### Como isso funciona

#### Aprovações

Area para o cliente aprovar:

- post pronto
- legenda final
- arte final
- peça agendada

#### Pautas

Area separada para o cliente aprovar ou comentar:

- ideias
- temas
- direcionamentos
- roteiros iniciais
- briefs simplificados

Isso evita misturar:

- uma ideia ainda aberta

com

- um post praticamente pronto

## Melhor estrutura para pautas

### Home do cliente

Se houver pautas pendentes:

- aparece um widget `Pautas para aprovação`

Ele deve mostrar:

- titulo da pauta
- cliente ou campanha
- data
- status
- CTA `Ver pauta`

### Tela de lista

A secao `Pautas` pode ter:

- `Aguardando sua aprovação`
- `Aprovadas`
- `Solicitaram ajustes`

### Tela detalhe da pauta

A pauta deve ter:

- titulo
- objetivo
- descricao
- referencias
- comentarios
- botoes `Aprovar pauta` e `Solicitar ajuste`

## Diferentes modos de cliente

Esse e um ponto muito bom e muito real do seu produto.

Nem todo cliente trabalha do mesmo jeito, entao a `v2` deve ter **modos de portal por cliente**.

## Modo 1: simples

Para clientes que:

- so aprovam
- so comentam
- quase nao interagem

Esse modo mostra:

- Aprovações
- Próximos posts
- Faturas, se habilitado
- Relatórios, se habilitado

Esconde:

- colunas
- criacao de post
- interacoes mais complexas

## Modo 2: legenda

Para clientes que:

- aprovam
- comentam
- editam a legenda

Esse modo mostra:

- tudo do modo simples
- campo editavel de legenda
- histórico de ajustes

## Modo 3: colaborativo

Para clientes que:

- criam post
- trabalham em pauta
- acompanham fluxo com mais autonomia

Esse modo mostra:

- Aprovações
- Pautas
- Próximos posts
- Faturas, se habilitado
- Relatórios, se habilitado
- opcionalmente `Área de trabalho`

## Modo 4: board estilo Trello

Para clientes mais operacionais, que gostam de acompanhar por colunas:

- `Entrada`
- `Em desenvolvimento`
- `Aguardando aprovação`
- `Agendado`

Mas eu nao deixaria esse modo como padrao para todos.

Minha recomendacao:

- ele existe como configuracao opcional por cliente

## Recomendacao de arquitetura de portal

Em vez de criar portais totalmente diferentes, eu faria:

- um mesmo portal
- com blocos habilitados ou ocultados por permissao/configuracao

Ou seja:

- mesma base
- experiencias diferentes por cliente

## Configuracoes por cliente que eu colocaria

- `can_approve_posts`
- `can_comment`
- `can_edit_caption`
- `can_create_posts`
- `can_view_board`
- `can_view_briefs_or_pautas`
- `can_download_files`
- `show_upcoming_posts`
- `show_invoices`
- `show_reports`

## Mobile first

## Sim, faz muito sentido

Varios clientes acessam do celular, entao eu faria o portal ja com pensamento mobile first desde a fundacao.

## O que isso muda no design

### No mobile

- uma coluna so
- cards empilhados
- CTA grande no polegar
- menu simples
- comentarios com leitura limpa

### Na tela de aprovacao

Essa tela especificamente precisa ser excelente no celular.

No mobile ela deve virar:

1. imagem/video grande no topo
2. legenda abaixo
3. comentarios abaixo
4. barra fixa inferior com:
   - `Aprovar`
   - `Solicitar alteração`

Isso seria muito forte.

## Regras mobile first que eu adotaria

1. toda decisao critica com um toque
2. nenhum texto essencial escondido
3. CTA sempre visivel
4. componentes largos e confortaveis
5. comentarios faceis de ler e responder

## O que eu nao faria no mobile

1. board completo com arrastar e soltar como primeira experiencia
2. menus complexos
3. telas com duas ou tres colunas obrigatorias
4. modais pesados demais

## Como resolver clientes estilo Trello no celular

Para esses clientes, eu faria no mobile:

- lista por status
- filtro por coluna
- cards empilhados

E deixaria o `board completo horizontal` mais forte no tablet/desktop.

## Minha recomendacao final

### Para a estreia da V2

Eu faria o portal assim:

1. `Aprovações`
2. `Pautas`
3. `Próximos posts`
4. `Faturas`
5. `Relatórios`

E por configuracao de cliente:

- simples
- legenda
- colaborativo
- board

### Em termos de design

Sim, esse portal pode ficar:

- lindo no desktop
- muito forte no celular
- adaptado a perfis diferentes de cliente

## Conclusao

O que voce descreveu nao e problema; na verdade, e uma vantagem competitiva.

Se a `v2` nascer com:

- portal modular
- modos por cliente
- aprovacao de posts e pautas
- mobile first de verdade

ela fica muito mais madura e mais usavel do que um portal unico e engessado.
