# Nome técnico no multipart administrativo

## Diagnóstico e escopo

Foi relatado um teste em produção em que os mesmos bytes PNG falharam com nome longo/pontuação e foram enviados com nome curto. Isso sustenta provável interferência do nome no tratamento multipart, mas não identifica o componente nem a regra que respondeu 403. Não se afirma que uma regra de segurança identificada foi contornada nem que todas as causas de 403 foram resolvidas.

A mudança reduz metadados de transporte a `upload-<UUID>.<extensão>`. Não altera arquivos no computador, bytes, MIME, autenticação ou diagnóstico. UUID técnico é novo por envio; o UUID de correlação do PR #51 continua separado. Nenhuma proteção, validação, tamanho permitido, conversão WebP ou armazenamento no servidor foi alterado.

O helper lê somente os primeiros 32 bytes para escolher extensão de assinaturas reconhecidas: PNG, JPEG, GIF, WebP, PDF e marcas conhecidas de MP4/QuickTime. WebM/formatos não identificados com segurança usam o MIME declarado suportado; outros usam `.bin`. A inspeção não é detector universal nem nova validação de conteúdo. Não confia na extensão original, não corrige MIME divergente e não aceita arquivos no lugar do backend. Arquivos corrompidos continuam sujeitos às validações existentes.

## Fluxos verificados

- `uploadAdminMedia` → `tracedUpload` → helper: cards/edição de mídia, pautas/rascunhos, logos, avatar, textos/anexos, faturas, evidências de relatórios e capas. Consumidores recebem a mesma URL e conservam nomes originais usados como metadados visíveis.
- `uploadReceiptSignature` → mesmo helper: caminho administrativo separado, sem alterar regras de assinatura.
- `uploadPortalMediaBySlug`: intocado. Compartilha o storeUpload do servidor, que não foi modificado.
- `uploadBriefAttachment`: intocado. Função compartilhada por contextos de briefs; o nome original é metadado do anexo, portanto não foi alterado genericamente.
- Publicação Meta: rotinas e dados intocados; uploads administrativos de mídia continuam pelo helper comum, com os mesmos bytes/URLs e conversão existente.

## Validação isolada

Testes cobrem nomes longos, espaços, acentos, `?`, `;`, pontos e Unicode; multipart serializado com nome curto, UUID único, MIME/bytes intactos e File original preservado. Cobrem PNG/JPEG/GIF/WebP, MP4/QuickTime/WebM e PDF. Integração Fastify usa diretório temporário, conversão real de imagens e passthrough de vídeos/PDF; vídeo/PDF usam fixtures sintéticas de transporte, não validação de reprodução. Um PNG inválido continua recebendo 400. Sem banco ou dados de produção.

A suíte existente inclui autenticação, assinatura de recibos e diagnóstico de upload. Testes locais não reproduzem regras da Hostinger; confirmação de eficácia em produção depende de teste manual autorizado após revisão/implantação. Sem merge/deploy nesta tarefa.
