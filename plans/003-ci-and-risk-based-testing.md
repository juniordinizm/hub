# Plan 003: Criar CI e testes orientados às jornadas críticas

> **Instruções ao executor**: não use contagem de testes ou cobertura percentual como
> meta principal. Proteja invariantes e jornadas observáveis.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- package.json vitest.config.ts lefthook.yml .github src scripts`

## Status

- **Prioridade**: P0
- **Esforço**: L
- **Risco**: MED
- **Depende de**: `001-database-evolution-and-safe-tooling.md`
- **Categoria**: tests, dx
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

O Hub possui 73 arquivos de teste, mas 28 verificam strings no código-fonte, não
comportamento. Não há CI, browser test, teste de teclado/acessibilidade ou Postgres
efêmero. A falha atual de teste é exatamente um falso alarme causado por mover texto
para um componente.

## Estado atual

- `vitest.config.ts`: somente `src/**/*.test.ts(x)`, ambiente `node`.
- `lefthook.yml`: formata arquivos staged; não roda testes/typecheck.
- `.github/`: inexistente.
- `package.json`: sem Playwright/Cypress.
- teste atual falhando:
  `src/app/(student)/app/aulas/[lessonId]/page-source.test.ts`.
- `bun run knip` encontra arquivos/actions de certificado e privacidade sem consumidor.
- referências:
  - LearnHouse documenta camadas, mas não tem specs E2E commitadas;
  - Frappe tem muitos scaffolds sem assertion;
  - CourseLit tem volume, mas nenhum workflow no snapshot.

## Escopo

**Em escopo**

- `.github/workflows/`;
- configs e scripts de teste;
- dependência de browser test escolhida;
- testes sob `src/` e `tests/`;
- fixtures/factories sem dados reais;
- documentação mínima do mapa de testes.

**Fora de escopo**

- perseguir 100% de cobertura;
- snapshots visuais frágeis;
- rodar E2E contra produção;
- mascarar suites lentas com `.skip`;
- corrigir todos os achados de produto no mesmo PR.

## Estratégia de camadas

1. **unit**: regras puras de duração, progressão, precedência e autorização;
2. **integration-db**: transactions, constraints, webhooks, grants, certificado;
3. **component**: estados, semântica, teclado e erros;
4. **route/server action**: validação, autenticação, resposta pública segura;
5. **E2E**: poucas jornadas críticas em navegador;
6. **contract**: adaptadores de AbacatePay, JMVStream, R2 e Resend com fixtures.

## Passos

### 1. Corrigir o baseline sem esconder a regressão

Substituir o teste que procura `"Video em processamento"` no arquivo de página por
um teste do componente/estado renderizado. Inventariar os 28 source-inspection tests
e classificar: contrato estático legítimo, candidato a behavior test ou remover.

**Verificar**: `bun run test` passa e a mesma regressão de UI ainda seria detectada.

### 2. Adicionar Postgres efêmero

Consumir o comando do plano 001. Em CI, criar branch/database isolado, migrar, rodar
integration tests e excluir sempre, inclusive em cancelamento.

Referência oficial Neon:
https://neon.com/docs/guides/branching-ci

**Verificar**: duas jobs paralelas não compartilham estado; cleanup não deixa branch.

### 3. Adicionar E2E mínimo

Usar Playwright com Chromium inicialmente. Cobrir:

- login e recuperação sem revelar existência de conta;
- aluna com grant acessa primeira aula;
- aluna sem grant não acessa material;
- sequência bloqueia aula futura;
- conclusão avança e persiste;
- admin autorizado entra; aluna recebe 403/redirect;
- checkout público trata erro sem detalhe interno;
- certificado público válido e revogado;
- teclado percorre player/sidebar/formulários principais.

**Verificar**: `bun run test:e2e` passa headless em ambiente efêmero.

### 4. Criar workflow obrigatório

Jobs, na ordem de feedback:

1. `bun install --frozen-lockfile`;
2. `bun run docs:check`;
3. `bun run db:migrations:check`;
4. `bun run typecheck`;
5. `bun run check`;
6. `bun run test`;
7. integration-db;
8. E2E;
9. `bun run build`;
10. `bun run knip`.

Separar jobs quando isso reduzir tempo sem esconder dependências.

**Verificar**: PR de teste com falha proposital em cada gate bloqueia merge.

### 5. Definir ownership por risco

Documentar quais suites protegem:

- identidade/RBAC;
- dinheiro/webhook/refund;
- grant/enrollment;
- progressão/conclusão;
- certificado;
- privacidade;
- storage/media;
- páginas críticas.

Não aceitar um domínio crítico sem pelo menos um teste comportamental e um de falha.

## Critérios de pronto

- [ ] workflow versionado executa todos os gates;
- [ ] Postgres isolado por job;
- [ ] ao menos oito jornadas E2E críticas;
- [ ] nenhum teste crítico depende apenas de string-fonte;
- [ ] teste concorrente de certificado existe;
- [ ] nenhum `.only` ou `.skip`;
- [ ] build e knip são gates, não relatórios ignorados;
- [ ] tempo e flakiness são medidos.

## Condições STOP

- migration baseline não está reparado;
- CI exigiria credencial de produção;
- provider externo real seria chamado por teste;
- E2E só passa com bypass de autorização;
- runner não consegue cleanup seguro do banco efêmero.

## Manutenção

Revisar trimestralmente source-inspection tests, skips, duração e flaky retries.
Retry pode confirmar flakiness, nunca tornar o gate verde silenciosamente.

