# Investigação de invalid_response — sem nova chamada real

Base auditada: `e2ef3689d997524fa4b3a3beffc0d2a783a5f822`, versão implantada. Smoke original: HTTP 502, `invalid_response`, 13.553 ms observados no navegador. Nenhum novo acesso à OpenAI foi executado nesta investigação.

## Conclusão e limite retrospectivo

A causa operacional exata do smoke não pode ser recuperada dos registros disponíveis. A resposta pública reteve apenas o código genérico e a mensagem; a Hostinger disponibilizou apenas timestamp/message do evento. A resposta OpenAI não foi armazenada (`store:false`), nem seu texto foi registrado. Não existe uma fixture da resposta real. A fixture de regressão é inteiramente sintética e não deve ser confundida com uma reprodução do conteúdo da resposta de produção.

O defeito comprovado é a perda da classificação e da telemetria no caminho de erro. Não há evidência que permita afirmar que a falha real foi especificamente truncamento, refusal, JSON inválido, schema ou evidência inexistente.

No código implantado:

1. `openAiResponses()` classificava HTTP não-2xx/rede como `unavailable`, refusal como `refusal`, status diferente de completed/incomplete_details como `incomplete`, JSON/output inválido como `invalid_response`. Tokens/modelo eram extraídos apenas depois desses checks e do parsing.
2. O catch de `createResponsesProvider()` (linha 50 na base) convertia `refusal`, `incomplete` e `invalid_response` em `ResponsesError('invalid_response')`, descartando a causa e os tokens.
3. `validateGroundedAnalysis()` (linhas 80–82 na base) lançava o mesmo código para referências ausentes. O schema Zod lançava um erro distinto internamente, mas sem propagação específica.
4. `analyzeReport()` (linhas 98–105 na base) definia `phase='invalid_response'` antes do JSON.parse/validação e convertia erros de parsing/Zod nesse código. A rota apenas devolvia o erro já classificado pelo service; não originava a classificação.

Pelo código implantado, o resultado observado exclui o caminho comum de HTTP OpenAI não-2xx/rede (`provider_error`) e timeout (504), mas não distingue os caminhos acima. O HTTP exato da OpenAI, seu response.status, ID, incomplete_details e refusal não foram retidos. Uma resposta HTTP bem-sucedida da OpenAI não implica `response.status=completed`.

## Auditoria das etapas

| Etapa | Implementação auditada / correção |
| --- | --- |
| HTTP da Responses API | Agora retém providerHttpStatus; HTTP não-2xx é provider_error. Corpo/mensagem de erro nunca entra no log. |
| response.status | Agora retém status reconhecido; failed/cancelled/queued/in_progress não são confundidos com incomplete. |
| incomplete_details | incomplete tem categoria própria; reason conhecido é preservado, desconhecido vira unknown_reason. |
| Refusal | Verificado antes de parsing/schema, categoria refusal e boolean; nunca registra o texto de refusal. |
| Output | Exige um único output_text não vazio, com teto de tamanho; registra tipos de itens/conteúdo, sem textos. Ausência é parse_error/output_missing. |
| Structured Output | Parsing do envelope e do JSON gerado possuem códigos de diagnóstico próprios. |
| Schema local | safeParse diferencia schema_validation_error e registra apenas issue.code e path de chaves conhecidas/índices; sem mensagens/valores Zod. |
| evidenceRefs | Categoria evidence_validation_error/unknown_evidence_ref, com caminho exato, sem registrar a referência recebida. Validação continua rígida. |
| Arrays | Limites originais mantidos: 5/4/4/5/5/3; confidenceNotes até 8; evidenceRefs entre 1 e 6. Todos os caps têm regressão. |
| Opcionais/nulos | Todos os campos do output são required. platformComparison pode ser null; seus canais podem ser null; contentTitle pode ser null. Null em campos não nullable continua inválido. |
| Tokens | REPORT_AI_MAX_OUTPUT_TOKENS permanece 4000 por default e continua enviado como max_output_tokens. Não há prova de que foi atingido no smoke. O teto do schema não garante que uma resposta no tamanho máximo caiba nesse orçamento. Incomplete por esse motivo foi reproduzido com mock. |
| Transformações | OpenAI output_text → JSON.parse no adapter → JSON.stringify no wrapper → JSON.parse no service → Zod (trim/validação) → referências verificadas → evidence de exibição reconstruído do contexto → confidenceNotes combinadas e limitadas → endpoint. Modelo/usage/diagnósticos atravessam agora esse caminho também em falha. Não há retry nem ferramenta de ação. |

## IDs de evidências e contrato

Antes, o modelo já recebia um registro evidence com os IDs exatos como chaves (não apenas métricas sem identificadores). Contudo, o JSON Schema permitia strings arbitrárias em evidenceRefs; não havia enum por contexto nem uma lista separada explícita.

Agora `availableEvidenceIds` lista exatamente `Object.keys(context.evidence)`, incluindo apenas valores existentes. A instrução pede cópia literal e cada evidenceRefs.items no JSON Schema usa esse enum. Métrica null não gera ID. Referência forjada continua sendo rejeitada localmente mesmo que um mock/provider ignore o schema.

Quando não existe qualquer evidência, o schema exige arrays sustentados vazios e platformComparison=null; o mínimo local de uma referência por item não foi relaxado.

O schema parte da mesma definição Zod: objetos com additionalProperties=false, todas as propriedades em required, enums preservados, nullable via anyOf, root object, caps de arrays/strings. A conversão é auditada por teste recursivo. Zod também aplica trim, que não é uma transformação expressável pelo JSON Schema; por isso a validação local continua necessária para strings vazias após trim. Não foi identificado um keyword estrutural incompatível que explique o smoke. O endpoint permanece json_schema/strict:true, sem JSON mode.

Compatibilidade conferida com a documentação oficial: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) e [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). A validação por mocks e auditoria estática não substitui uma futura verificação real autorizada.

## Log seguro

Além dos identificadores/telemetria já permitidos, registra responseId, providerHttpStatus, responseStatus, incompleteReason, failureReason, refusalPresent, outputItemTypes, validationErrorCode e validationPath. Tokens são capturados antes de testar status/refusal/output/parsing e preservados em erros subsequentes. Razões/tipos/modelos/IDs são filtrados; valores desconhecidos recebem marcadores fixos.

O mesmo objeto sanitizado também compõe a mensagem de log, pois a Hostinger omitiu os campos estruturados no evento original. O teste da rota verifica que essa mensagem retém tokens/código/path sem notas, Brain, chave, prompt ou texto de resposta. O contrato de erro do adapter compartilhado com Brand Brain permanece compatível; a tradução específica de Report AI usa as categorias novas.

## Verificação e escopo

- 31 testes específicos de Report AI, incluindo caminho até o endpoint e log da rota.
- 538 testes da API, incluindo consumidores existentes do adapter compartilhado.
- 14 testes de Report AI na interface e 9 de Brand Brain na interface.
- Typecheck e build.
- Fixture sintética com dois canais, crescimento de seguidores, campo null, destaque, notas formatadas e período representativo; cobre resposta válida, referência ausente, required ausente, refusal, incomplete por limite, output vazio, enum inválido, null permitido/proibido e tokens preservados em falhas.

Sem redesign, mudança de modelo/configuração, chamada real, migration, merge ou deploy. A correção é entregue em branch para revisão; produção permanece na versão anterior.
