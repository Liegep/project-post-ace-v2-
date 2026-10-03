# Indicadores financeiros: exclusão de canceladas

O faturamento V2 calcula os quatro indicadores no frontend, em
`v2/apps/web/src/BillingWorkspace.tsx`, usando `calculateBillingStatistics`.
A API de listagem continua retornando todos os status: excluir canceladas na
consulta geral esconderia registros históricos e seus documentos.

| Indicador | Status considerados |
| --- | --- |
| Total faturado | `open`, `paid`, `overdue` |
| Total recebido | `paid` |
| Pendente | `open` |
| Atrasado | `overdue` |

Antes, Total faturado também incluía `cancelled`. Os demais indicadores já
excluíam canceladas; seus valores permanecem iguais. Valores são calculados
pelos itens e separados por moeda, preservando BRL, USD e EUR no resumo V2.

O escopo permanece o histórico de faturas carregado, sem novo filtro de mês:
a tela atual não tem seleção de período para os indicadores. Busca e filtro
de status continuam afetando somente a lista.

A tela antiga `src/pages/BillingPage.tsx` tinha a mesma inclusão indevida em
`financialSummary.totalBilled` e agora aplica os mesmos três status. Sua regra
de Pendente continua incluindo abertas e atrasadas, conforme já existia.

Nenhuma escrita no banco, alteração de fatura, pagamento, recibo ou snapshot
é necessária. O valor individual de uma cancelada continua sendo exibido.

## Validação

- Cinco testes novos cobrem status válidos/canceladas, separação de moedas,
  preservação de pagamento e recibo, recálculo após cancelamento e estabilidade.
- Suíte V2: 322 testes aprovados; typecheck e builds API/web aprovados.
- Build da aplicação antiga aprovado. Sua suíte passou 13 de 14 testes; a
  falha existente `text-content-contrast.test.ts` exige `dark:prose-invert`
  em `TextContentDetailDialog.tsx`. Ambos os arquivos são idênticos ao
  `origin/main`, onde esse atributo também está ausente.
- Aplicação do cálculo ao snapshot local da regularização, sem acesso de
  escrita à produção: Total faturado R$ 14.500,00 / EUR 2.020,94;
  recebido R$ 13.850,00 / EUR 1.750,94; pendente R$ 650,00 / EUR 270,00;
  atrasado zero. Os 69 registros do snapshot permanecem intactos.
