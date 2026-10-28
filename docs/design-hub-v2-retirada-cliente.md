# Retirada reversível de pautas do Portal do Cliente

## Investigação e implementação

A pauta editorial fica em `client_accounts.workspace_drawer_json.pautaIdeas`. O envio existente (`sendPautaForApproval`) cria um `kanban_cards` com `is_brief_approval=1` e guarda o vínculo `cardId` no banco. Não se trata do questionário `design_briefs`, nem dos documentos do módulo `brief-foundation`.

A visibilidade anterior aceitava tanto o status `Enviar para Cliente` quanto `isBriefApproval`. Remover apenas o status ou arquivar a pauta não era suficiente: busca, arquivados, detalhes, comentários e links públicos poderiam continuar acessíveis. Exclusão não é reutilizada.

O campo proposto `kanban_cards.brief_withdrawn_at` é a barreira persistente. Apenas a retirada e o reenvio explícito escrevem nele; o schema de atualização comum não o aceita. Portanto edição, salvamento de uma aba antiga, movimentação ou atualização do JSON do banco não restabelecem visibilidade. A interface deriva o status do card no servidor e não tenta reparar o status por gravações automáticas do drawer.

A retirada mantém conteúdo, cliente, imagens, anexos, etiquetas, colunas, vínculos e decisões existentes. Encerra `approval_links.is_active`, sem apagar `approved_at`, `viewed_at` ou os links. Preserva o snapshot legado quando necessário, registra evento `withdrawn` e comentário interno. Retirada e decisões incrementam a revisão; ações com revisões antigas recebem conflito. As ações do Portal são bloqueadas também quando feitas por URL direta.

O reenvio usa `resubmitCardApproval`, o fluxo existente: mesmo card, nova revisão pendente e novo link. O histórico permanece e os tokens antigos continuam encerrados. Decisões e transições travam a mesma linha com `FOR UPDATE`; comentários, legendas e etiquetas do cliente também verificam a retirada dentro do bloqueio. Se a decisão vence a corrida, a retirada deve ser refeita com a revisão atual; se a retirada vence, a ação do cliente é recusada.

Permissões: retirada e reenvio exigem acesso interno e vínculo de admin/colaborador na conta, ou super admin. Clientes e usuários de outras contas são recusados. A ação é restrita a pautas de aprovação; cards comuns, pautas convertidas em posts, agendamentos e publicações não são retirados por ela. Não há exclusão de arquivos nem alteração das tabelas de publicação Meta.

As notificações encontradas no cabeçalho são de aprovação interna. Não há disparo de email ou fila de notificação do cliente no envio de pauta investigado. Links já compartilhados continuam existindo como histórico, mas não permitem novas ações; o dashboard deixa de considerar a pauta retirada como aprovação ativa. Uma página já aberta pode conservar texto previamente carregado até atualizar; qualquer nova ação consulta o servidor e é recusada.

## Validação

- Suite MariaDB em instância descartável local: migration proposta aplicada apenas ao banco sintético; pautas pendentes/aprovadas, envio real, retirada, conexão reaberta, edição interna, revisão antiga recusada, busca e arquivados, preservação de arquivos por referência/comentários/decisões/drawer, reenvio no mesmo card, permissões e isolamento de outros cards, decisão concorrente recusada sem comentário residual.
- Teste React/JSDOM: menu, mensagem exata, cancelamento, confirmação, status persistente após desmontar e remontar a tela e reenvio explícito com revisão. Não substitui um teste manual em navegador integrado a staging.
- Suite geral, typecheck e build executados; resultados finais no PR.

Nenhum banco de produção ou staging foi acessado. Sem merge ou deploy.
