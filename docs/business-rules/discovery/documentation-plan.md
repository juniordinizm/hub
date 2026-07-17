> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Proposta de documentação normativa futura

Criar somente após as decisões pendentes serem registradas e aprovadas:

- `docs/business-rules/README.md`: governança, status, classificação e glossário.
- `identity-and-access.md`: contas, sessão, papéis, bloqueios, verificação e entitlement.
- `commerce-and-enrollments.md`: checkout, pedido, eventos, precedência, idempotência, grants, expiração, ajuste, refund e disputa.
- `learning-content-and-progress.md`: publicação, sequência, conclusão, duração editorial, alterações/versionamento e coortes.
- `certificates.md`: elegibilidade, emissão, correção, reemissão, validação pública e revogação.
- `operations-and-compliance.md`: auditoria, e-mail, suporte, retenção, incidente, acessibilidade e integrações.
- `decision-register.md`: decisões aprovadas, responsável, data, impacto e revisão.

Evitar documentos para organizações, multi-tenancy, assinatura SaaS ou domínios inexistentes. Os documentos acima são uma proposta, não foram criados como norma.

# Primeiro pacote de decisões do produto

## DEC-DISC-001 — Serviço de e-mail transacional

* **Pergunta:** qual provedor, entrega, retry e visibilidade operacional tornam reset, primeiro acesso, expiração, certificado e suporte operáveis?
* **Por que precisa ser decidida:** a promessa de comunicação depende de uma função que não envia.
* **Comportamento atual comprovado:** `sendTransactionalEmail` resolve sem entrega.
* **Evidências:** `src/features/email/server.ts:18-132`; [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email).
* **Contradições ou lacunas:** sem provedor, outbox, retry, alerta, retenção ou teste de entrega.
* **Opção A:** integrar provedor com outbox, chave de idempotência e monitoramento.
* **Opção B:** retirar/ocultar fluxos que prometem e-mail até a integração.
* **Opção C:** não aplicável; não há terceiro trade-off independente.
* **Opção de não implementar:** válida só se os fluxos dependentes forem removidos do produto.
* **Recomendação:** A.
* **Motivo da recomendação:** preserva recuperação de conta e comunicação prometida com efeito rastreável.
* **Vantagens:** entrega verificável, menor duplicidade, diagnóstico de falhas.
* **Desvantagens:** custo de fornecedor, segredo, operação e tratamento de dados.
* **Impacto técnico:** adaptador real, outbox/retry e métricas; sem alteração nesta fase.
* **Impacto operacional:** domínio remetente, suporte a bounces e incidentes.
* **Impacto para a aluna:** reset e avisos passam a chegar; risco de atraso precisa ser comunicado.
* **Impacto em dados existentes:** possível registro de tentativa/status, sujeito a retenção.
* **Impacto em segurança e privacidade:** credenciais server-side e contrato com fornecedor; não enviar conteúdo sensível.
* **Impacto em acessibilidade:** templates legíveis e alternativa texto.
* **Impacto financeiro:** custo por envio/plano.
* **Migração necessária:** depende da escolha de outbox; não aprovada.
* **Testes necessários:** mock de provedor, idempotência, falha/retry e fluxo de reset.
* **Reversibilidade da decisão:** média; trocar provedor exige migração operacional.
* **Custo futuro de alteração:** médio.
* **Resposta do produto:** pendente.

## DEC-DISC-002 — Precedência de eventos de pagamento e acesso

* **Pergunta:** refund, disputa ou cancelamento sempre vencem pagamento tardio e qual evento reabre acesso?
* **Por que precisa ser decidida:** a unicidade atual cobre duplicatas, não ordem de eventos diferentes.
* **Comportamento atual comprovado:** webhook é autenticado e transacional; eventos distintos podem concorrer sobre pedido/grant.
* **Evidências:** `payments/server.ts:274-472,595-745`; `schema.ts:610-667`; documentação AbacatePay de webhooks.
* **Contradições ou lacunas:** não há máquina monotônica, lock por pedido ou política explícita de disputa.
* **Opção A:** máquina de estados com precedência e serialização por pedido.
* **Opção B:** aceitar o último evento processado.
* **Opção C:** revisão manual para qualquer evento reversível.
* **Opção de não implementar:** não válida enquanto o produto concede acesso por webhook.
* **Recomendação:** A, com exceção manual auditada.
* **Motivo da recomendação:** reduz reativação indevida após refund/disputa sem bloquear toda operação.
* **Vantagens:** integridade financeira e comportamento explicável.
* **Desvantagens:** maior complexidade de transação, suporte e reconciliação.
* **Impacto técnico:** estado, lock/ordem, logs e testes concorrentes.
* **Impacto operacional:** playbook para divergência e reprocessamento.
* **Impacto para a aluna:** acesso não oscila silenciosamente.
* **Impacto em dados existentes:** reconciliação de pedidos/grants pode ser necessária.
* **Impacto em segurança e privacidade:** reduz acesso não autorizado; sem novo PII necessário.
* **Impacto em acessibilidade:** não aplicável: regra de domínio sem UI obrigatória.
* **Impacto financeiro:** evita concessão/revogação indevida; custo de manutenção.
* **Migração necessária:** provável se persistir precedência/estado.
* **Testes necessários:** duplicata, fora de ordem, concorrência, retry e refund.
* **Reversibilidade da decisão:** média; histórico de estados precisa permanecer interpretável.
* **Custo futuro de alteração:** alto após dados de produção.
* **Resposta do produto:** pendente.

## DEC-DISC-003 — Compatibilidade de valor pago

* **Pergunta:** quando valor do webhook divergir do pedido, desconto, cupom ou preço atual, concede-se acesso?
* **Por que precisa ser decidida:** não foi localizada comparação explícita antes do grant.
* **Comportamento atual comprovado:** pedido/metadata são persistidos e usados para mapear curso.
* **Evidências:** `payments/server.ts:327-377,435-448`; `abacatepay.ts:420-432`.
* **Contradições ou lacunas:** tolerância, moeda, cupom, parcelamento e pagamento parcial não estão definidos.
* **Opção A:** exigir snapshot compatível; divergência vai para revisão auditada.
* **Opção B:** conceder por produto e apenas registrar divergência.
* **Opção C:** aceitar faixa de tolerância documentada.
* **Opção de não implementar:** válida apenas se preço não influenciar entitlement, o que contraria o modelo atual.
* **Recomendação:** A; B somente por decisão operacional explícita.
* **Motivo da recomendação:** reduz concessão financeira indevida sem ignorar exceções legítimas.
* **Vantagens:** rastreabilidade e previsibilidade.
* **Desvantagens:** revisão manual e possível atraso de acesso.
* **Impacto técnico:** snapshot imutável e validação server-side.
* **Impacto operacional:** fila/processo de divergências.
* **Impacto para a aluna:** possível status claro de pagamento em análise.
* **Impacto em dados existentes:** pedidos legados podem não ter todos os snapshots.
* **Impacto em segurança e privacidade:** protege entitlement; sem PII adicional.
* **Impacto em acessibilidade:** mensagens de erro devem ser compreensíveis.
* **Impacto financeiro:** reduz perda, aumenta custo de suporte.
* **Migração necessária:** possível backfill, após avaliação.
* **Testes necessários:** desconto, diferença de centavos, cupom, parcial e moeda.
* **Reversibilidade da decisão:** média.
* **Custo futuro de alteração:** médio.
* **Resposta do produto:** pendente.

## DEC-DISC-004 — Conclusão e desbloqueio de aulas

* **Pergunta:** clique manual, visualização mínima ou regra híbrida define conclusão e avanço?
* **Por que precisa ser decidida:** o código aceita clique manual e também 95%/fim de vídeo, sem política declarada.
* **Comportamento atual comprovado:** progresso de curso conta aulas concluídas; servidor aplica sequência.
* **Evidências:** `app/(student)/app/actions.ts:17-99`; `progress/rules.ts:23-85`; `courses/server.ts:1213-1347`.
* **Contradições ou lacunas:** não há objetivo pedagógico, exceção de acessibilidade ou política de replay definida.
* **Opção A:** clique manual é suficiente.
* **Opção B:** mínimo de visualização obrigatório.
* **Opção C:** híbrido: visualização quando houver vídeo e conclusão manual para outros formatos.
* **Opção de não implementar:** válida mantendo a regra atual, mas deixa ambiguidade material.
* **Recomendação:** escolher A ou C conforme objetivo pedagógico; não inferir B de telemetria.
* **Motivo da recomendação:** evita barreira indevida e transforma comportamento em regra explícita.
* **Vantagens:** UX previsível e certificado consistente com política.
* **Desvantagens:** A reduz evidência de consumo; C aumenta casos de borda.
* **Impacto técnico:** regras e guard server-side; não alterar nesta fase.
* **Impacto operacional:** suporte para exceções de player.
* **Impacto para a aluna:** define quando a próxima aula/certificado ficam disponíveis.
* **Impacto em dados existentes:** possível reavaliação de progresso se a regra mudar.
* **Impacto em segurança e privacidade:** telemetria de vídeo é dado comportamental; minimizar se adotada.
* **Impacto em acessibilidade:** não bloquear conclusão por mídia inacessível.
* **Impacto financeiro:** indireto, por certificação e suporte.
* **Migração necessária:** depende de reprocessamento de progresso.
* **Testes necessários:** URL direta, vídeo curto, replay, múltiplas abas e mídia indisponível.
* **Reversibilidade da decisão:** média.
* **Custo futuro de alteração:** médio/alto para certificados já emitidos.
* **Resposta do produto:** pendente.

## DEC-DISC-005 — Conteúdo publicado, duração e versionamento

* **Pergunta:** o que ocorre com progresso/certificado quando conteúdo ativo muda e quem pode alterar duração editorial?
* **Por que precisa ser decidida:** conteúdo atual determina conclusão, sem versão; action da aluna pode alterar duração.
* **Comportamento atual comprovado:** admin publica/arquiva/reordena; conjunto active atual é usado; duração aceita dado da aluna.
* **Evidências:** `admin/actions.ts:651-907,1413-1499`; `courses/server.ts:636-649,1127-1144,1350-1395`; `app/(student)/app/actions.ts:42-64`.
* **Contradições ou lacunas:** não há coorte, snapshot de conteúdo nem separação completa de autoridade editorial.
* **Opção A:** congelar a coorte na primeira matrícula.
* **Opção B:** versionar curso e migrar coortes explicitamente.
* **Opção C:** aplicar alterações retroativamente com comunicação definida.
* **Opção de não implementar:** manter efeito retroativo implícito, não recomendado.
* **Recomendação:** A para curso curto; restringir duração a fonte editorial independente da opção.
* **Motivo da recomendação:** protege histórico/certificado com custo menor que versionamento completo.
* **Vantagens:** previsibilidade e redução de manipulação.
* **Desvantagens:** manutenção de conteúdo histórico.
* **Impacto técnico:** snapshot/coorte e autorização da duração.
* **Impacto operacional:** processo de publicação/correção.
* **Impacto para a aluna:** não perde conclusão por mudança silenciosa.
* **Impacto em dados existentes:** pode exigir snapshot para matrículas vigentes.
* **Impacto em segurança e privacidade:** integridade de carga certificada; sem novo PII.
* **Impacto em acessibilidade:** alterações precisam preservar alternativa acessível.
* **Impacto financeiro:** manutenção de versões/armazenamento.
* **Migração necessária:** provável para coortes/snapshots.
* **Testes necessários:** adicionar/remover/arquivar/reordenar, duração maliciosa e certificado.
* **Reversibilidade da decisão:** baixa após certificados emitidos.
* **Custo futuro de alteração:** alto.
* **Resposta do produto:** pendente.

## DEC-DISC-006 — Certificado após reembolso, correção e exposição pública

* **Pergunta:** certificado continua válido após refund, disputa, expiração ou correção de nome, e quais dados a validação pública revela?
* **Por que precisa ser decidida:** há unicidade/snapshot, mas não lifecycle de correção/revogação nem minimização pública definida.
* **Comportamento atual comprovado:** emite certificado único, PDF e página pública por código com nome, curso, carga e data.
* **Evidências:** `schema.ts:669-694`; `certificates/server.ts:16-131`; `app/certificados/[code]/page.tsx:9-56`.
* **Contradições ou lacunas:** sem status, revogação, reemissão, rate limit ou política pós-pagamento.
* **Opção A:** validade permanente sem revogação.
* **Opção B:** status público mínimo e fluxo auditado de correção/revogação.
* **Opção C:** não emitir enquanto o pedido estiver em janela elegível a refund.
* **Opção de não implementar:** válida somente se certificados públicos forem removidos.
* **Recomendação:** B, após validação jurídica/educacional aplicável.
* **Motivo da recomendação:** permite corrigir e tratar eventos financeiros sem apagar rastreabilidade.
* **Vantagens:** confiança verificável e menor exposição desnecessária.
* **Desvantagens:** schema, suporte e regra de comunicação.
* **Impacto técnico:** status, consulta pública e PDF.
* **Impacto operacional:** atendimento e registro de motivo.
* **Impacto para a aluna:** status e correção previsíveis.
* **Impacto em dados existentes:** certificados existentes podem requerer estado inicial.
* **Impacto em segurança e privacidade:** minimizar PII público e limitar abuso de código.
* **Impacto em acessibilidade:** página/PDF de status precisam ser acessíveis.
* **Impacto financeiro:** custo de suporte e risco de reemissão.
* **Migração necessária:** provável.
* **Testes necessários:** unicidade, reemissão, refund, página pública e PDF.
* **Reversibilidade da decisão:** média; revogação não deve apagar histórico.
* **Custo futuro de alteração:** alto.
* **Resposta do produto:** pendente.

## DEC-DISC-007 — Identidade e vínculo de compra

* **Pergunta:** e-mail verificado é requisito para conta/vínculo de compra, sobretudo se cadastro público abrir?
* **Por que precisa ser decidida:** signup é fechado hoje, mas `emailVerified` não é gate; abrir sem política pode pré-vincular e-mail alheio.
* **Comportamento atual comprovado:** roles vêm de profile; reset expira em uma hora e revoga sessão; cadastro público é bloqueado por padrão.
* **Evidências:** `api/auth/[...all]/route.ts:12-29`; `auth.ts:35-69`; `session.ts:23-75`; documentação Better Auth.
* **Contradições ou lacunas:** verificação, antiabuso, conta existente e compra feita em e-mail distinto não foram definidos.
* **Opção A:** manter cadastro fechado e ativar via compra/admin.
* **Opção B:** abrir cadastro com verificação obrigatória e antiabuso.
* **Opção C:** permitir pré-cadastro sem entitlement até confirmação.
* **Opção de não implementar:** manter fechado com fluxo atual.
* **Recomendação:** A enquanto não houver e-mail real e regra atômica de vínculo.
* **Motivo da recomendação:** reduz superfície de abuso no estado atual.
* **Vantagens:** menos ambiguidade de identidade e suporte.
* **Desvantagens:** onboarding depende de fluxo operacional.
* **Impacto técnico:** pode exigir gate de verificação e vínculo transacional.
* **Impacto operacional:** procedimento de ativação/compra.
* **Impacto para a aluna:** menos autoatendimento até abertura segura.
* **Impacto em dados existentes:** revisar contas não verificadas se a política mudar.
* **Impacto em segurança e privacidade:** reduz tomada de identidade; proxy só deve ser confiado quando controlado.
* **Impacto em acessibilidade:** verificação por e-mail deve ter alternativa/feedback claro.
* **Impacto financeiro:** baixo direto; reduz fraude/suporte.
* **Migração necessária:** depende da política escolhida.
* **Testes necessários:** signup duplicado, não verificado, e-mail de compra distinto e reset.
* **Reversibilidade da decisão:** alta se não houver grants inconsistentes.
* **Custo futuro de alteração:** médio.
* **Resposta do produto:** pendente.

## DEC-DISC-008 — Privacidade, acessibilidade e suporte

* **Pergunta:** quais dados podem ir a suporte/validação pública, por quanto tempo, e qual alvo de acessibilidade/legenda/PDF será adotado?
* **Por que precisa ser decidida:** há mensagem livre e certificado público, mas sem retenção, aviso, ciclo de suporte ou avaliação WCAG.
* **Comportamento atual comprovado:** suporte encaminha mensagem por e-mail sem ticket; certificado expõe PII por código; não foram localizadas legendas/transcrições ou testes de acessibilidade.
* **Evidências:** `support-request-dialog.tsx:83-110`; `certificates/server.ts:16-52`; `schema.ts:109-730`; LGPD, ANPD e WCAG 2.2.
* **Contradições ou lacunas:** finalidade, minimização, retenção, direitos, conteúdo de saúde, SLA, teclado, leitor de tela e PDF não definidos.
* **Opção A:** minimização, aviso, ticket/auditoria, retenção aprovada e alvo WCAG 2.2.
* **Opção B:** manter comportamento atual.
* **Opção C:** desativar suporte livre e validação pública até governança definida.
* **Opção de não implementar:** válida somente se essas superfícies forem removidas.
* **Recomendação:** A, com validação especializada e escopo de acessibilidade mensurável.
* **Motivo da recomendação:** reduz exposição de PII e barreiras de uso sem inventar base legal.
* **Vantagens:** processo defensável, suporte rastreável e UX inclusiva.
* **Desvantagens:** custo jurídico, de produto e manutenção.
* **Impacto técnico:** campos limitados, ticket/outbox, retenção, componentes e testes.
* **Impacto operacional:** treinamento, resposta a incidentes e exclusão.
* **Impacto para a aluna:** aviso claro, menor exposição e melhor uso assistivo.
* **Impacto em dados existentes:** possível classificação/retenção de mensagens e certificados.
* **Impacto em segurança e privacidade:** central; requer avaliação de fornecedores.
* **Impacto em acessibilidade:** central; player, formulário, autenticação e PDF.
* **Impacto financeiro:** auditoria, fornecedor e manutenção.
* **Migração necessária:** possível, dependente da retenção aprovada.
* **Testes necessários:** teclado, leitor de tela, contraste, legenda, PDF e retenção.
* **Reversibilidade da decisão:** baixa para dados já divulgados; alta para UX futura.
* **Custo futuro de alteração:** alto.
* **Resposta do produto:** pendente.
