# Conversão pauta → post: correção e reparação planejada

Branch independente `codex/pauta-post-state-guard`, baseada em `main` `c92e57a617dea4fd7c286548301a47ba350682d2` (#38, #39, #40, #41 e #42). Nenhuma alteração em cards ou dados de produção. Não há migration nova.

## Diagnóstico

O editor enviava `isBriefApproval` a partir de uma referência inicial. Uma movimentação pode converter a pauta aprovada, mudar sua revisão e retornar o novo card. O editor ignorava esse retorno. A ação “Atualizar estado da aprovação” adotava a revisão, coluna e marcadores, mas mantinha a referência antiga. Um salvamento seguinte podia reenviar `true`; o backend aceitava a reclassificação. O indicador podia voltar a pauta sem evento de reversão, mesmo com `converted_to_post` no histórico.

A pauta original continua no banco e aponta para o mesmo card. Isso não representa dois posts. Mídia pronta, briefing editorial e nome da coluna não substituem o indicador de fase. Anexar arte sozinho não converte a pauta.

Na investigação por leitura da Kynagogi em 15/10:

- Cliente: `d23f7591-ad3e-45fc-a3a5-f036189153db`.
- Card: `089dbeed-f15d-4f28-ae5f-ccfaa35e1e9d`.
- Pauta: `e5484a6d-2626-48d8-9100-e75c4ef3c1e7`, aprovada e vinculada ao mesmo card.
- Título: **KYNAGOGI - Il settore pet cresce. Ma cresce anche la cultura cinofila?**
- O feed mostrou conversão em **14/10, 11:07**, e atualização em **15/10, 10:51**, nos horários da interface. Não identifica os campos alterados nessa última atualização.
- O card estava em **Waiting approval**, coluna visível, com arte, retorno “Pendente” e `status: []`. A consulta exclusiva de pautas pendentes o retornava, confirmando o indicador de pauta.
- A pesquisa administrativa, que inclui ativos e arquivados, encontrou um resultado para “settore pet”. Das 56 ideias do banco, apenas uma correspondia ao título e apontava para esse card.

A falha foi reproduzida, mas não foi possível atribuir a reversão desse card a um clique/pessoa/salvamento específico. O texto exato dos avisos não foi recuperado. A conexão SQL da configuração local foi recusada na investigação anterior; a revisão e os snapshots completos de produção continuam pendentes de leitura autorizada. Estes dados históricos **não substituem a prévia atual** do reparo.

## Correção global

- Salvamentos comuns do editor não enviam mais `isBriefApproval`. A classificação permanece sob responsabilidade do fluxo do servidor; rascunhos antigos não podem reintroduzir o campo.
- O editor adota a revisão, os marcadores, o retorno e a coluna do resultado final da movimentação, incluindo a conversão. Mantém legenda, mídia e alterações humanas feitas enquanto uma solicitação estava em andamento; uma nova coluna escolhida durante esse tempo permanece como alteração pendente.
- Atualizar a aprovação ou reabrir o editor não recupera uma referência antiga de classificação, pois ela foi eliminada do editor. O conflito continua preservando o rascunho para adoção explícita do estado vigente.
- O serviço recusa `false → true` em edição comum. O repositório aplica essa condição no próprio `UPDATE`, inclusive para escritores sem revisão e para uma conversão concluída após a leitura inicial.
- Edição e versão anterior da legenda passam a ser confirmadas/revertidas na mesma transação, com bloqueio do card e nova conferência da revisão/classificação. A versão de legenda de uma conversão também participa da transação dela. A preparação aditiva já existente da tabela de legendas permanece fora dessas transações, evitando commit implícito de DDL.
- A reconciliação legada de inicialização não pode recuperar o indicador de pauta se já existir `converted_to_post`, mesmo que os metadados legados de revisão/reset estejam inconsistentes.
- Criar/enviar uma pauta nova, converter explicitamente uma pauta em post, converter ao mover uma pauta aprovada e converter pelo envio de uma pauta aprovada ao cliente mantêm o fluxo existente. Decisões, comentários, snapshots e links anteriores permanecem preservados.

O PR não muda o design aprovado, o enquadramento de mídia, permissões ou contratos HTTP. A resposta da movimentação já continha o card; o cliente agora a tipa e consome.

## Prévia da reparação específica

Foi acrescentada uma ferramenta **exclusivamente de prévia**, `preview:kynagogi-produced-post`. Não existe `--apply`, endpoint de reparação ou caminho que execute a alteração do card.

A ferramenta exige `--preview` e um `APP_ENV_FILE` explícito. Não usa configuração de banco implícita, não inicializa a aplicação, não executa reconciliações, workers ou preparação de schema. Abre conexão dedicada, exige uma transação `READ ONLY`, obtém snapshot consistente e encerra a conexão. Apenas `SELECT`s leem os registros; comandos de sessão iniciam/encerram a transação sem alterar dados.

A prévia verifica:

- Cliente, slug e ID fixos; classificação, revisão, decisão, datas e indicadores de arquivamento.
- Coluna do mesmo cliente, visível e compatível com aprovação pendente; não propõe alterar uma coluna compartilhada.
- Status interpretáveis e coerentes com o ciclo pendente; mídia realmente presente.
- Vínculo único com a pauta aprovada esperada e ausência de outro card com o mesmo título entre ativos/arquivados.
- Evento `converted_to_post`, snapshots válidos mostrando `true → false`, revisão da conversão, revisão auditada mais recente e decisão vigente.
- Comentários, links, versões de legenda, eventos de aprovação, referências de calendário e aprovações internas.

O resultado contém a proposta de classificação/visibilidade, os estados estruturais dos snapshots, o vínculo da pauta, contagens e fingerprints dos dados que devem ser preservados. Não expõe tokens de aprovação, URLs privadas ou texto integral de legendas/comentários. Alterações posteriores de legenda/mídia em relação à conversão são destacadas; a proposta preserva os dados atuais, sem restaurar conteúdo de snapshot antigo.

Se faltar qualquer conferência ou houver divergência, `eligibleForReview` é falso e `proposedPatch` é nulo. Uma prévia elegível continua sendo somente uma proposta para revisão humana.

Para obter uma prévia futura, em ambiente com acesso de leitura válido, a partir de `v2`:

```sh
APP_ENV_FILE=/caminho/explicito/configuracao.env npm --workspace @design-hub-v2/api run preview:kynagogi-produced-post -- --preview
```

**Essa prévia não foi executada contra produção neste PR.** O leitor foi exercitado em uma transação MariaDB `READ ONLY` com registros sintéticos. Não há afirmação de elegibilidade atual do card real.

## Plano para uma aplicação futura, ainda não autorizada

1. Revisar a correção global e disponibilizá-la pelo processo autorizado antes de qualquer reparo, evitando a repetição do problema por editor antigo.
2. Obter a prévia real atual, revisar seus bloqueios, coluna, status, vínculos, snapshots e fingerprints. Não presumir a revisão a partir do diagnóstico anterior.
3. Aprovar separadamente uma operação específica para o mesmo ID. Uma implementação de aplicação deverá repetir a leitura sob bloqueio, conferir revisão e snapshot integral e abortar se qualquer dado ou vínculo tiver mudado.
4. Se o ciclo vigente continuar pendente e os demais critérios forem confirmados, restaurar **somente** a classificação de post e a visibilidade necessária. Com `status: []`, mudar apenas o indicador para falso pode ocultar o conteúdo: o portal exige **Enviar para Cliente** nos posts. A proposta inclui esse marcador, preservando os demais, sem duplicar card ou trocar coluna.
5. Preservar mídias, legenda, briefing, banco original, comentários, decisões, aprovações internas, links e snapshots. Não copiar a legenda antiga do banco para o card e não reaproveitar a aprovação da pauta como aprovação da arte.
6. Registrar um reparo administrativo com antes/depois e uma cerca de revisão para editores obsoletos, sem fingir conversão, reenvio ou nova decisão do cliente. A implementação futura precisa definir esse evento não decisório e sua apresentação no histórico; não deve reutilizar rótulos de aprovação/alteração solicitada. Não chamar o PATCH genérico de conversão, que abriria outro ciclo e encerraria links novamente.
7. Conferir os fingerprints preservados, a classificação e a presença do mesmo ID na área de posts do portal. Não executar correção em lote. Havendo divergência, interromper e gerar nova prévia; não restaurar snapshots antigos por cima de conteúdo atual.

Não há SQL de atualização do card nem aplicador pronto para execução incluído neste PR. A etapa atual entrega a prevenção, a prévia verificável e este plano; qualquer escrita futura requer outra autorização e implementação revisada.

## Validação

Node 22.23.3:

- **694 testes de regressão API/componentes passaram.** Incluem rejeição do indicador antigo com revisão ausente, antiga e atual; conversão explícita; preservação; conferências e bloqueios da prévia.
- **7 testes de navegador do editor passaram**, usando o componente real e API sintética: salvar/mover, novo salvamento em andamento, adoção de aprovação, reabertura, rascunho antigo e conversão concorrente. Os payloads comuns não contêm classificação.
- **5 testes MariaDB isolados passaram** (contagem do runner, incluindo teste principal): conversão real, rejeição atômica, leitura antiga concorrente, rollback de legenda/histórico/links, visibilidade na rota real do portal, reconciliação e prévia `READ ONLY` sem escritas.
- **12 testes de layout editorial passaram.**
- **9 testes do visualizador de mídia passaram**, incluindo a comparação com o leitor anterior ao #41.
- **Typecheck e build API/web passaram.** Somente o aviso preexistente de chunks acima de 500 kB.

O MariaDB foi criado em diretório temporário próprio, sem networking, acessível apenas pelo socket `/tmp/pauta-state-mariadb-20261015/server.sock`. As suítes recusam outro padrão de socket, sem fallback para `.env`, host ou banco remoto. As únicas escritas SQL executadas nesta tarefa foram as dos bancos sintéticos isolados dos testes.

Reprodução, a partir de `v2`:

```sh
npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/api test
npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/web run test:pauta-state
PAUTA_STATE_TEST_SOCKET=/tmp/pauta-state-mariadb-20261015/server.sock npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/api run test:pauta-state:mysql
npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/web run test:pauta-layout
npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/web run test:media-layout
npm exec --yes --package=node@22 -- npm run check
npm exec --yes --package=node@22 -- npm run build
```

A suíte MariaDB requer inicializar previamente uma instância temporária com `mariadb-install-db` e `mariadbd --no-defaults --skip-networking`, usando datadir, pid e log no mesmo diretório temporário. Não se conecta ao banco da aplicação. O teste visual comparativo requer o commit anterior ao #41 disponível no Git local.

Sem merge, deploy, migrations ou alterações de dados em produção.
