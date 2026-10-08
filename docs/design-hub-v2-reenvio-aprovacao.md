# Reenvio de posts para aprovação — Design Hub V2

Implementação sobre o estado atual da V2, sem alterações no legado em `src/` ou nas migrações Supabase.

## Uso

No editor administrativo, logo abaixo de **Feedback do cliente**, um post aprovado ou com alteração solicitada oferece **Enviar novamente para aprovação**. A ação salva a correção, reabre a revisão no portal e disponibiliza um novo link público de sete dias para copiar. Não envia e-mail ou mensagem automaticamente.

O mesmo card é mantido. Comentários, versões de legenda, mídia, etiquetas, datas e aprovações internas permanecem. A coluna é preservada, exceto se for uma coluna de Aprovados que esconderia a revisão; nesse caso o post vai para **Aguardando aprovação**. Pautas mantêm sua identificação e destino separado quando aprovadas.

Posts agendados, publicados ou arquivados não são reabertos silenciosamente. O botão explica o impedimento. Agendamento e arquivamento automático existentes continuam responsáveis por essas etapas.

## Persistência e concorrência

- `kanban_cards.approval_state` identifica a decisão vigente (`pending`, `approved`, `changes_requested`); `NULL` identifica os registros anteriores ao novo fluxo.
- `approval_revision` avança a cada decisão/reenvio. O editor e o portal enviam a revisão conhecida; uma operação desatualizada recebe 409.
- `card_approval_events` registra ação, origem, usuário/nome/papel, data, comentário associado, link e snapshots antes/depois. Há unicidade por card/revisão.
- Decisões dos dois canais e reenvio são transações com bloqueio do card. Comentário, estado, movimentação, tokens e evento são confirmados juntos ou revertidos juntos.
- O primeiro evento preserva o estado legado como captura, sem inventar autor ou data da decisão original. As datas anteriores disponíveis permanecem no snapshot e nos comentários/links originais.
- Links antigos são encerrados; `approved_at`, `viewed_at`, criação e autor não são apagados. A reconciliação de inicialização considera o estado atual dos cards rastreados, não qualquer aprovação histórica.
- O histórico aparece no editor. O dashboard usa decisões registradas com datas estáveis e não oferece Agendar para uma aprovação histórica já superada.
- O editor bloqueia interação durante o reenvio e atualiza revisão, marcadores, coluna e referências de salvamento depois da confirmação. Rascunhos antigos podem ser reconciliados explicitamente, mantendo legenda/arquivos em edição.
- O portal não mantém mais uma lista de IDs aprovados sobreposta ao servidor. Preserva a animação de aprovação, atualiza ao recuperar foco e a cada minuto enquanto visível. Falha de atualização conserva o quadro anterior, sem descartar permissões recebidas do servidor.

## Banco e publicação

A preparação aditiva e idempotente `ensureApprovalStorage` está ligada à inicialização da API e ao bootstrap existente. Os dois schemas de instalação incluem a estrutura nova.

Para instalações com migração manual, existe `v2/database/migrations/20260921_card_approval_resubmission.sql`. Seus dois `ALTER TABLE` são para execução única; não executar o arquivo depois de a inicialização já ter criado as colunas. Não há backfill que invente decisões antigas nem remoção de dados.

Nenhuma migração foi executada no banco remoto durante esta implementação. A publicação requer disponibilizar API e frontend juntos e conferir a preparação do schema no ambiente de destino. As versões antigas de navegador recebem conflito após uma nova decisão, evitando sobrescrever o novo ciclo; atualizar a página carrega a interface compatível.

## Verificação

- `npm --prefix v2 run check`
- `npm --prefix v2 run build`
- `npm --prefix v2 run test --workspace=@design-hub-v2/api`

A suíte de aprovação executa os serviços e repositórios reais em SQL isolado, usando SQLite com adaptação explícita do dialeto MySQL. Cobre o ciclo completo, histórico/comentários, tokens encerrados, rollback, revisões obsoletas, duplicidade, agendamento/arquivamento, pautas e permissões. Não substitui a validação de DDL e bloqueios concorrentes no MySQL do ambiente de destino.

A interface foi exercitada em navegador local com respostas de API simuladas: salvar antes de reenviar, atualização de revisão, edição posterior sem recuperar marcadores antigos, persistência visual em falha de atualização e sincronização do portal após reabertura no servidor.

## Integração com as mudanças recentes do GitHub

Base integrada: `a1fd0c5f` da branch `main`. Permanecem as permissões por cliente e papel, privacidade dos comentários administrativos, otimização da ordenação, preparação de timezone, uploads persistentes, proteção de carregamento inicial, identificação de alterações solicitadas e destaque de links de material no portal.

A conversão de pauta em post conserva os gatilhos existentes, mas passa a atualizar `approval_reset_at`, a nova revisão e o histórico na mesma transação. Os links da pauta ficam preservados e encerrados. A recuperação de pautas legadas não transforma novamente em pauta um post já convertido.

O histórico `card_activity_events` existente continua recebendo as decisões do portal dentro da transação; a criação da tabela ocorre na preparação das rotas, evitando DDL durante a decisão. O histórico do Kanban também mostra o reenvio e a conversão.
