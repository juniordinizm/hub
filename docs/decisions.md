---
status: canonical
owner: product
last_verified_commit: ba883f14af8d8587b5eb0aec75e3969fa937ffcd
---

# Registro de decisões de produto

## Como ler

- **Implementado:** comprovado no `HEAD`.
- **Aprovado:** trade-off ratificado em ADR aceito ou decisão explícita registrada neste
  documento.
- **Aguardando ratificação:** código escolheu política sem aprovação documentada.
- **Pendente:** ainda não há resposta suficiente.

Implementação não promove política a aprovada sozinha.

## DEC-DISC-001

**Tema:** entrega de e-mail.
**Estado:** factory, parser e delivery implementados; enfileiramento Asaas pendente.

A intenção durável de ativação guarda somente `userId` e `orderId`, sem outros dados
pessoais, token ou URL de callback. No processamento, o worker resolve a Conta e chama Better Auth
`requestPasswordReset`; o token nasce somente durante o envio. Falha de resolução ou
entrega mantém a intenção elegível para retry, sem persistir o token.

`auth.account-activation` implementa a intenção sem PII e resolve os dados no delivery. O
processor financeiro Asaas que escolherá e enfileirará essa intenção permanece pendente.
O fluxo legado AbacatePay continua fora da outbox. Os demais e-mails transacionais mantêm
o contrato descrito em [Outbox e efeitos transacionais](operations/outbox-and-transactional-effects.md).

## DEC-DISC-002

**Tema:** precedência financeira.
**Estado:** aprovado; matriz pura Asaas implementada, efeitos persistentes pendentes.

`CHECKOUT_PAID` não libera. PIX libera em `PAYMENT_RECEIVED`; cartão libera em
`PAYMENT_CONFIRMED` quando não há risco pendente ou reprovado. Aprovação posterior pode
destravar confirmação armazenada. Reembolso confirmado, disputa e chargeback
prevalecem e revogam. Pago tardio não reativa estado adverso; cancelamento ou expiração
tardios não revogam Pedido pago. Evento parcial, desconhecido, regressivo ou contraditório
abre revisão ou alerta. Ver
[ADR-0005](adr/0005-financial-precedence-and-manual-review.md).

`decideAsaasFinancialEvent`, em `src/features/payments/asaas-financial-events.ts`,
materializa a matriz como decisão pura, sem SQL ou efeitos de acesso. O processor
transacional que aplicará a decisão permanece pendente.

## DEC-DISC-003

**Tema:** divergência de valor.
**Estado:** aprovado; comparação pura Asaas implementada, revisão persistente pendente.

O valor bruto Asaas `value` deve coincidir exatamente com o snapshot do Pedido em
centavos, com tolerância zero. Divergência não libera acesso e abre revisão. Decisão manual
exige permissão, motivo e auditoria. A comparação e o código seguro da revisão são
produzidos por `decideAsaasFinancialEvent`; a criação e decisão persistente da Revisão
permanecem pendentes.

## DEC-DISC-004

**Tema:** conclusão de Aula e Curso.
**Estado:** aprovado e implementado.

Toda Aula obrigatória pode ser concluída manualmente sem mínimo de visualização. Evento JMVStream válido em 98% ou mais também conclui automaticamente. Curso conclui quando todas as Aulas obrigatórias da publicação vigente estão concluídas; opcionais não entram no denominador. Certificado prova conclusão histórica, não domínio de conteúdo nem currículo vivo atual.

## DEC-DISC-005

**Tema:** coortes e versões de conteúdo.
**Estado:** aprovado e implementado.

`Course` é identidade comercial; `CoursePublication` é revisão interna em lote. Matrícula ativa sempre recebe a publicação vigente; Curso novo e refilmado é novo produto e nova compra/concessão. A primeira conclusão é histórica por Aluna + Curso; certificado permanece válido após atualização de conteúdo e não é reemitido automaticamente. Não há coorte nem `DripRule` até existir calendário ou grupo real. Ver [ADR-0007](adr/0007-course-versioning-and-enrollment-curriculum.md).

## DEC-DISC-006

**Tema:** ciclo de Certificados.
**Estado:** aprovado e implementado.

Certificado tem snapshots, código público, estado válido/revogado e reemissão. Revogado bloqueia emissão automática; somente reemissão manual cria novo válido. Admin e Suporte podem emitir, revogar e reemitir com confirmação e motivo: correção de identidade, snapshot de Curso, duplicidade/falha técnica, elegibilidade, integridade, obrigação legal/conformidade ou outro motivo documentado. O verificador público mostra status, data e categoria legível; não expõe detalhes internos. Ver [ADR-0006](adr/0006-certificate-lifecycle.md).

## DEC-DISC-007

**Tema:** identidade, verificação e recuperação.
**Estado:** resolução local implementada; integração com processor Asaas pendente.

No checkout autenticado, a Conta é a da sessão; o provider não pode alterar nome, e-mail,
verificação ou credenciais. No checkout público, o Hub captura nome e e-mail localmente
antes do redirect e registra Compradora = Aluna. Uma Conta nova não é considerada
verificada pelo provider. Uma Conta existente não é sobrescrita pelos dados do checkout.
Compra como presente ou para terceiro fica fora do escopo.

`resolveLocalOrderIdentity` implementa o vínculo local seguro para Pedido já bloqueado,
sem confiar no provider. O processor Asaas ainda não chama esse módulo. O fluxo
AbacatePay atual permanece apenas como evidência legada.

## DEC-DISC-008

**Tema:** retenção, privacidade e acessibilidade.
**Estado:** manutenção técnica implementada; política jurídica de dados pendente.

O workflow de solicitações e anonimização foi removido: não havia solicitante, operação administrativa recorrente ou plano aprovado. O cron de manutenção preserva apenas limpeza técnica de sessões, rate limits e analytics. Se houver pedido real no futuro, será necessário definir política jurídica, fluxo e auditoria antes de criar nova funcionalidade. Ledger financeiro e evidências necessárias para auditoria/defesa não devem ser apagados por atalho.

## DEC-DISC-009

**Tema:** analytics de aprendizagem padrão com opt-out.
**Estado:** aprovado e implementado, condicionado à ratificação jurídica antes da produção.

Para a plataforma pequena atual, analytics técnico minimizado fica habilitado por padrão, sem modal, consentimento ou área dedicada. A Aluna tem controle claro em **Conta > Configurações** para desligar análises opcionais. Desativar remove eventos brutos identificáveis, bloqueia eventos futuros e exclui a Aluna das consultas analíticas; não altera acesso, sequência, progresso, conclusão ou Certificado.

Admin vê somente métricas agregadas por Aula e `CoursePublication`. Não há lista nominal de inatividade, reengajamento manual, contato automático ou CRM analítico. Retenção é 90 dias para eventos brutos e 13 meses para métricas agregadas. Ver [ADR-0008](adr/0008-optional-learning-analytics.md).

Esta decisão de produto não prova base legal ou conformidade LGPD. Antes da ativação em produção, é obrigatória ratificação jurídica da base legal, transparência, prazos e canal de direitos aplicáveis.

## DEC-DISC-010

**Tema:** preço mínimo de Curso pago.
**Estado:** aprovado; implementação pendente.

Curso pago custa no mínimo `1000` centavos, equivalentes a R$ 10. A autoria valida o
limite ao criar ou editar o Curso, e o checkout repete a validação antes de persistir o
Pedido ou chamar o provider. Dados de teste abaixo desse mínimo devem ser ajustados ou
removidos.

Em 2026-07-28, o sandbox Asaas rejeitou uma tentativa de R$ 1 com `invalid_object` e
mínimo de R$ 10. Essa evidência ratifica o limite externo observado, mas não prova a
implementação no Hub. Ver
[Comércio e acesso](domain/commerce-and-access.md#reg-com-001-pedido-preserva-o-contrato-vendido)
e [Asaas](integrations/asaas.md).

## Outras ratificações necessárias

- escopo definitivo de `support`;
- política de reversão de ajustes encadeados;
- confiabilidade banco e e-mail sem outbox;
- critérios de incidente e SLOs;
- uso de provedores externos; racional histórico não localizado.
