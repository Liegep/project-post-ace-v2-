# Pré-voo Meta multiconta

## Entrega

Branch: `codex/meta-multiclient-preflight`. Base: `103ab043b4c80a0dcb2e950ee5cf39a1f63eb6bf` (origin/main na leitura inicial). Sem merge no main e sem publicação/deploy em produção.

O botão **Verificar contas Meta** fica em **Configurações do cliente → Integrações Meta → Verificação Meta**, disponível ao super_admin. Cada destino tem seu próprio botão e resultado. A verificação continua disponível quando a conexão está indisponível, e não depende de abrir a lista de assets para edição.

## Roteamento anterior e reforço

A rota de agendamento já buscava um destino restrito ao cliente, selecionava seus IDs no banco e conferia o cliente do card no serviço. O frontend envia plataformas e destinationId; não é fonte dos IDs de assets.

A proteção adicional no serviço `scheduleMetaCardPublications` faz uma nova leitura do banco **antes de qualquer criação, consulta de conexão ou movimentação**:

- confirma o cliente do card pelo ID persistido, além do objeto recebido;
- encontra o destino com `id` e `client_account_id`, bloqueando destino ausente ou de outro cliente;
- compara cada `metaAssetId` com o ID exato salvo para a plataforma;
- bloqueia todo o lote se uma plataforma tiver mismatch;
- usa o nome persistido do destino no snapshot, ignorando um nome recebido;
- preserva o fallback anterior para configurações sem destinationId, também validando os IDs persistidos.

Os IDs dos registros agendados continuam sendo snapshots imutáveis para o worker. O pré-voo não chama o worker e não altera os agendamentos existentes.

## Endpoint somente de leitura

```text
GET /api/meta/preflight?clientAccountId=<cliente>&destinationId=<destino>
GET /api/meta/preflight?clientAccountId=<cliente>&destinationId=<destino>&cardId=<card>
```

- Autenticação obrigatória; apenas `super_admin`.
- `cardId` é opcional para a verificação geral de contas. Quando ausente, `cardBelongsToClient` é `null`, e a interface não afirma ter verificado um card.
- Destino ou card incorreto retorna `blocked` sem consultar a Meta. Um destino de outro cliente não tem nome ou assets expostos.
- Checks não executados ficam `null`, incluindo a auditoria de colisão quando a validação de propriedade impede a consulta.

A leitura da Meta utiliza **exclusivamente GET** na Graph API v26.0:

1. Página salva: `/<facebookPageId>?fields=id,name,instagram_business_account{id}`; sem Instagram configurado, consulta apenas `id,name`.
2. Instagram salvo: `/<instagramAccountId>?fields=id,username`.
3. Acesso do usuário conectado: `/me/accounts?fields=id,instagram_business_account{id}`; sem Instagram configurado, consulta apenas `id`.

O retorno exige IDs reais correspondentes, compara o nome/username salvo com o atual e verifica a presença na lista de assets acessíveis. Uma Página publicamente legível não basta para confirmar acesso. Com Facebook e Instagram configurados, também exige que a Página aponte para o Instagram salvo.

A paginação da lista é reconstruída com cursors, sem seguir a URL `next`. Há limite de 20 páginas e 15 segundos para a leitura completa. Lista incompleta, falha de rede, conexão indisponível, acesso revogado, asset ausente ou IDs inconsistentes impedem `safe`.

`safe` confirma roteamento e acesso de leitura no momento da consulta. **Não é um teste de permissão de publicação** e não garante que um futuro publish será autorizado. O pré-voo é uma consulta independente; o agendamento mantém sua proteção própria de propriedade e IDs persistidos, sem depender de um resultado antigo exibido na interface.

## Avisos e colisões

- Nome ou username diferente com ID real correspondente: `warning`, para acomodar renomeações legítimas.
- Asset ligado a outro cliente: `warning`, código `asset_linked_to_multiple_clients`, sem bloquear automaticamente compartilhamentos intencionais.
- A auditoria consulta `meta_publish_destinations` e `client_meta_assets`, excluindo associações do próprio cliente. Múltiplos destinos do mesmo cliente não são classificados como colisão entre clientes.
- A resposta de colisão contém somente plataforma, ID do asset, ID/nome do cliente e ID/nome do destino; nenhuma configuração é alterada.

**Associações reais existentes:** não foi concluída uma auditoria de produção nesta entrega. O endpoint novo não foi implantado, e não foi obtida uma sessão de auditoria independente da janela do navegador em uso. Não há evidência para afirmar que a base está livre de colisões ou que existe uma associação suspeita. Os cenários locais de colisão e configuração cruzada foram detectados corretamente.

## Segurança

O pré-voo não cria post, container, Reel, Story ou publicação agendada; não altera/move card, nem faz INSERT/UPDATE/DELETE. O reader não solicita Page access token. Tokens e appsecret_proof são usados apenas na chamada interna autenticada à Meta e nunca retornados ou registrados.

Erros da Meta e da rede são convertidos em códigos fixos; mensagens brutas, payloads completos, credenciais e URLs sensíveis não entram na resposta ou logs. O log próprio do pré-voo contém clientAccountId, destinationId e resultado. A interface trata nomes como texto, descarta respostas antigas após mudanças no destino e mantém resultados separados por cliente/destino.

## Validação

- **243 testes aprovados**, incluindo **31 novos** (28 backend + 3 apresentação).
- Typecheck de API e web aprovado.
- Build de API e web aprovado. O aviso preexistente de bundles maiores que 500 kB permanece.
- Interface real React conferida no navegador local, com resultados `safe`, `warning` e `blocked` e respostas simuladas. Fixtures temporárias removidas.
- Nenhuma chamada real de publicação/agendamento foi feita; o caminho correto de agendamento foi exercitado apenas com banco simulado.

Cobertura nova: propriedade do card/destino, destino ausente, IDs Facebook/Instagram incorretos, lote parcialmente incorreto, multidestino, asset removido, acesso revogado, lista sem membership, relação Página–Instagram incorreta, renomeação, colisão entre clientes incluindo configuração anterior, paginação segura/incompleta, conexão expirada/ausente, destinos de plataforma única, fluxo válido, fallback anterior, restrição de perfil, erros de rede/JSON, resposta/log sem segredos e escape de labels na interface.

## Arquivos

- API: `meta.routes.ts`, `meta.schemas.ts`, `meta.repository.ts`, `meta.service.ts`, `meta-routing.ts`, `meta-preflight.ts`, `meta-preflight.test.ts`, `package.json`.
- Web: `App.tsx`, `api.ts`, `styles.css`, `MetaPreflightPanel.tsx`, `tests/metaPreflight.test.tsx`.
- Documento: `docs/meta-multiclient-preflight.md`.

Referência de leitura de assets: [coleção oficial da Meta para Instagram no Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).
