# Homologação SQL das propostas — 05/11/2026

**Resultado: 13/13 testes com MariaDB real aprovados**, além de 722/722 testes gerais. Node **22.23.4**; typecheck e builds da API e frontend aprovados. Sem merge, deploy ou acesso a produção. PR #54 não alterado.

## Compatibilidade e isolamento

Instância temporária **MariaDB 11.8.9**, mesma versão principal/secundária/patch de produção registrada em [auditoria de 04/10](../seasonal-radar-production-migration-2026-10-04.md). A versão atual de produção não foi reconsultada. MariaDB é o motor MySQL compatível efetivamente documentado para esta aplicação.

InnoDB, `utf8mb4_unicode_ci`, FK e validação JSON habilitadas. Exercitado o modo registrado em produção (`NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION`) e, adicionalmente, modo estrito (`STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION`). A suíte verifica o modo efetivo das sessões.

Diferenças explícitas: build Homebrew em macOS, sem sufixo `-log`; `lower_case_table_names=2` versus 0 registrado em produção; UTC explícito versus `SYSTEM` registrado no servidor remoto. Os nomes SQL usados são todos minúsculos. Isto demonstra compatibilidade com a versão e o schema reconstituído do repositório, sem afirmar inspeção do schema/configuração vivos.

Servidor exclusivo em `/tmp/proposal-mariadb-*/`, socket local e `--skip-networking`. A suíte rejeita sockets fora desse padrão e não lê `.env`, DB_HOST, DB_NAME ou credenciais da aplicação. Cada fixture cria e remove um banco aleatório com dados sintéticos. Ao terminar: zero bancos de testes restantes; servidor encerrado e diretório temporário removido. A instalação local do motor não foi registrada como serviço nem vinculada em substituição ao MariaDB 10.11 existente.

Evidência legível por máquina: [mysql-evidence.json](mysql-evidence.json), incluindo versão, configuração, SHA-256 do SQL, cenários aprovados e descarte do ambiente.

## Migration e dados históricos

Executado **sem alterar o arquivo SQL**: `v2/database/migration-proposals/20261105_proposal_documents.sql`, SHA-256 `7144412615f0a726bdfab5b146486cb76d5e6f56d6dcfe59095f88ba7d918b4b`.

- DDL aprovada em ambos os modos. Comparação integral das linhas históricas e `SHOW CREATE TABLE proposals` antes/depois: iguais.
- FK rejeita documento órfão; JSON inválido é rejeitado; PK rejeita documento duplicado.
- Reaplicação falha explicitamente com tabela existente; nenhum dado antigo é alterado. O SQL continua sendo de aplicação única, sem execução automática.
- Na ausência da tabela, leituras e criação/edição legadas funcionam; escritas premium e aceites retornam 503 sem gravar proposta parcial ou alterar estado.
- Remoção da tabela complementar foi ensaiada exclusivamente na fixture descartável, preservando as linhas de `proposals`. Para rollback real, continuam obrigatórios backup/exportação dos documentos e aceites e bloqueio de novos aceites premium no código antigo.

## Ciclos funcionais e segurança

| Cenário no motor real, com rotas e repositórios reais | Resultado |
| --- | --- |
| Proposta antiga: editar escopo, preservar token/moeda/serviços, abrir link e aceitar | Aprovado; valor 250,25 e termos originais registrados; moeda legada `R$` preservada. |
| Proposta histórica já aceita | Linhas e datas preservadas; leitura não modifica o registro. |
| BRL, USD, EUR, SEK × proposta única/alternativas | Oito ciclos de criar, editar, recarregar por conexão independente, abrir página pública e aceitar aprovados em modo estrito. |
| Persistência de todos os campos premium e reordenação das alternativas | Documento reaberto igual ao salvo; revisão incrementada. |
| Validade na criação e edição | ISO UTC preservado na resposta; edição valida precisão de milissegundos. |
| Valor e termos aceitos | Snapshot completo, moeda, opção e revisão persistidos; valores enviados pelo cliente ignorados. |
| Alternativas e add-ons | Aceite de 450 ou 700; nunca soma 1.150; adicional de 100 fica fora do total. |
| Sem opção, opção aleatória/de outra proposta ou revisão antiga | Rejeitados sem aceite. |
| Dois aceites simultâneos por conexões distintas | Um 200 e um 409; um único evento de feedback e um único snapshot. |
| Rascunho, expiração, recusa e novo aceite após decisão | Regras preservadas; tentativas inválidas rejeitadas. |
| Edição/exclusão após aceite | Rejeitadas, preservando as condições aceitas. |
| Sem autenticação, papel cliente e token inexistente | 401, 403 e 404 respectivamente. |
| Falha SQL forçada por trigger na gravação do snapshot | Rollback real mantém status e linha da proposta; nenhum snapshot parcial. |

A injeção HTTP do Fastify executa as rotas e repositórios reais, com contexto de autenticação sintético; não envolve o login de produção nem um navegador. A apresentação e responsividade continuam cobertas pelos testes frontend e pelas evidências Chromium anteriores.

## Correção revelada pela homologação

A primeira execução em modo estrito revelou que `expires_at` recebia texto ISO com `T`/`Z`, rejeitado como DATETIME. O repositório agora entrega um objeto `Date` ao mysql2 na criação e edição, permitindo a serialização nativa do driver. Nenhum registro existente, valor financeiro, SQL de migration ou configuração global foi alterado. Os oito ciclos em modo estrito passaram após essa correção. A fixture do teste de moedas foi ajustada para serializar a data como a resposta HTTP real.

## Reproduzir

A suíte é separada da execução comum, sem dependências novas:

1. Com Node 22 e MariaDB 11.8.9, criar um diretório com `mktemp -d /tmp/proposal-mariadb-XXXXXX`.
2. Inicializar somente esse datadir com `mariadb-install-db --no-defaults --datadir=... --auth-root-authentication-method=normal --skip-test-db`.
3. Iniciar `mariadbd --no-defaults --datadir=... --socket=.../server.sock --pid-file=.../server.pid --log-error=.../server.log --skip-networking --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-time-zone=+00:00`.
4. No diretório `v2`, executar `PROPOSAL_TEST_SOCKET=/tmp/proposal-mariadb-XXXXXX/server.sock PROPOSAL_TEST_REPORT=/tmp/proposal-evidence.json npm run test:proposals:mysql --workspace=@design-hub-v2/api`.
5. Encerrar somente essa instância por seu socket e remover somente o diretório temporário identificado.

Homologação concluída. Aprovação da estrutura e autorização de qualquer aplicação em produção, merge ou deploy continuam pendentes.
