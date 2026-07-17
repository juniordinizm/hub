> **Status: proposta de planejamento; não normativa; baseada em documentação, código e metadados Neon observados em 2026-07-17. Não aprova regras nem autoriza alterações.**

# Plano de PRs para correção e refinamento do Hub

## Premissas e evidências

- O produto é uma plataforma privada de cursos, não um ERP: não há organizações, fornecedores, importações, estoque, planos de assinatura nem metas no schema Neon ou no código.
- Produção Neon confirma `users`, conteúdo, pedidos, grants, matrículas, progresso, certificados, eventos e ativos JMVStream; não confirma tabelas de `organizations`, `support_tickets`, `password_resets`, estoque ou importação. RLS está desligado no schema `public`.
- `docs/PLAN.md` marca Resend como implementado, mas `src/features/email/server.ts` resolve sem enviar. O mesmo documento se descreve como starter e lista fases já implementadas: é planejamento histórico, não fonte AS-IS.
- `docs/protear-arquitetura-organizada.md` descreve stack, tabelas e provedores de uma proposta inicial que divergem do código atual; por exemplo, `support_tickets` e `password_resets` não existem.
- `docs/JMVSTREAM_UPLOAD_MODULE.md` e `docs/JMVSTREAM_SETUP.md` afirmam cron JMV a cada cinco minutos, mas `vercel.json` só agenda `/api/cron/enrollments` diariamente.
- A descoberta em `docs/business-rules/discovery/` é a fonte AS-IS mais recente, porém ainda depende de decisões de produto pendentes.

## Ordem proposta

`PR 0` → `PR 1` → `PR 2`, `PR 4`, `PR 5`, `PR 6`, `PR 9`, `PR 11`, `PR 12` → `PR 13` → `PR 14`.

PRs marcados como **não aplicável** devem permanecer sem código, migration ou documentação normativa até que o produto introduza o domínio correspondente.

## Atualização de execução — 2026-07-17

- **PR 0, implementada:** documentos de visão/roadmap foram marcados como históricos e passaram a apontar à descoberta AS-IS; evita usar planos antigos como contrato atual.
- **PR 1, implementada no escopo documental:** criados autoridade documental, glossário e registro de decisões; isso separa evidência, decisão e implementação sem inventar política.
- **PR 2, parcial:** produção exige URLs canônicas de autenticação, aplicação e certificado; a política de identidade, proxy confiável e rate limit continua dependente de decisão/infraestrutura.
- **PR 4, bloqueada:** a precedência de eventos e o snapshot financeiro não podem ser inferidos com segurança.
- **PR 5, bloqueada:** não há alteração de autorização segura sem fechar a política de identidade do PR 2.
- **PR 6, parcial:** uma aluna não consegue mais alterar duração editorial nem carga de curso; o cron JMV foi incluído e testado. Coorte/versionamento permanece pendente.
- **PR 9 e PR 12, bloqueadas:** exigem política comercial e validação jurídica/especializada, respectivamente.
- **PR 11, parcial:** o adapter Resend deixou de ser no-op e o cron JMV foi configurado; retry/outbox/DLQ exigem desenho operacional antes de persistir ou reenviar eventos.
- **PR 13, parcial:** a rastreabilidade agora possui governança e resultados de implementação; ampliações dependem das decisões bloqueadas.
- **PR 14, em execução:** este plano passou a registrar estado real, evidência e bloqueio de cada iniciativa.

---

## PR 0 — Descoberta e inventário

* **Status da PR:** implementada em 2026-07-17.
* **Objetivo:** consolidar mapa de domínio, AS-IS, contradições e lacunas sem criar regra normativa.
* **Prioridade:** P0 documental.
* **Regras envolvidas:** `AUTH-DISC-001`, `ENROLL-DISC-001`, `WEBHOOK-DISC-001`, `LESSON-DISC-001`, `CONTENT-DISC-001`, `CERT-DISC-001`, `COMM-DISC-001`, `PRIVACY-DISC-001`.
* **Gaps corrigidos:** fontes conflitantes e ausência de inventário único.
* **Dependências:** nenhuma.
* **Escopo:** reconciliar os documentos raiz com a descoberta, classificando cada afirmação como AS-IS, TO-BE, histórico ou obsoleta.
* **Fora de escopo:** alterar produto, schema ou comportamento.
* **Arquivos prováveis:** `docs/PLAN.md`, `docs/protear-arquitetura-organizada.md`, `docs/AUTH_MODULE.md`, `docs/JMVSTREAM_*.md`, `docs/business-rules/discovery/*`.
* **Alterações no banco:** nenhuma.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** total; documentação apenas.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** revisão de responsáveis por produto/técnica antes de substituir textos obsoletos.
* **Testes obrigatórios:** validação de links, referências e IDs únicos.
* **Observabilidade necessária:** não aplicável.
* **Riscos:** tratar decisão pendente como regra aprovada.
* **Rollback:** reverter somente os arquivos Markdown.
* **Critérios de aceite:** cada documento raiz aponta seu status; nenhuma tabela/provedor inexistente é descrito como implementado.
* **Regras consideradas concluídas após o PR:** nenhuma normativa; somente inventário rastreável.

## PR 1 — Governança e glossário

* **Status da PR:** implementada no escopo documental em 2026-07-17; adoção organizacional ainda requer responsável.
* **Objetivo:** estabelecer IDs, status, templates, glossário e registro de decisões para documentos futuros.
* **Prioridade:** P1; pré-requisito de documentação autoritativa.
* **Regras envolvidas:** todas as `*-DISC-*`; decisões `DEC-DISC-001` a `DEC-DISC-008` permanecem pendentes.
* **Gaps corrigidos:** termos conflitantes como matrícula/grant/acesso e documentos sem autoridade explícita.
* **Dependências:** PR 0.
* **Escopo:** criar governança documental, glossário de curso/pedido/grant/matrícula/progresso e formato de ADR/decisão.
* **Fora de escopo:** aprovar decisões, mudar nomenclatura de banco ou reescrever código.
* **Arquivos prováveis:** novo `docs/business-rules/README.md`, `governance.md`, `glossary.md`, `decision-register.md`; referências nos documentos existentes.
* **Alterações no banco:** nenhuma.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** documental.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** aprovar glossário com produto e adotar em PRs subsequentes.
* **Testes obrigatórios:** links, IDs e status válidos.
* **Observabilidade necessária:** não aplicável.
* **Riscos:** burocracia sem dono documental.
* **Rollback:** reverter Markdown.
* **Critérios de aceite:** cada regra futura possui ID, autoridade, versão e decisão vinculada.
* **Regras consideradas concluídas após o PR:** apenas governança documental.

## PR 2 — Identidade, autenticação e sessões

* **Status da PR:** parcialmente implementada em 2026-07-17; decisões de identidade e infraestrutura de proxy/rate limit permanecem bloqueadas.
* **Objetivo:** tornar explícita e verificável a política de cadastro fechado, vínculo de compra, sessão, proxy e permissões.
* **Prioridade:** P0.
* **Regras envolvidas:** `AUTH-DISC-001`, `SESSION-DISC-001`, `RBAC-DISC-001`, DEC-DISC-007.
* **Gaps corrigidos:** defaults localhost em produção, proxy confiável, rate limit distribuído, acesso sem `emailVerified` se signup abrir e divergência de senha.
* **Dependências:** PR 1 e decisão de identidade/vínculo de compra.
* **Escopo:** endurecer env de produção, centralizar política de senha/origem, validar auth-adjacent no servidor e testar bloqueio/profile/role.
* **Fora de escopo:** abrir signup público, adicionar organização ou trocar Better Auth.
* **Arquivos prováveis:** `src/lib/env.ts`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/auth-policy.ts`, formulários auth, Route Handlers e testes.
* **Alterações no banco:** possivelmente índice/registro de rate-limit apenas se a decisão escolher armazenamento próprio.
* **Migration necessária:** condicional; não para ajuste de env/policy.
* **Migração de dados necessária:** revisar contas não verificadas se a verificação virar gate.
* **Alterações de API:** respostas de signup/reset podem tornar-se mais restritivas.
* **Alterações de UI:** mensagens de senha, verificação e acesso bloqueado.
* **Alterações em jobs/eventos:** auditoria de reset/login, se aprovada.
* **Compatibilidade:** risco controlado de bloquear fluxo hoje permitido; rollout deve medir falhas.
* **Feature flag necessária:** sim, para qualquer gate de e-mail verificado.
* **Estratégia de rollout:** observação → habilitação em preview → produção com rollback do flag.
* **Testes obrigatórios:** signup bloqueado, role/profile ausente, estudante bloqueada, support, proxy/origem e reset.
* **Observabilidade necessária:** métricas de falha auth, bloqueio e reset; alertas de abuso.
* **Riscos:** bloquear alunas legítimas ou aceitar headers forjados se o proxy não for confiável.
* **Rollback:** desabilitar flag de verificação; reverter validações sem remover dados.
* **Critérios de aceite:** toda superfície auth-adjacent tem decisão, guard server-side e teste direto.
* **Regras consideradas concluídas após o PR:** identidade/sessão somente após decisão DEC-DISC-007 aprovada.

## PR 3 — Organizações, membros e multi-tenancy

* **Status da PR:** não aplicável; não criar.
* **Objetivo:** registrar que o domínio não existe e evitar escopo especulativo.
* **Prioridade:** não aplicável.
* **Regras envolvidas:** nenhuma; o produto é de cursos próprios, sem tenant/organization no schema Neon.
* **Gaps corrigidos:** evita introduzir isolamento/RLS/membership sem requisito.
* **Dependências:** PR 0.
* **Escopo:** nota de exclusão no plano/ADR, se necessário.
* **Fora de escopo:** tabelas `organizations`, `members`, convites ou RLS por tenant.
* **Arquivos prováveis:** `docs/business-rules/README.md` após PR 1.
* **Alterações no banco:** nenhuma.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** total.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** não aplicável.
* **Testes obrigatórios:** não aplicável.
* **Observabilidade necessária:** não aplicável.
* **Riscos:** criar complexidade sem produto correspondente.
* **Rollback:** não aplicável.
* **Critérios de aceite:** domínio marcado como fora do escopo atual.
* **Regras consideradas concluídas após o PR:** nenhuma.

## PR 4 — Billing, planos e entitlements

* **Status da PR:** bloqueada por DEC-DISC-002 e DEC-DISC-003.
* **Objetivo:** formalizar lifecycle de pedido/grant/matrícula e impedir concessão incorreta.
* **Prioridade:** P0.
* **Regras envolvidas:** `ENROLL-DISC-001`, `WEBHOOK-DISC-001`, DEC-DISC-002 e DEC-DISC-003.
* **Gaps corrigidos:** eventos fora de ordem, valor divergente, ajuste revertido e bloqueio manual versus nova compra.
* **Dependências:** PR 1 e decisões de precedência/valor.
* **Escopo:** máquina de estados monotônica, serialização por pedido, validação de snapshot e reversão idempotente de ajustes.
* **Fora de escopo:** recorrência, planos SaaS, cupom/carrinho e novos gateways.
* **Arquivos prováveis:** `src/features/payments/server.ts`, `src/features/enrollments/server.ts`, `src/db/schema.ts`, migrations e testes de integração.
* **Alterações no banco:** provável: estado de reversão/precedência, snapshot financeiro imutável e índice de consistência.
* **Migration necessária:** sim, provável.
* **Migração de dados necessária:** provável reconciliação de pedidos/grants existentes antes de ativar a regra.
* **Alterações de API:** estados de checkout/acesso podem expor “em análise”.
* **Alterações de UI:** admin mostra divergência e motivo de bloqueio; estudante recebe estado compreensível.
* **Alterações em jobs/eventos:** reprocessamento/reconciliação de pedidos com trilha auditável.
* **Compatibilidade:** exige preservar IDs e eventos legados.
* **Feature flag necessária:** sim, para nova projeção de entitlement durante reconciliação.
* **Estratégia de rollout:** backfill em dry run → comparação → flag em produção → reconciliação monitorada.
* **Testes obrigatórios:** duplicata, fora de ordem, concorrência, refund, disputa, parcial, cupom e reversão encadeada.
* **Observabilidade necessária:** métricas por status, eventos ignorados/falhos, divergências e grants reconstruídos.
* **Riscos:** revogar acesso legítimo ou preservar acesso após reembolso.
* **Rollback:** desligar projeção nova, manter eventos/auditoria e restaurar projeção anterior por job controlado.
* **Critérios de aceite:** um pedido possui precedência determinística e nenhuma corrida reativa grant após evento terminal.
* **Regras consideradas concluídas após o PR:** entitlement e webhook, após DEC-DISC-002/003 aprovadas.

## PR 5 — Admin interno

* **Status da PR:** bloqueada pela política de autorização do PR 2; nenhuma mudança segura e verificável foi inferida.
* **Objetivo:** concentrar autorização, limites operacionais e auditoria das ações administrativas.
* **Prioridade:** P1.
* **Regras envolvidas:** `RBAC-DISC-001`, `AUDIT-DISC-001`, `ENROLL-DISC-001`.
* **Gaps corrigidos:** UI divergente da policy, leituras sensíveis reutilizáveis sem guard próximo e auditoria incompleta.
* **Dependências:** PR 1 e PR 2.
* **Escopo:** módulo profundo de autorização administrativa com interface pequena, usar a mesma policy em UI e servidor, catalogar ações auditáveis.
* **Fora de escopo:** novo papel, SSO, organizações ou alterar permissões de negócio sem aprovação.
* **Arquivos prováveis:** `src/lib/auth-policy.ts`, `src/lib/auth-permissions.ts`, `src/features/admin/{actions,server}.ts`, navegação admin e testes.
* **Alterações no banco:** possivelmente catálogo/metadata de audit logs; não obrigatório.
* **Migration necessária:** condicional.
* **Migração de dados necessária:** não, salvo novo formato de auditoria.
* **Alterações de API:** respostas de ação negada podem padronizar erro.
* **Alterações de UI:** esconder controles não autorizados e expor estado de acesso negado.
* **Alterações em jobs/eventos:** registrar mudanças sensíveis de forma consistente.
* **Compatibilidade:** preservar capabilities atuais até decisão explícita.
* **Feature flag necessária:** não para centralização; sim se mudar permissões.
* **Estratégia de rollout:** primeiro leitura/auditoria, depois mutações por área.
* **Testes obrigatórios:** matrix admin/support/student, leitura direta, mutação direta e audit log.
* **Observabilidade necessária:** eventos de negação e ações administrativas por tipo.
* **Riscos:** regressão de acesso do support ou excesso de log com PII.
* **Rollback:** manter policy anterior como fallback temporário; reverter UI/guards juntos.
* **Critérios de aceite:** UI e servidor derivam da mesma policy; ações sensíveis possuem audit trail.
* **Regras consideradas concluídas após o PR:** RBAC/auditoria somente para superfícies cobertas.

## PR 6 — Catálogo, produtos e imagens

* **Status da PR:** parcialmente implementada em 2026-07-17; coorte/versionamento continua bloqueado por DEC-DISC-005.
* **Objetivo:** estabilizar lifecycle de conteúdo, imagens, vídeo e duração editorial.
* **Prioridade:** P0 para integridade de certificado; P1 para mídia.
* **Regras envolvidas:** `CONTENT-DISC-001`, `LESSON-DISC-001`, `VIDEO-DISC-001`, DEC-DISC-005.
* **Gaps corrigidos:** student altera duração, `is_published` conflita com status, conteúdo ativo muda conclusão e cron JMV documentado não está agendado.
* **Dependências:** PR 1 e decisão de coorte/versionamento.
* **Escopo:** separar metadado editorial da telemetria, escolher fonte de publicação, definir coorte/versionamento e alinhar configuração/contrato JMV ao scheduler real.
* **Fora de escopo:** trocar provedor de vídeo, criar marketplace de produtos ou reescrever editor.
* **Arquivos prováveis:** `src/features/courses/server.ts`, actions student/admin, `src/db/schema.ts`, `src/features/jmvstream/*`, `vercel.json`, docs JMV e testes.
* **Alterações no banco:** provável para snapshot/coorte; possível remoção/migração de campo legado após plano.
* **Migration necessária:** provável se houver coorte/versionamento.
* **Migração de dados necessária:** provável para cursos/matrículas existentes.
* **Alterações de API:** ações de vídeo/duração deixam de aceitar dado editorial vindo da aluna.
* **Alterações de UI:** estados de processamento, publicação e requisito de conteúdo por coorte.
* **Alterações em jobs/eventos:** cron JMV agendado ou documentação corrigida; reconciliação auditável.
* **Compatibilidade:** preservar vídeos e progresso existentes durante migração.
* **Feature flag necessária:** sim, para aplicar coorte nova a novas matrículas antes do backfill.
* **Estratégia de rollout:** corrigir autoridade de duração primeiro; ativar coorte para novas matrículas; migrar legados depois.
* **Testes obrigatórios:** chamada maliciosa de duração, publicação pós-venda, troca de vídeo, cron e CORS/ETag em integração controlada.
* **Observabilidade necessária:** assets uploading/processing/failed, idade de processamento e falhas de reconciliação.
* **Riscos:** alterar requisito de conclusão ou deixar vídeo órfão.
* **Rollback:** flag de coorte; não apagar assets/versões durante rollout.
* **Critérios de aceite:** student não altera carga editorial; um lifecycle publicado é fonte de verdade; scheduler e docs concordam.
* **Regras consideradas concluídas após o PR:** conteúdo/vídeo após DEC-DISC-005 aprovada.

## PR 7 — Fornecedores, compras e importações

* **Status da PR:** não aplicável; não criar.
* **Objetivo:** evitar domínio ERP inexistente.
* **Prioridade:** não aplicável.
* **Regras envolvidas:** nenhuma; `orders` representam compra de curso, não compra de fornecedor ou importação.
* **Gaps corrigidos:** evita reutilizar billing de aluna para procurement.
* **Dependências:** PR 0.
* **Escopo:** registrar exclusão de escopo.
* **Fora de escopo:** fornecedores, notas, importação e catálogo de compras.
* **Arquivos prováveis:** documentação de governança, se necessário.
* **Alterações no banco:** nenhuma.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** total.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** não aplicável.
* **Testes obrigatórios:** não aplicável.
* **Observabilidade necessária:** não aplicável.
* **Riscos:** diluir foco do produto.
* **Rollback:** não aplicável.
* **Critérios de aceite:** PR explicitamente descartada até existir requisito de produto.
* **Regras consideradas concluídas após o PR:** nenhuma.

## PR 8 — Estoque

* **Status da PR:** não aplicável; não criar.
* **Objetivo:** não introduzir inventário em plataforma de cursos digitais.
* **Prioridade:** não aplicável.
* **Regras envolvidas:** nenhuma; mídia e vagas não são estoque no modelo atual.
* **Gaps corrigidos:** evita invariantes/movimentações artificiais.
* **Dependências:** PR 0.
* **Escopo:** registrar exclusão de escopo.
* **Fora de escopo:** saldo, reserva, movimentação, reconciliação física ou warehouse.
* **Arquivos prováveis:** documentação de governança, se necessário.
* **Alterações no banco:** nenhuma.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** total.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** não aplicável.
* **Testes obrigatórios:** não aplicável.
* **Observabilidade necessária:** não aplicável.
* **Riscos:** complexidade sem valor.
* **Rollback:** não aplicável.
* **Critérios de aceite:** nenhuma entidade de estoque é criada.
* **Regras consideradas concluídas após o PR:** nenhuma.

## PR 9 — Vendas, cancelamentos e estornos

* **Status da PR:** bloqueada pelas decisões de precedência/valor do PR 4 e pela decisão de retenção DEC-DISC-008.
* **Objetivo:** separar a política comercial de cancelamento/estorno da mecânica de webhook e refletir seus efeitos no acesso/certificado.
* **Prioridade:** P0.
* **Regras envolvidas:** `WEBHOOK-DISC-001`, `CERT-DISC-001`, DEC-DISC-002, DEC-DISC-003 e DEC-DISC-006.
* **Gaps corrigidos:** refund/disputa sem regra explícita para acesso, certificado e comunicação.
* **Dependências:** PR 4 e decisão DEC-DISC-006.
* **Escopo:** definir estados comerciais, reversibilidade, atendimento de exceção e efeitos em grant/certificado.
* **Fora de escopo:** novos meios de pagamento, assinatura recorrente, fiscal/contábil e chargeback do provedor além dos eventos recebidos.
* **Arquivos prováveis:** payments/enrollments/certificates, documentos comerciais e testes de integração.
* **Alterações no banco:** provável status/motivo de certificado e histórico de resolução.
* **Migration necessária:** provável.
* **Migração de dados necessária:** análise de certificados/pedidos legados.
* **Alterações de API:** endpoints/admin podem expor motivo/status de reversão.
* **Alterações de UI:** comunicação de acesso revogado, certificado anotado e contato de suporte.
* **Alterações em jobs/eventos:** reconciliação e notificações idempotentes.
* **Compatibilidade:** não apagar pedido/certificado histórico.
* **Feature flag necessária:** sim, para efeito novo em certificado.
* **Estratégia de rollout:** aplicar a novos eventos, revisar legados por procedimento auditado.
* **Testes obrigatórios:** refund, disputa, cancelamento, reembolso repetido, certificado já emitido e reprocessamento.
* **Observabilidade necessária:** contagem por transição comercial e revogações de entitlement/certificado.
* **Riscos:** punição incorreta de aluna ou certificado inválido sem justificativa.
* **Rollback:** preservar evento histórico e desativar só o efeito novo.
* **Critérios de aceite:** cada evento comercial tem efeito determinístico, auditável e comunicável.
* **Regras consideradas concluídas após o PR:** vendas/reversões após decisões aprovadas.

## PR 10 — Metas, métricas e relatórios

* **Status da PR:** não aplicável no momento; reavaliar quando o produto definir perguntas operacionais.
* **Objetivo:** não criar relatórios ou metas sem semântica de período/cancelamento aprovada.
* **Prioridade:** P3.
* **Regras envolvidas:** nenhuma aprovada; audit logs e eventos não são modelo analítico.
* **Gaps corrigidos:** evita métricas incorretas de vendas/progresso.
* **Dependências:** PR 4 e PR 9 se métricas comerciais forem solicitadas.
* **Escopo:** somente definição futura de perguntas e fontes de verdade.
* **Fora de escopo:** dashboard, BI, metas, comissão e cálculo de receita agora.
* **Arquivos prováveis:** futuro documento de métricas.
* **Alterações no banco:** nenhuma agora.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** total.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** não aplicável.
* **Testes obrigatórios:** não aplicável.
* **Observabilidade necessária:** métricas operacionais dos PRs 4/11, não relatórios de produto.
* **Riscos:** dashboards que contam pagamentos reembolsados como receita final.
* **Rollback:** não aplicável.
* **Critérios de aceite:** não iniciar até produto definir período, fonte e efeito de cancelamento.
* **Regras consideradas concluídas após o PR:** nenhuma.

## PR 11 — Jobs, eventos e integrações

* **Status da PR:** parcialmente implementada em 2026-07-17; outbox, retry e DLQ permanecem pendentes de desenho operacional.
* **Objetivo:** tornar e-mail, cron, retries, eventos e observabilidade realmente operáveis.
* **Prioridade:** P0 para e-mail e scheduler; P1 para DLQ/reprocessamento.
* **Regras envolvidas:** `COMM-DISC-001`, `WEBHOOK-DISC-001`, `VIDEO-DISC-001`, `AUDIT-DISC-001`, DEC-DISC-001.
* **Gaps corrigidos:** e-mail no-op, cron JMV não agendado, retry/DLQ/alerta ausentes e aviso de expiração concorrente.
* **Dependências:** PR 1; PR 4 para eventos financeiros; decisão de provedor de e-mail.
* **Escopo:** adapter real de e-mail, outbox/idempotência, agendamento JMV explícito ou correção documental, retry/reprocessamento e alertas.
* **Fora de escopo:** adotar fila genérica sem caso real, trocar JMVStream ou expor credenciais ao cliente.
* **Arquivos prováveis:** `src/features/email/*`, maintenance, webhook, JMV sync, `vercel.json`, env, migrations, docs e testes.
* **Alterações no banco:** provável tabela outbox/status de entrega; possível lock/reserva de avisos.
* **Migration necessária:** sim, se houver outbox/estado de retry.
* **Migração de dados necessária:** não para mensagens passadas; possível marcação de avisos pendentes.
* **Alterações de API:** handlers cron/webhook podem expor status operacional restrito.
* **Alterações de UI:** admin pode mostrar falhas/retry, não conteúdo de e-mail sensível.
* **Alterações em jobs/eventos:** central; cron, outbox, retries e reprocessamento.
* **Compatibilidade:** manter templates/fluxos existentes; evitar envio retroativo inesperado.
* **Feature flag necessária:** sim, ativação gradual de envio real.
* **Estratégia de rollout:** dry-run/outbox sem entrega → domínio validado → pequena coorte → produção monitorada.
* **Testes obrigatórios:** provider mockado, chave idempotente, falha/retry, cron duplicado, evento webhook e JMV processing.
* **Observabilidade necessária:** taxa de envio/falha, idade de outbox, cron success/failure, eventos falhos e alertas.
* **Riscos:** envio duplicado, perda silenciosa de mensagem ou cron não executado.
* **Rollback:** desligar entrega pelo flag mantendo outbox; pausar cron novo sem apagar estado.
* **Critérios de aceite:** nenhum fluxo afirma envio quando o efeito não ocorre; scheduler configurado coincide com documento e métricas.
* **Regras consideradas concluídas após o PR:** comunicação operacional, retry e reconciliação cobertos.

## PR 12 — Segurança, privacidade e retenção

* **Status da PR:** bloqueada por validação jurídica/especializada e DEC-DISC-008.
* **Objetivo:** minimizar PII, definir retenção e proteger certificado/suporte/mídia sem alegar conformidade jurídica automática.
* **Prioridade:** P1; P0 para exposição pública de certificado se houver dados sensíveis adicionais.
* **Regras envolvidas:** `PRIVACY-DISC-001`, `CERT-DISC-001`, `COMM-DISC-001`, `AUTH-DISC-001`, DEC-DISC-008.
* **Gaps corrigidos:** PII público, suporte livre, ausência de retenção, acessibilidade não avaliada e RLS não disponível como defesa.
* **Dependências:** PR 1, decisão DEC-DISC-008 e parecer jurídico/privacidade quando necessário.
* **Escopo:** política de dados por domínio, minimização na validação pública, aviso de suporte, rate limit, retenção e plano WCAG mensurável.
* **Fora de escopo:** declarar conformidade LGPD/WCAG sem avaliação; ler dados reais; criptografia proprietária sem ameaça definida.
* **Arquivos prováveis:** certificado, suporte, env/headers, docs de privacidade, testes acessíveis e possivelmente migrations.
* **Alterações no banco:** possível status de retenção/revogação e timestamps de eliminação.
* **Migration necessária:** condicional.
* **Migração de dados necessária:** provável se a política exigir minimização de históricos existentes.
* **Alterações de API:** consulta pública pode devolver menos campos; suporte pode limitar conteúdo.
* **Alterações de UI:** aviso de dados sensíveis, feedback acessível, legenda/transcrição/PDF conforme decisão.
* **Alterações em jobs/eventos:** retenção/eliminação e auditoria de execução, se aprovadas.
* **Compatibilidade:** links públicos podem passar a exibir estado mínimo.
* **Feature flag necessária:** sim, para reduzir payload público gradualmente.
* **Estratégia de rollout:** inventário → política aprovada → mudança para novos dados → tratamento de legados.
* **Testes obrigatórios:** enumeração/rate limit de certificado, autorização de suporte, teclado, leitor de tela, contraste e PDF.
* **Observabilidade necessária:** acessos públicos, tentativas limitadas, execução de retenção e falhas de acessibilidade reportadas.
* **Riscos:** exposição continuada ou remoção indevida de histórico necessário.
* **Rollback:** flag de resposta pública; não destruir dados antes de backup/política aprovada.
* **Critérios de aceite:** cada fluxo PII possui finalidade, minimização, retenção e owner; alvo WCAG tem testes definidos.
* **Regras consideradas concluídas após o PR:** privacidade/acessibilidade apenas após validação especializada e DEC-DISC-008.

## PR 13 — Matriz de aderência

* **Status da PR:** parcialmente implementada em 2026-07-17; a matriz existente deve ser expandida quando as decisões bloqueadas forem aprovadas.
* **Objetivo:** tornar verificável a relação regra ↔ código ↔ banco ↔ teste.
* **Prioridade:** P1.
* **Regras envolvidas:** todas as regras aprovadas após PR 1; inventário de descoberta como entrada.
* **Gaps corrigidos:** teste verde sem cobertura da regra, documentação desatualizada e assertions sem fonte.
* **Dependências:** PR 0 e PR 1; alimentada pelos PRs 2/4/5/6/9/11/12.
* **Escopo:** matriz por regra, símbolo, constraint, migration, teste e fonte externa aplicável.
* **Fora de escopo:** substituir testes por documentação ou afirmar cobertura E2E inexistente.
* **Arquivos prováveis:** `docs/business-rules/traceability-matrix.md`, testes correlatos e validação de links.
* **Alterações no banco:** nenhuma.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma direta.
* **Alterações de UI:** nenhuma direta.
* **Alterações em jobs/eventos:** nenhuma direta.
* **Compatibilidade:** documental.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** exigir atualização da matriz em PRs de domínio.
* **Testes obrigatórios:** verificador de links/IDs e testes que apontem cenários de negócio.
* **Observabilidade necessária:** não aplicável.
* **Riscos:** matriz virar inventário manual obsoleto.
* **Rollback:** reverter Markdown.
* **Critérios de aceite:** cada regra aprovada tem fonte de código, banco e teste ou lacuna explicitamente marcada.
* **Regras consideradas concluídas após o PR:** nenhuma regra de produto; rastreabilidade concluída.

## PR 14 — Plano de implementação

* **Status da PR:** em execução; atualizado em 2026-07-17 com resultados e bloqueios verificáveis.
* **Objetivo:** transformar gaps priorizados em execução segura, com critérios de aceite e PRs de código pequenos.
* **Prioridade:** P0 de planejamento.
* **Regras envolvidas:** decisões DEC-DISC-001 a DEC-DISC-008 e todas as regras impactadas pelos PRs aplicáveis.
* **Gaps corrigidos:** roadmap histórico mistura implementado/planejado e não explicita dependências/rollout.
* **Dependências:** PR 0 e PR 1; decisões de produto pendentes.
* **Escopo:** decompor PRs 2, 4, 5, 6, 9, 11 e 12 em issues implementáveis com owner, decisão e verificação.
* **Fora de escopo:** começar código antes da decisão que altera contrato de produto/dados.
* **Arquivos prováveis:** este arquivo, decision register e issues/PR descriptions futuras.
* **Alterações no banco:** nenhuma neste PR; cada PR de código declara a sua.
* **Migration necessária:** não.
* **Migração de dados necessária:** não.
* **Alterações de API:** nenhuma.
* **Alterações de UI:** nenhuma.
* **Alterações em jobs/eventos:** nenhuma.
* **Compatibilidade:** documental.
* **Feature flag necessária:** não.
* **Estratégia de rollout:** executar por dependência, com revisão de risco antes de cada PR de código.
* **Testes obrigatórios:** checklist de aceite deve apontar teste estreito, integração e observabilidade quando aplicáveis.
* **Observabilidade necessária:** definida por PR de código, especialmente 4/11/12.
* **Riscos:** cronograma transformar recomendação em decisão sem owner.
* **Rollback:** reverter documentação; não há mudança operacional.
* **Critérios de aceite:** todo gap P0/P1 possui PR alvo, pré-condição de decisão, rollout e rollback.
* **Regras consideradas concluídas após o PR:** nenhuma; o plano organiza execução, não implementa.
