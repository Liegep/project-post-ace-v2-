# PR #38 — validação editorial em MariaDB descartável

Branch `codex/radar-editorial-brief`, revisão inicial `f16b78bd444e5518147fb220a0097331e713c083`. Base `e289a7be443d75aa69a5e45fd4f6ec199a901946`.

## Ambiente e limite da conclusão

MariaDB **10.11.19**, InnoDB, utf8mb4, modo estrito e UTC, em diretório criado por `mktemp` sob `/tmp/radar-mariadb-*`. Servidor iniciado com `--no-defaults --skip-networking`: somente socket local, sem TCP, `.env` ou credenciais da aplicação. Cada fixture cria e apaga seu próprio banco. Node 22.23.3. Dados inteiramente sintéticos; provedor de IA injetado e simulado, sem chamadas externas.

A versão da Hostinger documentada pela auditoria de 04/10 é **11.8.9-MariaDB-log** (`docs/seasonal-radar-production-migration-2026-10-04.md`). Ela não foi consultada novamente em produção. O motor disponível nesta máquina é 10.11.19; não há Docker nem instalação local 11.8.9. **Não se afirma execução na versão exata da Hostinger.** A compatibilidade dos tipos e da sintaxe com 11.8 é sustentada pela documentação oficial; o comportamento completo foi exercitado em 10.11.19.

Referências primárias: [JSON no MariaDB](https://mariadb.com/docs/server/reference/data-types/string-data-types/json), [ALTER TABLE / IF NOT EXISTS](https://mariadb.com/docs/server/reference/sql-statements/data-definition/alter/alter-table), [DDL e commit implícito](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit). `JSON` é um alias de LONGTEXT com collation binária e verificação de JSON válido; `MEDIUMTEXT` e `ADD COLUMN IF NOT EXISTS` são suportados. Ambas as colunas novas são anuláveis, evitando preencher registros históricos com conteúdo inventado.

## Migration real

O teste reconstrói o esquema anterior removendo o campo novo apenas da fixture descartável. Não basta executar contra o schema atual, que já contém `editorial_brief_json`.

- Aplicação real de `20261014_radar_editorial_brief.sql` sobre cards, sugestão descartada, pautas aprovadas e eventos anteriores.
- Conferência de tipos, nulabilidade e collation no `information_schema`; registros anteriores recebem NULL nos campos novos.
- Comparação integral dos valores e timestamps históricos antes/depois, incluindo JSON bruto de snapshots; nenhum UPDATE/backfill.
- Índices e chaves estrangeiras anteriores permanecem iguais.
- CHECK de JSON rejeita documento inválido (erro 4025); texto longo com Unicode/emoji preservado na sugestão e no briefing.
- Reexecução preserva registros, inclusive conteúdo já salvo nos novos campos.
- Falha provocada na segunda instrução por indisponibilidade temporária da tabela de cards: a primeira coluna permanece adicionada, sem alteração dos dados. Após restaurar a tabela, reaplicação conclui e uma repetição adicional permanece segura.

**Os dois ALTERs não formam uma transação atômica.** O procedimento correto após falha é corrigir a causa, conferir o schema e reaplicar. `IF NOT EXISTS` não corrige um campo previamente criado com tipo errado. Os comentários da migration agora explicitam essas duas condições. Não é necessário outro DDL ou backfill.

## Fluxo e concorrência

`pauta-editorial.mysql.test.ts` executa os serviços e repositórios reais com conexões independentes, não traduz SQL para SQLite:

1. Três contas sintéticas: entrada de sugestão, armazenamento do resumo factual, aceitação, edição do rascunho, envio, card e renderização do componente do cliente.
2. Conceito/gancho/descrição/justificativa/objetivo disponíveis preservados; resumo original, título/URL/data da fonte mantidos. Dados técnicos e estratégicos sintéticos presentes na origem não aparecem no HTML do briefing.
3. Solicitação de alterações → edição enviada → reenvio → aprovação. Card, pauta e evento da revisão usam o conteúdo consistente. Snapshots anteriores permanecem integralmente iguais e são renderizados pelo componente histórico.
4. Oito envios simultâneos produzem um card. Duas edições diferentes com a mesma revisão produzem um sucesso e um conflito 409; nenhuma substituição silenciosa. Cliente alheio não encontra a pauta.
5. Falha na gravação do evento reverte card, banco, versão de legenda e invalidação do link juntos.
6. Confirmação de commit perdida é simulada **depois do commit real**; replay do envio/edição retorna o vínculo/revisão gravado, sem duplicar card ou evento.
7. Aprovação real impede edição mesmo com status desatualizado no banco. Pauta manual e card antigo sem briefing continuam legíveis; nenhum resumo ou fonte é reconstruído.

A suíte MCP existente foi ampliada para provar `create_radar_suggestion` pelo transporte MCP em memória → API de aceitação → envio transacional → briefing do card, com resumo/URL/data iguais ao input e nenhuma chamada adicional ao provedor simulado. Suítes existentes também verificam consentimento, isolamento, deduplicação, recuperação desabilitada e falhas de commit.

Isso valida o armazenamento, operações transacionais e renderização React do componente. Não substitui um teste navegável do portal implantado; nenhum portal ou cliente real foi acessado nesta etapa.

## Resultados e correções

- **651 testes automatizados de regressão:** passaram, zero falhas ou skips.
- **34 testes nativos MariaDB:** cinco novos editoriais mais 29 existentes de Radar/MCP/recuperação; todos passaram após a correção descrita abaixo.
- Typecheck API/web: aprovado.
- Build API/web: aprovado; aviso existente de chunks acima de 500 kB.
- `git diff --check`: aprovado.

A suíte SQL antiga esperava 32 campos em `radar_suggestions`, mas a migration adiciona o 33º. Corrigida a asserção e incluída verificação explícita do tipo `source_summary`. Não foi encontrada falha funcional no DDL ou nos serviços de recuperação/briefing exercitados. Adicionados teste nativo, comando `test:editorial-brief:mysql`, cobertura MCP e documentação. A migration recebeu apenas comentários operacionais; seu SQL permanece aditivo.

## PR #39 — comparação sem incorporação

Comparado com `codex/internal-approval-reviewers`, SHA `a00042ed2edec44fdb6c130a127ae476c469b639`, mesma base main. Inspeção do diff e simulação textual `git merge-tree BASE PR38 PR39`, sem checkout, merge ou cherry-pick do PR #39.

| Arquivo | Conflito confirmado | Conciliação futura |
| --- | --- | --- |
| `v2/apps/web/src/App.tsx` | Imports iniciais | Preservar imports de envio/briefing do #38 e de revisores/inbox do #39. O #39 também remove o tipo local de aprovação interna, substituído pelo tipo da API; não restaurar o fluxo local antigo. |
| `v2/apps/web/src/api.ts` | Funções adicionadas ao final do arquivo | Manter `sendAdminPautaForApprovalBySlug` e as três funções/tipos de aprovação interna, cada qual com seu fechamento correto; preservar `editorialBrief` e a resposta de edição com revisão. |
| `v2/apps/api/package.json` | `scripts.test` e comandos adicionados | Unir as listas de testes e conservar ambos os conjuntos de comandos, incluindo os testes MariaDB editoriais. |

O #39 altera `approvals.routes.ts`, que o #38 não altera, e propõe `internal_approval_requests`, enquanto o #38 adiciona campos a duas tabelas existentes. Não há colisão DDL direta identificada. A aprovação interna do #39 não deve escrever `editorial_brief_json`, alterar a revisão de aprovação do cliente nem substituir o snapshot enviado. Após futura conciliação, rodar testes dos dois fluxos; esta revisão **não certifica uma combinação que não foi incorporada**.

## Aplicação futura

Merge, deploy e migration em produção permanecem sujeitos à autorização. Antes de ativar o código, conferir versão, existência/tipos das tabelas/colunas e aplicar a migration no ambiente aprovado com backup e acompanhamento. Em falha parcial, não iniciar o código novo com schema incompleto: verificar e reaplicar após resolver a causa. Reverter somente o código mantendo os campos opcionais preserva os dados. Não apagar colunas, reconstruir resumos ou alterar textos antigos.

Nenhuma alteração de produção, chamada real à IA, merge ou deploy foi executado.
