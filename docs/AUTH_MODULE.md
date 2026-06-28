# Modulo de autenticacao e autorizacao

Data: 2026-06-28  
Stack: Next.js App Router, Better Auth, Drizzle/Postgres.

## Decisoes de produto

- A plataforma opera como cadastro fechado.
- `POST /api/auth/sign-up/email` fica bloqueado por padrao.
- Contas de alunas entram por fluxo controlado: pagamento/webhook, criacao administrativa ou reset de senha enviado pelo admin.
- `emailVerified` e metadado do provedor de auth, nao gate de acesso da aplicacao neste momento. Como o cadastro publico esta fechado, a identidade da aluna deve vir do fluxo operacional que criou a conta.
- `support` pode operar acesso/matriculas, mas nao pode alterar conteudo, configuracoes ou financeiro.

## Arquivos fonte

- `src/lib/auth.ts`: configuracao Better Auth, Drizzle adapter, password reset, Dash/Sentinel e cookies Next.js.
- `src/app/api/auth/[...all]/route.ts`: fronteira HTTP para endpoints Better Auth e bloqueio do sign-up publico.
- `src/lib/session.ts`: sessao atual, bloqueio de estudante e gates por role.
- `src/lib/auth-policy.ts`: politica pura e testavel de permissoes, bootstrap, sign-up e redirects.
- `src/lib/auth-permissions.ts`: wrapper server-only para exigir permissoes em paginas, Server Actions e DAL.
- `src/app/api/auth/dev/bootstrap-admin/route.ts`: bootstrap protegido para ambiente nao produtivo.

## Variaveis

Obrigatorias em producao:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_PUBLIC_SIGNUP_ENABLED=false`

Obrigatoria para bootstrap fora de producao:

- `INTERNAL_BOOTSTRAP_SECRET`

Opcionais recomendadas para Better Auth Infra:

- `BETTER_AUTH_API_KEY`
- `BETTER_AUTH_API_URL`
- `BETTER_AUTH_KV_URL`

Quando `BETTER_AUTH_API_KEY` existe, o app habilita `dash()` e `sentinel()` de `@better-auth/infra`. Sem essa chave, o auth continua funcionando sem esses plugins.

## Matriz de permissoes

Fonte: `src/lib/auth-policy.ts`.

| Role | viewAdminPanel | manageEnrollmentAccess | manageContent | manageSettings | viewFinancials |
| --- | --- | --- | --- | --- | --- |
| `admin` | sim | sim | sim | sim | sim |
| `support` | sim | sim | nao | nao | nao |
| `student` | nao | nao | nao | nao | nao |

Use `requirePermission(permission)` para novas paginas admin, Server Actions e funcoes server-only que leem dados sensiveis. Use `requireRole()` apenas quando a regra for realmente role-based e nao uma capacidade de negocio.

## Fronteiras de seguranca

- Layouts admin/student fazem o primeiro gate de navegacao.
- Server Actions e Route Handlers devem revalidar permissao no proprio endpoint.
- Funcoes que buscam dados administrativos devem chamar `requirePermission("viewAdminPanel")` ou permissao mais especifica.
- UI pode esconder acoes proibidas, mas a fonte da verdade fica no servidor.
- `nextCookies()` deve permanecer como ultimo plugin do Better Auth.

## Bootstrap admin

`POST /api/auth/dev/bootstrap-admin`:

- Retorna `404` em producao.
- Retorna `503` fora de producao se `INTERNAL_BOOTSTRAP_SECRET` nao estiver configurado.
- Retorna `401` quando o bearer token nao bate.
- Cria/promove o usuario para `admin` apenas depois da autorizacao.

## Cadastro publico

`AUTH_PUBLIC_SIGNUP_ENABLED` tem default `false`. Com esse valor, `POST /api/auth/sign-up/email` retorna `404` antes de chegar ao Better Auth.

So altere para `true` se o produto decidir abrir cadastro publico. Nesse caso, antes de ativar:

1. Criar `profile` automaticamente para todo usuario novo.
2. Definir se `emailVerified=false` bloqueia acesso, checkout ou ambos.
3. Adicionar rate limit/WAF especifico para sign-up.
4. Testar abuso de cadastro e reset de senha.

## Password reset

O reset usa URL canonica de `NEXT_PUBLIC_APP_URL` para gerar `/redefinir-senha`. Se a URL canonica estiver invalida no cliente, o helper cai para a origem atual. O token expira em 1 hora e o Better Auth revoga sessoes apos reset.

## Dash e Sentinel

`dash()` foi adicionado para expor capacidades administrativas/infra do Better Auth quando a chave existir. `sentinel()` foi adicionado para protecao contra abuso, incluindo credential stuffing.

Nao foi adicionado o plugin `admin()` do Better Auth porque o projeto ja tem RBAC proprio em `profiles.role`, Server Actions e paginas admin. Misturar dois modelos administrativos agora criaria duplicidade de fonte da verdade.

## Checklist para novas superficies auth-adjacent

Antes de criar pagina, action ou route que toque usuario, sessao, profile, matricula, financeiro ou conteudo admin:

1. Escolha a permissao em `auth-policy.ts`.
2. Chame `requirePermission()` dentro da action/route/DAL, nao apenas no layout.
3. Adicione teste da politica quando a regra mudar.
4. Confirme se a rota deve aceitar estudante bloqueada.
5. Rode o teste estreito e `bun run typecheck`.
