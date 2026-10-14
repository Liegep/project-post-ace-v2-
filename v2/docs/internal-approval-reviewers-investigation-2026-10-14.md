# Aprovação interna — investigação e correção para revisão

Branch: `codex/internal-approval-reviewers`, criada em worktree própria a partir de `origin/main` atualizado (`e289a7be`). Nenhum arquivo do checkout compartilhado foi editado. Não houve merge, deploy, aplicação de migração ou alteração de usuários/dados em produção.

## Causa dos cenários A e B

A janela de revisão de cards da V2 chamava `listManagedUsers()` (`GET /api/auth/users`), uma rota para gestão de acessos:

- Para Aline (`admin`), a rota remove todos os `super_admin`. A conta legítima da administradora principal é ocultada independentemente de memberships.
- Para Liege (`super_admin`), a rota retorna todas as contas. A janela filtra apenas ativos/clientes; não exclui o próprio usuário nem a identidade de demonstração. Por isso aparecem duas identidades com o mesmo nome.
- Colaboradores recebem 403 nessa rota, embora possam participar do fluxo interno.
- Não havia filtro de acesso do revisor ao cliente do card.

A rota de gestão permanece igual. Uma rota específica retorna revisores internos ativos, exclui o solicitante por ID e inclui super admins globais mesmo sem membership explícito. Admins e colaboradores precisam de membership interno no cliente. `EXISTS` evita duplicatas por múltiplos vínculos. Pessoas distintas com nomes iguais não são fundidas.

## Identidade temporária: evidência e limites

O par `11111111-1111-4111-8111-111111111111` + `liege@designhub.local` é definido como login sintético em `v2/apps/api/src/scripts/bootstrap-local-db.ts`, replicado em `v2/apps/web/src/mockData.ts` e documentado em `v2/LOCAL_MYSQL_SETUP.md`. O bootstrap marca a identidade como ativa por padrão; esse flag sozinho não prova uso humano.

A seleção exclui **somente esse par exato**. Se o ID ou e-mail mudar, a regra não exclui a identidade. Outros endereços `.local`, outros super admins e outras pessoas chamadas Liege permanecem elegíveis pelas regras de acesso. Não há desativação, fusão, troca de IDs ou alteração de usuários.

Referências comprovadas no código do bootstrap:

- Proprietária das contas sintéticas Aplikasi, Minas e Podcast.
- Memberships e autoria da atribuição de membros.
- Autoria de cards, comentários e links de aprovação sintéticos.
- Referências de conteúdo e registros sintéticos criados pelo mesmo bootstrap.

O schema também permite referências a usuários em sessões/reset de senha, agenda, tempo, textos, relatórios, briefings, faturas/anexos, propostas, contratos, Brand Brain e MCP. Essas possibilidades não são contagens reais de produção.

Foi tentada uma conexão **somente leitura** usando a configuração existente. O banco remoto recusou a conexão com `ER_ACCESS_DENIED_ERROR`; nenhuma consulta de dados foi executada. Não foi possível confirmar o ID da entrada temporária em produção, seus vínculos, login recente ou uso humano. **Não se propõe desativação.** Se o registro de produção não corresponder ao par sintético documentado, ele permanece na seleção até investigação adicional.

O comando `npm --workspace @design-hub-v2/api run audit:internal-reviewer`, executado no diretório `v2` com configuração autorizada, abre uma transação READ ONLY e inventaria IDs, papéis, atividade e contagens em colunas de referência a usuários. Não consulta hashes, não escreve, não desativa e não reatribui. Sua saída deve permanecer privada. Não cobre dados em JSON, exportações externas nem registros antigos no navegador; contagens não provam uso humano.

## IDs, histórico e notificações

O envio anterior criava um comentário com os nomes e gravava a notificação apenas em `localStorage`. Isso não entregava a solicitação ao navegador/dispositivo do destinatário.

O novo envio revalida todos os revisores no servidor. Seleção própria, demo identificada, cliente, inativo, inexistente ou sem acesso é rejeitada antes de gravar histórico. Comentário interno e solicitações são gravados na mesma transação, com IDs reais de solicitante, destinatário e comentário. Uma falha reverte também o contador de comentários.

A inbox usa o ID da sessão autenticada, com nova verificação do acesso ao cliente. A barra de notificações e o dashboard consultam essa inbox. Preferências locais de leitura/ocultação continuam locais. Os registros anteriores no navegador não são apagados nem importados automaticamente; novos envios usam exclusivamente a inbox do servidor. Comentários antigos permanecem no histórico.

## Migração e integração

`v2/database/migrations/20261014_internal_approval_requests.sql` cria somente a tabela de solicitações internas. Deve ser aplicada explicitamente em etapa futura, após revisão, antes de disponibilizar este código. Não é executada no startup e não modifica usuários nem reatribui históricos. Exclusão de card/cliente segue o padrão de cascata do schema; exclusão de comentário/usuário preserva a solicitação com vínculo nulo.

Possível sobreposição com o trabalho paralelo: `v2/apps/web/src/App.tsx`, `v2/apps/web/src/api.ts`, `v2/apps/api/src/modules/approvals/approvals.routes.ts` e `v2/apps/api/package.json`. As alterações são pontuais e foram feitas apenas nesta worktree a partir do main. Nenhum conteúdo modificado da outra sessão foi copiado ou sobrescrito. Resolver eventual conflito na revisão dos PRs; nenhum arquivo de Radar, briefing ou template foi alterado.

## Validação

- 8 testes de API/SQL isolados: sessões Aline, Liege e colaborador; super admin sem membership; exclusão própria/demo; preservação de outros revisores e nomes iguais; rejeição de destinatários inválidos/inativos; escopo; IDs do histórico/inbox; rollback.
- Suíte completa: 636 testes aprovados.
- MariaDB 10.11.19 local isolado, somente socket Unix e networking desativado: migração real reexecutável, cinco FKs, usuários inalterados, listas das duas sessões, envio, leitura em outra conexão e rollback por falha nativa.
- Typecheck de API e web aprovado.
- Build de API e web aprovado. Apenas aviso de tamanho de bundle já existente.
- Validação final no runtime declarado: Node 22.23.3, com 636 testes, teste MariaDB, typecheck e build aprovados. As primeiras verificações também passaram em Node 24.14.1.

Esses resultados validam o código e cenários sintéticos; não representam execução das sessões reais em produção. A auditoria remota continua pendente por acesso negado.
