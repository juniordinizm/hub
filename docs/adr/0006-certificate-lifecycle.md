---
status: proposed
owner: product
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# ADR-0006 Snapshots, revogação e reemissão de Certificados

## Contexto

Certificado é evidência histórica. Nome, Curso e carga horária podem mudar; fraude ou erro pode exigir invalidação sem apagar o passado.

## Proposta

Persistir snapshots no momento da emissão. Revogar com motivo/autoria/data. Reemitir criando novo Certificado e novo código, preservando o anterior revogado. Consulta pública mostra o estado do código consultado.

## Alternativas

- renderizar sempre dados atuais: simples, mas reescreve documento histórico;
- apagar e recriar: perde auditoria e permite ambiguidade do código;
- editar snapshots: resolve erro, mas oculta a correção.

## Consequências

- histórico é recuperável;
- dados pessoais permanecem em snapshots e entram na política de retenção;
- UI precisa explicar revogação e reemissão;
- autoridade, motivo e dados públicos precisam de ratificação.

## Estado

Implementado por `issueManualCertificate`, `revokeCertificate` e `reissueCertificate`. A política
de que revogação bloqueia nova emissão automática, exigindo reemissão manual, foi ratificada em
2026-07-20. Autoridade, motivos e dados públicos continuam pendentes em DEC-DISC-006.
