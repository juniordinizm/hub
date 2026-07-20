# Plan 006: Tornar falhas detectáveis e recuperação ensaiável

> **Instruções ao executor**: não exponha detalhes de dependência no endpoint público.
> Não declare backup seguro sem executar restore test.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/app/api/health src instrumentation* next.config.ts docs/operations package.json`

## Status

- **Prioridade**: P1
- **Esforço**: L
- **Risco**: MED
- **Depende de**: `001-database-evolution-and-safe-tooling.md`
- **Categoria**: operations, reliability
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

`/api/health` sempre devolve `ok: true`; não prova que Postgres responde. Não há
error monitoring, tracing, logs estruturados, SLO nem evidência de restore. LearnHouse
tem health por dependência; CourseLit instrumenta workers. Neon recomenda proteção da
branch, pooling correto, métricas e restore testado.

## Estado atual

- `src/app/api/health/route.ts`: processo + timestamp.
- sem pacote/config explícita de Sentry/OpenTelemetry/logger;
- sem `instrumentation.ts`;
- sem `error.tsx`/`global-error.tsx`;
- infraestrutura externa marcada como não verificada;
- busca Neon acessível não encontrou projeto do Hub;
- migrations têm drift documentado;
- não há runbook com SLO/RTO/RPO ratificados.

## Escopo

**Em escopo**

- liveness e readiness separados;
- logging estruturado e correlation ID;
- captura de exceção e tracing;
- métricas RED para rotas e jobs;
- SLI/SLO iniciais;
- runbooks de provider;
- restore drill e migration drill;
- fallbacks de erro observáveis.

**Fora de escopo**

- expor credenciais/hostnames internos;
- monitorar conteúdo pessoal em payload;
- prometer alta disponibilidade sem infraestrutura;
- adicionar múltiplos vendors sem owner;
- health síncrono de todos os providers em cada request.

## Passos

### 1. Definir sinais e owners

Para auth, checkout/webhook, grant, player, upload, certificado, e-mail e crons,
definir:

- sucesso/falha;
- latency;
- saturation/backlog;
- owner;
- severidade;
- ação de runbook.

**Verificar**: todo alerta possui ação e owner; remover alertas sem resposta possível.

### 2. Separar liveness e readiness

- liveness: processo executa, sem dependência externa;
- readiness protegida/adequada à plataforma: query Postgres com timeout curto e estado
  de migrations; detalhes só em log;
- providers assíncronos entram em dashboard/synthetic checks, não bloqueiam health de
  cada request.

**Verificar**: banco indisponível => readiness não-2xx; liveness continua 2xx.

### 3. Introduzir logging e tracing

Padronizar campos:

- request/correlation ID;
- actor ID pseudonimizado quando necessário;
- operation;
- aggregate ID;
- provider;
- error code;
- duration;
- outcome.

Nunca logar token, senha, assinatura, payload pessoal integral ou URL assinada.

**Verificar**: teste captura erro sintético e localiza trace/log pelo mesmo ID.

### 4. Instrumentar jornadas críticas

Medir:

- auth failure/lockout;
- checkout criado/falhou;
- webhook idade/retry/conflito;
- grant projetado;
- upload pendente/falho;
- outbox backlog/dead-letter;
- certificado emitido;
- cron executado/atrasado.

**Verificar**: ambiente de teste gera cada sinal sem chamar produção.

### 5. Ratificar SLO e resposta

Começar com poucos SLOs:

- disponibilidade de login/player;
- processamento de webhook até acesso;
- idade máxima de outbox;
- tempo para upload sair de pending;
- erro de checkout.

Definir janela, budget e severidade. Não inventar percentuais sem baseline; coletar
por 30 dias antes de fixar objetivo.

### 6. Ensaiar recuperação

Com Neon/infra real identificada:

- confirmar branch protegida;
- confirmar pooled runtime e direct migrations;
- registrar PITR/history disponível;
- restaurar snapshot em branch isolada;
- validar contagens e invariantes;
- ensaiar migration forward e rollback operacional;
- limpar branch de teste.

Checklist Neon:
https://neon.com/docs/get-started/production-checklist

**Verificar**: relatório de restore com tempo medido, data e checks executados.

## Critérios de pronto

- [ ] readiness detecta banco;
- [ ] logs correlacionados sem segredos;
- [ ] exceções críticas chegam ao owner;
- [ ] backlog de outbox/webhook é mensurável;
- [ ] SLOs têm baseline e ação;
- [ ] restore real foi ensaiado;
- [ ] runbooks cobrem Neon, AbacatePay, JMVStream, R2 e Resend;
- [ ] fallbacks do App Router registram correlation ID.

## Condições STOP

- projeto/owner de infraestrutura não identificado;
- ferramenta exigiria enviar PII sem contrato;
- health detalhado ficaria público;
- restore test só seria possível sobre produção;
- migrations do plano 001 continuam divergentes.

## Manutenção

Repetir restore e incident drill trimestralmente. Revisar alertas sem ação e dados
sensíveis em logs a cada nova integração.

