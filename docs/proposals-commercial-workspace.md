# Propostas — diagnóstico e validação (03/10/2026)

## Causa

`InternalAreaPage` inicializava `proposalCreationVersion` com 1. Ao montar,
`ProposalsWorkspace` executava um efeito que chamava `createAdminProposal` quando
esse sinal era maior que zero. A função fazia POST com os campos comerciais
vazios e adicionava o registro retornado à biblioteca. O botão Nova proposta
usava o mesmo fluxo. Não era necessário editar ou salvar para ocorrer INSERT.

## Registros suspeitos observados na interface de produção

A biblioteca apresentava 6 propostas, incluindo 4 rascunhos sem cliente, e-mail,
plano, escopo, descrição de investimento ou conteúdo dos serviços, com quantidade
e valor zero. Três exibiam validade de 10/10/2026 e um de 12/09/2026.

Esses 4 registros são compatíveis com o payload criado pelo bug. A interface não
expõe IDs, datas de criação ou auditoria suficiente para atribuir a origem de
cada um com certeza. A contagem é uma observação da biblioteca disponível,
não uma auditoria completa do banco. Nenhum registro foi excluído ou editado
para esta correção. Não há rotina de limpeza na branch.

## Fluxo implementado

- A montagem consulta o histórico e inicia um editor local vazio.
- Nova proposta limpa apenas o estado local, com confirmação se houver alterações.
- Digitação e prévia de uma nova proposta não fazem POST nem PATCH.
- Salvar rascunho cria a proposta; enviar cria com o status sent e a validade já
  utilizada pelo fluxo anterior (7 dias).
- A nova proposta só entra no histórico depois de resposta bem-sucedida da API.
- Cliques repetidos durante salvamento são bloqueados. Falhas preservam o conteúdo.
- Propostas existentes continuam com autosave de 500ms. As gravações são
  serializadas com o envio para evitar que um PATCH atrasado restaure draft.
- Campos, serviços, idioma, moeda, status, prévia pública e compartilhamento
  continuam usando o contrato da API existente. Não há alteração de schema,
  consultas de backend, envio de e-mail ou criação de nova API.

## Interface

Banner simples preservado. Histórico lateral no desktop com cliente, plano/tipo,
valor dos serviços, status real e validade. Editor agrupado em cliente/proposta,
escopo/entregas e serviços/investimento. Ações ao final do editor. No mobile,
histórico rolável e editor empilhados. O modelo não possui campo de título;
a lista usa plano ou tipo, sem inventar dados.

A apresentação da proposta pública e suas traduções foram extraídas do App sem
alterar seu conteúdo. A alteração no package.json da API apenas inclui o novo
arquivo de testes no comando da suíte.

## Validação

- 345 testes aprovados (336 anteriores e 9 do novo arquivo).
- Typecheck e build completos de API e web aprovados.
- Testes de montagem repetida/StrictMode, digitação sem persistência, descarte
  protegido, salvamento explícito/duplo clique, falha preservando conteúdo,
  envio de proposta local, autosave existente concorrente com envio e seis status.
- Prévia local com dados demonstrativos: desktop, mobile 390px e 320px;
  sem overflow horizontal. Ações mobile com 44px de altura e teclado chegando
  de Salvar rascunho a Enviar proposta.
- API, banco e registros existentes preservados. Sem merge ou deploy.
