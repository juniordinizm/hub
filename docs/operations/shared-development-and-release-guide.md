---
status: runbook
owner: engineering
last_verified_commit: 34f35e12a4cbe9b6e3b14bfda176bf7ec5501d2b
---

# Desenvolvimento compartilhado

Este guia explica, em linguagem operacional, como preparar o computador e
desenvolver sem atingir Production. Para publicar uma mudança, use o
[tutorial da alteração até Production](production-release-guide.md), que é a
autoridade do procedimento diário de release.

Não copie segredos para este documento, chat, issue ou commit. Os nomes dos
recursos podem ser registrados; senhas, tokens e URLs de banco não.

## Antes de começar

O projeto possui cinco ambientes com finalidades diferentes:

| Ambiente | Para que serve | Banco | Providers |
|---|---|---|---|
| Development | desenvolvimento local com recursos de teste compartilhados | branch persistente `development` | recursos reais, mas exclusivos de Development |
| E2E | jornadas automatizadas da CI | branch efêmera apagada após o teste | storage S3 local descartável; e-mail absorvido |
| Preview | smoke de cada PR/push | branch persistente `vercel-preview`, vazia | providers proibidos |
| Staging | homologação pré-produção na URL de teste | branch Neon configurada pelo Environment `vercel-staging` | providers de Staging; R2 Development com namespace `staging/` |
| Production | aplicação pública | branch `production` | recursos definitivos |

`development` é o ambiente usado pelo código rodando localmente; seus recursos
persistentes são compartilhados apenas entre estações autorizadas. `staging` é a
etapa de pré-produção para homologação manual. A branch Git `main` representa o
candidato de Production, mas o merge sozinho não publica o domínio: a promoção
continua protegida pelo workflow manual `Deploy Vercel production`.

Branch Git e branch Neon são independentes. Trocar de branch com `git switch`
não muda o banco. `bun run dev` usa a URL presente no `.env.local`.

### Estado atual

Em 2026-07-27, a estação principal passou pelo preflight de Development com o
compute Neon `ep-silent-leaf-aclmy5uk`, os dois buckets
`hub-development-*`, o plano JMVStream compartilhado aprovado e o projeto
Sentry Development. A configuração está liberada para desenvolvimento.

Em uma estação nova, conclua todos os itens da seção
[Preparação única](#preparação-única) antes de executar a aplicação.

Estado confirmado em 2026-07-27:

- buckets `hub-development-private` e `hub-development-public` criados;
- API key, acesso público e CORS dos buckets R2 Development configurados;
- branch Neon `development` (`br-cool-voice-acsxtxyv`) criada com compute
  `ep-silent-leaf-aclmy5uk`;
- a leitura da branch confirmou 44 migrations e zero usuários, cursos e
  matrículas antes do seed;
- Resend Development reutiliza o domínio verificado
  `neurocapacitar.com.br`, protegido por allowlist de destinatários;
- JMVStream reutiliza conscientemente o plano Production `OD-20912`;
- Asaas usa Sandbox e Sentry usa projeto Development separado.

## Topologia aprovada

### Neon

- projeto: `damp-snow-22911188`;
- branch Production: `production` (`br-dark-boat-ac5ju6m4`);
- branch Preview: `vercel-preview` (`br-cool-leaf-acabyy5q`);
- branch compartilhada: `development` (`br-cool-voice-acsxtxyv`);
- compute Development: `ep-silent-leaf-aclmy5uk`;
- pai da branch: `vercel-preview`, não `production`.

Em 2026-07-27, a branch `development` possuía 44 migrations e zero usuários,
cursos e matrículas antes do seed.

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
- checkout e webhook de teste do Asaas Sandbox;
- upload e processamento real de vídeo na JMVStream;
- captura de erros reais em um projeto Sentry de Development.

“Real” significa executar a integração externa. JMVStream é a única exceção:
reutiliza o plano Production por decisão explícita e exige cuidados adicionais
com operações destrutivas.

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

Development reutiliza o domínio Resend verificado
`neurocapacitar.com.br`. Não é necessário criar subdomínio adicional.

1. Use um remetente identificado como
   `Neuro Capacitar Dev <notificacoes@neurocapacitar.com.br>`.
2. Escolha uma caixa interna monitorada para receber os testes.
3. Cadastre somente caixas internas controladas em
   `DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST`.

Valores resultantes:

- `RESEND_API_KEY`;
- `RESEND_FROM_EMAIL`;
- `SUPPORT_EMAIL`, apontando à caixa interna de teste.

O domínio e a credencial compartilhados ampliam o impacto de um vazamento
local. Contas fictícias devem usar somente endereços controlados pela equipe.
A allowlist obrigatória bloqueia destinatários arbitrários antes que o cliente
Resend seja construído.

Teste inicial:

1. solicite recuperação de senha de uma conta fictícia;
2. confirme a entrega;
3. confira o remetente com o sufixo `Dev`;
4. confira que o link aponta ao Development ativo;
5. tente um destinatário fora da allowlist e confirme que o envio é bloqueado.

### 4. Preparar o Asaas Sandbox

Use somente a conta e a chave Sandbox. Nunca use a credencial financeira
Production localmente.

1. Configure `ASAAS_API_BASE_URL=https://api-sandbox.asaas.com`.
2. Crie ou copie uma `ASAAS_API_KEY` Sandbox.
3. Defina um `ASAAS_USER_AGENT` estável com produto e contato técnico.
4. Crie um webhook Sandbox para `/api/webhooks/asaas`.
5. Gere um `ASAAS_WEBHOOK_TOKEN` exclusivo para Development.
6. Mantenha `ASAAS_WEBHOOK_ENABLED=true` somente enquanto o pipeline Sandbox
   estiver sob teste.

Faça um checkout de valor fictício e confirme:

- Pedido criado somente no banco Development;
- webhook autenticado e recebido somente pela origem Development;
- evento deduplicado em `webhook_events`;
- Concessão e Matrícula criadas somente após evento financeiro válido;
- nenhum checkout ou pagamento criado na conta Production.

O contrato completo e os limites do ensaio ficam em
[Asaas](../integrations/asaas.md).

### 5. Preparar a JMVStream Development

A integração reutiliza o plano Production `OD-20912`. A API oficial permite
excluir vídeo por hash e Plan ID; portanto, não existe isolamento técnico entre
os vídeos de teste e os vídeos reais.

Configure:

- `JMVSTREAM_API_BASE_URL=https://api.jmvstream.com`;
- `JMVSTREAM_AUTH_RESOURCE`, preferencial;
- `JMVSTREAM_PLAN_ID=OD-20912`;
- `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION=true`;
- `JMVSTREAM_API_TOKEN` apenas como fallback temporário.

Regras obrigatórias:

1. envie somente um vídeo curto, descartável e sem dados pessoais;
2. não associe hashes preexistentes por URL;
3. não teste remoção, movimentação ou retry com ativos que não tenham sido
   criados pelo próprio Development;
4. confira o hash e a Aula local antes de qualquer deleção;
5. trate a credencial local como segredo Production.

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

Development possui o comando protegido:

```powershell
bun run db:seed:development
```

Ele exige hostname Neon confirmado e
`SHARED_DEVELOPMENT_SEED_CONFIRMATION=development`, recusa o compute Production
e cria fixtures estáveis sem truncar tabelas ou chamar providers. O conjunto
inicial inclui:

- um Admin fictício;
- uma Aluna fictícia;
- um Curso publicado;
- módulos e aulas;
- uma Concessão ativa;
- e-mails pertencentes somente à equipe de teste.

Estados adicionais de expiração, progresso e certificado continuam cobertos
pelo E2E descartável e podem ser criados manualmente quando uma jornada exigir.
Não execute o seed E2E na branch compartilhada.

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
DEVELOPMENT_DATABASE_HOST=<host-direto-development>
SHARED_DEVELOPMENT_SEED_CONFIRMATION=development
DEVELOPMENT_ADMIN_EMAIL=<caixa-interna-allowlisted>
DEVELOPMENT_ADMIN_PASSWORD=<segredo>
DEVELOPMENT_STUDENT_EMAIL=<caixa-interna-allowlisted>
DEVELOPMENT_STUDENT_PASSWORD=<segredo>

BETTER_AUTH_SECRET=<development>
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
BETTER_AUTH_URL=http://localhost:3000
AUTH_PUBLIC_SIGNUP_ENABLED=false
INTERNAL_BOOTSTRAP_SECRET=<development>

NEXT_PUBLIC_APP_URL=http://localhost:3000
CERTIFICATE_PUBLIC_BASE_URL=http://localhost:3000
CLIENT_IP_SOURCE=x-forwarded-for

RESEND_API_KEY=<development>
DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST=<emails-internos-separados-por-virgula>
RESEND_FROM_EMAIL=Neuro Capacitar Dev <notificacoes@neurocapacitar.com.br>
SUPPORT_EMAIL=<caixa-interna-de-teste>

ASAAS_API_BASE_URL=https://api-sandbox.asaas.com
ASAAS_API_KEY=<sandbox>
ASAAS_USER_AGENT=hub-development/1.0 <contato-tecnico>
ASAAS_WEBHOOK_TOKEN=<development>
ASAAS_WEBHOOK_ENABLED=true

JMVSTREAM_API_BASE_URL=https://api.jmvstream.com
JMVSTREAM_AUTH_RESOURCE=<production-compartilhado>
JMVSTREAM_PLAN_ID=OD-20912
DEVELOPMENT_JMVSTREAM_USES_PRODUCTION=true

R2_ACCOUNT_ID=<account>
R2_BUCKET_NAME=hub-development-private
R2_ACCESS_KEY_ID=<development>
R2_SECRET_ACCESS_KEY=<development>
R2_PUBLIC_BUCKET_NAME=hub-development-public
R2_PUBLIC_BASE_URL=<public-development-url>

SENTRY_DSN=<hub-development>
NEXT_PUBLIC_SENTRY_DSN=<hub-development>
DEVELOPMENT_SENTRY_PROJECT_ID=<id-numerico-hub-development>

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
- qualquer credencial Production, exceto a JMVStream explicitamente aprovada.

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
5. confira que a base URL e a chave Asaas pertencem ao Sandbox;
6. confira que o projeto Sentry é `hub-development`;
7. confira `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION=true` e trate a credencial
   JMVStream como Production;
8. confira `E2E_TEST_MODE=false`.

Em caso de dúvida, não execute a aplicação.

### 4. Iniciar

```powershell
bun run dev
```

O comando executa `check-development-environment.ts` antes do Next. Ele recusa
fingerprints Production, recursos ausentes e confirmações inconsistentes sem
imprimir segredos. Abra `http://localhost:3000` somente depois da mensagem
`Development environment verified`.

## Quando outro provider precisar de uma origem pública

Se um provider exigir uma origem HTTPS pública, use um túnel apenas durante o
teste:

1. inicie `bun run dev`;
2. inicie o túnel para a porta 3000;
3. copie somente a origem HTTPS, sem path ou query;
4. altere temporariamente as três URLs canônicas para a mesma origem:
   `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` e
   `CERTIFICATE_PUBLIC_BASE_URL`;
5. adicione a origem em `BETTER_AUTH_TRUSTED_ORIGINS`;
6. adicione a origem exata ao CORS R2 privado;
7. atualize o webhook de teste do provider;
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
bun run verify:quick
```

`verify:quick` executa, em ordem, integridade das migrations, typecheck, estilo e
testes. Antes de abrir o Pull Request, execute o perfil completo:

```powershell
bun run verify
```

`verify` acrescenta documentação, build Production e Knip. Ambos param no
primeiro gate vermelho e mostram qual comando falhou. O build recebe somente
as variáveis sintéticas mínimas de aplicação exigidas pela compilação e não
exige copiar `.env.local` para um worktree limpo.

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

O Preview não testa providers. Resend, Asaas, JMVStream e R2 são
verificados localmente em Development e novamente no candidato Production
quando necessário.

O banco persistente `vercel-preview` também não recebe migrations de Pull
Request. Mudanças de schema são validadas nas branches Neon descartáveis das
jobs PostgreSQL, E2E e Preview. A última cria uma branch própria, migra, injeta
sua URL somente no deployment candidato, executa readiness e apaga a branch.
Quando a revisão manual depender do schema novo, use outra branch Neon
temporária; nunca aplique migration de PR no Preview compartilhado.

### 5. Sincronizar o banco Development depois do merge

Quando o Pull Request contiver migration, aguarde a CI verde do commit final da
`main`. Depois, no GitHub:

1. abra **Actions**;
2. escolha **Migrate Neon development**;
3. clique em **Run workflow**;
4. mantenha a branch em `main`;
5. marque `confirm_development`;
6. execute uma única vez e aguarde migration e auditoria verdes.

O workflow deriva o SHA da `main`, exige CI verde e confere o hostname do secret
`DATABASE_URL_DIRECT` contra `DEVELOPMENT_DATABASE_HOST` antes de abrir a
conexão. Ele não aceita migration de uma feature ainda não integrada.

## Da mudança local até Production

Este guia termina no desenvolvimento compartilhado. O procedimento único de
commit, Pull Request, CI, migration Development, merge e promoção Vercel está
no [tutorial da alteração até Production](production-release-guide.md).

Resumo da fronteira:

- push cria CI e Preview, mas não publica Production;
- merge atualiza `main`, mas também não publica Production;
- migration em Development é manual e só ocorre depois do merge;
- migration e deploy Production acontecem juntos no workflow manual
  `Deploy Vercel production`;
- não é necessário copiar ou digitar SHA.

## Quando parar e pedir ajuda

Pare sem tentar contornar quando:

- o banco local aponta ao hostname Production;
- um provider não aprovado lista recursos Production;
- a CI está vermelha;
- o workflow informa que o checkout não é a `main` atual;
- migration falhou;
- webhook chegou sem assinatura válida;
- JMVStream alterou ou removeu um ativo preexistente;
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
- [ ] Providers identificados como Development/Test, com exceção JMV registrada.
- [ ] Nenhum segredo Production no `.env.local`, exceto JMV aprovada.

Antes do PR:

- [ ] Teste relacionado passou.
- [ ] Gates locais passaram.
- [ ] `git diff` revisado.
- [ ] `.env.local` ausente do commit.

Antes de Production:

- [ ] PR aprovado e merged.
- [ ] CI da `main` verde.
- [ ] Nenhuma migration presa no bloqueio conhecido de Preview.
- [ ] Migration Development executada, quando houver migration.
- [ ] Workflow `Deploy Vercel production` executado uma vez.
- [ ] Readiness e promoção verdes.
- [ ] Smoke e observabilidade conferidos.

## Evidências

`.github/workflows/ci.yml`, `.github/workflows/deploy-vercel.yml`,
`.github/workflows/migrate-development.yml`,
`.env.example`, `playwright.config.ts`, `src/lib/env.ts`,
`src/lib/preview-environment.ts`, `src/lib/production-environment.ts`,
`src/features/storage/r2.ts`, `src/features/email/server.ts`,
`src/features/payments/asaas-client.ts`, `src/features/jmvstream/client.ts`,
`src/lib/sentry-options.ts`, `src/db/migration-target.ts` e
`scripts/migrate-development.ts`.
