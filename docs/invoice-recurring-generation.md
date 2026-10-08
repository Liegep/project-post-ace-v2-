# Geração real de faturas recorrentes

## Operação

A API verifica as recorrências ao iniciar e a cada hora, usando o mesmo padrão Fastify `onReady` / `setInterval` / `onClose` dos workers existentes. A verificação usa `APP_TIMEZONE` (padrão `America/Sao_Paulo`). Não depende de estar online à meia-noite do dia 1: executada em 02/10/2026, cria as faltantes de outubro com emissão em 01/10/2026.

Para executar imediatamente após instalar esta versão, o super admin pode usar **Faturamento > Gerar recorrentes deste mês**. A ação chama POST `/api/invoices/recurring/generate`, recebe contagens e atualiza a lista. O cliente não recebe acesso a essa operação. Não há parâmetro para gerar meses anteriores ou enviar faturas automaticamente.

Esta entrega implementa e testa a recuperação de outubro; não executa geração ou implantação em produção durante o desenvolvimento.

## Fonte e idempotência

- Fonte ativa: fatura cadastrada explicitamente em `invoice_recurring_sources`, com `recurring = 1` e sem `recurring_source_invoice_id`.
- A tabela de fontes começa vazia na atualização. Flags históricas importadas não são promovidas automaticamente. Em **Revisar fontes de recorrência**, o operador analisa e confirma a base correta. A sugestão da fatura mais recente é apenas para revisão.
- Uma nova fatura criada manualmente com recorrência ativa registra a própria fonte na mesma transação. Ativar a flag em uma fatura existente requer confirmação na revisão.
- O cadastro impede duas fontes históricas importadas ativas para o mesmo cliente. Fontes novas explicitamente cadastradas podem representar contratos distintos. Nenhuma origem é inferida apenas pelo nome do cliente.
- Fatura gerada: `recurring_source_invoice_id` aponta para a fonte e `recurring_period` contém o mês, como `2026-10`. Ela possui `recurring = 0`, evitando novas cadeias/explosão de recorrências.
- UNIQUE `(recurring_source_invoice_id, recurring_period)` impede duplicatas persistentes. O inicializador de faturamento adiciona os campos/índice de forma idempotente.
- Se a fatura-base já foi emitida no mês atual, ela já representa a cobrança desse mês e não é duplicada.
- Fontes futuras não geram antecipadamente. Não há recuperação retroativa de meses anteriores.
- A origem é reavaliada sob bloqueio antes de copiar os dados. Desativar a recorrência na fatura-base impede novas gerações; não muda faturas existentes.
- O formulário identifica faturas geradas e direciona alterações/desativação à base. A API impede transformar uma fatura gerada em outra fonte.
- Excluir uma fatura gerada torna aquele mês faltante novamente; a rotina pode recriá-la enquanto a fonte continua ativa. Desative a fonte para parar a recorrência.
- Um bloqueio de banco na conexão serializa os jobs e a criação manual de faturas para proteger também a atribuição de `invoice_number`. Uma instância concorrente retorna `busy`, sem duplicar.

## Dados e datas

Copiados da fonte: cliente, dados do destinatário, moeda, idioma, itens (preservando valores decimais), observações, `fixedAmount`, visibilidade e autoria. IDs de fatura e itens são novos. O título recalcula referências ao mês/ano no idioma da fatura; títulos genéricos recebem o mês atual. Referências ao mês/ano nas descrições dos itens também são atualizadas, mantendo os demais dados comerciais.

Novas faturas iniciam `open`. Pagamento, método, comprovante, envio e recibo/snapshot ficam nulos. Anexos antigos não são reaproveitados. A visibilidade configurada é mantida, mas, sem `sent_at`, a fatura ainda precisa ser enviada para aparecer no portal, preservando a regra existente.

Emissão sempre no primeiro dia do mês atual. Vencimento preserva o dia da fonte, aplicado ao mês gerado, sem transportar distâncias de meses históricas. Se o dia não existe no mês de destino, usa seu último dia; o próximo mês volta a considerar o dia original da base (por exemplo, 31 → 28 em fevereiro → 31 em março). O período é formatado em português, inglês, italiano, espanhol ou sueco conforme a fatura.

Cada fatura e seus itens são criados em uma transação. Falha em uma fonte faz rollback e não impede as fontes saudáveis; a fonte faltante será tentada novamente. Falhas temporárias não interrompem o servidor, e timers são encerrados junto da API.

## Interface

A resposta da fatura-base inclui o período atual, a identificação da fatura que já cobre esse período, elegibilidade e próxima data. A interface mostra **Fatura de outubro aguardando geração** enquanto falta uma cobrança elegível ou **Próxima geração: 1 de novembro de 2026** quando outubro está coberto. Faturas desativadas e geradas recebem rótulos distintos. A barra de ações permite quebra de linha no desktop e mantém o layout móvel.

## Validação

Testes cobrem dia 1, execução nos dias 2/20, repetição, múltiplas fontes, dados/itens, limpeza de pagamento/recibo/envio, virada de mês/ano, ausência de retroatividade, fonte já emitida no mês, desativação antes/depois de uma geração, isolamento de falhas, concorrência, fuso, vencimento em meses curtos/bissextos, índice único idempotente, estado retornado pela API, textos da interface e ciclo do worker (início, repetição, recuperação após falha e encerramento).

Os testes de repositório usam simulação das respostas do banco e verificam consultas/contratos. A proteção final contra concorrência permanece no índice UNIQUE e no bloqueio do banco de produção.

## Arquivos principais

- `v2/apps/api/src/modules/invoices/invoice-recurring.service.ts`
- `v2/apps/api/src/modules/invoices/invoice-number-lock.ts`
- `v2/apps/api/src/modules/invoices/invoices.repository.ts`
- `v2/apps/api/src/modules/invoices/invoices.routes.ts`
- `v2/apps/api/src/plugins/invoice-recurring-worker.ts`
- `v2/apps/api/src/app.ts`
- `v2/apps/web/src/invoiceRecurrence.ts`
- `v2/apps/web/src/BillingWorkspace.tsx`
- `v2/apps/web/src/BillingWorkspace.css`
- `v2/apps/web/src/api.ts`
- Testes: `invoice-recurring.test.ts`, `invoice-recurring-worker.test.ts`, `invoiceRecurrence.test.ts` e adaptação do teste de recibo ao bloqueio compartilhado.
- `v2/apps/api/package.json` registra os testes novos na suíte habitual.

## Auditoria e recuperação após o incidente

GET `/api/invoices/recurring/audit` é restrito ao super admin e executa somente SELECT. Expõe candidatos por cliente, fontes confirmadas, UUID da origem e instâncias do mês, incluindo inconsistências de título, datas, período, envio/recibo e origem. Datas retornadas pelo driver como `Date` são normalizadas. A confirmação explícita usa POST `/api/invoices/:invoiceId/recurring-source`, sob o mesmo bloqueio da geração.

O job e o botão usam exclusivamente as fontes confirmadas. Instâncias existentes continuam cobertas pelo par origem/mês mesmo quando o título antigo estiver errado: não são substituídas silenciosamente. A regularização dos registros já emitidos é uma operação separada, sujeita à revisão dos UUIDs e autorização do responsável. Veja `recurring-invoices-incident-2026-10.md`.
