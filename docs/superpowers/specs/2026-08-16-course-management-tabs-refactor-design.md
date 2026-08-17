---
status: accepted
owner: product
last_verified_commit: 4b5be00
---

# Refinamento das abas de gerenciamento de Curso

**Data:** 2026-08-16
**Status:** aprovado para implementação
**Escopo:** Visão geral, Conteúdo, Certificado e a navegação compartilhada da
página de gerenciamento de Curso

## Resultado esperado

A página de gerenciamento deve organizar cada aba de acordo com o trabalho que
ela suporta, mantendo a linguagem visual simples do Hub:

- **Visão geral** orienta a pessoa administradora com números exatos, estado
  operacional e uma próxima ação clara;
- **Conteúdo** funciona como um construtor curricular escalável, com publicação,
  módulos, aulas e reordenação no mesmo contexto;
- **Certificado** preserva o editor visual existente e adapta seu inspetor para
  telas menores;
- o cabeçalho compartilhado apresenta somente identidade e ações realmente
  globais do Curso.

Configurações e Alunos não terão seus conteúdos redesenhados neste trabalho. A
navegação compartilhada pode ser ajustada porque também serve essas abas.

## Princípios

1. Ações aparecem junto do objeto que alteram.
2. Estado visual nunca substitui o estado real do domínio.
3. Informação resumida deve conduzir a uma ação, não apenas ocupar espaço.
4. Densidade é reduzida por hierarquia e divulgação progressiva, não por ocultar
   informações necessárias.
5. Desktop, tablet, mobile, teclado e conteúdo longo são estados de primeira
   classe.
6. Componentes existentes do projeto têm precedência sobre novas abstrações.

## Navegação e cabeçalho compartilhados

### Cabeçalho

O cabeçalho mantém:

- título do Curso;
- subtítulo, quando existir;
- status localizado do Curso;
- ação `Ver como aluno` quando a visualização estiver disponível.

O sinal de integridade do conteúdo deixa o cabeçalho global e passa para a aba
Conteúdo. As ações `Preparar alterações` e `Publicar alterações` também deixam o
cabeçalho, pois alteram exclusivamente a publicação curricular.

Em telas estreitas, a ação global pode ocupar uma segunda linha ou entrar em um
menu de ações, sem reduzir o título a uma coluna artificialmente estreita.

### Estado da aba

A aba ativa será refletida na URL por um parâmetro estável, por exemplo
`?tab=content`. O comportamento deve preservar:

- abertura padrão em Visão geral quando o parâmetro estiver ausente ou inválido;
- atualização da página;
- compartilhamento da URL;
- navegação de voltar e avançar;
- semântica e interação de teclado do componente de Tabs atual.

Em telas estreitas, a lista permanece em uma linha com rolagem horizontal. Não
será dividida em duas linhas. A aba ativa deve permanecer visível depois da
navegação.

## Visão geral

### Contrato de dados

A aba não deve calcular métricas a partir de listas operacionais paginadas. Uma
projeção agregada específica por Curso fornecerá, no mínimo:

- quantidade exata de Matrículas ativas;
- quantidade exata de Pedidos pagos;
- quantidade exata de Certificados válidos.

Contagens devem ser calculadas no banco com os estados canônicos correspondentes.
Pedidos pendentes, expirados, cancelados, estornados ou disputados não entram em
`Pedidos pagos`. Certificados revogados não entram em `Certificados válidos`.

Receita não será adicionada nesta etapa. Ela pertence ao fluxo financeiro e não
é necessária para orientar a manutenção do Curso.

### Estado operacional

A prontidão deixa de afirmar genericamente que o Curso está “vendável e
completo”. Ela será derivada de condições explícitas e ordenadas:

1. identidade mínima: descrição e capa;
2. estrutura mínima: pelo menos um Módulo e uma Aula pronta;
3. publicação curricular vigente;
4. configuração comercial válida para Curso pago;
5. status ativo do Curso.

O primeiro bloqueio relevante determina a próxima ação. Um rascunho curricular
posterior à publicação vigente não torna o Curso indisponível; ele aparece como
alteração pendente de publicação.

O estado comercial deve reutilizar regras de domínio existentes para preço,
métodos de pagamento e disponibilidade do checkout, sem duplicar validação no
componente de apresentação.

### Layout

A ordem visual será:

1. bloco de estado e próxima ação;
2. três métricas compactas;
3. resumo curricular com quantidade de Módulos, Aulas, duração efetiva e estado
   da publicação.

Pendências acionáveis navegam para a aba ou abrem o diálogo responsável. Estados
saudáveis usam uma confirmação curta e não exibem um checklist vazio.

Os números usam algarismos tabulares. Labels e helpers permanecem curtos e não
repetem o título do bloco.

## Conteúdo

### Barra de publicação

O topo da aba concentra:

- título e descrição curta do fluxo;
- estado da publicação vigente;
- indicação de rascunho em preparo;
- `Preparar alterações` ou `Publicar alterações`, conforme o estado;
- `Novo módulo` como ação primária de autoria quando houver rascunho editável.

Quando não houver rascunho, ações de criação, edição e reordenação ficam
indisponíveis com texto que ensina a preparar alterações. A UI não deve sugerir
que conteúdo publicado pode ser alterado diretamente.

Publicar continua submetendo o conjunto completo de alterações e deve usar a
confirmação já definida para ações de publicação, caso exista no projeto. Este
refactor não modifica a atomicidade da publicação.

### Módulos

Cada Módulo será uma seção recolhível. O cabeçalho sempre visível contém:

- handle de reordenação;
- título;
- quantidade de Aulas;
- duração acumulada;
- estado;
- ação `Nova aula`;
- menu de ações secundárias, incluindo edição.

O Módulo recém-criado ou que contém a Aula retornada de uma edição abre
automaticamente. Nos demais casos, o estado inicial pode manter o primeiro
Módulo aberto e os demais recolhidos. Expandir um Módulo não recolhe
obrigatoriamente os outros.

O controle de expansão será um botão semântico com `aria-expanded` e
`aria-controls`. Ações persistentes do cabeçalho não ficam dentro desse botão.

### Aulas

A tabela de colunas rígidas será substituída por linhas responsivas. Cada linha
apresenta:

- handle e posição curricular;
- título como informação principal;
- tipos de conteúdo, duração e obrigatoriedade como metadados secundários;
- estado da Aula;
- ação de edição.

No desktop, a linha usa uma grade compacta. No mobile, título e metadados são
empilhados, com estado e ação na parte inferior. Títulos longos podem ocupar duas
linhas antes de truncar; o valor completo continua disponível por nome acessível
ou conteúdo expandido, não apenas por tooltip.

Badges de `Vídeo` e `Texto` não serão exibidos como dois elementos concorrentes
quando uma frase curta, como `Vídeo + texto`, comunicar melhor a composição.
`Sem conteúdo` permanece um estado de atenção textual.

### Reordenação

Arrastar continua sendo um acelerador, não a única forma acessível de operar a
lista. Os handles devem:

- ser botões semânticos com nome específico, como `Reordenar aula Introdução`;
- ter foco visível;
- oferecer área interativa mínima de 40 px no desktop e 44 px em telas de toque;
- preservar a operação por teclado do DnD existente;
- impedir seleção de texto e ações concorrentes durante o arraste.

Enquanto a nova ordem estiver sendo persistida, a seção mostra
`Salvando ordem…` sem toast de sucesso. Em falha, a ordem volta ao estado inicial
e o Sonner informa o erro e a possibilidade de tentar novamente.

### Estados vazios

O Curso sem Módulos usa o componente `Empty`, explica o próximo passo e apresenta
`Criar primeiro módulo`. Um Módulo sem Aulas exibe um estado compacto dentro da
seção com `Criar primeira aula`.

## Certificado

### Desktop

O editor atual permanece canvas-first e conserva:

- Card único;
- barra de status, rascunho, publicação e menu;
- preview como superfície principal;
- inspetor contextual lateral;
- Sheet de campos e visibilidade;
- histórico de versões;
- avisos de sobreposição sem bloqueio indevido.

As ações curriculares removidas do cabeçalho global não aparecem nesta aba.

### Mobile e tablet

Abaixo do breakpoint em que preview e inspetor não cabem lado a lado:

- o preview continua como superfície principal;
- selecionar um campo ou a arte abre suas propriedades em um Sheet inferior;
- fechar o Sheet preserva seleção e alterações;
- `Campos e visibilidade` continua em Sheet;
- as ações menos frequentes do toolbar entram em um menu quando não couberem;
- ações essenciais permanecem nomeadas ou possuem nome acessível;
- controles interativos têm área mínima de 44 px;
- inputs usam fonte visual mínima de 16 px para evitar zoom durante edição.

O Sheet inferior não cria uma segunda cópia do formulário. O mesmo inspetor contextual é
composto em recipientes diferentes conforme o breakpoint.

## Componentes e limites técnicos

Responsabilidades sugeridas:

- projeção de overview: consulta agregada e função de apresentação sem JSX;
- shell da página: identidade, ação global e seleção de aba pela URL;
- painel de publicação: estado e mutações da publicação curricular;
- módulo recolhível: resumo, expansão e ações do Módulo;
- linha de Aula: apresentação responsiva e edição;
- editor de certificado: composição responsiva do inspetor existente.

Não será criada uma biblioteca paralela de Cards ou layout. `Card`, `Empty`,
`Tabs`, `Sheet`, `DropdownMenu`, `Badge`, `Button` e Sonner existentes devem ser
reutilizados. O Sheet inferior usa `side="bottom"` no componente atual, sem nova
dependência de interface.

O arquivo de página não deve absorver consultas, regras de prontidão ou estado
client-side das abas. A apresentação complexa deve permanecer em componentes ou
funções com responsabilidade nomeada.

## Erros e estados assíncronos

- Mutações desabilitam apenas controles que poderiam duplicar a mesma operação.
- O rótulo original permanece reconhecível durante carregamento, usando
  `Preparando…`, `Publicando…` ou `Salvando ordem…`.
- Erros de campo permanecem junto ao campo.
- Erros globais e de persistência usam Sonner com mensagem acionável.
- Falhas otimistas restauram o último estado confirmado.
- Navegar entre abas não pode descartar silenciosamente alterações não salvas do
  certificado.

## Acessibilidade e responsividade

- preservar hierarquia `h1` para Curso, `h2` para aba e `h3` para Módulos;
- manter labels textuais além de cor para todos os estados;
- garantir foco visível em tabs, menus, handles e campos do preview;
- evitar controles icon-only sem `aria-label`;
- validar 320 px, 768 px, largura de notebook e largura máxima do container;
- testar títulos de Curso, Módulo e Aula longos;
- não depender de hover para revelar uma operação necessária;
- manter ações de navegação como links reais.

## Testes e verificação

### Dados e apresentação

- projeção retorna totais exatos acima de 40 registros;
- somente Pedidos pagos entram na métrica;
- somente Certificados válidos entram na métrica;
- prontidão distingue Curso indisponível, incompleto, pronto, publicado e com
  alterações pendentes;
- ações de pendência apontam para o destino correto.

### Navegação

- parâmetro de aba válido abre o painel correspondente;
- parâmetro inválido volta para Visão geral;
- troca de aba atualiza a URL e respeita voltar/avançar;
- tabs continuam operáveis por teclado.

### Conteúdo

- expansão de Módulo preserva ações independentes no cabeçalho;
- estados vazios oferecem a ação correta;
- reordenação de Módulos e Aulas continua persistindo os grupos completos;
- falha de persistência restaura a ordem anterior e mostra Sonner;
- linhas não criam overflow horizontal nas larguras cobertas.

### Certificado

- desktop mantém preview e inspetor lado a lado;
- seleção no mobile abre o Sheet inferior com o campo correto;
- fechar e reabrir preserva o rascunho;
- salvar, publicar, desfazer e gerenciar visibilidade mantêm o comportamento
  atual;
- navegação com alterações não salvas continua protegida.

### Comandos mínimos

- testes direcionados dos componentes e projeções alterados;
- `bun x ultracite fix`;
- `bun x ultracite check`;
- `bun run typecheck`;
- `bun run docs:check` quando a documentação for alterada;
- build antes da conclusão, se os checks anteriores passarem.

## Fora de escopo

- redesenhar Configurações ou Alunos;
- alterar regras de matrícula, progresso ou emissão de certificado;
- criar analytics adicionais;
- adicionar receita ao overview;
- trocar o motor de DnD ou o renderer do certificado;
- alterar schema persistido de templates;
- transformar as abas em rotas independentes nesta etapa;
- modificar o checkout ou a oferta de pagamento.

## Sequência de implementação

1. Criar a projeção agregada e os estados de prontidão testáveis.
2. Persistir a aba na URL e simplificar o cabeçalho compartilhado.
3. Refatorar Visão geral sobre o novo contrato.
4. Mover publicação para Conteúdo e refatorar Módulos e Aulas.
5. Adaptar o inspetor do Certificado para Sheet inferior responsivo.
6. Executar verificações direcionadas e completas.

Cada etapa deve permanecer revisável e evitar misturar mudanças de dados com
grandes mudanças visuais no mesmo commit.
