---
status: canonical
owner: engineering
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# Testes e CI

## Objetivo

A CI prova uma alteração uma vez antes do merge. Ela não é um mecanismo de
deploy e não usa Production, Staging ou branches Neon efêmeras.

## Quando executa

O workflow `.github/workflows/ci.yml` executa em:

- PRs para `staging`;
- PRs de hotfix para `main`;
- PRs de reconciliação `main → staging`;
- execução manual para diagnóstico.

Ele não executa em cada `push` para `main` ou `staging`. O merge em `staging`
possui somente uma operação separada para aplicar migrations no banco persistente
de Staging; essa operação não repete os testes.

## Banco de teste

Cada job usa o service container PostgreSQL 18 do próprio runner. São criados
dois bancos independentes:

- `hub_integration`: testes de integração PostgreSQL;
- `hub_e2e`: migrations e jornadas Playwright.

As URLs usam `sslmode=disable` somente dentro do runner descartável. Nenhuma
URL Neon, segredo financeiro ou dado real é usado pela CI.

O modo E2E usa uma regra de rate limit de login isolada para acomodar os
projetos desktop e mobile que executam contra o mesmo endereço do runner. Ela
permite até 100 tentativas em dez segundos somente quando `E2E_TEST_MODE=true`.
O limite normal de autenticação não é alterado e essa variável não é usada em
Staging ou Production.

## Ordem dos gates

1. checkout completo para validação documental;
2. `bun install --frozen-lockfile`;
3. `bun run docs:check`;
4. `bun run db:migrations:check`;
5. `bun run typecheck`;
6. `bun run check`;
7. `bun run test`;
8. `bun audit --production`;
9. migrations no banco de integração;
10. integração PostgreSQL;
11. migrations no banco E2E;
12. jornadas desktop e mobile do Playwright;
13. relatório e artefato de falha E2E;
14. build Next.js com configuração sintética;
15. Knip.

Não use `DATABASE_URL` de Development, Staging ou Production na CI. Se o
container PostgreSQL não subir, corrija o workflow ou a imagem; não substitua o
alvo por Neon apenas para fazer a execução passar.

## CodeRabbit

O CodeRabbit é uma revisão assistida separada da CI. Antes do Pull Request,
tente o procedimento em [Revisão assistida com CodeRabbit](code-review-with-coderabbit.md)
com a base `staging`; para hotfix, use `main`. A etapa exige disponibilidade da
CLI e autenticação válidas. Se qualquer uma estiver ausente, registre o motivo
do skip e não bloqueie o trabalho.

CodeRabbit não substitui `bun run verify`, o workflow `CI`, revisão de regra de
negócio ou validação de deployment. Não adicione a revisão como check obrigatório
sem uma decisão explícita sobre plano, custo, disponibilidade e comportamento
do repositório.

## Dependabot e forks

Pull requests de forks não recebem secrets. Os testes locais e estáticos ainda
podem executar; qualquer gate que exigisse provider real deve falhar de forma
explícita ou ser coberto por fixture local. Não copie secrets para tornar um
fork verde.

## Custos e duração

Uma única job reduz instalações, runners e branches Neon duplicadas. O objetivo
operacional é p50 abaixo de oito minutos e p95 abaixo de doze minutos. Meça a
duração por run; não adicione retry silencioso para esconder flakiness.

O cron automático de Staging foi removido. A operação manual
`Run Staging jobs` continua disponível e chama Asaas, outbox, JMVStream, Resend,
enrollments e maintenance quando necessário para homologação.

## Testes locais

Antes do PR:

```powershell
bun run verify:quick
bun run verify
```

Para testar somente integração, configure uma URL PostgreSQL descartável e
execute `bun run test:certificates:integration`. Para E2E, use as URLs e os
servidores locais definidos no `playwright.config.ts`.

### PostgreSQL descartável no Windows

O caminho recomendado é executar a CI, que já provisiona PostgreSQL 18. Se o
Docker Desktop estiver instalado, o fluxo local seguro é:

```powershell
docker run --name hub-release-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=postgres `
  -p 5432:5432 `
  -d postgres:18-alpine

docker exec hub-release-postgres createdb -U postgres hub_integration
docker exec hub-release-postgres createdb -U postgres hub_e2e
```

Na mesma sessão PowerShell, configure somente o banco descartável:

```powershell
$integration = "postgresql://postgres:postgres@127.0.0.1:5432/hub_integration?sslmode=disable"
$e2e = "postgresql://postgres:postgres@127.0.0.1:5432/hub_e2e?sslmode=disable"
$env:INTEGRATION_DATABASE_URL = $integration
$env:CERTIFICATE_CONCURRENCY_DATABASE_URL = $integration
$env:E2E_DATABASE_URL = $e2e
$env:DATABASE_URL = $integration
$env:DATABASE_URL_DIRECT = $integration
```

Execute migrations, integração e E2E em ordem:

```powershell
bun run db:migrate:e2e
bun run test:certificates:integration
$env:DATABASE_URL = $e2e
$env:DATABASE_URL_DIRECT = $e2e
bun run db:migrate:e2e
bun run test:e2e
```

Não use banco de Staging ou Production. Se a porta 5432 estiver ocupada, use
outra porta e ajuste as URLs; o container deve ser descartado depois do teste.

Os testes unitários carregam `tests/setup.ts`, que remove variáveis de aplicação
herdadas do processo e restaura o ambiente ao final de cada teste. Isso impede
que `.env.local` altere silenciosamente o resultado da suíte. O contrato fica em
`src/testing/hermetic-environment.test.ts`.

O artifact `playwright-report` contém somente evidência de teste e possui
retenção explícita de 14 dias no workflow de CI. Evidências de backup e release
não devem ser colocadas nesse artifact; cada uma precisa de retenção e runbook
próprios.

O audit de produção também mantém `browserslist` fixado pelo override do
`package.json`; rode `bun audit --production` depois de qualquer alteração no
lockfile.

## Contratos obrigatórios

Os testes de workflow devem detectar regressão quando:

- CI voltar a executar em `push`;
- aparecer dependência de `NEON_CI_API_KEY`;
- uma segunda instalação de dependências for adicionada;
- Staging voltar a ser publicado pelo GitHub Action;
- o cron JMVStream deixar de existir ou mudar de quinze minutos;
- release permitir hotfix com migration;
- reconciliação deixar de abrir PR para `staging`.

Toda alteração de workflow deve atualizar [Fluxo canônico de
release](release-flow.md) e rodar `bun run docs:check`.
