# PR #55 — proposta separada de persistência e implantação

**Somente proposta para revisão. Não autoriza execução em produção.** Nenhuma alteração de produção, Hostinger, merge, deploy ou reinício foi realizada.

A resposta perdida exige uma chave única durável. A proposta cria `card_transfer_operations`, com usuário, origem, destino, coluna, modo, impressão da versão da origem, estado e destino criado. Não armazena legenda, arquivos, tokens de aprovação ou credenciais Meta. O hash detecta alterações da origem; **não deduplica conteúdo**. Chaves novas permitem cópias idênticas legítimas.

[SQL proposto](../v2/database/proposals/20261029_card_transfer_operations.sql). Não foi incluído no bootstrap, schema-base ou startup. Foi executado somente no banco local descartável. A tabela e os cartões devem usar InnoDB. Não há FK para cartões: excluir um cartão não pode apagar a deduplicação. Reservas encerradas também permanecem.

## Sequência futura, mediante autorização separada

1. Revisar o SQL, backup, permissões, versão real do banco e impacto. Confirmar o banco V2 correto e ausência de tabela homônima incompatível. Nada disso foi inspecionado em produção. Programar janela e limitar a espera por locks de metadados na sessão operacional; abortar em timeout.
2. Manter `CARD_TRANSFERS_ENABLED=false`. Aplicar explicitamente o SQL aprovado. É uma tabela nova, sem reescrever cartões. `CREATE TABLE` sem `IF NOT EXISTS` falha se houver tabela homônima, evitando esconder divergências.
3. Conferir colunas, chave primária exclusiva, índice, engine, privilégios de leitura/escrita e preservação dos cartões existentes. O guard da API recusa tabela/chave primária/engine ausentes, mas não substitui a conferência integral do DDL aprovado.
4. Disponibilizar API/frontend compatíveis em procedimento autorizado. Não há fallback para criar/excluir por chamadas independentes. Drenar versões antigas e exigir recarga de abas antigas: o endpoint genérico de criar cartões continua necessário e não identifica cópias enviadas por um frontend antigo.
5. Somente então habilitar `CARD_TRANSFERS_ENABLED=true` e executar smoke tests sintéticos: chave repetida, resposta perdida, nova chave, acesso revogado e rollback de Mover. A flag é lida da configuração do processo; nenhuma alteração operacional ou reinício necessário foi realizado neste trabalho.

## Recuperação e contingência

A reserva é persistida antes da criação. A execução bloqueia a chave e grava criação, eventual exclusão e resultado na mesma transação. Falha antes do commit deixa a reserva pendente, sem destino parcial. Commit com resposta perdida deixa o resultado concluído, consultável pelo histórico. Retomar usa a mesma chave. Encerrar uma reserva é serializado com a execução; se ela já concluiu, retorna o resultado concluído. Repetir uma operação concluída nunca recria um destino apagado posteriormente.

Na contingência, desabilitar a flag e preservar tabela, resultados e cartões. Após corrigir a causa, reabilitar a implementação idempotente para consultar/retomar as chaves existentes. Não voltar ao fluxo antigo, limpar a tabela ou gerar outra chave para operação incerta. Não remover a tabela em rollback. A retenção deve durar enquanto chaves puderem ser repetidas; expurgo exige outro projeto de garantia de não repetição. Restaurar backup antigo sem conciliação também pode desfazer deduplicação.

## Limites

O histórico é restrito ao mesmo usuário autenticado e aos clientes ainda autorizados; nova sessão do mesmo usuário funciona. Outro usuário não reutiliza a chave alheia. Origem alterada exige encerrar a reserva e revisar uma nova operação. Mover cartões com publicação Meta vinculada ou aprovação ativa retorna conflito; copiar continua disponível. O ensaio não certifica infraestrutura, durabilidade real, backup ou failover. Publicação e ativação dependem da aprovação e execução deste plano.
