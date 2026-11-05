# Moedas por proposta

Mudança isolada baseada em main. Não requer SQL ou migration: proposals.currency já existe (VARCHAR(10)). Nenhum registro ou valor financeiro foi alterado. Sem dependências novas.

## Arquivos
- proposals.schemas.ts: padrão BRL na criação; PATCH sem moeda preserva a moeda existente.
- ProposalsWorkspace.tsx: seletor BRL/USD/EUR/SEK, aviso sem conversão, moeda nos itens e formatação do total e histórico.
- proposalCurrency.ts: normalização de símbolos antigos, fallback BRL e Intl.NumberFormat centralizado.
- proposalPresentation.tsx: formatação comum na prévia interna e página pública.
- proposalCurrency.test.ts: quatro moedas, persistência via repositório com banco simulado, cópia do payload, fallback e renderização de itens/total.
- proposalsWorkspace.test.tsx: expectativa atualizada para espaço não separável produzido pelo Intl.

A moeda independe do idioma da proposta. Os números dos serviços não são recalculados. Símbolos antigos são interpretados apenas para apresentação; outros valores legados continuam visíveis.

## Limites de validação
O módulo atual não oferece duplicação por interface, descontos ou exportação PDF própria. A cópia de dados foi validada no repositório; não equivale a um teste de duplicação por interface. A página pública reutiliza ProposalClientPreview. Exportação PDF não foi validada. Banco real de produção não acessado.

Nenhuma alteração em faturas, pagamentos, contratos, relatórios ou Hostinger. PR #54 não alterado. Merge e deploy dependem de autorização posterior.

## Verificações (Node v22.23.4)
- Typecheck API e frontend: passaram.
- Build API e frontend: passaram (Vite avisa sobre tamanho de chunks).
- Testes focados: 18/18 passaram, incluindo os seis novos testes e regressões do editor.
- package.json da API inclui a nova cobertura no comando de testes existente.
- Suíte geral API e testes frontend associados: 715/715 passaram. Inclui a nova cobertura, após atualização com main.
