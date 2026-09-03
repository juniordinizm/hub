---
status: runbook
owner: operations
last_verified_commit: a3b0e20ed663e455ecdc5367310592b3d073d6f6
---

# Observabilidade e recuperação

## Objetivo e limites

Este runbook torna falhas detectáveis sem registrar dados pessoais ou segredos. Ele cobre processo, Postgres, filas persistidas e integrações assíncronas. Não prova backup, proteção de branch ou alertas ativos em produção: cada item exige confirmação no painel do provedor.

**Admin > Auditoria** mostra apenas contagens e idade de backlog. Nunca expõe payload, token, e-mail ou URL assinada.

## Sinais, dona e resposta

| Capacidade | Sinal | Dona | Severidade | Ação |
|---|---|---|---|---|
| Auth | `auth.sign_in`, exceção de request e fallback de interface | Engenharia | alta se login indisponível | localizar `correlationId`, consultar Sentry e Better Auth |
| Checkout | `checkout.create`, duração e falha | Engenharia | alta se sustentada | conferir configuração Asaas e Pedido sem PII |
| Webhook e concessão | `webhook.asaas`, falhas e idade | Operações financeiras | alta se acesso pago não projeta | seguir [Pagamento/webhook](deploy-and-incidents.md#pagamentowebhook) |
| Player e upload | `cron.jmvstream`, eventos `lesson-resource-upload.*`, vídeos pendentes e idade | Operações de conteúdo | média | seguir [JMVStream](deploy-and-incidents.md#jmvstream) e preservar o `correlationId` |
| Certificado e e-mail | outbox, dead letter, rota pública, verificação de hash e exceção | Operações | alta se emissão não notifica ou PDF válido/pronto fica indisponível | conferir agregado, outbox, R2 e Resend; não editar snapshot nem divulgar URL assinada |
| Crons | eventos `cron.*` e backlog | Operações | alta se backlog cresce | conferir agenda, Bearer e idempotência |
| Banco | readiness e `health.readiness` | Engenharia | alta | seguir [Banco e recuperação](deploy-and-incidents.md#banco-e-recuperação) |
| Backup Production | falha do workflow ou ausência de manifesto `frequent` válido há 6 h 30 min | Operações | crítica | disparar manualmente o backup, investigar sem liberar o deploy e seguir o [runbook de backup e restore](production-backup-restore.md) |

Alerta sem dona e ação reproduzível deve ser removido, não apenas silenciado.

## Correlação, logs e exceções

`proxy`, em `src/proxy.ts`, aceita apenas UUID v4 em `x-correlation-id` ou gera um novo. O valor segue para a requisição e a resposta. `logOperationalEvent`, em `src/lib/observability.ts`, emite JSON com `correlationId`, `operation`, `outcome`, `durationMs`, `errorCode`, `provider` e, quando seguro, `aggregateId`. O fluxo de anexos emite `lesson-resource-upload.prepare`, `.reissue`, `.confirm`, `.fallback` e `.consume`, com Aula, recurso e tamanho; nunca registra URL assinada, query `X-Amz-*`, nome do arquivo, conteúdo ou credenciais.

O sanitizador remove atributos cujo nome revele autorização, cookie, nome, e-mail, senha, segredo, assinatura, payload, token ou URL assinada. Referências circulares são substituídas por `[circular]` antes da serialização; esse marcador evita recursão sem publicar o objeto original. Não inclua dados sensíveis nos valores de outros campos.

`src/instrumentation.ts`, ao lado de `src/app`, registra exceções de request e preserva o mesmo identificador como a tag segura `correlation_id` no Sentry. Os hooks `beforeSend`, `beforeBreadcrumb`, `beforeSendTransaction` e `beforeSendSpan` removem query strings de localizações e substituem códigos públicos de Certificado por `[certificate-code]` em requests, breadcrumbs, transações e spans. Campos não relacionados permanecem disponíveis para diagnóstico. `error.tsx` e `global-error.tsx` geram e exibem um identificador para a exceção do navegador. Sem DSN, o Sentry fica desativado deliberadamente; isso não comprova que uma equipe recebeu alerta.

Os pools `application` e `readiness`, em `src/db/index.ts`, registram listener
`error` no `pg.Pool`. Uma conexão ociosa encerrada pelo provider não pode virar
`uncaughtException`; o handler emite somente `database.pool`, código
`database_pool_client_error`, status 503 e correlação UUID, sem mensagem do
provider ou URL. O request que originou a falha ainda deve ser tratado pelo
worker/rota e o readiness continua sendo a confirmação de recuperação.

O candidato `72265c3c2f7c6f881843096f86d77175985a5d2b` foi publicado no Staging
no deploy `32886494503`. A rodada `32886769013` chamou `/api/cron/outbox` e
recebeu HTTP 200 com `outcome=success`; o Issue Sentry histórico de conexão não
teve nova ocorrência no intervalo consultado. O Issue permanece aberto para
triagem humana, pois ausência de recorrência não é resolução automática.

O inventário autenticado preserva temporariamente `hub-development` (ID
`4511808556564480`) como projeto com histórico e `hub-production` como projeto
Production ainda referenciado pelo deployment canônico. O alvo é um projeto
único, com `environment` separando Development, Staging e Production. O build
agora exige `SENTRY_ORG`, `SENTRY_PROJECT` e SHA Git completo quando existe
`SENTRY_AUTH_TOKEN`; o mesmo SHA é injetado como `release`, o token fica somente
no build e os source maps são removidos após upload.

Na leitura autenticada mais recente de 2026-08-25, `hub-development` tinha 29 releases e
recebia os três environments; `hub-production` tinha uma release e zero
ocorrência nos 14 dias consultados. O filtro Production do projeto histórico
retornou cinco Issues/688 ocorrências, provando que o DSN efetivo ainda aponta
para ele. Preserve os dois projetos até trocar o DSN somente no deployment
candidato e concluir a janela de observação. O projeto novo não deve ser
removido automaticamente pelo deploy.

Uma das Issues concentrava 671 `Maximum call stack size exceeded` em uma hora.
Path Windows e Node 22 provaram origem em verificação local, não no runtime
Vercel Linux/Node 24. O evento revelou, porém, uma regressão real do candidato:
objetos circulares faziam o sanitizador recursar indefinidamente. O commit
`801a1ce` adiciona detecção por caminho ativo e teste red/green. O evento não
teve source map/contexto resolvido, então não serve como aceite do probe de
readiness.

O deployment Staging `aceeaf830cf75667df8ce21e5b586d47155dd5ac`
comprovou upload de source maps e ingestão real no projeto histórico. O evento
`2a8b96ca952740ffb28a7fc04c7816d1`, recebido em
`2026-08-25T15:10:44Z`, contém `environment=staging`, release igual ao SHA,
`readiness_probe=sentry` e frame `app:///src/lib/sentry-readiness.ts:42`. O
workflow global `Send a notification for high priority issues` foi acionado
depois do evento, mas não possui filtro de ambiente e seu destino atual não
comprova canal institucional monitorado.

O SDK não enviou identidade, e-mail, username ou IP, mas o projeto está com
`scrubIPAddresses=false`; a ingestão acrescentou `user.geo` com país/região
derivados do IP de transporte. `cookies` foi normalizado como array vazio. Como
o contrato exige ausência total de PII, não trate esse evento como sanitização
aprovada. Habilite a remoção de IP no projeto preservado com credencial
`project:write`, emita outro probe e confirme que o checker falha apenas enquanto
o alerta institucional não alcança o evento. A credencial de inspeção permanece
somente leitura e não deve ganhar permissão de mutação.

A troca de slug, o endurecimento de privacidade e o alerta por ambiente em canal
institucional continuam pendentes. Até essas evidências existirem, Sentry
permanece gate crítico aberto e bloqueia `GO`. A manutenção diária também expira
`support_requests` após 90 dias.

O probe controlado usa `POST /api/health/sentry`, disponível somente em Staging
ou Production quando `SENTRY_READINESS_SECRET` existe. Ele exige bearer próprio
e corpo literal `{"confirmation":"EMIT_SENTRY_READINESS_EVENT"}`, cria somente
uma exceção constante em `src/lib/sentry-readiness.ts`, anexa `environment`, SHA
completo e `readiness_probe=sentry`, aguarda o flush e retorna apenas `eventId` e
`correlationId`. `SENTRY_READINESS_AUTH_TOKEN` é separado, somente leitura e
nunca entra no runtime web.

Depois da emissão, execute o checker somente leitura com o `eventId`, ambiente e
SHA retornados pelo deployment, sem copiar tokens para a linha de comando:

```powershell
bun run ops:check:sentry-readiness -- --event-id=<32-hex> --environment=staging --release=<40-hex>
```

O processo lê `SENTRY_READINESS_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
`SENTRY_PROJECT_ID` e `SENTRY_READINESS_ALERT_NAME` do ambiente seguro. Ele
aguarda no máximo um minuto, exige evento no projeto/ambiente/release corretos,
ausência de PII/query no payload de telemetria, frame resolvido para
`src/lib/sentry-readiness.ts` e workflow ativo cujo campo `environment` seja
exatamente `production` (ou `staging`, na prova correspondente) e cujo
`lastTriggered` alcance o evento. Metadados administrativos que a API do Sentry
anexa à resposta, como `release.lastCommit`, e coleções vazias normalizadas,
como `cookies=[]`, não são payload da aplicação e não reprovam a privacidade;
cookies não vazios, identidade, e-mail, token ou query no payload continuam
reprovando. HTTP 401/403, resposta incompleta ou timeout falham; o checker não
cria nem altera alerta.

Para a prova específica de Production, use o workflow manual
`Verify Sentry Production readiness`. Informe o SHA completo atualmente servido
e a confirmação literal `EMIT_SENTRY_PRODUCTION_READINESS`. O workflow usa o
Environment `vercel-production`, emite um único evento controlado no domínio
canônico e executa o checker com `--environment=production`; ele não faz deploy,
não altera configurações do Sentry e não cria cobrança. Não execute essa prova
como smoke genérico nem sem autorização para gerar o evento operacional.

O Sentry pode acrescentar `user.geo` (cidade, região e país) no processamento do
evento, mesmo quando `scrubIPAddresses=true` e `email`/`ip_address` não foram
enviados pelo SDK. Esse bloco derivado é o único campo `user` tolerado pelo
checker; qualquer identidade, IP, credencial ou valor sensível continua
reprovando o gate. A política organizacional deve permanecer ativa para que
novos eventos não armazenem endereços IP.

As Server Actions de reordenação do conteúdo usam o mesmo cabeçalho e emitem `course_content.reorder_modules` ou `course_content.reorder_lessons`. Falhas retornam uma mensagem segura à interface e ficam nos logs como `course_module_reorder_failed` ou `course_lesson_reorder_failed`.

## Liveness, readiness e RED

- `GET /api/health` é liveness: processo e relógio; continua 2xx mesmo sem banco.
- `GET /api/health/ready` é readiness: exige `Authorization: Bearer <HEALTHCHECK_SECRET>` quando o segredo existe. Em produção, segredo ausente, conexão indisponível ou schema incompatível retorna 503 sem detalhes.
- A readiness usa conexão com timeout de um segundo, transação somente leitura e exige no journal `drizzle.__drizzle_migrations` a migration mínima declarada em `src/db/migration-state.ts`. Providers externos não bloqueiam cada request.

RED é calculado por `operation`: taxa de eventos, `outcome=failure` e `durationMs`. Saturação vem do snapshot administrativo: outbox pendente/dead letter, webhooks Asaas prontos, em retry ou falhos, checkouts e reembolsos incertos e vídeo pendente, com a idade do item mais antigo.

O snapshot emite códigos operacionais sem PII, com limiares internos nomeados:

- `outbox_dead_letter`: existe ao menos uma mensagem em `dead_letter`, severidade crítica;
- `outbox_pending_stale`: mensagem pendente há pelo menos 15 minutos, severidade `warning`, ou há pelo menos 60 minutos, severidade `critical`;
- `webhook_ready_stale`: evento `received`/`processing` há pelo menos 15 minutos;
- `webhook_retry_stale`: evento `retryable` há pelo menos 6 horas;
- `webhook_failed_stale`: evento `failed` há pelo menos 24 horas;
- `webhook_payload_retention_risk`: qualquer um desses eventos há pelo menos 25 dias, severidade crítica, cinco dias antes da sanitização obrigatória em 30 dias.

Esses limiares acionam o runbook; não são SLO ratificado nem autorizam mutação externa automática.

## SLI/SLO antes de ratificação

Colete uma linha de base de 30 dias antes de fixar meta, janela, error budget ou pager. Registre diariamente:

1. disponibilidade de login e player por check sintético autenticado;
2. tempo entre `webhook.asaas` e projeção de Matrícula/Concessão;
3. idade e quantidade de outbox pendente/dead letter;
4. tempo entre vídeo pendente e `ready`;
5. falha e latência de `checkout.create`.

Até haver baseline e aprovação de produto/operações, excedente gera investigação pelo runbook, não promessa de SLO. A revisão mensal registra dona, ambiente, período, volume e decisão.

Ensaios e verificações podem usar `createRecoveryEvidence`, em
`src/tooling/observability-recovery-evidence.ts`, para produzir um registro
estruturado com versão, ambiente, dona, janela UTC, journal e nomes de checks.
O helper rejeita e-mail, URL, credencial e identificador sem formato seguro; ele
não consulta nem altera banco e não substitui a confirmação humana de PITR,
backup ou entrega de alerta.

Para registrar somente a evidência dos checks já confirmados manualmente, use
`bun run ops:recovery:evidence` com `RECOVERY_DRILL_OWNER`,
`RECOVERY_DRILL_ENVIRONMENT`, `RECOVERY_DRILL_MIGRATION_JOURNAL` e os três
resultados `RECOVERY_DRILL_*`. O comando aceita exclusivamente `--dry-run`, não
abre conexão, não executa migration e não restaura banco.

## Diagnóstico por provider

### Neon/Postgres

1. Consulte liveness e readiness com bearer; não publique o bearer em ticket.
2. Use o `correlationId` no log e confira conectividade, pool runtime e journal.
3. Runtime usa `DATABASE_URL` pooled; migrations usam `DATABASE_URL_DIRECT`. Nunca recupere com `db:push` ou `db:reset`.
4. Branch, PITR, proteção e retenção de produção requerem verificação humana no Neon.
5. O backup lógico independente executa às `17 */6 * * *` e também por dispatch
   manual. O deploy recusa manifesto ausente, stale, com migration desconhecida,
   tamanho divergente ou SHA-256 divergente. A falha do workflow é o alerta
   primário do GitHub Actions; o canal institucional deve apontar para essa job
   quando o GitHub Environment for provisionado.

### Asaas

1. Relacione `correlationId`, ID do Pedido e `event_key`, sem payload bruto.
2. Confira token de acesso, deduplicação, estado financeiro e `payment_reviews`.
3. Use somente retry autorizado; não crie Matrícula diretamente para simular pagamento.
4. Para `installment_enrichment_failed`, confirme que a Revisão
   `installment_enrichment_pending` existe e que a Concessão paga já foi revogada quando o
   ID parcelado era exato. Aguarde as cinco tentativas automáticas; não repita reembolso nem
   restaure acesso.
5. Se o evento terminar `failed`, somente Admin com `retryWebhook` pode reenfileirá-lo,
   após confirmar no Asaas que o agregado está consultável. Suporte apenas consulta e
   encaminha o caso.
6. Se a fila Asaas estiver interrompida, reative o envio no painel antes de replay. Confirme
   que a URL, o token e o tipo de envio pertencem ao ambiente correto; não troque credenciais
   para contornar backlog.
7. Antes de reenfileirar um evento falho, consulte o Pedido, a cobrança ou o parcelamento pelo
   ID exato e compare o estado já persistido. Se a chamada anterior teve resultado incerto,
   consulte primeiro; nunca repita criação de Checkout ou reembolso para “testar”.
8. Faça replay pelo painel do Asaas quando a entrega ainda estiver retida. Quando o evento já
   estiver na inbox local como `failed`, use a ação de retry na aba de operações
   financeiras do **Admin > Financeiro**, informe o motivo e
   reenfileire uma vez. O comando só aceita payload não sanitizado e ainda dentro de 30 dias,
   zera tentativas e deixa trilha `asaas_webhook.requeued`.
9. Após o replay, acompanhe `ready`, `retryable`, idade e Revisões até convergirem. Não edite
   Pedido, Concessão ou Matrícula diretamente. Se o payload alcançou 25 dias, trate como
   incidente crítico antes que a evidência bruta seja removida.

### JMVStream e R2

1. Para JMVStream, confira `videoHash`, estado local, cron e etapa: parte, complete, processamento, sync ou delete.
2. Preserve sessão, ETags e IDs. A divergência `gallery` permanece bloqueio no guia de [JMVStream](../integrations/jmvstream.md).
3. Para R2, registre somente bucket/chave; teste HEAD privado e GET público conforme publicação. Não limpe objetos sem reconciliar referência.
4. Para anexos de Aula, `prepare` 4xx/5xx indica autenticação, validação, banco ou assinatura; preflight 403 indica origem/método/header fora da política; PUT 403 sem CORS indica URL expirada ou assinatura inválida; falha de rede dispara reemissão e uma segunda tentativa. Fallback server-side só é permitido até 4 MiB; não encaminhe arquivos maiores pelo Hub.
5. A confirmação exige HEAD do objeto e só então marca a sessão como `uploaded`. Se o salvamento falhar, mantenha a sessão para retry; a manutenção remove apenas sessões expiradas sem referência no conteúdo da Aula.

### Certificado público

1. Comece pela página canônica `/certificados/[code]` e registre apenas estado, `render_status` e `correlationId`; nunca copie código completo, chave do objeto ou URL assinada para logs e tickets.
2. Preview/download só é esperado para `valid` e `ready`. `pending`, `failed`, `revoked`, chave/digest ausente e rate limit bloqueiam o redirecionamento; não contorne a rota com acesso direto ao R2.
3. Se `/certificados/[code]/pdf` retornar indisponibilidade para um registro elegível, confira a metadata SHA-256 por HEAD privado. Divergência bloqueia a URL assinada e exige investigação do artefato; não altere o snapshot nem o digest para forçar o download.
4. Confirme `noindex,nofollow` na página e `X-Robots-Tag: noindex, nofollow` no redirect. A URL do R2 expira em cinco minutos e não deve ser tratada como link canônico.
5. Revogação deve impedir novos previews/downloads imediatamente. PDFs já baixados ou copiados fora do Hub não podem ser recolhidos; use a página pública para comunicar a invalidação.

### Resend

1. Confirme commit e estado atual do agregado.
2. Consulte outbox/dead letter, tópico, tentativa e `lastErrorCode`, nunca o payload.
3. Reprocessamento exige motivo. Depois de 24 horas, a idempotência do provedor pode não evitar e-mail duplicado.
4. A rota pública rejeita corpos acima de 256 KiB com `413 payload_too_large`.
   O limite é aplicado antes de materializar o corpo completo, inclusive quando
   `Content-Length` está ausente ou subdeclarado; não reenvie esse payload.

## Ensaio de recuperação

### Procedimento trimestral

1. Crie branch temporária no Neon a partir de snapshot autorizado; nunca restaure sobre produção.
2. Obtenha URL direta exclusiva e não a copie para documentação, ticket ou log.
3. Rode `bun run db:migrations:check`, `bun run db:migrate` e smoke sem PII: journal, tabelas e invariantes de contagem aprovados.
4. Registre data UTC, origem, início/fim, duração, checks, resultado e operadora.
5. Exercite rollback operacional: aplicação anterior compatível ou forward-fix revisado. Não execute rollback SQL destrutivo.
6. Revogue URL e apague a branch temporária depois da conferência.

### Evidência atual

Em 2026-07-21 UTC, a branch `recovery-drill-20260721` foi criada da branch `production` do projeto Neon `protear`, recebeu `bun run db:migrate`, passou no smoke sem PII e foi removida. A cópia preservou 2 Contas e zero registros nas tabelas de Pedido, Matrícula, webhook e Certificado; após a migration, o journal chegou a 25 entradas e `outbox_messages` existia.

Esse é um ensaio real de cópia do estado corrente de produção e de recuperação forward de schema. Ele revelou o estado inicial de 23 entradas no journal e ausência de `outbox_messages`. Após aprovação explícita, `0023` e `0024` foram promovidas de forma controlada para `production`: o journal chegou a 25 entradas, a outbox existe e uma segunda execução do migrador não reaplicou schema.

As branches `production` acessíveis de CI e do projeto `protear` permanecem sem proteção porque o plano Free não oferece esse recurso. O ensaio não comprova PITR em ponto histórico, cópia independente, política de retenção nem entrega de alerta. A auditoria de 23 de agosto confirmou essas lacunas como bloqueio de recuperação; elas permanecem pendentes no plano mestre e não podem depender de upgrade pago.

### Atualização de Sentry em Staging — 2026-08-29

O deployment Staging do SHA
`f9eb31ae2a4019a376660269f609518ac303faaf` (`dpl_5J7v7Qb7ztR5GPo3PKft77d99Y9v`)
emitiu o probe no projeto `hub-web`, ambiente `staging`. O evento
`f74a01d2a4e846deb2f4a770b16d5928`, correlacionado a
`2bb9c767-0d30-4d00-8e09-d7df89ac34f2`, foi conferido com a credencial de
inspeção. O checker terminou com código zero e confirmou `match=true`,
`sourceMapped=true` e `alertTriggered=true` para o release completo.

O evento não contém identidade, e-mail ou IP enviados pelo SDK; somente o
bloco derivado `user.geo` foi acrescentado pelo Sentry e é o único bloco
permitido pelo contrato do checker. A política organizacional de remoção de IP
está ativa. Este fechamento vale para o gate de Staging; o evento próprio de
Production continua reservado para depois de um candidato promovido e de uma
autorização explícita.

## Manutenção

Repita o ensaio e um incidente simulado trimestralmente. Em cada integração, revise filtros de PII, dona, alerta, dashboard e ação. Atualize este runbook e rode `bun run docs:check` na mesma mudança.
