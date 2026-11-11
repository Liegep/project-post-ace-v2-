# PR #66 — tentativa de conclusão da homologação

Data: 11/11/2026. Código conferido: `a3f6c6480077799d0a3eb33dcf559061e27b6170`. O PR permanece aberto em rascunho, sem merge.

**Resultado: homologação incompleta por bloqueios do ambiente.** Esta tentativa não gerou aprovação SQL nem visual. Os 742 testes automatizados da entrega anterior não substituem essas verificações.

## MariaDB real

O binário instalado foi consultado diretamente e confirmou MariaDB **11.8.9**, conforme [mariadb-version.txt](mariadb-version.txt). Node disponível: **22.23.4**.

Foi criado um datadir novo em `/tmp/briefs-mariadb-foundation/data`, sem ler arquivos de configuração (`--no-defaults`), sem credenciais de produção e com TCP desabilitado (`--skip-networking`). A inicialização das tabelas internas do próprio servidor foi concluída. Nenhuma migration da aplicação foi executada e nenhum banco comercial foi acessado.

Tentativa de iniciar o servidor:

```sh
mariadbd --no-defaults \
  --datadir=/tmp/briefs-mariadb-foundation/data \
  --socket=/tmp/briefs-mariadb-foundation/server.sock \
  --skip-networking \
  --pid-file=/tmp/briefs-mariadb-foundation/server.pid \
  --log-error=mariadb-startup.log \
  --skip-name-resolve
```

O processo terminou com código **1**. O socket não foi criado. Erro real do log:

```text
[ERROR] Can't start server : Bind on unix socket: Operation not permitted
[ERROR] Aborting
```

O log também apresenta a sugestão padrão de verificar se há outro servidor no socket; a verificação do caminho retornou `No such file or directory`. A evidência concreta é a negação de permissão de bind, não um conflito confirmado de servidores.

| Cenário SQL solicitado | Resultado desta tentativa |
| --- | --- |
| Arquivar/restaurar preservando configuração e templates legados | Bloqueado antes da execução |
| Excluir fisicamente template sem dependências | Bloqueado antes da execução |
| Impedir exclusão de templates com rascunhos/envios/respostas, preservando histórico | Bloqueado antes da execução |
| Concorrência entre criação de brief e exclusão do template | Bloqueado antes da execução |

[Extrato das saídas reais do servidor](sql-blocker.txt). Não foram produzidas simulações ou marcações artificiais de aprovação. A suíte SQL não foi iniciada após a falha do servidor; seu bootstrap contém execução de migration, que também não deve ser disparada nesta etapa conforme a instrução recebida. Uma futura execução deve usar uma fixture de schema existente em banco descartável, sem rodar o fluxo de migrations.

## Navegador real

As verificações locais confirmaram ausência dos binários esperados do Playwright e do Google Chrome. A consulta ao navegador integrado retornou **zero abas**, sem uma prévia de homologação disponível. Na tentativa anterior, a URL `file://` da prévia local foi rejeitada pela política do navegador, com protocolo permitido apenas para HTTP/HTTPS. Não houve tentativa de contornar essa rejeição por outra superfície ou protocolo.

| Largura solicitada | Aba Arquivados / contadores | Restauração | Modal de exclusão | Responsividade |
| --- | --- | --- | --- | --- |
| 1440 px | Não verificado em navegador real | Não verificado | Não verificado | Não verificado |
| 390 px | Não verificado em navegador real | Não verificado | Não verificado | Não verificado |

Nenhuma captura de tela foi gerada. JSDOM, HTML estático ou revisão de CSS não foram usados como evidência visual substituta. A homologação visual requer uma prévia não produtiva do commit acima acessível por uma URL permitida e um navegador real com viewport controlável.

## Estado para revisão

- Sem alterações no código funcional desta tentativa.
- Nenhuma migration da aplicação, alteração em produção, merge ou deploy.
- PR #54 intacto.
- Manter o PR #66 em rascunho até as duas verificações reais serem concluídas.

[Resultados estruturados](results.json).
