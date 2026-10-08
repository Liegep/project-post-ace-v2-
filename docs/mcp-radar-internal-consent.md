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
