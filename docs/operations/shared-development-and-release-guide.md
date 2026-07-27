---
status: runbook
owner: engineering
last_verified_commit: a668d70826d7ea76c6d5ead17fe5c31f5c854d78
---

# Desenvolvimento compartilhado e deploy para Production

Este guia explica, em linguagem operacional, como preparar o computador,
desenvolver sem atingir Production e publicar uma mudança. Ele foi escrito para
quem ainda não conhece Neon, R2, Vercel ou GitHub Actions.

Não copie segredos para este documento, chat, issue ou commit. Os nomes dos
recursos podem ser registrados; senhas, tokens e URLs de banco não.

## Antes de começar

O projeto possui quatro ambientes com finalidades diferentes:

| Ambiente | Para que serve | Banco | Providers |
|---|---|---|---|
| Development | trabalho manual compartilhado | branch persistente `development` | recursos reais, mas exclusivos de Development |
| E2E | jornadas automatizadas da CI | branch efêmera apagada após o teste | storage S3 local descartável; e-mail absorvido |
| Preview | smoke de cada PR/push | branch persistente `vercel-preview`, vazia | providers proibidos |
| Production | aplicação pública | branch `production` | recursos definitivos |

Branch Git e branch Neon são independentes. Trocar de branch com `git switch`
não muda o banco. `bun run dev` usa a URL presente no `.env.local`.

### Estado atual e bloqueio

Na auditoria de 2026-07-27, o `.env.local` existente apontava ao compute Neon
de Production e continha credenciais de providers definitivos. Até concluir a
preparação deste guia, não use esse arquivo para criar, editar ou remover dados.

Antes de liberar o desenvolvimento local, todos os itens da seção
[Preparação única](#preparação-única) devem estar concluídos.

## Topologia aprovada

### Neon

- projeto: `damp-snow-22911188`;
- branch Production: `production` (`br-dark-boat-ac5ju6m4`);
- branch Preview: `vercel-preview` (`br-cool-leaf-acabyy5q`);
- nova branch compartilhada: `development`;
- pai da nova branch: `vercel-preview`, não `production`.

Em 2026-07-27, `vercel-preview` possuía as 44 migrations e zero usuários,
cursos e matrículas. Ela é uma origem limpa para `development`.

### Cloudflare R2

Development usa dois buckets:

- privado: `hub-development-private`;
- público: `hub-development-public`.

O privado recebe materiais, uploads temporários, origens e certificados. O
público recebe cópias publicadas de capas, banners e outras imagens públicas.
Uma credencial R2 exclusiva deve acessar somente esses dois buckets.

### Providers funcionais

Development deve permitir:

- entrega real de e-mails pelo Resend;
- checkout e webhook de teste da AbacatePay;
- upload e processamento real de vídeo na JMVStream;
- captura de erros reais em um projeto Sentry de Development.

“Real” significa executar a integração externa. Não significa reutilizar
conta, chave, evento, mídia ou destinatário de Production.

## Preparação única

Esta seção é executada uma vez por uma pessoa responsável pela infraestrutura.
O estagiário recebe somente os valores de Development necessários ao
`.env.local`.

### 1. Criar a branch Neon `development`

No painel Neon:

1. Abra o projeto `damp-snow-22911188`.
2. Abra **Branches**.
3. Clique em **Create branch**.
4. Informe `development`.
5. Selecione `vercel-preview` como branch pai.
6. Não selecione `production`.
7. Crie um compute com capacidade mínima e suspensão automática.
8. Copie a conexão pooled para um gerenciador de segredos.
9. Copie a conexão direta para o mesmo gerenciador.
10. Não cole nenhuma das URLs em documento ou chat.

Depois de criar, confirme:

- branch chamada exatamente `development`;
- origem `vercel-preview`;
- banco `neondb`;
- schema com 44 migrations;
- zero usuários antes do seed;
- hostname diferente do compute Production
  `ep-hidden-tooth-ac843qc2`.

Use:

- conexão pooled em `DATABASE_URL`;
- conexão direta em `DATABASE_URL_DIRECT`, somente para migrations e
  auditoria.

Não rode `db:push`. O projeto usa migrations forward-only.

### 2. Criar os buckets R2

No Cloudflare:

1. Abra **R2 Object Storage**.
2. Crie `hub-development-private`.
3. Mantenha esse bucket privado.
4. Crie `hub-development-public`.
5. Habilite acesso público somente no bucket público.
6. Copie a URL `r2.dev` do bucket público.
7. Crie uma API key chamada `hub-development`.
8. Restrinja a key aos dois buckets de Development.
9. Conceda leitura e escrita de objetos.
10. Guarde Access Key ID e Secret Access Key no gerenciador de segredos.

Configure CORS no bucket privado:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Se um túnel HTTPS for usado, acrescente a origem exata do túnel. Não use `*`.
Não acrescente `https://app.neurocapacitar.com.br` aos buckets Development.

Valores resultantes:

- `R2_ACCOUNT_ID`;
- `R2_BUCKET_NAME=hub-development-private`;
- `R2_ACCESS_KEY_ID`;
- `R2_SECRET_ACCESS_KEY`;
- `R2_PUBLIC_BUCKET_NAME=hub-development-public`;
- `R2_PUBLIC_BASE_URL` com a URL pública do bucket Development.

### 3. Preparar o Resend Development

Para separar reputação e identificação, prefira verificar
`dev.neurocapacitar.com.br` no Resend. Isso não muda o domínio Production.

1. No Resend, crie o domínio `dev.neurocapacitar.com.br`.
2. Cadastre no DNS somente os registros exibidos pelo Resend.
3. Aguarde o estado **Verified**.
4. Crie uma API key chamada `hub-development`.
5. Restrinja a key ao envio pelo domínio Development, quando o painel oferecer
   esse escopo.
6. Defina o remetente como
   `Neuro Capacitar Dev <notificacoes@dev.neurocapacitar.com.br>`.
7. Escolha uma caixa interna monitorada para receber os testes.

Valores resultantes:

- `RESEND_API_KEY`;
- `RESEND_FROM_EMAIL`;
- `SUPPORT_EMAIL`, apontando à caixa interna de teste.

Não use a API key `hub-production`. Contas fictícias devem usar somente
endereços controlados pela equipe. Antes de permitir cadastros arbitrários em
Development, implemente uma allowlist ou redirecionamento técnico de
destinatários; uma API key separada não impede envio a um endereço digitado por
engano.

Teste inicial:

1. solicite recuperação de senha de uma conta fictícia;
2. confirme a entrega;
3. confira o remetente com o sufixo `Dev`;
4. confira que o link aponta ao Development ativo;
5. confira que nenhuma mensagem apareceu na atividade da API key Production.

### 4. Preparar a AbacatePay de teste

Use somente o modo, conta ou chave de teste oferecido pelo painel AbacatePay.
Nunca use a chave financeira Production localmente.

1. Abra o ambiente de teste da AbacatePay.
2. Crie ou copie uma API key de teste.
3. Crie um webhook de teste.
4. Gere um segredo exclusivo para o webhook Development.
5. Use uma URL HTTPS pública apontando ao computador de desenvolvimento.
6. Cadastre:
   `https://ORIGEM-DEV/api/webhooks/abacatepay`.
7. Configure no painel as camadas de segredo/assinatura solicitadas pelo
   provider.
8. Não registre em logs a URL completa quando ela contiver segredo na query.

Valores resultantes:

- `ABACATE_PAY_API_KEY`;
- `ABACATEPAY_API_BASE_URL`, mantendo o default salvo se o painel de teste não
  fornecer outro endpoint;
- `ABACATEPAY_WEBHOOK_SECRET`.

Faça um checkout de valor fictício e confirme:

- Pedido criado somente no banco Development;
- webhook recebido somente pela origem Development;
- evento deduplicado em `webhook_events`;
- Concessão e Matrícula criadas somente após evento financeiro válido;
- nenhum produto ou pedido criado na conta Production.

### 5. Preparar a JMVStream Development

A integração consegue criar, mover e apagar pastas e vídeos. Uma pasta com nome
`DEV` não é isolamento suficiente se a credencial continuar autorizada a apagar
vídeos Production.

No painel ou com o suporte JMVStream:

1. Crie um recurso/aplicação dedicado chamado `hub-development`.
2. Use um plano Development separado, se a autorização continuar abrangendo
   todos os vídeos do plano atual.
3. Obtenha o UUID do recurso/aplicação.
4. Obtenha o Plan ID correspondente.
5. Confirme por consulta que a credencial Development não lista vídeos
   Production.
6. Confirme que uma tentativa de acessar ou apagar um hash Production é
   recusada.

Valores resultantes:

- `JMVSTREAM_API_BASE_URL`;
- `JMVSTREAM_AUTH_RESOURCE`, preferencial;
- `JMVSTREAM_PLAN_ID`;
- `JMVSTREAM_API_TOKEN` apenas como fallback temporário.

Se a credencial Development listar ou puder apagar ativos Production, pare. O
ambiente ainda não está isolado. Solicite um plano/conta separado antes de
entregar a credencial à equipe.

Teste com um vídeo curto sem dados pessoais. Confirme upload, complete,
processamento, player, thumbnail e remoção.

### 6. Criar o projeto Sentry Development

Use a mesma organização Sentry, mas um projeto diferente:

1. Crie o projeto `hub-development`.
2. Selecione Next.js.
3. Copie o DSN do novo projeto.
4. Configure alertas de Development sem acionar plantões Production.
5. Não configure `SENTRY_AUTH_TOKEN` localmente; ele é necessário para upload
   de source maps de build, não para capturar um erro em `next dev`.

Valores:

- `SENTRY_DSN`;
- `NEXT_PUBLIC_SENTRY_DSN`, usando o DSN público do mesmo projeto.

Gere uma exceção controlada e confirme:

- projeto `hub-development`;
- ambiente `development`;
- ausência de e-mail, nome, senha, token, query string e payload;
- `correlation_id` presente quando a falha passar pelo boundary do projeto.

### 7. Gerar segredos próprios

Gere valores diferentes de Production e com pelo menos 32 caracteres:

- `BETTER_AUTH_SECRET`;
- `INTERNAL_BOOTSTRAP_SECRET`;
- `CRON_SECRET`;
- `HEALTHCHECK_SECRET`.

Não derive um segredo do outro. Não reutilize o token Vercel, webhook secret ou
senha de usuário.

### 8. Criar dados fictícios

Development deve possuir um seed idempotente e protegido, ainda a ser
implementado, com:

- um Admin fictício;
- duas Alunas fictícias;
- um Curso publicado;
- módulos e aulas;
- uma Concessão ativa;
- uma matrícula expirada;
- progresso parcial e completo;
- certificados pendente, disponível e revogado;
- e-mails pertencentes somente à equipe de teste.

O seed deve recusar o hostname Production antes de qualquer escrita. Até esse
comando existir, não copie dados de Production e não execute o seed E2E
manualmente: ele foi criado para branches descartáveis e dados aleatórios.

## Configuração do computador

### 1. Preparar o repositório

```powershell
git switch main
git pull origin main
bun install
```

Use a versão de Bun declarada no `package.json`.

### 2. Substituir o `.env.local`

Primeiro, mova o arquivo atual para um cofre seguro ou remova-o depois de
confirmar que os valores Production já estão no gerenciador de segredos. Não
copie o conteúdo para outro arquivo dentro do repositório.

Crie um novo `.env.local` a partir de `.env.example` e preencha apenas
Development:

```dotenv
DATABASE_URL=<pooled-development>
DATABASE_URL_DIRECT=<direct-development>

BETTER_AUTH_SECRET=<development>
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
BETTER_AUTH_URL=http://localhost:3000
AUTH_PUBLIC_SIGNUP_ENABLED=false
INTERNAL_BOOTSTRAP_SECRET=<development>

NEXT_PUBLIC_APP_URL=http://localhost:3000
CERTIFICATE_PUBLIC_BASE_URL=http://localhost:3000
CLIENT_IP_SOURCE=x-forwarded-for

RESEND_API_KEY=<development>
RESEND_FROM_EMAIL=Neuro Capacitar Dev <notificacoes@dev.neurocapacitar.com.br>
SUPPORT_EMAIL=<caixa-interna-de-teste>

ABACATE_PAY_API_KEY=<test>
ABACATEPAY_API_BASE_URL=https://api.abacatepay.com/v2
ABACATEPAY_WEBHOOK_SECRET=<development>

JMVSTREAM_API_BASE_URL=https://api.jmvstream.com
JMVSTREAM_AUTH_RESOURCE=<development>
JMVSTREAM_PLAN_ID=<development>

R2_ACCOUNT_ID=<account>
R2_BUCKET_NAME=hub-development-private
R2_ACCESS_KEY_ID=<development>
R2_SECRET_ACCESS_KEY=<development>
R2_PUBLIC_BUCKET_NAME=hub-development-public
R2_PUBLIC_BASE_URL=<public-development-url>

SENTRY_DSN=<hub-development>
NEXT_PUBLIC_SENTRY_DSN=<hub-development>

CRON_SECRET=<development>
SCHEDULED_JOBS_ENABLED=true
HEALTHCHECK_SECRET=<development>

E2E_TEST_MODE=false
```

Não preencha localmente:

- `VERCEL_ENV`, `VERCEL_URL` ou `VERCEL_BRANCH_URL`;
- `SENTRY_AUTH_TOKEN`;
- `E2E_DATABASE_URL`, `E2E_R2_BUCKET_NAME` ou
  `CERTIFICATE_CONCURRENCY_DATABASE_URL`;
- qualquer credencial Production.

`SCHEDULED_JOBS_ENABLED=true` permite exercitar outbox, sincronização de vídeo
e manutenção no banco Development. Não existe agenda externa local: o
desenvolvedor chama o cron necessário de forma controlada com o Bearer
Development.

### 3. Conferência obrigatória

Antes de iniciar:

1. confira que o hostname de `DATABASE_URL` não contém
   `ep-hidden-tooth-ac843qc2`;
2. confira `R2_BUCKET_NAME=hub-development-private`;
3. confira `R2_PUBLIC_BUCKET_NAME=hub-development-public`;
4. confira que o remetente contém `Dev`;
5. confira que a chave AbacatePay é de teste;
6. confira que o projeto Sentry é `hub-development`;
7. confira que o recurso/plano JMVStream é Development;
8. confira `E2E_TEST_MODE=false`.

Em caso de dúvida, não execute a aplicação.

### 4. Iniciar

```powershell
bun run dev
```

Abra `http://localhost:3000`. O terminal deve permanecer aberto.

## Quando o webhook precisar alcançar o computador

AbacatePay não consegue chamar `localhost`. Use um túnel HTTPS apenas durante o
teste:

1. inicie `bun run dev`;
2. inicie o túnel para a porta 3000;
3. copie somente a origem HTTPS, sem path ou query;
4. altere temporariamente as três URLs canônicas para a mesma origem:
   `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` e
   `CERTIFICATE_PUBLIC_BASE_URL`;
5. adicione a origem em `BETTER_AUTH_TRUSTED_ORIGINS`;
6. adicione a origem exata ao CORS R2 privado;
7. atualize o webhook de teste AbacatePay;
8. reinicie `bun run dev`.

Ao terminar:

1. remova o webhook temporário;
2. remova a origem do CORS;
3. encerre o túnel;
4. restaure as três URLs para `http://localhost:3000`;
5. reinicie a aplicação.

Nunca aponte webhook Production para um computador.

## Fluxo diário de desenvolvimento

### 1. Atualizar e criar uma branch Git

```powershell
git switch main
git pull origin main
git switch -c feat/nome-curto-da-mudanca
```

Exemplos:

- `feat/email-expiracao`;
- `fix/upload-certificado`;
- `docs/guia-checkout`.

Não programe diretamente na `main`.

### 2. Desenvolver e testar

Execute a aplicação:

```powershell
bun run dev
```

Antes do commit, rode primeiro o teste mais relacionado à mudança. Depois:

```powershell
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run check
bun run test
bun run build
bun run knip
```

Não rode E2E contra a branch compartilhada Development. E2E limpa e recria
fixtures; a CI fornece branches descartáveis próprias.

### 3. Commit e push

Confira os arquivos:

```powershell
git status
git diff
```

Depois:

```powershell
git add <arquivos-revisados>
git commit -m "tipo: resumo objetivo"
git push -u origin HEAD
```

Nunca use `git add .` sem revisar `git status`. `.env.local` não deve aparecer.

### 4. Pull request

No GitHub:

1. abra o Pull Request para `main`;
2. explique o problema e a solução;
3. informe quais testes foram executados;
4. aguarde todos os jobs da CI;
5. não faça merge com job vermelho;
6. abra o Preview criado pela CI;
7. verifique a interface relacionada à mudança;
8. peça revisão quando a mudança envolver autenticação, pagamento, migration,
   storage ou autorização.

O Preview não testa providers. Resend, AbacatePay, JMVStream e R2 são
verificados localmente em Development e novamente no candidato Production
quando necessário.

## Deploy para Production

Deploy Production não acontece automaticamente no push.

### 1. Fazer merge

Faça merge somente depois de:

- CI verde;
- Preview aprovado;
- revisão concluída;
- migration revisada, quando existir;
- teste Development do provider afetado.

### 2. Aguardar a CI da `main`

Depois do merge, abra **GitHub > Actions > CI** e localize a execução da
`main`. Aguarde todos os jobs ficarem verdes.

Uma CI verde do Pull Request não substitui a CI do commit final da `main`.

### 3. Encontrar o SHA completo

Opção pelo terminal:

```powershell
git switch main
git pull origin main
git rev-parse HEAD
```

O resultado deve conter 40 caracteres minúsculos. Copie somente o SHA.

Opção pelo GitHub:

1. abra a execução verde da CI da `main`;
2. clique no commit exibido;
3. copie o SHA completo pela tela do commit.

### 4. Executar o workflow

No GitHub:

1. abra **Actions**;
2. escolha **Deploy Vercel production**;
3. clique em **Run workflow**;
4. mantenha a branch do workflow em `main`;
5. cole o SHA em `release_sha`;
6. marque `confirm_production`;
7. execute uma única vez.

Não inicie um segundo deploy enquanto o primeiro estiver em andamento.

### 5. Entender as etapas

O workflow:

1. prova que o SHA é o `origin/main` atual;
2. prova que existe CI verde para esse SHA;
3. instala dependências;
4. aplica migrations na branch Neon Production;
5. audita o journal de migrations;
6. cria um deployment Production sem apontar o domínio;
7. testa readiness;
8. promove o deployment verificado.

Falha antes da promoção mantém o domínio no deployment anterior. Não tente
“corrigir” executando migration ou deploy manual.

### 6. Verificação pós-deploy

Depois do workflow verde:

1. abra `https://app.neurocapacitar.com.br`;
2. confirme login;
3. teste somente a jornada alterada;
4. consulte erros recentes no Sentry Production;
5. confira logs Vercel pelo SHA e `correlationId`;
6. se a mudança afetou provider, confira o painel correspondente;
7. não use pagamento real apenas como smoke genérico.

## Quando parar e pedir ajuda

Pare sem tentar contornar quando:

- o banco local aponta ao hostname Production;
- uma chave Development lista recursos Production;
- a CI está vermelha;
- o SHA informado não é o `main` atual;
- migration falhou;
- webhook chegou sem assinatura válida;
- upload JMVStream apareceu entre vídeos Production;
- e-mail Development foi enviado a cliente;
- R2 Development escreveu no bucket Production;
- Sentry Development registrou PII ou segredo;
- o deployment não passou na readiness.

Informe:

- link da execução;
- nome do job;
- menor trecho de erro necessário;
- SHA;
- `correlationId`, quando existir.

Não informe:

- token;
- senha;
- URL de banco;
- URL assinada R2/JMVStream;
- query completa de webhook;
- payload financeiro;
- nome, e-mail ou documento de cliente.

## Rollback

Se o problema apareceu depois da promoção:

1. interrompa novas operações de risco;
2. registre SHA, horário e `correlationId`;
3. confira se houve migration;
4. não reverta SQL manualmente;
5. use o runbook de
   [Deploy e incidentes](deploy-and-incidents.md#rollback);
6. prefira promover o deployment anterior somente quando ele continuar
   compatível com o schema atual;
7. caso contrário, prepare um forward-fix revisado.

## Checklist curto

Antes de programar:

- [ ] Git branch própria.
- [ ] Banco `development`.
- [ ] Buckets `hub-development-*`.
- [ ] Providers identificados como Development/Test.
- [ ] Nenhum segredo Production no `.env.local`.

Antes do PR:

- [ ] Teste relacionado passou.
- [ ] Gates locais passaram.
- [ ] `git diff` revisado.
- [ ] `.env.local` ausente do commit.

Antes de Production:

- [ ] PR aprovado e merged.
- [ ] CI da `main` verde.
- [ ] SHA completo da `main`.
- [ ] Workflow manual executado uma vez.
- [ ] Readiness e promoção verdes.
- [ ] Smoke e observabilidade conferidos.

## Evidências

`.github/workflows/ci.yml`, `.github/workflows/deploy-vercel.yml`,
`.env.example`, `playwright.config.ts`, `src/lib/env.ts`,
`src/lib/preview-environment.ts`, `src/lib/production-environment.ts`,
`src/features/storage/r2.ts`, `src/features/email/server.ts`,
`src/features/payments/abacatepay-client.ts`, `src/features/jmvstream/client.ts`
e `src/lib/sentry-options.ts`.
