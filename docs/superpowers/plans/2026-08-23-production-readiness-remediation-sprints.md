---
status: accepted
execution_status: active
owner: engineering
last_verified_commit: aceeaf830cf75667df8ce21e5b586d47155dd5ac
current_sprint: 7
supersedes: docs/superpowers/plans/2026-08-23-email-auth-resend-completion-sprints.md
---

# Plano mestre de remediação da prontidão de Production

> Plano executável único para encerrar a auditoria de 23 de agosto de 2026.
> Execute uma tarefa por vez, preserve os identificadores `F-001` a `F-010` e
> pare em qualquer condição `STOP`. Nenhuma caixa marcada neste documento prova
> implementação por si só: cada conclusão exige código, teste e evidência.

## 1. Objetivo e autoridade

Este plano transforma a
[auditoria histórica](../../reviews/2026-08-23-production-readiness-audit.md) e a
[especificação aceita](../specs/2026-08-23-production-readiness-remediation-design.md)
em trabalho implementável. Ele é a única fonte executável para a remediação. O
plano anterior de e-mail e autenticação permanece apenas como histórico e não
deve ser executado em paralelo.

Resultado esperado:

- encerrar `F-001` a `F-010` com teste e evidência;
- provar Sentry, backup e restauração, que permaneceram lacunas críticas;
- preservar operação permanente em planos gratuitos, exceto Vercel por enquanto;
- requalificar o sistema antes de uma nova decisão `GO/NO-GO`;
- validar uma venda real somente depois do deploy em Production, com supervisão
  humana e autorização específica no momento da execução.

Base de planejamento: commit
`9f2b8f177e7531f1c19242099f403c55b3820d08`. Se o executor iniciar em outro
commit, deve refazer o baseline, conferir migrations e atualizar os caminhos ou
símbolos que tenham mudado antes de editar.

## 2. Restrições ratificadas

Estas decisões não são opções de implementação:

1. Senhas novas e redefinidas exigem no mínimo **8 caracteres** em todas as
   camadas.
2. `support` é papel operacional ativo, diferente de `student` e `admin`.
3. `support` pode consultar Cursos, Alunas, Matrículas, progresso, Certificados,
   Pedidos, receita e Revisões financeiras; ajustar validade e bloquear ou
   restaurar uma Matrícula; reemitir o Certificado existente mais recente; e
   executar reembolso integral.
4. `support` não administra Curso, conteúdo, preço, disponibilidade, template,
   banner, FAQ, configuração, provider, analytics detalhado, moderação,
   conciliação, extrato, decisão de Revisão, retry de webhook/outbox, bloqueio de
   plataforma, concessão manual, emissão ou revogação de Certificado.
5. Reembolso integral exige sessão privilegiada com TOTP, senha atual, ID exato
   do Pedido, motivo e auditoria. Não reduzir as proteções existentes em
   `src/features/payments/refunds.ts`.
6. `admin` e `support` exigem TOTP e códigos de recuperação. Mudança de papel
   revoga todas as sessões da Conta.
7. Neon continua no Free. Recuperação combina PITR disponível no plano e cópia
   lógica cifrada fora do Neon, em bucket R2 privado e dedicado.
8. RPO alvo é 6 horas e RTO alvo é 4 horas. Se a medição real não couber nas
   cotas gratuitas, medir 8 e 12 horas, propor o menor intervalo sustentável e
   registrar uma decisão explícita sobre o RPO efetivo antes do release; nunca
   habilitar cobrança nem reduzir a proteção silenciosamente.
9. Free trial só pode apoiar ensaio descartável. Não pode ser dependência de
   runtime, backup, monitoramento ou release.
10. DMARC progride de `none` até `reject; pct=100`; nenhuma etapa é pulada.
11. A venda real supervisionada não é gate pré-deploy, não roda em CI e não é
    automatizada.
12. Mudanças editoriais nos templates Resend e remoção de React Email estão fora
    deste plano.
13. O congelamento atual vale somente para Production. Staging/Preview pode
    receber merge, migration, configuração e deploy controlados para fechar os
    gates. Permanecem proibidos até novo `GO`: deploy/promoção Production,
    alias/DNS Production, migration ou dado Production, mudança de provider
    Production e venda real.

## 3. Estado inicial que deve ser reproduzido

O baseline de 23 de agosto de 2026 registrou:

- migration local e remota superior `0064_certificates_preview_sha256`;
- 65 entradas no journal e 43 tabelas no snapshot de Production;
- Vercel `READY`, alias `app.neurocapacitar.com.br`, região `gru1`, Node 24 e
  commit implantado `9f2b8f1`;
- PostgreSQL 18.6 no Neon, aproximadamente 35 MB e nenhuma concessão a `PUBLIC`;
- domínio Resend verificado, seis templates publicados, nenhum webhook e DMARC
  em `p=none`;
- zero mensagens na outbox, zero Certificados e zero solicitações de suporte na
  fotografia remota;
- API do Sentry respondeu 403 na coleta inicial; a retomada autenticada provou
  que `summit-studio-ij/protear` era o alvo incorreto e identificou a organização
  canônica `neurocapacitar`;
- Playwright configurado somente com Desktop Chrome e Axe bloqueando apenas
  impactos `serious` e `critical`;
- Dependabot cobrindo somente GitHub Actions.

Esses são fatos datados, não constantes. Sprint 0 deve refazê-los sem alterar
Production.

## 4. Princípios de execução

### 4.1 Teste antes da alteração

Para cada correção:

1. reproduzir a falha com teste ou inspeção objetiva;
2. executar o teste e guardar a falha decisiva;
3. implementar a menor mudança que fecha o contrato;
4. executar teste focal, depois os gates mais amplos;
5. atualizar o documento canônico afetado na mesma mudança;
6. registrar evidência sanitizada, sem token, URL assinada, e-mail, corpo de
   mensagem, dump, segredo ou payload bruto.

### 4.2 Migrations

- A cadeia termina em `0067_sparkling_ghost_rider`. Staging recebeu `0065`,
  `0066` e `0067` pelo workflow protegido; Development e Production continuam
  sem essas migrations, e Production permanece em `0064`.
- Se o topo mudar, usar os próximos números livres sem renomear migrations já
  aplicadas.
- Gerar SQL, journal e snapshot com `bun run db:generate`; não editar metadata
  Drizzle manualmente.
- Migrations são forward-only e compatíveis com a versão anterior da aplicação.
- Primeiro aplicar em branch Neon descartável, executar duas vezes e comprovar
  idempotência; depois seguir os workflows protegidos.
- Nunca usar `db:push`, `db:reset` ou rollback SQL em ambiente compartilhado.

### 4.3 Evidência

Cada Sprint deve acrescentar uma seção ao futuro arquivo
`docs/reviews/<data>-production-readiness-requalification.md` com:

- SHA completo e ambiente;
- comandos executados e códigos de saída;
- teste ou consulta que prova o contrato;
- IDs remotos somente quando não forem segredo nem PII;
- horário UTC, duração, operadora e resultado;
- risco restante e decisão `continue` ou `STOP`.

Saídas brutas sensíveis ficam fora do Git. Registre somente contagens, hashes,
status e identificadores sanitizados.

### 4.4 Gate comum de uma Sprint

Salvo indicação mais estreita, a Sprint termina com:

```powershell
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run check
bun run test
bun run build
bun run knip
bun audit --production
```

Use `bun run verify:quick` quando ele já reunir o subconjunto relevante. Um gate
que não possa rodar deve ser registrado como bloqueio, não como aprovado.

## 5. Dependências entre Sprints

1. Sprint 0 cria o baseline de todas as demais.
2. Sprints 1 e 2 podem ser implementadas separadamente, mas ambas são P1 e
   precisam terminar antes da requalificação.
3. Sprint 3 depende do baseline e deve terminar antes do lifecycle de e-mail,
   pois estabiliza a semântica da outbox.
4. Sprint 4 depende da migration e do worker da Sprint 3.
5. DMARC pode iniciar assim que o inventário de remetentes da Sprint 0 estiver
   completo, mas seu fechamento pertence à Sprint 5.
6. Sprint 6 depende da matriz de papéis da Sprint 1 para testar as jornadas
   corretas.
7. Sprint 7 só começa quando todas as implementações anteriores estiverem
   verdes.
8. Sprint 8 só começa depois de uma decisão `GO` documentada e de promoção
   aprovada para Production.

---

## Sprint 0: baseline reproduzível e evidências externas

**Estado em 2026-08-24T02:37:28Z:** `COMPLETED`. Baseline, gates, providers e
cadência de backup de 6 horas foram comprovados no
[relatório de requalificação](../../reviews/2026-08-23-production-readiness-requalification.md).
Uma credencial Sentry read-only separada identificou a organização real, os dois
projetos, releases, ambientes, Issues, alertas e canais. O `403` foi atribuído à
configuração obsoleta `summit-studio-ij/protear`. O token de upload ausente,
source maps, canal institucional e consolidação ficaram explicitamente destinados
ao Sprint 5. Decisão do gate: `CONTINUE` para o Sprint 1.

### Resultado

Produzir uma fotografia somente leitura, atualizada e repetível. Nenhuma
correção funcional entra nesta Sprint.

### Tarefa 0.1: fixar a base local

**Ler:** `docs/README.md` e o percurso canônico indicado nele.

**Criar:**

- `docs/reviews/<data>-production-readiness-requalification.md`

**Passos:**

- [x] Confirmar `git rev-parse HEAD`, branch, worktree e ancestralidade em
  `main`. Não descartar mudanças preexistentes.
- [x] Registrar versões de Bun, Node, Next.js, Better Auth, Resend, Drizzle,
  Playwright e PostgreSQL client.
- [x] Confirmar o último item de
  `src/db/migrations/meta/_journal.json`, o valor de
  `LATEST_COMPATIBLE_MIGRATION_TIMESTAMP` e a quantidade de tabelas exportadas
  por `src/db/schema.ts`.
- [x] Executar os gates comuns. Para E2E e integração, usar somente branch Neon
  descartável criada pelo workflow; nunca apontar a suíte para Production.
- [x] Salvar no relatório apenas resumo, duração e resultado. Logs completos
  permanecem como artefato privado da execução.

**Aceite:** outro executor consegue repetir os comandos no mesmo SHA e obter o
mesmo topo de migration e os mesmos gates.

### Tarefa 0.2: inventariar Vercel e Neon sem mutação

**Referências atuais:** endpoint Vercel `GET /v13/deployments/{idOrUrl}` com
`withGitRepoInfo=true`; runbooks
`docs/operations/production-release-guide.md` e
`docs/operations/database-and-migrations.md`.

**Passos:**

- [x] Consultar o alias canônico com integração Vercel somente leitura. Confirmar
  `readyState=READY`, `target=production`, alias atribuído, SHA Git completo,
  Node 24 e região `gru1`.
- [x] Consultar a branch Neon configurada como Production e confirmar projeto,
  branch ID, parent, estado e compute. Não abrir endpoint de escrita.
- [x] Pela URL direta de auditoria, iniciar transação `read only`, consultar
  `version()`, journal, tamanho do banco, contagem de tabelas e grants. Encerrar
  com rollback.
- [x] Medir transferência e armazenamento usados no mês para definir a reserva
  de backup da Sprint 2.
- [x] Comparar os resultados com `docs/operations/release-state.md`. Qualquer
  divergência recebe `F-007` e bloqueia promoção, mas não autoriza correção
  automática do Markdown.

**STOP:** alias não aponta para o SHA esperado; branch não é Production;
migration remota fica atrás ou à frente do release; grant inesperado; token
possui permissão de escrita desnecessária.

### Tarefa 0.3: inventariar Resend, DNS e remetentes

**Ler:** `docs/integrations/resend.md` e
`docs/integrations/resend-templates.md`.

**Passos:**

- [x] Reexecutar `bun run check:resend-templates -- --environment=production`
  com credencial temporária no shell e saída sanitizada.
- [x] Confirmar domínio, região, SPF, DKIM, seis templates publicados e ausência
  ou presença de webhooks.
- [x] Resolver TXT de SPF e DMARC e seletores DKIM por DNS público. Registrar os
  valores sem copiar chaves privadas.
- [x] Inventariar todo remetente legítimo do domínio: Resend, caixa
  institucional e qualquer serviço corporativo. Remetente não explicado impede
  avanço de DMARC.
- [x] Criar ou confirmar a caixa institucional que receberá `rua`; não publicar
  endereço pessoal.

**Aceite:** inventário tem responsável, finalidade, mecanismo SPF/DKIM e decisão
`legítimo` ou `remover` para cada fonte.

### Tarefa 0.4: transformar o 403 do Sentry em diagnóstico

**Ler:** `next.config.ts`, `src/instrumentation.ts`,
`instrumentation-client.ts` e
`src/lib/sentry-options.ts`.

**Passos:**

- [x] Confirmar sem revelar valores o estado de DSN de servidor/cliente e do
  token de upload de source map no ambiente Vercel. Resultado: DSN cliente
  presente no bundle; DSN servidor não inferível do artefato público; token de
  upload ausente nos builds Production e Staging.
- [x] Criar uma credencial de inspeção separada, com os menores escopos que os
  endpoints usados exigirem: `org:read`, `project:read` e
  `project:releases` quando necessário.
- [x] Repetir a consulta que retornou 403 e registrar endpoint, status e escopo,
  nunca o token.
- [x] Inventariar organização, slug real do projeto, release atual, regra de
  alerta e canal institucional. Resultado sanitizado: organização
  `neurocapacitar`; projetos `hub-development` e `hub-production`; 23/0
  releases; dois workflows ativos com e-mail para `issue_owners` e Sentry App;
  nenhum canal institucional explícito.
- [x] Não emitir evento sintético ainda. Esta Sprint apenas torna a inspeção
  possível para a Sprint 5.

**STOP:** token continua 403 contra a organização canônica; organização ou
projetos reais não podem ser identificados; credencial exigiria acesso
administrativo amplo. Divergência de build identificada e reproduzível vira
finding do Sprint 5, não falso bloqueio do baseline.

### Tarefa 0.5: medir a viabilidade gratuita

**Passos:**

- [x] Registrar limites atuais dos planos, consultando novamente as fontes
  oficiais no dia da execução. A fotografia de planejamento usou Neon Free com
  0,5 GB, 5 GB/mês de transferência pública, dez branches e janela de restore
  de seis horas; R2 Free com 10 GB-mês, um milhão de operações Classe A e dez
  milhões Classe B.
- [x] Produzir um `pg_dump -Fc -Z9` somente leitura em diretório temporário,
  medir bytes e apagar a cópia local após registrar a medida. Não fazer upload
  nesta Sprint.
- [x] Calcular para intervalos de 6, 8 e 12 horas:

  ```text
  transferencia_mensal_projetada = bytes_dump_comprimido
    * execucoes_mensais
    * 1,25
  ```

- [x] Recomendar o menor intervalo cuja projeção, somada ao uso já medido, fique
  abaixo de 80% da cota Neon e cuja execução fique dentro da cota GitHub
  Actions. Registrar RPO alvo e RPO recomendado.
- [x] Se o recomendado for 8 ou 12 horas, registrar antes da implementação a
  aceitação explícita do RPO efetivo. Sem esse registro, a Sprint permanece
  bloqueada; o script nunca muda a cadência por conta própria.
  Avaliado e não aplicável: a medição aprovou o RPO alvo de 6 horas.
- [x] Se nem 12 horas couber, interromper. Investigar compressão, redução de
  egress não essencial ou outra solução permanentemente gratuita; não habilitar
  plano pago ou trial.
  Avaliado e não aplicável: 6 horas consome cerca de 1,02% da cota mensal Neon
  quando somado ao uso observado.

### Gate da Sprint 0

- [x] Todos os comandos locais verdes ou bloqueio explícito.
- [x] Vercel, Neon, Resend, DNS e Sentry comparados com a documentação.
- [x] Intervalo de backup gratuito selecionado por medida, não por estimativa.
- [x] Nenhuma escrita em Production.
- [x] Decisão `CONTINUE` registrada no relatório às `2026-08-24T02:37:28Z`.

---

## Sprint 1: RBAC granular de `support` e assurance privilegiada

### Resultado

Encerrar `F-001` e implementar a fronteira aprovada de `support`, com negação
servidor-side e TOTP obrigatório para `admin` e `support`.

### Tarefa 1.1: congelar a matriz de permissões em teste

**Modificar:**

- `src/lib/auth-policy.ts`
- `src/lib/auth-policy.test.ts`
- `docs/domain/identity-and-authorization.md`
- `docs/decisions.md`

**Permissões alvo:**

```ts
type AuthPermission =
  | "executeRefund"
  | "manageCertificates"
  | "manageContent"
  | "manageEnrollmentAccess"
  | "manageEnrollmentSupport"
  | "manageFinancialOperations"
  | "manageFinancialReviews"
  | "manageLearningAnalytics"
  | "manageSettings"
  | "reissueCertificates"
  | "retryOutbox"
  | "retryWebhook"
  | "viewAdminPanel"
  | "viewCourseOperations"
  | "viewFinancials"
  | "viewGlobalAudit"
  | "viewScopedAudit"
  | "viewStudentOperations";
```

**Contrato:**

- `student`: nenhuma permissão administrativa;
- `support`: `executeRefund`, `manageEnrollmentSupport`,
  `reissueCertificates`, `viewAdminPanel`, `viewCourseOperations`,
  `viewFinancials`, `viewScopedAudit`, `viewStudentOperations`;
- `admin`: todas as permissões.

**Passos:**

- [x] Escrever teste parametrizado com todas as combinações papel × permissão.
- [x] Provar primeiro que a matriz atual falha nos pontos de Certificado e
  Matrícula amplos.
- [x] Acrescentar as permissões granulares e remover `support` de
  `manageCertificates` e `manageEnrollmentAccess`.
- [x] Manter `viewAdminPanel` como acesso ao shell, nunca como autorização de
  leitura de domínio.
- [x] Documentar a nova decisão como `aprovada; implementação em andamento` até
  o gate completo da Sprint. Só então marcar implementada.

**Aceite:** nenhuma permissão proibida é herdada por conveniência do shell.

### Tarefa 1.2: separar projeções e rotas operacionais de autoria

**Criar:**

- `src/features/admin/support-server.ts`
- `src/features/admin/support-server.test.ts`
- `src/app/(admin)/admin/operacao/cursos/page.tsx`
- `src/app/(admin)/admin/operacao/cursos/page.test.tsx`
- `src/app/(admin)/admin/operacao/cursos/[courseId]/alunas/page.tsx`
- testes da página contextual
- `src/app/api/admin/operations/courses/[courseId]/students/[userId]/route.ts`
- testes da rota contextual
- `src/app/(admin)/admin/support-dashboard.tsx`
- `src/app/(admin)/admin/support-dashboard.test.tsx`

**Modificar:**

- `src/features/admin/server.ts`
- `src/app/(admin)/admin/(dashboard)/page.tsx`
- `src/app/(admin)/admin/layout.tsx`
- `src/app/(admin)/admin/admin-sidebar-nav.tsx`
- `src/app/(admin)/admin/alunos/page.tsx`
- `src/app/(admin)/admin/alunos/students-table.tsx`
- `src/components/admin/student-management-sheet.tsx`
- `src/components/admin/student-management-types.ts`
- `src/app/api/admin/students/[userId]/route.ts`
- testes adjacentes desses arquivos

**Projeção permitida para `support`:**

- Curso: ID, título, estado operacional, quantidade total/ativa de Matrículas,
  Pedidos pagos e reembolsados e receita paga/reembolsada em centavos;
- Aluna dentro de um Curso selecionado: ID, nome, e-mail e estado geral de
  acesso necessário ao atendimento;
- contexto de Curso: Matrícula, início, validade, status, progresso agregado
  concluído/obrigatório, Certificado mais recente e Pedidos associados;
- histórico restrito à Aluna, suas Matrículas, Pedidos, reembolsos e
  Certificados;
- financeiro: toda leitura já autorizada por `viewFinancials`, inclusive
  Revisões, mas sem controles de decisão, importação, conciliação ou retry.

**Dados proibidos na projeção:**

- módulos, Aulas, conteúdo, configuração editorial, preço editável e estado de
  draft;
- analytics detalhado por Aula, exportação e eventos brutos;
- backlog global, payload, auditoria global e ações de outros domínios;
- controles de bloqueio da plataforma, concessão manual, emissão ou revogação
  de Certificado.

**Passos:**

- [x] Criar consultas próprias para o painel de `support`; não filtrar depois de
  executar `getAdminDashboardData`, porque a consulta ampla já atravessaria a
  fronteira.
- [x] Fazer `/admin` escolher o dashboard pelo papel antes de disparar consultas.
- [x] Manter `/admin/cursos` e seus editores exclusivos de `manageContent`.
  `support` usa `/admin/operacao/cursos`, somente leitura.
- [x] Manter `/admin/alunos` e a rota ampla por `userId` exclusivas de Admin.
  `support` abre Alunas a partir do Curso operacional, e a API exige simultaneamente
  `courseId`, `userId` e Matrícula contextual; não listar Contas sem vínculo ao
  Curso selecionado.
- [x] Tornar a sidebar dirigida pela matriz: `support` vê Painel, Cursos
  operacionais e Financeiro; Alunas são acessadas dentro do Curso. `admin`
  preserva a navegação atual.
- [x] Proteger diretamente cada page/Route Handler. Ocultar link ou botão é
  apenas UX, nunca o controle de segurança.
- [x] Ao reutilizar `StudentManagementSheet`, passar capacidades e `courseId`
  explícitos. Não derivar autorização de texto, pathname ou estado de cliente;
  o componente nunca escolhe o escopo da query.
- [x] Escrever testes que falham se uma consulta proibida for chamada para
  `support` e snapshots de links exatos por papel.

### Tarefa 1.3: dividir mutações de Matrícula, Certificado, comentário e banner

**Modificar:**

- `src/features/admin/actions.ts`
- `src/features/admin/enrollment-actions.test.ts`
- `src/features/certificates/actions.ts`
- `src/features/certificates/server.ts`
- testes correspondentes em `src/features/certificates`
- `src/features/comments/actions.ts`
- `src/features/comments/server.ts`
- testes correspondentes em `src/features/comments`
- `src/features/learning-analytics/server.ts`
- `src/app/api/admin/learning-analytics/export/route.ts`
- `src/app/api/banners/[bannerId]/image/route.ts`
- `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx`
- testes de rota, página e source-contract adjacentes

**Mapeamento obrigatório:**

- `extendEnrollmentExpirationAction`, `setEnrollmentExpirationAction`,
  `adjustEnrollmentExpirationAction`, `blockEnrollmentAccessAction` e
  `restoreEnrollmentAccessAction` => `manageEnrollmentSupport`;
- `blockStudentPlatformAccessAction`, `restoreStudentPlatformAccessAction` e
  concessão manual => `manageEnrollmentAccess`, apenas `admin`;
- emissão e revogação de Certificado => `manageCertificates`, apenas `admin`;
- reemissão => `reissueCertificates`, com regra adicional para `support` aceitar
  somente o Certificado mais recente já existente da Aluna no Curso;
- exclusão/reordenação de banner e rota de imagem => `manageSettings`;
- leitura/exportação de analytics => `manageLearningAnalytics`;
- comentário administrativo e moderação => `manageContent`, apenas `admin`;
- edição de Aula, preview autoral e Course cover administrativo =>
  `manageContent`.

**Passos:**

- [x] Adicionar teste de negação servidor-side para cada ação proibida.
- [x] Na reemissão por `support`, buscar e bloquear em transação o Certificado
  mais recente por `user_id`, `course_id`, `issued_at desc`, `id desc`. Rejeitar
  se o ID confirmado não for esse registro. `admin` mantém o fluxo geral.
- [x] Preservar motivo, confirmação e audit log existentes; não transformar
  reemissão em emissão manual.
- [x] Remover `support` da moderação de comentários também em
  `src/features/comments/server.ts`; mudar somente a action deixa uma segunda
  entrada aberta.
- [x] Verificar por busca que nenhum `requireRole(["admin", "support"])`
  restante protege conteúdo, configuração, moderação ou analytics.

**Aceite:** requisições diretas de `support` recebem negação antes de consulta ou
mutação proibida.

### Tarefa 1.4: adicionar o schema e o plugin TOTP do Better Auth

**Referência de versão:** Better Auth instalado `1.6.25`; confirmar a
documentação e o código instalado antes de implementar.

**Criar/gerar:**

- migration `0065_*` e snapshot Drizzle correspondentes, se o topo continuar
  `0064`;
- `src/lib/auth-client.ts`
- `src/lib/privileged-assurance.ts`
- testes unitários correspondentes

**Modificar:**

- `src/db/schema.ts`
- `src/lib/auth.ts`
- `src/lib/session.ts`
- `src/lib/auth-permissions.ts`
- `src/lib/admin-assurance.ts`
- `src/lib/admin-assurance.test.ts`
- `src/components/panel-layout.tsx`

**Schema exigido pelo plugin:**

- `users.two_factor_enabled boolean not null default false`;
- tabela física `two_factors`, export Drizzle `twoFactors`: `id text` primary
  key; `secret text` e `backup_codes text` obrigatórios; `user_id text` único
  com FK `users` em cascade; `verified boolean not null default true`;
  `failed_verification_count integer not null default 0`; `locked_until
  timestamptz null`; índice de `secret`. Não inventar timestamps que o modelo do
  plugin `1.6.25` não declara;
- adicionar `twoFactors` ao mapa do `drizzleAdapter`. Como o adapter usa
  `usePlural: true`, conferir em teste que o modelo lógico `twoFactor` resolve
  para o export plural;
- funções/triggers de banco que apagam `sessions` quando `profiles.role` muda ou
  quando `users.two_factor_enabled` muda. Na ativação inicial, o plugin atualiza
  a Conta antes de criar a nova sessão verificada; o trigger elimina todas as
  sessões anteriores e a sessão pós-TOTP permanece. Caracterizar essa ordem em
  integração PostgreSQL antes de depender dela;
- a migration deve criar e remover somente seus próprios objetos forward-only;
- zero seed de segredo TOTP e zero backup code em texto claro.

**Configuração:**

```ts
twoFactor({
  issuer: "PROTEA-R Hub",
  trustDeviceMaxAge: 0,
  accountLockout: {
    enabled: true,
    maxFailedAttempts: 5,
    durationSeconds: 900,
  },
})
```

**Passos:**

- [x] Importar o plugin servidor de `better-auth/plugins/two-factor` e o cliente
  `twoFactorClient`.
- [x] Criar uma única instância `authClient` com
  `twoFactorPage: "/verificar-segundo-fator"`; substituir criações locais como
  a de `PanelLayout`.
- [x] Caracterizar o comportamento de dispositivo confiável em `1.6.25`.
  Privilegiados não podem pular o TOTP: toda chamada envia `trustDevice=false`,
  `trustDeviceMaxAge=0` impede persistência útil mesmo em chamada direta e o
  teste prova ausência de sessão confiável reutilizável.
- [x] No Route Handler do Better Auth, interceptar endpoints antes de delegar:
  resolver a sessão, `users.two_factor_enabled` e o papel no banco. Em
  `POST /two-factor/disable`, `admin`/`support` recebem 403 sem leitura do corpo
  nem mutação. Em `POST /two-factor/enable`, uma Conta privilegiada já habilitada
  recebe 409, evitando substituir o segredo sem validar o novo TOTP. Recuperação
  usa backup code e `getTotpUri`, não desativação ou segundo `enable`.
- [x] Fazer `AppSession` carregar `twoFactorEnabled`. O plugin não persiste um
  campo `twoFactorVerified` na sessão: caracterizar que sign-in privilegiado
  apaga a sessão pré-challenge e só cria outra após TOTP/backup code. Somente
  então tratar uma sessão ativa com `twoFactorEnabled=true` como verificada.
  Os triggers acima fecham sessões anteriores à ativação ou à promoção de papel.
- [x] Usuário privilegiado sem TOTP entra somente no fluxo de configuração.
- [x] Fazer `requireRole` e `requirePermission` chamarem a assurance
  privilegiada. Nenhuma Server Action sensível pode depender apenas do layout.
- [x] Manter a página de configuração acessível por `requireSession`, para não
  criar loop de redirect.

**Testes:** schema esperado pelo plugin; setup obrigatório; challenge obrigatório;
backup code; lock após cinco falhas; student sem mudança; privileged mutation
negada sem assurance; role change revoga sessões.

**Evidência integrada em 2026-08-24:** o fluxo PostgreSQL real passou duas vezes
na branch Neon descartável `br-weathered-meadow-ac4httb1`: setup pelo segredo
Base32 do `totpURI`, ativação TOTP, challenge obrigatório, consumo único de backup
code, revogação da sessão após `admin` => `support`, cinco falhas até lockout e
negação de TOTP válido durante o bloqueio. A fixture foi removida pelo teste e a
branch foi apagada e confirmada como ausente. Nenhum segredo, QR, código ou URL
de conexão foi retido na evidência.

### Tarefa 1.5: implementar setup, challenge e recuperação

**Estado:** implementado em código e testes de UI/contrato. A prova operacional
com duas Contas Admin reais e consumo de backup code permanece no gate da Sprint.

**Preparação operacional:**

- [x] Fazer `db:seed:staging-admin` exigir Admin primário e Admin de recuperação
  com e-mails e senhas distintos, mínimo de oito caracteres e transação única.
- [x] Revogar sessões das duas Contas ao atualizar credencial/papel e não criar
  segredo TOTP ou backup code no seed.
- [x] Fazer o reset de Staging restaurar e verificar exatamente duas Contas
  Admin, sem registrar identidade ou segredo nos logs.
- [ ] Configurar os dois novos secrets no GitHub Environment `vercel-staging` e
  executar seed/setup/recuperação somente depois de publicar `0065` em Staging.

**Criar:**

- `src/app/(auth)/configurar-segundo-fator/page.tsx`
- `src/app/(auth)/configurar-segundo-fator/two-factor-setup-form.tsx`
- `src/app/(auth)/verificar-segundo-fator/page.tsx`
- `src/app/(auth)/verificar-segundo-fator/two-factor-challenge-form.tsx`
- testes de regra, UI e interação adjacentes

**Modificar:**

- `src/app/(auth)/entrar/sign-in-form.tsx`
- `src/app/(auth)/entrar/sign-in-result.ts`
- `src/app/api/auth/redirect/route.ts`
- componentes de conta que ofereçam segurança ou logout

**Fluxo de setup:**

1. confirmar senha atual via `authClient.twoFactor.enable`;
2. exibir QR e segredo manual do `totpURI` somente à pessoa autenticada;
3. mostrar backup codes uma única vez, exigir confirmação de armazenamento e
   nunca gravá-los em estado persistente do navegador;
4. exigir `verifyTotp` antes de liberar `/admin`;
5. regeneração de backup codes exige senha atual e invalida o conjunto anterior.

**Fluxo de recuperação:**

1. entrar com senha e um backup code de uso único;
2. reconfirmar a senha atual e chamar `authClient.twoFactor.getTotpUri` para
   cadastrar um autenticador substituto sem desativar 2FA;
3. validar um TOTP do novo autenticador;
4. chamar `authClient.twoFactor.generateBackupCodes` com senha, invalidar o
   conjunto anterior e armazenar o novo conjunto fora do Hub;
5. provar que o backup code consumido e os códigos antigos falham.

**Fluxo de login:**

1. e-mail e senha preservam mensagem anti-enumeração;
2. `twoFactorRedirect=true` leva ao challenge;
3. aceitar TOTP ou um backup code;
4. erro não revela se código, Conta ou método existe;
5. após sucesso, consultar `/api/auth/redirect` e encaminhar pelo papel.

**Acessibilidade:** labels explícitos, `autocomplete="one-time-code"`, foco no
primeiro erro, status em região viva, QR acompanhado de segredo textual, teclado
completo e códigos não anunciados novamente após sair da tela.

**Rollout de Production:** manter enforcement desligado até duas Contas Admin
distintas concluírem setup. Exercitar recuperação por backup code em uma delas,
confirmar que ambas mantêm acesso e somente então ativar o gate para
`admin`/`support`. Registrar apenas IDs internos sanitizados, horário e resultado;
segredo, QR e códigos não entram na evidência.

### Tarefa 1.6: preservar e reforçar o reembolso integral

**Modificar somente se necessário:**

- `src/features/payments/actions.ts`
- `src/features/payments/refunds.ts`
- `src/app/(admin)/admin/financeiro/financial-operations.tsx`
- testes adjacentes

**Passos:**

- [x] Provar que `executeRefund` continua disponível a `admin` e `support`.
- [x] Provar a sequência TOTP da sessão => senha atual => token de confirmação
  de dez minutos => ID completo do Pedido => motivo => chamada Asaas.
- [x] Manter limite de cinco falhas de senha em quinze minutos, uso único do
  token e audit logs `refund.*`.
- [x] Garantir que `support` vê a Revisão financeira, mas não recebe controles
  de `manageFinancialReviews`, `manageFinancialOperations` ou `retryWebhook`.
- [x] Testar que ocultar o botão não é a única defesa: chamar diretamente as
  três actions proibidas como `support` deve falhar antes do provider.

### Gate da Sprint 1

- [x] Matriz completa verde.
- [x] Navegação e consultas de `support` contêm somente as quatro superfícies
  aprovadas.
- [x] Todas as mutações proibidas negadas por teste servidor-side.
- [x] TOTP, backup code, lockout e revogação por mudança de papel exercitados.
- [ ] Duas Contas Admin aptas e recuperação real por backup code comprovada antes
  do enforcement de Production.
- [x] Reembolso integral preserva todas as confirmações.
- [x] Migration ensaiada em branch descartável e gates comuns verdes.

**STOP:** qualquer rota proibida retorna dados a `support`; TOTP pode ser
ignorado; backup code aparece em log; migration invalida login da aplicação
anterior; sessão sobrevive a mudança de papel.

---

## Sprint 2: backup independente, retenção e restauração

### Resultado

Encerrar `F-002` com uma cópia lógica cifrada fora do Neon, retenção em R2,
gate de frescor e restauração completa comprovada em PostgreSQL 18 descartável.

### Tarefa 2.1: modelar manifesto, cotas e retenção

**Estado em 2026-08-24:** implementado e coberto localmente. O parser é estrito,
as chaves são determinísticas, a seleção diária/semanal usa períodos UTC e a
projeção usa as cotas atuais do R2 Standard Free com reserva de 20%.

**Criar:**

- `src/tooling/production-backup.ts`
- `src/tooling/production-backup.test.ts`
- `src/tooling/production-backup-r2.ts`
- `src/tooling/production-backup-r2.test.ts`

**Contrato do manifesto, versão 1:**

```ts
interface ProductionBackupManifestV1 {
  schemaVersion: 1;
  backupId: string;
  createdAt: string;
  sourceEnvironment: "production";
  releaseSha: string;
  migrationTag: string;
  migrationTimestamp: number;
  postgresServerVersion: string;
  pgDumpVersion: string;
  encryptedObjectKey: string;
  encryptedBytes: number;
  encryptedSha256: string;
  dumpSha256: string;
  compression: "pg-custom-z9";
  encryption: "age-x25519";
  cadenceHours: 6 | 8 | 12;
  retentionClasses: Array<"frequent" | "daily" | "weekly">;
}
```

**Regras:**

- nenhum host, usuário, connection string, e-mail, contagem identificável ou
  conteúdo de linha entra no manifesto;
- `releaseSha` tem 40 caracteres; timestamps são UTC; hashes são SHA-256
  lowercase; migration deve existir no journal local;
- prefixos: `postgres/production/frequent`, `daily`, `weekly` e `manifests`;
- todo run grava `frequent`; o primeiro run UTC do dia também grava `daily`; o
  primeiro run UTC de segunda-feira também grava `weekly`;
- manifesto é publicado por último e funciona como commit marker;
- `recommendBackupCadence` recomenda 6, depois 8, depois 12 horas sob a reserva
  de 80%; a cadência executada vem da decisão registrada e não muda em runtime.

**Testes:** parsing estrito, chaves determinísticas, virada UTC, semana ISO,
hash inválido, manifesto com segredo recusado, cálculo de cota nos três
intervalos e impossibilidade gratuita.

### Tarefa 2.2: criar o backup cifrado

**Estado em 2026-08-24:** implementação local concluída. O workflow, comandos,
limpeza de temporários, versões, checksum do binário `age`, ordem
cifra/HEAD/manifesto e source contracts estão verdes. A job remota ainda não foi
executada porque bucket, role e GitHub Environment não foram provisionados.
O checkpoint agregado aprovou 315 arquivos/2.154 testes, typecheck, migrations,
Ultracite em 827 arquivos e 33 documentos canônicos.

**Auditoria somente leitura em 2026-08-25:** `production-backup` ainda não existe
nos Environments do GitHub, seus secrets/variables estão ausentes e o workflow
retorna `404` na branch padrão. As credenciais S3 locais alcançam apenas o bucket
da aplicação; isso não prova o bucket exclusivo de backup. Nenhuma job foi
disparada.

**Criar:**

- `scripts/create-production-backup.ts`
- `scripts/check-production-backup.ts`
- `.github/workflows/backup-production-database.yml`

**Modificar:**

- `package.json`
- `docs/operations/environment-and-local-development.md`
- `docs/operations/observability-and-recovery.md`
- `docs/integrations/r2.md`
- `docs/operations/testing-and-ci.md`

**Variáveis exclusivas do ambiente GitHub `production-backup`:**

- secret `BACKUP_DATABASE_URL`: role PostgreSQL dedicada, direta e somente
  leitura;
- secrets `BACKUP_R2_ACCESS_KEY_ID` e `BACKUP_R2_SECRET_ACCESS_KEY`: chave com
  acesso apenas ao bucket de backup;
- vars `BACKUP_R2_ACCOUNT_ID`, `BACKUP_R2_BUCKET_NAME`,
  `BACKUP_AGE_RECIPIENT`, `PRODUCTION_DATABASE_HOST`,
  `PRODUCTION_NEON_BRANCH_ID`;
- `BACKUP_AGE_RECIPIENT` é chave pública e não é secret. A identidade privada
  possui duas cópias offline sob custódias diferentes e nunca entra no GitHub.

**Role PostgreSQL de backup:** provisionar fora das migrations da aplicação, sem
senha em arquivo ou histórico. Usar uma role Neon exclusiva com `LOGIN`, membro
de `pg_read_all_data`, `default_transaction_read_only=on` e timeout explícito;
ela não recebe ownership, DDL, escrita nem credencial de runtime. Em branch
descartável, provar que `SELECT` e `pg_dump` funcionam e que `INSERT`, `UPDATE`,
`DELETE`, criação de objeto persistente e `ALTER` falham. Em Production, executar
somente a leitura de identidade do target e o dump. Rotação atualiza apenas o
secret protegido do GitHub.

**Pipeline:**

1. criar diretório temporário fora do workspace;
2. validar host direto, branch declarada, role somente leitura, PostgreSQL 18 e
   migration esperada;
3. executar `pg_dump` por `spawn` com argumentos separados, formato custom,
   compressão 9, sem owner nem ACL;
4. calcular SHA-256 do dump;
5. cifrar com `age` X25519 para arquivo novo e calcular o hash cifrado;
6. apagar o dump claro assim que os hashes estiverem disponíveis;
7. enviar o objeto cifrado com `PutObjectCommand`, metadata mínima e
   `If-None-Match: *`;
8. confirmar por `HeadObject` tamanho e metadata;
9. copiar a mesma cifra para as classes diária/semanal aplicáveis;
10. enviar manifestos por último;
11. apagar todo temporário no `finally`, inclusive em falha.

**Workflow:**

- depois da decisão da Sprint 0, commitar exatamente um cron literal:
  `17 */6 * * *`, `17 */8 * * *` ou `17 */12 * * *`. Expressões e vars não são
  aceitas em `on.schedule`; o `env.BACKUP_CADENCE_HOURS` público do próprio
  workflow deve repetir o intervalo para o manifesto e para o gate;
- teste estrutural lê o YAML e falha se o cron e `env.BACKUP_CADENCE_HOURS`
  divergirem, se houver mais de um cron ativo ou se o intervalo não for 6, 8 ou
  12 horas;
- incluir também `workflow_dispatch` e
  `concurrency.group=production-database-backup` sem cancelamento;
- `permissions: contents: read`, timeout explícito e ambiente protegido;
- PostgreSQL client 18 e `age` com versões fixadas/verificadas;
- Bun `1.3.11`, install frozen e script;
- upload de artefato GitHub proibido para dump, cifra ou manifesto completo;
- summary contém somente backup ID, horário, bytes, classes, migration e status.

**Aceite:** duas execuções consecutivas criam chaves distintas, ambas passam
HEAD/hash, e nenhum arquivo claro permanece no runner ou workspace.

### Tarefa 2.3: configurar o bucket R2 dedicado

**Alteração externa controlada:** Cloudflare R2.

**Estado em 2026-08-25:** pendente. Wrangler `4.125.0` não possui sessão
administrativa local; nenhuma regra pôde ser lida. A documentação atual confirma
R2 Standard Free em 10 GB-mês, 1 milhão Class A, 10 milhões Class B e egress
gratuito. Nenhum bucket, objeto, token, lock ou lifecycle foi criado.

**Projeção fechada:** no modelo de 30 dias/120 runs, uma listagem por run, dois
PUTs e um HEAD por classe resultam em cerca de 430 operações Class A e 155 Class
B, incluindo 30 classes diárias e até cinco semanais. São menos de 0,06% e
0,002% das reservas internas respectivas; o gate de release acrescenta uma
listagem, um GET e um HEAD por execução.

**Configuração:**

- bucket privado exclusivo, sem custom domain, `r2.dev`, CORS ou acesso público;
- token S3 de leitura/escrita limitado a esse bucket no GitHub, sem permissão de
  administrar buckets ou regras; restauração usa uma credencial separada de
  leitura, disponibilizada somente durante o exercício;
- configuração de Bucket Lock/lifecycle usa credencial operacional temporária,
  nunca o token do workflow;
- Bucket Lock mínimo: 1 dia para `frequent`, 7 dias para `daily`, 28 dias para
  `weekly`;
- lifecycle expira cada classe após seu mínimo mais uma margem de um dia;
- manifests acompanham a mesma classe da cifra;
- nenhuma regra alcança buckets de materiais, capas, banners ou Certificados.

**Passos:**

- [ ] Registrar nomes e IDs não secretos, regras lidas de volta pela API e
  estado público desabilitado.
- [ ] Tentar exclusão controlada de objeto descartável ainda bloqueado e
  confirmar recusa; depois do prazo, confirmar lifecycle em objeto de teste.
- [x] Medir armazenamento e operações projetadas. Interromper em 80% da cota
  gratuita; nunca ativar compra automática.
- [ ] Alertar por falha de workflow e por ausência de manifesto recente usando
  GitHub Actions e o canal institucional já disponível.

### Tarefa 2.4: implementar restauração fail-closed

**Estado em 2026-08-24:** guardas, streaming, hashes, inspeção do archive,
single transaction, postflight e cleanup estão implementados e testados. O
restore real permanece na Tarefa 2.5.

**Criar:**

- `scripts/restore-production-backup.ts`
- `src/tooling/production-restore.ts`
- `src/tooling/production-restore.test.ts`
- `docs/operations/production-backup-restore.md`

**Entradas:** manifesto selecionado, chave R2, arquivo de identidade `age`, URL
de banco descartável e confirmação literal
`RESTORE_DISPOSABLE_PRODUCTION_BACKUP`.

**Guardas:**

- target PostgreSQL válido, banco vazio e nome começando por `hub_restore_`;
- host não pode coincidir com Production, Staging, Development persistente nem
  compute conhecido como protegido;
- source e target nunca podem ser a mesma URL;
- identidade `age` é arquivo local legível fora do repositório, nunca conteúdo
  de variável ou argumento de linha de comando;
- restaurar somente cifra cujo manifesto, tamanho e SHA-256 coincidam;
- recusar migration desconhecida ou versão PostgreSQL diferente da suportada.

**Procedimento:**

1. baixar cifra para diretório temporário;
2. verificar hash cifrado;
3. decifrar localmente e verificar hash do dump;
4. executar `pg_restore --list` e rejeitar entrada inesperada;
5. provar que o banco alvo não tem relações de aplicação;
6. executar `pg_restore --exit-on-error --single-transaction --no-owner
   --no-privileges` sem `--clean`;
7. conferir journal, 43+ tabelas conforme o manifesto vigente, constraints,
   índices críticos e checks agregados sem PII;
8. iniciar a aplicação compatível contra o target e executar readiness/smokes;
9. registrar início, fim e RTO;
10. revogar URL e remover banco/branch descartável por procedimento confirmado.

**Testes:** target Production recusado, banco não vazio recusado, hash errado,
manifesto adulterado, falha de `age`, falha de `pg_restore`, cleanup de
temporário e evidência sanitizada.

### Tarefa 2.5: ensaiar PITR e restauração da cópia externa

**Passos:**

- [ ] Criar branch Neon descartável a partir de ponto dentro da janela PITR de
  seis horas, conferir parent/timestamp e executar smoke; remover a branch após
  evidência.
- [ ] Restaurar o backup R2 mais recente em PostgreSQL 18 descartável seguindo
  o runbook, sem atalhos.
- [ ] Medir RPO real entre `createdAt` e início do incidente simulado e RTO até
  readiness verde.
- [ ] Fazer o exercício com uma das cópias offline da identidade `age`; a segunda
  continua selada como contingência.
- [ ] Registrar falhas e repetir desde o início. Ensaio parcial não fecha
  `F-002`.

### Tarefa 2.6: bloquear release sem backup recente

**Estado em 2026-08-24:** implementado no workflow Production antes da branch
Neon e das migrations, usando credencial R2 read-only separada. A prova remota
depende do primeiro backup válido.

**Modificar:**

- `.github/workflows/deploy-vercel.yml`
- `scripts/check-production-backup.ts`
- testes do parser/checker
- `docs/operations/production-release-guide.md`

**Passos:**

- [x] Antes da migration e da branch Neon de release, ler o manifesto R2 mais
  recente e exigir idade menor ou igual ao RPO efetivo mais uma margem de 30
  minutos.
- [x] Confirmar HEAD, hash metadata, migration conhecida, bucket exato e
  `sourceEnvironment=production`.
- [x] Se estiver stale, orientar `workflow_dispatch` do backup e terminar com
  falha. O deploy não cria backup implicitamente nem ignora o gate.
- [x] Manter a branch Neon de release existente como segunda camada; ela não
  substitui R2/PITR.

### Gate da Sprint 2

- [ ] Backup agendado e manual verdes.
- [ ] Cifra e manifestos sob Bucket Lock/lifecycle lidos de volta.
- [ ] Restore R2 completo dentro do RTO e PITR exercitado.
- [ ] RPO efetivo e uso de cotas documentados abaixo de 80%.
- [ ] Release falha com backup stale ou inválido.

**STOP:** dump claro persistido; identidade privada no GitHub; bucket público;
target compartilhado aceito pelo restore; cota projetada excedida; restore
parcial; RTO ou RPO não medido.

---

## Sprint 3: concorrência de suporte e gerações de expiração

**Estado em 2026-08-24T14:31:21Z:** `COMPLETED`. `F-003` e `F-004` foram
encerrados em código, testes e PostgreSQL descartável. A decisão do gate é
`CONTINUE` para o Sprint 4; nenhuma branch persistente foi alterada.

### Resultado

Encerrar `F-003` e `F-004`: limite de solicitações atômico sob concorrência e
aviso de expiração incapaz de enviar uma validade obsoleta.

### Tarefa 3.1: reproduzir a corrida do formulário de suporte

**Estado em 2026-08-24:** concluída. A integração PostgreSQL liberou quatro
requisições concorrentes da mesma Conta e comprovou três commits, uma rejeição,
três solicitações e três intenções de e-mail; locks de Contas diferentes foram
adquiridos simultaneamente.

**Modificar:**

- `src/features/support/server.test.ts`

**Criar:**

- `src/features/support/server.integration.test.ts`

**Cenário obrigatório:**

- mesma Conta, janela vazia, quatro requisições liberadas por uma barreira para
  contar simultaneamente;
- no estado atual, demonstrar que as quatro podem observar contagem menor que
  três;
- após a correção, exatamente três commits e uma rejeição;
- para cada commit existe exatamente uma `support_request` e uma mensagem
  `email.support-request`; nenhum insert parcial;
- requisições de Contas diferentes não se bloqueiam entre si.

Use a branch PostgreSQL descartável do job `integration-db`. Fixtures devem ter
prefixo único do teste e cleanup limitado aos IDs criados.

### Tarefa 3.2: serializar o check-and-act no PostgreSQL

**Estado em 2026-08-24:** concluída na ordem transacional especificada, com
validação anterior à conexão, advisory lock por Conta e mesmo client para
contagem, insert e outbox.

**Modificar:**

- `src/features/support/server.ts`
- `src/features/support/server.test.ts`
- `src/features/support/server.integration.test.ts`
- `docs/operations/outbox-and-transactional-effects.md`

**Ordem exata da transação:**

1. `pool.connect()`;
2. `begin`;
3. `select pg_advisory_xact_lock(hashtextextended($1, 0))` com chave
   `support-request:<userId>`;
4. contar `support_requests` da Conta nos últimos dez minutos usando o mesmo
   `client`;
5. se já houver três, rollback e erro seguro;
6. inserir solicitação;
7. enfileirar `email.support-request` com o mesmo `client`;
8. commit; em qualquer falha, rollback; sempre release.

**Regras:**

- validar e normalizar assunto/mensagem antes de abrir transação;
- manter limites de 160 e 1800 caracteres;
- não usar memória, IP, lock global ou `pool.query` fora da transação;
- não incluir `userId` em log operacional de alta cardinalidade;
- a mensagem de limite não revela a contagem.

**Testes unitários:** ordem das queries, lock antes da contagem, limite sem
insert/enqueue, rollback do enqueue, release em todos os caminhos.

### Tarefa 3.3: versionar a geração do aviso de expiração

**Modificar:**

- `src/features/outbox/rules.ts`
- `src/features/outbox/rules.test.ts`
- `src/features/enrollments/maintenance.ts`
- testes de manutenção adjacentes

**Payload v2:**

```ts
{
  enrollmentId: string;
  warningKind: "1d" | "7d";
  expectedExpiresAt: string; // ISO UTC exato
}
```

**Chave:**

```text
email.access-expiry-warning/<enrollmentId>/<warningKind>/<epochMs>/v2
```

**Passos:**

- [x] Transformar `OutboxMessageInput` em união discriminada que aceite v1 para
  tópicos antigos e v2 somente para o aviso novo.
- [x] Validar objeto fechado, ISO válido e correspondência entre
  `expectedExpiresAt` e o epoch da chave.
- [x] Passar `enrollment.expires_at` lido pela manutenção para a factory.
- [x] Preservar o reset de `expiry_warning_*_sent_at` que
  `rebuildEnrollmentProjection` já faz quando a validade muda.
- [x] Adicionar helper puro que classifica `current`, `changed`, `inactive`,
  `expired` ou `wrong_window`. Para `7d`, dias restantes devem estar entre 2 e
  7; para `1d`, entre 0 e 1, usando a mesma regra UTC do scheduler.

### Tarefa 3.4: criar o terminal `superseded` na outbox

**Estado em 2026-08-24:** concluída em código, migration, worker, delivery,
pruning, snapshot operacional e script guardado. O primeiro ensaio revelou que
o índice parcial gerado não podia referenciar o novo enum na mesma transação; a
transação reverteu. O índice tornou-se não parcial e as duas execuções seguintes
passaram.

**Criar/gerar:**

- migration `0066_*` e snapshot Drizzle, se não houver colisão
- `scripts/supersede-expiry-warning-v1.ts`
- testes do script guardado

**Modificar:**

- `src/db/schema.ts`
- `src/features/outbox/worker.ts`
- `src/features/outbox/worker.test.ts`
- `src/features/outbox/server.ts`
- `src/features/outbox/server.test.ts`
- `src/features/outbox/runner.ts`
- `src/features/outbox/runner.test.ts`
- `src/features/outbox/delivery.ts`
- `src/features/outbox/delivery.test.ts`
- `src/features/operations/server.ts` e seus testes de snapshot
- `docs/operations/outbox-and-transactional-effects.md`

**Schema:** acrescentar `superseded` ao enum `outbox_status` e coluna
`superseded_at`. `last_error_code` guarda um código fechado como
`expiry_generation_changed`, `expiry_inactive`, `expiry_window_elapsed` ou
`expiry_payload_v1`.

A migration contém somente `ALTER TYPE ... ADD VALUE` e a coluna/índices
aditivos. Não usar o novo valor em `UPDATE` dentro da mesma transação que altera
o enum PostgreSQL. A classificação de dados v1 ocorre pelo script após commit da
migration.

**Transição:**

- criar `OutboxSupersededError` separado de falha de delivery;
- worker chama `markOutboxMessageSuperseded` somente se a mensagem ainda estiver
  `processing` e pertencer ao mesmo `workerId`;
- limpar lock, preencher `superseded_at`, não preencher `delivered_at`, não
  incrementar retry e nunca virar dead letter;
- pruning remove `superseded` após 30 dias, como efeito terminal observável;
- snapshot operacional conta `superseded` separadamente, sem payload.

**Delivery do aviso:** buscar Matrícula sem filtrar `active`, incluindo
`status` e `expires_at`. Comparar em milissegundos com o payload e reavaliar a
janela imediatamente antes de chamar Resend. Qualquer divergência lança
`OutboxSupersededError`; somente `current` resolve identidade e envia.

**Compatibilidade v1:** com jobs desligados e depois do commit da migration, o
script guardado primeiro executa dry-run, recusa alvo fora do ambiente declarado
e aborta se houver aviso v1 em `processing`. Após confirmação literal, marca v1
`pending`/`retrying` como `superseded` e limpa o marcador de aviso correspondente
nas Matrículas ainda ativas. O scheduler criará v2. Não reenviar mensagens v1 e
não alterar mensagens já entregues. O worker novo também trata qualquer v1
remanescente como `superseded`, sem delivery.

### Tarefa 3.5: provar as corridas de expiração

**Estado em 2026-08-24:** concluída em branch Neon descartável com nove cenários
integrados de suporte/expiração, incluindo geração atual, mudança, v1, janela,
inatividade e fencing do lease. A branch foi apagada e confirmada como ausente.

**Criar:**

- `src/features/outbox/expiry-warning.integration.test.ts`

**Cenários PostgreSQL:**

- warning 7d enfileirado, validade estendida antes do delivery => v1/v2 antigo
  `superseded`, zero chamada Resend, nova geração elegível;
- warning 7d atrasado até a janela 1d => `superseded`, 1d novo elegível;
- Matrícula bloqueada/revogada/expirada => `superseded`;
- validade idêntica e janela correta => uma chamada e `delivered` da outbox
  significa aceite pelo handler, não inbox final;
- dois workers competindo => apenas o detentor do lease transiciona;
- retry da mesma geração => chave idempotente idêntica;
- nova validade => chave diferente.

### Gate da Sprint 3

- [x] Quatro requests concorrentes produzem 3 commits + 1 rejeição.
- [x] Nenhuma notificação de validade alterada alcança o adapter de e-mail.
- [x] `superseded` é terminal, observável e não confundido com `delivered`.
- [x] Migration ensaiada duas vezes e gates comuns verdes.

---

## Sprint 4: lifecycle real de entrega do Resend

**Estado em 2026-08-24T15:25:28Z:** `IMPLEMENTED_LOCAL` /
`EXTERNAL_GATE_PENDING`. Código, migration, testes, integração PostgreSQL e gates
comuns estão verdes; implantação da rota, assinatura e eventos reais do Resend
permanecem na Tarefa 4.6 e impedem encerrar `F-005`.

### Resultado

Encerrar `F-005`: separar intenção, tentativa, aceitação do provider e resultado
de entrega, com webhook assinado, inbox durável, ordem tolerante e zero segredo
persistido.

### Tarefa 4.1: congelar a máquina de estados

**Estado em 2026-08-24:** concluída com mapeamento fechado, precedência,
deduplicação, conflito e 5.040 permutações de ordem exercitadas.

**Criar:**

- `src/features/email-delivery/rules.ts`
- `src/features/email-delivery/rules.test.ts`

**Estados da mensagem:**

```ts
type EmailMessageStatus =
  | "sending"
  | "acceptance_unknown"
  | "accepted"
  | "delayed"
  | "delivered"
  | "failed"
  | "suppressed"
  | "bounced"
  | "complained";
```

**Mapeamento Resend:**

- resposta síncrona com `data.id` e `email.sent` => `accepted`;
- `email.delivery_delayed` => `delayed`;
- `email.delivered` => `delivered`;
- `email.failed` => `failed`;
- `email.suppressed` => `suppressed`;
- `email.bounced` => `bounced`;
- `email.complained` => `complained`;
- `opened`, `clicked`, `received`, `scheduled`, `canceled` e tipos futuros não
  alteram a projeção desta iniciativa.

**Redução determinística para evento fora de ordem:**

`complained > delivered > bounced > suppressed > failed > delayed > accepted > acceptance_unknown > sending`.
A projeção é recalculada a partir dos eventos válidos persistidos e do estado
local; não depende da ordem de processamento nem apenas do horário. `delivered`
vence falha terminal conflitante porque existe evidência positiva de entrega;
`complained` vence `delivered` porque só ocorre depois da entrega. Se a mesma
mensagem possuir mais de um entre `delivered`, `bounced`, `suppressed` e
`failed`, preservar todos os eventos, manter a projeção determinística, marcar
`delivery_event_conflict` e alertar. Estado de menor precedência nunca regride a
projeção.

**Testes:** todas as transições, duplicata, todas as permutações de ordem,
terminais conflitantes, tipo ignorado e timestamp inválido.

### Tarefa 4.2: persistir mensagens e inbox de eventos

**Estado em 2026-08-24:** migration `0067_sparkling_ghost_rider`, snapshot,
schema sem conteúdo/PII, filas, FKs e retenção implementados.

**Criar/gerar:**

- migration `0067_*` e snapshot Drizzle, se não houver colisão

**Modificar:**

- `src/db/schema.ts`
- `src/db/migration-state.ts`

**Tabela `email_messages`:**

- `id uuid` local;
- `provider='resend'`;
- `provider_message_id text unique null` enquanto `sending`;
- `outbox_message_id uuid unique null` com FK `on delete set null`;
- `correlation_id uuid unique` para fluxos sem outbox;
- `topic` e `template_alias` com valores fechados e sem conteúdo editorial;
- `status`, `accepted_at`, `latest_event_at`, timestamps terminais e
  `last_error_code` seguro;
- `request_fingerprint` HMAC-SHA256, `first_provider_attempt_at`,
  `acceptance_unknown_at` e `automatic_retry_deadline_at` para fechar a janela
  de crash sem persistir o request;
- timestamps padrão do projeto;
- nenhum destinatário, nome, assunto, HTML, texto, URL, token, payload ou header.

**Tabela `resend_webhook_events`:**

- `id uuid` local;
- `provider_event_id text unique` vindo de `svix-id`;
- `provider_message_id text null`;
- `event_type`, `occurred_at`, `received_at`, `payload_sha256`;
- `status`: `received`, `processing`, `processed`, `ignored`, `retrying`,
  `dead_letter`;
- `attempts`, `available_at`, `locked_at`, `locked_by`, `processed_at`,
  `last_error_code`;
- `email_message_id uuid null` com FK `on delete set null`;
- zero payload bruto ou campos `from`, `to`, `subject`, `tags` completos.

**Índices:** unique IDs do provider; fila por `status, available_at`; lookup por
`provider_message_id`; timeline por `email_message_id, occurred_at`.

**Retenção:** eventos processados/ignorados por 180 dias; dead letter por 365
dias; mensagens por 365 dias após terminal. Mudança de prazo exige decisão
jurídica/operacional; maintenance remove em lotes e não apaga item com evento
pendente.

### Tarefa 4.3: registrar a tentativa antes de chamar o provider

**Estado em 2026-08-24:** HMAC canônico, tags fechadas, janela de 23 horas,
registro pré-IO, atalhos de provider ID e estados de aceitação implementados.
Wrappers da outbox transportam contexto durável; recuperação pública continua
fora da outbox e sem persistir URL/token.

**Modificar:**

- `src/features/email/server.ts`
- `src/features/email/server.test.ts`
- wrappers de e-mail em `src/features/outbox/delivery.ts`
- `src/lib/auth-password-reset.ts` e seus testes

**Criar:**

- `src/features/email-delivery/server.ts`
- `src/features/email-delivery/server.test.ts`

**Contrato `EmailDeliveryContext`:**

```ts
interface EmailDeliveryContext {
  correlationId: string;
  topic: string;
  templateAlias: HostedEmailTemplateName;
  outboxMessageId?: string;
  idempotencyKey: string;
}
```

**Sequência:**

1. montar a requisição normalizada e calcular HMAC-SHA256 com
   `BETTER_AUTH_SECRET` e prefixo de domínio `email-delivery-request:v1`; guardar
   somente o fingerprint;
2. upsert local `sending` por `outboxMessageId` ou `correlationId`;
3. antes do IO, preencher `first_provider_attempt_at` e deadline de 23 horas
   usando o relógio do banco;
4. enviar template Hosted com tags Resend seguras `hub_topic` e
   `hub_correlation`; `hub_topic` usa um mapa fechado para slug ASCII com apenas
   letras, números, `_` ou `-`, nunca o tópico bruto com ponto.
   `hub_correlation` é o UUID local da mensagem, nunca ID de Aluna/Pedido;
5. exigir `data.id` na resposta de sucesso;
6. atualizar `provider_message_id`, `status=accepted` e `accepted_at`;
7. retornar `{ provider: "resend", messageId, acceptedAt }`;
8. rejeição definitiva do SDK marca código sanitizado e segue a política de
   retry existente; timeout, reset de conexão ou exceção sem resposta muda para
   `acceptance_unknown` e preenche `acceptance_unknown_at`. Nenhum caminho grava
   corpo/URL.

Testar tamanho máximo e charset das duas tags antes do adapter; valor inválido
falha localmente e nunca é truncado silenciosamente.

**Janela de crash/idempotência:** se o provider aceitou e o processo caiu antes
do update, o registro local prova que o IO pode ter ocorrido. No retry:

- se o registro ou um webhook correlacionado já tem `provider_message_id`,
  concluir como aceito sem chamar o provider;
- antes da deadline de 23 horas, recalcular a requisição e só repetir com a
  mesma chave se o HMAC for idêntico; a margem evita depender do limite de 24
  horas da idempotência do Resend;
- fingerprint diferente, `invalid_idempotent_request` ou deadline vencida =>
  não chamar o provider. Manter `acceptance_unknown`, emitir
  `resend_acceptance_unresolved` e exigir investigação; nunca trocar a chave;
- o worker pode consultar a linha novamente enquanto aguarda webhook, mas não
  transforma ausência de evento em autorização para reenviar;
- nunca generalizar a exceção atual de ativação para chamada pública sem esse
  registro durável.

Recuperação pública de senha continua fora da outbox, mas deriva idempotency key
do `correlationId` aleatório e pode ter lifecycle. Não guardar `resetUrl`, token
ou fingerprint sem HMAC.

### Tarefa 4.4: criar a rota de webhook assinada

**Estado em 2026-08-24:** rota, verificação exata do corpo bruto/headers,
normalização mínima, digest, duplicata idempotente, dead letter de schema e 503
de banco implementados. `RESEND_WEBHOOK_SECRET` é obrigatório em
Staging/Production e proibido em Preview.

**Criar:**

- `src/app/api/webhooks/resend/route.ts`
- `src/app/api/webhooks/resend/route.test.ts`
- `src/features/email-delivery/resend-webhook.ts`
- `src/features/email-delivery/resend-webhook.test.ts`

**Modificar:**

- `src/lib/env.ts`
- `.env.example`
- testes de ambiente
- `docs/integrations/resend.md`

**Variável:** `RESEND_WEBHOOK_SECRET`, diferente de `RESEND_API_KEY`.

**Contrato HTTP baseado no SDK Resend atual:**

1. `await request.text()` exatamente uma vez;
2. exigir `svix-id`, `svix-timestamp` e `svix-signature`;
3. chamar `resend.webhooks.verify` com o corpo bruto e o shape exigido pelo SDK
   `6.17.2`, sem passar `request.headers` diretamente nem fazer parse/stringify:

   ```ts
   resend.webhooks.verify({
     payload: rawBody,
     headers: {
       id: svixId,
       timestamp: svixTimestamp,
       signature: svixSignature,
     },
     webhookSecret,
   });
   ```

4. assinatura ausente ou inválida => 400 e zero escrita;
5. assinatura válida => extrair somente tipo, `created_at`, `data.email_id` e
   tags de correlação allowlisted; calcular digest do corpo;
6. inserir evento em transação por `svix-id`;
7. duplicata => 200 idempotente;
8. schema válido persistido => 200 somente após commit;
9. schema assinado mas não normalizável => persistir envelope mínimo em
   `dead_letter` com `invalid_event_schema` e retornar 200;
10. falha de banco => 503 para o provider tentar novamente.

Não registrar o objeto verificado, headers, destinatário, assunto ou exceção
bruta do SDK.

### Tarefa 4.5: processar a inbox fora da requisição

**Estado em 2026-08-24:** claim/lease, doze tentativas, redução transacional,
cron próprio, retenção em lotes, alertas e painel aceite versus entrega
implementados. A integração PostgreSQL comprovou as duas ordens da corrida.

**Criar:**

- `src/features/email-delivery/worker.ts`
- `src/features/email-delivery/worker.test.ts`
- `src/features/email-delivery/runner.ts`
- `src/features/email-delivery/runner.test.ts`
- `src/app/api/cron/resend-webhooks/route.ts`
- `src/app/api/cron/resend-webhooks/route.test.ts`

**Modificar:**

- `src/config/scheduled-jobs.ts`
- `vercel.json`
- `src/features/maintenance/server.ts`
- testes de manutenção e snapshot operacional

**Worker:** claim com `for update skip locked`, lease de dez minutos, backoff com
jitter e até doze tentativas por 24 horas. Resolver mensagem por
`provider_message_id`; se ainda não existir, usar a tag allowlisted de correlação
para preencher o registro `sending`. Evento válido que chegou antes da aceitação
local fica `retrying`, não é descartado.

Aplicar projeção e marcar evento processado na mesma transação. Bounce,
complaint, suppressed e failed não reenviam e-mail nem mudam automaticamente
Conta, Matrícula ou Pedido; geram sinal operacional para investigação.

Cron a cada cinco minutos, lease próprio `resend-webhooks`, mesmas guardas de
`CRON_SECRET` e `SCHEDULED_JOBS_ENABLED`. Maintenance executa retenção em lotes
de no máximo 500.

### Tarefa 4.6: configurar e provar o webhook no Resend

**Alteração externa controlada:** painel/API Resend.

**Eventos inscritos:** `email.sent`, `email.delivery_delayed`,
`email.delivered`, `email.failed`, `email.suppressed`, `email.bounced` e
`email.complained`. Não inscrever opened/clicked nesta iniciativa.

**Passos:**

- [x] Implantar a rota antes de criar a inscrição.
- [x] Guardar o signing secret no ambiente correto e validar fingerprint, sem
  copiá-lo para Git/log.
- [x] Enviar evento controlado com envelope assinado do provider e provar
  assinatura e duplicata por `svix-id` no Staging persistente.
- [ ] Provar com lifecycle originado pelo Resend o evento antes/depois da
  aceitação e a transição final.
- [ ] Confirmar que o painel chama aceite `accepted` e entrega final
  `delivered`; remover linguagem ambígua de outbox.
- [ ] Criar alerta para inbox `dead_letter`, evento `retrying` acima de uma hora,
  crescimento de bounce/complaint e ausência de evento `accepted` por tópico.
- [ ] Registrar IDs sanitizados, nunca endereço ou conteúdo.

**Automação operacional preparada em 2026-08-25:** o teste de contrato revelou
que o scheduler externo de Staging não chamava `/api/cron/resend-webhooks`; a
agenda foi alinhada aos quatro workers de cinco minutos. O workflow manual
`Run Staging jobs`, operação `verify-resend-lifecycle`, e o checker fail-closed
usam somente o GitHub Environment `vercel-staging`, segredo próprio e a confirmação
`SEND_CONTROLLED_STAGING_PASSWORD_RESET`. O aceite exige `email.sent` e
`email.delivered` processados, estado final `delivered`, zero conflito e zero
erro. A execução real permanece pendente até essa mudança alcançar `staging`.

**Primeira execução e correção:** o run `32875321220` emitiu um único request e
falhou com estado vazio; o log runtime sanitizado confirmou
`password_reset_email_delivery_failed`. Nenhum `email_messages` foi criado e não
houve retry de envio. O checker deixou de depender de `STAGING_ADMIN_EMAIL`: a
rota `POST /api/health/resend`, protegida por segredo próprio e confirmação
literal, escolhe no runtime uma Conta existente que também esteja na allowlist,
inicia o lifecycle e retorna somente o UUID de correlação. O segredo foi
provisionado apenas em Staging. Nova execução real permanece pendente após
deploy dessa rota.

### Gate da Sprint 4

- [x] Webhook inválido não escreve; duplicata é 200 idempotente.
- [x] Corrida webhook/aceitação converge sem reenvio.
- [x] Reset não persiste token/URL/conteúdo.
- [x] Estado fora de ordem não regride.
- [x] Dashboard distingue aceite e entrega.
- [x] Migration e gates comuns verdes.

**STOP:** corpo bruto persistido; assinatura verificada após parse; evento pode
acionar reenvio; `invalid_idempotent_request` cria chave nova; lifecycle altera
status genérico da outbox; alerta exige plano pago.

---

## Sprint 5: DMARC, Sentry e verdade operacional

**Estado em 2026-08-24T16:29:05Z:** `IMPLEMENTED_LOCAL` /
`EXTERNAL_GATES_PENDING`. O analisador DMARC, a verdade documental, o checker
Vercel/Neon/PostgreSQL, a configuração Sentry, o probe e o checker de evento
estão implementados e verdes localmente. Progressão DNS, corte do projeto
Sentry, source map/evento reais e alerta recebido continuam deliberadamente
pendentes; nenhum provider foi alterado.

**Checkpoint externo de Staging em 2026-08-25:** o deployment
`aceeaf830cf75667df8ce21e5b586d47155dd5ac` publicou a release e os source maps
no projeto preservado. O probe real provou ambiente, release, tag e frame
source-mapped. O gate permanece aberto porque `scrubIPAddresses=false` fez a
ingestão derivar `user.geo`, e o workflow global acionado não filtra ambiente nem
comprova canal institucional. DMARC continua no estágio inicial e Production
não foi alterada.

### Resultado

Encerrar `F-006` e `F-007` e transformar Sentry de lacuna em evidência
reproduzível, sem serviço pago adicional.

### Tarefa 5.1: analisar relatórios DMARC sem SaaS pago

**Estado em 2026-08-24:** concluída localmente. XML/gzip/zip, deduplicação,
agregação, limites de 2 MiB/10 MiB/100×, XXE e arquivo excessivo estão cobertos
por três testes; `fast-xml-parser` é dependência direta e o diretório bruto é
ignorado.

**Criar:**

- `src/tooling/dmarc-report.ts`
- `src/tooling/dmarc-report.test.ts`
- `scripts/analyze-dmarc-report.ts`
- `docs/operations/dmarc-rollout.md`

**Modificar:**

- `package.json` e `bun.lock` somente se um parser XML mantido for necessário;
- `.gitignore` para o diretório local de relatórios brutos;
- `docs/integrations/resend.md`

**Contrato:** aceitar XML, gzip ou zip baixado da caixa institucional; impor
limites de arquivo/expansão, desabilitar entidades externas e rejeitar XML
malformado. Saída agregada contém organização emissora, intervalo, source IP,
contagem, disposição e alinhamento SPF/DKIM. Não commitar XML, endereço de
destinatário ou headers.

**Testes:** fixture mínima, zip bomb/arquivo excessivo recusado, XXE recusado,
relatório duplicado deduplicado e agregação correta.

### Tarefa 5.2: executar a progressão DMARC

**Registro recomendado:**

```text
v=DMARC1; p=<policy>; pct=<percent>; rua=mailto:<caixa-institucional>;
adkim=r; aspf=r; ri=86400
```

Não configurar `ruf` nesta iniciativa. Preservar um único registro DMARC.

**Etapas e gates:**

1. `p=none; pct=100` por 14 dias completos;
2. `p=quarantine; pct=25` por 72 horas;
3. `p=quarantine; pct=100` por 7 dias;
4. `p=reject; pct=25` por 72 horas;
5. `p=reject; pct=100` por pelo menos 7 dias antes de fechar `F-006`.

Antes de cada alteração, registrar valor e TTL anteriores, reduzir TTL com
antecedência e obter confirmação humana. Depois, resolver DNS por pelo menos
dois resolvers, confirmar SPF/DKIM no Resend, analisar relatórios e observar
bounce/complaint.

**Avançar somente se:** 100% das fontes legítimas estão inventariadas; DKIM e SPF
permanecem verificados e alinhados; não existe falha legítima sem explicação;
volume do relatório é suficiente para a janela.

**Rollback:** voltar imediatamente ao estágio anterior, restaurar `pct`,
registrar causa e reiniciar toda a janela. Não pular de `none` para `reject`.

### Tarefa 5.3: centralizar fatos locais verificáveis

**Estado em 2026-08-24:** concluída. `docs:check` cobre 35 documentos, deriva
`0067_sparkling_ghost_rider`, 68 entradas e 46 tabelas, valida checkpoint por
SHA completo/existente/ambiente, referências `DEC-DISC-*` e indexação histórica
de plano `superseded`.

**Modificar:**

- `scripts/check-docs.ts`
- testes de `validateDocumentation`
- `README.md`
- `docs/architecture.md`
- `docs/operations/database-and-migrations.md`
- `docs/operations/release-state.md`

**Criar:**

- `src/tooling/documentation-facts.ts`
- `src/tooling/documentation-facts.test.ts`

**Passos:**

- [x] Tornar `docs/operations/database-and-migrations.md` o único documento que
  declara migration superior, quantidade de entradas e quantidade de tabelas.
  README e arquitetura apontam para ele, sem repetir literais mutáveis.
- [x] Adicionar metadata estruturada `current_migration_tag`,
  `migration_entry_count` e `schema_table_count` ao runbook do banco.
- [x] Fazer `docs:check` derivar migration/tag/contagem do journal e contagem de
  exports `pgTable` do schema, comparando com a metadata.
- [x] Exigir SHA completo nos checkpoints de `release-state.md`, existência do
  commit e ambiente permitido.
- [x] Validar que decisões `approved/implemented` referenciadas nos guias
  existem em `docs/decisions.md` e que plano marcado `superseded` não aparece
  como executável.
- [x] Manter o checker offline e determinístico; ele não consulta providers nem
  reescreve Markdown.

### Tarefa 5.4: verificar Vercel e Neon contra o estado documentado

**Estado em 2026-08-24:** implementada localmente; execução externa pendente. O
workflow chama o checker depois do smoke não promovido e depois da promoção. A
consulta PostgreSQL usa transação `read only`, lê somente versão e journal e
emite divergências fechadas.

**Criar:**

- `src/tooling/production-release-check.ts`
- `src/tooling/production-release-check.test.ts`
- `scripts/check-production-release-state.ts`

**Modificar:**

- `package.json`
- `.github/workflows/deploy-vercel.yml`
- `docs/operations/production-release-guide.md`

**Vercel:** `GET /v13/deployments/app.neurocapacitar.com.br` com
`withGitRepoInfo=true` e team ID. Exigir `READY`, `production`, alias canônico,
SHA Git/meta igual ao `release_sha` e projeto correto.

**Neon:** conferir projeto/branch via API e, por conexão direta read-only,
PostgreSQL 18, journal superior e marker compatível. Nunca selecionar dados de
domínio.

**Comparação:** ler `docs/operations/release-state.md`; emitir JSON sanitizado
com `match` ou lista fechada de divergências. Token 401/403, resposta incompleta
ou timeout são falha, não `unknown` verde.

Executar no workflow depois do smoke do deployment não promovido e novamente
após promoção. O primeiro compara com o SHA candidato; o segundo também exige o
alias canônico. O script nunca edita documento.

### Tarefa 5.5: tornar release e source map do Sentry explícitos

**Auditoria e regressão em 2026-08-25:** a credencial separada somente leitura
confirmou que `hub-development` concentra Development, Staging e Production,
com 25 releases; `hub-production` possui uma release e não recebeu ocorrência
nos 14 dias consultados. Production no projeto histórico apresentou cinco
Issues/688 ocorrências, das quais 671 eram um loop do sanitizador recursivo
durante verificação local Windows classificada como Production. O teste focado
reproduziu o mesmo `RangeError`; o commit `801a1ce` tornou referências circulares
serializáveis e manteve a remoção de PII. Os frames continuaram minificados, sem
contexto resolvido. A CLI reconheceu release/stack, mas informou que a release
não tem artefatos enviados; portanto source map real segue como gate aberto.

**Modificar:**

- `next.config.ts`
- `src/lib/sentry-options.ts`
- `src/instrumentation.ts`
- `instrumentation-client.ts`
- testes de configuração/sanitização
- documentação de ambiente

**Contrato:** release Sentry é o SHA Git completo do deployment. Organização e
projeto usados pelo upload, SDK e checker devem vir da mesma configuração
validada. O build com `SENTRY_AUTH_TOKEN` publica source maps; o runtime não
recebe esse token.

**Inventário autenticado atualizado em 2026-08-24:** a organização canônica é
`neurocapacitar`. O projeto ID `4511808556564480`, hoje
`hub-development`, contém 24 releases, 22 Issues não resolvidas e histórico dos
ambientes `development`, `staging` e `production`; ele será preservado e
receberá o slug neutro recomendado `hub-web`. O projeto `hub-production`, ID
`4511951566798848`, contém uma release, três Issues no total e uma não
resolvida; seu DSN está no bundle Production atual. O zero mostrado no gráfico
do painel era relativo ao intervalo visível, não ao inventário completo. Não
remover nem renomear o projeto novo antes de triar suas Issues e concluir o
corte de DSN, ingestão, janela de observação e rollback.

**Passos:**

- [x] Introduzir `SENTRY_ORG`, `SENTRY_PROJECT` e release derivada do SHA de
  deployment, com guardas de Production.
- [ ] Alterar o slug do projeto preservado para `hub-web` com credencial de
  gestão separada; confirmar que o project ID e a DSN permanecem os esperados e
  registrar rollback. Não conceder escrita à credencial de inspeção.
- [ ] Apontar Development, Staging e o deployment Production candidato para o
  projeto preservado, sempre com `environment` explícito. Production só troca o
  DSN no deployment candidato, nunca diretamente no deployment canônico atual.
- [ ] Consolidar os dois workflows no projeto preservado. O alerta operacional
  de Production deve filtrar `environment=production` e notificar um canal
  institucional monitorado; `issue_owners` pode permanecer como ação adicional,
  não como único destino.
- [x] Triar as três Issues já existentes em `hub-production`, sem copiar PII ou
  payload bruto para a documentação, e registrar sua relação com a release
  Production atual. Resultado somente leitura: `HUB-PRODUCTION-1` e `-3` estão
  resolvidas, tiveram uma ocorrência e não recorreram; `HUB-PRODUCTION-2` é uma
  notificação de teste não resolvida, com uma ocorrência em 22 de agosto. Nada
  foi resolvido ou reaberto pela auditoria.
- [ ] Manter `hub-production` disponível e sem novos eventos por uma janela de
  observação que cubra ao menos um deploy, um evento sintético em Staging e um
  evento sintético em Production. Só então abrir ação separada para arquivar ou
  remover o projeto vazio; nunca apagar como parte automática do deploy.
- [x] Configurar `useRunAfterProductionCompileHook: true` somente depois de
  confirmar compatibilidade entre Next.js 16.2.11 e `@sentry/nextjs` 10.68.0;
  manter a estratégia atual se o teste de build mostrar regressão.
- [x] Manter `sendDefaultPii=false` e todos os sanitizadores existentes.
- [x] Acrescentar testes que removem e-mail, token, query string, código de
  Certificado e atributos sensíveis de evento, breadcrumb, transaction e span.
- [x] Verificar no build local sem upload que source maps não aparecem no
  artefato público (`.next/static`: zero `.map`). Repetir no deployment com
  upload autenticado antes de fechar o gate externo.

**Evidência real de Staging em 2026-08-25:** o PR `#54` corrigiu a convenção do
Next.js 16 ao mover `instrumentation.ts` para `src/`, ao lado de `src/app`. A CI
`32862430399` passou e o deploy `32863445174`, tentativa 2, publicou a release
`aceeaf830cf75667df8ce21e5b586d47155dd5ac` com source maps de browser, servidor,
edge e `instrumentation.js`. O deployment exato
`dpl_FZ3WPZfrjAgD6jQPR7s4zvneePNu` ficou `READY` no target `staging`, passou
smoke direto e assumiu `preview.neurocapacitar.com.br`. Isso fecha o upload e a
resolução em Staging, não a privacidade, o alerta institucional ou a prova
Production.

### Tarefa 5.6: emitir e verificar um evento sintético sem PII

**Estado em 2026-08-25:** rota e checker implementados e emissão real concluída
em Staging. O token de inspeção configurado foi introspectado sem exposição e tem
somente escopos de leitura/release (`alerts:read`, `event:read`, `org:read`,
`project:read` e correlatos), não gestão.

**Revalidação em 2026-08-25:** o helper somente leitura e o Sentry CLI listaram
projetos, releases e Issues sem 403. Isso fecha somente o acesso de inspeção;
nenhum evento foi emitido, nenhum alerta foi acionado e nenhuma configuração do
provider foi alterada.

**Execução real posterior:** `POST /api/health/sentry` no deployment exato
retornou `eventId=2a8b96ca952740ffb28a7fc04c7816d1` e
`correlationId=97350600-8687-47b8-842d-f896d75bd8c5`. A leitura autenticada
confirmou `environment=staging`, release igual ao SHA, tag
`readiness_probe=sentry` e frame
`app:///src/lib/sentry-readiness.ts:42`. O workflow global do projeto foi
acionado depois do evento. A sanitização ainda reprova: a API normalizou
`cookies=[]` e acrescentou `user.geo` porque `scrubIPAddresses` está desativado.
O token read-only não possui `project:write`; não aumentar seu escopo. Após uma
credencial de gestão habilitar a remoção de IP, emitir outro probe e comprovar
também um workflow filtrado por ambiente em canal institucional.

**Criar:**

- `src/app/api/health/sentry/route.ts`
- `src/app/api/health/sentry/route.test.ts`
- `src/lib/sentry-readiness.ts`
- `src/lib/sentry-readiness.test.ts`
- `src/tooling/sentry-readiness-check.ts`
- `src/tooling/sentry-readiness-check.test.ts`
- `scripts/check-sentry-readiness.ts`

**Modificar:**

- `src/lib/env.ts`
- `.env.example`
- testes de ambiente
- `docs/operations/environment-and-local-development.md`

**Rota:** `POST`, Node runtime, protegida por
`SENTRY_READINESS_SECRET` próprio e por corpo literal
`{"confirmation":"EMIT_SENTRY_READINESS_EVENT"}`. Não reutilizar
`HEALTHCHECK_SECRET`; leitura de readiness não deve ganhar permissão de emitir
evento. Secret ausente ou ambiente fora de Production/Staging retorna 404; bearer
inválido retorna 401 e zero evento. Ela cria uma exceção constante sem request
body, usuário, URL ou agregado, adiciona tags de baixa cardinalidade
`readiness_probe=sentry`, `environment` e `release`, chama `captureException`,
aguarda `flush` com timeout e retorna apenas `eventId` e `correlationId`.

**Checker somente leitura:** com credencial de inspeção separada, aguardar o
evento e confirmar:

- organização/projeto e ambiente corretos;
- release igual ao SHA implantado;
- evento contém a tag sintética e nenhuma PII;
- frame da exceção resolve para `src/lib/sentry-readiness.ts`, não somente bundle
  minificado;
- regra de alerta ativa alcança o evento.

Recebimento no canal institucional é confirmação humana anexada com horário e
nome da regra, sem encaminhar o e-mail bruto. O script não cria regra nem envia
mensagem externa por conta própria.

### Gate da Sprint 5

- [ ] DMARC em `reject; pct=100` estável pelo período mínimo.
- [x] `docs:check` detecta migration e metadado deliberadamente adulterados.
- [ ] Checker remoto detecta SHA/branch/migration divergentes.
- [ ] Sentry prova release, source map, evento sanitizado e alerta recebido.
- [x] Nenhum gate exige upgrade ou trial contínuo: GitHub usa runner padrão
  ilimitado no repositório público; Neon, R2, Sentry, Resend e DNS permanecem
  nos contratos gratuitos já medidos.

**STOP:** remetente legítimo falha DMARC; Sentry continua 403; stack não resolve
source map; evento contém PII; checker remoto possui permissão de mutação;
documentação é atualizada automaticamente por provider.

---

## Sprint 6: senha, acessibilidade, mobile e dependências

**Estado em 2026-08-24T20:43:00Z:** `LOCAL_RUNTIME_QUALIFIED` /
`DEPENDABOT_PROVIDER_PENDING`. Política de senha, helper Axe moderate+,
inventário de superfícies, projetos desktop/mobile, métricas por projeto,
jornadas de teclado/foco e configuração Dependabot Bun estão implementados. O
gate local aprovou 339 arquivos e 2.278 testes Vitest, 880 arquivos no Ultracite,
35 documentos canônicos, TypeScript, migrations, build Next.js e Knip. A
integração PostgreSQL aprovou 45/45 testes. O Playwright aprovou 41/41 casos em
7,7 min, sendo 33 desktop e oito mobile, sem skip, retry ou flaky, e manteve zero
source map público em `.next/static`. A branch Neon descartável foi removida e a
consulta posterior confirmou HTTP 404. Permanece aberto apenas o gate externo
de um PR Dependabot real no SHA candidato remoto; nenhum banco compartilhado foi
usado como atalho.

### Resultado

Encerrar `F-008`, `F-009` e `F-010` com uma política única de oito caracteres,
matriz E2E proporcional ao risco e atualização gratuita do lockfile Bun.

### Tarefa 6.1: criar uma política única de senha

**Criar:**

- `src/lib/password-policy.ts`
- `src/lib/password-policy.test.ts`

**Modificar:**

- `src/lib/auth.ts`
- `src/app/(auth)/cadastro/sign-up-form.tsx`
- `src/app/(auth)/redefinir-senha/page.tsx`
- `src/app/(auth)/redefinir-senha/reset-password-form.tsx`
- testes de cadastro/reset e E2E

**Contrato:**

```ts
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_LENGTH_MESSAGE =
  "Use uma senha com pelo menos 8 caracteres.";
```

**Passos:**

- [x] Usar a constante no Better Auth, atributos HTML, validação cliente,
  schemas, mensagens e testes.
- [x] Procurar literais 8/10 relacionados a senha e eliminar regras paralelas.
- [x] Testar 7 rejeitado, 8 aceito, confirmação divergente rejeitada e reset
  revogando sessões.
- [x] Não alterar hashing, token de uma hora, rate limit ou mensagem
  anti-enumeração.

### Tarefa 6.2: elevar Axe para `moderate`

**Estado local:** helper e quatro grupos de superfícies implementados sem
allowlist global. Diagnósticos contêm somente regra, impacto, help URL e até três
seletores; dois testes unitários provam o filtro e a ausência de HTML/valor.
A execução E2E descartável foi habilitada com migrador direto e branch Neon do
parent da CI; o resultado integral está registrado na requalificação.

**Criar:**

- `tests/e2e/accessibility.ts`
- `tests/e2e/accessibility.spec.ts`

**Modificar:**

- `tests/e2e/critical-journeys.spec.ts`
- testes adjacentes que repetem filtro Axe

**Helper:** falha para `moderate`, `serious` e `critical`, imprime rule ID,
impacto, help URL e seletores limitados; nunca despeja HTML completo. Uma
exclusão precisa estar junto ao teste, citar issue/prazo e regra exata. Não criar
allowlist global.

**Superfícies mínimas:** home, login, cadastro/reset, compra pública, dashboard
da Aluna, Aula, Certificados, dashboard `support`, Cursos operacionais, Alunas no
contexto do Curso, Financeiro, dashboard Admin e editor de Curso/Certificado.

### Tarefa 6.3: adicionar Chromium mobile sem duplicar toda a suíte

**Estado local:** `chromium-desktop` exclui apenas o caso `@mobile-only` e
`chromium-mobile` seleciona oito casos `@mobile`. O relatório JSON agrega duração,
falhas e retries por projeto; CI permite uma repetição diagnóstica e falha se ela
for necessária. O repositório é público e todos os jobs usam runner padrão
`ubuntu-24.04`, cujo uso é gratuito e ilimitado. A API registrou dois caches
ativos somando `70.698.566` bytes, abaixo de 1% do limite de 10 GB por
repositório. A qualificação local usa um worker por compartilhar fixture e branch
descartável; duração e retries definitivos da matriz ainda dependem da CI no SHA
candidato, mas não existe cota mensal de minutos a projetar nesse contrato.

**Modificar:**

- `playwright.config.ts`
- `tests/e2e/critical-journeys.spec.ts`
- `.github/workflows/ci.yml`
- `scripts/report-playwright-metrics.ts`
- `docs/operations/testing-and-ci.md`

**Projetos:**

```ts
projects: [
  {
    name: "chromium-desktop",
    grepInvert: /@mobile-only/,
    use: devices["Desktop Chrome"],
  },
  {
    name: "chromium-mobile",
    grep: /@mobile/,
    use: devices["Pixel 7"],
  },
]
```

Marcar `@mobile` apenas nas jornadas críticas: login/TOTP, compra pública,
dashboard/Aula da Aluna, Certificado, navegação e ficha de Aluna do `support` e
reembolso com confirmações. Desktop continua executando toda a suíte aplicável
ao viewport.
O caso que depende exclusivamente do menu móvel usa `@mobile-only` para não
gerar skip no projeto desktop.

CI deve relatar duração por projeto. Se a média mensal projetada atingir 80% da
cota Actions, mover a matriz mobile completa para schedule diário e manter em PR
um smoke mobile representativo. Nunca silenciar falha para economizar minutos.

### Tarefa 6.4: completar teclado, foco e dialogs

**Estado local:** login, TOTP, link de salto, sidebar mobile, ficha da Aluna,
crop de Certificado e confirmação de reembolso receberam asserções de foco,
Escape, região viva ou Enter seguro. A fronteira do Suporte também verifica
links ausentes e redirect 307 da URL Admin proibida. A execução funcional dessas
asserções foi exercitada no banco E2E descartável conforme a requalificação.

**Modificar/criar testes E2E:**

- login e challenge TOTP em ordem de tabulação;
- skip/foco no conteúdo principal;
- sidebar desktop/mobile e retorno de foco ao trigger;
- `StudentManagementSheet`, dialogs de expiração, Certificado e reembolso;
- Escape fecha somente quando seguro; confirmação destrutiva não dispara por
  Enter acidental fora do formulário;
- mensagens de erro recebem foco ou região viva;
- foco visível em todos os controles testados.

Provar também que `support` não alcança links proibidos por teclado e que URL
direta continua negada.

### Tarefa 6.5: cobrir dependências JavaScript/Bun

**Estado local:** configuração `github-actions` preservada e ecossistema `bun`
adicionado com agenda, grupos e limite aprovados. YAML foi parseado localmente e
a documentação oficial confirmou Bun 1.1.39+; a abertura e validação de um PR
real do Dependabot continua sendo evidência externa pendente.

**Auditoria GitHub em 2026-08-25:** a branch padrão ainda usa a configuração
anterior. O PR Dependabot #6 atualiza `actions/checkout` e possui quality/build
verdes, com integração e browser corretamente skipped para o bot, mas não altera
`package.json` ou `bun.lock`. Não serve como aceite de `F-010`. Depois do merge
da remediação, aguardar a execução dinâmica semanal e exigir um PR do ecossistema
`bun` com lockfile gerado pelo próprio Dependabot.

**Modificar:**

- `.github/dependabot.yml`
- `.github/workflows/ci.yml`, se necessário para bot/fork
- `docs/operations/testing-and-ci.md`

**Configuração:** manter o bloco `github-actions` e adicionar:

```yaml
- package-ecosystem: bun
  directory: /
  schedule:
    interval: weekly
    day: monday
    time: "09:00"
    timezone: America/Sao_Paulo
  open-pull-requests-limit: 5
  groups:
    production-minor-patch:
      dependency-type: production
      update-types: [minor, patch]
    development-minor-patch:
      dependency-type: development
      update-types: [minor, patch]
```

Dependabot atual suporta o `bun.lock` textual usado por Bun 1.1.39+ através do
ecossistema `bun`; o repositório usa Bun 1.3.11. A documentação oficial foi
reconfirmada em 2026-08-24 antes da implementação; usar `npm` aqui deixaria a
configuração divergente da matriz atual do GitHub.

**Regras de merge:** majors individuais; grupos pequenos de minor/patch; lockfile
gerado pelo Bun; `bun install --frozen-lockfile`, audit, tipos, testes e build
verdes. Jobs que dependem de secrets podem ficar `skipped` para o bot, mas uma
pessoa deve rodar integração/E2E no SHA antes de merge de mudança de auth,
banco, provider, Playwright ou Next.js.

### Gate da Sprint 6

- [x] Busca não encontra política de senha diferente de 8.
- [x] Axe moderate+ verde nas superfícies listadas.
- [x] Chromium desktop completo e mobile crítico verdes: 41/41 em 7,7 min,
  zero skip, retry ou flaky, sobre branch Neon descartável removida após o gate.
- [x] Teclado/foco exercitados nos fluxos destrutivos e privileged auth.
- [ ] Dependabot reconhece `package.json` e `bun.lock` e abre PR de teste.
- [x] Cota Actions permanece abaixo do limite operacional: runner padrão
  ilimitado no repositório público e cache em `70.698.566` bytes de 10 GB.

---

## Sprint 7: requalificação completa para Production

**Estado em 2026-08-25T10:07:03Z:** implementação e CI do SHA candidato
`1e60557bc39956e74c1150880ca0d573129bcf34` concluídas. Decisão independente:
`NO-GO`, pois os gates externos listados em 7.5 e os findings `F-002`, `F-006` e
`F-010` permanecem abertos. Ver a requalificação para causas, commits e provas.

**Checkpoint posterior:** a auditoria externa somente leitura encontrou uma
regressão do sanitizador Sentry no candidato. O commit `801a1ce` possui teste
red/green focado, TypeScript e Ultracite aprovados; ele passa a ser descendente
obrigatório do próximo SHA candidato, mas não herda automaticamente a evidência
integral da CI `32834478030`. Reexecutar os gates antes de qualquer nova decisão.

**Checkpoint Staging de 2026-08-25:** PRs `#52`, `#53` e `#54` foram integrados
somente em Staging. O CI `32862430399` aprovou os quatro jobs; o deploy
`32863445174` aplicou `0065`–`0067`, publicou e verificou o SHA
`aceeaf830cf75667df8ce21e5b586d47155dd5ac`. Resend tem rota, secret e inscrição
de sete eventos, com assinatura/duplicata provadas. Sentry tem release,
source-map e evento real provados, mas privacidade e alerta institucional ainda
falham. Production permanece no SHA `9f2b8f1` e o resultado segue `NO-GO`.

**Verificação local posterior:** no SHA documental `92ec261`, migrations,
TypeScript, Ultracite, 339 arquivos/2.286 testes, build Next.js com 20 páginas
estáticas, zero source map público, Knip e audit de produção passaram. A CI
integral não foi disparada porque criaria branches Neon efêmeras fora da
autorização somente leitura.

### Resultado

Reexecutar a auditoria no SHA candidato e emitir uma nova decisão independente.
Não alterar o resultado histórico `NO-GO` de 23 de agosto.

### Tarefa 7.1: fechar cada finding com evidência

No relatório de requalificação, criar uma seção por `F-001` a `F-010` com:

- causa original;
- commit(s) corretivos;
- teste de regressão e comando;
- evidência remota quando aplicável;
- risco residual;
- estado `closed` ou `open`.

Não aceitar `mitigated` como fechamento de P1. Se qualquer finding estiver
aberto, a decisão é `NO-GO`.

### Tarefa 7.2: qualificar schema e banco descartável

**Estado local:** a branch descartável do parent da CI e a matriz integrada
foram comprovadas e removidas. A repetição integral da cadeia e o restore do
backup externo permanecem juntos no exercício remoto para que RPO/RTO, schema e
compatibilidade sejam medidos sobre o mesmo SHA candidato.

- [x] Criar branch Neon descartável do mesmo parent usado pela CI.
- [ ] Aplicar toda a cadeia até o topo duas vezes.
- [x] Executar integração de suporte concorrente, expiração, lifecycle Resend,
  auth/2FA e Certificados.
- [ ] Confirmar marker, journal, tabelas, enums, triggers, constraints e índices.
- [ ] Restaurar o backup Production mais recente em outro target descartável e
  executar a mesma compatibilidade.
- [ ] Remover os dois targets somente após evidência e conferência de IDs.

### Tarefa 7.3: executar a matriz de segurança

Para `student`, `support` e `admin`, testar UI, Route Handlers e Server Actions.

**Negação obrigatória de `support`:** `/admin/cursos` autoral, editor de Aula,
configurações, banners/FAQ, analytics e export, auditoria global, moderação,
concessão manual, bloqueio de plataforma, emissão/revogação de Certificado,
conciliação/extrato/decisão financeira e retries.

**Permissão obrigatória de `support`:** dashboard operacional, Cursos agregados,
Alunas/contexto, validade/bloqueio de Matrícula, histórico restrito,
Financeiro read-only, reemissão mais recente e refund integral com todos os
fatores.

Testar sessão antiga após mudança de papel, TOTP ausente, backup code usado,
tentativas excessivas e chamada direta sem UI.

### Tarefa 7.4: executar todos os gates locais e CI

**Estado local e remoto:** `verify` completo e CI `32834478030` passaram no SHA
candidato. Foram 2.285 testes Vitest, 45 testes PostgreSQL e 41 casos
Playwright, sem vulnerabilidade conhecida, sem source map público, retry ou
resultado não aprovado. Build e Knip passaram; Knip manteve 14 configuration
hints não impeditivos, e o warning Node 20 foi eliminado. As duas branches Neon
efêmeras foram excluídas.

```powershell
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run check
bun run test
bun run test:certificates:integration
bun run test:e2e
bun run build
bun run knip
bun audit --production
bun run verify:quick
```

Além do exit 0, revisar warnings, retries, testes skipped, duração E2E e artefatos.
Nenhum `.only`, `.skip` não justificado ou violação Axe allowlisted globalmente.

### Tarefa 7.5: executar gates externos sem venda real

- [ ] Checker Vercel/Neon concorda com release-state candidato.
- [ ] Backup recente, RPO/cota e restore/RTO verdes.
- [ ] Resend templates/domain/webhook e lifecycle controlado verdes.
- [ ] DMARC final estável, SPF/DKIM alinhados e relatórios sem fonte desconhecida.
- [ ] Sentry event/source map/alert verdes.
- [x] Smokes de endpoints públicos e readiness no endereço exato antes da
  atualização do alias de Staging.
- [x] Não criar Checkout ou pagamento real nesta Sprint.

### Tarefa 7.6: emitir decisão

Uma decisão `GO` exige todos os itens anteriores e zero P0/P1/P2/P3 abertos do
escopo. Registrar aprovador humano, SHA completo, horário UTC e janela proposta.

`NO-GO` exige listar bloqueios e próxima evidência necessária. Não promover por
prazo, custo afundado ou porque a correção “parece segura”.

---

## Sprint 8: deploy e validação pós-Production

**Estado:** `NOT STARTED`. O `NO-GO` da Sprint 7 e o congelamento exclusivo de
Production impedem qualquer tarefa desta Sprint. Staging/Preview pode continuar
sendo usado para qualificação, mas isso não inicia a Sprint 8. A venda real continua
permitida somente depois da promoção e estabilidade inicial em Production.

### Resultado

Promover o SHA aprovado com manutenção, observar o sistema real e executar a
primeira venda supervisionada somente após estabilidade inicial.

### Tarefa 8.1: executar o release protegido

**Workflow:** `.github/workflows/deploy-vercel.yml`.

**Ordem:**

1. confirmação literal e SHA contido em `main` com CI verde;
2. checker de backup R2 recente;
3. branch Neon de release e ancestralidade;
4. migrations com advisory lock;
5. inspeção do journal;
6. build/deployment Production não promovido com release Sentry igual ao SHA;
7. readiness e smokes não destrutivos;
8. check de Vercel/Neon candidato;
9. promoção do alias;
10. smokes canônicos e check remoto final;
11. saída da manutenção somente pelo procedimento aprovado.

**Rollback:** aplicação anterior compatível; migrations permanecem forward-only.
Backup R2 e branch Neon não são apagados. Se schema impedir rollback da aplicação,
manter manutenção e executar forward-fix revisado.

### Tarefa 8.2: observar antes da venda

Durante a janela definida no release:

- login de `student`, `support` e `admin`, incluindo TOTP;
- readiness, logs e Sentry sem nova falha inexplicada;
- crons e leases; outbox e inbox Resend sem backlog stale;
- webhook Resend assinado e eventos controlados convergentes;
- backup agendado posterior ao deploy e manifesto com migration nova;
- Neon sem pico de conexão/egress e R2 dentro da cota;
- DMARC, bounce e complaint sem regressão.

Qualquer P1 operacional mantém a venda suspensa e aciona rollback/incidente.

### Tarefa 8.3: obter autorização específica para a venda real

A execução exige uma pessoa responsável presente, caixa controlada, meio de
pagamento real autorizado e confirmação explícita naquele momento. Não reutilizar
a aprovação deste plano como autorização financeira permanente.

Registrar antes:

- Curso e preço vigente, sem alterá-los para o teste;
- identidade controlada da compradora fora do Git;
- operador Admin/Support e pessoa supervisora;
- plano de interrupção e reembolso integral;
- quais IDs serão registrados apenas de forma sanitizada.

### Tarefa 8.4: executar e acompanhar a venda

1. abrir o link público canônico e criar exatamente um Checkout;
2. concluir o pagamento real;
3. acompanhar Pedido, evento Asaas, identidade, Concessão, Matrícula e acesso;
4. confirmar aceite e `delivered` do e-mail sem copiar seu conteúdo/token;
5. abrir o Curso como a Aluna controlada;
6. verificar ausência de erro novo no Sentry e backlogs;
7. pelo fluxo oficial de `executeRefund`, confirmar TOTP, senha, ID completo e
   motivo e solicitar reembolso integral;
8. aguardar confirmação financeira autoritativa e provar revogação do acesso;
9. `support` não executa conciliação manual. Se houver incerteza, Admin segue o
   runbook e consulta o provider antes de qualquer retry;
10. anexar tempos, estados e IDs sanitizados ao relatório pós-release.

Não repetir cobrança ou reembolso para “testar de novo”. Resultado incerto é
incidente financeiro.

### Tarefa 8.5: encerrar a release

- [ ] Atualizar `docs/operations/release-state.md` com os três checkpoints reais.
- [ ] Atualizar documentos canônicos das funcionalidades efetivamente
  implantadas e seus `last_verified_commit`.
- [ ] Acrescentar resoluções ao relatório histórico sem alterar sua decisão
  original.
- [ ] Registrar a venda supervisionada como validação pós-deploy, não como gate
  retroativo.
- [ ] Programar próximo restore trimestral, revisão DMARC e revisão mensal de
  cotas.

---

## 6. Matriz de rastreabilidade

| Finding/lacuna | Sprint e tarefas | Prova mínima de encerramento |
|---|---|---|
| `F-001` autorização `support` | 1.1–1.6, 7.3 | matriz completa, denial direto e E2E por papel |
| `F-002` recuperação | 2.1–2.6, 7.2 | backup cifrado, PITR e restore real dentro de RPO/RTO |
| `F-003` corrida de suporte | 3.1–3.2 | 4 concorrentes => 3 commits e 1 rejeição |
| `F-004` validade obsoleta | 3.3–3.5 | geração antiga `superseded`, zero envio |
| `F-005` lifecycle Resend | 4.1–4.6 | assinatura, inbox, aceite e terminal separados |
| `F-006` DMARC | 5.1–5.2 | `reject; pct=100` estável e relatórios limpos |
| `F-007` drift documental | 5.3–5.4 | checker local/remote falha em divergência induzida |
| `F-008` senha | 6.1 | 7 rejeitado, 8 aceito em cadastro/reset/backend |
| `F-009` a11y/mobile | 6.2–6.4 | Axe moderate+, teclado e dois projetos Chromium |
| `F-010` dependências | 6.5 | PR Dependabot altera `bun.lock` e passa gates |
| Sentry desconhecido | 0.4, 5.5–5.6 | release, source map, evento sem PII e alerta recebido |
| Venda supervisionada | 8.3–8.4 | somente pós-deploy, um ciclo pago e refund observado |

## 7. Rollback por componente

### Aplicação e RBAC

Promover deployment anterior compatível. Migrations e trigger de revogação de
sessão permanecem. Assurance falha fechada; se UI 2FA quebrar, manter manutenção
e corrigir, não liberar privileged routes sem segundo fator.

### Backup

Falha de novo run nunca apaga a última cópia válida. Desabilitar schedule apenas
durante incidente documentado; PITR e backups existentes permanecem. Não trocar
para storage pago silenciosamente.

### Outbox

Versão anterior ignora `superseded`; migration é aditiva. Pausar worker durante
rollback se a versão antiga não conhecer payload v2. Nunca converter
`superseded` em `pending` em massa.

### Resend

Desabilitar a inscrição do webhook sem interromper envio. Preservar inbox já
gravada para reprocessamento. Não remover tabelas, signing secret ou histórico
durante o incidente.

### DMARC

Restaurar o registro do estágio imediatamente anterior e reiniciar a janela.
SPF/DKIM permanecem; não criar segundo registro DMARC.

### Documentação/Sentry/E2E

Checker pode ser removido do gate somente por override humano auditado e com
`NO-GO`; não transformar indisponibilidade em sucesso. Teste flakey deve ser
diagnosticado, não desabilitado sem prazo.

## 8. Condições globais de STOP

Interromper imediatamente se ocorrer qualquer um destes casos:

- target de banco, bucket, projeto ou ambiente não pode ser provado;
- comando propõe escrita em Production fora do workflow/janela aprovada;
- segredo, PII, token de reset, URL assinada ou payload bruto aparece em saída
  versionável;
- uma alternativa ativa cobrança, upgrade ou trial como dependência;
- migration não é compatível com a aplicação anterior;
- `support` alcança capacidade proibida por rota direta;
- TOTP ou reautenticação de refund pode ser ignorado;
- backup não restaura, excede cota ou perde a última cópia válida;
- webhook não valida o corpo bruto ou pode provocar reenvio;
- DMARC quebra remetente legítimo;
- Sentry não resolve source map ou não entrega alerta;
- gate requerido falha, fica skipped sem justificativa ou não pode ser
  reproduzido;
- resultado financeiro real é incerto.

## 9. Definição final de concluído

Este plano só pode receber `execution_status: completed` quando:

- todas as checkboxes aplicáveis têm evidência, não apenas afirmação;
- `F-001` a `F-010` constam como `closed` na requalificação;
- Sentry, PITR e restore estão comprovados;
- DMARC final está estável;
- todos os gates locais, integração, E2E e externos estão verdes no mesmo SHA;
- uma decisão `GO` humana foi registrada;
- o SHA foi promovido e observado em Production;
- a venda real supervisionada ocorreu ou foi explicitamente adiada como
  validação pós-deploy sem invalidar a decisão pré-deploy;
- documentos canônicos descrevem o comportamento realmente implantado;
- nenhum risco restante depende de plano pago silencioso.

Até esse ponto, o resultado histórico permanece `NO-GO` e este documento
permanece `proposed`/`active`.
