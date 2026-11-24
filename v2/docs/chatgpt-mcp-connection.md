# Conexão ChatGPT/MCP com o Design Hub V2

Contrato revisado em 24/11/2026. O endpoint é `/mcp`, no domínio público da API.
As consultas MCP exigem OAuth e conta `super_admin` ativa. O servidor não é um
executor de buscas: o Radar/automação externa precisa submeter as descobertas.

## Ferramentas e permissões

| Permissão | Disponibilidade |
| --- | --- |
| `planning:read` | Clientes, cards, aprovações, comentários públicos, carga semanal, resumo de card e contexto de monitoramento. Na versão atual também há `get_radar_connection_status` e `validate_radar_source`. |
| `pauta:create` | `create_pauta_draft`, somente após confirmação explícita do usuário; cria rascunho, sem card ou publicação. |
| `pauta:create` + consentimento interno do Radar | `create_radar_suggestion`: analisa uma fonte e cria somente sugestão pendente no Dashboard. |
| `radar:suggest` | Compatibilidade OAuth; não substitui `pauta:create` nem concede consentimento interno. |

Defaults: `planning:read pauta:create`. Pedidos explícitos não ganham scopes
adicionais. Na autorização com `pauta:create`, o checkbox de IA do Radar é
opcional e começa desmarcado. Uma conexão pode ler normalmente sem possuir
permissão para Radar. Grants antigos têm consentimento falso; refresh preserva
essa decisão e não amplia scopes. Não editar grants manualmente.

Código de autorização: cinco minutos, uso único e PKCE S256. Access token MCP:
uma hora, separado dos tokens do aplicativo. Refresh token: 30 dias, com rotação.
Há limite de 60 requisições por minuto por cliente OAuth/usuário e auditoria de
tools. Revogar refresh não invalida imediatamente um JWT já emitido.

## Preparação e diagnóstico sem escrita

1. Confirmar SHA servido, `APP_URL` e `API_URL` HTTPS corretos, com issuer/resource
   iguais aos usados na autorização. Não alterar domínio ou secrets para testar.
2. Conferir configuração efetiva no servidor: `BRAND_BRAIN_AI_ENABLED` deve ser
   a string exata `true`; conferir somente presença de `OPENAI_API_KEY`, sem
   exibir/copiar seu valor. Flags de Relatórios não habilitam Radar.
3. Conferir migrations de sugestões, AI runs, source runs e as duas colunas
   `radar_ai_authorized` da migration `20261008_mcp_radar_internal_consent.sql`.
   Não executar bootstrap ou migrations como diagnóstico.
4. Conferir metadata pública `/.well-known/oauth-authorization-server` e
   `/.well-known/oauth-protected-resource/mcp`. O POST `/mcp` sem token responde
   401; GET `/mcp` responde 405, não é teste de autenticação.
5. Numa validação futura autorizada, comparar tools/list com a permissão da
   conexão específica. Tool ausente pode indicar escopo/consentimento, versão
   implantada ou catálogo desatualizado; não comprova agente ausente.

As tools de diagnóstico não chamam IA nem gravam sugestões/fontes, mas chamadas
MCP registram auditoria. Se o escopo for zero escrita no banco, não chamá-las.
Também não iniciar OAuth/refresh como teste nessa situação. O diagnóstico não
comprova validade da chave, resposta do provider ou permissão de escrita SQL.

## Onde aparece cada resultado

`created` gera `radar_suggestions.pending` → widget Radar de Pautas no Dashboard.
Somente **Adicionar ao banco** converte em pauta draft do cliente. Envio/aprovação
e Kanban são ações humanas posteriores. `create_pauta_draft` é outro fluxo,
com confirmação explícita, que grava diretamente no Banco de Pautas.

`no_op` é decisão editorial sem sugestão. `existing` reutiliza a mesma fonte,
inclusive accepted/dismissed. `processing` e `source_failed` não permitem retry
pago automático. Não apagar ledger nem mudar URL para contornar deduplicação.

Falha MCP pode aparecer em `isError` mesmo com HTTP 200. Dashboard mostra erros
de listagem/decisão, mas não é um painel de falhas das execuções externas.
Correlacionar horário do emissor, HTTP/MCP, auditoria, source runs, AI runs e
status da sugestão antes de atribuir causa ou repetir uma operação.

Roteiro completo somente leitura e dados a ocultar:
[diagnóstico de recebimento](../../docs/radar-receiving-diagnosis/README.md).
Histórico da mudança de consentimento:
[consentimento interno](../../docs/mcp-radar-internal-consent.md).
