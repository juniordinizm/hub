---
status: implemented
owner: engineering
audited_commit: a2f4588
surface: /admin/financeiro
---

# Plano final de refinamento do Financeiro

Este plano foi escrito contra o commit `a2f4588` e o working tree atual, que já
contém mudanças intencionais do sprint de reorganização do Admin. Ele é um plano
incremental: preserva as três abas, a fila de revisões, a sincronização em modal,
as ações dentro do detalhe do Pedido, os quatro estados de Saúde financeira e a
análise por período. O objetivo é remover redundância e ambiguidade sem retirar
evidência necessária para a operação.

## Escopo auditado

- `src/app/(admin)/admin/financeiro/page.tsx` — entrada da rota, permissões,
  seleção da aba e carregamento condicional das projeções.
- `financial-overview.tsx` — KPIs globais, Saúde financeira, integração Asaas,
  receita por Curso e fila de Revisões.
- `financial-orders-table.tsx`, `financial-orders-table-client.tsx` e
  `financial-orders-filter-menu.tsx` — busca, filtros, paginação e tabela.
- `financial-order-details-dialog.tsx`, `financial-reconcile-operation.tsx` e
  `financial-refund-operation.tsx` — detalhe do Pedido e operações mutáveis.
- `financial-payment-review.tsx` — fila e histórico de Revisões financeiras.
- `financial-analysis.tsx`, `financial-period-select.tsx` e `loading.tsx` —
  análise, seleção de período e estados de carregamento.
- `financial-statement-import.tsx` e `date-range-picker-field.tsx` —
  sincronização Asaas, cursor, histórico e seleção do intervalo.
- `src/features/admin/server.ts`, `presentation.ts`, `status-presentation.ts`,
  `src/features/payments` e os testes diretamente ligados à rota.

Não houve inspeção renderizada em navegador. O projeto proíbe abrir URL local;
portanto, recomendações de aparência final, contraste calculado e overflow real
em viewport específico precisam de uma validação visual posterior autorizada.
O detector estático `impeccable detect --json` retornou `[]` e não há arquivo de
exceções ativo.

## Veredito

A arquitetura atual está correta para o estágio do produto. As três abas têm
responsabilidades diferentes e não recomendo criar uma quarta aba, uma rota
exclusiva para sincronização ou uma lista local de Webhooks/Certificados.

O próximo ganho não vem de adicionar gráficos ou mais KPIs. Vem de tornar uma
única resposta evidente em cada lugar:

- Visão geral responde “há algo que precisa de ação agora?”;
- Pedidos responde “qual compra é esta e qual decisão posso tomar?”;
- Análises responde “como os valores se comportaram neste período?”;
- Sincronização responde “o que foi consultado e qual foi o resultado da
  sincronização?”.

Avaliação estática, sem prova renderizada: 16/20, faixa boa. Theming e uso dos
primitives estão fortes; acessibilidade, responsividade, performance e integridade
perdem pontos por estados de paginação, rolagem duplicada, interação de linha,
texto técnico exposto e trabalho de banco desnecessário.

## Achados prioritários

### P1 — Fazer a Visão geral priorizar ação e ter uma única fonte de estado

**Evidência**

- `financial-overview.tsx:129` renderiza KPIs, `:182` Saúde financeira, `:292`
  Receita por curso e `:332` Pendências financeiras; a fila de maior risco fica
  depois do resumo passivo.
- `financial-overview.tsx:202` exibe `financialSignal.helper` no cabeçalho,
  enquanto `:515` em `FinancialIntegrationStatus` exibe outro estado da mesma
  integração.
- `presentation.ts:529-595` calcula o sinal sem receber a quantidade de
  Revisões pendentes nem solicitações de reembolso; o cabeçalho pode dizer que
  não há pendência enquanto a fila abaixo contém Revisões.
- `server.ts:1557-1596` preserva `totalCount` quando uma página de Revisões fica
  vazia, mas `financial-overview.tsx:365-383` interpreta qualquer
  `reviews.length === 0` como “Tudo em ordem”.
- A contagem global de Pedidos em aberto exclui Checkouts encerrados em
  `server.ts:1362-1373`, mas o link do tile “Pendentes” usa apenas
  `status=pending` em `financial-overview.tsx:217-229` e a busca de Pedidos não
  repete o predicado de Checkout em `server.ts:1198-1200`.

**Impacto**

O operador precisa atravessar resumos antes da fila de decisão e pode receber
duas mensagens concorrentes sobre a integração. Em uma página de Revisões fora
do intervalo, “Tudo em ordem” contradiz o contador e o botão “Anteriores”. O
tile “Pendentes” também pode abrir uma lista com Checkouts falhos que não fazem
parte do valor em aberto.

**Correção**

1. Tornar a fila de Revisões o primeiro bloco acionável da Visão geral quando
   houver itens; quando estiver vazia na página 2+, mostrar “Nenhuma Revisão
   nesta página”, a faixa correta e o link para a página anterior. Só mostrar
   “Tudo em ordem” quando `totalCount === 0`.
2. Remover o helper dinâmico do cabeçalho de Saúde financeira e deixar a
   `FinancialIntegrationStatus` como a única mensagem operacional de Webhooks.
   Se o helper de sinal não tiver outro consumidor, remover também o campo
   `label`/projeção órfã em uma limpeza separada.
3. Reordenar os blocos inferiores para Revisões antes de Receita por Curso. A
   Receita por Curso continua visível, mas é uma consulta passiva.
4. Criar um predicado nomeado de “Pedido em aberto” usado pelo contador, link e
   filtro. Manter um caminho explícito separado para Checkouts encerrados, sem
   chamá-los de recebimentos em aberto.

**Prioridade**: P1. **Esforço**: M. **Risco**: MED; a mudança altera a ordem da
primeira leitura e o contrato dos filtros, mas não altera a autorização nem o
estado financeiro.

### P1/P2 — Tornar Pedidos uma tabela semanticamente simples e operacionalmente honesta

**Evidência**

- `financial-order-details-dialog.tsx:89-90` adiciona `onClick` à linha `<tr>` e
  define `tabIndex={-1}`. O botão “Detalhes” já existe em `:124-142` e é o único
  alvo de teclado.
- `financial-orders-table.tsx:173-174` envolve `Table` em `overflow-x-auto`,
  enquanto `src/components/ui/table.tsx:10` já cria o mesmo contêiner.
- `financial-orders-filter-menu.tsx:218-219` chama a ação de “Limpar filtros”,
  mas `baseHref()` preserva `search`; a busca não vira pill nem entra na contagem
  de filtros ativos.
- `courses-revenue-table.tsx:94-95` repete a rolagem externa e
  `:148-183` mantém paginação para uma lista que, pela decisão de produto, deve
  permanecer pequena e sem busca.

**Impacto**

A linha parece um controle, mas não é ativável por teclado e pode devolver foco
de forma inconsistente quando aberta por clique na linha. A rolagem aninhada
cria dois contextos de scroll. “Limpar filtros” pode deixar a lista filtrada e
produzir falsa sensação de reset. A paginação de Cursos adiciona estado de URL e
controles a uma seção que deve ser apenas um resumo curto.

**Correção**

1. Fazer o botão “Detalhes” ser o único acionador. Remover o clique da linha e o
   `cursor-pointer`, ou implementar um padrão de linha totalmente acessível com
   Enter/Espaço e foco de retorno determinístico; a opção recomendada é remover a
   interação duplicada.
2. Remover o `overflow-x-auto` externo das duas tabelas e manter a rolagem no
   primitive `Table`. Validar foco e rolagem local em viewport estreito.
3. Representar a busca como estado ativo: incluir “Busca: …” com ação de limpar,
   ou separar claramente “Limpar busca” de “Limpar filtros”. O botão de limpeza
   nunca deve preservar `q` se disser que limpa tudo.
4. Remover `revenuePage` e a paginação da Receita por Curso depois de confirmar
   que a decisão de produto continua sendo uma lista pequena. Se a população
   deixar de ser pequena, não ocultar linhas com um limite silencioso: criar uma
   projeção paginada com faixa/total antes de reintroduzir o controle.

**Prioridade**: P1 para interação e reset de filtros; P2 para rolagem e Cursos.
**Esforço**: S/M. **Risco**: LOW, exceto a remoção da paginação, que exige
confirmação de população operacional.

### P1/P2 — Aplicar divulgação progressiva e copy de operador no detalhe

**Evidência**

- `financial-payment-review.tsx:245-261` repete o sujeito/Curso no cabeçalho e
  em `PaymentReviewContext`, mostra Badge “Pendente” em todos os cards da fila
  e imprime `review.reason` diretamente.
- Razões internas como `installment_enrichment_pending` são persistidas em
  `asaas-webhook-processor.ts:1228-1234`; razões de identidade e divergência
  também podem ser enum-like.
- `financial-order-details-dialog.tsx:280-282` e `:373-390` imprimem estados
  brutos do provedor; `OrderProviderSection` aparece mesmo quando ainda não há
  correlação, exibindo vários placeholders.
- `financial-order-details-dialog.tsx:496-504` coloca Ações depois de Resumo,
  Checkout, Valores, Integração e Reembolso.
- `financial-refund-operation.tsx:63-69` fala em digitar o identificador antes
  de o campo existir e diz que o acesso permanece ativo; esse componente também
  é usado em Revisão de identidade, cujo fluxo não libera acesso.
- `financial-refund-operation.tsx:22`, `:71` e `:114` trocam a árvore do
  formulário após senha sem anunciar ou focar o próximo passo.
- `financial-operations-shared.ts:26-40` recomenda encaminhar um código de
  ocorrência, mas as operações exibem apenas a mensagem, sem código seguro.

**Impacto**

A fila fica mais alta sem aumentar a informação útil, o operador precisa
interpretar códigos internos e o detalhe apresenta dados técnicos antes da
decisão. O fluxo de reembolso pode instruir uma ação invisível e comunicar um
estado de acesso incorreto para identidade pendente.

**Correção**

1. Na fila ativa, mostrar o tipo, o sujeito/Curso uma única vez, estados
   “Pedido”/“Asaas”, motivo traduzido e próxima ação. Remover o Badge “Pendente”
   redundante; mantê-lo no histórico. Usar `h3` e `aria-labelledby` para cada
   `article`.
2. Criar um mapa de razões conhecidas em português, com instrução de recuperação.
   Guardar o código bruto apenas em detalhe técnico, identificado como tal.
3. No Pedido, colocar Resumo, Valores e Ações antes da seção técnica. Exibir
   “Integração Asaas” somente quando houver evidência; agrupar IDs, risco e
   estados brutos em uma seção recolhível. Não remover os IDs, pois ainda são
   necessários para conferência externa.
4. Corrigir o fluxo de reembolso para instruções por etapa, foco no primeiro
   campo da etapa seguinte e mensagem específica para identidade: nenhum acesso
   é liberado e o reembolso integral é a ação necessária.
5. Mapear estados Asaas conhecidos, preservar fallback neutro para novos estados
   e não converter datas do provedor sem fuso explícito. Se a operação precisa de
   correlação, gerar/exibir um identificador seguro em vez de pedir um código que
   não existe na tela.
6. Renomear ações para distinguir solicitação de confirmação: “Confirmar
   solicitação de reembolso” e “aguarda confirmação do Asaas”.

**Prioridade**: P1 para razões, identidade e reembolso; P2 para divulgação
progressiva e headings. **Esforço**: M. **Risco**: MED; textos operacionais
precisam permanecer coerentes com a ADR-0005 e com as permissões.

## Plano de execução por fases

### Fase 0 — Caracterização e contratos de população

Antes de alterar a composição, criar testes que registrem o comportamento
esperado:

- revisão em página vazia com `totalCount > 0` não pode dizer “Tudo em ordem”;
- contador e link de Pedidos em aberto usam o mesmo predicado de Checkout;
- busca, pills e limpeza geram URLs coerentes;
- botão “Detalhes” abre e devolve foco por teclado;
- fila ativa não repete contexto nem expõe razão técnica sem tradução;
- fluxo de senha do reembolso anuncia/foca a segunda etapa;
- estados sem dados exibem “Sem base” quando não há denominador.

Usar como exemplares `financial-tabs.test.tsx`,
`financial-order-details-dialog.test.tsx`, `financial-orders-filter-menu.test.tsx`
e `date-range-picker-field.test.tsx`. Não substituir esses testes por snapshots
amplos.

Também alinhar os contratos E2E: `tests/e2e/accessibility.spec.ts:149` ainda
procura “Receita e liberação de acesso”, e
`tests/e2e/critical-journeys.spec.ts:864-866` procura o Checkout na tabela,
embora o detalhe atual oculte o ID até o diálogo. O Vitest não executa
`tests/e2e`, portanto a suíte unitária verde não prova esse fluxo.

**Gate**: `bun run test -- <testes afetados>` e `bun run test:e2e -- <specs afetadas>`
devem passar antes da reorganização visual.

### Fase 1 — Visão geral orientada a decisão

Arquivos principais: `financial-overview.tsx`, `page.tsx`, `server.ts`,
`presentation.ts` e seus testes.

- Reordenar Pendências, Saúde, KPIs e Receita por Curso conforme o estado,
  mantendo vazio compacto quando não houver Revisões.
- Remover o helper duplicado de integração ou estreitar seu texto para não
  prometer ausência de Revisões/reembolsos que ele não consulta.
- Implementar o filtro nomeado de Pedido em aberto e um caminho separado para
  Checkouts encerrados.
- Manter `Receita bruta paga` do resumo global claramente diferente de
  `Recebido confirmado` da análise por período; se os dois continuarem com o
  mesmo “Valor médio”, renomear para “Médio dos pedidos atualmente pagos” e
  “Médio do recebimento confirmado”.

**Gate**: testes de projeção e página passam; nenhuma permissão muda; os quatro
tiles de Saúde continuam navegáveis.

### Fase 2 — Tabela e filtros

Arquivos principais: `financial-orders-table.tsx`,
`financial-orders-table-client.tsx`, `financial-orders-filter-menu.tsx`,
`financial-order-details-dialog.tsx`, `courses-revenue-table.tsx` e
`src/components/ui/table.tsx` somente se o primitive precisar de ajuste.

- Remover clique da linha ou implementar o padrão acessível completo; a
  recomendação é manter apenas o botão “Detalhes”.
- Eliminar rolagem externa duplicada e preservar caption, cabeçalhos, `scope`,
  alinhamento numérico e rolagem local do primitive.
- Incluir busca no estado ativo e fazer a limpeza ser semanticamente correta.
- Remover paginação da lista pequena de Cursos após a confirmação de população;
  não adicionar contador só para justificar o controle removido.

**Gate**: testes de teclado/foco, URLs de filtros, estado vazio e viewport
estreito por markup passam; `bun run check` e `bun run typecheck` passam.

### Fase 3 — Revisões, Pedido e operações

Arquivos principais: `financial-payment-review.tsx`,
`financial-order-details-dialog.tsx`, `financial-refund-operation.tsx`,
`financial-reconcile-operation.tsx` e `financial-operations-shared.ts`.

- Traduzir razões e estados conhecidos; manter códigos brutos em disclosure
  técnico.
- Remover duplicatas da fila e tornar artigos navegáveis por headings.
- Mover ações para perto dos valores, sem alterar os guards server-side.
- Corrigir foco/announcement do reembolso e diferenciar solicitação de
  confirmação.
- Remover o bloco de Integração vazio para Pedido sem evidência e recolher o
  restante dos IDs/estados técnicos.
- Remover o toast duplicado quando a mensagem inline já permanece visível no
  diálogo; manter uma confirmação acessível, não duas notificações concorrentes.

**Gate**: cobertura jsdom de sucesso, erro, permissão de Support/Admin, foco,
reembolso em duas etapas e Pedido parcelado; suíte financeira completa passa.

### Fase 4 — Análise e carregamento

Arquivos principais: `financial-analysis.tsx`, `financial-period-select.tsx`,
`loading.tsx`, `server.ts` e testes.

- Manter “Recebimentos em aberto” e reorganizar os cards em dois grupos:
  “Resumo financeiro” e “Indicadores operacionais”. O líquido deve ser lido
  como estimativa; recebido confirmado e aberto devem ficar próximos.
- Mostrar “Sem base” para média/conversão quando o denominador for zero, sem
  transformar ausência de dados em R$ 0,00 ou 0%.
- Documentar no próprio período a base temporal: recebimentos usam
  `coalesce(paid_at, created_at)`, reembolsos usam `confirmed_at` e pendências
  usam `created_at`. Não chamar essa mistura de taxa de coorte.
- Ajustar o loader para representar as três abas e o seletor na mesma topologia
  da tela final; renomear chaves de skeleton que ainda dizem `fee-rate`.
- Remover `financialHealth` de DTOs de Pedidos/Análise se o cabeçalho deixar de
  depender dele. A análise e a tabela não consomem a agregação global; isso
  elimina uma consulta de toda a tabela de `orders` em cada navegação.

**Gate**: testes de análise, loader e navegação; `bun run test`, `bun run check`
e `bun run typecheck`.

### Fase 5 — Sincronização e desempenho de escala

Arquivos principais: `financial-statement-import.tsx`, `server.ts`,
`reconciliation.ts`, `asaas-query-policy.ts` e migrations somente se a medição
justificar.

- Corrigir `sm:col-span-3` em um formulário que declara duas colunas.
- Unificar a descrição e o Alert informativo do modal. Manter o Alert de cursor
  ativo e o histórico “Últimas sincronizações”.
- Como o modal não lista linhas importadas, trocar “consulta das movimentações”
  por “registro para conciliação/auditoria” ou criar uma leitura paginada
  separada; a recomendação atual é estreitar a promessa para não criar outra
  superfície.
- Limitar a consulta de Revisões de identidade aos IDs da página de Pedidos, em
  vez de enviar todos os IDs pendentes ao navegador.
- Medir `EXPLAIN (ANALYZE, BUFFERS)` para busca com `ILIKE`, contagem de página e
  análise temporal antes de criar índices. Não trocar por índice ou cache sem
  dados de volume.
- Remover `getAdminFinancialData` somente depois de retargetear os testes para
  as três projeções realmente usadas pela rota.
- Se sincronizações grandes excederem o tempo de Server Action, transformar o
  fluxo em job durável usando o cursor existente; não improvisar concorrência
  em memória de uma instância serverless.

Medição executada no Development: 8 Pedidos, busca textual com `Seq Scan` em 2
buffers e 0,111 ms; filtro/ordenação por status em 2 buffers e 0,092 ms. A
população não justifica índice trigram ou cache neste momento; a decisão deve ser
reavaliada com volume real.

**Gate**: `bun run db:migrations:check`, testes de sincronização e uma medição
comparável antes/depois. Mudança de migration exige atualizar o guia operacional
canônico e validar em transação descartável.

### Fase 6 — Parcelas e liquidação, separada da limpeza visual

O limite de não exibir “saldo em caixa” foi preservado. Nesta série, a parte de
evidência de parcelas foi implementada: a migration persiste pagamentos individuais
por ID externo, número, vencimento, datas textuais do provedor, status, valor,
líquido, taxa e antecipação; a conciliação consulta o endpoint do parcelamento e
faz upsert idempotente; e o detalhe do Pedido mostra a última sincronização, um
resumo de cobranças confirmadas/não confirmadas e a tabela individual.

O que permanece deliberadamente separado é a liquidação bancária. O Hub não infere
“em caixa” a partir de `dueDate`, status, antecipação ou proximidade com linha de
extrato. Para adicionar agregados “liquidado” e “a receber” ao dashboard ainda é
necessário definir uma fonte que prove disponibilidade na conta, contrato de
retenção e regra financeira explícita.

## Dependências

1. Fase 0 antes de qualquer mudança de IA, para evitar regressão silenciosa.
2. Fase 1 antes de Fase 2, porque o predicado de Pedido em aberto alimenta links,
   filtros e estados vazios.
3. Fase 2 antes de Fase 3, porque o diálogo depende do único acionador de linha e
   do foco de retorno.
4. Fase 3 antes de remover ou reduzir `FinanceHelp`, pois a nova copy deve estar
   estabelecida antes de decidir quais ajudas ainda são necessárias.
5. Fase 4 pode ser executada após Fase 1; Fase 5 depende de medição; a parte de
   evidência da Fase 6 foi implementada, enquanto a liquidação permanece um
   projeto separado.

## Política de `FinanceHelp`

Manter ajuda somente onde há fórmula, permissão, risco ou limitação real:

- manter: Valor em aberto, Pedidos pagos/registrados, Saúde financeira,
  Análise por período e Ações do Pedido;
- remover: ajuda do cabeçalho de Pedidos e Receita por Curso, pois a descrição e
  os cabeçalhos já explicam a tarefa;
- no diálogo do Pedido, manter uma única ajuda geral ou a ajuda de Ações, não
  ambas, depois que a seção técnica for recolhida;
- não colocar ajuda em headers puramente decorativos nem duplicar a mesma
  explicação em quatro camadas.

O `TooltipProvider` global já existe em `src/app/layout.tsx:52`; revisar se o
provider aninhado em `src/components/admin/finance-help.tsx:39` ainda é necessário
quando a política de ajuda for reduzida.

## Critérios de aceite

- A primeira leitura da Visão geral mostra a exceção acionável quando existir.
- “Tudo em ordem” só aparece quando não há Revisões pendentes em nenhuma página.
- Contador, link e filtro de Pedidos em aberto exibem a mesma população.
- A tabela tem um único acionador de detalhe, com teclado e foco de retorno.
- Busca e filtros podem ser removidos sem preservar estado oculto.
- Nenhum contêiner de tabela cria rolagem horizontal aninhada.
- A fila de Revisões não repete sujeito/Curso/status e não mostra códigos internos
  como explicação principal.
- O detalhe do Pedido mostra primeiro resumo, valores e ações; IDs ficam
  disponíveis, mas em camada técnica.
- O reembolso comunica solicitação versus confirmação e não afirma acesso ativo
  em Revisão de identidade.
- A análise informa período, população e caráter estimado; zero e “sem base” não
  são confundidos.
- O modal de sincronização não promete uma consulta que a superfície não oferece.
- Nenhuma tela chama valor operacional de saldo disponível sem evidência de
  liquidação; parcelas confirmadas são apresentadas como status/valor bruto do
  Asaas.

## Verificação obrigatória

Após cada fase relevante:

```text
bun run test -- <testes afetados>
bun run check
bun run typecheck
```

Antes de concluir a série:

```text
bun run test
bun run docs:check
bun run db:migrations:check
bun run build
C:\Users\Junior\.agents\skills\impeccable\scripts\impeccable.cmd detect --json src/app/(admin)/admin/financeiro
git diff --check
```

Se documentos canônicos, migrations, autorização, fórmula financeira, retenção
ou contrato Asaas mudarem, atualizar a documentação correspondente no mesmo
change. Não aplicar migration em Staging/Production como parte da limpeza de UI.

## Registro de execução

Em 2026-09-09, as fases aprovadas foram implementadas no working tree: a visão
geral prioriza revisões quando existem, os filtros e estados de URL foram
separados por aba, a receita por curso deixou de ter busca/paginação, a tabela
de Pedidos ficou com um único acionador de detalhe, operações e evidência técnica
foram recolhidas, e a análise passou a distinguir valores confirmados, taxas
identificadas, reembolsos e líquido estimado. A sincronização continua em modal;
Auditoria não voltou ao menu.

Também foram implementadas as correções de dados: valor observado de divergência
é persistido com casts explícitos, pagamentos individuais de parcelamentos são
sincronizados idempotentemente, o detalhe separa cobranças confirmadas e não
confirmadas, datas do provedor permanecem sem conversão de fuso e o Development
recebeu a cadeia até `0075_installment_schedule_and_observed_evidence`.

Verificação concluída: `401` arquivos de teste, `2721` testes, typecheck,
Ultracite, `docs:check`, `db:migrations:check`, build, Knip, detector Impeccable,
medição `EXPLAIN (ANALYZE, BUFFERS)` e probes SQL transacionais. Testes E2E de
navegador não foram executados porque o `AGENTS.md` deste projeto proíbe abrir
URL local; os contratos E2E foram alinhados estaticamente e essa é a única
verificação pendente de ambiente permitido.

## Stop conditions

- O contador de Cursos deixar de ser pequeno ou a lista precisar ser completa;
  parar antes de remover paginação e decidir entre resumo limitado e rota de
  relatório.
- Uma correção de copy exigir mudar regra de acesso, status financeiro,
  reembolso ou permissão; registrar decisão antes de editar.
- A fonte externa não comprovar data/status de parcela ou liquidação; não criar
  o KPI “em caixa”.
- Um teste E2E falhar por contrato externo não reproduzível; corrigir o contrato
  local e reportar o bloqueio, sem relaxar o teste.
- A otimização exigir índice/cache sem plano representativo; medir primeiro.
- Qualquer arquivo fora do escopo aparecer no diff sem uma razão explícita.

## Resultado esperado

Financeiro continuará completo para o dia a dia, mas com uma leitura mais
hierárquica: exceções e ações primeiro, valores operacionais em segundo, detalhes
técnicos sob demanda. O plano não remove Revisões, sincronização, tabela de
Pedidos, análise, status ou evidências; remove somente duplicação, promessa
ambígua e controles sem benefício proporcional.
