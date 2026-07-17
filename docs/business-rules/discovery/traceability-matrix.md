> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Matriz de rastreabilidade

| Regra | UI | Servidor | Autorização | Banco | Integração | Testes | Evidências | Confiança |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AUTH-DISC-001` | login/admin | rota Better Auth; sessão | role em profile | users, profiles, sessions | Better Auth | `auth-policy.test.ts` | `api/auth/[...all]/route.ts:12-29`; `auth-policy.ts:3-73`; `session.ts:23-75` | alta |
| `SESSION-DISC-001` | layouts protegidos | `requireSession` | bloqueio de estudante no servidor | sessions, profiles | Better Auth | contrato/política | `auth.ts:35-69`; `session.ts:23-75` | alta |
| `RBAC-DISC-001` | navegação admin | actions admin | capabilities por role | profiles, audit_logs | — | `auth-policy.test.ts` | `auth-policy.ts:3-30`; `admin/actions.ts:614-652` | alta |
| `ENROLL-DISC-001` | páginas da aluna | entitlement e aula | sessão + ownership | enrollments, grants | — | contrato de acesso | `enrollments/server.ts:168-322,990-1044`; `courses/server.ts:857-969` | alta |
| `ORDER-DISC-001` | checkout | projeção de pagamento | webhook autenticado | orders, grants | AbacatePay | mapping/SQL | `payments/server.ts:327-377,435-448`; `abacatepay.ts:420-432` | média |
| `WEBHOOK-DISC-001` | não aplicável: entrada HTTP de provedor | handler e transação | segredo + HMAC | webhook_events, orders, grants | AbacatePay | unitários/contratos | `webhooks/abacatepay/route.ts:10-49`; `payments/server.ts:274-472,595-745`; `schema.ts:610-667` | alta |
| `LESSON-DISC-001` | player/aluna | Server Action de vídeo | sessão; autorização editorial ausente | lessons, courses | JMVStream | não localizado para abuso | `app/(student)/app/actions.ts:42-64`; `courses/server.ts:1350-1395` | alta |
| `PROGRESS-DISC-001` | player, sidebar | regras de conclusão | matrícula da aluna | lesson_progress, lesson_watch_progress | JMVStream | `progress/rules` | `progress/rules.ts:23-85`; `courses/server.ts:1213-1347` | alta |
| `VIDEO-DISC-001` | player/upload | geração de URL/validação | acesso à aula | video_assets, lesson_materials | JMVStream, R2 | upload/storage | `jmvstream.ts:27-68`; `lesson-video-player.tsx:204-233`; `r2.ts:172-189` | alta |
| `CONTENT-DISC-001` | builder admin | ações de publicação | admin | courses, modules, lessons | — | contratos/source tests | `admin/actions.ts:651-907,1413-1499`; `courses/server.ts:636-649,1127-1144` | alta |
| `CERT-DISC-001` | certificado/PDF/página pública | emissão e consulta | owner para lista; público por código | certificates | PDF, QR | regras de certificado | `certificates/rules.ts:4-18`; `courses/server.ts:1105-1198`; `certificates/server.ts:16-131` | alta |
| `AUDIT-DISC-001` | feed administrativo | ações admin | admin/support conforme ação | audit_logs, enrollment_events | — | não cobre catálogo completo | `admin/actions.ts:363-401`; `admin/server.ts:389-467`; `schema.ts:472-505,710-724` | alta |
| `SUPPORT-DISC-001` | diálogo de suporte | action da aluna | sessão | não há ticket | e-mail | nenhum fluxo E2E | `support-request-dialog.tsx:83-110`; `features/email/server.ts:18-132` | média |
| `COMM-DISC-001` | fluxos de reset/aviso | adaptador de e-mail | servidor | sem outbox | e-mail não configurado | fonte/unitário | `features/email/server.ts:18-132` | alta |
| `PRIVACY-DISC-001` | suporte/certificado público | páginas e actions | acesso por código público | PII em domínio e logs | Resend/R2 quando configurados | não localizado | `schema.ts:109-730`; `certificates/server.ts:16-52`; `support-request-dialog.tsx:83-110` | média |

## Cobertura de verificação localizada

| Área | Evidência forte | Evidência fraca ou ausente |
| --- | --- | --- |
| Auth/RBAC | regras puras, layouts/actions e schema | sessão/HTTP e infraestrutura real |
| Pagamento | HMAC, mapeamento, índices e testes unitários | concorrência, ordem e webhook real |
| Entitlement | SQL de servidor e contrato de acesso | E2E de URL direta e múltiplas grants |
| Conteúdo | actions, schema e testes de contrato | migração/versionamento de conteúdo já vendido |
| Progresso | funções puras e índices | múltiplas abas/dispositivos e manipulação do player |
| Certificado | regra e unicidade no banco | PDF/validação pública, reembolso e concorrência |
| E-mail/suporte | código fonte | entrega, retry, retenção e privacidade |
| Acessibilidade | semântica e labels pontuais | teclado, leitor de tela, legenda, PDF e WCAG |

`Evidências` aponta a fonte rastreável; a coluna `Testes` não afirma cobertura de integração quando só há teste de unidade ou de contrato. A matriz não substitui as fichas de descoberta em `rule-inventory.md`.
