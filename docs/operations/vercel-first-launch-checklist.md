---
status: runbook
owner: operations
last_verified_commit: 9fa916691ed1226233847f40b13bdfac6787c995
---

# Primeiro deploy Vercel-first

Este checklist transforma a configuração externa em uma sequência verificável.
Não registre valores secretos neste documento, em issue, chat, commit ou log.
Marque uma fase como concluída somente depois de executar a verificação
descrita.

## Estado conhecido

- time Vercel: `Neuro Capacitar`;
- team ID: `team_mHFcEG9cedToJWgCu8ikH8VE`;
- plano Pro: confirmado manualmente pela proprietária;
- projeto Vercel: `hub` (`prj_oHQOBsqhr7wlWpJoGVMTlw7ciyFg`);
- projeto Neon definitivo: `damp-snow-22911188`;
- branch Neon definitiva: `production` (`br-dark-boat-ac5ju6m4`);
- região de aplicação: `gru1`;
- repositório: `juniordinizm/hub`;
- branch de release: `main`.

O conector Vercel não expõe faturamento. A confirmação do plano continua sendo
a conferência visual em **Team Settings > Billing**. O conector deve confirmar
time, projeto e deployments; não use sua ausência de dados de billing como
prova de plano.

## Fase 1: migration definitiva

1. [x] Validar a migration em branch Neon temporária.
2. [x] Registrar migration ID, branch temporária e resultado.
3. [x] Obter autorização humana explícita para promover.
4. [x] Aplicar à branch `production` usando o fluxo de migration do Neon.
5. [x] Confirmar 44 entradas no journal e topo `0043`.
6. [x] Confirmar as tabelas `scheduled_job_leases` e
   `certificate_template_asset_cleanup`, além de
   `staged_admin_image_uploads`.
7. [x] Confirmar que a branch temporária foi removida.

Não use `db:push` e não copie a URL direta para a Vercel.

## Fase 2: criar o projeto sem deploy automático

**Status:** concluída em 2026-07-26. O projeto pertence ao time correto, está
vinculado localmente e usa Next.js/Node.js 24.x. Nenhum deployment foi criado.

Evidência registrada:

1. `vercel whoami`: `neurocapacitarprojetos`;
2. scope: `neuro-capacitar`;
3. `.vercel/project.json`: org
   `team_mHFcEG9cedToJWgCu8ikH8VE`, project
   `prj_oHQOBsqhr7wlWpJoGVMTlw7ciyFg`;
4. Framework Preset `Next.js`;
5. Node.js `24.x`;
6. variáveis de sistema expostas automaticamente;
7. Standard Deployment Protection em todos os deployments, exceto domínios
   personalizados;
8. nenhum deployment ou repositório Git conectado.

O arquivo `.vercel` e o token OIDC local permanecem ignorados pelo Git.

## Fase 3: separar Preview de Production

**Status parcial:** a branch Neon `vercel-preview`
(`br-cool-leaf-acabyy5q`) foi criada a partir do schema atual. Como branches
herdam o snapshot do pai, todos os dados copiados foram removidos imediatamente;
o journal permaneceu com 44 entradas/topo `0043`. O contrato limitado foi
implementado e passou nos testes locais. Os seis valores de runtime foram
auditados no escopo Preview: Neon, autenticação, readiness, IP, cadastro e kill
switch estão configurados; o primeiro deployment e o smoke remoto continuam
pendentes.

Não conecte Preview à branch `production`. A branch dedicada já existe e não
contém dados do ambiente definitivo.

Preview é somente um smoke de infraestrutura. Configure:

- `DATABASE_URL` pooled da branch `vercel-preview`;
- `BETTER_AUTH_SECRET` e `HEALTHCHECK_SECRET` exclusivos;
- `CLIENT_IP_SOURCE=x-forwarded-for`;
- `AUTH_PUBLIC_SIGNUP_ENABLED=false`;
- `SCHEDULED_JOBS_ENABLED=false`.

Não crie buckets, remetentes ou credenciais de AbacatePay, JMVStream, R2 ou
Resend para satisfazer o Preview. Não copie nenhum provider de Production e não
cadastre webhooks apontando para deployments Preview. Jornadas funcionais
continuam na CI e no candidato Production.

## Fase 4: variáveis na Vercel

**Status parcial:** Production já contém banco pooled, autenticação, pagamentos,
vídeo, R2, Sentry, Resend e segredos próprios. Crons permanecem desligados. O
runtime não recebeu URL direta Neon, segredo de bootstrap, variáveis E2E nem
URLs ngrok. As três URLs canônicas, `RESEND_FROM_EMAIL`, `SUPPORT_EMAIL` e
`RESEND_API_KEY` já foram cadastradas em Production. Preview não recebeu
providers e seus seis valores permitidos foram cadastrados. A listagem nominal
da Vercel confirmou `HEALTHCHECK_SECRET` somente em Preview; o workflow provará
que seu equivalente no GitHub possui o mesmo valor.

A revisão nominal removeu de Production somente os secrets órfãos
`JMVSTREAM_AUTH_EMAIL` e `JMVSTREAM_AUTH_PASSWORD`. O código não os reconhece;
`JMVSTREAM_AUTH_RESOURCE`, `JMVSTREAM_API_TOKEN` e `JMVSTREAM_PLAN_ID`
permaneceram intactos.

No projeto, abra **Settings > Environment Variables**. Cadastre valores
separadamente nos escopos Preview e Production. Nunca habilite o mesmo valor
secreto nos dois escopos apenas para economizar configuração.

### Runtime Preview

- `DATABASE_URL`: endpoint pooled da branch `vercel-preview`;
- `BETTER_AUTH_SECRET`: valor exclusivo;
- `HEALTHCHECK_SECRET`: valor exclusivo;
- `CLIENT_IP_SOURCE=x-forwarded-for`;
- `AUTH_PUBLIC_SIGNUP_ENABLED=false`;
- `SCHEDULED_JOBS_ENABLED=false`.

Não cadastre as três URLs canônicas manualmente em Preview. Habilite as
variáveis de sistema da Vercel; a aplicação deriva a origem do alias de branch.
Não cadastre `CRON_SECRET` nem credenciais de providers.

### Runtime Production

- `DATABASE_URL`: endpoint pooled do Neon do ambiente;
- `BETTER_AUTH_SECRET`;
- `BETTER_AUTH_URL`;
- `NEXT_PUBLIC_APP_URL`;
- `CERTIFICATE_PUBLIC_BASE_URL`;
- `BETTER_AUTH_TRUSTED_ORIGINS`, somente quando necessário;
- `AUTH_PUBLIC_SIGNUP_ENABLED`;
- `CLIENT_IP_SOURCE=x-forwarded-for`;
- `CRON_SECRET`;
- `SCHEDULED_JOBS_ENABLED`;
- `HEALTHCHECK_SECRET`;
- credenciais Resend, AbacatePay, JMVStream, R2 e Sentry descritas em
  [Ambiente](environment-and-local-development.md).

### Build

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: estável entre releases sobrepostas;
- `SENTRY_AUTH_TOKEN`, se source maps forem publicados;
- `NEXT_PUBLIC_SENTRY_DSN`;
- `R2_PUBLIC_BASE_URL`.

As três URLs canônicas devem usar HTTPS e a mesma origem em Production. Não
cadastre `DATABASE_URL_DIRECT`, `INTERNAL_BOOTSTRAP_SECRET`, `E2E_*`,
`SMOKE_DATABASE_URL` ou `CERTIFICATE_CONCURRENCY_DATABASE_URL` na Vercel.

Depois de salvar, use a tela da Vercel para revisar apenas nomes, ambientes e
presença. Nunca copie valores para uma conferência textual.

## Fase 5: GitHub Environments

Em `juniordinizm/hub`, abra **Settings > Environments**.

**Status externo:** `vercel-preview` está completo.
`vercel-production` foi criado com `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
`DATABASE_URL_DIRECT` da branch Neon definitiva e `HEALTHCHECK_SECRET`
sincronizado com a Vercel. Falta somente cadastrar `VERCEL_TOKEN`, reutilizando
o token vigente e não comprometido do time.

**Detalhe de Preview:** o token final
`GitHub hub deploy 2026-07` está limitado ao time `Neuro Capacitar`, que contém
somente o projeto `hub`, e expira em 2026-10-24. O token anterior sem expiração
foi revogado e os dois tokens publicados por engano não aparecem mais na
listagem. O primeiro job Preview ainda deve provar o valor compartilhado de
readiness e a credencial GitHub. Se outro projeto entrar no time, segregar os
deploys antes de reutilizar a credencial.

A sessão local atual é OAuth de aplicativo. Por isso, a tentativa opcional de
criar token project-scoped pela CLI exigiu um token clássico intermediário e
produziu erros desnecessários. O caminho operacional é:

1. No dashboard Vercel, mude o seletor para a conta pessoal.
2. Abra **Settings > Tokens** e crie `GitHub hub deploy`, com escopo
   `Neuro Capacitar` e expiração de no máximo 90 dias.
3. Substitua `VERCEL_TOKEN` nos dois GitHub Environments.
4. Depois da auditoria do novo token, revogue o token anterior.

O token nunca pertence à Vercel runtime, ao `.env`, ao chat ou ao histórico do
terminal.

### Conectar a identidade Git do autor

O CLI envia metadata do commit mesmo sem integração Git automática. Em times
Pro, a Vercel bloqueia o candidato quando o autor não está associado a uma
Login Connection do time. Não contorne essa regra alterando o autor do commit.

1. Entre na Vercel como `neurocapacitarprojetos`.
2. Abra **Account Settings > Authentication > Login Connections**.
3. Em GitHub, selecione **Connect** e autorize `juniordinizm`.
4. Confirme que `juniordinizm` aparece na conexão da mesma conta.
5. Não convide outro membro nem compre um seat adicional para a mesma pessoa.
6. Se o GitHub já estiver ligado a outra conta Vercel, pare e revise a conta
   existente antes de desconectar ou transferir a conexão.

Erros conhecidos:

- `--token ... missing a value`: a variável de memória está vazia;
- `Project-scoped tokens must be created within a team scope`: faltou
  `--scope neuro-capacitar`;
- `projectId is not supported`: o token usado já está limitado ao time e não
  pode criar outro token project-scoped;
- `Cannot create tokens for this app`: a autenticação é OAuth, não um token
  clássico de conta.

Esses erros pertencem somente ao hardening opcional project-scoped. Não é
necessário reproduzi-los enquanto o time continuar contendo apenas `hub`. Se um
token aparecer em chat, log, captura ou linha de comando, revogue-o antes de
tentar novamente. Não reutilize uma credencial exposta.

### `vercel-preview`

1. Crie o environment `vercel-preview`.
2. Adicione secret `VERCEL_TOKEN`.
3. Adicione secret `HEALTHCHECK_SECRET`, com o mesmo valor do runtime Preview
   configurado na Vercel.
4. Adicione variables `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.
5. Não adicione URL de produção, URL direta Neon ou credenciais de providers.

### `vercel-production`

1. Crie o environment `vercel-production`.
2. Não dependa de required reviewers: este repositório é privado e essa regra
   não está disponível nos planos GitHub Free/Pro/Team.
3. Adicione secret `VERCEL_TOKEN`.
4. Adicione secret `HEALTHCHECK_SECRET`, com o mesmo valor do runtime
   Production configurado na Vercel.
5. Adicione secret `DATABASE_URL_DIRECT`, com endpoint direto da branch Neon
   `production`.
6. Adicione variables `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.

A aprovação humana ocorre ao executar manualmente `Deploy Vercel production`.
O formulário exige o SHA completo do `main` verde e a confirmação
`confirm_production`. O workflow valida ambos antes de acessar migrations.

No nível do repositório, preserve `NEON_API_KEY` e `NEON_PROJECT_ID` usados
pelas branches efêmeras de integração/E2E. Eles não substituem a URL direta do
environment Production.

## Fase 6: domínio e providers

**Estado:** origem Production, domínio, remetente, API key Resend e caixa de
suporte concluídos. Em 2026-07-26, o Resend confirmou o domínio como `verified`
em `sa-east-1`, com envio habilitado e recebimento desabilitado. A caixa
`suporte@neurocapacitar.com.br` foi criada e testada no Lark Mail. O painel
Vercel confirmou `app.neurocapacitar.com.br`; DNS público, TLS e roteamento
responderam corretamente com `DEPLOYMENT_NOT_FOUND`, pois ainda não há release
Production.

### 6.1 Preservar o DNS atual

1. Entre em [hPanel](https://hpanel.hostinger.com/).
2. Abra **Domínios > Portfólio de domínios**.
3. Em `neurocapacitar.com.br`, clique em **Gerenciar**.
4. Abra **DNS / Nameservers > Registros DNS**.
5. Use **Exportar** para salvar uma cópia da zona antes de qualquer mudança.
6. Não altere nameservers, `@`, `www`, registros A existentes ou qualquer
   registro do site institucional.
7. Não use **Redefinir DNS** nem importação com opção **Substituir**.

### 6.2 Verificar e apontar `app` para a Vercel

O domínio já aparece associado a outra conta/time Vercel, provavelmente o site
institucional. Isso exige prova DNS, não transferência do domínio.

1. Na Vercel, abra o time **Neuro Capacitar** e o projeto **hub**.
2. Abra **Settings > Domains**.
3. Clique em **Add Domain** e informe `app.neurocapacitar.com.br`.
4. Se a Vercel informar que o domínio pertence a outra conta, escolha
   **Verify ownership** ou **Add existing**. Não escolha transferência.
5. A Vercel exibirá um TXT de verificação. Copie os campos **Name** e **Value**
   sem modificar.
6. Na Hostinger, adicione um registro **TXT**:
   - **Name/Host:** use o host relativo mostrado pela Vercel, sem repetir
     `.neurocapacitar.com.br` quando o hPanel já o acrescentar;
   - **Value/Content:** cole o valor completo da Vercel;
   - **TTL:** padrão/automático.
7. Volte à Vercel e clique em **Verify**. O TXT pode permanecer; não afeta o
   site.
8. A Vercel mostrará o CNAME específico do projeto. Na Hostinger, adicione:
   - **Type:** `CNAME`;
   - **Name:** `app`;
   - **Target:** valor exato mostrado pela Vercel, sem `https://` e sem caminho;
   - **TTL:** padrão/automático.
9. Se já existir algum registro com nome exatamente `app`, pare e identifique o
   uso antes de removê-lo. A auditoria de 2026-07-26 não encontrou nenhum.
10. Aguarde a Vercel mostrar **Valid Configuration** e certificado TLS válido.
11. Confirme que `https://app.neurocapacitar.com.br` responde. Um 404 antes do
    primeiro deployment é aceitável; erro DNS ou TLS não é.

Referência:
[domínio personalizado na Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

### 6.3 Caixa real de suporte

**Status:** concluído com Lark Mail.

1. [x] Criar `suporte@neurocapacitar.com.br` no Lark Mail.
2. [x] Publicar os três MX `mx1`, `mx2` e `mx3.larksuite.com`.
3. [x] Publicar o SPF raiz `include:spf.onlarksuite.com`.
4. [x] Testar recebimento e resposta com uma conta externa.
5. [x] Cadastrar `SUPPORT_EMAIL` somente em Production na Vercel.

O Lark hospeda a caixa; a Hostinger continua autoritativa apenas pelo DNS.
Registros MX/SPF do domínio raiz não conflitam com o Return-Path `send` do
Resend. Preserve a senha exclusivamente no gerenciador de credenciais.

### 6.4 Verificar o domínio raiz no Resend

1. Entre no painel do Resend com a conta de Production.
2. Abra **Domains > Add Domain**.
3. Informe somente `neurocapacitar.com.br`; não informe o endereço completo.
4. Selecione região São Paulo (`sa-east-1`) quando disponível.
5. Habilite **Sending** e mantenha **Receiving** desabilitado.
6. O Resend exibirá registros DNS. Para cada um, copie exatamente tipo, nome,
   valor e prioridade:
   - Return-Path/SPF, normalmente sob o host `send`;
   - DKIM, sob um seletor `_domainkey`;
   - tracking, somente se essa capacidade for habilitada.
7. No hPanel, adicione cada registro individualmente. O campo **Name** usa o
   host relativo; por exemplo, `send` em vez de
   `send.neurocapacitar.com.br`.
8. Não apague os MX/SPF/DKIM do Lark Mail. Não crie um segundo
   SPF com o mesmo **Name**. Se houver coincidência exata, pare e registre os
   dois valores para revisão.
9. Volte ao Resend e clique em **Verify DNS Records**.
10. Se o MX aparecer com o domínio duplicado, acrescente um ponto final ao
    target no hPanel, conforme o diagnóstico oficial do Resend.
11. Aguarde o estado **Verified**. Não crie a API key antes de concluir a
    verificação.

Referências:
[domínios Resend](https://resend.com/docs/dashboard/domains/introduction) e
[diagnóstico de DNS](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying).

### 6.5 Concluir as variáveis de e-mail na Vercel

1. [x] Criar no Resend a chave `hub-production`, restrita a envio pelo domínio
   `neurocapacitar.com.br`.
2. [x] Cadastrar a key uma única vez sem gravá-la em arquivo ou documento.
3. Na Vercel, abra **hub > Settings > Environment Variables**.
4. [x] Criar `RESEND_API_KEY`, somente em **Production**, como **Sensitive**.
5. [x] Criar `SUPPORT_EMAIL=suporte@neurocapacitar.com.br`, somente em
   **Production**.
6. Confirme também os valores já cadastrados:
   - `BETTER_AUTH_URL=https://app.neurocapacitar.com.br`;
   - `NEXT_PUBLIC_APP_URL=https://app.neurocapacitar.com.br`;
   - `CERTIFICATE_PUBLIC_BASE_URL=https://app.neurocapacitar.com.br`;
   - `RESEND_FROM_EMAIL=Neuro Capacitar <notificacoes@neurocapacitar.com.br>`.
7. [x] Em **Settings > Environment Variables**, habilite
   **Automatically expose System Environment Variables**. Preview depende de
   `VERCEL_ENV` e `VERCEL_BRANCH_URL`; `VERCEL_URL` só é fallback em
   deployments sem Standard Deployment Protection.
8. Não cadastre `RESEND_API_KEY` de Production em Preview.

### 6.6 Atualizar callbacks e validar

1. Refaça o build Production; `NEXT_PUBLIC_APP_URL` só muda em deployments
   novos.
2. Atualize Better Auth trusted origins, CORS do R2 e callbacks/webhooks dos
   providers para `https://app.neurocapacitar.com.br`.
3. Mantenha `SCHEDULED_JOBS_ENABLED=false`.
4. Envie um reset de senha a uma conta de teste.
5. No e-mail recebido, confirme:
   - remetente `notificacoes@neurocapacitar.com.br`;
   - Reply-To `suporte@neurocapacitar.com.br`;
   - link iniciado por `https://app.neurocapacitar.com.br`;
   - SPF, DKIM e DMARC aprovados nos detalhes da mensagem.
6. Responda ao e-mail e confirme chegada à caixa/encaminhamento de suporte.

Não reutilize URL de túnel, VPS ou deployment Preview como callback definitivo.

## Fase 7: primeira promoção

1. Execute todos os gates locais.
2. Faça commit da branch da sprint e abra PR para `main`.
3. Confirme CI verde e Preview smoke aprovado.
4. Revise o deployment Preview manualmente.
5. Faça merge.
6. Copie o SHA completo do `main` cuja CI terminou verde.
7. Abra **Actions > Deploy Vercel production > Run workflow**.
8. Mantenha a branch do workflow em `main`, cole o SHA em `release_sha`,
   marque `confirm_production` e execute uma única vez.
9. Observe a validação do SHA/CI, migration, auditoria, deploy e smoke; não
   inicie outro workflow.
10. Execute o smoke funcional do runbook de
    [Deploy e incidentes](deploy-and-incidents.md).
11. Somente depois, altere `SCHEDULED_JOBS_ENABLED=true` em Production e
    redeploy.

## Fase 8: evidência de conclusão

Registre no status da sprint:

- project ID e nome, nunca token;
- domínio final;
- SHA promovido;
- URL e estado do deployment;
- journal e migration de topo;
- resultado do smoke de auth, banco, upload, Certificado e crons;
- estado dos quatro crons;
- confirmação de Preview isolado;
- riscos aceitos e responsável por qualquer pendência.

O primeiro deploy não está concluído apenas porque a Vercel mostra `Ready`.
Todos os itens acima precisam de evidência.
