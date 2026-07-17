> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Atores e permissões preliminares

| Ator | Capacidades observadas | Negado/limite observado | Evidência |
| --- | --- | --- | --- |
| Anônimo | login, reset, checkout público, validação de certificado | área `/app` e admin | `auth/[...all]/route.ts`, páginas públicas |
| Compradora sem conta | checkout; webhook pode criar conta student | acesso antes de webhook pago | `payments/public-checkout.ts`, `payments/server.ts:118-190` |
| Student | cursos/aulas liberados, progresso, suporte | admin, conteúdo e financeiro | `session.ts`, `courses/server.ts:857-925` |
| Support | painel, acesso/matrícula, moderação e preview | conteúdo, configuração e financeiro no servidor | `auth-policy.ts:10-20`, `admin/actions.ts` |
| Admin | todas as permissões locais | não verificado contra banco/RLS | mesma matriz |
| AbacatePay | chama webhook autenticado | efeitos somente após assinatura/segredo | `api/webhooks/abacatepay/route.ts` |
| Jobs | expiração/avisos e sync de vídeo | cron requer segredo em produção | `api/cron/*/route.ts` |

Matriz observada: admin: `viewAdminPanel`, `manageEnrollmentAccess`, `manageContent`, `manageSettings`, `viewFinancials`; support: somente as duas primeiras; student: nenhuma capacidade admin. O papel é buscado em `profiles`, não derivado do cookie (`src/lib/session.ts:23-51`). Layouts são gates de navegação; actions e handlers relevantes reaplicam autorização.

Lacunas: menu expõe links a support que serão negados depois, produzindo UX enganosa; faltam testes HTTP/de integração para sessão, perfil ausente, bloqueio de plataforma e handlers.

## Restrições e exceções observadas

- Student bloqueada em nível de plataforma é impedida por `requireSession`; o bloqueio não se aplica a `admin`/`support` (`src/lib/session.ts:54-75`).
- Staff pode abrir preview explícito de experiência de aluno, mas não pode registrar progresso como preview (`src/features/courses/preview.ts:32-53`; `src/app/(student)/app/actions.ts:17-22`).
- Support pode ajustar acesso, expiração e bloqueio, mas actions de conteúdo/configuração/financeiro exigem admin. A UI não espelha sempre essa separação.
- Compradora é ligada por `metadata.userId` quando autenticada; sem esse vínculo, o webhook normaliza e procura o e-mail do comprador. Um e-mail inexistente cria user/profile `student`.
- O usuário anônimo que conhece o código de certificado pode ver nome, curso, carga e emissão. Não há permissão adicional observada.

## Matriz preliminar de ações

| Ação | Anônimo | Student | Support | Admin | Evidência |
| --- | --- | --- | --- | --- | --- |
| Criar checkout | sim | sim | — | — | `payments/public-checkout.ts` |
| Ler aula liberada | não | sim | preview | preview | `courses/server.ts:857-925` |
| Registrar progresso | não | sim | não | não em preview | `app/(student)/app/actions.ts` |
| Gerir matrícula | não | não | sim | sim | `admin/actions.ts:1052-1250` |
| Gerir conteúdo | não | não | não | sim | `admin/actions.ts:614-907` |
| Ver financeiro/configuração | não | não | não | sim | `auth-policy.ts` e páginas específicas |
| Moderar comentário | não | não | sim | sim | `features/comments/actions.ts` |
| Ver certificado por código | sim | sim | sim | sim | `certificados/[code]/page.tsx` |
