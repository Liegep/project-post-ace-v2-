# 7. Dashboard V2 e plano de PWA

Data deste documento: 20 de agosto de 2026

## Regra central da dashboard

Na `v2`, a dashboard deve seguir a mesma regra boa que o app atual ja usa:

- se existe dado relevante, o widget aparece
- se nao existe dado, o widget nao aparece

Isso traz tres ganhos:

1. menos poluicao visual
2. menos trabalho de renderizacao
3. a home continua mostrando so o que pede atencao

## Widgets condicionais que entram na V2

### Bloco de prioridade alta

Esses devem aparecer no topo da area operacional, porque pedem acao:

- `Feedbacks dos clientes`
- `Posts enviados pelo cliente`
- `Tarefas com Prazo`
- `Agenda de hoje`

### Bloco de operacao diaria

- `Posts para Hoje`
- `Aprovacoes`
- `Calendario Editorial`

### Bloco estrutural

- `Clientes`

## Comportamento recomendado por widget

### Feedbacks dos clientes

Aparece quando houver pelo menos um item com retorno do cliente:

- aprovacao
- pedido de alteracao
- comentario importante
- estado do tipo `de_seu_feedback`, `leia_comentario` ou `alteracao_solicitada`

Quando nao houver feedbacks:

- nao renderiza o widget

### Posts enviados pelo cliente

Aparece quando houver posts criados pelo cliente e ainda nao tratados pela equipe.

Hoje isso se apoia bem na ideia de `client_created_at`.

Quando nao houver itens:

- nao renderiza o widget

### Tarefas com Prazo

Aparece quando existir tarefa futura ou vencendo.

Quando nao houver:

- nao renderiza

### Agenda de hoje

Aparece apenas quando houver compromissos no dia.

Quando nao houver:

- pode sumir
- ou, se voce preferir, virar um widget compacto com CTA para criar item

### Posts para Hoje

Aparece quando houver conteudo com data do dia.

### Aprovacoes

Aparece quando houver conteudos aguardando retorno.

### Calendario Editorial

Esse pode seguir dois caminhos:

1. sempre visivel, como ancora de orientacao
2. condicional tambem, se voce quiser uma home ainda mais limpa

Minha recomendacao:

- manter visivel em versao compacta

### Clientes

A grade de clientes pode continuar sempre visivel, porque ela e mais estrutural do que notificacional.

## Ordem de exibicao recomendada

### Linha 1

- saudacao
- metricas de resumo

### Linha 2

- `Feedbacks dos clientes` se houver
- `Posts enviados pelo cliente` se houver

### Linha 3

- `Tarefas com Prazo` se houver
- `Agenda de hoje` se houver

### Linha 4

- `Posts para Hoje` se houver
- `Aprovacoes` se houver
- `Calendario Editorial`

### Linha 5

- grade de clientes

## Regra visual da dashboard

Como esses widgets sao condicionais, a dashboard da `v2` precisa usar layout modular fluido:

- cards com altura autonoma
- grid responsiva
- reflow natural quando um widget some
- sem espacos vazios artificiais

Ou seja:

- a pagina nao pode depender de blocos fixos demais

## Recomendacao de UX

Cada widget deve responder a tres perguntas:

1. o que aconteceu?
2. com quem aconteceu?
3. qual a proxima acao?

Por isso, cada widget deve ter:

- titulo claro
- contador
- lista enxuta
- CTA direto

## PWA para a V2

## Vale a pena?

Sim.

Para este tipo de app, um PWA faz bastante sentido porque:

- facilita instalar no celular e tablet
- pode abrir com cara de app
- melhora acesso rapido para voce e clientes
- reduz friccao no uso recorrente

## O que eu recomendo

### Sim para PWA

Eu recomendo a `v2` nascer com suporte PWA.

### Nao para offline total na estreia

Eu nao recomendo prometer funcionamento offline completo na primeira versao, porque o sistema depende de:

- autenticacao
- dados dinâmicos
- uploads
- permissoes
- atualizacoes em tempo real

## Melhor estrategia de PWA

### Fase 1: PWA instalavel

1. manifesto web
2. icones
3. tela de abertura
4. abertura em modo app
5. cache de assets estaticos
6. pagina basica offline

### Fase 2: leitura resiliente

1. cache de algumas paginas de leitura
2. ultima sessao visual recente
3. fila local limitada para algumas acoes simples

### Fase 3: offline mais avancado

1. sincronizacao posterior
2. cache seletivo de listas e cards
3. tratamento fino de conflitos

## O que a V2 precisa para virar PWA

### Itens tecnicos base

- `manifest.webmanifest`
- icones em multiplos tamanhos
- service worker
- estrategia de cache
- metadata para mobile
- comportamento de atualizacao

### Itens de produto

- tela/estado sem internet
- aviso de reconexao
- mensagens claras quando uma acao depender de rede
- definicao do que pode ou nao funcionar offline

## O que faz sentido cachear

### Cache seguro

- HTML shell
- JS/CSS
- fontes
- imagens de interface
- icones
- logo

### Cache com cuidado

- logos de clientes
- miniaturas recentes
- ultima dashboard visitada
- ultimos cards lidos

### Nao tratar como offline-first no inicio

- uploads de imagem e video
- mudancas sensiveis de permissao
- auth complexa
- operacoes financeiras

## Comportamento ideal do PWA

### Para admin e equipe

- instalar no desktop e no celular
- abrir direto na dashboard
- navegar com rapidez
- receber estado claro de online/offline

### Para cliente

- instalar o portal do cliente
- abrir rapidamente aprovacao e calendario
- visualizar conteudos recentes com boa performance

## Recomendacao de escopo PWA para estreia

Na estreia da `v2`, eu faria:

1. instalacao no navegador
2. icone e splash
3. cache dos assets da aplicacao
4. pagina de fallback offline
5. banner de atualizacao
6. banner de sem conexao

## O que eu nao faria na estreia

1. edicao offline completa
2. fila de upload offline
3. sincronizacao complexa de comentarios
4. cache agressivo de tudo

## Conclusao

Para a `v2`, a melhor combinacao e:

- dashboard dinamica por presenca real de dados
- widgets operacionais modulares
- PWA instalavel e elegante
- offline parcial e honesto

Essa combinacao te da:

- produto mais bonito
- home mais inteligente
- app mais rapido de abrir
- melhor experiencia no celular
