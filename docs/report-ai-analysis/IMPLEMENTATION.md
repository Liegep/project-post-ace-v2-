# Relatórios: análise estratégica manual com IA — 8 outubro 2026

Implementação na V2, branch `codex/report-ai-analysis`. Sem merge, deploy, alterações em bancos reais ou chamada real à OpenAI. Provider e HTTP OpenAI mockados nos testes. Alterações anteriores do workspace preservadas e excluídas do commit desta melhoria.

## Auditoria anterior à implementação

- Persistência: `client_reports`, com `metrics_json`, `highlights_json`, `evidence_urls_json` e `notes`. Nenhuma nova tabela necessária.
- Montagem: `ReportsWorkspace.tsx`, `ReportDocument` e exportador PDF. O resumo existente é calculado localmente; não existia análise estratégica por IA.
- Observações: textarea controlado pelo editor, salvo via PATCH normal, exibido pelo documento. Inserção mantém o texto exato existente; publicação continua explícita.
- OpenAI: única integração V2 encontrada em `reports.routes.ts`, chamada REST Responses para extrair números de capturas. Modelo fixo `gpt-4.1-mini`, chave `OPENAI_API_KEY`, sem adapter separado. Esse transporte foi extraído para um adapter compartilhado e reutilizado pelas duas operações. Nenhuma integração paralela.
- Meta: destinos em `client_meta_assets`; credenciais OAuth em `meta_connections`, que nunca é consultada pela análise. A integração V2 gerencia OAuth/destinos, mas não contém importação Graph de insights para relatórios. A tela atual importa capturas mediante extração com IA; a nova operação interpreta os números já preenchidos.
- Limitações do armazenamento atual: seguidores sem ganhos/perdas; destaques com canal/título/valor, sem formato e sem identificação da métrica. Escopo não possui campo próprio no relatório. Não preencher lacunas com dados de contratos ou finanças.
- Brand Brain oficial: `client_accounts.workspace_drawer_json.brandBrain`; propostas ficam em outra tabela. A análise lê só o oficial, com lista permitida de campos e limites de tamanho. Não lê revisões, histórico ou comentários.

## Contrato da API

`POST /api/clients/:clientAccountId/reports/:reportId/ai-analysis`

Autenticação da aplicação, acesso interno e associação admin/colaborador ao cliente. Valida a propriedade do relatório antes de montar o contexto ou chamar provider. O cliente do path nunca pode ser substituído pelo body.

Body: `{ snapshot?: { title, periodStart, periodEnd, metrics, highlights, evidenceUrls, notes } }`. O snapshot validado representa o editor atual, inclusive números recém-importados, sem salvar automaticamente. Sem snapshot, usa o relatório persistido. O browser não fornece comparação, Brand Brain ou permissões. O relatório precisa ter ID persistido; modo local/demo não chama IA.

Resposta: `{ analysis, contextHash }`.

Schema em `report-analysis.schemas.ts` (Zod, também convertido para JSON Schema strict):

```ts
{
  executiveSummary: string,
  keyFindings: { title, finding, evidence, evidenceRefs: string[], type: "fact" | "interpretation" | "hypothesis" }[], // até 5
  whatWorked: { title, explanation, evidence, evidenceRefs }[], // até 4
  attentionPoints: { title, explanation, evidence, evidenceRefs }[], // até 4
  platformComparison: { instagram: string | null, facebook: string | null, evidenceRefs } | null,
  contentInsights: { contentTitle: string | null, insight, evidence, evidenceRefs }[], // até 5
  nextSteps: { action, reason, priority: "high" | "medium" | "low", evidence, evidenceRefs }[], // até 5
  experiments: { test, expectedLearning, evidence, evidenceRefs }[], // até 3
  confidenceNotes: string[] // até 8
}
```

`evidenceRefs` é uma extensão necessária para verificar citações: de 1 a 6 referências a métricas reais do registro do contexto. Sem referência ou com referência inexistente, rejeita a resposta inteira. O texto de evidência é montado pelo servidor a partir dos dados reais, não dos números escritos pelo modelo. Nenhum campo adicional é aceito. Refusal, resposta incompleta, JSON inválido e schema inválido são rejeitados, sem retries pagos automáticos.

O contexto inclui métricas atuais, títulos/destaques, período, observações, destinos Meta e Brand Brain oficial compactado. Comparação usa o relatório anterior mais recente do mesmo cliente que termina antes do início atual; não envia suas observações. Diferenças de duração são sinalizadas. Ausência de comparativo, zeros ambíguos e limitações dos destaques produzem avisos determinísticos, além das notas do modelo.

## UI e custo

Botão `✦ Analisar relatório com IA` junto às observações. Drawer acessível com loading/erro, resumo, achados rotulados, o que funcionou, atenção, comparação, conteúdo, próximos passos, experimentos e limites.

- Analisar: uma chamada explicitamente solicitada. Bloqueia cliques duplicados enquanto aguarda.
- Regenerar: nova chamada explícita, com os dados atuais.
- Inserir: conversão editorial local, título `Análise estratégica da IA`, separador e preservação do texto manual. Não chama IA nem salva/publica automaticamente.
- Descartar/fechar/Escape: limpa preview, sem chamada adicional e sem escrever observações.
- Mudanças nos dados invalidam a inserção. Troca de cliente/relatório e respostas atrasadas não reaproveitam preview de outro contexto.
- Campo com limite de 10.000 caracteres: se a inserção ultrapassar, informa o problema sem truncar nem sobrescrever.
- Abrir, importar, salvar e visualizar não chamam a operação estratégica. **A importação de capturas preexistente usa IA para extrair números**; seu aviso incorreto de execução gratuita/local foi corrigido.

Screenshots de QA isolado, com HTTP interceptado e dados fictícios: `preview-desktop.png` e `preview-mobile.png`. Drawer verificado em 1440×1050 e 390×844, sem overflow horizontal. O harness temporário foi removido; screenshots não usam dados reais.

## Configuração e telemetria

`OPENAI_API_KEY` reutilizada. Defaults e exemplos:

```env
REPORT_AI_ENABLED=false
REPORT_AI_MODEL=gpt-4.1-mini
REPORT_AI_MAX_OUTPUT_TOKENS=4000
REPORT_AI_TIMEOUT_MS=45000
```

Desligado por padrão até revisão. `false` não é convertido indevidamente para true. Timeout aborta o provider; sem retry automático. Responses usa `store: false`, structured output strict e nenhuma ferramenta.

Log estruturado exclusivamente: reportId, clientAccountId, operation, model, timestamp, durationMs, inputTokens, outputTokens, totalTokens, status, error sanitizado e contextHash SHA-256. Tokens indisponíveis são null. Inclui falhas de montagem de contexto, timeout, configuração e validação. Nunca registra chave, corpo HTTP do provider, prompt, relatório, observações ou Brand Brain.

## Testes

Provider sempre mockado. Cobertura dos 20 critérios pedidos:

| Critérios | Evidência |
|---|---|
| 1, 2, 12, 13, 14, 15 | Interface: abrir/importar/salvar sem análise; clique único; inserir preserva texto; regenerar chama novamente; descartar não chama |
| 3, 4 | HTTP: acesso, propriedade e snapshot de cliente/relatório correto; comparação com filtros por cliente |
| 5, 6 | Brain oficial compactado correto; revisão pendente/histórico/campos financeiros não enviados |
| 7, 8 | Schema, enum, limites, campo extra, JSON inválido, refusal/incomplete |
| 9, 10, 11 | Timeout com abort; desabilitada; chave ausente; zero chamadas |
| 16 | Tipos fact/interpretation/hypothesis preservados na resposta, preview e texto editorial |
| 17 | Recomendação sem evidenceRefs ou referência inexistente rejeitada |
| 18 | Avisos determinísticos para falta de comparativo e métricas zeradas |
| 19 | Payload adversarial mantido como dado em mensagem user; política system fixa; renderização HTML escapada |
| 20 | Nenhuma escrita SQL pela análise, nenhum tool, pauta/card/publicação |

Comandos reprodutíveis na raiz do repositório:

```sh
v2/node_modules/.bin/tsx --test v2/apps/api/src/modules/reports/report-analysis.test.ts
(cd v2/apps/web && ../../../node_modules/.bin/vitest run --config vitest.config.ts)
npm --prefix v2 --workspace @design-hub-v2/api test
npm test
npm --prefix v2 run check
npm --prefix v2 run build
npm run build
```

Resultados finais são registrados na seção abaixo.

## Decisões e limites de confiança

- Não criar tabelas, pautas, cards, publicações, histórico de análises ou alterações automáticas no Brand Brain.
- Não há origem histórica do destino Meta no relatório: mostra o vínculo atual e declara a limitação.
- Evidência existente é verificável; a relação semântica completa entre uma interpretação e os números ainda depende do modelo/revisão humana. Referências válidas não provam causalidade.
- O teste de prompt injection comprova isolamento de mensagens e ausência de ferramentas/escritas, mas não demonstra comportamento de um modelo real, que não foi chamado conforme solicitado.
- As melhorias do fluxo de aprovação já presentes no workspace não fazem parte deste commit. Testes da API executados também incluíram essas alterações locais.
- A falha preexistente na suíte da raiz exige `dark:prose-invert` em `src/components/TextContentDetailDialog.tsx`. Tanto esse componente como seu teste permanecem sem alterações desta tarefa; não ajustar fora do escopo.
- Structured output segue a [documentação oficial OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), consultada durante implementação.

## Arquivos desta melhoria

- `v2/apps/api/src/lib/openai-responses.ts`
- `v2/apps/api/src/modules/reports/report-analysis.schemas.ts`
- `v2/apps/api/src/modules/reports/report-analysis.service.ts`
- `v2/apps/api/src/modules/reports/report-analysis.test.ts`
- `v2/apps/api/src/modules/reports/reports.routes.ts`
- `v2/apps/api/src/modules/reports/reports.repository.ts`
- `v2/apps/api/src/modules/reports/reports.schemas.ts`
- `v2/apps/api/src/config/env.ts`
- `v2/apps/api/package.json` (somente inclusão do teste desta melhoria)
- `v2/.env.example`, `v2/.env.staging.example`
- `v2/apps/web/src/ReportAnalysisPanel.tsx`
- `v2/apps/web/src/reportAnalysis.ts`
- `v2/apps/web/src/reportAnalysis.css`
- `v2/apps/web/src/ReportsWorkspace.tsx`
- `v2/apps/web/src/api.ts` (somente operação analyzeAdminReport)
- `v2/apps/web/tests/report-analysis.test.tsx`
- `v2/apps/web/vitest.config.ts`
- `vitest.config.ts`
- Este documento e screenshots de QA.

## Resultados finais

- Específicos servidor: **17/17** aprovados.
- Específicos interface: **13/13** aprovados.
- Suíte API V2 no workspace: **40/40** aprovados (inclui testes anteriores de aprovação já presentes localmente).
- Suíte raiz: **26/27** aprovados; falha anterior de contraste descrita acima. Os 13 testes novos de interface passaram nessa suíte também.
- Typecheck API e web V2: **aprovado**.
- Build API e web V2: **aprovado**.
- Build legado/raiz: **aprovado**.
- QA visual desktop/mobile e contagem de chamadas mockadas: **aprovado**.
- `git diff --check`: **aprovado**.
- Avisos de build: chunks grandes e, no legado, Browserslist antigo/utilitário ambíguo/imports mistos. Sem erros de compilação.
