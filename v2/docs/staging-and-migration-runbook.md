# Preparação do ambiente de teste e migração

## Regra principal

O app antigo continua sendo a fonte oficial até a virada final. O ambiente de
teste da V2 pode receber dados reais para conferência, mas clientes não devem
trabalhar simultaneamente nos dois sistemas.

## Arquitetura esperada

- frontend React servido pela própria aplicação Fastify
- API Node acessível no mesmo domínio pelo caminho `/api`
- banco MySQL separado e vazio para a V2
- pasta persistente para uploads, fora da pasta substituída a cada deploy
- HTTPS ativo

Manter frontend e API no mesmo domínio evita configuração adicional de CORS e
faz com que os arquivos em `/api/uploads/...` continuem funcionando.

## 1. Antes do primeiro deploy

1. Consolidar uma versão estável do código.
2. Confirmar que o plano de hospedagem mantém um processo Node ativo.
3. Criar um banco MySQL exclusivo para o ambiente de teste.
4. Criar uma pasta persistente e protegida por backup para uploads.
5. Copiar `.env.staging.example` para um arquivo secreto no servidor e preencher
   os valores reais.
6. Nunca ativar `DEMO_MODE` fora do desenvolvimento local.

## 2. Verificação do código

Na pasta `v2`, executar:

```sh
npm ci
npm run prepare:staging
```

Esse comando valida TypeScript e gera os pacotes do frontend e da API.

## 3. Preparação do banco vazio

Com as variáveis do ambiente de teste carregadas, executar:

```sh
npm run db:prepare:staging
```

Esse comando cria somente tabelas, colunas e relacionamentos. Ele não insere os
usuários, senhas ou conteúdos fictícios usados no ambiente local.

Antes de repetir o comando em um banco que já contenha dados, fazer backup.

## 4. Publicação técnica

1. Definir `v2` como diretório raiz do projeto na hospedagem.
2. Executar o build com `npm run build`.
3. Iniciar a aplicação com `npm run start:api`.
4. A aplicação Fastify serve o frontend compilado e mantém a API em `/api`.
5. Abrir `/api/health` e confirmar uma resposta de sucesso.

## 5. Migração de ensaio

1. Executar primeiro o extrator legado em modo de conferência.
2. Guardar o backup bruto sem alterações.
3. Importar uma única conta prioritária.
4. Copiar as mídias dessa conta para a pasta persistente.
5. Comparar contagens, datas, colunas, cards, comentários e permissões.
6. Corrigir o processo e só então repetir para as demais contas.

O extrator atual gera os arquivos JSON e o manifesto de mídias. Para validar os
arquivos sem gravar no banco:

```sh
npm run import:legacy
```

O modo de simulação é o padrão. Depois da conferência e de um backup do banco,
a importação real é liberada explicitamente:

```sh
npm run import:legacy -- --commit
```

O importador preserva os identificadores do legado e atualiza registros já
importados, permitindo repetir o ensaio sem duplicar dados. Usuários novos são
criados inativos e sem senha utilizável; eles devem ser ativados somente depois
da definição do fluxo de primeiro acesso. A cópia física das mídias listadas no
manifesto continua sendo uma etapa separada.

### Preservação das mídias

O manifesto bruto da exportação também pode ser transformado em um backup local
retomável. Links externos permanecem como links; somente objetos do storage
legado são copiados:

```sh
npm --workspace @design-hub-v2/api run backup:legacy-media -- \
  --input /caminho/media-manifest.json \
  --output /caminho/backup-midia
```

Depois, envie o backup para a pasta persistente da aplicação e substitua as
referências do banco:

```sh
npm --workspace @design-hub-v2/api run migrate:legacy-media -- \
  --backup-dir /caminho/backup-midia \
  --api-base https://dominio-da-v2
```

Os dois comandos registram o progresso. Se houver interrupção, uma nova execução
continua apenas os arquivos pendentes. Arquivos que já estavam ausentes no
storage legado são mantidos no relatório de falhas para revisão manual.

## 6. Virada oficial

1. Definir uma janela curta sem novas alterações no app antigo.
2. Fazer o backup e a exportação finais.
3. Importar apenas o que mudou desde o ensaio.
4. Validar acessos e dados.
5. Trocar o domínio oficial.
6. Manter o legado disponível somente para contingência durante o período
   combinado.

## Informações ainda necessárias da hospedagem

- suporte a processo Node persistente
- versão de Node disponível
- comando e diretório de inicialização
- dados de conexão MySQL
- forma de configurar variáveis secretas
- configuração de proxy para `/api`
- caminho persistente para uploads
- rotina de backup do banco e dos uploads
