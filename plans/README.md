# Auditoria integral e roadmap de evolução do Hub

```yaml
status: ready_for_decision
owner: product_and_engineering
planned_at_commit: 06f0c061e502b5990069acd7c4fb36d7fed13301
verified_on: 2026-07-20
scope: planning_only
```

## Resultado executivo

O Hub não precisa se transformar em um LMS horizontal. Sua vantagem é justamente ser
uma plataforma privada, de uma única especialista, com comércio, concessões de acesso,
matrículas, reembolsos e certificados modelados de forma mais rigorosa que a maioria
das referências inspecionadas.

Os problemas mais importantes não são ausência de funcionalidades de mercado. São
problemas de confiança operacional e de evolução:

1. a linha de migrations não reproduz o schema atual;
2. a emissão automática de certificado tem uma corrida que pode anunciar um código
   não persistido;
3. não existe CI versionada, E2E real nem teste de integração concorrente com Postgres;
4. checkout público usa rate limit local ao processo e devolve mensagens internas;
5. autenticação privilegiada não exige 2FA nem verificação de e-mail;
6. não há telemetria, readiness real, SLO ou evidência de restore testado;
7. capacidades de certificado e privacidade existem no backend, mas não formam
   jornadas administrativas completas;
8. conteúdo mutável, conclusão, certificado e futuras coortes ainda não têm política
   de produto ratificada;
9. analytics mede operação e dinheiro melhor que aprendizagem;
10. módulos centrais grandes concentram consultas, regras, efeitos e apresentação,
    dificultando testes comportamentais.

O roadmap separa:

- correções objetivas, que independem de opinião de produto;
- decisões que precisam ser ratificadas antes de implementação;
- oportunidades úteis, mas subordinadas ao foco da PROTEA-R;
- funcionalidades de referência que devem continuar fora do escopo.

Nenhum código, schema, migration, dependência ou configuração foi alterado nesta
auditoria.

## Como a auditoria foi feita

Evidência examinada:

- documentação canônica do Hub;
- rotas, componentes, módulos server, schema, migrations, scripts e testes;
- execução de verificações locais contra o `HEAD`;
- os cinco projetos em `.0ref/lms`;
- `.0ref/component-reference.jsx`;
- documentação oficial atual de Next.js 16.2.9, Better Auth, Neon e produtos de LMS;
- capacidades de mercado atuais de Teachable, Thinkific, Circle e Hotmart.

Limites:

- não foi aberta URL local, conforme regra do projeto;
- não foram inspecionados segredos nem valores de `.env.local`;
- os projetos em `.0ref` são snapshots ignorados pelo Git, sem commit upstream
  verificável;
- nenhum projeto de referência foi iniciado, instalado ou testado;
- UX de referência foi inferida por código, rotas, documentação e testes;
- infraestrutura de produção não foi acessada;
- a busca de projetos Neon visível no ambiente não encontrou um projeto do Hub;
- claims de runtime, performance, acessibilidade e produção continuam não verificados.

## Baseline verificável do Hub

No commit planejado:

- `bun audit`: passou, sem vulnerabilidades conhecidas reportadas;
- `bun run typecheck`: passou;
- `bun run check`: passou em 301 arquivos;
- `bun run test`: 310 testes passaram e 1 falhou;
- falha atual: `src/app/(student)/app/aulas/[lessonId]/page-source.test.ts` procura
  texto literal que foi movido para `LessonVideoProcessing`;
- `bun run knip`: falhou com quatro arquivos não usados, uma dependência não usada,
  uma dependência não declarada e exports não consumidos;
- não há `.github/` e, portanto, não há gate de CI versionado;
- não há Playwright/Cypress nem suite E2E;
- 28 dos 73 arquivos de teste inspecionam texto-fonte em vez de comportamento;
- `vitest.config.ts` executa tudo em ambiente `node`;
- o health check apenas declara processo vivo;
- não há `error.tsx`, `global-error.tsx`, `loading.tsx` ou `not-found.tsx` no App Router.

Esses resultados são baseline, não uma afirmação de que o produto não funciona.
Eles mostram que regressões de integração, navegador e concorrência ainda escapam ao
gate atual.

## Comparação por referência

### CourseLit 0.73.16

Use como referência de creator-commerce e comunicação:

- múltiplos formatos de conteúdo;
- drip;
- quizzes;
- comunidades;
- broadcasts, sequences e métricas de e-mail;
- relatórios por cliente.

Não copiar:

- Mongo com arrays e campos genéricos para o domínio financeiro;
- API key persistida diretamente;
- GraphQL, REST e worker paralelos sem necessidade comprovada;
- memberships e subscriptions apenas por paridade;
- árvore documental fragmentada entre múltiplos sites e READMEs.

O Hub é melhor em ledger financeiro, separação entre concessão e matrícula, conflitos
de pagamento, reembolso e certificado.

### LearnHouse 1.2.6

Use como referência de pedagogia, autoria e operação:

- atividades em blocos;
- assignments e submissões;
- histórico de aprendizagem;
- analytics;
- health por dependência;
- tokens com prefixo, hash, expiração e revogação;
- webhooks assinados, com retry e delivery log;
- organização clara de documentação por público.

Não copiar:

- topologia Next + FastAPI + Redis + Hocuspocus + CLI para o escopo atual;
- multi-organização, AI, code execution e colaboração em tempo real;
- threshold de cobertura baixo com subsistemas críticos excluídos;
- código AGPL;
- versões declaradas em documentação sem verificação automática.

### LearningPlatform

Use como referência experimental de aprendizagem:

- tentativas append-only separadas do estado atual;
- adaptive practice e spaced repetition como material de pesquisa;
- editor com blocos explícitos;
- taxonomia de activity log;
- rate limit durável e atômico.

Não copiar:

- acesso a todo curso publicado sem entitlement;
- mídia de curso pública;
- dupla propriedade Payload/Prisma sem chaves estrangeiras;
- audit log best-effort como trilha financeira;
- AI experimental e estado de geração em memória;
- script de Playwright sem specs como sinal de cobertura.

### Frappe Learning 2.45.2

Use como referência de LMS horizontal:

- Curso separado de Turma;
- quiz, assignment e submissão como domínio próprio;
- notas e highlights privados;
- conteúdo de instrutor;
- preview no editor;
- analytics por aula;
- import/export de curso.

Não copiar:

- SCORM extraído e servido no mesmo origin em iframe sem sandbox;
- progresso baseado em `course` informado pelo cliente;
- reserva de vaga por `count` seguido de insert;
- módulos de API/utilitários com mais de 2.500 linhas;
- testes scaffold sem assertions;
- comércio reduzido a estado mutável de pagamento.

O Hub é melhor em autorização sequencial, constraints no banco, ledger de acesso e
ciclo de certificado.

### Template Sanity/Stripe/Clerk

Classificação: tutorial visual, não benchmark de produção.

Útil apenas para:

- course sidebar;
- estado ativo/concluído;
- feedback compacto de progresso;
- navegação creator → enrollment.

Rejeitar:

- `userId`/`clerkId` fornecido pelo cliente;
- guarda de curso sem provar que a aula pertence ao curso;
- webhook que cria matrícula diretamente e sem lifecycle financeiro;
- token Sanity compartilhado como `serverToken` e `browserToken`;
- claims de acessibilidade não sustentados pelo código;
- ausência completa de testes.

### component-reference.jsx

O arquivo tem zero bytes. Não existe evidência visual, comportamental ou de
acessibilidade a comparar. Ele não deve fundamentar decisão até receber conteúdo
real.

## Onde o Hub está melhor

Preservar explicitamente:

- identidade e autorização resolvidas no servidor;
- RBAC próprio adequado ao produto single-tenant;
- sessão não usada como substituta de permissão;
- pedido, webhook, revisão, refund, grant e enrollment como conceitos distintos;
- idempotência e precedência financeira mais fortes que as referências;
- materiais privados por URL assinada;
- uploads diretos R2/JMVStream sem proxy pelo app;
- constraints e índices no Postgres;
- progressão sequencial validada no servidor;
- tracking de vídeo separado da conclusão;
- certificado com snapshot, revogação e substituição;
- verificação pública de certificado;
- documentação canônica pequena, indexada e com estados de decisão;
- arquitetura monolítica no bom sentido: menos deploys e menos sincronização para o
  escopo atual.

## Onde o Hub está pior

### Confiança e segurança

- migrations não reproduzíveis;
- scripts destrutivos/incompatíveis;
- corrida na emissão automática de certificado;
- entrega de e-mail fora de uma outbox;
- rate limit de checkout não distribuído;
- confiança implícita no primeiro `X-Forwarded-For`;
- mensagens de erro do provedor/configuração devolvidas ao público;
- 2FA não exigida para Admin/Suporte;
- e-mail não verificado;
- CSP e headers de segurança não configurados;
- auditoria de registrar/aprovar privacidade fora da mesma transação;
- health sem dependências;
- sem SLO, tracing, error monitoring ou teste de restore.

### Qualidade e arquitetura

- CI ausente;
- nenhum E2E;
- muitos testes frágeis de texto-fonte;
- ausência de teste real de concorrência e migrations;
- arquivos centrais de 1.000+ linhas com várias responsabilidades;
- helpers de material/arquivo duplicados entre autoria e player;
- telas administrativas carregam coleções inteiras e agregam em memória;
- ausência de fallbacks de erro/loading no App Router;
- imports/exports e jornadas backend detectadas como não usadas.

### Produto e aprendizagem

- política de conteúdo vivo versus versão congelada não ratificada;
- adicionar aula ativa pode alterar o denominador de progresso de alunas atuais;
- não há coorte, drip ou learning path;
- conclusão mede consumo, não aprendizagem;
- não há avaliação, tentativa, submissão, feedback ou nota;
- analytics não mostra drop-off, tempo por aula, inatividade ou dificuldade;
- comentários não têm uma camada consistente de notificação/reengajamento;
- aluna não possui notas privadas/highlights;
- autoria rica ainda é um documento Tiptap limitado, não blocos semânticos;
- não há portabilidade lógica de curso;
- acessibilidade não possui baseline, testes de teclado ou axe;
- certificado/privacidade não têm jornada administrativa fechada.

## Decisões diferentes que são corretas

Não são lacunas:

- não ser marketplace;
- não suportar múltiplas especialistas;
- não ter multi-tenancy;
- não ter subscription;
- não ter website builder, blog, podcast, AI, flashcards ou code execution;
- manter comentários contextuais em vez de comunidade ampla;
- usar Postgres relacional em vez de conteúdo/ledger em documentos genéricos;
- manter um deploy Next.js em vez de introduzir API, collab server, Redis e worker;
- não adotar SCORM sem um modelo de isolamento;
- não ter app nativo agora;
- não adotar gamificação, streaks ou badges sem objetivo pedagógico;
- não adotar turma/coorte antes de decidir versionamento.

## Fontes oficiais de mercado

As referências de mercado não são especificações para copiar. Elas mostram padrões
testados que ajudam a formular decisões:

- Teachable, course compliance:
  https://support.teachable.com/en/articles/11682463-course-compliance
- Teachable, certificados:
  https://support.teachable.com/en/articles/11682466-certificates-of-completion
- Teachable, relatórios:
  https://support.teachable.com/en/articles/11682570-course-reporting-tools
- Thinkific, learning paths:
  https://support.thinkific.com/hc/en-us/articles/19950070459927-Learning-Paths
- Thinkific, engagement dashboards:
  https://support.thinkific.com/hc/en-us/articles/15795863469463-Thinkific-Analytics-Engagement-Dashboards
- Circle, modelos de curso:
  https://help.circle.so/p/courses
- Circle, analytics de curso:
  https://help.circle.so/p/administration/analytics/course-analytics
- Hotmart, app e offline:
  https://help.hotmart.com/pt-br/article/10203471099917/como-acesso-e-utilizo-o-aplicativo-da-hotmart-
- Hotmart, certificado:
  https://help.hotmart.com/pt-br/article/115003666771/como-configurar-um-certificado-para-o-meu-curso-

Padrões úteis observados:

- conclusão é uma política configurável, não um booleano universal;
- curso já concluído não deve mudar silenciosamente quando uma nova aula é publicada;
- analytics acionável mostra drop-off e alunas desengajadas;
- drip, coorte e learning path são conceitos diferentes;
- avaliação tem tentativas, nota, feedback e regra de progressão explícitas;
- comunidade amplia muito o custo de moderação e notificação;
- offline/app nativo é uma estratégia de distribuição, não requisito básico de LMS.

## Roadmap priorizado

Cada executor deve ler o plano inteiro. Estados permitidos: `TODO`, `IN PROGRESS`,
`DONE`, `BLOCKED: motivo` e `REJECTED: motivo`.

| Plano | Resultado | Prioridade | Esforço | Dependência | Estado |
|---|---|---:|---:|---|---|
| 001 | migrations e ferramentas seguras | P0 | L | — | TODO |
| 002 | certificado concorrente/idempotente | P0 | M | 001 | TODO |
| 003 | CI e testes por risco | P0 | L | 001 | TODO |
| 004 | auth e fronteiras públicas | P1 | L | 003 | TODO |
| 005 | outbox e audit transacional | P1 | L | 001, 002 | TODO |
| 006 | observabilidade e recovery | P1 | L | 001 | TODO |
| 007 | jornadas admin de certificado/privacidade | P1 | L | 003, 005 | TODO |
| 008 | módulos mais profundos | P2 | L | 003 | TODO |
| 009 | UX resiliente e acessível | P2 | L | 003, 006 | TODO |
| 010 | versão de conteúdo/coorte | P1 decisão | L | 003 | TODO |
| 011 | avaliações | P2 decisão | L | 010 | TODO |
| 012 | analytics/reengajamento | P2 | L | 005, 010 | TODO |
| 013 | autoria/portabilidade | P3 | L | 008, 010 | TODO |

### Fase 0: restaurar confiança no estado atual

1. [Reparar evolução do banco e ferramentas locais](./001-database-evolution-and-safe-tooling.md)
2. [Tornar emissão de certificado concorrente e idempotente](./002-certificate-issuance-concurrency.md)
3. [Criar CI e uma pirâmide de testes orientada a riscos](./003-ci-and-risk-based-testing.md)
4. [Endurecer autenticação e limites públicos](./004-security-and-public-boundaries.md)
5. [Garantir efeitos assíncronos e auditoria crítica](./005-outbox-and-transactional-audit.md)
6. [Criar observabilidade, readiness e recuperação](./006-observability-and-recovery.md)

### Fase 1: fechar jornadas já prometidas

7. [Fechar operações de certificado e privacidade](./007-admin-certificate-and-privacy-workflows.md)
8. [Aprofundar módulos centrais sem reescrita](./008-architecture-deepening.md)
9. [Estabelecer baseline de UX resiliente e acessível](./009-learner-experience-and-accessibility.md)

### Fase 2: decidir o que “aprender” significa no Hub

10. [Ratificar conclusão, versões de conteúdo e coortes](./010-learning-policy-content-versions-and-cohorts.md)
11. [Decidir avaliações e evidência de aprendizagem](./011-assessments-and-learning-evidence.md)
12. [Modelar analytics de aprendizagem e reengajamento](./012-learning-analytics-and-reengagement.md)

### Fase 3: melhorar autoria, somente após uso comprovado

13. [Evoluir autoria e portabilidade de curso](./013-authoring-and-course-portability.md)

## Dependências

```text
001 banco seguro
  ├─> 002 certificado concorrente
  ├─> 003 CI com Postgres efêmero
  ├─> 005 outbox e auditoria
  └─> 006 restore/migrations em operação

003 testes reais
  ├─> 004 segurança
  ├─> 007 jornadas administrativas
  ├─> 008 arquitetura
  └─> 009 UX/acessibilidade

010 política pedagógica
  ├─> 011 avaliações
  ├─> 012 analytics
  └─> 013 autoria/versionamento
```

## Decisões que exigem ratificação humana

### D1. O que acontece quando uma aula é adicionada a um curso em andamento?

Recomendação: preservar a conclusão e o certificado de quem já concluiu; para alunas
em andamento, aplicar a nova aula apenas se ela pertencer à versão/coorte delas.

Razão simples: a aluna precisa saber qual promessa está cumprindo. Mudar a linha de
chegada depois da conclusão torna o certificado instável.

Decisão: Seguir a recomendação

### D2. O certificado prova consumo ou aprendizagem?

Recomendação: no curto prazo, declarar que prova conclusão do percurso. Só passar a
provar aprendizagem quando houver avaliação com critérios, tentativas e revisão.

Razão simples: assistir aulas e acertar uma avaliação são evidências diferentes.

Decisão: Não deve haver prova, o certificado é comprovante de conclusão de visualização de aulas.

### D3. A especialista precisa liberar conteúdo por calendário?

Recomendação: confirmar necessidade real antes de criar coorte/drip. Se sim, separar
`CourseVersion` (conteúdo) de `Cohort` (calendário e grupo).

Razão simples: coorte responde “quem e quando”; versão responde “qual conteúdo”.

Decisão: Não entendi muito bem, mas sugiro seguir o melhor para o projeto.

### D4. Qual o primeiro tipo de avaliação?

Recomendação: quiz objetivo de baixo risco, com tentativas append-only e regra de
aprovação configurável. Assignment manual somente se a especialista aceitar o custo
de correção e SLA.

Razão simples: assignment não é só um formulário; cria fila humana permanente.

Decisão: Sem avaliações.

### D5. O Hub quer comunidade ou apenas apoio contextual?

Recomendação: manter comentários por aula e adicionar notificação/menção antes de
considerar feed, grupos, eventos ou mensagens diretas.

Razão simples: comunidade exige descoberta, moderação, abuso, privacidade e
notificações. Comentário resolve uma dúvida localizada com custo menor.

Decisão: Manter comentários por aula, nao teremos comunidade.

### D6. 2FA será obrigatória para quem?

Recomendação: obrigatória para `admin` e `support`; opt-in para alunas inicialmente.

Razão simples: os papéis privilegiados podem alterar dinheiro, acesso, privacidade e
certificados. O dano de uma conta comprometida é maior.

Decisão: O 2FA será obrigatório para todos admin e suporte apenas.

## Achados considerados e rejeitados

Estes itens foram avaliados e não devem voltar como “lacuna” sem nova evidência:

- **Trocar Postgres por Mongo/Sanity/Payload**: piora consistência do ledger e não
  resolve uma necessidade atual.
- **Migrar para microservices**: os produtos de referência justificam múltiplos
  serviços pela amplitude; o Hub pagaria custo de deploy, auth e sincronização sem
  benefício proporcional.
- **Better Auth Admin/Organization**: o RBAC próprio é deliberado, pequeno e adequado
  ao single-tenant.
- **Subscriptions, bundles e múltiplos gateways**: não objetivos atuais; adicionar
  por paridade aumentaria reconciliação financeira.
- **Marketplace, múltiplas especialistas e multi-tenancy**: mudam o negócio.
- **Comunidade completa**: comentários contextuais atendem o caso atual com menor
  custo de moderação.
- **Gamificação, streaks e badges**: nenhuma meta pedagógica recuperável os exige.
- **AI, adaptive learning e spaced repetition**: subsistemas atraentes, mas
  incompatíveis com a profundidade pedagógica atual.
- **SCORM**: a referência contém um modelo inseguro; adotar exigiria origin isolado,
  sandbox e operação própria.
- **Colaboração de autoria em tempo real**: custo de um collab server sem evidência de
  múltiplos autores simultâneos.
- **GraphQL paralelo ao App Router**: criaria segunda superfície sem consumidor.
- **Copiar código das referências**: LearnHouse e Frappe são AGPL; os snapshots
  também não são prova de segurança ou produção.
- **Cobertura percentual como meta**: referências demonstram que volume/threshold
  pode esconder áreas críticas. O gate será por invariantes e jornadas.
- **Refatorar apenas por linhas de arquivo**: tamanho é sinal, não causa; o plano 008
  exige motivos de mudança e interfaces melhores.

## Critério de conclusão do roadmap

O Hub estará pronto para expansão pedagógica quando:

- banco novo nasce do zero e chega ao schema esperado;
- restore e rollback operacional foram ensaiados;
- gates de CI protegem domínio, browser e acessibilidade;
- certificado, webhook e e-mail toleram retry/concorrência;
- checkout e auth têm proteção compartilhada;
- falhas críticas geram sinal acionável;
- jornadas administrativas prometidas existem de ponta a ponta;
- política de conteúdo e conclusão está ratificada;
- métricas respondem perguntas de produto, não apenas contam eventos.
