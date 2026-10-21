# Diagnóstico de POST /api/uploads

Cada tentativa do upload administrativo gera um UUID v4 e horário UTC antes do envio. A referência local não depende do cabeçalho ou corpo da resposta: erros de rede e HTML 403 substituído continuam consultáveis/copiáveis no aviso. Guarda no máximo 20 tentativas em sessionStorage da aba, sem nomes, conteúdo, tokens ou dados de clientes; se indisponível, usa memória. Fechar a aba encerra esse histórico. Não há retries automáticos.

A API registra `received` antes da autenticação e, ao terminar, status, duração, último estágio, MIME permitido normalizado (ou `other`), bytes quando conhecidos e categoria de erro fechada. IDs recebidos só são aceitos como UUID v4; inválidos/ausentes são substituídos. Respostas emitidas pelo Fastify incluem `X-Upload-Trace-Id`. Logs automáticos da rota são silenciados para evitar duplicação e vazamento de query strings/mensagens com nomes de arquivos; as entradas dedicadas usam apenas campos permitidos. Outras rotas, incluindo uploads do Portal, permanecem fora desse diagnóstico.

Limite por instância: primeiras 60 tentativas a cada janela de 60 segundos, até dois registros por tentativa. Demais tentativas ainda recebem cabeçalho, mas não produzem registros dedicados. Não há fila de logs, histórico no servidor, timer ou worker adicional. O último estágio é agregado no registro final, sem log por chunk/segundo. Desconexão durante o recebimento gera categoria `UPLOAD_ABORTED` quando o Fastify emite onRequestAbort. Uma conexão encerrada depois do recebimento, ou uma interrupção abrupta do processo, pode deixar só `received`.

## Interpretação

- Mesmo ID no navegador e no log: chegada ao Fastify comprovada. Resultado HTTP no log indica a resposta da API, não garante a resposta efetivamente entregue pelo proxy.
- Só referência local: não comprova bloqueio anterior à API. Considerar limite de amostragem, retenção/coleta de logs, interrupção e relógios antes de concluir.
- Sem cabeçalho encaminhado: API gera outro ID; correlacionar pela hora UTC, método e rota. Em concorrência essa correlação é aproximada, não unívoca.
- Não gravamos corpo/resposta HTML, cookies, autorização, IP, filename, query string ou payload de erro. Nenhum banco é usado.

## Comparação sem cabeçalho

Cabeçalhos próprios podem ser tratados por regras WAF/proxy e, entre origens, podem exigir preflight. O fluxo padrão usa URL relativa quando não há base externa; Authorization já pode exigir preflight entre origens. Testes locais não comprovam aceitação pela Hostinger.

Somente se necessário para uma comparação controlada, definir no sessionStorage da aba `designhub:upload-trace-header` como `off`. A próxima tentativa não envia o cabeçalho, mas mantém ID e UTC locais. Remover a chave restaura o comportamento padrão. Nenhuma tentativa é reenviada automaticamente; não usar retries para comparar uploads cujo resultado seja incerto. Nenhuma proteção é desativada. Não adicionar query strings de diagnóstico, que podem expor informação em logs do proxy.

## Validação local

Em v2: `npm --workspace @design-hub-v2/api test` inclui os testes da rota com Fastify inject e armazenamento temporário, simulações de rede/HTML 403 no frontend e aviso/copiar com DOM simulado. Não exige credenciais ou banco. Verificam também limite de logs e ausência de sentinelas sensíveis em todos os logs capturados.
