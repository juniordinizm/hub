---
status: canonical
owner: engineering
last_verified_commit: 6caecf9c2d73bf6021a238e73c3ccb43e1682ca9
---

# Identidade e autorização

## Escopo

Define Conta, sessão, perfil, papéis, permissões e bloqueios. Termos comerciais como Compradora e Concessão ficam em [Comércio e acesso](commerce-and-access.md).

## Modelo e estados

- `users`: identidade Better Auth, papel e bloqueio de plataforma.
- `accounts`: credenciais/provedores da identidade.
- `sessions`: sessões revogáveis.
- `verifications`: tokens de verificação e recuperação.
- `profiles`: dados complementares da Aluna.
- papéis: `admin`, `support`, `student`.

Não existe Better Auth Admin Plugin nem Organization Plugin. Não existe organização, tenant, convite ou equipe de cliente no domínio atual.

### REG-IDA-001 E-mail identifica a Conta sem distinção de caixa

**Invariante:** duas Contas não podem representar o mesmo e-mail por diferença apenas de maiúsculas/minúsculas.

**Implementado:** migration `0027_case_insensitive_user_email.sql`; normalização de Compradora em `normalizeBuyerEmail`, de `src/features/payments/buyer-identity.ts`.

**Falha:** conflitos de legado precisam ser resolvidos antes de aplicar a restrição. A migration não está no journal atual; a garantia do banco implantado não foi verificada.

### REG-IDA-002 Cadastro público é fechado por padrão

`AUTH_PUBLIC_SIGNUP_ENABLED` tem default `false`. `isBlockedAuthEndpoint`, em `src/lib/auth-policy.ts`, bloqueia `POST sign-up/email`. Contas entram por fluxo financeiro ou bootstrap operacional.

**Autorização:** o endpoint de bootstrap Admin só existe fora de produção, exige `INTERNAL_BOOTSTRAP_SECRET` e retorna 404 em produção por `getBootstrapAdminDecision`.

**Falhas:** sem Resend, recuperação de senha e e-mails de acesso falham; isso não reabre cadastro.
O formulário público de recuperação sempre mostra a mesma mensagem para Conta existente, inexistente
ou falha de entrega, evitando enumeração visível no navegador.

### REG-IDA-003 Autorização é por capacidade

`canPerform`, em `src/lib/auth-policy.ts`, é a fonte do RBAC:

- `admin`: todas as capacidades;
- `support`: `executeRefund`, `manageCertificates`, `manageEnrollmentAccess`, `managePrivacyRequests`, `viewAdminPanel`, `viewFinancials`;
- `student`: nenhuma capacidade administrativa.

Server Actions e páginas devem checar a capacidade apropriada; esconder botão não é autorização. O papel Suporte implementado aguarda ratificação de produto.

### REG-IDA-004 Bloqueio de plataforma prevalece sobre Matrículas

`blockStudentPlatformAccessAction` e `restoreStudentPlatformAccessAction`, em `src/features/admin/actions.ts`, alteram o bloqueio amplo da Conta. Uma Matrícula ativa não contorna esse bloqueio.

**Invariantes:**

- bloquear não apaga Conta, Pedido, progresso ou Certificado;
- bloqueio por curso é outra operação;
- restaurar a plataforma não recria Concessões.

## Autenticação

`getAuth`, em `src/lib/auth.ts`, configura Better Auth com:

- adaptador Drizzle para `users`, `accounts`, `sessions`, `verifications`;
- e-mail/senha, mínimo de oito caracteres;
- token de redefinição por uma hora;
- revogação das sessões após redefinição;
- origens confiáveis resolvidas por `parseTrustedOrigins`;
- `nextCookies()` como último plugin;
- Dash/Sentinel opcionais quando `BETTER_AUTH_API_KEY` existe.

O uso desses componentes foi conferido com a documentação oficial Better Auth v1.6, mas a configuração do painel Infra não foi verificada.

A página `/entrar` aguarda uma requisição antes de resolver a sessão: uma Conta já autenticada é redirecionada para sua área, e essa leitura nunca ocorre durante o build.

## Fronteira Admin/Aluna

`getStudentPreviewMode`, `canAccessStudentRoute` e `canMutateStudentExperience`, em `src/features/courses/preview.ts`, permitem visualização controlada da experiência da Aluna. Preview de Admin não deve gravar progresso nem simular autorização real.

## Concorrência e segurança

- sessão deve ser resolvida no servidor a cada operação sensível;
- permissão não deve ser recebida do cliente;
- e-mail, ID de usuário e papel não devem ser aceitos como prova de identidade sem sessão;
- redefinição revoga sessões existentes;
- credenciais e secrets nunca entram em logs ou documentação versionada.

## Evidências

- schema: `roleEnum`, `users`, `sessions`, `accounts`, `verifications`, `profiles` em `src/db/schema.ts`;
- implementação: `getAuth`, `canPerform`, `isBlockedAuthEndpoint`, `getBootstrapAdminDecision`;
- testes: `src/lib/auth-policy.test.ts`, `src/lib/trusted-origins.test.ts`, `src/lib/allowed-dev-origins.test.ts`;
- rotas: `src/app/api/auth/[...all]/route.ts`, `src/app/api/auth/dev/bootstrap-admin/route.ts`.

## Decisões e pendências

- [ADR-0001](../adr/0001-custom-rbac.md): RBAC próprio, aceito.
- [DEC-DISC-007](../decisions.md#dec-disc-007): identidade/verificação, pendente.
- Ratificar a matriz de Suporte.
- Definir política formal de vinculação Compradora => Conta.
- Racional histórico para Better Auth e autenticação por e-mail/senha não localizado.
