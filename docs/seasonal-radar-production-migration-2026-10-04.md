# Radar sazonal — validação e migração em produção, 04/10/2026

A migração aditiva foi aplicada pelo phpMyAdmin autenticado da Hostinger ao banco Design Hub V2 de liegestudio.com. A conexão SQL remota foi recusada; nenhuma permissão de rede ou credencial foi modificada. A versão foi consultada no servidor real antes da aplicação.

## Compatibilidade antes da aplicação

- Servidor: **11.8.9-MariaDB-log**, MariaDB Server.
- InnoDB; charset do servidor `utf8mb4`; collation `utf8mb4_unicode_ci`; `lower_case_table_names=0`; timezone da sessão `SYSTEM`.
- Configuração observada: `NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION`; `foreign_key_checks=1`; `check_constraint_checks=1`.
- `users.id` e `client_accounts.id`: `CHAR(36)`, `utf8mb4_unicode_ci`, InnoDB. Compatíveis com as FKs novas.
- CHECK é suportado e habilitado; JSON usa LONGTEXT/utf8mb4_bin com validação JSON_VALID; GENERATED ALWAYS AS YEAR(DATE) STORED e TIMESTAMP(3) são suportados.
- FKs compostas referenciam PK/unique com tipos e collation correspondentes. Todas as nove usam RESTRICT para DELETE e UPDATE.
- RENAME TABLE múltiplo é atômico no InnoDB desde MariaDB 10.6. O rollback por arquivamento e sua restauração foram testados no banco temporário 10.11.19. Não foram executados em produção.
- Produção usa nomes de tabelas sensíveis a maiúsculas/minúsculas; o banco temporário no macOS usa lower_case_table_names=2. Os nomes do projeto são consistentemente minúsculos.
- A sessão de aplicação usou modo estrito e UTC; nenhuma configuração global foi alterada. A configuração padrão de produção permanece sem modo estrito.

Referências oficiais: [CHECK](https://mariadb.com/docs/server/reference/sql-statements/data-definition/constraint), [generated columns](https://mariadb.com/docs/server/reference/sql-statements/data-definition/create/generated-columns), [JSON](https://mariadb.com/docs/server/reference/data-types/string-data-types/json), [TIMESTAMP](https://mariadb.com/docs/server/reference/data-types/date-and-time-data-types/timestamp), [foreign keys](https://mariadb.com/docs/server/ha-and-performance/optimization-and-tuning/optimization-and-indexes/foreign-keys), [atomic DDL](https://mariadb.com/docs/server/reference/sql-statements/data-definition/atomic-ddl).

## Aplicação e integridade

Aplicadas as instruções de `20261004_seasonal_radar_foundation.sql`, qualificando explicitamente banco/tabelas para evitar mudança de contexto pelo phpMyAdmin. Não foi executado bootstrap nem qualquer outra migração. Foram criadas sete tabelas, nove FKs e treze índices físicos (incluindo sete PKs, um unique e índices de suporte das FKs). Todas as tabelas novas usam InnoDB/utf8mb4_unicode_ci. Códigos de país usam CHAR(2)/ascii_bin; informações regionais permanecem em JSON sem truncamento para alpha-2.

| Tabela | Linhas após migração |
| --- | ---: |
| seasonal_workspaces | 1 |
| seasonal_monitored_countries | 0 |
| client_editorial_markets | 0 |
| seasonal_categories | 4 |
| seasonal_opportunities | 0 |
| seasonal_opportunity_countries | 0 |
| seasonal_occurrences | 0 |

As 51 tabelas anteriores foram comparadas imediatamente antes/depois usando CHECKSUM TABLE EXTENDED: **51/51 checksums iguais**. As assinaturas das definições de colunas também permaneceram iguais em 51/51 tabelas. Índices anteriores: assinatura MD5 `6ac1e1ff1573e08fef680de00825d48b`, 225 entradas de colunas de índices, sem mudança. FKs anteriores: assinatura MD5 `dd5719af35c18317cf59348101d48fde`, 76 constraints, sem mudança. São evidências da janela da migração; não representam congelamento da operação após o deploy.

Nenhuma tabela anterior foi alterada, nenhum registro anterior foi modificado pela migração, nenhum país foi monitorado, nenhum mercado editorial foi inferido/associado. Não houve importação do legado. Foram inseridos apenas um workspace e quatro categorias nas tabelas novas.

## Índices físicos novos

- client_editorial_markets: PRIMARY; fk_editorial_market_client; fk_editorial_market_confirmer.
- seasonal_categories: PRIMARY.
- seasonal_monitored_countries: PRIMARY.
- seasonal_occurrences: PRIMARY; idx_seasonal_occurrence_period; fk_seasonal_occurrence_opportunity.
- seasonal_opportunities: PRIMARY; uq_seasonal_opportunity_workspace; fk_seasonal_opportunity_category.
- seasonal_opportunity_countries: PRIMARY.
- seasonal_workspaces: PRIMARY.

## Reversão

Preferir reverter o código mantendo as tabelas aditivas. Se necessário, após retirar o código que usa o Radar, o script `20261004_seasonal_radar_foundation.archive.sql` renomeia as sete tabelas para nomes de arquivo sem apagar linhas; `.restore.sql` restaura os nomes. Não usar DROP e não tentar ROLLBACK transacional de DDL. As FKs de proteção continuam existentes durante o arquivamento.

## Integração e validação final

O merge preserva o main atual (ee0eaa6c) e integra a branch aprovada (f13a5c98), mantendo as mudanças recentes de contratos, propostas, faturamento e Meta. O alerta do dashboard mantém a janela de hoje até quatro dias e atualização periódica. Nenhum redesign completo foi feito.

- Node **22.23.3**, mesma versão principal da hospedagem.
- **389 testes passaram**, repetidos após a migração.
- **10 testes nativos MariaDB passaram** após a migração, em banco temporário isolado: multi-país, global, mercados N:N confirmados, desativação sem exclusão, hoje/amanhã/dezembro-janeiro, falha parcial do provedor, regiões, paginação, constraints e arquivamento/restauração.
- Typecheck de API/frontend: aprovado.
- Build de API/frontend: aprovado; aviso não bloqueante de chunks maiores que 500 kB.
- Testes com dados fictícios nunca foram executados na produção.
