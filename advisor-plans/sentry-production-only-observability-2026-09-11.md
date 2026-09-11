---
status: in-progress
owner: product-and-engineering
planned_at_commit: edad1eb
date: 2026-09-11
scope: sentry-production-only
---

# Plano: Sentry somente em Production

> **Instruções ao executor**: este plano tem dois lados coordenados: o código
> deve deixar de inicializar o Sentry fora de Production e a configuração
> externa deve deixar de notificar fora de Production. Não remova projetos,
> DSNs, alertas ou secrets antes de concluir a fase de inventário e cumprir o
> período de observação definido nela. Não reproduza valores de credenciais.
> Ao concluir uma fase, atualize o status deste arquivo e a tabela em
> `advisor-plans/README.md`.

> **Drift check inicial**: `git diff --stat edad1eb..HEAD -- src/instrumentation.ts instrumentation-client.ts src/lib/sentry-options.ts src/lib/sentry-deployment.ts src/lib/sentry-readiness.ts src/lib/*environment.ts src/lib/env.ts src/app/api/health/sentry scripts/check-sentry-readiness.ts .github/workflows/verify-production-sentry.yml .env.example docs/operations/observability-and-recovery.md`

## Status

- **Prioridade**: P0
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: nenhum plano de código; exige acesso de leitura ao Sentry, Vercel e GitHub. Alterações externas destrutivas exigem autorização do operador.
- **Categoria**: operations, security, reliability
- **Planejado em**: commit `edad1eb`, 2026-09-11
- **Issue**: não publicada

### Execução em 2026-09-11

- **Fase 0**: inventário somente leitura concluído; hub-web permanece o
  projeto canônico e hub-production está marcado para observação.
- **Fase 1**: contrato Production-only implementado no runtime, nos guards,
  nos testes e no exemplo de ambiente.
- **Fase 3**: readiness e checker restringidos a Production; testes e workflow
  permanecem alinhados.
- **Fase 5**: documentação operacional atualizada e validada.
- **Aproveitamento Free**: spans e Application Metrics de baixa cardinalidade
  adicionados ao wrapper de operações; o cron de outbox passou a emitir o único
  check-in permitido no desenho atual. Dashboard, uptime monitor e alertas de
  métricas continuam sendo configuração externa pendente.
- **CodeRabbit**: skipped — CLI indisponível nesta estação; revisão manual e
  checks locais executados.
- **Pendente externo**: acompanhar a limpeza por uma janela operacional,
  revisar a duplicidade de alertas, remover ou arquivar o projeto legado depois
  da observação e confirmar privacidade/retention no painel. A integração
  disponível nesta estação é somente leitura, portanto essas mudanças não
  foram simuladas nem aplicadas por API.

### Atualização externa após a limpeza

- O operador confirmou a remoção das variáveis Sentry de Staging e Preview.
- A leitura autenticada confirmou que a regra de hub-production agora está em
  environment=production.
- Na janela de 24 horas consultada, hub-web tinha zero erro em Staging, zero
  erro em Production e ainda registrava erros em Development; isso indica que
  existe algum emissor Development residual, normalmente estação local ou
  deployment antigo. O zero em Staging ainda precisa ser acompanhado após o
  deploy do contrato Production-only.
- A estação local ainda contém nomes de variáveis Sentry no `.env.local`,
  incluindo DSN e tokens de apoio ao checker. Esses valores devem ser removidos
  do ambiente carregado pelo Development e, se ainda necessários ao checker,
  mantidos somente em um shell/secret store separado.
- Não existem cron monitors, uptime monitors ou alertas de métrica. Também não
  há dashboard customizado; os dashboards listados são templates predefinidos
  vazios.
- Ambos os projetos possuem apenas um DSN Default. Releases dos mesmos SHAs
  aparecem em hub-web e hub-production, reforçando a hipótese de projeto
  legado/duplicado, não de dois serviços.

## Objetivo e decisão de produto

O resultado desejado é um observability boundary simples:

- Sentry captura erros, traces e readiness somente no runtime Production;
- nenhum evento de Development, Staging, Preview ou E2E chega ao Sentry;
- todas as notificações Sentry habilitadas são explicitamente restritas a
  `environment=production`;
- Production não pode iniciar sem DSN, release e configuração de source maps
  compatíveis com o projeto canônico;
- `CI`, readiness, smoke e revisão humana continuam sendo gates independentes;
- Development e Staging continuam verificáveis por testes, logs locais, CI e
  health checks, sem depender de Sentry.

Esta decisão abandona a observabilidade Sentry de Staging. Portanto, a prova
de readiness Sentry de Staging deve ser removida ou marcada como histórica; ela
não pode continuar descrita como gate atual depois da implementação.

## Estado atual confirmado

### Topologia externa

- A organização Sentry é `neurocapacitar`.
- Existem os projetos `hub-web` e `hub-production`.
- O GitHub Environment `vercel-production` usa `SENTRY_PROJECT=hub-web` e o
  alerta `Hub production readiness`.
- `hub-web` recebeu, nos últimos 30 dias, eventos de erro em `development`,
  `staging` e `production`. Também recebeu spans nos três ambientes.
- `hub-production` recebeu eventos recentes de Production, mas mantém uma
  regra de primeiro evento sem filtro de ambiente.

### Alertas atuais

No projeto `hub-web` há três regras de Issue Alert habilitadas, todas com
`environment=production`:

- `Hub production readiness`: exige a tag `readiness_probe=sentry` e envia
  e-mail aos membros;
- `Hub Production High Priority`: dispara para primeira ocorrência de issue
  de alta prioridade e envia e-mail aos membros ativos;
- `Send a notification for high priority issues`: cobre issues novas e
  existentes de alta prioridade, envia e-mail aos donos e também ao Linear.

No projeto `hub-production` há a regra `Notify Suggested Assignees, Notify via
Linear`, com primeiro evento e sem filtro de ambiente. Ela envia e-mail aos
donos e ação para Linear.

As duas regras de alta prioridade em `hub-web` têm escopo parcialmente
sobreposto. A duplicação pode ser intencional para separar e-mail de Linear,
mas precisa ser confirmada antes de consolidar.

### Código e contratos atuais

- `src/instrumentation.ts:8-27` inicializa o SDK server-side com `SENTRY_DSN`
  tanto em Node quanto em Edge, usando `VERCEL_TARGET_ENV` como ambiente.
- `instrumentation-client.ts:5-11` inicializa o SDK do navegador quando existe
  `NEXT_PUBLIC_SENTRY_DSN`.
- `src/lib/sentry-options.ts:123-156` marca o SDK como habilitado quando há DSN,
  mantém `tracesSampleRate=0.1`, desabilita PII padrão e aplica sanitização.
- `next.config.ts:19-24,145-162` já limita auth token e upload de source maps a
  builds Production não-E2E; essa propriedade deve ser preservada.
- `src/lib/development-environment.ts:219-239` exige DSNs e
  `DEVELOPMENT_SENTRY_PROJECT_ID`, e rejeita o projeto Production.
- `src/lib/staging-environment.ts:214-235` exige DSNs e
  `STAGING_SENTRY_PROJECT_ID`, e rejeita o projeto Production.
- `src/lib/production-environment.ts:1-24` não exige Sentry no contrato de
  Production; uma aplicação pode iniciar sem monitoramento.
- `src/app/api/health/sentry/route.ts:30-78` permite emissão sintética em
  Production e Staging.
- `src/lib/sentry-readiness.ts:9-18` modela o ambiente protegido como
  `production | staging`.
- `scripts/check-sentry-readiness.ts:42-44` aceita `production` e `staging`.
- `.github/workflows/verify-production-sentry.yml:25-98` verifica somente
  Production hoje, usando o projeto `hub-web` configurado no Environment.
- `.env.example:87-106` ainda documenta variáveis de Development/Staging e usa o
  slug histórico `hub-development`, enquanto Production usa `hub-web`.

### Baseline de verificação

O comando correto para os testes Vitest relacionados ao Sentry é:

```powershell
bun run test -- src/lib/sentry-options.test.ts src/lib/sentry-deployment.test.ts src/lib/sentry-readiness.test.ts src/app/api/health/sentry/route.test.ts src/tooling/sentry-readiness-check.test.ts src/instrumentation.test.ts
```

Baseline no commit planejado: 6 arquivos e 38 testes passaram. `bun test` não
é o comando equivalente neste projeto porque invoca o runner Bun diretamente,
que não fornece os mocks Vitest usados pela suíte.

## Achados priorizados

### [OBS-01] A coleta não está restrita a Production

- **Evidence**: `src/instrumentation.ts:11-24` e `instrumentation-client.ts:5-10` inicializam o SDK sempre que a variável DSN existe; `src/lib/sentry-options.ts:152` usa `enabled: Boolean(dsn)`; o Sentry observou eventos de erro de Development e Staging recentemente.
- **Impact**: apagar Development dos alertas não reduz ingestão, volume, custo, ruído de Issues ou exposição de telemetria. A intenção Production-only ainda não é cumprida.
- **Effort**: L — alteração de runtime, ambientes, testes, configuração externa e documentação.
- **Risk**: HIGH — remover a coleta de Staging sem retirar o readiness correspondente pode quebrar uma prova operacional.
- **Confidence**: HIGH.
- **Fix sketch**: criar uma decisão única baseada em `resolveRuntimeEnvironment`, inicializar o Sentry apenas quando o runtime for `production` e remover DSNs de ambientes não produtivos após a confirmação externa. Preservar o sanitizador e a coleta de erros Production.

### [OBS-02] Os guards de ambiente contradizem a política Production-only

- **Evidence**: `src/lib/development-environment.ts:221-236` e `src/lib/staging-environment.ts:216-231` tratam DSNs não produtivos como obrigatórios; os testes `src/lib/development-environment.test.ts` e `src/lib/staging-environment.test.ts` codificam essa exigência; `src/lib/production-environment.ts:1-24` não exige DSN Production.
- **Impact**: remover DSNs não produtivos faria o onboarding falhar, enquanto Production poderia continuar sem Sentry e sem source maps. A configuração ficaria fail-open no ambiente mais crítico.
- **Effort**: M.
- **Risk**: MED — guards errados podem bloquear Development/Staging ou permitir deploy não observável se a ordem de mudança for incorreta.
- **Confidence**: HIGH.
- **Fix sketch**: tornar Sentry ausente uma condição válida em Development, Staging, Preview e E2E; exigir os identificadores e DSNs necessários no contrato Production; atualizar `.env.example` para `hub-web` e retirar variáveis que deixarem de existir.

### [OBS-03] A topologia possui projeto duplicado e regra sem filtro

- **Evidence**: o Environment Production aponta para `hub-web`; `hub-web` e `hub-production` receberam releases Production; a regra `Notify Suggested Assignees, Notify via Linear` em `hub-production` está sem `environment`; os dados recentes mostram eventos em ambos os projetos.
- **Impact**: o mesmo incidente pode abrir Issues e notificações em projetos diferentes, dificultando ownership, source maps, métricas e triagem. Um evento não produtivo encaminhado ao projeto secundário poderia notificar.
- **Effort**: M.
- **Risk**: HIGH se o projeto errado for removido; MED se apenas filtros e roteamento forem ajustados.
- **Confidence**: HIGH para a existência da duplicação; MED para a causa dos eventos duplicados.
- **Fix sketch**: tratar `hub-web` como candidato canônico porque é o projeto configurado no Environment Production; adicionar filtro Production à regra do projeto secundário; observar por um período acordado antes de arquivar ou remover qualquer DSN/projeto.

### [OBS-04] Readiness Sentry ainda aceita Staging

- **Evidence**: `src/app/api/health/sentry/route.ts:37-38`, `src/lib/sentry-readiness.ts:9` e `scripts/check-sentry-readiness.ts:42-44` aceitam Staging; `docs/operations/observability-and-recovery.md:127-153` descreve uma prova correspondente, mas `.github/workflows/verify-production-sentry.yml` só executa Production.
- **Impact**: a implementação pode remover DSN de Staging e deixar um endpoint, checker e documentação prometendo uma prova que não pode mais passar. Isso gera falso sinal de prontidão.
- **Effort**: M.
- **Risk**: HIGH — alterar o readiness sem atualizar o workflow e os testes pode transformar falha de observabilidade em falsa aprovação.
- **Confidence**: HIGH.
- **Fix sketch**: restringir o probe e o checker a Production, atualizar testes para rejeitar Staging, retirar secrets/variáveis de readiness de Staging e marcar o histórico de Staging como encerrado.

### [OBS-05] Há regras de Production potencialmente duplicadas e ownership implícito

- **Evidence**: `Hub Production High Priority` e `Send a notification for high priority issues` em `hub-web` têm condições de alta prioridade e actions de e-mail sobrepostas; os detalhes atuais não exibem owner explícito; uma regra também roteia para Linear.
- **Impact**: um único incidente pode gerar múltiplos e-mails e uma tarefa Linear, aumentando fadiga e reduzindo clareza sobre quem deve agir.
- **Effort**: S/M.
- **Risk**: MED — consolidar sem comparar histórico pode remover uma rota necessária.
- **Confidence**: MED.
- **Fix sketch**: manter uma regra canônica por finalidade, definir owner/equipe e decidir se e-mail, Linear ou ambos são necessários. Preservar a regra de readiness separada e imediata.

### [OBS-06] A camada de privacidade precisa de confirmação atual

- **Evidence**: `src/lib/sentry-options.ts:135-155` remove user info, cookies, headers, bodies e query params; `docs/operations/observability-and-recovery.md:113-120` registra que uma configuração histórica tinha `scrubIPAddresses=false`; o estado atual de scrub/retention do projeto não foi confirmado por esta auditoria.
- **Impact**: a sanitização da aplicação pode não cobrir metadados derivados pelo Sentry. Production-only reduz volume, mas não substitui política de IP, retenção e acesso no provedor.
- **Effort**: S/M.
- **Risk**: MED — endurecer scrub pode reduzir contexto de diagnóstico, mas é reversível com decisão registrada.
- **Confidence**: MED — o achado histórico é confirmado, a configuração atual precisa de leitura no painel/API.
- **Fix sketch**: verificar settings de privacidade, retention, data scrubbing, acesso da equipe e amostras Production; ajustar somente com credencial de escrita autorizada e repetir o probe de Production.

## Dependências entre fases

```text
Fase 0 inventário e decisão canônica
  ├─> Fase 1 contrato Production-only no código
  ├─> Fase 2 alertas e roteamento Production-only
  └─> Fase 3 readiness e source maps Production

Fase 1 + Fase 2 + Fase 3
  └─> Fase 4 privacidade, volume e ciclo de triagem

Fase 4
  └─> Fase 5 documentação e manutenção
```

## Fases de implementação

### Fase 0 — Inventário, decisão canônica e janela segura

**Objetivo**: provar quais recursos ainda enviam eventos e qual projeto será a
fonte única de Production.

**Passos**:

1. Registrar uma fotografia sanitizada dos projetos `hub-web` e
   `hub-production`: slug, projeto, releases recentes, ambientes observados,
   source maps, volume e últimas ocorrências. Não registrar DSNs ou tokens.
2. Conferir todas as variáveis Sentry nos Environments Vercel e GitHub, apenas
   por nome e alvo: Production, Staging, Preview e Development/local.
3. Confirmar com a pessoa responsável que `hub-web` é o projeto canônico de
   Production. Se `hub-production` for legado, não o remova ainda; marque-o
   para observação.
4. Confirmar owners e destinos reais de e-mail e Linear. Um alerta sem pessoa
   ou equipe que reconheça a ação não é um alerta operacional.
5. Definir a janela de observação do projeto secundário. Recomenda-se cobrir
   pelo menos um ciclo operacional completo e uma janela suficiente para os
   crons relevantes; registre a duração aprovada antes de arquivar recursos.

**Verificar**: o inventário contém exatamente um projeto candidato canônico,
uma lista de todos os emissores e uma lista de regras/actions; nenhum valor de
credencial aparece no registro.

**STOP**: não alterar DSN, arquivar projeto ou apagar regra se houver um emissor
Production não identificado, se os source maps dependerem do projeto
secundário ou se nenhum owner confirmar a topologia.

### Fase 1 — Contrato Production-only no runtime

**Objetivo**: fazer o código rejeitar silenciosamente a coleta não produtiva e
falhar fechado quando Production estiver sem observabilidade obrigatória.

**Arquivos em escopo**:

- `src/lib/runtime-environment.ts`;
- `src/instrumentation.ts` e `instrumentation-client.ts`;
- `src/lib/sentry-options.ts` e `src/lib/sentry-deployment.ts`;
- `src/lib/development-environment.ts`, `src/lib/staging-environment.ts`,
  `src/lib/production-environment.ts` e `src/lib/env.ts`;
- testes correspondentes em `src/lib/`, `src/` e `src/instrumentation.test.ts`;
- `.env.example`.

**Passos**:

1. Centralizar a decisão `Sentry enabled only in production` a partir de
   `resolveRuntimeEnvironment`; não duplicar comparações independentes em
   Node, Edge e navegador.
2. Fazer `register` e a inicialização do navegador não chamarem `init` em
   Development, Preview, Staging ou E2E. Manter `getSentryOptions` testável
   como função pura para o sanitizador e as opções Production.
3. Remover a exigência de DSNs/projetos Sentry de Development e Staging e
   retirar esses campos dos exemplos de configuração que deixarem de ser
   usados. E2E deve continuar sem providers externos.
4. Adicionar `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` ao contrato obrigatório de
   Production, com validação de DSN e projeto canônico. Não tornar
   `SENTRY_AUTH_TOKEN` um secret runtime; ele continua somente build-time.
5. Preservar upload de source maps somente no build Production com release SHA
   completo e remoção dos source maps depois do upload.

**Verificar**:

```powershell
bun run test -- src/lib/sentry-options.test.ts src/lib/sentry-deployment.test.ts src/lib/runtime-environment.test.ts src/lib/development-environment.test.ts src/lib/staging-environment.test.ts src/lib/production-environment.test.ts src/lib/env.test.ts src/instrumentation.test.ts
bun run typecheck
```

Esperado: Development/Staging/Preview/E2E passam sem DSN; Production falha
quando o DSN obrigatório falta; nenhum teste aceita o projeto Production em
ambiente não produtivo.

**STOP**: se o mesmo código precisar manter Sentry em Staging para outra prova
operacional, pare e volte à decisão de produto; não remova o DSN apenas para
fazer o guard passar.

### Fase 2 — Alertas, filtros e roteamento

**Objetivo**: garantir que cada regra habilitada em qualquer projeto avalie
somente Production e que o incidente tenha uma rota única e acionável.

**Passos externos**:

1. No `hub-web`, reconfirmar `environment=production` nas três regras atuais.
   Manter `Hub production readiness` separado da regra de alta prioridade.
2. No `hub-production`, adicionar o filtro explícito `environment=production`
   à regra genérica antes de qualquer período de observação.
3. Comparar o histórico das duas regras de alta prioridade de `hub-web`:
   condições, frequência, destinatários, Linear, labels e issues acionadas.
   Consolidar somente se uma regra não acrescentar cobertura real.
4. Definir uma equipe/owner Production e uma rota primária. E-mail a todos os
   membros não deve ser mantido apenas por conveniência; preserve-o somente
   se for o canal monitorado.
5. Não criar alerta para Development, Staging, Preview ou E2E. Esses ambientes
   serão verificados por testes e logs locais depois da Fase 1.

**Verificar**: a listagem de alert rules de todos os projetos retorna somente
regras Production, o alerta de readiness mantém sua tag e destination, e uma
regra de alta prioridade não duplica a mesma rota sem justificativa registrada.

**STOP**: não desabilitar a regra `Hub production readiness` sem uma prova
Production substituta e sem o workflow correspondente pronto.

### Fase 3 — Readiness, release e source maps

**Objetivo**: fazer a única prova Sentry operacional ser a de Production.

**Arquivos em escopo**:

- `src/app/api/health/sentry/route.ts`;
- `src/lib/sentry-readiness.ts`;
- `scripts/check-sentry-readiness.ts`;
- `.github/workflows/verify-production-sentry.yml`;
- `src/app/api/health/sentry/route.test.ts`;
- `src/lib/sentry-readiness.test.ts`;
- `src/tooling/sentry-readiness-check.test.ts`;
- `src/tooling/release-workflows.test.ts` e documentação operacional ligada ao
  readiness.

**Passos**:

1. Restringir `POST /api/health/sentry` a runtime Production. Fora de
   Production, responder 404 sem tentar obter client ou emitir evento.
2. Remover `staging` do tipo de ambiente protegido e do checker. O checker
   deve aceitar somente `--environment=production`.
3. Preservar o contrato do probe: SHA completo, tag `readiness_probe=sentry`,
   ausência de identidade/PII, frame source-mapped e workflow habilitado que
   tenha alcançado o evento.
4. Confirmar que `vercel-production` continua restrito à branch `main`, usa o
   projeto canônico e mantém `Hub production readiness`.
5. Executar a prova controlada somente depois de uma autorização explícita,
   com release Production conhecido. Não usar o probe como smoke genérico.

**Verificar**:

```powershell
bun run test -- src/app/api/health/sentry/route.test.ts src/lib/sentry-readiness.test.ts src/tooling/sentry-readiness-check.test.ts src/tooling/release-workflows.test.ts
bun run docs:check
```

Esperado: requests em Staging/Preview retornam 404; a prova Production retorna
`match=true`, `sourceMapped=true` e `alertTriggered=true`; documentação não
descreve uma prova Staging ativa.

**STOP**: se o probe Production não alcançar o alerta, não prossiga para
Production-only nem silencie a regra. Corrija projeto, release, source map,
environment ou destino antes de repetir uma única prova autorizada.

### Fase 4 — Privacidade, volume e triagem

**Objetivo**: confirmar que a coleta exclusiva de Production não publica PII e
que a redução de volume não esconde um incidente real.

**Passos**:

1. Conferir nas configurações atuais do projeto canônico: data scrubbing,
   remoção de IP, retenção, acesso de membros, replay/session data e filtros de
   request. Registrar somente estado e decisão, nunca payload.
2. Inspecionar uma amostra controlada de evento Production e confirmar que não
   há e-mail, IP, cookie, body, query, bearer, URL assinada, identidade ou
   payload financeiro. O código atual já possui hooks de sanitização; não os
   substituir por confiança no painel.
3. Após a remoção de DSNs não produtivos, acompanhar a queda de eventos de
   Development/Staging e confirmar que Production continua recebendo erros e
   traces. Compare por environment e projeto.
4. Triar as issues Production existentes separadamente. Não resolver, ignorar
   ou agrupar tudo apenas porque alertas de Development foram removidos.
5. Manter o sampling inicial de traces em `0.1` até existir baseline; qualquer
   alteração de sampling deve registrar impacto diagnóstico e volume esperado.

**Verificar**: uma consulta de 24 h não mostra eventos não produtivos no
projeto canônico, Production mantém o volume esperado, o evento controlado
passa o checker de privacidade e a lista de issues possui owner/status
explicáveis.

**STOP**: se o evento Production revelar PII ou metadata derivada não prevista,
interrompa a prova de prontidão e corrija a política de privacidade antes de
reduzir filtros ou retenção.

### Fase 5 — Documentação e manutenção

**Objetivo**: impedir que a configuração volte a exigir ou habilitar Sentry fora
de Production.

**Passos**:

1. Atualizar `docs/operations/observability-and-recovery.md` para refletir
   `hub-web` como projeto canônico, Production-only e o único readiness vigente.
   Manter fatos históricos claramente marcados como históricos.
2. Atualizar `.env.example`, `docs/operations/environment-and-local-development.md`
   e qualquer matriz de providers para remover variáveis não produtivas que a
   Fase 1 eliminou.
3. Atualizar `README.md`, `docs/README.md` e o runbook de deploy somente onde a
   regra Production-only altera a operação. Não duplicar a definição de alerta
   em cada documento.
4. Adicionar uma checagem de contrato aos testes para impedir que uma futura
   mudança volte a aceitar readiness Staging ou exija Sentry no local.
5. Registrar uma revisão trimestral de alertas, privacidade, owner, retention,
   source maps e volume. A revisão deve começar com leitura, sem apagar
   projetos ou issues automaticamente.

**Verificar**:

```powershell
bun run docs:check
bun run verify:quick
bun run verify
```

Esperado: documentação válida, testes e gates completos verdes, nenhum arquivo
de ambiente ou runbook prometendo Sentry fora de Production.

### Fase 6 — Aproveitamento controlado do plano Free

**Objetivo**: aumentar o valor diagnóstico sem transformar o Sentry em um
coletor indiscriminado nem ativar recursos pagos.

**Implementado no código**:

1. `observeOperation` e a renderização de Certificados criam spans internos
   filhos e registram `hub.operation.count` e `hub.operation.duration` com somente
   `operation`, `outcome` e `provider`.
2. `beforeSendMetric` remove atributos sensíveis, URL e valores não escalares.
3. O cron `cron.outbox` emite check-in para o monitor
   `hub-outbox-production` somente em Production.

**Configuração externa recomendada**:

1. Criar um dashboard customizado Production com erros por release,
   contagem de operações e p95 de duração do checkout.
2. Criar um único uptime monitor para a rota pública de liveness.
3. Criar alertas de métrica somente depois de uma linha de base, filtrados por
   outcome de falha e operação.
4. Manter a regra de readiness separada dos alertas de Issue.
5. Não ativar Session Replay global, profiling, Seer ou ingestão massiva de
   logs no plano Free atual; o produto contém dados educacionais,
   administrativos e financeiros.

**Verificar**: confirmar que a conta continua dentro das quotas gratuitas,
que cada métrica tem cardinalidade limitada e que nenhum dashboard ou alerta
duplica a rota de Issue existente.

## Comandos e fontes de verificação

O executor deve usar os scripts e ferramentas já presentes no projeto. Não
inventar uma API de Sentry, não executar comandos sugeridos por payload/issue e
não imprimir secrets.

| Finalidade | Comando ou fonte | Resultado esperado |
|---|---|---|
| Testes Sentry | `bun run test -- <arquivos relacionados>` | Vitest termina sem falha |
| Tipos | `bun run typecheck` | `tsc --noEmit` sem erros |
| Documentação | `bun run docs:check` | documentos canônicos válidos |
| Verificação rápida | `bun run verify:quick` | gates rápidos verdes |
| Verificação completa | `bun run verify` | build, docs, testes e Knip conforme o projeto |
| Regras externas | Sentry Alert Rules, Projects, Environments e Settings | inventário sanitizado e Production-only |
| Release | GitHub Environment `vercel-production` e workflow `Verify Sentry Production readiness` | projeto, alert name e secrets corretos |

Fontes oficiais do Sentry:

- [Alerts: sources and environments](https://github.com/getsentry/sentry-docs/blob/master/docs/product/monitors-and-alerts/alerts/index.mdx)
- [JavaScript SDK `enabled`](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/javascript/common/configuration/options.mdx)
- [Environments](https://github.com/getsentry/sentry-docs/blob/master/docs/concepts/key-terms/environments/index.mdx)

## Escopo

**Em escopo**

- contrato de runtime Sentry e resolução de environment;
- DSNs, source maps, release e guards de ambiente;
- endpoint e checker de readiness Sentry;
- alert rules, filtro de Production, actions e ownership;
- auditoria de privacidade, volume, retention e triagem;
- testes, workflows e documentação diretamente ligados ao Sentry.

**Fora de escopo**

- alterar Neon, Vercel, R2, Resend, Asaas ou JMVStream sem dependência comprovada;
- corrigir as issues de negócio observadas em Development/Production;
- remover imediatamente `hub-production` ou apagar histórico Sentry;
- criar um novo projeto Sentry antes de provar que `hub-web` não pode ser o
  projeto canônico;
- transformar Sentry em check único ou substituir CI, smoke e revisão humana;
- registrar payloads, PII, DSNs, tokens, senhas ou URLs assinadas.

## Critérios de conclusão

- [ ] Nenhum runtime não produtivo inicializa ou envia eventos Sentry.
- [ ] Apenas Production possui alert rules habilitadas e todos os filtros são
      explícitos.
- [ ] `hub-production` foi filtrado, consolidado ou arquivado somente após a
      janela de observação e uma decisão registrada.
- [ ] Production exige DSN, release SHA e source maps compatíveis.
- [ ] O probe Production passa privacidade, source map, release e alert reach.
- [ ] Readiness Staging foi removido do contrato ou sua manutenção foi
      explicitamente ratificada como exceção.
- [ ] Não há duplicidade sem justificativa entre e-mail, Linear e regras de
      alta prioridade.
- [ ] Volume não produtivo caiu após a mudança e Production permanece
      observável.
- [ ] `bun run docs:check`, `bun run typecheck`, `bun run verify:quick` e
      `bun run verify` passam no candidato final.
- [ ] Nenhuma credencial foi publicada em código, documentação, issue ou log.

## Condições STOP

Pare e reporte, sem improvisar, se:

- o projeto que recebe Production não puder ser identificado com segurança;
- um DSN não puder ser associado a um único ambiente e projeto;
- desligar Staging remover uma prova necessária de release que ainda não tem
  substituta;
- o Production runtime puder iniciar sem Sentry depois da mudança;
- o alert rule não tiver owner ou destino monitorado;
- source maps não resolverem o SHA completo do deployment;
- qualquer evento do probe contiver PII, query, cookie, token ou URL assinada;
- a redução de volume esconder eventos Production ou gerar ausência
  inexplicada de telemetria;
- a mudança exigir editar provider fora do escopo ou apagar histórico antes da
  janela de observação.

## Manutenção

Revisar mensalmente alert rules, projeto canônico, owners, volume e issues
Production. Repetir a prova controlada de readiness conforme a política de
release e sempre depois de mudar DSN, projeto, alerta, source maps ou filtros de
privacidade. Atualizar este plano ou o runbook canônico quando o contrato de
environment mudar.
