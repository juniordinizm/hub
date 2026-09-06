---
status: canonical
owner: engineering
last_verified_commit: e121349ad0a625857037617a71259c7f4e22b1ce
---

# PROTEA-R Hub

Plataforma de cursos da PROTEA-R: catálogo e aprendizagem para Alunas, autoria e operação para Admin/Suporte, comércio Asaas em Production, vídeo via JMVStream, mídia via Cloudflare R2, e-mail via Resend e Postgres/Neon.

## Antes de começar

Pré-requisitos:

- Bun `1.3.11`, versão fixada em `package.json`;
- acesso a um banco Postgres já compatível com o schema atual;
- credenciais das integrações necessárias à funcionalidade que será testada.

O topo da cadeia local, a quantidade de migrations e a quantidade de tabelas
exportadas têm uma única autoridade: o
[runbook de banco](docs/operations/database-and-migrations.md), validado contra
o journal e o schema por `bun run docs:check`. O catálogo efetivamente
implantado em cada ambiente permanece no
[Estado de release](docs/operations/release-state.md). Para um banco local
descartável, use os comandos de reset, seed e smoke somente conforme o runbook:
eles recusam host remoto e exigem confirmação quando destrutivos.

O estado de deployment, verificação e documentação é mantido separadamente em
[Estado de release](docs/operations/release-state.md). Um commit verificado localmente
não é tratado como implantado até passar o workflow e o smoke test do ambiente.

## Desenvolvimento local com banco existente

1. Instale dependências:

   ```bash
   bun install
   ```

2. Copie `.env.example` para `.env.local` e preencha somente os serviços necessários. A matriz completa está em [Ambiente local](docs/operations/environment-and-local-development.md).

3. Garanta no mínimo `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL`.

4. Inicie:

   ```bash
   bun run dev
   ```

5. Abra `http://localhost:3000`. Cadastro público fica fechado por padrão. Em ambiente não produtivo, o bootstrap de Admin exige `INTERNAL_BOOTSTRAP_SECRET`; veja `getBootstrapAdminDecision` em `src/lib/auth-policy.ts`.

## Comandos seguros

```bash
bun run dev
bun run verify:quick
bun run verify
```

`verify:quick` executa os gates rápidos durante o desenvolvimento. `verify`
executa a verificação completa exigida antes de um Pull Request. Os dois comandos
param no primeiro erro. `bun run check` é somente leitura. Para correções
automáticas deliberadas, use `bun run fix` e revise o diff.

## Mapa arquitetural

- `src/app`: rotas Next.js App Router, layouts, handlers HTTP e Server Actions.
- `src/features`: regras e serviços por capacidade (`payments`, `enrollments`, `courses`, `certificates`, `privacy`, `jmvstream`, `storage`).
- `src/lib`: autenticação, autorização, ambiente e utilidades transversais.
- `src/db`: schema, conexão e migrations.
- `scripts`: operações manuais; algumas estão bloqueadas para onboarding.
- `docs`: documentação canônica, decisões e runbooks.

O mapa completo, inclusive fluxos ponta a ponta, está em [Arquitetura](docs/architecture.md).

## Ordem de leitura para quem chegou agora

1. [Produto](PRODUCT.md)
2. [Glossário](CONTEXT.md)
3. [Índice da documentação](docs/README.md)
4. [Arquitetura](docs/architecture.md)
5. Guia de domínio da primeira tarefa
6. ADR e runbook relacionados

## Estado de verificação

Production está ativa em `https://app.neurocapacitar.com.br`, na Vercel Pro,
com Next.js nativo, Functions Node.js 24 em `gru1`, Neon pooled em São Paulo e
Cloudflare R2. Push e merge não publicam Production automaticamente: a promoção
usa um workflow manual que aplica migrations pendentes, testa um deployment sem
domínio e só então o promove.

O último checkpoint verificado de `staging` é o merge commit
`35e838c21f2ad94fefe2aec187db5068f2726c0e`; a CI completa da última mudança de organização passou os gates
obrigatórios. Production continua servindo o deployment verificado do SHA
`10c9cb8`, e o fluxo de promoção permanece separado da homologação.

Na requalificação operacional atual, Resend, Sentry e R2/restore estão
encerrados conforme as evidências registradas. DMARC permanece deliberadamente
em observação; essa observação não autoriza alterar DNS ou fazer nova promoção.

Para publicar qualquer mudança, siga o
[tutorial de alteração até Production](docs/operations/production-release-guide.md).
O [status Vercel-first](docs/operations/vercel-migration-status.md) é registro
histórico da migração concluída, não o procedimento diário.

A jornada E2E completa de conclusão, emissão, renderização, e-mail absorvido,
download privado e validação pública está implementada no repositório. A CI
remota do SHA atual de `main` foi confirmada no run `33716424503`, incluindo
integração PostgreSQL, E2E, build e Knip. Esse resultado é evidência do commit;
continua sendo a evidência obrigatória do commit candidato; um commit local
isolado não é tratado como promoção ou deploy e não substitui o fluxo de
promoção protegido.
