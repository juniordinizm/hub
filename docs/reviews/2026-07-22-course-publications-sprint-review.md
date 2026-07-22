---
status: resolved
owner: engineering
last_verified_commit: bf273f803d2d66b0da613a909aa21c31358db81c
---

# Revisão do sprint de publicações de Curso

## Escopo e método

Revisão do diff `f7a6c99..bf273f8`, que introduziu `CoursePublication`, conteúdo vivo por Curso e `CourseCompletion`. Foram inspecionados schema, migration, autoria, leitura de Curso, certificados, analytics, seed E2E, documentação e testes. As correções desta revisão devem preservar a decisão aprovada: Matrícula ativa lê a publicação vigente; Certificado e Conclusão continuam históricos.

## Achados e resolução

1. **Seed E2E incompatível com migration 0035 (P1).** `scripts/seed-e2e.ts` ainda inseria em `course_versions` e `course_version_id`, removidos na migration. Como o `globalSetup` do Playwright executa o seed, Browser journeys não iniciava.
2. **SQL inválido no painel de aprendizagem (P1).** O CTE `completed` de `getLessonAnalyticsMetrics` referenciava o alias `m` sem declará-lo, impedindo o painel e a exportação.
3. **Progresso perdido em nova publicação (P1).** A clonagem materializava todas as Aulas com IDs novos, enquanto `lesson_progress` é vinculado à Aula. Uma mudança editorial fazia todas as Aulas inalteradas parecerem pendentes.
4. **Vídeo removível fora de rascunho (P1).** `removeLessonVideo` não verificava que a Aula pertencia a publicação `draft`, contornando o ciclo de publicação.
5. **Emissão manual contornava reemissão histórica (P1).** Após uma revogação, o fluxo de emissão manual podia usar a publicação vigente, em vez da origem do Certificado revogado.
6. **Carga horária de publicação incorreta (P1).** O recálculo somava Aulas de todas as publicações e só alterava `courses.workload_hours`; `workload_hours_snapshot` da publicação não era atualizado.
7. **Rascunho concorrente sem invariante no banco (P2).** A aplicação verificava o rascunho antes do lock e o schema só impunha unicidade para publicação vigente.
8. **Migration com certificados válidos legados duplicados (P2).** A nova unicidade por Conta + Curso poderia falhar em base que tivesse Certificados válidos em mais de uma publicação antiga. O banco promovido estava sem Certificados; a correção mantém uma evidência válida determinística e preserva as demais como revogadas/auditáveis antes do novo índice.

## Estado da implementação

Os itens 1 a 8 foram corrigidos e têm cobertura focada. `0036_ambitious_shinobi_shaw` foi gerada em terminal interativo; seu snapshot reflete o schema consolidado e seu SQL foi auditado e limitado às três alterações posteriores a `0035`: `lessons.curriculum_key`, seu índice e a unicidade parcial de rascunho por Curso. A branch já promovida não tinha Certificados, portanto o item 8 não exige reparo de dados nela.

## Critério de encerramento

- Publicação preserva o progresso de Aulas materialmente inalteradas; Aulas novas continuam pendentes e Aulas removidas saem do denominador vivo.
- Apenas um rascunho e uma publicação vigente por Curso existem, inclusive sob concorrência.
- Snapshots de título e carga horária pertencem à publicação que será emitida no Certificado.
- Somente `reissueCertificate` pode criar nova evidência após revogação.
- Seed E2E, analytics, migration, testes de domínio, typecheck, lint, build e documentação passam.
- `0036_ambitious_shinobi_shaw` deve ser validada em banco descartável antes de qualquer promoção compartilhada.
