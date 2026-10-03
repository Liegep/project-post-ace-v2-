# Incidente das recorrências — 03/10/2026

## Causa comprovada no código

O importador `v2/apps/api/src/scripts/import-legacy-export.ts` define `recurring` de cada fatura histórica com base em `billing_recurrence_active` do cliente. O gerador anterior buscava todas as faturas `recurring = 1` sem origem. Assim, meses históricos de uma mesma recorrência viraram templates independentes. Não foi uma cadeia multiplicada pelas instâncias: estas já eram inseridas com `recurring = 0` e origem preenchida.

Além disso, a inserção copiava `source.title` e descrições literalmente. Emissão, vencimento e `recurring_period` eram de outubro, mas o título continuava Março/Abril/Setembro. O botão encontrava o par origem + `2026-10` e corretamente evitava outra inserção para aquele template incorreto. A interface ainda chamava as instâncias de “Recorrente”. O gerador anterior não continha UPDATE/DELETE das faturas-base.

## Evidência de produção e limites

Consulta visual de leitura na sessão autenticada de `https://liegestudio.com/#/area/faturamento`: 29 faturas históricas marcadas recorrentes e 29 novos registros #63–#91. A inspeção detalhada de #91 confirmou título “Setembro 2026”, emissão 2026-10-01, vencimento 2026-10-28, período `ottobre 2026`, identificação “Gerada por recorrência · 2026-10” e item “Recorrência mensal - Setembro 2026”. As originais permaneceram na listagem com suas datas históricas.

O acesso direto MySQL foi recusado com `ER_ACCESS_DENIED_ERROR`. Não foi possível fazer JOIN em produção, obter todos os UUIDs nem confirmar individualmente todos os vínculos. A lista abaixo identifica os registros visíveis pelo número da fatura; não substitui um export do banco. Nenhum dado foi escrito ou apagado durante esta investigação.

| Cliente | Novos registros observados |
| --- | --- |
| Mattia’s Bar | #91 Setembro, #90 Abril, #78 Junho, #76 Agosto, #69 Julho, #68 Fattura Março, #66 Maio |
| Serena | #89 Setembro, #88 Invoice March, #87 Abril, #86 Junho, #85 Julho, #80 Maio, #64 Agosto |
| Minas Home | #84 Social Media, #83 Junho, #79 Julho, #77 Maio, #74 Abril, #67 Setembro, #65 Agosto |
| Niko | #82 Julho, #72 Junho, #71 Setembro, #70 Kynagogi & Kynagogi Detection Invoice-May 2026, #63 Agosto |
| Patricia Rodrigues | #81 Agosto, #75 Julho, #73 Setembro |

Os vencimentos visíveis eram outubro/28, exceto #88, #84, #70 e #68 em outubro/31.

## Modelo corrigido

`invoice_recurring_sources` registra apenas fontes explicitamente confirmadas, com usuário e data da confirmação. A migração cria a tabela vazia e não altera invoices. Novas faturas criadas manualmente com `recurring = true` registram sua fonte na mesma transação. Faturas existentes requerem confirmação pelo operador. A auditoria e a sugestão da base mais recente são somente leitura.

O gerador faz JOIN com esse cadastro e revalida `recurring = 1` e origem nula sob bloqueio. O cadastro também rejeita instâncias e uma segunda origem histórica importada ativa para o mesmo cliente. Fontes novas explícitas podem representar contratos comerciais distintos; não há agrupamento automático só pelo cliente.

Cada instância aponta diretamente para a mesma fonte, tem `recurring = 0` e UNIQUE `(recurring_source_invoice_id, recurring_period)`. Mantêm-se bloqueio compartilhado e transação por fatura. Título/período e referências datadas dos itens passam para o novo mês/idioma; emissão é o dia 1, vencimento é o dia da base aplicado ao mês novo, limitado ao último dia. Pagamento, recibo e envio começam limpos.

## Recuperação de outubro, após revisão

1. Implantar a versão corrigida: o cadastro vazio impede novas gerações a partir dos históricos não confirmados. Nenhum histórico é reclassificado ou cancelado pela atualização.
2. Executar **Analisar recorrências** ou GET `/api/invoices/recurring/audit`, ou obter export de `invoices` e `invoice_items`, para confirmar os UUIDs e as origens. O endpoint só usa SELECT.
3. Revisar como candidatas as bases de setembro #57 Mattia, #58 Minas, #59 Patricia, #60 Serena e #61 Niko. Confirmar valores, dia de vencimento e se cada uma corresponde ao contrato ativo. Não selecionar automaticamente.
4. Candidatas a instâncias de outubro a conservar: #91 Mattia, #67 Minas, #73 Patricia, #89 Serena e #71 Niko. Seus vínculos às bases precisam ser confirmados no banco. As outras 24 são candidatas a duplicatas de cadeias indevidas, não autorizadas para exclusão/cancelamento neste trabalho.
5. Com aprovação explícita de um plano contendo UUIDs, regularizar título/período/descrições das cinco instâncias escolhidas, preservar origem/`2026-10`, e definir o tratamento das 24 excedentes após verificar pagamento, recibo, envio e efeitos contábeis. Não existe rotina automática de reparo nesta branch.
6. Confirmar as fontes corretas. O botão e o worker criam apenas pares origem/mês ausentes, inclusive após perder o dia 1. Se uma instância já existe com título errado, ela é sinalizada para revisão e não substituída, evitando nova cobrança. Executar novamente deve criar zero duplicatas.
7. Novembro e os meses seguintes apontarão diretamente às mesmas bases confirmadas, com os novos títulos e datas. Não se geram meses anteriores.

## Validação

A suíte usa testes de serviço, repositório simulado, auditoria e interface. Inclui várias bases históricas por cliente, cadastro vazio, confirmação explícita, instância impedida de virar fonte, geração tardia de outubro, repetição, mesma origem em novembro, títulos em cinco idiomas, vencimentos, reset dos campos e consultas de diagnóstico somente leitura. Não houve execução dos testes sobre produção nem teste integrado em MySQL real nesta investigação.

Resultado final: 329 testes passaram, zero falhas; typecheck da API e do frontend e build de ambos passaram. O build mantém o aviso de tamanho de chunks do frontend. Os testes de regressão existentes de dashboard, datas comemorativas e assinatura de recibos estão incluídos na suíte.
