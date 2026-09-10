---
status: review
owner: product-and-engineering
review_date: 2026-09-08
repository_branch: staging
repository_commit: a2f458834c0aa28f68abc4bae83f3ee8acfea115
---

# Auditoria profunda do painel administrativo

## 1. Veredito executivo

O painel não está “grande” porque tudo nele seja dispensável. Ele mistura três
funções diferentes:

1. operar o produto: cursos, aulas, matrículas, suporte, certificados e
   disponibilidade comercial;
2. recuperar exceções raras, mas perigosas: reconciliação, reembolso,
   divergência financeira, retry, dead letter e auditoria;
3. observar sistemas: webhooks recentes, contagens de provider, IDs técnicos,
   filas e métricas de aprendizagem.

A primeira e a segunda funções devem permanecer. A terceira deve ser resumida,
rebaixada para detalhe ou substituída por um link contextual para o portal do
fornecedor.

### Recomendações de maior confiança

- Remover da home a lista detalhada de “Webhooks recentes”. Manter um sinal
  acionável e um único local de investigação/retry.
- Remover da home “Pedidos recentes” e a caixa estática “Próximas ações”.
  Financeiro e as páginas de detalhe já são os locais canônicos; atalhos só
  agregam valor quando forem dinâmicos e apontarem para pendências reais.
- Remover de Financeiro “Certificados recentes”. É um bloco sem relação direta
  com a decisão financeira e já existe no contexto da Aluna/Curso.
- Corrigir ou retirar temporariamente os indicadores financeiros que parecem
  globais, mas são calculados somente sobre a página de até 20 pedidos. Sem
  período ou consulta agregada, “Conversão checkout”, “Ticket médio” e
  “Receita pendente” podem induzir decisão errada.
- Rebaixar a saúde JMVStream de “painel de configurações” para alerta mínimo e
  link para o portal. Preservar no Hub apenas o vínculo Aula ↔ ativo, estado de
  upload/processamento/deleção e recuperação local.
- Remover o arquivo de loading órfão de `/admin/privacidade` após confirmar a
  ausência de referências externas. O workflow de privacidade administrativa
  foi removido do produto; o arquivo restante não entrega uma capacidade.

### O que não deve ser removido por parecer técnico

- inbox local de webhooks Asaas, idempotência, status de processamento e retry;
- `payment_reviews`, reconciliação, reembolso auditado e importação de extrato;
- `audit_logs`, outbox dead letter e eventos de matrícula;
- projeção local mínima dos ativos JMVStream e sessões de upload;
- autoria de Curso/Módulo/Aula, publicação, acesso, certificados e suporte;
- analytics de aprendizagem agregado e exportável, que é uma decisão de produto
  e privacidade já ratificada.

O Asaas sabe o que aconteceu na conta dele; o Hub precisa saber se o evento foi
correlacionado a um Pedido local, se liberou ou revogou acesso, se abriu uma
Revisão e se o efeito de e-mail/outbox foi aplicado. A JMVStream sabe o estado
do vídeo; o Hub precisa saber qual Aula o usa, qual publicação o referencia e
se a Aluna receberá um player válido. Essas duas camadas não são a mesma coisa.

## 2. Escopo, método e limitações

### Escopo técnico

Foi auditada a aplicação administrativa sob `src/app/(admin)/admin`, suas
projeções em `src/features/admin`, componentes administrativos compartilhados,
ações de pagamento/certificado/outbox, rotas administrativas e os contratos
canônicos em `PRODUCT.md`, `CONTEXT.md`, `docs/README.md`, arquitetura, guias de
domínio, integrações e decisões.

Foram delegadas frentes independentes para inventário de rotas, proveniência e
duplicação de integrações, jobs-to-be-done, riscos de remoção e pesquisa
externa. A pesquisa externa foi salva em
[admin-dashboard-external-research-2026-09-08.md](admin-dashboard-external-research-2026-09-08.md).

Não foi aberta uma URL local nem feita inspeção visual/renderizada. Esta revisão
é de código, contratos, textos de interface, dados, ações, autorização, testes
e fontes externas. Portanto, não conclui densidade visual percebida, tempos de
interação, descoberta real por uma operadora ou uso efetivo de cada bloco.

Também não há telemetria de uso, tickets de suporte anexados, frequência de
incidentes ou dados de produção consultados nesta revisão. Qualquer afirmação
sobre frequência de uso está marcada como “não medido”.

### Critério de avaliação

Cada item foi classificado por:

- decisão habilitada: o que a operadora consegue decidir com a informação;
- ownership: fonte local, projeção, cálculo derivado, evidência ou provider;
- ação: se existe algo recuperável na própria superfície;
- duplicação: se o mesmo bloco aparece em outra tela ou já existe no portal;
- risco de remoção: perda de operação diária, recuperação rara, auditoria,
  financeiro, acesso, privacidade ou apenas descoberta;
- destino recomendado: manter, compactar, mover para detalhe, exportar,
  linkar ou remover.

## 3. Contrato de produto que governa a análise

O produto define o Hub como central de venda, entrega e operação de Cursos. A
equipe publica conteúdo, cuida de acessos e resolve exceções financeiras e de
dados com rastreabilidade (`PRODUCT.md:9-15`). O público administrativo é
dividido entre Admin, que opera todas as capacidades, e Support, que possui um
subconjunto explícito (`PRODUCT.md:17-26`).

As jornadas atuais exigem persistência local: o Pedido e seus snapshots nascem
antes do checkout, o webhook entra em inbox durável, o worker atualiza o Pedido,
o pagamento válido cria Concessão/Matrícula e divergências viram Revisão humana
(`PRODUCT.md:31-40`). Isso impede tratar o portal Asaas como fonte suficiente
para o estado de acesso.

O contrato também delimita o analytics: métricas técnicas agregadas por Aula e
Publicação, sem lista nominal de inatividade, CRM ou automação de reengajamento
(`PRODUCT.md:61-69`; `docs/decisions.md:119-126`). Portanto, o analytics não é
um candidato a ser eliminado por “não ter dados individuais”; essa ausência é
intencional.

O papel Support pode analisar Cursos, Alunas, Matrículas, Certificados,
Pedidos, disputas e reembolsos, mas não pode administrar conteúdo, provider,
analytics detalhado, retry, decisão financeira, bloqueio de plataforma ou
auditoria global (`docs/decisions.md:213-231`). Ocultar uma tela não substitui a
autorização server-side; qualquer simplificação deve preservar a matriz em
`src/lib/auth-policy.ts:3-65`.

## 4. Mapa da navegação e das entradas reais

### Menu Admin

`src/app/(admin)/admin/admin-sidebar-nav.tsx:21-39` exibe:

- Painel: `/admin`;
- Aprendizagem: `/admin/aprendizagem`;
- Cursos: `/admin/cursos`;
- Alunas: `/admin/alunos`;
- Financeiro: `/admin/financeiro`;
- Auditoria: `/admin/auditoria`;
- Configurações: `/admin/configuracoes`.

### Menu Support

O mesmo arquivo limita Support a:

- Painel: `/admin`;
- Cursos de operação: `/admin/operacao/cursos`;
- Financeiro: `/admin/financeiro`.

Support não vê no menu Aprendizagem, Cursos de autoria, Alunas global,
Auditoria ou Configurações. Isso já é uma boa separação de função; o problema
principal é conteúdo repetido dentro das superfícies permitidas.

### Entradas não presentes no menu

| Entrada | Situação | Veredito |
| --- | --- | --- |
| `/admin/alunas` | Redireciona para `/admin/alunos` em `alunas/page.tsx:1-6` | Manter enquanto houver links antigos; remover só após inventário de links/analytics. |
| `/admin/cursos/[courseId]` | Detalhe completo do Curso | Manter; é a unidade de trabalho principal de autoria. |
| `/admin/cursos/[courseId]/aulas/[lessonId]` | Editor de Aula | Manter; concentra conteúdo, mídia, anexos e comentários. |
| `/admin/operacao/cursos/[courseId]/alunas` | Contexto de Support por Curso | Manter; reduz escopo e exposição de dados. |
| `/admin/privacidade` | Existe somente `loading.tsx`; não há `page.tsx` nem entrada de menu | Candidato forte a limpeza de arquivo órfão. Não criar uma nova capacidade. |

O layout autentica Admin/Support em `src/app/(admin)/admin/layout.tsx:6-20`.
Cada página ainda deve reforçar permissão, e as actions/Route Handlers fazem a
mesma verificação no servidor.

## 5. Inventário minucioso por superfície

### 5.1 `/admin` para Admin: Central do LMS

Evidência principal: `src/app/(admin)/admin/(dashboard)/page.tsx:47-424`.

#### Informações visíveis

1. **Quatro métricas de topo**
   - Cursos: quantidade total;
   - Alunas: perfis com papel Student;
   - Acessos: matrículas ativas;
   - Pedidos: pedidos pagos.

2. **Saúde da operação**
   - sinal textual geral: operação saudável, pedidos pendentes, catálogo em
     ajuste ou revisão de webhooks;
   - Receita paga, somada de `coursesRevenue`;
   - pedidos pendentes;
   - webhooks com falha;
   - prontidão média do catálogo;
   - cursos ativos e rascunhos.

3. **Cursos que precisam de atenção**
   - até quatro Cursos com menor prontidão;
   - quantidade de itens pendentes;
   - percentual de prontidão.

   A prontidão é um checklist de quatro itens: descrição, capa, existência de
   Módulo e ao menos uma Aula total/publicada (`src/features/admin/presentation.ts:281-342`).
   Não é uma avaliação pedagógica, de conversão ou de qualidade do conteúdo.

4. **Pedidos recentes**
   - até quatro pedidos;
   - nome/e-mail de cliente;
   - Curso;
   - estado do Pedido;
   - valor.

5. **Webhooks recentes**
   - até oito eventos Asaas;
   - nome do evento;
   - chave externa;
   - mensagem de erro segura, quando existe;
   - status;
   - data.

#### Ações

- “Revisar catálogo” → `/admin/cursos`;
- “Ver financeiro” → `/admin/financeiro`;
- links estáticos da caixa “Próximas ações” para Cursos, Financeiro e Alunas.

Não há retry, filtro, detalhe do evento ou ação sobre Pedido na home.

#### Proveniência e custo

`getAdminOverview` consulta contagens globais e os oito últimos webhooks
Asaas (`src/features/admin/server.ts:24-91`). `getAdminDashboardData` carrega
cursos, todos os Módulos, todas as Aulas, uma página de Pedidos e receita por
Curso (`src/features/admin/server.ts:1330-1348`). A home, portanto, faz mais
leitura do que os blocos visíveis de triagem parecem exigir.

#### Veredito

| Item | Veredito | Motivo |
| --- | --- | --- |
| Quatro métricas | Manter, com revisão de prioridade | São resumo útil, desde que não sejam tratados como analytics. |
| Saúde da operação | Manter, mas corrigir a origem dos webhooks | O sinal é bom para triagem, porém `failedWebhooks` conta somente os oito eventos carregados. |
| Prontidão média | Compactar ou remover quando a lista detalhada permanecer | Média e lista de Cursos repetem o mesmo checklist. |
| Cursos que precisam de atenção | Manter somente se virar atalho acionável | Hoje o item mostra progresso, mas não oferece link direto para corrigir. |
| Pedidos recentes | Remover da home | Financeiro é a superfície canônica e já contém busca, IDs, status e ações. |
| Webhooks recentes | Remover da home | É a duplicação mais clara; manter sinal + link para recuperação. |
| Próximas ações estáticas | Remover ou tornar dinâmica | Repetem navegação e não refletem pendências específicas. |

#### Achado crítico de semântica

Em `page.tsx:109-123`, o painel chama de “Webhooks com falha” a contagem dos
eventos falhos dentro de `overview.recentWebhooks`, que é limitada a oito linhas
em `server.ts:67-72`. Um evento antigo pode deixar de aparecer e o sinal virar
zero sem que o backlog tenha sido resolvido. A fonte correta já existe em
`src/features/operations/server.ts:234-300`, que calcula falhas, idade,
recebidos, retry e alerts. Antes de decidir manter esse indicador, ele deve ser
ligado ao backlog operacional ou explicitamente rotulado como “entre os oito
eventos recentes”.

### 5.2 `/admin` para Support: Operação de suporte

Evidência: `src/app/(admin)/admin/support-dashboard.tsx:24-155` e
`src/features/admin/support-server.ts:15-178`.

#### Informações visíveis

- Cursos disponíveis para consulta;
- soma de Matrículas;
- Pedidos pagos;
- Receita paga;
- lista de Cursos com status de entrega;
- matrículas ativas e totais por Curso;
- receita paga e reembolsada;
- número de Pedidos pagos e reembolsados.

#### Ações

- abrir Financeiro;
- abrir a lista de Alunas do Curso;
- abrir o contexto operacional de uma Aluna.

#### Veredito

Manter, mas revisar a densidade depois de observar tickets de Support. A lista
por Curso reduz o universo antes de acessar a Aluna, e os valores pagos/
reembolsados ajudam a responder dúvidas de acesso. Não há evidência suficiente
para remover essas informações. O que pode ser simplificado é a repetição de
receita e contagens se Support usar Financeiro como rotina principal; isso é
uma hipótese de uso, não uma conclusão de código.

Há uma duplicação estrutural confirmada: `/admin` para Support e
`/admin/operacao/cursos` renderizam o mesmo `SupportDashboard` com a mesma
projeção (`src/app/(admin)/admin/(dashboard)/page.tsx:74-80`;
`src/app/(admin)/admin/operacao/cursos/page.tsx:1-10`). O menu usa ambas as
entradas como se fossem funções diferentes, mas o código não mostra diferença.
Escolher uma URL canônica e transformar a outra em redirect, ou dar ao Painel
uma função de triagem realmente distinta, é uma remoção de duplicação de baixo
risco. Preservar bookmarks antes de apagar a rota antiga.

### 5.3 `/admin/aprendizagem`

Evidência: `src/app/(admin)/admin/aprendizagem/page.tsx:27-147`.

#### Informações visíveis

Tabela “Funil por aula e versão” com:

- Aula;
- ID da Publicação;
- elegíveis;
- iniciaram;
- concluíram;
- checkpoint mediano;
- mediana de horas até concluir;
- mediana de horas até a próxima Aula;
- erros.

Também há estado vazio e “Exportar métricas em CSV”. A consulta agrega eventos
brutos recentes e métricas diárias de até 13 meses
(`src/features/learning-analytics/server.ts:147-297`).

#### Ações

- exportar CSV;
- nenhuma edição, contato individual, opt-out ou reengajamento.

#### Veredito

Não remover o recurso inteiro: o produto declara analytics agregado como
capacidade vigente. Simplificar a primeira camada:

- substituir o ID bruto da Publicação por Curso + versão legível;
- mostrar por padrão elegíveis, iniciaram, concluíram e erros;
- deixar checkpoints e medianas em detalhe ou CSV;
- declarar o período efetivo da consulta;
- manter exportação e permissão `manageLearningAnalytics`.

O ID da Publicação pode ser útil para Engenharia, mas é informação técnica sem
decisão óbvia para a operadora. A remoção da coluna da UI não remove o campo
nem a rastreabilidade do banco.

### 5.4 `/admin/cursos`

Evidência: `src/app/(admin)/admin/cursos/page.tsx:75-407`.

#### Informações visíveis

- busca por título, subtítulo ou slug;
- estado de disponibilidade combinado;
- título e subtítulo;
- Módulos e Aulas;
- meses de acesso;
- preço;
- estados vazios e paginação.

#### Ações

- criar Curso;
- informar capa, título, subtítulo, descrição, duração comercial de acesso e
  preço;
- abrir “Gerenciar curso”;
- navegar entre páginas;
- limpar busca.

#### Veredito

Manter. Esta é a lista canônica de autoria e o resumo do card é coerente com a
decisão de entrar no detalhe. Não mover preço/duração para o provider: são
contrato comercial local e snapshots do Pedido.

### 5.5 `/admin/cursos/[courseId]`

As abas são definidas em
`src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.tsx:8-14`:
Visão geral, Conteúdo, Alunas, Configurações e Certificado.

#### Visão geral

Evidência: `course-overview.tsx:97-189`.

- estado operacional do Curso;
- alerta de identidade, conteúdo, publicação, oferta, inatividade, checkout,
  alterações pendentes ou pronto;
- Matrículas ativas;
- Pedidos pagos;
- Certificados válidos;
- Módulos, Aulas, duração e estado da Publicação;
- atalho para a aba que resolve a pendência;
- preview como Aluna na página principal do detalhe.

**Veredito:** manter. É informação contextual de um Curso e não substitui as
listas globais. A parte mais importante é o caminho da pendência para a ação.

#### Conteúdo

Evidência: `course-content-panel.tsx:89-167` e
`course-builder-components.tsx`.

- estado de conteúdo e Publicação;
- Módulos, descrição, ordem, estado e atraso de liberação;
- Aulas, título, descrição, ordem, status e obrigatoriedade;
- conteúdo pronto/sem conteúdo, rascunhos e Módulos vazios;
- criar Módulo;
- criar/editar Aula;
- reordenar Módulos e Aulas;
- preparar rascunho;
- publicar lote;
- arquivar/alterar estados conforme regras do builder.

**Veredito:** manter integralmente. É o núcleo de autoria e a Publicação em
lote protege Matrículas existentes. Simplificação possível: esconder detalhes
de estado que não alteram a próxima ação, nunca remover o workflow de draft/
publish.

#### Alunas

- últimas Matrículas;
- busca e paginação;
- identidade mínima;
- situação de acesso;
- abertura da mesma ficha contextual da Aluna.

**Veredito:** manter. É a entrada correta para resolver um problema de uma
Aluna dentro do Curso.

#### Configurações do Curso

Evidência: `page.tsx:193-230` e `course-dialogs-client.tsx`.

- identidade: capa, título, subtítulo e descrição;
- carga horária calculada ou override;
- meses de acesso;
- preço;
- Pix e cartão;
- máximo de parcelas;
- link de compra estável e URL pública;
- disponibilidade de entrega, vitrine e vendas;
- data de lançamento e URL da landing page;
- interesse de venda, notificações pendentes e cancelamentos de checkout;
- arquivamento.

**Veredito:** manter. São dimensões locais do produto, não configurações do
Asaas. Pode haver disclosure/agrupamento por “identidade”, “oferta” e
“disponibilidade”, mas remover campos quebraria contrato comercial ou acesso.

#### Certificado

- habilitar/desabilitar certificado por Curso;
- configurar template visual;
- salvar e publicar draft;
- histórico de versões;
- emitir certificados pendentes de reconciliação;
- visualizar estado do emissor;
- carga horária usada no documento.

**Veredito:** manter para Admin. A complexidade é consequência do lifecycle
validado/revogado/reemitido e dos snapshots. Não confundir o editor de template
com informação sobre o provider de vídeo ou pagamento.

### 5.6 `/admin/cursos/[courseId]/aulas/[lessonId]`

Evidência: `page.tsx:58-185`.

#### Informações e ações

- Curso e Módulo de contexto;
- título da Aula;
- duração total, duração de vídeo e duração de texto;
- aba Vídeo: upload JMVStream, player/thumbnail, ID externo, duração e
  sincronização;
- aba Texto: editor rico;
- aba Anexos: lista e upload de resources;
- aba Comentários: leitura e moderação;
- sidebar com título, descrição, status, obrigatoriedade e ações de salvar;
- contagens de anexos e comentários;
- publicação/rascunho da Aula.

**Veredito:** manter. Se a preferência operacional for administrar a biblioteca
de vídeo no portal JMVStream, o editor ainda precisa guardar o vínculo com a
Aula e validar o player. O candidato é substituir “gestão de catálogo JMV” por
“selecionar/associar ativo existente + abrir portal”, não remover a associação
local nem o estado de recuperação.

### 5.7 `/admin/alunos`

Evidência: `src/app/(admin)/admin/alunos/page.tsx:36-137` e
`students-table.tsx:71-238`.

#### Informações visíveis

- total de Alunas;
- Alunas com acesso ativo;
- Alunas sem Matrícula;
- Matrículas expirando em até 30 dias;
- busca por nome/e-mail;
- nome, e-mail, quantidade de Cursos, plataforma ativa/bloqueada,
  expiração final e último acesso;
- paginação e total.

#### Ações na ficha

`StudentManagementSheet` (`src/components/admin/student-management-sheet.tsx:338-420`)
tem abas:

- **Acesso:** bloqueio/restauração da plataforma e lista de Matrículas;
- **Certificados:** emissão manual, revogação e reemissão conforme capacidade;
- **Operação:** somente no contexto Support.

Em uma Matrícula, a ficha mostra Curso, status, início, expiração original,
expiração atual, modo de liberação e próxima liberação. Admin pode ajustar
validade, bloquear/restaurar Matrícula, conceder acesso integral conforme as
regras e operar Certificados.

#### Veredito

Manter a lista e a ficha. `Último acesso` deve permanecer como diagnóstico
operacional, não virar métrica de inatividade ou automação, conforme a decisão
de analytics. Os quatro cards podem ser reduzidos se a operadora não usa os
contadores para triagem; isso precisa de telemetria de clique/filtro, pois o
código não prova baixa utilidade.

### 5.8 `/admin/operacao/cursos` e contexto de Support

Evidência: `support-dashboard.tsx:24-155`,
`operacao/cursos/[courseId]/alunas/page.tsx:52-135` e
`support-course-students-table.tsx:18-129`.

#### Informações

- Cursos em operação;
- Matrículas ativas/totais;
- receita paga/reembolsada;
- Pedidos pagos/reembolsados;
- Aluna, e-mail, início, expiração, status e bloqueio da plataforma;
- busca e paginação por Curso.

#### Ações

- consultar Aluna;
- acessar ficha contextual;
- ajustar validade e bloquear/restaurar Matrícula com motivo;
- reemitir somente o Certificado mais recente;
- solicitar reembolso integral sob confirmação e permissão;
- consultar progresso obrigatório, liberação programada, próxima liberação,
  Pedidos/reembolsos e histórico contextual.

O contexto é carregado sob escopo de Curso e usa `viewScopedAudit`
(`src/features/admin/support-server.ts:241-535`).

#### Veredito

Manter. Esta é uma superfície de suporte, não uma réplica de autoria. O
conteúdo adicional da ficha existe para responder “por que a Aluna não vê a
Aula?”, “quando expira?”, “o Pedido foi reembolsado?” e “o Certificado está
pronto?”. Remover progresso/liberação/histórico aumentaria encaminhamentos para
Admin/Engenharia.

### 5.9 `/admin/financeiro`

Evidência: `src/app/(admin)/admin/financeiro/page.tsx:228-645`.

#### Informações visíveis

1. **Métricas**: Receita confirmada, ticket médio pago, receita pendente e
   conversão checkout.
2. **Saúde do checkout**: pendentes, disputas, reembolsos, conversão e alerta de
   webhooks falhos.
3. **Pedidos recentes**: busca por Pedido, checkout, pagamento ou e-mail;
   nome/e-mail, Curso, status, bruto, líquido, tarifa, IDs externos, método,
   status do checkout, status do pagamento e reembolso.
4. **Receita por Curso**: vendas concluídas/total, conversão e receita real.
5. **Webhooks recentes**: chave, evento, status, erro, data e retry.
6. **Certificados recentes**: Aluna, Curso, código e data.
7. **Revisões financeiras**: tipo, motivo, checkout, estado e controles.

#### Ações

- buscar/paginar Pedidos;
- solicitar estorno integral com senha recente, digitação do ID e motivo;
- conciliar pagamento Asaas;
- importar período fechado do extrato Asaas;
- resolver Revisão quando o tipo permite, com decisão e motivo;
- reprocessar webhook falho com motivo;
- filtrar/paginar receita por Curso;
- abrir validação pública do Certificado.

#### O que é indispensável

- Pedido local, estado canônico, evidência de pagamento e IDs para correlação;
- Revisão financeira, pois divergências não podem liberar acesso;
- reembolso auditado e conciliação;
- importação do extrato como evidência financeira;
- retry de webhook local, com motivo e permissão.

#### O que é candidato a reduzir

- Certificados recentes: remover do Financeiro;
- webhooks recentes: mover para uma fila/área operacional canônica;
- IDs de checkout/pagamento: esconder por padrão e revelar em detalhe;
- receita por Curso: manter, mas deixar explícito se é acumulada e oferecer
  período/filtro antes de tratá-la como relatório;
- indicadores de saúde: corrigir recorte ou reduzir a “últimos pedidos
  carregados”.

#### Achado de recorte incorreto

`getAdminFinancialData` busca 20 pedidos mais um para paginação
(`src/features/admin/server.ts:1441-1469`). A página passa apenas esses pedidos
para `summarizeAdminFinancialHealth` (`financeiro/page.tsx:240-248`). Logo,
“Conversão checkout”, “Ticket médio”, “Receita pendente”, “Disputas” e
“Reembolsos” refletem a página atual, não necessariamente a plataforma inteira.
Isso é mais grave que excesso visual: pode produzir uma decisão financeira
errada. Há duas saídas seguras:

1. consulta agregada global com período explícito; ou
2. renomear todos os números para “últimos 20 pedidos” e retirar o status
   global.

Há outra lacuna de operação: a UI só oferece decisão genérica para parte das
Revisões. `financial-operations.tsx:305-385` abre reembolso para
`buyer_identity` e Aprovar/Rejeitar para `amount_mismatch` e
`terminal_conflict`; o contrato de comércio exige tratamento específico para
`event_anomaly`, `partial_refund`, `uncertain_result` e outros
(`docs/domain/commerce-and-access.md:197-204`). Ao reorganizar Financeiro ou
mover a fila para Auditoria, cada tipo precisa exibir seu próximo passo
correto: conciliação, retry, reembolso específico ou encaminhamento ao
runbook/provider. Não basta preservar uma lista maior se os itens continuarem
sem ação.

### 5.10 `/admin/auditoria`

Evidência: `src/app/(admin)/admin/auditoria/page.tsx:177-430`.

#### Informações visíveis

- alertas de dead letter de e-mail/outbox;
- outbox pendente, mais antiga e dead letters;
- e-mails aceitos, entregues, bounce, reclamações, retry e dead letters;
- webhooks falhos, fila, retry e idades;
- pendências financeiras: checkouts incertos, reembolsos incertos e pedidos sem
  pagamento correlacionado;
- vídeos pendentes e idade;
- mensagens em dead letter, tópico, ID, tentativas, código de falha e data;
- até 30 alterações administrativas, ator e data.

#### Ações

- reprocessar uma mensagem de outbox uma vez, com motivo, apenas Admin;
- investigar manualmente os demais backlogs via runbook;
- nenhuma ação visual de retry de vídeo ou resolução de webhook nesta tela hoje.

#### Veredito

Manter a superfície para Admin, pois ela é a única que junta sinais de
recuperação e auditoria local. Simplificar a apresentação:

- alertas e itens stale em primeiro nível;
- contagens de sucesso rotineiro de e-mail em detalhe, não como bloco de mesma
  importância de dead letter;
- “Vídeos pendentes” só deve ocupar espaço quando houver ação, idade crítica ou
  link para a Aula/portal;
- mover para cá, ou para uma subárea de recuperação ligada daqui, a fila completa
  de webhooks se ela sair de Financeiro;
- manter log global e motivo/ator/data.

Não remover `audit_logs`, outbox ou backlog local. O portal de Resend/Asaas não
conhece todas as transições internas do Hub.

Dois limites atuais precisam ser tratados antes de chamar Auditoria de
“recuperação completa”:

- `readPaymentReviews` retorna no máximo 40 Revisões
  (`src/features/admin/server.ts:1056-1070`) e não há paginação na tela;
- `listOutboxDeadLetters` retorna no máximo 50 dead letters
  (`src/features/outbox/server.ts:350-367`) e também não há paginação.

Esses limites são invisíveis para a operadora. Se o volume ultrapassar o teto,
itens antigos permanecem bloqueados sem superfície de resolução. O primeiro
passo é paginação/filtros por idade, status, tópico e tipo; só depois se deve
considerar remover qualquer bloco visual.

O feed de auditoria também tem um problema de legibilidade: o formatter cobre
alguns eventos, mas cai em “Ação do sistema (...)” para ações não catalogadas
(`src/app/(admin)/admin/auditoria/page.tsx:98-175`). Por exemplo, o authoring
grava `module.upserted` (`src/features/admin/authoring.ts:1795-1800`), que não
tem apresentação específica. Antes de reduzir o log por considerá-lo técnico,
vale centralizar um catálogo seguro de ações por domínio, ator, alvo e data,
sem expor payload bruto ou PII.

### 5.11 `/admin/configuracoes`

Evidência: `src/app/(admin)/admin/configuracoes/page.tsx:33-215`.

#### JMVStream

- estado de autenticação;
- mensagem de conexão/orphan folders;
- galerias;
- uploads ativos;
- uploads com falha;
- exclusões pendentes;
- exclusões com falha.

`getJmvstreamHealthSummary` também expira uploads stale, lê assets locais e
lista pastas remotas (`src/features/jmvstream/server.ts:63-126`).

**Veredito:** remover “Galerias” e “Conectada” como informação permanente;
transformar em link “Abrir JMVStream” e alerta somente quando há falha local,
upload em processamento além do limite ou exclusão pendente. Preservar o
estado local que permite recuperação. Não retirar upload/associação do editor
de Aula sem decidir explicitamente um fluxo portal-first.

Há também um problema de fronteira: abrir Configurações chama
`getJmvstreamHealthSummary` (`configuracoes/page.tsx:36-40`), que executa
`expireStaleJmvstreamUploads()` antes de ler o health
(`features/jmvstream/server.ts:74-77`). Essa função atualiza
`jmvstream_video_assets` para `failed`
(`features/jmvstream/asset-persistence.ts:478-492`). Uma leitura da tela é,
portanto, parcialmente mutável e a visita de uma pessoa pode antecipar uma
mudança de estado que deveria pertencer à rotina agendada. Antes de simplificar
ou mover o card, separar diagnóstico de expiração de upload é obrigatório. A
recomendação é deixar a tela somente leitura e manter a expiração no cron/
manutenção.

#### Dados operacionais de certificado

- Razão social emissora;
- marca exibida;
- CNPJ emissor;
- nome da assinatura;
- cargo da assinatura.

**Veredito:** manter. Esses dados são usados em Certificados e não vêm do
Asaas/JMVStream.

#### Banners do dashboard da Aluna

- até cinco imagens;
- ativo/inativo;
- link e texto de botão;
- ordenação;
- upload, edição e exclusão.

**Veredito:** manter, mas considerar renomear a área para conteúdo da área da
Aluna. É configuração editorial, não operação técnica.

#### FAQ

- perguntas, respostas, publicação e ordem;
- criar, editar, excluir e reordenar.

**Veredito:** manter, mas separar visualmente de certificado/JMV. Não há
evidência para remover conteúdo que reduz dúvidas de Support.

### 5.12 `/admin/privacidade`

Não há página efetiva, apenas `loading.tsx`. A decisão vigente afirma que o
workflow de solicitações/anonimização foi removido por não haver solicitante,
operação recorrente ou plano aprovado (`docs/decisions.md:112-115`).

**Veredito:** remover o arquivo órfão e qualquer referência residual, sem criar
uma nova tela. A política pública de privacidade e o controle de opt-out de
analytics da Aluna continuam sendo outra coisa.

Também foram encontrados dois componentes antigos sem consumidor no código:
`src/app/(admin)/admin/cursos/[courseId]/course-actions-dropdown.tsx` e
`src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-header.tsx`.
As páginas atuais renderizam o preview e o cabeçalho/sidebar por outros
componentes, e não há importações desses arquivos. Eles são candidatos de
limpeza técnica independentes da decisão de produto; remover somente depois de
confirmar o resultado do analisador de referências/Knip.

## 5.13 Achados transversais que a simplificação não pode mascarar

### Dashboard supercarregado

`getAdminDashboardData` carrega Cursos, Módulos, Aulas, Pedidos e receita em
conjunto (`src/features/admin/server.ts:1330-1348`). A leitura de Aulas inclui
`content_json` (`server.ts:578-659`), enquanto a home usa o conteúdo apenas para
contagens de prontidão (`(dashboard)/page.tsx:86-108`). Isso torna a home mais
cara e mais difícil de escalar sem aumentar o valor percebido. A simplificação
de UI deve vir acompanhada de uma projeção agregada específica; remover o bloco
sem remover a leitura deixa o custo intacto.

### Duas bases monetárias para uma mesma leitura

Receita por Curso em `server.ts:1082-1107` soma `amount_in_cents`, enquanto o
dashboard Support em `support-server.ts:141-159` soma preferencialmente
`paid_amount_in_cents`. Isso pode ser deliberado para distinguir contrato e
pagamento confirmado, mas hoje os rótulos próximos (“Receita paga”, “Receita
real”) não deixam a base explícita. Antes de remover ou consolidar métricas,
definir uma projeção compartilhada com nomes distintos para bruto contratual,
bruto confirmado, líquido e tarifa.

### Ações e trilha podem não ser atômicas

Algumas Server Actions alteram a entidade e só depois chamam `audit()` ou
`auditEnrollmentExpirationChange()` (`src/features/admin/actions.ts:476-487`,
`:590-607`). Se a escrita de auditoria falhar depois da mutação, pode haver
alteração de acesso/bloqueio sem a trilha global esperada, ainda que existam
eventos de domínio em outros fluxos. Antes de reduzir Auditoria ou retirar
informações de motivo/ator, investigar a transação de cada comando e decidir se
mutação + auditoria devem compartilhar transação ou outbox.

### Perfil emissor aceita salvamento parcial sem explicação

`saveSettingsAction` sempre atualiza nome/cargo e só persiste o perfil emissor
quando há nome legal e CNPJ (`src/features/admin/actions.ts:741-770`). A UI não
marca essa regra nem retorna erro quando a segunda parte não é atualizada. Isso
não é motivo para remover os campos; é uma lacuna de contrato/copy que pode
fazer a operadora acreditar que o Certificado está configurado quando não está.

### Retry destrutivo de JMV tem contexto insuficiente

`retryJmvstreamDeleteAction` recebe apenas `assetId`
(`src/features/admin/actions.ts:418-437`) e `retryJmvstreamAssetDelete` valida
somente a existência do registro local antes de chamar a deleção
(`src/features/jmvstream/asset-deletion.ts:39-55`). Como a operação remota é
destrutiva, a superfície futura deve confirmar Aula/Curso/hash, registrar ator e
manter contexto stale-safe. A solução não é remover o retry: é torná-lo seguro.

### Limites de fila invisíveis

Além dos oito webhooks da projeção recente, Revisões financeiras têm limite 40 e
dead letters da outbox limite 50. Esses limites devem virar paginação e filtros
antes de qualquer decisão de “não precisamos mostrar isso”.

### Possível perda de estado na aba Anexos

O editor mantém Vídeo e Texto com `forceMount`, mas não Anexos
(`src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx:91-131`).
`TabsContent` repassa o comportamento padrão de desmontagem
(`src/components/ui/tabs.tsx:77-86`). É necessário verificar se o componente de
Anexos guarda estado fora da aba; se não guardar, trocar de aba antes de salvar
pode perder upload/edição local. É um item de caracterização, não uma proposta
de remoção.

## 6. Mapa de todas as capacidades mutáveis

### Conteúdo e autoria

| Capacidade | Onde | Papel | Veredito |
| --- | --- | --- | --- |
| Criar/editar Curso | Lista e Configurações do Curso | Admin | Manter |
| Preparar Publicação | Conteúdo | Admin | Manter |
| Criar/editar/reordenar Módulos | Conteúdo | Admin | Manter |
| Criar/editar/reordenar Aulas | Conteúdo/editor | Admin | Manter |
| Publicar lote | Conteúdo | Admin | Manter; é a barreira de consistência curricular |
| Upload/associação JMV | Editor de Aula | Admin | Manter vínculo local; considerar link para portal |
| Upload/anexos R2 | Editor de Aula | Admin | Manter |
| Moderar Comentários | Editor de Aula | Admin | Manter se comentários continuarem no produto |
| Preview como Aluna | Detalhe do Curso | Admin | Manter |

### Acesso, Support e certificados

| Capacidade | Onde | Papel | Veredito |
| --- | --- | --- | --- |
| Buscar Aluna | `/admin/alunos` e Support por Curso | Admin/Support | Manter |
| Ajustar validade | Ficha da Aluna | Admin/Support com permissões distintas | Manter; exige motivo/auditoria |
| Bloquear/restaurar Matrícula | Ficha | Admin/Support | Manter |
| Conceder acesso integral | Ficha | Admin | Manter; raro, crítico e auditado |
| Bloquear/restaurar plataforma | Ficha global | Admin | Manter; é diferente de Matrícula |
| Emitir Certificado manual | Ficha | Admin | Manter |
| Revogar Certificado | Ficha | Admin | Manter |
| Reemitir Certificado | Ficha | Admin/Support limitado | Manter |
| Reconciliação histórica de Certificados | Curso/ações | Admin | Manter como modo avançado confirmado |
| Progresso/liberação contextual | Ficha Support | Support | Manter; resolve incidentes de acesso |

### Financeiro e recuperação

| Capacidade | Onde | Papel | Veredito |
| --- | --- | --- | --- |
| Solicitar reembolso integral | Pedido/ficha | Admin/Support conforme permissão | Manter |
| Conciliar pagamento | Pedido | Admin | Manter |
| Importar extrato | Financeiro | Admin | Manter avançado; exportar evidência |
| Resolver Revisão | Financeiro | Admin | Manter; não é decisão genérica para Support |
| Retry de webhook | Financeiro/área operacional | Admin | Manter com motivo e limite |
| Reprocessar outbox dead letter | Auditoria | Admin | Manter com guardrail |
| Ver receita por Curso | Financeiro | Admin/Support leitura | Manter com período explícito |

### Configuração editorial

| Capacidade | Onde | Papel | Veredito |
| --- | --- | --- | --- |
| Dados do emissor | Configurações | Admin | Manter |
| Banners | Configurações | Admin | Manter; separar semanticamente |
| FAQ | Configurações | Admin | Manter; separar semanticamente |
| Saúde JMV | Configurações | Admin | Reduzir a alerta/link |

## 7. Redundâncias identificadas

### Redundância forte: webhooks recentes

O mesmo `recentWebhooks` é carregado em `getAdminOverview` e exibido na home e
em Financeiro. Financeiro acrescenta retry; a home não acrescenta ação. A
Auditoria ainda mostra o backlog agregado. Resultado: três lugares falam de
webhooks, mas nenhum explica claramente “onde resolvo?”.

**Decisão recomendada:** uma única fila detalhada de recuperação, um sinal
compacto no Painel e link contextual. O provider fica com logs de entrega HTTP;
o Hub fica com correlação, efeito local e retry.

### Redundância forte: Pedidos recentes

A home mostra quatro pedidos, Financeiro mostra pedidos paginados com busca,
IDs e operações, e a ficha Support mostra Pedidos do Curso/Aluna. A home não
permite decisão; é um recorte sem ação.

**Decisão recomendada:** remover da home; manter resumo pago/pendente e links
para Financeiro/ficha.

### Redundância forte: Certificados recentes em Financeiro

Certificados são exibidos na área financeira, na ficha da Aluna, no Curso e na
experiência pública. Financeiro não oferece ação de certificado além do link
público.

**Decisão recomendada:** remover do Financeiro. A existência de Certificados
válidos pode permanecer como métrica contextual do Curso ou da Aluna.

### Redundância parcial: JMVStream

O provider é fonte de vídeo, galeria, conversão e player; o Hub tem projeção
local por Aula, sessão de upload, estado de deleção e sincronização. A contagem
de galerias e a autenticação são espelho/health check; o vínculo Aula/ativo e
falha de deleção são estado local necessário.

**Decisão recomendada:** retirar o espelho de catálogo/health permanente,
preservar a projeção mínima e oferecer link para o portal.

### Redundância parcial: receita e contagens

Receita total e pagamentos existem no Asaas e no Hub. A diferença útil do Hub é
cruzar Curso, Pedido, Concessão e acesso. Sem período explícito, a tela corre o
risco de parecer contábil sem ser extrato.

**Decisão recomendada:** manter resumo comercial por Curso e Pedido; evitar
clonar extrato, tarifas e telemetria do provider sem necessidade. Nomear
claramente “dados do Hub” versus “dados do Asaas”.

## 8. Decisão específica sobre webhooks Asaas

### O que o Asaas já oferece

A documentação oficial do Asaas informa que a cobrança muda de forma assíncrona,
que a integração deve acompanhar Webhooks e consultas posteriores, que o evento
deve ser identificado, validado, aplicado e registrado, e que o processamento
deve ser idempotente. Também existem logs de entrega no portal, com tentativa,
HTTP, timeout, erro e penalização da fila.

Fontes: [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas),
[guia de cobranças](https://docs.asaas.com/docs/guia-de-cobrancas),
[logs de webhook](https://docs.asaas.com/docs/webhooks-logs) e
[penalização de fila](https://docs.asaas.com/docs/queue-penalty).

### O que só o Hub sabe

- qual Pedido local corresponde exatamente ao evento;
- qual snapshot de valor/duração/oferta estava vigente;
- se o pagamento criou Concessão e Matrícula;
- se o e-mail de ativação foi colocado na outbox;
- se houve conflito de identidade, valor, estado terminal ou reembolso;
- se a decisão abriu Revisão e quem a resolveu;
- se o retry local já aplicou ou apenas tentou aplicar o efeito.

### Decisão

As informações de webhook não devem ser removidas do sistema. A UI deve ser
redesenhada para três níveis:

1. **Painel:** “há falhas/stale que podem afetar acesso” + link;
2. **Operação:** eventos falhos/prontos/retryáveis, idade, erro seguro,
   correlação e ação de retry;
3. **Detalhe técnico:** IDs, tentativa, payload sanitizado e vínculo, somente
   para Admin/runbook.

O provider portal deve ser linkado para investigar entrega externa; não deve ser
usado como substituto do estado financeiro local.

## 9. Decisão específica sobre JMVStream

### O que o portal deve continuar governando

- catálogo completo de vídeos;
- organização ampla de galerias;
- analytics nativo do provider;
- controles nativos de retenção/privacidade/entrega;
- operações que não dependem de uma Aula ou Publicação específica.

### O que o Hub precisa governar

- Curso/Módulo/Aula e publicação;
- qual `video_hash` está associado à Aula;
- player/thumbnail usados pela experiência da Aluna;
- upload iniciado pela autoria, estado e sessão;
- processamento pendente/falho;
- deleção pendente/falha e retry seguro;
- verificação de que a publicação não referencia um ativo removido;
- alerta de divergência e link para o portal.

### Decisão

“Gerenciar vídeo no portal” é compatível com “manter projeção local mínima”. Não
é compatível com apagar `jmvstream_video_assets`, `jmvstream_folders` ou a
associação Aula ↔ ativo sem redesenhar o workflow de autoria, publicação e
recuperação.

O primeiro corte recomendado é a UI: remover contagem de galerias, badge de
conexão permanente e detalhes do provider de Configurações; manter um health
badge apenas quando há alerta e um link para o portal. O segundo corte, caso a
operação confirme o fluxo externo, é oferecer no editor “Abrir JMVStream” e
“Associar vídeo existente”, preservando validação e sincronização local.

## 10. Classificação final dos itens

| Item | Decisão | Confiança | Risco de retirar | Observação |
| --- | --- | --- | --- | --- |
| Home: webhooks detalhados | Remover da home; manter em uma fila | Alta | Baixo | A mesma coleção aparece em Financeiro; o retry não está na home. |
| Home: pedidos recentes | Remover da home | Alta | Baixo | Financeiro é canônico. |
| Home: próximas ações estáticas | Remover ou tornar dinâmica | Alta | Baixo | Navegação duplicada. |
| Home: prontidão média | Compactar junto da lista | Média | Baixo | Checklist duplicado; preservar o diagnóstico acionável. |
| Home: cursos sem link de correção | Linkar ou reduzir a contador | Alta | Médio | Informação sem próximo passo é observação. |
| Home: falhas de webhook | Corrigir fonte antes de manter | Alta | Alto | Hoje observa apenas oito eventos recentes. |
| Financeiro: métricas sobre 20 pedidos | Corrigir recorte ou retirar | Alta | Alto | Sem período, semântica enganosa. |
| Financeiro: Certificados recentes | Remover | Alta | Baixo | Fora da decisão financeira. |
| Financeiro: webhooks | Mover/consolidar | Alta | Médio | Manter retry em superfície operacional única. |
| Financeiro: Pedido/Review/Reembolso | Manter | Alta | Alto | Decisão financeira e acesso. |
| Financeiro: extrato | Manter avançado/exportável | Alta | Alto | Evidência de reconciliação. |
| Auditoria: backlog e dead letters | Manter, compactar | Alta | Alto | Recuperação rara e auditoria. |
| Auditoria: contagens de sucesso de e-mail | Rebaixar | Média | Baixo | O alerta/dead letter é mais relevante. |
| Auditoria: vídeos pendentes sem ação | Rebaixar/remover do primeiro nível | Média | Médio | Manter monitoramento interno e link quando crítico. |
| Aprendizagem: página inteira | Manter como analytics | Alta | Alto | Decisão de produto/privacy explícita. |
| Aprendizagem: ID bruto/medianas na primeira camada | Esconder/compactar | Alta | Baixo | Técnico e sem decisão imediata. |
| Configurações: health JMV permanente | Remover/rebaixar | Alta | Médio | Portal governa catálogo; Hub precisa do vínculo/recovery. |
| Editor de Aula: vínculo/upload JMV | Manter, talvez linkar portal | Alta | Alto | Necessário para publicação e player. |
| Configurações: emissor | Manter | Alta | Alto | Usado em Certificados. |
| Configurações: banners/FAQ | Manter, separar semanticamente | Alta | Médio | Conteúdo editorial da área da Aluna. |
| Alunas/ficha | Manter | Alta | Alto | Acesso, suporte e certificados. |
| Support contextual | Manter | Alta | Alto | Resolve incidentes sem acesso global. |
| `/admin/privacidade` loading-only | Remover arquivo órfão | Alta | Baixo | Workflow foi removido e não há página. |
| `/admin/alunas` redirect | Manter temporariamente | Média | Baixo | Compatibilidade de links antigos. |

## 11. Ordem recomendada de simplificação

### Fase 0 — medir antes de apagar

1. Registrar visualização e abertura de detalhe para cada bloco, sem PII.
2. Registrar clique em exportação, retry, reembolso, conciliação, extrato,
   “Abrir portal” e abas de Curso/Aluna.
3. Levantar tickets de Support que citam acesso expirado, liberação, vídeo,
   reembolso, Certificado e webhook.
4. Levantar por 30 dias a quantidade de webhooks falhos/stale, Revisões,
   reembolsos incertos, dead letters, uploads falhos e deleções pendentes.
5. Confirmar com a operadora se o fluxo JMV desejado é:
   - upload no Hub;
   - upload no portal + associação no Hub;
   - gestão integral no portal + importação/validação no Hub.

Sem essa fase, “não uso” continua sendo sensação, não evidência.

### Fase 1 — remoções de baixo risco e consolidação

1. Retirar da home Webhooks recentes, Pedidos recentes e Próximas ações.
2. Manter na home apenas métricas, saúde global e uma lista de pendências com
   link direto.
3. Retirar Certificados recentes de Financeiro.
4. Escolher Auditoria ou Financeiro como fila detalhada única de webhook; a
   recomendação é Auditoria para recovery e um resumo/link em Financeiro.
5. Corrigir o indicador de falha da home para usar backlog global.
6. Remover o `loading.tsx` órfão de `/admin/privacidade` depois do inventário de
   links.

### Fase 2 — reduzir detalhes técnicos na primeira camada

1. Colapsar IDs de checkout/pagamento/evento em detalhes do Pedido/evento.
2. Trocar ID bruto da Publicação por Curso + versão legível em Aprendizagem.
3. Exibir apenas quatro métricas analíticas na tabela inicial; preservar
   medianas no detalhe/CSV.
4. Converter o health JMV em badge de incidente + link portal + detalhes de
   upload/deleção locais somente quando houver pendência.
5. Separar visualmente emissor, banners e FAQ em subseções com linguagem de
   conteúdo/configuração, não “monitoramento”.

### Fase 3 — mudanças que exigem decisão de produto

1. Eventual retirada do upload JMV do Hub; (Decisão: Não remover)
2. eventual substituição por associação manual de vídeo existente;
3. remoção da página de analytics caso a decisão de produto seja revertida;
4. remoção do redirect legado `/admin/alunas`;
5. qualquer alteração na retenção, auditoria, inbox, outbox ou extrato.

Esses itens não devem ser incluídos em uma limpeza visual rápida.

## 12. Dependências e guardrails de implementação futura

- Criar testes de caracterização da home antes de remover blocos.
- Primeiro corrigir a semântica de contagens/páginas financeiras; depois
  simplificar a UI. Não esconder um indicador errado sem decidir sua origem.
- Primeiro escolher a fila canônica de webhooks; depois remover a duplicação de
  Financeiro/Home.
- Preservar as permissões e testar Admin versus Support em cada superfície.
- Não apagar tabelas/migrations por uma remoção de UI. A camada de dados pode
  continuar necessária para cron, reconciliação, auditoria ou suporte.
- Não automatizar links de provider com credenciais, tokens ou URLs assinadas.
- Não mover `retry`, `refund`, `reconcile`, `reprocess` ou `certificate` para
  um componente genérico sem manter motivo, confirmação, auditoria e
  autorização server-side.
- Para JMVStream, confirmar contrato externo antes de trocar polling por
  webhook ou antes de alterar o payload de `gallery`.

## 13. Perguntas que ainda exigem evidência humana

1. Quais blocos da home são consultados antes de abrir Financeiro, Cursos ou
   Alunas? (nao sei)
2. A operadora já resolveu incidentes usando webhooks locais, retry de outbox,
   reconciliação ou extrato? Com que frequência? (No 1 mes de funcionamento, não)
3. O portal Asaas é usado para investigar entrega, ou só para consultar valor/
   recebimento? (Usado para analisar vendas, mas tambem analisar erros de webhook)
4. O portal JMVStream será a única interface de upload no futuro? Quem fará a
   associação do vídeo à Aula e a validação antes da Publicação? (O sistema de upload pode ser mantido, mas a prioridade é anexaçào. Nao remova o upload)
5. A tabela de Aprendizagem é usada para corrigir Aulas, para relatórios ou
   apenas para inspeção ocasional? (Pra falar a verdade nem sei pra que serve)
6. Existe obrigação operacional de consultar globalmente `último acesso`,
   `expirando em breve`, certificados recentes ou vídeos pendentes? (existe)
7. O papel Support precisa dos valores de receita por Curso no primeiro nível ou
   apenas do Pedido individual associado à dúvida? (Suporte precisa ver tudo relacionado a valores financeiros)

## 14. Conclusão

O painel deve ficar menor por concentração de responsabilidade, não por
apagamento indiscriminado de dados técnicos. A arquitetura já possui boas
fronteiras: Admin/Support, operação/analytics, Pedido/Concessão/Matrícula,
provider/projeção local e alerta/detalhe.

O principal trabalho de produto é fazer essas fronteiras aparecerem na UI:

- Painel para triagem;
- Cursos/Alunas para operar o produto;
- Financeiro para decidir dinheiro e acesso;
- Auditoria para recuperar efeitos e investigar histórico;
- Aprendizagem para analytics agregado;
- Configurações para dados duráveis e conteúdo editorial;
- portal Asaas/JMVStream para capacidades nativas do fornecedor.

Se a primeira rodada for restrita às remoções de baixo risco da Fase 1, a
redução de ruído será perceptível sem sacrificar recuperação financeira,
suporte, publicação de conteúdo, certificados ou integridade dos vídeos.

## 15. Evidências externas

- Asaas: [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas),
  [guia de cobranças](https://docs.asaas.com/docs/guia-de-cobrancas),
  [logs de Webhook](https://docs.asaas.com/docs/webhooks-logs),
  [penalização de fila](https://docs.asaas.com/docs/queue-penalty),
  [listar pagamentos](https://docs.asaas.com/reference/listar-cobrancas) e
  [extrato](https://docs.asaas.com/reference/retrieve-extract).
- JMVStream: [API pública](https://jmvstream.com/en/developer) e
  [API REST de vídeos](https://jmvstream.com/pt-br/rest-api-for-videos/).
- Mercado: [Thinkific Admin Dashboard](https://support.thinkific.com/hc/en-us/articles/360030719833-Admin-Dashboard-A-Closer-Look),
  [Thinkific Analytics](https://www.thinkific.com/features/analytics/),
  [Kajabi Help Center](https://help.kajabi.com/) e
  [Shopify Admin overview](https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview?links=false).
- Comunidade: [webhook reliability](https://www.reddit.com/r/webdev/comments/1nrtlcp/best_practices_for_handling_webhooks_reliably/),
  [Stripe webhook debugging](https://www.reddit.com/r/stripe/comments/1sumo3c/stripe_webhook_debugging/) e
  [Instructure sobre ownership de mídia](https://community.instructure.com/en/discussion/409368/studio-api-to-search-all-media).

## 16. Plano de reorganização aprovado para implementação

As respostas operacionais recebidas depois da auditoria alteram o plano em
quatro pontos:

- o upload JMVStream permanece; a prioridade passa a ser associação/seleção do
  vídeo na Aula, não remoção do upload;
- Support precisa continuar vendo os valores financeiros completos;
- `último acesso` e `expirando em breve` permanecem como diagnóstico de acesso;
- Aprendizagem deixa de ser informação de primeira camada e vira relatório
  avançado até que seu uso seja comprovado.

### Arquitetura de informação alvo

| Responsabilidade | Entrada canônica | O que fica nessa camada |
| --- | --- | --- |
| Triagem Admin | `/admin` | quatro métricas, saúde global, catálogo pendente e links acionáveis |
| Autoria | `/admin/cursos` e detalhe do Curso | conteúdo, publicação, oferta, disponibilidade, Alunas e Certificado |
| Acesso/Support | `/admin/alunos` e `/admin/operacao/cursos/[courseId]/alunas` | identidade, validade, bloqueio, progresso e contexto financeiro |
| Decisão financeira | `/admin/financeiro` | Pedido, receita, Revisão, reembolso, conciliação e extrato |
| Recuperação/auditoria | `/admin/auditoria` | webhooks, outbox, sinais stale, dead letters e trilha global |
| Relatório avançado | `/admin/aprendizagem` | métricas agregadas, filtros/exportação e detalhes técnicos |
| Configuração | `/admin/configuracoes` | emissor, conteúdo editorial e health de provider somente quando acionável |
| Provider | portal Asaas/JMVStream | logs/telemetria nativos, catálogo de mídia e configurações externas |

### Mudanças de experiência

1. **Painel:** retirar pedidos recentes, webhooks recentes e atalhos estáticos;
   manter saúde global e transformar pendências de Curso em links diretos.
2. **Financeiro:** retirar Certificados recentes; retirar a lista de Webhooks;
   manter um alerta/link para Auditoria; preservar todas as operações financeiras
   e todos os valores para Support.
3. **Auditoria:** receber a lista paginada e pesquisável de webhooks falhos ou
   retryáveis, com retry auditado; paginar Revisões e dead letters.
4. **JMVStream:** manter upload e associação na Aula; mover expiração stale para
   cron; tornar Configurações somente leitura, compacta e acionável.
5. **Support:** manter a ficha e os valores financeiros; remover a rota
   duplicada da navegação e preservar redirect de compatibilidade.
6. **Aprendizagem:** rotular como relatório avançado, explicar período, trocar
   ID bruto da Publicação por contexto legível e deixar medianas/CSV como
   detalhe.
7. **Limpeza:** remover `loading.tsx` órfão de privacidade e componentes sem
   consumidores depois de verificar referências.

### Limite desta execução

Serão implementadas as mudanças de superfície, projeção, navegação,
paginação, health/read-only, testes e documentação do comportamento. Não será
feito upload portal-only nem troca de polling JMV por webhook, porque a decisão
recebida foi manter upload e o contrato externo de webhook ainda não está
validado. Também não serão removidas tabelas, migrations, inbox, outbox,
concessões, Certificados ou eventos de auditoria.

O plano operacional detalhado, com ordem, arquivos, critérios de aceite e
comandos de verificação, está em
[admin-dashboard-implementation-plan-2026-09-08.md](admin-dashboard-implementation-plan-2026-09-08.md).

## 17. Estado após implementação

O plano foi executado no worktree. A reorganização agora mantém o Painel para
triagem, Financeiro para decisão monetária, Auditoria para recuperação,
Aprendizagem como relatório avançado e JMVStream como provider contextual.

Também foram corrigidos os recortes globais de KPI, a consulta ampla da home,
a fila limitada de Webhooks, a paginação de Revisões/dead letters, a mutação
indesejada do health JMV em leitura, a rota duplicada de Support e os artefatos
órfãos. Upload JMV, associação na Aula, valores financeiros de Support,
`último acesso` e `expirando em breve` foram preservados conforme as decisões
recebidas.

O upload portal-only e a troca de polling JMV por webhook não foram feitos:
continuam sem contrato externo validado e não eram necessários para melhorar a
experiência agora.

## 18. Segunda revisão após restaurar compras e Certificados

### Superfície auditada

`/admin` Admin e suas projeções/consumidores em
`src/features/admin/server.ts`, além das superfícies relacionadas de Financeiro,
Auditoria, Configurações, navegação e relatório de Aprendizagem. A revisão foi
novamente feita por código, testes, contratos de produto/design e análise
estática; não houve inspeção renderizada em navegador.

### Resultado

As duas listas restauradas melhoram a primeira leitura sem reintroduzir o ruído
removido:

- **Últimas compras** é uma lista curta de triagem, agora com status, Curso,
  valor, data/hora e link direto para Financeiro já filtrado pelo Pedido;
- **Últimos certificados emitidos** é uma lista curta de emissão, com Aluna,
  Curso, código e data, apontando para a validação pública canônica;
- a home não voltou a exibir Webhooks ou Certificados dentro de Financeiro;
- a lista completa de Pendências do catálogo foi substituída por links de ação,
  enquanto a saúde mantém a visão agregada.

### Score técnico da superfície

Avaliação estática, sem prova de viewport real:

| Dimensão | Score | Evidência |
| --- | ---: | --- |
| Acessibilidade | 4/4 | headings, links semânticos, labels/aria-labels existentes, status textual e ações de teclado pelos componentes locais |
| Performance | 4/4 | projeção da home sem `content_json`, leitura paralela de saúde/compras/Certificados e KPIs globais separados da lista paginada |
| Theming | 4/4 | tokens, `Card`, `Badge`, `Button`, `Progress` e variantes existentes; detector estático sem achados |
| Responsividade | 3/4 | grids empilham abaixo de `xl` e listas usam flex; permanece não verificada em viewport real |
| Anti-padrões | 4/4 | detector `impeccable` retornou `[]`; composição agora tem quatro grupos com responsabilidades distintas |
| **Total** | **19/20** | **Bom, com verificação visual ainda pendente** |

### O que não recomendo remover agora

Não há nova remoção sustentada por evidência após a restauração. Compras e
Certificados têm perguntas operacionais diferentes de Financeiro/Auditoria:
“o que entrou por último?” e “o que foi emitido por último?”. Remover esses
blocos novamente reduziria a utilidade da home sem eliminar uma duplicação real.

### Refinamentos ainda possíveis

1. **Ver todos:** compras já têm link por linha e ação global para Financeiro.
   Certificados não possuem uma lista administrativa global canônica; criar um
   novo destino só para o link exigiria decisão de produto. Manter como está é
   mais coerente do que inventar outra rota.
2. **Janela explícita:** se a operadora passar a interpretar os cards como
   relatório, adicionar “últimas 4 compras”/“últimos 6 certificados” ou um
   período. Hoje os títulos “Últimas” e “mais recentes” comunicam triagem, não
   total histórico.
3. **Health acionável:** o estado de Saúde da operação agora separa Badge de
   estado e botão “Abrir”, apontando para Auditoria, Financeiro ou Cursos. Não há
   novo ajuste necessário nessa camada.
4. **Validação visual futura:** testar a home em viewport estreito, com nomes
   longos, mensagens de erro, quatro Cursos pendentes e pedidos com status
   longos. O código usa reflow, truncamento e componentes existentes, mas uma
   revisão estática não prova a aparência final.

### Veredito da segunda revisão

O dashboard está equilibrado para o estágio atual: triagem operacional,
compras recentes, emissões recentes e pendências de catálogo. A próxima
melhoria de alto valor não é remover mais conteúdo; é observar uso real por
algumas semanas e medir quais blocos geram navegação para Financeiro, Cursos,
Alunas e Auditoria. O restante é refinamento de detalhe, não uma nova
reorganização estrutural.
