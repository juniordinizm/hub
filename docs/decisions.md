---
status: canonical
owner: product
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Registro de decisões de produto

## Como ler

- **Implementado:** comprovado no `HEAD`.
- **Aprovado:** trade-off registrado em ADR aceito.
- **Aguardando ratificação:** código escolheu política sem aprovação documentada.
- **Pendente:** ainda não há resposta suficiente.

Implementação não promove política a aprovada sozinha.

## DEC-DISC-001

**Tema:** entrega de e-mail.
**Estado:** aprovado e implementado parcialmente.

Resend envia redefinição, acesso, expiração, Certificado e suporte por `sendTransactionalEmail`. Certificado, acesso de Conta já ativada e expiração usam outbox sem PII, chave de idempotência Resend, cinco tentativas e dead letter. Recuperação/ativação por senha fica fora da outbox porque a callback URL contém token secreto. Ver [Outbox e efeitos transacionais](operations/outbox-and-transactional-effects.md).

## DEC-DISC-002

**Tema:** precedência financeira.
**Estado:** implementação aguardando ratificação.

`resolveAbacatePayOrderStatus` e `getAbacatePayOrderTransition` impedem sobrescrita silenciosa de estado terminal; conflito cria revisão manual. Falta ratificar matriz entre `paid`, `refunded`, `disputed` e `cancelled`. Proposta: [ADR-0005](adr/0005-financial-precedence-and-manual-review.md).

## DEC-DISC-003

**Tema:** divergência de valor.
**Estado:** implementação aguardando ratificação.

Pagamento diferente do snapshot gera revisão `amount_mismatch` e não libera acesso automaticamente. Falta decidir tolerância de arredondamento, autoridade e efeito da aprovação.

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
**Estado:** parcial e pendente.

Cadastro público é fechado; Conta pode nascer da compra; recuperação envia e-mail e revoga sessões. Falta decidir vínculo entre Compradora e Aluna, prova de posse do e-mail, duplicidade e atendimento de Conta sem acesso.

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

## Outras ratificações necessárias

- escopo definitivo de `support`;
- política de reversão de ajustes encadeados;
- confiabilidade banco e e-mail sem outbox;
- critérios de incidente e SLOs;
- uso de provedores externos; racional histórico não localizado.
