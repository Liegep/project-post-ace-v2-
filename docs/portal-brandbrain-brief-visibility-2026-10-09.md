# Brand Brain e Briefs no portal — validação de 09/10/2026

Base: `17649edc74b85fbc5fe297afcc34a52bc4073025`.
Branch: `codex/portal-brandbrain-brief-visibility`.

## Patrícia Rodrigues: investigação somente de leitura

Conta observada: **Patricia Rodrigues - Adv.**, slug `adv-patricia-rodrigues`.
Na sessão administrativa existente de liegestudio.com, Configurações → Kanban e portal mostrou “Editar Brand Brain” e “Ver Brand Brain” marcados. Nenhum toggle foi acionado.
Ao abrir o portal da mesma conta e depois recarregar, Brand Brain continuou no menu e no atalho do quadro. A sessão disponível era de super admin; não foi utilizado login da cliente.

O código liga essas evidências pelo seguinte caminho:

1. `GET /clients/:id/tracker-settings` lê `client_permissions` por `client_account_id` através de `findClientPermissionsByAccountId`.
2. `GET /portal/accounts/:id/home` usa a mesma função e devolve `permissions` em `getPortalHome`.
3. `loadClientPortalBySlug` usa `homeResponse.permissions`, inclusive se a requisição de board falhar. Os GETs usam `cache: no-store`.
4. O menu e o atalho de Brand Brain só são renderizados com `data.permissions.allowClientViewBrandBrain=true`, sem bypass de super admin nessa condição.

Assim, o menu observado após refresh confirma o View efetivo como true no caminho da interface. Não houve consulta direta ao banco de produção nem captura do JSON bruto da resposta em produção. O teste local cobre explicitamente a gravação, o valor no banco e o JSON de home numa sessão com papel cliente.
Não foi reproduzida uma perda atual de View nessa conta. A combinação inválida Edit=true/View=false era possível nos toggles e nas entradas anteriores do backend.

## Correção

- Um único normalizador compartilhado aplica Edit ⇒ View nas entradas de criação e tracker e na leitura de permissões existentes. Não é necessária migração nem alteração dos registros legados durante a leitura.
- O toggle Edit ativa View; desligar View também desliga Edit. O backend normaliza entradas inconsistentes antes de persistir.
- O menu Briefs usa a lista de `GET /portal/accounts/:id/briefs`, a mesma API utilizada para consulta. Não há nova permissão, consulta SQL paralela ou regra de status para selecionar os briefs visíveis.
- Lista vazia oculta o item. Qualquer brief retornado permanece consultável, incluindo respondidos. Apenas `sent` e `reopened` contam como pendentes.
- Refresh recarrega a lista. A lista atualizada depois de enviar uma resposta também atualiza o contador.
- Autorização e filtros do backend de Briefs permanecem intactos: conta própria e `sent_at IS NOT NULL`; detalhes de drafts e briefs de outra conta retornam 404, acesso a uma conta sem associação retorna 403.

## Validação

Node 22.23.3; banco MariaDB temporário, sem rede, socket `/tmp/briefs-mariadb-foundation/server.sock`; dados fictícios descartados após cada execução. Nenhum `.env` de produção foi utilizado.

Comandos executados na pasta `v2` (Node 22):

```sh
BRIEF_TEST_SOCKET=/tmp/briefs-mariadb-foundation/server.sock node node_modules/tsx/dist/cli.mjs --test apps/api/src/modules/brief-foundation/brief.mysql.test.ts apps/api/src/modules/brief-foundation/brief.test.ts apps/api/src/modules/portal/portal-calendar.test.ts apps/web/tests/portalVisibility.test.ts apps/web/tests/briefFoundation.test.tsx
npm run check
npm run build
```

Resultados: **25 testes aprovados**, zero falhas ou skips; typecheck API/web aprovado; build API/web aprovado. O build emite aviso de tamanho de chunks, sem falha.

Cobertura inclui toggles, normalização em criação/tracker, persistência e refresh de home, leitura de configurações legadas sem escrita, menu sem briefs, draft invisível, envio visível, isolamento por conta, resposta consultável, reabertura, contador de pendentes e atualização imediata do contador após resposta. O novo teste de menu também integra o comando padrão `test` da API.

Sem merge, deploy, escrita em produção ou chamadas a OpenAI.
