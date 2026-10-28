# PR #54 — proposta de migração e implantação (aprovação separada pendente)

**Este documento é um procedimento futuro. Não autoriza acesso a produção, migração, merge, deploy, reinício de serviços ou mudança na Hostinger. Nenhuma dessas ações foi executada nesta validação.**

## Suficiência do esquema

`kanban_cards.brief_withdrawn_at DATETIME(3) NULL` é suficiente como barreira persistente de visibilidade: `NULL` mantém o comportamento anterior e uma data bloqueia a pauta no Portal. O campo não está nos schemas de atualização comum. Retirada e reenvio usam bloqueio da linha e `approval_revision`, já existente; o histórico usa `card_approval_events` e comentários já existentes. Não é necessário apagar conteúdo, criar outro estado de aprovação ou adicionar índice para estas consultas, que já listavam os cards do cliente antes de filtrar a visibilidade. A data não é usada para ordenar decisões: a revisão é a referência de concorrência.

Pré-requisitos: schema atual com `approval_revision`, `approval_state`, `approval_links` e `card_approval_events`, tabelas transacionais InnoDB e código do ciclo de aprovação na base deste PR. Não aplicar esta coluna como substituto de migrações anteriores ausentes.

O arquivo `v2/database/migrations/20261028_brief_withdrawal.sql` propõe:

```sql
SET SESSION lock_wait_timeout = 5;
ALTER TABLE kanban_cards
  ADD COLUMN brief_withdrawn_at DATETIME(3) NULL,
  ALGORITHM=INSTANT, LOCK=NONE;
```

A execução exige suporte confirmado a `INSTANT` e `NONE` na versão e nas características da tabela de destino. Não retirar essas opções para forçar uma reconstrução, nem usar fallback `COPY`. Mesmo DDL instantâneo precisa de bloqueio de metadados; o timeout evita espera indefinida. Em timeout, interromper a implantação, identificar transações longas e reprogramar a janela com aprovação; não matar sessões de produção automaticamente.

Validado **somente em MariaDB 10.11.19 local descartável**, com registros sintéticos existentes: um bloqueio concorrente causou timeout, a coluna continuou ausente e os registros foram preservados; após liberar a transação de teste, o mesmo ALTER foi aplicado com sucesso, preservando linhas e preenchendo a nova coluna com `NULL`. Isso não confirma a versão, o volume, a replicação ou os privilégios do banco de produção, que não foi acessado.

## Checklist anterior à aplicação — exige nova autorização

- [ ] Aprovar o SHA final do PR e o plano de migração; registrar responsáveis e janela. O PR permanece em rascunho até decisão humana sobre os resultados.
- [ ] Identificar staging realmente isolado, com domínio, banco, usuário, uploads e segredos próprios. Usar apenas fixtures sintéticas; não importar clientes reais. Se ausente, usar o roteiro local descrito no relatório, sem criar infraestrutura.
- [ ] Confirmar administrativamente a identidade do destino; somente após autorização de acesso consultar `SELECT VERSION(), DATABASE(), @@hostname, @@port, @@server_id;` e `SHOW CREATE TABLE kanban_cards;`. Não deduzir isolamento apenas do nome do banco ou domínio.
- [ ] Confirmar InnoDB, versão/recursos DDL, schema prévio, privilégios, espaço, transações longas e, se aplicável, replicação/replica lag. Falta de informação bloqueia a aplicação.
- [ ] Preparar release imutável com Node 22, dependências do lockfile e artefatos deste SHA; executar `npm ci --ignore-scripts`, `npm run check`, `npm run build` e os testes pertinentes em ambiente autorizado. Nenhuma chave Meta, SMTP ou OpenAI deve ser usada no ensaio local.
- [ ] Registrar versão em execução, artefatos e procedimento operacional de manutenção/drain. Não liberar a retirada enquanto houver instâncias antigas atendendo o Portal: elas ignoram a nova coluna.

## Checklist de backup — não executado em produção

- [ ] Confirmar backup completo e recente, criptografado, com retenção, destino protegido, checksum e responsável pela recuperação. Não incluir senhas em comandos, logs ou no PR.
- [ ] Garantir consistência entre banco e uploads na janela autorizada: snapshot consistente InnoDB e inventário/backup dos arquivos, mantendo as gravações pausadas conforme o procedimento operacional aprovado.
- [ ] Incluir `kanban_cards`, `client_accounts.workspace_drawer_json`, `approval_links`, `card_approval_events`, comentários, versões de legenda, vínculos de anexos e demais tabelas relacionadas. Não fazer backup parcial apenas da nova coluna.
- [ ] Registrar contagens, identidade do banco, horário UTC e manifestos antes da alteração. Verificar integridade e legibilidade do backup. Ensaios locais usam backup sintético; **não restaurar dados reais em staging/teste**.
- [ ] Definir RPO/RTO e como preservar retiradas/encerramentos de links posteriores ao backup. Restaurar backup antigo pode reexpor pautas: a recuperação deve permanecer inacessível aos clientes até conferir o estado mais recente.

## Aplicação e validação — somente após autorizações de migração e deploy

1. Ativar a manutenção/drain aprovado, inclusive para APIs diretas e links públicos. Pausar novas retiradas e decisões; confirmar ausência de instâncias antigas que possam voltar a servir o Portal durante a transição.
2. No banco de destino previamente identificado, consultar `SHOW COLUMNS FROM kanban_cards LIKE 'brief_withdrawn_at';`. Se a coluna existir, verificar tipo `datetime(3)`, nulabilidade e valores; não repetir o ALTER nem zerar valores. Se houver divergência, parar.
3. Registrar contagem de cards; aplicar o arquivo SQL uma vez. Um timeout ou recurso não suportado bloqueia o avanço. Não fazer fallback automático. O DDL faz commit implícito: `ROLLBACK` não é reversão de esquema.
4. Verificar o tipo/nulabilidade; em primeira aplicação, conferir que todas as linhas anteriores continuam presentes e com `NULL`. Não fazer `UPDATE` de backfill. Preservar qualquer valor existente de retirada.
5. Somente então disponibilizar API e frontend do SHA aprovado pelo procedimento de deploy autorizado. Nunca executar este código contra banco sem a coluna: a consulta de cards depende dela. Confirmar todas as instâncias atualizadas, invalidar/drainar versões antigas e conferir assets e autorização nas rotas.
6. Com uma conta sintética autorizada, validar login interno/cliente, criação/envio, retirada, Portal, busca, arquivados, aprovados, detalhes/comentários por URL e links públicos; recarregar e reenviar. Conferir conteúdo, hash de arquivo de teste, eventos, comentários e invalidação de tokens antigos. Conferir um card comum e os registros de agendamento Meta sem publicar.
7. Conferir erros da API, conflitos esperados de revisão, conexões/locks e desempenho. Não ativar workers extras nem executar publicação Meta como teste desta mudança.
8. Encerrar a manutenção somente após as verificações e autorização operacional. Registrar horários, SHA, verificações e responsáveis; manter o histórico de retirada e backups.

## Contingência que preserva a invisibilidade

- Antes de haver retiradas, falha do ALTER ou da preparação bloqueia o deploy; não alterar dados para contornar a falha.
- Depois de existir qualquer retirada, **não reverter para API antiga que ignora a coluna**, não remover a coluna e não redefinir datas para `NULL`.
- Em falha funcional, bloquear temporariamente o Portal e os endpoints públicos/diretos no mecanismo operacional aprovado; manter a proteção de leitura da versão nova e corrigir adiante. Não presumir que ocultar o botão no frontend bloqueia a API.
- Uma reversão de código só é aceitável para uma versão de contingência previamente revisada que já respeite a barreira em todas as leituras e ações. Sem essa versão, permanecer em manutenção.
- Se for necessário restaurar banco/arquivos, restaurar apenas no destino de recuperação expressamente autorizado. Manter o acesso do cliente bloqueado até reconciliar as retiradas e os tokens encerrados mais recentes com o histórico confiável. Se esse estado não puder ser reconstruído com segurança, não reabrir o Portal.
- Nenhuma contingência permite excluir pautas/arquivos ou alterar agendamentos/publicação Meta para esconder conteúdo. Toda operação em produção continua exigindo autorização própria.
