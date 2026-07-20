---
status: canonical
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Arquitetura

## Visão geral

O Hub é uma aplicação Next.js 16 App Router com React 19. A aplicação, APIs e jobs HTTP vivem no mesmo deploy. O Postgres persiste identidade, conteúdo, comércio, acesso e operação. Serviços externos são acessados por módulos server-only.

O racional histórico para a escolha de Next.js, React, Postgres/Neon e Vercel não foi localizado. Esta página documenta o desenho existente.

## Fronteiras

### Rotas

- `src/app/(auth)`: entrada e recuperação de senha.
- `src/app/(student)`: área autenticada da Aluna.
- `src/app/(admin)`: painel de Admin/Suporte.
- `src/app/api`: Better Auth, checkout, webhooks, mídia, crons e health check.
- `src/app/certificados/[code]`: validação pública e PDF.

Layouts e páginas obtêm dados no servidor. Componentes com interação local usam `"use client"` apenas na folha da árvore. Mutação parte de Server Actions ou Route Handlers; regras não devem morar em JSX.

### Camadas

- **Apresentação:** `src/app`, `src/components` e funções de apresentação em cada feature.
- **Aplicação/domínio:** `src/features/<capacidade>`. Orquestra autorização, transação, regra e integração.
- **Transversal:** `src/lib` para autenticação, sessão, autorização e ambiente.
- **Persistência:** `src/db/index.ts` (`getPool`, `getDb`), `src/db/schema.ts` e SQL explícito nas features.
- **Externo:** clientes em `src/features/payments`, `src/features/jmvstream`, `src/features/storage` e `src/features/email`.

Importações usam alias `@/`. Não há camada de repositórios genérica; Drizzle e `pg` são utilizados onde sua interface é mais adequada.

## Mapa domínio => código

- Identidade e sessão => `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/auth-policy.ts`, tabelas `users`, `accounts`, `sessions`, `verifications`, `profiles`.
- Conteúdo => `src/features/admin/authoring.ts`, `src/features/courses/server.ts`, tabelas `courses`, `modules`, `lessons`.
- Progresso e interação => `src/features/progress/rules.ts`, `src/features/comments`, tabelas `lesson_progress`, `lesson_watch_progress`, `lesson_comments`.
- Comércio => `src/features/payments`, tabelas `orders`, `webhook_events`, `payment_reviews`, `refund_requests`.
- Acesso => `src/features/enrollments`, tabelas `enrollment_grants`, `enrollments`, `enrollment_expiration_adjustments`, `enrollment_events`.
- Certificados => `src/features/certificates`, tabelas `certificates`, `public_certificate_rate_limits`.
- Dados pessoais => `src/features/privacy`, tabela `privacy_requests`.
- Mídia => `src/features/jmvstream`, `src/features/storage`, tabelas `jmvstream_folders`, `jmvstream_video_assets` e JSON de conteúdo.
- Operação => `src/features/admin/server.ts`, `audit_logs`, `app_settings`, `faq_items`, `dashboard_banners`.

## Banco

`getPool` cria um `pg.Pool`; `getDb` expõe Drizzle sobre o mesmo pool. `withVerifiedSslMode`, em `src/db/connection-url.ts`, normaliza conexões para `sslmode=verify-full` quando necessário.

No runtime, `DATABASE_URL` deve ser pooled em ambientes serverless. Migrations e tarefas administrativas devem usar `DATABASE_URL_DIRECT`. A distinção segue a documentação oficial do [Neon sobre pooling](https://neon.com/docs/connect/connection-pooling), mas os endpoints reais do projeto não foram verificados no painel.

O schema possui 28 tabelas exportadas em `src/db/schema.ts`. O journal de migrations está incompleto; portanto, schema TypeScript, SQL em disco e banco aplicado podem divergir. Veja [Banco e migrations](operations/database-and-migrations.md).

## Fluxos ponta a ponta

### Autenticação

1. `/api/auth/[...all]` delega ao Better Auth criado por `getAuth`.
2. `isBlockedAuthEndpoint` bloqueia cadastro público quando a flag está desligada.
3. Better Auth persiste identidade nas próprias tabelas via Drizzle.
4. Helpers de sessão resolvem perfil e papel.
5. `canPerform` autoriza capacidades administrativas.

### Checkout e acesso

1. Route Handler/Action chama `createPublicCourseCheckout` ou `createCourseCheckout`.
2. `AbacatePayClient` cria produto e checkout; o Pedido guarda snapshots.
3. `/api/webhooks/abacatepay` verifica segredo/assinatura e chama `processAbacatePayWebhook`.
4. O evento é deduplicado em `webhook_events`.
5. Transição válida atualiza Pedido e chama `applyPaidWebhookAccess` ou `applyPaymentRevocation`.
6. Concessões são recalculadas por `rebuildEnrollmentProjection`.
7. Conflitos geram `payment_reviews`; falhas operacionais ficam disponíveis para retry autorizado.

### Aprendizagem

1. `getStudentCourseAccessStatus` e `resolveCourseAccess` negam acesso sem Conta/Matrícula válidas.
2. `getStudentCourseOverview` devolve Módulos/Aulas publicáveis.
3. `isLessonAvailable` aplica sequência.
4. `recordLessonWatchProgress` registra posição; evento JMVStream pode concluir em 95%.
5. `completeLesson` permite conclusão manual.
6. `calculateCourseProgress` calcula percentual e próxima Aula.

### Publicação de mídia

- JMVStream: app inicia multipart, navegador envia partes diretamente às URLs assinadas, app confirma e sincroniza player.
- R2 privado: app assina upload/download por objeto; navegador transfere sem proxy de payload.
- R2 público: `publishR2Object` copia do bucket privado para o público; URL pública vem de `R2_PUBLIC_BASE_URL`.

### Certificado e dados

- `issueManualCertificate`, `revokeCertificate` e `reissueCertificate` controlam lifecycle.
- páginas públicas chamam `consumePublicCertificateLookup` antes de consultar por código.
- solicitações de privacidade passam por registro, aprovação e execução; retenção automática só executa com flag e referência jurídica.

## Concorrência, idempotência e auditoria

- webhooks usam chave externa e registro persistido para deduplicação;
- alterações críticas usam transações e locks explícitos onde implementado;
- Pedidos e Concessões preservam IDs de origem;
- eventos de Matrícula e `audit_logs` registram ações administrativas;
- não existe outbox transacional. Uma transação de banco pode concluir e o e-mail falhar, exigindo reconciliação manual;
- upload JMVStream mantém sessão/estado persistido para retry e limpeza.

## Rotinas

`vercel.json` agenda:

- `/api/cron/enrollments` diariamente às 10:00 UTC;
- `/api/cron/jmvstream` a cada cinco minutos;
- `/api/cron/retention` diariamente às 04:00 UTC.

Todos dependem de `CRON_SECRET`. Agendamento e segredo em produção não foram verificados externamente.

## Limitações arquiteturais conhecidas

- migrations fora do journal podem não ser aplicadas;
- ausência de coortes: publicar conteúdo altera a experiência de todas as Matrículas elegíveis;
- reversão de ajuste de expiração pode sobrescrever ajustes posteriores;
- ausência de outbox para banco + e-mail/provedor;
- decisões implementadas sem ratificação de produto;
- infraestrutura e dados de produção não verificados;
- JMVStream `gallery` no complete diverge da documentação histórica do projeto;
- R2 é lido por `process.env` dinâmico, fora do schema central de `getServerEnv`.

## Como investigar uma mudança

Comece no guia de domínio, siga a evidência para o símbolo da feature e então leia Route Handler/Action e testes adjacentes. Para alteração de estado, verifique também `src/db/schema.ts`, SQL em `src/db/migrations` e o [registro de decisões](decisions.md).
