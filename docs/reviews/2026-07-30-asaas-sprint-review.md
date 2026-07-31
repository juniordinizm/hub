---
status: open
owner: engineering
last_verified_commit: 384db5ad9bca03ff5723f6c7e2602c80d9e0755c
---

# Revisão pós-sprint da migração Asaas

## Escopo e método

Revisão do diff `d64fc66bdf049fbe7da782a4cd705e60c82ea4bc...384db5a`,
incluindo plano original, especificação de corte, schema e migrations `0044` a `0051`,
checkout autenticado/público, adapter, inbox/worker/processor, identidade, acesso,
reembolso, conciliação, administração, ambiente, observabilidade, documentação e testes.

Fatos do código, contrato oficial do Asaas, evidência Sandbox e inferências de produto
foram mantidos separados. O parcelamento e a compra anterior à credencial são decisões
posteriores: entram no backlog sem reescrever o aceite histórico do sprint.

Decisões posteriores à fotografia revisada estão registradas em `DEC-DISC-007`: a jornada
pública usará handoff sem formulário, identidade consultada no Asaas após evento
autoritativo e Revisão sem acesso para Conta de equipe. Esses itens foram implementados em
código depois desta fotografia; E2E PostgreSQL, Sandbox pós-mudança e corte continuam
pendentes e não alteram os achados históricos abaixo.

## Veredito

**Núcleo técnico Asaas: aprovado com ressalvas. Migração completa: não aprovada.
Production: bloqueada.**

| Objetivo | Estado | Evidência |
| --- | --- | --- |
| Remover produto remoto do Curso | Concluído | Item inline e coluna removida no schema novo |
| Checkout hospedado PIX/cartão à vista | Concluído em código/Sandbox | PIX e cartão reais confirmados |
| Inbox, idempotência, worker e precedência | Concluído em código/Sandbox | retries, duplicatas e ordem adversa exercitados |
| Concessão, Matrícula e ativação | Concluído no backend | efeitos transacionais e outbox |
| Compra pública | Concluída em código | Link estável, handoff, identidade pós-evento e Revisão sem acesso; E2E/Sandbox pendentes |
| Reembolso e conciliação | Concluído em código/Sandbox | correlação do reembolso corrigida e mutações restritas a Admin |
| Corte direto e revogação do AbacatePay | Não concluído | Production em `0043`, sem deploy/corte/estabilização |
| Parcelamento por Curso | Não iniciado | requisito pós-sprint; modelo atual é incompatível |

## Achados prioritários

### P1

1. **Webhook AbacatePay executável após coluna removida.** A rota
   `src/app/api/webhooks/abacatepay/route.ts` continua chamando
   `processAbacatePayWebhook`. Esse serviço consulta
   `courses.payment_provider_product_id`, mas `0044_asaas_commerce_persistence.sql`
   remove a coluna. Retry legado após a migration falharia em runtime. Desativar com
   kill switch/retorno terminal ou remover antes do DDL.

2. **Release A e Release B foram combinadas.** O desenho aprovado exige contenção
   compatível com `0043` em release independente. O commit `384db5a` mistura contenção,
   migrations, adapter, cleanup e módulo Asaas. O procedimento de corte não é executável
   com segurança a partir desse histórico até as releases serem separadas.

3. **Remediado na Release B: a compra pública agora é uma jornada do produto.**
   `/comprar/[slug]` inicia uma única tentativa por `POST`, sem formulário local, e retorna
   cancelamento/expiração ao link estável. A landing page continua em outro repositório.

4. **O corte não ocorreu.** Production permanece no schema `0043`, sem credenciais,
   webhook, migrations, smoke real, revogação AbacatePay e observação de 14 dias. Isso é
   gate externo conhecido, não regressão do código, mas impede encerrar o objetivo de
   substituição do gateway.

### P2

1. **Corrigido na Release B: capacidade de leitura autorizava mutações financeiras.**
   `reconcileAsaasPaymentAction` e `importAsaasStatementAction` agora exigem
   `manageFinancialOperations`, concedida somente a Admin. `viewFinancials` permanece
   leitura e resolução ordinária de Revisões. Os controles mutáveis também não são
   renderizados para Suporte; a proteção autoritativa permanece no servidor.

2. **Corrigido na Release B: reembolso normal apresentava resultado incerto.** O
   `requestFullRefund` reserva `provider_checkout_id` e aceita
   `externalReference=null` somente com pagamento e sessão exatos, nenhum identificador
   presente conflitante e evidência de reembolso integral.

3. **Falha de checkout autenticado não tem UX tratada.**
   `startCourseCheckoutAction` lança `Error` quando o provider rejeita. O formulário não
   usa estado de action nem mensagem inline; em Development isso já apareceu como Runtime
   Error. Retornar resultado discriminado e preservar a tentativa.

4. **Preflight não relaciona modo de checkout e credenciais Asaas.** Production aceita
   todas as variáveis Asaas ausentes para a Release A, mas também aceita
   `PAYMENTS_CHECKOUT_MODE=authenticated|public` sem elas. O deploy inicia e falha apenas
   quando alguém compra. Ausência só deve ser válida com checkout e webhook desativados.

5. **Remediado na Release B: vínculo público falha fechado.**
   `resolveLocalOrderIdentity` verifica papel, bloqueio geral e revogação no Curso.
   Colisão abre Revisão sem acesso, resolvida somente por reembolso integral confirmado.

6. **Corrigido na Release B: Checkout `uncertain` não entrava no backlog operacional.**
   `getOperationalBacklogSnapshot` agora conta `checkout_status='uncertain'`; a tela de
   auditoria inclui essa contagem no total financeiro e a exibe separadamente.

7. **Testes de UI por texto-fonte.** `checkout-ui-contract.test.ts` e
   `course-price-fields.test.ts` leem arquivos e procuram strings. Isso não prova
   renderização, acessibilidade ou comportamento; substituir por componente/E2E.

8. **Documentação canônica estava divergente.** Produto, arquitetura, decisões e domínio
   ainda descreviam AbacatePay, processor pendente, 39 tabelas e topo `0049`. A revisão
   corrigiu os contratos principais e incluiu o guia Asaas no `docs:check`.

### P3

1. `importAsaasFinancialStatement` conta toda linha retornada pelo upsert como
   “importada”; a UI chama o resultado de “movimentações conciliadas”, embora não exista
   correlação com Pedido. Renomear para processadas/importadas e distinguir insert/update.
2. `checkout.ts` repete a projeção SQL completa de Pedido em três releituras. Centralizar
   leitura e mapeamento reduz risco ao adicionar snapshots.
3. `asaas-webhook-processor.ts` concentra correlação, SQL, Revisão, identidade, acesso,
   outbox e reembolso em cerca de 960 linhas. Extrair persistência/correlação mantendo
   orquestrador e transação explícitos.
4. A importação de extrato persiste páginas parcialmente antes da auditoria final. A
   reexecução é idempotente, mas falha intermediária não deixa registro da tentativa.

## Parcelamento: impacto obrigatório

O Asaas Checkout permite métodos e `maxInstallmentCount`, mas cada parcela possui ID de
pagamento próprio e gera eventos próprios. O Hub hoje possui:

- um `provider_payment_id` por Pedido;
- comparação de cada `payment.value` com o total do Pedido;
- uma única evidência de método, líquido e tarifa;
- reembolso via `/payments/{id}/refund`.

Adicionar `INSTALLMENT` agora causaria divergência de valor, conflito entre IDs e risco de
reembolsar apenas uma parcela. A evolução precisa:

1. configuração tipada por Curso e checks no banco;
2. snapshot da oferta no Pedido;
3. agregado de parcelamento com `provider_installment_id` e pagamentos/parcelas filhos;
4. regra de concessão baseada no evento correto, validada no Sandbox;
5. reconciliação e totalização de bruto, líquido, taxa e recebíveis;
6. reembolso integral via operação de parcelamento;
7. prova de Pix + cartão + parcelamento no mesmo Checkout;
8. decisão financeira para juros, porque o Checkout não os configura por API.

O padrão desejado de até 3x com juros permanece em “pendente de viabilidade”. O campo
`interest` do Asaas é juros por atraso e não pode ser reutilizado.

## Compra antes da Conta

O backend já converge pelo e-mail local após pagamento:

1. Pedido público nasce sem `user_id`;
2. pagamento autoritativo procura Conta pelo e-mail normalizado;
3. se não existir, cria Conta com `email_verified=false` e Perfil de Aluna;
4. vincula Pedido, cria Concessão/Matrícula e enfileira ativação;
5. a pessoa define senha pelo fluxo de ativação.

Isso satisfaz “comprar antes de criar credencial”, mas não um cadastro posterior
independente. A documentação agora usa o termo correto. Superfície pública e regra para
colisão com Conta de equipe foram desenhadas depois desta revisão e, na fotografia
histórica, ainda precisavam ser implementadas. Hoje estão implementadas em código; a prova
E2E PostgreSQL, o Sandbox pós-mudança e o corte continuam pendentes.

## Ordem recomendada de correção

1. Corrigir os P1 e os P2 de autorização, ambiente, reembolso e erro de checkout.
2. Extrair/versionar Release A isolada e validar seu diff contra `0043`.
3. Construir e testar a jornada pública completa.
4. Executar Release A, backup/cleanup, Release B, smoke e corte conforme runbook.
5. Observar 14 dias e só então remover resíduos AbacatePay.
6. Abrir sprint separado para oferta por Curso e parcelamento.

## Eixo Standards

- **[P2 corrigido] Autorização de escrita usava capacidade de leitura.** Conciliação e
  importação de extrato agora exigem `manageFinancialOperations`, exclusiva de Admin.
- **[P2] Documentação canônica contradizia o HEAD.** Contagens, agenda e estados de
  implementação estavam desatualizados.
- **[P2] Testes novos de UI inspecionam strings do source.** Migrar para comportamento.
- **[P3] Duplicated Code/Data Clumps.** `checkout.ts` repete a projeção completa de Pedido.
- **[P3] Divergent Change.** O processor Asaas concentra responsabilidades demais.

Nenhum P0/P1 de Standards foi identificado.

## Eixo Spec

- **[P1] Corte e critérios finais de aceite incompletos.** O núcleo anterior ao novo
  handoff foi comprovado localmente e no Sandbox. A jornada pública nova ainda aguarda E2E
  PostgreSQL e Sandbox pós-mudança; a substituição operacional também não ocorreu.
- **[P1] Fronteira Release A/Release B ausente no histórico.**
- **[P1] Endpoint AbacatePay incompatível com a migration `0044`.**
- **[P2] Documentação canônica contradizia o HEAD.**

Não houve scope creep material: cleanup, contenção, ambiente e E2E estavam nos planos ou
eram necessários aos gates. Parcelamento configurável é backlog legítimo e não falha
retroativa do sprint.

## Verificação

- correções financeiras da Release B: 5 arquivos e 33 testes focais aprovados;
- `bunx vitest run src/features/payments src/features/operations
  src/lib/auth-policy.test.ts src/app/(admin)/admin/auditoria/page.test.tsx`:
  28 arquivos e 320 testes aprovados;
- `bun run typecheck`, `bun run check`, `bun run docs:check` e `git diff --check`
  aprovados após as correções;
- a evidência anterior do mesmo commit registra `bun run verify` com 201 arquivos e
  1.083 testes, 27 testes PostgreSQL e 19 jornadas Playwright aprovadas;
