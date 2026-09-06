# Auditoria final da migração V1 → V2

Data da conferência: 06/09/2026.

## Resultado da comparação

- 11 contas de clientes localizadas e configuradas.
- 58 colunas e 653 cards da V1 presentes na V2.
- 225 comentários presentes, sem HTML bruto e sem vínculos quebrados.
- 300 posts de calendário presentes.
- 40 faturas, 118 itens e 10 anexos presentes.
- 2 contratos, 2 aceites e 5 modelos de contrato presentes.
- 2 propostas presentes.
- 8 relatórios e 2 modelos de relatório presentes, sem JSON bruto visível.
- 2 briefs de design presentes.
- 5 textos e 1 comentário de texto presentes.
- 112 pautas presentes no espaço de pautas dos Kanbans.
- 37 recados compartilhados e 1 rascunho privado presentes.
- Brand Brain do cliente Niko presente.
- Todos os clientes possuem registro de permissões.
- Não foram encontrados cards, colunas, comentários, calendários ou vínculos de usuários órfãos.

## Diferenças encontradas e corrigidas

- 3 comentários que ainda estavam somente na V1.
- 3 posts de calendário da Patricia Rodrigues.
- Fatura “Julho 2026” da Aplikasi e seus 9 itens.
- Proposta de teste que ainda não estava na V2.
- 2 briefs gerais sem cliente vinculado.
- 31 imagens internas dos relatórios que ainda apontavam para o armazenamento antigo.

As correções foram feitas apenas para registros ausentes, sem substituir edições já existentes na V2.

## Exceções conhecidas

- Datas comemorativas não foram migradas por decisão da usuária; serão configuradas novamente na V2.
- Um compromisso cancelado da agenda antiga não foi migrado, conforme a regra do importador.
- 21 arquivos já estavam indisponíveis no armazenamento da V1. Eles afetam 9 registros: 5 cards e 4 itens de calendário. Todos os demais arquivos localizados foram preservados na hospedagem da V2.

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
