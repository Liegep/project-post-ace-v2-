# Auditoria final da migração V1 → V2

Data da conferência inicial: 06/09/2026.

Última atualização: 08/09/2026.

Status da virada: pronta, sem diferenças bloqueantes na auditoria automatizada.

## Resultado da comparação

- 11 contas de clientes localizadas e configuradas.
- Todos os 653 cards da V1 presentes na V2; a V2 possui 654 cards no total por conter também um registro novo.
- 57 das 58 colunas legadas presentes, além de 2 colunas criadas na V2. A única coluna legada omitida era uma duplicata vazia chamada “Entrada” no Minas Home ADS.
- 225 comentários presentes, sem HTML bruto e sem vínculos quebrados.
- Todos os 300 posts legados de calendário presentes; a V2 possui 301 no total.
- 40 faturas, 118 itens e 10 anexos presentes.
- 2 contratos, 2 aceites e 5 modelos de contrato presentes.
- As 2 propostas legadas presentes; a V2 possui 4 no total por conter também 2 rascunhos novos.
- 8 relatórios e 2 modelos de relatório presentes, sem JSON bruto visível.
- 2 briefs de design presentes.
- Os 5 textos legados e 1 comentário de texto presentes; a V2 possui 7 textos no total.
- 112 pautas presentes no espaço de pautas dos Kanbans.
- Os 37 recados compartilhados e 1 rascunho privado legados presentes. A V2 possui 44 recados e 2 rascunhos no total.
- 25 links específicos dos clientes e 13 links rápidos globais presentes.
- 2 PDFs funcionais anexados aos recados da Aplikasi, recuperados pelo Google Drive.
- Brand Brain do cliente Niko presente.
- Todos os clientes possuem registro de permissões.
- Não foram encontrados cards, colunas, comentários, calendários ou vínculos de usuários órfãos.
- A atualização incremental de 07/09 trouxe 35 alterações recentes de cards e 4 atualizações de calendário da V1. Três comentários do mesmo período já estavam presentes e não foram duplicados.
- Quatro cards com edições comprovadamente mais recentes na V2 foram preservados durante a atualização incremental.
- A sincronização incremental de 08/09 trouxe 27 cards alterados, 5 atualizações de calendário, 1 etiqueta nova e 8 compromissos novos da V1.
- Foram preservados e transferidos 25 arquivos de mídia ainda pendentes; depois da substituição das referências, os cards atualizados não mantiveram links para o armazenamento antigo.
- A auditoria posterior à sincronização de 08/09 terminou novamente com `ready: true`, sem diferenças bloqueantes ou vínculos órfãos.

## Diferenças encontradas e corrigidas

- 3 comentários que ainda estavam somente na V1.
- 3 posts de calendário da Patricia Rodrigues.
- Fatura “Julho 2026” da Aplikasi e seus 9 itens.
- Proposta de teste que ainda não estava na V2.
- 2 briefs gerais sem cliente vinculado.
- 31 imagens internas dos relatórios que ainda apontavam para o armazenamento antigo.
- Card “Imóveis Tráfego Pago” e sua coluna “Entrada” no Minas Home ADS.
- Links específicos de Niko, Aplikasi, DJ Per Eventi, Mattia's Bar, Podcast Líder de Elite e Serena Genovese.
- Leitura de anexos em formato JSON textual no importador de recados.

As correções foram feitas apenas para registros ausentes, sem substituir edições já existentes na V2.

## Verificação automatizada para a virada

Foi adicionado um verificador somente leitura que compara a exportação final com
o banco da V2 e também procura vínculos órfãos e clientes sem permissões. A
execução de 07/09/2026 terminou com `ready: true` e zero diferenças bloqueantes.

```sh
npm run audit:legacy -- --input /caminho/exportacao-final
```

Esse comando deve ser repetido logo após a última exportação da V1 e antes da
troca do domínio oficial.

## Exceções conhecidas

- Datas comemorativas não foram migradas por decisão da usuária; serão configuradas novamente na V2.
- Um compromisso cancelado da agenda antiga não foi migrado, conforme a regra do importador.
- A coluna vazia e duplicada “Entrada” do Minas Home ADS não foi recriada. A coluna funcional com o card correspondente foi restaurada e permanece oculta no portal do cliente.
- 21 arquivos já estavam indisponíveis no armazenamento da V1. Eles afetam 9 registros: 5 cards e 4 itens de calendário. Todos os demais arquivos localizados foram preservados na hospedagem da V2.
- Três PDFs antigos dos recados da Aplikasi já não existem no armazenamento da V1 e não foram encontrados no Google Drive: Easy2Work, VT Cards e TransAol. Os atalhos quebrados não foram mantidos na V2.

Registros com arquivos antigos indisponíveis:

- Minas Home — “Imóvel 1409 - Extra” (arquivado).
- Elite Leader Podcast — “🖌️ CAPAS YT + SPOTIFY”.
- Elite Leader Podcast — “Ep. 013 - 🌄 FB + IG Posts”.
- Elite Leader Podcast — “Ep. 013 - 📰 ARTIGOs LINKEDIN” (um dos dois arquivos continua disponível).
- Elite Leader Podcast — “Ep. 013 - 📈 INFOGRÁFICOS”.
- Minas Home — calendário “4 MAR - 210 - Apartamento Ed. Araguaia - Centro BH”.
- Minas Home — calendário “3 Maio - 772 - Loja Ed- Lopes Ribeiro” (um dos dois arquivos continua disponível).
- Niko — calendário “KYNAGOGI - Cosa osserviamo prima di intervenire.”.
- Serena Genovese — calendário “12 -📍 VENICE”.

## Conferência visual publicada

- Dashboard, faturamento, propostas, contratos, briefs, calendário social e equipe carregaram normalmente na versão publicada.
- O Kanban da Aplikasi exibiu colunas, cards, mídias, etiquetas e pautas.
- Os recados migrados apareceram com autor, data e cores de fundo.
- O portal da Aplikasi respeitou as permissões habilitadas e exibiu o menu, as boas-vindas e os compromissos.
- Foi corrigido o formulário de relatórios para não manter o título do cliente anterior ao trocar de conta.

### Etapa 2 — conferência publicada de 08/09/2026

- O dashboard publicou os 11 clientes, 6 próximos posts, 3 compromissos do dia e 8 feedbacks recentes.
- O Kanban da Aplikasi publicou 11 colunas e 31 cards ativos, com carrosséis, etiquetas e contagens coerentes.
- Os 6 recados migrados da Aplikasi carregaram com datas; os 2 PDFs recuperados abriram como links do Google Drive.
- Os 9 links operacionais da Aplikasi ficaram organizados nos grupos `APLIKASI FILES` e `PLANILHAS`.
- O Kanban de Niko publicou 7 colunas e 29 cards ativos; a coluna `Aprovados` está visível ao cliente e contém 7 cards.
- O Brand Brain de Niko carregou com posicionamento, voz, 9 pilares, paleta, tipografia e as demais seções estruturadas.
- O portal italiano de Niko exibiu menus, banner de boas-vindas e textos localizados corretamente.
- O calendário de setembro de Niko está vazio por coerência com a V1: os 25 eventos migrados dessa conta terminam em agosto de 2026; os cards atuais ainda não possuem data de publicação.
- O Kanban do Podcast Líder de Elite publicou 3 colunas e 15 cards, incluindo carrosséis com 2, 9 e 11 artes.
- As prévias indisponíveis encontradas nesse quadro correspondem a arquivos já ausentes na V1 e permanecem dentro das exceções conhecidas abaixo.
- A auditoria automatizada foi repetida ao final da conferência e permaneceu com `ready: true`, `blockingDifferences: 0` e nenhum vínculo órfão.

### Etapa 3 — acessos e permissões de 08/09/2026

- As 11 contas possuem uma configuração própria de permissões; nenhuma conta ficou sem registro.
- A matriz salva no banco foi conferida para criação de posts, edição de legenda, etiquetas, download, pesquisa, textos, faturas, relatórios, Brand Brain e acompanhamento.
- A navegação do portal é montada a partir da resposta de permissões da conta e remove automaticamente recursos desabilitados.
- As rotas de textos, faturas, relatórios, Brand Brain, pesquisa, criação de posts, edição de legenda e etiquetas repetem a validação no servidor; esconder o botão não é a única proteção.
- A criação de post pelo cliente exige permissão e nível de acesso compatível, grava o card na coluna `Entrada` e não aceita uma coluna arbitrária enviada pelo navegador.
- O quadro do cliente retorna apenas colunas marcadas como visíveis; a visualização de arquivados depende também da opção específica da conta.
- A agenda do portal retorna somente compromissos da própria conta que tenham link de reunião preenchido, mantendo tarefas internas fora da área do cliente.
- O portal italiano de Niko confirmou em produção a combinação esperada: criar post, textos, aprovados, Brand Brain e acompanhamento visíveis; faturas e relatórios ocultos.
- Português, italiano e inglês estão associados corretamente às contas; sueco continua disponível no sistema para novas contas.
- As verificações de tipos do site e da API passaram sem erros; os testes de separação entre acesso da aplicação e acesso MCP também passaram integralmente.

### Etapa 4 — pré-voo da virada de 08/09/2026

- A V2 publicada respondeu em HTTPS com status saudável, banco disponível e armazenamento persistente de uploads ativo.
- A página inicial da V2 e a API estão no mesmo domínio, mantendo autenticação e arquivos sem dependência de CORS adicional.
- Uma amostra dos 20 arquivos internos modificados mais recentemente foi baixada pela URL pública; todos responderam com HTTP 200.
- O domínio oficial `liegestudio.com` continua servindo a V1 pela infraestrutura da Hostinger. Nenhum DNS ou domínio foi alterado nesta etapa.
- O backup bruto mais recente da V1 permanece preservado em `migration-export/final-2026-09-08` e continua sendo a base da auditoria.
- A V1 permanece como fonte oficial até a janela de congelamento; alterações feitas nela depois da exportação de 08/09 ainda exigirão uma sincronização incremental final.
- A troca do domínio só será realizada depois de: definir a janela sem edições, gerar a última exportação, importar as diferenças, repetir a auditoria, preparar os logins e testar um acesso real por idioma.
- Para contingência, a V1 deverá permanecer acessível por um endereço alternativo durante o período combinado após a virada.

## Itens preservados para decisão manual

- A área de equipe ainda contém perfis de demonstração e alguns cadastros aparentemente duplicados. Eles não foram removidos durante a auditoria porque a exclusão é destrutiva e deve ser confirmada pela usuária.

Qualquer item percebido pela usuária deve ser confrontado com esta lista para distinguir conteúdo ausente de diferença de apresentação.
