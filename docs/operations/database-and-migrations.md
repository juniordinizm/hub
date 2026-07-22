---
status: runbook
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Banco e migrations

## Estado atual

O repositório usa cadeia Drizzle forward-only. As migrations `0023` a `0030` e `0031`/`0032` foram promovidas para a branch `production` do projeto Neon `protear` em 2026-07-21. As migrations `0033_default_learning_analytics_preference` e `0034_remove_privacy_request_workflow` foram promovidas em 2026-07-22.

Não execute `bun run db:migrate` em ambiente compartilhado sem URL direta conferida, branch/backup disponível, validação em banco descartável e aprovação explícita de promoção.

## Autoridades

Compare sempre, nesta ordem operacional:

1. `src/db/schema.ts`;
2. SQL em `src/db/migrations`;
3. `src/db/migrations/meta/_journal.json` e snapshots gerados pelo Drizzle;
4. catálogo e journal do banco alvo.

`bun run db:migrations:check` verifica a integridade versionada. Ele não prova que o banco remoto recebeu as migrations.

## Conexões

- runtime: `DATABASE_URL`, preferencialmente endpoint pooled;
- migrations e auditoria: `DATABASE_URL_DIRECT`, endpoint direto;
- fallback do Drizzle: `DATABASE_URL` se a URL direta estiver ausente;
- `withVerifiedSslMode` exige `sslmode=verify-full` para aliases menos estritos.

Neon recomenda pooled em runtime serverless e direto para migrations, `pg_dump` e operações com estado de sessão. O plano Free não fornece proteção de branch; confirme manualmente projeto, branch, host, banco e usuário antes de qualquer escrita compartilhada.

## Migrations e geração

### `bun run db:generate`

Gera SQL, journal e snapshot; não aplica schema. Revise o SQL antes de aceitá-lo. Não edite journal ou snapshot manualmente.

Renomeações de tabela/coluna exigem que o Drizzle reconheça o pareamento. Quando o gerador pedir confirmação interativa, selecione a renomeação real, não uma criação e remoção equivalentes. Se a execução não tiver TTY, pare e rode o gerador em terminal interativo; não improvise metadata JSON.

### `0033_default_learning_analytics_preference`

O SQL forward-only renomeia `learning_analytics_consents` para `learning_analytics_preferences`, renomeia `consented_at`/`revoked_at` para `enabled_at`/`disabled_at`, remove `learning_reengagements` e seu enum. A promoção foi aplicada uma vez em 2026-07-22; a segunda execução do migrador não reaplicou alterações. A próxima geração de schema que envolver renomeação deve continuar sendo revisada em terminal interativo para o Drizzle reconhecer o pareamento sem metadata manual.

### `0034_remove_privacy_request_workflow`

Remove `privacy_requests` e seu enum, que não possuem usuário solicitante, fluxo administrativo ativo ou política jurídica aprovada. Foi promovida em 2026-07-22 para o ambiente sem produção ativa, após auditoria de pré-condições.

### `bun run db:migrate`

Só na promoção controlada. Não é onboarding e não substitui auditoria de schema.

## Comandos bloqueados

### `bun run db:reset` e `bun run db:reset:local`

São destrutivos e só aceitam `NODE_ENV=development`/`test`, host local, banco listado em `LOCAL_DATABASE_NAMES`, `--allow-destructive-local-reset` e `--confirm=<nome-do-banco>`. Exemplo para banco descartável local:

```bash
bun run db:reset:local -- --allow-destructive-local-reset --confirm=hub_test
```

Nunca execute contra Neon, Vercel ou qualquer ambiente compartilhado.

### `bun run db:seed` e `bun run db:seed:student`

São somente para banco local descartável. O seed de Aluna cria Concessão manual e deriva Matrícula com `rebuildEnrollmentProjection`; não cria Pedido financeiro fictício.

### `bun run db:smoke:empty`

Cria banco PostgreSQL local temporário, aplica a cadeia, roda seed duas vezes e remove o banco ao terminar. Requer `SMOKE_DATABASE_URL` ou URL local e recusa host remoto. É o smoke indicado para CI quando houver PostgreSQL local descartável.

### `bun run test:certificates:integration`

Executa concorrência de conclusão/outbox em Postgres real e requer `CERTIFICATE_CONCURRENCY_DATABASE_URL` de banco descartável migrado. Nunca aponte para banco compartilhado.

### `bun run db:push` e `bun run db:studio`

Não são alternativas para onboarding nem promoção. `db:push` altera schema sem histórico; Studio permite mutação manual e exposição de dados sensíveis.

## Promoção controlada

1. Confirme projeto, branch, host, database e usuário da URL direta sem registrar segredo.
2. Rode `bun run db:migrations:check` e valide a migration em banco descartável.
3. Crie backup ou branch isolada quando disponível; no Free, registre a ausência de proteção e o plano de recuperação.
4. Rode `bun run db:migrations:inspect -- --environment=<rótulo-sem-segredo>` em modo somente leitura.
5. Aplique `bun run db:migrate` uma única vez com aprovação explícita.
6. Audite catálogo e journal; execute migrador uma segunda vez para confirmar ausência de reaplicação.
7. Registre ambiente, operadora, migrations esperadas/aplicadas e impacto.

Em dados existentes, valide contagens e relações antes e depois. Rollback preferencial é forward-fix revisado; não use reset como rollback.

## Histórico operacional confirmado

- `0023`/`0024`: validadas em branch temporária e promovidas uma vez para `production`; auditoria posterior confirmou outbox vazio e journal com 25 entradas.
- `0025` a `0030`: promovidas em 2026-07-21; auditoria posterior confirmou referências obrigatórias de `course_version_id` e unicidades esperadas. A base não continha Cursos, Matrículas ou Certificados, portanto não é evidência de backfill com dados históricos.
- `0031`/`0032`: promovidas para suportar analytics minimizado e métricas diárias. A configuração de produção e dados externos permanecem sujeitos a verificação humana no painel.
- `0033`: promovida em 2026-07-22 pelo migrador Drizzle após auditoria de pré-condições; a segunda execução terminou sem reaplicar schema e o journal passou a conter a entrada correspondente.
- `0034`: promovida em 2026-07-22 pelo migrador Drizzle; removeu a tabela e o enum do workflow de solicitações de dados. A auditoria posterior confirmou a ausência de ambos.

## Recuperação

- pare deploys e a escrita afetada em divergência;
- registre migration esperada, aplicada e impacto;
- restaure aplicação compatível com o schema ou aplique forward-fix revisado;
- não use `db:reset`, `db:push` ou rollback SQL destrutivo;
- para ensaio, use branch/banco isolado e siga [Observabilidade e recuperação](observability-and-recovery.md#ensaio-de-recuperação).

## Evidências

`drizzle.config.ts`, `src/db/index.ts`, `src/db/connection-url.ts`, `src/db/schema.ts`, `src/db/migrations/meta/_journal.json`, `scripts/check-migrations.ts`, `scripts/inspect-migration-state.ts`, `scripts/reset-local-database.ts`, `scripts/seed-initial-data.ts` e `scripts/bootstrap-student.ts`.
