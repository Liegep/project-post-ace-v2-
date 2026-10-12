# Radares — recuperação manual e Minas Home (fase 3)

Base: `main`, `e3ae8b6c6b9559556004a3475ba62424c49d6f4c` (PR #36 incorporado). Branch: `codex/radar-manual-recovery`.

## Bloqueio e reconstrução da fonte

O bloqueio é confirmado no código: `radar_source_runs` tem UNIQUE por cliente/fonte e o fluxo comum retorna `source_failed` para um registro com falha. Atualizar a validação não libera nem reexecuta uma fonte histórica.

Os três casos informados em produção são duas falhas da Kynagogi e uma da Patrícia, todas `invalid_response`. Não foram reprocessados. O código genérico histórico continua sem permitir atribuir a falha a um campo específico.

**O banco não contém dados suficientes para reconstruir essas descobertas:** o ledger guarda hash da identidade e contexto, status, IDs e timestamps; a telemetria da IA não guarda prompts ou outputs, e a auditoria MCP da criação é sanitizada. Quando a validação falha, nenhuma sugestão existe da qual recuperar título, URL e resumo. Um hash não permite reconstruir esses textos.

O fluxo novo exige que o Radar reenvie o pacote original e que um administrador o revise. O backend calcula a mesma identidade usada no Radar comum. Com URL, isso verifica a URL canônica; sem URL, verifica nome do Radar, título e data normalizados. **Não comprova o conteúdo original do resumo:** o operador deve conferir a fonte/conversa original. Se os dados não puderem ser recuperados com segurança, interromper; nunca adivinhar ou preencher uma notícia a partir do hash.

## Recuperação administrativa implementada

API interna, autenticada com token normal da aplicação, não com token MCP:

- `GET /api/clients/:clientId/radar-recovery`: até 100 falhas originais, metadados e histórico separado. Não chama IA. Mostra se as escritas estão habilitadas e exige reenvio da fonte.
- `POST /api/clients/:clientId/radar-recovery/:runId`: uma tentativa manual, com fonte completa, ID de solicitação, contagem esperada, revisão e consentimento explícitos.

O super admin ou um admin global com papel de admin no cliente pode usar a operação. Perfil de cliente, colaborador, usuário inativo e admin fora desse cliente são recusados. Autenticação existente é reutilizada; tokens MCP não autenticam a API normal. Não há ferramenta MCP de recuperação ou botão novo no Dashboard nesta entrega; é uma API para operação administrativa revisada.

Corpo estrutural de exemplo — **IDs/fonte sintéticos; não executar contra produção**:

```json
{
  "requestId": "33333333-3333-4333-8333-333333333333",
  "expectedAttempts": 0,
  "sourceReviewed": true,
  "aiConsent": true,
  "source": {
    "sourceTitle": "Título original da descoberta",
    "sourceSummary": "Resumo original recuperado e revisado pelo operador",
    "sourceUrl": "https://example.invalid/fonte",
    "sourceDate": "2026-10-07",
    "radarName": "Radar sintético"
  }
}
```

`sourceTitle` e `sourceSummary` são obrigatórios; URL/data podem ser nulos se assim eram os dados conhecidos. Não fabricar uma data. Datas usam YYYY-MM-DD ou ISO com fuso. Campos adicionais de força/retry são rejeitados. Consentimento administrativo é novo e registrado por tentativa; não transforma nem substitui o grant OAuth do Radar.

### Controles

- Falha original e sua telemetria permanecem intactas, inclusive código e timestamps. Novas tentativas usam `radar_recovery_attempts`; não se altera `radar_source_runs` para permitir retry.
- Reserva transacional: bloqueio do cliente e da fonte, conferência do hash, histórico, contagem esperada, orçamento e sugestões existentes. Transação termina antes da IA.
- Só `failed` é elegível. Originais `completed`, `processing` e `no_op` são recusados. Erros de acesso/desconhecidos exigem investigação; falhas corrigíveis conhecidas, inclusive `invalid_response`, são aceitas após revisão.
- Máximo **duas recuperações por fonte** (três execuções contando a original), espera de **15 minutos** entre recuperações e máximo de **dez recuperações por cliente em 24 horas**. Limites são fixos e também há CHECK/UNIQUE no schema proposto.
- Um cliente tem no máximo uma recuperação ativa. O bloqueio do cliente serializa orçamento/reservas entre usuários e processos; chamadas repetidas reutilizam o resultado pelo mesmo `requestId` e hash de dados.
- Novo `requestId` não ignora a contagem esperada, cooldown ou estado ativo. Reutilizar o ID com outros dados é conflito. Uma repetição de rede não paga novamente.
- A execução de IA é vinculada à tentativa **antes** da chamada ao provedor. Se esse vínculo falhar, nenhuma chamada paga ocorre.
- Finalização verifica cliente, tentativa ainda `processing`, fonte e sugestão existente. A inserção de sugestão e resolução da tentativa são transacionais. Sugestão existente durante a análise é reconciliada, sem criar outra pela recuperação.
- `finish` e `fail` operam sobre o ID da tentativa e seu estado; worker antigo não pode sobrescrever tentativa resolvida. Não existe takeover por idade. Tentativa presa em `processing` exige investigação/reconciliação em uma etapa separada.
- Commit seguido de erro de leitura é reconciliado antes de marcar falha. Persistência indisponível retorna estado não confirmado e exige consulta, em vez de tentar a IA novamente.
- Resultado claro: `created`, `existing`, `no_op`, `failed` ou `processing`, com mensagem, ID/contagem da tentativa e código seguro. Criação continua exclusivamente `pending`; não cria pauta, card ou publicação.

O histórico guarda hashes, IDs, ator, número, consentimento/revisão, contexto, estado, erro seguro, instantes e vínculo à execução de IA. Não guarda fonte/resumo completos, prompts, respostas brutas, termos proibidos ou credenciais. A validação atual do Brand Brain e o suporte a memória vazia do PR #36 são reutilizados.

**Contagens históricas permanecem históricas:** o ledger original pode continuar `failed` mesmo após recuperação concluída. O estado atual da recuperação vem do histórico novo. Uma sugestão recuperada é encontrada pela deduplicação do fluxo comum. Um `no_op` de recuperação é terminal no fluxo manual; não se apaga a falha original para liberar outras chamadas.

## Migration proposta — não executada

Arquivo: `v2/database/migrations/20261012_radar_recovery_attempts.sql`.

Justificativa: histórico de tentativas, idempotência da solicitação, limite por fonte e vínculo à IA precisam de persistência compartilhada entre processos; um contador em memória ou sobrescrever a falha original não atende esses requisitos.

A proposta cria somente a tabela nova, com PK, índices UNIQUE de fonte/número e fonte/solicitação, CHECKs e FKs. Não faz backfill, UPDATE ou reprocessamento de registros antigos. Não é executada pelo startup ou pelo deploy. **Antes de qualquer execução, justificar ambiente/escopo e solicitar aprovação explícita. Esta entrega não concede essa aprovação.**

`RADAR_RECOVERY_ENABLED=false` por padrão. Código pode ser entregue com escritas de recuperação desativadas. Depois de aprovação, validar a migration em MariaDB isolado, revisar compatibilidade/DDL/FKs e aplicação no ambiente correto. Somente após aprovação da aplicação e habilitação explícita a API aceita POSTs de recuperação. GET de histórico não depende de IA habilitada e permanece possível com escritas desligadas, se a tabela existir; tabela indisponível produz erro seguro.

Para desativar, desligar a flag e manter o histórico. Não excluir tentativas ou apagar o ledger para “desbloquear” fontes.

## Minas Home — evidência e limites

A conexão desta conversa lista e consulta o cliente **Minas Home**, ID `51de8960-64c5-45a4-a094-a58076a1285b`, slug `minas-home`. Existe também **Minas Home ADS**, com ID distinto; não intercambiar os clientes.

A leitura atual confirma seis pilares com nomes de 155, 130, 130, 140, 171 e 163 caracteres e 68 entradas editoriais. Os conteúdos privados não foram copiados para fixtures/relatório. O PR #36 em `main` mantém nomes completos e valida as 68 regras; os testes representativos continuam na suíte. Não foi verificado o commit atualmente implantado no servidor.

O relato de produção informa zero execuções nos dois ledgers da Minas Home. Isso **não confirma falha da IA**. Uma rejeição da saída da IA depois de `beginRun` normalmente deixaria telemetria. São compatíveis com ausência de registros:

- Radar não chamou `create_radar_suggestion` ou trabalhou em outra conta/ambiente.
- Ferramenta não registrada nessa conexão por falta de `pauta:create` ou consentimento interno. `radar:suggest` sozinho não substitui `pauta:create`.
- Token inválido/expirado, conta sem acesso ativo de super admin ao transporte MCP ou limite de consultas; falhas antes do callback não necessariamente geram auditoria de ferramenta.
- Dados recusados pelo schema SDK antes do callback; auditoria por cliente pode não conseguir atribuir esse evento.
- IA desativada/sem chave, erro de leitura do contexto/versões ou falha de armazenamento antes de reservar a fonte.
- Fonte já existente em `radar_suggestions`, criada por outro fluxo, retornada sem nova execução da IA.

**A causa específica ainda não foi confirmada.** Faltam os metadados da sessão OAuth realmente usada pelo Radar da Minas Home, sua chamada efetiva/horário e auditoria sanitizada dessa sessão. A conexão desta conversa não prova o grant de outra sessão. A conversa específica do Radar não foi identificada com segurança na listagem recente do aplicativo; títulos de outros chats não foram usados como prova de configuração. Nenhum token de outra sessão foi solicitado ou inspecionado.

### Diagnóstico seguro novo no MCP

`get_radar_connection_status({clientId})` é somente leitura: identifica o cliente, scopes relevantes da requisição atual, consentimento, disponibilidade da ferramenta, configuração de IA e presença/visibilidade das quatro tabelas existentes necessárias. Retorna contagens de pilares/regras, sem seus textos. Não testa o provedor nem permissão de escrita no banco. Erros de armazenamento são sanitizados.

`validate_radar_source({clientId,source})` aceita o mesmo pacote de fonte, valida o schema e normalização e devolve hash/estado da conexão. Não insere fonte, sugestão ou execução de IA. Grava apenas auditoria sanitizada de validação, com cliente/hash/resultado/código conhecido, nunca o pacote original. `mode='validation_only'`, `providerTested=false` e `sourceSubmitted=false` distinguem esse teste da criação.

### Procedimento objetivo no próprio Radar da Minas Home

Após deploy **aprovado** deste PR, inicialmente sem habilitar recuperações:

1. Na mesma conexão usada pelo Radar, listar ferramentas e chamar `list_clients`. Confirmar o ID de Minas Home, não Minas Home ADS. Confirmar que aparecem os dois diagnósticos novos. Se o catálogo estiver desatualizado, verificar sua atualização com o operador da integração.
2. Chamar `get_radar_connection_status` para esse ID. Registrar somente os campos de estado. `planningReadGranted`, `pautaCreateGranted`, `radarAiConsent`, `creationToolAvailable`, `aiEnabled` e `requiredTablesPresent` devem ser verdadeiros para prontidão. `missingStorage` identifica tabelas ausentes/não visíveis pela conexão de banco.
3. Se falta scope/consentimento, refazer autorização OAuth com `planning:read pauta:create`, usando a conta de super admin ativa exigida pelo transporte MCP atual e marcando “Autorizo sugestões do Radar com uso de IA.” Refresh não eleva permissões nem inventa consentimento. Se há 401/403/429, resolver transporte/conta/limite antes de investigar o modelo.
4. Reenviar uma descoberta original **somente para** `validate_radar_source`. Exigir chamada real da ferramenta, não apenas uma resposta textual dizendo que foi enviada. Confirmar `sourceValid=true`, hash e `canSubmit`. Se `invalid_input`, corrigir tipos, campos, limites e data; não simplificar o schema para aceitar dados incorretos.
5. Comparar a chamada/horário e metadados com `mcp_audit_log`. Falha em `validate_radar_source` é pré-análise; não interpretar como rejeição da IA. Esse teste não deve criar linhas nos ledgers/sugestões. `canSubmit` indica gates de configuração, não relevância editorial, ausência de duplicação ou saúde real do provedor.
6. Um teste completo de criação com IA só será feito em outra etapa, com **nova autorização explícita para custo e criação real**, usando uma fonte verificada e a mesma conexão. Não foi executado nesta fase. Não usar as três fontes históricas como teste comum; elas exigem a API administrativa.

## Como usar a recuperação depois do deploy

1. Aprovar código/deploy e, separadamente, a execução da migration no ambiente escolhido. Validar SQL/concorrência em MariaDB isolado antes de ativar em produção. Não há execução automática desses passos.
2. Aplicar a migration somente após aprovação, consultar o histórico em leitura e habilitar `RADAR_RECOVERY_ENABLED` explicitamente quando autorizado. Isso não reprocessa nenhum registro.
3. Administrador consulta as falhas do cliente. Radar reenvia os dados originais; validação sem IA ajuda a comparar o hash com a falha correta. Se faltar a fonte/resumo seguro, parar.
4. Operador revisa identidade e conteúdo, obtém autorização para uma chamada de IA e envia um POST administrativo com consentimento, novo UUID de solicitação e `expectedAttempts` igual à quantidade de recuperações do histórico (zero na primeira).
5. Guardar o UUID. Em erro de rede, consultar histórico ou repetir **o mesmo UUID e pacote**, sem criar outra tentativa. `processing` não autoriza um novo POST com outro ID.
6. Rever a sugestão pendente se criada; encerrar se `no_op`. Em nova falha, ler o código e corrigir a causa. Outra recuperação exige nova revisão/consentimento, novo UUID, contagem atual e espera de 15 minutos; máximo duas.

## Validação desta entrega

Fixtures e provedores sintéticos; SDK MCP em memória e conexões falsas de repositório. Cobertura: reserva/concorrência, replay e conflito de payload, preservação da falha original, limites/cooldown/orçamento, clientes e consentimento, estados terminais, validação atual, fonte reenviada, sugestão surgida durante a análise, vínculo antes da IA, commit ambíguo, falha ao registrar erro e privacidade.

Inclui testes do diagnóstico da Minas Home (seis pilares longos/68 regras sintéticas), falta de scope/consentimento/chave/tabelas, validação de envio e sanitização da auditoria. As regressões do PR #36 permanecem.

Executados em `v2/`, Node 22.23.3:

- `npm --workspace @design-hub-v2/api test`: **628 passaram**, sem falhas, skip ou TODO; 28 testes adicionais.
- `npm run check`: API/web aprovados.
- `npm run build`: API/web aprovados; permanece o aviso existente de chunks grandes.
- `git diff --check`.

**Nenhuma migration foi executada, nem mesmo para estes testes.** O SQL proposto foi inspecionado/testado estaticamente; as transações são exercitadas por conexões falsas. Compatibilidade e concorrência no engine MariaDB real precisam de validação após aprovação explícita da execução em ambiente isolado. Os testes simulados não são prova de execução da migration ou do estado de outra sessão em produção.

Nenhum dado real de cliente foi modificado; nenhuma sugestão real, recuperação histórica ou chamada paga à IA foi realizada. Sem merge/deploy nesta fase.
