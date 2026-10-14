# Aprovação interna — investigação e correção para revisão

Branch: `codex/internal-approval-reviewers`, em worktree própria. Atualizada com o main `3a509d753817bb6485866a9aee567031f4412241`, que incorpora os PRs #38 e #40. Nenhum arquivo do checkout compartilhado foi editado. O PR #39 não foi incorporado ao main; não houve deploy, aplicação de migração ou alteração de usuários/dados em produção.

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

Após a atualização com o PR #40, os conflitos em `v2/apps/web/src/App.tsx` e `v2/apps/api/package.json` foram resolvidos preservando ambos os lados; `v2/apps/web/src/api.ts` foi conciliado automaticamente e conferido. A atualização anterior já havia integrado o PR #38. Foram preservados os imports e APIs editoriais, os tipos `editorialBrief`, o envio transacional de pautas, a renderização dos snapshots e todos os comandos/listas de testes do main, junto com a seleção e inbox do #39. Fora desses três pontos de integração, os arquivos específicos dos PRs #38 e #40 permanecem idênticos ao main, incluindo os serviços de recuperação, suas permissões, prévia, aplicação e auditoria. A UI administrativa mantém `AdminEditorialBrief` e a renderização de `brief_restored`. Nenhuma alteração do checkout de outra sessão foi sobrescrita; o fluxo antigo de aprovação interna no navegador não foi restaurado.

## Validação

- 8 testes de API/SQL isolados: sessões Aline, Liege e colaborador; super admin sem membership; exclusão própria/demo; preservação de outros revisores e nomes iguais; rejeição de destinatários inválidos/inativos; escopo; IDs do histórico/inbox; rollback.
- Suíte completa combinada no main atualizado: **667 testes aprovados**, zero falhas ou skips.
- **49 testes MariaDB aprovados**, zero falhas ou skips: 47 de briefing editorial/recuperação administrativa/Radar/MCP/recuperação de Radar e 2 de aprovação interna, incluindo integração com recuperação administrativa. MariaDB 10.11.19 local isolado, somente sockets Unix, UTC e networking desativado. O teste integrado aplica as duas migrations sobre o schema anterior ao briefing, verifica cinco FKs, usuários inalterados, listas Aline/Liege, envio, inbox pelo ID legítimo, inbox demo vazia e rollback por falha nativa. Briefing, legenda, estado/revisão e eventos de aprovação do cliente são comparados integralmente antes/depois do envio interno e da falha.
- Typecheck de API e web aprovado.
- Build de API e web aprovado. Apenas aviso de tamanho de bundle já existente.
- Validação final no runtime declarado: **Node 22.23.3**. Todos os testes, typecheck e build acima foram executados após a resolução dos conflitos. `git diff --check` aprovado.
- Nesta atualização, as instâncias MariaDB descartáveis já foram iniciadas em UTC, com networking desativado. Não se afirma execução na versão exata do banco de produção. A falha de fuso relatada na atualização anterior não ocorreu nesta execução.

Esses resultados validam o código e cenários sintéticos; não representam execução das sessões reais em produção. A auditoria remota continua pendente por acesso negado.

## Migrations após a atualização

- Pendente do PR #39: `20261014_internal_approval_requests.sql`, a aplicar somente em etapa autorizada antes da disponibilização do código.
- Pré-requisito herdado do PR #38: `20261014_radar_editorial_brief.sql`. A aplicação em produção não foi consultada nesta etapa; conferir existência e tipos das colunas antes de qualquer aplicação autorizada.
- Nenhuma migration nova foi criada nesta atualização. As duas migrations foram aplicadas apenas nos bancos descartáveis dos testes. A auditoria de identidade em produção segue pendente; não houve nova tentativa de conexão remota nesta etapa.

## Recuperação administrativa e aprovação interna juntas

O novo teste usa as rotas HTTP reais dos dois recursos, com sessões sintéticas de Aline e Liege, sugestão aceita, pauta legada enviada e briefing ausente:

1. Aline consulta a prévia sem escrita e envia uma revisão interna para o ID legítimo da Liege; a conta demo não aparece na seleção.
2. O envio interno preserva conteúdo, sugestão, banco de pautas, links e eventos editoriais. Como ele acrescenta um comentário ao card examinado, a prévia anterior fica desatualizada e a aplicação retorna 409 sem escrita.
3. Uma nova prévia permite recuperar o briefing. A legenda humana permanece igual; a revisão avança, os links antigos são encerrados e os eventos `legacy_snapshot`/`brief_restored` são registrados conforme o #40.
4. Outro envio interno preserva integralmente o estado editorial recuperado. A repetição do comprovante da recuperação retorna `alreadyApplied` sem reescrever os eventos, mesmo após o novo comentário interno.
5. A inbox da Liege recebe as duas solicitações com IDs corretos de destinatária, solicitante, card e comentários; a inbox demo permanece vazia.

Esse teste não recupera nenhuma pauta real. Os demais testes do #40 continuam cobrindo proteção de aprovados, concorrência, permissões, falhas, replay e portal. O #40 não exige migration adicional: permanecem apenas os requisitos de schema dos PRs #38/#39 já documentados.
