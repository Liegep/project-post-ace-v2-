# Conexão somente leitura com o ChatGPT

## O que está disponível

O endpoint MCP fica em `/mcp` no mesmo domínio da V2 e oferece somente estas
consultas:

- clientes acessíveis, sem contatos e sem dados financeiros
- cards e posts com prazo em um período
- aprovações pendentes
- comentários recentes feitos pelos clientes, sem notas internas
- carga de trabalho semanal, incluindo a descrição dos compromissos da agenda
- resumo de um card, sem arquivos ou links privados

Não existem ferramentas MCP de criação, alteração, exclusão, aprovação,
publicação ou envio de mensagens.

## Proteções implementadas

- OAuth com Authorization Code e PKCE S256
- escopo único `planning:read`
- autorização restrita a uma conta `super_admin` ativa
- tokens MCP separados dos tokens normais do aplicativo
- códigos de autorização com uso único e validade de cinco minutos
- tokens de acesso com validade de uma hora
- renovação com rotação e possibilidade de revogação
- limite de 60 consultas por minuto por autorização
- auditoria de cada ferramenta chamada
- comentários internos, faturas, contratos, senhas, contatos e mídias não são expostos

## Preparação da hospedagem

Antes da conexão, confirme na Hostinger:

1. `APP_URL` e `API_URL` apontam para o endereço HTTPS público exato da V2.
2. `NODE_ENV=production` e `DEMO_MODE=false`.
3. `JWT_SECRET` continua longo, secreto e diferente de valores de exemplo.
4. A nova versão foi compilada e reimplantada.

Não é necessário cadastrar uma senha ou chave do banco no ChatGPT.

## Verificação após o deploy

Abra estes endereços, trocando o domínio pelo domínio público da V2:

- `https://SEU-DOMINIO/.well-known/oauth-authorization-server`
- `https://SEU-DOMINIO/.well-known/oauth-protected-resource/mcp`

Ambos devem responder com JSON. Uma chamada sem autorização para
`https://SEU-DOMINIO/mcp` deve responder `401`.

## Conexão no ChatGPT

No modo de desenvolvedor/conectores do ChatGPT, informe:

`https://SEU-DOMINIO/mcp`

O ChatGPT descobrirá os endereços de autorização. Na tela do Design Hub,
confirme a conexão usando o login da conta super admin. A tela deixa explícito
que o acesso é somente leitura.

Depois da conexão, teste primeiro:

1. listar os clientes
2. consultar a carga da semana atual
3. consultar aprovações pendentes
4. confirmar que nenhuma ferramenta de escrita aparece

Só depois desse teste o check-in de quinta-feira deve ser atualizado para usar
o conector.

