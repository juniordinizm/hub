> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Mapa do sistema observado

| Área | Camada responsável | Entrada | Persistência ou saída |
| --- | --- | --- | --- |
| Web | Next.js App Router em `src/app` | páginas, Server Actions, Route Handlers | React/HTTP |
| Identidade | `src/lib/auth.ts`, `session.ts` | Better Auth `/api/auth/[...all]` | Postgres: users, sessions, accounts, profiles |
| Conteúdo | `features/courses`, `features/admin` | admin e área da aluna | courses, modules, lessons, progresso |
| Acesso pago | `features/payments`, `features/enrollments` | checkout, webhook, cron | orders, grants, enrollments, eventos |
| Vídeo/materiais | `features/jmvstream`, `features/storage` | upload admin, player, downloads | JMVStream e R2 com URLs assinadas |
| Certificados | `features/certificates` | conclusão e rotas públicas | certificates, PDF/QR em memória |
| Operação | cron Vercel e audit logs | `/api/cron/*`, admin | expiração, sincronização e auditoria |

Stack confirmada: Next 16.2.9, React 19.2.7, TypeScript, Better Auth 1.6.20, Drizzle/PostgreSQL via `pg`, Vitest e Bun. `vercel.json` agenda `/api/cron/enrollments`; JMVStream também expõe cron no código. O repositório é único.

Entradas relevantes: login/reset, checkout público/autenticado, webhook AbacatePay, administração, área da aluna, validação pública/PDF de certificado, upload e download de recurso. Integrações aparentes: AbacatePay, JMVStream, Cloudflare R2/S3 e e-mail configurável. O e-mail atual é stub: `sendTransactionalEmail` retorna `Promise.resolve()` em `src/features/email/server.ts:18-19`.

## Metadados de banco confirmados em Neon

Em 2026-07-17, o projeto Neon `protear`, branch `production`, expõe `postgres` e `neondb`. O catálogo de `neondb.public` confirma as tabelas do domínio, `drizzle.__drizzle_migrations`, chaves estrangeiras, checks e índices de unicidade para usuários, pedidos, grants, progresso, certificados e eventos de webhook. A consulta ao catálogo também confirmou **RLS desabilitado e zero policies nas 23 tabelas `public`**. A proteção observada está, portanto, no servidor da aplicação; isso não é falha por si só, mas impede atribuir ao banco um isolamento que ele não aplica.

Não foram lidos registros, funções de negócio, segredos ou dados pessoais.

## Rotas e pontos de entrada

| Tipo | Pontos observados | Observação |
| --- | --- | --- |
| Navegação | `/entrar`, `/recuperar-senha`, `/redefinir-senha`, `/app`, `/admin` | layouts fazem o primeiro gate de navegação |
| Checkout | `POST /api/checkouts/course`, `/checkout/sucesso` | sucesso de checkout não libera acesso por si só |
| Webhook | `POST /api/webhooks/abacatepay` | assinatura HMAC e segredo; configuração real não verificada |
| Recursos | upload admin, download e preview por aula | download/preview reaplicam acesso de student |
| Operação | `/api/cron/enrollments`, `/api/cron/jmvstream`, `/api/health` | cron protegido condicionalmente por ambiente/segredo |
| Certificado | `/certificados/[code]`, PDF público | código não exige sessão |

## Propriedade técnica por domínio

- Auth/identidade: `src/lib/auth.ts`, `session.ts`, `auth-policy.ts`, `auth-permissions.ts`, rotas Better Auth.
- Administração: `src/features/admin/{actions,server}.ts` e rotas `(admin)`.
- Conteúdo/aprendizagem: `src/features/courses`, `progress`, `certificates`, rotas `(student)`.
- Pagamento/acesso: `src/features/payments`, `enrollments`, webhook e cron.
- Vídeo: `src/features/jmvstream`, `videos`, componentes player/upload e cron de reconciliação.
- Arquivos: `src/features/storage/r2*.ts` e handlers de recurso.
- Comunicação: `src/features/email/{server,templates}.tsx`; entrega externa ainda não implementada.

Não foram encontrados worker, fila, DLQ, middleware/proxy de aplicação, trigger SQL ou observabilidade externa configurável no repositório. RLS/policy SQL também não existe no catálogo Neon. Isso não prova ausência no ambiente além das fontes verificadas.
