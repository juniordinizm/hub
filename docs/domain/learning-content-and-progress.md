---
status: canonical
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Conteúdo, aprendizagem e progresso

## Modelo

Um Curso contém Módulos ordenados; cada Módulo contém Aulas ordenadas. A identidade comercial é `Course`; o currículo publicado é uma `CourseVersion` imutável vinculada à Matrícula. Curso, Módulo e Aula têm ciclo próprio; vídeo pode ser `jmvstream`, `external` ou legado `panda`.

## Regras de domínio

### REG-LEA-001 Somente conteúdo ativo integra a experiência da Aluna

`getStudentCourseOverview` e `getStudentLessonWorkspace` leem Curso, Módulo e Aula ativos, pela `course_version_id` da Matrícula. Publicar uma nova versão não altera Matrícula, progresso ou Certificado já existentes. Ver [ADR-0007](../adr/0007-course-versioning-and-enrollment-curriculum.md).

### REG-LEA-002 Ordem é explícita e estável

Módulos e Aulas usam `sort_order`; `reorderModulesAction` e `reorderLessonsAction` persistem a ordem. Não há protocolo colaborativo: em reordenações simultâneas, a última persistência pode prevalecer.

### REG-LEA-003 Aulas são liberadas sequencialmente

`isLessonAvailable`, em `src/features/progress/rules.ts`, permite a Aula concluída, qualquer Aula anterior ao último índice concluído e a primeira Aula ainda não concluída após esse índice. Aula fora da sequência é negada após a autorização da Matrícula.

### REG-LEA-004 Conclusão manual é permitida; vídeo JMVStream em 98% é automático

`completeLesson` é idempotente. `shouldCompleteLessonFromJmvstreamEvent`, em `src/features/videos/jmvstream.ts`, conclui uma Aula quando evento reconhecido informa pelo menos 98% assistido.

A Aluna pode concluir manualmente qualquer Aula obrigatória sem percentual mínimo de visualização. Os 98% são uma segunda via automática, não uma condição para conclusão manual. Aulas opcionais não entram no denominador de Conclusão do Curso. Ver [DEC-DISC-004](../decisions.md#dec-disc-004).

**Invariantes:** posição assistida nunca diminui; duração de evento deve ser positiva e no máximo 12 horas; evento de vídeo não conclui Aula de outro provedor; repetição não duplica `lesson_progress`.

### REG-LEA-005 Progresso de Curso considera Aulas obrigatórias da Versão

`calculateCourseProgress` conta Aulas obrigatórias concluídas da Versão. Curso sem Aula obrigatória resulta em 0% e não emite Certificado automaticamente. Ao completar todas, `completeLesson` pode emitir o Certificado daquela Versão.

### REG-LEA-006 Duração pedagógica é derivada do conteúdo

`calculateLessonDurationBreakdown` soma vídeo e leitura a 260 palavras por minuto; `recalculateCourseWorkloadHours` agrega a carga do Curso. É uma estimativa pedagógica, sem efeito na duração comercial de acesso. O racional histórico para 260 palavras/minuto não foi localizado.

### REG-LEA-007 Comentários têm uma camada de resposta

`normalizeCommentBody`, `validateReplyTarget` e `buildLessonCommentTree`, em `src/features/comments/rules.ts`, aplicam texto obrigatório de até 2.000 caracteres, resposta somente a comentário raiz da mesma Aula e estados `visible`/`hidden`. A Aluna só comenta em Aula acessível; moderação exige autorização administrativa. Não há árvore arbitrariamente profunda.

### REG-LEA-008 Mídia publicada mantém fronteira por finalidade

Vídeo de Aula usa JMVStream; capa, banner e materiais usam R2. Materiais privados usam URL assinada; mídia pública é copiada para bucket público. Banner segue contrato 4:1, 1680×420, máximo 5 MiB e LQIP. Ao editar rascunho clonado, um objeto R2 só é apagado se nenhuma Versão publicada o referencia. Ver [JMVStream](../integrations/jmvstream.md) e [R2](../integrations/r2.md).

## Autorização e falhas

- autoria e publicação exigem `manageContent`;
- a autoria define Aula obrigatória ou opcional; a marca integra a Versão e controla só o denominador de conclusão;
- correção editorial compatível em Versão publicada exige motivo e auditoria; mudança de objetivo, ordem obrigatória ou conclusão cria nova Versão;
- experiência da Aluna exige Matrícula válida; preview Admin não grava progresso;
- indisponibilidade de JMVStream/R2 degrada mídia, mas não autoriza ignorar acesso;
- remoção de conteúdo deve tratar ativos externos de forma recuperável.

## Analytics de aprendizagem

### REG-LEA-009 Analytics é minimizado, padrão habilitado e nunca é autoridade de domínio

Analytics é habilitado por padrão e pode ser desativado pela Aluna em **Conta > Configurações**. Não há modal, gate nem tela dedicada. Ausência de linha em `learning_analytics_preferences` significa habilitado; preferência desativada bloqueia eventos futuros, remove os eventos brutos identificáveis e exclui a Aluna das consultas analíticas. É opt-out/oposição, nunca consentimento.

O servidor deriva Conta, Matrícula e `CourseVersion`; o cliente não fornece identidade para os eventos `lesson_started`, `watch_checkpoint`, `lesson_completed`, `resource_open_failed` e `player_error`. `lesson_progress` e `lesson_watch_progress` continuam fontes de verdade para acesso, sequência, conclusão e Certificado.

**Invariantes:**

- chave de idempotência impede contagem em replay;
- checkpoint é uma faixa de 10%, sem replay ou trilha detalhada;
- erro aceita apenas código allowlisted, nunca mensagem, IP, user agent, comentário ou conteúdo de Aula;
- falha de coleta não desfaz acesso, progresso, conclusão ou Certificado;
- eventos distinguem `CourseVersion`;
- eventos brutos ficam até 90 dias; métricas diárias agregadas, até 13 meses; a limpeza depende de habilitação operacional e referência jurídica formal.

### REG-LEA-010 Painel analítico é somente agregado

O painel mostra por Aula e Versão: elegíveis, início, conclusão, checkpoint mediano, mediana até conclusão, mediana até a próxima Aula e falhas. Não mostra Aluna, Conta, Matrícula, e-mail, inatividade, contato manual ou automação de reengajamento. `GET /api/admin/learning-analytics/export` preserva a mesma fronteira no CSV.

Checkpoint e tempos usam os últimos 90 dias porque dependem de timestamps individuais. A API pública atual da JMVStream não documenta evento estruturado de erro do player; `player_error` permanece reservado até haver contrato. Falha de abertura de material R2 é `resource_open_failed`. Ver [ADR-0008](../adr/0008-optional-learning-analytics.md).

## Experiência de falha e continuidade

- páginas da Aluna exibem retry e identificador de correlação sem detalhe interno;
- trilha é navegável por teclado no desktop e expansível no mobile, incluindo Aulas bloqueadas;
- JMVStream em `processing` atualiza a Aula periodicamente; `failed` interrompe polling e orienta contato com suporte;
- antes de redirecionar anexo R2, o Hub confirma o objeto e retorna à Aula com alerta recuperável em falha;
- posição assistida é monotônica e só é restaurada após sync do player.

## Evidências

- schema: `courses`, `courseVersions`, `modules`, `lessons`, `lessonProgress`, `lessonWatchProgress`, `lessonComments`, `learningAnalyticsPreferences`;
- leitura/autoria: `src/features/courses/server.ts`, `src/features/admin/authoring.ts`, `src/features/admin/actions.ts`;
- regras: `src/features/progress/rules.ts`, `src/features/videos/jmvstream.ts`, `src/features/comments/rules.ts`, `src/features/learning-analytics/rules.ts`;
- analytics: `src/features/learning-analytics/server.ts`, `src/app/(admin)/admin/aprendizagem/page.tsx`;
- testes: `src/features/courses/*.test.ts`, `src/features/progress/rules.test.ts`, `src/features/videos/jmvstream.test.ts`, `src/features/learning-analytics/*.test.ts`.

## Pendências

- `migrateEnrollmentCourseVersion` exige Versão publicada de destino e motivo auditado; não há migração automática ou em massa;
- falta interface administrativa para classificar correção editorial compatível e registrar justificativa;
- racional histórico para 260 palavras/minuto não foi localizado.
