---
status: runbook
owner: operations
last_verified_commit: a3b0e20ed663e455ecdc5367310592b3d073d6f6
---

# Checklist das pendências externas

Este runbook explica como fechar os gates que o código não consegue provar
sozinho. Ele deve ser executado por uma pessoa júnior acompanhada por uma
supervisora quando houver acesso a Production, DNS, GitHub secrets ou dinheiro.

## Regra importante sobre MFA

MFA administrativo não faz parte do produto atual. Não procure uma tela de
configuração, não crie códigos TOTP e não ative uma variável de enforcement. As
migrations históricas de MFA permanecem no banco apenas para evitar uma remoção
destrutiva; elas não são usadas pelo runtime.

## Antes de começar

1. Abra o [estado de release](release-state.md) e anote o SHA e o ambiente que
   realmente estão documentados. Não use um SHA digitado de memória.
2. Confirme com a supervisora quais ações podem ser executadas. Emitir um evento
   Sentry, alterar DNS, trocar secret e restaurar banco são ações diferentes.
3. Nunca cole senha, token, URL de banco, conteúdo de e-mail, XML DMARC, dump,
   chave `age` privada ou payload bruto em chat, issue, commit ou log.
4. Ao registrar evidência, use somente SHA, ambiente, horário UTC, status, IDs
   operacionais e contagens sanitizadas.

## 1. Provar Sentry em Production

### O objetivo

Provar quatro coisas ao mesmo tempo: o evento chegou ao projeto Sentry correto,
tem o ambiente e o release esperados, o código aparece com source map e o alerta
chegou ao canal monitorado. O teste não faz deploy nem altera o Sentry, mas gera
um evento operacional; por isso precisa de autorização.

### Preparação da supervisora

No GitHub, no Environment `vercel-production`, confirme apenas a presença dos
nomes abaixo. Nunca revele os valores:

- secrets: `SENTRY_READINESS_SECRET` e `SENTRY_READINESS_AUTH_TOKEN`;
- variables: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_PROJECT_ID` e
  `SENTRY_READINESS_ALERT_NAME`.

No Sentry, o alerta cujo nome está em `SENTRY_READINESS_ALERT_NAME` deve estar
ativo, ligado ao projeto `SENTRY_PROJECT` e ter o campo **Environment** definido
exatamente como `production` (minúsculas). Deixar o campo vazio, usar
`Production` ou manter um alerta global não fecha este gate.

O workflow correto é `.github/workflows/verify-production-sentry.yml`, chamado
**Verify Sentry Production readiness**. Execute a versão que já esteja na branch
aprovada pela equipe, normalmente `main`.

### Passo a passo

1. Entre no GitHub e abra **Actions**.
2. Escolha **Verify Sentry Production readiness**.
3. Clique em **Run workflow** e selecione a branch aprovada.
4. No campo `release_sha`, cole o SHA completo, em minúsculas, com 40 caracteres,
   do deployment Production que será verificado.
5. No campo `confirmation`, digite exatamente
   `EMIT_SENTRY_PRODUCTION_READINESS`.
6. Clique em **Run workflow** uma única vez e aguarde os três passos da job.
7. A saída permitida contém `eventId`, `correlationId`, ambiente, release e
   resultados booleanos. Guarde esses identificadores no registro de release;
   não copie secrets nem o payload do evento.

### Resultado esperado

O último passo termina verde e informa, de forma equivalente, `match=true`,
`sourceMapped=true` e `alertTriggered=true`, com `environment=production` e o
SHA esperado. Se aparecer `401` ou `403`, pare: normalmente é bearer/secret
incorreto. Se aparecer erro de release, projeto, source map ou alerta, não marque
o gate como resolvido; a supervisora deve corrigir a configuração e repetir a
prova autorizada.

## 2. Fechar e-mail, Resend e DMARC

Há duas provas diferentes: o Resend precisa convergir no lifecycle da mensagem,
e o DNS precisa permanecer correto durante as janelas de observação DMARC.
“Resend aceitou” não significa “a mensagem chegou à caixa”.

### 2.1 Provar um lifecycle controlado do Resend

1. Confirme que a caixa de teste está na `STAGING_EMAIL_RECIPIENT_ALLOWLIST`.
   Use uma caixa da equipe, nunca uma cliente real.
2. Em **Actions**, abra **Run Staging jobs**.
3. Clique em **Run workflow**, selecione a branch `staging`, escolha a operação
   `verify-resend-lifecycle` e digite exatamente
   `SEND_CONTROLLED_STAGING_PASSWORD_RESET`.
4. Execute uma vez e aguarde a job. Ela usa `RESEND_READINESS_SECRET`, cria uma
   mensagem controlada e roda o worker de webhook.
5. O resultado esperado inclui `email.sent`, `email.delivered`, mensagem em
   estado `delivered`, zero conflito e zero erro. Registre apenas a correlação e
   as contagens.
6. Abra a caixa de teste e confirme o recebimento. No menu de detalhes, abra os
   cabeçalhos originais e procure `Authentication-Results` e `DKIM-Signature`.
   Confirme SPF, DKIM e DMARC como `pass` e alinhados ao domínio remetente.
7. Não copie o cabeçalho inteiro. Anote apenas `pass/fail`, domínio alinhado,
   horário e a correlação sanitizada.

Se o provider mostrar `accepted`, mas a caixa não receber, não envie várias
vezes. Verifique lifecycle, bounce, complaint, allowlist e spam; depois peça
triagem. O mesmo e-mail não deve ser reenviado manualmente para “testar”.

### 2.2 Analisar relatórios DMARC

O procedimento atual está em [Progressão DMARC](dmarc-rollout.md). Na data desta
requalificação, o primeiro estágio `p=none; pct=100` termina em
`2026-09-12T00:06:50Z`; confirme a data no runbook antes de agir.

1. Acesse a caixa institucional que recebe `rua` usando uma conta autorizada.
2. Baixe os anexos agregados XML, `.gz` ou `.zip` para uma pasta local
   `.dmarc-reports/`. Essa pasta é temporária e não deve entrar no Git.
3. No terminal, execute:

   ```powershell
   bun run ops:analyze:dmarc -- .dmarc-reports\relatorio-1.xml .dmarc-reports\relatorio-2.xml.gz
   ```

4. Leia a saída sanitizada: organização do relatório, intervalo, quantidade,
   disposition e resultados SPF/DKIM. Procure qualquer fonte legítima com
   falha; não copie o XML para o ticket.
5. Antes de qualquer alteração, confira o DNS em dois resolvers:

   ```powershell
   Resolve-DnsName -Server 1.1.1.1 -Type TXT _dmarc.neurocapacitar.com.br
   Resolve-DnsName -Server 8.8.8.8 -Type TXT _dmarc.neurocapacitar.com.br
   ```

   Registre somente política e TTL. Não crie um segundo TXT DMARC.
6. Só a responsável pelo domínio autoriza a progressão. As etapas são, nesta
   ordem: `none/100` por 14 dias, `quarantine/25` por 72 horas,
   `quarantine/100` por 7 dias, `reject/25` por 72 horas e `reject/100` por pelo
   menos 7 dias.
7. Entre cada mudança, reduza o TTL com antecedência, confira novamente SPF e
   DKIM, aguarde propagação em dois resolvers e observe os relatórios, bounces e
   complaints durante toda a janela.
8. Se uma fonte legítima falhar, restaure imediatamente o estágio anterior,
   documente a causa e reinicie a janela. Não pule direto para `reject`.

## 3. Rotacionar e provar a credencial R2 de restore

### O objetivo

Separar a credencial que escreve backups da credencial que apenas lê backup para
restore/release. A credencial de leitura deve alcançar somente o bucket privado
de backup e não deve ser usada pela aplicação web.

### Troca do secret

1. No Cloudflare, abra o bucket R2 de backup Production confirmado no runbook.
2. Crie uma API token nova com permissão de objeto **Read** somente nesse bucket.
   Não escolha administração da conta, escrita, domínio público ou `r2.dev`.
3. Copie o `Access Key ID` e o `Secret Access Key` diretamente para o cofre ou
   para o formulário de secret do GitHub. Não passe esses valores na linha de
   comando.
4. No GitHub, abra **Settings → Environments → vercel-production**.
5. Substitua os secrets `RESTORE_R2_ACCESS_KEY_ID` e
   `RESTORE_R2_SECRET_ACCESS_KEY`. Não altere `BACKUP_R2_*`: eles pertencem ao
   workflow de escrita `production-backup`.
6. Enquanto a chave nova não for testada, mantenha a antiga disponível apenas no
   cofre aprovado, nunca em arquivo local ou chat. Depois da prova, revogue a
   antiga no Cloudflare.

### Teste de leitura e restore

1. Confirme somente a presença dos dois secrets no Environment e que o bucket e
   a conta são os esperados. Não imprima valores.
2. Execute o checker `bun run ops:check:production-backup` no ambiente seguro
   aprovado pela equipe. Ele deve encontrar o manifesto `frequent` mais recente,
   conferir migration, tamanho e hash e retornar `fresh`.
3. Para um ensaio de restore, crie um banco PostgreSQL 18 descartável cujo nome
   comece por `hub_restore_`. Verifique que ele está vazio e não é o compute
   Production, Staging ou Development.
4. Disponibilize temporariamente uma identidade `age` offline fora do
   repositório, selecione um `RESTORE_MANIFEST_KEY` exato e defina
   `RESTORE_CONFIRMATION=RESTORE_DISPOSABLE_PRODUCTION_BACKUP` no ambiente seguro.
5. Execute `bun run ops:restore:production-backup`. O script baixa a cifra,
   confere hash, decifra, valida a lista do `pg_restore`, restaura em transação e
   verifica journal, tabelas, constraints, índices e consultas agregadas.
6. O resultado permitido informa apenas backup ID, migration, quantidade de
   tabelas, RTO e status. Registre isso e remova o banco/branch descartável
   somente depois de conferir o ID exato.
7. Retire a identidade offline para a custódia, revogue a credencial temporária
   e confirme no Cloudflare que a chave antiga foi revogada.

Se o checker falhar, não troque o bucket, edite manifesto ou desabilite o gate.
Se o restore tocar um banco persistente, interrompa imediatamente e acione a
supervisora.

## 4. Repetir CI, integração e E2E no SHA candidato

### O que conferir

O workflow `.github/workflows/ci.yml` usa Bun `1.3.11` em Ubuntu. Os jobs
relevantes são `Quality gates`, `PostgreSQL integration`, `Browser journeys` e
`Build and dependency audit`.

1. Abra o Pull Request que contém a alteração e confirme que a branch de destino
   é a correta.
2. Depois do merge autorizado em `main`, abra **Actions → CI** e localize a
   execução cujo `head_sha` é exatamente o SHA candidato. Uma CI verde de um
   Pull Request antigo não substitui essa execução.
3. Aguarde todos os jobs. A integração PostgreSQL e o Playwright devem usar
   branches Neon efêmeras; a própria job deve apagá-las mesmo se falhar.
4. No job de navegador, confirme que são usados dados de teste, bucket R2
   isolado, `E2E_TEST_MODE=true` e nenhum e-mail, pagamento ou vídeo real.
5. No build/audit, confirme `bun install --frozen-lockfile`, build, Knip e
   `bun audit --production` sem vulnerabilidades.
6. Se um job ficar vermelho, abra o primeiro step vermelho, copie somente a
   mensagem sanitizada, corrija na branch e execute a CI novamente. Não marque o
   job como skipped e não apague uma branch Neon manualmente sem conferir o ID.

Na máquina local, Node 24.x é a versão declarada pelo projeto; Bun local pode
ser diferente do runner. Se a supervisora exigir reprodução local, use uma
instalação aprovada de Node 24 e Bun `1.3.11`, depois execute os comandos abaixo:

```powershell
bun install --frozen-lockfile
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run test
bun run build
bun run knip
bun audit --production
```

O check global também deve ficar verde em uma árvore limpa. Se ele apontar uma
alteração antiga em `skills-lock.json`, registre-a separadamente; não misture a
correção desse arquivo com o gate de MFA removido.

## 5. Fechar a requalificação

Quando os blocos anteriores tiverem evidência:

1. reúna SHA, ambiente, horário UTC, IDs sanitizados e resultado de cada gate;
2. atualize [estado de release](release-state.md) sem registrar secrets, XML,
   headers, URLs assinadas ou PII;
3. confirme que `main` tem CI verde no mesmo SHA que será informado ao workflow
   Production;
4. só a pessoa autorizada executa o deploy protegido e o smoke pós-deploy;
5. se qualquer gate externo continuar pendente, mantenha `NO-GO` para nova
   promoção. Production estar no ar não transforma evidência antiga em evidência
   do SHA novo.

O resultado esperado é uma decisão humana explícita `GO` ou `NO-GO`. A ausência
de MFA não precisa ser “resolvida”: ela é a decisão de escopo vigente.
