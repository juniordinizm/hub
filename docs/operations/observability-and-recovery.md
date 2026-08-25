---
status: runbook
owner: operations
last_verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
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
| Player e upload | `cron.jmvstream`, vídeos pendentes e idade | Operações de conteúdo | média | seguir [JMVStream](deploy-and-incidents.md#jmvstream) |
| Certificado e e-mail | outbox, dead letter, rota pública, verificação de hash e exceção | Operações | alta se emissão não notifica ou PDF válido/pronto fica indisponível | conferir agregado, outbox, R2 e Resend; não editar snapshot nem divulgar URL assinada |
| Crons | eventos `cron.*` e backlog | Operações | alta se backlog cresce | conferir agenda, Bearer e idempotência |
| Banco | readiness e `health.readiness` | Engenharia | alta | seguir [Banco e recuperação](deploy-and-incidents.md#banco-e-recuperação) |
| Backup Production | falha do workflow ou ausência de manifesto `frequent` válido há 6 h 30 min | Operações | crítica | disparar manualmente o backup, investigar sem liberar o deploy e seguir o [runbook de backup e restore](production-backup-restore.md) |

Alerta sem dona e ação reproduzível deve ser removido, não apenas silenciado.

## Correlação, logs e exceções

`proxy`, em `src/proxy.ts`, aceita apenas UUID v4 em `x-correlation-id` ou gera um novo. O valor segue para a requisição e a resposta. `logOperationalEvent`, em `src/lib/observability.ts`, emite JSON com `correlationId`, `operation`, `outcome`, `durationMs`, `errorCode`, `provider` e, quando seguro, `aggregateId`.

O sanitizador remove atributos cujo nome revele autorização, cookie, nome, e-mail, senha, segredo, assinatura, payload, token ou URL assinada. Não inclua esses dados nos valores de outros campos.

`instrumentation.ts` registra exceções de request e preserva o mesmo identificador como a tag segura `correlation_id` no Sentry. Os hooks `beforeSend`, `beforeBreadcrumb`, `beforeSendTransaction` e `beforeSendSpan` removem query strings de localizações e substituem códigos públicos de Certificado por `[certificate-code]` em requests, breadcrumbs, transações e spans. Campos não relacionados permanecem disponíveis para diagnóstico. `error.tsx` e `global-error.tsx` geram e exibem um identificador para a exceção do navegador. Sem DSN, o Sentry fica desativado deliberadamente; isso não comprova que uma equipe recebeu alerta.

O inventário autenticado preserva temporariamente `hub-development` (ID
`4511808556564480`) como projeto com histórico e `hub-production` como projeto
Production ainda referenciado pelo deployment canônico. O alvo é um projeto
único, com `environment` separando Development, Staging e Production. O build
agora exige `SENTRY_ORG`, `SENTRY_PROJECT` e SHA Git completo quando existe
`SENTRY_AUTH_TOKEN`; o mesmo SHA é injetado como `release`, o token fica somente
no build e os source maps são removidos após upload.

Na leitura autenticada de 2026-08-24, `hub-development` tinha 24 releases e 22
Issues não resolvidas; `hub-production` tinha uma release, três Issues no total
e uma não resolvida. O zero exibido no gráfico do painel era restrito ao
intervalo selecionado. Preserve os dois projetos até triar essas Issues, trocar
o DSN somente no deployment candidato e concluir a janela de observação. O
projeto novo não deve ser removido automaticamente pelo deploy.

A triagem somente leitura repetida em 24 de agosto encontrou as mesmas 22 Issues
não resolvidas no projeto histórico e três no inventário Production. Nenhuma
teve atividade nas 48 horas anteriores à coleta. `HUB-PRODUCTION-1` e
`HUB-PRODUCTION-3` estão resolvidas, tiveram uma ocorrência e não recorreram; a
única não resolvida, `HUB-PRODUCTION-2`, é uma notificação de teste com um
evento, vista pela última vez em 22 de agosto. Nada foi resolvido ou reaberto
pela auditoria. Isso elimina um bloqueio de severidade, mas não autoriza
exclusão: o DSN do deployment atual, a release histórica e a janela de
observação ainda precisam ser preservados até o corte validado.

A troca de slug/DSN, o evento sintético, a stack desminificada e o alerta em
canal institucional ainda dependem do deployment candidato e da credencial
correta. Até essas evidências existirem, Sentry permanece gate crítico aberto e
bloqueia `GO`. A manutenção diária também expira `support_requests` após 90 dias.

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
ausência de PII/query, frame resolvido para `src/lib/sentry-readiness.ts` e
workflow ativo cujo `lastTriggered` alcança o evento. HTTP 401/403, resposta
incompleta ou timeout falham; o checker não cria nem altera alerta.

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

## Manutenção

Repita o ensaio e um incidente simulado trimestralmente. Em cada integração, revise filtros de PII, dona, alerta, dashboard e ação. Atualize este runbook e rode `bun run docs:check` na mesma mudança.
