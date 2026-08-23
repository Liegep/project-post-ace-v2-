# Automacoes, Status e Acompanhamento

## Automacoes por cliente

Dentro do Kanban de cada cliente, a V2 precisa permitir automacoes personalizadas daquela conta.

Essas automacoes pertencem ao workspace do cliente atual.

## Exemplos de automacao

- se usar uma tag especifica, mover o card para uma coluna especifica
- se entrar em determinado status, atualizar o acompanhamento
- se for enviado para aprovacao, gerar comportamento automatico no fluxo
- se chegar a data e hora do agendamento, arquivar automaticamente

## Papel das automacoes

As automacoes servem para reduzir trabalho manual e adaptar o fluxo para cada cliente.

Como cada conta pode funcionar de um jeito, a automacao precisa ser flexivel e localizada naquele Kanban.

## Status dentro do card

Cada card trabalha com status internos.

Esses status nao sao apenas visuais. Eles alimentam partes importantes do sistema.

## Exemplos de status

- pendente
- design pronto
- legenda pronta
- aprovado pela boss
- alterado
- artigo pronto
- shorts/reels pronto

## Comportamento visual dos status

Os status podem aparecer:

- com bolinha colorida
- com etiqueta colorida
- riscados quando finalizados
- com leitura muito rapida no card

Exemplo de logica visual:

- status finalizado pode aparecer riscado
- status em andamento pode aparecer com bolinha ativa
- cores ajudam a bater o olho e entender a fase do material

## Relacao entre status e acompanhamento

O widget de `Acompanhamento` e alimentado pelos status ativos do card.

Ou seja:

- o acompanhamento nao nasce separado
- ele reflete o que esta acontecendo nos cards

## Relacao entre tags e acompanhamento

O widget de `Acompanhamento` tambem deve mostrar as tags ativas dos cards.

Exemplos:

- `Design pronto`
- `Legenda pronta`
- `Artigo pronto`
- `Alterado`
- `Aline aprovou`

Assim, o acompanhamento vira um espelho resumido do estado real do trabalho.

## Leitura no acompanhamento

O widget de acompanhamento pode mostrar:

- item do projeto
- tags/status ativos
- progresso visual
- marcacao de finalizado

Por exemplo:

- item com status finalizado aparece marcado
- item com etapa pronta aparece com bolinha verde ou amarela
- item pendente permanece aberto

## Regra estrutural da V2

O fluxo ideal fica assim:

1. o card recebe status e tags
2. esses status e tags alimentam o acompanhamento
3. automacoes podem reagir a esses status e tags
4. o Kanban continua sendo a fonte principal da operacao

## Impacto no design

No desenho do Kanban e da gaveta lateral, a V2 deve deixar claro que:

- o acompanhamento vem dos cards
- status e tags importam de verdade
- automacoes podem ser configuradas por cliente
- o sistema nao e apenas visual, ele responde ao estado do trabalho
