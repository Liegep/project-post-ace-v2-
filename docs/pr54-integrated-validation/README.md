# PR #54 — validação integrada local e preparação da implantação

Data: 28/10/2026. PR mantido em rascunho. Este relatório não é autorização de implantação.

## Ambiente e bloqueio de staging

Foram examinados `.env.staging.example`, o roteiro `v2/docs/staging-and-migration-runbook.md`, a configuração da API e os testes locais. O arquivo de exemplo contém placeholders; o roteiro descreve uma arquitetura esperada e uma migração antiga, não uma instância atualmente verificada. Não foram fornecidos identificação e comprovação de um staging isolado. **Não foi possível confirmar a existência de staging funcional e seguro.**

A etapa remota ficou bloqueada por falta de evidência de isolamento e autorização de acesso. Nenhum endpoint/banco de produção foi usado como substituto. Não foram consultados banco remoto, credenciais reais, configurações Hostinger ou dumps/exportações de clientes. O antigo roteiro permite dados reais no ensaio de migração V1→V2; essa orientação não se aplica a este PR e foi substituída aqui pela restrição de fixtures exclusivamente sintéticas.

A execução efetiva usou Chromium/Playwright com frontend compilado, rotas Fastify reais e autenticação JWT do projeto, sobre MariaDB descartável local. `results.json` registra versões, socket, `@@skip_networking=1`, banco aleatório e porta HTTP loopback. Não há mocks de respostas da API nem autenticação por cabeçalho de teste; os dois papéis principais entram pelo formulário de login. Nenhum `.env` é carregado pelo harness. Os pools aceitam apenas `/tmp/brief-mariadb-*/server.sock`, sem conexão TCP ao banco. O navegador só pode acessar a origem local; requisições externas são abortadas.

Para impedir efeitos externos, o harness registra os módulos pertinentes sem `buildApp`, sem workers de publicação/recorrência/arquivamento, sem SMTP e sem credenciais de provedores. Isso valida a integração UI/API/banco e a preservação dos registros Meta, mas **não equivale a executar publicação real Meta nem certifica a infraestrutura de hospedagem**.

## Reproduzir sem staging

Pré-requisitos locais: Node 22, MariaDB (com `mariadb-install-db`, `mariadbd`, `mariadb-admin`), dependências do lockfile e Chromium do Playwright. A partir de `v2`:

```sh
npm ci --ignore-scripts
npx playwright install chromium
bash scripts/validate-brief-withdrawal-local.sh
```

O script recusa Node diferente de 22; cria um processo MariaDB novo com `--skip-networking`, aguarda seu socket exclusivo, executa build, suite MariaDB, teste integrado em navegador, typecheck e suite geral. No fim encerra **somente o processo descartável que criou**, sem iniciar/reiniciar serviços existentes. O teste remove somente o banco sintético aleatório que criou; arquivos/logs sintéticos ficam no diretório temporário informado. As evidências do navegador são atualizadas nesta pasta.

## Cobertura

| Cenário | Evidência/critério |
|---|---|
| Criar e enviar | Login pelo formulário; criar pauta e enviar PNG gerado pelo seletor de arquivos; enviar ao cliente pela aba Pautas |
| Visibilidade antes | Login do cliente pelo formulário; título visível no Portal; captura `01-portal-sent.png` |
| Retirada | Menu, mensagem exata e confirmação; status administrativo; captura `02-admin-withdrawn.png` |
| Invisibilidade | Recarga do Portal, pesquisa pela interface, Arquivados e Aprovados; APIs de board/busca/arquivados, detalhes e comentários; link público aberto em outra página |
| Preservação | Igualdade de título, legenda, briefing, mídia, etiquetas e cliente; comentários internos e do cliente presentes; evento de retirada; hash SHA-256 dos bytes da imagem igual |
| Persistência | Recarregar completamente a área administrativa e o Portal; status e invisibilidade persistem; suite MariaDB verifica nova conexão |
| Reenvio | Reenviar pelo botão existente; mesmo `cardId`, nova revisão/link e reaparecimento no Portal; captura `03-portal-resent.png` |
| Links antigos | GET e decisão por token anterior recusados, inclusive depois de reenviar |
| Aprovação anterior | Aprovar no navegador; retirar pauta aprovada; preservar evento de aprovação e reenviar |
| Permissões | JWT real: cliente, colaborador de outra conta, viewer e anônimo recusados; edições internas preservam retirada |
| Concorrência | Dois endpoints HTTP reais de retirada/decisão enfileirados em bloqueio da linha; decisão perdedora recusada sem comentário residual ou retirada pede revisão atual; resultado registrado no JSON |
| Outros cards/Meta | Card comum recusa retirada; comparação integral antes/depois do card e do registro Meta sintético; nenhum worker ou chamada ao provedor |
| Migração | DDL com registros existentes; timeout de metadados não cria coluna; nova tentativa após liberar o lock aplica INSTANT/NONE; linhas antigas preservadas com NULL |

A suite MariaDB adicional cobre pautas pendentes/aprovadas, edição, conexão nova, tokens, conteúdo do drawer e outras pautas. A suite geral cobre regressões dos módulos, incluindo Meta. Rodada completa aprovada pelo script de reprodução em Node 22.23.4, MariaDB 10.11.19 e Chromium 151.0.7922.34:

- **9 verificações integradas de navegador/migração passaram**, sem erro JavaScript de página ou resposta 5xx inesperada.
- **6 testes MariaDB passaram**; **703 testes gerais passaram**, sem falhas ou skips.
- **Typecheck e build passaram**; build mantém o aviso de chunks acima de 500 kB.
- Corrida observada: retirada HTTP 200 e decisão concorrente HTTP 404, sem comentário residual.
- O processo MariaDB criado pelo script foi encerrado ao fim; banco de teste removido pelo harness. Evidências: `results.json` e capturas desta pasta.

## Falhas durante preparação e limites

As primeiras execuções expuseram problemas do próprio harness: caminho da raiz incorreto, PNG de fixture inválido, preparação ausente de tabela auxiliar/coluna de textos, autenticação incompleta de contexto e seletor de Arquivados incorreto. Foram corrigidos no teste e a validação foi repetida. Não se alterou código de produto para contornar essas falhas. Falhas esperadas de permissão, retirada e revisão são parte dos critérios; erros 5xx inesperados ou erros JavaScript de página fazem a execução final falhar.

Limites: teste local em Chromium; sem validação de proxy/TLS/cache/múltiplas instâncias da Hostinger, volume de produção, outros navegadores ou publicação real Meta. Uma página já carregada pode reter o conteúdo anterior até atualizar; novas ações são bloqueadas no servidor. URLs de arquivos existentes não são apagadas ou revogadas por esta função.

## Migração, riscos e decisão de prontidão

A coluna proposta é suficiente com os mecanismos existentes de revisão e histórico. A versão de MariaDB e a topologia de produção permanecem desconhecidas porque o banco não foi acessado. Suporte a DDL instantâneo, locks, backup, recuperação e drain de instâncias antigas são pré-condições obrigatórias, não suposições.

O procedimento exato e os checklists de backup/aplicação/validação/contingência estão em [proposta-migracao-retirada-pautas.md](../proposta-migracao-retirada-pautas.md). A contingência não pode reverter para API antiga nem limpar a coluna; se a proteção não puder ser mantida, o Portal e as rotas públicas permanecem em manutenção autorizada.

**Manter o PR #54 em rascunho para revisão humana dos resultados.** A validação técnica local está aprovada e o PR está apto a avançar para revisão final dos resultados; a saída do rascunho exige a decisão humana solicitada; prontidão para produção depende de autorizações separadas, confirmação do ambiente de destino e conclusão dos checklists. Nenhum merge, deploy, migração de produção, reinício de serviço ou alteração Hostinger foi realizado.
