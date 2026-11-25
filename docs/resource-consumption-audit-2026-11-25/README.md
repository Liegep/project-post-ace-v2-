# Diagnóstico de recursos — Design Hub V2 — 25/11/2026

**Resultado:** há polling duplicado e consultas desnecessárias confirmados no frontend. A correção proposta reduz essa carga. **Não há evidência suficiente para atribuir ao Design Hub a saturação NPROC 120/120 do plano com quatro aplicativos.** Reduzir requisições não garante liberar processos/threads residentes.

Análise realizada sobre `main` em `770cc38c3e4a4a574164c625a8823568392dfd85`, em checkout isolado, com testes locais e dados sintéticos. O SHA efetivamente implantado, métricas por PID, logs de acesso/runtime e eventos CDN da Hostinger não foram disponibilizados nem consultados. Os volumes abaixo e o NPROC são informações fornecidas pelo solicitante, sem validação independente. Produção não foi acessada; nenhuma configuração, serviço, banco ou deploy foi alterado. O PR #54 foi apenas consultado para identificar e preservar sua branch.

**Volumes e significado**

| Recurso nas últimas 24 horas informadas | Requisições | Parcela do total |
| --- | ---: | ---: |
| Todas as rotas | 10.105 | 100% |
| `GET /api/internal-approvals/inbox` | 5.390 | 53,34% |
| `GET /api/clients` | 1.158 | 11,46% |
| As duas rotas | 6.548 | 64,80% |

O total representa média aproximada de 0,117 requisição/s, sem informação sobre picos ou duração. Contagens diárias não medem concorrência nem processos. A Hostinger define NPROC como processos **e threads** de todo o plano. A documentação também aponta instâncias por domínio/`www` e cópias antigas de apps como possíveis contribuições; nenhuma dessas condições foi constatada nesta conta. [Fonte oficial](https://www.hostinger.com/support/how-to-fix-503-and-too-many-processes-errors-on-node-js-websites-at-hostinger/).

**1. Onde as rotas são chamadas**

As referências nesta seção apontam para o código original auditado, antes da correção.

- Inbox: `listInternalApprovalInbox()` em `v2/apps/web/src/api.ts:1998` faz um GET sem cache/deduplicação. É chamada por `WorkspaceNavbar`, em `App.tsx:649`, e por `DashboardPage`, em `App.tsx:2145`. O Dashboard renderiza a própria navbar (`App.tsx:2306`), portanto os dois consumidores ficam montados simultaneamente. A navbar também aparece no Kanban e nas áreas internas.
- Clientes: `getAdminClients()` em `api.ts:579` é o ponto compartilhado, com cache de 60 segundos e promessa em andamento. `listAdminClients()` (`api.ts:1255`) é usado pelo Dashboard, seletor de cliente do Kanban, central Meta, gestão de equipe, `ReportsWorkspace.tsx:364`, `AdminKanbanSearch.tsx:130` e `InitialDataLoadingShield.tsx:46`. `loadAdminWorkspaceBySlug()` e dezenas de helpers passam por `findAdminClientBySlug()` (`api.ts:1038`) antes de acessar a rota específica do cliente.
- Exceção relevante: `TextCoverPersistence.tsx:62` faz seu próprio GET de `/api/clients`, sem aproveitar esse cache. O componente está montado globalmente em `main.tsx`, independentemente da tela aberta.

[App original](https://github.com/Liegep/project-post-ace-v2-/blob/770cc38c3e4a4a574164c625a8823568392dfd85/v2/apps/web/src/App.tsx#L631) · [API frontend original](https://github.com/Liegep/project-post-ace-v2-/blob/770cc38c3e4a4a574164c625a8823568392dfd85/v2/apps/web/src/api.ts#L574) · [Persistência original](https://github.com/Liegep/project-post-ace-v2-/blob/770cc38c3e4a4a574164c625a8823568392dfd85/v2/apps/web/src/TextCoverPersistence.tsx#L57).

**2. Polling, duplicação e cleanup**

| Origem original | Frequência | Problema / proteção existente |
| --- | --- | --- |
| Navbar → inbox | Inicial + 5 s + qualquer evento `storage` | Sem verificação de visibilidade/inatividade; impede sobreposição apenas dentro da navbar |
| Dashboard → inbox | Inicial + 5 s | Segundo timer para o mesmo recurso; sem trava de requisição em andamento |
| Dashboard → clientes + overview | Inicial + 10 min | Verifica visibilidade e intervalo mínimo em foco/retorno |
| Persistência de capas → clientes | Inicial + 60 s + foco + mudança de hash | Consulta mesmo sem cliente selecionado e em aba oculta; ignora cache compartilhado |
| Persistência de capas → PATCH de capa pendente | Verificação local a cada 1,2 s | Só escreve se houver diferença, mas originalmente sem trava contra PATCHs sobrepostos |

Os intervalos investigados têm `clearInterval` no cleanup; não foi identificado vazamento de timer por ausência desse cleanup. A duplicação da inbox decorre de dois efeitos distintos, não do relógio visual do Dashboard. Com resposta lenta, o timer da inbox do Dashboard pode abrir outra requisição antes de a anterior terminar; o timeout HTTP normal é de 20 s.

**Reprodução comparativa local:** Chromium, mesma fixture do Dashboard e HTTP simulado, carregando o `App.tsx` original do SHA acima e depois a versão corrigida. No original: 2 GETs iniciais; após simular 10 s com `document.visibilityState = hidden`, total de 6. Na correção: 1 GET inicial; total permanece 1 após os mesmos 10 s. A mudança de visibilidade foi simulada por propriedade/evento no navegador; isso não é uma medição de throttling do navegador em produção. [Resultados](validation.json).

**3. Dashboard fechado, aba inativa e usuário ausente**

Sair do Dashboard desmonta seu timer, mas mantém a consulta da navbar nas outras telas internas. Fechar completamente a aba encerra os timers daquela página. Ocultar a aba não impedia os dois polls da inbox nem a consulta global de capas; o navegador pode desacelerá-los, mas o aplicativo não os suspendia. Ausência de interação também não era verificada.

A correção pausa a inbox em aba oculta e após 5 min sem atividade de ponteiro, teclado ou scroll. Retorno à aba, foco e interação retomam o feed quando a consulta está vencida, respeitando o intervalo/backoff. Uma requisição já enviada pode terminar; não é cancelada retroativamente e não inicia novo ciclo sem assinantes. A persistência de capas passa a exigir aba visível e rota de cliente, com retomada na visibilidade.

Limite deliberado: outros fluxos continuam com suas políticas atuais. Por exemplo, `CardDetailModal` consulta destinos/publicações Meta a cada 60 s mesmo oculto (`App.tsx` original:7349); a persistência de capas, numa rota de cliente visível, ainda pode consultar a cada minuto sem interação. Isso merece uma segunda mudança, com cobertura específica, se a medição indicar impacto. A correção não é uma pausa global de todas as consultas do produto.

**4. Consultas simultâneas**

Navbar e Dashboard duplicavam o mesmo GET. O cache já existente de clientes deduplica consumidores de `api.ts` na mesma aba, mas não inclui o GET independente de capas. Outras abas têm suas próprias instâncias dos módulos e fazem novas consultas.

A proposta cria um feed de inbox por sessão/aba e compartilha o snapshot entre os dois componentes, com apenas uma requisição em andamento. Capas passa a usar `listAdminClients()`. O cache de clientes também passa a ser identificado pelo token: anteriormente, uma troca de conta podia reutilizar por até 60 s os dados em memória da sessão anterior. Respostas atrasadas da inbox de outra sessão são descartadas. Não há coordenação de rede entre abas nesta proposta.

**5. Requisições em loop**

Não foi identificado ciclo infinito de efeito React nas duas rotas. As dependências dos efeitos são estáveis e a resposta do GET não dispara eventos de sucesso de escrita em `sendJson`. O excesso confirmado vem da periodicidade e dos consumidores independentes.

Há amplificadores limitados: qualquer `storage` acionava GET da navbar, inclusive alterações locais de preferências/histórico de outra aba. Agora esse listener apenas sincroniza o estado local de leitura. `InitialDataLoadingShield` repete clientes a cada 1,8 s durante uma janela de 30 s de falha e recarrega uma vez na recuperação; não é um polling permanente em funcionamento normal. Capas pode repetir um PATCH malsucedido enquanto há uma alteração pendente; a correção impede sobreposição e execução oculta, mas mantém a tentativa de salvar a alteração ao usuário ativo. Recomenda-se backoff próprio desse PATCH se as métricas mostrarem falhas persistentes.

**6. Upload de PNG e desafio da Hostinger**

`uploadAdminMedia()` envia `POST /api/uploads` com `tracedUpload`. A API recebe multipart, lê o arquivo em memória, aceita PNG de até 12 MB, converte para WebP por `sharp(...).webp({quality:84, effort:4}).toBuffer()` e grava o resultado. Não há processo Node criado por upload. [Rota original](https://github.com/Liegep/project-post-ace-v2-/blob/770cc38c3e4a4a574164c625a8823568392dfd85/v2/apps/api/src/modules/uploads/uploads.routes.ts#L42).

**Pode ser afetado por saturação:** essa rota compartilha o processo da API e passa pela autenticação com acesso ao banco antes da conversão. Competição de CPU, RAM, filas e falta de threads podem atrasá-la ou gerar falha no aplicativo/proxy. Mesmo um PNG pequeno usa processamento nativo; tamanho comprimido não equivale ao custo de pixels decodificados. Sharp usa pools de libuv/libvips; os valores efetivos de concorrência na Hostinger não foram medidos. Isso é hipótese de contribuição ao NPROC, não confirmação. [Documentação Sharp](https://sharp.pixelplumbing.com/performance/).

**Pode ser afetado por desafio automático:** a Hostinger documenta verificação JavaScript/cookie e proteção automática por taxas anormais. Inferência: se um fetch de upload receber essa página HTML em vez da resposta JSON, o cliente não conseguirá confirmar o upload; o HTML recebido por fetch não executa a etapa interativa de navegação. Não há amostra real que comprove isso neste incidente. Não se pode concluir que as 10.105 requisições ativaram a proteção. [Documentação Hostinger CDN](https://www.hostinger.com/support/hostinger-cdn-the-browser-verification-page/).

Já existe rastreio local de tentativa (ID, UTC, status e desfecho) e rastreio amostrado da API por etapas `multipart`, `file_received`, `converting`, `storing`, `stored`. Para diagnóstico futuro, correlacionar uma tentativa já falhada com logs do app/proxy/CDN. Ausência de log da API isoladamente não prova bloqueio anterior: há amostragem e podem existir falhas de log. HTML/status, origem da resposta e correlação temporal são necessários para distinguir CDN, proxy, fila e conversão.

A proposta não altera a conversão nem repete POST automaticamente. Foram adicionadas regressões para 503 JSON/HTML, 403 HTML e 200 HTML inválido: exatamente uma tentativa e preservação do status/desfecho local em cada caso. Nenhum upload real foi enviado.

**7. Workers, tarefas e processos**

A busca em `v2/apps/api/src` não encontrou `spawn`, `fork`, `exec`, `child_process`, `worker_threads`, `cluster` ou `new Worker` no código de execução da API. O entrypoint inicia uma instância Fastify. O comando de produção é `node dist/server.js`; `tsx watch` é apenas o comando de desenvolvimento. Isso não comprova qual comando/quantas instâncias a Hostinger executa.

| Worker registrado uma vez por instância da API | Cadência | Proteção |
| --- | --- | --- |
| `scheduled-card-archiver.ts` | Startup + 60 s | `running`, timer `unref`, cleanup em `onClose` |
| `meta-publication-worker.ts` | Startup + 60 s | `running`, lote de até 10 por rodada, timer `unref`, cleanup |
| `invoice-recurring-worker.ts` | Startup + 1 h | Promessa compartilhada `running`, timer `unref`, cleanup e espera no fechamento |

São tarefas assíncronas no processo, não novos processos a cada tick. Instâncias duplicadas executariam seus próprios timers. Publicações Meta usam transição condicional de estado antes do envio; faturas também usam lock de banco. Essas proteções não eliminam o custo de várias instâncias consultarem o banco. A conexão MySQL é um pool por instância, com limite de 5 conexões e fila de 50; conexões de banco não são processos Node e não devem ser somadas diretamente ao NPROC.

**8. Menor correção e recomendações**

A branch altera apenas o frontend e seus testes/documentação:

- Inbox compartilhada, 30 s após o término da consulta anterior, sem sobreposição; pausa oculta/inativa e backoff de 60/120/240/300 s em falhas, retornando a 30 s após sucesso.
- Notificações e widget continuam recebendo o mesmo snapshot. Há mudança explícita de latência: de cerca de 5 s para até 30 s + tempo de rede em uso ativo. Durante inatividade ficam suspensas até retorno. Som, leitura e histórico são preservados.
- Capas deixa de listar clientes no Dashboard e em abas ocultas, compartilha o cache de 60 s e serializa sincronização/PATCH. Travas ficam no escopo do efeito para a remontagem de desenvolvimento em React StrictMode não bloquear a primeira sincronização útil.
- Workers de publicação, arquivamento, agenda e recorrência permanecem com a mesma cadência. As atualizações explícitas após ações do usuário também permanecem. A execução de agendamentos continua independente do Dashboard aberto.

Projeção de frequência, sem contar carregamentos iniciais, rede lenta ou falhas: no Dashboard ativo, inbox cai de 24 para até 2 GETs/min por aba (**91,7%**); em outra tela interna, de 12 para até 2 (**83,3%**). Oculta/inativa: zero novas chamadas de polling da inbox. Isso não representa redução medida do tráfego total diário ou do NPROC. Capas eliminava aproximadamente uma consulta/min no Dashboard aberto; agora esse caminho faz zero.

Próxima coleta recomendada, estritamente de leitura, antes de escolher mudanças de infraestrutura: confirmar o SHA/comando implantado; solicitar à Hostinger processos/threads agrupados por app/domínio/versão (PID, PPID, threads, memória e tempo de atividade), métricas NPROC/CPU/RAM e faults no mesmo intervalo; verificar instâncias de `www`/domínio principal e versões antigas sem encerrá-las; correlacionar 503 e uploads com latência/status por rota, filas e logs CDN. Só então avaliar separação de apps, concorrência Sharp ou capacidade do plano. Não executar restart/stop de processos para testar uma hipótese.

**Validação e limites da proposta**

Node 22.23.5; Chromium 151.0.7922.34; dependências do lockfile instaladas com scripts desativados. `check` e build de API/web passaram. Build conserva aviso de chunks acima de 500 kB. Suite geral: **730 testes passaram, zero falhas/skips**. Regressão nova: **8 cenários Chromium passaram** (o executor conta também o teste agrupador, total 9). Som: **7 testes unitários + 5 cenários Chromium passaram** (6 contando agrupador). [Resumo verificável](validation.json).

Os testes novos cobrem Dashboard real, compartilhamento/StrictMode, 30 s, visibilidade, inatividade, retomada, evento storage sem HTTP, falhas/backoff, resposta lenta, desmontagem/cleanup, troca de conta e resposta atrasada, exclusão de usuário cliente, cache de clientes e gravação de capa. HTTP é simulado; não houve banco remoto, teste de carga no plano, publicação Meta real ou verificação da configuração do CDN. O resultado não certifica a resolução do incidente de infraestrutura.

Reprodução a partir da raiz do repositório, usando Node 22:

```sh
npm --prefix v2 ci --ignore-scripts
npm --prefix v2 run check
npm --prefix v2 run build
npm --prefix v2/apps/api test
v2/node_modules/.bin/playwright install chromium
npm --prefix v2/apps/web run test:resource-polling
npm --prefix v2/apps/web run test:notification-sound
```

Revisar e homologar o rascunho antes de qualquer decisão de implantação. Não foi feito merge/deploy, reinício ou alteração de configurações. PR #54 preservado.
