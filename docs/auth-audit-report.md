# Relatorio tecnico: auditoria de autenticacao e autorizacao

Data: 2026-06-28  
Escopo: Next.js App Router 16.2.9, React 19.2.7, Better Auth 1.6.20, Drizzle/Postgres, rotas `src/app`, Server Actions, Route Handlers, schema e configuracao de ambiente.

## Sumario executivo

O sistema usa uma base moderna e majoritariamente correta: Better Auth com adapter Drizzle/Postgres, `nextCookies()` configurado, helpers `server-only`, sessoes persistidas no banco, checagem server-side em layouts/Server Actions/Route Handlers e rotas sensiveis com autorizacao explicita.

Os maiores riscos nao estao no login basico, mas em bordas operacionais e de autorizacao:

1. Endpoint de bootstrap cria admin fora de producao sem exigir segredo quando `INTERNAL_BOOTSTRAP_SECRET` esta ausente.
2. O endpoint publico nativo de sign-up do Better Auth fica disponivel, mas o dominio do produto parece operar por convite/pagamento/reset de senha.
3. `emailVerified` existe no schema, mas nao participa de login/autorizacao.
4. Funcoes de leitura admin dependem do layout para protecao, nao de uma camada DAL com autorizacao perto dos dados.
5. Rate limiting de auth fica em memoria por padrao em producao, fragil em serverless/multiplas instancias.
6. Politica de `support` esta parcialmente espalhada entre layout, actions e UI.

## Status apos hardening

Implementado em 2026-06-28:

- Bootstrap admin agora exige `INTERNAL_BOOTSTRAP_SECRET` tambem fora de producao e retorna `503` quando o segredo nao esta configurado.
- Sign-up publico do Better Auth agora e bloqueado por padrao em `POST /api/auth/sign-up/email`; `AUTH_PUBLIC_SIGNUP_ENABLED=true` e necessario para reabrir.
- Matriz de permissoes centralizada em `src/lib/auth-policy.ts`.
- `requirePermission()` server-only criado para aplicar autorizacao por capacidade perto das paginas e funcoes sensiveis.
- Leituras administrativas em `src/features/admin/server.ts` agora exigem `viewAdminPanel`.
- Paginas de financeiro e configuracoes agora exigem permissoes especificas, impedindo acesso de `support`.
- Reset de senha usa URL canonica de `NEXT_PUBLIC_APP_URL` com fallback validado para origem atual.
- Better Auth Dash e Sentinel foram adicionados via `@better-auth/infra`, habilitados somente com `BETTER_AUTH_API_KEY`.
- `docs/AUTH_MODULE.md`, `.env.example` e `docs/DEPLOY_CHECKLIST.md` documentam as novas decisoes operacionais.
- Compra externa por landing page agora segue cadastro fechado: checkout publico sem sessao, webhook confirmado cria/localiza usuario pelo e-mail normalizado, concede matricula e aciona criacao/redefinicao de senha quando necessario.
- E-mails de usuarios agora sao protegidos contra duplicidade case-insensitive por indice unico em `lower(email)`.

Decisoes mantidas:

- O plugin `admin()` do Better Auth nao foi adicionado para evitar duas fontes de verdade de RBAC. O projeto usa `profiles.role` e permissoes locais.
- `emailVerified` segue como metadado, nao gate de acesso, porque o cadastro publico esta fechado. Se o produto abrir cadastro, isso deve ser revisitado antes de ativar `AUTH_PUBLIC_SIGNUP_ENABLED=true`.

## Fontes consultadas

- `ctx7`: `/better-auth/better-auth`, docs de integracao Next.js. Pontos usados: `nextCookies()` por ultimo, `auth.api.getSession({ headers: await headers() })`, protecao em Server Components.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`. Pontos usados: auth em tres camadas, Server Actions/Route Handlers como endpoints publicos, DAL centralizada e cuidado com auth em layouts.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. Ponto usado: Proxy e util para checks otimistas, nao como autorizacao completa.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/headers.md` e `cookies.md`. Pontos usados: APIs async e restricoes de leitura/escrita.
- Skill `vercel:auth` e `vercel:nextjs`: confirmaram padroes de auth em camadas, Proxy no Next 16 e risco de depender exclusivamente de middleware/proxy.

## O que esta correto

- `src/lib/auth.ts` usa `server-only`, Better Auth, Drizzle adapter e `nextCookies()` no fim da lista de plugins (`src/lib/auth.ts:1`, `src/lib/auth.ts:48`).
- `getAuth()` e `getDb()` sao lazy singletons, evitando inicializacao de SDK/DB em module scope durante build (`src/lib/auth.ts:52`, `src/db/index.ts:42`).
- `getCurrentSession()` usa `auth.api.getSession({ headers: await headers() })`, alinhado ao Better Auth e Next 16 (`src/lib/session.ts:23`).
- Admin e estudante tem layouts server-side com `requireRole`/`requireSession` (`src/app/(admin)/admin/layout.tsx:8`, `src/app/(student)/app/layout.tsx:27`).
- Server Actions relevantes revalidam permissao no servidor. Mutacoes de curso/aula/configuracao exigem `admin`; ajustes de matricula permitem `admin`/`support` de forma explicita (`src/features/admin/actions.ts:615`, `src/features/admin/actions.ts:1055`).
- Route Handlers sensiveis tambem validam sessao/role: upload admin exige `admin`, download/preview de recursos exige sessao, access status exige role de aluno (`src/app/api/admin/lessons/[lessonId]/resources/upload-url/route.ts:68`, `src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.ts:14`, `src/app/api/enrollments/access/route.ts:9`).
- Crons exigem bearer token quando `CRON_SECRET` existe e falham em producao se ele faltar (`src/app/api/cron/enrollments/route.ts`, `src/app/api/cron/jmvstream/route.ts`).
- Webhook AbacatePay exige segredo e assinatura antes de processar payload (`src/app/api/webhooks/abacatepay/route.ts`).
- Bloqueio de estudante em plataforma e role-based redirects estao modelados em `requireSession()`/`requireRole()` (`src/lib/session.ts:54`, `src/lib/session.ts:68`).

## Achados criticos e altos

### Alta: bootstrap admin aberto quando o segredo esta ausente fora de producao

Evidencia: `src/app/api/auth/dev/bootstrap-admin/route.ts:10` bloqueia apenas `NODE_ENV === "production"`. Depois, a checagem de Authorization so roda se `env.INTERNAL_BOOTSTRAP_SECRET` existir (`src/app/api/auth/dev/bootstrap-admin/route.ts:17`). Se o segredo estiver vazio em preview/dev exposto, qualquer POST com email/nome/senha cria ou promove admin (`src/app/api/auth/dev/bootstrap-admin/route.ts:33`, `src/app/api/auth/dev/bootstrap-admin/route.ts:44`, `src/app/api/auth/dev/bootstrap-admin/route.ts:48`).

Recomendacao: exigir `INTERNAL_BOOTSTRAP_SECRET` sempre, exceto talvez `localhost` estrito; retornar `503` quando ausente. Adicionar teste cobrindo segredo ausente em ambiente nao local.

### Alta: sign-up publico nativo do Better Auth parece fora da politica de produto

Evidencia: `emailAndPassword.enabled = true` habilita os endpoints de email/senha (`src/lib/auth.ts:35`). Nao ha UI de cadastro, mas `/api/auth/sign-up/email` fica exposto pelo handler catch-all (`src/app/api/auth/[...all]/route.ts:3`). `getCurrentSession()` trata usuario sem `profile` como `student` (`src/lib/session.ts:50`).

Impacto: usuario pode criar conta diretamente pela API, entrar como estudante sem `profile`, acessar `/app` e potencialmente iniciar checkout. Se o produto deve ser por convite, pagamento ou reset de senha, isso abre uma entrada nao governada.

Recomendacao: decidir a politica. Para plataforma fechada, bloquear sign-up publico via hook/endpoint customizado ou mover criacao para fluxo controlado. Para plataforma aberta, criar `profile` de estudante no cadastro e documentar essa entrada.

### Alta: `emailVerified` existe, mas nao e aplicada

Evidencia: coluna `emailVerified` existe (`src/db/schema.ts:113`), mas a busca por `emailVerified` fora do schema nao encontrou uso relevante. O webhook cria usuarios com `email_verified = true` (`src/features/payments/server.ts:110`), enquanto sign-up/email pode criar usuario sem verificacao.

Impacto: contas criadas diretamente podem autenticar sem email validado, dependendo do comportamento padrao do Better Auth. Isso reduz garantia de identidade para suporte, compras e recuperacao.

Recomendacao: se email verificado importa, configurar envio/verificacao no Better Auth e bloquear acesso/checkout enquanto `emailVerified=false`. Se nao importa, remover a expectativa do modelo mental e documentar.

### Alta: funcoes de leitura admin nao autorizam perto dos dados

Evidencia: `getAdminOverview()` e `getAdminManagementData()` consultam dados administrativos sensiveis sem receber/validar sessao (`src/features/admin/server.ts:23`, `src/features/admin/server.ts:205`). Hoje elas ficam protegidas pelo layout admin (`src/app/(admin)/admin/layout.tsx:8`).

Impacto: alinhamento parcial com Next docs. Layout protege a rota, mas docs recomendam verificacao em DAL/fonte de dados porque layouts nao sao o melhor unico limite e funcoes server-only podem ser reutilizadas no futuro.

Recomendacao: criar DAL admin, por exemplo `requireAdminDataAccess(["admin", "support"])`, e chamar dentro das funcoes de leitura sensiveis ou em wrappers especificos.

## Achados medios

### Media: `trustedProxyHeaders: true` exige fronteira confiavel

Evidencia: `src/lib/auth.ts:19`.

Impacto: Better Auth passa a honrar `x-forwarded-host`/`x-forwarded-proto`. A Vercel normalmente fornece uma fronteira confiavel, mas self-host/dev exposto por tunel/proxy mal configurado pode aceitar headers forjados.

Recomendacao: condicionar por ambiente/plataforma ou documentar que a aplicacao deve rodar atras de proxy que sobrescreve esses headers.

### Media: rate limit de auth em memoria por padrao

Evidencia em Better Auth 1.6.20 local: rate limit fica `enabled` em producao, `window=10`, `max=100`, `storage=memory` quando nao existe `secondaryStorage`.

Impacto: cada instancia serverless tem contador proprio. Ataques distribuidos contra login/reset/sign-up podem atravessar o limite com facilidade.

Recomendacao: configurar storage compartilhado para rate limit, ou aplicar WAF/rate limiting na borda para `/api/auth/*`, especialmente sign-in, sign-up e reset.

### Media: politica de `support` precisa ser formalizada

Evidencia: layout admin permite `admin` e `support` (`src/app/(admin)/admin/layout.tsx:8`). Mutacoes de conteudo/config exigem apenas `admin` (`src/features/admin/actions.ts:615`, `src/features/admin/actions.ts:1385`), mas ajustes de matricula e bloqueios permitem `support` (`src/features/admin/actions.ts:1055`, `src/features/admin/actions.ts:1215`).

Impacto: a regra parece intencional, mas esta dispersa. Como `support` enxerga o painel admin, a UI precisa esconder comandos proibidos e o servidor precisa manter a fonte da verdade.

Recomendacao: extrair matriz de permissoes (`canManageContent`, `canManageEnrollmentAccess`, `canViewFinancials`, etc.) e usar tanto UI quanto actions a partir dela.

### Media: reset de senha usa `window.location.origin`

Evidencia: `src/app/(auth)/recuperar-senha/request-password-reset-form.tsx:23`.

Impacto: em ambiente com preview/tunel/domino alternativo, links podem ser gerados para origem acessada pelo usuario. Isso e conveniente, mas pode conflitar com dominios canonicos e politica de trusted origins.

Recomendacao: gerar `redirectTo` no servidor com `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` canonico ou validar a origem contra `trustedOrigins`.

### Media: requisito de senha inconsistente

Evidencia: Better Auth aceita minimo 8 (`src/lib/auth.ts:37`); UI de reset exige `minLength={10}` (`src/app/(auth)/redefinir-senha/reset-password-form.tsx:63`, `src/app/(auth)/redefinir-senha/reset-password-form.tsx:74`).

Impacto: UX e politica divergentes; usuarios via endpoint podem usar 8, UI exige 10.

Recomendacao: centralizar politica de senha e refletir a mesma regra no servidor e UI. Preferir 10+ com bloqueio de senhas comprometidas quando possivel.

## Gaps de teste

- Falta teste real de `requireSession()`/`requireRole()` cobrindo usuario sem `profile`, estudante bloqueada, `support` e `admin`.
- Falta teste de que bootstrap admin exige segredo quando nao e producao local.
- Falta teste de politica de sign-up publico: permitido com criacao de profile ou bloqueado.
- Falta teste de email nao verificado, se a decisao for bloquear.
- Falta teste de Route Handlers de auth-adjacent: `/api/auth/redirect`, bootstrap, upload-url, download/preview de recurso.
- Testes atuais para auth sao majoritariamente indiretos/string-source ou validam payload de sign-in.

## Verificacao executada

- `bun run typecheck`: passou.
- `bun run test`: falhou em 3 testes existentes.
  - `src/lib/allowed-dev-origins.test.ts`: esperado `"https://register-available-shaft.ngrok-free.dev/app"`, recebido `"register-available-shaft.ngrok-free.dev"`. Auth-adjacent; ha divergencia entre teste e implementacao de `allowedDevOrigins`.
  - `src/features/admin/enrollment-expiration-controls.test.ts`: espera textos `"Expiracao original"`/`"Expiracao atual"` que nao existem mais no componente.
  - `src/features/comments/rules.test.ts`: ordenacao esperada de comentarios raiz diverge do resultado atual.

Essas falhas nao foram introduzidas por esta auditoria, que adicionou apenas este documento.

## Features recomendadas

1. Matriz de permissoes centralizada para `admin`, `support`, `student`.
2. Politica explicita de cadastro: fechado por convite/pagamento ou aberto com profile automatico.
3. Verificacao de email ou decisao documentada de dispensar verificacao.
4. Rate limit compartilhado para `/api/auth/*` e reset de senha.
5. Auditoria de eventos de auth: sign-in falho, reset solicitado, senha alterada, bootstrap usado, bloqueio/desbloqueio.
6. Sessao/admin: opcionalmente exigir reautenticacao para acoes sensiveis como configuracoes, conteudo publicado e financeiro.
7. Documentar runbook de primeiro acesso da aluna criada por pagamento/webhook.

## Priorizacao sugerida

1. Fechar bootstrap admin quando `INTERNAL_BOOTSTRAP_SECRET` estiver ausente.
2. Decidir e implementar politica de sign-up publico.
3. Aplicar ou remover semanticamente `emailVerified`.
4. Mover leitura admin sensivel para DAL autorizada.
5. Centralizar matriz de permissoes.
6. Configurar rate limit distribuido/WAF para auth.
7. Adicionar testes de auth/role/blocked/profile.

## Veredito

A implementacao atual e boa como base e segue varios padroes modernos de Next.js + Better Auth. Nao encontrei dependencia exclusiva de middleware/proxy para autorizacao, o que e positivo. O principal trabalho agora e endurecimento: fechar entradas operacionais, explicitar politica de cadastro/verificacao, colocar autorizacao mais perto dos dados e transformar permissoes em uma matriz unica testavel.
