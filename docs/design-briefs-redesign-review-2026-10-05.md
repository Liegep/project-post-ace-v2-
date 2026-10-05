# Briefs de design — revisão visual, 5 de outubro de 2026

Branch local: `codex/design-briefs-redesign`. Sem push, merge, deploy ou acesso a dados de produção.

## Integridade da base

- Fundação aprovada: `4399d57a515566a357f9af1442b89229e0b76fba`.
- `origin/main`, conferido novamente antes da entrega: `78d7d6a2b2a24f194090db273bb84ab0340f846f`.
- A fundação contém o main remoto inteiro, sem commits pendentes de incorporação (0 atrás / 1 à frente antes do redesign).
- O comando principal do main foi executado novamente: **420 testes passaram**.
- Os **439** registrados nas entregas anteriores eram **420 da suíte principal + 19 do Radar executados separadamente**. Referências: `docs/social-calendar-production-2026-10-05.md` no checkout original e `docs/social-calendar-redesign-review-2026-10-05.md`.
- A fundação passou a ter **431 na suíte principal: 420 anteriores + 11 de Briefs**. O comando conservou todos os caminhos anteriores e acrescentou somente os dois arquivos de teste de Briefs.
- Nenhum teste anterior do main foi excluído ou alterado. Neste redesign, foram adaptados apenas os seletores dos testes novos de Briefs aos controles visuais, preservando as verificações de integridade, e acrescentados três cenários.

## Entrega visual

- Templates, Briefs enviados e Respostas recebidas, com contagens dos dados carregados, busca e filtros.
- Biblioteca com categoria, campos, atualização, status e ações Usar, Editar, Duplicar e Arquivar.
- Novo brief com escolha de modelo ou início do zero; editor de perguntas e propriedades laterais.
- Dez tipos de campo com nomes legíveis, duplicação, exclusão, reordenação por arraste e controles acessíveis de subir/descer. Duplicação gera novo ID e preserva os campos de origem.
- Prévia preenchível usa o mesmo componente de formulário do portal. Respostas e arquivos selecionados na prévia ficam somente na memória do navegador e não são enviados.
- Revisão de envio com seleção de cliente e confirmação explícita do congelamento. O envio conserva os mesmos endpoints e controle de versão da fundação.
- Formulário enviado em consulta; respostas em visualização separada, sem controles de edição; seleção de revisão e histórico de atividades.
- Anexos continuam privados. Prévia de imagens usa o GET autenticado existente, URL temporária em memória e revogação ao fechar. PDFs permanecem disponíveis para download autenticado.
- Estados vazios contextuais nas três abas; consulta de registros anteriores mantida.
- Propriedades em modal/bottom sheet em telas menores; Salvar/Revisar e enviar acima da barra inferior, com espaço de rolagem e safe-area.

## Origem dos dados e limites

Nenhuma mudança em `v2/apps/api`, `v2/database` ou `v2/apps/web/src/api.ts`. Nenhuma migração foi executada. A autorização, o congelamento, as revisões, as versões concorrentes e os uploads continuam sob as regras aprovadas.

A biblioteca consulta os detalhes já existentes com até três requisições simultâneas para mostrar respostas/revisões e atividade real do brief/resposta/eventos. Não há novo endpoint ou polling. Uma falha de leitura mostra aviso parcial.

**Nova resposta** significa “ainda não consultada neste dispositivo”, identificada pela última revisão e guardada localmente por usuário. O título do indicador explica esse alcance. A API não oferece leitura sincronizada entre dispositivos; não foi criado estado novo no servidor.

A prévia local usa fixtures isoladas nos arquivos de teste. Esses arquivos não são importados pelo entry point de produção e recusam requisições externas. Nenhum template, cliente, brief ou resposta de exemplo foi gravado no banco.

## Validação

- Suíte principal: **434/434**, sem falhas ou testes ignorados.
- Radar separado: **19/19**, sem falhas ou testes ignorados.
- Total executado nesta revisão: **453 testes**.
- Três cenários adicionados: respostas e revisões somente em leitura; duplicação/reordenação de IDs e prévia sem escrita; propriedades mobile e restauração de foco/rolagem.
- Mantidas as verificações de congelamento, rascunho, envio, autorização do portal, tentativa com a mesma chave de idempotência e headers de upload. Abrir a revisão do envio também é verificado como ação sem envio antes de confirmar.
- Typecheck de API e web: passou.
- Build de API e web: passou. O aviso de tamanho dos bundles continua não bloqueante.
- Diff sem erros de whitespace.
- Verificação visual e medição das três abas em **1440 / 1024 / 768 / 390 / 320 px**: largura do documento igual à largura do viewport, sem overflow horizontal. As tabs têm rolagem própria no mobile.
- Editor e propriedades verificados em desktop, 1024, 768, 390 e 320; prévia preenchida; envio confirmado somente na fixture local; revisões 1/2 consultadas; preview autenticado de imagem aberto.
- Em 390 × 844, rodapé de ações termina em 768 px e navegação inferior começa em 772 px, sem sobreposição.

## Prévia e evidências

Prévia local: `http://127.0.0.1:4182/tests/briefs-preview.html#/area/briefs-design`.

Estado vazio: `http://127.0.0.1:4182/tests/briefs-preview.html?scenario=empty#/area/briefs-design`.

- [Biblioteca desktop](briefs-redesign-review/templates-desktop.jpg)
- [Editor desktop](briefs-redesign-review/builder-desktop.jpg)
- [Editor mobile](briefs-redesign-review/builder-mobile.jpg)
- [Propriedades mobile](briefs-redesign-review/properties-mobile.jpg)
- [Prévia do cliente mobile](briefs-redesign-review/preview-mobile.jpg)
- [Revisão antes de enviar](briefs-redesign-review/send-review-desktop.jpg)
- [Consulta de resposta mobile](briefs-redesign-review/response-mobile.jpg)
- [Biblioteca mobile](briefs-redesign-review/templates-mobile.jpg)
- [Estado vazio desktop](briefs-redesign-review/empty-desktop.jpg)
- [Medições das cinco larguras](briefs-redesign-review/responsive-checks.json)
