---
status: proposed
owner: engineering
canonical: false
snapshot_commit: cf6a129
last_verified_commit: b97f9594d6b4c06efe6287225e86e6d9c637f1b5
---

> Snapshot de plano não canônico. Este arquivo registra uma proposta histórica e não é autoridade de produto, contrato de runtime ou instrução operacional vigente.

# Resend Hosted Email Templates Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirar o HTML dos seis e-mails transacionais do runtime do Hub e transferir o conteúdo editorial para Resend Hosted Templates, sem alterar gatilhos de negócio, destinatários, URLs, idempotência, outbox, garantias de ativação ou política de segurança de autenticação.

**Architecture:** O Hub continua dono de orquestração, destinatário, construção de URLs, contexto de ambiente, allowlist, `from`, `replyTo`, idempotency key e decisão de envio. O Resend passa a ser dono do markup, preview, assunto quando explicitamente aprovado e versão publicada. Um adaptador tipado resolve aliases por ambiente e envia exclusivamente `template.id + variables`; o renderer legado permanece disponível até o rollout de Production e não existe fallback automático entre renderers, porque um retry após aceitação do provider poderia duplicar mensagens.

**Tech Stack:** Next.js 16.2.11, React 19.2.7, TypeScript 6, Better Auth 1.6.25, Resend 6.17.2, `@react-email/components` 1.0.12, PostgreSQL/Neon, outbox transacional, Vitest, Playwright, Sentry e Bun 1.3.11.

---

## 1. Decisões obrigatórias antes de implementar

Este plano incorpora a análise do estagiário e as correções verificadas contra o código, a documentação canônica e a documentação oficial atual do Resend.

### 1.1 Topologia Resend

O primeiro rollout usa um único Team Resend, um único domínio verificado e um único catálogo de seis templates:

- aliases canônicos, sem prefixos de ambiente;
- a mesma template é usada por Development, Staging e Production;
- allowlist continua obrigatória na aplicação para Development e Staging;
- Production usa o mesmo catálogo, com smoke controlado;
- a chave administrativa, quando necessária para publicar/checkar, fica fora do web runtime.

Não criar Teams, contas ou cópias de template por ambiente. A separação de ambiente continua existindo somente no runtime do Hub, no destinatário permitido e no valor já configurado de `RESEND_API_KEY`; ela não deve gerar aliases paralelos no Resend. Não mover o domínio institucional nem alterar DNS.

O alias é um identificador editorial, não uma fronteira de autorização. A runtime key deve somente enviar; operações de criação/publicação devem usar a integração Resend conectada ou uma chave administrativa fora do web runtime.

### 1.2 Limites e payload do Hosted Template

Quando o envio usa `template`, o payload não pode conter `html`, `text` ou `react`. O adapter deve enviar somente:

```ts
{
  from,
  to,
  replyTo,
  subject,
  template: {
    id: alias,
    variables,
  },
}
```

No SDK TypeScript atual, usar os nomes camelCase definidos pelos tipos instalados, como `replyTo`; não misturar campos snake_case do HTTP cru com o objeto do SDK.

As regras que bloqueiam o plano são:

- cada variável usada pelo template deve ser fornecida ou ter fallback configurado;
- valores string aceitam no máximo 2.000 caracteres segundo a documentação consultada;
- `MESSAGE` do suporte terá limite de produto de 1.800 caracteres, deixando margem para futuras alterações e evitando encostar no limite do provider;
- o limite de `MESSAGE` não será 5.000 caracteres;
- `DAYS_REMAINING` será enviado como string já formatada (`1 dia` ou `7 dias`), sem depender de condicionais no editor;
- `ACTION_URL`, `PASSWORD_RESET_URL` e o link do certificado são sempre construídos no Hub;
- tokens não são persistidos na outbox e não são enviados como variáveis fora do fluxo Better Auth que os cria.

### 1.3 Importação React Email

A documentação atual do editor Resend informa suporte a imports de `@react-email/components` e `react`, e não a qualquer dependência arbitrária. Isso não prova que o arquivo atual inteiro falhará: o arquivo do Hub usa imports compatíveis, mas contém seis exports e um `EmailShell` compartilhado.

O plano exige teste de importação por template. Se a importação monolítica não funcionar, separar os componentes no editor ou usar o HTML renderizado como base. Não atualizar `@react-email/components` ou React Email como parte da migração.

### 1.4 Plain text

Plain text não será escrito manualmente no código. O primeiro caminho envia o Hosted Template e valida a versão de texto gerada ou configurada pelo Resend. Se a saída for insuficiente para um cliente real, o texto será mantido no próprio template hospedado ou tratado em uma sprint posterior. O adapter não adicionará um campo `text` junto do template.

As páginas oficiais consultadas não são perfeitamente consistentes sobre o limite total de variáveis do Dashboard: uma página menciona 20 e outra/API menciona 50. Este projeto usa no máximo cinco variáveis por template, portanto a diferença não afeta o catálogo. O checker deve validar as variáveis declaradas para cada alias e não depender de um limite 50.

### 1.5 Assunto

A propriedade do assunto será explícita por template. Para preservar paridade, a primeira troca de renderer pode continuar enviando o assunto calculado pelo Hub; mover o assunto para o Resend é uma etapa editorial posterior, depois que o envio e as variáveis estiverem comprovados.

Regra de destino:

- assuntos estáticos: alvo final no Resend;
- assuntos dinâmicos com variáveis seguras (`DAYS_REMAINING`, `COURSE_TITLE`): alvo final no Resend somente depois de teste de subject variables;
- assunto de suporte, que contém entrada da aluna: permanece no Hub até existir teste de comprimento, caracteres de controle e comportamento do Resend; a troca de renderer não depende dessa mudança;
- `from` e `replyTo` permanecem no Hub no primeiro rollout, especialmente o `replyTo` da aluna no suporte.

### 1.6 Draft e `has_unpublished_versions`

Draft é um estado normal de edição. `has_unpublished_versions` deve produzir warning no checker, não quebrar automaticamente o deploy. O checker deve falhar apenas quando o alias estiver ausente, sem versão publicada, com variáveis incompatíveis ou em ambiente errado.

Reverter uma versão no histórico cria uma nova alteração em draft; não presumir que o revert já está ativo. É obrigatório testar e publicar a versão revertida antes de reprocessar mensagens.

### 1.7 Auth público versus ativação interna

O reset público pode usar `after()` do Next.js para agendar o envio depois da resposta, reduzindo o tempo observável. A ativação interna não pode fazer isso: ela chama Better Auth com uma `Request` sintética e precisa aguardar a confirmação do callback dentro do `AsyncLocalStorage` antes de concluir a outbox.

Não configurar um handler global de background do Better Auth sem preservar essa distinção. O tipo instalado de Better Auth permite `advanced.backgroundTasks.handler`, mas esse handler faria operações com e sem contexto terem a mesma semântica. O plano usa `after()` somente no caminho público, guardado pela ausência do contexto de ativação, e mantém `await` na ativação.

### 1.8 Hardening que não bloqueia a troca do renderer

Persistência de tickets de suporte, rate limiting específico do formulário, webhooks de bounce/complaint/suppression e correção completa da corrida dos avisos de expiração são itens separados. A migração não deve esperar essas entregas.

Ainda assim, o contrato de renderer deve validar limites e conteúdo de entrada para impedir que a mudança exponha HTML, URL ou payload inválido.

O sink E2E e os testes de contrato devem confirmar que um token de reset aparece somente no `href` da CTA. O token não pode aparecer em subject, preview, plain text, logs, outbox, catálogo documental ou sink.

### 1.9 Cutover da outbox e idempotência

O schema atual da outbox não guarda qual transporte foi usado. O delivery sempre chama o adapter vigente. Portanto, uma mensagem criada com HTML legado e ainda em `pending`, `retrying` ou `processing` pode ser reenviada com `template + variables` usando a mesma idempotency key. O Resend pode rejeitar isso como `invalid_idempotent_request` ou, pior, a equipe pode tentar um fallback e duplicar uma mensagem já aceita.

Este plano escolhe `quiesce + drain` como estratégia inicial, porque é menor que versionar todos os payloads e preserva o desenho atual. Antes de habilitar Hosted em um ambiente:

1. colocar o ambiente em janela de manutenção/quiescência aprovada, bloqueando novos produtores de e-mail;
2. manter o worker legado ativo e drenar mensagens de email até não haver `pending`, `retrying` ou `processing`;
3. esperar o prazo do lease e consultar novamente para garantir que não existe worker antigo em execução;
4. confirmar o estado por tópico, incluindo `auth.account-activation`, `email.*` e o caminho direto de suporte quando ele estiver incluído na janela;
5. publicar o deployment Hosted enquanto a quiescência ainda impede tráfego concorrente;
6. reabrir o ambiente e observar o primeiro ciclo de outbox.

Se a operação não conseguir provar que todos os produtores estão quiescidos, não executar o cutover. Nesse caso, criar antes uma implementação de transporte versionado no payload da outbox: mensagens sem versão continuam no renderer legado e mensagens novas recebem `legacy` ou `hosted`, inclusive no contexto de ativação. Não substituir esse requisito por fallback automático.

`has_unpublished_versions` continua sendo warning no deploy automático. Uma promoção manual pode exigir reconhecimento desse warning, mas o pipeline não deve quebrar somente porque existe draft enquanto uma versão publicada válida permanece ativa.

---

## 2. Estado atual que o implementador deve conhecer

### 2.1 Arquivos e responsabilidades atuais

| Arquivo | Responsabilidade atual | Papel durante a migração |
|---|---|---|
| `src/features/email/server.ts` | renderiza React Email, monta envelope, aplica allowlist, chama Resend e trata idempotência | manter como facade; adicionar adapter Hosted e retirar `render` somente no final |
| `src/features/email/templates.tsx` | seis componentes React Email | fonte de paridade durante a criação; remover apenas na Sprint 11 |
| `src/features/email/development-recipient.ts` | allowlist hoje limitada a `NODE_ENV=development` | ampliar para runtime Development/Staging de forma fail-closed |
| `src/features/email/e2e-delivery-sink.ts` | sink E2E específico para certificado | ampliar com segurança para provar logical template sem guardar HTML/token |
| `src/lib/auth.ts` | Better Auth, reset de senha e política de senha | preservar callback e, depois, separar reset público assíncrono |
| `src/lib/auth-password-reset.ts` | callback Better Auth e contexto de ativação | preservar HMAC/ALS; adicionar `after()` somente para reset público |
| `src/features/outbox/rules.ts` | tópicos, payloads e idempotency keys | não alterar payloads por causa do renderer |
| `src/features/outbox/delivery.ts` | reconfirma agregados e chama funções de email | manter consultas, ordem, retry e no-op da ativação |
| `src/features/outbox/worker.ts` | lease, retry, dead letter e máximo de cinco tentativas | não alterar por causa da troca de template |
| `src/lib/runtime-environment.ts` | resolve Development/E2E/Preview/Production/Staging | fonte única do alias e da allowlist |
| `src/lib/staging-environment.ts` | preflight de Staging | exigir allowlist e impedir aliases/credenciais de Production |
| `src/lib/env.ts` | schema e leitura de variáveis | adicionar somente variáveis necessárias para allowlist/checker |
| `.env.example` | contrato de onboarding | documentar nomes, sem valores reais |
| `docs/integrations/resend.md` | domínio, remetente, chaves e operação Resend | atualizar para Hosted Templates, aliases e ownership |
| `docs/operations/environment-and-local-development.md` | topologia de ambientes | documentar allowlist Staging e mapeamento de aliases |
| `docs/operations/outbox-and-transactional-effects.md` | outbox e semântica de entrega | documentar que `delivered` é aceitação do provider |
| `docs/operations/testing-and-ci.md` | gates de teste/CI | documentar checker opcional e gate protegido |

### 2.2 Catálogo funcional confirmado

| Template lógico | Função atual | Gatilho | Criticidade | Variáveis alvo |
|---|---|---|---|---|
| `auth-password-reset` | `sendPasswordResetEmail` | reset público ou ativação interna | A | `USER_NAME`, `ACTION_URL` |
| `access-released` | `sendAccessReleasedEmail` | acesso pago já autenticado | B | `USER_NAME`, `COURSE_TITLE`, `ACTION_URL`, `PASSWORD_RESET_URL` |
| `access-expiry-warning` | `sendAccessExpiryWarningEmail` | manutenção 7d/1d | B | `USER_NAME`, `COURSE_TITLE`, `DAYS_REMAINING`, `ACTION_URL` |
| `certificate-issued` | `sendCertificateIssuedEmail` | certificado `valid` e `ready` | B | `USER_NAME`, `COURSE_TITLE`, `CERTIFICATE_CODE`, `ACTION_URL` |
| `course-sales-opened` | `sendCourseSalesOpenedEmail` | interesse comercial | C | `USER_NAME`, `COURSE_TITLE`, `ACTION_URL` |
| `support-request` | `sendSupportRequestEmail` | Server Action autenticada | B para conteúdo, C para criticidade operacional | `STUDENT_NAME`, `STUDENT_EMAIL`, `COURSE_TITLE`, `SUPPORT_SUBJECT`, `MESSAGE` |

O fluxo de ativação não é um sétimo template. Ele reutiliza `auth-password-reset` por meio de Better Auth, mas possui invariantes próprias: confirmação do pedido Asaas pago, HMAC, `AsyncLocalStorage`, idempotência e espera síncrona.

### 2.3 Comandos de verificação do repositório

O script de teste do projeto é `bun run test`, não `bun test`. Toda sprint deve usar os comandos abaixo, quando aplicáveis:

```powershell
bun run typecheck
bun run check
bun run test -- src/features/email src/lib/auth-password-reset.test.ts src/lib/account-activation-idempotency.test.ts src/features/outbox src/features/enrollments/maintenance.test.ts
bun run docs:check
```

O `check:resend-templates` desta migração não deve ser executado pelo build normal, pelo `typecheck` ou pelo `bun run check`, porque depende de rede e de chave administrativa.

---

## 3. Mapa de aliases e variáveis

### 3.1 Aliases oficiais

Os aliases abaixo são nomes lógicos estáveis e únicos no Team Resend. O runtime nunca grava UUID do Resend em vários arquivos.

| Nome lógico | Alias único |
|---|---|
| `auth-password-reset` | `auth-password-reset` |
| `access-released` | `access-released` |
| `access-expiry-warning` | `access-expiry-warning` |
| `certificate-issued` | `certificate-issued` |
| `course-sales-opened` | `course-sales-opened` |
| `support-request` | `support-request` |

Mapeamento de runtime:

- `development`, `staging` e `production` usam o alias único de cada template;
- `development` e `staging` exigem allowlist antes do provider;
- `e2e` não chama Resend e usa sink isolado;
- `preview` não possui credenciais de provider e deve falhar antes de tentar resolver alias de envio;
- qualquer runtime desconhecido falha fechado.

### 3.2 Contrato de variáveis

Todos os valores string passam pelo validador comum de tamanho e formato. O contrato deve declarar se o valor aparece em texto, assunto ou atributo de link.

| Template | Variável | Tipo | Obrigatória no payload | Contexto | Regra |
|---|---|---:|---:|---|---|
| auth | `USER_NAME` | string | sim | texto | nunca usar em URL |
| auth | `ACTION_URL` | string | sim | `href` | URL completa construída no Hub |
| access | `USER_NAME` | string | sim | texto | valor atual da Conta |
| access | `COURSE_TITLE` | string | sim | texto | título consultado no delivery |
| access | `ACTION_URL` | string | sim | `href` | curso autenticado |
| access | `PASSWORD_RESET_URL` | string | sim | texto/link | rota pública sem token |
| expiry | `USER_NAME` | string | sim | texto | valor atual da Conta |
| expiry | `COURSE_TITLE` | string | sim | texto | snapshot/consulta atual conforme delivery existente |
| expiry | `DAYS_REMAINING` | string | sim | texto/assunto | somente `1 dia` ou `7 dias` |
| expiry | `ACTION_URL` | string | sim | `href` | curso autenticado |
| certificate | `USER_NAME` | string | sim | texto | snapshot existente |
| certificate | `COURSE_TITLE` | string | sim | texto | snapshot do certificado |
| certificate | `CERTIFICATE_CODE` | string | sim | texto | código público, não segredo |
| certificate | `ACTION_URL` | string | sim | `href` | `/certificados/<code>` construído no Hub |
| sales | `USER_NAME` | string | sim | texto | valor atual da Conta |
| sales | `COURSE_TITLE` | string | sim | texto/assunto | título consultado no delivery |
| sales | `ACTION_URL` | string | sim | `href` | slug codificado no Hub |
| support | `STUDENT_NAME` | string | sim | texto | conteúdo fornecido pela Conta |
| support | `STUDENT_EMAIL` | string | sim | texto | também define `replyTo` no Hub |
| support | `COURSE_TITLE` | string | sim | texto | enviar `Não informado` quando ausente |
| support | `SUPPORT_SUBJECT` | string | sim | texto | 1–160 caracteres; subject do envelope continua no Hub inicialmente |
| support | `MESSAGE` | string | sim | texto | 1–1.800 caracteres; não usar em `href`, `style` ou markup |

`COURSE_TITLE` do suporte será sempre fornecido, evitando depender de uma condicional de template cuja semântica não foi comprovada. O layout pode exibir `Não informado`.

---

## Sprint 0 — Baseline, inventário e rede de segurança

### Objetivo

Registrar o comportamento atual antes de mudar qualquer renderer e criar testes de caracterização para que cada sprint prove que a migração mudou apenas a apresentação.

### Dependências

Nenhuma. Esta sprint deve começar a partir de `staging`, sem resetar, rebasear ou limpar mudanças do usuário.

### Arquivos

- Teste: `src/features/email/server.test.ts`
- Teste: `src/lib/auth-password-reset.test.ts`
- Teste: `src/lib/account-activation-idempotency.test.ts`
- Teste: `src/features/outbox/delivery.test.ts`
- Teste: `src/features/outbox/rules.test.ts`
- Teste: `src/features/outbox/worker.test.ts`
- Teste: `src/features/email/development-recipient.test.ts`
- Documento de trabalho: `docs/superpowers/plans/2026-08-19-resend-hosted-email-templates-migration.md`

### Passos

- [ ] **0.1 — Confirmar branch e estado sem apagar alterações**

  Execute:

  ```powershell
  git branch --show-current
  git status --short
  git log -1 --oneline
  ```

  Resultado esperado: branch `staging` ou branch de trabalho derivada dela, sem usar `git reset --hard`, `git checkout --` ou remoção de arquivos existentes.

- [ ] **0.2 — Executar baseline completo**

  Execute:

  ```powershell
  bun run typecheck
  bun run check
  bun run test -- src/features/email src/lib/auth-password-reset.test.ts src/lib/account-activation-idempotency.test.ts src/features/outbox src/features/enrollments/maintenance.test.ts src/features/enrollments/maintenance-deadline.test.ts
  bun run docs:check
  ```

  Critério: todos os comandos passam antes de uma mudança de produção. Se um comando já falhar, registrar a falha como baseline e não atribuí-la ao Hosted Template.

- [ ] **0.3 — Fixar o contrato atual do envelope**

  Em `src/features/email/server.test.ts`, adicionar ou completar spies sobre `Resend.prototype.emails.send` para verificar, por fluxo:

  ```ts
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      from: expect.any(String),
      subject: expect.any(String),
      to: expect.any(String),
    }),
    expect.anything()
  );
  ```

  Asserções adicionais obrigatórias: `replyTo` do suporte é o e-mail da aluna; o certificado usa `CERTIFICATE_PUBLIC_BASE_URL`; a chave de idempotência chega ao SDK; `E2E_TEST_MODE` não chama provider; o conteúdo legado contém HTML renderizado e não um payload Hosted.

- [ ] **0.4 — Fixar os invariantes Better Auth**

  Em `src/lib/auth-password-reset.test.ts` e `src/lib/account-activation-idempotency.test.ts`, manter testes para:

  - reset público repassa a URL e o destinatário;
  - erro público continua sendo propagado;
  - ativação com contexto registra `recordDelivered` somente após sucesso;
  - ativação com contexto registra `recordFailed` e lança `account_activation_email_delivery_failed`;
  - header inventado não transforma erro de idempotência em sucesso;
  - HMAC válido sem contexto de ativação não concede tratamento especial.

- [ ] **0.5 — Fixar o contrato outbox**

  Em `src/features/outbox/delivery.test.ts`, verificar que a troca do renderer não altera tópicos, payloads, consultas de agregados ou idempotency keys. Em `src/features/outbox/worker.test.ts`, manter retry, dead letter, lease e limite de cinco tentativas.

- [ ] **0.6 — Registrar riscos conhecidos sem misturá-los à migração**

  Registrar como follow-up, não como alteração desta sprint: suporte sem persistência/rate limit, `delivered` significando aceitação do provider, corrida dos avisos de expiração e ausência de webhooks de deliverability. A migração não deve alterar esses contratos sem uma sprint própria.

- [ ] **0.7 — Caracterizar o cutover da outbox**

  Consultar o estado por tópico antes de qualquer troca de renderer. O procedimento de operação deve usar uma consulta equivalente a:

  ```sql
  select topic, status, count(*)::int as total
  from outbox_messages
  where topic = 'auth.account-activation'
     or topic like 'email.%'
  group by topic, status
  order by topic, status;
  ```

  Registrar que a aplicação atual não persiste `transportVersion`. A Sprint 10 só poderá habilitar Hosted depois que a janela de quiescência e o drain forem testados em Staging.

### Critérios de aceite

- Os testes de caracterização provam o comportamento atual.
- O baseline está verde ou suas falhas estão documentadas com comando e erro exato.
- Nenhum segredo foi copiado para o plano, teste, log ou commit.
- Nenhum template Hosted foi ainda usado pelo runtime.

### Rollback

Reverter somente os testes de caracterização desta sprint. Não apagar `.env` nem alterar credenciais.

### Commit sugerido

```powershell
git add src/features/email src/lib/auth-password-reset.test.ts src/lib/account-activation-idempotency.test.ts src/features/outbox src/features/enrollments/maintenance.test.ts src/features/enrollments/maintenance-deadline.test.ts
git commit -m "test: capture transactional email baseline"
```

---

## Sprint 1 — Governança e catálogo único no Resend

### Objetivo

Confirmar o Team/domínio existentes, criar um catálogo único de aliases e definir o workflow editorial sem criar cópias por ambiente.

### Dependências

Sprint 0 verde. Acesso administrativo ao mesmo Team Resend que já possui o domínio institucional.

### Arquivos

- Modificar: `.env.example`
- Modificar: `src/lib/env.ts`
- Modificar: `src/lib/env.test.ts`
- Modificar: `src/lib/staging-environment.ts`
- Modificar: `src/lib/staging-environment.test.ts`
- Modificar: `docs/integrations/resend.md`
- Modificar: `docs/operations/environment-and-local-development.md`
- Modificar: `docs/operations/testing-and-ci.md`

### Passos

- [ ] **1.1 — Confirmar a conta e o domínio sem mover DNS**

  No painel Resend, confirme que o Team atual possui `neurocapacitar.com.br` verificado. Não excluir domínio, não usar o mesmo domínio em uma conta nova e não alterar SPF/DKIM/DMARC nesta migração.

  Se a equipe exigir isolamento de conta, parar nesta sprint e obter subdomínio ou domínio dedicado. Não criar um segundo Team com o mesmo remetente como experimento.

- [ ] **1.2 — Confirmar o escopo da integração conectada**

  Usar a integração Resend conectada ao Team atual. Não criar chaves, contas ou Teams por ambiente. Se uma operação administrativa precisar de Full Access, executá-la pela integração ou com chave administrativa fora do web runtime; `RESEND_API_KEY` continua sendo a única variável de envio consumida pela aplicação.

- [ ] **1.3 — Definir aliases únicos sem UUID no código**

  Criar os seis aliases canônicos da seção 3.1 no painel, primeiro como draft. Development, Staging e Production apontarão para os mesmos aliases; a allowlist é responsabilidade do Hub, não uma cópia de template.

- [ ] **1.4 — Definir workflow editorial**

  Registrar no documento de integração:

  1. editar como draft;
  2. testar contra caixa controlada;
  3. revisar markup, links, assunto, `from`, `reply_to`, plain text e variáveis;
  4. publicar somente após aprovação;
  5. manter version history e não apagar o alias em uso;
  6. usar revert para voltar a uma versão anterior.

  `has_unpublished_versions=true` é warning operacional. Ausência de versão publicada é bloqueio.

- [ ] **1.5 — Adicionar o contrato de allowlist de Staging ao schema**

  Adicionar `STAGING_EMAIL_RECIPIENT_ALLOWLIST` a `.env.example` e a `src/lib/env.ts` como string opcional no schema bruto. A obrigatoriedade contextual será aplicada no preflight de Staging na Sprint 8.

  Não remover `DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST`; a compatibilidade de Development será mantida até a Sprint 8.

  Manter `STAGING_RESEND_USES_PRODUCTION=true` apenas como confirmação explícita de que a estrutura Resend é compartilhada, conforme o runbook atual. Essa variável não seleciona alias, não autoriza publicação e não substitui a allowlist.

- [ ] **1.6 — Cobrir a leitura dos ambientes**

  Em `src/lib/env.test.ts`, incluir `STAGING_EMAIL_RECIPIENT_ALLOWLIST` no fixture de Staging e provar que Preview continua recusando `RESEND_API_KEY`. Em `src/lib/staging-environment.test.ts`, adicionar o caso de allowlist ausente como falha contextual.

- [ ] **1.7 — Atualizar a documentação de operação**

  Em `docs/integrations/resend.md`, documentar Team/domínio existentes, aliases únicos, credenciais já configuradas, chave administrativa e caveat de domínio. Em `docs/operations/environment-and-local-development.md`, documentar que Staging compartilha a estrutura Resend, mas passa a exigir allowlist própria.

### Critérios de aceite

- Os seis aliases canônicos existem como drafts no Team correto.
- Não existem cópias `staging-*`/`production-*` criadas para esta migração.
- A integração conectada é capaz de criar/editar/publicar drafts sem colocar credenciais administrativas no web runtime.
- O domínio institucional não foi movido nem revalidado.
- `bun run typecheck` e os testes de `src/lib/env*` e `src/lib/staging-environment*` passam.
- `bun run docs:check` passa.

### Rollback

Remover somente aliases drafts criados por engano e variáveis ainda não usadas. Não excluir aliases publicados nem o domínio institucional.

### Commit sugerido

```powershell
git add .env.example src/lib/env.ts src/lib/env.test.ts src/lib/staging-environment.ts src/lib/staging-environment.test.ts docs/integrations/resend.md docs/operations/environment-and-local-development.md docs/operations/testing-and-ci.md
git commit -m "docs: define Resend template environments"
```

---

## Sprint 2 — Criar e validar os seis templates do catálogo único

### Objetivo

Reproduzir o layout atual no Resend, sem redesign, e provar que cada template possui variáveis e plain text utilizáveis antes de tocar no adapter. Os drafts são únicos e serão usados por todos os runtimes após o cutover.

### Dependências

Sprint 1 concluída. Os seis aliases canônicos estão criados como drafts.

### Arquivos e fontes

- Fonte de layout: `src/features/email/templates.tsx`
- Fonte de envelope: `src/features/email/server.ts`
- Documento de catálogo a criar: `docs/integrations/resend-templates.md`
- Evidência manual: export/screenshot do painel somente se a política interna permitir; não incluir dados de alunos ou tokens.

### Passos

- [ ] **2.1 — Criar um template por alias**

  Trabalhar nesta ordem: `course-sales-opened`, `certificate-issued`, `access-expiry-warning`, `access-released`, `support-request`, `auth-password-reset`.

  A ordem reduz o risco de começar por autenticação e permite validar primeiro o contrato de link e variáveis simples.

- [ ] **2.2 — Testar importação do React Email existente**

  Tentar importar o componente correspondente do arquivo atual. O teste é por template, não apenas pelo arquivo inteiro. Confirmar que imports usados são somente de `@react-email/components` e `react`.

  Se o editor rejeitar o export compartilhado ou o `EmailShell`, criar o markup equivalente diretamente no template ou importar HTML produzido pelo componente. Não instalar versão nova para contornar a importação.

  Se a CLI de React Email for usada para upload, utilizar uma Full Access key administrativa temporária e separada, revogando-a após o seed. A runtime Sending Access key não deve ser usada para publicação.

- [ ] **2.3 — Manter paridade visual antes de editar copy**

  Reproduzir o container de 560px, cores, botão, preview e estrutura atual. Corrigir acentos apenas se a revisão de conteúdo aprovar; não combinar redesign com migração de renderer.

  Os links devem continuar sendo placeholders de variável, nunca URLs fixas, tokens gerados pelo Resend ou lógica de negócio no template.

- [ ] **2.4 — Declarar as variáveis no painel**

  Criar as variáveis exatamente conforme a seção 3.2. Para `support-request`, declarar `COURSE_TITLE` com fallback `Não informado` e manter `MESSAGE` como string.

  Não declarar variáveis reservadas pelo Resend, não usar chave com espaço ou acento e não criar contratos alternativos por runtime.

- [ ] **2.5 — Definir o assunto de compatibilidade**

  Configurar um assunto default válido no Resend para permitir preview e publicação. O adapter poderá sobrescrevê-lo na primeira migração. Os assuntos alvo são:

  - `Criar ou redefinir senha do PROTEA-R Hub`;
  - `Acesso liberado no PROTEA-R Hub`;
  - `Seu acesso vence em {{DAYS_REMAINING}}` quando a variável for comprovada;
  - `Inscrições abertas: {{COURSE_TITLE}}` quando subject variable for comprovada;
  - `Seu certificado PROTEA-R Hub foi emitido`;
  - `Suporte: {{SUPPORT_SUBJECT}}` somente depois do teste de segurança; até lá, o envelope continua vindo do Hub.

- [ ] **2.6 — Validar plain text sem escrevê-lo no Hub**

  Enviar/testar cada draft pela ferramenta do Resend com valores controlados. Confirmar que o texto simples não contém HTML literal quebrado, quebras de linha inutilizáveis ou perda da CTA.

  Se o Resend exigir uma versão text explícita para obter resultado aceitável, configurar essa versão no próprio template. O objeto do Hub continua sem `text`.

- [ ] **2.7 — Testar conteúdo adversarial no suporte**

  No template `support-request`, testar valores controlados contendo:

  ```text
  <img src=x onerror=alert(1)>
  " onclick="alert(1)
  {{COURSE_TITLE}}
  </style>
  linha 1
  linha 2
  ```

  O resultado esperado é texto visível, sem execução de HTML/atributo. A documentação do Resend não deve ser interpretada como prova de escaping para todos os contextos; se o teste falhar, não migrar suporte até alterar o layout/contrato.

- [ ] **2.8 — Publicar somente depois do teste do draft**

  Publicar cada alias depois de confirmar render, links, plain text e variáveis. Registrar `published_at`, status e `has_unpublished_versions` no catálogo, sem registrar IDs secretos ou destinatários pessoais.

- [ ] **2.9 — Criar catálogo documental sem copiar HTML**

  Criar `docs/integrations/resend-templates.md` com aliases, variáveis, owner, subject mode, `from/replyTo`, status de publicação e procedimento de rollback. O conteúdo editorial continua no Resend; o documento guarda somente o contrato operacional.

### Critérios de aceite

- Os seis templates únicos estão publicados e testados em caixa controlada.
- Cada template mostra as seis famílias de dados corretas sem depender de HTML enviado pelo Hub.
- O suporte passa nos casos adversariais ou está explicitamente bloqueado para migração.
- Plain text foi validado sem adicionar `text` ao payload do Hub.
- Todos os links são placeholders e serão preenchidos pelo Hub.
- `docs/integrations/resend-templates.md` não contém tokens, PII ou HTML exportado.

### Rollback

Deixar o alias anterior em draft ou publicar a versão anterior pelo version history. Como o runtime ainda usa o renderer legado, nenhum email de aplicação muda nesta sprint.

### Commit sugerido

```powershell
git add docs/integrations/resend-templates.md
git commit -m "docs: catalog Resend hosted templates"
```

---

## Sprint 3 — Contrato tipado e resolução de alias no Hub

### Objetivo

Criar uma fronteira única para nomes lógicos, variáveis, aliases, ownership de assunto e validação local, sem chamada de rede ao Resend.

### Dependências

Sprint 2 publicada no catálogo único. O catálogo documental está revisado.

### Arquivos

- Criar: `src/features/email/templates-contract.ts`
- Criar: `src/features/email/templates-contract.test.ts`
- Modificar: `src/lib/runtime-environment.ts` somente se o tipo comum precisar ser exportado
- Modificar: `src/lib/env.ts` somente se o resolver usar uma variável já aprovada
- Testes: `src/lib/runtime-environment.test.ts`, `src/lib/env.test.ts`
- Modificar: `docs/integrations/resend-templates.md`

### Passos

- [ ] **3.1 — Definir nomes lógicos e aliases em um único módulo**

  O módulo deve exportar constantes equivalentes a:

  ```ts
  export const hostedEmailTemplates = {
    authPasswordReset: "auth-password-reset",
    accessReleased: "access-released",
    accessExpiryWarning: "access-expiry-warning",
    certificateIssued: "certificate-issued",
    courseSalesOpened: "course-sales-opened",
    supportRequest: "support-request",
  } as const;
  ```

  O alias de cada nome lógico deve ser o próprio valor canônico, evitando strings espalhadas em `server.ts`, delivery ou testes.

- [ ] **3.2 — Definir tipos de variáveis por template**

  Usar união discriminada, sem `Record<string, string>` genérico:

  ```ts
  export type HostedTemplateVariables =
    | { name: "auth-password-reset"; variables: { USER_NAME: string; ACTION_URL: string } }
    | { name: "access-released"; variables: { USER_NAME: string; COURSE_TITLE: string; ACTION_URL: string; PASSWORD_RESET_URL: string } }
    | { name: "access-expiry-warning"; variables: { USER_NAME: string; COURSE_TITLE: string; DAYS_REMAINING: string; ACTION_URL: string } }
    | { name: "certificate-issued"; variables: { USER_NAME: string; COURSE_TITLE: string; CERTIFICATE_CODE: string; ACTION_URL: string } }
    | { name: "course-sales-opened"; variables: { USER_NAME: string; COURSE_TITLE: string; ACTION_URL: string } }
    | { name: "support-request"; variables: { STUDENT_NAME: string; STUDENT_EMAIL: string; COURSE_TITLE: string; SUPPORT_SUBJECT: string; MESSAGE: string } };
  ```

  `DAYS_REMAINING` será uma string já formatada pelo Hub (`1 dia` ou `7 dias`) para preservar a concordância sem depender de condicionais no editor. Não enviar o número cru para o template.

- [ ] **3.3 — Declarar metadata de ownership**

  Para cada template, declarar `subjectOwner`, `fromOwner`, `replyToOwner` e `plainTextMode`. O primeiro rollout usa `fromOwner: "hub"` e `replyToOwner: "hub"` para todos; `subjectOwner` começa como `hub` nos testes de paridade e migra individualmente para `resend` após smoke.

- [ ] **3.4 — Implementar `resolveHostedTemplateAlias` fail-closed**

  A função deve receber `{ name, runtimeEnvironment }` e devolver o alias único do catálogo. Regras exatas:

  - Development, Staging e Production → alias canônico;
  - E2E/Preview → lançar erro de envio não permitido;
  - valor desconhecido → lançar erro de ambiente desconhecido.

  Não criar fallback entre aliases e não usar `NODE_ENV` no lugar de `resolveRuntimeEnvironment`.

- [ ] **3.5 — Implementar `validateHostedTemplateVariables`**

  Validar presença de cada chave, tipo, string não vazia quando obrigatória, comprimento máximo de 2.000 e regras específicas do suporte. Nunca truncar silenciosamente `MESSAGE`, `ACTION_URL`, nome, título ou código.

  A função deve rejeitar `MESSAGE` vazio, maior que 1.800, com caracteres de controle proibidos no assunto e `DAYS_REMAINING` diferente de `1 dia` ou `7 dias`.

- [ ] **3.6 — Testar o resolver sem provider**

  Em `templates-contract.test.ts`, cobrir aliases de todos os seis templates em Development, Staging e Production; recusa de Preview/E2E; chaves ausentes; tipos errados; limite de 2.000; suporte com `COURSE_TITLE` vazio convertido antes do contrato; `MESSAGE` nos limites 1, 1.800 e 1.801.

- [ ] **3.7 — Verificar que o módulo não importa Resend**

  O contrato deve ser puro. Adicionar uma asserção de arquitetura ou inspeção estática no checker para que `templates-contract.ts` não importe `resend`, `@react-email/components`, `next/server` ou módulos com efeitos de rede.

### Critérios de aceite

- Existe uma única fonte de nomes e aliases.
- O TypeScript recusa variáveis de um template em outro.
- Preview/E2E nunca resolvem alias de envio real.
- O contrato não faz rede e não depende de React Email.
- Todos os testes de contrato passam com `bun run test -- src/features/email/templates-contract.test.ts src/lib/runtime-environment.test.ts`.

### Rollback

Remover o módulo novo e seus testes; nenhum sender legado depende dele até a Sprint 4.

### Commit sugerido

```powershell
git add src/features/email/templates-contract.ts src/features/email/templates-contract.test.ts src/lib/runtime-environment.ts src/lib/runtime-environment.test.ts src/lib/env.ts src/lib/env.test.ts docs/integrations/resend-templates.md
git commit -m "feat: add typed hosted email template contract"
```

---

## Sprint 4 — Adapter Hosted com preservação de idempotência e E2E

### Objetivo

Adicionar o transporte Hosted sem remover o caminho legado e sem misturar `react/html/text` ao payload.

### Dependências

Sprint 3 verde. Os aliases únicos do catálogo estão publicados.

### Arquivos

- Modificar: `src/features/email/server.ts`
- Modificar: `src/features/email/server.test.ts`
- Modificar: `src/features/email/e2e-delivery-sink.ts`
- Modificar: `src/features/email/e2e-delivery-sink.test.ts`
- Modificar: `src/lib/account-activation-idempotency.test.ts` somente se a fronteira do adapter exigir nova asserção
- Modificar: `docs/operations/outbox-and-transactional-effects.md`

### Passos

- [ ] **4.1 — Separar os tipos de entrada legado e Hosted**

  Manter `sendTransactionalEmail` como facade de compatibilidade. Criar uma função interna tipada com assinatura equivalente a:

  ```ts
  const sendHostedTemplateEmail = async (
    input: HostedTemplateVariables & {
      idempotencyKey?: string;
      replyTo?: string;
      subject?: string;
      to: string;
    }
  ): Promise<void> => { /* adapter */ };
  ```

  A implementação deve chamar `resolveHostedTemplateAlias` e `validateHostedTemplateVariables` antes do SDK.

- [ ] **4.2 — Montar somente o payload Hosted**

  O objeto passado a `new Resend(apiKey).emails.send` deve conter `from`, `to`, `template` e, quando necessário, `replyTo`/`subject`. As asserções do teste devem provar ausência de `react`, `html` e `text`:

  ```ts
  expect(payload).not.toHaveProperty("react");
  expect(payload).not.toHaveProperty("html");
  expect(payload).not.toHaveProperty("text");
  expect(payload.template).toEqual({ id: expectedAlias, variables: expectedVariables });
  ```

- [ ] **4.3 — Preservar envelope e idempotência**

  Manter `RESEND_FROM_EMAIL`, `replyTo` explícito, `SUPPORT_EMAIL` default, `idempotencyKey` no segundo argumento do SDK e tratamento atual de `invalid_idempotent_request` somente quando `isAccountActivationEmailIdempotencyKey` retornar verdadeiro.

  Não gerar uma nova idempotency key por causa do alias ou da versão editorial.

- [ ] **4.4 — Preservar o guard E2E**

  Antes de validar API key ou chamar Resend, o adapter deve respeitar `E2E_TEST_MODE`. O sink deve registrar apenas nome lógico, destinatário derivado/fixture, idempotency key quando já existente e nomes das variáveis; nunca HTML, token, URL completa, mensagem de suporte ou valor bruto arbitrário.

- [ ] **4.5 — Não implementar fallback automático**

  Se o Resend aceitar o envio e a resposta se perder, chamar o renderer legado como fallback pode duplicar o e-mail. O erro deve seguir o contrato existente para o worker fazer retry; rollback é troca de deployment/alias, não fallback dentro da mesma chamada.

- [ ] **4.6 — Testar o adapter com Resend mockado**

  Em `src/features/email/server.test.ts`, cobrir:

  - alias canônico em Development, Staging e Production;
  - ausência de provider em E2E;
  - ausência de API key;
  - allowlist antes do provider;
  - payload sem `react/html/text`;
  - `replyTo` customizado do suporte;
  - idempotência repassada;
  - conflito HMAC válido tratado como sucesso;
  - conflito comum lançado como erro;
  - erro do provider propagado para retry.

- [ ] **4.7 — Rodar testes antes de migrar qualquer sender**

  ```powershell
  bun run test -- src/features/email src/lib/account-activation-idempotency.test.ts src/features/outbox/worker.test.ts
  bun run typecheck
  bun run check
  ```

### Critérios de aceite

- O adapter Hosted está testado sem chamada de rede.
- O payload não mistura modos de envio.
- A ativação interna mantém HMAC, ALS e espera síncrona.
- O sink E2E não armazena conteúdo sensível.
- Todos os seis senders ainda usam renderer legado; o risco de rollout ainda é zero.

### Rollback

Remover o adapter e manter os testes de contrato. Nenhum deployment deve ter sido configurado para usá-lo ainda.

### Commit sugerido

```powershell
git add src/features/email/server.ts src/features/email/server.test.ts src/features/email/e2e-delivery-sink.ts src/features/email/e2e-delivery-sink.test.ts src/lib/account-activation-idempotency.test.ts docs/operations/outbox-and-transactional-effects.md
git commit -m "feat: add Resend hosted template adapter"
```

---

## Sprint 5 — Migrar os quatro e-mails transacionais de menor acoplamento

### Objetivo

Migrar `course-sales-opened`, `certificate-issued`, `access-expiry-warning` e `access-released` individualmente, mantendo tópicos, consultas, URLs e retry exatamente como estão.

### Dependências

Sprint 4 verde. Templates Staging publicados e verificados.

### Regra de execução

Cada subseção é um PR ou commit isolado. Depois de cada sender:

```powershell
bun run test -- src/features/email/server.test.ts src/features/outbox/delivery.test.ts src/features/outbox/rules.test.ts
bun run typecheck
bun run check
```

Não migrar dois senders no mesmo PR sem executar smoke separado para cada alias.

### 5.1 `course-sales-opened`

#### Arquivos

- Modificar: `src/features/email/server.ts`
- Teste: `src/features/email/server.test.ts`
- Teste: `src/features/outbox/delivery.test.ts`

#### Passos

- [ ] **5.1.1 — Preservar construção do link**

  Continuar usando `NEXT_PUBLIC_APP_URL`, `encodeURIComponent(courseSlug)` e o caminho `/comprar/<slug>`. Enviar `USER_NAME`, `COURSE_TITLE` e `ACTION_URL` ao alias lógico `course-sales-opened`.

- [ ] **5.1.2 — Preservar subject na primeira troca**

  Continuar enviando `Inscrições abertas: ${courseTitle}` pelo Hub no primeiro commit. Depois do smoke, testar `COURSE_TITLE` no assunto do template e somente então alterar `subjectOwner` para Resend.

- [ ] **5.1.3 — Provar que o interesse continua sendo consumido depois do envio aceito**

  O delivery deve continuar chamando `consumeDeliveredCourseSaleInterest` somente após `sendCourseSalesOpenedEmail` resolver. Erro do provider deve manter retry e não remover o interesse.

#### Aceite

- Alias canônico correto em todos os runtimes que enviam.
- Link leva ao slug correto.
- Uma falha antes do envio não consome interesse.
- Uma aceitação seguida de erro de persistência mantém a semântica de retry já existente; não introduzir nova ação de negócio.

### 5.2 `certificate-issued`

#### Arquivos

- Modificar: `src/features/email/server.ts`
- Teste: `src/features/email/server.test.ts`
- Teste: `src/features/email/e2e-delivery-sink.test.ts`
- Teste: `src/features/outbox/delivery.test.ts`

#### Passos

- [ ] **5.2.1 — Preservar sink E2E antes do provider**

  O caminho `isIsolatedE2eRuntime(process.env)` continua retornando antes do Resend. O sink deve registrar o template lógico `certificate-issued` e não o link completo.

- [ ] **5.2.2 — Preservar URL pública canônica**

  Continuar usando `new URL('/certificados/<code>', CERTIFICATE_PUBLIC_BASE_URL)` e `encodeURIComponent(certificateCode)`. O template recebe a URL pronta como `ACTION_URL`.

- [ ] **5.2.3 — Preservar snapshot e status**

  `courseTitle`, `certificateCode`, `student_name` e `student_email` continuam vindo da mesma query de `getCertificateDeliveryData`. A migração não pode fazer o template buscar dados no banco.

- [ ] **5.2.4 — Provar estado pronto**

  A entrega continua exigindo `status='valid'` e `render_status='ready'`. Um certificado pending/failed/revoked não dispara email.

#### Aceite

- O link recebido abre `/certificados/<code>` no smoke controlado.
- O sink E2E comprova uma entrega lógica sem guardar URL/token.
- A outbox não muda tópico, chave ou condição de status.

### 5.3 `access-expiry-warning`

#### Arquivos

- Modificar: `src/features/email/server.ts`
- Teste: `src/features/email/server.test.ts`
- Teste: `src/features/outbox/delivery.test.ts`
- Teste de caracterização: `src/features/enrollments/maintenance.test.ts`
- Teste de prazo: `src/features/enrollments/maintenance-deadline.test.ts`

#### Passos

- [ ] **5.3.1 — Preservar 1d/7d como enum fechado**

  Converter `warningKind` para `DAYS_REMAINING`: `1d` vira `1 dia` e `7d` vira `7 dias`. Não aceitar valor arbitrário vindo do payload.

- [ ] **5.3.2 — Preservar idempotency key**

  Continuar usando a chave derivada de matrícula e tipo de aviso. Não incluir texto, nome ou versão do template na chave.

- [ ] **5.3.3 — Não esconder a corrida conhecida**

  Adicionar caracterização para mensagem antiga após extensão da matrícula. A migração do renderer pode seguir se o comportamento atual permanecer identificado, mas o teste deve deixar claro que a invalidação de janela é um follow-up de consistência, não uma responsabilidade do template.

- [ ] **5.3.4 — Testar subject dinâmico separadamente**

  Primeiro enviar o subject atual calculado no Hub. Só mover para o Resend depois de comprovar que `DAYS_REMAINING` é aceito no assunto e que o resultado para 1 e 7 é correto.

#### Aceite

- Templates 1d e 7d mostram o número correto.
- Nenhum aviso é enviado para warning kind inválido.
- O smoke confirma botão e link sem token.
- A corrida de extensão está documentada e não é agravada pela migração.

### 5.4 `access-released`

#### Arquivos

- Modificar: `src/features/email/server.ts`
- Teste: `src/features/email/server.test.ts`
- Teste: `src/features/outbox/delivery.test.ts`

#### Passos

- [ ] **5.4.1 — Preservar os dois links**

  `ACTION_URL` continua sendo `/app/cursos/<courseId>` quando há curso e `/app` quando não há. `PASSWORD_RESET_URL` continua sendo `/recuperar-senha`.

- [ ] **5.4.2 — Preservar a reconfirmação de matrícula**

  Não alterar `getAccessReleasedDeliveryData`. A migração só substitui o renderer; a mensagem continua não sendo enviada se a matrícula não estiver ativa.

- [ ] **5.4.3 — Testar no-op e retry**

  Provar que uma ausência de agregado mantém o erro outbox atual e que erro do Resend continua retryable. Não adicionar fallback para acesso ou ativação.

#### Aceite

- O e-mail mostra curso, CTA e link de recuperação.
- A query, o tópico e a idempotency key não mudaram.
- O smoke ocorre com um usuário de Staging allowlisted.

### 5.5 Smoke controlado da Sprint 5

- [ ] Antes do primeiro smoke que chama Resend em Staging, executar os passos 8.1–8.5 da Sprint 8. A numeração mantém o hardening separado do renderer, mas a allowlist é uma pré-condição operacional; sem ela, limitar-se a testes unitários e ao sink E2E.
- [ ] Usar uma caixa de teste previamente incluída em `STAGING_EMAIL_RECIPIENT_ALLOWLIST`.
- [ ] Confirmar que o Resend aceitou a API request.
- [ ] Confirmar recebimento na caixa, porque `delivered` na outbox não prova entrega real.
- [ ] Validar `from`, `replyTo`, subject, plain text, botão, URL e ausência de HTML inesperado.
- [ ] Verificar dead letters e `resend_delivery_failed` antes de seguir.

### Critérios de aceite

- Quatro senders usam Hosted Templates em Staging.
- O outbox continua igual do ponto de vista de negócio.
- Cada alias foi smoke-tested separadamente.
- O renderer legado continua disponível para auth e suporte.

### Rollback

Reverter somente o sender que apresentou falha ou publicar o deployment anterior. Não criar alias alternativo e não apagar a versão publicada que permite diagnóstico.

### Commits sugeridos

```powershell
git add src/features/email/server.ts src/features/email/server.test.ts src/features/outbox/delivery.test.ts
git commit -m "feat: migrate course sales email to hosted template"

git add src/features/email/server.ts src/features/email/server.test.ts src/features/email/e2e-delivery-sink.test.ts src/features/outbox/delivery.test.ts
git commit -m "feat: migrate certificate email to hosted template"

git add src/features/email/server.ts src/features/email/server.test.ts src/features/outbox/delivery.test.ts src/features/enrollments/maintenance.test.ts src/features/enrollments/maintenance-deadline.test.ts
git commit -m "feat: migrate expiry warning email to hosted template"

git add src/features/email/server.ts src/features/email/server.test.ts src/features/outbox/delivery.test.ts
git commit -m "feat: migrate access release email to hosted template"
```

---

## Sprint 6 — Migrar suporte somente no renderer

### Objetivo

Mover o layout de suporte para o Resend sem transformar esta sprint em uma reescrita de persistência, rate limiting ou outbox.

### Dependências

Sprint 5 verde. Teste adversarial do template único aprovado.

### Arquivos

- Modificar: `src/features/email/server.ts`
- Modificar: `src/features/email/server.test.ts`
- Modificar: `src/features/email/templates-contract.ts`
- Modificar: `src/features/email/templates-contract.test.ts`
- Modificar: `src/features/outbox` somente se nenhum arquivo for tocado; suporte não usa outbox hoje
- Modificar: documentação de follow-up em `docs/integrations/resend-templates.md`

### Passos

- [ ] **6.1 — Preservar o envelope atual**

  Continuar enviando para `SUPPORT_EMAIL ?? RESEND_FROM_EMAIL` e com `replyTo: studentEmail`. O `replyTo` não será transferido para variável do template.

- [ ] **6.2 — Validar e construir as variáveis**

  Enviar `STUDENT_NAME`, `STUDENT_EMAIL`, `COURSE_TITLE`, `SUPPORT_SUBJECT` e `MESSAGE`. Quando `courseTitle` estiver ausente, enviar `Não informado`.

  Validar `subject.trim().length` entre 1 e 160 e `message.trim().length` entre 1 e 1.800 antes de construir o payload. Rejeitar excesso com erro de entrada sanitizado; não truncar.

  O campo `courseTitle` vindo de input de formulário não pode ser tratado como autoridade de autorização. Nesta sprint ele é apenas conteúdo de apresentação; o destinatário, a identidade da aluna, o `replyTo` e a existência da sessão continuam sendo derivados/validados no servidor. Derivar o curso por um identificador autorizado é follow-up de hardening, não pré-requisito para trocar o renderer.

- [ ] **6.3 — Manter o assunto do envelope no Hub inicialmente**

  Continuar usando `Suporte: ${subject}` no campo `subject` do envelope. O texto `SUPPORT_SUBJECT` dentro do corpo é separado. A migração não deve permitir que uma aluna controle headers por meio da variável.

- [ ] **6.4 — Testar texto não confiável**

  Em `server.test.ts`, mockar o adapter e provar que os valores chegam como variáveis, nunca como HTML concatenado. Os fixtures devem incluir tags, aspas, chaves de template, quebras de linha e caracteres Unicode.

- [ ] **6.5 — Testar limites sem chamar Resend**

  Mensagem vazia, assunto vazio, mensagem de 1.801 caracteres e assunto de 161 caracteres devem falhar antes da chamada ao SDK. Uma mensagem de 1.800 caracteres deve construir payload válido.

- [ ] **6.6 — Registrar hardening fora do bloqueio**

  Documentar em `docs/integrations/resend-templates.md` que persistência de ticket, rate limit dedicado, retry durável e idempotência de formulário continuam pendentes. Não adicionar tabela ou outbox neste commit.

### Critérios de aceite

- O renderer de suporte é Hosted.
- `replyTo` continua sendo a aluna.
- Conteúdo adversarial não executa HTML no resultado aprovado.
- Limites são aplicados no Hub sem ultrapassar 2.000 caracteres do Resend.
- Nenhuma mudança de persistência ou rate limiting é necessária para concluir a migração.

### Rollback

Reverter somente `sendSupportRequestEmail` para o renderer legado. Manter o contrato de limites se ele já tiver sido publicado e estiver documentado como política do formulário.

### Commit sugerido

```powershell
git add src/features/email/server.ts src/features/email/server.test.ts src/features/email/templates-contract.ts src/features/email/templates-contract.test.ts docs/integrations/resend-templates.md
git commit -m "feat: migrate support email to hosted template"
```

---

## Sprint 7 — Migrar reset de senha e ativação sem quebrar as garantias

### Objetivo

Migrar `auth-password-reset` depois dos demais, preservando o mesmo template para reset público e ativação interna, HMAC, ALS, idempotência e semântica de erro.

### Dependências

Sprints 0–6 verdes. `auth-password-reset` publicado e testado. Antes de qualquer smoke que envie para uma caixa real de Staging, os passos 8.1–8.5 da Sprint 8 precisam estar concluídos.

### Arquivos

- Modificar: `src/features/email/server.ts`
- Modificar: `src/features/email/server.test.ts`
- Modificar: `src/lib/auth-password-reset.ts`
- Modificar: `src/lib/auth-password-reset.test.ts`
- Modificar: `src/lib/auth.ts` somente se a configuração Better Auth precisar expor tipo/observabilidade
- Modificar: `src/app/api/auth/[...all]/route.ts` somente para evento/correlação, se necessário
- Modificar: `src/app/api/auth/[...all]/route.test.ts`
- Modificar: `docs/domain/identity-and-authorization.md`
- Modificar: `docs/integrations/resend-templates.md`

### Parte A — Renderer Hosted com espera preservada

- [ ] **7.1 — Trocar somente `sendPasswordResetEmail`**

  A função continuará recebendo `resetUrl`, `to`, `userName` e `idempotencyKey`, mas passará `USER_NAME` e `ACTION_URL` ao adapter Hosted. Não alterar o token, `redirectTo`, expiração de 3.600 segundos ou revogação de sessões.

- [ ] **7.2 — Manter `auth-password-reset.ts` síncrono na primeira etapa**

  O callback deve continuar aguardando `sendPasswordResetEmail` antes de chamar `deliveryContext.recordDelivered()`. Esse commit não usa `after()`.

- [ ] **7.3 — Reexecutar os seis casos críticos**

  Os testes devem comprovar:

  1. reset público normal usa Hosted e retorna sucesso;
  2. header arbitrário não é aceito como idempotência de ativação;
  3. HMAC válido sem ALS não é privilegiado;
  4. ativação interna válida envia Hosted e registra `recordDelivered` depois da resolução;
  5. erro do Resend registra falha interna e continua retryable;
  6. conflito de idempotência válido da ativação é sucesso;
  7. conflito de idempotência público é erro.

- [ ] **7.4 — Smoke de ativação em Staging**

  Usar um pedido Asaas Sandbox pago de teste e uma Conta sem credencial. Confirmar outbox `auth.account-activation`, link de reset e criação de senha. Repetir delivery e confirmar no-op/idempotência sem duplicação.

### Parte B — Agendar somente o reset público

- [ ] **7.5 — Confirmar o contexto disponível antes de usar `after()`**

  O tipo instalado do Next 16 exporta `after` de `next/server`; o callback Better Auth recebe uma `Request`; a ativação interna passa uma `Request` sintética. Antes de editar, adicionar teste que diferencia request pública real de `getAccountActivationDeliveryContext()`.

- [ ] **7.6 — Agendar o envio público dentro do callback**

  Em `src/lib/auth-password-reset.ts`, a regra de implementação é:

  ```ts
  if (request && !deliveryContext) {
    const correlationId = createCorrelationId(
      request.headers.get(CORRELATION_ID_HEADER)
    );
    after(async () => {
      try {
        await sendPasswordResetEmail({
          idempotencyKey,
          resetUrl: url,
          to: user.email,
          userName: user.name,
        });
        logOperationalEvent({
          correlationId,
          operation: "auth.password_reset_email",
          outcome: "success",
          provider: "resend",
        });
      } catch {
        logOperationalEvent({
          correlationId,
          errorCode: "password_reset_email_failed",
          operation: "auth.password_reset_email",
          outcome: "failure",
          provider: "resend",
        });
      }
    });
    return;
  }

  await sendPasswordResetEmail(input);
  deliveryContext?.recordDelivered();
  ```

  O código final deve importar `after` de `next/server`, `CORRELATION_ID_HEADER`, `createCorrelationId` e `logOperationalEvent` conforme os módulos existentes. O `idempotencyKey` do reset público deve continuar indefinido quando não houver contexto HMAC; não inventar uma chave de ativação para o caminho público. O callback não pode registrar URL, token, e-mail ou nome, e não pode lançar exceção para o response já enviado.

- [ ] **7.7 — Não usar `after()` para ativação**

  O branch `deliveryContext` deve seguir o `await` síncrono. O teste deve falhar se `after` for chamado quando o contexto de ativação existe. A operação interna precisa continuar retornando erro ao outbox se o provider falhar.

- [ ] **7.8 — Testar atraso e falha agendada**

  Mockar `next/server.after`, capturar a função e provar que a resposta pública pode concluir sem aguardar o mock de Resend. Executar o callback capturado e verificar sucesso/falha sanitizada. Provar que o callback público não altera o comportamento anti-enumeração da rota.

- [ ] **7.9 — Adicionar observabilidade sanitizada**

  Usar o padrão de `logOperationalEvent` existente para registrar somente operação, ambiente, outcome, correlation id disponível e código de erro categorizado. Não registrar e-mail, token, URL ou payload.

### Parte C — Smoke final de auth

- [ ] **7.10 — Testar conta existente**

  Solicitar reset e confirmar resposta genérica, registro `verifications`, email aceito pelo Resend e link funcional na caixa controlada.

- [ ] **7.11 — Testar conta inexistente**

  Solicitar reset com endereço não cadastrado e comparar status, corpo e tempo dentro da tolerância definida; não exigir igualdade estatística sem benchmark, mas registrar diferença grosseira.

- [ ] **7.12 — Testar ativação pós-pagamento**

  Confirmar que a ativação ainda espera o delivery, que HMAC inválido não é aceito, que conflito autorizado é no-op e que retry não cria credencial prematuramente.

### Critérios de aceite

- Todos os seis templates usam Hosted em Staging.
- Reset público pode ser agendado após resposta sem quebrar Better Auth.
- Ativação interna continua síncrona e protegida.
- Não há alteração em token, redirect, expiração, sessão ou anti-enumeração.
- Testes unitários e smoke de auth passam.

### Rollback

Primeiro desabilitar o branch `after()` por deployment anterior, mantendo o renderer Hosted. Se o problema for o template, reverter `sendPasswordResetEmail` para o renderer legado. Não alterar HMAC/ALS como tentativa de correção rápida.

### Commit sugerido

```powershell
git add src/features/email/server.ts src/features/email/server.test.ts src/lib/auth-password-reset.ts src/lib/auth-password-reset.test.ts src/app/api/auth/'[...all]'/route.test.ts docs/domain/identity-and-authorization.md docs/integrations/resend-templates.md
git commit -m "feat: migrate password reset to hosted template"
```

---

## Sprint 8 — Allowlist e isolamento efetivo de destinatários não produtivos

### Objetivo

Impedir que Development ou Staging enviem para destinatários arbitrários, corrigindo a lacuna atual em que o helper só aplica allowlist quando `NODE_ENV=development`.

### Dependências

Sprint 1 adicionou a variável e Sprint 7 terminou o smoke de auth em ambiente controlado.

### Arquivos

- Modificar: `src/features/email/development-recipient.ts`
- Modificar: `src/features/email/development-recipient.test.ts`
- Modificar: `src/features/email/server.ts`
- Modificar: `src/lib/env.ts`
- Modificar: `src/lib/env.test.ts`
- Modificar: `src/lib/staging-environment.ts`
- Modificar: `src/lib/staging-environment.test.ts`
- Modificar: `.env.example`
- Modificar: `docs/operations/environment-and-local-development.md`
- Modificar: `docs/integrations/resend.md`

### Passos

- [ ] **8.1 — Renomear a responsabilidade, não necessariamente a variável legada**

  Criar `assertNonProductionEmailRecipientAllowed` ou equivalente. A função recebe `runtimeEnvironment`, `developmentAllowlist`, `stagingAllowlist` e `recipient`.

  `DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST` continua atendendo Development. `STAGING_EMAIL_RECIPIENT_ALLOWLIST` atende Staging. A função não deve depender somente de `NODE_ENV`.

- [ ] **8.2 — Aplicar regra fail-closed**

  Regras exatas:

  - Development: allowlist não vazia e destinatário presente;
  - Staging: allowlist não vazia e destinatário presente;
  - Preview: runtime sem API key, falha antes do envio;
  - E2E: sink, sem provider;
  - Production: não aplicar allowlist, mas exigir configuração de remetente/suporte já existente.

- [ ] **8.3 — Aplicar a mesma regra ao Hosted e ao legado**

  A validação deve ocorrer na facade antes de escolher renderer. Um rollback para React Email não pode reabrir o risco de Staging.

- [ ] **8.4 — Cobrir `VERCEL_TARGET_ENV=staging`**

  Em `staging-environment.ts`, exigir `STAGING_EMAIL_RECIPIENT_ALLOWLIST` configurada. A classificação deve usar `resolveRuntimeEnvironment`, não apenas `VERCEL_ENV=preview`.

- [ ] **8.5 — Testar normalização e fail-closed**

  Em `development-recipient.test.ts`, cobrir maiúsculas, espaços, lista vazia, endereço ausente, Development, Staging e Production. Em `staging-environment.test.ts`, cobrir ausência e valor placeholder.

- [ ] **8.6 — Atualizar onboarding**

  `.env.example` deve descrever as duas allowlists sem valores reais. O runbook deve dizer que Staging compartilha Resend, mas só envia para caixas aprovadas.

### Critérios de aceite

- Staging recusa destinatário fora da allowlist antes do SDK.
- A regra funciona para todos os templates e ambos os renderers.
- Preview continua sem provider.
- Testes de ambiente e email passam.

### Rollback

Não fazer rollback da barreira de destinatário para corrigir um template. Se a allowlist estiver errada, corrigir somente a variável no ambiente ou pausar o smoke.

### Commit sugerido

```powershell
git add src/features/email/development-recipient.ts src/features/email/development-recipient.test.ts src/features/email/server.ts src/lib/env.ts src/lib/env.test.ts src/lib/staging-environment.ts src/lib/staging-environment.test.ts .env.example docs/operations/environment-and-local-development.md docs/integrations/resend.md
git commit -m "fix: enforce staging email recipient allowlist"
```

---

## Sprint 9 — Checker protegido do contrato Resend

### Objetivo

Detectar drift entre o contrato no código e o template publicado, sem transformar o build normal em uma chamada de rede dependente de segredo.

### Dependências

Todas as seis templates Staging publicadas e o contrato tipado da Sprint 3 estabilizado.

### Arquivos

- Criar: `scripts/check-resend-templates.ts`
- Criar: `src/tooling/check-resend-templates.test.ts`
- Modificar: `package.json` para script explícito `check:resend-templates`
- Modificar: `.github/workflows/deploy-staging.yml` somente se o gate protegido for executado nesse workflow
- Modificar: `.github/workflows/deploy-vercel.yml` somente se o gate de Production for executado com secret dedicado
- Modificar: `docs/integrations/resend-templates.md`
- Modificar: `docs/operations/testing-and-ci.md`

### Passos

- [ ] **9.1 — Definir interface do script**

  O comando será:

  ```powershell
  bun run check:resend-templates -- --environment=staging
  bun run check:resend-templates -- --environment=production
  ```

  O script exige `RESEND_TEMPLATES_ADMIN_API_KEY` apenas quando explicitamente chamado. Sem essa variável, falha com mensagem sem segredo. O build, `bun run check` e `bun run typecheck` não o importam.

- [ ] **9.2 — Usar o SDK/tipos instalados ou API oficial comprovada**

  Antes de implementar, conferir no `resend` 6.17.2 a assinatura de get-template por ID/alias e o formato `variables`, `status`, `published_at`, `reply_to`, `text` e `has_unpublished_versions`. O teste deve mockar a fronteira, não fazer rede.

- [ ] **9.3 — Definir checks bloqueantes**

  Para cada alias esperado, falhar com exit code 1 se:

  - o alias não existir;
  - o status não estiver publicado;
  - uma variável obrigatória estiver ausente;
  - tipo da variável divergir;
  - `ACTION_URL` faltar onde o contrato exige;
  - `CERTIFICATE_CODE` faltar no certificado;
  - o alias canônico esperado não corresponder ao template retornado;
  - `from`/`reply_to` do template violarem o contrato quando não forem overrides do Hub.

  Quando `plainTextMode` for `provider-generated` ou `template-managed`, o retorno do template também deve possuir `text` não vazio. A origem do texto pode ser automática ou editada no Resend; o bloqueio é a ausência de uma saída utilizável, não a exigência de texto escrito no código.

- [ ] **9.4 — Tratar draft como warning**

  Se `has_unpublished_versions=true`, emitir `warning` com alias e ambiente, sem exit code de falha. O output não pode imprimir HTML completo, corpo de email, variáveis de teste ou secrets.

- [ ] **9.5 — Verificar semântica de CTA**

  Não basta a chave existir. A inspeção deve confirmar que `ACTION_URL` aparece em um `href` ou posição declarada pelo catálogo e que `MESSAGE`/`SUPPORT_SUBJECT` aparecem em contexto de texto. Se a inspeção HTML for frágil, manter essa checagem como warning e exigir smoke manual; não inventar parser inseguro.

- [ ] **9.6 — Testar exit codes e mensagens**

  Em `src/tooling/check-resend-templates.test.ts`, mockar respostas para alias ausente, não publicado, variável ausente, tipo incorreto, draft com versão publicada, erro 401 e erro de rede. Verificar que nenhum output contém API key, HTML, token ou PII.

- [ ] **9.7 — Integrar somente como gate explícito**

  CI de qualidade continua sem rede Resend. Um workflow de deploy pode chamar o checker depois de Quality gates e com secret administrativo scoped, mas o deploy deve saber diferenciar warning de falha. Não usar `has_unpublished_versions` para bloquear.

### Critérios de aceite

- O checker roda sob comando explícito.
- Falhas de contrato têm exit code não zero.
- `has_unpublished_versions` apenas alerta.
- Build normal não exige Resend nem rede.
- Testes do script passam sem credenciais reais.
- O catálogo documental aponta para o comando e para o owner da publicação.

### Rollback

Remover somente a chamada do workflow; manter o script disponível para execução manual. Não desabilitar validação local de variáveis nem publicar template incompatível para contornar o gate.

### Commit sugerido

```powershell
git add scripts/check-resend-templates.ts src/tooling/check-resend-templates.test.ts package.json .github/workflows/deploy-staging.yml .github/workflows/deploy-vercel.yml docs/integrations/resend-templates.md docs/operations/testing-and-ci.md
git commit -m "ci: verify Resend hosted template contracts"
```

---

## Sprint 10 — Fazer rollout controlado do catálogo único

### Objetivo

Publicar a mesma superfície de contrato em Production e ativar o renderer Hosted somente após smoke real controlado.

### Dependências

Sprints 0–9 verdes, checker do catálogo sem falhas, CI do commit aprovado, autorização explícita para enviar emails reais.

### Arquivos

- Modificar: `docs/integrations/resend-templates.md`
- Modificar: `docs/integrations/resend.md`
- Modificar: `.github/workflows/deploy-vercel.yml` se o gate já estiver aprovado
- Nenhum código de negócio deve ser alterado nesta sprint sem PR específico de rollout

### Passos

- [ ] **10.1 — Confirmar o catálogo único antes do rollout**

  Não criar aliases adicionais. Confirmar que os seis aliases canônicos existem no mesmo Team e que o domínio verificado é `neurocapacitar.com.br`. O controle de destinatários continua no Hub.

- [ ] **10.2 — Testar drafts publicados com dados controlados**

  Antes de publicar, testar cada draft com uma caixa interna autorizada. Confirmar `from`, `replyTo`, plain text, subject, links e variáveis.

- [ ] **10.3 — Publicar a versão revisada e executar o checker**

  Publicar cada alias depois do teste e executar o checker contra o catálogo único:

  ```powershell
  bun run check:resend-templates -- --environment=production
  ```

  Warnings de `has_unpublished_versions` devem ser registrados para revisão, não convertidos em falha automática.

- [ ] **10.4 — Confirmar o deployment candidate**

  O SHA do deployment deve corresponder ao commit que migrou os senders. Confirmar que as variáveis do runtime Production apontam para a chave de envio correta e que não existe `RESEND_TEMPLATES_ADMIN_API_KEY` no web runtime.

- [ ] **10.5 — Quiescer e drenar a outbox antes do corte**

  Esta etapa é bloqueante. Antes de publicar o deployment Hosted, usar a janela de manutenção aprovada para impedir novas solicitações de reset, suporte, pagamentos, manutenção e outros produtores de email. Manter o deployment legado/worker legado ativo e consultar:

  ```sql
  select status, count(*)::int as total
  from outbox_messages
  where topic = 'auth.account-activation'
     or topic like 'email.%'
  group by status
  order by status;
  ```

  A consulta deve retornar zero para `pending`, `retrying` e `processing`. Esperar pelo menos o lease configurado do worker, consultar novamente e confirmar que não há processamento antigo. Não prosseguir se a quiescência não impedir novos produtores; aplicar o transporte versionado descrito na seção 1.9 antes de Production.

- [ ] **10.6 — Publicar Hosted sob quiescência**

  Com o ambiente ainda impedindo tráfego concorrente, publicar o SHA Hosted, confirmar o catálogo único e executar o checker. Somente depois de o novo deployment estar servindo, reabrir usuários e jobs.

- [ ] **10.7 — Executar smoke por fluxo, não envio em massa**

  Usar uma Conta de teste aprovada e, quando possível, um único evento por template:

  - reset público;
  - ativação interna em pedido de teste;
  - acesso liberado;
  - aviso controlado de expiração;
  - certificado emitido em fixture autorizado;
  - interesse comercial;
  - suporte com mensagem de teste identificável.

  Confirmar tanto a aceitação da API quanto a chegada na caixa. A palavra `delivered` no estado interno deve ser interpretada como aceitação do provider até existir webhook de entrega.

- [ ] **10.8 — Monitorar outbox e Resend**

  Durante a janela de observação, verificar `resend_delivery_failed`, retries, dead letters, duplicatas, `replyTo`, complaints e bounces no painel. Não considerar apenas HTTP 200 suficiente.

- [ ] **10.9 — Registrar a decisão de subject ownership**

  Depois do smoke, mover para Resend os assuntos estáticos que passaram por revisão. Para assuntos dinâmicos, registrar se as subject variables funcionaram. Manter suporte no Hub se a entrada da aluna não tiver contrato de segurança comprovado.

### Critérios de aceite

- Catálogo único publicado e checado.
- Todos os fluxos controlados chegam à caixa correta.
- Development, Staging e Production usam os mesmos aliases canônicos.
- Não há duplicação nem dead letter inesperado.
- O owner de conteúdo e o owner de código estão documentados.
- Não houve mudança de domínio/DNS.

### Rollback

Ordem de rollback:

1. pausar novos smokes e jobs controlados;
2. publicar o deployment anterior que usa React Email, se o problema for runtime;
3. reverter a versão do alias pelo version history, se o problema for conteúdo;
4. reprocessar dead letters somente depois de confirmar que o alias e a versão estão corretos;
5. não criar alias de fallback por ambiente nem apagar templates para “forçar” erro.

### Commit sugerido

```powershell
git add docs/integrations/resend-templates.md docs/integrations/resend.md .github/workflows/deploy-vercel.yml
git commit -m "release: enable production hosted email templates"
```

---

## Sprint 11 — Remover React Email do runtime somente após estabilização

### Objetivo

Eliminar o renderer legado e a dependência de componentes React Email somente quando todos os fluxos estiverem comprovadamente Hosted em Production.

### Dependências

Sprint 10 concluída e janela de observação definida pelo owner. O deployment anterior com renderer legado deve estar identificável para rollback.

### Arquivos

- Remover ou deixar de importar: `src/features/email/templates.tsx`
- Modificar: `src/features/email/server.ts`
- Modificar: `package.json`
- Modificar: `bun.lock` somente se a dependência for realmente removida
- Modificar: `src/features/email/server.test.ts`
- Modificar: `docs/integrations/resend.md`
- Modificar: `docs/integrations/resend-templates.md`
- Modificar: `docs/operations/outbox-and-transactional-effects.md`
- Modificar: `docs/operations/testing-and-ci.md`

### Passos

- [ ] **11.1 — Confirmar que não há import de runtime**

  Execute:

  ```powershell
  Select-String -Path 'src\**\*' -Pattern '@react-email/components','from "@react-email/components"','render(' -SimpleMatch -ErrorAction SilentlyContinue
  Select-String -Path 'src\**\*' -Pattern 'sendTransactionalEmail','sendHostedTemplateEmail' -SimpleMatch -ErrorAction SilentlyContinue
  ```

  Resultado esperado: nenhuma chamada de renderização React Email em caminho de envio; os seis senders usam o adapter Hosted.

- [ ] **11.2 — Fazer uma release de limpeza sem comportamento novo**

  Remover somente imports, componente legado e dependência não utilizada. Não alterar aliases, variáveis, subjects, URLs, outbox ou auth no mesmo commit.

- [ ] **11.3 — Validar dependência com Knip e TypeScript**

  ```powershell
  bun run typecheck
  bun run check
  bun run knip
  bun run test -- src/features/email src/lib/auth-password-reset.test.ts src/features/outbox
  bun run build
  ```

  Se `knip` indicar uso legítimo de `@react-email/components`, não remover a dependência. Se somente `react` permanecer usado pela aplicação, remover apenas `@react-email/components`.

- [ ] **11.4 — Executar verificação completa e documentação**

  ```powershell
  bun run docs:check
  bun run verify:quick
  ```

  Atualizar o runbook para dizer que o Resend é a fonte editorial e que rollback volta ao deployment anterior, não a um fallback interno.

- [ ] **11.5 — Preservar o artefato de rollback**

  Taggear ou registrar o SHA do último deployment com React Email antes de remover arquivos. Não manter uma cópia duplicada de secrets ou templates renderizados no Git.

### Critérios de aceite

- Nenhum import legado permanece no caminho de envio.
- Dependência removida somente se realmente não usada.
- Testes, build, Knip, typecheck, lint e docs passam.
- Rollback para o SHA anterior está documentado e testável.

### Rollback

Promover o deployment anterior com React Email. Não recriar manualmente os templates no código nem alterar o alias publicado durante a reversão, salvo se o problema for comprovadamente editorial.

### Commit sugerido

```powershell
git add src/features/email/server.ts src/features/email/templates.tsx package.json bun.lock src/features/email/server.test.ts docs/integrations/resend.md docs/integrations/resend-templates.md docs/operations/outbox-and-transactional-effects.md docs/operations/testing-and-ci.md
git commit -m "refactor: remove legacy React Email runtime"
```

---

## 4. Pós-migração: itens deliberadamente separados

Estes itens devem virar planos ou sprints próprios. Não bloquear o renderer Hosted por eles.

### 4.1 Suporte durável

- criar ticket persistido ou tópico `email.support-request` na outbox;
- definir idempotency key por submissão, não por texto cru;
- rate limit por Conta e IP conforme política existente;
- reprocessamento e dead letter auditável;
- preservar `replyTo` da aluna sem colocar PII desnecessária na outbox.

### 4.2 Deliverability real

- decidir se `delivered` será renomeado para `accepted_by_provider`;
- adicionar webhook autenticado para `email.delivered`, `email.bounced`, `email.complained` e `email.suppressed` se o produto precisar de estado durável;
- armazenar somente IDs/status necessários, sem corpo de email ou token;
- criar alertas para bounce e complaint.

### 4.3 Corrida de expiração

- versionar janela de expiração no payload sem guardar PII;
- invalidar mensagem antiga quando `expires_at` for alterado;
- revalidar `warningKind` contra a janela real antes de envio;
- atualizar idempotency key somente com identificadores e versão de janela estável.

### 4.4 Política de identidade

- decidir se email verification será exigido;
- alinhar `minPasswordLength` do backend e UI;
- centralizar `normalizeBuyerEmail` no reset público;
- medir p50/p95/p99 do reset existente e assíncrono.

### 4.5 Webhooks não fazem parte do primeiro corte

Não criar webhook apenas porque o Resend oferece o recurso. Primeiro definir consumidor, autenticidade, idempotência, retenção e impacto de produto.

---

## 5. Plano de rollback consolidado

### 5.1 Durante Development/Staging

1. impedir novos envios fora da allowlist;
2. usar deployment anterior ou reverter o sender específico;
3. manter templates Hosted publicados para investigação;
4. revisar Resend accepted events e inbox controlada;
5. reprocessar somente mensagens retryable depois da correção.

### 5.2 Se o template tiver conteúdo errado

1. manter o código atual se o payload estiver correto;
2. editar o draft;
3. testar draft;
4. publicar nova versão;
5. usar version history/revert se necessário;
6. não mudar o código para corrigir copy editorial.

### 5.3 Se o contrato estiver errado

1. parar o rollout;
2. corrigir `templates-contract.ts` e o template do mesmo alias;
3. executar checker e testes sem rede;
4. publicar versão compatível;
5. só então reprocessar mensagens.

### 5.4 Se auth falhar

1. promover o deployment legado;
2. confirmar que o renderer legado ainda existe até a Sprint 11;
3. não remover HMAC, ALS, idempotência ou `await` da ativação;
4. testar reset público e ativação separadamente antes de novo rollout.

Não usar `SCHEDULED_JOBS_ENABLED` como rollback específico de email: ele é um kill switch global e pode interromper webhooks, matrícula, JMVStream, outbox e manutenção. Para conter somente o rollout Hosted, promover o artefato anterior, manter a janela de manutenção ou reverter a versão do alias.

### 5.5 O que não fazer no rollback

- não chamar ambos os renderers na mesma tentativa;
- não criar alias de fallback por ambiente;
- não apagar uma versão publicada sem confirmar o deployment que a consome;
- não alterar `BETTER_AUTH_SECRET` para resolver erro de template;
- não reprocessar dead letters em massa sem medir se o provider já aceitou mensagens anteriores.

---

## 6. Matriz de testes por camada

### 6.1 Contrato puro

Arquivo: `src/features/email/templates-contract.test.ts`

- nomes lógicos e aliases por runtime;
- recusa de Preview/E2E;
- variável ausente;
- tipo errado;
- strings em 2.000 e 2.001;
- `MESSAGE` em 1.800 e 1.801;
- `DAYS_REMAINING` `1 dia`, `7 dias` e inválido;
- `COURSE_TITLE` de suporte sempre preenchido;
- nenhum import de provider.

### 6.2 Adapter

Arquivo: `src/features/email/server.test.ts`

- payload Hosted não possui `react/html/text`;
- alias por environment;
- `from`, `subject`, `replyTo`, `to`;
- idempotency key;
- conflito HMAC;
- conflito comum;
- erro provider;
- E2E sem rede;
- allowlist antes de Resend;
- valores não confiáveis somente em variables.

### 6.3 Templates editoriais

Evidência manual no Resend e catálogo documental:

- layout equivalente;
- CTA com variável correta;
- plain text;
- preview;
- assunto;
- `from/reply_to` default apenas como fallback;
- draft/publish/version history;
- suporte com HTML adversarial, aspas e quebra de linha.

### 6.4 Outbox

Arquivos: `src/features/outbox/delivery.test.ts`, `rules.test.ts`, `worker.test.ts`, `server.test.ts`.

- tópicos inalterados;
- payloads sem HTML, token ou PII nova;
- idempotency keys inalteradas;
- retry e dead letter;
- lease e fencing;
- ativação com HMAC/ALS;
- certificado somente `valid/ready`;
- access released somente matrícula ativa;
- sales interest consumido somente depois do envio aceito;
- expiry warning mantendo comportamento conhecido.

### 6.5 Auth

Arquivos: `src/lib/auth-password-reset.test.ts`, `src/lib/auth.ts`, `src/app/api/auth/[...all]/route.test.ts`.

- reset público Hosted;
- mensagem anti-enumeração;
- `after()` chamado somente no público;
- ativação interna aguardada;
- HMAC inválido;
- HMAC válido sem ALS;
- erro provider público e interno;
- revogação de sessões permanece Better Auth;
- URL de reset não é logada.

### 6.6 Ambiente

Arquivos: `src/features/email/development-recipient.test.ts`, `src/lib/env.test.ts`, `src/lib/staging-environment.test.ts`, `src/lib/runtime-environment.test.ts`.

- Development allowlisted;
- Staging allowlisted;
- Staging fora da allowlist recusado;
- Preview sem provider;
- E2E sink;
- todos os runtimes de envio usam o alias canônico;
- desconhecido fail-closed.

### 6.7 Verificação final

```powershell
bun run typecheck
bun run check
bun run knip
bun run test -- src/features/email src/lib/auth-password-reset.test.ts src/lib/account-activation-idempotency.test.ts src/features/outbox src/features/enrollments/maintenance.test.ts src/features/enrollments/maintenance-deadline.test.ts
bun run docs:check
bun run build
bun run verify:quick
```

Smoke remoto controlado é adicional; nenhum comando local substitui a confirmação na caixa destinatária.

---

## 7. Sequência recomendada de PRs

Cada PR deve ser pequeno o suficiente para rollback independente:

1. baseline e caracterização;
2. governança/aliases/documentação;
3. contrato tipado;
4. adapter Hosted e sink E2E;
5. course sales;
6. certificate;
7. expiry warning;
8. access released;
9. support renderer;
10. auth renderer;
11. auth `after()` público;
12. allowlist Staging;
13. checker protegido;
14. rollout do catálogo único;
15. remoção do runtime legado.

Cada PR deve conter:

- arquivos tocados;
- teste focal executado;
- resultado do `typecheck` e `check` quando houver código;
- evidência de smoke quando houver alias migrado;
- confirmação de que nenhum secret, token, HTML exportado ou PII foi adicionado;
- rollback específico.

Não fazer commit ou push automaticamente como parte da execução deste documento; o implementador deve seguir a política da equipe para revisão e release.

---

## 8. Definition of Done

A migração só está concluída quando todos os pontos forem verdadeiros:

- [ ] os seis aliases canônicos estão publicados no Team correto;
- [ ] Development, Staging e Production usam os mesmos aliases e Development/Staging têm allowlist fail-closed;
- [ ] Preview não tem credencial nem envia email;
- [ ] todos os seis senders usam o adapter Hosted;
- [ ] nenhum payload Hosted contém `react`, `html` ou `text`;
- [ ] `from` e `replyTo` continuam sob controle do Hub;
- [ ] subjects têm owner declarado por template;
- [ ] `MESSAGE` não ultrapassa 1.800 caracteres e nenhum valor string ultrapassa 2.000;
- [ ] suporte passou por teste de conteúdo adversarial;
- [ ] plain text foi validado em caixa controlada;
- [ ] reset público e ativação interna mantêm semânticas diferentes;
- [ ] ativação interna ainda aguarda entrega e preserva HMAC/ALS/idempotência;
- [ ] outbox, retry, dead letters e tópicos não foram alterados indevidamente;
- [ ] checker falha em drift bloqueante e alerta em `has_unpublished_versions`;
- [ ] checker não é dependência de build normal;
- [ ] smoke confirmou aceitação do Resend e recebimento na caixa;
- [ ] documentação de integração e operação está atualizada;
- [ ] `bun run typecheck`, `bun run check`, testes focais, `bun run docs:check`, `bun run build` e `bun run knip` passaram;
- [ ] o SHA do último deployment legado está registrado para rollback;
- [ ] a dependência React Email só foi removida depois de todos os imports desaparecerem.

---

## 9. Fontes primárias utilizadas

- [Resend — Send Email API](https://resend.com/docs/api-reference/emails/send-email): `template.id`, aliases, variables, incompatibilidade entre `template` e `html/text/react`, overrides de `from/subject/reply_to`.
- [Resend — Template introduction](https://resend.com/docs/dashboard/templates/introduction): importação de React Email, draft, test e publish.
- [Resend — Template variables](https://resend.com/docs/dashboard/templates/template-variables): variáveis, fallback, nomes reservados e limites documentados.
- [Resend — Version history](https://resend.com/docs/dashboard/templates/version-history): versão publicada permanece ativa enquanto existe draft e possibilidade de revert.
- [Resend — Get template](https://resend.com/docs/api-reference/templates/get-template): alias, status, `published_at`, variables e `has_unpublished_versions`.
- [Resend — API keys](https://resend.com/docs/dashboard/api-keys/introduction): Full Access, Sending Access e escopo de domínio.
- [Resend — Teams](https://resend.com/docs/dashboard/settings/team): separação de Team, membros e chaves.
- [Resend — Multi-tenant domains](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants): ownership/claim/reverificação de domínio e risco de interrupção.
- [Resend — React Email templates](https://resend.com/docs/knowledge-base/template-emails-with-react-email): renderização e upload a partir de React Email.
- [Better Auth — Email concepts](https://better-auth.com/docs/concepts/email): recomendação de não aguardar reset público quando timing attack for preocupação e uso de background/waitUntil.
- Código instalado de Better Auth 1.6.25 em `node_modules/@better-auth/core/dist/types/init-options.d.mts`: contrato de `advanced.backgroundTasks.handler`.
- Código instalado de Next 16.2.11: export de `after` em `next/server`, validado antes da Sprint 7.

---

## 10. Resultado esperado

Ao final, o fluxo deverá ser:

```text
evento de negócio/auth
  -> Hub valida destinatário, ambiente, URL, variáveis e idempotência
  -> Hub resolve alias por runtime
  -> Resend recebe from/to/replyTo/subject + template.id + variables
  -> Resend renderiza HTML/plain text e mantém versão editorial
  -> Hub/outbox registra a aceitação do provider conforme contrato atual
```

O Resend não decide matrícula, pagamento, ativação, expiração, certificado, destinatário ou autorização. O Hub não mantém mais o HTML de produção depois da Sprint 11. A separação reduz o acoplamento editorial sem transferir invariantes de segurança e negócio para o provider.
