# PR66 — homologação manual isolada no GitHub Actions

Data: 11/11/2026. Esta investigação não repete os procedimentos locais de banco ou navegador.

## Viabilidade verificada antes da implementação

- O repositório é público, tem `main` como branch padrão e o PR66 está aberto em rascunho na branch `codex/brief-template-archive-delete`.
- A árvore completa da `main` (`770cc38c3e4a4a574164c625a8823568392dfd85`, resposta não truncada) não possui arquivos em `.github/`.
- O GitHub exige que um workflow exista na branch padrão para permitir `workflow_dispatch`. Portanto, adicionar apenas um workflow_dispatch na branch do PR66 não permitiria dispará-lo antes de integrá-lo à `main`.
- Alternativa adotada: disparo manual por adição da label **`homologate-pr66`** ao PR66, com evento `pull_request: labeled`. Esse evento usa a árvore de merge do PR para localizar o workflow, e o checkout é explicitamente do SHA da branch do PR. Não há trigger de push, abertura, sincronização, comentário, cron, deployment ou pull_request_target.
- Os jobs exigem simultaneamente PR66, nome exato da label, branch exata e repositório de origem e destino corretos. Não testam o PR54 e não alteram a `main`.
- O runner Ubuntu suporta containers Docker. A imagem oficial `mariadb:11.8.9` está publicada para Linux/amd64. Foi conferido o índice `sha256:c4124d1afa875e47f2892edf26b482fa54f796e2f342d3717a04ca091a22a9bd` e o manifesto amd64 `sha256:8a4a99eff981d95c3ab12d019b82fe59725fb7761f1f9a5f155bc3f025528f4f` no Docker Hub. O workflow fixa tag e digest e verifica `SELECT VERSION()`; não faz fallback para outra versão.
- A conexão GitHub tem acesso administrativo ao repositório, mas isso não comprova escopos Actions/Workflows do token. O conector rejeitou leituras de `/actions/workflows` e `/actions/permissions` por sua própria allowlist; isso não demonstra que o repositório esteja com Actions desativado. A página pública de Actions apresenta a introdução de configuração, sem runs ou workflow manual. As permissões efetivas de publicação/disparo precisam ser confirmadas pela tentativa real, sem ampliar permissões automaticamente.

## Implementação preparada

`.github/workflows/pr66-homologation.yml` usa Ubuntu 24.04, Node22 e actions oficiais fixadas por SHA. Checkout sem persistência de credenciais; `GITHUB_TOKEN` somente com `contents: read`. Não usa secrets da Hostinger, environments de produção, credenciais reais ou etapas de merge/deploy.

O MariaDB usa `--network none`, `--skip-networking`, datadir tmpfs e somente um socket Unix compartilhado no runner. Senha root vazia se limita a esse servidor descartável sem TCP. O container é removido ao final, incluindo seus volumes anônimos. A versão 11.8.9 e o isolamento de rede são também verificados nos testes antes de criar qualquer banco sintético.

Os quatro testes SQL existentes são selecionados por seus nomes completos. O bootstrap de CI inicializa o schema existente em um banco novo gerado pela própria suíte; não executa um comando de migration/deployment nem aceita URL ou credencial externa. O teste antigo de migration não é selecionado. Nenhum schema ou banco real é migrado.

A homologação visual usa Chromium real com a interface real `BriefsFoundationWorkspace`, endpoints reais de templates/briefs no Fastify e persistência real no MariaDB. O harness fornece apenas uma identidade interna sintética e a listagem auxiliar de clientes do próprio banco temporário. Não é um teste de login, nem um teste de toda a navegação do produto. Não há mock de respostas HTTP das ações do módulo. API e Vite escutam somente loopback e o navegador aborta qualquer requisição externa.

Os casos cobrem, em 1440×1000 e 390×844: ativos separados dos arquivados, contadores, arquivar, visualizar, restaurar sem perder configurações, cancelar exclusão, exigir checkbox, exclusão física, bloqueio por dependências com mensagem, preservação da resposta/histórico, estado vazio e ausência de overflow horizontal na página. São capturados nove estados por largura, além de screenshots de falha quando possível.

Playwright já existe no `devDependencies` versionado do workspace web e no lockfile. Nenhuma dependência ou lockfile foi alterado. O Chromium é baixado somente para `$RUNNER_TEMP` no runner. `npm ci --ignore-scripts --include=dev` não dispara builds ou lifecycle scripts de produção.

## Evidências e estado da execução

Artifacts da execução devem conter TAP dos quatro casos SQL, versão do MariaDB, SHA testado, logs de instalação e servidor, screenshots PNG reais e `visual-results.json`. Upload e resumo executam também em caso de falha. Testes falhos, não iniciados ou ignorados não são convertidos em aprovações. Prazo dos artifacts: 14 dias.

**Preparado; ainda sem resultado de execução nesta revisão do documento.** A aprovação depende dos logs reais do run e da revisão das screenshots. Qualquer impedimento de publicação ou execução será registrado no PR66. O PR deve permanecer em rascunho até conclusão.

Para disparar: adicionar manualmente `homologate-pr66` ao PR66, após o workflow estar na branch. Para outra tentativa, remover e reaplicar a mesma label. A simples atualização da branch não dispara execução.

## Fontes primárias consultadas

- [GitHub: execução manual e requisito de branch padrão](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
- [GitHub: pull_request, labeled e checkout do head do PR](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).
- [GitHub: containers de serviço em runners Ubuntu](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers).
- [Docker Hub: imagem oficial MariaDB 11.8.9 Linux/amd64](https://hub.docker.com/layers/library/mariadb/11.8.9/images/sha256-8a4a99eff981d95c3ab12d019b82fe59725fb7761f1f9a5f155bc3f025528f4f).
- [Playwright: Chromium e dependências em CI](https://playwright.dev/docs/ci).
