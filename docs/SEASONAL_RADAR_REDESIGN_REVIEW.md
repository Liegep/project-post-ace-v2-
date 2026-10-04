# Radar de oportunidades sazonais — revisão visual

Implementado na branch local `codex/seasonal-radar-redesign`. Direção visual aprovada; refinamentos leves validados antes do push. Sem merge ou deploy.

A página destaca a próxima ocorrência e organiza as restantes por mês, sem repetir o destaque. Filtros de período, país, categoria e cliente consultam a API existente. O drawer reúne países monitorados e mercados editoriais; a seleção de mercados exige confirmação explícita. A criação de pauta reutiliza o fluxo de card pendente para aprovação e exige escolher um cliente.

Nenhuma alteração de schema, API ou banco. Nenhuma importação de legado ou associação automática de clientes. Nenhuma alteração em produção. O diretório ISO vem da API e os nomes são localizados por `Intl.DisplayNames`; o frontend não restringe países à cobertura de feriados externos.

## Validação

- 389 testes existentes aprovados; 18 testes novos aprovados.
- Typecheck de API e frontend aprovado.
- Build de API e frontend aprovado. Mantido o aviso existente sobre tamanho dos bundles.
- Mobile de 360 e 390 px sem overflow horizontal; desktop de 1440 px revisado.
- Testes de desativação/reativação sem DELETE, confirmação de vários mercados, global único, regional, paginação acima de 24, Hoje/Amanhã, períodos em dezembro/janeiro, falhas e criação de pauta pendente.
- Dados de demonstração não entram no build de produção.

## Reproduzir a prévia

Em `v2`, com Node 22 e dependências instaladas:

```sh
npm run dev:web -- --host 127.0.0.1 --port 4182
npm run test:seasonal --workspace @design-hub-v2/web
npm test --workspace @design-hub-v2/api
npm run check
npm run build
```

Abrir `/tests/seasonal-preview.html?scenario=populated`. Outros cenários: `empty`, `global`, `regional`, `many`, `warning`.

A prévia renderiza a página real dentro do aplicativo. As respostas são fixtures locais em memória, com clientes e oportunidades de demonstração. Não representa registros reais da produção e não envia requisições ao banco ou a provedores externos. A implementação de produção continua usando exclusivamente as APIs existentes.

## Refinamentos aprovados

Ajustes restritos ao CSS: botão de gerenciamento integrado às cores do banner sem alterar altura; destaque suave em Útil para; títulos da timeline com mais presença e metadados/chips leves. CTA principal mobile em largura total, ações da timeline discretas e onboarding final preservado. Revalidados 407 testes, typecheck, build e mobile de 360/390 px sem overflow. Nenhuma alteração de lógica, APIs, schema ou dados nesta etapa.
