# PR #55 — validação local final

29/10/2026. Node 22.23.4, Chromium 151.0.7922.34, MariaDB 10.11.19.

Ambiente exclusivo: servidor HTTP loopback, banco aleatório em MariaDB descartável com `skip_networking=1`, arquivos e usuários sintéticos. Esquema-base criado em banco novo; nenhum arquivo de migration foi executado. Sem `.env`, dados de produção, Hostinger, workers, SMTP, provedores Meta, merge ou deploy. O PR #54 não foi alterado.

## Resultado no navegador

Oito verificações passaram usando frontend compilado, autenticação real pelo formulário, rotas Fastify reais e banco local. Apenas as falhas de criação/exclusão foram injetadas na rede pelo navegador.

- Cópia entre dois clientes sintéticos na coluna escolhida; persiste após recarga.
- Legenda, referências e bytes da imagem e anexo sintético, briefing, etiquetas, hashtags e prioridade preservados. Título mantém o sufixo existente `(copia)`; Mover conserva o título exato. O PDF é somente um arquivo de teste de transporte; renderização de documentos não foi validada.
- Cartão sem fuso e com `Europe/Stockholm` copiados com sucesso.
- Falha de criação: mensagem visível e modal aberto, original preservado.
- Mover com criação falha: nenhuma exclusão do original.
- Mover com exclusão falha: criação parcial informada explicitamente, original preservado e botão de envio bloqueado no mesmo modal.
- Mover com sucesso: somente um cartão no destino e original removido após criação.
- Nenhum agendamento, publicação Meta ou link de aprovação no destino; fixture Meta da origem integralmente preservada. Entrada inválida retorna HTTP 400. Nenhuma rejeição não tratada no navegador.

Evidências: `results.json` e capturas locais `01-copy.png`, `02-partial-move.png`.

## Correções adicionais

O payload inclui tipo de mídia, briefing, prioridade, cor e retenção de arquivos. A falha de exclusão agora usa mensagem específica e bloqueia repetição no mesmo modal. Testes unitários de ordenação criação/exclusão e campos aplicáveis entram na suite padrão.

## Reproduzir

Com Node 22, dependências do lockfile e Chromium instalado, executar de `v2`: `bash scripts/validate-card-transfer-local.sh`. Requer MariaDB local instalado; o script cria e encerra apenas um novo processo descartável, sem TCP, e remove apenas seu banco aleatório. O harness não chama `buildApp` nem inicia workers.

## Limites e decisão

O fluxo testado passou, mas não há garantia de idempotência ponta a ponta: se o servidor salvar a criação e a resposta se perder, a UI manda conferir o destino, porém reabrir e repetir a operação pode duplicar o cartão. O bloqueio de repetição de Mover dura somente enquanto o modal permanece aberto. Não houve ensaio dessa perda de resposta após commit. Por isso **não considerar pronto para publicação com garantia irrestrita contra duplicação**.

O esquema-base também não contém todos os ajustes posteriores usados por endpoints auxiliares: o ensaio registra HTTP 500 em `/api/internal-approvals/inbox` e `/texts`. Esses erros não interrompem os cenários de cópia/movimentação e estão expostos em `results.json`; não foram escondidos nem corrigidos com migrations, conforme a restrição recebida.

Typecheck API/web, builds API/web e suite passaram em Node 22. O build mantém aviso de chunks grandes. A validação não certifica hospedagem ou publicação real Meta. Revisão do tratamento de resposta perdida/idempotência e do ambiente completo permanece necessária antes de declarar liberação irrestrita.
