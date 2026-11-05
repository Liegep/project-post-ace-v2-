# Badges somente quando preenchidos

O renderer usava `badge || recommended`, criando Recommended automaticamente para opções antigas com flag true. Agora só exibe `badge.trim()` quando houver texto. Campo ausente, vazio ou só com espaços não produz selo, mesmo com `recommended=true` armazenado.

O campo de badge é a única fonte visual. Retirado o checkbox separado de recomendação; o campo opcional continua aceitando Recommended, Most popular ou outro texto escrito pelo administrador. Texto personalizado não é traduzido automaticamente. Metadados antigos são preservados, sem backfill ou regravação de propostas/snapshots.

Sem alterações em preços, seleção, aceite, banco, API ou migrations. Teste de regressão cobre flags antigas em ambas as opções, campo ausente, espaços, badge explícito, limpeza do campo e preservação dos objetos de origem. Node 22: typecheck/builds API/frontend aprovados e 728 testes aprovados. PR #54 intacto. Correção preparada para revisão, ainda não publicada.
