# Cronograma com múltiplas etapas — Design Hub V2

Data: 26/11/2026. Base: `origin/main` em `1db2b102`. Branch: `codex/proposal-timeline-stages`.

## Resultado

O editor permite adicionar até 100 etapas, editar título, descrição e prazo, reordenar por botões acessíveis e remover qualquer etapa, inclusive a última. Unidades mantidas: dias úteis, dias corridos e data específica. As condições de início e observações continuam gerais. A prévia administrativa e a proposta pública compartilham o mesmo componente e exibem uma sequência numerada, com descrições multilinha e prazos localizados.

Etapas completamente vazias não aparecem na apresentação. Campos vazios são permitidos durante a edição, seguindo o comportamento dos demais campos editoriais. Prazos preenchidos exigem inteiros não negativos ou datas reais; IDs devem ser UUIDs únicos. O título admite até 255 caracteres e a descrição até 50.000.

## Persistência: alteração mínima, sem migration

A inspeção de `proposal-documents.repository.ts` confirmou que `saveDocument` já serializa o documento completo com `JSON.stringify`, e `documentData` recupera `document_json`. O schema existente de `proposal_documents` comporta esse JSON. A alteração acrescenta apenas `timelineStages?: Array<{ id, title, description, value, unit }>` ao contrato da API e do frontend. A ordem do array é a ordem das etapas. Nenhuma alteração nas consultas, tabelas, colunas, bootstrap ou scripts de migration.

- Sem `timelineStages`: o prazo anterior (`timelineValue` / `timelineUnit`) é apresentado como uma etapa. O título original da seção é mantido. A leitura não altera dados nem snapshots históricos.
- A primeira edição das etapas inclui a lista no documento salvo, mantendo também os campos antigos intactos. Editar outros campos não materializa a lista.
- `timelineStages: []`: remoção explícita de todas as etapas, sem ressuscitar o prazo legado. Condições de início e observações continuam visíveis mesmo sem etapas.
- Propostas sem documento premium continuam no fluxo existente.
- A gravação continua usando a transação e a revisão já existentes; conflitos entre sessões continuam rejeitados.

Não houve alteração na lógica de preços, moeda, pacotes, serviços, adicionais, envio, aprovação ou seleção de opção. Snapshots de aceite continuam usando o documento integral e as mesmas verificações.

## Verificação executada

Ambiente: Node 22.23.5, dependências do lockfile, Chromium headless via Playwright. Dados exclusivamente sintéticos.

| Verificação | Resultado |
| --- | --- |
| Suíte geral da API e testes web incluídos | 733 aprovados; 0 falhas; 0 skips |
| Suítes focadas de propostas, moeda, pagamento e workspace | 35 aprovados; 0 falhas; 0 skips |
| `npm run check` em `v2` | API e web aprovados |
| `npm run build` em `v2` | API e web aprovados; aviso de chunks acima de 500 kB |
| Chromium | criação, edição, três unidades, reordenação em ambas as direções, remoção, recarga e apresentação aprovadas |
| Responsividade pública | 1440, 390 e 320 px, sem overflow horizontal na página ou nas etapas |
| Compatibilidade | prazo legado, ausência de documento, lista vazia explícita, condições gerais sem prazo |
| Validação | datas impossíveis, valores negativos/fracionários, unidade inválida, IDs duplicados, limites, escape de HTML |
| Comercial | valores de serviços, moeda, pacotes e texto de aceite preservados; regressões existentes de aceite aprovadas |

O teste de persistência executa `createProposal`, `updateProposal` e `findProposal` reais com adaptador SQL simulado: confirma criação, edição/reordenação, releitura, remoção e conflito de revisão. O navegador usa os componentes reais com fixture isolada e localStorage para simular salvar/reabrir. Não representa integração HTTP com MySQL real. Nenhum banco real foi acessado e nenhum teste que aplica DDL foi executado. Staging, produção e outros navegadores não foram validados.

Capturas inspecionadas visualmente: [desktop](desktop.png), [mobile](mobile.png), [320 px](small-mobile.png), [editor mobile](editor-mobile.png). O teste do navegador regenera essas capturas com dados sintéticos.

## Reprodução

A partir de `v2`, com Node 22:

```sh
npm ci --ignore-scripts
npm run check
npm run build
npm --workspace @design-hub-v2/api test
npm --workspace @design-hub-v2/web run test:proposal-timeline
npm --workspace @design-hub-v2/web run test:proposal-timeline:browser
```

O último comando inicia e encerra seu próprio Vite em loopback e porta dinâmica. Requer Chromium instalado pelo Playwright; se necessário, instalar com `npx playwright install chromium`. Não carrega a configuração da API nem conecta banco.

## Revisão e liberação

Implementação preparada exclusivamente para PR rascunho. Não foram executados merge, deploy ou migration; o PR #54 não foi alterado.

Uma liberação futura deve atualizar API e frontend em conjunto: uma API antiga desconhece e remove `timelineStages` ao validar gravações. Um editor antigo também não apresenta as etapas novas. Não é seguro permitir gravação por versões antigas após adoção do novo campo. Antes de um eventual rollback, preservar os documentos JSON completos e impedir gravação por versões incompatíveis. A estrutura premium existente é pré-requisito; se faltar, a API mantém o erro explícito já existente, sem aplicar DDL automaticamente.
