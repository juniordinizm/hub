---
status: accepted
owner: engineering
last_verified_commit: 9fa916691ed1226233847f40b13bdfac6787c995
---

# Migração Vercel-first

## Objetivo

Tornar a Vercel Pro o ambiente primário do Hub, preservando Next.js, Neon,
Cloudflare R2, Better Auth, Resend, JMVStream, AbacatePay, PDFKit e Sharp. A
migração remove pressupostos do runtime de container quando eles prejudicam a
execução serverless. A instalação anterior na VPS não é requisito de
compatibilidade nem rollback.

## Decisões

1. O projeto usa a integração nativa de Next.js da Vercel, com Functions Node.js
   na região `gru1`, próxima ao Neon definitivo em `aws-sa-east-1`.
2. O runtime web recebe somente a URL pooled do Neon. URL direta continua
   restrita ao job controlado de migration.
3. Arquivos que podem exceder o limite de request da Vercel são enviados
   diretamente ao bucket privado do R2. A aplicação confirma o objeto, processa
   formatos definitivos e reconcilia temporários.
4. Nenhum trabalho distribuído depende de estado de sessão do PostgreSQL.
   Exclusão mútua usa lease persistente com fencing ou claim transacional.
5. Vercel Cron é o scheduler de produção. Rotas possuem autenticação, duração,
   deadline interno, idempotência, observabilidade e chave geral de ativação.
6. A CI mantém os gates existentes, valida migrations e solicita um build
   remoto à Vercel. Produção é criada sem promoção de domínio; a promoção só
   ocorre depois de migration, auditoria e smoke autenticado da readiness.
7. Preview é um smoke de infraestrutura, não um ambiente de homologação
   funcional. Ele usa somente a branch Neon `vercel-preview`, sanitizada, e os
   segredos próprios de autenticação e readiness. Jobs e integrações externas
   permanecem desabilitados. Jornadas funcionais continuam na CI; integrações
   definitivas pertencem ao candidato Production ainda não promovido.
8. A origem canônica de Production é
   `https://app.neurocapacitar.com.br`. Preview prefere o alias de branch
   exposto em `VERCEL_BRANCH_URL`; `VERCEL_URL` é apenas fallback para
   deployments sem Standard Deployment Protection. As três URLs explícitas
   continuam obrigatórias em Production para impedir que links definitivos
   apontem por engano para `*.vercel.app`.
9. O domínio de envio verificado no Resend é `neurocapacitar.com.br`, com
   remetente `Neuro Capacitar <notificacoes@neurocapacitar.com.br>`. A
   proprietária aceitou que a reputação do envio transacional fique acoplada
   ao domínio raiz em troca de um endereço mais simples.
10. `notificacoes@neurocapacitar.com.br` não é uma caixa de entrada.
    Respostas e contatos usam `suporte@neurocapacitar.com.br`, que precisa ser
    uma caixa ou encaminhamento real e monitorado.

## Arquitetura

### Runtime e banco

`next.config.ts` não gera `standalone` na Vercel. A região é fixada em `gru1`;
Node.js 24 é o runtime suportado. `getDatabasePoolOptions` reduz o pool por
instância na Vercel sem alterar o pool local. O código continua inicializando
Postgres e SDKs de forma lazy.

### Uploads

O navegador solicita uma preparação autenticada contendo chave temporária e URL
assinada. Depois do PUT, confirma tamanho, MIME e ownership. O backend lê a
chave temporária do R2, valida pixels e conteúdo decodificado, produz os
artefatos definitivos e só então persiste a referência. A chave temporária é
apagada após sucesso; falhas ficam disponíveis para reconciliação por idade.

O contrato cobre fundo e assinatura de Certificado, banner e capa de Curso.
Materiais de Aula e JMVStream preservam os fluxos diretos existentes.

### Jobs

Cada cron passa por uma entrada comum que:

- exige `Authorization: Bearer <CRON_SECRET>`;
- recusa execução quando `SCHEDULED_JOBS_ENABLED` não é `true`;
- cria correlação e registra resultado;
- fornece deadline monotônico ao caso de uso.

JMVStream usa lease persistente e token de fencing. Outbox para de reclamar
novos itens antes do deadline e deixa itens pendentes para a próxima execução.
Jobs diários permanecem idempotentes e seu runbook exige alerta por falha, pois
Vercel Cron não oferece retry.

### Deploy

A Vercel é ligada ao time `Neuro Capacitar`. O workflow usa Vercel CLI fixada e
`vercel deploy` com build remoto. Produção usa deployment imutável sem promoção
de domínio, migration explícita, smoke de `/api/health/ready` e
`vercel promote`. Credenciais do CLI ficam somente no GitHub; credenciais do
runtime ficam somente nos ambientes da Vercel.

Como o repositório é privado e required reviewers de GitHub Environments não
estão disponíveis nos planos Free/Pro/Team, Production não parte de
`workflow_run`. A proprietária dispara `workflow_dispatch`, informa o SHA
completo e confirma Production. O job exige que esse SHA seja o `main` atual e
tenha uma execução `CI` verde antes de migration ou deployment.

### Perfil Preview limitado

O perfil é derivado de `VERCEL_ENV`; não existe uma segunda flag capaz de
divergir do ambiente real da Vercel. Quando `VERCEL_ENV=preview`, a validação
do runtime exige:

- `DATABASE_URL` pooled da branch Neon `vercel-preview`;
- `BETTER_AUTH_SECRET` exclusivo;
- `HEALTHCHECK_SECRET` exclusivo;
- `SCHEDULED_JOBS_ENABLED=false`;
- `CLIENT_IP_SOURCE=x-forwarded-for`;
- origem resolvida por `VERCEL_BRANCH_URL`, ou por `VERCEL_URL` apenas quando o
  deployment não usa Standard Deployment Protection.

O perfil recusa `DATABASE_URL_DIRECT`, `INTERNAL_BOOTSTRAP_SECRET`, variáveis
E2E, segredos de AbacatePay, JMVStream, R2 e Resend, além de jobs habilitados.
Production preserva a validação integral existente. Development e testes
continuam com defaults locais.

A branch Preview permanece vazia e sanitizada. O deployment prova build remoto,
inicialização do runtime e conectividade com Postgres por
`/api/health/ready`. Ele não promete login com fixture, upload, pagamento,
vídeo, e-mail ou revisão manual de telas. Isso evita uma falsa homologação e
elimina a duplicação de providers apenas para satisfazer o pipeline.

### Domínio e e-mail

A Hostinger continua autoritativa pelo DNS. O domínio raiz e `www` pertencem ao
site institucional e não são alterados pela migração do Hub. Somente
`app.neurocapacitar.com.br` é associado ao projeto `hub` por meio do CNAME exato
fornecido pela Vercel.

O Resend verifica o domínio raiz sem assumir recebimento de e-mail. Seus
registros SPF/Return-Path e DKIM usam os nomes exatos apresentados no painel e
podem coexistir com o site. Nenhum registro existente é removido por
inferência. `SUPPORT_EMAIL` só recebe o endereço institucional depois que a
caixa ou encaminhamento for testado de fora do domínio.

## Interfaces de teste aprovadas

- `vercel.json`, `next.config.ts` e política de pool como contratos públicos de
  deployment;
- funções de preparação/confirmação de upload e os Server Actions que as
  consomem;
- Route Handlers `/api/cron/*` e resultados observáveis dos casos de uso;
- lease persistente de job, outbox e reconciliação como interfaces de
  concorrência;
- workflow GitHub como gate de promoção;
- validações separadas de Preview e Production como autoridade das variáveis;
- `/api/health/ready` como única superfície remota obrigatória do Preview.

## Falhas e segurança

- Upload não confirmado nunca vira referência de domínio.
- Chave de upload deve pertencer ao tipo, ator e agregado esperado.
- HEAD não substitui decodificação da imagem.
- Retry não sobrescreve artefato definitivo existente.
- Function interrompida perde somente trabalho reclamável, nunca o estado
  transacional.
- Preview não recebe secrets ou dados de produção.
- Preview falha o deployment se receber credenciais de provider, URL direta,
  segredo de bootstrap, variável E2E ou jobs habilitados.
- `DATABASE_URL_DIRECT`, `INTERNAL_BOOTSTRAP_SECRET` e variáveis E2E são
  proibidas no runtime.

## Critérios de conclusão

- Nenhum request aceito pelo produto pode exceder 4,5 MiB por carregar arquivo.
- Nenhum lock de sessão é usado pelo runtime pooled.
- Os quatro crons têm duração e deadline compatíveis com Vercel Pro.
- Há apenas um scheduler de produção, ativado explicitamente.
- Build Vercel inclui Sharp, PDFKit, QRCode e fontes necessárias.
- CI, migrations, docs, testes, typecheck, Ultracite, build e E2E passam.
- Preview usa Neon isolado, passa readiness autenticada e não recebe
  credenciais dos providers de Production.
- Runbook permite que uma pessoa iniciante configure projeto, ambientes,
  domínio, providers e promoção sem inferir valores.
