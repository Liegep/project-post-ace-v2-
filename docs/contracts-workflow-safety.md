# Contratos — correções funcionais antes do redesign

Branch: `codex/contracts-workflow-safety`, baseada em `a3a4d0fa1a46705930644bbcd10ef1b5c4832912`.

## Rascunho e publicação

Não existe status de rascunho no backend de contratos. Para evitar alterar o schema e converter documentos históricos, o rascunho permanece no armazenamento local deste navegador. O botão **Salvar rascunho** não chama a API nem publica um documento. O texto da interface explica a limitação: o rascunho não é compartilhado entre dispositivos e pode ser perdido se o armazenamento do navegador for apagado.

Somente **Publicar contrato** cria um documento `pending`. É obrigatório escolher um cliente; não há seleção do primeiro cliente. Rascunhos recuperados do formato anterior não reutilizam a seleção automática antiga. **Criar nova versão** copia os termos para o editor local e exige escolher o cliente novamente; não modifica o original.

Uma publicação usa um UUID persistido localmente antes da requisição. Repetir a mesma requisição reutiliza esse UUID e a chave primária existente, sem criar outro contrato. Reutilizar o UUID com termos diferentes retorna conflito. Duplo clique também é bloqueado no frontend. Falha no armazenamento impede a publicação; falha na resposta preserva o rascunho e o UUID para tentativa posterior.

Não há migração, ALTER, limpeza de dados, conversão de contratos ou regravação de aceites. Os três modelos fixos permanecem iguais e os cinco modelos persistidos não são alterados automaticamente. Os dois contratos históricos aceitos e seus registros de aceite permanecem intactos; esta etapa não acessou produção.

## Documento aceito e auditoria

A API de contratos bloqueia edição e exclusão quando existe qualquer aceite ou quando o documento possui status `accepted`, inclusive nos registros históricos. Aceitar, editar e excluir usam uma transação com bloqueio do documento, impedindo que uma alteração concorrente ocorra depois do aceite.

A estratégia escolhida é **documento aceito imutável**, permitido pelo escopo solicitado. O texto e os campos do documento são independentes do template e permanecem no registro original; não é necessário adicionar uma tabela paralela de snapshots. Alterações de termos exigem outro documento, com outro ID. Não foi inventado hash retroativo nem reconstituído conteúdo histórico inexistente. Não há novo status nem relação de substituição gravada no banco.

O aceite mantém o registro existente de usuário, horário e IP. O horário é registrado pelo banco e o IP vem da requisição. O status efetivo continua derivado do aceite, conforme a arquitetura anterior, sem atualizar artificialmente os documentos históricos.

Limite: esta proteção está nas rotas de contratos. Não é uma garantia contra alterações diretas no banco, scripts de manutenção ou cascatas de exclusão de contas que já existem no schema. A política global de retenção/exclusão de contas deve ser tratada separadamente. O nome do cliente exibido no cabeçalho continua vindo da conta atual; o conteúdo armazenado do documento é preservado.

## Aceite e portal

A API exige contrato pendente, ausência de aceite anterior e vínculo de usuário `cliente` com a conta do contrato. Perfil somente leitura não pode aceitar. Privilégio administrativo sem esse vínculo não substitui o responsável do cliente. Documento de outra conta retorna não encontrado; aceito ou cancelado retorna conflito. Não é permitido fabricar status `accepted` pelo CRUD administrativo.

As respostas de pendência e aceite excluem `notes`, e a prévia compartilhada não renderiza esse campo. Observações internas permanecem disponíveis somente no contexto administrativo.

O modal é renderizado fora da árvore da página, mantém foco/Tab/Escape dentro dele e torna o fundo inerte. Existe **Sair da conta**. Ao aceitar, consulta imediatamente o próximo pendente; somente libera a interface depois de uma consulta confirmar que não há nenhum. Falhas de consulta mantêm o bloqueio e oferecem nova verificação. Aceite já registrado não é reenviado para resolver uma falha na consulta seguinte. Respostas antigas de carregamento em StrictMode são descartadas.

**Limite de segurança deliberado:** o modal bloqueia a interface, não as APIs gerais do portal. O bloqueio server-side dos demais recursos enquanto houver contrato pendente ainda exige uma etapa própria de autorização. Esta implementação não apresenta o modal como garantia de segurança da API.

## Compatibilidade e proteção local

Os campos de modelo usam `contractType` e `contractValue` na API e são convertidos para `type` e `value` no editor. Datas vazias são normalizadas para `null` tanto no envio do frontend quanto na validação da API. Trocar de modelo ou iniciar outro documento com alterações não salvas exige confirmação e permite cancelar. Nenhum modelo existente é sobrescrito por personalização do cliente.

## Validação

- Testes novos de repositório/API e interface: rascunho sem publicar; cliente explícito; publicação idempotente; falha de armazenamento; imutabilidade de históricos e conflito HTTP; aceite inválido; disputa entre edição e aceite; sequência de pendentes; notas internas ausentes; troca de modelo; datas/tipo/valor; foco/teclado; falhas de consulta; respostas antigas em StrictMode.
- Conferência visual local com dados fictícios: desktop de 1280 px e mobile de 390 px, sem overflow. Verificados cliente vazio, salvamento local, oito opções de modelo, prévia sem nota interna, modal com teclado e avanço por dois documentos antes de liberar a página.
- Suíte completa V2: 372 testes aprovados (24 novos), sem falhas ou testes ignorados. Typecheck e build aprovados. O build mantém o aviso habitual de tamanho de bundle.
- Testes de banco usam conexão simulada para verificar consultas, bloqueios e transações; não foram executados contra produção.

Sem push, merge ou deploy nesta etapa.
