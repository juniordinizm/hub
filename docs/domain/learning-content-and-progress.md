---
status: canonical
owner: engineering
last_verified_commit: e325b7e
---

# Conteúdo, aprendizagem e progresso

## Modelo

`Course` é a identidade comercial. `CoursePublication` é uma revisão interna materializada de Módulos e Aulas, com estados `draft`, `published` e `retired`. Há no máximo uma publicação publicada e uma em rascunho por Curso.

Matrícula concede acesso comercial ao Curso, não a uma publicação. Portanto, toda Matrícula ativa lê a publicação `published` vigente. Uma publicação nova alcança todas os Alunos com Matrícula ativa; acesso expirado, revogado ou bloqueado não lê conteúdo novo. Ver [ADR-0007](../adr/0007-course-versioning-and-enrollment-curriculum.md).

## Regras de domínio

### REG-LEA-001 Publicação é atômica e em lote

`createCoursePublicationDraft`, em `src/features/admin/authoring.ts`, clona a publicação vigente para um único rascunho. `publishCoursePublication` serializa o Curso com lock transacional, valida o rascunho, rejeita vídeo JMVStream sem player e só então copia a capa fora de uma transação aberta; uma segunda transação adquire o mesmo lock, revalida o estado e aposenta a publicada anterior, publica o rascunho e grava autora/data no audit log. Alterações concorrentes no rascunho são serializadas pelo mesmo lock e não atravessam a fronteira de publicação. Salvar conteúdo só é permitido no rascunho: não há correção direta em conteúdo publicado.

Publicar uma `CoursePublication` não altera visibilidade nem abre vendas. A
disponibilidade comercial é uma decisão administrativa separada, conforme
[ADR-0009](../adr/0009-course-availability-and-sale-interest.md).

Módulos e Aulas continuam ligados à publicação que os materializou. Cada Aula também tem uma chave curricular estável: ao clonar uma Aula para uma nova publicação, a chave é preservada e o `lesson_progress` anterior continua valendo; remover a Aula ou criar outra gera efeito no currículo vivo sem apagar histórico. Retirar conteúdo numa nova publicação o oculta do currículo vivo, mas não apaga a publicação anterior, progresso, analytics, ativos R2/JMVStream ou auditoria.

Reordenar conteúdo só aceita o conjunto completo de Módulos ou de Aulas dos Módulos afetados na mesma publicação em rascunho. Mover uma Aula entre Módulos renumera origem e destino em uma única transação; IDs de outra publicação ou Curso são rejeitados.

Módulo ativo pode carregar `release_delay_days`. Em Matrícula `scheduled`, o conteúdo fica disponível em `content_release_started_at + N × 24 horas`; a decisão temporal precede a sequência. O overview preserva título, descrição, contagem, duração agregada, data futura e metadados visuais das Aulas, como título, duração, thumbnail e indicação de vídeo, mas não entrega conteúdo rico, player, materiais ou ações. Aulas bloqueadas aparecem como cards e itens de navegação estáticos, sem link ou foco. Matrícula `full_access` e Aula concluída anteriormente atravessam o atraso.

### REG-LEA-002 Progresso é vivo

`getStudentCourseOverview`, `getStudentLessonWorkspace` e `completeLesson`, em `src/features/courses/server.ts`, calculam o progresso pelas Aulas obrigatórias ativas da publicação vigente e reconhecem conclusões da mesma chave curricular em publicação anterior. Aulas opcionais não entram no denominador. Publicar Aula obrigatória nova pode reduzir o percentual de um Aluno já certificado; o certificado continua histórico e acessível.

### REG-LEA-003 Sequência e conclusão de Aula

`isLessonAvailable`, em `src/features/progress/rules.ts`, libera a Aula concluída, as anteriores e a primeira pendente. `completeLesson` é idempotente. O Aluno pode marcar qualquer Aula manualmente, sem visualização mínima. Evento JMVStream reconhecido em 98% ou mais é apenas uma segunda via automática. Repetições não duplicam `lesson_progress`.

### REG-LEA-004 Conclusão do Curso é histórica

`CourseCompletion` tem unicidade por Aluno e Curso e registra a primeira publicação/data de conclusão. Ela nasce automaticamente quando todas as Aulas obrigatórias vigentes forem concluídas, ou na emissão manual de certificado se ainda não existir. `completeLesson` serializa por Conta e Curso, antes de gravar progresso e calcular o resumo; somente a transação que insere a primeira `CourseCompletion` pode disparar a emissão automática. Uma tentativa concorrente que encontra a conclusão existente não atualiza a linha e não tenta emitir Certificado ou gravar outbox. Revogar ou reemitir certificado não a apaga nem a reabre. Não existe ação administrativa separada para marcar conclusão. Conclusões históricas sem Certificado só entram no fluxo por reconciliação confirmada de Admin, em lote limitado; não há backfill silencioso.

### REG-LEA-004A Carga horária exibida

O valor exibido no catálogo, na experiência do Aluno e no certificado é a
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

O painel administrativo permite selecionar um Curso e um período de 1, 3, 6 ou 12 meses. Para o Curso escolhido, a tabela mostra uma linha por Aula da publicação vigente, na ordem do Curso; as contagens de início, conclusão e falha somam todas as versões da mesma chave curricular, enquanto checkpoint e tempos são recalculados sobre os registros disponíveis das versões. O KPI de visualização média do Curso calcula, para cada Matrícula ativa com analytics habilitado, a média do maior percentual registrado em cada Aula ativa; uma Aula concluída vale 100% e uma Aula sem registro vale 0%, inclusive quando o registro veio de uma versão anterior da mesma Aula. Matrículas ativas representam a fotografia atual do Curso e não são somadas entre versões. As versões históricas ficam disponíveis nos detalhes, e os KPIs e a exportação CSV ficam limitados ao Curso e período selecionados. Não exibe Aluno, Conta, e-mail, inatividade ou automação de reengajamento.

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
