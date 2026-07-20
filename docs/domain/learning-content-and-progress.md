---
status: canonical
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Conteúdo, aprendizagem e progresso

## Modelo

Curso contém Módulos ordenados; Módulo contém Aulas ordenadas. Cada nível de conteúdo possui lifecycle próprio:

- Curso: `draft`, `active`, `archived`;
- Módulo/Aula: estados de conteúdo definidos no schema atual;
- vídeo: `jmvstream`, `external` ou legado `panda`;
- Aula: documento rico, vídeo e materiais opcionais combinados.

### REG-LEA-001 Somente conteúdo ativo integra a experiência da Aluna

Consultas em `getStudentCourseOverview` e `getStudentLessonWorkspace` filtram Curso, Módulo e Aula ativos. Drafts pertencem à autoria/preview.

**Invariante:** tornar um item ativo pode afetar imediatamente todas as Alunas com acesso; não existem coortes ou versões de conteúdo.

### REG-LEA-002 Ordem é explícita e estável

Módulos e Aulas usam `sort_order`. `reorderModulesAction` e `reorderLessonsAction` persistem a ordem administrativa.

**Concorrência:** duas reordenações simultâneas não possuem protocolo colaborativo; a última persistência pode prevalecer.

### REG-LEA-003 Aulas são liberadas sequencialmente

`isLessonAvailable`, em `src/features/progress/rules.ts`, permite:

- Aula já concluída;
- qualquer Aula anterior ao último índice concluído;
- primeira Aula ainda não concluída após o último índice concluído.

Aula inexistente na sequência é negada. A regra atua depois da autorização de Matrícula.

### REG-LEA-004 Conclusão atual é manual ou vídeo JMVStream em 98%

`completeLesson` registra conclusão idempotente. `shouldCompleteLessonFromJmvstreamEvent`, em `src/features/videos/jmvstream.ts`, conclui quando evento reconhecido informa pelo menos 98% assistido.

Esse limiar e a conclusão manual estão implementados, mas aguardam ratificação pedagógica em [DEC-DISC-004](../decisions.md#dec-disc-004).

**Invariantes:**

- progresso de posição nunca diminui: usa máximo já observado;
- duração deve ser positiva e no máximo 12 horas no evento;
- evento de vídeo não conclui Aula de outro provedor;
- conclusão repetida não duplica `lesson_progress`.

### REG-LEA-005 Progresso de Curso considera Aulas ativas

`calculateCourseProgress` conta IDs concluídos que pertencem à lista vigente. Percentual é arredondado; Curso vazio resulta em 0%.

Ao atingir todas as Aulas ativas, `completeLesson` pode emitir Certificado se ainda não houver um válido. Alterar o conjunto ativo pode mudar o percentual histórico; não há snapshot/coorte de grade.

### REG-LEA-006 Duração pedagógica é derivada do conteúdo

`calculateLessonDurationBreakdown`, em `src/features/courses/lesson-duration.ts`, soma vídeo e leitura. Leitura usa 260 palavras por minuto. `recalculateCourseWorkloadHours` agrega o Curso.

Essa duração não altera a duração comercial de acesso. Migração `0023_precise_text_reading_duration.sql` refina o cálculo, mas está fora do journal.

### REG-LEA-007 Comentários têm uma camada de resposta

`normalizeCommentBody`, `validateReplyTarget` e `buildLessonCommentTree`, em `src/features/comments/rules.ts`, aplicam:

- texto obrigatório com máximo de 2.000 caracteres;
- resposta somente a comentário raiz da mesma Aula;
- estados `visible` e `hidden`;
- conteúdo oculto é sanitizado na visualização;
- Aluna só comenta em Aula acessível; moderação exige autorização administrativa.

Não há árvore arbitrariamente profunda.

### REG-LEA-008 Mídia publicada mantém fronteira por finalidade

- vídeo de Aula => JMVStream;
- capa, banner e materiais => R2;
- materiais privados usam URL assinada;
- mídia pública é copiada para bucket público;
- banner tem contrato 4:1, 1680×420, máximo 5 MiB e LQIP.

Detalhes: [JMVStream](../integrations/jmvstream.md) e [R2](../integrations/r2.md).

## Autorização e falhas

- autoria e publicação exigem `manageContent`;
- experiência da Aluna exige Matrícula válida;
- preview Admin não grava progresso;
- falha de upload não deve publicar referência quebrada;
- remoção de conteúdo deve limpar ativos externos de forma recuperável;
- JMVStream/R2 indisponíveis degradam mídia, não autorizam ignorar acesso.

## Evidências

- schema: `courses`, `modules`, `lessons`, `lessonProgress`, `lessonWatchProgress`, `lessonComments`;
- autoria: `src/features/admin/authoring.ts`, `src/features/admin/actions.ts`;
- leitura: `src/features/courses/server.ts`;
- regras: `src/features/progress/rules.ts`, `src/features/videos/jmvstream.ts`, `src/features/comments/rules.ts`;
- testes: `src/features/courses/*.test.ts`, `src/features/progress/rules.test.ts`, `src/features/comments/*.test.ts`, `src/features/videos/jmvstream.test.ts`.

## Pendências

- [DEC-DISC-004](../decisions.md#dec-disc-004): ratificar conclusão.
- [DEC-DISC-005](../decisions.md#dec-disc-005): decidir coortes/versionamento.
- Definir efeito de arquivamento sobre Matrículas existentes.
- Racional histórico para 260 palavras/minuto não localizado.
