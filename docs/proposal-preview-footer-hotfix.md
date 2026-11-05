# Hotfix: fechamento na prévia administrativa

A prévia de ProposalsWorkspace mantinha um CTA próprio com a validade acima dos botões. A correção anterior havia coberto a página pública, mas não esse bloco separado.

Mudança pontual: remove somente o parágrafo de validade do CTA da prévia e iguala sua largura/margens às da proposta. `proposalPresentation.tsx` não foi modificado: validade à esquerda e termos de aprovação permanecem intactos. Botões da prévia continuam desabilitados; nenhum aceite é enviado.

Regressão adicionada ao teste existente do workspace: uma validade na prévia, presente no rodapé esquerdo e ausente no CTA. Node 22: typecheck/builds API/frontend e 727 testes aprovados. Chromium em 1600px e 390px renderizou o ProposalsWorkspace real: bordas/larguras iguais para proposta e CTA, validade única, ausência de data acima dos botões e texto de aprovação intacto.

Sem alterações financeiras, de dados, API, banco, pacotes ou condições. PR #54 intacto. Publicação solicitada no contexto da correção do rodapé aprovado; confirmação final registrada no PR após observar os novos assets.
