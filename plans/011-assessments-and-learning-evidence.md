# Plan 011: Introduzir avaliação apenas com objetivo pedagógico explícito

> **Instruções ao executor**: não implemente quiz por paridade. Pare até produto e
> especialista definirem o que precisa ser aprendido e como será avaliado.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- PRODUCT.md docs/domain src/db/schema.ts src/features/courses`

## Status

- **Prioridade**: P2 de decisão, P3 de implementação
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: `010-learning-policy-content-versions-and-cohorts.md`
- **Categoria**: direction, product, domain-modeling
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

Hoje o Hub mede consumo. CourseLit, LearnHouse, LearningPlatform e Frappe possuem
quiz/assignment/tentativas; Teachable e Hotmart podem exigir nota para progressão.
Isso é uma lacuna apenas se o certificado ou percurso precisar provar aprendizagem.
Assignment manual cria uma fila humana e SLA permanente.

## Estado atual

- schema sem quiz, question, submission, attempt ou grade;
- conclusão depende de aulas ativas e watch/manual;
- certificado não declara competência avaliada;
- comentários não são submission;
- referências mais fortes mantêm tentativa histórica separada do estado agregado;
- LearningPlatform usa `TaskAttempt` append-only e `TaskProgress` atual;
- LearnHouse suporta file, quiz, form, feedback/retry e várias escalas;
- Frappe suporta quiz, assignment e programming exercise.

## Decisões obrigatórias

1. Qual resultado de aprendizagem será medido?
2. Formativa ou somativa?
3. Nota mínima? Quantas tentativas?
4. Questões embaralhadas/banco de questões?
5. Feedback imediato ou após encerramento?
6. A aprovação bloqueia aula, curso ou apenas informa?
7. Quem revisa resposta aberta e em qual prazo?
8. O certificado passa a declarar avaliação?
9. Como contestação/reset fica auditado?
10. Quais dados de tentativa serão retidos?

Recomendação: começar com quiz objetivo formativo; tentativas append-only; melhor
resultado derivado; configuração versionada junto ao curso. Só ligar a certificado
depois de evidência de uso e política ratificada.

## Escopo

**Em escopo após decisão**

- assessment versionada;
- questão objetiva e alternativas;
- attempt/submission append-only;
- score derivado;
- limite/reset auditado;
- feedback;
- integração opcional à progressão;
- analytics básico.

**Fora de escopo inicial**

- AI grading;
- proctoring;
- programação;
- SCORM/LTI;
- assignment de arquivo;
- banco compartilhado entre cursos;
- certificado de competência sem validade pedagógica.

## Passos

### 1. Escrever blueprint pedagógico

Para um módulo real, mapear objetivo → evidência → critério → feedback. Especialista
aprova conteúdo e custo operacional.

**Verificar**: toda questão tem objetivo; remover questão sem uso decisório.

### 2. Prototipar sem persistência de produção

Validar fluxo de tentativa, erro, retake, feedback e bloqueio com conteúdo real.
Testar com alunas e especialista.

**Verificar**: métricas de compreensão e suporte definidas antes de schema.

### 3. Modelar eventos e estado

Separar:

- definição/version;
- attempt;
- answer;
- score;
- aggregate de melhor/última tentativa;
- reset/review audit.

Não sobrescrever tentativas históricas.

**Verificar**: retry e concorrência produzem histórico determinístico.

### 4. Implementar vertical slice

Uma avaliação objetiva em uma versão de curso, com authoring, learner, score e admin.
Não criar framework para tipos futuros.

**Verificar**: E2E autor → publica → aluna responde → recebe feedback → retenta.

### 5. Decidir vínculo com conclusão

Somente após dados do slice. Se aprovado, atualizar plano 010 e certificado com
semântica explícita.

**Verificar**: transição não retroage para certificado já emitido.

## Critérios de pronto

- [ ] objetivo pedagógico aprovado;
- [ ] custo de correção/SLA conhecido;
- [ ] tentativas são append-only;
- [ ] configuração é versionada;
- [ ] reset e override são auditados;
- [ ] acessibilidade e teclado cobertos;
- [ ] vínculo com conclusão é explícito, não implícito.

## Condições STOP

- único motivo é “concorrentes têm”;
- especialista não pode manter banco/feedback;
- resposta aberta não tem reviewer/SLA;
- avaliação seria usada para diagnóstico clínico sem governança;
- modelo exige alterar certificados anteriores.

## Manutenção

Revisar qualidade das questões e distribuição de resposta. Não otimizar score sem
validade pedagógica.

