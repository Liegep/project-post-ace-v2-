# PR #37 — validação isolada da recuperação dos Radares

Validação de 12/10/2026, autorizada exclusivamente para MariaDB descartável. Branch `codex/radar-manual-recovery`, base `main` do PR #36. Nenhuma conexão com produção, leitura de `.env`, chamada real à IA, habilitação de recuperação em ambiente da aplicação, recuperação histórica, merge ou deploy.

## Ambiente e escopo

MariaDB **10.11.19**, InnoDB, `utf8mb4_unicode_ci`, UTC, modo estrito (`STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION`; mysql2 acrescenta `IGNORE_SPACE`). Servidor iniciado com `--no-defaults --skip-networking`, diretório de dados e socket exclusivos em `/tmp/radar-mariadb-*/`. Sem porta TCP. A suíte rejeita qualquer socket fora desse padrão e não possui fallback para host, credenciais da aplicação ou variáveis de conexão da produção.

Cada fixture cria um banco com nome UUID, aplica o schema real de `apps/api/src/db/schema.sql`, a fundação de Brand Brain e as migrations existentes de sugestões, telemetria e fontes; em seguida aplica **o próprio arquivo** `20261012_radar_recovery_attempts.sql`. Cria somente clientes, fontes, falhas e usuários sintéticos. Cada banco é descartado no encerramento da fixture; o servidor e o diretório temporários são removidos ao finalizar a validação.

A compatibilidade demonstrada é com as tabelas existentes **reconstituídas do repositório**, nesse engine. Não se inspecionou o schema vivo nem a versão do MariaDB de produção. Divergências locais de produção exigem conferência separada autorizada antes da aplicação lá; esta validação não concede autorização para isso.

## Resultados

| Verificação | Resultado observado |
| --- | --- |
| Migration e FKs | DDL aplicado pelo engine; as cinco referências são compatíveis. IDs das seis tabelas envolvidas são `CHAR(36)` com `utf8mb4_unicode_ci`. Referências inexistentes a fonte, cliente, usuário, sugestão e execução de IA são rejeitadas. |
| CHECKs | Números 0/3, ausência de consentimento/revisão e status desconhecido são rejeitados pelo MariaDB. Valores válidos são persistidos pelas operações reais. |
| UNIQUE e índices | Segundo número de tentativa igual ou mesmo UUID de solicitação na mesma fonte recebem `ER_DUP_ENTRY`. Índices de cliente/data e cliente/status existem, além dos índices de FK. |
| Histórico | Comparação integral de fontes originais, telemetria histórica e clientes, incluindo timestamps, antes/depois de migration, sucesso, falha, replay e no-op. Nenhuma alteração causada pela recuperação. DELETE da fonte referenciada é bloqueado; exclusão do ator anula somente seu vínculo. |
| Concorrência | Duas solicitações novas simultâneas em serviços independentes produzem uma reserva e uma sugestão pendente, com uma chamada simulada. Seis replays enquanto a IA está bloqueada retornam `processing`; solicitação nova é recusada. |
| Commit da reserva ambíguo | Injeção de erro após COMMIT real, antes da resposta ao serviço: zero chamadas à IA. Mesmo UUID retorna `processing`, nova solicitação é bloqueada. Não existe takeover automático. |
| Commit final ambíguo | Injeção de erro após COMMIT real: resultado persistido é reconciliado como `created`. Reenvio com mesmo UUID/pacote mantém IDs e não chama o provedor novamente. |
| Rollback | Trigger sintético recusa a conclusão: inserção da sugestão é revertida junto com a transação; a tentativa registra falha segura. Repetição da solicitação não chama IA novamente. |
| Vínculo da IA | Trigger recusa vincular o AI run antes do provedor: nenhuma chamada simulada, telemetria nova registra `storage_unavailable`. |
| Falha ao registrar falha | Trigger recusa o registro após timeout do provedor: resposta de armazenamento indisponível, tentativa continua reservada. Replay retorna `processing`; nova recuperação não toma posse. |
| Limites | Timeout é persistido, mesmo UUID não repete IA, cooldown de 15 minutos é aplicado; segunda recuperação exige nova revisão/UUID e a terceira é recusada. |
| Estados e isolamento | Fontes `completed`/`processing` são recusadas; `no_op` de recuperação é terminal. Cliente diferente não encontra a fonte; UUID com resumo alterado é conflito. Sugestão criada durante a análise e posteriormente descartada é reutilizada, sem duplicação. |
| Flag desligada | POST recusa com `recovery_disabled`, sem reserva/provedor. Isso ocorre inclusive sem a migration. Histórico continua legível, se a tabela existir. |

Os erros de rede são reproduzidos por falhas na confirmação **após o commit efetivo**, mantendo todas as consultas e transações reais. Não se interrompeu rede de cliente real nem se usou um provedor externo. Isso cobre a janela de resultado ambíguo do banco, sem afirmar entrega exatamente uma vez pelo serviço externo.

Uma tentativa reservada com resultado desconhecido pode permanecer `processing`. Esse bloqueio é deliberado: não existe repetição automática da IA, expiração da reserva ou liberação por novo UUID. A reconciliação operacional desses casos continua sendo uma etapa separada, sem excluir registros.

## Alterações no PR

Nenhuma correção funcional na migration ou nas transações foi necessária nos cenários exercitados. A lacuna de validação foi fechada com:

- `radar-recovery.mysql.test.ts`: testes com SQL, locks, constraints, triggers e commits reais; IA exclusivamente simulada.
- Script `test:radar-recovery:mysql` no pacote da API, separado da suíte que não requer banco.
- Este relatório e atualização do relatório da fase 3 para distinguir validação isolada concluída de execução em produção ainda não autorizada.

## Reproduzir em um MariaDB descartável

Não usar um banco de aplicação. Criar um diretório exclusivo com `mktemp -d /tmp/radar-mariadb-XXXXXX`, inicializar `mariadb-install-db --no-defaults` com esse datadir, autenticação root normal e sem banco de teste. Iniciar um servidor dedicado com:

```sh
mariadbd --no-defaults --datadir="$task_tmp/data" \
  --socket="$task_tmp/server.sock" --pid-file="$task_tmp/server.pid" \
  --log-error="$task_tmp/server.log" --skip-networking \
  --default-time-zone=+00:00 --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci \
  --sql-mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

Em `v2/`, com Node 22 e o socket dedicado pronto:

```sh
RADAR_TEST_SOCKET="$task_tmp/server.sock" npm --workspace @design-hub-v2/api run test:radar-recovery:mysql
```

A flag verdadeira usada na construção do serviço de teste é local à fixture, sem alterar configuração da aplicação. A chave `mock` nunca é enviada: o construtor recebe um provedor sintético. Encerrar somente esse servidor com `mariadb-admin --no-defaults --socket="$task_tmp/server.sock" --user=root shutdown` e descartar o diretório temporário identificado.

## Verificações finais

Node **22.23.3**, em `v2/`:

- Suíte completa definida em `@design-hub-v2/api` (`scripts.test`), com `--test-concurrency=2`: **628 passaram**, zero falhas, cancelamentos, skips ou TODO. A concorrência dos arquivos foi limitada para reduzir consumo de recursos locais; a concorrência das recuperações continua sendo exercitada explicitamente pelos testes SQL.
- `npm --workspace @design-hub-v2/api run test:radar-recovery:mysql`: **11 passaram**, zero falhas/skips.
- Suítes `mcp.radar.mysql.test.ts`, `brand-brain-ai.mysql.test.ts` e `radar-suggestions.mysql.test.ts`, juntas no mesmo servidor descartável: **21 passaram**, zero falhas/skips.
- `npm run check`: API e web aprovados.
- `npm run build`: API e web aprovados; permanece somente o aviso existente de chunks maiores que 500 kB.
- `git diff --check`: aprovado.

Servidor encerrado e diretório de dados descartado. Total: **32 testes de engine MariaDB**, além dos **628 testes gerais**. Não foi necessária alteração funcional no SQL ou no algoritmo transacional. A autorização permanece restrita à validação descartável; aplicar migration, habilitar a recuperação, reprocessar fontes históricas ou fazer merge/deploy continuam fora desta entrega.
