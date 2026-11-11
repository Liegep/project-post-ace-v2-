# Briefs de design — arquivamento, restauração e exclusão definitiva

Data: 11/11/2026. Base conferida: `main` em `770cc38c3e4a4a574164c625a8823568392dfd85`.

## Resultado

A biblioteca apresenta quatro abas: Templates, Briefs enviados, Respostas recebidas e Arquivados. Templates mostra somente ativos; Arquivados mostra somente templates arquivados. Os dois contadores consideram toda a coleção, independentemente da busca.

Ativos mantêm Usar, Editar, Duplicar e Arquivar e recebem Excluir permanentemente. Arquivados oferecem Visualizar, Restaurar e Excluir permanentemente. A prévia é somente leitura. A restauração altera apenas o estado e a versão de concorrência, preservando descrição, idioma, categoria, introdução, campos, opções e validações. Os cards e os estilos responsivos existentes são reutilizados; o CSS adicional fica restrito ao modal de exclusão.

A exclusão abre um modal com o nome do template, aviso de irreversibilidade e checkbox obrigatório. Apenas o botão final destrutivo é vermelho. Erros de dependência são apresentados dentro do modal e o template permanece listado. Sucesso atualiza listagens e contadores.

## Investigação das relações e segurança

O schema já contém `design_brief_template_metadata.status` com `active` e `archived`. Nenhuma migration é necessária ou foi criada/aplicada. A constatação se baseia no schema versionado; o banco de produção não foi acessado.

| Relação | Proteção existente / comportamento |
| --- | --- |
| `design_brief_templates` → metadados | FK `RESTRICT`; metadados removidos explicitamente somente quando não há uso |
| template → `design_brief_template_versions` | FK `RESTRICT`; versões removidas somente quando não há briefs vinculados |
| versão → `design_brief_instances` | FK composta `RESTRICT`; qualquer instância bloqueia exclusão, inclusive rascunhos e arquivados |
| instância → respostas, eventos | Registros comerciais preservados; nenhuma exclusão nessas tabelas |
| resposta → revisões e anexos | Histórico e anexos preservados; nenhuma exclusão nessas tabelas |
| briefs legados e endpoints antigos | Sem alterações; bloqueios de escrita antigos preservados |

O backend usa `assertSuperAdmin`, em conformidade com as permissões atuais do módulo. Perfis `admin`, `colaborador`, `cliente` e sessões ausentes não podem executar essas ações. Parâmetros exigem UUID válido. DELETE exige `expectedVersion` e `confirmation: "DELETE"`.

A exclusão bloqueia o template com `FOR UPDATE`, valida a versão e procura dependências dentro da mesma transação. A criação de instâncias e a edição de templates já usam o mesmo bloqueio do template. Somente metadados, versões sem uso e o template são removidos. Qualquer falha desfaz a transação. A violação de FK é convertida em mensagem de dependência compreensível. Nenhuma FK é alterada e nenhuma exclusão em cascata é adicionada.

Endpoints novos:

- `POST /api/briefs/templates/:templateId/restore`
- `DELETE /api/briefs/templates/:templateId`

## Arquivos da implementação

- `v2/apps/api/src/modules/brief-foundation/brief.repository.ts`: restauração e exclusão transacional.
- `v2/apps/api/src/modules/brief-foundation/brief.routes.ts`: endpoints autorizados e validados.
- `v2/apps/api/src/modules/brief-foundation/brief.schemas.ts`: confirmação explícita de DELETE.
- `v2/apps/web/src/api.ts`: chamadas de restauração e exclusão.
- `v2/apps/web/src/BriefFoundationWorkspace.tsx`: abas, contadores, ações, prévia e modal.
- `v2/apps/web/src/briefsDesign.css`: estilos restritos ao modal.
- `v2/apps/api/src/modules/brief-foundation/template-lifecycle.test.ts`: testes de transação, falhas e autorização HTTP.
- `v2/apps/web/tests/briefTemplateLifecycle.test.tsx`: testes das interações, contadores, confirmação e erros.
- `v2/apps/api/src/modules/brief-foundation/brief.mysql.test.ts`: quatro novos cenários SQL para homologação.
- `v2/apps/api/package.json`: inclusão dos novos testes na suíte padrão.

## Validação executada

Node **22.23.4**.

| Verificação | Resultado |
| --- | --- |
| Typecheck API e web (`npm run check`) | Passou |
| Builds API e web (`npm run build`) | Passaram; aviso existente de chunks grandes do Vite |
| Suíte completa incluindo os novos testes | **742 passaram, 0 falhas** |
| Novos testes de backend | 6 passaram, incluindo autorização HTTP sem abrir porta |
| Novos testes de interface | 7 passaram (teste principal e seis cenários) |
| `git diff --check` | Passou |
| SQL real / concorrência em MariaDB | **Pendente**: sandbox impediu abrir o socket do banco temporário (`EPERM`) |
| Inspeção visual desktop e celular | **Pendente**: navegador Playwright ausente; política do navegador integrado bloqueou prévia `file://` |

Os testes gerais foram executados com `node --import tsx --test` usando a lista da suíte `scripts.test`, pois o CLI `tsx` tenta abrir um socket IPC bloqueado pelo ambiente. Alguns testes existentes emitem erro não fatal de HMR do Vite também bloqueado por `EPERM`; o runner terminou com 742 aprovações e zero falhas.

Os quatro novos cenários SQL estão implementados e passam no typecheck, mas **não foram executados**: preservação ao arquivar/restaurar inclusive templates legados; exclusão física de templates sem uso; bloqueio para rascunhos/enviados/respondidos/arquivados preservando todo o detalhe; concorrência entre uso e exclusão. O teste SQL existente só aceita o socket local descartável `/tmp/briefs-mariadb-foundation/server.sock` e não carrega credenciais de produção.

O teste de interface usa React e JSDOM com respostas HTTP simuladas. Ele comprova as interações e o estado; não comprova renderização responsiva em navegador real. A estrutura e as media queries existentes foram preservadas, mas a homologação visual deve ser concluída em desktop e celular antes do merge.

## Limites de entrega

PR em rascunho até concluir as duas homologações pendentes. Sem merge, deploy, alteração na Hostinger ou acesso ao banco de produção. PR #54 não alterado. Alterações preexistentes do checkout original preservadas.
