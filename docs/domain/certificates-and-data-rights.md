---
status: canonical
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Certificados e dados técnicos

## Certificados

Cada Curso pode habilitar certificado e possuir um template publicado por vez.
O template tem arte A4 horizontal privada, campos padronizados e coordenadas
normalizadas. A administração recorta a arte na proporção A4 e envia o resultado
diretamente ao R2 por URL assinada. A Server Action recebe somente a referência
temporária; o servidor confirma tipo e tamanho, decodifica e normaliza a imagem
em WebP. Fundo e assinatura aceitam, respectivamente, até 10 MiB e 2 MiB.
Rascunho e publicação são separados; publicar substitui a versão ativa apenas
para emissões futuras. O perfil emissor global, com razão social, marca e CNPJ,
é obrigatório para publicar; responsável e assinatura visual são opcionais por
Curso. Não há HTML livre, campos arbitrários ou inferência automática de
posicionamento.

Sobreposições geométricas entre campos visíveis são permitidas: podem ser uma
decisão intencional de composição. O editor calcula os pares sobrepostos,
mostra um aviso acessível e destaca os retângulos no preview, mas não bloqueia
salvar o rascunho nem publicar. Continuam bloqueantes a ausência da arte,
campos fora da área imprimível, campos duplicados, campos obrigatórios ocultos,
cores inválidas, fontes não permitidas e tamanhos de fonte fora do limite.

O certificado sempre usa a carga horária efetiva do Curso. A configuração do
Curso pode deixar `courses.workload_hours_override` nulo para calcular
automaticamente a soma arredondada das aulas, ou informar um inteiro não
negativo para substituir o valor exibido aos alunos e usado nas próximas
emissões. A emissão grava somente a carga efetiva em
`certificates.workload_hours_snapshot`; certificados já emitidos permanecem
imutáveis. Campos de texto usam `verticalAlign` (`top`, `middle` ou `bottom`),
com `middle` como default compatível para specs legados, tanto no preview quanto
no PDF. O antigo campo de curso livre não faz parte do perfil emissor, template
ou novas emissões; snapshots históricos que ainda o contenham são somente
leitura. A migration de contrato transfere para o Curso um override manual
existente no template ativo antes de remover a coluna legada.

Quando um rascunho substitui fundo ou assinatura, a chave anterior entra em
`certificate_template_asset_cleanup` com carência de 24 horas. A manutenção
reconfirma que nenhum template referencia a chave antes de excluir no R2. O
delete ocorre fora da transação Postgres, possui claim recuperável e mantém um
tombstone depois do sucesso; assim, formulário antigo não ressuscita uma arte
já removida e falha de provider pode ser repetida.

Certificado preserva código público, Conta, Curso, publicação interna de origem, data, carga horária e snapshots de nome e título. Seus estados são `valid` e `revoked`.

### REG-DAT-001 Emissão exige conclusão e unicidade válida

`issueManualCertificate` cria `CourseCompletion` se ela ainda não existir e somente quando não há Certificado anterior para a Aluna no Curso. `completeLesson` cria a primeira conclusão e pode emitir automaticamente quando todas as Aulas obrigatórias da publicação vigente estão concluídas. Depois de uma revogação, somente `reissueCertificate` pode criar nova evidência, sempre na publicação de origem.

**Invariantes:** `CourseCompletion` é única por Conta e Curso; o código público é único; não há segundo Certificado válido para a mesma Conta e Curso sem lifecycle explícito; Certificado revogado bloqueia emissão automática; snapshots e a publicação de origem preservam o texto emitido. Publicação posterior não reabre a conclusão nem gera novo certificado automaticamente.

**Concorrência:** `tryIssueAutomaticCompletionCertificate` usa `INSERT ... ON CONFLICT DO NOTHING RETURNING code`. Somente a transação vencedora solicita e-mail, gravando `email.certificate-issued` na outbox sem PII. Veja [Outbox](../operations/outbox-and-transactional-effects.md).

### REG-DAT-001A Renderização e arquivo imutáveis

A transação vencedora de emissão grava `certificate.render`. A worker obtém um claim atômico persistido por Certificado antes de renderizar; o token e o instante do claim formam um lease de dez minutos. Claim ativo impede outro renderizador, lease abandonado pode ser retomado e falha recuperável libera somente o token pertencente à tentativa. Nenhuma conexão Postgres permanece reservada durante leitura do R2, Sharp, PDFKit ou upload. A worker lê somente o snapshot validado e grava o PDF em chave privada determinística no R2. Se cair depois do upload, a próxima tentativa finaliza o mesmo artefato, sem reconstruí-lo. O fencing não promete computação única: quando o lease expira durante uma operação lenta, duas workers podem executar IO, mas somente a dona do token vigente pode concluir o único artefato persistido. A conclusão também exige que o Certificado continue `valid`; revogação durante o IO impede `ready` e o e-mail. Somente depois de `render_status = ready` a worker grava `email.certificate-issued`. O snapshot registra template/versionamento, arte, campos, marca, razão social, CNPJ, conclusão e hash SHA-256. Reemissão cria nova evidência e preserva a anterior. Download exige sessão da Aluna ou permissão administrativa. O QR/código público apenas valida dados mínimos e nunca entrega o PDF.

O upload de novos PDFs também grava o digest SHA-256 como metadata privada do objeto R2; o download confere a metadata antes de emitir a URL assinada. Objetos legados sem metadata permanecem explicitamente não verificáveis até backfill/reconciliação.

### REG-DAT-002 Revogação preserva histórico

`revokeCertificate` altera estado, categoria, detalhe interno, autoria e data; não apaga o registro. Admin e Suporte podem emitir, revogar e reemitir com confirmação e motivo. A consulta pública mostra estado, data e categoria legível, nunca detalhe, autoria ou evidências.

### REG-DAT-003 Reemissão cria nova evidência

`reissueCertificate` revoga o anterior e cria novo código e snapshots, mantendo vínculo auditável. As categorias canônicas são `identity_correction`, `course_snapshot_correction`, `duplicate_or_technical_issue`, `eligibility_correction`, `integrity_review`, `legal_or_compliance` e `other`; `other` exige detalhe interno. Veja [DEC-DISC-006](../decisions.md#dec-disc-006) e [ADR-0006](../adr/0006-certificate-lifecycle.md).

### REG-DAT-003A Hardening do ciclo e da rastreabilidade

Reemissão somente pode partir do registro histórico mais recente da Aluna no
Curso e usa lock transacional por par Aluna/Curso; assim, o predecessor revogado
não é reescrito e duas reemissões concorrentes não criam ramificação. A UI só
oferece a operação para o registro elegível. Novas emissões usam código no
formato `PRT-` seguido de 32 caracteres hexadecimais; o lookup continua
compatível com códigos legados.

O signatário do template do Curso tem precedência sobre
`app_settings.certificate_signer_name` e
`app_settings.certificate_signer_role`. Quando o template não define o valor,
o default global é resolvido na emissão e congelado no `render_snapshot`.
Salvar rascunho, publicar, habilitar e desabilitar template registram ator,
alvo e metadados em `audit_logs` na mesma transação da mutação; o rascunho
inclui o digest SHA-256 do spec e a publicação inclui o template publicado.

A migration `0056_certificate_state_invariants` normaliza registros legados,
restringe exclusão física do Curso e valida a coerência entre `status`, campos
de revogação e categorias canônicas. Em 2026-08-07, a migration foi aplicada
pelo runner oficial e verificada em staging; a promoção para Production ainda
deve seguir o workflow protegido após preflight e backup.

### REG-DAT-004 Consulta pública é limitada

`consumePublicCertificateLookup`, em `src/features/certificates/public-rate-limit.ts`, aplica limite antes de `getCertificateByCode`. Código inexistente não revela outros Certificados da pessoa.

A página pública compara nome, Curso, carga horária, emissor, CNPJ, conclusão e
data de emissão com os claims do snapshot e publica `noindex,nofollow`. Códigos
de certificado são redigidos no pathname enviado ao Sentry; cache/CDN e
sitemap ainda exigem verificação no ambiente-alvo.

## Dados técnicos e manutenção

### REG-DAT-005 Não existe workflow de solicitações de dados

O Hub não expõe página, API, cron, permissão ou tabela para registrar, aprovar ou executar solicitações de dados. Não há política jurídica formal, caso operacional recorrente nem garantia de uma anonimização correta para justificar manter esse mecanismo inativo.

Uma solicitação real é um incidente excepcional: registrar o caso no canal operacional apropriado, preservar evidências e buscar orientação jurídica antes de alterar dados. Não há anonimização parcialmente implementada disponível para ser acionada.

### REG-DAT-006 Manutenção técnica tem retenção limitada

`runMaintenance`, em `src/features/maintenance/server.ts`, executa diariamente por `GET /api/cron/maintenance`, protegido por `CRON_SECRET`. A rotina não é um mecanismo de direitos de dados nem afirma conformidade LGPD. Ela apenas:

- remove sessões expiradas;
- remove limites expirados da consulta pública de certificados;
- consolida eventos de analytics anteriores ao dia atual em métricas diárias;
- remove eventos brutos de analytics após 90 dias e métricas diárias após 13 meses;
- remove uploads administrativos temporários abandonados após 24 horas;
- reconcilia artes de template substituídas por uma fila persistente, com
  carência, claim, nova verificação de referência e retry;
- reconcilia PDFs determinísticos órfãos de Certificados revogados somente após expirar o lease, confirmar ausência de claim e de mensagem de renderização em processamento e repetir a verificação imediatamente antes da exclusão.

As preferências de analytics da Aluna estão em [Aprendizagem e progresso](learning-content-and-progress.md). Base legal, canal de direitos, retenção de registros financeiros e qualquer anonimização exigem decisão jurídica futura.

## Concorrência e falhas

- emissão e intenção de e-mail compartilham transação; falha ao gravar a outbox desfaz emissão;
- reemissões concorrentes exigem revisão do estado final;
- a manutenção é idempotente: agregados diários usam upsert e exclusões por prazo podem ser repetidas;
- a falha do cron é observável como `maintenance_cron_failed`; dados antigos permanecem até uma execução posterior.

## Evidências

- schema: `certificates`, `publicCertificateRateLimits`, `learningAnalyticsEvents`, `learningAnalyticsDailyMetrics` em `src/db/schema.ts`;
- certificados: `src/features/certificates/server.ts`, `src/features/certificates/rules.ts`;
- manutenção: `src/features/maintenance/server.ts`, `src/app/api/cron/maintenance/route.ts`;
- testes: `src/features/certificates/*.test.ts`, `src/features/maintenance/server.test.ts`.

## Pendências

- definir política jurídica de retenção, direitos de dados e anonimização antes de criar novo workflow;
- recovery/ativação por senha permanece fora da outbox porque contém token secreto;
- infraestrutura de cron e base legal de produção não foram verificadas externamente.
