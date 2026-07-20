---
status: canonical
owner: product
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Registro de decisões de produto

## Como ler

- **Implementado:** comprovado no `HEAD`.
- **Aprovado:** trade-off registrado em ADR aceito.
- **Aguardando ratificação:** código escolheu uma política sem evidência de aprovação.
- **Pendente:** ainda não há resposta suficiente.

Implementação não promove uma política a “aprovada”.

## DEC-DISC-001

**Tema:** entrega de e-mail.

**Estado:** parcialmente implementado; confiabilidade pendente.

Resend envia redefinição, acesso, aviso de expiração, Certificado e suporte por `sendTransactionalEmail`. O comportamento substitui a antiga simulação por log.

**Aguardando decisão:** exigência de outbox, idempotency key, retentativa e alertas. A API oficial da Resend suporta chave idempotente por 24 horas; o código atual não a usa.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-002

**Tema:** precedência financeira.

**Estado:** implementação aguardando ratificação.

`resolveAbacatePayOrderStatus` e `getAbacatePayOrderTransition` impedem sobrescrita silenciosa de estado terminal; conflito cria revisão manual.

**Ratificar:** matriz exata entre `paid`, `refunded`, `disputed` e `cancelled`, incluindo eventos fora de ordem. Proposta em [ADR-0005](adr/0005-financial-precedence-and-manual-review.md).

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-003

**Tema:** divergência de valor.

**Estado:** implementação aguardando ratificação.

Pagamento cujo valor não corresponde ao snapshot gera revisão `amount_mismatch` e não libera acesso automaticamente.

**Ratificar:** tolerância zero versus arredondamento, autoridade para aprovar e efeito da aprovação.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-004

**Tema:** conclusão de Aula e Curso.

**Estado:** implementação aguardando ratificação pedagógica.

Aula pode ser concluída manualmente ou por vídeo JMVStream em 98%; Curso conclui quando todas as Aulas ativas estão concluídas.

**Decidir:** se o botão manual permanece, limiar por tipo de Aula, efeito de conteúdo adicionado e regra para Curso vazio.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-005

**Tema:** coortes e versões de conteúdo.

**Estado:** pendente real.

Não existem coortes. Ativar, ordenar ou remover conteúdo altera a grade vigente para todas as Alunas elegíveis.

**Decidir:** conteúdo por data de compra/coorte, política de migração e efeito no progresso/Certificado.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-006

**Tema:** lifecycle de Certificados.

**Estado:** implementação aguardando ratificação.

Certificados têm snapshots, código público, estado válido/revogado e reemissão. Proposta formal em [ADR-0006](adr/0006-certificate-lifecycle.md).

**Ratificar:** motivos permitidos, autoridade de Suporte, informação pública e efeito de mudança posterior no nome/carga horária.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-007

**Tema:** identidade, verificação e recuperação.

**Estado:** parcial e pendente.

Cadastro público está fechado; Conta pode surgir do fluxo de compra; recuperação envia e-mail e revoga sessões. Não há fluxo obrigatório de verificação de e-mail documentado como política.

**Decidir:** vínculo quando Compradora e Aluna diferem, prova de posse do e-mail, duplicidade prévia e atendimento de Conta sem acesso.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-008

**Tema:** retenção, privacidade e acessibilidade.

**Estado:** implementação parcial; política pendente.

Há solicitações de privacidade, aprovação, anonimização controlada, retenção opt-in de dados técnicos e práticas de interface no código. Isso não constitui aprovação jurídica nem auditoria completa de acessibilidade.

**Decidir:** base legal, prazos por categoria, exceções financeiras, conteúdo da anonimização, autoridade final e padrão/teste de acessibilidade.

**Decisão:** Seguir a com o melhor para o projeto

## Outras ratificações necessárias

- escopo definitivo de `support`;
- política de reversão de ajustes encadeados;
- confiabilidade banco + e-mail sem outbox;
- critérios de incidente e SLOs;
- uso de provedores externos. Racional histórico não localizado.
