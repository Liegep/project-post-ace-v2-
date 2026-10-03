# Contratos — workspace documental

Branch: `codex/contracts-document-workspace`, baseada em `codex/contracts-workflow-safety` (`de2c0881c060e02e03fcbcfd1680ba714bfed008`).

## Interface

Biblioteca lateral com acesso a modelos e contratos publicados; filtro pelos sete idiomas existentes: Português, English, Español, Français, Italiano, Deutsch e Svenska. Datas de atualização aparecem quando fornecidas pela API; modelos fixos não recebem datas inventadas.

Editor organizado em Partes, Objeto / escopo, Valores e pagamento, Vigência, Cláusulas e Observações internas. Alternância acessível entre Editar e Prévia do cliente preserva a cópia local. A prévia usa o mesmo componente documental do portal, com título, destinatário, escopo, texto formatado, valores, vigência e estado de aceite. Observações internas não são renderizadas no documento.

Contratos publicados são inspecionados em modo somente leitura, inclusive pendentes. Aceitos mostram data/hora e ID do usuário quando disponíveis. Não há edição ou exclusão do documento original; a ação existente Criar nova versão abre uma cópia local e exige novamente a escolha explícita do cliente. Inspecionar o histórico não sobrescreve o rascunho de trabalho.

A revisão de publicação evidencia cliente, idioma, contrato e vigência antes da ação. Salvar rascunho continua local, sem publicação. Os modelos originais permanecem preservados; Salvar formulário como modelo continua sendo uma ação explícita que cria um novo modelo.

## Limites e preservação

Sem alterações na API, schema, banco, banner ou dados de produção. As funções de proteção local e publicação, a sanitização e os três modelos fixos são idênticos aos da branch de segurança. As consultas permanecem as mesmas; apenas a data de atualização já retornada pelos modelos é exibida.

As regras de aceite, imutabilidade, idempotência e proteção contra troca de modelo são preservadas. O bloqueio geral server-side das outras APIs do portal continua como pendência separada, descrita em [contracts-workflow-safety.md](contracts-workflow-safety.md); o modal visual não substitui autorização no backend.

Nenhum modelo, contrato histórico ou aceite foi excluído ou alterado. As prévias utilizam exclusivamente dados fictícios locais; não foram realizadas publicações ou aceites em produção.

## Validação

- Suíte completa V2: 376 testes aprovados, sem falhas ou testes ignorados.
- Typecheck API e web: aprovado.
- Build API e web: aprovado; aviso de tamanho de bundle do Vite permanece.
- Testes de regressão da segurança mantidos; cobertura adicional de alternância por teclado, preservação do rascunho ao inspecionar registros, leitura de pendentes/aceitos e filtro de idiomas.
- Prévia visual desktop 1440 px e mobile 390/320 px, sem overflow horizontal.
- Capturas de Editar e Prévia do cliente para rascunho local, pendente e aceito, em desktop e mobile.

Arquivos da implementação: `v2/apps/web/src/ContractsWorkspace.tsx`, `v2/apps/web/src/contractsWorkspace.css`, `v2/apps/web/tests/contractsWorkspace.test.tsx` e este documento.

## Refinamento visual aprovado

Ajustes exclusivamente em CSS: biblioteca desktop de 290 para 310 px com mais respiro entre itens; maior largura útil do documento, título mais presente e separação sutil por borda/sombra; bloco de aceite com melhor contraste para data/hora e ID do usuário. Não foi criado nome de usuário artificial: a API atual fornece o identificador do aceite.

Mobile preservado estruturalmente. Conferidos 390 e 320 px sem overflow horizontal, abas com 50 px de altura e ações principais com pelo menos 46 px. Aceitos permanecem somente leitura e sem publicação/edição; observações internas continuam ausentes da prévia. As capturas utilizam dados fictícios locais, sem escritas na API.

Validação repetida após o refinamento: 376 testes aprovados, typecheck e build aprovados. O aviso existente de tamanho de bundle permanece. Push da branch autorizado pelo usuário; merge e deploy ainda não autorizados.
