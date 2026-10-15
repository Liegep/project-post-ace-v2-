# Dashboard — Mensagens internas

## Causa e correção

A regra desktop (`min-width: 1500px`) definia `grid-column: auto` para mensagens internas. Sua especificidade superava a regra genérica posterior que atribui quatro colunas aos widgets na grade atual de 12 colunas. Assim, mensagens internas ocupava apenas uma coluna. Dentro da mensagem, a data ainda disputava a mesma linha com título, ícone e indicador.

O widget agora ocupa seis colunas, com largura mínima de 320 px limitada ao espaço disponível. Quando a grade tem até 720 px de largura, ocupa uma linha inteira, inclusive em containers estreitos em telas desktop. A data fica abaixo do título e da mensagem; título com até duas linhas, texto completo no DOM, no tooltip e no objeto entregue ao callback de abertura. Ícone, indicador e ação de fechar têm espaço reservado. O widget ganhou espaçamento interno e foco visível para navegação por teclado.

A extração do componente permite testar sua apresentação e callbacks sem alterar a consulta da caixa de entrada, autorização, notificações, navegação ou persistência. Permanecem o contador total, limite de cinco mensagens, ocultação quando vazio e a chave de armazenamento usada para dispensar mensagens.

## Auditoria dos outros widgets

A fixture renderiza o `App` e o dashboard reais com respostas locais, incluindo relógio, lembretes, próximos posts, agenda, datas comemorativas, posts do dia, pautas aprovadas, feedbacks e sugestões dos clientes. Os testes verificam que todos os widgets cabem na grade e que nenhum recebe posicionamento automático de uma única coluna. Datas comemorativas também aparece na regra antiga, mas já possui uma regra posterior de mesma especificidade que corrige seu span. Não foi encontrada a mesma compressão nos outros widgets renderizados; seus spans existentes foram preservados.

## Validação

Executar a partir de `v2/`:

- `npm --workspace @design-hub-v2/web run test:dashboard-layout`: 18 testes aprovados (incluindo o teste agrupador).
- `npm --workspace @design-hub-v2/api test`: 694 testes aprovados.
- `npm --workspace @design-hub-v2/web run test:seasonal`: 19 testes aprovados.
- `npm run check`: API e web aprovados.
- `npm run build`: API e web aprovados. O Vite mantém o aviso de bundles acima de 500 kB.

Os testes novos usam Chromium, sem depender da API ou do banco: 320, 390, 768, 1024, 1280, 1499, 1500, 1536 e 1920 px; container de 360 px em desktop; títulos longos e sem espaços; 0, 1, 3 e 8 mensagens; limite de duas linhas; ausência de overflow e sobreposição; callback com título integral; abertura por teclado; navegação existente; contadores; persistência após recarregar; notificações preservadas ao fechar mensagens; perfis admin e colaborador. Requisições externas e mutações são bloqueadas na fixture.

Capturas são salvas em pasta temporária. Para escolher o destino: `DASHBOARD_LAYOUT_ARTIFACT_DIR=/caminho/local npm --workspace @design-hub-v2/web run test:dashboard-layout`.

Validação local realizada com Node 24.14.1; o projeto declara Node 22. Nenhuma dependência foi alterada. Nenhum merge, deploy, migration ou alteração em produção foi executado.
