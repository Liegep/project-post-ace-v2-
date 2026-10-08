# Radar: consentimento interno por autorização OAuth

A autorização real do ChatGPT pede explicitamente `planning:read pauta:create`.
Os defaults OAuth não alteram um pedido explícito; depender de `radar:suggest`
impedia a descoberta da ferramenta nessa conexão.

Novas autorizações com `pauta:create` mostram o checkbox do Radar desmarcado e
opcional. Desmarcado, a conexão continua funcionando sem Radar. Marcado, o POST
autenticado persiste a decisão independentemente do scope. Os scopes devolvidos
continuam exatamente os solicitados, sem inclusão de `radar:suggest`.

O campo `radar_ai_authorized` é persistido nos códigos OAuth e refresh tokens
existentes. Cada autorização tem sua própria decisão; o consentimento de uma
conexão não modifica outra. A troca do código e a rotação do refresh preservam o
campo e o transportam em uma claim interna do access token assinado. Parâmetros
de consentimento enviados ao endpoint de token não concedem essa permissão.

A rota MCP usa somente a claim verificada. A ferramenta exige simultaneamente
`pauta:create` e consentimento interno verdadeiro para registro. O serviço
repete as duas verificações antes de contexto, IA ou gravações. Ausência de claim,
campo falso e antigos scopes Radar não concedem permissão.

O scope `radar:suggest` continua suportado para compatibilidade, mas não implica
consentimento nem substitui `pauta:create`. Downscope para somente leitura mantém
a decisão persistida, mas remove a ferramenta por ausência de `pauta:create`.
Refresh continua impedido de ampliar scopes.

## Migration para revisão

`v2/database/migrations/20261008_mcp_radar_internal_consent.sql` adiciona somente
duas colunas booleanas com `NOT NULL DEFAULT 0` às tabelas OAuth existentes.
Todas as autorizações antigas ficam sem consentimento interno. Não cria tabelas
ou serviços novos, nem infere autorização a partir de scopes antigos.

Aplicar explicitamente após revisão e antes de um futuro deploy. O bootstrap
mantém as definições de tabelas novas coerentes, mas não executa ALTER nas tabelas
existentes. A migration foi entregue, sem aplicação em banco nesta implementação.
O SQL segue o padrão MariaDB de ADD COLUMN IF NOT EXISTS já usado no projeto.

Sem mudanças em sugestões pending, dedupe, PautaIdea, cards, publicações ou
política de retries. Nenhuma chamada real à OpenAI.

## Revisão final de persistência — 2026-10-08

Revisado o commit funcional a985dc5996a4ab1ca75a890f0089f9bf9267af7b.
Não foram necessárias mudanças funcionais ou alterações no SQL da migration.

Executada em MariaDB 10.11.19 local, socket temporário, sem rede, com timezone UTC
e SQL mode estrito. A versão 11.8.9 de produção consta em um registro anterior;
produção não foi consultada nem alterada nesta revisão.

- Reconstruído o schema anterior sem as colunas e inseridos code/refresh grants
  antigos, inclusive com scope radar:suggest. Aplicada a migration: ambos ficaram
  com consentimento 0, todos os demais campos permaneceram iguais, e as colunas
  foram confirmadas como tinyint(1), NOT NULL, default 0.
- UPDATE para NULL foi recusado. Reaplicação da migration preservou tanto os
  registros antigos negados quanto novos grants explicitamente autorizados.
- Exercitado POST de autorização → código persistido → token → claim assinada →
  tools/list → chamada da ferramenta com provider mockado e banco real.
  Sem checkbox: conexão válida e ferramentas antigas disponíveis, sem Radar.
  Com checkbox: scope continua planning:read pauta:create, Radar disponível,
  somente sugestão pending e nenhum card ou mudança no drawer do cliente.
- Code e refresh antigos produziram claims internas falsas depois da migration.
  Refresh manteve exatamente o consentimento original mesmo quando o cliente
  enviou parâmetros tentando inverter a decisão. Refresh anterior rotacionado
  não pôde ser reutilizado; revogação pelo cliente correto bloqueou renovação,
  enquanto um client_id diferente não revogou o token.
- 24/24 MCP/OAuth, 21/21 MariaDB (8 MCP/Radar, 10 Radar Suggestions, 3 Brand Brain
  AI), 548/548 suíte principal, typecheck API/frontend e build API/frontend.
  Nenhuma chamada real à OpenAI. Servidor temporário encerrado após os testes.

O primeiro ensaio detectou somente uma lacuna do fixture: o schema de bootstrap
contém tabelas OAuth antigas e o teste não aplicava a nova migration. Incluída
a migration na lista explícita dos testes; nenhuma correção em produção.

Pontos para implantação futura: aplicar a migration antes do código, pois
CREATE TABLE IF NOT EXISTS não atualiza tabelas já existentes. A revogação conserva
o comportamento anterior: invalida refresh tokens, mas access tokens stateless
já emitidos permanecem válidos até a expiração original (até uma hora).
