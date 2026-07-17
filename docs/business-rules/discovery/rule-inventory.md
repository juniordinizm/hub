> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação. IDs são provisórios.**

# Fichas de descoberta das regras materiais

Campos marcados como não aplicável indicam o motivo, não ausência de investigação.

## AUTH-DISC-001 — Cadastro fechado, sessão e RBAC

* **Domínio:** identidade e autorização.
* **Classificação:** AS-IS CONFIRMADO.
* **Confiança:** alta.
* **Severidade:** P1.
* **Ator:** visitante, student, support e admin.
* **Recurso:** conta, sessão e ações protegidas.
* **Ação:** criar sessão, acessar rotas e executar mutações autorizadas.
* **Pré-condições:** sessão Better Auth válida; profile com role; student não bloqueada.
* **Gatilho:** login, layout protegido ou Server Action.
* **Comportamento atual confirmado:** signup público é bloqueado por padrão; role vem de `profiles`, não do cookie; ações fazem gate no servidor; reset expira em uma hora e revoga sessões.
* **Comportamento atual inferido:** configuração de proxy/rate-limit depende do deploy e não foi confirmada.
* **Comportamento desejado documentado:** docs locais tratam URLs auth como obrigatórias em produção, sem prova de enforcement.
* **Comportamento negado:** support não pode mutar conteúdo, configuração ou financeiro no servidor.
* **Exceções:** preview explícito de aluno; telas podem mostrar caminho que o servidor nega.
* **Estados envolvidos:** conta, sessão, profile bloqueado.
* **Transições observadas:** sessão criada, revogada por reset, acesso negado por bloqueio/role.
* **Efeitos no banco:** users, accounts, sessions, profiles e verifications.
* **Efeitos externos:** Better Auth; e-mail de reset não é entregue pelo adaptador atual.
* **Transação:** não confirmada para todo fluxo de auth.
* **Idempotência:** não aplicável a login; duplicata de e-mail depende do framework/constraint.
* **Concorrência:** multi-sessão e signup simultâneo não testados.
* **Retry e falha parcial:** reset depende do e-mail stub.
* **Timezone ou arredondamento:** expiração de reset é temporal; timezone não é material na fonte lida.
* **Autorização:** servidor consulta policy/role; RLS está desligado no banco.
* **Privacidade:** e-mail, sessão e reset são PII/sensíveis.
* **Acessibilidade:** não avaliada para login/reset.
* **Auditoria:** auditoria de toda ação auth não demonstrada.
* **Logs e métricas:** não observados.
* **Testes encontrados:** `auth-policy.test.ts`; sem integração HTTP/sessão.
* **Evidências:** `src/app/api/auth/[...all]/route.ts:12-29`; `src/lib/auth.ts:35-69`; `src/lib/session.ts:23-75`; `src/lib/auth-policy.ts:3-73`; `src/db/schema.ts:109-184`.
* **Contradições:** fallback localhost versus documentação de URL obrigatória.
* **Lacunas:** `emailVerified`, proxy confiável, rate limit e política de vínculo de compra.
* **Riscos:** conta/vínculo indevido caso signup abra; configuração de proxy pode afetar callback/origem.
* **Recomendação preliminar:** manter cadastro fechado até decidir verificação e vínculo atômico.
* **Decisão humana necessária:** sim, DEC-DISC-007.
* **Perguntas em aberto:** compra com e-mail diferente cria conta, convida ou aguarda confirmação?

## ENROLL-DISC-001 — Entitlement e expiração de matrícula

* **Domínio:** matrícula e acesso pago.
* **Classificação:** AS-IS CONFIRMADO.
* **Confiança:** alta.
* **Severidade:** P1.
* **Ator:** student, support/admin e job de manutenção.
* **Recurso:** enrollment, grant, curso, aula e material.
* **Ação:** conceder, ajustar, expirar ou verificar acesso.
* **Pré-condições:** sessão/ownership para student; capability para operação; curso ativo; grant elegível.
* **Gatilho:** webhook, ajuste administrativo, cron ou chamada direta à aula/material.
* **Comportamento atual confirmado:** acesso exige matrícula/grant ativo e janela válida; aula também exige sequência; URL direta reaplica guard.
* **Comportamento atual inferido:** nova compra após bloqueio manual pode restaurar acesso; política não está documentada.
* **Comportamento desejado documentado:** nenhum normativo localizado.
* **Comportamento negado:** conta sem entitlement ativo não acessa conteúdo pago.
* **Exceções:** preview autorizado explicitamente.
* **Estados envolvidos:** grant/enrollment ativo, expirado, bloqueado; curso ativo.
* **Transições observadas:** projeção de grant atualiza matrícula; cron trata expiração.
* **Efeitos no banco:** enrollments, enrollment_grants, enrollment_events e ajustes.
* **Efeitos externos:** aviso de expiração depende de e-mail stub.
* **Transação:** criação/projeção observada em servidor; ajuste encadeado é inseguro.
* **Idempotência:** source unique reduz duplicata de grant.
* **Concorrência:** reversão de ajuste antigo pode sobrescrever ajuste novo.
* **Retry e falha parcial:** aviso de expiração pode repetir sem reserva/lock.
* **Timezone ou arredondamento:** expiração usa timestamps; regra de timezone de negócio não declarada.
* **Autorização:** server-side; RLS desabilitado.
* **Privacidade:** vínculo de conta, curso e histórico de acesso.
* **Acessibilidade:** não aplicável ao guard; mensagens de expiração não foram auditadas.
* **Auditoria:** enrollment_events e audit_logs parciais.
* **Logs e métricas:** não confirmados.
* **Testes encontrados:** contratos de acesso/manutenção; sem cadeia concorrente.
* **Evidências:** `src/features/enrollments/server.ts:168-322,747-841,990-1044`; `src/features/courses/server.ts:857-969`; `src/db/schema.ts:367-505`.
* **Contradições:** não localizada política para bloqueio manual versus novo pagamento.
* **Lacunas:** reversão, reembolso e timezone operacional.
* **Riscos:** P1 de encurtar acesso válido ao reverter ajuste.
* **Recomendação preliminar:** modelar reversão idempotente/ordenada depois da decisão de lifecycle.
* **Decisão humana necessária:** sim, DEC-DISC-002.
* **Perguntas em aberto:** uma nova compra deve neutralizar bloqueio manual?

## WEBHOOK-DISC-001 — Pagamento, idempotência e ordem de eventos

* **Domínio:** pagamentos e webhooks.
* **Classificação:** AS-IS PARCIAL.
* **Confiança:** alta.
* **Severidade:** P1.
* **Ator:** AbacatePay e job interno de processamento.
* **Recurso:** pedido, evento e grant.
* **Ação:** validar evento, alterar pedido e projetar entitlement.
* **Pré-condições:** segredo/HMAC válidos e payload mapeável.
* **Gatilho:** POST de webhook.
* **Comportamento atual confirmado:** handler valida assinatura; transação registra evento, deduplica mesma chave e atualiza pedido/grant.
* **Comportamento atual inferido:** um `paid` tardio pode reabrir acesso após refund por falta de serialização entre eventos diferentes.
* **Comportamento desejado documentado:** AbacatePay requer HMAC/segredo e prevê retentativas; não define a política de negócio do produto.
* **Comportamento negado:** evento com autenticação inválida não deve processar.
* **Exceções:** divergência de valor não possui regra explícita.
* **Estados envolvidos:** ordem, webhook event e grant/enrollment.
* **Transições observadas:** pendente/pago/revertido conforme mapeamento de evento; precedência não comprovada.
* **Efeitos no banco:** orders, webhook_events, enrollment_grants, enrollments e enrollment_events.
* **Efeitos externos:** AbacatePay; possível e-mail posterior stub.
* **Transação:** sim, processamento de evento observado em transação.
* **Idempotência:** unique de provider key e source grant.
* **Concorrência:** não serializada por pedido entre chaves diferentes.
* **Retry e falha parcial:** duplicata é tratada; falhas após efeitos externos não têm outbox demonstrado.
* **Timezone ou arredondamento:** valores monetários em cents; tolerância/arredondamento não definidos.
* **Autorização:** webhook usa autenticação de provedor, não sessão humana.
* **Privacidade:** payload pode conter PII; não foi lido nem analisado.
* **Acessibilidade:** não aplicável: endpoint sem UI.
* **Auditoria:** webhook_events e enrollment_events persistem histórico.
* **Logs e métricas:** não há alerta/DLQ observados.
* **Testes encontrados:** unitários/contratuais; sem webhook real/concorrente.
* **Evidências:** `src/app/api/webhooks/abacatepay/route.ts:10-49`; `src/features/payments/server.ts:274-472,595-745`; `src/db/schema.ts:610-667`.
* **Contradições:** nenhuma resolvida; a ordem é ambígua.
* **Lacunas:** precedência, valor esperado, disputa e reprocessamento.
* **Riscos:** P1 de reativar conteúdo após reversão financeira.
* **Recomendação preliminar:** decidir máquina monotônica por pedido e validar valor.
* **Decisão humana necessária:** sim, DEC-DISC-002 e DEC-DISC-003.
* **Perguntas em aberto:** qual evento pode reabrir acesso após refund/disputa?

## LESSON-DISC-001 — Sequência, conclusão e duração editorial

* **Domínio:** progresso, desbloqueio e conteúdo.
* **Classificação:** BUG PROVÁVEL.
* **Confiança:** alta.
* **Severidade:** P1.
* **Ator:** student e admin.
* **Recurso:** aula, progresso, duração e carga horária.
* **Ação:** concluir aula, avançar e sincronizar duração.
* **Pré-condições:** matrícula ativa, aula ativa e sequência permitida.
* **Gatilho:** clique manual, evento do player ou Server Action.
* **Comportamento atual confirmado:** server aplica sequência; clique manual conclui; player conclui em 95%/fim; ação da student usa `durationSeconds` para atualizar aula/curso.
* **Comportamento atual inferido:** carga de certificado pode ser alterada por chamada legítima autenticada sem autoridade editorial.
* **Comportamento desejado documentado:** não localizado; objetivo pedagógico é indefinido.
* **Comportamento negado:** próxima aula bloqueada quando sequência não permite.
* **Exceções:** formatos sem vídeo dependem de clique; acessibilidade não definida.
* **Estados envolvidos:** lesson progress e watch progress; aula ativa/arquivada.
* **Transições observadas:** não concluída para concluída; atualização de watch/duração.
* **Efeitos no banco:** lesson_progress, lesson_watch_progress, lessons e courses.
* **Efeitos externos:** JMVStream emite eventos de player.
* **Transação:** emissão de progresso/certificado observada; atualização de duração não tem autoridade editorial comprovada.
* **Idempotência:** unique user+lesson reduz progresso duplicado.
* **Concorrência:** múltiplas abas/dispositivos e última escrita não foram testados.
* **Retry e falha parcial:** telemetria/player pode falhar; política não observada.
* **Timezone ou arredondamento:** duração/carga usam segundos/horas; arredondamento de certificado não documentado.
* **Autorização:** sessão existe, mas student não deveria definir dado editorial; RLS desabilitado.
* **Privacidade:** watch progress é dado comportamental.
* **Acessibilidade:** legenda/transcrição e alternativa de conclusão não verificadas.
* **Auditoria:** mudança de duração por student não tem auditoria comprovada.
* **Logs e métricas:** não observados.
* **Testes encontrados:** regras de progresso; sem teste anti-manipulação.
* **Evidências:** `src/app/(student)/app/actions.ts:17-99`; `src/features/progress/rules.ts:23-85`; `src/features/courses/server.ts:1213-1395`; `src/db/schema.ts:508-572`.
* **Contradições:** click e 95% coexistem sem regra de produto.
* **Lacunas:** autoridade de duração e requisito de conclusão.
* **Riscos:** P1 de alterar carga/certificado; P2 de regra pedagógica imprevisível.
* **Recomendação preliminar:** separar atualização editorial de telemetria e decidir A/C no pacote.
* **Decisão humana necessária:** sim, DEC-DISC-004 e DEC-DISC-005.
* **Perguntas em aberto:** conclusão manual basta para todos os formatos?

## CONTENT-DISC-001 — Lifecycle de conteúdo ativo

* **Domínio:** conteúdo e publicação.
* **Classificação:** LACUNA.
* **Confiança:** alta.
* **Severidade:** P2.
* **Ator:** admin e student consumidora.
* **Recurso:** curso, módulo, aula, vídeo e material.
* **Ação:** criar, ativar, arquivar, mover e reordenar.
* **Pré-condições:** capability administrativa.
* **Gatilho:** ações do builder admin.
* **Comportamento atual confirmado:** status active é usado para consumo; admin altera conteúdo e ordem.
* **Comportamento atual inferido:** mudança de conjunto active altera elegibilidade/conclusão da matrícula existente.
* **Comportamento desejado documentado:** roadmap menciona evolução, não regra aprovada.
* **Comportamento negado:** student não edita conteúdo.
* **Exceções:** legacy `is_published` coexiste com status.
* **Estados envolvidos:** draft, active, archived em curso/módulo/aula.
* **Transições observadas:** admin ativa/arquiva/move/reordena.
* **Efeitos no banco:** courses, modules, lessons, assets e progress relacionado.
* **Efeitos externos:** JMVStream/R2 para ativo/material.
* **Transação:** mutações administrativas existem; efeito coorte não é atômico/documentado.
* **Idempotência:** não avaliada para comandos de publicação.
* **Concorrência:** reordenação/publicação simultâneas não testadas.
* **Retry e falha parcial:** delete/upload de vídeo possui estados, sem prova de compensação completa.
* **Timezone ou arredondamento:** não aplicável: lifecycle não temporal definido.
* **Autorização:** admin no servidor.
* **Privacidade:** materiais podem conter dados; conteúdo real não foi lido.
* **Acessibilidade:** nenhuma garantia de legenda/PDF acessível observada.
* **Auditoria:** ações admin têm audit logs parciais.
* **Logs e métricas:** não observados.
* **Testes encontrados:** contratos/source tests; sem alteração pós-venda.
* **Evidências:** `src/features/admin/actions.ts:651-907,1413-1499`; `src/features/courses/server.ts:636-649,1127-1144`; `src/db/schema.ts:186-364`.
* **Contradições:** `is_published` versus status pode divergir.
* **Lacunas:** versão/coorte e regra retroativa.
* **Riscos:** conclusão/certificado mudam silenciosamente.
* **Recomendação preliminar:** congelar coorte ou versionar após decisão.
* **Decisão humana necessária:** sim, DEC-DISC-005.
* **Perguntas em aberto:** uma aula adicionada depois passa a ser obrigatória para quem já comprou?

## CERT-DISC-001 — Emissão e validação pública de certificado

* **Domínio:** certificados.
* **Classificação:** AS-IS PARCIAL.
* **Confiança:** alta.
* **Severidade:** P1.
* **Ator:** student, sistema e visitante público.
* **Recurso:** certificate, PDF, QR e código público.
* **Ação:** emitir, listar, baixar e validar.
* **Pré-condições:** todas as aulas active concluídas.
* **Gatilho:** conclusão de curso e rota pública.
* **Comportamento atual confirmado:** transação tenta emitir um certificado único por user/course com snapshots; código público renderiza nome, curso, carga e data.
* **Comportamento atual inferido:** corrida pode duplicar efeito de e-mail/relatório embora a constraint evite dois certificados.
* **Comportamento desejado documentado:** não há política aprovada de validade/revogação.
* **Comportamento negado:** segundo certificado persistido para mesmo user/course.
* **Exceções:** correção/reestruturação de nome e refund não têm fluxo.
* **Estados envolvidos:** emitido apenas; não há status/revogado observado.
* **Transições observadas:** elegível para emitido.
* **Efeitos no banco:** certificates com código e snapshots únicos.
* **Efeitos externos:** PDF/QR e e-mail stub.
* **Transação:** emissão e unicidade observadas.
* **Idempotência:** unique user+course e code.
* **Concorrência:** persiste um registro; efeitos externos não são idempotentes demonstrados.
* **Retry e falha parcial:** e-mail/PDF posterior pode falhar ou repetir; sem outbox.
* **Timezone ou arredondamento:** issued_at existe; regra de exibição/fuso e arredondamento da carga não documentada.
* **Autorização:** owner para lista; consulta por código é pública.
* **Privacidade:** nome completo é exposto publicamente por código.
* **Acessibilidade:** PDF e página pública não foram auditados.
* **Auditoria:** emissão não tem lifecycle de correção/revogação demonstrado.
* **Logs e métricas:** não observados.
* **Testes encontrados:** regras de emissão; sem refund/concorrência/página pública E2E.
* **Evidências:** `src/features/certificates/rules.ts:4-18`; `src/features/courses/server.ts:1105-1198`; `src/features/certificates/server.ts:16-131`; `src/db/schema.ts:669-694`.
* **Contradições:** certificado único é permanente no schema, mas política de pós-pagamento é ausente.
* **Lacunas:** revogação, reemissão, correção, rate limit e minimização.
* **Riscos:** PII público e credencial inconsistente após refund.
* **Recomendação preliminar:** decidir status/revogação e resposta pública mínima.
* **Decisão humana necessária:** sim, DEC-DISC-006.
* **Perguntas em aberto:** refund deve revogar, anotar ou manter certificado?

## COMM-DISC-001 — Comunicação transacional e suporte

* **Domínio:** operação e suporte.
* **Classificação:** BUG PROVÁVEL.
* **Confiança:** alta.
* **Severidade:** P1.
* **Ator:** sistema, student e atendimento.
* **Recurso:** mensagem de reset, acesso, expiração, certificado e suporte.
* **Ação:** compor e enviar e-mail.
* **Pré-condições:** fluxo chama adaptador de e-mail.
* **Gatilho:** reset, pagamento, expiração, certificado ou diálogo de suporte.
* **Comportamento atual confirmado:** adaptador retorna `Promise.resolve()` e não chama provedor.
* **Comportamento atual inferido:** destinatários não recebem nenhuma mensagem desses fluxos.
* **Comportamento desejado documentado:** plano local descreve e-mail real como futuro.
* **Comportamento negado:** não há entrega operacional confirmada.
* **Exceções:** não aplicável: stub é comum ao fluxo.
* **Estados envolvidos:** não existe outbox/ticket persistente observado.
* **Transições observadas:** composição para resolução sem envio.
* **Efeitos no banco:** nenhum ticket/outbox localizado.
* **Efeitos externos:** nenhuma chamada de e-mail observada.
* **Transação:** não aplicável: efeito externo não ocorre.
* **Idempotência:** não aplicável no adaptador; provedor futuro deve suportar.
* **Concorrência:** avisos cron podem repetir quando o efeito existir.
* **Retry e falha parcial:** ausente.
* **Timezone ou arredondamento:** aviso de expiração é temporal; fuso não especificado.
* **Autorização:** support request requer sessão; destinatário/escopo não foram avaliados com dados reais.
* **Privacidade:** mensagem livre pode conter PII sensível.
* **Acessibilidade:** templates não foram auditados.
* **Auditoria:** suporte não gera ticket/audit trail observável.
* **Logs e métricas:** sem entrega, bounce, retry ou alerta.
* **Testes encontrados:** fonte/unitário; nenhum teste de integração.
* **Evidências:** `src/features/email/server.ts:18-132`; `src/components/support-request-dialog.tsx:83-110`; `src/features/enrollments/maintenance.ts:28-140`.
* **Contradições:** fluxos/planejamento prometem comunicação, implementação não entrega.
* **Lacunas:** provedor, outbox, retenção, SLA e aviso de dados sensíveis.
* **Riscos:** P1 em reset e acesso; P2 de privacidade de suporte.
* **Recomendação preliminar:** escolher DEC-DISC-001 e incluir suporte no DEC-DISC-008.
* **Decisão humana necessária:** sim.
* **Perguntas em aberto:** suporte deve virar ticket persistente ou apenas canal de e-mail?

## PRIVACY-DISC-001 — PII, retenção, validação pública e acessibilidade

* **Domínio:** privacidade, acessibilidade e auditoria.
* **Classificação:** OBRIGAÇÃO EXTERNA.
* **Confiança:** média.
* **Severidade:** P2.
* **Ator:** student, visitante público, support/admin e fornecedores.
* **Recurso:** dados de conta, compra, suporte, logs, certificado, vídeo/material.
* **Ação:** coletar, exibir, encaminhar, reter e excluir/anonimizar.
* **Pré-condições:** uso dos fluxos existentes.
* **Gatilho:** cadastro, compra, suporte, certificado ou player.
* **Comportamento atual confirmado:** schema contém PII; suporte aceita texto livre; certificado público exibe nome; não há evidência de avaliação WCAG/retention.
* **Comportamento atual inferido:** fornecedores podem receber os dados estritamente necessários ao fluxo, mas configuração real não foi acessada.
* **Comportamento desejado documentado:** plano cita LGPD/checklist sem política aprovada.
* **Comportamento negado:** não foi localizada exclusão, anonimização ou aviso contra dados de pacientes.
* **Exceções:** não aplicável sem política aprovada.
* **Estados envolvidos:** retenção/eliminação não modeladas; certificado só emitido.
* **Transições observadas:** não há lifecycle de privacidade confirmado.
* **Efeitos no banco:** PII em users, orders, audit/support-related records e certificate snapshots.
* **Efeitos externos:** e-mail, AbacatePay, JMVStream e R2 quando configurados.
* **Transação:** não aplicável a governança ainda ausente.
* **Idempotência:** não aplicável.
* **Concorrência:** não aplicável; pedidos de direitos/eliminação não existem no código encontrado.
* **Retry e falha parcial:** fornecedores/entrega não auditados.
* **Timezone ou arredondamento:** retenção exige regra temporal futura; não definida.
* **Autorização:** sessões/actions protegem algumas superfícies; consulta de certificado é pública por código; RLS está desligado.
* **Privacidade:** central; exige validação especializada, sem conclusão jurídica definitiva.
* **Acessibilidade:** legenda, teclado, leitor de tela e PDF não verificados contra WCAG 2.2.
* **Auditoria:** audit_logs existe, mas cobertura/imutabilidade/retenção não provadas.
* **Logs e métricas:** observabilidade externa não encontrada.
* **Testes encontrados:** nenhum teste de retenção/privacidade/acessibilidade localizado.
* **Evidências:** `src/db/schema.ts:109-730`; `src/features/certificates/server.ts:16-52`; `src/components/support-request-dialog.tsx:83-110`; `external-sources.md`.
* **Contradições:** política futura citada versus ausência atual de controles/documento localizado.
* **Lacunas:** finalidade, base legal, retenção, direitos, DPA, acessibilidade e rate limit público.
* **Riscos:** exposição de PII, barreira de acesso e operação sem rastreabilidade suficiente.
* **Recomendação preliminar:** decidir minimização/retenção/alvo WCAG com especialistas.
* **Decisão humana necessária:** sim, DEC-DISC-008.
* **Perguntas em aberto:** qual dado mínimo a validação pública deve revelar e por quanto tempo suporte deve reter mensagens?
