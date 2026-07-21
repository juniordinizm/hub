---
status: runbook
owner: engineering
last_verified_commit: 754b654a357274fd5af504e4e714efb2dd519e2a
---

# Banco e migrations

## Estado atual: produção em `0024`; repositório bloqueado em `0026`

As migrations `0020` a `0024` foram promovidas de forma controlada em `production`. Em
2026-07-21, `0023` criou `outbox_messages` e `0024` limitou o reprocessamento manual a uma vez;
o journal de produção tem 25 entradas.

O repositório contém também `0025_admin_certificate_privacy_workflows` e
`0026_certificate_privacy_segregation`, ainda não promovidas. O journal local referencia `0026`,
mas `src/db/migrations/meta/0026_snapshot.json` não foi versionado; por isso
`bun run db:migrations:check` falha até o snapshot ser reconstruído e revisado. Não execute
`db:migrate` em ambiente compartilhado enquanto esse gate estiver vermelho.

Os comandos locais de reset e seed foram protegidos. Eles só são seguros para banco local
descartável, com as proteções e confirmações abaixo.

## Conexões

- runtime: `DATABASE_URL`, preferencialmente endpoint pooled;
- migrations/admin: `DATABASE_URL_DIRECT`, endpoint direto;
- fallback do Drizzle config: `DATABASE_URL` se o direto estiver ausente;
- TLS: `withVerifiedSslMode` força `sslmode=verify-full` para aliases menos estritos.

Neon recomenda pooled para aplicações serverless e direto para migrations, `pg_dump` e operações com estado de sessão. O painel confirmou o projeto `protear` e sua branch `production` em 2026-07-21; o restante das configurações operacionais continua sujeito à verificação no painel.

## Schema e migrations

Autoridades a comparar:

1. `src/db/schema.ts`;
2. SQL em `src/db/migrations`;
3. `src/db/migrations/meta/_journal.json`;
4. schema do banco alvo.

O schema TypeScript exporta 29 tabelas. O journal tem uma sequência única até
`0026_certificate_privacy_segregation`; `0023` cria `outbox_messages` e `0024` limita
reprocessamento manual a uma vez. Os arquivos históricos anteriores `0020`–`0029` foram
substituídos por `0020_reconcile_schema_after_manual_changes` e permanecem recuperáveis pelo Git.

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

### `bun run test:certificates:integration`

Executa a concorrência de `completeLesson` e da outbox contra Postgres real, incluindo retry, callback de vídeo
duplicado, certificado válido, certificado revogado, idempotência e leases concorrentes. Requer
`CERTIFICATE_CONCURRENCY_DATABASE_URL` apontando para um banco descartável já migrado; nunca use
um banco compartilhado. Sem essa variável, o arquivo de integração é ignorado pelo teste unitário.

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

### Auditoria de recuperação e promoção em 2026-07-21

O projeto Neon `protear` foi confirmado como o ambiente de produção acessível. Antes da promoção,
`production` tinha 23 entradas no journal e não possuía `outbox_messages`. A branch temporária
`migration-promotion-0023-0024-20260721` recebeu `0023` e `0024` com sucesso, chegou a 25 entradas,
possuía a tabela de outbox vazia e foi removida depois da conferência.

Com aprovação explícita, as mesmas migrations foram aplicadas uma vez em `production` pela URL direta
conferida. A auditoria posterior confirmou 25 entradas no journal, existência de `outbox_messages` e
zero mensagens pendentes. A segunda execução do migrador terminou sem reaplicar schema. A branch
`production` continua sem proteção: o plano Free não oferece esse recurso; essa limitação deve ser
reavaliada antes de qualquer nova mudança estrutural compartilhada.

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
