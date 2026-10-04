# Revisão do widget de Datas comemorativas

Branch: codex/seasonal-dashboard-widget, baseada no main fd1de721.

As linhas agora possuem estilos próprios, evitando conflito com o grid genérico de tarefas do Dashboard. Data fixa de 58 px, dia e mês separados, título com quebra de linha, abrangência e categoria alinhadas. CTA usa o gradiente, cores, bordas e sombra do app. Até três ocorrências em ordem cronológica; Ver todas aparece quando há mais resultados. Gerenciar monitoramento permanece no rodapé.

Container query posiciona o CTA abaixo do texto em cards com conteúdo de até 360 px, inclusive quando o Dashboard é estreito em uma tela desktop. Mantidos atualização periódica, período de quatro dias, APIs existentes e fluxo de pauta pendente. Categorias vêm do endpoint existente; caso a consulta de rótulos falhe, o código recebido permanece visível sem interromper as oportunidades.

## Validação

- 389 testes de regressão + 19 testes do Radar/interface: 408 aprovados.
- Teste do widget cobre três de quatro ocorrências no mesmo dia, global, multipaís, rótulo da categoria, links, Hoje/Amanhã, ausência de Ver todas com um resultado, CTA desabilitado sem cliente e criação de pauta pendente.
- Typecheck API/web aprovado; build API/web aprovado. Build web repetido após ajuste final de CSS; aviso preexistente de tamanho do bundle.
- Prévia local do componente real dentro do grid do Dashboard, com fixtures isoladas da produção.
- 1440 px: scrollWidth = clientWidth = 1440; linhas com CTA na mesma linha.
- 390 px: scrollWidth = clientWidth = 390; CTA abaixo do texto.
- 320 px: scrollWidth = clientWidth = 320; sem sobreposição ou overflow, inclusive no diálogo de pauta.

Nenhuma alteração de API, schema ou dados. Sem push, merge ou deploy desta correção.
