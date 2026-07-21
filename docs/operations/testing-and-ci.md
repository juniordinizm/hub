---
status: runbook
owner: engineering
last_verified_commit: 2df4996ac4875bf48f425a7e3456f3c8ac1fc3aa
---

# Testes e CI

## Objetivo e ordem dos gates

O workflow versionado em `.github/workflows/ci.yml` executa, nesta ordem:

1. instalação imutável com Bun;
2. `docs:check`;
3. integridade das migrations;
4. typecheck;
5. check de estilo;
6. testes unitários, de componente, contrato e rota;
7. integração PostgreSQL;
8. jornadas Chromium;
9. build;
10. Knip.

`quality` contém os gates sem banco e roda em todo push e pull request. `integration-db` e
`e2e` só executam para branches internas ou push: o GitHub não fornece secrets a pull requests
de forks. Essa restrição é intencional; os gates que exigem Neon não devem receber segredos de
contribuidores externos. As duas jobs partem de `quality` e executam em paralelo, cada uma com sua
própria branch Neon; `build-and-knip` só inicia após as duas terminarem.

`quality` usa `fetch-depth: 0`: `docs:check` confirma que cada
`last_verified_commit` ainda existe no histórico. O checkout raso padrão do GitHub Actions traz
apenas o commit atual e produziria um falso erro para documentos verificados em commits anteriores.

## Banco efêmero da CI

As jobs que precisam de Postgres criam branches distintas no projeto Neon exclusivo de CI. Cada
branch recebe expiração de 24 horas e é removida em um passo `always()`. A expiração é a contenção
para cancelamentos que interrompam o runner antes do cleanup explícito.

Antes da primeira execução remota, configure no repositório GitHub:

- secret `NEON_API_KEY`: chave de API limitada ao projeto/organização de CI;
- variable `NEON_PROJECT_ID`: ID do projeto Neon dedicado de CI.

Não use o projeto Neon de produção, sua URL de conexão ou uma chave com escopo de produção.
O workflow nunca escreve URLs em logs. `create-branch-action` retorna URLs apenas como outputs
mascarados, usadas para `db:migrate`, integração e E2E.

### Paridade de ambiente

O projeto dedicado `protear-ci-pg18` usa PostgreSQL 18 em `sa-east-1`, alinhado ao projeto
`protear`. `NEON_PROJECT_ID` deve apontar para esse projeto dedicado, nunca para produção nem
para o antigo projeto de CI em PostgreSQL 17.

## E2E

`bun run test:e2e` inicia a aplicação em `127.0.0.1:3100`, sem abrir navegador visual, e roda
Chromium em modo headless. Localmente, o Playwright inicia `next dev`; em CI, compila e inicia
`next start`, evitando HMR e verificando a aplicação de produção. A configuração está em
`playwright.config.ts`.

O setup `tests/e2e/global-setup.ts` executa `bun run test:e2e:seed`, que carrega `seedE2e` em
`scripts/seed-e2e.ts` com a condição `react-server`. Ele só funciona com `E2E_TEST_MODE=true` e
`DATABASE_URL`; cria contas pela API real `getAuth().api.signUpEmail`,
atribui papel no perfil e gera Concessão manual seguida da projeção de Matrícula. Não usa o endpoint
de bootstrap, cookie forjado nem bypass de autorização.

As jornadas atuais verificam:

- login e recuperação sem enumeração de Conta;
- acesso da Aluna com Concessão e negação sem Concessão;
- bloqueio de sequência, conclusão persistida e avanço;
- fronteira Admin/Aluna;
- erro seguro de checkout sem provedor configurado;
- certificado público válido e revogado;
- foco de teclado no formulário e navegação da sidebar.

A negação sem Concessão retorna `404` no comportamento implementado, em vez de revelar a Aula.
O teste protege a impossibilidade de obter o material, não presume um `403` inexistente.

Como todas as jornadas Chromium saem do mesmo IP do runner, `E2E_TEST_MODE=true` eleva apenas o
limite de `POST /sign-in/email` para 20 tentativas por 10 segundos. O modo exige `CI=true`, usa a
branch Neon efêmera e não altera o limite padrão do Better Auth em deploys.

## Inventário dos testes que inspecionam fonte

Testes estáticos são permitidos apenas para contratos que o runtime não expõe com segurança:

- **contrato estático legítimo:** SQL, migrations, configurações de provedor, `next.config.ts` e
  componentes cuja estrutura é o contrato de integração;
- **candidato a teste comportamental:** componentes e páginas que verificam texto, renderização,
  teclado ou navegação;
- **remover:** inspeções duplicadas de texto quando um teste de componente ou E2E já cobre o
  resultado observável.

O antigo `page-source.test.ts` de Aula foi removido: procurava uma string no arquivo de página.
`LessonVideoProcessing`, em `src/components/lesson-video-processing.test.tsx`, agora verifica o
estado renderizado e seus dois caminhos de atualização. A revisão trimestral deve reduzir os demais
candidatos a teste comportamental, nunca trocar uma regressão por uma string no source.

| Arquivo remanescente | Classificação | Próxima decisão |
|---|---|---|
| `duration-authority-source.test.ts` | candidato comportamental | mover a fronteira Aluna/Admin para teste de action/rota |
| `route-source.test.ts` do cron JMVStream | contrato estático temporário | criar teste de rota com Bearer válido e inválido |
| `auth-shell-source.test.ts` | candidato comportamental | cobrir shell nas jornadas de autenticação |
| `jmvstream-upload-panel-source.test.ts` | candidato comportamental | migrar estados para teste de componente com mocks do adaptador |
| `lesson-kind-controls-source.test.ts` | candidato comportamental | cobrir callback de player em teste de componente |
| `panel-layout-source.test.ts` | remover ou comportamento | decidir se a ausência de notificações ainda é requisito de produto |

## Propriedade por risco

| Risco | Evidência principal |
|---|---|
| Identidade e RBAC | `auth-policy.test.ts`, `trusted-origins.test.ts`, E2E login/Admin |
| Pagamento e webhook | `abacatepay*.test.ts`, `public-checkout.test.ts`, E2E checkout seguro |
| Concessão e Matrícula | `enrollments/rules.test.ts`, `server-sql.test.ts`, E2E acesso |
| Progresso e conclusão | `progress/rules.test.ts`, integração de certificado, E2E sequência/conclusão |
| Certificado | `certificates/rules.test.ts`, integração concorrente, E2E público |
| Efeitos transacionais | `outbox/*.test.ts`, integração PostgreSQL de locks e emissão de certificado |
| Privacidade | testes de ações de Admin e guia de direitos de dados |
| Storage e mídia | testes R2/JMVStream e contratos de upload |
| Páginas críticas | jornadas Chromium de login, painel, Aula, checkout e certificado |

Não introduza `.only` ou `.skip`. Testes de integração ficam fora da suíte unitária por configuração,
rodam serialmente porque limpam tabelas da mesma branch descartável, e falham cedo sem sua URL;
as jobs Neon sempre fornecem a variável exigida. Em CI,
Playwright permite uma repetição diagnóstica, registra resultados/duração/retries em JSON e falha o
job se qualquer retry ocorreu. Assim, flakiness não fica verde silenciosamente. O relatório é anexado
em toda execução para permitir acompanhar duração e estabilidade.

`knip.jsonc` inclui uma baseline explícita para arquivos e exports já desconectados por rotas ou
ações dinâmicas do Next.js. Ela existe para que `bun run knip` bloqueie novos achados sem apagar
comportamento fora deste plano. Cada item da baseline deve ser removido quando ganhar consumidor
estático ou quando a capacidade for retirada deliberadamente.

## Build sem deploy

`next build` executa a validação de ambiente como produção. A job `build-and-knip` portanto fornece
um segredo-placeholder e URLs `https://ci-build.invalid` somente para compilar; não fornece banco,
provedores ou credenciais reais e não produz artefato para deploy. Um deploy continua exigindo as
variáveis reais do ambiente alvo, conforme o [runbook de deploy](deploy-and-incidents.md).

## Verificação local

Para unitários e qualidade:

```bash
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run check
bun run test
bun run build
bun run knip
```

E2E e integração requerem uma branch Neon ou banco descartável já migrado, nunca um banco
compartilhado. A CI é o caminho recomendado até existir um procedimento local isolado equivalente.
