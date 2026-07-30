---
status: proposed
owner: engineering
last_verified_commit: ba883f14af8d8587b5eb0aec75e3969fa937ffcd
---

# Limpeza e contenção para o corte Asaas em Production

## Contexto

A substituição direta do AbacatePay pelo Asaas exige aplicar as migrations `0044` a
`0051`. A migration `0046` adiciona snapshots obrigatórios a `orders` sem backfill do
contrato legado, portanto todos os Pedidos de teste precisam ser removidos antes do DDL.

O preflight somente leitura de 2026-07-29 confirmou que Production está no topo `0043`
e contém cinco Pedidos AbacatePay, dois webhooks e duas Concessões financeiras. A
responsável confirmou que todos os dados de todas as branches são testes descartáveis,
incluindo pagamentos, Cursos, Alunas e conteúdo. A única exceção aprovada é a Conta
Admin atual, que deve permanecer utilizável.

O código Asaas está apenas no worktree `codex/asaas-migration`. Não há commit, push,
Pull Request, CI remota ou autorização de release. Esta especificação não autoriza
nenhuma dessas ações.

## Objetivos

- Remover de forma auditável todo o conteúdo operacional de teste.
- Preservar exatamente uma Conta Admin utilizável e suas credenciais Better Auth.
- Preservar schema, enums, extensões e o journal Drizzle.
- Impedir exclusão se o banco mudar entre dry-run e execução.
- Separar a limpeza destrutiva do workflow recorrente de deploy.
- Publicar o código novo com checkout e webhook Asaas contidos até o smoke controlado.
- Permitir smoke autenticado sem abrir o checkout público.

## Fora de escopo

- Migrar, transformar ou importar dados AbacatePay.
- Preservar Cursos, Alunas, progresso, mídia, pagamentos ou auditoria de teste.
- Executar limpeza automaticamente em todo deploy.
- Fazer pagamento ou reembolso real sem supervisão.
- Alterar Production durante a implementação e os testes desta especificação.
- Remover a Conta Admin aprovada.

## Decisões

### Workflow destrutivo separado

A limpeza terá um workflow manual próprio. O workflow `Deploy Vercel production` não
apagará dados. Essa separação impede que um rerun de deploy repita uma operação
destrutiva e mantém a autorização visível.

### Um Admin preservado

O dry-run deve localizar exatamente um `profiles.role = 'admin'` e comprovar:

- uma linha correspondente em `users`;
- ao menos uma linha `accounts.provider_id = 'credential'` com `password` não nula;
- ausência de bloqueio de plataforma;
- nenhuma segunda Conta Admin.

Serão preservados somente:

- a linha Admin em `users`;
- seu `profile`;
- suas linhas em `accounts`;
- suas linhas em `sessions`.

Todas as demais Contas e todos os demais registros de aplicação serão removidos.
`verifications` também será esvaziada.

O relatório nunca exibirá nome, e-mail, senha, token, sessão ou identificador externo.
O ID do Admin entra apenas como hash no fingerprint.

### Allowlist fechada de tabelas

O script consultará `information_schema` e comparará as tabelas existentes com uma
allowlist versionada. Tabela nova, ausente ou inesperada interrompe dry-run e execução.

A limpeza usará um único `TRUNCATE` explícito, sem `CASCADE`, contendo todas as tabelas
operacionais e dependentes. As quatro tabelas de identidade preservadas (`users`,
`profiles`, `accounts`, `sessions`) ficam fora do `TRUNCATE`. O conjunto descartável
do schema `0043` é:

- `app_settings`, `audit_logs`, `certificate_issuer_profiles`,
  `certificate_template_asset_cleanup`, `certificate_templates`, `certificates`;
- `course_completions`, `course_publications`, `courses`, `dashboard_banners`;
- `enrollment_events`, `enrollment_expiration_adjustments`, `enrollment_grants`,
  `enrollments`;
- `faq_items`, `jmvstream_folders`, `jmvstream_video_assets`;
- `learning_analytics_daily_metrics`, `learning_analytics_events`,
  `learning_analytics_preferences`;
- `lesson_comments`, `lesson_progress`, `lesson_watch_progress`, `lessons`, `modules`;
- `orders`, `outbox_messages`, `payment_reviews`, `public_certificate_rate_limits`,
  `refund_requests`, `scheduled_job_leases`, `staged_admin_image_uploads`,
  `verifications` e `webhook_events`.

Depois do `TRUNCATE`, um único `DELETE FROM users WHERE id <> $adminId` remove as
demais Contas. As FKs `ON DELETE CASCADE` removem seus `profiles`, `accounts` e
`sessions`. A transação confirma que somente as quatro classes de linha aprovadas
permaneceram. Incluir todas as tabelas referenciadoras no mesmo `TRUNCATE` permite
manter `CASCADE` proibido e faz uma FK nova interromper a operação.

O script não usa SQL dinâmico derivado diretamente do catálogo. Os identificadores de
tabela vêm somente da allowlist constante e revisada.

### Fingerprint contra drift

O dry-run produzirá um SHA-256 sobre JSON canônico contendo:

- hostname normalizado, database e branch esperados;
- quantidade e hash dos registros do journal;
- lista exata de tabelas públicas;
- contagem de linhas por tabela;
- contagem de Admins;
- hash do ID do Admin preservado.

O fingerprint não contém PII nem secrets. A execução recebe o fingerprint como input,
abre transação, adquire `ACCESS EXCLUSIVE` nas 38 tabelas da allowlist em ordem
determinística, recalcula o snapshot e exige igualdade exata antes de qualquer
exclusão. Assim, nenhuma escrita concorrente pode entrar entre a conferência e o
`TRUNCATE`.

### Backup antes da exclusão

O workflow criará uma branch Neon a partir de Production imediatamente antes da
execução. O ID da branch será registrado sem URL de conexão. A branch será preservada
durante a estabilização de 14 dias da Etapa 11 e removida somente depois do aceite.
Ela não terá expiração automática.

Se a criação ou a confirmação da branch falhar, a limpeza não começa.

O GitHub Environment `vercel-production` deverá receber o secret `NEON_API_KEY` e as
variáveis `PRODUCTION_NEON_PROJECT_ID` e `PRODUCTION_NEON_BRANCH_ID`. O token terá
somente a permissão mínima necessária para inspecionar o projeto e criar a branch. O
workflow recusa IDs ausentes e confirma pela API que a branch de origem informada é a
branch Production esperada.

### Alvo Production verificado

O GitHub Environment terá uma variável `PRODUCTION_DATABASE_HOST`. O script exige
`DATABASE_URL_DIRECT`, normaliza alias pooled/direto e compara o hostname exato. Ele
também exige `--environment=production` e confirma que o journal está exatamente no
topo `0043`, com 44 entradas conhecidas, antes da limpeza.

Nenhum valor de conexão aparece no output.

## Duas releases e contenção

O preflight encontrou uma lacuna: o plano exige pausar e reabrir checkout, mas o código
não possui kill switch explícito. Falhar pela ausência de credencial Asaas é fail-safe,
porém não permite smoke autenticado separado da abertura pública.

A contenção será entregue primeiro em uma Release A pequena, compatível com o schema
`0043` e com o código AbacatePay ainda publicado. Ela introduzirá
`PAYMENTS_CHECKOUT_MODE`:

- `disabled`: nenhuma entrada cria Pedido ou chama provider;
- `authenticated`: somente a action de uma Aluna autenticada pode criar checkout;
- `public`: action autenticada e `POST /api/checkouts/course` ficam disponíveis.

O servidor verifica o modo antes de banco, rate limit ou provider. A interface pode
ocultar ou desabilitar ações, mas não é autoridade. Production exige valor explícito;
Preview aceita somente `disabled`; Development usa `public`.

A Release B conterá a migração Asaas completa e introduzirá
`ASAAS_WEBHOOK_ENABLED`:

- `false`: a rota Asaas recusa entrega antes de ler o corpo ou acessar banco;
- `true`: a rota exige o token normal e segue persist-before-200.

O worker cron não processa inbox Asaas quando a flag está falsa. O kill switch global
`SCHEDULED_JOBS_ENABLED` não será reutilizado, pois desligá-lo também interromperia
outbox, matrículas, JMVStream e manutenção.

As duas releases passam separadamente por Pull Request, CI e deploy aprovado. Isso é
necessário porque o workflow Production atual aplica migrations antes de publicar:
tentar publicar toda a implementação Asaas apenas para obter o kill switch aplicaria
`0044` a `0051` cedo demais.

## Componentes

### Núcleo puro

Um módulo sob `src/db` conterá:

- parser dos argumentos de dry-run/execute;
- validação do alvo;
- validação da allowlist;
- construção do snapshot canônico;
- fingerprint;
- validação das pré e pós-condições.

Esse módulo não abre conexão nem executa SQL e terá testes unitários.

### Executor

Um script sob `scripts`:

1. carrega somente `DATABASE_URL_DIRECT`;
2. valida alvo e argumentos;
3. abre conexão com `application_name` identificável;
4. adquire advisory lock dedicado;
5. executa dry-run em transação `READ ONLY` ou execução em `SERIALIZABLE`;
6. impõe `statement_timeout` e `lock_timeout`;
7. produz somente contagens, fingerprint e resultado seguro;
8. encerra conexão em sucesso ou falha.

### Workflow

Um workflow `workflow_dispatch` separado terá:

- input `mode=plan|execute`;
- no modo `execute`, input booleano `confirm_cleanup`;
- no modo `execute`, confirmação literal `DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN`;
- no modo `execute`, fingerprint obrigatório produzido pelo modo `plan`;
- GitHub Environment `vercel-production`;
- concorrência própria sem cancelamento;
- checkout obrigatório da `main` atual com CI verde;
- criação da branch de backup;
- execução transacional;
- auditoria pós-limpeza;
- nenhum deploy e nenhuma migration.

O modo `plan` nunca aceita nem executa SQL de escrita, não cria branch de backup e não
exige confirmação destrutiva. A branch de backup é criada somente pelo modo `execute`,
depois de todas as validações e imediatamente antes da transação de limpeza.

## Sequência operacional

1. Integrar a Release A de contenção na `main` com CI verde.
2. Configurar `PAYMENTS_CHECKOUT_MODE=disabled` em Production.
3. Publicar a Release A pelo workflow Production, sem migrations novas.
4. Confirmar health/readiness, bloqueio dos dois checkouts e login do Admin.
5. Integrar a Release B Asaas na `main` com CI verde, sem publicá-la ainda.
6. Configurar `PRODUCTION_DATABASE_HOST`, `PRODUCTION_NEON_PROJECT_ID`,
   `PRODUCTION_NEON_BRANCH_ID` e o secret `NEON_API_KEY`.
7. Executar o workflow de limpeza em modo `plan`.
8. Revisar contagens e fingerprint.
9. Executar o workflow em modo `execute` com as duas confirmações e o fingerprint.
10. Confirmar um Admin, zero linhas operacionais e journal ainda em `0043`.
11. Configurar credencial, base URL, User-Agent e token de webhook Asaas Production,
    além de `ASAAS_WEBHOOK_ENABLED=false`.
12. Executar o workflow Production para aplicar `0044` a `0051` e publicar a Release B.
13. Confirmar health/readiness e cadastrar o webhook Asaas não sequencial inicialmente
    interrompido.
14. Ativar `ASAAS_WEBHOOK_ENABLED=true` e confirmar fila/worker.
15. Usar `PAYMENTS_CHECKOUT_MODE=authenticated` para PIX, cartão e reembolso
    controlados.
16. Conferir taxas, extrato, alertas, Pedido, Concessão e Matrícula.
17. Alterar `PAYMENTS_CHECKOUT_MODE=public`.
18. Revogar chave e webhook AbacatePay.
19. Manter a branch de backup durante os 14 dias de estabilização.

Variáveis alteradas só entram em vigor em um novo deployment. Cada lote operacional de
alterações será seguido por deployment Production explícito, readiness e promoção.
Não existe mutação silenciosa no deployment em execução.

## Falhas e recuperação

- Drift de fingerprint: abortar antes de exclusão e repetir dry-run.
- Admin ausente, duplicado, bloqueado ou sem senha: abortar.
- Tabela inesperada: abortar e revisar a allowlist.
- Falha ao criar backup: abortar.
- Falha dentro da limpeza: rollback integral.
- Pós-condição inválida: rollback integral.
- Limpeza concluída e deploy falhou: manter checkout desabilitado; o schema `0043`
  continua válido com banco vazio e a Release A mantém o Admin acessível.
- Migration aplicada e deploy falhou: seguir forward-fix; nunca restaurar SQL
  destrutivamente.
- Primeiro pagamento Asaas criado: não reativar AbacatePay como rollback.

## Testes

### Unitários

- parser recusa confirmação incompleta;
- modo dry-run nunca autoriza escrita;
- hostname, ambiente e topo do journal divergentes são rejeitados;
- zero ou mais de um Admin são rejeitados;
- Admin sem credencial de senha ou bloqueado é rejeitado;
- tabela inesperada ou ausente é rejeitada;
- JSON canônico gera fingerprint estável;
- mudança de uma contagem altera o fingerprint;
- output seguro não contém PII nem conexão;
- modos de checkout respeitam `disabled`, `authenticated` e `public`;
- Preview rejeita modo diferente de `disabled`;
- webhook e worker recusam operação quando desabilitados.

### PostgreSQL descartável

- dry-run não altera linha alguma;
- execução remove todos os dados operacionais;
- Admin, profile, credencial e sessões permanecem;
- outras Contas, sessões e credenciais são removidas;
- journal, schema e enums permanecem;
- FK nova ou tabela inesperada aborta;
- fingerprint divergente aborta sem mudança;
- execução concorrente perde o advisory lock;
- falha intermediária provoca rollback;
- segunda execução não é aceita como limpeza nova sem novo dry-run.

### Workflow e contrato

- workflow exige `main`, CI verde e GitHub Environment;
- cleanup não chama migration, deploy ou Vercel;
- deploy não chama cleanup;
- secrets não são interpolados em argumentos ou logs;
- flags permanecem contidas no candidato inicial.

## Critérios de aceite

- Especificação, plano, código e workflow revisados.
- Testes unitários, PostgreSQL, E2E, build, lint, tipos e documentação verdes.
- Dry-run Production revisado e fingerprint aprovado.
- Branch de backup confirmada.
- Limpeza executada uma vez e pós-condições aprovadas.
- Migrations `0044` a `0051` aplicadas e auditadas.
- Admin preservado consegue autenticar.
- Smoke Asaas autenticado aprovado antes da abertura pública.
- Checkout público aberto somente depois de fila, alertas, taxas e extrato conferidos.
