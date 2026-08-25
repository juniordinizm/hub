---
status: proposed
execution_status: superseded
owner: engineering
last_verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
superseded_by: docs/superpowers/plans/2026-08-23-production-readiness-remediation-sprints.md
---

# E-mail, autenticação e Resend: plano de conclusão em sprints

> **Plano substituído em 23 de agosto de 2026. Não executar.** O
> [plano mestre de Production Readiness](2026-08-23-production-readiness-remediation-sprints.md)
> incorporou o trabalho ainda válido e substituiu decisões conflitantes, incluindo
> política de senha, RBAC de `support`, recuperação e critérios de release.

> **Para executores agentes:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Execute uma tarefa por vez, mantenha os gates e
> pare nas condições de STOP. Este plano é deliberadamente dividido: cada Sprint
> deve chegar verde a `main` antes da próxima.

**Objetivo:** encerrar a migração para Resend Hosted Templates e eliminar riscos
confirmados de autenticação, outbox, suporte e observabilidade sem persistir
tokens, corpo de e-mail ou PII desnecessária.

**Arquitetura alvo:** o Hub continua dono do evento de negócio, destinatário,
URLs, allowlists, `from`, `replyTo`, idempotência e autorização. O Resend é dono
de assunto, HTML, preview, texto simples e versão editorial. A outbox continuará
registrando que a API do provider aceitou um efeito; o ciclo posterior de entrega
será um registro separado e assíncrono, alimentado por webhooks assinados. Isso
não muda `delivered` de tópicos não relacionados a e-mail.

**Decisões ratificadas para este plano:**

- Não habilitar `requireEmailVerification`. A ativação por compra e a recuperação
  de senha permanecem a prova de posse relevante; Contas criadas por compra podem
  continuar com `email_verified=false`. Não criar template de verificação nesta
  iniciativa.
- Fixar a política de senha em 10 caracteres mínimos, já exigidos pela tela de
  redefinição. Backend e cadastro devem usar uma única constante.
- Assunto é conteúdo editorial e passará a ser propriedade do template Hosted.
  O Hub continuará enviando `from` e `replyTo`; suporte seguirá validando
  `SUPPORT_SUBJECT` como variável, sem interpolá-lo no envelope.
- A falha de entrega do reset público continuará best-effort, fora da outbox. É
  uma decisão de segurança já registrada em `DEC-DISC-015`; o plano só completa
  a telemetria sanitizada, não tenta persistir token ou URL secreta.
- Para e-mails da outbox, `invalid_idempotent_request` significa que o primeiro
  payload da mesma intenção já foi aceito pelo Resend. O Hub não fará fallback
  para outro renderer nem reenviará com chave nova dentro da janela do provider.

**Fora de escopo:** copiar templates por ambiente, Teams Resend separados,
automação de envio de canário para clientes, alterar DNS, migrar reset público
para a outbox, salvar corpo/URL/token em logs ou acrescentar verificação de
e-mail obrigatória.

## Estado confirmado em 2026-08-23

- Os seis aliases (`auth-password-reset`, `access-released`,
  `access-expiry-warning`, `certificate-issued`, `course-sales-opened` e
  `support-request`) estão publicados no Resend, com HTML e plain text; o domínio
  `neurocapacitar.com.br` está verificado para envio em `sa-east-1`.
- O commit Hosted `faa3e83` é ancestral do release Production documentado.
  A logo oficial responde HTTP 200. Isso fecha a indisponibilidade histórica do
  asset, mas não substitui uma inspeção de inbox em clientes reais.
- Allowlists fail-closed de Development/Staging, templates Hosted, checker
  manual, suporte durável, retenção de 90 dias e reset público assíncrono já
  existem. Não reimplementar esses itens.
- O legado React Email ainda existe apenas como rollback interno. O último commit
  anterior à migração é `1baf463cf82ad27a1e60b89cd8704e7160b4bb1a`.
- Não há webhook Resend configurado. `outbox_messages.status='delivered'` ainda
  significa somente aceitação síncrona pelo provider.

## Ordem e dependências

| Sprint | Resultado | Depende de |
|---|---|---|
| 0 | Evidência operacional e rollback explicitamente registrados | nenhuma |
| 1 | Assunto totalmente editorial no Resend | 0 |
| 2 | React Email removido com rollback por deployment | 0, 1 |
| 3 | Identidade de reset e senha consistentes | 0 |
| 4 | Suporte limitado atomicamente | 3 |
| 5 | Avisos de expiração e retries idempotentes | 3 |
| 6 | Aceite e entrega real rastreados separadamente | 5 |
| 7 | E2E e observabilidade por tópico | 4, 5, 6 |
| 8 | Gates de release, SLO e documentação final | 1, 2, 6, 7 |

---

## Sprint 0 — Evidência, rollback e limites operacionais

**Objetivo:** transformar o estado remoto já verificado em procedimento auditável
antes de remover o rollback em código.

**Arquivos:**

- Modificar: `docs/integrations/resend.md`
- Modificar: `docs/integrations/resend-templates.md`
- Modificar: `docs/operations/release-state.md`
- Modificar: `docs/operations/production-release-guide.md`
- Modificar: `docs/operations/environment-and-local-development.md`

- [ ] Registrar em `release-state.md` que `1baf463...` é o artefato legado de
  rollback e que o rollback de e-mail é a promoção desse SHA, nunca o envio pelos
  dois renderers.

- [ ] Acrescentar no guia Production uma janela de corte reutilizável: pausar
  produtores de e-mail, drenar `pending`/`retrying`/`processing` por tópico,
  aguardar um lease e então promover. Declarar que a prova retroativa do corte
  de 2026-08-19 não existe e não deve ser inventada.

- [ ] Executar, com chave administrativa temporária apenas no shell:

  ```powershell
  bun run check:resend-templates -- --environment=production
  ```

  Esperado: exit 0; os seis aliases publicados, contrato de envelope/variáveis,
  HTML e plain text válidos. Draft não publicado é warning, não falha.

- [ ] Fazer uma única homologação manual de Production em caixa controlada: reset
  de senha, inspeção de `From`, `Reply-To`, SPF, DKIM e DMARC. Registrar somente
  data, caixa controlada, resultado e IDs sanitizados; nunca header bruto, token
  ou endereço no Git.

- [ ] Corrigir `.env.example`: ele não pode dizer que
  `SCHEDULED_JOBS_ENABLED=true` é exclusivo de Production enquanto o preflight de
  Development o exige. Explicar os dois perfis sem revelar valores locais.

**Verificar:** `bun run docs:check` => exit 0.  Não executar deploy nesta Sprint.

**STOP:** checker sem chave administrativa, falha de DNS/header, ou backlog que
não drena na janela. Registrar incidente e não seguir para Sprint 2.

---

## Sprint 1 — Transferir o assunto para o catálogo Hosted

**Objetivo:** completar a propriedade editorial do template sem mover dados de
segurança para o Resend além das variáveis já contratadas.

**Arquivos:**

- Modificar: `src/features/email/templates-contract.ts`
- Modificar: `src/features/email/server.ts`
- Modificar: `src/features/email/server.test.ts`
- Modificar: `src/features/email/templates-contract.test.ts`
- Modificar: `docs/integrations/resend-templates.md`
- Alteração externa controlada: os seis templates no Resend

- [ ] Criar testes que provem que o payload Hosted contém `template.id` e
  `variables`, mas não contém `subject` quando `subjectOwner` for `resend`.
  Para suporte, usar sujeito com caracteres de controle e provar a rejeição antes
  de chamar o provider.

- [ ] Alterar `HostedEmailTemplateMetadata` para

  ```ts
  subjectOwner: "resend";
  ```

  em cada alias. Remover `subject?: string` de `sendHostedTemplateEmail` e as
  seis propriedades `subject` dos wrappers. Não alterar `from`, `replyTo`, URL,
  allowlist ou `idempotencyKey`.

- [ ] Publicar, nesta ordem, os assuntos existentes no Resend: reset e acesso
  estáticos; expiração e vendas usando as variáveis já existentes; suporte usando
  `{{{SUPPORT_SUBJECT}}}`. Testar o draft com valores controlados, revisar texto
  simples e publicar. Não trocar para editor TipTap se a versão HTML atual for
  a fonte aprovada.

- [ ] Rodar o checker remoto e os testes focais:

  ```powershell
  bun run test -- src/features/email/server.test.ts src/features/email/templates-contract.test.ts
  bun run check:resend-templates -- --environment=production
  bun run typecheck
  ```

**Aceite:** uma alteração editorial de assunto é feita somente no Resend; o
runtime não possui string de assunto transacional.

---

## Sprint 2 — Remover React Email e o rollback interno

**Objetivo:** concluir a antiga Sprint 11 depois de evidência de Production da
Sprint 0 e do sujeito Hosted da Sprint 1.

**Arquivos:**

- Remover: `src/features/email/templates.tsx`
- Modificar: `src/features/email/server.ts`
- Modificar: `src/features/email/server.test.ts`
- Modificar: `package.json`, `bun.lock`, `knip.jsonc`
- Modificar: `docs/integrations/resend.md`, `docs/integrations/resend-templates.md`
- Modificar: `docs/operations/outbox-and-transactional-effects.md`,
  `docs/operations/testing-and-ci.md`

- [ ] Escrever primeiro a asserção de ausência: `git grep` não pode encontrar
  `@react-email/components`, `sendTransactionalEmail` nem `templates.tsx` em
  código rastreado. Preservar apenas referências históricas explicitamente
  marcadas como snapshot.

- [ ] Remover `SendEmailInput`, `sendTransactionalEmail`, o import `render` e
  testes/mocks exclusivos do renderer local. Manter todos os testes de Hosted,
  idempotência, E2E e allowlist.

- [ ] Remover `@react-email/components` com o gerenciador Bun e atualizar lock.
  Remover a exceção Knip de `templates.tsx`. Não remover `react`, usado pelo app.

- [ ] Atualizar runbooks: rollback agora promove `1baf463...` ou outro deployment
  anterior aprovado; não existe fallback automático no processo atual.

- [ ] Verificar:

  ```powershell
  bun run test -- src/features/email src/lib/auth-password-reset.test.ts src/features/outbox
  bun run typecheck
  bun run check
  bun run knip
  bun run build
  bun run docs:check
  bun run verify:quick
  ```

**STOP:** qualquer import legítimo restante do pacote, checker remoto falhando,
ou ausência da evidência de homologação Production da Sprint 0.

---

## Sprint 3 — Identidade canônica, senha e telemetria do reset

**Objetivo:** impedir que aliases equivalentes impeçam a recuperação e deixar a
política de senha única, sem reabrir a decisão de verificação obrigatória.

**Arquivos:**

- Criar: `src/lib/password-policy.ts`, `src/lib/email-identity.ts`
- Modificar: `src/lib/auth.ts`, `src/lib/auth-password-reset.ts`
- Modificar: `src/app/(auth)/cadastro/sign-up-form.tsx`
- Modificar: `src/app/(auth)/redefinir-senha/page.tsx`,
  `src/app/(auth)/redefinir-senha/reset-password-form.tsx`
- Modificar: `src/app/(auth)/recuperar-senha/request-password-reset-form.tsx`
- Modificar: `src/features/payments/buyer-identity.ts` e testes associados
- Criar/Modificar testes correspondentes em `src/lib` e `src/app/(auth)`
- Modificar: `docs/domain/identity-and-authorization.md`, `docs/decisions.md`

- [ ] Extrair a regra de `normalizeBuyerEmail` para `email-identity.ts`, com API
  pura `normalizeCanonicalEmail(email: string): string`. `buyer-identity.ts`
  torna-se consumidor desse helper. Testes devem fixar caixa, espaços, Gmail,
  Googlemail e `+tag`, e provar que domínios não reconhecidos não perdem pontos.

- [ ] Antes de chamar Better Auth, normalizar o e-mail do pedido de reset na
  fronteira segura compatível com a rota atual. Primeiro criar um teste de
  caracterização que prova a busca da Conta canonicalizada. Se a API atual do
  Better Auth não permitir essa transformação sem alterar o token/redirect,
  interromper e apresentar um spike com a documentação oficial, em vez de
  normalizar somente no cliente.

- [ ] Definir em `password-policy.ts`:

  ```ts
  export const PASSWORD_MIN_LENGTH = 10;
  ```

  Usar a constante no `minPasswordLength` do Better Auth e nos dois formulários.
  Atualizar a cópia da tela. Não invalidar senhas existentes de oito ou nove
  caracteres no login; a nova regra vale para criação e redefinição.

- [ ] Acrescentar eventos sanitizados `auth.password_reset` para `requested`,
  `accepted` e `failure`, contendo somente `correlationId`, resultado, provider e
  duração. Testar explicitamente que e-mail, nome, token, URL e mensagem do
  provider não aparecem no evento.

- [ ] Documentar a decisão: não há `requireEmailVerification`; qualquer proposta
  futura precisa tratar Contas de compra não verificadas e criar seu próprio
  template/fluxo.

**Verificar:** testes novos focais, `bun run typecheck`, `bun run check` e
`bun run docs:check` => exit 0.

---

## Sprint 4 — Tornar o limite de suporte concorrente e atômico

**Objetivo:** conservar o limite de três solicitações por dez minutos mesmo sob
requisições concorrentes da mesma Aluna.

**Arquivos:**

- Modificar: `src/features/support/server.ts`, `src/features/support/server.test.ts`
- Modificar: `docs/operations/outbox-and-transactional-effects.md`

- [ ] Criar teste concorrente que inicia quatro chamadas autenticadas para a mesma
  Conta e prova que somente três chegam ao insert/enqueue, sem deixar transação
  parcial.

- [ ] Mover a contagem para dentro da transação já existente e serializar por
  Conta com uma leitura bloqueante da própria linha:

  ```sql
  select id from users where id = $1 for update
  ```

  Executar a contagem, insert em `support_requests` e enqueue somente após esse
  lock. Tratar Conta ausente como falha segura. Não criar rate limit global em
  memória nem persistir IP, pois o contrato atual limita por Conta.

- [ ] Preservar rollback quando enqueue falhar e os limites de 160/1800
  caracteres. Atualizar o runbook com o fato de que o limite agora é serializado
  no Postgres.

**Verificar:** `bun run test -- src/features/support/server.test.ts
src/features/outbox/delivery.test.ts` => exit 0.

---

## Sprint 5 — Invalidar e reconciliar e-mails idempotentes obsoletos

**Objetivo:** impedir aviso de expiração desatualizado e tratar corretamente uma
repetição Resend cujo primeiro payload já foi aceito.

**Arquivos:**

- Modificar: `src/features/outbox/rules.ts`, `src/features/outbox/rules.test.ts`
- Modificar: `src/features/enrollments/maintenance.ts` e testes de manutenção
- Modificar: `src/features/outbox/delivery.ts`, `src/features/outbox/delivery.test.ts`
- Modificar: `src/features/email/server.ts`, `src/features/email/server.test.ts`
- Modificar: `docs/operations/outbox-and-transactional-effects.md`

- [ ] Evoluir somente o payload `email.access-expiry-warning` para versão 2,
  carregando `expiresAt` ISO e mantendo `enrollmentId`/`warningKind`. A chave deve
  incluir uma versão estável derivada da janela, por exemplo
  `email.access-expiry-warning/<enrollment>/<kind>/<epoch>/v2`; não incluir PII.
  O parser deve continuar entendendo v1 para mensagens já persistidas.

- [ ] No delivery, selecionar `enrollments.expires_at` e aceitar o aviso apenas
  se a matrícula estiver ativa, a data for exatamente a do payload e a janela
  ainda corresponder a 1 ou 7 dias. Mensagem obsoleta conclui como no-op, sem
  chamar Resend; a nova projeção enfileira a versão correta.

- [ ] Criar uma opção interna, não exposta a entrada web, para que entregas da
  outbox tratem `invalid_idempotent_request` como aceite prévio da mesma intenção.
  A chamada direta de reset público não recebe essa opção. Testar chave adulterada,
  erro transitório, erro permanente e conflito de uma mensagem legítima.

- [ ] Registrar no runbook que conteúdo dinâmico no retry pode diferir do primeiro
  envelope; a chave estável representa a intenção original, e conflito do Resend
  não deve ser “corrigido” com uma nova chave ou fallback.

**Verificar:** `bun run test -- src/features/outbox src/features/enrollments
src/features/email/server.test.ts` => exit 0.

---

## Sprint 6 — Registrar ciclo de vida real de entrega via Resend

**Objetivo:** manter a outbox como confirmação de aceite e acrescentar estado
durável de `accepted`, `delivered`, `bounced`, `complained`, `suppressed` e
`failed`, sem corpo de mensagem ou dados de destinatário.

**Arquivos:**

- Criar migration e snapshot Drizzle para `email_delivery_records` e
  `resend_webhook_events`
- Modificar: `src/db/schema.ts`, `src/db/migration-state.ts`
- Criar: `src/features/email/delivery-lifecycle.ts` e testes
- Criar: `src/app/api/webhooks/resend/route.ts` e testes
- Modificar: `src/features/email/server.ts`, `src/features/outbox/delivery.ts`
- Modificar: `src/lib/env.ts`, `.env.example`, testes de ambiente
- Modificar: `docs/integrations/resend.md`,
  `docs/operations/outbox-and-transactional-effects.md`,
  `docs/operations/observability-and-recovery.md`

- [ ] Antes da migration, fixar testes de contrato: aceitação retorna somente o
  ID do provider; evento duplicado é idempotente; assinatura inválida retorna
  erro sem gravar; evento desconhecido é armazenado/ignorado de modo seguro; PII,
  HTML, subject, token e URL não são colunas nem logs.

- [ ] Criar `email_delivery_records` com `outbox_message_id` opcional único,
  `provider_message_id` único, `accepted_at`, `latest_status`,
  `latest_status_at` e timestamps. Criar `resend_webhook_events` com chave única
  de evento do provider, tipo, data do provider, referência ao record e timestamps.
  Retenção mínima: eventos por 180 dias; records por prazo explicitamente
  documentado. Não reaproveitar o status genérico da outbox.

- [ ] Fazer o adaptador devolver o ID de aceitação do Resend e persistir esse ID
  no record durante o processamento da outbox. Fluxos sem outbox, como reset
  público, podem registrar somente métricas até haver requisito explícito de
  retenção.

- [ ] Implementar rota webhook com leitura do corpo bruto e verificação da
  assinatura usando `RESEND_WEBHOOK_SECRET`. Processar em transação, deduplicar
  pelo ID do evento, atualizar apenas transições permitidas e não acionar novo
  e-mail em bounce/complaint/suppression. Inscrever no Resend somente os eventos
  `email.delivered`, `email.bounced`, `email.complained`, `email.suppressed` e
  `email.failed` depois do deploy da rota.

- [ ] Incluir um procedimento de replay seguro: replay do webhook é idempotente;
  reprocessar outbox continua sendo ação administrativa separada e não ocorre em
  resposta ao webhook.

**Verificar:** migration em branch Neon não produtiva, testes de rota com corpo
assinado/alterado/duplicado, `bun run typecheck`, testes focais e
`bun run docs:check` => exit 0.

**STOP:** a biblioteca oficial de verificação exigir body já parseado, o provider
não fornecer ID estável de evento, ou a migration tocar em status de tópicos não
e-mail. Reprojetar antes de promover.

---

## Sprint 7 — Provar e observar cada fluxo sem expor conteúdo

**Objetivo:** tornar falhas de e-mail detectáveis por template/tópico e ampliar a
prova E2E sem chamar Resend em CI.

**Arquivos:**

- Substituir: `src/features/email/e2e-delivery-sink.ts` e testes
- Modificar: `src/features/email/server.ts`, `src/features/email/server.test.ts`
- Modificar: `src/app/api/e2e/email-deliveries/route.ts` e testes
- Modificar: `tests/e2e/critical-journeys.spec.ts`
- Modificar: `src/features/outbox/runner.ts`,
  `src/app/api/cron/outbox/route.ts`, `src/lib/observability.ts` e testes
- Modificar: `docs/operations/testing-and-ci.md`,
  `docs/operations/observability-and-recovery.md`

- [ ] Generalizar o sink para os seis tópicos. Cada registro pode conter somente
  tópico, alias, chave idempotente, hash do destinatário e fatos booleanos de
  contrato (`hasActionUrl`, `hasPlainTextContract`). Para reset, nunca armazenar
  query string ou token; para suporte, nunca armazenar assunto, mensagem ou
  e-mail.

- [ ] Adicionar testes E2E/integração para ativação, acesso liberado, expiração,
  suporte e vendas. Certificado deve verificar que o caminho público esperado é
  declarado como fato seguro, sem tentar renderizar HTML remoto na CI.

- [ ] Emitir métricas/eventos operacionais com dimensões de baixa cardinalidade:
  `emailTopic`, `outcome`, `provider` e ambiente. Proibir destinatário, payload,
  ID do agregado e ID do provider como dimensão. Mostrar no snapshot Admin apenas
  contagens por tópico e idade do backlog/dead letter.

- [ ] Criar alertas operacionais para dead letter de `email.*`, crescimento de
  `bounced`/`complained`/`suppressed` e ausência prolongada de aceite. Os valores
  de limiar não são SLO final nesta Sprint.

**Verificar:** suíte E2E isolada, testes unitários de sanitização e:

```powershell
bun run test -- src/features/email src/features/outbox
bun run test:e2e -- tests/e2e/critical-journeys.spec.ts
```

---

## Sprint 8 — Gate protegido, SLO e encerramento documental

**Objetivo:** impedir que drift do catálogo Hosted ou falha de e-mail passe por
um release verde e fechar os pontos operacionais restantes.

**Arquivos:**

- Modificar: `.github/workflows/deploy-vercel.yml`
- Modificar: `docs/operations/testing-and-ci.md`,
  `docs/operations/production-release-guide.md`, `docs/operations/release-state.md`
- Modificar: `docs/integrations/resend.md`, `docs/integrations/resend-templates.md`
- Modificar: `docs/operations/observability-and-recovery.md`, `docs/decisions.md`

- [ ] Inserir antes da promoção Production um job protegido que execute
  `bun run check:resend-templates -- --environment=production` com credencial
  administrativa de escopo mínimo, timeout explícito e saída sanitizada. CI de PR
  não consulta Resend. Definir override manual auditado para indisponibilidade do
  provider, nunca bypass silencioso.

- [ ] Não automatizar envio de e-mail em deploy. O canário continua manual, para
  caixa controlada e somente quando a mudança tocar provider, template, auth ou
  entrega. O checker read-only é o gate obrigatório; o canário comprova inbox.

- [ ] Coletar 30 dias de baseline por tópico: taxa de aceite, delivery final,
  retry, dead letter, bounce, complaint, suppression e idade. Só então ratificar
  SLO, janela de retry e limiares de alerta em `docs/decisions.md`.

- [ ] Fazer auditoria operacional de credenciais sem ler valores: confirmar que
  arquivos locais permanecem ignorados, conferir presença/fingerprint no secret
  manager e registrar se rotação é necessária. Rotacionar `RESEND_API_KEY` se
  houver exposição comprovada; rotacionar `BETTER_AUTH_SECRET` somente em janela
  aprovada, pois invalida sessões/tokens.

- [ ] Atualizar `last_verified_commit` e remover linguagem transitória de
  migração. Rodar:

  ```powershell
  bun run docs:check
  bun run verify:quick
  ```

**Aceite final:** nenhum import React Email; assuntos/HTML/texto pertencem ao
Resend; reset preserva segurança; suporte e expiração são concorrentes/corretos;
webhooks autenticados produzem lifecycle sem PII; E2E e operação distinguem
aceite de entrega; release Production tem gate explícito.

## Revisão de cobertura

- **Plano de templates:** Sprints 0–2 encerram evidência, ownership editorial,
  rollback e Sprint 11. Templates, domínio e logo foram rechecados; webhook,
  checker protegido e E2E continuam pendentes e foram incluídos.
- **Auditoria inicial:** allowlist, suporte durável, texto simples, branding,
  reset assíncrono, anti-enumeração e destino de certificado já estão concluídos
  e não reaparecem como implementação. Senha, normalização, corrida de expiração,
  concorrência de suporte, classificação/idempotência, entrega final, E2E, SLO e
  documentos restantes estão cobertos nas Sprints 3–8.
- **Não recuperável:** não há como provar retroativamente o drain do primeiro
  cutover Hosted. O plano registra essa lacuna e cria procedimento para futuros
  cutovers/rollbacks, em vez de fabricar uma evidência.
