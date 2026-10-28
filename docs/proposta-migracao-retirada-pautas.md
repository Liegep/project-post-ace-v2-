# Proposta MariaDB — retirada de pautas (aguarda aprovação)

**Não executada em produção. Aprovação separada obrigatória antes da aplicação.**

Adicionar uma coluna anulável, sem exclusões ou backfill:

```sql
ALTER TABLE kanban_cards ADD COLUMN brief_withdrawn_at DATETIME(3) NULL;
```

Arquivo: `v2/database/migrations/20261028_brief_withdrawal.sql`. O schema de instalações novas foi atualizado em `v2/apps/api/db/schema.sql`. O código não adiciona essa coluna automaticamente no startup.

`NULL` preserva o comportamento atual de todos os registros. Uma data indica retirada. O campo fica fora dos schemas de edição comum. Não modifica enum, arquivos, registros de aprovação, agenda ou tabelas Meta.

## Procedimento proposto após aprovação

1. Confirmar versão MariaDB e banco de destino, inspecionar `SHOW COLUMNS FROM kanban_cards LIKE 'brief_withdrawn_at'` e obter backup verificado de acordo com o procedimento operacional. Se a coluna já existir, validar seu tipo e não repetir o ALTER.
2. Executar primeiro em staging aprovado. Planejar janela para o bloqueio de metadados; validar suporte de DDL online da versão instalada antes de prometer ausência de bloqueio.
3. Executar o ALTER uma vez e verificar que a coluna existe e todos os registros antigos continuam com `NULL`.
4. Validar envio → retirada → detalhes/busca/arquivados/links indisponíveis → reabrir aplicativo → reenvio. Conferir histórico e referências de arquivos. Confirmar que cards comuns e publicação Meta continuam iguais.
5. Somente com autorizações de migração e deploy: aplicar a coluna em produção antes de disponibilizar a nova API/frontend. Não disponibilizar este código contra um banco sem a coluna: as consultas a cards a exigem.

## Retorno seguro

Não remover a coluna ou seus valores. Após começar a usar retiradas, reverter somente o código para uma versão antiga reexporia essas pautas, pois a versão antiga ignora a barreira. Em falha, manter a proteção de leitura e bloquear temporariamente a função ou corrigir adiante; qualquer rollback operacional requer plano específico que preserve a invisibilidade. Nenhuma reversão automática ou DROP acompanha o PR.
