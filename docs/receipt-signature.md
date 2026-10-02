# Assinatura automática dos recibos

## Configuração administrativa

Em Faturamento, abrir **Configurações · Dados de faturamento**. O campo **Assinatura para recibos** permite enviar, visualizar, substituir e remover PNG, JPG ou WEBP (até 12 MB). PNG transparente é recomendado. Somente super admin pode administrar essa configuração, seguindo a autorização atual do módulo de faturamento.

## Arquitetura reutilizada

- Usa o diretório persistente existente de uploads (`getUploadDirectory`), a conversão Sharp e a leitura `/api/uploads/:fileName`.
- Cada envio gera um novo nome UUID, em WEBP lossless, preservando transparência. A validação verifica MIME e o formato real da imagem; arquivos inválidos não atualizam a configuração.
- Não havia configuração global de faturamento. A tabela singleton `billing_settings` guarda apenas `receipt_signature_url`; é criada idempotentemente pelo inicializador existente `ensureInvoiceTables`, sem serviço paralelo de storage.
- Rotas super admin: GET `/api/billing/settings`, POST multipart `/api/uploads/receipt-signature` e DELETE `/api/billing/settings/receipt-signature`.
- Substituir/remover altera apenas a referência atual. Não remove nem sobrescreve os arquivos antigos, necessários para os snapshots.

## Emissão e snapshot

- Criar uma fatura paga ou alterar seu status para `paid` emite o recibo automaticamente na mesma transação de banco.
- A assinatura atual entra como `signatureUrl` em `receipt_snapshot_json`, junto dos dados existentes. Nenhuma configuração é consultada na renderização de recibos emitidos.
- A emissão existente continua idempotente e usa bloqueio da fatura. Se já existe número de recibo, o snapshot não é recriado.
- Recibos antigos sem `signatureUrl` continuam sem imagem; não recebem retroativamente a assinatura atual. Recibos novos sem configuração registram `null` e funcionam normalmente.
- O arquivo usado na emissão permanece com nome e conteúdo imutáveis no storage, inclusive após substituição ou remoção da configuração.

## Visualização e PDF

O componente existente `BillingReceiptDocument` é compartilhado pela área administrativa, pelo portal do cliente e pela fonte da impressão/PDF. A imagem aparece somente se existir no snapshot, no rodapé antes do nome da emissora, com largura/altura automáticas e limites proporcionais. O PDF continua usando a impressão do navegador; a abertura do diálogo aguarda o carregamento do documento e das imagens, evitando downloads com assinatura ainda não carregada.

## Arquivos

- `v2/apps/api/src/modules/invoices/billing-settings.repository.ts`
- `v2/apps/api/src/modules/invoices/invoices.repository.ts`
- `v2/apps/api/src/modules/invoices/invoices.routes.ts`
- `v2/apps/api/src/modules/uploads/uploads.routes.ts`
- `v2/apps/web/src/BillingSettings.tsx`
- `v2/apps/web/src/BillingWorkspace.tsx`
- `v2/apps/web/src/BillingWorkspace.css`
- `v2/apps/web/src/App.tsx`
- `v2/apps/web/src/api.ts`
- `v2/apps/web/src/printDocument.ts`
- `v2/apps/api/src/modules/invoices/receipt-signature.test.ts`
- `v2/apps/api/src/modules/invoices/receipt-signature-upload.test.ts`
- `v2/apps/web/tests/receiptSignature.test.tsx`
- `v2/apps/api/package.json`

## Validação

Testes cobrem snapshot, troca e remoção, emissão automática na atualização e criação de fatura paga, ausência de assinatura, idempotência, rollback de falha, upload PNG/JPG/WEBP, transparência, arquivos imutáveis, imagem corrompida/formato disfarçado, autorização super admin, componente compartilhado e espera da imagem na impressão. Prévia local do componente real com dados fictícios verificada no desktop e em 375×812, sem overflow horizontal. Não foi necessário alterar recibos ou configurações de produção para verificar.
