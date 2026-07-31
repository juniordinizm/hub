---
status: canonical
owner: engineering
last_verified_commit: 384db5ad9bca03ff5723f6c7e2602c80d9e0755c
---

# PROTEA-R Hub

Plataforma de cursos da PROTEA-R: catálogo e aprendizagem para Alunas, autoria e operação para Admin/Suporte, comércio Asaas em preparação para o corte de produção, vídeo via JMVStream, mídia via Cloudflare R2, e-mail via Resend e Postgres/Neon.

## Antes de começar

Pré-requisitos:

- Bun `1.3.11`, versão fixada em `package.json`;
- acesso a um banco Postgres já compatível com o schema atual;
- credenciais das integrações necessárias à funcionalidade que será testada.

O histórico local de migrations está reconciliado até
`0051_asaas_financial_statement`, incluindo outbox transacional,
publicações de Curso, artefatos imutáveis de Certificado, perfil automático
para cadastro público, leases dos jobs serverless e consumo único de uploads
administrativos. As migrations Asaas `0044` a `0051` foram validadas apenas em
PostgreSQL descartável; Production permanece auditada em `0043` e não recebeu o
corte. Para um banco local
descartável,
use os comandos de reset, seed e smoke somente conforme o
[runbook de banco](docs/operations/database-and-migrations.md): eles recusam
host remoto e exigem confirmação quando destrutivos.

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

Para publicar qualquer mudança, siga o
[tutorial de alteração até Production](docs/operations/production-release-guide.md).
O [status Vercel-first](docs/operations/vercel-migration-status.md) é registro
histórico da migração concluída, não o procedimento diário.
