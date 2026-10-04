# Radar sazonal — validação MariaDB em 04/10/2026

Resultado: **aprovado no ambiente temporário compatível**. Não houve merge, deploy, acesso ao banco de produção ou migração do legado.

## Ambiente e limite de equivalência

- MariaDB **10.11.19-MariaDB**, InnoDB, instância temporária criada exclusivamente para esta tarefa.
- Conexões somente por socket Unix; networking desativado; nenhum `.env`, `DB_HOST` ou `DB_NAME` da aplicação foi utilizado.
- Charset `utf8mb4`; collation `utf8mb4_unicode_ci`; sessão UTC (`+00:00`).
- Modo SQL: `STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION`.
- `foreign_key_checks = 1`; verificações de integridade ativas.
- `lower_case_table_names = 2`, devido ao filesystem macOS. Todos os identificadores usados são minúsculos. Um host Linux pode usar `0`; igualdade dessa configuração com produção não foi confirmada.
- Runtime de validação: Node v24.14.1.
- A versão e o `sql_mode` exatos de produção não estavam disponíveis nos arquivos consultados. Esta validação prova compatibilidade com MariaDB 10.11 LTS e o charset/engine declarados no projeto, sem afirmar paridade exata com produção.

## Resultado da migração

O arquivo `v2/database/migrations/20261004_seasonal_radar_foundation.sql` foi aplicado **sem tradução ou alteração** depois do schema anterior da aplicação em bancos temporários com usuários, clientes, fatura e pauta sintéticos. SHA-256: `77088d17e0ec60b092437496708b2788b8eefe5ea433374665de4f32f2f81927`.

Foram confirmadas **7 tabelas, 7 PKs, 9 FKs e 13 índices físicos**. Os índices implícitos de FKs estão incluídos nessa contagem. Todos os novos relacionamentos têm `ON DELETE RESTRICT` e `ON UPDATE RESTRICT` (este último é o default quando omitido no DDL).

| Tabela | Índices / uniques efetivamente criados |
|---|---|
| `client_editorial_markets` | `fk_editorial_market_client` (`client_account_id`); `fk_editorial_market_confirmer` (`confirmed_by_user_id`); `PRIMARY` (`workspace_id`, `client_account_id`, `country_code`) — unique |
| `seasonal_categories` | `PRIMARY` (`workspace_id`, `code`) — unique |
| `seasonal_monitored_countries` | `PRIMARY` (`workspace_id`, `country_code`) — unique |
| `seasonal_occurrences` | `fk_seasonal_occurrence_opportunity` (`workspace_id`, `opportunity_id`); `idx_seasonal_occurrence_period` (`workspace_id`, `occurrence_date`); `PRIMARY` (`id`) — unique |
| `seasonal_opportunities` | `fk_seasonal_opportunity_category` (`workspace_id`, `category_code`); `PRIMARY` (`id`) — unique; `uq_seasonal_opportunity_workspace` (`workspace_id`, `id`) — unique |
| `seasonal_opportunity_countries` | `PRIMARY` (`workspace_id`, `opportunity_id`, `country_code`) — unique |
| `seasonal_workspaces` | `PRIMARY` (`id`) — unique |

As constraints, defaults, tipos de cada coluna e o `SHOW CREATE TABLE` obtidos do servidor estão no arquivo JSON de evidências desta revisão.

Verificações efetivas:

- `country_code`: `CHAR(2)`, charset `ascii`, collation `ascii_bin`. A API normaliza entradas para maiúsculas e rejeita `BRA`, `ZZ` e códigos fora do catálogo ISO completo. Inserção SQL de três caracteres foi rejeitada (`ER_DATA_TOO_LONG`), sem truncamento silencioso.
- `active`: `TINYINT(1) NOT NULL DEFAULT 1`; gravações e leituras 1/0 foram verificadas como true/false no repositório. A validação da API exige boolean, pois o tipo SQL `TINYINT(1)` sozinho não restringe todo o domínio a 0/1.
- Criação/atualização: `TIMESTAMP(3)`, defaults de timestamp e atualização automática preservados; `created_at` permanece estável na desativação/reativação.
- Ocorrência: `DATE`; ano `SMALLINT UNSIGNED` gerado e armazenado a partir de `YEAR(occurrence_date)`. Dezembro/2026 e janeiro/2027 retornam os anos corretos e diferenças 0/1 para Hoje/Amanhã.
- JSON válido, informação regional e códigos de subdivisão de até 32 caracteres fizeram round-trip sem alteração. Texto acentuado e emoji foram preservados.
- PK duplicada, FK órfã, escopo inválido, data inválida, JSON inválido e alteração/exclusão de registros referenciados foram rejeitados.
- Cadastro com falha tardia de ocorrência foi revertido pela transação, sem oportunidade ou abrangências parciais.

## Cenários e checks

**10 testes nativos MariaDB passaram**, cobrindo todos os cenários abaixo:

| Cenário | Resultado |
|---|---|
| Adicionar, desativar e reativar monitoramento | Mesmo registro e criação; outra conexão observa o estado persistido |
| Cliente com múltiplos mercados | N:N confirmado; relações removidas permanecem inativas |
| Idioma / país fiscal | Cliente `locale=it` e fatura fiscal Suécia continuam sem mercados até confirmação explícita |
| Oportunidade nacional e multipaís | Um UUID de oportunidade, com abrangências separadas |
| Oportunidade global | Uma oportunidade, zero cópias/abrangências artificiais por país |
| Mesmo país e data, eventos distintos | IDs e registros distintos preservados |
| Dezembro → janeiro, Hoje/Amanhã | Ocorrências e anos concretos corretos, diferenças 0 e 1 |
| Falha Nager.Date em um país | Resposta HTTP de falha controlada para AQ; BR e ambos os anos preservados no serviço real com SQL real |
| Feriado regional / `global` do provedor | Região preservada; `global=true` significa nacional, nunca mundial |
| Paginação | 55 registros recuperados em páginas de 50 + 5, sem perda ou duplicação |
| Criar pauta | Endpoint existente de cards criou pauta pendente para aprovação; desativar país não alterou as pautas |
| Concorrência | `FOR UPDATE` bloqueou confirmação concorrente; nenhum conjunto misto de mercados ativos |
| Reexecução da migração | Snapshot completo dos dados preservado, inclusive categoria cujo nome havia sido editado |
| Arquivamento / restauração | Todas as tabelas, linhas e 9 FKs preservadas; snapshot antes/depois idêntico |

Depois da aprovação nativa, a branch isolada passou novamente por **16 testes**, typecheck e build da API e do frontend. O aviso existente de tamanho de bundle do Vite não impediu o build. Os 7 testes de aprovação que estavam apenas em alterações locais de outra tarefa não foram incluídos no commit do Radar.

## Diferenças SQLite × MariaDB encontradas

| Aspecto | SQLite anterior | MariaDB nativo |
|---|---|
| JSON | Representação textual no adaptador | `JSON` aparece como `LONGTEXT` com validação `JSON_VALID`; mysql2 retornou objeto já decodificado. O repositório já aceita texto ou objeto. A asserção do teste foi ajustada. |
| Tipos/limites | Afinidade flexível; não garante tamanho de `CHAR` | `CHAR(2)` estrito rejeita três caracteres; charset/collation são efetivos |
| Datas | Comparação de strings e tradução de expressão | `DATE` nativo rejeita 30/02; `YEAR()` gerado é executado pelo servidor |
| Timestamps | Adaptação removia precisão e `ON UPDATE` | Milissegundos/defaults/atualização automática reais confirmados |
| Locks | Adaptador retirava `FOR UPDATE` | Bloqueio de linha e serialização reais confirmados |
| FKs/índices | Dialeto adaptado; índices auxiliares não reproduzidos integralmente | 9 FKs RESTRICT e 13 índices inspecionados no catálogo do servidor |
| DDL e reversão | Não prova semântica DDL do servidor de destino | DDL aplicado diretamente; arquivamento/restauração por `RENAME TABLE` testados |

Nenhuma correção do schema ou do código de produção foi necessária após os testes nativos. A fatura sintética usa `open`, conforme o enum pré-existente; um seed inicial de teste com `draft` foi corrigido antes da execução final.

Referências complementares: [JSON em MariaDB](https://mariadb.com/docs/server/reference/data-types/string-data-types/json) e [colunas geradas](https://mariadb.com/docs/server/reference/sql-statements/data-definition/create/generated-columns). A evidência acima vem da execução nativa, não apenas da documentação.

## Reversão sem perda de histórico

Para um incidente após adoção, a reversão de menor risco é voltar o código da aplicação e manter as tabelas novas intactas. DDL não deve ser tratado como se fosse uma transação DML reversível.

Também foram fornecidos e executados no banco temporário:

- `v2/database/rollback/20261004_seasonal_radar_foundation.archive.sql`: um único `RENAME TABLE` arquiva as sete tabelas, sem DROP/DELETE/TRUNCATE.
- `v2/database/rollback/20261004_seasonal_radar_foundation.restore.sql`: restaura os nomes, preservando os mesmos dados e referências.

Procedimento operacional futuro: pausar gravações do Radar, obter backup, voltar a aplicação para código que não consulte as tabelas e só então executar o arquivamento se necessário. Para recuperar, confirmar que os nomes normais estão livres, restaurar as tabelas e depois restaurar a aplicação.

O arquivamento é intencionalmente executado uma única vez: uma segunda execução falha sem substituir os dados arquivados. A restauração também falha se houver tabelas normais conflitantes. Não reaplicar a migração criando um conjunto novo sobre os nomes normais antes de decidir qual histórico será restaurado.

As FKs dos arquivos continuam protegendo clientes/usuários referenciados; arquivar não libera exclusão física desses registros. Remover essas FKs ou descartar história seria outra operação, não incluída nesta reversão.

A reexecução da migração original foi testada com schema correto já existente. `IF NOT EXISTS` não reconcilia tabelas antigas com definições divergentes; comparar metadados antes de aplicar em staging continua necessário.

## Legado: capacidade validada, migração não executada

A ocorrência sintética preservou `title`, `description`, `category`, país textual, `date_month=12` e `date_day=31` em `external_payload`, além da associação ISO na oportunidade. Nada foi lido ou importado de clientes/datas reais. Os registros sintéticos pré-existentes permaneceram intactos em snapshots e na reversão.

Esse armazenamento permite receber proveniência sem perda. Uma futura importação ainda deverá revisar país → ISO, conservar `legacy_id` e definir a regra anual (inclusive 29/02); uma ocorrência concreta sozinha não substitui recorrência mês/dia.

## Reproduzir com segurança

`npm --workspace @design-hub-v2/api run test:seasonal:mysql` exige `SEASONAL_TEST_SOCKET` no padrão `/tmp/seasonal-mariadb-*/server.sock` de uma instância temporária local. Sem esse socket, a suíte recusa executar. Não aceita os dados de conexão usuais da aplicação nem servidor remoto.

Os bancos de teste têm nomes aleatórios `seasonal_test_*`, são criados pela suíte e removidos ao final. A instância temporária foi iniciada com `--no-defaults --skip-networking`, modo estrito, InnoDB e o charset/collation acima. Não foi registrada como serviço de inicialização automática.

O commit foi preparado e validado em worktree isolada, a partir do commit-base original da branch, para preservar alterações locais alheias à tarefa. Não houve merge/rebase de `main`. O push publica somente a branch solicitada.
