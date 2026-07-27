---
status: runbook
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Banco e migrations

## Estado atual

O repositório usa cadeia Drizzle forward-only. Em 2026-07-26, a cadeia
`0000` a `0043` estava aplicada à branch `production`
(`br-dark-boat-ac5ju6m4`) do projeto Neon definitivo
`damp-snow-22911188`. A auditoria posterior confirmou 44 entradas no journal,
topo em `0043`, hashes idênticos ao repositório e paridade dos objetos críticos
descritos neste runbook.

`0042_serverless_job_leases` adiciona os leases persistentes dos crons e a fila
de limpeza de artes de Certificado. `0043_staged_admin_image_uploads` registra,
vincula ao agregado e garante claim exclusivo dos uploads administrativos
diretos ao R2. O primeiro desenho de `0042` foi exercitado na branch temporária
`br-raspy-cloud-aco4wfg2`, mas a validação foi descartada depois que a revisão
encontrou requisitos adicionais; a branch temporária foi removida sem promover
mudanças. A versão final foi validada na branch descartável
`br-wild-dew-ac538g2r`, promovida com autorização explícita e auditada antes da
remoção automática dessa branch.

Não execute `bun run db:migrate` em ambiente compartilhado sem URL direta conferida, branch/backup disponível, validação em banco descartável e aprovação explícita de promoção.

## Autoridades

Compare sempre, nesta ordem operacional:

1. `src/db/schema.ts`;
2. SQL em `src/db/migrations`;
3. `src/db/migrations/meta/_journal.json` e snapshots gerados pelo Drizzle;
4. catálogo e journal do banco alvo.

`bun run db:migrations:check` verifica a integridade versionada. Ele não prova que o banco remoto recebeu as migrations.

Gerar ou commitar uma migration não altera banco algum. Cada branch Neon possui
seu próprio catálogo e journal. Executar o migrador em `development` não altera
`vercel-preview`, `production` ou branches já existentes. Uma branch nova herda
o estado da branch-pai no instante da criação e depois evolui de forma isolada.

O mesmo gate resolve o snapshot autoritativo pela última entrada do journal e
valida nele a paridade do catálogo de Certificados com `schema.ts`. Os snapshots
`0038` e `0039` permanecem como histórico forward-only da recuperação de
metadata, pois sua aplicação externa não pode ser descartada com segurança.
Para checks e novos diffs, somente o snapshot correspondente ao topo atual do
journal é autoridade; nesta cadeia, `0043_snapshot.json`.

## Conexões

- runtime: `DATABASE_URL`, preferencialmente endpoint pooled;
- migrations e auditoria: `DATABASE_URL_DIRECT`, endpoint direto;
- fallback do Drizzle: `DATABASE_URL` se a URL direta estiver ausente;
- `withVerifiedSslMode` exige `sslmode=verify-full` para aliases menos estritos.

O pool web limita a espera de conexão a dez segundos, mantém no máximo três
conexões por instância Vercel e não recebe `DATABASE_URL_DIRECT`. Fora da
Vercel, a política local mantém no máximo dez conexões. A readiness usa um pool isolado de
uma conexão e timeout de um segundo, para falhar rápido sem impor essa latência
agressiva às requisições normais. Ela confirma a entrada da migration mínima
compatível declarada em `src/db/migration-state.ts`; a CI falha se esse
marcador não acompanhar o topo do journal.

Neon recomenda pooled em runtime serverless e direto para migrations, `pg_dump` e operações com estado de sessão. O plano Free não fornece proteção de branch; confirme manualmente projeto, branch, host, banco e usuário antes de qualquer escrita compartilhada.

## Migrations e geração

### `bun run db:generate`

Gera SQL, journal e snapshot; não aplica schema. Revise o SQL antes de aceitá-lo. Não edite journal ou snapshot manualmente.

Renomeações de tabela/coluna exigem que o Drizzle reconheça o pareamento. Quando o gerador pedir confirmação interativa, selecione a renomeação real, não uma criação e remoção equivalentes. Se a execução não tiver TTY, pare e rode o gerador em terminal interativo; não improvise metadata JSON.

A correção de progresso curricular está em `0036_ambitious_shinobi_shaw`: adiciona uma chave estável às Aulas e uma unicidade parcial para publicação `draft`. Foi gerada em terminal interativo; antes de promovê-la, revise o SQL para confirmar que contém somente essas três alterações e valide-a em banco descartável.

`0040_certificate_render_claim` adiciona o token e o instante do claim persistido de renderização. Os checks exigem que ambos sejam nulos ou preenchidos em conjunto e que um Certificado `ready` possua chave, hash e data de renderização sem claim ativo. A migration foi gerada normalmente pelo Drizzle e validada antes da promoção.

### Recuperação de snapshot após migration customizada

Uma migration criada com `--custom` preserva o snapshot anterior. Se o SQL manual alterar o catálogo, nunca reescreva sua migration, journal ou snapshot depois de aplicada. Corrija primeiro `schema.ts`; em terminal interativo, gere uma migration normal de baseline; revise o diff e substitua apenas seu SQL por no-op comentado quando o catálogo do alvo já possuir as alterações. O snapshot e journal produzidos pelo Drizzle passam a ser a nova base para diffs futuros. Valide a cadeia inteira em banco descartável antes da promoção.

### `0033_default_learning_analytics_preference`

O SQL forward-only renomeia `learning_analytics_consents` para
`learning_analytics_preferences`, renomeia `consented_at`/`revoked_at` para
`enabled_at`/`disabled_at`, remove `learning_reengagements` e seu enum. A
próxima geração de schema que envolver renomeação deve continuar sendo
revisada em terminal interativo para o Drizzle reconhecer o pareamento sem
metadata manual.

### `0034_remove_privacy_request_workflow`

Remove `privacy_requests` e seu enum, que não possuem usuário solicitante, fluxo administrativo ativo ou política jurídica aprovada. Foi promovida em 2026-07-22 para o ambiente sem produção ativa, após auditoria de pré-condições.

### `bun run db:migrate`

Só na promoção controlada. Não é onboarding e não substitui auditoria de schema.

### `bun run db:migrate:development`

É o comando exclusivo do workflow manual `Migrate Neon development`. Exige
`DATABASE_URL_DIRECT` e `DEVELOPMENT_DATABASE_HOST`, normaliza aliases
pooled/direto, recusa hostname divergente e recusa explicitamente o compute
Production conhecido. Depois da guarda, reutiliza o advisory lock global e
aplica somente migrations pendentes.

Não execute esse comando manualmente na rotina local. O workflow protegido usa
somente o SHA atual da `main` com CI verde e audita o banco depois da aplicação.

### `bun run db:migrate:production`

É o comando de promoção para produção. Exige `DATABASE_URL_DIRECT`, adquire um
advisory lock global, executa a cadeia Drizzle e libera conexão/lock mesmo em
falha. No fluxo Vercel, o workflow protegido executa esse comando como etapa
isolada antes de construir o deployment Production não promovido. Nunca
execute como hook de inicialização da aplicação.

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
5. Aplique `bun run db:migrate:production` uma única vez com aprovação explícita.
6. Audite catálogo e journal; execute migrador uma segunda vez para confirmar ausência de reaplicação.
7. Registre ambiente, operadora, migrations esperadas/aplicadas e impacto.

Em dados existentes, valide contagens e relações antes e depois. Rollback preferencial é forward-fix revisado; não use reset como rollback.

## Histórico operacional confirmado

- `0000` a `0040`: aplicadas em 2026-07-25 ao novo projeto vazio
  `neurocapacitar-lms`, após duas execuções bem-sucedidas na branch temporária
  `migration-verify-official`. A segunda execução confirmou idempotência. A
  produção apresentou 41 entradas no journal, 35 tabelas, 51 de 51 checks de
  estado presentes e zero Contas, Cursos, Certificados, Pedidos ou mensagens de
  outbox. A branch temporária foi removida após a auditoria.
- `0000` a `0040`: promovidas também em 2026-07-25 para o alvo definitivo
  `damp-snow-22911188`, branch `production` (`br-dark-boat-ac5ju6m4`).
  A auditoria confirmou 41 entradas no journal e 35 tabelas antes da criação da
  primeira Conta Admin.
- `0023`/`0024`: validadas em branch temporária e promovidas uma vez para `production`; auditoria posterior confirmou outbox vazio e journal com 25 entradas.
- `0025` a `0030`: promovidas em 2026-07-21; são histórico da introdução de versões curriculares. A base não continha Cursos, Matrículas ou Certificados, portanto não é evidência de backfill com dados históricos.
- `0031`/`0032`: promovidas para suportar analytics minimizado e métricas diárias. A configuração de produção e dados externos permanecem sujeitos a verificação humana no painel.
- `0033` a `0040`: promovidas em 2026-07-25 pelo workflow de migration do Neon
  após execução e auditoria em branch temporária. A verificação posterior em
  `production` confirmou 41 entradas no journal, topo `0040`, tabelas de
  publicações/conclusões/templates, ausência de `course_versions` e `pdf_url`,
  oito campos de renderização, três constraints críticas, três índices
  parciais esperados e zero duplicidades entre Certificados válidos. O banco
  tinha zero Cursos e zero Certificados, portanto os backfills não foram
  exercitados com dados históricos.
- `0041_public_signup_student_profiles`: promovida em 2026-07-25 para o alvo
  definitivo. A auditoria Vercel-first confirmou 42 entradas no journal e
  paridade com o repositório.
- `0042_serverless_job_leases`: o primeiro ensaio em 2026-07-26 na branch
  temporária `br-raspy-cloud-aco4wfg2` confirmou o mecanismo básico, mas foi
  cancelado sem promoção após a revisão exigir deadlines e fencing adicionais.
- `0043_staged_admin_image_uploads`: gerada em 2026-07-26 para registrar,
  confirmar, reivindicar e consumir uma única vez uploads administrativos
  vinculados ao ator e agregado. A validação conjunta autoritativa de
  `0042`/`0043` está na migration Neon
  `ff79a0c9-5404-49d1-8582-bd7675fb8015`, branch temporária
  `br-wild-dew-ac538g2r`: confirmou 44 entradas, hashes do repositório, topo
  `0043`, quatro índices, três constraints e exclusão mútua/reclaim dos claims.
  A migration foi promovida com autorização explícita em 2026-07-26. A
  auditoria da branch definitiva repetiu as mesmas evidências e confirmou zero
  leases, limpezas ou uploads temporários residuais.

## Recuperação

- pare deploys e a escrita afetada em divergência;
- registre migration esperada, aplicada e impacto;
- restaure aplicação compatível com o schema ou aplique forward-fix revisado;
- não use `db:reset`, `db:push` ou rollback SQL destrutivo;
- para ensaio, use branch/banco isolado e siga [Observabilidade e recuperação](observability-and-recovery.md#ensaio-de-recuperação).

## Evidências

`drizzle.config.ts`, `src/db/index.ts`, `src/db/connection-url.ts`,
`src/db/migration-target.ts`, `src/db/schema.ts`,
`src/db/migrations/meta/_journal.json`, `scripts/check-migrations.ts`,
`scripts/inspect-migration-state.ts`, `scripts/migrate-development.ts`,
`scripts/reset-local-database.ts`, `scripts/seed-initial-data.ts` e
`scripts/bootstrap-student.ts`.
