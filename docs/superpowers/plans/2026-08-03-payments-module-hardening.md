---
status: accepted
owner: engineering
last_verified_commit: 3f890203b6d74d9500ac894e6edfcc02bf70ceac
---

# Payments Module Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar os riscos de convergencia, autorizacao e recuperacao encontrados na revisao pos-sprint do modulo Asaas sem enfraquecer idempotencia, precedencia financeira ou isolamento entre ambientes.

**Architecture:** Webhook e conciliacao permanecem adaptadores distintos, mas passam a entregar evidencia normalizada a um unico modulo profundo de aplicacao financeira. Comandos administrativos mutaveis usam capacidades explicitas, e operacoes ambiguas convergem por consulta idempotente em vez de repetir mutacoes externas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Drizzle schema/migrations, Better Auth RBAC, Vitest e Asaas Checkout/Webhooks API v3.

`last_verified_commit` permanece no hash-base existente. As alteracoes descritas nas fases
concluidas estao locais e ainda nao foram commitadas.

---

## Regras de execucao

- Desenvolvimento por TDD: cada mudanca comportamental comeca por um teste que falha pelo motivo esperado.
- Nenhuma resposta ou redirect de checkout comprova pagamento; somente evidencia financeira autoritativa concede acesso.
- Nenhuma chamada externa ocorre dentro de transacao longa do PostgreSQL.
- Nenhum retry repete cegamente criacao de checkout ou reembolso em estado incerto.
- Dinheiro continua representado em centavos inteiros dentro do dominio.
- Documentacao canonica e este checklist sao atualizados na mesma fase.
- Commits e push nao fazem parte da execucao sem autorizacao explicita do usuario.

## Estado das fases

- [x] Fase 0: auditoria, baseline e plano rastreavel
- [x] Fase 1: autorizacao e maquina de revisoes financeiras
- [x] Fase 2: aplicacao financeira compartilhada e conciliacao reparadora
- [x] Fase 3: recuperacao do checkout publico em processamento
- [x] Fase 4: resiliencia de eventos financeiros adversos
- [x] Fase 5: observabilidade, throttling e inventario de eventos
- [x] Fase 6: parcelamento, extrato e invariantes persistentes
- [x] Fase 7: remocao de politica morta e reconciliacao documental
- [x] Fase 8: verificacao integral e auditoria de conclusao

## Fase 0: baseline e rastreabilidade

**Arquivos:**

- Criar: `docs/superpowers/plans/2026-08-03-payments-module-hardening.md`
- Modificar: `docs/README.md`

**Criterios:**

- [x] Revisar documentacao oficial atual do Asaas para checkout, eventos, idempotencia, retries e reembolso.
- [x] Confirmar que o worktree esta isolado na branch `staging` e equivale ao codigo remoto revisado.
- [x] Executar baseline global com `bun run verify:quick`.
- [x] Registrar baseline: migrations validas, 652 arquivos no Ultracite e 1.417 testes em 226 arquivos.
- [x] Executar `bun run docs:check` depois de indexar este plano.

## Fase 1: autorizacao e maquina de revisoes financeiras

**Arquivos principais:**

- Modificar: `src/lib/auth/permissions.ts` e testes de RBAC correspondentes.
- Modificar: `src/features/payments/actions.ts`.
- Modificar: `src/features/payments/payment-reviews.ts` e `payment-reviews.test.ts`.
- Modificar: `src/app/(admin)/admin/financeiro/financial-operations.tsx` e testes.
- Modificar: `docs/domain/identity-and-authorization.md`, `docs/domain/commerce-and-access.md`, `docs/adr/0005-financial-precedence-and-manual-review.md` e `docs/integrations/asaas.md`.

**Contrato desejado:**

```ts
type PaymentReviewType =
  | "amount_mismatch"
  | "buyer_identity"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict";

type FinancialReviewDecision = "approved" | "rejected";
```

- [x] RED: provar que `support` nao possui `manageFinancialReviews` e que `admin` possui.
- [x] GREEN: adicionar `manageFinancialReviews` como capacidade mutavel exclusiva de Admin.
- [x] RED: provar que a action rejeita resolucao com apenas `viewFinancials`.
- [x] GREEN: exigir `manageFinancialReviews` em `resolvePaymentReviewAction`.
- [x] RED: provar que `event_anomaly` e `partial_refund` nao podem ser encerrados pelo resolvedor generico.
- [x] GREEN: tornar a matriz exaustiva; `buyer_identity` exige reembolso integral, `event_anomaly` exige conciliacao/reprocessamento, `partial_refund` exige fluxo financeiro especifico e `terminal_conflict` permanece Admin-only.
- [x] RED: provar que combinacoes de tipo e decisao sem efeito de dominio falham antes do update.
- [x] GREEN: persistir resolucao somente depois de aplicar e auditar o efeito previsto.
- [x] Ajustar a UI para nao oferecer decisoes genericas em anomalia, identidade ou reembolso parcial.
- [x] Executar testes focados de RBAC, actions, revisoes e pagina financeira.
- [x] Atualizar os quatro documentos canonicos e marcar a fase concluida apenas apos `bun run docs:check`.

## Fase 2: aplicacao financeira compartilhada e conciliacao reparadora

**Arquivos principais:**

- Criar: `src/features/payments/apply-authoritative-financial-evidence.ts` e teste.
- Modificar: `src/features/payments/asaas-webhook-processor.ts` e teste.
- Modificar: `src/features/payments/reconciliation.ts` e teste.
- Modificar: `docs/architecture.md`, `docs/domain/commerce-and-access.md` e ADR-0005.

**Interface interna desejada:**

```ts
type AuthoritativeFinancialEvidence = {
  source: "asaas_webhook" | "asaas_reconciliation";
  eventId: string | null;
  orderId: string;
  paymentId: string;
  installmentId: string | null;
  eventType: string;
  providerStatus: string;
  paidAmountInCents: number | null;
  netAmountInCents: number | null;
  refundedAmountInCents: number;
  observedAt: Date;
};
```

- [x] Escrever testes de caracterizacao para concessao, revogacao, precedencia terminal, divergencia e idempotencia do webhook atual.
- [x] RED: provar que conciliacao de pedido `pending` com pagamento confirmado ainda nao concede acesso.
- [x] Implementar o modulo compartilhado com transacao recebida por dependencia, mantendo consultas Asaas fora da transacao.
- [x] Migrar o webhook para o modulo compartilhado sem alterar os testes de caracterizacao.
- [x] Migrar conciliacao para a mesma politica e remover `decideReconciliation` duplicado.
- [x] GREEN: conciliacao confirmada deve marcar pedido pago, resolver identidade publica, criar Access Grant/matricula e enfileirar efeitos exatamente uma vez.
- [x] Provar que conciliacao repetida e webhook posterior sao idempotentes.
- [x] Provar que pagamento bloqueado/revogado nunca cria acesso e gera a revisao correta.
- [x] Executar testes focados e a suite completa de pagamentos.
- [x] Atualizar arquitetura, dominio e ADR antes de concluir a fase.

## Fase 3: recuperacao do checkout publico

**Arquivos principais:**

- Criar: `src/features/payments/checkout-recovery.ts` e teste.
- Modificar: `src/app/api/checkouts/course/route.ts` e teste.
- Modificar: `src/app/comprar/[slug]/purchase-handoff-client.tsx` e teste.
- Modificar: `src/features/payments/checkout-api.ts` e teste.
- Modificar: `docs/domain/commerce-and-access.md` e `docs/integrations/asaas.md`.

- [x] RED: provar que um checkout `processing` nao possui mecanismo de convergencia na UI.
- [x] Implementar consulta autorizada pelo identificador opaco da tentativa armazenado no navegador, sem expor PII ou aceitar enumeracao por `orderId` puro.
- [x] Retornar apenas `processing`, `ready`, `unavailable` ou `failed`, com URL somente quando o checkout pertence a tentativa apresentada.
- [x] Implementar polling com backoff limitado e cancelamento no unmount.
- [x] Exibir verificacao manual depois do limite sem criar outra mutacao automaticamente.
- [x] Provar que refresh, duas abas e respostas repetidas reutilizam a mesma tentativa e nunca criam dois checkouts automaticamente.
- [x] Provar que tentativa invalida nao revela existencia do pedido.
- [x] Atualizar docs e concluir com testes de route, client e checkout.

## Fase 4: eventos adversos sem dependencia de enriquecimento remoto

**Arquivos principais:**

- Modificar: `src/features/payments/asaas-webhook-processor.ts` e teste.
- Modificar: `src/features/payments/asaas-financial-events.ts` e teste.
- Modificar: `docs/integrations/asaas.md` e runbook de recuperacao.

- [x] RED: simular falha de `getInstallment` durante refund, chargeback e disputa de pagamento ja correlacionado.
- [x] Separar evidencia minima autoritativa de enriquecimento agregado.
- [x] Aplicar bloqueio/revogacao conservadora quando IDs persistidos correlacionarem exatamente o evento adverso.
- [x] Criar revisao e retry de enriquecimento sem reverter a protecao de acesso ja aplicada.
- [x] Manter grant proibido quando enriquecimento necessario a valor ou identidade estiver indisponivel.
- [x] Provar idempotencia quando o enriquecimento posterior finalmente funcionar.
- [x] Atualizar contrato e runbook; executar suite de eventos e worker.

## Fase 5: observabilidade, throttling e inventario de eventos

**Arquivos principais:**

- Modificar: observabilidade financeira e pagina administrativa existentes.
- Modificar: `src/features/payments/refunds.ts` e teste.
- Modificar: `src/features/payments/asaas-financial-events.ts` e teste.
- Modificar: `docs/operations/observability-and-recovery.md` e `docs/integrations/asaas.md`.

- [x] Adicionar idade do webhook pronto/retry/failed mais antigo e contagens de checkout/refund `uncertain` ao snapshot operacional.
- [x] Definir limiares nomeados e emitir sinal operacional antes da janela de retencao do Asaas.
- [x] Documentar reativacao da fila, replay e consulta antes de retry externo.
- [x] RED: provar limite de tentativas incorretas na confirmacao de senha de reembolso por ator e janela.
- [x] GREEN: aplicar throttling server-side sem registrar senha ou PII e limpar contagem depois de sucesso/expiracao.
- [x] RED: classificar `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` como falha sem acesso.
- [x] GREEN: persistir estado e contexto operacional do evento sem transforma-lo em pagamento confirmado.
- [x] Executar testes de observabilidade, refund e eventos; atualizar docs.

## Fase 6: parcelamento, extrato e invariantes persistentes

**Arquivos principais:**

- Modificar: configuracao de pagamento do curso e testes.
- Modificar: `src/features/payments/reconciliation.ts` e teste.
- Modificar: `src/db/schema.ts`, contrato de schema e nova migration.
- Modificar: dominio, integracao e runbook de banco.

- [x] Introduzir uma politica interna nomeada de valor minimo por parcela, validada contra o Sandbox antes de virar bloqueio rigido.
- [x] Calcular `maxInstallmentCount` efetivo sem alterar o default comercial de ate 3x e sem afirmar controle de juros indisponivel no Checkout.
- [x] Mostrar no Admin quando o preco reduzir o maximo efetivo.
- [x] RED: provar contagem separada de transacoes inseridas e atualizadas na importacao.
- [x] Substituir upserts unitarios por lotes transacionais com cursor retomavel e resultado estruturado.
- [x] Provar retomada depois de falha parcial sem duplicacao.
- [x] Auditar dados existentes antes de criar checks de valor nao negativo e consistencia entre status/evidencia.
- [x] Criar migration aditiva e validavel; nunca apagar dados para satisfazer constraint.
- [x] Executar `bun run db:migrations:check`, testes de schema, pagamentos e docs.

## Fase 7: limpeza arquitetural e documentacao

**Arquivos principais:**

- Remover ou absorver: `src/features/payments/financial-policy.ts` e teste.
- Modificar: `README.md`, `PRODUCT.md` apenas se houver regra afetada, `docs/README.md`, guias de comercio/identidade, ADR-0005, integracao Asaas e runbooks relacionados.

- [x] Confirmar por busca que funcoes de `financial-policy.ts` continuam usadas apenas pelo proprio teste.
- [x] Mover o tipo ainda necessario para o modulo financeiro autoritativo e remover codigo/teste morto.
- [x] Reconciliar afirmacoes conflitantes sobre migrations, homologacao, staging e production.
- [x] Remover referencia historica a segredo de webhook exposto e registrar somente a obrigacao de rotacao, se ainda aplicavel. A busca nao encontrou referencia canonica a exposicao do token do webhook; a rotacao documentada do token ngrok permanece por ser outro segredo.
- [x] Atualizar `last_verified_commit` somente para commits existentes; antes de commit, manter o hash-base e declarar alteracoes locais em execucao.
- [x] Executar busca por regras duplicadas e `bun run docs:check`.

## Fase 8: verificacao e auditoria final

- [x] Executar todos os testes focados introduzidos em cada fase: 550 testes em 37 arquivos passaram antes da verificacao global.
- [x] Executar `bun run verify:quick`: migrations validas, typecheck sem erros, Ultracite em 655 arquivos e 1.466 testes em 228 arquivos.
- [x] Executar `bun audit --production`: nenhuma vulnerabilidade encontrada.
- [x] Executar `bun run knip` com ambiente E2E valido; se exceder o limite, registrar bloqueio e executar buscas direcionadas equivalentes. A execucao integral excedeu 124 segundos e a variante de producao nao carregou `playwright.config.ts` sem `E2E_DATABASE_URL`; buscas direcionadas confirmaram a remocao completa de `financial-policy` e o uso de todos os novos exports.
- [x] Auditar cada requisito deste documento contra codigo, testes, migration e documentacao atuais.
- [x] Confirmar que nenhum segredo, fixture de producao ou PII foi adicionado. A busca do diff encontrou apenas senhas ficticias em testes.
- [x] Registrar arquivos alterados, comandos, resultados decisivos e riscos residuais.
- [x] Marcar esta fase e o plano como concluidos somente quando toda evidencia estiver presente.

### Evidencia final

- Superficies alteradas: nucleo financeiro autoritativo, webhook e conciliacao Asaas, recuperacao de checkout, reembolsos e revisoes, observabilidade, configuracao administrativa, schema/migration e documentacao canonica.
- Comandos decisivos: testes focados, `bun run verify:quick`, `bun audit --production`, `bun run docs:check`, `git diff --check` e buscas direcionadas de referencias/segredos.
- Resultado: todos os gates funcionais, de tipos, estilo, migration, documentacao e dependencias passaram; `git diff --check` encontrou apenas avisos de normalizacao LF/CRLF, sem erro de whitespace.
- Promocao confirmada: a migration `0054_payments_hardening.sql` foi validada em branch temporaria e aplicada a Development, Staging e Production; os tres alvos possuem 55 entradas, hash e objetos criticos identicos. Production recebeu backup dedicado antes da escrita.
- Politica revisada: o piso interno de cobranca e de cada parcela e R$ 10,00. A recusa anterior de 3x de R$ 6,63 foi explicada pela configuracao de minimo por parcela da conta Asaas, nao por limite universal da API.
- Limite de ferramenta: o Knip integral nao concluiu no limite e a verificacao direcionada dependeu de buscas estaticas; isso nao bloqueia os gates funcionais, mas deve ser reexecutado quando o ambiente E2E estiver disponivel.
- O deploy de Staging permanece responsabilidade do workflow protegido disparado pelo push da branch `staging`; Production nao foi deployada e continua em manutencao.

## Cenarios de aceitacao obrigatorios

1. Suporte nao resolve nenhuma revisao que altere dinheiro, pedido ou acesso.
2. Admin resolve somente combinacoes de revisao explicitamente implementadas.
3. Pagamento confirmado recuperado por conciliacao concede exatamente o mesmo acesso que o webhook.
4. Refund, chargeback e disputa prevalecem sobre pagamento confirmado e revogam acesso de forma idempotente.
5. Checkout incerto converge por consulta; nunca por nova criacao automatica.
6. Reembolso incerto exige consulta antes de qualquer repeticao externa.
7. Falha temporaria do Asaas nao impede bloqueio conservador de evento adverso ja correlacionado.
8. Parcelamento configurado nunca promete ao comprador mais parcelas que a politica efetiva permite.
9. Importacao de extrato pode retomar depois de falha sem duplicar transacoes.
10. Alertas operacionais surgem antes de o backlog atingir a janela critica do Asaas.
