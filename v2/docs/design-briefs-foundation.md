# Fundação funcional de Briefs — revisão antes de publicação

Branch: `codex/design-briefs-foundation`. Não publicada. Nenhum banco de produção foi acessado ou alterado.

## Modelo e migração

`database/migrations/20261005_design_briefs_foundation.sql` cria sete tabelas aditivas:

- `design_brief_template_metadata`: categoria, descrição, idioma, versão, estado e último autor; mantém o ID do template existente.
- `design_brief_template_versions`: definições históricas do template, chave `(template_id, version)`.
- `design_brief_instances`: instância independente, cliente, origem/versionamento, snapshot JSON, estado e envio.
- `design_brief_responses`: resposta atual/rascunho, uma por instância, com versão de concorrência e respondente.
- `design_brief_response_revisions`: cópias imutáveis de cada submissão, número sequencial e chave/hash de idempotência.
- `design_brief_attachments`: resposta, field ID, arquivo privado e metadados.
- `design_brief_events`: criação, edição do rascunho, envio, salvamento da resposta, anexos, submissão, reabertura e arquivamento.

São 17 FKs; nenhuma usa `ON DELETE CASCADE`. Relações históricas usam `RESTRICT`; referências de autoria usam `SET NULL`. `ON UPDATE CASCADE`, InnoDB, utf8mb4/utf8mb4_unicode_ci, JSON e DATETIME(3). Field IDs de anexos têm collation binária para comparação sensível a maiúsculas/minúsculas, igual ao JSON.

`CREATE TABLE IF NOT EXISTS` permite repetir a migração. Não há ALTER, UPDATE, DELETE, importação, conversão de status ou inserção de dados na migração. O schema de bootstrap foi atualizado para bancos novos. O módulo não executa a nova migração no startup; aplicar o SQL é uma etapa futura, depois da revisão.

Os registros de `design_briefs` continuam com IDs e respostas originais, disponíveis somente para consulta na nova interface. Não são promovidos automaticamente a envios/respostas: `completed` e `submitted_at` antigos não provam uma submissão de cliente. Templates atuais mantêm IDs e recebem metadados/versionamento quando usados/editados. Não existe reconstrução artificial de revisões passadas.

## Estados e garantias

- Template: `active` / `archived`. Editar incrementa a versão; conserva a definição anterior.
- Brief: `draft` → `sent` → `answered` → `reopened` → `answered`; arquivamento é permitido sem apagar histórico.
- Resposta: `draft` / `submitted`. Na reabertura, o rascunho parte da última resposta, mas a revisão submetida permanece intacta.
- Enviar exige cliente e ao menos uma pergunta válida. O snapshot já é uma cópia independente; depois do envio, cliente e formulário não podem ser alterados.
- Anexos retirados da resposta atual permanecem armazenados para revisões anteriores. Não há endpoint de exclusão destrutiva.
- Mutação usa transação e bloqueio da instância; respostas também são bloqueadas. `expectedVersion` evita sobrescrita entre sessões. Criação usa UUID do solicitante para repetição segura. Submissão usa UUID de idempotência + hash canônico das respostas: repetição retorna o estado existente; reutilização com conteúdo diferente retorna 409.
- Tentativas concorrentes com o mesmo ID são recuperadas por repetição limitada da transação após deadlock/duplicação. Não há repetição ilimitada.
- Erros de validação: 400; ausência/conta divergente: 404; conflito/fechamento: 409; autenticação/permissão: 401/403.

## Campos e arquivos

Texto curto/longo, escolha única, checklist, dropdown, número, data, link, escala e arquivo. IDs únicos e estáveis; tipos, obrigatoriedade, opções, intervalos, data real (sem conversão de fuso), URLs HTTP/HTTPS, limites e propriedade de anexos são validados no servidor. IDs reservados de objetos são recusados.

Uploads: JPG, PNG, WebP e PDF, até 12 MB; até 5 arquivos por campo por padrão, configurável até 10. Imagens são decodificadas para validar integridade e conservadas sem conversão/perda dos bytes originais. PDFs precisam de assinatura PDF. Arquivos ficam em `UPLOAD_DIR/brief-private`, fora do endpoint público de uploads; download exige sessão e acesso ao brief, com `private, no-store` e `nosniff`. Use a pasta persistente existente e inclua-a no backup junto com o banco.

## API

Administração continua exclusiva de superadmin:

- `GET/POST /api/briefs/templates`
- `PATCH /api/briefs/templates/:templateId`
- `POST /api/briefs/templates/:templateId/archive`
- `GET/POST /api/briefs`
- `GET/PATCH /api/briefs/:briefId`
- `POST /api/briefs/:briefId/send|reopen|archive`
- `GET /api/briefs/:briefId/attachments/:attachmentId`

Portal (sob `/api/portal/accounts/:clientAccountId/briefs`):

- GET lista somente instâncias enviadas da conta; GET `/:briefId` permite consulta, inclusive depois da resposta/arquivamento.
- PUT `/:briefId/response` salva rascunho; POST `/:briefId/submit` cria revisão.
- POST `/:briefId/fields/:fieldId/attachments`: multipart e header `x-brief-response-version`.
- GET `/:briefId/attachments/:attachmentId`: download autorizado.

A conta precisa estar no escopo da sessão. Portal `viewer` consulta; `admin`/`approver` responde. Contas internas seguem as regras existentes de associação. Não é utilizada a permissão de criação de posts para briefs ou anexos. Os endpoints antigos de alteração/exclusão retornam 409; GET legado permanece disponível.

## Interface desta etapa

Interface funcional com tokens existentes, sem redesign final: criar/editar template, escolher modelo ou formulário vazio, reordenar perguntas, salvar rascunho no servidor, selecionar cliente, enviar, consultar respostas/revisões e reabrir/arquivar. Portal possui entrada Briefs, salvamento explícito de rascunho, submissão e consulta de versões. Alterações não salvas têm aviso ao sair. O envio é para o portal; não foi acrescentado envio de e-mail ou link público.

## Validação local

Instância temporária MariaDB **10.11.19**, socket local, sem rede e sem carregar .env. Bases de teste com nomes aleatórios são criadas e removidas pelo teste.

- Migração executada duas vezes: sete tabelas, 17 FKs, InnoDB/utf8mb4 confirmados, registros legados iguais antes/depois.
- Seis grupos de integração reais: templates/snapshot, resposta/duas revisões, concorrência/idempotência, anexos, autorização, arquivamento e proteção do legado.
- Suíte principal: **431 testes aprovados**; integração MariaDB: **6 grupos aprovados**; regressão do Radar: **19 testes aprovados**; nenhum teste ignorado. Typecheck e build aprovados. O build mantém o aviso de tamanho de chunks.
- Suíte API/web e testes de interface cobrem salvamento sem falsa conclusão, envio congelado, resposta em rascunho, repetição da submissão e viewer sem controles de escrita.
- Regressão do Radar executada separadamente.

Comandos na pasta `v2`:

```sh
npm run test --workspace @design-hub-v2/api
npm run test:seasonal --workspace @design-hub-v2/web
BRIEF_TEST_SOCKET=/tmp/briefs-mariadb-foundation/server.sock npm run test:briefs:mysql --workspace @design-hub-v2/api
npm run check
npm run build
```

A suíte MariaDB recusa outros sockets e nunca usa DB_HOST/DB_NAME de staging/produção. A instância deve ser inicializada previamente em `/tmp/briefs-mariadb-foundation` com `mariadb-install-db`, `--skip-networking`, charset utf8mb4 e modo SQL estrito. Evidência local: `/tmp/briefs-mariadb-foundation/result.json`.

## Reversão e futura publicação

Antes de qualquer publicação, revisar SQL, confirmar versão/configuração do banco de destino e fazer backup do banco e dos uploads. Esta entrega não autoriza aplicar migração em produção.

Reversão segura: suspender o novo fluxo e reverter o código, mantendo tabelas novas, revisões e arquivos. A versão antiga não exibirá os dados novos, mas eles permanecem recuperáveis. Não executar DROP, DELETE, importação legada ou reimportação para "reverter". Não remover FKs nem arquivos privados; não há rollback destrutivo automático.

O importador legado existente pode sobrescrever dados quando executado fora do modo de apenas ausentes. Não foi executado nem ampliado nesta etapa. Uma futura migração de `brief_assignments`/`brief_responses` do Supabase deve ser separada e preservar a origem, sem inventar snapshots ou revisões que nunca foram registrados.
