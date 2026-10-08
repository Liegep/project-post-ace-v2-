# Hotfix — escala de alinhamento e fidelidade à evidência

Base: main `7bb1230018533cbc2493f510bbea510bc96e806f`.
Branch: `codex/brand-brain-score-evidence-hotfix`.

## Contrato de alignmentScore

Inteiro percentual entre 0 e 100. A descrição do campo no JSON Schema e o system prompt compartilhado de analyze, generate, refine e radar agora explicitam exemplos 25/55/80/95 e proíbem a escala 0–10. A validação server-side permanece inteira, inclusiva em 0/100 e sem coerção. O número 9 é válido como 9%, nunca interpretado como 9 de 10 ou convertido para 90. UI, endpoints e persistência não mudam.

## Evidência

Regra compartilhada em todas as operações: observações, surveys e correlações exigem linguagem associativa; preservar limitações e desenho, não ampliar sourceSummary. Causalidade só pode ser afirmada quando sustentada explicitamente pela evidência fornecida, no mesmo desfecho, população e condições. Abrange todo o resultado editorial, inclusive título, gancho, rationale, CTA e legenda. Fonte ambígua exige cautela. A regra também cobre evidência já recebida nos campos existentes de análise, geração e refinamento; nenhum novo campo/API foi criado.

É uma proteção de instrução do modelo, não um classificador semântico server-side. Não se introduziu lista de palavras que proibisse conclusões causais legítimas. Testes com mocks verificam envio das regras nas quatro operações, preservação de evidência/idioma, schemas, limites e resultados editoriais associativos/causais controlados. Eles não comprovam comportamento de um modelo real; nenhuma chamada real foi feita.

## Registros antigos

Sem migration, reprocessamento ou atualização de dados. Não é possível distinguir automaticamente um verdadeiro 9% de um modelo que pensou em 9/10. Inclusive a sugestão do smoke test e seu texto original ficam preservados para revisão humana; não há ajuste retroativo ou multiplicação silenciosa. Uma eventual correção histórica exigiria decisão específica e auditável, separada deste hotfix.

## Validação local

- Brand Brain AI específico (backend + frontend): 28/28.
- Suíte principal, incluindo Radar/MCP/Dashboard: 507/507 (503 anteriores + 4 novos testes).
- Radar sazonal: 19/19.
- Typecheck API/frontend: passou.
- Build API/frontend: passou; aviso preexistente de chunk frontend acima de 500 kB.
- Sem push, merge, deploy, alteração de produção ou chamada real à OpenAI.
