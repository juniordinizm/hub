---
status: canonical
owner: engineering
last_verified_commit: b97f9594d6b4c06efe6287225e86e6d9c637f1b5
---

# Conteúdo, aprendizagem e progresso

## Modelo

`Course` é a identidade comercial. `CoursePublication` é uma revisão interna materializada de Módulos e Aulas, com estados `draft`, `published` e `retired`. Há no máximo uma publicação publicada e uma em rascunho por Curso.

Matrícula concede acesso comercial ao Curso, não a uma publicação. Portanto, toda Matrícula ativa lê a publicação `published` vigente. Uma publicação nova alcança todas as Alunas com Matrícula ativa; acesso expirado, revogado ou bloqueado não lê conteúdo novo. Ver [ADR-0007](../adr/0007-course-versioning-and-enrollment-curriculum.md).

## Regras de domínio

### REG-LEA-001 Publicação é atômica e em lote

`createCoursePublicationDraft`, em `src/features/admin/authoring.ts`, clona a publicação vigente para um único rascunho. `publishCoursePublication` serializa o Curso com lock transacional, valida o rascunho, rejeita vídeo JMVStream sem player e só então copia a capa fora de uma transação aberta; uma segunda transação adquire o mesmo lock, revalida o estado e aposenta a publicada anterior, publica o rascunho e grava autora/data no audit log. Alterações concorrentes no rascunho são serializadas pelo mesmo lock e não atravessam a fronteira de publicação. Salvar conteúdo só é permitido no rascunho: não há correção direta em conteúdo publicado.

Publicar uma `CoursePublication` não altera visibilidade nem abre vendas. A
disponibilidade comercial é uma decisão administrativa separada, conforme
[ADR-0009](../adr/0009-course-availability-and-sale-interest.md).

Módulos e Aulas continuam ligados à publicação que os materializou. Cada Aula também tem uma chave curricular estável: ao clonar uma Aula para uma nova publicação, a chave é preservada e o `lesson_progress` anterior continua valendo; remover a Aula ou criar outra gera efeito no currículo vivo sem apagar histórico. Retirar conteúdo numa nova publicação o oculta do currículo vivo, mas não apaga a publicação anterior, progresso, analytics, ativos R2/JMVStream ou auditoria.

Reordenar conteúdo só aceita o conjunto completo de Módulos ou de Aulas dos Módulos afetados na mesma publicação em rascunho. Mover uma Aula entre Módulos renumera origem e destino em uma única transação; IDs de outra publicação ou Curso são rejeitados.

### REG-LEA-002 Progresso é vivo

`getStudentCourseOverview`, `getStudentLessonWorkspace` e `completeLesson`, em `src/features/courses/server.ts`, calculam o progresso pelas Aulas obrigatórias ativas da publicação vigente e reconhecem conclusões da mesma chave curricular em publicação anterior. Aulas opcionais não entram no denominador. Publicar Aula obrigatória nova pode reduzir o percentual de uma Aluna já certificada; o certificado continua histórico e acessível.

### REG-LEA-003 Sequência e conclusão de Aula

`isLessonAvailable`, em `src/features/progress/rules.ts`, libera a Aula concluída, as anteriores e a primeira pendente. `completeLesson` é idempotente. A Aluna pode marcar qualquer Aula manualmente, sem visualização mínima. Evento JMVStream reconhecido em 98% ou mais é apenas uma segunda via automática. Repetições não duplicam `lesson_progress`.

### REG-LEA-004 Conclusão do Curso é histórica

`CourseCompletion` tem unicidade por Aluna e Curso e registra a primeira publicação/data de conclusão. Ela nasce automaticamente quando todas as Aulas obrigatórias vigentes forem concluídas, ou na emissão manual de certificado se ainda não existir. `completeLesson` serializa por Conta e Curso, antes de gravar progresso e calcular o resumo; somente a transação que insere a primeira `CourseCompletion` pode disparar a emissão automática. Uma tentativa concorrente que encontra a conclusão existente não atualiza a linha e não tenta emitir Certificado ou gravar outbox. Revogar ou reemitir certificado não a apaga nem a reabre. Não existe ação administrativa separada para marcar conclusão. Conclusões históricas sem Certificado só entram no fluxo por reconciliação confirmada de Admin, em lote limitado; não há backfill silencioso.

### REG-LEA-004A Carga horária exibida

O valor exibido no catálogo, na experiência da Aluna e no certificado é a
carga horária efetiva do Curso. Sem override, ela é derivada pela soma das
durações das Aulas da publicação e atualizada quando o conteúdo muda. Um
administrador pode informar `courses.workload_hours_override` nas
configurações do Curso para exibir outro total inteiro não negativo. Remover o
valor manual retorna ao cálculo automático. Certificados já emitidos preservam
o snapshot anterior.

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
