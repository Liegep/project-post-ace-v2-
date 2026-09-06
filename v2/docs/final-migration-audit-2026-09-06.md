# Auditoria final da migração V1 → V2

Data da conferência inicial: 06/09/2026.

Última atualização: 07/09/2026.

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

## Itens preservados para decisão manual

- A área de equipe ainda contém perfis de demonstração e alguns cadastros aparentemente duplicados. Eles não foram removidos durante a auditoria porque a exclusão é destrutiva e deve ser confirmada pela usuária.

Qualquer item percebido pela usuária deve ser confrontado com esta lista para distinguir conteúdo ausente de diferença de apresentação.
