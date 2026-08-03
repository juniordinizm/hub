---
status: canonical
owner: engineering
last_verified_commit: 4eab1a331f2d6989e5958aa0d6b55a66438f1396
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
- `src/app/certificados/[code]`: validação pública por código/QR, sem acesso ao PDF.

Layouts e páginas obtêm dados no servidor. Componentes com interação local usam `"use client"` apenas na folha da árvore. Mutação parte de Server Actions ou Route Handlers; regras não devem morar em JSX.
Layouts autenticados são `force-dynamic`: sessão e dados protegidos são resolvidos por requisição, nunca durante o build.

O runtime é classificado separadamente de `VERCEL_ENV`: o Custom Environment
Staging usa `VERCEL_TARGET_ENV=staging`. Em manutenção integral, o Proxy é a
fronteira fail-closed para tráfego público e mutações, preservando apenas
health, readiness e crons autenticados. A topologia completa está no
[runbook de ambientes](operations/environment-and-local-development.md).

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
- Certificados => `src/features/certificates`, tabelas `certificate_issuer_profiles`, `certificate_templates`, `certificates` e `public_certificate_rate_limits`.
- Dados técnicos de analytics => `src/features/learning-analytics`, tabelas `learning_analytics_events` e `learning_analytics_daily_metrics`.
- Mídia => `src/features/jmvstream`, `src/features/storage`, tabelas `jmvstream_folders`, `jmvstream_video_assets` e JSON de conteúdo.
- Operação => `src/features/admin/server.ts`, `audit_logs`, `app_settings`, `faq_items`, `dashboard_banners`.

## Banco

`getPool` cria um `pg.Pool`; `getDb` expõe Drizzle sobre o mesmo pool. `withVerifiedSslMode`, em `src/db/connection-url.ts`, normaliza conexões para `sslmode=verify-full` quando necessário.

No runtime, `DATABASE_URL` deve ser pooled em ambientes serverless. Migrations e tarefas administrativas devem usar `DATABASE_URL_DIRECT`. A distinção segue a documentação oficial do [Neon sobre pooling](https://neon.com/docs/connect/connection-pooling), mas os endpoints reais do projeto não foram verificados no painel.

O schema possui 41 tabelas exportadas em `src/db/schema.ts`. SQL e journal
possuem 55 entradas alinhadas, com topo local `0054_payments_hardening`;
`db:migrations:check` valida a cadeia local, enquanto
`db:migrations:inspect` comprova separadamente o catálogo do banco alvo. A
migration `0049` garante uma Revisão por Webhook; as migrations Asaas `0044` a
`0053` estão aplicadas em Production e Staging, enquanto `0054` permanece somente no
repositório até promoção controlada. Na Vercel, cada instância limita o pool
de aplicação a três conexões; readiness mantém uma conexão isolada. Veja
[Banco e migrations](operations/database-and-migrations.md).

## Fluxos ponta a ponta

### Autenticação

1. `/api/auth/[...all]` delega ao Better Auth criado por `getAuth`.
2. `isBlockedAuthEndpoint` bloqueia cadastro público quando a flag está desligada.
3. Better Auth persiste identidade nas próprias tabelas via Drizzle.
4. Helpers de sessão resolvem perfil e papel.
5. `canPerform` autoriza capacidades administrativas.

### Checkout e acesso

1. Route Handler/Action chama `createPublicCourseCheckout` ou `createCourseCheckout`.
2. O núcleo Asaas persiste o Pedido e seus snapshots antes da chamada externa.
3. `/api/webhooks/asaas` autentica, limita, valida e persiste a inbox antes de `200`.
4. O worker reivindica o evento e abre uma transação com posse exclusiva.
5. `processAsaasWebhookEvent` correlaciona somente identificadores exatos, bloqueia o
   Pedido e aplica a matriz financeira sobre o snapshot bloqueado. A conciliação adapta
   a consulta oficial do pagamento para a mesma matriz, sem manter política paralela.
6. `apply-authoritative-financial-evidence.ts` converge pagamento, identidade, Concessão
   e outbox; webhook e conciliação chamam esse mesmo módulo profundo. A transação
   persiste evidência, Revisão idempotente ou Concessão/revogação e recompõe Matrícula.
7. Conflitos ambíguos não escolhem Pedido e geram alerta durável sem payload ou PII.

O processor financeiro e sua rota cron estão implementados. A agenda chama o worker
Asaas a cada minuto sob autenticação compartilhada, kill switch, lease e deadline. Isso
não comprova deploy de Production. A migration `0044` remove a persistência específica
do provedor anterior; o runtime opera somente com o contrato Asaas.

### Aprendizagem

1. `getStudentCourseAccessStatus` e `resolveCourseAccess` negam acesso sem Conta/Matrícula válidas.
2. `getStudentCourseOverview` devolve Módulos/Aulas publicáveis.
3. `isLessonAvailable` aplica sequência.
4. `recordLessonWatchProgress` registra posição; evento JMVStream pode concluir em 98%.
5. `completeLesson` permite conclusão manual.
6. `calculateCourseProgress` calcula percentual e próxima Aula.

### Publicação de mídia

- JMVStream: app inicia multipart, navegador envia partes diretamente às URLs assinadas, app confirma e sincroniza player.
- R2 privado: app assina upload/download por objeto; navegador transfere sem proxy de payload.
- R2 público: `publishR2Object` copia do bucket privado para o público; URL pública vem de `R2_PUBLIC_BASE_URL`.

### Certificado, analytics e manutenção

- cada Curso pode publicar uma versão imutável de template A4, vinculada ao perfil emissor global; novas emissões congelam template, dados da Aluna, Curso e emissão em `render_snapshot`;
- a conclusão elegível ou emissão manual cria o Certificado `pending` e uma mensagem `certificate.render`; o worker obtém claim persistido, gera o PDF uma vez, grava o artefato privado no R2 e só então enfileira o e-mail;
- `issueManualCertificate`, `revokeCertificate` e `reissueCertificate` controlam lifecycle; reemissão cria nova evidência e preserva a anterior revogada;
- download exige sessão e propriedade do Certificado ou permissão administrativa. Páginas públicas chamam `consumePublicCertificateLookup` antes de consultar por código e nunca expõem PDF ou CPF.
- não existe workflow de solicitações ou anonimização de dados. `runMaintenance` executa
  limpeza técnica limitada: sessões e rate limits expirados, reservas Asaas
  inequivocamente pré-provider abandonadas, sanitização do payload bruto da inbox Asaas
  após 30 dias, agregação diária de analytics e retenção de analytics brutos por 90 dias
  e agregados por 13 meses.

## Observabilidade

`src/proxy.ts` propaga `x-correlation-id` para request e response. `logOperationalEvent`, em `src/lib/observability.ts`, emite eventos JSON sem atributos sensíveis. `instrumentation.ts` registra exceções de request e as encaminha ao Sentry quando `SENTRY_DSN` existe; `error.tsx` e `global-error.tsx` fazem o equivalente para fallbacks de interface com um identificador de suporte.

`GET /api/health` é liveness. `GET /api/health/ready` faz readiness protegida contra Postgres, com timeout curto e verificação do journal; ele não consulta providers externos. `getOperationalBacklogSnapshot`, em `src/features/operations/server.ts`, alimenta **Admin > Auditoria** com contagens/idade de outbox, webhook e vídeo, sem PII. SLI/SLO, dona e ensaio de recuperação estão em [Observabilidade e recuperação](operations/observability-and-recovery.md).

## Concorrência, idempotência e auditoria

- webhooks usam chave externa e registro persistido para deduplicação; a inbox Asaas
  separa recebimento do processor transacional agendado;
- alterações críticas usam transações e locks explícitos onde implementado;
- Pedidos e Concessões preservam IDs de origem;
- `payment_reviews.webhook_event_id` é único quando preenchido, e conflitos de correlação
  sem Pedido seguro ficam em `audit_logs` com motivo sem PII;
- eventos de Matrícula e `audit_logs` registram ações administrativas e operacionais;
- `outbox_messages` registra efeitos de e-mail críticos com chave idempotente, lease e
  dead letter; `auth.account-activation` persiste apenas IDs locais e cria token no
  callback Better Auth. Recuperação pública e ativação legada continuam fora da outbox;
- `scheduled_job_leases` impede sobreposição de uma mesma rotina entre
  instâncias serverless sem depender de sessão Postgres;
- `certificate_template_asset_cleanup` registra limpeza atrasada e recuperável
  das artes substituídas;
- upload JMVStream mantém sessão/estado persistido para retry e limpeza.

## Rotinas

`vercel.json` agenda:

- `/api/cron/asaas-webhooks` a cada minuto;
- `/api/cron/enrollments` diariamente às 10:00 UTC;
- `/api/cron/jmvstream` a cada cinco minutos;
- `/api/cron/outbox` a cada cinco minutos;
- `/api/cron/maintenance` diariamente às 04:00 UTC.

Todos dependem de `CRON_SECRET` e do kill switch
`SCHEDULED_JOBS_ENABLED`. Cada execução usa lease persistente e prazo interno
menor que o limite da função. Agendamento e segredo em produção ainda não foram
verificados externamente.

## Limitações arquiteturais conhecidas

- catálogo remoto pode divergir da cadeia local quando a promoção controlada não for executada ou auditada;
- ausência de coortes: publicar conteúdo altera a experiência de todas as Matrículas elegíveis;
- reversão de ajuste de expiração pode sobrescrever ajustes posteriores;
- recuperação pública e ativação legada permanecem fora da outbox;
- decisões implementadas sem ratificação de produto;
- infraestrutura e dados de produção não verificados;
- JMVStream `gallery` no complete diverge da documentação histórica do projeto;
- R2 é lido por `process.env` dinâmico, fora do schema central de `getServerEnv`.

## Como investigar uma mudança

Comece no guia de domínio, siga a evidência para o símbolo da feature e então leia Route Handler/Action e testes adjacentes. Para alteração de estado, verifique também `src/db/schema.ts`, SQL em `src/db/migrations` e o [registro de decisões](decisions.md).

## Mapa de aprofundamento de módulos

O plano 008 trata tamanho como sinal, não como motivo suficiente para mover código. O mapa atual identifica responsabilidades independentes antes de qualquer extração:

- `courses/server.ts`: catálogo, acesso da aluna, leitura de aula, progresso e coordenação de conclusão. A conclusão preserva sua transação e delega a elegibilidade, emissão e enfileiramento ao símbolo `issueCompletionCertificateIfEligible` de `certificates/server.ts`.
- `admin/server.ts`: read models por superfície: catálogo/autoria, alunas/acesso, financeiro, auditoria e configurações. Cada extração deve manter a projeção e a autorização server-side.
- `enrollments/access.ts` responde acesso de Curso/Aula por Matrícula ativa e conteúdo publicado; `enrollments/server.ts` mantém concessões, projeção de matrícula e ajustes de expiração, que compartilham transações e não devem ser separados arbitrariamente.
- `payments/provider.ts` cria o adapter Asaas; `checkout.ts` concentra a intenção
  compartilhada, `asaas-financial-events.ts` decide eventos e consultas,
  `apply-authoritative-financial-evidence.ts` aplica o efeito local e
  `public-checkout.ts` autoriza a entrada pública. Provider e transição financeira não
  devem ser misturados em uma API genérica.
- `jmvstream/server.ts` é a façade de leitura operacional e dos casos de uso ainda consumidos; `auth.ts` resolve token, `client.ts` é o contrato HTTP e `upload.ts` executa multipart no navegador. `asset-persistence.ts`, `course-folders.ts`, `upload-session.ts`, `upload-completion.ts`, `player-sync.ts`, `asset-deletion.ts` e `manual-video-sync.ts` separam persistência e lifecycle. `provider-mapper.ts` traduz o estado remoto em operação de galeria. O upload multipart direto é invariante.
- resources de aula: autoria e player tinham regras duplicadas de extensão, tipo e tamanho. `src/features/courses/resource-presentation.ts` concentra apenas essa apresentação pura, sem importar React ou providers.
- actions administrativas de matrícula e certificados: seus `*-command-input.ts` traduzem e validam o `FormData` de cada comando. As actions continuam responsáveis por autenticar; serviços continuam responsáveis por autorização de domínio, transação e efeitos.

### Orçamento atual de leitura administrativa

`getAdminStudentsData` usa duas queries em paralelo: matrículas e perfis de Aluna. O teste `admin/server-read-projections.test.ts` mede 250 Alunas com três matrículas cada: 750 linhas de matrícula, 250 perfis, duas queries e payload serializado inferior a 512 KiB. Não há paginação enquanto essa projeção permanecer dentro do orçamento; ao excedê-lo com volume representativo, a paginação deve preservar busca e detalhes por Aluna, não truncar silenciosamente a tabela.

### Interfaces, consumidores e efeitos

#### Cursos e conclusão

- **Símbolos:** `getStudentCourses`, `getStudentCourseCatalog`, `getStudentCourseAccessStatus`, `getStudentCourseOverview`, `getStudentLessonWorkspace`, `recordLessonWatchProgress`, `completeLesson` e `recalculateCourseWorkloadHours`; `issueCompletionCertificateIfEligible` para a conclusão.
- **Consumidores:** páginas/actions de `/app`, handlers de recurso de aula, autoria administrativa e testes de SQL/concorrência.
- **Invariante, queries e efeitos:** acesso exige Matrícula elegível e conteúdo publicado. `completeLesson` preserva a transação de progresso e delega apenas o resumo persistido ao serviço de certificado, que emite idempotentemente e persiste a mensagem da outbox, sem enviar e-mail direto.

#### Administração

- **Símbolos:** `getAdmin*Data`, `getAdminOverview`, `getAdminStudentDetail` e editores de curso/aula; actions nomeadas por comando.
- **Consumidores:** páginas e componentes Admin. `authoring.ts` é chamado por actions, nunca por JSX.
- **Invariante, queries e efeitos:** `requireRole` autentica a entrada. Os parsers por comando validam `FormData` antes de SQL/provider. `admin/server.ts` só projeta dados de catálogo, Alunas/acesso, financeiro, auditoria e configurações; a action chama o caso de uso e revalida as rotas afetadas.

#### Acesso e comércio

- **Símbolos:** `resolveCourseAccess` e `resolveLessonAccess`; concessões, projeção e ajustes de expiração; checkout autenticado/público, webhook, revisão e retry de pagamento.
- **Consumidores:** cursos, actions administrativas, handlers de checkout e webhook
  Asaas.
- **Invariante, transação e efeitos:** Concessão é fonte e Matrícula é projeção. A inbox
  deduplicada só aplica transição financeira válida; conflitos entram em revisão. O
  adapter Asaas concentra HTTP/configuração, e o rate limit pertence exclusivamente ao
  checkout público.

#### JMVStream e resources

- **Símbolos:** cliente HTTP, autenticação, upload multipart do navegador, mapper de provider e casos de uso de sessão, conclusão, sincronização, exclusão e pastas. `getResourceExtension`, `getResourceTypeLabel` e `formatResourceFileSize` são a interface pura de resources.
- **Consumidores:** painel de upload, actions de autoria, cron JMVStream, player e página de aula; a apresentação de resource é compartilhada por autoria e player.
- **Invariante, persistência e efeitos:** o navegador envia partes diretamente ao provider, sem proxy/TUS. A sessão persistida fica vinculada à Aula e ao `video_hash`; a Aula recebe o vídeo novo antes de excluir o anterior. Falha de exclusão remota fica disponível para retry sem bloquear o unlink local. A apresentação compartilhada não importa React, banco ou provider.
