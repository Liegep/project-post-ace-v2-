# PR66 — resultados reais no GitHub Actions

Execução final: [43067237312](https://github.com/Liegep/project-post-ace-v2-/actions/runs/43067237312), concluída com **success** em 11/11/2026, às 18:22 (Europe/Stockholm). SHA testado: `48e32cc57c194d525b6af7d57758b790620c37f1`. Os commits posteriores de relatório não alteram o código funcional nem os testes executados.

## Resultado comprovado

| Verificação | Resultado real |
| --- | --- |
| Runner | Ubuntu 24.04, Node 22.23.4 |
| Banco | `11.8.9-MariaDB-ubu2404`, `@@skip_networking=1`, container sem rede e somente socket Unix |
| Arquivar e restaurar, preservando campos/configurações e legados | SQL passou |
| Exclusão física de template sem dependências | SQL passou |
| Bloqueio com rascunhos/envios/respostas/arquivados e preservação integral do detalhe | SQL passou |
| Concorrência entre uso e exclusão | SQL passou |
| Total SQL selecionado | **4 passaram, 0 falhas, 0 ignorados** |
| Chromium 1440×1000 | Seis verificações de fluxo passaram; nove screenshots reais |
| Chromium 390×844 | Seis verificações de fluxo passaram; nove screenshots reais |
| Upload de artifacts | Sucesso; 29 arquivos, dos quais 18 são screenshots |

Nos dois tamanhos, o navegador real verificou ativos separados de arquivados, contadores iniciais e após operações, arquivamento, prévia, restauração com configuração preservada, cancelamento seguro, confirmação explícita antes de excluir, exclusão física no banco, erro de dependência no modal, resposta/histórico preservados, estados vazios, mensagens e ausência de overflow horizontal da página. O código valida também limites horizontais do modal e do painel e ausência de erros JavaScript ou chamadas externas. O backend é o Fastify real do módulo, com MariaDB real e dados sintéticos; os endpoints de ações não são simulados. O harness fornece uma identidade interna sintética e uma rota auxiliar de clientes locais. Isso não é homologação da tela de login ou de todos os módulos do produto.

## Capturas e logs

[Baixar o artifact final](https://github.com/Liegep/project-post-ace-v2-/actions/runs/43067237312/artifacts/13876282655). Nome: `pr66-homologation-43067237312-48e32cc57c194d525b6af7d57758b790620c37f1`.

- SHA-256 do ZIP: `b837562af194c64ea634ac07c91d167bda1a54ad40bdf7063268a146b27eb36c`.
- Tamanho: 3.993.936 bytes. Retenção até 25/11/2026, às 18:21 (Europe/Stockholm).
- Inclui `sql-tests.tap`, `visual.log`, `visual-results.json`, logs do servidor e instalação, versão do banco e SHA testado.
- Para cada largura (1440 e 390), os PNGs são: `01-active`, `02-archived`, `03-preview`, `04-restored`, `05-delete-unconfirmed`, `06-delete-confirmed`, `07-deleted`, `08-dependency-blocked` e `09-empty`.

**Limite da inspeção:** os testes automatizados em Chromium e as capturas reais foram concluídos. A revisão visual manual das imagens não foi concluída: a tentativa de baixar o ZIP para inspeção local falhou. Não se declara uma aprovação manual de design com base apenas no resultado automatizado. As capturas estão disponíveis no artifact para revisão.

[Extrato dos logs reais](actions-success.log) e [resultados estruturados](actions-results.json). O extrato seleciona linhas relevantes sem alterar seus valores; o log completo continua no run/artifact.

## Histórico transparente

| Tentativa | Resultado |
| --- | --- |
| [43066194253](https://github.com/Liegep/project-post-ace-v2-/actions/runs/43066194253) | Validação de workflow rejeitada antes de jobs: contexto runner.temp fora do local permitido. Corrigido via GITHUB_ENV. Não executou testes. |
| [43066395310](https://github.com/Liegep/project-post-ace-v2-/actions/runs/43066395310) | SQL 4/4 passou. Harness visual falhou por helper de transpiler `__name` dentro de avaliação do navegador. Corrigido somente no harness. |
| [43066853908](https://github.com/Liegep/project-post-ace-v2-/actions/runs/43066853908) | Chromium passou nos dois tamanhos. Bootstrap SQL encontrou socket em reinício do servidor temporário da imagem. Corrigida condição de prontidão para esperar PID1=mariadbd (servidor final). |
| [43067237312](https://github.com/Liegep/project-post-ace-v2-/actions/runs/43067237312) | **SQL e Chromium passaram na mesma execução.** |

O registro de validação inválida aparece como evento push no GitHub por validação sintática automática; nenhum job de teste foi configurado ou executado por push. Os runs de testes foram iniciados pelo evento labeled manualmente aplicado ao PR66. Nenhuma falha anterior foi convertida em aprovação.

## Segurança e entrega

Somente a branch do PR66 recebeu alterações. Não houve conexão com produção, uso de secrets/credenciais Hostinger, migration em banco real, merge, deploy ou alteração no PR54. O bootstrap usa schema existente somente em bancos novos com nomes gerados pela suíte no container descartável. Playwright já era devDependency; nenhuma dependência ou lockfile de produção foi modificado. O container foi removido ao final com sucesso. O log confirma GITHUB_TOKEN com Contents: read e Metadata: read.

O PR66 **permanece em rascunho**, conforme instrução. A execução automatizada está aprovada; a revisão humana das screenshots continua explicitamente pendente.
