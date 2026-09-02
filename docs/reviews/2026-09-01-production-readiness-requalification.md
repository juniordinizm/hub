---
status: accepted
owner: engineering
last_verified_commit: a3b0e20ed663e455ecdc5367310592b3d073d6f6
audit_date: 2026-09-01
---

# Requalificação de Production Readiness — 2026-09-01

## Decisão

**Estado: AMARELO.** Production continua ativa e funcional, mas não há base
para declarar uma nova promoção como plenamente `READY`. O deployment servido e
o smoke pós-promoção foram comprovados no checkpoint de 2026-08-30. A prova
própria do Sentry em Production e a observação DMARC continuam pendentes; MFA
administrativo foi retirado do escopo do produto e não é um gate operacional.

Este documento atualiza a leitura dos findings `EXT-001` a `EXT-013` do parecer
externo recebido. Ele não altera a decisão histórica de auditorias anteriores,
não autoriza deploy, migration, cobrança, alteração de DNS ou rotação de
credenciais.

## Base verificada

- branch local: `staging`;
- SHA-base da árvore: `a3b0e20`;
- deployment Production documentado: `e5db6a16b804d1b418e257ef786fc1e06443afc5`;
- Production documentada como servida pelo deployment
  `dpl_5JkmcWBFrRbYUExi6MexjtUtYQAg`;
- working tree original com alteração não relacionada em `skills-lock.json`,
  preservada fora desta implementação.

O estado de deployment continua separado do estado de prontidão em
`docs/operations/release-state.md`. Production estar no ar não equivale a todos
os gates externos estarem verdes.

## Reclassificação dos findings

| Finding | Estado atual | Decisão |
|---|---|---|
| `EXT-001` | fechado operacionalmente | O workflow testa o deployment não promovido e verifica o alias depois da promoção. |
| `EXT-002` | fechado como blocker crítico | O smoke público distingue manutenção de checkout público e webhook protegido. |
| `EXT-003` | implementação local fechada; prova Production pendente | Release e source maps estão configurados, mas falta emitir e verificar o evento próprio de Production. |
| `EXT-004` | precisa de evidência atual | Os workflows usam Bun `1.3.11`; a versão externa `1.3.14` do parecer não foi reproduzida. |
| `EXT-005` | corrigido nesta implementação | O guia agora documenta `release_sha`, confirmação e a ordem dos gates reais. |
| `EXT-006` | dividido | Restore, PITR, RPO e RTO têm evidência; alerting de Production ainda precisa de prova. |
| `EXT-007` | fechado | O ruleset `protect-release-branches` protege `main` e `staging`. |
| `EXT-008` | hardening pendente | O projeto exige Node `24.x`; o ambiente local observado usa Node `22.20.0`. |
| `EXT-009` | evidência de caixa pendente | DNS e Resend têm sinais positivos, mas ainda falta mensagem recebida com headers SPF/DKIM/DMARC verificados. |
| `EXT-010` | não é finding | Deve permanecer somente na seção de evidências positivas. |
| `EXT-011` | hardening implementado localmente | A suíte unitária agora começa e termina cada teste em ambiente sem configuração da aplicação herdada. |
| `EXT-012` | sem ação | `.env.local` está ignorado, não rastreado e sem entrada no histórico consultado. |
| `EXT-013` | fechado no código atual | Solicitações de suporte usam lock transacional, rate limit e intenção durável na outbox. |

## Pendências fora da lista original

MFA administrativo foi explicitamente retirado do escopo. A implementação ativa,
as páginas e a flag de enforcement foram removidas; as estruturas históricas da
migration `0065` permanecem somente para evitar uma remoção destrutiva no banco.
Não há gate de login, backup code ou configuração de autenticador a executar.

O par `RESTORE_R2_*` precisa ser substituído por uma credencial dedicada somente
leitura após a janela operacional. A rotação exige acesso ao provider e não é
simulada por código ou documentação.

Durante a verificação desta requalificação, `bun audit --production` encontrou
dois avisos `HIGH` em `browserslist@4.28.2`, dependência transitiva alcançável
por Sentry e Shadcn. O pacote foi fixado em `4.28.8` por override explícito e o
audit foi repetido com resultado sem vulnerabilidades. Esse finding não veio do
parecer original e fica registrado para impedir que seja perdido na comparação
histórica.

## Implementação das sprints

### Sprint 0 — Requalificação

Concluída nesta revisão. O parecer recebeu uma base temporal, uma classificação
por estado e uma decisão que separa Production funcional de Production Readiness.

### Sprint 1 — Release e documentação

Implementada localmente:

- guia reconciliado com as entradas reais do workflow;
- `release_sha` exige o SHA atual de `origin/main` no fluxo normal;
- rollback de aplicação continua separado do workflow de migration;
- teste de contrato cobre inputs, promoção, smoke público e verificação final.

### Sprint 2 — Sentry e observabilidade

Implementada localmente:

- workflow manual `Verify Sentry Production readiness`;
- confirmação literal obrigatória;
- emissão de um único evento controlado no domínio canônico;
- checker exige release, ambiente, source map, privacidade e alerta.

A emissão real continua pendente de autorização operacional e de secrets
configurados no Environment correto.

### Sprint 3 — E-mail e DMARC

O parser e o comando de análise DMARC já existem. A prova final continua
pendente da janela de observação, dos relatórios agregados e de uma mensagem
controlada recebida em caixa autorizada. Não houve alteração automática de DNS.

### Sprint 4 — Testes e toolchain

Implementada localmente:

- `tests/setup.ts` remove configuração da aplicação herdada do processo;
- `src/testing/hermetic-environment.ts` preserva o ambiente de ferramentas e
  elimina variáveis de aplicação;
- testes de contrato comprovam a política;
- `browserslist` foi fixado em `4.28.8` após o audit encontrar dois avisos HIGH;
- `bun audit --production` passou depois da atualização do lockfile;
- a suíte unitária permanece verde após a mudança.

O alinhamento local de Bun e Node permanece hardening: o CI versionado usa Bun
`1.3.11`, enquanto a máquina desta execução usa Bun `1.4.0` e Node `22.20.0`.

### Sprint 5 — Recuperação operacional

A evidência de restore/PITR/RPO/RTO já existe no runbook. A rotação da credencial
R2 continua aguardando ação humana no provider. MFA administrativo não faz parte
do produto atual.

### Sprint 6 — Requalificação final

Ainda não concluída. Depende da prova Sentry Production, da observação DMARC, da
rotação da credencial R2, da CI/integração/E2E no SHA candidato e dos demais
gates externos aplicáveis. Não deve
ser emitido `GO` somente porque os testes locais passaram.

## Verificações locais

Executadas na árvore isolada:

```text
bun run test
351 arquivos, 2414 testes aprovados

bun run test -- src/tooling/release-workflows.test.ts src/vercel-deployment-contract.test.ts
20 testes aprovados

bun run docs:check
Documentação válida
```

Os gates de integração PostgreSQL, E2E, build completo, Knip, DNS, Sentry
Production e DMARC não são marcados como aprovados por esta execução local.
