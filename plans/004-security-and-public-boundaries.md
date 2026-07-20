# Plan 004: Endurecer autenticação privilegiada e fronteiras públicas

> **Instruções ao executor**: trate cada entrada pública como não confiável e cada
> Server Action como endpoint público. Não mude identidade ou provedor de auth.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/lib/auth.ts src/app/api src/features/payments next.config.ts src/db`

## Status

- **Prioridade**: P1
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: `003-ci-and-risk-based-testing.md`
- **Categoria**: security
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

Admin e Suporte podem operar dinheiro, acesso, certificados e privacidade, mas o login
não exige 2FA/e-mail verificado. Checkout público limita tentativas em um `Map` local,
confia no primeiro `X-Forwarded-For` e devolve `error.message`, inclusive mensagens do
provedor/configuração. O app também não define CSP/headers.

## Estado atual

- `src/lib/auth.ts`, `createAuth`:
  - senha mínima 8;
  - reset revoga sessões;
  - Sentinel só existe quando Better Auth Infra está configurada;
  - `trustedProxyHeaders: true`;
  - sem `emailVerification`, `twoFactor` ou `rateLimit` explícito.
- `src/features/payments/public-checkout.ts`:
  - `publicCheckoutRateLimitState = new Map(...)`;
  - 5 tentativas/10 min por IP+curso, por processo.
- `src/app/api/checkouts/course/route.ts`:
  - usa primeiro `X-Forwarded-For`;
  - devolve qualquer `Error.message`;
  - transforma quase toda falha em 400.
- `next.config.ts`: sem headers/CSP.

Documentação oficial Better Auth 1.6.x:

- 2FA: https://www.better-auth.com/docs/plugins/2fa
- rate limit: https://www.better-auth.com/docs/concepts/rate-limit
- e-mail: https://www.better-auth.com/docs/concepts/email

## Escopo

**Em escopo**

- política 2FA para `admin` e `support`;
- verificação de e-mail e fluxo de ativação existente;
- rate limit compartilhado para auth/checkout/certificado;
- política de IP alinhada ao proxy real;
- erros públicos tipados;
- CSP e headers mínimos;
- validação de entradas de rotas/actions privilegiadas;
- migrations e UI estritamente necessárias.

**Fora de escopo**

- trocar Better Auth;
- Better Auth Admin/Organization;
- social login;
- CAPTCHA por padrão;
- copiar rate limiter fail-open de referência;
- aplicar CSP sem inventariar JMVStream/R2/Resend.

## Passos

### 1. Registrar política e rollout de identidade

Ratificar:

- 2FA obrigatória para Admin/Suporte;
- opt-in para aluna;
- e-mail verificado antes de sessão utilizável;
- recuperação de 2FA e custódia de backup codes;
- sessões existentes durante rollout;
- resposta de suporte sem bypass permanente.

**Verificar**: casos de aceitação aprovados por produto/operação.

### 2. Implementar 2FA e verificação

Configurar plugin oficial Better Auth, migration gerada e telas de enrollment/challenge.
Bloquear operação privilegiada se papel exige 2FA e enrollment não está completo.
Não depender apenas de esconder UI.

**Verificar**:

- login admin sem segundo fator não cria sessão privilegiada;
- backup code é single-use;
- reset revoga sessões;
- aluna segue política ratificada;
- e-mails não permitem enumeração de conta.

### 3. Substituir rate limits locais

Criar uma interface de rate limit com contador atômico, TTL e namespace. Usar store
compartilhado já aprovado para produção; Postgres é aceitável inicialmente se a
consulta for atômica e indexada. Definir fail-open/fail-closed por operação:

- checkout: degradação controlada, com alarme;
- login/2FA: seguir garantias Better Auth;
- certificado público: preservar disponibilidade com limite de dano explícito.

**Verificar**: duas instâncias concorrentes compartilham o mesmo contador.

### 4. Definir origem confiável do IP

Usar somente header inserido pelo proxy/CDN real e remover headers fornecidos pelo
cliente na borda. Não assumir que o primeiro `X-Forwarded-For` é autêntico.

**Verificar**: spoof de XFF não muda a chave; IP real do ambiente de preview/prod é
capturado como esperado.

### 5. Tipar erros públicos

Criar erros com código público estável e log interno correlacionado. A rota de checkout
deve devolver:

- 400 para input inválido;
- 404/409 conforme política de curso;
- 429 com `Retry-After`;
- 502/503 para provider indisponível;
- mensagem genérica para configuração e exceção inesperada.

Nunca devolver payload ou texto bruto de AbacatePay.

**Verificar**: testes injetam erro com texto sensível e provam que a resposta não o
contém.

### 6. Introduzir CSP e headers em report-only

Inventariar origens de:

- JMVStream iframe/player/CDN;
- R2 público e privado;
- imagens;
- APIs/auth;
- analytics/observabilidade aprovados.

Começar com CSP report-only, eliminar violações legítimas e então bloquear. Adicionar
`frame-ancestors`, `object-src`, `base-uri`, `Referrer-Policy`,
`X-Content-Type-Options` e Permissions Policy apropriada.

**Verificar**: E2E de player, upload, checkout e auth sem violações inesperadas.

### 7. Validar ações de alto risco

Aplicar schema compartilhado a IDs, enums, motivos e limites nas ações financeiras,
grant/enrollment, certificado e privacidade. Autorização continua dentro da função
server, após validação.

**Verificar**: UUID inválido, enum desconhecido, payload grande e string vazia falham
sem tocar banco.

## Critérios de pronto

- [ ] 2FA obrigatória para papéis privilegiados;
- [ ] política de e-mail verificado ativa;
- [ ] rate limit compartilhado e atômico;
- [ ] IP vem de fronteira confiável;
- [ ] nenhum erro interno chega ao checkout público;
- [ ] CSP bloqueante após fase report-only;
- [ ] ações críticas validam input e autorização;
- [ ] testes E2E e security regression passam.

## Condições STOP

- produto não ratifica recovery de 2FA;
- proxy real/header confiável não é conhecido;
- store compartilhado não possui semântica atômica;
- CSP exigiria `unsafe-eval` em produção sem justificativa;
- rollout bloquearia o único administrador sem recuperação ensaiada.

## Manutenção

Revisar origens CSP, papéis privilegiados e headers de proxy em cada mudança de
infraestrutura. Não transformar Better Auth Infra opcional em única defesa.

