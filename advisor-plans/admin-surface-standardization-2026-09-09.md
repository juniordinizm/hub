---
status: complete
owner: product-and-engineering
planned_at_commit: f93a308e7e49ae8a8ca460fd750714b228863382
date: 2026-09-09
scope: admin-surface-standardization
---

# Plano de padronização do Admin a partir do Financeiro

Este plano leva para o restante do Admin o nível de clareza, evidência,
divulgação progressiva e segurança operacional alcançado no Financeiro. O
objetivo não é deixar as telas menores por princípio: é fazer cada superfície
responder uma pergunta principal, mostrar a próxima ação quando ela existir e
preservar os detalhes somente onde eles ajudam a decidir.

O plano foi escrito contra o commit `f93a308`, que contém o sprint anterior do
Dashboard e do Financeiro. O diretório `plans/` já contém o roadmap integral do
Hub; este plano fica em `advisor-plans/` para não misturar esse roadmap com a
execução específica de padronização do Admin.

## Resultado desejado

Depois da execução, a operação administrativa deve ter esta leitura:

- `/admin` responde “o que precisa de atenção agora?”;
- `/admin/alunos` responde “qual é o estado de acesso desta Aluna e que ação é
  segura?”;
- `/admin/cursos` responde “qual Curso preciso abrir ou publicar?”;
- `/admin/cursos/[courseId]` responde “qual parte deste Curso estou editando?”;
- `/admin/cursos/[courseId]/aulas/[lessonId]` responde “qual Aula estou
  configurando e como salvo a alteração?”;
- `/admin/aprendizagem` responde “o que os dados agregados de aprendizagem
  mostram e em qual janela?”;
- `/admin/auditoria` responde “qual operação falhou, qual é o backlog e como
  recuperar?”;
- `/admin/configuracoes` responde “qual configuração global ou conteúdo
  editorial preciso alterar?”;
- `/admin/operacao/cursos` continua sendo apenas uma compatibilidade para o
  fluxo canônico de Suporte.

## Linguagem e contratos que governam o plano

- **Superfície auditada:** Console Admin/Suporte em
  `src/app/(admin)/admin`, incluindo o shell compartilhado em
  `src/components/panel-layout.tsx`.
- **Fontes de design:** `DESIGN.md`, `PRODUCT.md`, `CONTEXT.md`,
  `docs/architecture.md`, `docs/domain/identity-and-authorization.md` e os
  padrões implementados no Financeiro.
- **Regra visual:** uma seção responde uma pergunta nova; a composição deve
  seguir a tarefa, não um molde de cards. Use `PageHeader`, `PageContainer`,
  `Card`, `Empty`, `Table`, `DataTable`, `Field`, `Badge`, `Dialog`, `Sheet` e
  `AdminMutationForm` existentes antes de criar novas abstrações.
- **Regra de evidência:** toda métrica deve indicar população, período, unidade,
  denominador, fonte e se é observada ou derivada quando isso mudar a
  interpretação.
- **Regra de autorização:** `admin`, `support` e `student` são papéis distintos.
  A UI pode esconder uma ação, mas a autorização efetiva continua no servidor.
  Não relaxar `requirePermission`, `requireRole` ou as guards das actions.
- **Regra de operação:** não remover Concessões, Matrículas, Pedidos,
  Revisões, inbox local de webhooks, Auditoria, upload/associação JMVStream,
  Certificados ou histórico financeiro apenas para reduzir a tela.
- **Regra de identidade:** `NeuroCapacitar Hub` é o shell da plataforma;
  `PROTEA-R` é identidade de Curso e não deve continuar nomeando o shell global.
- **Regra de estado:** usar `Sem base` quando não houver denominador, manter
  erros próximos da ação e não comunicar sucesso, saldo, acesso ou publicação
  com base somente em cor, ícone ou ausência de mensagem.
- **Referência externa aplicada:** as diretrizes atuais da Vercel reforçam
  labels acessíveis, foco visível, URL refletindo filtros/abas/paginação,
  estados vazios, erros com próximo passo e rolagem local. A referência não
  substitui `DESIGN.md` nem autoriza importar identidade ou componentes da
  Vercel: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Findings priorizados

### [P1-CORR-01] Corrigir população e limite da saúde do Dashboard

- **Evidência:** `src/features/admin/server.ts:504-575` carrega todos os Cursos
  e conta Módulos/Aulas por `course_id`, atravessando publicações históricas;
  `src/features/admin/presentation.ts:279-341` corta a lista de Cursos que
  precisam de atenção para quatro itens; `src/app/(admin)/admin/(dashboard)/page.tsx:111-116`
  usa o tamanho já cortado para o sinal operacional.
- **Impacto:** uma publicação antiga ou um rascunho pode fazer um Curso parecer
  pronto; com mais de quatro pendências, o Dashboard subconta o backlog e oculta
  itens sem dizer que a lista é uma amostra. A query cresce com o histórico
  mesmo que a tela mostre somente quatro prioridades.
- **Esforço:** L.
- **Risco:** MED; a correção altera números visíveis e precisa respeitar a
  publicação vigente e o contrato de prontidão.
- **Confiança:** HIGH.
- **Correção:** separar `totalCoursesNeedingAttention` de
  `priorityCourses`, selecionar a publicação corrente usada pelo detalhe do
  Curso, contar somente Módulos/Aulas ativos dessa publicação e retornar apenas
  os campos necessários à triagem. O sinal usa o total; a lista mostra a
  amostra e sua faixa.

### [P1-CORR-02] Fazer “Acessos” representar acesso efetivo

- **Evidência:** `src/features/admin/server.ts:88-96` conta somente linhas de
  Matrícula com `status = 'active'`; `src/features/enrollments/access.ts:27-80`
  também exige Curso publicado/ativo, início já alcançado e expiração ainda
  válida. O Dashboard chama o número de “Acessos” e “Matrículas vigentes” em
  `src/app/(admin)/admin/(dashboard)/page.tsx:74-84`.
- **Impacto:** uma execução de manutenção atrasada, uma Matrícula futura, um
  Curso arquivado ou uma publicação ausente pode inflar o número apresentado
  como acesso vigente.
- **Esforço:** M.
- **Risco:** MED; o número corrigido pode mudar em relação ao status persistido.
- **Confiança:** HIGH.
- **Correção:** criar uma projeção agregada com o mesmo predicado de acesso
  efetivo, ou renomear explicitamente o KPI para “Matrículas ativas
  registradas”. A recomendação é corrigir a população e cobrir datas,
  publicação, status e expiração.

### [P1-DATA-01] Separar KPIs globais da página de Alunas

- **Evidência:** `src/app/(admin)/admin/alunos/page.tsx:39-48` solicita uma
  página de Alunas e `:48` calcula `studentAccessSummary` usando
  `data.students`; `src/features/admin/server.ts:1957-2024` limita a leitura a
  `pageSize + 1`, cujo padrão é 100. Os cards continuam rotulados como
  “Alunas cadastradas”, “Com acesso ativo”, “Sem matrícula” e “Expirando em
  breve” em `src/app/(admin)/admin/alunos/page.tsx:87-109`.
- **Impacto:** ao passar de 100 Alunas, os cards mudam quando a operadora troca
  de página ou busca um nome. Um KPI que parece global passa a ser uma amostra
  da página atual, sem aviso.
- **Esforço:** M.
- **Risco:** MED; é necessário decidir e documentar que esses cards são sempre
  globais ou explicitamente filtrados.
- **Confiança:** HIGH.
- **Correção:** criar uma projeção agregada independente de `page` e `q`, com
  denominações equivalentes às do Financeiro, e manter a leitura paginada
  somente para a tabela. Se a busca precisar alterar os KPIs no futuro, isso
  deve ser indicado visualmente e coberto por outro contrato.

### [P1-UX-01] Tornar o sinal operacional explicativo e acionável

- **Evidência:** `src/features/admin/presentation.ts:60-72,346-402` calcula
  `helper` e `actionHref`; `src/app/(admin)/admin/(dashboard)/page.tsx:166-195`
  renderiza somente o badge e o CTA genérico “Abrir”. Quando o sinal é de
  pedidos pendentes, o destino atual é a raiz do Financeiro, sem os filtros de
  Pedido em aberto usados em `financial-overview.tsx:49-64`.
- **Impacto:** a operadora vê que existe algo para revisar, mas não por quê;
  para o caso de Pedido, precisa repetir a triagem dentro do Financeiro.
- **Esforço:** M.
- **Risco:** MED; deep links errados podem levar a uma população diferente da
  contagem mostrada.
- **Confiança:** HIGH.
- **Correção:** renderizar o helper dinâmico junto do estado e trocar “Abrir” por
  uma ação nomeada. Para pendências, apontar para
  `/admin/financeiro?tab=orders&status=pending&checkout=open`; para webhooks,
  Auditoria; para catálogo, Cursos.

### [P1-A11Y-01] Alinhar ordem do DOM, ordem visual e loading por papel

- **Evidência:** `src/app/(admin)/admin/(dashboard)/page.tsx:154-166` coloca os
  KPIs antes de “Saúde da operação” no DOM, mas usa `order-2`/`order-1` para
  inverter somente a apresentação. `src/app/(admin)/admin/(dashboard)/loading.tsx:21-40`
  também inclui uma seção fantasma. O mesmo loading serve ao branch Admin e ao
  branch Support, embora `support-dashboard.tsx:42-145` tenha outra topologia.
  `src/components/panel-layout.tsx:184-212` ainda não exclui
  `/admin/aprendizagem` da lista de páginas de topo e usa fallback único para
  Admin e Suporte.
- **Impacto:** leitores de tela e teclado encontram métricas antes do estado que
  usuários visuais veem primeiro; o estado de carregamento pode mostrar áreas
  inexistentes, especialmente para Support. O fallback do Support pode levar a
  `/admin/cursos`, que exige `manageContent`.
- **Esforço:** M.
- **Risco:** MED; altera a primeira leitura e a navegação de retorno.
- **Confiança:** HIGH.
- **Correção:** ordenar o JSX pela tarefa, remover `order-*` desnecessário,
  criar loading consciente do papel ou boundaries próprios, adicionar
  `aria-current="page"` ao link ativo da Sidebar, excluir Aprendizagem das
  páginas de topo e usar `userRole` no fallback de retorno.

### [P1-SEC-01] Reduzir a superfície de autorização das projeções

- **Evidência:** `src/features/admin/server.ts:74-96` autoriza
  `getAdminOverview` com `viewAdminPanel`, embora a consulta leia receita e
  falhas/retries de webhook. A página atual evita o caminho para Support em
  `src/app/(admin)/admin/(dashboard)/page.tsx:87-98`, mas a função exportada é
  mais ampla que o seu guard. `src/lib/auth-policy.ts:45-64` confirma que
  Support não possui as capacidades globais de Auditoria.
- **Impacto:** não há exploração demonstrada no caminho atual, mas um novo
  caller de Support pode reutilizar a projeção do shell e receber dados
  financeiros/operacionais além da finalidade autorizada.
- **Esforço:** M.
- **Risco:** MED; callers existentes precisam ser inventariados antes de
  apertar o contrato.
- **Confiança:** HIGH.
- **Correção:** separar projeções por capacidade ou tornar a projeção de Admin
  explicitamente Admin-only. Preservar guards no servidor mesmo que a página já
  faça a seleção de papel.

### [P1-ERR-01] Manter erros das mutações administrativas junto da ação

- **Evidência:** `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx:115-132`
  e `course-availability-form.tsx:106-121` comunicam falhas principalmente
  por toast; `course-publication-action.tsx:50-68` faz o mesmo. O contrato de
  `AdminMutationForm` em `src/components/admin-mutation-form.tsx:70-127` já
  mantém erro inline. `lesson-sidebar-actions.tsx:46-70` tem estado inline, mas
  o formulário ainda possui `action` nativa e o botão `type="submit"` com
  tratamento somente no `onClick` em `:91-99`.
- **Impacto:** uma falha de salvar, publicar ou alterar disponibilidade pode
  desaparecer antes de a operadora corrigir o campo. Pressionar Enter no editor
  de Aula pode seguir um caminho diferente do clique, sem o mesmo loading e
  mensagem.
- **Esforço:** M.
- **Risco:** MED; a correção precisa preservar Server Actions, dirty state,
  confirmações de preço/publicação e não duplicar submits.
- **Confiança:** HIGH.
- **Correção:** padronizar mutações críticas em um módulo de formulário com
  `loading`, erro inline, `aria-live` e recuperação. Tornar o submit do editor
  dono do caminho tanto para clique quanto para Enter; não confiar em toast como
  única evidência de falha.

### [P2-LIST-01] Aplicar uma única linguagem de busca, filtro e paginação

- **Evidência:** Financeiro usa pills, limpeza correta, faixa/total e estados
  vazios em `financial-orders-table.tsx:134-294`; Alunas usa formulário simples
  e sempre renderiza botões desabilitados em `students-table.tsx:171-232`;
  matrículas do Curso não exibem faixa/total junto do controle em
  `course-enrollments-table.tsx:167-225`; Support por Curso não retorna total e
  exibe somente botões em `operacao/cursos/[courseId]/alunas/page.tsx:76-127`;
  Auditoria recebe `totalCount`, mas não o mostra em `page.tsx:417-507`.
- **Impacto:** cada lista ensina um comportamento diferente, e a operadora não
  sabe se está vendo o universo, a página atual ou uma busca parcial. Botões
  desabilitados sem necessidade ocupam atenção.
- **Esforço:** M.
- **Risco:** LOW/MED; URLs existentes e bookmarks precisam continuar válidos.
- **Confiança:** HIGH.
- **Correção:** reutilizar a composição vencedora do Financeiro: busca com
  label, filtro ativo/removível quando aplicável, limpeza que remove todo o
  estado, faixa/total, estado vazio específico e paginação renderizada somente
  quando necessária. Criar um módulo compartilhado apenas se a interface de
  seus adaptadores permanecer pequena; não criar um componente genérico cheio
  de flags.

### [P2-CAT-01] Fazer o catálogo usar uma projeção própria e uma ação por Curso

- **Evidência:** `src/app/(admin)/admin/cursos/page.tsx:74-274` renderiza um
  link de título com pseudo-elemento cobrindo o card e outro link “Gerenciar
  curso” para o mesmo destino. `src/app/(admin)/admin/cursos/loading.tsx:15-22`
  ainda simula busca removida. `src/features/admin/server.ts:2164-2192`
  retorna `lessons: []` e `modules: []` que o consumidor não usa, enquanto
  `readCourses` mantém muitos campos e agregados para o detalhe.
- **Impacto:** há dois alvos para a mesma navegação, o loading promete um
  controle inexistente e o contrato do catálogo carrega dados de outra
  superfície.
- **Esforço:** M.
- **Risco:** LOW/MED; preservar links antigos, paginação e abertura do diálogo
  de criação.
- **Confiança:** HIGH.
- **Correção:** manter um único CTA explícito por card, criar uma projeção de
  card com somente os campos exibidos, remover `lessons`/`modules` vazios do
  retorno do catálogo e fazer o skeleton refletir a tela final. Se a paginação
  continuar, retornar total e faixa; não adicionar busca apenas para compensar
  o contrato.

### [P2-COURSE-01] Separar dados pesados das abas de Curso sem perder rascunhos

- **Evidência:** `src/app/(admin)/admin/cursos/[courseId]/page.tsx:61-126`
  consulta simultaneamente detalhe completo, resumo, templates de certificado,
  publicação e emissor, independentemente da aba. `course-management-tabs.tsx:69-110`
  monta todas as abas e usa `forceMount` no Certificado; o detalhe completo
  carrega Módulos, Aulas e uma página de Alunas mesmo quando a operadora abre
  somente Visão geral.
- **Impacto:** cada entrada no Curso paga o custo de todas as tarefas, aumenta o
  payload e mantém editor de certificado montado sem necessidade. Remover
  `forceMount` sem desenho de estado pode perder alterações não salvas.
- **Esforço:** L.
- **Risco:** HIGH; mudar a estratégia de abas pode perder rascunhos, foco,
  uploads ou deep links.
- **Confiança:** HIGH para o overfetch; MED para a melhor solução final.
- **Correção:** fazer um spike de projeções por aba. A solução deve preservar
  `tab` na URL, advertir sobre alterações não salvas ou manter estado local de
  forma explícita. Preferir módulos profundos como
  `getAdminCourseOverviewData`, `getAdminCourseContentData`,
  `getAdminCourseStudentsData` e `getAdminCourseCertificateData` a um DTO que
  carregue tudo; não implementar somente removendo `forceMount`.

### [P2-SUPPORT-01] Tornar a operação de Support específica e escalável

- **Evidência:** `src/features/admin/support-server.ts:105-163` consulta todos os
  Cursos com dois `cross join lateral` por Curso; `support-dashboard.tsx:29-90`
  soma e renderiza toda a coleção. A página de Alunas por Curso chama
  `getSupportCourseOperations()` novamente apenas para encontrar o título em
  `operacao/cursos/[courseId]/alunas/page.tsx:42-51`.
- **Impacto:** o Support carrega e serializa dados de todos os Cursos para uma
  tela ou para obter um único contexto; o custo e a altura da página crescem
  sem limite explícito.
- **Esforço:** M.
- **Risco:** MED; o Support ainda precisa consultar totais globais e preservar
  sua visibilidade financeira.
- **Confiança:** HIGH.
- **Correção:** criar uma leitura de contexto por `courseId`, separar totais
  globais da página visível e definir paginação somente se a população deixar
  de ser pequena. Não esconder Cursos com um limite silencioso; mostrar total e
  faixa se a lista for limitada.

### [P2-LEARNING-01] Explicitar janela e população do relatório de Aprendizagem

- **Evidência:** `src/features/learning-analytics/server.ts:143-333` mistura
  elegibilidade atual, métricas diárias de até 13 meses, conclusão sem a mesma
  janela e tempos calculados nos últimos 90 dias. `src/app/(admin)/admin/aprendizagem/page.tsx:31-150`
  mostra a tabela sem janela, denominador, faixa/total ou paginação.
- **Impacto:** a operadora pode comparar números de populações e períodos
  diferentes como se fossem o mesmo funil. O retorno completo também cresce com
  o número de Aulas.
- **Esforço:** M/L.
- **Risco:** MED; alterar a janela pode mudar decisões de produto e exportação.
- **Confiança:** HIGH.
- **Correção:** primeiro documentar e exibir as janelas atuais; depois decidir
  se o funil deve usar uma janela única. Adicionar projeção paginada para a
  tabela, manter CSV com o contrato explicitado e usar “Sem base” em vez de
  `—` quando não houver observação. Não adicionar gráficos ou KPIs sem uma
  pergunta comprovada.

### [P2-AUDIT-01] Completar a leitura de filas na Auditoria

- **Evidência:** `src/features/admin/server.ts:2096-2154` retorna
  `totalCount`/`hasNextPage` para webhooks, e `listOutboxDeadLetters` retorna a
  mesma metadata em `src/features/outbox/server.ts:358-399`; a UI em
  `src/app/(admin)/admin/auditoria/page.tsx:417-592` exibe busca e links, mas
  não mostra faixa/total nem pills de busca. A mensagem default de auditoria
  expõe `log.action` em `page.tsx:130-223`, e o Support expõe ações cruas em
  `src/components/admin/student-management-sheet.tsx:74-151`.
- **Impacto:** a fila é funcional, mas a operadora não sabe quantos itens há no
  conjunto filtrado e códigos internos aparecem como copy primária em alguns
  contextos.
- **Esforço:** M.
- **Risco:** LOW/MED; não esconder IDs necessários para investigação.
- **Confiança:** HIGH.
- **Correção:** mostrar faixa/total, limpar busca de modo explícito, traduzir
  ações conhecidas e colocar o código bruto em detalhe técnico. Manter payload
  fora da tabela comum, retry Admin-only e link para a telemetria do Asaas.

### [P2-SETTINGS-01] Organizar Configurações por responsabilidade

- **Evidência:** `src/app/(admin)/admin/configuracoes/page.tsx:56-214`
  empilha Saúde JMVStream, emissor de certificados, banners e FAQ como quatro
  cards equivalentes. O JMV tem quatro tiles em `:88-105`, mas
  `configuracoes/loading.tsx:22-41` ainda desenha cinco. O input de arquivo de
  banners em `banners/banner-gallery.tsx:313-331` não tem label ou
  `aria-label`, somente `title`.
- **Impacto:** integração, dado operacional e conteúdo editorial competem na
  mesma hierarquia; o loading produz layout incorreto; o upload depende de um
  controle invisível sem nome robusto para teclado/tecnologia assistiva.
- **Esforço:** M.
- **Risco:** LOW; preservar upload, recorte, ordenação, FAQ e link do provider.
- **Confiança:** HIGH.
- **Correção:** agrupar visualmente Integrações, Certificados e Conteúdo
  editorial, usando duas colunas apenas onde a altura e a tarefa permitirem;
  corrigir o skeleton; associar o input a um label acessível. Não transformar
  quatro cards em tabs sem evidência de necessidade.

### [P2-ARCH-01] Aprofundar os módulos administrativos antes de adicionar mais UI

- **Evidência:** `src/features/admin/server.ts` tem cerca de 2.545 linhas e
  concentra projeções de Dashboard, Cursos, Alunas, Financeiro, Auditoria e
  Configurações; `authoring.ts` e `actions.ts` também concentram muitas regras.
  O catálogo ainda retorna campos vazios para manter um contrato legado em
  `server.ts:2164-2192`.
- **Impacto:** uma mudança de uma superfície exige navegar por um módulo grande,
  aumenta o risco de importar a projeção errada e dificulta testar a fronteira
  de cada tela.
- **Esforço:** L.
- **Risco:** MED/HIGH; extrações apressadas podem duplicar autorização ou
  quebrar transações.
- **Confiança:** HIGH para a concentração; MED para a divisão ideal.
- **Correção:** extrair por seam de leitura, não por tamanho: Dashboard,
  Alunas/Suporte, Cursos, Financeiro, Auditoria e Configurações devem ter
  interfaces pequenas e projeções específicas, mantendo a autorização dentro
  de cada entrada. Começar pelo DTO legado do catálogo e pelas projeções de
  Curso por aba; não dividir `server.ts` inteiro em uma única mudança.

## O que deve permanecer como está

- A separação de responsabilidades das rotas administrativas.
- Últimas compras e últimos certificados no Dashboard, como listas curtas de
  triagem.
- A fila local de webhooks, o retry auditado e a relação local com Pedido,
  acesso e Revisão.
- A fila de Revisões, histórico em Sheet, conciliação, reembolso e evidências
  de parcelas no Financeiro.
- O upload e a associação de vídeos JMVStream no contexto da Aula.
- A Auditoria como dona da fila detalhada de recuperação.
- A rota legada `/admin/operacao/cursos` como redirect de compatibilidade.
- O relatório agregado de Aprendizagem e sua exportação CSV, até que uma
  decisão de janela/uso indique evolução.
- As permissões server-side e as confirmações de operações destrutivas.
- O tema dark-only, Hugeicons, tokens OKLCH e primitives locais do shadcn.

## Plano de execução por fases

### Fase 0 — Contratos e caracterização

**Objetivo:** registrar as populações atuais e criar testes que impeçam a
reorganização visual de esconder uma regressão de dados.

**Arquivos principais:**

- `src/features/admin/presentation.ts`
- `src/features/admin/server.ts`
- `src/features/admin/support-server.ts`
- `src/app/(admin)/admin/(dashboard)/page.test.tsx`
- `src/app/(admin)/admin/alunos/page.test.tsx` ou novo teste da projeção
- `src/features/admin/server-read-projections.test.ts`
- `src/features/admin/server-authorization-contract.test.ts`

**Passos:**

1. Definir tipos separados para total e amostra de saúde do catálogo.
2. Definir o predicado de acesso efetivo em um módulo puro ou query nomeada,
   sem copiar uma condição divergente para cada KPI.
3. Definir explicitamente que KPIs de Alunas são globais e independentes de
   `page`/`q`, salvo decisão futura documentada.
4. Adicionar casos de múltiplas publicações, Curso arquivado, Aula histórica,
   Matrícula futura/expirada, checkout fechado e mais de quatro Cursos
   pendentes.
5. Adicionar testes negativos de Support para qualquer projeção exclusiva de
   Admin.

**Verificação:**

```text
bun run test -- src/features/admin/presentation.test.ts src/features/admin/server-read-projections.test.ts src/app/(admin)/admin/(dashboard)/page.test.tsx
```

Esperado: todos os testes afetados passam e os novos casos distinguem total,
amostra, população efetiva e papel autorizado.

### Fase 1 — Dashboard Admin orientado a triagem

**Objetivo:** fazer a primeira leitura visual e semântica responder a mesma
pergunta.

**Arquivos principais:**

- `src/app/(admin)/admin/(dashboard)/page.tsx`
- `src/app/(admin)/admin/(dashboard)/loading.tsx`
- `src/features/admin/presentation.ts`
- `src/features/admin/server.ts`
- `src/components/panel-layout.tsx`
- `src/components/ui/sidebar.tsx`

**Passos:**

1. Reordenar o JSX para que Saúde da operação venha antes dos KPIs quando esse
   for o primeiro bloco desejado; remover `order-*` que só altera a camada
   visual.
2. Renderizar `operationSignal.helper` e substituir “Abrir” por rótulos de
   destino concretos.
3. Usar o total do backlog de catálogo no sinal e exibir a lista como
   “Prioridades do catálogo”, com indicação de amostra quando existirem mais
   Cursos do que os mostrados.
4. Exibir “Sem base” e omitir `Progress` quando não houver Curso, em vez de
   comunicar prontidão de `0%`.
5. Qualificar “Receita paga” como receita bruta do histórico completo e deixar
   visível que não é saldo do Asaas. Usar “Compradora não identificada” como
   fallback de compra, não “Aluna”. Incluir checkout encerrado quando ele mudar
   a interpretação do Pedido recente.
6. Criar loading equivalente para Admin e Support. Se o boundary comum não
   puder conhecer o papel com segurança, separar o shell de loading por
   segmento em vez de mostrar blocos que não existem.
7. Corrigir `aria-current="page"` no link ativo da Sidebar e o fallback de
   retorno pelo papel do usuário. Incluir `/admin/aprendizagem` nas rotas de
   topo sem botão Voltar.
8. Se uma projeção independente falhar, preferir estado indisponível explícito
   para aquela seção. Não transformar falha em zero e não mascarar falha de
   receita ou acesso.

**Verificação:**

```text
bun run test -- src/app/(admin)/admin/(dashboard)/page.test.tsx src/app/(admin)/admin/support-dashboard.test.tsx src/app/(admin)/admin/admin-sidebar-nav.test.tsx src/features/admin/presentation.test.ts
bun run check
bun run typecheck
```

Esperado: caminho Admin, caminho Support, links de prioridade, estado vazio e
seleção de navegação passam sem alterar permissões.

### Fase 2 — Alunas e operação de Support

**Objetivo:** levar a tabela e a ficha de Aluna ao padrão de consulta do
Financeiro, preservando o contexto e as capacidades de cada papel.

**Arquivos principais:**

- `src/app/(admin)/admin/alunos/page.tsx`
- `src/app/(admin)/admin/alunos/students-table.tsx`
- `src/features/admin/server.ts`
- `src/app/(admin)/admin/operacao/cursos/[courseId]/alunas/page.tsx`
- `src/app/(admin)/admin/operacao/cursos/[courseId]/alunas/support-course-students-table.tsx`
- `src/features/admin/support-server.ts`
- `src/components/admin/student-management-sheet.tsx`

**Passos:**

1. Introduzir a projeção global de resumo de Alunas e deixar a tabela consumir
   somente a página solicitada.
2. Mostrar faixa/total no cabeçalho ou rodapé da tabela, esconder paginação
   quando não houver próxima/anterior e adicionar pill de busca/limpeza sem
   perder o query param legítimo.
3. Transformar “Ativo/Bloqueado” em apresentação textual semântica consistente
   com `Badge`/status quando isso melhorar a comparação; nunca depender de cor.
4. Na operação por Curso, retornar título/contexto por `courseId` em vez de
   carregar todos os Cursos, adicionar `totalCount` e usar a mesma toolbar de
   busca/paginação.
5. Preservar `StudentManagementSheet`, mas traduzir ações de auditoria e
   manter pedidos, histórico, progresso e liberação progressiva dentro do
   contexto correto.
6. Manter Support sem acesso a edição de conteúdo, bloqueio global ou
   conciliação; provar isso por testes negativos, não apenas pela ausência do
   botão.
7. Medir a população de Cursos antes de paginar o Dashboard Support. Se ela
   continuar pequena, manter a lista simples; se crescer, separar totais
   globais da lista e mostrar faixa/total.

**Verificação:**

```text
bun run test -- src/features/admin/server-read-projections.test.ts src/features/admin/support-server.test.ts src/app/(admin)/admin/alunos/students-table.test.tsx src/app/(admin)/admin/operacao/cursos/[courseId]/alunas/page.test.tsx
bun run check
bun run typecheck
```

Esperado: KPIs não mudam com `page`/`q`, páginas vazias são honestas e os
capabilities de Admin/Support continuam distintos.

### Fase 3 — Cursos: catálogo, projeções e navegação

**Objetivo:** remover duplicação de ação e contratos rasos sem reduzir a
capacidade de autoria.

**Arquivos principais:**

- `src/app/(admin)/admin/cursos/page.tsx`
- `src/app/(admin)/admin/cursos/loading.tsx`
- `src/features/admin/server.ts`
- `src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.tsx`
- testes do catálogo e das abas.

**Passos:**

1. Criar uma projeção de card de Curso com somente título, subtítulo, capa,
   status, preço, duração e contagens realmente renderizados.
2. Remover `lessons: []` e `modules: []` do contrato do catálogo quando todos
   os callers e testes tiverem sido migrados.
3. Escolher um único alvo de navegação por card. A recomendação é manter o CTA
   explícito “Gerenciar curso” e retirar o pseudo-link de título, salvo prova
   de que o card inteiro é o padrão desejado; não manter dois links para a
   mesma ação.
4. Corrigir o loading que ainda mostra busca. Se a paginação permanecer,
   adicionar `totalCount` e faixa; se a população permanecer comprovadamente
   pequena, registrar a decisão antes de remover qualquer controle.
5. Trocar `window.history.pushState` por `router.push` ou outro seam já usado
   pelo Financeiro somente depois de testar preservação de hash, query e
   estado de rascunho.

**Verificação:**

```text
bun run test -- src/features/admin/server-read-projections.test.ts src/app/(admin)/admin/cursos/page.authorization.test.ts src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.test.tsx
bun run check
bun run typecheck
```

Esperado: uma ação clara por Curso, bookmarks preservados, sem campo de busca
falso no loading e contrato de catálogo sem campos vazios.

### Fase 4 — Curso detalhado e editor de Aula

**Objetivo:** reduzir overfetch e manter a edição segura.

**Arquivos principais:**

- `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- `src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.tsx`
- `src/features/admin/server.ts`
- `src/app/(admin)/admin/cursos/[courseId]/course-overview.tsx`
- `course-content-panel.tsx`
- `course-dialogs-client.tsx`
- `course-availability-form.tsx`
- `course-publication-action.tsx`
- `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx`
- `lesson-sidebar-actions.tsx`

**Passos:**

1. Fazer um spike com as cinco abas e medir queries, payload e estado não salvo.
   Não remover `forceMount` diretamente.
2. Escolher entre projeções server-side por aba com navegação de rota, ou
   carregamento tardio de módulos client-side. A escolha deve preservar
   deep-link, foco, uploads e alterações não salvas; se exigir aviso de saída,
   especificá-lo antes de implementar.
3. Criar seams de leitura pequenos para Visão geral, Conteúdo, Alunas,
   Configurações e Certificado, mantendo os comandos de autoria separados dos
   read models.
4. Padronizar os formulários críticos em `AdminMutationForm` ou em um módulo
   equivalente, com erro persistente junto do campo/seção e loading no botão.
   Manter AlertDialog para preço, publicação, arquivamento e exclusão.
5. Corrigir o submit do editor de Aula para que clique e Enter usem o mesmo
   caminho, com estado de erro e prevenção de dupla submissão.
6. Reorganizar o DOM do editor para que o `h1` da Aula e o contexto Curso/Módulo
   apareçam antes do conteúdo editável. Se o layout desktop exigir coluna
   lateral, usar grid/áreas sem inverter a ordem semântica.
7. Preservar upload JMV, editor de texto, anexos, comentários, reorder por
   teclado e a regra de publicação do Curso.

**Verificação:**

```text
bun run test -- src/app/(admin)/admin/cursos/[courseId]/page.test.tsx src/app/(admin)/admin/cursos/[courseId]/course-content-panel.test.tsx src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.test.tsx src/components/course-builder-dnd.test.tsx
bun run check
bun run typecheck
```

Esperado: o editor continua preservando dados, publicação e uploads, e Enter
não bypassa o feedback do save. Se o teste exigir uma nova rota ou migration,
parar e registrar a decisão antes de ampliar o escopo.

### Fase 5 — Relatório de Aprendizagem

**Objetivo:** fazer o relatório avançado ser interpretável e escalável, sem
transformá-lo em um novo Dashboard.

**Arquivos principais:**

- `src/features/learning-analytics/server.ts`
- `src/app/(admin)/admin/aprendizagem/page.tsx`
- `src/app/(admin)/admin/aprendizagem/loading.tsx`
- `src/app/api/admin/learning-analytics/export/route.ts`

**Passos:**

1. Registrar o contrato das janelas: elegibilidade atual, eventos diários até
   13 meses, conclusão e tempos dos últimos 90 dias, ou decidir uma janela
   única com Produto.
2. Exibir período, população e aviso de métrica agregada próximo da tabela e
   na exportação.
3. Paginar o retorno da tabela com faixa/total, mantendo a exportação completa
   separada. Não adicionar busca por Curso sem evidência de que a população
   deixou de ser pequena; a tabela é por Aula e Publicação, não uma lista curta
   de Cursos.
4. Substituir `—` por `Sem base`/`Não disponível` conforme o significado do
   dado, mantendo `tabular-nums` e alinhamento numérico.
5. Avaliar mover a ação de CSV para o `PageHeader` ou manter no cabeçalho da
   tabela, escolhendo um único local de ação.

**Verificação:**

```text
bun run test -- src/app/(admin)/admin/aprendizagem/page.test.tsx src/app/api/admin/learning-analytics/export/route.test.ts src/features/learning-analytics/server.test.ts
bun run check
bun run typecheck
```

Esperado: a tabela e o CSV comunicam a mesma janela; valores ausentes não são
interpretados como zero; a UI não carrega uma coleção ilimitada sem metadata.

### Fase 6 — Auditoria e Configurações

**Objetivo:** aplicar a mesma divulgação progressiva e hierarquia de operação às
duas superfícies restantes.

**Arquivos principais:**

- `src/app/(admin)/admin/auditoria/page.tsx`
- `src/features/admin/server.ts`
- `src/features/outbox/server.ts`
- `src/app/(admin)/admin/auditoria/loading.tsx`
- `src/app/(admin)/admin/configuracoes/page.tsx`
- `src/app/(admin)/admin/configuracoes/loading.tsx`
- `src/app/(admin)/admin/configuracoes/banners/banner-gallery.tsx`
- `src/app/(admin)/admin/configuracoes/faq/faq-table.tsx`
- `src/components/admin/student-management-sheet.tsx`

**Passos:**

1. Na Auditoria, mostrar faixa/total de webhooks e dead letters, busca ativa e
   limpeza explícita; manter retry Admin-only e motivo obrigatório.
2. Separar visualmente “Sinais operacionais”, “Recuperação” e “Registro”, sem
   criar outra rota para webhooks.
3. Reutilizar apresentação de ações/status conhecida; manter ação bruta/ID em
   detalhe técnico com `translate="no"` quando aplicável.
4. Fazer o loading da Auditoria conter também o registro final e respeitar os
   estados de alertas sem inventar linhas.
5. Em Configurações, agrupar Integrações, Certificados e Conteúdo editorial;
   manter JMV read-only e link para o portal.
6. Corrigir o skeleton de quatro tiles JMV e nomear o input de banner com label
   acessível. Preservar recorte, upload, drag-and-drop, ordenação e confirmação
   destrutiva.
7. Manter erros de operações críticas visíveis, sem remover toasts de sucesso
   que sejam úteis como confirmação complementar.

**Verificação:**

```text
bun run test -- src/app/(admin)/admin/auditoria/page.test.tsx src/app/(admin)/admin/configuracoes/faq/faq-table.test.tsx src/app/(admin)/admin/configuracoes/banners/banner-gallery.test.ts src/features/outbox/server.test.ts
bun run check
bun run typecheck
```

Esperado: filas mostram a população, Configurações não promete controles
inexistentes e uploads/FAQ continuam operacionais.

### Fase 7 — Integração, escala e documentação

**Objetivo:** consolidar o padrão sem criar cópias divergentes.

**Passos:**

1. Depois das fases anteriores, extrair read models administrativos por seam
   real, começando pelos contratos de catálogo, Dashboard e abas de Curso. Não
   fazer uma divisão mecânica de `server.ts`, `authoring.ts` ou `actions.ts`.
2. Reexecutar `EXPLAIN (ANALYZE, BUFFERS)` para saúde de catálogo, KPI de
   Alunas, lista Support, relatório de Aprendizagem e filas de Auditoria.
   Índice/cache só entra com população e ganho medidos.
3. Adicionar integração PostgreSQL para publicações, acesso efetivo, somas
   grandes, páginas vazias e estados de checkout; adicionar testes de negação
   por papel.
4. Atualizar `PRODUCT.md`, `DESIGN.md` somente se um contrato visual novo for
   aprovado, `docs/architecture.md`, guias de domínio e runbooks quando
   projeção, autorização, migration, janela de analytics ou procedimento
   mudar.
5. Atualizar testes E2E estáticos e, em um ambiente autorizado a abrir a
   aplicação, executar os fluxos de Admin e Support em viewport estreito e
   largo. A regra atual do projeto impede executar URL local nesta máquina.

**Verificação final:**

```text
bun run verify
```

Esperado: `docs:check`, `db:migrations:check`, typecheck, Ultracite, suíte
completa, build e Knip passam. Se documentação canônica mudar, `docs:check`
deve ser executado após a alteração.

## Ordem e dependências

1. Fase 0 antes de alterar qualquer KPI ou projeção.
2. Fase 1 antes das melhorias de navegação, pois define a ordem semântica e o
   contrato de loading do Admin.
3. Fase 2 antes de abstrair a toolbar, pois fornece o segundo e terceiro
   consumidores reais do padrão Financeiro.
4. Fase 3 antes da Fase 4, para não confundir navegação de catálogo com estado
   interno de edição.
5. Fase 4 antes de reduzir montagem de abas; estado não salvo é a principal
   condição de segurança desse trabalho.
6. Fase 5 pode ocorrer em paralelo com Fase 3, mas sua janela deve ser decidida
   antes de qualquer novo KPI ou gráfico.
7. Fase 6 pode ocorrer em paralelo com Fase 5, preservando a Auditoria como dona
   da recuperação.
8. Fase 7 somente depois que os contratos e testes das superfícies tiverem
   estabilizado.

## Critérios de aceite

- [x] O DOM e a apresentação visual do `/admin` começam pela mesma tarefa.
- [x] Admin e Support recebem loading compatível com seus conteúdos reais.
- [x] Sinal operacional mostra motivo e destino específico.
- [x] Saúde do catálogo distingue total de amostra e publicação corrente.
- [x] “Acessos” representa acesso efetivo ou é rotulado como registro ativo.
- [x] KPIs de Alunas não mudam ao trocar página/busca sem indicação explícita.
- [x] Alunos, matrículas, Support, Auditoria e Cursos usam faixa/total e
      estados vazios coerentes.
- [x] O catálogo não possui dois links para a mesma ação nem loading de busca
      removida.
- [x] O detalhe de Curso não carrega todas as abas sem uma decisão explícita
      sobre estado não salvo.
- [x] Clique e Enter salvam a Aula pelo mesmo caminho e erros críticos ficam
      visíveis.
- [x] Aprendizagem informa janelas/populações e não retorna uma tabela ilimitada
      sem paginação ou justificativa.
- [x] Auditoria mantém retry, dead letters, IDs e correlação sem expor payload
      bruto como copy principal.
- [x] Configurações mantém JMV read-only, upload, FAQ e emissor, com loading e
      input acessíveis.
- [x] Nenhuma permissão mutável é ampliada e nenhum dado essencial é removido.
- [x] `bun run verify` passa após a execução completa.

## Fora de escopo e stop conditions

Parar e reportar antes de improvisar se ocorrer qualquer uma destas condições:

- a população de Cursos ou Alunas exigir um produto diferente de lista
  paginada;
- a correção de KPI alterar regra de acesso, publicação, financeiro ou
  certificado sem decisão documentada;
- a projeção por aba exigir nova rota, endpoint ou migration não previstos;
- a estratégia de abas puder perder rascunho, upload ou foco;
- o fornecedor JMVStream exigir troca de polling por webhook sem contrato
  verificável;
- o cálculo de Aprendizagem não puder declarar uma janela comum;
- um índice/cache parecer necessário sem plano medido;
- qualquer componente crítico precisar de biblioteca visual paralela;
- um teste de permissão falhar ou um erro precisar ser escondido para manter a
  UI verde;
- uma inspeção visual for necessária, mas o ambiente continuar proibido de
  abrir URL local.

Não criar gráficos, IA, filtros adicionais, novas rotas, nova marca ou cópia do
portal Asaas/JMVStream apenas para preencher espaço. Cada adição precisa
responder a uma decisão operacional existente e possuir fonte de dados,
permissão, estado vazio e teste.

## Manutenção após a execução

- Toda nova métrica deve declarar população, período, fonte e se é observada ou
  derivada.
- Toda nova lista server-side deve retornar `page`, `pageSize`, `totalCount`,
  `hasNextPage` e busca normalizada quando aplicável.
- Toda nova ação mutável deve usar o padrão de loading/erro inline e teste de
  permissão correspondente.
- Toda nova aba deve declarar se o estado pode ser perdido ao navegar e qual é
  o seam de persistência.
- Toda nova integração deve declarar o que o Hub governa e o que continua no
  portal externo.
- Revisar as medições de escala quando a quantidade real de Cursos, Alunas,
  Aulas, eventos ou logs crescer, em vez de adivinhar um limite.

## Registro da execução

Execução concluída em 2026-09-09 sobre o Admin derivado de
`f93a308e7e49ae8a8ca460fd750714b228863382`.

- Dashboard: saúde do catálogo baseada na publicação corrente, backlog total
  separado da amostra, acesso efetivo, sinal operacional acionável, últimas
  compras e últimos Certificados mantidos.
- Alunas, matrículas e Support: read models paginados, totais independentes,
  busca com limpeza explícita, estados vazios e contexto por Curso.
- Cursos: projeção própria de catálogo, uma ação por card, abas do detalhe
  carregadas sob demanda e proteção contra perda de rascunhos em abas, links
  internos e saída do navegador.
- Aula: ordem semântica do editor alinhada ao contexto da Aula; clique e Enter
  usam o mesmo caminho de salvamento com erro persistente.
- Aprendizagem: tabela paginada, janelas explícitas e elegibilidade alinhada ao
  acesso efetivo; exportação completa permanece separada da paginação.
- Auditoria e Configurações: faixas/contagens visíveis, estado das listas
  preservado entre controles, ações conhecidas traduzidas, JMV read-only,
  agrupamento editorial e input de banner nomeado.
- Shell: nome global usa `NeuroCapacitar Hub`; `PROTEA-R` permanece restrito a
  superfícies de Curso e integrações que dependem do asset existente.

Verificação executada:

- `bun run docs:check` — 36 documentos canônicos válidos.
- `bun run db:migrations:check` — migrations válidas.
- `bun run typecheck` — aprovado.
- `bun run check` — Ultracite sem pendências.
- `bun run test` — 401 arquivos e 2.733 testes aprovados.
- `bun run build` — build Next.js aprovado.
- `bun run knip` — sem erro; somente sugestões de configuração existentes.

A inspeção visual/E2E do servidor local permaneceu fora da execução porque a
regra atual do projeto proíbe abrir URL local neste ambiente.
