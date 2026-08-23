# Matriz de Clientes para Migracao

## Como usar

Para cada cliente ou conta, preencher:

- situacao atual
- quanto historico realmente importa
- o que entra na V2
- o que fica fora
- prioridade

## Categorias de decisao

Use uma destas categorias por cliente:

- `Migrar completo`
- `Migrar essencial`
- `Recriar depois`
- `Arquivar fora`
- `Descartar`

## Regra simples para decidir

### Migrar completo

Quando:

- o cliente esta ativo
- usa o portal
- consulta historico
- ainda depende de posts, textos, comentarios ou arquivos antigos

### Migrar essencial

Quando:

- o cliente esta ativo
- precisa entrar na V2
- mas nao precisa do historico inteiro

### Recriar depois

Quando:

- o cliente nao precisa entrar ja
- pode ser trazido numa segunda fase

### Arquivar fora

Quando:

- o cliente nao precisa ficar no app novo
- mas o material merece ser guardado

### Descartar

Quando:

- nao ha valor operacional
- existe backup
- o conteudo nao faz falta nem no sistema nem fora dele

## Campos recomendados

Preencha estes campos para cada cliente:

| Cliente/Conta | Status atual | Usa portal? | Precisa de historico? | Recorte sugerido | O que migrar | O que recriar manualmente | O que arquivar fora | Decisao final | Prioridade | Observacoes |
|---|---|---|---|---|---|---|---|---|---|---|
| Ex.: Imobiliaria X | Ativo | Sim | Sim | Ultimos 24 meses + excecoes | cards, comentarios, textos, brand brain, agenda | automacoes, coluna personalizada | arquivos antigos redundantes | Migrar completo | Alta | Cliente gosta de rever posts antigos |
| Ex.: Cliente Y | Ativo | Sim | Nao muito | Ultimos 6 meses | conta, login, cards ativos, agenda atual | organizacao do quadro | posts antigos | Migrar essencial | Alta | Quase nunca consulta historico |
| Ex.: Cliente Z | Inativo | Nao | Nao | Nenhum | nada | nada | backup completo | Arquivar fora | Baixa | Guardar por seguranca |

## Modelo enxuto

Se quiser decidir mais rapido, pode usar esta versao curta:

| Cliente/Conta | Decisao final | Prioridade | Recorte | Observacao |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

## Recortes de historico sugeridos

Voce pode usar padroes como:

- `Apenas ativos/agendados`
- `Ultimos 3 meses`
- `Ultimos 6 meses`
- `Ultimos 12 meses`
- `Ultimos 24 meses`
- `Tudo`
- `Tudo + excecoes`

## O que normalmente vale migrar

- clientes ativos
- usuarios e acessos
- contas vinculadas ao mesmo login
- cards ativos
- cards agendados
- comentarios importantes
- textos em uso
- brand brain
- idioma da conta
- permissoes
- faturas relevantes
- relatorios recentes

## O que normalmente vale recriar

- colunas personalizadas
- automacoes do cliente
- gaveta lateral
- links rapidos
- recados
- rascunhos internos

## O que normalmente vale arquivar fora

- posts muito antigos sem uso
- materiais de clientes inativos
- anexos redundantes
- relatorios antigos pouco consultados
- faturas antigas apenas para consulta eventual

## Prioridade sugerida

Use uma destas:

- `Alta`
- `Media`
- `Baixa`

### Alta

- cliente ativo
- usa o sistema
- precisa entrar cedo na V2

### Media

- cliente ativo, mas pode esperar um pouco

### Baixa

- cliente inativo
- cliente sem urgencia
- cliente so para arquivo

## Ordem pratica de preenchimento

1. listar todos os clientes
2. marcar quem esta ativo hoje
3. marcar quem realmente usa o portal
4. marcar quem precisa de historico
5. definir recorte
6. escolher a decisao final
7. revisar excecoes

## Recomendacao para a estreia da V2

Entram primeiro:

- clientes ativos
- clientes com uso frequente
- clientes com historico importante
- contas que voce quer apresentar ja no app novo

Ficam para depois:

- inativos
- pouco usados
- baguncados
- sem valor operacional agora
