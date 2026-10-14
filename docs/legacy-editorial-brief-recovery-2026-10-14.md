# Recuperação administrativa de briefing legado

Base: main `f40b36c540d0be8bc6fd89ded0bee7def2580645`. Branch: `codex/legacy-editorial-brief-recovery`. Não incorpora ou modifica a branch do PR #39.

## Diagnóstico

Pautas aceitas pelo fluxo anterior ao PR #38 podiam perder conceito, gancho e justificativa na conversão, enquanto a sugestão original preservava esses campos. Cards antigos não recebem briefing retroativamente pela migration. Também faltava apresentar o briefing atual no caminho `AdminCardEditor`, embora portal/link público já tivessem o componente.

O diagnóstico da Patrícia fornecido pelo usuário confirma esse cenário. A implementação é global: não contém IDs, títulos ou condições específicos dessa cliente. Nenhum texto privado da sugestão foi copiado para testes. O recurso não processa automaticamente pautas históricas.

## Operação individual e prévia obrigatória

1. Administrador ativo (admin/super_admin) com acesso ao cliente abre o card e seleciona “Consultar prévia de recuperação”. Clientes e colaboradores não podem usar os endpoints.
2. `GET /api/clients/:clientAccountId/cards/:cardId/editorial-brief-recovery/preview` lê uma visão consistente, sem criar reserva, evento, revisão ou alterar links. Exibe briefing atual, campos recuperáveis, divergências, indisponibilidade de resumo factual e efeitos da recuperação. Resposta `Cache-Control: no-store`.
3. Uma prévia elegível gera comprovante assinado com prazo de dez minutos, vinculado ao administrador, cliente, card e hash dos dados examinados. Não contém textos de marca. Dados alterados, prévia expirada, identidade diferente ou comprovante adulterado exigem nova prévia.
4. A interface distingue “Briefing editorial atual” de “Conteúdo recuperável — ainda não aplicado”. A confirmação é desmarcada inicialmente e declara encerramento de links antigos e necessidade de aprovação da nova revisão. Edições em salvamento ou revisão desatualizada impedem acionar a recuperação nessa tela.
5. `POST /api/clients/:clientAccountId/cards/:cardId/editorial-brief-recovery` aceita somente o comprovante da prévia e `confirm:true`. Não recebe textos substitutos do navegador. Não chama IA.

## Regras de preservação

- Confere vínculo único cliente → pauta → card e sugestão aceita vinculada àquela pauta.
- Complementa somente campos ausentes (NULL/ausentes/texto vazio) com valores válidos efetivamente existentes na sugestão. Campos preenchidos não são substituídos, inclusive diante de divergências.
- Descrição da pauta e legenda do card/pauta nunca são atualizadas. Título, mídias, status, coluna, estado de aprovação, comentários, versões de legenda e sugestão original permanecem iguais. O timestamp técnico de atualização das linhas pode avançar normalmente.
- A descrição original só entra em um briefing de card sem descrição quando não diverge da descrição já existente na pauta. Não sobrescreve descrições editoriais existentes. Título/legenda divergentes também são apresentados na prévia, sem copiar ou trocar esses campos.
- Recupera conceito, gancho, justificativa, objetivo, CTA e referência quando disponíveis. Resumo factual e data ausentes permanecem ausentes. Valores inválidos não são reinterpretados por IA; briefing existente incompatível exige revisão manual.
- Pauta precisa estar enviada e card precisa ser pauta pendente. Aprovação atual/inferida, aprovação histórica por evento/link, alterações solicitadas, arquivamento, publicação, agendamento, finalização e vínculo incompatível bloqueiam a aplicação. Mesmo uma revisão 0 pode ter aprovação histórica e ser bloqueada.
- Campos estratégicos/técnicos da sugestão não são copiados ao briefing do cliente. Metadados de auditoria da recuperação não são renderizados no portal ou no componente histórico.

## Transação, revisão e repetição

Aplicação bloqueia cliente, card, sugestão e links, recalcula a prévia e salva em uma transação:

1. Captura `legacy_snapshot` da revisão corrente somente se ainda não houver evento dessa revisão; não reescreve snapshots anteriores nem inventa autoria/data de uma aprovação histórica.
2. Grava campos complementares e briefing, incrementando `approval_revision` com condição da revisão conferida. **Não muda `approval_state` ou status.**
3. Encerra links ativos somente após confirmação válida e dentro da transação. Nenhum link/mensagem/reenvio é criado automaticamente.
4. Registra `brief_restored`, com decisão NULL (evento administrativo, não aprovação), antes/depois e origem. Preserva o valor anterior da coluna de briefing e a distinção entre campos ausentes/NULL/vazios da pauta, para uma reversão futura controlada.

A identificação assinada da prévia é o ID único do evento. Repetir a mesma operação durante a validade retorna `alreadyApplied`, inclusive após uma aprovação posterior, sem nova escrita. Uma outra prévia anterior fica desatualizada. Falha de armazenamento/auditoria reverte o conjunto; confirmação perdida depois do commit real permite consulta/repetição segura. Depois de expirar o comprovante, consultar briefing/histórico e gerar outra prévia; não há reprocessamento automático. Deadlock/timeout produz conflito e exige conferência de uma nova prévia. Erros públicos não incluem mensagens SQL ou textos privados.

O portal recebe a nova revisão. Uma tela antiga não pode aprová-la. Links antigos ficam encerrados; um novo link deve ser criado explicitamente no fluxo normal. Aprovação da revisão anterior não é atribuída ao briefing recuperado.

## Visualização

`AdminEditorialBrief` apresenta o briefing atual no editor administrativo, com o mesmo componente `EditorialBrief` do cliente. Cards manuais sem briefing não recebem painel vazio nem requisito de origem Radar. Pautas incompatíveis podem ser inspecionadas em prévia, mas não aplicadas. “Briefing original recuperado — nova aprovação necessária” identifica o evento no histórico, mantendo snapshots anteriores.

## Testes e limites

Node 22.23.3:

- **659 testes de regressão passaram**, zero falhas/skips.
- **18 testes nativos MariaDB passaram**: treze de recuperação/revisão e cinco existentes do ciclo editorial.
- Typecheck API/web e build API/web aprovados; aviso existente de bundles acima de 500 kB.
- `git diff --check` aprovado.

MariaDB 10.11.19 descartável, InnoDB/utf8mb4/UTC, `--no-defaults --skip-networking`, socket validado sob `/tmp/radar-mariadb-*`; nenhuma configuração ou credencial de produção. Cada fixture cria/apaga seu banco sintético. Não se afirma reprodução da versão exata 11.8.9 da Hostinger.

Cobertura: prévia sem escrita/cache; preenchimento apenas de ausentes; preservação de descrição/legenda/mídias/status e sugestão; proteção de aprovação histórica; snapshots anteriores; prova expirada/adulterada/desatualizada; isolamento de conta/administrador; permissões e confirmação; falha de auditoria; commit ambíguo; concorrência de recuperações e corrida com aprovação; portal HTTP; GET/decisão pública com link antigo rejeitados; novo link explícito funcionando; renderização administrativa/histórica e proteção de edições locais. Não foi testado o portal implantado nem usada IA real.

## Produção e rollback

Nenhuma nova migration é necessária: usa as colunas do PR #38 e a tabela existente `card_approval_events` (action VARCHAR, ID e revisão únicos). Não há DDL novo, backfill, execução automática ou mudança de ambiente neste PR.

Deploy/API/web e a aplicação a uma pauta real permanecem pendentes de autorização. Depois do deploy aprovado: abrir o card, conferir a prévia, decidir individualmente e confirmar; revisar o resultado/histórico e solicitar aprovação pelo fluxo normal, se autorizado. Não aplicar automaticamente à Patrícia.

- Antes do commit: rollback transacional integral, comprovado no MariaDB.
- Rollback funcional: suspender a ação de aplicação por uma alteração revisada, mantendo a leitura e o rótulo dos eventos já registrados; preservar colunas, snapshots e dados. Não confundir rollback de código com reversão de conteúdo.
- Depois do commit: não executar UPDATE corretivo genérico, apagar evento ou reduzir revisão. Uma reversão de dados necessita autorização específica, conferência de ausência de edição/decisão posterior e transação que restaure somente os campos alterados, crie nova revisão e acrescente evento compensatório. As pré-imagens necessárias estão preservadas no evento. Uma aprovação posterior bloqueia reversão automática.
- Links encerrados não devem ser reativados; novo link/reenvio depende de ação explícita. Não reutilizar snapshots aprovados para apresentar texto diferente.

A reversão de dados não é automatizada nesta entrega. Não foi feita recuperação real, escrita em produção, chamada de IA, merge ou deploy.

## Revisão final do PR #40

Revisão inicial: `8cf6a33e78a821bca7491485c14ab0409b39090c`.

### Elegibilidade da Patrícia: ainda não confirmada

Os resultados fornecidos pelo usuário comprovam campos recuperáveis na sugestão original, pauta `sent`, briefing do card NULL e revisão 0. **Não comprovam todas as condições de elegibilidade.** Ainda faltam:

- `is_brief_approval`, `approval_state`, status/tags/client_label completos;
- coluna, pertencimento ao cliente e sinais de estado terminal;
- arquivamento, publicação e agendamento;
- eventos de aprovação anteriores e todos os links, inclusive aprovados/inativos;
- vínculo único com o card, status `accepted` e `accepted_pauta_id` da sugestão;
- igualdade exata de descrição/URL, que não pode ser deduzida pelos comprimentos.

O MCP desta conversa não disponibiliza esses campos nem acesso SQL. Não foi usada conexão de produção nesta revisão. `docs/pr40-patricia-eligibility-readonly.sql` contém seis consultas SELECT restritas aos IDs fornecidos, sem textos editoriais, tokens, contatos ou autores. A sintaxe e a ausência de escrita foram verificadas em MariaDB descartável substituindo os IDs por fixtures sintéticas. O arquivo **não foi executado em produção**. Os resultados precisam ser conferidos antes de declarar elegibilidade; depois do deploy autorizado, a prévia e a aplicação ainda revalidam o estado atual.

### Correções

1. A prévia inicial apresentava somente acréscimos. Agora apresenta o briefing final completo usando `recoverableBrief`, com título/legenda atuais lidos do banco, iguais aos que permanecerão após a aplicação. Separa conteúdo atual salvo, campos recuperáveis e divergências em blocos próprios. Quando bloqueada, identifica o conteúdo como análise e não como recuperação disponível. Testes comprovam que campos atuais divergentes permanecem na prévia final e que o resultado aplicado é igual à prévia.
2. Colunas padronizadas de aprovados/publicados/agendados/finalizados/cancelados/arquivados bloqueiam recuperação, assim como coluna de outra conta. Nome/identidade da coluna participam da assinatura da prévia e são bloqueados durante a aplicação. Uma alteração de coluna invalida a prévia.
3. Indicadores explícitos de aprovação em status/tags/client_label continuam protegidos mesmo quando há outros indicadores conflitantes. `archived_at` não nulo e links vinculados a outra conta também bloqueiam.

### Endpoints e aprovação

| Caminho na API V2 | Proteção confirmada |
| --- | --- |
| GET `/portal/approval/:token` | Link encerrado/expirado não apresenta a aprovação. |
| POST `/portal/approval/:token/decision` | Verifica o link antes de iniciar e novamente após bloquear o card; encerramento por recuperação impede decisão mesmo se a checagem inicial já passou. |
| POST `/portal/accounts/:clientAccountId/cards/:cardId/decision` | Exige autenticação, acesso e permissão de aprovação; revisão antiga é recusada. Um token no body não substitui essas proteções. |
| POST `/clients/:clientAccountId/cards/:cardId/approval-links` | Exige autenticação/acesso e confere a revisão sob bloqueio; criação com revisão anterior é recusada. |
| `submitApprovalDecision` do repositório | Helper interno usado pelo workflow protegido; não há endpoint independente expondo essa gravação. |

A recuperação não chama decisão de aprovação, não grava `approved_at`, não cria comentário de aprovação nem evento `approved`. Grava `brief_restored` com decisão NULL e preserva estado/status. As provas cobrem aprovação e solicitação de alterações por link encerrado, revisão antiga no portal, criação de link antigo e um novo link legítimo criado explicitamente. A auditoria é do código/endpoints V2 deste repositório, não de um deploy ainda inexistente.

### Concorrência e confirmação perdida

Mantidos os testes de operação repetida, prévias concorrentes, rollback integral, commit efetivo com confirmação perdida e corrida com aprovação. Acrescentados:

- Pausa determinística de decisão pública entre a primeira checagem do token e o bloqueio do card; recuperação conclui e a decisão antiga retorna 403, sem aprovação.
- Criação de link concorrente: ou vence a recuperação e não resta link ativo da revisão anterior, ou o link é criado antes e a prévia fica desatualizada, sem escrita parcial.
- Consultas de elegibilidade executadas com IDs sintéticos mantêm integralmente as tabelas.

Resultado final: 659 testes de regressão, 18 nativos MariaDB (17 da suíte conjunta mais um de SQL fornecido), typecheck e build aprovados. Nenhuma migration nova, chamada à IA, escrita em produção, recuperação da Patrícia, merge ou deploy. Branch do PR #39 não alterada. O plano de rollback acima permanece válido.
