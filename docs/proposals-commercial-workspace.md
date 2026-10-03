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

## Prévia do cliente — redesign

A prévia anterior usava o mesmo componente da proposta pública, mas saía da
workspace inteira e dependia de Voltar ao editor. O CSS escondia plano e
quantidade de peças, e as seções dependiam de animação por IntersectionObserver.
Os conteúdos existentes eram tipo, cliente, escopo, serviços/descrições,
investimento/condições, validade e fechamento com aceite/recusa. O link público
mantinha confirmação de resposta e tratamento de indisponibilidade/expiração.

A alternância Editar / Prévia do cliente agora está no topo da área principal,
com abas acessíveis por teclado. As duas visualizações usam o mesmo estado
local, sem chamadas de gravação provocadas pela alternância. O rascunho ainda
não salvo também pode ser visualizado. Envio, link e autosave permanecem iguais.

A nova apresentação é compartilhada com o link público: capa com plano (ou tipo
como fallback), cliente, tipo e quantidade de entregas; escopo; serviços com
valores individuais; total/condições; validade e fechamento. Não existem campos
separados de introdução ou observações finais no modelo; nenhum conteúdo
comercial adicional foi inventado. O total continua somando todos os serviços,
como antes. Os cinco idiomas existentes são preservados.

Apenas na prévia interna os botões de aceite/recusa são demonstrativos e
explicitamente desabilitados. No link público os handlers e estados de resposta
permanecem idênticos. O novo documento não depende de animações para ficar visível.

Validação: 348 testes aprovados, typecheck e build completos aprovados; testes de
alternância local sem gravação, retenção de dados editados, teclado, conteúdo e
idiomas. Conferência visual de editor e prévia em desktop e mobile (390/320px),
sem overflow horizontal; link público local conferido com ações habilitadas.
Prévias demonstrativas em docs/proposals-client-preview no workspace principal.
Sem push, merge ou deploy.
