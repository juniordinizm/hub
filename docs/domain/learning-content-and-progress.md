---
status: canonical
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Conteúdo, aprendizagem e progresso

## Modelo

`Course` é a identidade comercial. `CoursePublication` é uma revisão interna materializada de Módulos e Aulas, com estados `draft`, `published` e `retired`. Há no máximo uma publicação publicada e uma em rascunho por Curso.

Matrícula concede acesso comercial ao Curso, não a uma publicação. Portanto, toda Matrícula ativa lê a publicação `published` vigente. Uma publicação nova alcança todas as Alunas com Matrícula ativa; acesso expirado, revogado ou bloqueado não lê conteúdo novo. Ver [ADR-0007](../adr/0007-course-versioning-and-enrollment-curriculum.md).

## Regras de domínio

### REG-LEA-001 Publicação é atômica e em lote

`createCoursePublicationDraft`, em `src/features/admin/authoring.ts`, clona a publicação vigente para um único rascunho. `publishCoursePublication` bloqueia o rascunho, rejeita vídeo JMVStream sem player, aposenta a publicada anterior, publica o rascunho e grava autora/data no audit log na mesma transação. Salvar conteúdo só é permitido no rascunho: não há correção direta em conteúdo publicado.

Módulos e Aulas continuam ligados à publicação que os materializou. Retirar conteúdo numa nova publicação o oculta do currículo vivo, mas não apaga a publicação anterior, progresso, analytics, ativos R2/JMVStream ou auditoria.

### REG-LEA-002 Progresso é vivo

`getStudentCourseOverview`, `getStudentLessonWorkspace` e `completeLesson`, em `src/features/courses/server.ts`, calculam o progresso pelas Aulas obrigatórias ativas da publicação vigente. Aulas opcionais não entram no denominador. Publicar Aula obrigatória nova pode reduzir o percentual de uma Aluna já certificada; o certificado continua histórico e acessível.

### REG-LEA-003 Sequência e conclusão de Aula

`isLessonAvailable`, em `src/features/progress/rules.ts`, libera a Aula concluída, as anteriores e a primeira pendente. `completeLesson` é idempotente. A Aluna pode marcar qualquer Aula manualmente, sem visualização mínima. Evento JMVStream reconhecido em 98% ou mais é apenas uma segunda via automática. Repetições não duplicam `lesson_progress`.

### REG-LEA-004 Conclusão do Curso é histórica

`CourseCompletion` tem unicidade por Aluna e Curso e registra a primeira publicação/data de conclusão. Ela nasce automaticamente quando todas as Aulas obrigatórias vigentes forem concluídas, ou na emissão manual de certificado se ainda não existir. Revogar ou reemitir certificado não a apaga nem a reabre. Não existe ação administrativa separada para marcar conclusão.

### REG-LEA-005 Mídia e histórico

Vídeo usa JMVStream; capa, banner e materiais usam R2. Um ativo só pode ser removido quando nenhuma publicação publicada o referencia. Ver [JMVStream](../integrations/jmvstream.md) e [R2](../integrations/r2.md).

## Analytics de aprendizagem

Analytics é minimizado, habilitado por padrão e pode ser desligado em **Conta > Configurações**. Não altera acesso, sequência, progresso, conclusão ou certificado. O servidor deriva Matrícula, Aula e `CoursePublication`; o cliente não escolhe a identidade do evento. Eventos e métricas preservam a publicação para auditoria e comparação histórica, enquanto as consultas de elegibilidade usam a publicação vigente.

O painel é agregado por Aula e Publicação: elegíveis, início, conclusão, checkpoint mediano, tempos e falhas. Não exibe Aluna, Conta, e-mail, inatividade ou automação de reengajamento.

## Evidências

- schema: `coursePublications`, `courseCompletions`, `modules`, `lessons`, `enrollments`, `certificates` em `src/db/schema.ts`;
- autoria: `createCoursePublicationDraft` e `publishCoursePublication` em `src/features/admin/authoring.ts`;
- leitura/progresso: `src/features/courses/server.ts`;
- analytics: `src/features/learning-analytics/server.ts`;
- migration: `src/db/migrations/0035_course_publications_and_completions.sql`.

## Pendências

- não há coortes ou drip: só serão criados diante de calendário/grupo real;
- a migration 0035 precisa ser validada em banco descartável antes de promoção compartilhada;
- o racional histórico de 260 palavras/minuto para leitura não foi localizado.
