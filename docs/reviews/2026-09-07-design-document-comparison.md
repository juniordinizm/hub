# Comparação entre o `design.md` oficial da Vercel e `DESIGN.md`

Snapshot da análise: 7 de setembro de 2026, `America/Sao_Paulo`.

A matriz abaixo registra o diagnóstico da versão de `DESIGN.md` anterior à
consolidação. As referências de linha dentro da matriz preservam esse baseline;
as seções de disposição final registram o que foi incorporado ao documento
atual.

## Conclusão executiva

`DESIGN.md` é um contrato visual do produto PROTEA-R Hub, não uma tradução do
guia de marca da Vercel. Na versão final desta análise, ele cobre a tarefa por
registro, prioridade de decisão, processo de composição, tokens semânticos
locais, tipografia, ritmo, superfícies, estados, dados, tabelas, formulários,
mídia, movimento, responsividade e verificação. Esses pontos são compatíveis
com os princípios gerais da fonte oficial quando adaptados ao Hub.

As regras de wordmark, autoria Vercel, `vercel-brand.css`, classes `vbg-*`,
fundação de relatório, grade 12/6/4 e temas claro/escuro são específicas das
páginas de relatório da Vercel e não devem ser transplantadas para o produto.
`DESIGN.md` as rejeita intencionalmente.

Há uma divergência deliberada que permanece documentada: a referência oficial
recomenda respeitar preferências de movimento reduzido
([fonte oficial, seção “Motion and delight”](https://vercel.com/design.md#motion-and-delight), linhas 267-271), mas a decisão explícita do projeto é não adicionar `prefers-reduced-motion`. A ausência de `prefers-reduced-motion`, `motion-reduce` e `motion-safe` foi confirmada na busca em `src`; o documento final registra essa exceção em vez de importar a regra externa.

Antes da atualização, as maiores lacunas documentais, sem importar a marca
Vercel, eram: evidência e metodologia para métricas, regras de alinhamento e
reflow responsivo, critérios explícitos de WCAG AA e uma política de mídia/
ícones. A atualização consolidou essas lacunas em regras locais, mantendo o
escopo dark-only, a identidade PROTEA-R e a exceção visual de capas e Aulas.

## Escopo, método e estado da evidência

- A fonte oficial foi obtida por HTTP GET em `https://vercel.com/design.md`.
  Retorno: HTTP 200, `text/markdown; charset=utf-8`, 370 linhas, 39.519 bytes
  UTF-8, SHA-256
  `2b40b23712e548721ecae7d0672ae9318a83188b9fcd2fb4a7a1b7c147a39903`.
  A comparação usou o conteúdo integral, das linhas 1 a 370, não apenas os
  títulos.
- `DESIGN.md`, `AGENTS.md` e `docs/README.md` foram lidos integralmente.
  Também foram examinados `PRODUCT.md`, `CONTEXT.md`, `src/app/globals.css`,
  `src/app/layout.tsx`, `package.json`, `components.json` e os componentes
  locais de botão, tabela, data table, campo e estado vazio citados abaixo.
- As referências a arquivos locais usam números de linha do working tree
  analisado. O working tree já estava com muitas alterações não relacionadas e
  `DESIGN.md` aparecia como não rastreado; portanto as linhas descrevem o
  estado atual dos arquivos, não uma afirmação de que todos os arquivos já
  estejam no commit verificado.
- O hash indicado em `DESIGN.md:1-5` existe como commit e coincide com o
  `HEAD` observado. O hash indicado em `docs/README.md:1-5` também existe, mas
  é um commit anterior ao `HEAD`.

`docs/README.md:11-22` coloca o sistema visual na ordem canônica de leitura e
`docs/README.md:116-136` define o contrato documental e a hierarquia de
conflitos. Assim, a precedência do contrato externo oficial não transforma
automaticamente uma regra criada para uma página Vercel em regra do Hub; o
escopo da fonte continua decisivo. `AGENTS.md:11-19` também exige resolver
conflitos antes de criar regras paralelas.

## Critério de classificação

- **Alinhada:** a regra local cobre o mesmo princípio e a implementação
  inspecionada fornece evidência compatível.
- **Parcial:** há o princípio local, mas faltam condições ou detalhes da fonte
  oficial que são aplicáveis ao tipo de superfície do Hub.
- **Adaptar:** o princípio é útil, mas a forma da Vercel depende de uma
  fundação, identidade ou composição que não pertence ao Hub.
- **Vercel específica:** regra de autoria, CSS, shell ou página de relatório da
  Vercel; não é lacuna do `DESIGN.md`.
- **Conflito:** as duas regras são simultaneamente aplicáveis ao mesmo
  princípio, mas prescrevem comportamentos diferentes.
- **Fora do escopo atual:** não há superfície correspondente comprovada no
  produto consultado.

## Matriz de cobertura

| Tema | Regra da fonte oficial | Evidência local | Cobertura e disposição |
|---|---|---|---|
| Escopo e tarefa do leitor | A fonte é para websites de relatório de autoria Vercel e manda começar pelo trabalho do leitor, pela resposta sustentada, pela evidência e pela ressalva que pode mudá-la ([contexto](https://vercel.com/design.md#vercel-product-and-brand-context), linhas 1-18; [primeiro passe](https://vercel.com/design.md#frame-the-readers-job), linhas 54-79). | `DESIGN.md:13-24` começa pelos registros Operação e Aprendizagem e exige que a tela comece pela tarefa principal. `PRODUCT.md:9-21,56-64` confirma os públicos e jornadas. | **Alinhada quanto à tarefa; parcial quanto à evidência.** O Hub não exige no documento uma resposta sustentada, fonte, ressalva, método ou caminho executivo/auditável para cada métrica. Aplicar esses requisitos somente a dashboards, métricas, auditoria e decisões, não a toda tela. |
| Preservação do projeto hospedeiro | A Vercel manda preservar framework, estrutura, rotas e convenções; em um projeto genérico Next/Tailwind/shadcn, manter a stack e usar componentes instalados ([integração](https://vercel.com/design.md#integrate-with-the-callers-project), linhas 33-52). | `DESIGN.md:26-35` fixa App Router, RSC, Tailwind, `src/components/ui`, Geist e Hugeicons. `package.json:31-39,49-71` confirma Next 16.2.11, React 19.2.7, Tailwind 4.3.1, shadcn 4.11.0 e Hugeicons. `components.json:2-20` confirma RSC, CSS variables e Hugeicons. | **Alinhada e aplicável.** A recomendação é preservar a fundação existente; não há justificativa para adicionar a fundação VBG. |
| Marca e shell | Cada página Vercel concluída deve ter wordmark no cabeçalho, triângulo no rodapé, metadados de autoria e o shell estrutural `vbg-report`/`vbg-shell` ([authorship shell](https://vercel.com/design.md#authorship-shell), linhas 118-154). | `DESIGN.md:9-11,36-38` preserva a identidade PROTEA-R, rejeita a identidade Vercel, `vercel-brand.css`, wordmark e shell de relatório. A busca em `src` não encontrou `vbg-*`, `vbg-report` ou `vercel-brand.css`. | **Vercel específica; não aplicar.** A divergência é intencional e necessária para não transformar o Hub em uma superfície de marca Vercel. |
| CSS e API `vbg-*` | A fonte publica uma API fechada de classes, tokens `--vbg-*`, nesting e nomes de filhos; manda não inventar aliases nem traduzir o sistema ([Use the published CSS API](https://vercel.com/design.md#use-the-published-css-api), linhas 318-361). | `DESIGN.md:28-30,37-38,40-54` determina Tailwind, componentes locais e tokens semânticos `background`, `card`, `primary`, `sidebar-*` etc. `src/app/globals.css:8-52` mapeia esses tokens ao tema Tailwind. | **Vercel específica; não aplicar.** Os tokens locais não são uma implementação incompleta de `--vbg-*`; são a fundação autorizada do Hub. |
| Trabalho com fatos e metodologia | A fonte manda normalizar fatos, unidades, datas, fontes e contradições, distinguir observação, derivação, projeção, recomendação e causalidade, e manter pressupostos, metodologia, ressalvas e fontes no caminho de auditoria ([primeiro passe](https://vercel.com/design.md#frame-the-readers-job), linhas 56-79; [evidência](https://vercel.com/design.md#data-and-evidence), linhas 208-218). | `DESIGN.md:17-24` exige texto claro, recuperação e evidência para estados críticos; `DESIGN.md:56-57` impede cor como único estado. `PRODUCT.md:126-133` exige rastreabilidade e comunicação de limitações. | **Parcial e aplicável a dados.** Falta um contrato visual explícito para período, unidade, população, denominador, fonte, tipo de afirmação e ressalva junto à métrica. |
| Composição e primeiro viewport | A abertura deve expor identidade, pergunta e evidência mais forte; comparações devem usar a mesma base; cada artefato deve ter uma organização que carregue evidência e um caminho de leitura estável ([composição](https://vercel.com/design.md#choose-the-composition), linhas 83-116). | `DESIGN.md:23-24` torna métricas, cards, ícones e separadores secundários à compreensão e ação. | **Parcial, adaptar.** A orientação de começar pela tarefa é aplicável. A ideia de uma página de relatório com primeiro viewport argumentativo e composição específica deve ser usada somente em telas de decisão ou métricas, sem copiar um hero de relatório. |
| Grid, alinhamento e espaço | A Vercel define grade de 12/6/4, edges compartilhadas, gutters inequívocos, reflow para evitar trilhas vazias e espaçamento com um único dono ([grid](https://vercel.com/design.md#grid-and-alignment), linhas 156-166; [ritmo](https://vercel.com/design.md#typography-and-rhythm), linhas 174-190). | `DESIGN.md:70-78` cobre cards, dono dos gaps, escolha de Flexbox/Grid e `min-w-0`/`truncate`/`line-clamp`. `src/components/ui/table.tsx:7-18` dá largura total e overflow horizontal local à tabela. | **Parcial, adaptar.** O princípio de alinhamento e reflow é aplicável; a grade 12/6/4 e os tokens `--vbg-space-*` são da fundação Vercel. Falta explicitar que uma divisão subpreenchida deve refluír ou empilhar. |
| Tipografia | A fonte exige Geist Sans para leitura, títulos, labels, controles, tabelas e números; Mono somente para identificadores; papéis tipográficos publicados, pesos publicados, sentence case, ritmo relacional e prosa próxima de 60-68 caracteres ([tipografia](https://vercel.com/design.md#typography-and-rhythm), linhas 168-192). | `DESIGN.md:59-68` cobre h1/h2/h3, `text-balance`, `text-pretty`, 60-75ch, `tabular-nums`, português natural, Mono técnico e `…`. `src/app/layout.tsx:8-15,44-48` carrega Geist e Geist Mono. `src/app/globals.css:8-13,100-104,145-154` aplica as variáveis. | **Alinhada, com uma lacuna de escala.** A largura local é uma escolha de produto e não precisa ser reduzida ao limite do relatório Vercel. `DESIGN.md` não define papéis ou uma regra contra tamanhos/pesos arbitrários; isso pode gerar variação apesar da fonte correta. |
| Cor e superfícies | A Vercel pede monocromia, cor somente com significado e pista não cromática, uma tela contínua, poucas superfícies e rejeição de gradientes, glows, blobs, texturas, glass e profundidade ornamental ([cor](https://vercel.com/design.md#color-surfaces-and-boundaries), linhas 194-206). | `DESIGN.md:40-57` define tokens por papel e não só cor para estado. `DESIGN.md:70-74` rejeita cards sem agrupamento, cards aninhados e bordas repetidas. `src/app/globals.css:65-98` mostra a paleta escura PROTEA-R com teal, laranja, verde e tokens de chart. | **Alinhada no uso semântico e na contenção; parcial no anti-enfeite.** Monocromia e `.vbg-band[data-tone=contrast]` são específicas da Vercel. Pode ser adicionada uma regra local contra efeitos decorativos sem proibir a paleta da marca. |
| Estados e controles | Controles devem ter labels, helpers quando necessários, unidades claras, foco, status vivo, preservação de entrada inválida e último resultado válido; motion deve confirmar estado, não decorar ([calculators](https://vercel.com/design.md#calculators-and-interaction), linhas 244-265; [motion](https://vercel.com/design.md#motion-and-delight), linhas 267-271). | `DESIGN.md:80-95` lista repouso, hover, foco, ativo, desabilitado, carregando, erro e vazio. `src/components/ui/button.tsx:11-25,52-91` implementa foco, estados, `aria-busy`, bloqueio durante loading e preservação do nome da ação. `src/components/ui/field.tsx:99-140,174-221` implementa label, descrição e `role=alert`. | **Alinhada para controles gerais.** O modelo completo de calculadora só é necessário se uma calculadora entrar no produto. |
| Tabelas | Tabelas devem ser semânticas, caption, largura de evidência, alinhamento idêntico entre cabeçalho e células, baseline, unidades/precisão consistentes, escala comum, labels diretos e alternativa textual ([data and evidence](https://vercel.com/design.md#data-and-evidence), linhas 208-242). | `DESIGN.md:97-106` exige `<table>`, caption, alinhamento numérico, `tabular-nums`, Mono técnico sem forçar quebra e URL para consulta server-side. `src/components/ui/table.tsx:7-19,68-105` fornece table, `scope=col`, `align-baseline` e `TableCaption`. `src/components/ui/data-table.tsx:42-73,132-186,251-273` aplica o mesmo alinhamento a header/célula, `tabular-nums`, estados vazios, contagem viva e paginação. Chamadas amostradas passam captions em `src/app/(admin)/admin/alunos/students-table.tsx:192-200`, `src/app/(admin)/admin/cursos/[courseId]/course-enrollments-table.tsx:100-107` e `src/app/(admin)/admin/aprendizagem/page.tsx:56-85`. | **Alinhada no núcleo; parcial na evidência avançada.** Os usos inspecionados têm captions e números alinhados. O componente ainda permite caption vazio porque renderiza `TableCaption` condicionalmente em `data-table.tsx:184-186`. Faltam regra documental para qualificar unidade/período/denominador, regra de subset neutro auditável e alternativa textual para gráficos. |
| Calculadoras | Uma calculadora precisa de modelo canônico de estado, fórmulas, unidades, precisão, limites, incrementos, defaults e atualização atômica ([calculators](https://vercel.com/design.md#calculators-and-interaction), linhas 244-265). | Não há seção de calculadoras em `DESIGN.md`, e as jornadas atuais descritas em `PRODUCT.md:25-64` não identificam uma calculadora. | **Fora do escopo atual.** Se surgir uma calculadora, adotar o modelo de estado e a acessibilidade do princípio, não as classes `vbg-*` ou o layout Vercel. |
| Movimento | Motion deve ser estático por padrão, limitado a mudança de estado/continuidade, sem autoplay, typing, pulso decorativo, parallax ou espetáculo, e deve respeitar movimento reduzido ([motion](https://vercel.com/design.md#motion-and-delight), linhas 267-271). | `DESIGN.md:108-114` rejeitava animação decorativa, restringia transições e não queria biblioteca de microinteração, mas registrava a decisão explícita de não adicionar `prefers-reduced-motion`. `src/components/ui/button.tsx:12,64-71` usa transição de propriedades e spinner de loading; `src/components/ui/sonner.tsx:58-64` usa spinner de loading. | **Divergência deliberada.** A contenção local é compatível, mas a decisão explícita do projeto impede importar a regra externa de movimento reduzido. O documento final mantém essa exceção e reforça a proibição de movimento decorativo. |
| Mídia e ícones | Usar mídia fornecida somente como evidência ou para compreensão; não usar stock, screenshots falsos ou ícones decorativos/tiles coloridos ([media and icons](https://vercel.com/design.md#media-and-icons), linhas 273-275). | `DESIGN.md:26-38,116-126` fixa Hugeicons e regras de alt text, mas não regula stock, screenshot falso ou tile de ícone. `components.json:13` fixa Hugeicons. `src/components/ui/button.tsx:3-4,66-71` usa ícone como parte de ação; `src/components/ui/empty.tsx:28-55` possui a variante `EmptyMedia` com tile `bg-muted`. | **Parcial; regra do tile é específica da Vercel.** A distinção entre ícone informativo e decorativo é útil para o Hub. O tile de estado vazio não prova violação do contrato local nem exige remoção, pois a proibição veio de um guia de relatório Vercel. |
| Acessibilidade e reflow | Usar landmarks, um h1 descritivo, headings ordenados, skip link, controles nativos, captions, nomes acessíveis, foco visível, alternativa textual, WCAG AA, ordem de fonte e `min-width: 0`; refluír antes de encolher e não esconder overflow ([accessibilidade](https://vercel.com/design.md#accessibility-and-responsive-behavior), linhas 363-370). | `DESIGN.md:59-68,97-126` cobre hierarquia de headings, semântica de tabela, labels, links, botões, foco, vazios, erros e alt text. `src/components/ui/data-table.tsx:149-162` dá label de busca e status vivo; `src/components/ui/field.tsx:129-140,213-221` dá descrição e erro acessível. `src/app/layout.tsx:38-53` confirma a estrutura raiz e `lang=pt-BR`. | **Parcial e aplicável.** Faltam no documento alvo explícito WCAG AA, landmarks/skip link, ordem de fonte, alternativa textual de gráficos e regra de reflow antes de encolher. O `min-w-0` já aparece como requisito local em `DESIGN.md:77-78`. |
| Revisão e verificação | A Vercel pede inspecionar primeiro viewport, página inteira, temas, reflow e acessibilidade, corrigindo o maior defeito sistêmico antes da entrega; o processo não deve virar conteúdo da página ([inspect and revise privately](https://vercel.com/design.md#inspect-and-revise-privately), linhas 277-292). | `DESIGN.md:128-132` exige diff, testes afetados, `bun run check` e `bun run typecheck`. `AGENTS.md:207-215,231-244` exige testes proporcionais e evidência do comando/risco. `package.json:77-92` confirma os scripts. | **Parcial, adaptar.** O contrato local verifica código e tipos, mas não nomeia explicitamente viewport, reflow, contraste ou acessibilidade em alterações visuais. A inspeção de tema claro não se aplica ao escopo local dark-only (`DESIGN.md:36`), mas reflow e foco continuam aplicáveis. |
| Anti-padrões gerados | A fonte rejeita eyebrow em caixa alta, hero genérico, cards métricos repetidos, cápsulas ordinárias, bordas para compensar hierarquia fraca, gráficos decorativos e repetição de resumo/conclusão ([reject generated-design reflexes](https://vercel.com/design.md#reject-generated-design-reflexes), linhas 294-316). | `DESIGN.md:23-24,70-78` já reduz o peso de cards, ícones e separadores e evita cards aninhados/bordas repetidas. `AGENTS.md:32-54` também exige comunicação sem decoração desnecessária, mas isso é instrução de resposta, não contrato visual. | **Parcial e aplicável por princípio.** Vale incorporar somente os anti-padrões que protegem hierarquia e evidência do Hub; não transformar a lista inteira da Vercel em identidade obrigatória. |

## Conflitos e decisões consolidadas

### 1. Movimento reduzido: divergência explícita do projeto

O documento final combina quatro decisões compatíveis com a fonte oficial:
sem animação decorativa, transições limitadas, feedback de estado e ausência de
biblioteca dedicada. Ele também mantém a decisão explícita do projeto de não
adicionar `prefers-reduced-motion`, mesmo sendo uma divergência da recomendação
Vercel.

O código confirma que a decisão tem efeito prático: `Button` usa transição e
`animate-spin` durante loading (`src/components/ui/button.tsx:12,64-71`) e o
Toaster usa spinner (`src/components/ui/sonner.tsx:58-64`), mas a busca em
`src` não encontrou `prefers-reduced-motion`, `motion-reduce` ou `motion-safe`.

Disposição: manter a divergência e não adicionar a media query, classes ou
tokens equivalentes. A contenção de movimento continua obrigatória, sem afirmar
que o produto oferece uma adaptação de movimento reduzido que não existe.

### 2. Tema e identidade: divergências intencionais, não defeitos

- `DESIGN.md:36` escolhe dark-only, enquanto a fonte Vercel exige equivalência
  entre claro e escuro para seus relatórios (linhas 196 e 363-367). O código
  confirma que dark-only é uma decisão local: `src/app/globals.css:60-63`
  define `color-scheme: dark`, `src/app/layout.tsx:31-34` define
  `colorScheme: "dark"` e `globals.css:111-143` repete os tokens escuros.
  Não há base para substituir essa decisão local apenas por comparação com a
  página Vercel.
- `DESIGN.md:37-38` rejeita `vbg-*`, `vercel-brand.css`, wordmark e shell,
  enquanto a fonte exige esses elementos para autoria Vercel (linhas 122-154 e
  318-361). É uma fronteira de produto correta: PROTEA-R não é um relatório de
  autoria Vercel.
- A paleta local não é monocromática (`globals.css:65-98`); a fonte pede
  monocromia para relatórios Vercel (linhas 194-206). A fonte não é autoridade
  para remover cores da identidade PROTEA-R; o princípio transferível é usar
  cor por papel e não como único sinal, já registrado em `DESIGN.md:40-57`.

### 3. Regras locais que não estão desatualizadas

- A escolha de Geist e Geist Mono em `DESIGN.md:31-34` coincide com
  `src/app/layout.tsx:8-15` e `globals.css:8-13,100-104`.
- A escolha de Tailwind, componentes locais e Hugeicons em
  `DESIGN.md:28-35` coincide com `package.json:8-12,31-39,49-71` e
  `components.json:2-20`.
- A regra de tabelas em `DESIGN.md:97-106` tem suporte direto nos componentes
  `table.tsx` e `data-table.tsx`; as chamadas inspecionadas passam captions.
- A verificação em `DESIGN.md:128-132` aponta scripts existentes: `check`,
  `typecheck` e `docs:check` estão definidos em `package.json:77-92`.

## Lacunas tratadas e disposição final

1. **P1, evidência para superfícies de dados.** Para
   métricas, auditoria, finanças e gráficos, exigir perto do dado: período,
   unidade, população, denominador/base, fonte e indicação se é observação,
   derivação, projeção ou recomendação. Exigir caption ou texto curto que
   declare o que o dado mostra e o que não mostra. **Tratado no documento
   final.**
2. **P2, fechar o contrato de tabelas.** Documentar precisão/unidade
   consistentes, alinhamento de header e célula, regra de subset inicial neutro
   e contagem atual/total para ledgers filtráveis. Manter o overflow local para
   tabelas longas; não adotar `vbg-table-wrap`. **Tratado no documento final.**
3. **P2, explicitar reflow local.** Acrescentar shared edges, gutters
   inequívocos, `min-w-0`, reflow antes de reduzir texto e empilhamento de
   splits subpreenchidos. Usar os breakpoints e utilitários Tailwind do Hub,
   não a grade Vercel 12/6/4. **Tratado no documento final.**
4. **P2, fortalecer acessibilidade documental.** Registrar WCAG AA, landmarks,
   skip link quando houver shell de navegação, ordem de fonte, nomes
   acessíveis e alternativa textual para gráficos. O código já fornece
   exemplos de labels, `aria-live`, `role=alert`, captions e foco. **Tratado no
   documento final.**
5. **P3, decidir uma política de mídia e ícones.** Proibir mídia stock ou
   screenshots falsos e exigir que ícones tenham função semântica ou sejam
   `aria-hidden`; decidir explicitamente se tiles de estados vazios continuam
   permitidos no sistema PROTEA-R. A proibição de tiles é uma preferência
   Vercel, não uma obrigação de compatibilidade. **Tratado no documento final,
   com `EmptyMedia` como uso local permitido.**
6. **P3, definir papéis tipográficos locais.** Mapear papéis de título, seção,
   corpo, label, caption e identificador para utilitários existentes e registrar
   que peers equivalentes não devem variar peso/tamanho apenas por comprimento
   do texto. Preservar 60-75ch para o produto, salvo decisão específica para
   relatórios longos. **Tratado no documento final.**
7. **P3, ampliar a verificação visual sem exigir tema claro.** Para alteração
   visual, além de diff/testes/check/typecheck, verificar reflow estreito,
   foco, estados de loading/erro/vazio, contraste e hierarquia no tema escuro.
   Aplicar a inspeção claro/escuro da Vercel somente se o produto abandonar o
   dark-only. **Tratado no documento final.**

8. **Divergência de movimento reduzido.** Manter a proibição explícita de
   adicionar `prefers-reduced-motion`, conforme decisão do projeto. A regra
   local não deve ser confundida com compatibilidade integral com a
   recomendação externa.

## Regras da Vercel que não devem ser transplantadas

Estas regras são legítimas dentro do escopo da fonte oficial, mas não são
lacunas do contrato do Hub:

- autoria Vercel, wordmark, triângulo, metadados de cliente/período e shell
  `vbg-report`/`vbg-shell`;
- carregamento de `vercel-brand.css`, nomes de classes `vbg-*`, tokens
  `--vbg-*`, nesting e API pública VBG;
- a grade fixa de 12 colunas desktop, 6 tablet e 4 mobile;
- monocromia e o campo de contraste `.vbg-band[data-tone="contrast"]`;
- exigência de tema claro e escuro para uma página de relatório;
- composição, markup e estado canônico específicos de calculadoras VBG;
- o veto absoluto a tiles de ícone como regra de identidade do produto.

## Evidência local examinada

- Contrato e precedência: `AGENTS.md:11-19,71-82,207-244`;
  `docs/README.md:9-22,116-136`.
- Contexto do produto e critérios de qualidade: `PRODUCT.md:9-21,47-64,126-133`;
  `CONTEXT.md:13-29,63-96`.
- Contrato visual no baseline: `DESIGN.md:1-132`; contrato consolidado atual:
  `DESIGN.md` completo.
- Tokens e tema: `src/app/globals.css:8-52,60-154`;
  `src/app/layout.tsx:8-15,31-53`.
- Fundação de componentes: `package.json:31-39,49-92`;
  `components.json:2-20`.
- Estados e controles: `src/components/ui/button.tsx:11-91`;
  `src/components/ui/field.tsx:99-221`;
  `src/components/ui/empty.tsx:28-87`.
- Tabelas e dados: `src/components/ui/table.tsx:7-117`;
  `src/components/ui/data-table.tsx:42-273`;
  `src/app/(admin)/admin/alunos/students-table.tsx:192-225`;
  `src/app/(admin)/admin/cursos/[courseId]/course-enrollments-table.tsx:94-107`;
  `src/app/(admin)/admin/aprendizagem/page.tsx:56-113`;
  `src/app/(admin)/admin/financeiro/courses-revenue-table.tsx:171-220`.

## Fonte externa

- [Vercel `design.md`](https://vercel.com/design.md), documento oficial
  consultado integralmente no snapshot descrito acima.

O relatório foi criado como registro da comparação. Na consolidação posterior,
`DESIGN.md` foi atualizado; nenhum código de produto foi alterado por esta
análise.
