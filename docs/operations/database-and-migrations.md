---
status: runbook
owner: engineering
last_verified_commit: 06f0c061e502b5990069acd7c4fb36d7fed13301
---

# Banco e migrations

## Estado atual: histórico reconciliado e promovido

`bun run db:migrations:check` passa: o histórico após `0019` foi condensado em
`0020_reconcile_schema_after_manual_changes.sql`. As migrations `0021` e `0022` acrescentam a
fonte de Concessão manual e a separação entre `order_id` e `manual_reference`. As três foram
promovidas de forma controlada em `production`.

Os comandos locais de reset e seed foram protegidos. Eles só são seguros para banco local
descartável, com as proteções e confirmações abaixo.

## Conexões

- runtime: `DATABASE_URL`, preferencialmente endpoint pooled;
- migrations/admin: `DATABASE_URL_DIRECT`, endpoint direto;
- fallback do Drizzle config: `DATABASE_URL` se o direto estiver ausente;
- TLS: `withVerifiedSslMode` força `sslmode=verify-full` para aliases menos estritos.

Neon recomenda pooled para aplicações serverless e direto para migrations, `pg_dump` e operações com estado de sessão. Painel, branches e strings reais deste projeto não foram verificados.

## Schema e migrations

Autoridades a comparar:

1. `src/db/schema.ts`;
2. SQL em `src/db/migrations`;
3. `src/db/migrations/meta/_journal.json`;
4. schema do banco alvo.

O schema TypeScript exporta 28 tabelas. O journal tem uma sequência única até
`0022_manual_enrollment_grants`; os arquivos anteriores `0020`–`0029` foram substituídos por
`0020_reconcile_schema_after_manual_changes` e permanecem recuperáveis pelo Git.

`drizzle-kit migrate` exige promoção controlada em ambientes compartilhados: backup ou branch,
URL direta conferida, auditoria antes/depois e segunda execução sem reaplicação.

## Comandos bloqueados

### `bun run db:migrate`

Execute em ambiente compartilhado somente no procedimento de promoção controlada. Não é passo
de onboarding nem substitui a validação em banco descartável.

### `bun run db:generate`

Está liberado. O snapshot `0020` foi reconstruído a partir de `src/db/schema.ts`, os snapshots
históricos `0023`/`0024` incompatíveis foram removidos e uma geração sem alteração confirmou
que o Drizzle não produz SQL adicional. Revise sempre o SQL gerado; `db:generate` não aplica
migration.

### `bun run db:reset` e `bun run db:reset:local`

O reset é destrutivo e trunca dados; não recria contas. Ele só aceita:

- `NODE_ENV=development` ou `NODE_ENV=test`;
- host `localhost`, `127.0.0.1` ou `::1`;
- `LOCAL_DATABASE_NAMES` contendo explicitamente o banco alvo;
- a flag `--allow-destructive-local-reset`;
- `--confirm=<nome-do-banco>` com o nome exato do banco alvo.

Exemplo exclusivamente para banco descartável local:

```bash
bun run db:reset:local -- --allow-destructive-local-reset --confirm=hub_test
```

Não execute contra Neon, Vercel ou qualquer banco compartilhado.

### `bun run db:seed`

O seed de catálogo usa as colunas atuais e transação única, mas só aceita banco local em
`development`/`test`. Ele não é um passo de onboarding enquanto não houver banco local
descartável configurado para o time.


### `bun run db:smoke:empty`

Cria um banco com nome `hub_smoke_<timestamp>` em PostgreSQL local, aplica todas as
migrations, executa o seed duas vezes, verifica curso/módulos/aulas/FAQ e remove o banco no
encerramento. Requer `SMOKE_DATABASE_URL` ou uma URL local de banco e não aceita host remoto.
É o comando indicado para CI quando houver PostgreSQL descartável local.

### `bun run db:seed:student`

Cria ou atualiza uma Conta de teste local e uma Concessão com fonte `manual`; a Matrícula é
derivada por `rebuildEnrollmentProjection`. Aceita os argumentos opcionais
`<email> <senha> <nome> <curso-slug>`. Continua restrito a banco local em `development` ou
`test` e não cria Pedido financeiro fictício. Requer as migrations `0021` e `0022`, já promovidas
para produção em 2026-07-20.

### `bun run db:push` e `bun run db:studio`

Não são alternativas de onboarding. `db:push` pode alterar schema sem histórico; Studio permite mutação manual e acesso a dados sensíveis.

## Inspeções permitidas

Em branch de banco isolada e com URL conferida:

- comparar nomes/checksums de SQL e journal;
- consultar tabelas/migrations aplicadas em modo somente leitura;
- gerar diff sem aplicar;
- executar testes contra banco descartável.

Antes de qualquer comando, confirme host, database, branch e usuário. Nunca copie URL completa para log.

Use a auditoria versionada somente com a URL direta e um rótulo sem segredo:

```bash
bun run db:migrations:inspect -- --environment=<ambiente>
```

Ela abre `BEGIN READ ONLY`, usa timeout de 15 segundos e emite apenas estados de
catálogo, contagens e hashes do Drizzle. O hash não é o nome do arquivo de migration.

### Auditoria registrada em 2026-07-20

O inventário via Neon MCP identificou todas as branches do projeto `protear`:

- `production` (`neondb`): `0024` a `0027` presentes; `0028` e `0029` ausentes.
- `neuro-dev` (`neondb`): `0024` a `0029` presentes.

Em ambos, o journal do banco termina no timestamp de `0019`; as estruturas posteriores
foram aplicadas fora dele. `0023_precise_text_reading_duration` tem zero divergências de
duração e carga horária nas duas branches, mas consistência não prova execução do SQL.

Os ambientes divergem. A reconciliação foi validada pelo arquivo inteiro na branch temporária
`migration-reconciliation-replay-20260720`: criou as lacunas de produção
(`dashboard_banners`, `0028` e `0029`), atualizou o journal para
`0020_reconcile_schema_after_manual_changes` e a segunda execução do `drizzle-kit` não reaplicou
SQL. Em uma base vazia temporária, as 21 migrations criaram 28 tabelas; o seed rodou duas vezes e
permaneceu em 1 curso, 6 módulos, 28 aulas e 3 FAQs. As branches de teste foram removidas.

Em 2026-07-20, as migrations `0020`, `0021` e `0022` foram promovidas para `production`. O
journal passou a conter 23 entradas. A auditoria posterior confirmou a fonte `manual` no enum,
as colunas `order_id` e `manual_reference`, os dois índices únicos e a restrição
`enrollment_grants_source_shape_check`. Uma segunda execução do migrador não reaplicou SQL.

## Regra para a próxima promoção

Não editar o journal “no escuro”: ambiente que recebeu SQL manualmente pode exigir baseline diferente.
Crie uma migration forward-only, execute `db:migrations:check`, valide em banco vazio descartável,
audite o alvo e aplique uma vez com URL direta. Em seguida, audite o catálogo e execute o migrador
uma segunda vez para confirmar a ausência de reaplicação.

## Backup, rollback e incidentes

- schema change exige backup/branch antes da aplicação;
- rollback preferencial é forward-fix testado; SQL reverso precisa considerar dados;
- em divergência, pare deploys e escrita afetada;
- registre migration esperada, migration aplicada e impacto;
- não use reset como rollback.

## Evidências

`drizzle.config.ts`, `src/db/index.ts`, `src/db/connection-url.ts`, `src/db/schema.ts`, `src/db/migrations/meta/_journal.json`, `scripts/check-migrations.ts`, `scripts/inspect-migration-state.ts`, `scripts/reset-local-database.ts`, `scripts/seed-initial-data.ts`, `scripts/bootstrap-student.ts`.
