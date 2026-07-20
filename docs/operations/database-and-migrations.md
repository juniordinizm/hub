---
status: runbook
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Banco e migrations

## Estado atual: onboarding bloqueado

Não há caminho seguro e reproduzível para criar o banco do zero a partir dos scripts atuais. Não execute comandos de mutação até o journal e os seeds serem corrigidos e testados em uma branch descartável.

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

O schema TypeScript exporta 28 tabelas. O journal termina em `0024_dashboard_banners`, mas há sete migrations posteriores/fora da sequência que não constam nele:

1. `0023_precise_text_reading_duration.sql`
2. `0024_enrollment_grants.sql`
3. `0025_manual_access_block_events.sql`
4. `0026_student_platform_block.sql`
5. `0027_case_insensitive_user_email.sql`
6. `0028_billing_operations_privacy.sql`
7. `0029_dashboard_banner_blur_data_url.sql`

Também há numeração duplicada em `0023` e `0024`. `drizzle-kit migrate` usa o journal; portanto `bun run db:migrate` não é seguro para promover o schema esperado.

## Comandos bloqueados

### `bun run db:migrate`

Pode ignorar as sete migrations e deixar aplicação/schema divergentes.

### `bun run db:reset`

`scripts/reset-db-keep-users.ts` é destrutivo, trunca dados e recria relações/contas. Não possui proteção robusta contra produção. O nome “keep-users” não torna o comando seguro.

### `bun run db:seed`

`scripts/seed-initial-data.mjs` escreve colunas removidas:

- `lessons.lesson_type`;
- `faq_items.category`.

Falha contra o schema atual.

### `bun run db:seed:student`

`scripts/bootstrap-student.ts` cria Matrícula diretamente sem Concessão, violando a projeção documentada em [Comércio e acesso](../domain/commerce-and-access.md).

### `bun run db:push` e `bun run db:studio`

Não são alternativas de onboarding. `db:push` pode alterar schema sem histórico; Studio permite mutação manual e acesso a dados sensíveis.

## Inspeções permitidas

Em branch de banco isolada e com URL conferida:

- comparar nomes/checksums de SQL e journal;
- consultar tabelas/migrations aplicadas em modo somente leitura;
- gerar diff sem aplicar;
- executar testes contra banco descartável.

Antes de qualquer comando, confirme host, database, branch e usuário. Nunca copie URL completa para log.

## Plano de correção futuro

Fora do escopo desta reorganização:

1. inventariar estado aplicado em cada ambiente;
2. decidir como incorporar as sete migrations ao histórico sem reaplicar SQL já existente;
3. eliminar números conflitantes;
4. adicionar proteção explícita de ambiente/host ao reset;
5. atualizar seeds para o schema e Concessões;
6. provar criação do zero em banco descartável;
7. provar upgrade de um snapshot anterior;
8. só então liberar comandos no README.

Não editar o journal “no escuro”: ambiente que recebeu SQL manualmente pode exigir baseline diferente.

## Backup, rollback e incidentes

- schema change exige backup/branch antes da aplicação;
- rollback preferencial é forward-fix testado; SQL reverso precisa considerar dados;
- em divergência, pare deploys e escrita afetada;
- registre migration esperada, migration aplicada e impacto;
- não use reset como rollback.

## Evidências

`drizzle.config.ts`, `src/db/index.ts`, `src/db/connection-url.ts`, `src/db/schema.ts`, `src/db/migrations/meta/_journal.json`, `scripts/reset-db-keep-users.ts`, `scripts/seed-initial-data.mjs`, `scripts/bootstrap-student.ts`.
