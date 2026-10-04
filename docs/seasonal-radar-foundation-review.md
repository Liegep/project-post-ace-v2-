# Fundação persistente do Radar — revisão antes de deploy

Branch: `codex/seasonal-radar-foundation`.

Implementação na V2. Não houve push, merge, deploy, conexão de escrita com produção nem execução de migração de legado. O checkout já continha alterações de outras tarefas, preservadas. O commit do Radar foi preparado em worktree isolada para incluir somente esta fundação e sua validação.

## Schema proposto

Migração: `v2/database/migrations/20261004_seasonal_radar_foundation.sql`.
O mesmo SQL está anexado aos dois schemas de referência: `v2/apps/api/db/schema.sql` e `v2/database/schema.sql`.

| Tabela | Finalidade |
|---|---|
| `seasonal_workspaces` | Identidade da operação; a arquitetura atual tem uma operação por banco |
| `seasonal_monitored_countries` | Código ISO, ativo/inativo, criação/atualização, chave por operação/país |
| `client_editorial_markets` | N:N cliente/país, ativo/inativo, usuário que confirmou, timestamps |
| `seasonal_categories` | Categorias expansíveis; quatro registros iniciais preservados |
| `seasonal_opportunities` | UUID independente, título, descrição, categoria, origem, abrangência |
| `seasonal_opportunity_countries` | Um ou vários países por oportunidade |
| `seasonal_occurrences` | UUID independente, oportunidade, data concreta, ano derivado da data e proveniência externa opcional |

A migração é aditiva: cria somente tabelas novas e sementes de operação/categorias, sem atualizar ou excluir registros anteriores. `INSERT IGNORE` não substitui sementes já existentes. Não há DDL de radar no startup da API. A migração deve ser aplicada explicitamente somente após revisão.

Não se persiste catálogo mundial. O backend valida e fornece o conjunto completo de 249 códigos ISO 3166-1 alpha-2, como snapshot de `iso3166.tab` do IANA tzdb (domínio público), independente de Nager.Date. O frontend localiza com `Intl.DisplayNames`. Não existem seleções de países padrão nem fallback limitado a mercados atuais. A seleção antiga no `localStorage` não é apagada nem importada automaticamente: a configuração compartilhada começa vazia e os países devem ser confirmados no novo gerenciador. Atualizações futuras do padrão ISO exigem atualização do dataset, não mudanças em regras de negócio.

O identificador `operation` é resolvido no servidor, nunca a partir de um workspace enviado pelo usuário. Todos os usuários internos da operação leem a configuração compartilhada; administradores a configuram. Uma futura arquitetura com múltiplas operações por banco terá que resolver o workspace a partir da autenticação; a tabela não concede isolamento multitenant sozinha.

## Histórico e integridade

- Remover monitoramento faz upsert com `active = 0`; reativar preserva o mesmo registro e sua criação.
- Confirmar mercados exige `confirmed: true`. Substituições desativam relações antigas, sem excluí-las.
- Nenhuma associação vem de idioma, endereço ou país fiscal. Clientes existentes começam sem mercados editoriais.
- Países aceitos são validados no backend; nomes traduzidos são apenas apresentação.
- Identidades de oportunidades e ocorrências são UUIDs, sem unicidade por título/país/dia.
- Global não recebe países; abrangência por países exige pelo menos um. Essa consistência e subconjuntos de ocorrências são validados pela API.
- Uma ocorrência pode restringir os países da oportunidade, permitindo datas diferentes por mercado sem duplicar a oportunidade.
- O ano é derivado pelo banco da data, evitando divergências.
- Cadastro de oportunidade, abrangências e ocorrências ocorre em uma transação. Confirmações de mercados bloqueiam a conta do cliente para serializar gravações concorrentes.
- As novas relações usam `ON DELETE RESTRICT` para preservar histórico. Isso impede exclusão física de clientes/usuários referenciados por mercados confirmados; um futuro fluxo de exclusão deverá arquivar/desativar esses registros explicitamente.

## API

Todos os endpoints exigem sessão interna. As operações de configuração exigem administrador/superadministrador. Mercados de clientes também verificam acesso à conta; gravação exige papel de administrador nessa conta. Candidatos relacionados respeitam o escopo de clientes do usuário.

| Método | Endpoint | Uso |
|---|---|---|
| GET | `/api/seasonal/countries` | Diretório ISO completo |
| GET | `/api/seasonal/monitored-countries` | Todos os registros ativos/inativos e hoje no fuso da operação |
| PUT | `/api/seasonal/monitored-countries/:countryCode` | `{ active: boolean }` |
| GET / POST | `/api/seasonal/categories` | Listar ou criar/atualizar categoria por código |
| GET | `/api/clients/:clientId/editorial-markets` | Relações editoriais, incluindo inativas |
| PUT | `/api/clients/:clientId/editorial-markets` | `{ countryCodes: [...], confirmed: true }` |
| POST | `/api/seasonal/opportunities` | Criar oportunidade, abrangências e uma ou mais ocorrências |
| GET | `/api/seasonal/radar` | Intervalo, filtros, paginação e candidatos com mercados relacionados |

Exemplo de oportunidade internacional (exemplo de payload, não dado semeado):

```json
{
  "title": "Dia internacional de exemplo",
  "description": "Descrição editorial",
  "categoryCode": "cultural",
  "origin": "manual",
  "scope": "global",
  "countryCodes": [],
  "occurrences": [{ "date": "2027-01-01" }]
}
```

Para multipaís: `scope: "countries"`, `countryCodes: ["BR", "SE"]`. Várias ocorrências podem conter subconjuntos desses países. Categorias não são enum e podem ser criadas pela API.

A interface mínima oferece configuração, confirmação de mercados, cadastro de oportunidade com uma ocorrência e filtros. O modelo/API permitem várias ocorrências, mas edição e novas ocorrências em oportunidade existente ficam para a próxima etapa. O redesign editorial completo foi adiado.

## Feriados externos

Decisão desta etapa: normalizar Nager.Date no serviço sem persistência automática. Há cache transitório de uma hora, coalescência de consultas iguais, timeout por requisição e concorrência limitada. Falhas são retornadas por país/ano; países sem cobertura continuam válidos e suas datas próprias permanecem utilizáveis.

`global` é convertido em `regionalScope.nationwide`, nunca em abrangência mundial. Subdivisões recebidas são preservadas. Datas regionais não recebem clientes automaticamente, porque ainda não existe relação explícita de região editorial do cliente.

A normalização gera uma referência transitória por fingerprint do payload completo. Isso não é uma identidade persistida de oportunidade nem uma chave por nome/país/dia. Duplicatas de payload exatamente igual são removidas somente dentro da resposta do provedor; eventos distintos não são colapsados.

Para histórico externo futuro, o schema já comporta origem, referência, payload e informação regional. Um importador explícito poderá gerar UUIDs e arquivar ocorrências. Hoje a aplicação não promete histórico imutável dos dados do provedor e não tenta unificar eventos internacionais por semelhança de nome.

## Datas, filtros e pautas

A API usa datas de calendário e o `APP_TIMEZONE` existente para definir hoje. Diferenças usam dias UTC de datas sem horário, evitando meio-dia, DST e deriva de fuso. O frontend exibe **Hoje**, **Amanhã**, **Em N dias** ou indicação de passado.

O intervalo inclusivo é limitado a 367 dias e consulta todos os anos envolvidos. A página começa em hoje + 90 dias e pagina em 50 ocorrências, sem truncamento de 24. Filtros de país/categoria/cliente são aplicados ao resultado unificado antes da paginação. Datas globais continuam visíveis independentemente dos países monitorados. O filtro por cliente usa apenas mercados confirmados; se faltam, não inventa associação.

O dashboard mantém a janela existente de aviso em quatro dias, agora calculada corretamente e usando a configuração persistente. A criação de pauta reutiliza `createAdminCardBySlug` e gera card pendente para aprovação. `createPautaFromSeasonalOccurrence` recebe a ocorrência inteira (com IDs e proveniência) para permitir vínculo futuro; não grava esse vínculo agora nem afirma rastreamento de conversão persistente.

## Futuro legado — não executado

Não há leitura, atualização ou migração automática do Supabase nesta etapa.

Uma futura migração deve mapear explicitamente cada país textual para ISO, revisar ambiguidades e guardar um mapa `legacy_id → opportunity_id`. Cada registro próprio deve preservar título, descrição, categoria, país e mês/dia originais em sua proveniência. Datas de feriados do provedor não devem ser confundidas com registros cadastrados.

Antes dessa migração, deve-se definir recorrência anual própria: mês/dia originais não podem ser descartados após gerar uma ocorrência concreta. Uma tabela de regras de recorrência (inclusive política para 29/02) ou metadados legados explícitos devem preservar a regra; ocorrências não substituem essa regra. Nenhuma unificação por nome/país/dia será aplicada automaticamente.

## Validação

- Validação inicial no checkout local: 23 testes passaram, incluindo testes locais de aprovação de outra tarefa.
- Validação do conteúdo isolado para push: 16 testes passaram; 13 novos do Radar/UI e 3 previamente versionados.
- Validação nativa adicional: 10 testes passaram no MariaDB 10.11.19 temporário, sem adaptação de SQL.
- Typecheck e build da API e web passaram novamente depois da validação nativa. Vite mantém aviso de tamanho de bundle; não impede o build.

O relatório detalhado está em `docs/seasonal-radar-mariadb-validation-2026-10-04.md`, com metadados e DDL real em JSON. Inclui PKs/FKs/índices/defaults, idempotência, bloqueios concorrentes, preservação de dados e scripts de arquivamento/restauração.

A versão/configuração exata de produção não foi confirmada. Não houve conexão com produção ou importação do legado. O banco temporário prova compatibilidade com MariaDB 10.11 LTS e as configurações explicitadas no relatório, sem substituir a conferência da versão do servidor de destino antes de um deploy futuro.
