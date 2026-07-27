---
status: canonical
owner: engineering
last_verified_commit: 34f35e12a4cbe9b6e3b14bfda176bf7ec5501d2b
---

# Documentação do Hub

Este índice é a autoridade sobre onde cada informação vive. Código, schema, migrations e testes prevalecem quando um documento descreve o comportamento implementado; ADRs e o [registro de decisões](decisions.md) determinam o que foi aprovado ou ainda exige ratificação.

## Ordem de leitura

1. [README do projeto](../README.md): executar e verificar o repositório.
2. [Produto](../PRODUCT.md): propósito, público, jornadas e limites.
3. [Glossário](../CONTEXT.md): termos sem ambiguidade.
4. [Arquitetura](architecture.md): módulos, fronteiras e fluxos.
5. Guia de domínio relacionado à tarefa.
6. ADR ou decisão relacionada.
7. Integração e runbook operacional relacionado.

Esse percurso permite localizar propósito, regra, racional, código, teste e operação em no máximo dois saltos a partir deste índice.

## Mapa canônico

### Domínio

- [Identidade e autorização](domain/identity-and-authorization.md)
- [Comércio e acesso](domain/commerce-and-access.md)
- [Conteúdo, aprendizagem e progresso](domain/learning-content-and-progress.md)
- [Certificados e direitos de dados](domain/certificates-and-data-rights.md)

### Integrações

- [AbacatePay](integrations/abacatepay.md)
- [JMVStream](integrations/jmvstream.md)
- [Cloudflare R2](integrations/r2.md)
- [Resend e e-mail institucional](integrations/resend.md)

### Operação

- [Ambiente e desenvolvimento local](operations/environment-and-local-development.md)
- [Desenvolvimento compartilhado](operations/shared-development-and-release-guide.md)
- [Tutorial: da alteração até Production](operations/production-release-guide.md)
- [Banco e migrations](operations/database-and-migrations.md)
- [Deploy e incidentes](operations/deploy-and-incidents.md)
- [Configuração inicial Vercel-first, concluída](operations/vercel-first-launch-checklist.md)
- [Registro histórico da migração Vercel-first](operations/vercel-migration-status.md)
- [Testes e CI](operations/testing-and-ci.md)
- [Outbox e efeitos transacionais](operations/outbox-and-transactional-effects.md)
- [Observabilidade e recuperaÃ§Ã£o](operations/observability-and-recovery.md)

### Decisões

- [Registro de decisões de produto](decisions.md)
- [ADR-0001: RBAC próprio](adr/0001-custom-rbac.md)
- [ADR-0002: buckets R2 e publicação](adr/0002-r2-buckets-and-publication.md)
- [ADR-0003: upload direto para JMVStream](adr/0003-jmvstream-direct-multipart-upload.md)
- [ADR-0004: concessões e matrícula](adr/0004-access-grants-and-enrollment-projection.md)
- [ADR-0005: precedência financeira](adr/0005-financial-precedence-and-manual-review.md)
- [ADR-0006: ciclo de certificados](adr/0006-certificate-lifecycle.md)
- [ADR-0007: versionamento curricular](adr/0007-course-versioning-and-enrollment-curriculum.md)
- [ADR-0008: analytics opcional de aprendizagem](adr/0008-optional-learning-analytics.md)

## Contrato de manutenção

Todo documento canônico contém:

- `status`: `canonical`, `accepted`, `proposed` ou `runbook`;
- `owner`: função responsável, não nome pessoal;
- `last_verified_commit`: commit existente contra o qual as afirmações foram verificadas.

Regras de domínio são definidas uma única vez com ID `REG-<DOMÍNIO>-NNN`. Referências podem repetir o ID no texto, mas não redefini-lo em outro título. Referências ao código apontam arquivo e símbolo, sem número de linha.

Atualize a documentação na mesma mudança quando alterar estado, autorização, invariante, variável de ambiente, integração, migration, cron ou procedimento operacional. Rode `bun run docs:check`.

## Hierarquia em caso de conflito

1. Contrato externo oficial atual.
2. Código, schema, migrations e testes no commit verificado.
3. ADR aceito.
4. Guia canônico de domínio ou operação.
5. Histórico do Git.

Código prova o que acontece; não prova sozinho que o produto aprovou esse comportamento. Divergências ficam explícitas em [decisions.md](decisions.md).

## Registro da consolidação dos 34 documentos originais

O conteúdo único dos 34 arquivos de produto/documentação rastreados antes desta reorganização foi destinado assim:

1. `README.md` => reescrito no próprio caminho.
2. `PRODUCT.md` => ampliado no próprio caminho.
3. `docs/AUTH_MODULE.md` => identidade, ambiente e ADR-0001.
4. `docs/auth-audit-report.md` => identidade, arquitetura e bloqueios operacionais.
5. `docs/banner-image-loading-research.md` => integração R2 e ADR-0002.
6. `docs/business-rules/decision-register.md` => registro de decisões.
7. `docs/business-rules/discovery/actors-and-permissions.md` => identidade e produto.
8. `docs/business-rules/discovery/contradictions-and-gaps.md` => decisões e limitações.
9. `docs/business-rules/discovery/documentation-plan.md` => este índice e contrato de manutenção.
10. `docs/business-rules/discovery/entities-and-states.md` => quatro guias de domínio.
11. `docs/business-rules/discovery/external-sources.md` => guias de integração.
12. `docs/business-rules/discovery/flow-map.md` => arquitetura e guias de domínio.
13. `docs/business-rules/discovery/invariants.md` => regras com IDs estáveis.
14. `docs/business-rules/discovery/open-questions.md` => registro de decisões.
15. `docs/business-rules/discovery/README.md` => este índice.
16. `docs/business-rules/discovery/rule-inventory.md` => quatro guias de domínio.
17. `docs/business-rules/discovery/system-map.md` => arquitetura.
18. `docs/business-rules/discovery/traceability-matrix.md` => evidências em cada regra.
19. `docs/business-rules/glossary.md` => `CONTEXT.md`.
20. `docs/business-rules/README.md` => este índice.
21. `docs/DEPLOY_CHECKLIST.md` => deploy e incidentes.
22. `docs/JMVSTREAM_SETUP.md` => integração JMVStream.
23. `docs/JMVSTREAM_UPLOAD_MODULE.md` => integração JMVStream e ADR-0003.
24. `docs/PLAN.md` => somente fatos ainda vigentes foram distribuídos; tarefas concluídas ficaram no Git.
25. `docs/prds/2026-07-18-r2-media.md` => integração R2 e ADR-0002.
26. `docs/protear-arquitetura-organizada.md` => arquitetura; racional histórico não comprovado foi descartado como autoridade.
27. `docs/R2-CONFIGURACAO.md` => integração R2 e ambiente.
28. `docs/remediation-pr-plan.md` => bloqueios ainda existentes em banco e operação.
29. `docs/sistema de expiracao.md` => comércio e acesso.
30. `docs/superpowers/plans/2026-07-17-jmvstream-upload-reliability.md` => integração JMVStream.
31. `docs/superpowers/plans/2026-07-17-ui-trust-and-auth-continuity.md` => identidade, produto e limitações.
32. `docs/superpowers/specs/2026-07-17-jmvstream-upload-reliability-design.md` => integração JMVStream e ADR-0003.
33. `plans/001-r2-media-boundary.md` => integração R2 e ADR-0002.
34. `plans/002-r2-publication-lifecycle.md` => integração R2 e ADR-0002.

Os arquivos substituídos foram removidos depois desta conferência. O conteúdo literal continua recuperável no histórico do Git.
