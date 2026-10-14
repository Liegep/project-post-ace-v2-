# Briefing editorial global — Radar → Pautas → Aprovação

Base: `main`, `e289a7be443d75aa69a5e45fd4f6ec199a901946`. Branch: `codex/radar-editorial-brief`.

## Diagnóstico

O MCP já recebe `sourceSummary`, mas o serviço original usa o texto somente na análise e não o copia para `radar_suggestions`. A tabela original também não tem coluna para ele. O resumo factual ausente não pode ser reconstruído a partir do conceito, do hash ou de uma nova resposta da IA.

`RadarSuggestionsRepository.resolve()` preservava título, descrição, legenda, formato, objetivo e parte da referência. Conceito, gancho, justificativa e data da fonte eram perdidos na conversão. O envio do Banco de Pautas transformava somente título e legenda/descrição em card e não levava o briefing ao portal ou ao link público. Criar o card e vincular a pauta eram duas operações separadas.

A consulta autorizada da Patrícia, pelo MCP desta conversa, localizou duas pautas enviadas para aprovação. Ambas têm título, descrição, legenda, objetivo, título da fonte e URL no banco; ambas não têm conceito, gancho, justificativa, resumo factual ou data da fonte. Foi consultada somente a presença dos campos, sem copiar os textos privados para fixtures ou este relatório. A ferramenta de resumo do card confirma título/status, mas **não expõe o texto do portal**: não se afirma uma inspeção direta da apresentação atual do cliente. Pelo código de envio, apenas título e legenda (com fallback para descrição) são copiados para o card. Nenhum registro real foi alterado.

## Comportamento global

Não há branch, regra, ID ou condição por cliente. Clientes atuais e futuros utilizam os mesmos schemas, repositórios, endpoint e componente visual.

1. O resumo factual vem exclusivamente do pacote enviado pelo Radar. A criação comum e a recuperação manual preservam esse mesmo campo, separado do conteúdo gerado. Ausência continua ausência.
2. A sugestão guarda `source_summary` junto aos campos editoriais existentes. Aceitar copia conceito, gancho, descrição, justificativa, objetivo, CTA, legenda e referência completa para uma pauta nova. Os indicadores/modelo/evidências do Brand Brain continuam internos no banco de pautas.
3. O envio usa `POST /api/clients/:clientAccountId/workspace-drawer/pauta-ideas/:ideaId/send`. Reutiliza autenticação e acesso de admin/colaborador ao cliente. Lê a pauta armazenada, bloqueia o cliente e cria o card com briefing e vínculo em **uma transação**. O navegador não fornece o briefing a ser enviado. Repetição com a pauta já vinculada retorna o mesmo card, sem substituí-lo.
4. `editorial_brief_json` contém somente campos destinados ao cliente: conceito, gancho, descrição, justificativa editorial, objetivo, CTA, título/resumo/URL/data da fonte. Não inclui notas internas, pilares, alinhamento, modelo, hashes, versão ou evidências estratégicas. A leitura aplica a mesma lista explícita; URLs inválidas ou com credenciais não são expostas como links.
5. O portal e o link público usam `EditorialBrief`. Campos ausentes não criam blocos vazios; textos exatamente iguais à legenda ou a outro campo aparecem uma vez. O título fica no cabeçalho existente. A referência tem link seguro em nova aba e data somente quando válida/disponível. Não há HTML bruto vindo do Radar.
6. O detalhe interno oferece prévia do briefing no editor de pauta. O detalhe da sugestão também mostra o resumo factual quando disponível. O histórico de aprovação guarda o briefing no snapshot já existente do card; a interface oferece “Briefing desta revisão”. Uma revisão posterior não altera snapshots anteriores.

## Compatibilidade e proteção

- Pautas manuais não precisam ter dados de Radar. São enviados apenas os campos realmente disponíveis. Cards antigos sem briefing continuam exibindo sua legenda normalmente.
- Uma sugestão já aceita retorna a pauta existente; não há complementação automática ou substituição por replay.
- Nenhum backfill altera pautas/card/histórico já enviados ou aprovados. Se o dado foi perdido antes, ele permanece ausente. Dados conhecidos em uma pauta antiga ainda em rascunho são usados quando ela for enviada explicitamente.
- Conteúdo de pautas marcadas como aprovadas não pode ser substituído/resetado pelo editor do banco; manutenção do vínculo é permitida. Alterações de briefing do card recusam estado aprovado e usam a proteção de revisão atual, inclusive em uma corrida com a decisão do cliente. Os ciclos existentes de reabertura/decisão permanecem.
- O fluxo de envio não cria cards de outra conta nem modifica cards existentes. Pauta marcada como enviada/aprovada sem vínculo exige revisão, em vez de gerar automaticamente outra cópia.
- As edições explícitas e o ciclo de revisão de cards existentes continuam separados da preservação automática dos dados. Uma falha de rede exige repetir a operação/consultar o vínculo; não há repetição de IA.

## Migration proposta — não executada

`v2/database/migrations/20261014_radar_editorial_brief.sql` adiciona duas colunas opcionais:

- `radar_suggestions.source_summary MEDIUMTEXT NULL`;
- `kanban_cards.editorial_brief_json JSON NULL`.

São necessárias para preservar o input factual e um snapshot do conteúdo enviado sem misturá-los à legenda, às notas internas ou aos dados estratégicos. O schema de criação de bancos novos inclui o campo do card. A migration é aditiva, sem UPDATE, backfill, mudanças de FK ou execução automática. **Não foi executada, nem em MariaDB de teste.** Fixtures SQL em memória e mocks verificaram a aplicação; não são prova de execução desse DDL em MariaDB.

A aplicação da migration requer aprovação separada e validação isolada antes de produção. As colunas devem existir **antes de ativar este código no ambiente**, pois as consultas passam a referenciá-las. Merge/deploy e migration continuam não autorizados. A presença de `IF NOT EXISTS` permite repetição, mas não substitui conferir tipos/estado do schema autorizado. Reverter o código mantendo os campos opcionais preserva os dados; não apagar colunas/histórico.

## Validação

Node 22.23.3; todos os arquivos de `scripts.test` da API, incluindo testes web, com `--test-concurrency=2`:

- **645 testes passaram**, zero falhas/skip/TODO; 17 regressões adicionais.
- Typecheck API/web aprovado.
- Build API/web aprovado, com o aviso existente de chunks maiores que 500 kB.
- `git diff --check` aprovado.
- Renderização visual local do componente com conteúdo inteiramente sintético; sem conexão à API de produção.

Cobertura nova: retenção na aceitação, metadados legados nulos, input factual na entrada MCP/recuperação, whitelist e URLs, consistência card/snapshot, proteção de aprovação, edição da pauta aprovada, envio transacional e rollback, resultado ambíguo com replay, isolamento por cliente, pauta manual, ausência de reconstrução, deduplicação visual, escape HTML, datas e renderização histórica.

Nenhuma geração real de IA, sugestão real, aprovação real, migration, merge ou deploy foi executado. A leitura da Patrícia é diagnóstico, não implementação específica ou reparação de registros históricos.
