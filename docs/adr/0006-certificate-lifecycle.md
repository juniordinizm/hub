---
status: accepted
owner: product
last_verified_commit: 2df4996ac4875bf48f425a7e3456f3c8ac1fc3aa
---

# ADR-0006 Snapshots, revogação e reemissão de Certificados

## Contexto

Certificado é evidência histórica. Nome, Curso e carga horária podem mudar; fraude ou erro pode exigir invalidação sem apagar o passado.

## Proposta

Persistir snapshots no momento da emissão. Revogar com motivo, autoria e data. Reemitir criando novo Certificado e novo código, preservando o anterior revogado. Admin e Suporte podem executar as três operações, sempre com motivo obrigatório e confirmação na interface.

O motivo usa uma categoria padronizada e um detalhe interno. Na consulta pública de um certificado revogado, mostrar somente o estado, a data e a categoria legível; não expor o detalhe, que pode conter dados pessoais ou uma apuração sensível.

## Alternativas

- renderizar sempre dados atuais: simples, mas reescreve documento histórico;
- apagar e recriar: perde auditoria e permite ambiguidade do código;
- editar snapshots: resolve erro, mas oculta a correção.

## Consequências

- histórico é recuperável;
- dados pessoais permanecem em snapshots e entram na política de retenção;
- UI precisa explicar revogação e reemissão;
- download já realizado não pode ser recolhido; a revogação passa a ser verificável pelo código público;
- o detalhe do motivo fica restrito à operação e à auditoria.

## Estado

Implementado por `issueManualCertificate`, `revokeCertificate` e `reissueCertificate`. A política
de que revogação bloqueia nova emissão automática, exigindo reemissão manual, foi ratificada em
2026-07-20. Autoridade, motivos e informação pública foram ratificados em 2026-07-21; veja
[DEC-DISC-006](../decisions.md#dec-disc-006).
