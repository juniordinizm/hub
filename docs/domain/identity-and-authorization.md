---
status: canonical
owner: engineering
last_verified_commit: 384db5ad9bca03ff5723f6c7e2602c80d9e0755c
---

# Identidade e autorização

## Escopo

Define Conta, sessão, perfil, papéis, permissões e bloqueios. Termos comerciais como Compradora e Concessão ficam em [Comércio e acesso](commerce-and-access.md).

## Modelo e estados

- `users`: identidade Better Auth, papel e bloqueio de plataforma.
- `accounts`: credenciais e provedores da identidade.
- `sessions`: sessões revogáveis.
- `verifications`: tokens de verificação e recuperação.
- `profiles`: dados complementares da Aluna.
- papéis: `admin`, `support`, `student`.

Não existe Better Auth Admin Plugin nem Organization Plugin. Não existe organização, tenant, convite ou equipe de cliente no domínio atual.

### REG-IDA-001 E-mail identifica a Conta sem distinção de caixa

**Invariante:** duas Contas não podem representar a mesma identidade canônica de e-mail.
Além de espaços e caixa, Gmail/Googlemail convergem domínio, removem pontos e `+tag`;
provedores reconhecidos pelo Sentinel removem `+tag`. Essa mesma regra deve ser aplicada
antes de procurar ou criar a Conta da Compradora.

**Implementado:** migration `0027_case_insensitive_user_email.sql`; normalização de Compradora compatível com o Sentinel em `normalizeBuyerEmail`, de `src/features/payments/buyer-identity.ts`.

**Falha:** conflitos de legado precisam ser resolvidos antes de aplicar a restrição. A migration não está no journal atual; a garantia do banco implantado não foi verificada.

### REG-IDA-002 Cadastro público é desabilitado por padrão

`AUTH_PUBLIC_SIGNUP_ENABLED` tem default `false`. Quando desligado, `isBlockedAuthEndpoint`, em `src/lib/auth-policy.ts`, bloqueia `POST sign-up/email`. Contas também podem entrar por fluxo financeiro ou bootstrap operacional.

**Autorização:** o endpoint de bootstrap Admin só existe fora de produção, exige `INTERNAL_BOOTSTRAP_SECRET` e retorna 404 em produção por `getBootstrapAdminDecision`.

**Falhas:** sem Resend, recuperação de senha e e-mails de acesso falham; isso não reabre cadastro. O formulário público de recuperação sempre mostra a mesma mensagem para Conta existente, inexistente ou falha de entrega, evitando enumeração visível no navegador.

### REG-IDA-002A Cadastro público cria apenas a Conta

`AUTH_PUBLIC_SIGNUP_ENABLED` continua com default `false`. Quando habilitado, `/cadastro` permite criar uma Conta com sessão imediata, mas não cria Pedido, Concessão ou Matrícula. Cursos permanecem indisponíveis até o fluxo comercial ou administrativo conceder acesso. Compra pública não depende de abrir esse cadastro: a confirmação financeira pode criar uma Conta local sem credencial e enviar ativação.

O trigger `users_create_student_profile`, da migration `0041_public_signup_student_profiles.sql`, cria o Perfil `student` junto com cada nova Conta. A migration também preenche Perfis ausentes de Contas legadas, para que as novas Contas apareçam na administração sem depender de hook assíncrono da aplicação.

### REG-IDA-003 Autorização é por capacidade

`canPerform`, em `src/lib/auth-policy.ts`, é a fonte do RBAC:

- `admin`: todas as capacidades;
- `support`: `executeRefund`, `manageCertificates`, `manageEnrollmentAccess`, `viewAdminPanel`, `viewFinancials`;
- `student`: nenhuma capacidade administrativa.

`manageFinancialOperations` é uma capacidade mutável exclusiva de Admin. Conciliação
por pagamento e importação de extrato exigem essa capacidade. `viewFinancials`
permanece leitura financeira e autorização da resolução de Revisões; `executeRefund`
continua separada para o fluxo explícito de estorno.

Server Actions e páginas devem checar a capacidade apropriada; esconder botão não é autorização. O papel Suporte implementado aguarda ratificação de produto.

### REG-IDA-004 Bloqueio de plataforma prevalece sobre Matrículas

`blockStudentPlatformAccessAction` e `restoreStudentPlatformAccessAction`, em `src/features/admin/actions.ts`, alteram o bloqueio amplo da Conta. Uma Matrícula ativa não contorna esse bloqueio.

**Invariantes:**

- bloquear não apaga Conta, Pedido, progresso ou Certificado;
- bloqueio por curso é outra operação;
- restaurar a plataforma não recria Concessões;
- sessão bloqueada não inicia Checkout;
- compra anônima identificada após pagamento como Conta bloqueada abre Revisão sem acesso
  e exige reembolso pelo Suporte.

### REG-IDA-005 Checkout público usa identidade coletada pelo provider

**Contrato aprovado e implementado em código para Asaas:**

- checkout autenticado vincula a Conta da sessão;
- o provider não altera nome, e-mail, verificação ou credenciais;
- checkout público nasce sem PII local e omite `customer`/`customerData` na criação;
- depois do evento financeiro autoritativo, o Hub consulta nome/e-mail do cliente Asaas;
- no checkout público, Compradora = Aluna;
- compra pública pode acontecer antes de existir Conta com credencial;
- Conta criada a partir da compra não é considerada verificada pelo provider;
- Conta existente não é sobrescrita pelos dados do checkout;
- compra como presente ou para terceiro fica fora do escopo.

Esse contrato está aprovado em [DEC-DISC-007](../decisions.md#dec-disc-007) e detalhado na
[especificação de compra pública](../superpowers/specs/2026-07-30-public-course-purchase-handoff-design.md).
A ação autenticada ignora identidade enviada pelo formulário e usa somente `session.user`.
O handoff público não recebe PII: o Pedido nasce com identidade `pending`, o processor
consulta o cliente Asaas fora da transação e persiste somente nome/e-mail uma vez.

`resolveLocalOrderIdentity`, em `src/features/payments/order-identity.ts`, resolve a
identidade pública a partir desse snapshot minimizado, preserva o índice
`users_email_lower_unique_idx` e mantém Conta nova com `email_verified=false`. Papel,
bloqueio geral e Matrícula revogada no Curso são verificados antes da Concessão. Colisão
abre Revisão `buyer_identity`, que não aceita decisão genérica e só encerra após reembolso
integral confirmado. A prova E2E PostgreSQL passou e a homologação Sandbox pós-mudança
comprovou PIX, vínculo, acesso, entrega do e-mail de ativação, criação da senha, login e
abertura do Curso.

### REG-IDA-006 Ativação por compra é durável sem persistir segredo

A intenção `auth.account-activation` guarda exatamente `userId` e `orderId`, sem outros
dados pessoais, token ou URL de callback. Na entrega, o adaptador exige Pedido Asaas
`paid`, vínculo do Pedido com a Conta e Conta existente, resolve o e-mail atual e chama
Better Auth `requestPasswordReset`. O token nasce apenas dentro do Better Auth/callback.
Como Better Auth captura falhas do callback e resolve a API mesmo sem envio, a chamada
interna abre um contexto assíncrono isolado, associado à chave HMAC da intenção, e só
conclui quando o callback registra entrega. Falha ou ausência do callback usa
`account_activation_failed` e permanece elegível para retry; Conta que já ganhou
credential satisfaz a intenção como no-op. O contexto guarda somente chave e resultado,
sem e-mail, token ou URL.

Factory, parser, processor e delivery implementam
[DEC-DISC-001](../decisions.md#dec-disc-001). O processor escolhe entre ativação e
`email.access-released` e grava a intenção na mesma transação do acesso.

## Autenticação

`getAuth`, em `src/lib/auth.ts`, configura Better Auth com adaptador Drizzle para `users`, `accounts`, `sessions` e `verifications`; e-mail e senha; token de redefinição por uma hora; revogação das sessões após redefinição; origens confiáveis de `parseTrustedOrigins`; e `nextCookies()` como último plugin.

As páginas `/` e `/entrar` aguardam uma requisição antes de resolver a sessão: uma Conta já autenticada é redirecionada para sua área, e essa leitura nunca ocorre durante o build.

## Fronteira Admin e Aluna

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
- [DEC-DISC-001](../decisions.md#dec-disc-001): ativação durável somente com `userId` e
  `orderId`, sem outros dados pessoais nem token persistido, implementada na outbox e
  enfileirada pelo processor Asaas;
- [DEC-DISC-007](../decisions.md#dec-disc-007): identidade de checkout e verificação,
  aprovadas e integradas ao processor Asaas; homologação externa pendente.
- ratificar a matriz de Suporte;
- racional histórico para Better Auth e autenticação por e-mail e senha não localizado.
