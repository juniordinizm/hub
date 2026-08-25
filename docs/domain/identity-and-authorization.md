---
status: canonical
owner: engineering
last_verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
---

# Identidade e autorização

## Escopo

Define Conta, sessão, perfil, papéis, permissões e bloqueios. Termos comerciais como Compradora e Concessão ficam em [Comércio e acesso](commerce-and-access.md).

## Modelo e estados

- `users`: identidade Better Auth e indicador de segundo fator habilitado.
- `accounts`: credenciais e provedores da identidade.
- `sessions`: sessões revogáveis.
- `verifications`: tokens de verificação e recuperação.
- `two_factors`: segredo TOTP cifrado, códigos de recuperação cifrados e
  orçamento de falhas do Better Auth.
- `profiles`: papel, bloqueio de plataforma e dados complementares da Aluna.
- papéis: `admin`, `support`, `student`.

Não existe Better Auth Admin Plugin nem Organization Plugin. Não existe organização, tenant, convite ou equipe de cliente no domínio atual.

### REG-IDA-001 E-mail identifica a Conta sem distinção de caixa

**Invariante:** duas Contas não podem representar a mesma identidade canônica de e-mail.
Além de espaços e caixa, Gmail/Googlemail convergem domínio, removem pontos e `+tag`;
provedores reconhecidos pelo Sentinel removem `+tag`. Essa mesma regra deve ser aplicada
antes de procurar ou criar a Conta da Compradora.

**Implementado:** migration `0027_case_insensitive_user_email.sql`; normalização de Compradora compatível com o Sentinel em `normalizeBuyerEmail`, de `src/features/payments/buyer-identity.ts`.

**Falha:** conflitos de legado precisam ser resolvidos antes de aplicar a restrição. A migration não está no journal atual; a garantia do banco implantado não foi verificada.

`scanBuyerIdentityCollisions`, em `src/features/payments/identity-collision-audit.ts`,
é uma auditoria somente leitura em lotes por cursor. Ela agrupa somente colisões da
política já implementada, preserva os e-mails originais para a investigação
administrativa e não altera Conta, Pedido ou Matrícula. Nenhum resultado da auditoria
autoriza merge automático: cada conflito legado exige decisão explícita.

O comando `bun run ops:audit:buyer-identities` exibe por padrão apenas quantidade,
quantidade de Contas e hash do agrupamento. A forma detalhada exige a confirmação
local `IDENTITY_AUDIT_CONFIRMATION=read-only`; nunca execute essa forma em CI ou
redirecione sua saída para logs compartilhados.

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
- `support`: `executeRefund`, `manageEnrollmentSupport`,
  `reissueCertificates`, `viewAdminPanel`, `viewCourseOperations`,
  `viewFinancials`, `viewScopedAudit` e `viewStudentOperations`;
- `student`: nenhuma capacidade administrativa.

Essa matriz central já representa a fronteira aprovada no
[DEC-DISC-014](../decisions.md#dec-disc-014). `viewAdminPanel` autoriza somente o
shell; toda leitura e mutação de domínio ainda exige sua capacidade específica.
Páginas, Route Handlers, Server Actions e projeções aplicam essas capacidades no
servidor. `support` usa consultas próprias por Curso e não executa primeiro uma
consulta ampla para filtrá-la depois. O finding `F-001` permanece aberto somente
até concluir o rollout operacional do TOTP e o gate completo do Sprint 1.

A ficha contextual de `support` combina somente dados da Aluna no Curso
selecionado: estado e validade da Matrícula, bloqueio contextual, progresso das
Aulas obrigatórias, Certificado mais recente, Pedidos e reembolsos associados e
auditoria restrita aos agregados permitidos. Ela não consulta nem mostra edição
de conteúdo, configuração da plataforma, auditoria global ou controles Admin.
Admin continua usando sua projeção própria e não herda a restrição de
Certificado mais recente aplicada ao Suporte.

`manageFinancialOperations` e `manageFinancialReviews` são capacidades mutáveis
exclusivas de Admin. Conciliação por pagamento e importação de extrato exigem a
primeira; qualquer decisão manual que altere Revisão, Pedido ou acesso exige a
segunda. `viewFinancials` permanece estritamente leitura. `executeRefund` continua
separada para o Suporte iniciar o fluxo explícito de estorno autorizado.

Server Actions e páginas devem checar a capacidade apropriada; esconder botão não é autorização.

### Assurance de Admin/Suporte

O plugin two-factor do Better Auth `1.6.25` usa issuer `PROTEA-R Hub`, impede
persistência útil de dispositivo confiável e bloqueia a Conta por quinze minutos
após cinco falhas consecutivas. `resolvePrivilegedAssurance`, em
`src/lib/privileged-assurance.ts`, trata uma sessão ativa de `admin` ou `support`
com TOTP habilitado como verificada: o Better Auth apaga a sessão criada por senha
antes do challenge e cria outra somente após TOTP ou backup code válido.

`requireRole` e, por consequência, `requirePermission` aplicam essa assurance em
cada fronteira servidor-side. Com `PRIVILEGED_MFA_ENFORCED=true`, uma Conta
privilegiada sem TOTP só alcança `/configurar-segundo-fator`; estudantes não mudam.
O default permanece `false` exclusivamente para o rollout: duas Contas Admin
distintas devem concluir setup, e uma delas deve provar recuperação por backup
code, antes de ativar o gate em Production.

A configuração exige senha atual, apresenta QR e segredo manual, mostra códigos
de recuperação uma única vez e valida TOTP sem confiar no dispositivo. O login
aceita TOTP ou backup code com mensagem genérica. Recuperação reconfirma a senha,
obtém a URI do segredo existente e substitui todo o conjunto de backup codes. Os
endpoints de desativação e de segundo `enable` são negados a `admin` e `support`
antes de delegar ao Better Auth.

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

`getAuth`, em `src/lib/auth.ts`, configura Better Auth com adaptador Drizzle para
`users`, `accounts`, `sessions`, `verifications` e `twoFactors`; e-mail e senha;
token de redefinição por uma hora; revogação das sessões após redefinição;
origens confiáveis de `parseTrustedOrigins`; o plugin `twoFactor`; e
`nextCookies()` como último plugin.

### REG-IDA-007 Senha tem mínimo único de oito caracteres

Cadastro, redefinição, bootstrap operacional e Better Auth usam
`PASSWORD_MIN_LENGTH = 8`, de `src/lib/password-policy.ts`. Sete caracteres são
rejeitados e oito são aceitos; a confirmação deve ser idêntica. A mesma política
preserva token de redefinição por uma hora e revoga as sessões existentes depois
da troca. Mensagens públicas de recuperação continuam indistinguíveis para Conta
existente, inexistente ou falha de entrega.

As páginas `/` e `/entrar` aguardam uma requisição antes de resolver a sessão: uma Conta já autenticada é redirecionada para sua área, e essa leitura nunca ocorre durante o build.

## Fronteira Admin e Aluna

`getStudentPreviewMode`, `canAccessStudentRoute` e `canMutateStudentExperience`, em `src/features/courses/preview.ts`, permitem visualização controlada da experiência da Aluna. Preview de Admin não deve gravar progresso nem simular autorização real.

## Concorrência e segurança

- sessão deve ser resolvida no servidor a cada operação sensível;
- permissão não deve ser recebida do cliente;
- e-mail, ID de usuário e papel não devem ser aceitos como prova de identidade sem sessão;
- redefinição revoga sessões existentes;
- mudança de papel ou do indicador de segundo fator revoga sessões existentes;
- credenciais e secrets nunca entram em logs ou documentação versionada.

## Evidências

- schema: `roleEnum`, `users`, `sessions`, `accounts`, `verifications`,
  `twoFactors` e `profiles` em `src/db/schema.ts`;
- implementação: `getAuth`, `canPerform`, `resolvePrivilegedAssurance`,
  `isBlockedAuthEndpoint` e `getBootstrapAdminDecision`;
- testes: `src/lib/auth-policy.test.ts`, `src/lib/session.test.ts`,
  `src/lib/privileged-assurance.test.ts`,
  `src/lib/better-auth-two-factor-installed-contract.test.ts`,
  `src/db/two-factor-schema-contract.test.ts`,
  `src/lib/trusted-origins.test.ts` e `src/lib/allowed-dev-origins.test.ts`;
- rotas: `src/app/api/auth/[...all]/route.ts`,
  `src/app/api/auth/redirect/route.ts` e
  `src/app/api/auth/dev/bootstrap-admin/route.ts`.

## Decisões e pendências

- [ADR-0001](../adr/0001-custom-rbac.md): RBAC próprio, aceito.
- [DEC-DISC-001](../decisions.md#dec-disc-001): ativação durável somente com `userId` e
  `orderId`, sem outros dados pessoais nem token persistido, implementada na outbox e
  enfileirada pelo processor Asaas;
- [DEC-DISC-007](../decisions.md#dec-disc-007): identidade de checkout e verificação,
  aprovadas e integradas ao processor Asaas; homologação externa pendente.
- [DEC-DISC-014](../decisions.md#dec-disc-014): matriz granular de `support`,
  projeções por Curso e negações diretas implementadas; rollout operacional do
  TOTP e gate completo do Sprint 1 permanecem pendentes;
- racional histórico para Better Auth e autenticação por e-mail e senha não localizado.
