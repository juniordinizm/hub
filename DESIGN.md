---
status: canonical
owner: design-and-engineering
last_verified_commit: 9d0450a275d5bdacfaa44e306ca1ad8958053c89
last_verified_at: 2026-09-07
---

# Sistema visual do NeuroCapacitar Hub

Este documento é o contrato visual e de interação do Hub. Ele define como
compor, escrever, implementar e verificar as interfaces sem trocar a identidade
NeuroCapacitar por uma identidade externa. PROTEA-R é uma identidade específica
de Curso e não deve aparecer como nome global da plataforma.

## Escopo e relação com a referência Vercel

O documento [Design report websites like Vercel](https://vercel.com/design.md),
consultado em 2026-09-07, descreve sites de relatórios oficiais da Vercel. Ele
é uma referência de julgamento, composição, evidência, tipografia, contenção e
acessibilidade. Não é um contrato de marca ou de implementação do Hub.

O Hub reaproveita os princípios que são aplicáveis a uma plataforma de cursos:

- começar pela tarefa do leitor, não pelo tipo de tela;
- preservar fatos, unidades, estados, limites, privacidade e incertezas;
- organizar a primeira leitura e a consulta detalhada sem repetir a mesma
  informação em vários níveis de destaque;
- escolher a composição conforme a pergunta e o conteúdo, em vez de aplicar um
  molde de cards;
- usar tipografia, alinhamento, espaço e densidade antes de adicionar efeitos;
- tratar tabelas, estados e controles como evidência e interação, não como
  decoração;
- manter semântica, foco, texto alternativo, reflow responsivo e leitura por
  teclado.

As partes específicas de sites de relatório não se aplicam ao produto e não
devem ser copiadas:

- wordmark, triângulo, shell, URLs de assets ou autoria visual da Vercel;
- classes `.vbg-*`, tokens `--vbg-*`, `vercel-brand.css` e CSS externo paralelo;
- grade fixa de 12/6/4 colunas como requisito do Hub;
- exigência de tema claro e escuro;
- classes ou primitivas de gráfico, calculadora ou relatório que não existam no
  projeto;
- uso de um cabeçalho de relatório no lugar da navegação autenticada do Hub.

Há duas decisões do Hub que prevalecem sobre a referência externa:

- o produto é dark-only neste escopo e não possui seletor visual de tema;
- não adicionar `prefers-reduced-motion` neste projeto.

As capas de Cursos e a mídia visual existente de Aulas são conteúdo visual do
produto. Seus gradientes, blur, escala e sombras existentes podem permanecer;
não devem ser removidos nesta linha de trabalho nem usados para comunicar estado
operacional. Não adicionar novos efeitos decorativos a outras superfícies por
causa dessa exceção.

## Identidade da plataforma e dos Cursos

`NeuroCapacitar` é a marca da plataforma. `NeuroCapacitar Hub` é o nome da
aplicação. Esses valores vivem em [brand.ts](src/lib/brand.ts) e devem ser
reutilizados em metadata, shell, autenticação, certificados públicos e
comunicações geradas pelo Hub.

`PROTEA-R` é um Curso e uma identidade de conteúdo dentro da plataforma. O
nome, a capa, a logo e os textos específicos de PROTEA-R podem aparecer onde o
Curso for a entidade em foco; não devem nomear o shell global, o produto ou a
aplicação inteira. Identificadores técnicos, seeds, aliases e contratos
externos que ainda contenham `PROTEA-R` só devem ser alterados junto com o
contrato correspondente, nunca por uma troca visual automática.

O favicon file-based da aplicação é
[src/app/icon.svg](src/app/icon.svg). Ele é uma composição técnica do fundo
escuro do Hub com o mark aprovado atualmente disponível em
`public/protear/logo-negativo.svg`; não é autorização para criar uma nova logo
ou para usar a identidade de um Curso como nome global. Se surgir um mark
dedicado da NeuroCapacitar, substitua somente a composição do ícone e preserve
o contrato `app/icon.svg` do Next.js.

## Como interpretar este documento

As seções de fundação registram fatos verificáveis do código atual. As demais
seções são regras para novas interfaces e alterações. Uma regra não autoriza
inventar conteúdo, estado, identidade, acessibilidade ou comportamento que o
produto e o código não sustentem.

Quando houver conflito, use esta ordem:

1. preservar fatos do produto, privacidade, segurança, estados e contratos de
   dados;
2. preservar a stack, as rotas, a estrutura e os componentes existentes;
3. tornar a tarefa, a decisão ou a próxima ação evidente;
4. preservar semântica, acessibilidade e recuperação de erros;
5. escolher a composição que melhor explica o conteúdo, sem template genérico;
6. refinar responsividade, densidade e detalhes sem enfraquecer os itens
   anteriores.

Se uma decisão puder mudar significado comercial, segurança, privacidade,
permissão, unidade, fórmula, população, período, recomendação ou ação, pare e
registre a decisão apropriada. Se a dúvida não mudar o significado, omita o
elemento ou rotule a incerteza de forma explícita. Nunca preencha uma lacuna
com decoração ou texto inventado.

## Produto, leitores e tarefas

O Hub tem dois registros principais:

- **Operação:** Admin e Suporte precisam localizar estados, exceções, evidências
  e próximas ações com rapidez. A interface pode ser densa, mas cada estado
  crítico precisa de texto claro, ação de recuperação e evidência suficiente.
- **Aprendizagem:** o Aluno precisa identificar a próxima Aula, entender seu
  progresso e consumir conteúdo sem competir com controles administrativos.

As permissões são distintas: `admin`, `support` e `student` não são apenas
variações visuais. A interface não deve oferecer como disponível uma ação que o
servidor não autoriza. As fronteiras de autorização vivem em
`src/lib/auth-policy.ts`, `src/lib/session.ts` e nos guias de domínio indicados
em [docs/README.md](docs/README.md).

As áreas autenticadas seguem esta estrutura comprovada:

- Admin e Suporte: `src/app/(admin)/admin`, com `PanelLayout` e navegação
  administrativa;
- Aluno: `src/app/(student)/app`, com `PanelLayout` e navegação de aprendizagem;
- shell compartilhado: `src/components/panel-layout.tsx`;
- contêiner de página: `src/components/page-container.tsx`;
- cabeçalho de página: `src/components/page-header.tsx`.

Uma tela deve começar pela tarefa principal do seu registro. Métricas, cards,
ícones e separadores são secundários à compreensão e à ação.

## Processo de design e revisão

Antes de alterar uma tela, siga quatro passagens:

### 1. Enquadrar a tarefa

Identifique:

- quem está usando a tela e com qual permissão;
- qual tarefa precisa concluir;
- qual estado ou resposta é o principal;
- qual evidência torna a resposta confiável;
- qual limite, exceção ou incerteza muda a interpretação;
- qual ação deve ficar disponível depois da leitura.

Leia a rota, a fonte de dados, os Server Actions ou handlers, os componentes
compartilhados, os testes e o guia canônico de domínio antes de decidir a
composição. Diferencie observação, cálculo, estado persistido, recomendação e
projeção.

### 2. Escolher a composição

O primeiro viewport deve expor a tarefa, o estado principal e a ação ou
evidência decisiva. Não criar uma introdução ornamental antes do conteúdo útil.

Escolha a forma de acordo com a pergunta:

- consulta exata: tabela ou lista sem mediação desnecessária;
- estado ou exceção: mensagem, causa conhecida e recuperação próxima;
- comparação: alternativas na mesma base, com rótulos e unidades alinhados;
- progresso: sequência, porcentagem e próxima Aula em relação clara;
- edição: campos, validação e ação de salvar no mesmo contexto;
- conteúdo: leitura e reprodução sem controles administrativos competindo.

Uma seção deve responder a uma pergunta nova. Combine duplicatas. Cada afirmação
deve ter um lugar principal de evidência. Não repetir a mesma resposta como
metric card, resumo, gráfico e conclusão com o mesmo destaque.

Use espaço, hierarquia e ordem para criar presença. Se uma tela parecer fraca,
fortaleça a relação principal ou melhore a explicação antes de adicionar
bordas, ícones, cores ou efeitos.

### 3. Implementar pela fundação existente

Use os componentes e tokens existentes antes de criar CSS ou abstrações locais.
Escolha o elemento HTML pela semântica da ação e não pelo aspecto visual.

### 4. Verificar todos os estados

Revise o caminho principal, vazio, carregamento, erro, desabilitado, foco,
sucesso, conteúdo longo, ausência de permissão e viewport estreito. A tela deve
continuar compreensível quando o texto, título, ID ou número for maior que o
exemplo feliz.

## Fundação técnica atual

Os fatos abaixo são comprovados por `src/app/layout.tsx`,
`src/app/globals.css`, `components.json`, `package.json` e
`src/components/ui`:

- Next.js App Router, React Server Components e TypeScript;
- Tailwind CSS com CSS variables e o preset Ultracite/Biome;
- componentes locais no estilo shadcn com primitives Radix;
- `components.json` usa `radix-luma`, RSC, Tailwind v4, aliases `@/*` e
  `hugeicons` como biblioteca de ícones;
- Geist e Geist Mono são carregadas por `next/font/google` no layout raiz;
- Hugeicons é a biblioteca de ícones instalada;
- `PanelLayout` fornece sidebar, cabeçalho autenticado, skip link e região
  principal;
- `PageContainer` usa largura máxima de 1344px e padding responsivo;
- `PageHeader` centraliza `h1`, descrição, status e ações;
- os primitives reutilizáveis ficam em `src/components/ui`.

Não introduza uma biblioteca visual, design system paralelo, CSS externo ou
dependência de ícones sem uma decisão explícita. `package.json` é a fonte de
verdade para versões.

O registry ReUI foi avaliado para tabelas em 2026-09-07. O item `data-grid`
encontrado exige APIs de TanStack v9, `@base-ui/react`, virtualização, DnD e um
adaptador de ícones que não existe no Hub; o projeto usa TanStack 8.21.3,
primitives Radix e uma composição operacional simples. Por isso, ele não é
instalado como dependência paralela: o `DataTable` local preserva o contrato
compatível e reaproveita os princípios aplicáveis de densidade, estados,
alinhamento, overflow e paginação.

## Tokens, temas e superfícies

Os tokens semânticos são definidos em `src/app/globals.css` e devem ser usados
por papel, não por aparência:

- `background`: tela principal;
- `foreground`: texto principal;
- `card` e `card-foreground`: agrupamento real de conteúdo;
- `popover` e `popover-foreground`: menus, diálogos e superfícies portadas;
- `muted` e `muted-foreground`: apoio e contexto ainda legível;
- `primary` e `primary-foreground`: ação principal e seleção atual;
- `secondary` e `secondary-foreground`: ação ou estado secundário;
- `accent` e `accent-foreground`: ênfase pontual;
- `destructive`: erro, bloqueio e ação destrutiva;
- `border`, `input` e `ring`: estrutura, entrada e foco;
- `sidebar-*`: navegação autenticada;
- `chart-1` a `chart-5`: dados que precisam distinguir séries.

Os valores web atuais são escritos em OKLCH para manter a leitura dos canais
separada: `L` expressa luminosidade perceptual, `C` intensidade cromática e
`H` matiz. A tabela abaixo é o estado verificável em
`src/app/globals.css`; não copie os valores diretamente para componentes.

| Papel | Token atual | Uso autorizado |
|---|---|---|
| tela | `--background: oklch(0.237 0.025 204.4)` | fundo contínuo da aplicação |
| texto principal | `--foreground: oklch(0.949 0.009 197)` | títulos, prosa e controles |
| superfície | `--card: oklch(0.272 0.027 203.5)` | agrupamento real de conteúdo |
| navegação | `--sidebar: oklch(0.221 0.023 205.4)` | sidebar autenticada |
| ação/seleção | `--primary: oklch(0.495 0.061 202.9)` | ação principal e seleção atual |
| apoio | `--muted: oklch(0.309 0.033 204.9)` | contexto e placeholders |
| texto de apoio | `--muted-foreground: oklch(0.702 0.044 199.9)` | informação secundária legível |
| ênfase | `--accent: oklch(0.675 0.143 54)` | destaque pontual, não texto longo |
| erro | `--destructive: oklch(0.726 0.122 20.5)` | erro, bloqueio e ação destrutiva |
| sucesso | `--success: oklch(0.704 0.12 160)` | confirmação explícita |
| alerta | `--warning: oklch(0.769 0.13 78)` | atenção e risco reversível |
| informação | `--info: oklch(0.68 0.1 245)` | contexto informativo |

`--border`, `--input`, `--ring` e `--sidebar-*` também usam os mesmos papéis
em OKLCH, inclusive com alpha quando a função é separar sem criar uma nova
superfície. O tema é dark-only e os blocos `:root` e `.dark` permanecem
equivalentes até existir uma decisão de produto para outro tema.

Use sempre o token semântico (`bg-card`, `text-muted-foreground`,
`border-border`, `text-success`, `bg-warning/15` etc.), não a cor que hoje
parece visualmente correta. `success`, `warning` e `info` exigem texto ou
rótulo além da cor. Gráficos usam `chart-1` a `chart-5` somente quando há dado
real, legenda e alternativa textual.

OKLCH é o padrão do CSS da aplicação web. Markup de e-mail, imagens de
certificado, color picker e valores persistidos de templates são contratos
externos ou de mídia que continuam usando o formato exigido por seus
respectivos renderizadores. Nesses casos, não fazer uma conversão mecânica
sem verificar o cliente ou o contrato de saída; documentar a exceção perto do
integração.

O tema atual é dark-only: `html` declara `color-scheme: dark`, as variáveis
existem no `:root` e em `.dark`, e o viewport declara `colorScheme: "dark"`.
Não criar toggle ou variante clara sem decisão de produto.

Regras de superfície:

- `Card` já fornece a superfície padrão, raio, sombra e anel semântico; nos
  usos comuns, a classe do chamador deve cuidar apenas de layout ou de uma
  variação comprovada;
- um card agrupa conteúdo ou interação realmente relacionada;
- não criar card apenas para dar peso visual a uma seção;
- evitar card dentro de card, bordas repetidas e sombras ornamentais;
- usar separação, alinhamento e mudança de densidade antes de adicionar uma
  superfície;
- usar `Badge` para estados que precisam de rótulo, texto e variante semântica;
- não usar cor sozinha para comunicar sucesso, alerta, erro, bloqueio ou
  seleção;
- não usar gradientes, glow, blobs, texturas, glass, trilhas coloridas ou
  sombras decorativas como preenchimento de hierarquia;
- gradiente só é permitido quando for mídia de conteúdo já aprovada ou escala
  contínua de dados explicitamente rotulada.

Os efeitos visuais existentes em capas e mídia de Aulas são a exceção de
conteúdo descrita em [course-cover-image.tsx](src/features/courses/course-cover-image.tsx),
[lesson-card.tsx](src/components/ui/lesson-card.tsx) e nas telas que os usam.

## Grid, alinhamento e densidade

O Hub não possui uma grade VBG fixa. `PageContainer`, Flexbox, Grid e os
primitives existentes definem a topologia de cada tela.

- Flexbox organiza relações em uma dimensão; Grid organiza relações em duas;
- cada relação deve ter um único dono de gap, fluxo ou padding;
- objetos equivalentes compartilham borda, alinhamento, papel tipográfico e
  posição de ação;
- use `min-w-0` em filhos de flex/grid que contenham títulos, IDs ou valores
  longos;
- escolha `truncate`, `line-clamp`, quebra de palavras ou rolagem local de
  acordo com a importância do conteúdo;
- não deixe colunas vizinhas parecerem uma frase única quando seus conteúdos
  pertencem a grupos diferentes;
- não deixe um split vazio, uma terceira coluna órfã ou uma área sem evidência
  apenas para preencher espaço;
- em telas estreitas, empilhe ou reordene antes de reduzir legibilidade;
- tabelas longas podem rolar dentro do contêiner da tabela, nunca esconder o
  overflow da página inteira.

Não transforme toda tela em um mosaico uniforme. A densidade deve acompanhar a
tarefa: operação pode ser compacta e comparável; aprendizagem deve preservar
leitura e foco no conteúdo.

## Tipografia e ritmo

Geist Sans é usada para prosa, títulos, labels, controles, tabelas, métricas,
datas, contagens, porcentagens, durações e valores financeiros. Geist Mono fica
restrita a código, comandos, paths, tokens, timestamps e identificadores
operacionais curtos, como hash, ID, SKU ou região. Não aplique Mono à frase
inteira só porque ela contém um ID.

Os papéis reutilizáveis ficam em `src/app/globals.css` e devem ser a primeira
opção antes de combinar utilitários de tamanho e peso em cada tela:

| Papel | Classe | Contrato |
|---|---|---|
| título de página | `.type-page-title` | `clamp(1.75rem, 1.6rem + 0.65vw, 2rem)`, peso 650, `1.1`, tracking `-0.03em`, balanceado |
| título de seção | `.type-section-title` | `1.125rem`, peso 600, `1.2`, tracking `-0.015em`, balanceado |
| título de card | `.type-card-title` | `0.9375rem`, peso 600, `1.25` |
| corpo | `.type-body` | `1rem`, `1.6`, texto pretty |
| corpo auxiliar | `.type-body-sm` | `0.875rem`, `1.5`, texto pretty |
| label | `.type-label` | `0.8125rem`, peso 500, `1.25` |
| meta/caption | `.type-meta` | `0.75rem`, `1.4` |
| identificador | `.type-code` | Geist Mono, `0.75rem`, `tabular-nums`, quebra segura |

As classes expressam papel, não um tamanho conveniente. O corpo de leitura
permanece em `1rem` para preservar o piso de legibilidade; a redução concentra
se em títulos, títulos de card, descrições auxiliares e labels. O elemento ainda deve
ser o heading semântico correto (`h1`, `h2`, `h3`) e peers equivalentes devem
compartilhar papel, peso, line-height e tratamento numérico. Uma exceção local
precisa ser explicada pelo conteúdo ou pela densidade da tarefa, não pelo
comprimento acidental de um texto.

- um `h1` identifica a página;
- `h2` e `h3` refletem a estrutura real, não apenas o tamanho desejado;
- títulos que podem quebrar usam `text-balance`;
- descrições e mensagens longas usam `text-pretty`;
- prosa de leitura fica próxima de 60 a 75 caracteres por linha;
- valores comparáveis usam `tabular-nums`;
- não reduzir fonte ou contraste para fazer conteúdo denso caber;
- peers compartilham tamanho, peso, line-height e tratamento numérico;
- hierarquia tipográfica vem antes de cor, borda e superfície;
- títulos e headings usam sentence case, termos concretos e verbos ativos;
- não usar eyebrows, overlines, numeração decorativa ou caixa alta para criar
  hierarquia artificial;
- copy visível fica em português natural e com acentuação consistente;
- estados de processamento e placeholders progressivos usam `…`;
- não usar travessão longo em copy do produto.

Ritmo vertical:

- título e sua descrição ficam próximos;
- parágrafos seguem um ritmo de corpo consistente;
- label, valor e detalhe mantêm a mesma relação entre peers;
- mudança de grupo tem gap claramente maior que o espaço interno;
- caption ou fonte ficam próximos da evidência que qualificam;
- componentes filhos não adicionam margens concorrentes quando o container já
  possui o gap.

## Componentes e contratos de interação

### Botões e ações

Use `Button` de `src/components/ui/button.tsx`. Ele possui variantes
`default`, `outline`, `secondary`, `ghost`, `destructive` e `link`, além de
sizes padrão, `sm`, `lg` e `icon`.

- ações usam `<button>`; navegação usa `<a>` ou `Link`;
- o label comunica a ação sem depender do ícone;
- ícone ao lado de texto recebe `data-icon="inline-start"` ou
  `data-icon="inline-end"` quando o padding depende dessa posição;
- botão somente com ícone recebe nome acessível por `aria-label` ou texto
  equivalente;
- ícone que repete o label recebe `aria-hidden="true"`;
- não usar `div` clicável para representar ação;
- estados de submit usam a prop `loading`, preservam o label, impedem duplo
  envio e expõem `aria-busy`;
- não criar `transition-all`; transições devem listar apenas propriedades que
  mudam.

`FormSubmitButton` integra `useFormStatus` a `Button`. Mutações administrativas
que usam Server Action devem preferir esse componente ou
`AdminMutationSubmitButton` dentro de `AdminMutationForm`, preservando loading,
toast de resultado e erro inline.

### Campos e formulários

Use `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError`,
`Input`, `Textarea`, `Select`, `Checkbox`, `Switch` e `Slider` existentes.

- todo controle precisa de label visível ou nome acessível;
- `FieldLabel` aponta para o `id` do controle com `htmlFor`;
- ajuda explica formato ou consequência, não repete o label;
- erro fica próximo do campo e usa texto acionável;
- preserve o valor informado quando a validação falhar, salvo regra explícita;
- use `Input` e `Textarea` compartilhados em vez de recriar estilos locais;
- use `autocomplete` coerente; buscas que não representam dado pessoal podem
  usar `autoComplete="off"`;
- placeholders terminam com `…` quando forem instrução curta;
- uploads devem usar input de arquivo e `label` associado, não uma área `div`
  que dependa de clique ou teclado artificial;
- não ocultar a causa de uma falha de Server Action atrás de um toast que some;
  manter erro inline quando a pessoa precisa corrigi-lo.

### Menus, diálogos e superfícies portadas

Use `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Select` e
`Tooltip` existentes. Eles são portaled e devem manter nome, descrição, foco,
teclado e fechamento coerentes. Ação destrutiva exige confirmação clara e
explica a consequência. Não usar tooltip como único label de uma ação essencial.

### Status, progresso e feedback

Estados de domínio devem usar uma combinação de rótulo textual e variante
semântica. As funções em `src/features/admin/status-presentation.ts` são a
fonte atual de labels e variantes para status administrativos; não duplicar um
mapa visual local para o mesmo estado.

`Progress` comunica progresso mensurável e recebe `aria-label` contextual.
Não use a cor do indicador como único significado.

`Toast`, `role="status"`, `aria-live="polite"` e `role="alert"` têm papéis
distintos:

- sucesso ou mudança não urgente: status polido e toast;
- erro que exige atenção ou correção: alerta e mensagem próxima da ação;
- processamento prolongado: texto de estado, não apenas spinner;
- não anunciar repetidamente o mesmo estado sem mudança.

`Skeleton` usa `animate-pulse` como feedback de carregamento existente. O
skeleton deve acompanhar a estrutura da tela final, sem inventar seções que o
conteúdo real não possui.

`Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription` e `EmptyContent` de
`src/components/ui/empty.tsx` são o estado vazio padrão. Ele deve dizer o que
está vazio, por que isso importa e,
quando houver, qual é o próximo passo. `EmptyTitle` deve respeitar a hierarquia
da página (`h2` ou `h3` quando necessário).

## Dados, evidências e tabelas

Admin e Suporte frequentemente consultam listas, filas, auditoria, financeiro e
métricas. A interface deve mostrar a base necessária para a decisão sem expor
dados além da permissão e da finalidade da tela.

- mostre unidade, período, população, denominador e base de comparação perto da
  evidência;
- não trate uma projeção ou métrica agregada como autoridade de acesso,
  conclusão ou Certificado;
- preserve IDs técnicos em Mono e em escala legível;
- em paginação, mostre a faixa atual e o total geral quando esses dados
  existirem;
- mantenha filtros, busca e página na URL quando a consulta for carregada ou
  paginada no servidor;
- não selecione linhas favoráveis manualmente; informe o filtro ativo e permita
  consultar o conjunto completo quando a finalidade exigir;
- use texto alinhado ou tabela quando a precisão for a tarefa principal;
- adicione gráfico somente quando uma relação, tendência, proporção ou limiar
  ficar mais rápida de entender visualmente;
- toda visualização não textual material precisa de tabela semântica ou
  alternativa textual.

Para tabelas:

- use `Table`, `TableHeader`, `TableBody`, `TableHead`, `TableCell` e
  `TableCaption` de `src/components/ui/table.tsx`;
- use `<caption>` visível ou acessível;
- use `<th scope="col">` para colunas e `<th scope="row">` quando a linha tiver
  um rótulo próprio;
- alinhe headers e células pela mesma coluna: texto à esquerda, números à
  direita;
- use `tabular-nums` em números e mantenha unidade e precisão consistentes;
- mantenha células no baseline quando uma célula quebrar em várias linhas;
- não comprima ou corte headers para preservar uma coluna de texto lateral;
- dê largura suficiente a labels curtos antes de aceitar uma quebra estranha;
- não repita uma categoria em cada linha quando um agrupamento semântico for
  suficiente;
- deixe o contêiner fornecer rolagem horizontal local para ledgers largos;
- estado vazio de tabela ocupa a tabela com mensagem semântica, não um card
  decorativo solto.

Para métricas, auditoria, financeiro e gráficos, qualifique o dado quando for
necessário para interpretá-lo: período, unidade, população, denominador ou
base de comparação, fonte, e se o valor é observado, derivado, projetado ou
recomendado. Um subconjunto inicial deve ser explicitamente descrito como
filtro ou amostra operacional; não deve parecer o universo inteiro. Um gráfico
material precisa de legenda e uma leitura equivalente em texto ou tabela.

`DataTable` exige caption, mantém o estado vazio dentro do `<table>` e aceita
`rowHeader` na metadata da coluna para produzir `<th scope="row">`. A ordem,
busca, paginação e mensagem de erro devem continuar compreensíveis quando o
conjunto filtrado for vazio ou quando a tabela estiver em viewport estreito.

## Conteúdo, terminologia e confiança

Use os termos definidos em [CONTEXT.md](CONTEXT.md): Aluno, Curso, Módulo, Aula,
Matrícula, Concessão, Pedido, Progresso, Conclusão e Certificado não são
sinônimos intercambiáveis.

- títulos dizem o que a pessoa encontra ou precisa decidir;
- descrições são curtas, concretas e não prometem mais que o estado comprova;
- mensagens de erro dizem o que falhou e qual recuperação é possível;
- estados ambíguos comunicam a incerteza e não liberam confiança visual falsa;
- Admin e Suporte recebem detalhes operacionais necessários, sem transformar
  dados técnicos em copy para Alunos;
- não expor e-mail, identidade, payload, segredo, motivo interno ou detalhe de
  provider quando a tela não precisa disso;
- labels de status devem ser consistentes entre lista, detalhe, filtro e ação;
- datas, valores financeiros, percentuais e durações devem indicar seu formato
  e manter precisão coerente;
- não usar texto genérico como substituto de uma causa conhecida;
- copy interna de implementação não deve aparecer como se fosse decisão de
  produto.

## Movimento

O padrão do Hub é a quietude. Não adicionar animação decorativa, marquee,
typing cursor, parallax, bounce, pulso de status, som ou revelação de cada seção
no scroll.

- usar movimento somente para mudança de estado, foco, hover, continuidade ou
  confirmação da ação;
- nunca mover imagem de capa ou mídia de Aula no hover como requisito de
  entendimento;
- transicionar propriedades específicas, como fazem os primitives existentes;
- manter a experiência completa sem depender do movimento;
- `animate-spin` pode indicar carregamento e `animate-pulse` pode indicar
  skeleton, desde que o texto de estado também exista quando necessário;
- não adicionar uma biblioteca de animação para microinteração;
- não adicionar `prefers-reduced-motion` neste projeto.

O carrossel de banners do dashboard mantém o autoplay existente de seis
segundos nesta linha de trabalho por decisão explícita de escopo. Não adicionar
novos carrosséis com autoplay sem uma decisão específica de produto e sem
definir a interação correspondente.

O `Button`, `Input`, `Textarea`, `Select` e `Progress` atuais já possuem
transições limitadas às propriedades relevantes. Preserve esses contratos e não
os substitua por uma transição ampla.

## Imagens e ícones

- use `next/image` para imagens do produto, conforme o contrato de Next.js do
  repositório;
- cards de Aula em moldura horizontal priorizam a thumbnail do vídeo; quando ela
  não existe, usam a capa do Curso; sem nenhuma das duas, usam o fallback visual
  do próprio card;
- imagens de Aula ocupam a moldura com `fill` e `object-cover object-center`,
  preservando a proporção e aceitando corte para não deformar a imagem;
- URLs lógicas de Capa incluem uma versão codificada da chave da variante em
  `?v=...`; a versão muda quando a Capa é substituída, enquanto a rota continua
  resolvendo a chave atual no banco;
- a rota interna que serve a capa do Curso redireciona para a mídia pública; ao
  usá-la como fallback em `next/image`, mantenha `unoptimized` para que o
  otimizador não tente processar esse redirecionamento;
- imagem que carrega informação recebe alt adequado;
- imagem puramente decorativa recebe `alt=""`;
- não usar imagem stock, ilustração gerada ou screenshot falso para preencher
  espaço;
- capas e mídia visual de conteúdo podem usar a exceção registrada neste
  documento;
- Hugeicons é o único kit de ícones instalado e deve manter peso e escala
  coerentes;
- ícones ao lado de texto são auxiliares e ficam ocultos da árvore acessível;
- ícones isolados precisam de nome acessível;
- `EmptyMedia` pode agrupar ícone de um estado vazio, mas isso não autoriza
  colocar um ícone em tile colorido para cada metadata ou status.

## Acessibilidade e responsividade

- use landmarks, uma única região principal e um `h1` descritivo;
- preserve a ordem semântica de headings;
- `PanelLayout` mantém skip link para `#main-content` e navegação com
  `aria-label`; novas telas devem continuar dentro dessa estrutura;
- use HTML nativo antes de ARIA;
- toda interação de mouse precisa funcionar por teclado;
- foco deve ser visível, não coberto por header sticky, diálogo ou overlay;
- não dependa apenas de cor, posição, ícone ou animação;
- mantenha nomes, descrições, labels e mensagens de erro acessíveis;
- não oculte overflow da página para mascarar quebra de layout;
- use `min-w-0`, reflow e rolagem local antes de reduzir texto ou controle;
- mantenha controles utilizáveis em viewport estreito e com texto longo;
- preserve contraste entre texto, superfície, borda, foco e estado no tema escuro;
- use WCAG AA como piso de contraste para texto normal, controles e foco;
- tabelas e conteúdo de leitura devem continuar consultáveis sem mouse.

## Checklist de estados e composição

Antes de considerar uma interface pronta, confirme:

- tarefa e permissão estão claras na primeira leitura;
- o estado principal e a próxima ação têm maior destaque que o contexto;
- existe exatamente uma composição para a pergunta, não um conjunto de cards
  repetidos;
- cards, bordas, badges e ícones têm motivo semântico;
- nenhum título, descrição, ID ou valor quebra a topologia em largura estreita;
- repouso, hover, foco, ativo, desabilitado, carregando, sucesso, erro e vazio
  foram tratados quando aplicáveis;
- a ação não pode ser enviada duas vezes enquanto está pendente;
- erros podem ser entendidos e recuperados;
- tabelas têm caption, headers semânticos, alinhamento e faixa/total coerentes;
- dados técnicos não escapam da permissão ou da finalidade da tela;
- copy visível está em português, com termos do glossário e acentuação correta;
- não há cor, ícone ou movimento funcionando como único indicador;
- efeitos de capas e mídia de Aulas permanecem somente onde a exceção permite;
- não há `prefers-reduced-motion`, `transition-all`, gradiente decorativo novo
  ou CSS de marca Vercel;
- a ordem de leitura funciona sem estilos e a navegação por teclado mantém o
  foco visível.

## Verificação técnica

Após uma alteração visual ou de interação:

1. revisar o diff e confirmar que somente os arquivos necessários foram
   tocados;
2. executar os testes afetados;
3. executar `bun run check`;
4. executar `bun run typecheck`;
5. executar `bun run docs:check` se qualquer documento canônico mudar;
6. verificar que os estados e textos novos têm cobertura quando o componente ou
   contrato for crítico;
7. para revisão humana autorizada, inspecionar a primeira leitura, conteúdo
   longo e viewport estreito na aplicação real, sem tratar uma única viewport
   como prova de responsividade.

O repositório não usa o documento Vercel como fonte de tokens ou de marca. O
alvo é aplicar o mesmo rigor de clareza, evidência e contenção à identidade
NeuroCapacitar, mantendo PROTEA-R no contexto do Curso onde ele realmente
existe.
