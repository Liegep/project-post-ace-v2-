# Visualizador de posts produzidos — regressão do PR #41

Correção isolada a partir de `71d4dd4d30e6ed8614c0ec3d248b35238b712777` (main com #38, #39, #40 e #41), na branch `codex/restore-produced-media-viewer`.

A presença de `editorialBrief` não identifica uma pauta: posts produzidos mantêm esse conteúdo depois da produção. O leitor editorial agora depende exclusivamente de `isBriefApproval === true`, tanto no portal quanto no link público. Pautas com imagens de referência continuam usando o design aprovado do #41.

As regras `.editorial-pauta-modal`, sua grade de uma coluna e seu limite de imagem de 320 px permanecem exclusivas das pautas. O visualizador tradicional volta às duas colunas no desktop e uma coluna no celular. A moldura arredondada acompanha a proporção natural da imagem ou do vídeo, sem esticar ou recortar. A altura é limitada a 640 px e à área disponível em telas menores; a largura acompanha a proporção, evitando o painel cinza lateral. As dimensões reais de vídeos prevalecem sobre o rótulo Reels depois do carregamento. O carrossel recalcula a moldura a cada arte.

O link público de posts produzidos reutiliza o carrossel existente, incluindo vídeos, mantém a mídia principal primeiro e elimina URLs repetidas. O trecho de mídia das pautas no link público permanece como no #41. Nenhum handler de aprovação, comentário, alteração, conteúdo, snapshot ou histórico foi modificado. Não há alterações de API, permissões, persistência ou migrations.

## Comparação reproduzível com o visualizador anterior

O teste carrega em memória o `App.tsx` e o CSS reais do commit `fa8f6d9ed67c9fc97a9e70fbfc21b968580472b8`, imediatamente anterior ao #41. Usa as dependências locais atuais, os mesmos dados sintéticos e as mesmas dimensões de tela. Não restaura código antigo no produto. Compara as duas colunas com o original e verifica a nova moldura pela geometria da mídia, além de salvar capturas. Não exige igualdade de pixels, pois o enquadramento foi corrigido.

| Mídia | Antes do #41 — referência | Correção — desktop | Correção — celular |
|---|---|---|---|
| Quadrada | [Antes](produced-media-viewer-evidence/before-square-desktop-light.jpg) | [Depois](produced-media-viewer-evidence/after-square-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-square-mobile-light.jpg) |
| Vertical 4:5 | [Antes](produced-media-viewer-evidence/before-portrait-desktop-light.jpg) | [Depois](produced-media-viewer-evidence/after-portrait-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-portrait-mobile-light.jpg) |
| Vertical 9:16 | [Antes](produced-media-viewer-evidence/before-story-desktop-light.jpg) | [Depois](produced-media-viewer-evidence/after-story-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-story-mobile-light.jpg) |
| Horizontal 16:9 | [Antes](produced-media-viewer-evidence/before-landscape-desktop-light.jpg) | [Depois](produced-media-viewer-evidence/after-landscape-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-landscape-mobile-light.jpg) |
| Carrossel misto | [Antes](produced-media-viewer-evidence/before-carousel-desktop-light.jpg) | [Depois](produced-media-viewer-evidence/after-carousel-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-carousel-mobile-light.jpg) |
| Vídeo 9:16 | [Antes](produced-media-viewer-evidence/before-video-story-desktop-light.jpg) | [Depois](produced-media-viewer-evidence/after-video-story-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-video-story-mobile-light.jpg) |
| Vídeo horizontal | — | [16:9](produced-media-viewer-evidence/after-video-landscape-desktop-light.jpg) | [390 px](produced-media-viewer-evidence/after-video-landscape-mobile-light.jpg) |

Na tela de 1440 × 1100, a moldura 9:16 corrigida mede 360 × 640 px; a 4:5 mede 512 × 640 px; a quadrada mede aproximadamente 607 × 607 px. O visualizador anterior reservava uma moldura de aproximadamente 607 × 855 px para esses três casos, deixando espaço sem arte. As novas molduras ficam inteiras na área rolável, acima dos botões fixos.

Há 41 capturas e [medidas automatizadas](produced-media-viewer-evidence/evidence.json). A matriz cobre 1440 × 1100, 390 × 844 e 320 × 740, com preferências clara e escura do navegador. A aplicação mantém sua paleta clara explícita em ambas. Os vídeos WebM são gerados localmente pelo navegador, com metadados reais; as imagens são SVGs sintéticos. Nenhum dado da Kynagogi ou de outros clientes foi acessado.

## Validação

Executado com Node 22.23.3:

- Regressão API e componentes web: **672 passaram**.
- Design editorial, portal, link público e recuperação no Kanban: **12 passaram**.
- Visualizador de mídia: **9 passaram**. A matriz verifica proporção intrínseca, moldura arredondada, `object-fit: contain`, ausência de overflow, mídia inteira na área do leitor, troca entre quatro proporções no carrossel, reprodução de vídeo, sessão autenticada, link público e ordem da mídia principal. Confirma também que pautas com mídia continuam editoriais e que comentários, aprovação e pedido de alteração mantêm seus payloads e não alteram os dados sintéticos.
- Typecheck API e web: **passou**.
- Build API e web: **passou**, com o aviso preexistente de chunks acima de 500 kB.

Para reproduzir, a partir de `v2`:

```sh
npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/api test
npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/web run test:pauta-layout
MEDIA_LAYOUT_ARTIFACT_DIR=/tmp/produced-media-evidence npm exec --yes --package=node@22 -- npm --workspace @design-hub-v2/web run test:media-layout
npm exec --yes --package=node@22 -- npm run check
npm exec --yes --package=node@22 -- npm run build
```

O teste comparativo requer o commit histórico de referência disponível no Git local; em clones rasos, obtenha-o antes de executar. As chamadas de API são substituídas por respostas sintéticas; o navegador bloqueia requisições fora do servidor local. As únicas escritas simuladas aceitas são os payloads explicitamente testados.

Nenhum merge, deploy, migration ou acesso a banco de produção realizado.
