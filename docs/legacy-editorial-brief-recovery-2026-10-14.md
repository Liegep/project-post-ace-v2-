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

- **658 testes de regressão passaram**, zero falhas/skips.
- **14 testes nativos MariaDB passaram**: nove novos de recuperação e cinco existentes do ciclo editorial.
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
