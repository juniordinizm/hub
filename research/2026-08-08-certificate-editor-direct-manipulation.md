# Pesquisa: manipulação direta no editor de certificado

**Data:** 2026-08-08  
**Fuso:** America/Sao_Paulo  
**Escopo:** seleção, arrastar, redimensionar, snapping, seleção múltipla, teclado, zoom, limites de página e consistência entre preview HTML e PDF. Foram consultadas documentações oficiais dos produtos e bibliotecas; não foram usados tutoriais de terceiros para sustentar decisões.

## Decisão resumida

Manipulação direta é viável para os 13 campos padronizados do Hub, mas o editor não deve trocar o preview atual por um canvas livre. A melhor relação entre risco e valor é uma arquitetura **híbrida DOM-first**:

- manter o preview DOM atual para texto, QR e imagens;
- adicionar uma camada de seleção/handles (HTML ou SVG sobreposto) que converta ponteiros em coordenadas normalizadas `%`;
- manter `CertificateTemplateSpec` como única fonte de verdade;
- continuar renderizando o PDF com o renderer atual e validando limites/overflow no servidor;
- oferecer inspector e inputs numéricos como caminho principal de precisão e acessibilidade.

Essa abordagem entrega seleção, drag, resize, guides, zoom e teclado sem introduzir uma segunda engine de texto que possa divergir do PDFKit. Canvas puro (Konva/Fabric) oferece mais recursos prontos, mas cria uma terceira representação visual e exige reconstruir semântica, acessibilidade e sincronização com o PDF. DOM overlay puro é simples para começar, porém exige implementar snapping, handles, grupo e teclado de forma explícita. A camada híbrida preserva o investimento existente e limita a nova superfície a interação.

## Contexto e restrições do Hub

O código atual já usa um modelo adequado para manipulação normalizada:

- [`template-rules.ts`](../src/features/certificates/template-rules.ts#L21-L37) guarda `x`, `y`, `width` e `height` em porcentagem, com a página A4 horizontal como referência.
- O preview calcula frames CSS percentuais em [`certificate-template-preview-layout.ts`](<../src/app/%28admin%29/admin/cursos/%5BcourseId%5D/certificate-template-preview-layout.ts#L17-L24>) e recalcula o tamanho da fonte com base na largura renderizada.
- O renderer de PDF converte os mesmos percentuais para pontos A4 em [`rendering.ts`](../src/features/certificates/rendering.ts#L49-L85), desenha na ordem do array e rejeita overflow de texto em [`rendering.ts`](../src/features/certificates/rendering.ts#L107-L119).
- O preview atual aplica `overflow-hidden` no texto e usa a aproximação de Helvetica do browser. Portanto, um elemento que parece caber no browser ainda pode falhar na medição de `heightOfString` do PDFKit.
- A sobreposição é deliberadamente permitida e apenas avisada; sair dos limites da página, duplicar campo, ocultar campo obrigatório ou ultrapassar a altura imprimível continuam sendo invariantes de servidor.

Consequência: a interação deve editar percentuais, não pixels ou transforms persistidos. `transform: translate(...)` pode ser usado durante um gesto para fluidez, mas no `pointerup` precisa ser convertido para `x/y/width/height` e normalizado antes de atualizar o estado.

## Como editores reais resolvem o problema

### Figma

A Figma combina canvas, lista de layers e properties panel. A documentação de alinhamento diz que o usuário pode mover/redimensionar no canvas ou editar `W`/`H` na sidebar; snap to objects, snap to geometry e snap to pixel grid produzem guias visuais e podem ser desativados temporariamente com `Control`. A documentação de layers descreve a seleção na lista, a minimização dos painéis e a persistência de uma área de trabalho com canvas rolável.

Fontes oficiais:

- [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position)
- [Design, prototype, and view code in the Properties Panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel)
- [View layers and pages in the Layers Panel](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-Layers-Panel)
- [Resize, rotate, and flip objects in FigJam](https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam)

Padrões transferíveis:

- canvas e inspector representam o mesmo objeto; a seleção em um deve atualizar o outro;
- campos numéricos coexistem com drag/handles;
- snap é visível, reversível e tem atalho para desativação temporária;
- múltipla seleção é uma ação explícita, com bounding box de grupo;
- redimensionar texto não significa necessariamente escalar a fonte: o editor distingue resize de scale.

Risco para o Hub: copiar seleção múltipla e auto-layout sem definir o que um campo padronizado pode alterar criaria regras que não existem no snapshot do certificado.

### Canva

O anúncio oficial da Canva sobre Layers e Position descreve uma lista de elementos com visão geral de visibilidade, bloqueio e agrupamento e um painel de posição que permite editar posicionamento, alinhamento, espaçamento, tamanho, rotação e proporção de um ou vários elementos. A central de ajuda documenta seleção múltipla com `Shift`, handles de rotação e valores específicos no painel Position. A página de atalhos documenta nudge com setas, redimensionamento por teclado, seleção do próximo elemento com `Tab`, zoom e mostrar/ocultar sidebar.

Fontes oficiais:

- [Canva Create: Layers e Position tools](https://www.canva.com/newsroom/news/highly-requested-launches/)
- [Flip and rotate elements](https://www.canva.com/help/flip-and-rotate/)
- [Canva keyboard shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/)
- [Canva AI Photo Editor: selecionar, redimensionar e reposicionar elementos](https://www.canva.com/features/ai-photo-editing/)

Padrões transferíveis:

- visão de layers reduz a necessidade de clicar repetidamente em elementos sobrepostos;
- painel de posição é o caminho de precisão, enquanto handles são o caminho rápido;
- `Tab`/`Shift+Tab` e setas tornam a manipulação repetível sem mouse;
- múltipla seleção pode ser útil para alinhamento, mas deve ser uma decisão explícita.

Risco para o Hub: Canva permite liberdade de composição e reordenação muito maior. O Hub deve expor apenas operações compatíveis com os campos fixos e nunca permitir que uma transformação altere o payload de emissão ou a ordem de renderização sem contrato.

### Framer

O guia oficial do Framer trata o canvas como um ambiente com ferramentas separadas para seleção, pan e zoom. O toolbar oferece zoom numérico, zoom para seleção e fit; a documentação de preview recomenda verificar diferentes breakpoints e abrir um modo separado para testar o resultado final.

Fontes oficiais:

- [Using the canvas](https://www.framer.com/help/articles/how-to-use-the-canvas/)
- [Previewing your site](https://www.framer.com/help/articles/how-to-preview-your-site/)

Padrões transferíveis:

- pan e zoom são estado do viewport, não estado do documento;
- `Fit to selection` reduz a necessidade de rolar até o elemento selecionado;
- preview/produção são superfícies distintas: o editor não deve prometer que o canvas de edição é idêntico ao artefato final sem uma verificação própria.

### diagrams.net/draw.io

O editor draw.io documenta grid, snap to grid, snap to page centre, guias de alinhamento e espaçamento, desativação temporária com `Alt`, nudge por teclado e alinhamento/distribuição para várias formas. A documentação também deixa claro que grid e borda da página são auxiliares do editor e não são exportados.

Fontes oficiais:

- [Snap to grid and alignment tools](https://www.drawio.com/docs/manual/editor/alignment-tools/)
- [Editor grid and export behavior](https://www.drawio.com/docs/manual/editor/panels/editor-grid-change/)
- [Keyboard movement constraints](https://www.drawio.com/doc/faq/shape-move-horizontal-vertical)

Padrões transferíveis:

- guias e grid são feedback temporário, não dados persistidos no documento;
- snap deve ter liga/desliga e escape rápido para ajuste fino;
- limites da página e centro da página são alvos de snap diferentes do grid;
- para múltipla seleção, alinhar/distribuir é mais seguro do que aplicar um resize arbitrário.

### Google Slides

O suporte oficial do Google Slides documenta seleção de objetos no slide, `Size & Position` para valores precisos, snap to guides/grid, rulers, guides, lock aspect ratio, alinhamento/distribuição e centralização na página. Os atalhos incluem seleção do próximo shape com `Tab`, nudge de um pixel ou em incremento maior, redimensionamento por teclado e modificadores para limitar movimento, preservar proporção e suspender guias.

Fontes oficiais:

- [Insert and arrange text, shapes, diagrams, and lines](https://support.google.com/docs/answer/1696521)
- [Keyboard shortcuts for Google Slides](https://support.google.com/docs/answer/1696717)
- [Zoom or change your document view](https://support.google.com/docs/answer/99753)
- [Change slide size and measurement units](https://support.google.com/docs/answer/3447672)

Padrões transferíveis:

- unidade de medida explícita reduz ambiguidade; no Hub, usar `%` e mostrar A4 como contexto;
- preservar proporção precisa ser uma opção por tipo (QR/assinatura), não um efeito surpresa;
- rulers/guides podem ajudar, mas o certificado deve continuar simples por padrão;
- a existência de atalhos de nudge e resize é uma boa referência para a camada de acessibilidade.

## Bibliotecas oficiais avaliadas

### DOM/SVG: `interact.js`

O `interact.js` oferece drag, resize e gestos para DOM e SVG, mas explicitamente deixa a aplicação responsável por mover os elementos. Os modifiers incluem `restrict` para limites, `snap` para pontos, `snapSize` para dimensões, `snapEdges` para bordas e grids com limites.

Fontes:

- [interact.js overview](https://interactjs.io/)
- [Snapping](https://interactjs.io/docs/snapping/)
- [Modifiers and restrictions](https://interactjs.io/docs/modifiers/)

Avaliação para o Hub: tecnicamente adequado para uma camada híbrida porque fornece os eventos e os constraints sem impor uma cena paralela. O custo é implementar o contrato de estado, handles acessíveis, seleção, keyboard sensor, undo e conversão de pixels para `%`.

### DOM/SVG: Moveable/react-moveable

O projeto oficial Moveable oferece draggable, resizable, scalable, rotatable, groupable, snappable e suporte a SVG. A API expõe bounds, guidelines, snap threshold, grupos e eventos de início/movimento/fim.

Fonte:

- [Moveable documentation](https://daybrush.com/moveable/release/latest/doc/)

Avaliação para o Hub: acelera handles, guidelines e seleção, mas fornece uma UX de editor genérica. Será necessário desabilitar rotação/escala/pinch/warp, escolher handles permitidos por tipo e converter cada evento para a geometria normalizada. Deve ser considerado somente depois de provar que o DOM-first atende acessibilidade e PDF.

### Canvas: Konva/react-konva

O exemplo oficial do Konva usa `Transformer` para selecionar, arrastar e redimensionar formas. A documentação destaca que o transformer precisa ser ligado manualmente ao node selecionado; no resize, o transformer altera `scaleX/scaleY`, e o estado da aplicação deve converter a escala de volta para `width/height`. `boundBoxFunc` pode impedir limites inválidos. Há exemplos oficiais de seleção, clique fora para desselecionar, resize limitado e zoom relativo ao ponteiro.

Fontes:

- [React Transformer](https://konvajs.org/docs/react/Transformer.html)
- [Limited drag and resize](https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html)
- [Pointer-relative zoom](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html)
- [Transformer API](https://konvajs.org/api/Konva.Transformer.html)

Avaliação para o Hub: muito bom para a mecânica de cena, mas traz uma diferença importante: o preview deixaria de ser o mesmo DOM que contém texto acessível. Seria preciso criar uma árvore DOM paralela para leitores de tela e inputs, sincronizar fontes e imagens, testar hidratação Next.js e manter outra lógica para PDFKit. Não é indicado como primeira implementação.

### Canvas: Fabric.js

O Fabric documenta seleção simples, seleção por área, múltipla seleção, dragging, scaling, rotação, skew e controles customizáveis. A cena é gerida por objetos em um canvas e os controles são responsáveis por alterar o estado visual.

Fontes:

- [Fabric core concepts](https://fabricjs.com/docs/core-concepts/)
- [Configuring controls](https://fabricjs.com/docs/configuring-controls/)
- [Canvas API](https://fabricjs.com/api/classes/canvas/)

Avaliação para o Hub: cobre mais recursos de um editor visual, mas maximiza a divergência com o renderer PDFKit. Text metrics, QR, imagens, clipping, seleção acessível e exportação exigiriam contratos adicionais. Deve ser descartado enquanto o produto possuir poucos elementos padronizados.

### `@dnd-kit` já presente no repositório

O `@dnd-kit` do projeto é orientado a draggable/droppable e sortable, com sensores, modifiers e suporte a teclado. A documentação define `Sortable` como reordenação de itens em uma ou mais listas; o `DragOverlay` é recomendado para listas roláveis. Isso é útil para a futura lista de campos/layers, mas não é uma solução de bounding box para mover/redimensionar retângulos percentuais dentro da página.

Fontes:

- [dnd-kit overview](https://docs.dndkit.com/)
- [Sortable concepts](https://dndkit.com/concepts/sortable/)
- [Accessibility](https://docs.dndkit.com/guides/accessibility)

Avaliação para o Hub: reutilizar para seleção/reordenação de uma lista somente se a ordem dos campos passar a ser editável. Não usar `Sortable` para simular drag de campos no canvas; isso confundiria reorder com transformação geométrica.

## Comparação das arquiteturas

| Arquitetura | Como funciona | Pontos fortes | Riscos principais | Adequação ao Hub |
| --- | --- | --- | --- | --- |
| DOM overlay | Mantém `<p>`/`Image` posicionados em HTML e adiciona pointer events/handles ou Moveable/interact.js | Reaproveita preview; texto/labels continuam no DOM; integração com React e CSS simples; menor pacote | Implementar hit testing quando há sobreposição; converter pixels para `%`; handles e keyboard são responsabilidade do produto; browser/PDF têm métricas diferentes | Boa para fase 1, especialmente com inputs numéricos e overlay mínimo |
| SVG/canvas | Renderiza todos os campos em SVG ou scene graph de canvas; seleção/transformação no mesmo ambiente | Seleção, bounds, zoom e múltipla seleção podem ser centralizados; bibliotecas oferecem Transformer/controls | Nova engine visual; canvas não é semântico; fontes e quebras divergentes; SSR/hidratação; PDF é uma terceira saída; custo de acessibilidade e testes alto | Viável tecnicamente, mas desproporcional para 13 campos |
| Híbrida DOM-first | DOM continua renderizando arte e conteúdo; SVG/HTML transparente fornece hit areas, guides e handles; inspector é DOM acessível | Preserva a correspondência com PDF e acessibilidade; permite drag/resize progressivos; overlay pode ser desligado para impressão; biblioteca opcional | Sincronização entre retângulo visual e overlay; `z-index`/pointer-events; zoom precisa participar da conversão; sobreposição torna seleção ambígua | Recomendação. Entrega valor sem abandonar a fonte visual atual |

## Avaliação por capacidade

### Seleção direta no preview

**Viabilidade:** alta na arquitetura híbrida. Cada campo visível recebe `data-field` e uma hit area transparente com `button`/elemento focusável; clicar seleciona e atualiza a lista/inspector.

**Decisões necessárias:**

- clicar em uma área sobreposta deve selecionar o elemento visual do topo, com uma ação `Próximo campo` para alternar entre candidatos;
- a lista de campos continua sendo o caminho determinístico para QR/assinatura pequenos ou totalmente cobertos;
- a seleção deve ter outline, label e estado de acessibilidade, não depender apenas da cor;
- clicar no background sem campo desseleciona;
- seleção não deve alterar `visible` nem salvar automaticamente.

### Drag

**Viabilidade:** alta com Pointer Events ou interact.js. No `pointerdown`, capturar pointer e registrar `startRect`/`startPointer`; em `pointermove`, calcular `dx/pageWidth*100` e `dy/pageHeight*100`; em `pointerup`, confirmar a geometria.

**Riscos:** `getBoundingClientRect()` inclui zoom e escala do viewport; o cálculo precisa usar o retângulo real da página e não a largura do card. O drag deve operar somente quando o alvo for um handle/área de movimento, para não impedir seleção de texto ou uso de teclado.

**Regra:** clamp `x` a `[0, 100 - width]` e `y` a `[0, 100 - height]` durante o gesto, mas manter validação no servidor para entradas numéricas e concorrência.

### Resize

**Viabilidade:** média-alta. Oito handles (cantos e lados) são familiares, mas os campos possuem texto com altura calculada pelo PDF. Para texto, resize altera quebra de linha; para QR e assinatura, pode ser necessário preservar proporção.

**Regras recomendadas:**

- texto: handles laterais e cantos, com largura/altura mínimas e diagnóstico de overflow;
- QR: preservar proporção por padrão e exibir tamanho mínimo para leitura;
- assinatura: preservar proporção da imagem, salvo ação explícita `Desbloquear proporção`;
- nunca permitir geometria fora da página;
- transformar escala visual em `width/height` normalizados, não persistir `scaleX/scaleY`.

### Snapping e guides

**Viabilidade:** alta, mas deve ser opt-in ou discreto. O padrão dos editores reais é combinar grid, centro da página, bordas e alinhamento com outros elementos.

**MVP recomendado:**

- grid de 1% ou 0,5% da página, desativado durante input numérico;
- snap ao centro horizontal/vertical e às bordas da página;
- guides temporários para alinhar bordas/centros a outros campos visíveis;
- toggle `Ajustar à grade` e tecla `Alt/Option` para suspender durante o gesto;
- renderizar guides apenas enquanto o pointer estiver em movimento;
- não persistir grid, guides ou zoom em `CertificateTemplateSpec`.

**Risco:** snap automático pode impedir a decisão de sobrepor intencionalmente ou tornar pequenos ajustes instáveis. O usuário deve conseguir editar o valor exato depois do snap.

### Múltipla seleção

**Viabilidade:** baixa prioridade. A seleção múltipla e o resize de grupo exigem regras não existentes no domínio: como distribuir larguras diferentes, como preservar QR, como limitar o bounding box e como representar undo de vários campos.

**Fase 1:** não implementar; oferecer `Shift` apenas para selecionar itens na lista se isso ajudar a ações de alinhamento.  
**Fase 2:** permitir `Shift+click` e ações seguras de alinhar/centralizar/distribuir. Adiar resize/scale de grupo até haver casos reais.  
**Persistência:** aplicar uma única operação de histórico com todos os campos alterados, nunca vários updates intermediários.

### Teclado e tecnologia assistiva

O mouse não pode ser a única forma de manipular geometria. O caminho recomendado:

- lista de campos navegável por `Tab`; `Enter`/`Space` seleciona;
- campo selecionado anuncia nome e status por `aria-live="polite"`;
- inputs `X`, `Y`, `Largura`, `Altura` são o caminho de precisão e funcionam com teclado;
- `Arrow` move 0,5% ou 1%; `Shift+Arrow` move um incremento maior; `Home`/`End` pode ir ao limite do eixo quando o foco estiver no slider;
- `Escape` cancela um drag em andamento e restaura a geometria anterior;
- `Ctrl/Cmd+Z` desfaz a última operação completa, não cada `pointermove`;
- handles visuais não devem criar dezenas de paradas de foco; o inspector e os inputs continuam sendo o caminho acessível;
- `touch-action: none` somente nos handles, nunca na página inteira; testar com touch assistive technology.

O W3C alerta que sliders podem ser difíceis para algumas tecnologias assistivas por toque; por isso o input numérico é obrigatório como alternativa.

Fontes complementares:

- [W3C Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [W3C Keyboard Interface Practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [dnd-kit accessibility guide](https://docs.dndkit.com/guides/accessibility)

### Zoom e pan

Zoom é estado de viewport, nunca geometria do template. O editor deve oferecer `Fit`, `50%`, `100%`, `150%` e zoom com `Ctrl/Cmd +`/`-` ou roda com modifier. O ponto sob o cursor deve permanecer estável quando possível.

Implementação segura:

1. wrapper controla `zoom` e `pan`;
2. página A4 mantém uma caixa lógica fixa com aspect ratio 297:210;
3. overlay e DOM usam a mesma caixa física após escala;
4. conversão de pointer usa `page.getBoundingClientRect()` já escalado;
5. o spec continua em `%`, independente de zoom;
6. `Fit to selection` pode centralizar o viewport, mas não altera campos.

O exemplo oficial do Konva mostra a mesma regra para zoom relativo ao ponteiro: converter a posição do pointer para coordenada lógica antes de aplicar nova escala. Mesmo sem usar Konva, a matemática é aplicável.

### Limites da página

O cliente deve evitar que o handle saia da página, mas o servidor permanece autoritativo. Durante drag/resize:

- `x >= 0`, `y >= 0`;
- `width >= minWidth`, `height >= minHeight`;
- `x + width <= 100`, `y + height <= 100`;
- o cálculo deve usar o bounding box real, não a caixa do texto já recortado;
- valores de input devem ser normalizados depois de sair do campo, com erro inline enquanto inválidos;
- o usuário pode salvar sobreposição, mas não geometria fora da área imprimível.

Não tratar a borda do preview como prova de que o PDF caberá. O PDFKit continua medindo texto na emissão; o editor deve informar que altura de texto pode variar e, se possível, oferecer uma ação `Verificar PDF` antes da publicação.

## Sincronização com PDF

### O que pode ser compartilhado

- constantes A4 e percentuais;
- cálculo de frame (`x/y/width/height`);
- validação de limites, campos obrigatórios e tipos;
- ordem de campos/z-order;
- valores de exemplo e regras de visibilidade;
- nomes de fonte suportados e limites de tamanho.

### O que não deve ser assumido como idêntico

- métricas de Helvetica no browser versus PDFKit;
- quebra de linha e altura de texto;
- rasterização e quiet zone do QR em tamanhos pequenos;
- `object-cover`/`object-contain` do browser versus `document.image`/`fit` no PDF;
- CSS `overflow-hidden` versus erro de overflow no renderer.

### Contrato recomendado

1. O gesto produz `CertificateTemplateField` novo, nunca estilo CSS persistido.
2. A UI atualiza preview imediatamente e marca estado sujo.
3. Ao salvar, o servidor executa o mesmo parse/validação que já existe.
4. Ao publicar/emitir, o renderer PDFKit continua sendo a verificação final de overflow.
5. Um erro de `certificate_field_overflow:<field>` deve selecionar o campo, abrir `Posição` e apontar para `Altura`/`Tamanho` sem apagar as outras alterações.
6. Se a equipe quiser alta fidelidade antes da publicação, adicionar uma rota de renderização assíncrona do PDF de teste; não tentar replicar o motor PDF no browser.

## Arquitetura recomendada em detalhe

### Estado

Separar explicitamente:

- `templateSpec`: única fonte de verdade dos campos;
- `selectedField`: somente UI;
- `viewport`: `zoom`, `pan`, guias e snap;
- `interaction`: `idle`, `dragging`, `resizing`, `canceled`;
- `history`: snapshots compactos por gesto/edição, não por evento;
- `diagnostics`: overlap, overflow estimado, campos ocultos e erros do servidor.

### Camadas no preview

1. Arte de fundo, sem pointer events.
2. Conteúdo DOM dos campos, com `data-field`, `aria-hidden` quando a camada for apenas visual duplicada e `overflow` coerente com o diagnóstico.
3. Overlay de seleção com `pointer-events` apenas no campo ativo/handles; guidelines temporários em SVG ou pseudo-elementos.
4. Label/badge do campo selecionado fora da área imprimível, para não aparecer no PDF.

Não capturar todos os clicks da página em um overlay transparente: isso quebra seleção de links/inputs e cria dead zones. Hit areas devem ser criadas apenas quando o modo de edição estiver ativo.

### Sequência de um gesto

1. `pointerdown`: selecionar campo, guardar spec original e retângulo da página.
2. `pointermove`: calcular delta lógico, aplicar snap/clamp, desenhar preview transitório.
3. `pointerup`: converter para percentuais arredondados (por exemplo, 0,1%), atualizar estado e adicionar um único item ao histórico.
4. `pointercancel`/`Escape`: restaurar spec original.
5. `blur`/input numérico: validar e normalizar; não bloquear digitação parcial.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Texto HTML parece caber, PDFKit não cabe | Publicação/emissão falha ou layout muda | Diagnóstico de overflow; verificação PDF; renderer servidor como autoridade |
| Sobreposição torna clique ambíguo | Campo errado é movido | Lista de layers, badge de candidatos e comando `Próximo campo`; nunca depender só do z-index |
| Snap impede sobreposição intencional | Usuário perde controle | Toggle snap, `Alt` para suspender e input numérico exato |
| Resize muda proporção de QR/assinatura | QR ilegível ou assinatura distorcida | Lock ratio por tipo; limites mínimos; teste de impressão |
| Zoom altera conversão de pointer | Campos saltam ou saem da página | Usar `getBoundingClientRect()` da página escalada e coordenada lógica; testes em 50–200% |
| Pointer drag atualiza React a cada evento | Jank e histórico excessivo | Estado transitório/ref local durante gesto; commit em `pointerup`; `requestAnimationFrame` se necessário |
| Canvas puro perde semântica | Acessibilidade e testes ficam frágeis | Manter DOM/inspector como caminho principal; não usar canvas como única representação |
| Biblioteca genérica introduz features não desejadas | Rotação/warp/group quebram contrato | Desabilitar ables e mapear apenas drag/resize; cobrir por testes |
| Multiple selection sem regra de domínio | Geometria inesperada | Adiar grupo; começar com alinhamento seguro e uma operação de histórico |
| Handles recebem foco demais | Navegação por teclado cansativa | Inputs numéricos como caminho acessível; handles pointer-only ou roving controlado |

## Plano de implementação por fases

### Fase 0 — prova de conceito isolada

- protótipo somente no componente de preview com um campo de texto;
- selecionar, mover, resize lateral, clamp e conversão `%`;
- testes matemáticos em zoom 50%, 100% e 200%;
- validar que o spec gerado produz as mesmas coordenadas usadas no PDF.

### Fase 1 — DOM-first híbrida, sem biblioteca nova

- seleção por lista e por campo;
- overlay de seleção e drag de um campo;
- inputs `X/Y/W/H` no inspector;
- snap de centro/borda opcional;
- teclado por inputs, `Escape` e undo de gesto;
- sem múltipla seleção, rotação ou escala.

### Fase 2 — resize e qualidade do preview

- handles por tipo de campo;
- lock ratio para QR/assinatura;
- warnings de overflow estimado e links para campo;
- zoom/pan persistidos apenas no viewport;
- verificação de PDF de teste se a latência/infra permitirem.

### Fase 3 — biblioteca, se o custo justificar

- avaliar `interact.js` para modifiers/constraints ou Moveable para handles/guidelines;
- só adotar depois de comparar bundle, suporte a React 19/Next.js 16, touch e comportamento de foco;
- não migrar para Konva/Fabric sem uma decisão de produto que aceite uma nova renderer layer.

## Testes obrigatórios

### Matemática e estado

- pointer delta em A4 com zoom 50/100/150/200%;
- drag até cada borda e clamp sem valores negativos;
- resize de cada handle, largura/altura mínimas e `x+width/y+height` máximos;
- arredondamento não cria drift após 100 movimentos;
- `pointercancel`/Escape restaura snapshot original;
- histórico registra um gesto como uma operação.

### Interação

- seleção por lista, preview e teclado produz o mesmo `selectedField`;
- campos sobrepostos permitem escolher o campo correto pela lista/cycle;
- snap pode ser desativado e input numérico pode expressar qualquer posição válida;
- zoom/pan não altera spec;
- background não captura pointer events.

### Acessibilidade

- tab order sem atravessar handles invisíveis;
- labels, `aria-selected`, `aria-describedby` e status anunciados;
- inputs numéricos funcionam sem mouse;
- `Escape` cancela gesto;
- teste com leitor de tela e touch assistive technology;
- foco vai para o primeiro erro estrutural retornado pelo servidor.

### PDF e emissão

- cada campo movido gera PDF com frame esperado;
- texto longo continua gerando o erro de overflow correto;
- QR mantém quiet zone/tamanho mínimo e não é distorcido;
- assinatura mantém proporção;
- sobreposição permitida no save/publish e preservada no snapshot;
- reabrir o template não perde arredondamento nem ordem de campos.

## Recomendação final

Implementar primeiro uma experiência **DOM-first híbrida, single-select, com inspector e inputs numéricos**. A manipulação direta deve ser um acelerador do inspector, não a única forma de configurar o certificado. Snap, zoom e guides devem existir como estado temporário do viewport. Múltipla seleção, rotação, escala e canvas puro ficam fora do primeiro release porque não agregam valor proporcional aos 13 campos e aumentam a chance de divergência com PDFKit e acessibilidade.
