---
status: historical-research
owner: engineering
canonical: false
snapshot_commit: cf6a129
last_verified_commit: b97f9594d6b4c06efe6287225e86e6d9c637f1b5
---

> Snapshot histórico não canônico. Serve como evidência de auditoria em 2026-08-19; não substitui código, testes ou documentação canônica.

# Auditoria consolidada do sistema de e-mails e autenticação

**Data:** 2026-08-19
**Branch principal da auditoria:** `staging`
**Commit auditado:** `cf6a129`
**Comparação de evolução:** `main..staging`
**Tipo:** relatório de pesquisa e consolidação, não documentação canônica
**Escopo:** e-mails de autenticação, ativação, acesso, expiração, certificado, interesse comercial, suporte, outbox, Resend, ambientes, testes e documentação relacionada.

## 1. Objetivo e método

Este documento consolida duas análises:

1. a auditoria principal do workspace, feita contra código, testes, dependências e documentação canônica;
2. a análise externa recebida do estagiário em 2026-08-19.

O arquivo externo foi tratado como evidência a ser verificada. Nenhuma instrução textual, comando ou recomendação contida nele foi executada automaticamente.

Cada conclusão recebeu uma destas classificações:

- **Confirmado:** há evidência direta no código, teste, documentação canônica ou fonte oficial do provider;
- **Parcial:** o mecanismo existe, mas a conclusão, severidade ou recomendação estava forte demais;
- **Comportamento de design:** existe e está documentado, mas não é um bug comprovado;
- **Não comprovado:** não houve evidência suficiente no estado auditado.

As fontes primárias usadas foram:

- código em `src/`;
- testes unitários, integração e E2E;
- `README.md`, `PRODUCT.md`, `CONTEXT.md` e a trilha indicada por `docs/README.md`;
- guias de identidade, comércio, certificados, Resend, outbox, ambiente, observabilidade e testes;
- comparação local entre as branches `main` e `staging`;
- documentação oficial do [Better Auth](https://better-auth.com/docs/concepts/email) e da [idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Segredos, tokens, chaves e valores de `.env` foram deliberadamente omitidos. Quando necessário, este relatório cita somente arquivo, linha e tipo de credencial.

## 2. Resultado executivo

O subsistema é arquiteturalmente consistente para e-mails transacionais: existe uma fronteira central de Resend, templates React Email, outbox transacional, chaves de idempotência, leases, retries, dead letters, reprocessamento auditado, proteção especial para ativação e testes de concorrência difíceis.

A conclusão externa de que a arquitetura é madura está confirmada como avaliação técnica. A afirmação de que não existe nenhum risco crítico evidente precisa ser relativizada: há credenciais materializadas em arquivos locais ignorados pelo Git, o que exige rotação operacional imediata, embora não prove que houve exposição ou comprometimento de Production.

Os maiores riscos confirmados são:

1. Staging usa a estrutura Resend compartilhada sem allowlist de destinatários;
2. `delivered` na outbox significa aceitação síncrona do Resend, não entrega real na caixa;
3. solicitação de suporte envia diretamente, sem outbox, retry, rate limit ou idempotência;
4. recuperação de senha não aplica a mesma normalização canônica usada no fluxo de compra;
5. aviso de expiração pode ficar obsoleto depois de uma alteração concorrente da janela de acesso;
6. cobertura E2E de autenticação e acesso não valida os e-mails reais, somente a outbox ou o sink de certificado;
7. há divergência entre política de senha do backend e tela de redefinição;
8. a documentação contém contradições de destino do certificado e de ativação dos crons em Development.

## 3. Mapa funcional confirmado

### 3.1 Autenticação e recuperação pública

`src/lib/auth.ts` configura Better Auth com:

- autenticação por e-mail e senha;
- `minPasswordLength: 8`;
- tokens de redefinição válidos por 3600 segundos;
- revogação das sessões após redefinição;
- adaptador Drizzle sobre as tabelas `users`, `accounts`, `sessions` e `verifications`;
- callback próprio em `sendResetPassword`.

Não há `emailVerification`, `sendVerificationEmail` ou `requireEmailVerification`. Portanto, o produto atualmente não envia confirmação de cadastro e não exige verificação de posse do e-mail antes do login.

O fluxo público é:

1. a tela envia `POST /api/auth/request-password-reset`;
2. o Better Auth procura a Conta e, quando existente, cria um registro em `verifications`;
3. o token é usado para construir a URL de reset;
4. o callback chama o serviço de e-mail;
5. o link passa pela rota do Better Auth e redireciona para `/redefinir-senha`;
6. o POST de redefinição consome o token, cria ou atualiza a credencial e revoga as sessões.

A interface usa a mesma mensagem para Conta existente, inexistente e falha de entrega, preservando a política anti-enumeração.

### 3.2 Ativação após compra

Quando um pagamento autoritativo libera acesso, o processor escolhe entre:

- `auth.account-activation`, quando a Conta ainda não possui credencial;
- `email.access-released`, quando já possui credencial.

A intenção `auth.account-activation` contém somente `userId` e `orderId`. O token de redefinição não é gravado na outbox.

Durante a entrega, o sistema:

1. confirma que o Pedido é Asaas e está `paid`;
2. confirma que o Pedido pertence ao `userId` da mensagem;
3. resolve o e-mail atual da Conta;
4. verifica se já existe credencial;
5. chama `requestPasswordReset` com `/redefinir-senha` quando necessário;
6. deriva uma idempotency key opaca com HMAC-SHA256;
7. usa `AsyncLocalStorage` para confirmar que o callback realmente executou o envio;
8. classifica falhas como `account_activation_failed` e deixa a mensagem elegível para retry.

Se a credencial já existe no momento da entrega, a intenção é concluída como no-op. Esse comportamento está documentado em `docs/operations/outbox-and-transactional-effects.md` e não deve ser classificado automaticamente como bug.

### 3.3 Catálogo de efeitos transacionais

| Tópico | Gatilho | Payload persistido | Entrega | Observação |
|---|---|---|---|---|
| `auth.account-activation` | pagamento libera acesso sem credencial | `userId`, `orderId` | Better Auth → Resend | token nasce somente no delivery |
| `email.access-released` | pagamento libera acesso com credencial | `userId`, `courseId` | Resend | consulta matrícula ativa no delivery |
| `email.access-expiry-warning` | manutenção detecta janela de 7 ou 1 dia | `enrollmentId`, `warningKind` | Resend | marcador é gravado antes do envio |
| `certificate.render` | emissão de certificado | `certificateId` | R2/PDF | cria o artefato privado |
| `email.certificate-issued` | certificado fica `valid` e `ready` | `certificateId` | Resend | aponta para `/certificados/[code]` |
| `email.course-sales-opened` | Admin abre vendas | `interestId` | Resend | interesse é consumido após o envio |
| solicitação de suporte | Server Action autenticada | não usa outbox | Resend direto | `Reply-To` é o e-mail da aluna |

### 3.4 Transporte e templates

`src/features/email/server.ts` centraliza o envio:

- renderiza React Email para HTML;
- usa `RESEND_FROM_EMAIL` como remetente;
- usa `SUPPORT_EMAIL` como `Reply-To` padrão;
- aceita idempotency key do efeito;
- aplica allowlist somente quando `NODE_ENV=development`;
- não envia ao Resend em E2E isolado;
- lança erro quando o provider responde falha;
- trata conflito de idempotência como sucesso somente para uma chave interna de ativação autenticada por HMAC.

Os templates são:

- criação/redefinição de senha;
- acesso liberado;
- acesso próximo do vencimento;
- inscrições abertas;
- certificado emitido;
- pedido de suporte.

O envelope atual contém somente HTML. Não há alternativa `text` plain-text.

### 3.5 Ambientes

- **Development:** entrega real, mas com allowlist obrigatória de destinatários;
- **E2E:** absorve os efeitos e não chama Resend;
- **Preview:** recusa credenciais de providers;
- **Staging:** usa banco persistente, Asaas Sandbox e estrutura Resend compartilhada;
- **Production:** usa Resend real e exige `RESEND_API_KEY`, remetente e caixa de suporte.

O compartilhamento de Resend em Staging está documentado como exceção aprovada, mas não possui a mesma barreira de destinatário do Development.

## 4. Veredito consolidado da análise externa

### 4.1 Diagnóstico geral

**Veredito: parcialmente confirmado.**

A arquitetura realmente possui maturidade acima de um envio direto simples. O catálogo de e-mails e os limites entre domínio, outbox e provider estão coerentes.

Já a frase “não existe P0” é uma avaliação de severidade, não um fato demonstrável. Os arquivos locais contêm credenciais configuradas. Isso não prova vazamento nem comprometimento de Production, mas exige tratamento imediato.

### 4.2 Timing side-channel do reset público

**Veredito: parcial.**

O `await` e a diferença de caminho existem. O Better Auth também recomenda evitar aguardar o envio de e-mail de reset para reduzir timing attacks e usar mecanismo de background em serverless.

O que não foi comprovado é a exploração prática no ambiente real. Não há benchmark p50/p95/p99 nem teste de latência comparando Conta existente e inexistente.

Conclusão corrigida: risco plausível de hardening, com recomendação de separar o caminho público assíncrono do caminho interno de ativação, sem remover a confirmação síncrona necessária à outbox.

### 4.3 Staging pode enviar e-mails reais

**Veredito: confirmado.**

O comportamento está implementado e documentado. A proteção atual é baseada em `NODE_ENV`, enquanto o runtime canônico distingue `staging`.

Conclusão corrigida: risco operacional confirmado dentro de uma exceção de design conhecida. Deve existir allowlist específica, caixas de teste ou uma capability explícita para entrega real.

### 4.4 Ativação de conta

**Veredito: confirmado.**

A análise externa descreveu corretamente:

- ausência de token na outbox;
- reconfirmação do Pedido pago;
- HMAC interno;
- isolamento por `AsyncLocalStorage`;
- testes de callback engolido, callback ausente e concorrência.

A avaliação de “melhor parte” é opinião e foi removida do conjunto de fatos.

### 4.5 Conflito de idempotência da ativação

**Veredito: confirmado.**

O código trata `invalid_idempotent_request` somente quando a chave apresenta formato e tag HMAC válidos. As chaves adulteradas e tópicos comuns não recebem o mesmo tratamento.

O contrato externo do Resend confirma a janela de 24 horas e o conflito para payload diferente. Depois dessa janela, a deduplicação não deve ser presumida.

### 4.6 Idempotência dos demais e-mails

**Veredito: confirmado.**

Os efeitos comuns reutilizam a chave, mas alguns dados são resolvidos no momento da entrega. Mudança de nome, título, destinatário, template ou conteúdo pode produzir payload diferente e levar a conflito no Resend.

O problema é uma aresta de consistência, não uma falha em todas as tentativas. A correção futura precisa preservar a restrição de não colocar PII na outbox.

### 4.7 Janela de retry

**Veredito: parcial.**

Cinco tentativas e backoff de 1, 2, 4 e 8 minutos estão confirmados. O tempo real pode ser maior por causa da execução do cron a cada cinco minutos.

“Curto demais” é uma decisão operacional. Deve ser definido por SLO de recuperação e volume de dead letters, não apenas pela soma do backoff.

### 4.8 Ausência de verificação de e-mail

**Veredito: confirmado como comportamento; não confirmado como bug.**

Não existe fluxo de verification email. Staging habilita cadastro público sem exigir prova de posse do endereço.

É necessária decisão de produto/segurança, não correção automática. A ausência pode ser deliberada para o modelo de identidade baseado em compra e ativação.

### 4.9 Divergência de senha

**Veredito: confirmado.**

O backend aceita 8, enquanto a tela de redefinição informa e impõe 10. A política deve ser centralizada e aplicada no backend como autoridade.

### 4.10 Observabilidade do reset

**Veredito: parcial.**

O usuário recebe mensagem genérica e o callback pode falhar sem sinal específico na rota do Hub. Porém não é correto afirmar ausência total de logs, porque Better Auth possui logger interno.

Conclusão corrigida: falta telemetria operacional própria, sanitizada e correlacionável para solicitação, aceitação e falha do reset.

### 4.11 Outbox

**Veredito: confirmado.**

Leases, claims, `SKIP LOCKED`, fencing, retries, dead letters e auditoria de reprocessamento estão implementados.

Ressalva: `delivered` indica aceitação síncrona da API. Não comprova entrega na caixa.

### 4.12 Campos `sent_at` de expiração

**Veredito: parcial.**

O nome é enganoso porque o campo representa enqueue, não envio. Além disso, há uma corrida mais importante: uma alteração da expiração pode limpar o marcador enquanto a mensagem antiga continua pendente e mantém a mesma idempotency key.

Renomear o campo melhora o modelo, mas não resolve a invalidação da mensagem antiga.

### 4.13 No-op da ativação

**Veredito: comportamento de design.**

Quando a credencial já existe, a ativação é concluída sem novo email. Isso está documentado e testado.

A possibilidade de a pessoa ter acesso sem receber uma nova notificação é real, mas não constitui bug sem uma regra de produto exigindo o aviso de acesso liberado em todos os casos.

### 4.14 Suporte

**Veredito: confirmado.**

É o fluxo menos robusto: direto, sem persistência durável, retry, rate limit, limite server-side ou idempotência.

O fato de ser uma Server Action autenticada reduz abuso anônimo, mas não elimina spam por Conta válida nem perda por indisponibilidade do Resend.

### 4.15 Templates

**Veredito: parcial.**

Ausência de plain-text, português inconsistente e largura fixa são observações válidas. Apenas a ausência de plain-text é uma lacuna funcional clara; os demais pontos são qualidade de produto e compatibilidade.

### 4.16 Diferença entre `main` e `staging`

**Veredito: confirmado.**

`staging` contém renderização HTML explícita, sales-opened, sink E2E de certificado, destino canônico por `CERTIFICATE_PUBLIC_BASE_URL` e hardening adicional de outbox.

Isso confirma que a auditoria atual deve usar `staging` como fonte de comportamento, mantendo a divergência de branches como risco de release.

## 5. Achados adicionais confirmados pela auditoria principal

### 5.1 Credenciais materializadas nos arquivos locais

**Categoria:** segurança, urgente operacional
**Confiança:** alta
**Esforço:** S
**Risco da correção:** alto para `BETTER_AUTH_SECRET`, porque pode invalidar sessões e tokens; baixo para a troca da chave Resend.

Foram detectados valores configurados, sem placeholders, para `BETTER_AUTH_SECRET` e `RESEND_API_KEY` em `.env.local`, `.env.staging` e `.env.production`.

Os arquivos não estão versionados, mas continuam presentes na estação. A correção correta é rotação/revogação, revisão de backups e reidratação por secret manager. Os valores não devem ser copiados para issues, chat, relatório ou Git.

### 5.2 Normalização de e-mail inconsistente

**Categoria:** correctness/auth
**Confiança:** alta
**Esforço:** M
**Risco da correção:** médio, por causa de contas legadas.

`normalizeBuyerEmail` remove pontos e `+tag` em domínios reconhecidos. O fluxo de recuperação não aplica essa normalização antes de chamar Better Auth.

Impacto: Conta criada a partir de uma compra pode não ser encontrada quando a aluna usa um alias equivalente ao pedir recuperação. A mensagem anti-enumeração esconde a falha.

### 5.3 Aceitação do provider versus entrega real

**Categoria:** observabilidade/confiabilidade
**Confiança:** alta
**Esforço:** L
**Risco da correção:** médio.

Não há rota, handler ou persistência para eventos de bounce, complaint ou suppression do Resend. A busca atual encontrou somente uma importação direta do pacote `resend`, em `src/features/email/server.ts`.

O sistema precisa escolher entre:

- implementar ingestão e estado assíncrono do provider; ou
- renomear/documentar `delivered` como “accepted by provider” para não sugerir entrega real.

### 5.4 Corrida nos avisos de expiração

**Categoria:** correctness/concurrency
**Confiança:** alta
**Esforço:** M
**Risco da correção:** médio.

A manutenção grava o marcador e a intenção na mesma transação. Porém a reconstrução da matrícula pode alterar `expires_at`, limpar os marcadores e deixar a mensagem antiga na outbox.

Como a chave é derivada somente de matrícula e janela, uma nova intenção pode colidir com a antiga. O delivery também não revalida a janela efetiva antes de enviar.

### 5.5 Cobertura E2E incompleta

**Categoria:** testes
**Confiança:** alta
**Esforço:** M
**Risco da correção:** médio.

O sink E2E guarda somente tópico de certificado, hash do destinatário e idempotência. A ativação comprova existência da linha de outbox; acesso liberado e expiração não têm entrega E2E real; suporte não é coberto por sink.

O E2E do certificado também navega diretamente pela URL pública, sem validar o `actionUrl` que o template realmente renderizou.

### 5.6 Contradições documentais

**Categoria:** documentação/DX
**Confiança:** alta
**Esforço:** S
**Risco da correção:** baixo.

Há pelo menos estas divergências:

- `docs/operations/outbox-and-transactional-effects.md` ainda menciona `/app/certificados`, enquanto o código envia para `/certificados/[code]`;
- `.env.example` orienta `SCHEDULED_JOBS_ENABLED=false`, enquanto o preflight de Development exige `true` para exercitar outbox e manutenção;
- a documentação de Resend declara autenticação DNS válida, mas mantém a confirmação dos cabeçalhos como pendente.

## 6. Decisões de design confirmadas

Estes pontos não devem ser tratados como bugs automaticamente:

1. não persistir token de reset na outbox;
2. usar HMAC e contexto assíncrono para distinguir ativação interna de reset público;
3. concluir ativação como no-op quando a credencial já existe;
4. manter payloads da outbox sem PII, token, senha ou URL secreta;
5. usar uma página pública canônica para certificado;
6. manter cadastro público desligado por padrão fora de Staging;
7. compartilhar Resend em Staging, desde que o risco seja explicitamente aceito e controlado;
8. permitir reprocessamento manual de dead letters com motivo e auditoria.

## 7. Ordem recomendada para futuros sprints

Esta ordem não implementa nada; apenas organiza dependências para o planejamento posterior.

### Sprint 0 - contenção operacional

- rotacionar `BETTER_AUTH_SECRET` e `RESEND_API_KEY` materializados localmente;
- confirmar quais ambientes receberam as credenciais;
- decidir e documentar a política de destinatários do Staging.

### Sprint 1 - limites de envio

- allowlist/capability de Staging;
- limites server-side e rate limit para suporte;
- persistência ou outbox específica para solicitação de suporte;
- idempotência contra reenvio do formulário.

### Sprint 2 - auth e recuperação

- decidir política de verificação de e-mail;
- alinhar senha mínima backend/frontend;
- aplicar normalização canônica na recuperação;
- separar reset público assíncrono de ativação interna síncrona;
- adicionar telemetria sanitizada do reset.

### Sprint 3 - consistência de efeitos

- versionar ou invalidar avisos de expiração;
- decidir estratégia para payload mutável com mesma idempotency key;
- classificar erros permanentes do Resend sem registrar PII.

### Sprint 4 - confirmação de entrega e testes

- definir se `delivered` significa aceitação ou entrega;
- considerar webhooks de bounce, complaint e suppression;
- adicionar sinks E2E mínimos para auth, acesso e expiração;
- validar o link efetivamente renderizado no email de certificado.

### Sprint 5 - documentação e templates

- corrigir destinos e valores de ambiente documentados;
- adicionar plain-text;
- revisar acentuação, responsividade e compatibilidade dos templates;
- renomear campos `sent_at` se o modelo continuar representando enqueue.

## 8. Escopo não verificado

Esta auditoria não comprova:

- entrega real em uma caixa de Production;
- estado atual de SPF, DKIM e DMARC nos cabeçalhos de uma mensagem real;
- configuração efetiva do projeto Vercel ou do painel Resend;
- alertas operacionais ativos fora do código;
- resultado da CI completa do commit auditado;
- comportamento de branches ou deploys que não estejam presentes localmente.

## 9. Verificação do estado auditado

Comandos executados no commit auditado:

- `bun run typecheck` — exit code 0;
- `bun run check` — exit code 0; 748 arquivos verificados;
- `bun run docs:check` — exit code 0; 32 documentos válidos;
- testes focais de email, auth, outbox, manutenção e pagamentos — 10 arquivos e 76 testes passando.

Nenhum código, documentação canônica ou arquivo de configuração existente foi alterado como parte da auditoria. Este arquivo é o único artefato criado por esta solicitação.

## 10. Fontes internas principais

- `docs/README.md`;
- `docs/domain/identity-and-authorization.md`;
- `docs/domain/commerce-and-access.md`;
- `docs/domain/certificates-and-data-rights.md`;
- `docs/integrations/resend.md`;
- `docs/operations/outbox-and-transactional-effects.md`;
- `docs/operations/environment-and-local-development.md`;
- `docs/operations/observability-and-recovery.md`;
- `docs/operations/testing-and-ci.md`;
- `src/lib/auth.ts`;
- `src/lib/auth-password-reset.ts`;
- `src/features/email/server.ts`;
- `src/features/email/templates.tsx`;
- `src/features/outbox/rules.ts`;
- `src/features/outbox/delivery.ts`;
- `src/features/outbox/worker.ts`;
- `src/features/enrollments/maintenance.ts`;
- `src/features/enrollments/server.ts`;
- `src/app/(student)/app/actions.ts`;
- `tests/e2e/critical-journeys.spec.ts`.
