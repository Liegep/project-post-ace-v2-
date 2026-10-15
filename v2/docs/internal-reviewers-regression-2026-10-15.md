# Seletor de aprovação interna — diagnóstico e cobertura

Data: 15/10/2026. Base: `07723e36a11cdcaec5f0912ac7f9fe64f6449a84` (main após #43, #44 e #45).

## Resultado e limite

Não foi reproduzida uma regressão que remova destinatários elegíveis. Em produção, na sessão autenticada da conta real de Liège (super_admin), o seletor do card **AGO 10 - Imóvel 1415**, em **Minas Home ADS**, apresentou **Aline e Thomas**. A verificação foi feita pela interface, abrindo e fechando o card/seletor, sem edição nem envio.

A tela Equipe mostrou Agnes vinculada a Serena Genovese e Thomas vinculado a Minas Home ADS. Esses vínculos visíveis ajudam a explicar por que o conjunto de revisores varia por cliente. A lista não representa todos os usuários internos do sistema.

O relato original ainda não identifica cliente/card, conta solicitante e usuários esperados. Portanto, esta observação não encerra a investigação de um possível caso diferente. Foi solicitada essa informação na conversa. A tentativa de acesso direto ao banco em transação READ ONLY foi recusada com `ER_ACCESS_DENIED_ERROR`, antes de consultar dados. Não há confirmação direta dos IDs, flags e papéis dos vínculos reais pelo banco, nem captura do JSON bruto da API de produção.

**Este PR acrescenta diagnóstico, testes e esclarecimento na janela; não afirma corrigir uma regressão funcional ainda não reproduzida.** Não altera regras de elegibilidade ou autorização para ampliar a lista artificialmente.

## Comparação com #39 e alterações posteriores

Comparação de `fa8f6d9e` (#39) com a base:

- `internal-reviewers.repository.ts` e `internal-approvals.routes.ts` estão inalterados.
- A API web continua chamando `GET /api/clients/:clientAccountId/internal-approval-reviewers`, resolvendo o cliente pelo slug.
- O efeito do editor continua carregando os revisores ao abrir a janela e atribuindo `items` diretamente a `internalUsers`. A renderização faz `internalUsers.map`, sem filtro adicional, deduplicação por nome, limite de quantidade ou chamada à gestão de usuários.
- #43 altera estado/classificação do editor, #44 extrai o widget do dashboard e #45 altera som de notificações. Nenhum deles modifica seleção, consulta, revalidação ou persistência de destinatários.

## Regras vigentes

| Condição | Resultado |
| --- | --- |
| Usuário ativo, global_role interno | Pré-requisito |
| ID igual ao solicitante | Excluído, inclusive super_admin real |
| Par exato do bootstrap: `11111111-1111-4111-8111-111111111111` + `liege@designhub.local` | Excluído |
| Super_admin real distinto do solicitante | Elegível sem vínculo explícito com o cliente |
| Admin/colaborador | Exige vínculo com o cliente de papel admin/colaborador |
| Vínculo apenas cliente, usuário inativo, cliente externo ou outro cliente | Excluído |
| Nome igual ao de outra pessoa, domínio `.local`, outros IDs/e-mails | Não excluídos por essas características |

A comparação do e-mail sintético usa `LOWER`. Não se fundem identidades ou nomes. `EXISTS` evita duplicatas por vínculos adicionais. O acesso do solicitante é validado por `assertInternalAccess` e `assertClientAccess`, e a lista é reconsultada durante o envio antes da gravação transacional.

Quando Liège solicita para uma conta onde apenas Aline possui vínculo interno, mostrar somente Aline é compatível com #39: a solicitante sai por ID, a demo sai pelo par exato, e colaboradores de outros clientes não entram. Esse cenário foi reproduzido com dados sintéticos. Quando Aline solicita nesse mesmo cenário, a conta real de super_admin aparece, mesmo sem membership.

## Alteração proposta

A janela passa a explicar que mostra membros internos ativos **com acesso ao cliente** e exclui o próprio solicitante. O texto anterior apenas dizia que clientes não apareciam, sem explicar escopo e exclusão própria.

Foram acrescentados quatro testes de rotas/SQL, exercitando clientes com vínculos diferentes nas sessões admin, colaborador e super_admin e o caso de destinatária única. As consultas são comparadas com snapshots de usuários, vínculos, cards, comentários e solicitações para comprovar ausência de alterações. A suíte existente cobre IDs reais, demo exata, homônimos, `.local` legítimo, inativos, escopo, revalidação, envio múltiplo, inbox e rollback.

Sete cenários novos de navegador usam o **CardDetailModal real** com respostas HTTP sintéticas: paridade exata entre resposta e labels para admin/colaborador/super_admin, destinatária única, lista vazia, falha com nova tentativa e resposta atrasada após fechar/reabrir. Os cenários de envio verificam todos os IDs selecionados, ausência de outras escritas e preservação de legenda/comentário. Nomes iguais e `.local` legítimo não somem na interface. Esses testes validam o consumo da resposta pela interface; não representam login real de cada papel em produção. As regras de cada papel são exercitadas separadamente nas rotas reais da API com SQL isolado.

## Validação

A partir de `v2/`:

- `npm --workspace @design-hub-v2/api test`: **698 aprovados**, zero falhas/skips (inclui os 12 testes internos).
- `npm --workspace @design-hub-v2/api run test:internal-approvals`: **12 aprovados**.
- `npm --workspace @design-hub-v2/web run test:internal-reviewers`: **7 cenários + teste pai, 8 aprovados**, zero falhas/skips.
- `npm run check` e `npm run build`: API e web aprovados. Aviso existente de bundle acima de 500 kB.
- `git diff --check`: aprovado.

Runtime local: Node 24.14.1; o projeto declara Node 22. Não foi executada suíte MariaDB nesta etapa; SQL dos testes de rota usa SQLite em memória, como a suíte herdada do #39. Não foram usados serviços de IA, credenciais de produção nos testes ou requisições externas nas fixtures de navegador.

## Preservação e pendência

Trabalho em branch/worktree própria, sem alterar o checkout compartilhado. Nenhum usuário criado/excluído, nenhuma alteração de vínculos/permissões em produção, nenhum envio real, nenhuma mudança em dados, histórico ou schema. Nenhuma migration criada/aplicada, nenhum merge ou deploy.

Para confirmar outro caso, são necessários cliente/card, identidade solicitante e destinatários esperados. A próxima comparação deve observar o JSON retornado nesse contexto e o acesso interno de cada destinatário, sem modificar cadastros para fazê-los aparecer. Se a regra desejada passar a incluir pessoas sem acesso ao cliente, isso requer uma decisão explícita sobre permissões e está fora desta proposta.
