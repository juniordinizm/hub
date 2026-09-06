---
status: proposed
owner: engineering
last_verified_commit: 961476f
audit_date: 2026-09-06
---

# Revisão final de Production Readiness — liberação por Módulo

## Decisão

**NO-GO para Production no estado atual.** A arquitetura central está boa e a
maior parte do enforcement foi implementada corretamente, mas o artefato que
seria promovido ainda não existe como candidato verificável:

1. o branch `codex/module-content-release-hardening` está apenas local;
2. o PR #205 aponta para `d061beb`, anterior a todo o hardening;
3. o `staging` remoto avançou para `cb2680d` e o merge sintético apresenta
   conflitos;
4. nenhum CI PostgreSQL/E2E executou no HEAD `961476f`;
5. as correções foram implementadas apenas no worktree local e ainda não
   formam um SHA integrado/verificado;
6. playback JMVStream, R2, migration 0071 e copy jurídica ainda exigem
   validação externa em Staging.

Isso não significa que a feature deva ser redesenhada. A recomendação é manter
o modelo simples aprovado, corrigir os pontos abaixo, integrar com o `staging`
atual e só então requalificar o candidato.

## Escopo e evidências

Revisão realizada sobre:

- diff `staging...codex/module-content-release-hardening`, cujo fixed point
  local é `9d0450a`;
- especificação `docs/superpowers/specs/2026-09-04-module-content-release-design.md`;
- ADR-0010 e plano de implementação;
- código de autoria, publicação, Matrícula, checkout, workspace, comentários,
  materiais, progresso, Certificado, Admin e Support;
- migrations `0070` e `0071`;
- testes unitários, integração e Playwright;
- estado remoto do GitHub consultado em 2026-09-06;
- documentação atual de Next.js 16.2.11 instalada no repositório;
- fontes externas consolidadas em
  [Pesquisa externa para a revisão final](2026-09-06-module-content-release-external-research.md).

Comandos/evidências decisivos:

- `bun run verify:quick`: passou; 374 arquivos e 2578 testes unitários;
- `bun run verify`: passou; docs, migrations, typecheck, Ultracite, 374 arquivos
  e 2578 testes, build e Knip concluídos;
- `bun audit --production`: havia passado no mesmo branch antes desta revisão;
- `git diff --check staging...HEAD`: sem erro;
- CI remoto `33981084537`: verde apenas em `d061beb`, não no hardening;
- PR #205: HEAD `d061beb`, `mergeStateStatus: DIRTY`;
- `origin/staging`: `cb2680d`;
- `git merge-tree --write-tree HEAD origin/staging`: conflitos em workflow,
  lockfile, documentação e testes de release;
- integração local e Playwright não puderam rodar porque este host não possui
  PostgreSQL, Docker, WSL funcional nem URLs de banco descartável.

## Estado após a remediação local

Depois da auditoria, o worktree recebeu correções testadas para:

- lease/CAS de reserva pré-provider do checkout, com terminalização segura de
  `pending` órfão;
- lock de Curso em reordenação de Módulos/Aulas e lock agregado em comentários;
- limite máximo de atraso na autoria e fixtures PostgreSQL sem data fixa;
- Aula concluída em Módulo futuro no outline/workspace;
- estado `invalid_schedule` sanitizado no Support;
- telemetria não bloqueante e erros de domínio tipados;
- relógio `now()` do PostgreSQL nos read models temporais;
- `private, no-store` e revalidação server-side antes de novas URLs de mídia;
- flag server-side de publicação D+N para rollout em duas fases;
- reutilização do lock agregado nos Certificados.

Essas mudanças têm evidência unitária local, mas não substituem PostgreSQL,
Playwright, Staging, provider real ou um SHA integrado com o `staging` remoto.

## O que está bem implementado

### Modelo simples e adequado

- atraso exclusivamente no Módulo;
- D+N como períodos exatos de 24 horas;
- âncora explícita na Matrícula;
- renovação contínua e Concessões sobrepostas preservam o episódio;
- perda total seguida de nova ativação reinicia;
- nenhum scheduler ou estado materializado de desbloqueio;
- snapshot do Pedido é evidência comercial, sem virar segunda autoridade;
- monotonicidade por `curriculum_key` impede aumentar atraso de Aula existente;
- override integral por Matrícula é mais simples que exceção por Aula/Módulo.

### Barreiras server-side

- workspace e rota direta usam decisão server-side;
- conclusão e watch revalidam dentro de transação e usam o mesmo cliente;
- provider de vídeo não é chamado com a transação aberta;
- comentários, preview e download consultam o resolver antes de expor conteúdo;
- Certificado continua usando todas as Aulas obrigatórias no denominador;
- preview Admin é separado e Support não recebe permissão de mutação;
- checkout/publicação compartilham lock de Curso;
- digest obsoleto é recusado antes do provider.

### Compatibilidade de schema

- defaults de migration deixam Módulos em D+0 e Matrículas antigas em
  `full_access`;
- não existe backfill Aluna × Aula;
- o schema novo é aditivo e não exige migration destrutiva de reversão;
- a UI não usa relógio do navegador como autoridade.

O rollout de código, porém, **não é retrocompatível depois que existir um
cronograma D+N ativo**: uma versão antiga ignora os novos campos e libera todo
o conteúdo. Isso é um bloqueador separado, detalhado abaixo.

## Findings bloqueadores e importantes

### P0 — O candidato não está integrado nem verificável

**Evidência:** branch de hardening ausente no remoto; PR #205 permanece em
`d061beb`; `origin/staging` está em `cb2680d`; merge sintético gera conflitos.

**Impacto:** não existe SHA que combine feature, hardening e `staging` atual.
Qualquer conclusão de Production Readiness hoje seria sobre código diferente
do que seria promovido.

**Correção mínima:** integrar `origin/staging` em worktree próprio, resolver
conflitos preservando ambas as intenções, executar todos os gates, publicar o
branch e atualizar/criar PR.

### P1 — Reordenação pode atravessar publicação concorrente (corrigido localmente)

**Arquivo/símbolos:** `src/features/admin/actions.ts`,
`reorderLessonsAction`, `reorderModulesAction` e
`lockCourseContentRelease`.

**Cenário:** publicação segura o lock do Curso, valida e publica. As ações de
reordenação não adquirem o mesmo lock. Uma reordenação iniciada antes pode
escrever depois do commit da publicação e mover uma Aula/Módulo no rascunho
que acabou de ser publicado, sem nova validação de monotonicidade/digest.

**Impacto:** o conteúdo publicado pode divergir do artefato validado, inclusive
com uma Aula existente passando a herdar o atraso de outro Módulo.

**Correção aplicada:** adquirir `lockCourseContentRelease` no início de toda
mutação estrutural de Módulo/Aula, dentro da mesma transação, e adicionar teste
PostgreSQL que intercale reorder e publish nas duas ordens de commit.

### P1 — Rollback de código pode liberar conteúdo futuro

**Evidência:** o runtime anterior à feature não interpreta
`release_mode`, `release_delay_days`, snapshot ou âncora da Matrícula.

**Cenário:** após ativar qualquer D+N, um rollback para o código antigo mantém
as colunas no banco, mas volta a servir todas as Aulas como disponíveis.

**Impacto:** o procedimento descrito como rollback seguro viola a barreira que
a feature existe para aplicar.

**Correção mínima:** rollout em duas fases. Primeiro, publicar uma versão
compatível que entende e aplica o schema novo, mas mantém publicação de novos
D+N desabilitada. Só depois de validar e tornar a versão anterior incompatível
fora da janela de rollback, habilitar D+N. Após a ativação, rollback funcional
é uma nova versão corrigida ou D+0 deliberado, nunca retorno ao runtime antigo.

### P1 — Reserva de checkout pode ficar eternamente em `pending` (corrigido localmente)

**Arquivo/símbolos:** `src/features/payments/checkout.ts`,
`createPendingCheckoutOrder`, `createAsaasCheckoutIntent` e
`readPublicCheckoutStatus`.

**Cenário:** o Pedido pendente é commitado; o processo termina antes de
`authorizeAndClaimAttempt`. Um retry encontra o Pedido existente e retorna
`processing`; o status público também interpreta `pending` como `processing`.
Nenhum caminho recupera ou terminaliza essa reserva.

**Impacto:** checkout preso, polling sem fim, PII órfã e nova compra bloqueada
até o cliente abandonar o attempt ID.

**Correção aplicada:** lease de 30 segundos e CAS terminalizam somente a
reserva sem evidência de provider como `failed` retryável. `creating` e
`uncertain` continuam sem retry automático. O teste PostgreSQL de crash ainda
precisa executar no CI.

### P1 — Comentários ainda têm TOCTOU de autorização (corrigido localmente)

**Arquivo/símbolos:** `src/features/comments/server.ts`,
`createLessonComment` e `getLessonComments`.

**Cenário:** o resolver permite; uma revogação confirma antes do `insert` ou
da query de comentários; a operação seguinte usa outro comando/conexão sem
revalidar entitlement.

**Impacto:** uma Conta recém-revogada pode gravar ou ler comentários numa
janela concorrente. É estreita, mas contradiz o contrato de enforcement em
toda requisição.

**Correção aplicada:** criação e leitura usam transação + lock do agregado + resolver
com `PoolClient`, incluindo validação do parent e insert. Para leitura, usar
o mesmo ponto serializado e não prometer desfazer bytes já entregues antes da
revogação. O teste concorrente PostgreSQL aguarda execução no CI.

### P1 — Teste PostgreSQL de conteúdo expira em data fixa

**Arquivo:** `src/features/courses/content-release.integration-fixture.ts`.

**Cenário:** âncora fixa em 2026-09-04 é combinada com caminhos de produção que
chamam `new Date()` e não recebem o `NOW` do teste. Depois de 2026-09-12, o
Módulo “futuro” deixa de estar bloqueado; depois de 2027-09-04, a Matrícula
expira.

**Impacto:** CI futuro falha sem mudança de código e deixa de provar o cenário
que o nome do teste afirma.

**Correção mínima:** derivar âncora/expiração do relógio da execução ou injetar
um relógio consistente nos read models testados. Nunca depender de uma data
absoluta próxima.

### P1 — Limite máximo não é aplicado ao salvar Módulo

**Arquivo/símbolo:** `src/features/admin/authoring.ts`,
`readModuleReleaseDelayDays`.

**Cenário:** valores inteiros entre `MAX_RELEASE_DELAY_DAYS + 1` e o máximo de
`integer` do PostgreSQL passam pelo parser e podem ser salvos em Curso com
vendas fechadas. O runtime depois classifica a data como inválida e nega.

**Impacto:** autoria aceita estado que o próprio runtime não consegue avaliar,
violando “atraso inválido => Módulo não é salvo”.

**Correção mínima:** exportar/reusar o validador canônico ou comparar com
`MAX_RELEASE_DELAY_DAYS` no parser; testar máximo e máximo+1 no fluxo de save.

### P1 — Migration 0071 foi criada sem a medição que a justificava

**Arquivo:** `src/db/migrations/0071_content_release_observability_indexes.sql`.

**Evidência:** o plano exigia `EXPLAIN ANALYZE` e criação apenas se houvesse
scan relevante. Não existe evidência antes/depois. A migration usa `CREATE
INDEX` normal; o migrador Drizzle executa migrations em transação, portanto
`CONCURRENTLY` não pode ser simplesmente inserido nesse arquivo.

**Impacto:** lock de escrita potencial durante deploy e custo permanente para
um índice possivelmente desnecessário.

**Correção mínima:** medir volume/plano em clone de Production. Se não houver
ganho, remover 0071 antes de ela ser aplicada. Se houver, escolher janela de
manutenção compatível com `CREATE INDEX` transacional ou um runbook separado e
seguro para índice concorrente.

### P1 — Hardening PostgreSQL/E2E nunca executou no SHA final

**Evidência:** o último CI verde conhecido é `d061beb`; os testes de corrida e
fixtures novos vieram depois. O comando local falha pela ausência explícita de
`INTEGRATION_DATABASE_URL`/`E2E_DATABASE_URL`.

**Impacto:** queries, migrations, locks e Playwright novos estão apenas
compilados; não há prova de execução em PostgreSQL real.

**Correção mínima:** novo CI no SHA integrado, sem retry manual mascarando
falha, e inspeção dos artefatos Playwright.

## Findings de refinamento

### P2 — Support não expõe `invalid_schedule`

O hardening planejava um estado sanitizado para Support. Hoje o DTO mostra
modo, âncora e próxima data, mas não diferencia cronograma inválido. O log
operacional existe, porém o atendente não recebe diagnóstico acionável.

Adicionar `contentReleaseState: valid | invalid_schedule` calculado no servidor,
sem stack, SQL ou PII.

### P2 — Telemetria não possui alerta nem correlação ponta a ponta

Os códigos `content_release_invalid_state`, `digest_conflict` e overrides são
emitidos, mas não aparecem em `getOperationalBacklogSnapshot`, não há alerta
configurado e vários callers criam correlação nova em vez de propagar a do
request. Além disso, logging síncrono não deve mascarar erro de domínio se o
writer falhar.

### P2 — Aula concluída em Módulo futuro some do outline do workspace

O resolver permite a Aula concluída e o overview a apresenta, mas
`getEnrolledLessonWorkspace` remove todas as Aulas de Módulos temporais ao
montar `visibleModules`. A Aula ativa pode ser exibida sem aparecer no outline;
`lessonIndex` vira `-1` e a próxima navegação pode apontar para o primeiro item
visível.

Manter no outline somente as concluídas do Módulo futuro e calcular anterior/
próxima a partir de candidatos autorizados.

### P2 — Relógio de aplicação e relógio do banco podem divergir

Janela de Matrícula é filtrada com `now()` do PostgreSQL; D+N usa `new Date()`
da aplicação. Pequeno clock skew pode produzir decisões diferentes na borda.
Escolher uma referência por request/transação, preferencialmente obtida do
banco para mutações críticas, e testá-la exatamente no limite.

### P2 — Cobertura do override e acessibilidade é parcialmente indireta

Há contrato por leitura de source para matrícula inativa e markup estático para
`aria-busy`, mas falta teste comportamental real de override revogado/expirado
e anúncio do erro após rejeição da Server Action.

### P2 — Respostas que entregam URLs R2 podem usar `no-store`

O preview retorna `private, max-age=300` e o download redireciona sem política
explícita. Isso não amplia o TTL do bearer token, mas favorece reuso do redirect
no navegador. Para material dependente de entitlement, `private, no-store` é
mais previsível.

### P2 — Emissão de mídia ainda tem janela de revogação

As rotas de recurso e o caminho JMVStream autorizam a Aula e só depois assinam
ou obtêm a mídia. Uma revogação pode confirmar nesse intervalo. Para assinatura
R2 local, revalidar imediatamente antes da assinatura com o mesmo contexto de
decisão fecha a janela. Para provider remoto, não manter lock ou transação
aberta durante I/O: revalidar, encerrar a transação e aceitar/documentar o
pequeno TTL residual do token já emitido.

### P2 — Parte da cobertura SQL é acoplada ao texto-fonte (parcialmente mitigado)

`src/features/comments/server-sql.test.ts` e testes semelhantes procuram
fragmentos de SQL/source. Eles ajudam a detectar regressão mecânica, mas podem
passar mesmo com query semanticamente inválida. Locks, CAS, revogação e ordem
de commit agora também têm cenários de integração escritos, mas precisam ser
provados em PostgreSQL real.

### P3 — Classificação de erro por texto é frágil (corrigido localmente)

`classifyContentReleaseError` agora prioriza `ContentReleaseDomainError.code` e
mantém fallback para erros antigos.

### P3 — `server.ts` de Cursos cresceu demais

O arquivo concentra catálogo, overview, workspace, conclusão, watch e
certificado. Não é motivo para grande refactor antes do lançamento, mas as
correções devem extrair apenas o contexto transacional de mutação e a projeção
de disponibilidade, evitando novo framework.

## Standards

O código segue os padrões mecânicos do repositório: TypeScript passou,
Ultracite passou, arquivos server-only são usados nas fronteiras e as ações
privilegiadas revalidam permissão. Os desvios relevantes são humanos:

- **violação documentada:** o plano/AGENTS exige teste PostgreSQL real e
  verificação proporcional ao risco, ainda ausentes no SHA final;
- **violação documentada:** alteração de migration sem a medição prescrita;
- **julgamento — Duplicated Code/Data Clump:** contexto de disponibilidade
  ainda atravessa catálogo, overview e workspace em formas próximas;
- **julgamento — Divergent Change:** `src/features/courses/server.ts` responde
  por responsabilidades demais;
- **julgamento — Shotgun Surgery:** adicionar um estado de release exige tocar
  vários read models e DTOs, sinal de que a projeção canônica ainda é rasa.
- **correção aplicada:** o lock advisory por par dos Certificados reutiliza
  `enrollment-aggregate-lock.ts`, mantendo a ordem Curso → Conta+Curso.

Não recomendo refactor amplo antes do release. Corrigir P1 com helpers pequenos
e testes é menos arriscado.

## Spec

A especificação está majoritariamente implementada. Gaps comprovados:

- “atraso inválido => Módulo não é salvo” está coberto no parser canônico;
- “mesma decisão protege leitura/criação de comentários” está serializado no
  worktree, pendente de prova PostgreSQL;
- “publicação e autoria estrutural compartilham a mesma fronteira serializada”
  foi aplicado ao reorder, pendente de prova PostgreSQL;
- “rollback seguro” não vale para runtime antigo depois de D+N ativo;
- “Support expõe `invalid_schedule`” foi entregue localmente;
- “integração PostgreSQL e E2E no candidato” não foi provado;
- “índice somente após EXPLAIN” foi invertido;
- “Aula concluída permanece acessível” funciona, mas o outline/navegação do
  workspace fica inconsistente.

Não são gaps:

- ausência de regra por Aula;
- ausência de coorte, scheduler ou tabela Aluna × Módulo;
- snapshot sem IDs internos;
- override integral, em vez de override por Módulo;
- publicação viva como autoridade de runtime.

Esses pontos são decisões explícitas de simplicidade e devem ser preservados.

## Matriz final de prontidão

| Área | Estado | Evidência/pendência |
| --- | --- | --- |
| Modelo de domínio | Verde | simples, explícito e coerente com ADR |
| Autorização de Aula | Verde condicional | locks/revalidação locais; PostgreSQL pendente |
| Comentários | Verde condicional | transação local; PostgreSQL pendente |
| Checkout/publicação | Amarelo | lease local; corrida real pendente |
| Matrícula/âncora | Verde condicional | regras cobertas; CI real pendente |
| Certificado | Verde condicional | denominador correto; CI real pendente |
| UI/UX | Verde condicional | outline corrigido; E2E móvel pendente |
| Observabilidade | Amarelo | sink seguro; alertas externos pendentes |
| Migration | Vermelho | 0071 sem EXPLAIN; candidato não integrado |
| R2/JMVStream | Amarelo | revalidação local; bearer/playback real pendente |
| Jurídico/comercial | Vermelho | aprovação e fluxo durável pendentes |
| Release/CI | Vermelho | branch local, PR antigo, conflitos e rollback incompatível |

## Recomendação final

Não promover agora. Executar primeiro o Sprint 0 de integração e depois o Sprint 3
de PostgreSQL/E2E do plano de remediação
gerado junto desta revisão. Depois, criar um SHA integrado e exigir CI completo.
Os Sprints 3–4 fecham observabilidade e operação; somente após os gates manuais
de Staging/Jurídico e um rollout em duas fases a decisão pode mudar para GO.
