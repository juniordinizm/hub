---
status: canonical
owner: product
last_verified_commit: 19a268ca8b72bd8c2ac6875bfe68ca9f4ed7f18b
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

**Estado:** aprovado e implementado parcialmente.

Resend envia redefinição, acesso, aviso de expiração, Certificado e suporte por `sendTransactionalEmail`. O comportamento substitui a antiga simulação por log.

Certificado, acesso de Conta já ativada e avisos de expiração usam outbox, payload sem PII,
idempotency key Resend, cinco tentativas e dead letter. A deduplicação do provedor dura 24 horas;
reprocessamento posterior exige decisão manual devido ao risco de duplicidade.

Recuperação/ativação por senha permanece fora da outbox: o callback do Better Auth recebe URL com
token secreto que não pode ser persistido. O contrato e o runbook estão em
[Outbox e efeitos transacionais](operations/outbox-and-transactional-effects.md).

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

**Estado:** aprovado; implementação pendente.

Aula pode ser concluída manualmente ou por vídeo JMVStream em 98%; Curso conclui quando todas as Aulas obrigatórias da Versão de Curso vinculada estão concluídas.

**D3 ratificada em 2026-07-21:** toda Aula obrigatória pode ser concluída manualmente pela Aluna, sem mínimo de visualização. Para Aula de vídeo JMVStream, evento válido com 98% ou mais também conclui automaticamente. Aulas opcionais não entram no denominador. Certificado prova Conclusão curricular, não domínio do conteúdo.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-005

**Tema:** coortes e versões de conteúdo.

**Estado:** aprovado; implementação pendente.

Não existem coortes. Ativar, ordenar ou remover conteúdo altera a grade vigente para todas as Alunas elegíveis.

**D1 ratificada em 2026-07-21:** `Course` é a identidade comercial. Cada publicação cria uma `CourseVersion` imutável, à qual a Matrícula será vinculada. O Hub não manterá conteúdo vivo para Matrículas existentes nem duplicará o currículo como snapshot por Matrícula.

**D2 ratificada em 2026-07-21:** uma nova versão atende somente novas Matrículas. A migração de Alunas ou coortes existentes é opcional, auditada e explícita. Uma Aluna já concluída não perde sua Conclusão nem seu Certificado.

**D4 ratificada em 2026-07-21:** coortes e `DripRule` não serão modelados agora. A ausência de calendário ou grupo real torna essa modelagem prematura; quando necessários, permanecerão separados de Concessão de acesso e Matrícula.

**D5 ratificada em 2026-07-21:** correção editorial compatível pode integrar a mesma Versão de Curso com auditoria. Mudança de objetivo pedagógico, ordem obrigatória ou regra de Conclusão exige nova Versão de Curso.

O contrato aprovado está detalhado em [ADR-0007](adr/0007-course-versioning-and-enrollment-curriculum.md). Coorte e `DripRule` permanecem fora do modelo até existir calendário ou grupo real.

**Decidir:** conteúdo por data de compra/coorte, política de migração e efeito no progresso/Certificado.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-006

**Tema:** lifecycle de Certificados.

**Estado:** aprovado; implementação em andamento.

Certificados têm snapshots, código público, estado válido/revogado e reemissão. Proposta formal em [ADR-0006](adr/0006-certificate-lifecycle.md).

**Decidido em 2026-07-20:** certificado revogado bloqueia emissão automática; somente a
reemissão manual pode criar um novo certificado válido.

**Decidido em 2026-07-21:** Admin e Suporte podem emitir, revogar e reemitir. Toda operação exige confirmação e motivo. As categorias são correção de identidade, correção do snapshot do curso, duplicidade ou falha técnica, correção de elegibilidade, revisão de integridade, obrigação legal/conformidade e outro motivo documentado.

O verificador público de Certificado revogado mostra o estado, a data e a categoria legível do motivo. O detalhe interno, autoria e evidências não são públicos. Download anterior não pode ser recolhido.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-007

**Tema:** identidade, verificação e recuperação.

**Estado:** parcial e pendente.

Cadastro público está fechado; Conta pode surgir do fluxo de compra; recuperação envia e-mail e revoga sessões. Não há fluxo obrigatório de verificação de e-mail documentado como política.

**Decidir:** vínculo quando Compradora e Aluna diferem, prova de posse do e-mail, duplicidade prévia e atendimento de Conta sem acesso.

**Decisão:** Seguir a com o melhor para o projeto

## DEC-DISC-008

**Tema:** retenção, privacidade e acessibilidade.

**Estado:** procedimento operacional aprovado; política jurídica de anonimização pendente.

Há solicitações de privacidade, aprovação, anonimização controlada, retenção opt-in de dados técnicos e práticas de interface no código. Isso não constitui aprovação jurídica nem auditoria completa de acessibilidade.

**Decidido em 2026-07-21:** Admin ou Suporte pode registrar uma solicitação. Somente Admin aprova; outro Admin executa. Solicitante, aprovador e executor devem ser pessoas distintas. A medida impede que uma pessoa aprove ou execute o próprio pedido e cria uma revisão humana antes da operação irreversível.

Anonimização permanece bloqueada até uma referência jurídica formal ser registrada e ratificada. Enquanto isso, solicitações podem ser registradas e analisadas, mas não executadas. Ledger financeiro e evidências necessárias para auditoria/defesa não são apagados por esse fluxo.

**Pendente jurídico:** base legal, prazos por categoria, exceções financeiras, campos exatos da anonimização, referência formal de aprovação e padrão/teste de acessibilidade.

**Decisão:** Seguir a com o melhor para o projeto

## Outras ratificações necessárias

- escopo definitivo de `support`;
- política de reversão de ajustes encadeados;
- confiabilidade banco + e-mail sem outbox;
- critérios de incidente e SLOs;
- uso de provedores externos. Racional histórico não localizado.
