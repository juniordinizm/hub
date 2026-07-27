---
status: runbook
owner: engineering
last_verified_commit: 72600abe9f85e945b15b6d81db5fb259bff22d7e
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
10. Knip;
11. auditoria das dependências de produção;
12. build remoto, deploy e smoke autenticado de um candidato Vercel Preview;
13. habilitação dos workflows manuais de migration Development e deploy
    Production para o SHA verde da `main`.

`quality` contém os gates sem banco e roda em todo push e pull request. `integration-db` e
`e2e` só executam para branches internas ou push: o GitHub não fornece secrets a pull requests
de forks. Essa restrição é intencional; os gates que exigem Neon não devem receber segredos de
contribuidores externos. As duas jobs partem de `quality` e executam em paralelo, cada uma com sua
própria branch Neon; `build-and-knip` só inicia após as duas terminarem e
`vercel-preview` só inicia depois de todos esses gates.

O deployment Preview é deliberadamente um smoke de infraestrutura: usa a
branch Neon sanitizada, valida build/runtime e executa somente readiness
autenticada. Não recebe R2, Resend, AbacatePay ou JMVStream e não substitui as
jornadas funcionais do Playwright. A validação do ambiente bloqueia o
deployment se credenciais desses providers ou jobs habilitados aparecerem em
Preview. O contrato exige `VERCEL_BRANCH_URL` ou `VERCEL_URL`: o primeiro é
preferido quando existe alias de branch; o segundo é o hostname disponível nos
deployments criados pela CLI. Ambos continuam protegidos, e somente a CI recebe
o bypass de automação.

A branch persistente `vercel-preview` não recebe migrations de Pull Request.
Mudanças de schema são comprovadas por `integration-db` e `e2e`, cada uma em
branch Neon descartável já migrada. O Preview visual só representa jornadas que
continuam compatíveis com o schema persistente; uma validação manual dependente
do schema novo exige branch Neon temporária.

Pull requests do Dependabot também não recebem os Actions secrets normais e
podem alterar justamente o código de uma action de terceiros. Por isso,
`integration-db` e `e2e` são explicitamente ignoradas quando
`github.actor == 'dependabot[bot]'`; os gates sem provider continuam rodando e
as integrações completas são obrigatoriamente exercitadas no push confiável
após o merge. Não copie `NEON_API_KEY` para Dependabot secrets apenas para
forçar essas jobs.

`quality` usa `fetch-depth: 0`: `docs:check` confirma que cada
`last_verified_commit` ainda existe no histórico. O checkout raso padrão do GitHub Actions traz
apenas o commit atual e produziria um falso erro para documentos verificados em commits anteriores.
Todas as actions são fixadas em commit imutável. O Dependabot propõe
atualizações semanais do ecossistema `github-actions`; cada mudança de SHA
continua passando pelos mesmos gates.

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

Antes de rodar integração ou E2E, cada job tenta `db:migrate` até cinco vezes,
com espera limitada entre tentativas. A criação de uma branch não garante que o
compute Neon esteja imediatamente pronto para aceitar a primeira conexão. A
quinta falha preserva o erro do migrador e bloqueia os gates seguintes.

### Paridade de ambiente

O projeto `damp-snow-22911188` usa PostgreSQL 18 em `sa-east-1`. Sua branch
`production` (`br-dark-boat-ac5ju6m4`) é o banco definitivo da aplicação. As
jobs usam somente `NEON_PROJECT_ID` e a chave project-scoped `NEON_API_KEY`
configurados no GitHub; elas não recebem uma URL persistente. Cada job cria uma
branch temporária isolada a partir de `production` e deve removê-la ao terminar.
Nenhuma etapa de CI pode executar migrations, integração ou E2E diretamente na
branch `production`.

## E2E

`bun run test:e2e` inicia a aplicação em `127.0.0.1:3100`, sem abrir navegador visual, e roda
Chromium em modo headless. Localmente, o Playwright inicia `next dev`; em CI, compila e inicia
`next start`, evitando HMR e verificando a aplicação de produção. A configuração está em
`playwright.config.ts`. O processo web recebe somente a URL pooled da branch
efêmera; a URL direta fica restrita à etapa anterior de migration. O bypass das
credenciais de providers existe somente para esse runtime CI em loopback.
E-mails transacionais são absorvidos nesse modo e nunca chegam ao Resend.

Em CI, `scripts/e2e-next-server.ts` replica stdout/stderr do build e do processo Next para
`test-results/next-server.log`. O arquivo vai junto ao artefato privado do Playwright inclusive
quando a aplicação retorna uma boundary genérica ao navegador; ele é a fonte para diagnosticar
o erro original sem revelar detalhes na interface da Aluna.

O setup `tests/e2e/global-setup.ts` executa `bun run test:e2e:seed`, que carrega `seedE2e` em
`scripts/seed-e2e.ts` com a condição `react-server`. Ele só funciona com `E2E_TEST_MODE=true` e
`DATABASE_URL`; para escrever o PDF fixture no R2, também exige `E2E_R2_BUCKET_NAME` explicitamente
configurado e exatamente igual a `R2_BUCKET_NAME`. Ele cria contas pela API real `getAuth().api.signUpEmail`,
atribui papel no perfil e gera Concessão manual seguida da projeção de Matrícula. Não usa o endpoint
de bootstrap, cookie forjado nem bypass de autorização.

O `globalTeardown` executa mesmo após falha de jornada e remove apenas o PDF fixture e as artes de
template encontradas pelos IDs de Curso daquela execução. As chaves são validadas contra o prefixo
único E2E/Curso antes do delete. O Playwright inicia um endpoint S3 compatível em loopback e força
`R2_ENDPOINT`, credenciais e bucket exclusivos de E2E; o override é rejeitado fora de
`E2E_TEST_MODE=true` e para hosts que não sejam loopback. Assim, os testes exercitam upload,
presign, redirect, download e exclusão sem credenciais Cloudflare ou risco ao bucket de produção.

As jornadas atuais verificam:

- login e recuperação sem enumeração de Conta;
- acesso da Aluna com Concessão e negação sem Concessão;
- bloqueio de sequência, conclusão persistida e avanço;
- fronteira Admin/Aluna;
- erro seguro de checkout sem provedor configurado;
- certificado público válido e revogado;
- foco de teclado no formulário e navegação da sidebar;
- alertas seguros para falha simulada de leitura, material R2 indisponível e
  o índice de Aula expansível no mobile;
- acesso expirado e acesso revogado, com ação de renovação ou suporte;
- axe-core sem violações `critical` ou `serious` na Biblioteca e Aula da Aluna.

A negação sem Concessão renderiza a página segura “Página indisponível”, sem revelar a Aula nem
seu material. O teste protege esse resultado visível; o status HTTP de um `notFound()` renderizado
por streaming não é o contrato de autorização da jornada.

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

A rota de falha da Aula usada pela jornada existe somente quando `E2E_TEST_MODE=true`; ela não
aceita esse atalho em deploy normal. O teste valida o boundary da Aluna, não substitui uma
indisponibilidade real de Neon, JMVStream ou R2. Confirme esses provedores no ambiente antes de
uma promoção que altere suas integrações.

## Baseline da experiência da Aluna

Cada item abaixo descreve uma jornada, seu impacto se regredir, como reproduzir e a evidência que
define a aceitação. A revisão é feita em viewport desktop, mobile e teclado quando a superfície tem
interação.

| Jornada | Impacto e reprodução | Aceitação e evidência |
| --- | --- | --- |
| Primeiro acesso e recuperação | Alto: autenticar uma Conta com Concessão e solicitar recuperação para Conta existente/inexistente. | Redireciona à Biblioteca e não enumera Conta. `critical-journeys.spec.ts`. |
| Continuar e retomar vídeo | Alto: fechar e reabrir Aula com posição persistida. | O salto JMVStream é enviado após sync e sua resposta não grava progresso. `lesson-video-player.test.tsx`. |
| Vídeo processando ou falho | Médio: ativo JMVStream sem player, com e sem estado `failed`. | Processing atualiza; falha interrompe polling e oferece suporte. `lesson-video-processing.test.tsx`. |
| Material indisponível | Alto: R2 falha no HEAD antes da URL assinada. | Retorna à Aula com alerta recuperável, sem erro de provedor. `download/route.test.ts`. |
| Sequência bloqueada | Alto: abrir a segunda Aula antes da primeira. | Índice explica o bloqueio e a página segura não expõe conteúdo. `critical-journeys.spec.ts`. |
| Acesso expirado ou revogado | Alto: entrar com projeção `expired` ou `revoked`. | Dashboard informa o estado e oferece renovação ou suporte. `critical-journeys.spec.ts`. |
| Concluir e avançar | Alto: concluir a primeira Aula. | Progresso persiste e a próxima Aula é aberta. `critical-journeys.spec.ts`. |
| Comentário e resposta | Médio: criar comentário, responder e moderar. | Ações autorizadas, limites e visibilidade são validados em `src/features/comments/actions.test.ts` e `server-sql.test.ts`. |
| Certificado | Alto: consultar código válido e revogado. | Estado público é distinto e não expõe dados internos. `critical-journeys.spec.ts`. |

`knip.jsonc` inclui uma baseline explícita para arquivos e exports já desconectados por rotas ou
ações dinâmicas do Next.js. Ela existe para que `bun run knip` bloqueie novos achados sem apagar
comportamento fora deste plano. Cada item da baseline deve ser removido quando ganhar consumidor
estático ou quando a capacidade for retirada deliberadamente.

## Build sem deploy

`next build` executa a validação de ambiente como produção. A job `build-and-knip` portanto fornece
um segredo-placeholder e URLs `https://ci-build.invalid` somente para compilar; não fornece banco,
provedores ou credenciais reais e não produz artefato para deploy. Um deploy continua exigindo as
variáveis reais do ambiente alvo, conforme o [runbook de deploy](deploy-and-incidents.md).

Depois desses gates, `vercel-preview` solicita à Vercel um build remoto, publica
um candidato isolado e executa `vercel curl /api/health/ready` com autenticação.
O ambiente `vercel-preview` do GitHub fornece token, IDs do projeto e uma cópia
do `HEALTHCHECK_SECRET`; as demais variáveis de runtime ficam na Vercel.

Uma CI verde na `main` habilita, mas não aciona, o workflow separado de
produção. A proprietária o executa manualmente somente com a confirmação de
Production. O job deriva o SHA do checkout da `main`, prova que ele ainda é o
`origin/main` atual e possui CI verde, usa o GitHub Environment
`vercel-production`, aplica e audita as
migrations com `DATABASE_URL_DIRECT`, solicita um build Production remoto sem
promoção de domínio, executa o smoke de readiness nesse deployment isolado e só
então o promove. O grupo de concorrência não cancela uma migration em andamento.
Deploy Git automático da Vercel deve ficar desligado para não duplicar esse
pipeline.

Quando a `main` contém migration nova, o workflow manual
`Migrate Neon development` deriva e valida o mesmo SHA verde, usa o Environment
`neon-development`, confere o hostname esperado e aplica a cadeia com lock antes
de auditar o journal. Ele não recebe SHA digitado nem executa código de PR.

## Verificação local

Durante o desenvolvimento:

```bash
bun run verify:quick
```

Antes do Pull Request:

```bash
bun run verify
```

O perfil rápido executa migrations check, typecheck, estilo e testes. O perfil
completo acrescenta documentação, build e Knip. Ambos são fail-fast. O gate
local de build reproduz a configuração sintética da CI com origem `.invalid` e
segredo descartável para as variáveis mínimas exigidas pela compilação.

E2E e integração requerem uma branch Neon ou banco descartável já migrado, nunca um banco
compartilhado. A CI é o caminho recomendado até existir um procedimento local isolado equivalente.
