---
status: implemented
owner: product-and-engineering
base_commit: a2f458834c0aa28f68abc4bae83f3ee8acfea115
date: 2026-09-08
---

# Plano de implementação: reorganização do Admin

## Objetivo

Reduzir ruído e duplicação no Admin e reorganizar cada informação na superfície
que resolve sua decisão, sem remover dados locais necessários para acesso,
financeiro, recuperação, auditoria, certificados ou vínculo de mídia.

## Decisões de produto já confirmadas

- Upload JMVStream permanece. A melhoria é priorizar associação/seleção do vídeo
  na Aula e reduzir o painel geral do provider.
- Support continua vendo todos os valores financeiros necessários para suporte.
- `último acesso` e `expirando em breve` continuam na operação de Alunas.
- Aprendizagem vira relatório avançado até que o uso seja comprovado.
- Asaas continua sendo investigado no portal quando o problema é entrega do
  webhook; o Hub continua sendo a fonte da correlação, acesso e recuperação.

## Superfície alvo

| Superfície | Responsabilidade depois da mudança |
| --- | --- |
| `/admin` | triagem curta: métricas, saúde global e catálogo pendente acionável |
| `/admin/cursos` | autoria e publicação |
| `/admin/alunos` | acesso, suporte administrativo e ficha da Aluna |
| `/admin/financeiro` | Pedido, KPIs globais, Revisões, reembolso, conciliação e extrato |
| `/admin/auditoria` | webhooks, outbox/dead letters, backlog stale e auditoria global |
| `/admin/aprendizagem` | relatório avançado agregado e exportação |
| `/admin/configuracoes` | emissor, conteúdo editorial e health JMV acionável |
| `/admin/operacao/cursos` | redirect de compatibilidade para o dashboard Support canônico |

## Escopo de implementação

### Fase A: projeções corretas e home enxuta

Arquivos principais:

- `src/features/admin/server.ts`
- `src/features/admin/presentation.ts`
- `src/app/(admin)/admin/(dashboard)/page.tsx`
- testes de `server-read-projections` e da página do dashboard

Alterações:

1. Criar uma projeção agregada de saúde do catálogo que não carregue
   `content_json`, todos os Módulos ou todas as Aulas para a home.
2. Adicionar ao overview contagens globais de receita paga, pedidos pendentes e
   webhooks falhos; a contagem de webhooks não pode depender dos oito eventos
   recentes.
3. Remover da home Pedidos recentes, Webhooks recentes e a caixa de atalhos
   estáticos.
4. Manter métricas, saúde global e Cursos pendentes; cada Curso pendente deve
   abrir a aba de conteúdo/configuração correspondente.
5. Preservar o preview e a rota de Cursos.

Critérios de aceite:

- a home não contém “Pedidos recentes”, “Webhooks recentes” nem “Próximas
  ações”;
- falha antiga de webhook e pedido pendente antigo aparecem no sinal global;
- a query da home não seleciona `content_json` nem carrega a coleção completa de
  Módulos/Aulas;
- Admin continua autorizado por `viewAdminPanel`/`manageContent` conforme o
  contrato atual;
- teste de página cobre estado saudável, pendência e links de Curso.

### Fase B: Financeiro como decisão monetária

Arquivos principais:

- `src/app/(admin)/admin/financeiro/page.tsx`
- `src/app/(admin)/admin/financeiro/financial-operations.tsx`
- `src/features/admin/server.ts`
- `src/features/admin/presentation.ts`
- testes de Financeiro e projeções

Alterações:

1. Separar KPIs globais de listas paginadas: receita, ticket, conversão,
   pendências, disputas e reembolsos devem vir de uma agregação independente.
2. Manter busca/paginação de Pedidos e todos os valores brutos, líquidos,
   tarifas e IDs para Support/Admin.
3. Remover Certificados recentes.
4. Remover a lista detalhada de Webhooks e substituí-la por um alerta compacto
   com link para Auditoria quando houver falha.
5. Manter Revisões, reembolso integral, conciliação e importação do extrato.
6. Paginar a fila de Revisões e definir `reviewPage` sem remover qualquer tipo
   existente. Ações disponíveis continuam dependentes do tipo e da permissão.

Critérios de aceite:

- alteração de `q`, `page` ou `revenueQ` não altera KPIs globais sem um rótulo
  explícito de filtro;
- Support ainda vê valores financeiros e o Financeiro não expõe controls que
  seu papel não pode executar;
- Certificados e Webhooks não aparecem como listas completas no Financeiro;
- todos os tipos de Revisão continuam visíveis com paginação;
- testes cobrem KPI global versus lista paginada e autorização.

### Fase C: Auditoria como fila de recuperação

Arquivos principais:

- `src/app/(admin)/admin/auditoria/page.tsx`
- novo componente local para operações de webhook, se necessário
- `src/features/admin/server.ts` ou novo módulo de projeção operacional
- `src/features/outbox/server.ts`
- `src/app/(admin)/admin/financeiro/financial-operations.tsx` apenas se o
  componente de retry for reutilizado
- testes de Auditoria, webhook retry e outbox

Alterações:

1. Adicionar lista paginada/pesquisável de eventos Asaas com status, evento,
   chave, idade, tentativas, erro seguro e correlação disponível.
2. Permitir retry apenas para evento elegível, Admin, motivo obrigatório e
   confirmação já exigidos pela action existente.
3. Paginar dead letters da outbox, mantendo retry único, motivo e aviso de
   resultado ambíguo.
4. Paginar ou filtrar Revisões quando a fila for apresentada nessa superfície;
   não duplicar a mesma fila em Financeiro e Auditoria.
5. Manter o feed de auditoria global, mas ampliar o catálogo de labels para
   ações conhecidas como `module.upserted`.
6. Manter sinais de e-mail/vídeo, reduzindo sucesso rotineiro a detalhe e
   priorizando stale/dead letter/erro acionável.

Critérios de aceite:

- uma falha antiga localizável pela fila pode ser reprocessada sem SQL manual;
- nenhum payload bruto ou segredo aparece na tabela comum;
- Support não acessa a fila nem retry;
- dead letters além dos primeiros 50 são pagináveis;
- testes cobrem paginação, filtros, retry Admin e ausência de retry Support.

### Fase D: JMVStream contextual e somente leitura

Arquivos principais:

- `src/features/jmvstream/server.ts`
- `src/app/api/cron/jmvstream/route.ts`
- `src/app/(admin)/admin/configuracoes/page.tsx`
- `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx` e
  controles de vídeo, sem remover upload
- testes JMVStream e de Configurações

Alterações:

1. Remover `expireStaleJmvstreamUploads()` da leitura de health.
2. Executar a expiração no cron/manutenção antes ou junto da sincronização,
   preservando lease e observabilidade.
3. Transformar o card JMV em health compacto: falhas/pedências acionáveis,
   associação local e mensagem segura; esconder contagem de galerias e badge
   permanente de conexão.
4. Adicionar link seguro para o portal oficial, sem credenciais, URLs assinadas
   ou payloads.
5. Manter upload no editor da Aula e tornar associação de vídeo existente uma
   tarefa clara. Não trocar polling por webhook.

Critérios de aceite:

- abrir Configurações não altera `jmvstream_video_assets`;
- cron continua marcando uploads stale e sincronizando players;
- upload, associação e sincronização da Aula permanecem disponíveis;
- a UI não tenta replicar catálogo/analytics do provider;
- testes cobrem health read-only e cron.

### Fase E: navegação, relatório avançado e limpeza

Arquivos principais:

- `src/app/(admin)/admin/admin-sidebar-nav.tsx`
- `src/app/(admin)/admin/operacao/cursos/page.tsx`
- `src/app/(admin)/admin/aprendizagem/page.tsx`
- `src/features/learning-analytics/server.ts`
- `src/app/api/admin/learning-analytics/export/route.ts`
- componentes órfãos confirmados pelo analisador
- testes de navegação e Aprendizagem

Alterações:

1. Remover o item duplicado “Cursos” do menu Support; Painel será a entrada da
   operação e Financeiro continuará no menu.
2. Transformar `/admin/operacao/cursos` em redirect de compatibilidade para
   `/admin`, preservando links antigos.
3. Rotular Aprendizagem como relatório avançado, mostrar Curso + publicação
   legível em vez do UUID bruto e preservar CSV/analytics agregado.
4. Remover somente depois de confirmar referências:
   - `admin/privacidade/loading.tsx`;
   - `course-actions-dropdown.tsx` sem consumidor;
   - `lesson-sidebar-header.tsx` sem consumidor.
5. Não remover `/admin/alunas` nesta execução; manter redirect legado.

Critérios de aceite:

- menu Admin e Support não exibem duas entradas para a mesma superfície;
- bookmarks de `/admin/operacao/cursos` continuam funcionando via redirect;
- relatório mostra contexto legível e mantém exportação;
- Knip/checagem de referências não acusa os arquivos removidos;
- testes de navegação e analytics passam.

## Fora de escopo desta execução

- remover tabelas, migrations ou dados locais;
- trocar upload JMV por portal-only;
- trocar polling JMV por webhook sem contrato validado;
- alterar regra financeira, lifecycle de acesso ou permissão de papel;
- mudar o contrato de auditoria transacional de todos os comandos;
- publicar, commitar ou promover para Production.

## Ordem e dependências

1. Fase A, porque muda o contrato de dados do dashboard.
2. Fase B, porque Financeiro depende dos agregados e remove consumidores de
   `recentWebhooks`/certificados.
3. Fase C, porque recebe a fila detalhada de webhooks e dead letters.
4. Fase D, independente da UI financeira, mas deve acontecer antes da limpeza de
   Configurações.
5. Fase E, depois que os consumidores e redirects estiverem estabilizados.

## Verificação final obrigatória

```text
bun run typecheck
bun run test -- <testes administrativos afetados>
bun run check
bun run knip
bun run docs:check
```

Além dos comandos, revisar manualmente o diff para confirmar que nenhum bloco
crítico de reembolso, reconciliação, acesso, certificado, upload ou retry foi
removido por engano.

## Estado final

Implementado no worktree:

- Painel enxuto com projeção agregada e links diretos para pendências de Curso;
- Painel preserva Últimas compras e Últimos certificados emitidos, com data,
  status e links para a próxima ação;
- KPIs financeiros globais, sem depender da página de Pedidos;
- Financeiro sem listas duplicadas de Webhooks/Certificados, com Revisões
  paginadas;
- Auditoria com fila paginada de Webhooks falhos/retryáveis e dead letters;
- health JMVStream somente leitura, expiração movida para o cron e links para
  o portal na configuração e na Aula;
- menu Support sem rota duplicada, com redirect legado preservado;
- relatório de Aprendizagem contextualizado por Curso/versão;
- componentes e loader órfãos removidos;
- documentação canônica JMVStream atualizada para refletir o novo owner da
  expiração stale.

Ficaram deliberadamente fora: upload portal-only, troca de polling JMV por
webhook, remoção de dados/migrations e alteração das regras de autorização,
financeiro, acesso, certificados ou auditoria transacional.

Verificação final desta execução: 388 arquivos de teste, 2.653 testes
aprovados; `bun run typecheck`, `bun run check`, `bun run knip` e
`bun run docs:check` passaram.
