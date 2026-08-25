---
status: runbook
owner: engineering
last_verified_commit: 36019cf0a609a7283046d71c694f16d8afd6fec3
current_migration_tag: 0067_sparkling_ghost_rider
migration_entry_count: 68
schema_table_count: 46
---

# Banco e migrations

O registro factual de qual commit e qual migration estão implantados fica em
[Estado de release](release-state.md). Os parágrafos históricos abaixo preservam
evidência de ensaios anteriores; quando divergirem do registro atual, não devem
ser usados como autorização de promoção.

## Estado atual

No snapshot de 23 de agosto de 2026, o topo local e o catálogo de Production
eram `0064_certificates_preview_sha256`, com 65 entradas no journal e 43 tabelas
da aplicação. `0063_support_requests` cria a solicitação persistida do formulário
de suporte. `0064` adiciona `certificates.preview_sha256` como coluna opcional.
Ambas são aditivas e não reescrevem registros existentes.

Em 24 de agosto de 2026, a remediação da Sprint 1 acrescentou somente à cadeia
local `0065_gray_siren`. A Sprint 3 acrescentou `0066_gifted_retro_girl` e a
Sprint 4 acrescentou `0067_sparkling_ghost_rider`, totalizando 68 entradas e 46
tabelas no snapshot. `0065`
adiciona o indicador de segundo fator, a tabela `two_factors` e revogação de
sessões por mudança de papel ou do indicador de segundo fator. Production
permanece em `0064`; gerar, ensaiar e documentar `0065` não autoriza promoção.

O SQL de `0065` foi aplicado dentro de transação na branch Neon descartável
`br-plain-field-acrxo0ru`, filha direta de Production. O postflight confirmou as
sete colunas do plugin, um índice de segredo, dois triggers, zero registros TOTP
semeados, revogação das sessões anteriores e permanência apenas da sessão criada
depois do challenge. Os fixtures foram removidos e a branch descartável foi
excluída ao final; nenhum alvo persistente foi alterado.

`0066` acrescenta apenas o valor terminal `superseded` ao enum da outbox, a
coluna `superseded_at` e um índice não parcial nesse timestamp. O primeiro ensaio
na branch descartável `br-holy-wildflower-achkx0vn` detectou e reverteu um índice
parcial gerado que usava o novo valor do enum na mesma transação. O índice foi
corrigido para não parcial; a migration então passou e a segunda execução
confirmou idempotência. Nove cenários integrados de concorrência/expiração e o
script v1 dry-run/execute passaram, fixtures foram removidos e a branch foi
apagada e confirmada como ausente. Nenhum alvo persistente recebeu `0065` ou
`0066` por esse ensaio.

`0067` cria somente metadata de lifecycle Resend: enums fechados,
`email_messages`, `resend_webhook_events`, FKs `set null`, constraints de hash e
índices de fila/timeline. Não existem colunas de destinatário, remetente,
assunto, HTML, texto, URL, token, payload ou headers. Ela passou duas vezes na
branch descartável `br-falling-mouse-acqm8mw7`. A integração comprovou webhook
antes da aceitação local, redução determinística de eventos conflitantes e
deduplicação por Svix ID. Fixtures e branch foram removidos; listagem posterior
confirmou ausência. Nenhum alvo persistente recebeu `0067`.

O repositório usa cadeia Drizzle forward-only. Em 2026-08-02, a cadeia
`0000` a `0053` está aplicada à branch `production`
(`br-dark-boat-ac5ju6m4`) do projeto Neon definitivo
`damp-snow-22911188`. O workflow protegido `30735668308` confirmou 54 entradas
no journal, topo em `0053`, hashes idênticos ao repositório e paridade dos objetos
críticos descritos neste runbook.

Em 2026-08-01, a cadeia `0000` a `0053` foi aplicada à branch descartável de
Staging `br-rapid-rain-acnqzhiv`. Duas execuções consecutivas do migrador
guardado confirmaram idempotência, 54 entradas no journal, as quatro novas
colunas de snapshot do Pedido e a oferta padrão Pix + cartão em até 3x no Curso
existente. Production permaneceu em `0052` durante essa homologação e recebeu
`0053` somente na promoção protegida posterior.

O repositório agora possui `0054_payments_hardening`, 55 entradas e 41 tabelas no
snapshot local. Em 2026-08-03, o SQL foi validado primeiro numa branch temporária
descendente de Staging com `0053`; depois, Development, Staging e Production receberam
`0054`. Os três alvos apresentaram 55 entradas no journal, topo em `1785744643480`, hash
`95468fdf6ece0c5873406d9de4e2a5aeee20511d0ebf226d67f1f921a9f673b1`, a tabela de
cursor do extrato e as seis constraints financeiras esperadas. Development também
recebeu a `0053` que ainda estava pendente e uma segunda execução do migrador confirmou
idempotência. Production teve zero violações no preflight e recebeu antes uma branch de
backup `payments-hardening-backup-20260803`. O identificador da branch temporária foi
removido após a retenção operacional; não reutilize esse ID. O perfil
persistente `vercel-preview` continua dormente e, por contrato, não recebe migrations.

O repositório também possui `0055_limit_course_installments`, que reduz para 12 o teto
configurável de parcelas dos Cursos sem reescrever snapshots históricos dos Pedidos. Em
2026-08-03, o SQL foi exercitado numa branch Neon descartável descendente de Production:
zero Cursos exigiram normalização e a constraint resultante aceitou somente valores de 1
a 12. Development recebeu a migration e passou a ter 56 entradas, topo em
`1785751899658`. Esse registro é histórico do ensaio de 2026-08-03; o estado atual dos
alvos persistentes está descrito no parágrafo de 2026-08-07 abaixo.

Uma PR draft pausada `#26` usou anteriormente o rótulo experimental
`0056_asaas_installment_pricing`; esse experimento não integra a cadeia atual e seus
objetos não devem ser reutilizados. `0056_certificate_state_invariants` é a
última migration do módulo de Certificados já promovida aos ambientes compartilhados.

A migration local `0057_pink_chronomancer` adiciona o override nullable de carga
horária em `certificate_templates` e sua constraint de não negatividade. A
`0058_reconcile_certificate_state_invariants` reconcilia o drift catalogado em
Development antes de liberar o runtime compatível com o novo contrato. As duas
foram geradas e revisadas em 2026-08-08. `0057` e `0058` foram promovidas somente
a Development (`br-cool-voice-acsxtxyv`) pelo runner guardado, com autorização
explícita; Staging e Production continuam sem essas migrations. O journal de
Development ficou com 61 entradas, topo em `1786206200471`, e o postflight
confirmou a coluna de carga horária, sua constraint, as três constraints de
revogação e a FK de Curso em `ON DELETE RESTRICT`.

Uma auditoria somente-leitura em 2026-08-08 confirmou que Development
(`br-cool-voice-acsxtxyv`) ainda não possuía a coluna de `0057`. A mesma auditoria
encontrou uma divergência anterior: o journal registrava `0056`, mas os três checks
de estado de revogação dessa migration estavam ausentes e a FK de Curso usava
`ON DELETE CASCADE`. Esse drift foi reconciliado por `0058` antes da promoção em
Development; as próximas promoções ainda devem usar uma branch Neon descartável e
o workflow protegido.

Em 2026-08-07, `0056_certificate_state_invariants` foi aplicada pelo runner oficial na
branch Staging `br-rapid-rain-acnqzhiv`. O journal passou a 57 linhas, topo
`1786099773858`, hash `a65efc91b945926a6e1ea2f607324c28e1dac6650798ac5716e3d885c88e22f1`;
o postflight confirmou três constraints de revogação, FK de Curso em `ON DELETE RESTRICT`
e zero Certificados. Uma segunda execução do runner foi idempotente, sem nova linha ou
reaplicação de DDL. Production permanece em 0054; a promoção protegida precisa aplicar
0055, 0056, 0057 e 0058 em ordem, com backup e preflight.

`0042_serverless_job_leases` adiciona os leases persistentes dos crons e a fila
de limpeza de artes de Certificado. `0043_staged_admin_image_uploads` registra,
vincula ao agregado e garante claim exclusivo dos uploads administrativos
diretos ao R2. O primeiro desenho de `0042` foi exercitado na branch temporária
`br-raspy-cloud-aco4wfg2`, mas a validação foi descartada depois que a revisão
encontrou requisitos adicionais; a branch temporária foi removida sem promover
mudanças. A versão final foi validada na branch descartável
`br-wild-dew-ac538g2r`, promovida com autorização explícita e auditada antes da
remoção automática dessa branch.

Não execute `bun run db:migrate` em ambiente compartilhado sem URL direta conferida, branch/backup disponível, validação em banco descartável e aprovação explícita de promoção.

O procedimento normal não chama esse comando diretamente. Quando o pipeline
estiver liberado, o workflow `Migrate Neon development` atualiza Development
depois do merge e `Deploy Vercel production` atualiza Production antes do
deployment. O Preview de PR cria sua própria branch Neon efêmera, aplica a cadeia
validada e injeta a URL pooled somente naquele deployment; não migre a branch
persistente `vercel-preview`. Veja o [tutorial de release](production-release-guide.md).

Staging usa `db:migrate:staging`, `db:seed:staging-admin` e
`db:reset:staging`. Os três exigem URL direta, hostname, branch ID e a
confirmação literal `STAGING_OPERATION_CONFIRMATION=staging`; todos recusam o
compute Production conhecido antes de abrir conexão. O reset possui modo
`plan`, que lê contagens dentro de transação e faz rollback, e modo `execute`,
que exige `RESET_STAGING_DATA`, preserva `__drizzle_migrations`, recria somente
o Admin e limpa apenas o namespace físico `staging/` nos dois buckets
Development compartilhados. Não remove vídeos JMVStream. Antes do reset, o
workflow cria um backup usando o input `parent_branch` da action Neon e confere
via API que a branch criada descende da branch Staging configurada; se a
ancestralidade não coincidir, a execução é interrompida.

`db:seed:staging-admin` exige duas identidades e senhas distintas: o Admin
primário e o Admin de recuperação. As duas senhas precisam de pelo menos oito
caracteres. O comando normaliza os e-mails, executa as duas contas na mesma
transação, revoga sessões existentes depois de atualizar credencial/papel e
registra somente contagens sanitizadas. Ele não cria segredo TOTP nem backup
code; cada pessoa conclui esse setup pela interface.

## Autoridades

Compare sempre, nesta ordem operacional:

1. `src/db/schema.ts`;
2. SQL em `src/db/migrations`;
3. `src/db/migrations/meta/_journal.json` e snapshots gerados pelo Drizzle;
4. catálogo e journal do banco alvo.

`bun run db:migrations:check` verifica a integridade versionada. Ele não prova que o banco remoto recebeu as migrations.

Gerar ou commitar uma migration não altera banco algum. Cada branch Neon possui
seu próprio catálogo e journal. Executar o migrador em `development` não altera
`vercel-preview`, `production` ou branches já existentes. Uma branch nova herda
o estado da branch-pai no instante da criação e depois evolui de forma isolada.

O mesmo gate resolve o snapshot autoritativo pela última entrada do journal e
valida nele a paridade do catálogo de Certificados com `schema.ts`. Os snapshots
`0038` e `0039` permanecem como histórico forward-only da recuperação de
metadata, pois sua aplicação externa não pode ser descartada com segurança.
Para checks e novos diffs, somente o snapshot correspondente ao topo atual do
journal é autoridade; nesta cadeia local, `0067_snapshot.json`. O snapshot de
Production continua `0064_snapshot.json` até uma promoção protegida. As migrations Asaas e
da compra pública `0044` a `0052` foram geradas, ensaiadas em banco descartável e
promovidas para Production em 2026-07-31.

Em 2026-07-30, uma preparação E2E local chamou o migrador genérico enquanto
`drizzle.config.ts` carregava `DATABASE_URL_DIRECT` de `.env.local` com prioridade sobre
a URL E2E pretendida. O incidente originou o harness isolado descrito abaixo; a
execução acidental não vale como prova E2E nem como autoridade sobre o estado posterior
da branch.

Ainda em 2026-07-30, a auditoria do alvo Development vigente
(`br-cool-voice-acsxtxyv`) encontrou 44 entradas no journal, topo em `0043`, apesar de o
aplicativo local já exigir `0052`. Depois de confirmar zero Pedidos, Webhooks e
Concessões financeiras, e mediante autorização explícita, `0044` a `0052` foram
promovidas com `bun run db:migrate:development`. A auditoria posterior confirmou 53
entradas, `provider_checkout_id`, um único Admin preservado e uma segunda execução
idempotente. Production permaneceu inalterada em `0043` naquele ensaio.

No corte de 2026-07-31, dois planos consecutivos confirmaram o mesmo fingerprint
e as mesmas contagens no alvo Production. O workflow criou a branch de backup
`asaas-cutover-backup-20260731T045620Z` (`br-withered-tree-acj50vrb`) sem
expiração automática, removeu os dados descartáveis e preservou exclusivamente
um usuário, perfil, conta e sessão da pessoa Admin. O plano posterior confirmou
zero registros em todas as tabelas operacionais. Em seguida, o run
`30605515827` aplicou `0044` a `0052`, auditou o journal e promoveu a Release B.
A branch de backup deve permanecer durante a estabilização e não pode ser
removida sem aceite explícito.

A migration local `0059_material_madame_hydra` adiciona
`courses.workload_hours_override`, migra para esse campo o override manual
existente no template publicado (ou no rascunho mais recente, quando não há
publicado) e sincroniza o cache efetivo de `courses.workload_hours`, remove
`course_free_statement` do perfil emissor e remove
`certificate_workload_hours` do template. Ela preserva os snapshots históricos
porque apenas altera o schema vivo; o runtime mantém compatibilidade de leitura
para esses registros antigos. A migration foi gerada e revisada localmente. Em
2026-08-14, a branch persistente `development` (`br-cool-voice-acsxtxyv`) foi
reativada pelo Neon e recebeu `0059` com `bun run db:migrate:development`,
usando o endpoint direto validado pelo guard. O journal passou a 62 entradas,
com o hash `8479636c6c4b8843b752d076dce75217a72765b7b91c579492cdd1b9e7d997e8`;
o postflight confirmou `courses.workload_hours_override`, a constraint de não
negatividade e a remoção das duas colunas aposentadas. Staging e Production
permaneceram intocados nesta etapa.

`0061_paused_course_landing_url` permite manter uma landing opcional quando as
vendas estão fechadas. `0062_certificate_reconciliation_indexes` adiciona
`course_completions_course_reconciliation_idx` em
`(course_id, completed_at, id, user_id)` e o índice não parcial
`certificates_user_course_history_idx` em `(user_id, course_id)`. A migration é
somente aditiva e não altera linhas existentes; sua promoção continua sujeita
ao fluxo controlado deste runbook e ao advisory lock global do migrador. Ela não
emite Certificados nem reconcilia Conclusões; o lote permanece uma ação confirmada
de Admin depois da promoção.

`0063_support_requests` cria `support_requests`, sua referência à Conta e o índice
de consulta por usuário. `0064_certificates_preview_sha256` acrescenta o digest
opcional usado para verificar o preview persistido do Certificado. O snapshot e o
journal correspondentes são os artefatos autoritativos para novos diffs.

## Conexões

- runtime: `DATABASE_URL`, preferencialmente endpoint pooled;
- migrations e auditoria: `DATABASE_URL_DIRECT`, endpoint direto;
- fallback do Drizzle: `DATABASE_URL` se a URL direta estiver ausente;
- `withVerifiedSslMode` exige `sslmode=verify-full` para aliases menos estritos.

O pool web limita a espera de conexão a dez segundos, mantém no máximo três
conexões por instância Vercel e não recebe `DATABASE_URL_DIRECT`. Fora da
Vercel, a política local mantém no máximo dez conexões. A readiness usa um pool isolado de
uma conexão e timeout de um segundo, para falhar rápido sem impor essa latência
agressiva às requisições normais. Ela confirma a entrada da migration mínima
compatível declarada em `src/db/migration-state.ts`; a CI falha se esse
marcador não acompanhar o topo do journal.

Neon recomenda pooled em runtime serverless e direto para migrations, `pg_dump` e operações com estado de sessão. O plano Free não fornece proteção de branch; confirme manualmente projeto, branch, host, banco e usuário antes de qualquer escrita compartilhada.

## Migrations e geração

### `bun run db:generate`

Gera SQL, journal e snapshot; não aplica schema. Revise o SQL antes de aceitá-lo. Não edite journal ou snapshot manualmente.

Renomeações de tabela/coluna exigem que o Drizzle reconheça o pareamento. Quando o gerador pedir confirmação interativa, selecione a renomeação real, não uma criação e remoção equivalentes. Se a execução não tiver TTY, pare e rode o gerador em terminal interativo; não improvise metadata JSON.

A correção de progresso curricular está em `0036_ambitious_shinobi_shaw`: adiciona uma chave estável às Aulas e uma unicidade parcial para publicação `draft`. Foi gerada em terminal interativo; antes de promovê-la, revise o SQL para confirmar que contém somente essas três alterações e valide-a em banco descartável.

`0040_certificate_render_claim` adiciona o token e o instante do claim persistido de renderização. Os checks exigem que ambos sejam nulos ou preenchidos em conjunto e que um Certificado `ready` possua chave, hash e data de renderização sem claim ativo. A migration foi gerada normalmente pelo Drizzle e validada antes da promoção.

### Recuperação de snapshot após migration customizada

Uma migration criada com `--custom` preserva o snapshot anterior. Se o SQL manual alterar o catálogo, nunca reescreva sua migration, journal ou snapshot depois de aplicada. Corrija primeiro `schema.ts`; em terminal interativo, gere uma migration normal de baseline; revise o diff e substitua apenas seu SQL por no-op comentado quando o catálogo do alvo já possuir as alterações. O snapshot e journal produzidos pelo Drizzle passam a ser a nova base para diffs futuros. Valide a cadeia inteira em banco descartável antes da promoção.

### `0033_default_learning_analytics_preference`

O SQL forward-only renomeia `learning_analytics_consents` para
`learning_analytics_preferences`, renomeia `consented_at`/`revoked_at` para
`enabled_at`/`disabled_at`, remove `learning_reengagements` e seu enum. A
próxima geração de schema que envolver renomeação deve continuar sendo
revisada em terminal interativo para o Drizzle reconhecer o pareamento sem
metadata manual.

### `0034_remove_privacy_request_workflow`

Remove `privacy_requests` e seu enum, que não possuem usuário solicitante, fluxo administrativo ativo ou política jurídica aprovada. Foi promovida em 2026-07-22 para o ambiente sem produção ativa, após auditoria de pré-condições.

### `bun run db:migrate`

Só na promoção controlada. Não é onboarding e não substitui auditoria de schema.

### `bun run db:migrate:development`

É o comando exclusivo do workflow manual `Migrate Neon development`. Exige
`DATABASE_URL_DIRECT` e `DEVELOPMENT_DATABASE_HOST`, normaliza aliases
pooled/direto, recusa hostname divergente e recusa explicitamente o compute
Production conhecido. Depois da guarda, reutiliza o advisory lock global e
aplica somente migrations pendentes.

Não execute esse comando manualmente na rotina local. O workflow protegido usa
somente o SHA atual da `main` com CI verde e audita o banco depois da aplicação.

### `bun run db:migrate:production`

É o comando de promoção para produção. Exige `DATABASE_URL_DIRECT`, adquire um
advisory lock global, executa a cadeia Drizzle e libera conexão/lock mesmo em
falha. No fluxo Vercel, o workflow protegido executa esse comando como etapa
isolada antes de construir o deployment Production não promovido. Nunca
execute como hook de inicialização da aplicação.

### `bun run db:cleanup:production`

É o comando excepcional do corte Asaas para remover dados de teste em Production,
preservando somente a Conta Admin atual e sua identidade. Não executa migration nem
deploy. Use exclusivamente pelo workflow manual
`cleanup-production-test-data.yml`, no GitHub Environment protegido
`vercel-production`.

O modo `plan` é somente leitura: valida host, database, branch Neon, as 38 tabelas
exatas do schema `0043`, as 44 entradas do journal, um único Admin utilizável e as
contagens; depois retorna um fingerprint SHA-256 sem PII. Ele não cria backup. O
checkout deve estar em `PAYMENTS_CHECKOUT_MODE=disabled` antes do corte.

O modo `execute` exige o fingerprint do `plan`, `confirm_cleanup=true` e a confirmação
literal `DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN`. O workflow confirma `main` e CI,
valida projeto/branch de origem, cria primeiro uma branch Neon de backup sem compute e
sem expiração automática e só então executa uma transação serializável. Drift de
schema, journal, Admin, contagem, fingerprint ou alvo aborta antes da exclusão.

O GitHub Environment precisa do secret `NEON_API_KEY`, do secret
`DATABASE_URL_DIRECT` e das variables `PRODUCTION_NEON_PROJECT_ID`,
`PRODUCTION_NEON_BRANCH_ID` e `PRODUCTION_DATABASE_HOST`. Logs mostram somente
contagens, fingerprint, status e ID da branch de backup; URL, credenciais, IDs de
Conta e PII são proibidos.

O journal aplicado em Production possui quatro hashes históricos que diferem do SQL
hoje versionado (`0009`, `0037`, `0038` e `0039`). O contrato fixa os hashes realmente
aplicados e calcula os outros 40 com quebras de linha LF canônicas, evitando divergência
artificial em checkouts Windows com CRLF sem enfraquecer a comparação linha a linha.

Em 2026-07-29, executor e CLI foram validados numa clone descartável de Production: o
`plan` real passou em transação somente leitura, sem alterar o schema `public`; a suíte
de integração cobriu execução, drift, tabela inesperada, lock concorrente, rollback e
reexecução. A branch temporária foi removida após a prova.

## Comandos bloqueados

### `bun run db:reset` e `bun run db:reset:local`

São destrutivos e só aceitam `NODE_ENV=development`/`test`, host local, banco listado em `LOCAL_DATABASE_NAMES`, `--allow-destructive-local-reset` e `--confirm=<nome-do-banco>`. Exemplo para banco descartável local:

```bash
bun run db:reset:local -- --allow-destructive-local-reset --confirm=hub_test
```

Nunca execute contra Neon, Vercel ou qualquer ambiente compartilhado.

### `bun run db:seed` e `bun run db:seed:student`

São somente para banco local descartável. O seed de Aluna cria Concessão manual e deriva Matrícula com `rebuildEnrollmentProjection`; não cria Pedido financeiro fictício.

### `bun run db:smoke:empty`

Cria banco PostgreSQL local temporário, aplica a cadeia, roda seed duas vezes e remove o banco ao terminar. Requer `SMOKE_DATABASE_URL` ou URL local e recusa host remoto. É o smoke indicado para CI quando houver PostgreSQL local descartável.

### `bun run test:certificates:integration`

Executa concorrência de conclusão, outbox, inbox Asaas e assurance privilegiada
em PostgreSQL real. Requer `CERTIFICATE_CONCURRENCY_DATABASE_URL` de banco
descartável migrado. A suíte da inbox prova claim único entre dois workers,
rollback do efeito, perda de posse e terminalização da quinta tentativa
abandonada. A suíte de autenticação prova setup e challenge TOTP, consumo único
de backup code, revogação de sessão por mudança de papel e lockout. Nunca aponte
para banco compartilhado.

### `bun run db:push` e `bun run db:studio`

Não são alternativas para onboarding nem promoção. `db:push` altera schema sem histórico; Studio permite mutação manual e exposição de dados sensíveis.

## Promoção controlada

1. Confirme projeto, branch, host, database e usuário da URL direta sem registrar segredo.
2. Rode `bun run db:migrations:check` e valide a migration em banco descartável.
3. Crie backup ou branch isolada quando disponível; no Free, registre a ausência de proteção e o plano de recuperação.
4. Rode `bun run db:migrations:inspect -- --environment=<rótulo-sem-segredo>` em modo somente leitura.
5. Aplique `bun run db:migrate:production` uma única vez com aprovação explícita.
6. Audite catálogo e journal; execute migrador uma segunda vez para confirmar ausência de reaplicação.
7. Registre ambiente, operadora, migrations esperadas/aplicadas e impacto.

Em dados existentes, valide contagens e relações antes e depois. Rollback preferencial é forward-fix revisado; não use reset como rollback.

Backups de release Neon seguem retenção limitada, não exclusão por idade
isolada. Preserve as quatro branches persistentes (`production`, `staging`,
`development` e `vercel-preview`), a branch histórica
`asaas-cutover-backup-*` e o backup mais recente de cada ambiente. Para
backups `staging-release-*` ou `production-release-*` superseded, execute o
workflow separado em dry-run, confira projeto, parent e ausência de rollback
em andamento e somente então use a confirmação explícita
`cleanup-release-backups`. O cleanup nunca considera branches fora desses
prefixos nem estados que não estejam `ready`.

## Histórico operacional confirmado

- `0000` a `0040`: aplicadas em 2026-07-25 ao novo projeto vazio
  `neurocapacitar-lms`, após duas execuções bem-sucedidas na branch temporária
  `migration-verify-official`. A segunda execução confirmou idempotência. A
  produção apresentou 41 entradas no journal, 35 tabelas, 51 de 51 checks de
  estado presentes e zero Contas, Cursos, Certificados, Pedidos ou mensagens de
  outbox. A branch temporária foi removida após a auditoria.
- `0000` a `0040`: promovidas também em 2026-07-25 para o alvo definitivo
  `damp-snow-22911188`, branch `production` (`br-dark-boat-ac5ju6m4`).
  A auditoria confirmou 41 entradas no journal e 35 tabelas antes da criação da
  primeira Conta Admin.
- `0023`/`0024`: validadas em branch temporária e promovidas uma vez para `production`; auditoria posterior confirmou outbox vazio e journal com 25 entradas.
- `0025` a `0030`: promovidas em 2026-07-21; são histórico da introdução de versões curriculares. A base não continha Cursos, Matrículas ou Certificados, portanto não é evidência de backfill com dados históricos.
- `0031`/`0032`: promovidas para suportar analytics minimizado e métricas diárias. A configuração de produção e dados externos permanecem sujeitos a verificação humana no painel.
- `0033` a `0040`: promovidas em 2026-07-25 pelo workflow de migration do Neon
  após execução e auditoria em branch temporária. A verificação posterior em
  `production` confirmou 41 entradas no journal, topo `0040`, tabelas de
  publicações/conclusões/templates, ausência de `course_versions` e `pdf_url`,
  oito campos de renderização, três constraints críticas, três índices
  parciais esperados e zero duplicidades entre Certificados válidos. O banco
  tinha zero Cursos e zero Certificados, portanto os backfills não foram
  exercitados com dados históricos.
- `0041_public_signup_student_profiles`: promovida em 2026-07-25 para o alvo
  definitivo. A auditoria Vercel-first confirmou 42 entradas no journal e
  paridade com o repositório.
- `0042_serverless_job_leases`: o primeiro ensaio em 2026-07-26 na branch
  temporária `br-raspy-cloud-aco4wfg2` confirmou o mecanismo básico, mas foi
  cancelado sem promoção após a revisão exigir deadlines e fencing adicionais.
- `0043_staged_admin_image_uploads`: gerada em 2026-07-26 para registrar,
  confirmar, reivindicar e consumir uma única vez uploads administrativos
  vinculados ao ator e agregado. A validação conjunta autoritativa de
  `0042`/`0043` está na migration Neon
  `ff79a0c9-5404-49d1-8582-bd7675fb8015`, branch temporária
  `br-wild-dew-ac538g2r`: confirmou 44 entradas, hashes do repositório, topo
  `0043`, quatro índices, três constraints e exclusão mútua/reclaim dos claims.
  A migration foi promovida com autorização explícita em 2026-07-26. A
  auditoria da branch definitiva repetiu as mesmas evidências e confirmou zero
  leases, limpezas ou uploads temporários residuais.
- `0044` a `0051`: migrations da troca direta para Asaas. Incluem persistência do
  comércio/inbox/revisões, evidência real de reembolso, limites públicos, valores
  líquido/tarifa e extrato financeiro deduplicado. Em 2026-07-29, foram aplicadas e
  auditadas na branch descartável `br-autumn-mouse-ac9ti4dr`, sem promoção para a
  branch-pai. O primeiro ensaio confirmou que `0046` exige `orders` vazio: a branch
  herdava cinco Pedidos de teste, dois webhooks e duas Concessões pagas. Após remover
  somente esses dados financeiros de teste na branch isolada, a cadeia chegou ao topo
  `0051`, a auditoria confirmou todas as entradas e os 20 testes PostgreSQL passaram.
  Essa limpeza é uma pré-condição explícita do corte direto, não um backfill nem uma
  autorização para alterar a branch persistente antes da Etapa 10.
- `0053`: adiciona a oferta comercial por Curso e seus snapshots por Pedido,
  incluindo métodos aceitos, teto de parcelamento e correlação pelo agregado de
  parcelas. Foi exercitada pela CI em branches Neon isoladas e promovida somente
  para Staging em 2026-08-01.
- `0054`: adiciona o cursor retomável da importação de extrato e checks aditivos de
  valores não negativos e consistência entre estado financeiro e evidência. Antes de
  criar os checks, a própria migration executa auditoria somente leitura e aborta com
  erro explícito se encontrar divergência; ela não corrige nem apaga Pedido ou reembolso.
  O SQL, journal e snapshot foram gerados pelo Drizzle, passaram em
  `db:migrations:check` e foram promovidos aos alvos persistentes em 2026-08-03;
  o estado atual de cada branch deve ser conferido no catálogo antes de nova promoção.
- Em 2026-07-31, o primeiro run do PR da Release B falhou nas duas jobs PostgreSQL:
  ambas clonaram os cinco Pedidos da branch `production`, e `0046` recusou os snapshots
  `NOT NULL`. O pipeline passou a preparar esses clones com o comando guardado descrito
  acima, reproduzindo a ordem real do corte sem alterar a branch-pai.
- `db:smoke:empty` não foi executado no host da Etapa 9 porque PostgreSQL local não está
  instalado. A guarda recusaria corretamente a branch Neon remota; não foi afrouxada nem
  contornada. A cadeia incremental e o catálogo foram provados na branch descartável,
  mas o smoke local desde banco vazio permanece para um runner com PostgreSQL local.

## Recuperação

- pare deploys e a escrita afetada em divergência;
- registre migration esperada, aplicada e impacto;
- restaure aplicação compatível com o schema ou aplique forward-fix revisado;
- não use `db:reset`, `db:push` ou rollback SQL destrutivo;
- para ensaio, use branch/banco isolado e siga [Observabilidade e recuperação](observability-and-recovery.md#ensaio-de-recuperação).

## Banco da jornada pública E2E

Os helpers financeiros Playwright aceitam exclusivamente `E2E_DATABASE_URL`. Ausência da
variável falha com mensagem explícita; não existe fallback para `DATABASE_URL`, Development
ou Production. A suíte deve receber uma branch descartável já migrada.

A guarda central roda na configuração Playwright antes do `globalSetup` e também no setup,
seed, teardown e global teardown. Todo processo que pode alterar o banco exige
`DATABASE_URL` exatamente igual a `E2E_DATABASE_URL`, aceita somente protocolo PostgreSQL e
recusa o compute Neon Production conhecido sem registrar URL ou credencial. Uma
`DATABASE_URL` preexistente e divergente aborta a suíte antes do seed.

Para migrar a branch descartável, use somente `bun run db:migrate:e2e`. O harness exige
`DATABASE_URL` e `E2E_DATABASE_URL` iguais, recusa uma `DATABASE_URL_DIRECT` divergente e
fixa as três variáveis na mesma URL antes de iniciar diretamente o migrator
`drizzle-orm/node-postgres`. Ele não abre um processo `drizzle-kit`, evitando
divergência de ambiente e o bloqueio observado sob Bun em migrations de baseline
compostas somente por comentário. Assim, `.env.local` não pode redirecionar o migrador:

```powershell
$env:E2E_DATABASE_URL = "<url-postgresql-descartavel>"
$env:DATABASE_URL = $env:E2E_DATABASE_URL
$env:DATABASE_URL_DIRECT = $env:E2E_DATABASE_URL
bun run db:migrate:e2e
```

O comando `bun run db:prepare:ci-migration` não é de uso manual. A CI o executa somente
nas branches criadas pela própria job. Ele valida ambiente CI, branch Neon, URLs,
compute não Production e journal antes de truncar `orders` com dependências somente no
clone efêmero herdado de `0043`. O journal diferente de `0043`, `0052`, `0053` ou `0054`
interrompe o comando; em `0052`, `0053` ou `0054`, ele não altera dados.
Assim, a exceção de
corte não se transforma em limpeza recorrente nem bloqueia a CI depois da promoção.

## Evidências

`drizzle.config.ts`, `src/db/index.ts`, `src/db/connection-url.ts`,
`src/db/migration-target.ts`, `src/db/schema.ts`,
`src/db/migrations/meta/_journal.json`, `scripts/check-migrations.ts`,
`scripts/inspect-migration-state.ts`, `scripts/migrate-development.ts`,
`scripts/migrate-e2e.ts`,
`scripts/reset-local-database.ts`, `scripts/seed-initial-data.ts` e
`scripts/bootstrap-student.ts`.
