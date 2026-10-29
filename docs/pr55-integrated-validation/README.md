# PR #55 — idempotência e validação final

29/10/2026. Node 22.23.4, Chromium 151.0.7922.34, MariaDB 10.11.19. PR mantido em rascunho.

## Mudança

A transferência usa reserva persistente com UUID vinculada ao usuário, origem, destino, coluna e modo. Mesma chave retorna o mesmo resultado; nova chave permite nova cópia. O histórico na barra do quadro recupera operações após recarga ou novo login, sem armazenamento local da chave.

Criação, exclusão do modo Mover e resultado são atômicos. Falhas ao criar, excluir ou registrar a conclusão desfazem as mudanças dos cartões e deixam a reserva recuperável. Origem alterada, acesso revogado, mudança de parâmetros e vínculos Meta/aprovação ativos impedem exclusão. Encerrar uma reserva mantém sua chave como registro permanente. Operações concluídas não são reexecutadas quando a origem já foi removida.

O título é preservado integralmente, sem sufixo que poderia ultrapassar 255 caracteres. Conteúdo, briefing, mídias, etiquetas, hashtags, prazo, prioridade, cor e retenção são copiados por lista explícita no servidor. Fuso ausente é omitido; string válida é preservada. Não entram no destino agendamento, publicação, jobs Meta ou credenciais de aprovação.

## Ambiente

HTTP loopback, MariaDB novo com socket exclusivo e `skip_networking=1`, banco aleatório, arquivos e usuários sintéticos. Sem `.env`, dados reais, Hostinger, SMTP, provedores externos ou workers. O script encerra apenas seu processo descartável. PR #54 intacto; sem merge, deploy ou reinício de serviço existente.

O novo SQL foi ensaiado apenas na base descartável. A fixture corrente é criada completa antes das requisições; não são aplicados arquivos de migration para silenciar falhas. Outra base, criada com o schema-base histórico, permite diagnóstico comparativo.

## Evidências e cobertura

`results.json` registra versões, banco/socket, verificações, erros SQL esperados e falhas injetadas. Capturas: `01-copy.png`, `02-atomic-move.png`, `03-recovered-session.png`.

- Cópia entre clientes na coluna escolhida e persistência após recarga.
- Legenda, briefing, referências e bytes de imagem/anexo, etiquetas, hashtags e prioridade preservados. PDF é fixture de transporte; não valida renderização.
- Cartões sem fuso e com `Europe/Stockholm`.
- Mesma chave repetida simultaneamente retorna um destino; nova chave cria outra cópia.
- Reservas iniciais e execuções concorrentes; replay em outra instância Fastify com o mesmo banco, sem cache em processo.
- Resposta HTTP real descartada depois do commit; recuperação após recarga e novo login em contexto independente, sem compartilhar a chave com a nova sessão.
- Reserva pendente encontrada no histórico e retomada.
- Falhas de criação, exclusão e gravação do resultado por triggers sintéticos: original preservado e nenhum destino parcial.
- Retomada de Mover após rollback, descarte da resposta de sucesso e replay após exclusão da origem.
- Coluna de outro cliente, parâmetros diferentes com mesma chave, outro usuário, acesso revogado, origem alterada, vínculos ativos, cancelamento concorrente e flag desativada.
- Sem links de aprovação, agendamentos ou publicações Meta no destino; fixture Meta original integralmente preservada.
- Entrada inválida retorna 400; nenhuma rejeição sem tratamento. Erros esperados do ensaio permanecem registrados, sem mudança do tratamento global.

A suite padrão inclui fronteiras HTTP do novo recurso e regressões de concorrência de textos. O ensaio real MariaDB/navegador tem roteiro dedicado.

## HTTP 500 auxiliares

`auxiliary-baseline.json` conserva a captura anterior à correção de concorrência.

O inbox retorna `ER_NO_SUCH_TABLE`: `internal_approval_requests` ausente no schema-base histórico. É divergência da fixture diante de estrutura já exigida pelo código anterior, não regressão do PR #55. A fixture corrente criada completa retorna 200.

Textos apresentou `ER_DUP_FIELDNAME` em `cover_image_url`: o esquema-base não tinha a coluna e a inicialização tardia preexistente permitia que oito leituras concorrentes executassem o mesmo ALTER. Portanto havia uma condição de corrida real preexistente, exposta pela fixture incompleta. A correção compartilha uma Promise por pool e trata somente coluna duplicada, revalidando sua existência se outro pool/processo ganhar a corrida. Outros erros continuam sendo propagados e permitem nova tentativa. Nenhum tratamento global foi alterado.

O ensaio final faz oito leituras concorrentes na base histórica e oito na corrente: todas retornam 200. A base histórica continua retornando o 500 esperado no inbox, comprovando a causa sem ocultá-la. O navegador da fixture corrente não tem 500 nesses endpoints. A inicialização tardia de textos já existente continua podendo executar DDL quando faltam suas colunas; este trabalho não adiciona migration de textos.

## Reprodução e prontidão

Com Node 22, dependências do lockfile, MariaDB local e Chromium disponíveis, executar de `v2`: `bash scripts/validate-card-transfer-local.sh`. O roteiro compila API/web e executa o harness real. Suite e typecheck: `npm --workspace @design-hub-v2/api test` e `npm run check`.

A idempotência e a recuperação foram validadas localmente. Typecheck, builds API/web, 709 testes gerais e 14 verificações integradas passaram em Node 22. O build mantém aviso de chunks grandes.

**Pronto para revisão técnica; publicação/ativação depende da aprovação e execução separadas do [plano de persistência e implantação](../pr55-transfer-migration-proposal.md).** A flag é falsa por padrão e a API recusa o recurso sem tabela/chave/engine adequadas. Não foram certificados infraestrutura, failover, backups, outros navegadores ou publicação real Meta. Nenhuma atuação em produção.
