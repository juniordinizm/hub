---
status: runbook
owner: engineering
last_verified_commit: acb1d0b
---

# Testes e CI

Para transformar esses gates em uma publicação, siga o
[tutorial da alteração até Production](production-release-guide.md).

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
12. liberação do workflow de Staging para o SHA verde da branch persistente;
13. habilitação dos workflows manuais de migration Development e deploy
    Production para o SHA verde da `main`.

`quality` contém os gates sem banco e roda em todo push e pull request. `integration-db` e
`e2e` só executam para branches internas ou push: o GitHub não fornece secrets a pull requests
de forks. Essa restrição é intencional; os gates que exigem Neon não devem receber segredos de
contribuidores externos. `integration-db` cria sua branch Neon e a remove no cleanup; somente
depois disso `e2e` cria a própria branch. A serialização evita exceder a cota finita de branches
do projeto Neon de CI. `build-and-knip` só inicia após as duas terminarem e
`vercel-preview` só inicia depois de todos esses gates, com uma terceira branch Neon.

O perfil Preview permanece dormente e fail-closed: não recebe R2, Resend, Asaas
ou JMVStream e não substitui as jornadas funcionais do Playwright. Staging é o
ambiente persistente de homologação manual, publicado somente após a CI verde
da branch `staging`. O contrato Preview exige `VERCEL_BRANCH_URL` ou
`VERCEL_URL`: o primeiro é
preferido quando existe alias de branch; o segundo é o hostname disponível nos
deployments criados pela CLI. Ambos continuam protegidos, e somente a CI recebe
o bypass de automação. A branch é apagada em passo `always()` depois do smoke;
expiração de 24 horas cobre cancelamento abrupto do runner.

A branch persistente `vercel-preview` permanece sem migrations de Pull Request
e não é usada pelo candidato da CI. Assim, readiness acompanha o journal do
commit sem exigir escrita em Preview, Development ou Production. O deployment
de candidato deixa de funcionar quando sua branch descartável é removida; ele é
evidência de gate, não ambiente compartilhado para revisão manual.

### Limpeza automática das branches de CI

O workflow `.github/workflows/cleanup-ci-neon-branches.yml` executa a cada hora
e também pode ser disparado manualmente. Ele consulta o projeto definido por
`NEON_CI_PROJECT_ID` e só considera nomes com os prefixos `ci-integration-` e
`ci-e2e-`. Branches expiradas são removidas; uma branch sem `expires_at` só é
considerada órfã quando tem pelo menos 26 horas. Branches protegidas,
Production, `vercel-preview` e `staging-release-*` ficam fora da allowlist.

O modo manual padrão é `dry-run`. A exclusão exige `--execute` e a confirmação
`cleanup-ci-neon`; o job limita cada execução a 50 branches. Os passos
`always()` dos jobs continuam sendo a limpeza imediata; o janitor cobre
cancelamentos, falhas de runner e branches cujo ID não voltou como output da
action de criação. Backups de release não são apagados por esse workflow.

Pull requests do Dependabot também não recebem os Actions secrets normais e
podem alterar justamente o código de uma action de terceiros. Por isso,
`integration-db` e `e2e` são explicitamente ignoradas quando
`github.actor == 'dependabot[bot]'`; os gates sem provider continuam rodando e
as integrações completas são obrigatoriamente exercitadas no push confiável
após o merge. Não copie `NEON_CI_API_KEY` para Dependabot secrets apenas para
forçar essas jobs.

`quality` usa `fetch-depth: 0`: `docs:check` confirma que cada
`last_verified_commit` ainda existe no histórico. O checkout raso padrão do GitHub Actions traz
apenas o commit atual e produziria um falso erro para documentos verificados em commits anteriores.
Todas as actions são fixadas em commit imutável. O Dependabot propõe
atualizações semanais do ecossistema `github-actions`; cada mudança de SHA
continua passando pelos mesmos gates.

## Banco efêmero da CI

As jobs que precisam de Postgres criam branches distintas, em sequência, no projeto Neon exclusivo
de CI. Cada branch recebe expiração de 24 horas e é removida em um passo `always()`. A expiração é a contenção
para cancelamentos que interrompam o runner antes do cleanup explícito.

Antes da primeira execução remota, configure no repositório GitHub:

- secret `NEON_CI_API_KEY`: chave de API limitada exclusivamente ao projeto de CI;
- variable `NEON_CI_PROJECT_ID`: ID do projeto Neon dedicado exclusivamente à CI.
- variable `NEON_CI_PARENT_BRANCH_ID`: branch do projeto CI sem dados de Production,
  com journal aceito pelo preparador (limpo, `0052`, `0053`, `0054` ou `0062`),
  usada como origem das branches efêmeras. Em um projeto CI novo, o journal limpo
  significa que o schema `drizzle.__drizzle_migrations` existe sem linhas; cada
  job aplica a cadeia completa em sua branch descartável.

Não use o projeto Neon de produção, sua URL de conexão ou uma chave com escopo de produção.
O workflow nunca escreve URLs em logs. `create-branch-action` retorna URLs apenas como outputs
mascarados, usadas pelos migradores, integração e E2E.

Antes de disparar uma execução, confirme também que `NEON_CI_PROJECT_ID` aponta para
o projeto CI dedicado e que a action cria a branch a partir de uma origem sem
dados de Production. Sem `parent_branch` explícito, o Neon usa a branch padrão
do projeto; nesse caso, a execução deve ser interrompida em vez de copiar dados
reais para uma branch efêmera.

Antes de rodar integração ou E2E, cada job tenta seu migrador até cinco vezes,
com espera limitada entre tentativas. Integração usa `db:migrate`; E2E usa
`db:migrate:e2e`, com `DATABASE_URL`, `DATABASE_URL_DIRECT` e `E2E_DATABASE_URL`
fixadas na mesma URL direta descartável. A criação de uma branch não garante que
o compute Neon esteja imediatamente pronto para aceitar a primeira conexão. A quinta falha
preserva o erro do migrador e bloqueia os gates seguintes.

Quando a branch-pai ainda está em `0043`, ela contém os Pedidos de teste legados que
`0046` deliberadamente não converte. Por isso, as duas jobs executam
`db:prepare:ci-migration` antes do migrador. O preparador exige `CI=true`, o ID devolvido
pela action Neon, URLs direta e runtime idênticas, host Neon diferente do compute
Production conhecido e journal exatamente com 44 entradas até `0043`. Somente então
executa `truncate table public.orders cascade` em transação e sob advisory lock. Esse
passo existe exclusivamente para clones efêmeros; não é um comando de limpeza de
Development ou Production. Se a branch-pai já estiver exatamente em `0052`, `0053` ou `0054`,
o comando não altera dados; qualquer journal intermediário, anterior ou posterior aos
estados reconhecidos falha fechado. A aceitação explícita do topo atual evita que branches
efêmeras herdadas de Production falhem depois de uma promoção autorizada, mantendo a
validação fechada para journals desconhecidos.

O teste PostgreSQL real do worker Asaas depende de
`CERTIFICATE_CONCURRENCY_DATABASE_URL`. Em 2026-07-29, a Etapa 9 executou essa prova na
branch Neon descartável `br-autumn-mouse-ac9ti4dr`: 20 testes de integração passaram,
incluindo claim concorrente, rollback, perda de ownership, esgotamento de tentativas e
sanitização. Testes unitários da rota, worker e processor continuam complementares, não
substitutos dessa prova transacional.

### Paridade de ambiente

O projeto `damp-snow-22911188` usa PostgreSQL 18 em `sa-east-1`. Sua branch
`production` (`br-dark-boat-ac5ju6m4`) é o banco definitivo da aplicação. As
jobs usam somente `NEON_CI_PROJECT_ID` e a chave project-scoped `NEON_CI_API_KEY`
configurados no GitHub; elas não recebem uma URL persistente. Cada job cria uma
branch temporária isolada a partir de `production` e deve removê-la ao terminar.
Nenhuma etapa de CI pode executar migrations, integração ou E2E diretamente na
branch `production`.

O provisionamento passa por `.github/actions/create-neon-branch`, que tenta criar ou reutilizar a
mesma branch até três vezes, com espera de 5 e 10 segundos. A action reutiliza o mesmo nome em cada
tentativa para absorver respostas transitórias da API Neon sem criar branches duplicadas. Somente
uma tentativa bem-sucedida libera as URLs e o ID usados pelos migradores; depois das três falhas a
execução termina sem executar migrations ou testes.

## E2E

`bun run test:e2e` inicia a aplicação em `127.0.0.1:3100`, sem abrir navegador visual, e roda
Chromium em modo headless. Localmente, o Playwright inicia `next dev`; em CI, compila e inicia
`next start`, evitando HMR e verificando a aplicação de produção. A configuração está em
`playwright.config.ts`. O processo web recebe somente a URL pooled da branch
efêmera; a URL direta fica restrita à etapa anterior de migration. O bypass das
credenciais de providers existe somente para esse runtime CI em loopback.
E-mails transacionais são absorvidos nesse modo e nunca chegam ao Resend. Emissões de
Certificado registram somente tópico, chave SHA-256 normalizada do destinatário e chave
de idempotência em memória; não registram e-mail, nome, código público nem corpo.
`/api/e2e/email-deliveries` expõe esses registros somente sob a mesma guarda isolada e
responde `404` fora dela. `VERCEL_ENV` de Production/Preview ou
`VERCEL_TARGET_ENV=staging` anulam o modo mesmo com flags E2E presentes.
As três URLs canônicas e os flags isolados são aplicados tanto ao processo Playwright
quanto ao `webServer`, para que setup, servidor e teardown compartilhem a mesma origem.
`E2E_DATABASE_URL` continua obrigatório e não é inferido de um banco comum.
A configuração executa a guarda fail-closed antes do `globalSetup`; setup, seed e teardown
repetem a mesma validação. Processos mutadores exigem igualdade exata entre `DATABASE_URL` e
`E2E_DATABASE_URL`, protocolo PostgreSQL e alvo diferente do compute Production conhecido.
O migrador E2E também fixa `DATABASE_URL_DIRECT` no mesmo alvo antes de carregar a
configuração Drizzle, impedindo que `.env.local` selecione outra branch.

O Playwright também inicia `scripts/e2e-asaas.ts` em `127.0.0.1:4570`. Esse servidor
determinístico atende somente criação de Checkout, leitura do cliente fixture e página
hospedada; não imprime corpo, token, nome ou e-mail. A jornada financeira
envia webhook autenticado, executa o cron real e consulta o resultado usando exclusivamente
`E2E_DATABASE_URL`. Duplicar o mesmo evento deve manter um Pedido, uma Concessão e uma
ativação. As asserções também comprovam Conta não verificada, Perfil Student, Matrícula
ativa única, preservação da identidade da sessão no checkout autenticado e reuso do mesmo
UUID/Checkout após remount com `sessionStorage`.

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
- jornada completa da última Aula: primeira Conclusão, Certificado `pending`, cron real
  da outbox, renderização em storage S3 loopback, transição `ready`, uma entrega de e-mail
  minimizada e página pública canônica com preview/download mediado do PDF;
- Curso como entrada contextual e lista autenticada como arquivo global de Certificados,
  com estados `pending`, `ready`, `failed` e revogado;
- rotas públicas de preview PNG e PDF limitadas antes do lookup, com redirect inline curto somente para `valid` e `ready`,
  verificação SHA-256, `X-Robots-Tag` e ausência de URL assinada para os demais estados;
- fronteira Admin/Aluna;
- gestão de Alunas pelo `StudentManagementSheet` na lista geral e no contexto do Curso,
  incluindo aluno sem Matrícula, escopos de leitura e retorno 404 da rota individual removida;
- erro seguro de checkout sem provedor configurado;
- handoff público sem formulário, checkout Asaas fake, identidade pós-evento, idempotência,
  callbacks e bloqueios de Conta ativa, revogada, bloqueada ou de equipe;
- colisões pós-pagamento da compra anônima com Conta bloqueada ou de equipe: Pedido pago,
  revisão `buyer_identity` pendente e zero Concessão, Matrícula ou outbox de acesso;
- certificado público válido e revogado;
- foco de teclado no formulário e navegação da sidebar;
- alertas seguros para falha simulada de leitura, material R2 indisponível e
  o índice de Aula expansível no mobile;
- acesso expirado e acesso revogado, com ação de renovação ou suporte;
- axe-core sem violações `critical` ou `serious` na Biblioteca e Aula da Aluna.

Essa cobertura full-story está implementada em `critical-journeys.spec.ts` e integrada à
job Playwright; a execução da CI para este commit permanece pendente. Não trate a presença
do teste como resultado verde nem como evidência de promoção.

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
| Pagamento e webhook | `asaas*.test.ts`, `public-checkout.test.ts`, E2E checkout seguro |
| Concessão e Matrícula | `enrollments/rules.test.ts`, `server-sql.test.ts`, E2E acesso |
| Progresso e conclusão | `progress/rules.test.ts`, integração de certificado, E2E sequência/conclusão |
| Certificado | `certificates/rules.test.ts`, integração concorrente, testes da página/rota pública e E2E full-story de conclusão, renderização, e-mail, preview, download mediado e validação pública |
| Efeitos transacionais | `outbox/*.test.ts`, worker da inbox Asaas e integração PostgreSQL de locks, rollback e emissão de certificado |
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
| Certificado | Alto: concluir a última Aula, acompanhar `pending` até `ready` e abrir a página canônica a partir do Curso, do arquivo global ou do e-mail. | Uma única Conclusão/emissão/e-mail; preview e download público apenas para `valid`/`ready`, com hash íntegro, rate limit, URL assinada curta e não indexação; nenhum download para `pending`/`failed`/`revoked`. `critical-journeys.spec.ts` e testes de `src/app/certificados/[code]`. |

`knip.jsonc` inclui uma baseline explícita para arquivos e exports já desconectados por rotas ou
ações dinâmicas do Next.js. Ela existe para que `bun run knip` bloqueie novos achados sem apagar
comportamento fora deste plano. Cada item da baseline deve ser removido quando ganhar consumidor
estático ou quando a capacidade for retirada deliberadamente.

## Build sem deploy

`next build` executa a validação de ambiente como produção. A job `build-and-knip` portanto fornece
um segredo-placeholder e URLs `https://ci-build.invalid` somente para compilar; não fornece banco,
provedores ou credenciais reais e não produz artefato para deploy. Um deploy continua exigindo as
variáveis reais do ambiente alvo, conforme o [runbook de deploy](deploy-and-incidents.md).

Depois desses gates, em Pull Requests ou despachos manuais, `vercel-preview`
solicita à Vercel um build remoto, publica um candidato isolado e testa
`/api/health/ready` com autenticação. A execução de CI causada por push na
`main` omite esse job porque Production fará seu próprio build isolado antes da
promoção. O ambiente `vercel-preview` do GitHub fornece token, IDs do projeto e
uma cópia do `HEALTHCHECK_SECRET`; as demais variáveis de runtime ficam na
Vercel.

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

Quando uma migration já chegou com segurança à `main` e possui CI verde, o
workflow manual `Migrate Neon development` deriva e valida o mesmo SHA, usa o
Environment `neon-development`, confere o hostname esperado e aplica a cadeia
com lock antes de auditar o journal. Ele não recebe SHA digitado nem executa
código de PR. O bloqueio de Preview descrito acima precisa ser resolvido antes
da próxima migration nova.

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
segredo descartável para as variáveis mínimas exigidas pela compilação. O gate
Knip também recebe `DATABASE_URL` e `E2E_DATABASE_URL` iguais, sintéticas e sob
host `.invalid`, apenas para carregar `playwright.config.ts`; ele não abre conexão
nem reutiliza banco real.

E2E e integração requerem uma branch Neon ou banco descartável já migrado, nunca um banco
compartilhado. A CI é o caminho recomendado até existir um procedimento local isolado equivalente.
