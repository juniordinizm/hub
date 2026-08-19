# Pesquisa: refinamento premium do editor visual de certificados

**Data:** 2026-08-08  
**Fuso:** America/Sao_Paulo  
**Escopo:** canvas/preview com inspector, visibilidade em lista/Sheet/Modal, controles de valor com `step` e intervalo, substituição de imagens já existentes, alinhamento vertical e separação semântica entre conteúdo e geometria.  
**Fontes:** documentação e ajuda primárias dos produtos ou projetos citados, consultadas em 2026-08-08. Nenhum artigo de terceiros foi usado como evidência.

## Resultado executivo

O destino mais consistente para o Hub é um application frame de três áreas no desktop:

1. lista de campos/layers à esquerda;
2. preview A4 selecionável no centro;
3. inspector contextual à direita.

Esse arranjo é uma convergência entre o painel de Layers + Properties da Figma, o application frame da Adobe Spectrum e o inspector de Size & Position do Google Slides. O canvas continua sendo contexto; a lista continua sendo o caminho confiável para campos ocultos ou sobrepostos; o inspector é o caminho preciso e acessível. Não é necessário transformar o certificado em um editor livre nem criar grupos persistidos.

No telefone, o inspector deve virar um `Sheet`/tray com uma única área de rolagem e cabeçalho/rodapé estáveis. Um `Dialog`/modal deve ficar reservado a decisões que interrompem o fluxo (remover ou substituir uma arte, restaurar alterações destrutivas, confirmar publicação). A edição rotineira de posição, tipografia e visibilidade não deve abrir um modal a cada clique.

Geometria deve ter inputs numéricos sempre visíveis e slider apenas como atalho. Cada coordenada deve mostrar valor, unidade, `min`, `max` e `step`, e ambos os controles devem alterar a mesma fonte de estado. Para o contrato atual, `x`, `y`, `width` e `height` continuam percentuais normalizados e limitados à área imprimível.

Conteúdo e geometria devem ser agrupados visualmente, não fundidos no modelo de dados: `Assinatura` reúne nome, cargo e upload como uma tarefa de conteúdo, mas `signerName`, `signerRole` e `signatureImage` continuam campos posicionáveis independentes. Uma eventual opção de alinhamento vertical de texto só é segura se o renderer PDFKit e o preview passarem a usar a mesma propriedade; não deve ser apenas um `align-items` no DOM.

## Estado do Hub que a pesquisa deve preservar

O worktree atual já contém a direção aprovada em `docs/superpowers/specs/2026-08-08-certificate-editor-direct-manipulation-design.md`:

- `CertificateTemplateSpec` é a única fonte persistida de geometria; `x`, `y`, `width` e `height` são percentuais normalizados.
- O preview segue DOM-first, com camada não impressa para seleção, arraste, teclado e guias. O PDFKit continua autoridade para quebra de linha, fontes, overflow e arquivo emitido.
- A primeira fase é de seleção única; sobreposição é aviso e não impede salvar/publicar; geometria fora da página é erro estrutural e deve ser limitada no cliente e validada no servidor.
- A lista/inspector atuais estão em `certificate-template-fields.tsx`; o preview e a camada de interação estão em `certificate-template-preview.tsx`.
- Os primitives locais já são baseados no pacote `radix-ui` (v1.6.0) e em componentes shadcn (`src/components/ui/sheet.tsx`, `dialog.tsx`, `slider.tsx`, `switch.tsx`, `tabs.tsx`, `field.tsx`). A pesquisa não recomenda adicionar Material ou outro kit.

As recomendações abaixo refinam essa direção e não alteram por si só o contrato do certificado.

## Evidência primária por referência

### Figma: layers fornecem seleção e visibilidade; Properties fornece precisão

A documentação da Figma descreve uma navegação à esquerda, canvas e painel de propriedades à direita. O painel muda conforme a layer selecionada e permite habilitar labels de propriedades para tornar cada controle explícito. A seleção pode vir do canvas ou do painel Layers; o nome da layer selecionada aparece no topo do Properties panel.

Fontes: [Properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel), [Layers panel](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-assets-in-the-Layers-Panel), [select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects).

Para visibilidade, a Figma documenta que uma layer oculta pode continuar sendo posicionada e ter propriedades ajustadas pelo Layers panel; a layer fica inativa, mas não desaparece da estrutura. No canvas, a layer oculta não é selecionável até ser reexibida.

Fonte: [Toggle visibility to hide layers](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers).

Para geometria, a Figma oferece campos `X` e `Y`, dimensões, nudge por setas e comandos de alinhamento como top, bottom, horizontal centers e vertical centers. O alinhamento de um único objeto é relativo ao parent; o de vários objetos é relativo à seleção ou ao frame. O snap a objetos/guias é uma ajuda visual, não uma mudança implícita de unidade.

Fonte: [Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position).

Para texto, a Figma separa alinhamento horizontal e vertical; top/middle/bottom só têm efeito em text layers com tamanho fixo. Isso é uma advertência importante para campos que podem crescer ou quebrar linhas.

Fonte: [Explore text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-Text-Properties).

Para imagens, o inspector mantém a imagem como fill e oferece Fill, Fit, Crop e Tile; crop é não destrutivo e o modo é preservado ao redimensionar a layer.

Fonte: [Adjust the properties of an image](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image).

Figma Groups e Frames combinam layers para que sejam tratadas como uma layer, com hierarquia aninhável. Esse é um bom modelo mental para explicar “camadas”, mas não é motivo para criar grupos arbitrários no template do Hub, que tem campos padronizados e regras de emissão.

Fonte: [Difference between frames and groups](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups).

**Aplicação ao Hub:** manter a seleção sincronizada entre preview e lista; permitir selecionar e editar campo oculto na lista; apresentar X/Y/dimensões como valores explícitos; oferecer alinhamento à página como ação que calcula geometria; tratar alinhamento vertical de texto como propriedade de renderer; separar “grupo visual Assinatura” de layers independentes.

### Adobe Spectrum: application frame, painéis persistentes e slider editável

O application frame do Spectrum define header persistente para navegação, modos e ações globais como undo/sync/share; sidebars e panels ficam nas laterais em desktop/tablet. Panels podem ser persistentes ou alternados, com larguras de referência de 304 px e 240 px. Em telefone, panels ocupam a parte inferior; trays são a alternativa para conteúdo transitório que seria grande demais para um popover.

Fonte: [Application frame](https://spectrum.adobe.com/page/application-frame/).

O Spectrum recomenda side navigation de nível simples para uma estrutura plana e permite cabeçalhos não interativos para categorias. A largura deve ser generosa, e a hierarquia não deve passar de três níveis.

Fonte: [Side navigation](https://spectrum.adobe.com/page/side-navigation/).

O slider do Spectrum exige label, descreve `value`, `min`, `max` e `step`, permite valor editável em text field ao lado e recomenda unidades no valor quando ajudam a leitura. O valor editável fica no lado do controle; ao focar o campo, a unidade pode desaparecer para facilitar a edição. Setas incrementam/decrementam o valor e há comportamento documentado de reset por duplo clique.

Fonte: [Slider](https://spectrum.adobe.com/page/slider/).

Text fields devem ter label persistente, help text para requisito/formato e error text que ajude a resolver o problema; placeholder não deve carregar instrução essencial. O Spectrum também define estados read-only e disabled sem apagar o contexto.

Fonte: [Text field](https://spectrum.adobe.com/page/text-field/).

**Aplicação ao Hub:** colocar Salvar/Publicar, Desfazer/Refazer e Restaurar no header do editor; usar largura estável para lista/inspector; no telefone, usar Sheet/tray com footer persistente; sempre mostrar valor percentual com label e unidade; usar `FieldDescription`/`FieldError` para limites e overflow em vez de tooltip ou placeholder.

### Material Web/Material 3: valor visível, passo explícito e diálogo com foco

O slider Material Web suporta valores contínuos, discretos e intervalo. `min`, `max`, `step`, `ticks` e `labeled` são propriedades explícitas; o label de valor aparece quando o handle está ativo. O componente também expõe `aria-valuetext` para unidades/contexto e eventos `input`/`change`.

Fonte: [Material Web sliders](https://material-web.dev/components/slider/).

Text fields Material têm label e supporting text; o supporting text pode ser substituído por error text quando a validação falha.

Fonte: [Material Web text field](https://material-web.dev/components/text-field/).

Dialog Material tem headline, content e actions opcionais; deve ser rotulado por headline ou `aria-label`, e `type="alert"` é reservado para alerta que exige resposta. A implementação mantém foco dentro do diálogo por padrão.

Fonte: [Material Web dialogs](https://material-web.dev/components/dialog/).

O próprio site informa que `@material/web` está em maintenance mode pendente de novos mantenedores. Logo, Material é referência de interação e acessibilidade nesta pesquisa, não uma dependência a introduzir no Hub.

Fonte: [Material Web](https://material-web.dev/).

**Aplicação ao Hub:** manter o slider como affordance de ajuste rápido, sempre acompanhado de input numérico; usar `aria-valuetext="42,5%"`; exibir ticks somente quando o passo for compreensível; usar Dialog para confirmação/alerta, não como inspector permanente; adotar labels/supporting text sem copiar o kit Material.

### Radix + shadcn: primitives locais já cobrem o comportamento necessário

O Radix Dialog define uma janela que torna o conteúdo subjacente inerte; suporta modo modal e não modal, focus trap no modo modal, anúncio por `Title`/`Description`, fechamento por Escape e retorno de foco ao trigger. Isso é adequado para confirmações e para um inspector móvel modal, desde que o trigger seja a linha/campo que abriu o painel.

Fonte: [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog).

O Radix Slider pode ser controlado ou não controlado, aceita `min`, `max`, `step`, múltiplos thumbs, toque/clique no track e navegação completa por teclado. A documentação inclui Arrow, PageUp/PageDown, Home e End; `onValueChange` serve para atualização contínua e `onValueCommit` para o fim do gesto.

Fonte: [Radix Slider](https://www.radix-ui.com/primitives/docs/components/slider).

Radix Tabs fornece tablist/tabpanels com orientação horizontal/vertical, ativação automática ou manual e navegação de teclado. Accordion fornece disclosure com Home/End e setas, mas manter vários painéis abertos ainda amplia a sequência de foco.

Fontes: [Radix Tabs](https://www.radix-ui.com/primitives/docs/components/tabs), [Radix Accordion](https://www.radix-ui.com/primitives/docs/components/accordion).

O shadcn `Sheet` é uma composição de Dialog para conteúdo complementar, com `side` top/right/bottom/left. A documentação oficial também demonstra footer fixo e content rolável para Dialog, além de composição explícita por Header/Title/Description/Footer.

Fontes: [shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet), [shadcn Dialog](https://ui.shadcn.com/docs/components/radix/dialog), [shadcn Slider](https://ui.shadcn.com/docs/components/radix/slider).

O Hub já usa exatamente esses primitives locais (`src/components/ui/sheet.tsx`, `dialog.tsx`, `slider.tsx`). Portanto, a decisão premium é de composição e contrato de estado, não de instalar outra biblioteca.

**Aplicação ao Hub:** `Sheet` no telefone para lista/inspector; `Dialog` apenas para confirmação e crop; `Slider` controlado pelo mesmo estado dos inputs; `Tabs` no máximo para grupos de intenção do campo selecionado; `Switch` com label completo e separado do botão que seleciona a linha.

### Canva: layers, upload existente e slider com campo editável

Em anúncio oficial de produto, o Canva descreve Layers como uma visão de todos os elementos (texto, formas, imagens e vídeo) para selecionar, reposicionar ou apagar, com indicação de elementos bloqueados, agrupados ou usados como background. É evidência de produto, não uma prescrição de acessibilidade; deve ser aplicada no Hub com labels e teclado próprios.

Fonte: [Canva: Edit easily with Layers](https://www.canva.com/newsroom/news/highly-requested-launches/).

O Help Center do Canva documenta que transparência usa slider e também aceita valor digitado no campo adjacente. Isso confirma o padrão “gesto rápido + entrada precisa” para propriedades visuais.

Fonte: [Adjust element transparency](https://www.canva.com/en_gb/help/transparency/).

O Help Center lista agrupar, mover, colocar em camadas, alinhar e bloquear como operações de elementos. Os atalhos oficiais incluem setas para nudge pequeno, Shift+setas para nudge grande, Group/Ungroup e alinhamento de texto.

Fontes: [Elements](https://www.canva.com/es_es/help/elements/), [Canva keyboard shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/).

O uploader oficial aceita upload ou drag-and-drop e informa formatos JPG, PNG e SVG; o Help Center separa upload do dispositivo, importação de arquivos e importação de outras fontes.

Fontes: [Canva image uploader](https://www.canva.com/features/image-upload/), [Uploading and importing](https://www.canva.com/en_gb/help/uploading-importing/).

**Aplicação ao Hub:** a lista de campos pode funcionar como uma camada compacta, mostrando `Oculto`, `Sobreposto` e imagem de assinatura disponível; sliders de estilo podem ter campo numérico vizinho; substituir a imagem deve ser uma ação explícita com preview e fallback seguro, não um input de arquivo perdido no fim do formulário.

### Google Slides: Size & Position, alinhamento de página e substituição

A ajuda oficial do Google Slides coloca Size & Position no painel lateral e documenta `Arrange > Align`, `Distribute`, `Center on page` horizontal/vertical, `Group` e `Order`. Ao arrastar, Snap to Guides e Snap to Grid mostram linhas ou uma grade invisível; isso é um bom padrão para guias transitórias do preview.

Fonte: [Insert and arrange objects](https://support.google.com/docs/answer/1696521?hl=en).

O Google Slides permite inserir imagem do computador, Drive/Photos, câmera, URL e outras fontes; permite Replace image mantendo o slot e drag-and-drop para substituir. A ajuda também expõe Size & Rotation, Position e Adjustments para imagem.

Fonte: [Insert or delete images & videos](https://support.google.com/docs/answer/97447?hl=en&ref_topic=1694924).

O Slides permite unidades de medida como polegadas, centímetros, pontos e pixels para página e objetos. O Hub deve continuar usando percentual normalizado para preservar o contrato de impressão, mas pode mostrar `%` de forma igualmente explícita.

Fonte: [Change slide size and measurement units](https://support.google.com/docs/answer/3447672?hl=en).

**Aplicação ao Hub:** oferecer ações `Centralizar na página` horizontal/vertical que escrevem `x`/`y` calculados; manter guias/snap transitórios; oferecer `Substituir imagem` preservando o slot `signatureImage`; não criar agrupamento persistido de campos para imitar o Slides.

## Comparação consolidada

| Referência | Canvas + inspector | Visibilidade | Valor/step/range | Imagem existente | Alinhamento e agrupamento | Decisão para o Hub |
| --- | --- | --- | --- | --- | --- | --- |
| Figma | Layers à esquerda e Properties contextual à direita; seleção pelo canvas ou lista | Layer oculta permanece editável via Layers | X/Y e dimensões exatos; nudges e snap | Fill/Fit/Crop/Tile e upload no fill | Alinha ao parent/seleção; Groups/Frames hierárquicos | Principal referência estrutural; não copiar grupos arbitrários |
| Adobe Spectrum | Application frame com header, sidebars e panels | Panel/layer pode ser persistente ou alternado | Label obrigatório; value/min/max/step e campo editável | Não usar como fonte de upload | Header global; tray para telefone | Referência de shell, densidade, labels e mobile |
| Material Web | Dialog e campos com conteúdo/ações bem definidos | Dialog torna fundo indisponível durante decisão | Slider contínuo/discreto/range, ticks, labeled, `aria-valuetext` | Não adicionar kit | Tabs/Dialog para conteúdo relacionado | Referência de comportamento; não instalar `@material/web` |
| Radix/shadcn | Primitives composáveis e acessíveis | Switch/Accordion/Sheet/Dialog com estado anunciado | Slider controlado, `onValueChange`/`onValueCommit`, teclado completo | Compor com input local | Sheet é Dialog; Tabs/Fieldset para intenção | Continuar usando os primitives locais |
| Canva | Layers oferece visão de elementos e seleção rápida | Layers mostra oculto/bloqueado/agrupado | Slider acompanhado de campo editável | Upload e drag/drop de dispositivo | Group, align, nudge e layers | Referência de affordances; validar acessibilidade no Hub |
| Google Slides | Preview + painel Size & Position | Camadas/ordem no menu Arrange | Valores de posição e unidades | Insert/Replace/drag-drop | Align, distribute, center page, group, snap | Referência para ações de alinhamento e replace |

## Recomendações concretas

### 1. Shell desktop: três áreas, uma seleção

Manter `CertificateTemplatePreview` como área central e dividir o painel de edição em:

- **Campos:** uma linha por `CertificateField`, label humano, ícone/tipo opcional, badge textual de `Oculto`/`Sobreposto` e switch de visibilidade.
- **Preview:** overlay não impressa e seleção única. O outline selecionado deve ter label textual além da cor.
- **Inspector:** somente propriedades do campo selecionado, com header `Campo: Nome da aluna`, estado de visibilidade e diagnóstico.

Não abrir 13 accordions. Se disclosure for necessário dentro do inspector, usar grupos de intenção (`Conteúdo`, `Geometria`, `Aparência`, `Diagnóstico`) e manter um único tablist por campo. A linha inteira seleciona; o switch é a única ação adicional e tem label próprio.

Actions `Salvar rascunho`, `Publicar`, `Desfazer`, `Refazer` e `Restaurar` devem ficar em barra persistente do editor. Isso segue o header global do Spectrum e evita que o operador procure ações dentro do preview.

### 2. Responsividade: Sheet para tarefa, Dialog para interrupção

No telefone/laptop estreito:

- usar `Sheet side="bottom"` para inspector/lista, com `SheetHeader` contendo nome do campo, `SheetContent`/`ScrollArea` com uma única rolagem e `SheetFooter` com ações persistentes;
- manter a seleção e os valores sincronizados enquanto o Sheet está aberto; fechar não deve descartar alterações locais;
- retornar foco para o botão da linha ou para o botão que abriu o inspector (`onCloseAutoFocus`), anunciar título e descrição;
- manter a lista de visibilidade acessível dentro do Sheet: campo oculto continua selecionável e editável, mesmo sem overlay no canvas;
- reservar `Dialog`/`AlertDialog` para remover imagem, substituir upload pendente, restaurar geometria/estilo e confirmar publicação destrutiva.

O fundo deve ficar inerte enquanto um Dialog modal estiver aberto, conforme Radix. Não usar modal para cada ajuste de posição: a perda do canvas como contexto seria maior que o benefício.

### 3. Slider + valor: contrato único e preciso

Para cada campo selecionado, expor uma grade de quatro valores:

| Propriedade | Intervalo | Passo sugerido | Unidade visual |
| --- | --- | --- | --- |
| `X` | `0` a `100 - width` | `0,1` para input; nudge/slider pode usar `0,5` | `%` |
| `Y` | `0` a `100 - height` | `0,1` para input; nudge/slider pode usar `0,5` | `%` |
| `Largura` | `1` a `100 - x` | `0,1` | `%` |
| `Altura` | `1` a `100 - y` | `0,1` | `%` |

Os limites dependentes devem ser recalculados depois de qualquer alteração de posição ou tamanho. O input é a rota precisa; slider/arraste é atalho. Não criar uma segunda representação arredondada.

Requisitos de cada slider:

- label persistente (`X do campo`, não apenas `X`);
- `min`, `max`, `step`, valor visível e unidade; `aria-valuetext` com a unidade;
- `onValueChange` atualiza preview em tempo real; `onValueCommit` cria no máximo uma entrada de undo por gesto;
- Arrow usa passo pequeno, Shift/PageUp/PageDown passo grande, Home/End limites; Escape cancela apenas gesto ativo;
- campos QR e imagem não exibem controles de tipografia sem efeito;
- mensagens de limite/overflow ficam junto ao campo e no diagnóstico, não apenas em toast.

Esse desenho combina o valor editável do Spectrum, `step`/`labeled`/`aria-valuetext` do Material e o teclado do Radix, sem mudar `CertificateTemplateSpec`.

### 4. Upload e substituição de imagem já existente

Para `background` e `signatureImage`, usar um bloco de imagem com:

- thumbnail/preview atual;
- estado “Nenhuma imagem” quando ausente;
- botão `Substituir imagem` (file picker e drag/drop opcional);
- botão `Remover imagem` separado e confirmável;
- nome, tipo e estado de upload quando disponíveis;
- crop/fit para background e `object-contain` para assinatura;
- erro de validação junto ao bloco.

O fluxo deve preservar o objeto publicado até o novo upload staged concluir. Se o upload falhar, o preview e a key anterior continuam; se concluir, o preview usa object URL local e o formulário envia a referência staged. Revogar object URLs ao trocar/remover evita vazamento. Uma substituição não deve limpar `signerName`, `signerRole` ou os valores de geometria.

`Assinatura` é o grupo de conteúdo para nome, cargo e upload, mas `signerName`, `signerRole` e `signatureImage` continuam linhas distintas na lista e retângulos distintos no preview. `background` pertence ao grupo `Documento`, não ao inspector de texto.

### 5. Alinhamento vertical: separar texto, caixa e página

Há três operações diferentes que não devem compartilhar o mesmo select:

1. **Alinhamento de texto na caixa:** left/center/right (atual) e, se aprovado, top/middle/bottom.
2. **Alinhamento da caixa na página:** centralizar horizontal/vertical altera `x`/`y` para `(100 - size) / 2` e respeita clamp.
3. **Posição livre:** input, drag e nudge alteram `x`/`y` diretamente.

Se `verticalAlign` for necessário, adicionar uma propriedade explícita a `CertificateTemplateField`, atualizar preview e PDFKit, validar defaults e cobrir quebra de linha. Não usar CSS visual que o PDF não reproduza. Para QR e imagens, oferecer apenas alinhamento da caixa/posição, não controles de texto.

O botão `Centralizar na página` pode ser entregue sem nova propriedade: ele apenas calcula geometria. Uma futura ação `Alinhar ao campo selecionado` exigiria seleção múltipla, que permanece fora da primeira fase.

### 6. Agrupar conteúdo vs. geometria sem criar grupos persistidos

Usar `<fieldset>`/`<legend>` e divisores para deixar a intenção explícita:

- **Conteúdo:** valores editáveis de assinatura; texto de exemplo apenas no preview.
- **Geometria:** X, Y, largura, altura, centralizar e reset de posição.
- **Aparência:** fonte, tamanho, cor, alinhamento horizontal/vertical apenas para texto.
- **Visibilidade e diagnóstico:** switch, `Oculto`, `Sobreposto`, `Fora da área`.
- **Documento:** arte A4, crop, remoção e estado da imagem de fundo.

Não persistir um `groupId` só para organizar o inspector. Grupos de Figma/Slides mudam seleção, bounds e ordem; no Hub isso poderia alterar emissão, hit-testing e validação sem decisão de domínio. A hierarquia visual é suficiente até existir requisito real de seleção múltipla.

### 7. Estados premium e acessibilidade que valem o investimento

- seleção por canvas e por lista sempre sincronizada;
- campos ocultos selecionáveis na lista com estado textual, nunca apenas olho/cor;
- overlap como warning clicável que identifica os dois campos; out-of-bounds como erro bloqueante;
- foco visível na linha, overlay e inputs; `aria-live` para upload/salvamento;
- botão de salvar preserva label durante loading (`Salvando…`, `Publicando…`), sem trocar apenas por ícone;
- aviso de alterações não salvas antes de sair, já existente no formulário;
- `prefers-reduced-motion` para abertura de Sheet/Dialog e feedback de arraste;
- testes de teclado para lista, switch, inputs, slider, Escape, undo e retorno de foco;
- teste de zoom e viewport estreita sem dois scroll containers concorrentes.

## Sequência de entrega sugerida

### Fase A — composição sem mudança de contrato

- consolidar app frame desktop e barra global;
- manter lista compacta + inspector de um campo;
- mover inspector/lista para Sheet no mobile;
- substituir accordions abertos simultaneamente por fieldsets ou tabs de intenção;
- manter geometria numérica e slider no mesmo caminho de estado;
- tornar `Oculto`, `Sobreposto` e estado de upload textuais e acionáveis.

### Fase B — affordances de edição

- adicionar `Centralizar na página` horizontal/vertical;
- adicionar reset de posição/estilo com undo;
- melhorar replace/crop/fit de imagens mantendo staged upload e objeto anterior até sucesso;
- adicionar guias/snap transitórios, sem persistir zoom, pixels ou guias.

### Fase C — somente se aprovado pelo domínio

- persistir `verticalAlign` para texto e alinhar o renderer PDFKit;
- considerar seleção múltipla e alinhamento/distribuição de campos;
- criar grupos persistidos apenas com regra de emissão, bounds, ordem e testes definidos.

## Critérios de aceite para uma revisão premium

- Qualquer campo, inclusive oculto, é localizado e editado pela lista sem abrir mais de um inspector.
- O preview selecionado e a linha da lista anunciam o mesmo campo.
- X/Y/largura/altura têm unidade, valor, min/max, step e caminho de input por teclado; slider e drag não criam divergência.
- Um Sheet móvel não perde contexto nem cria segunda rolagem; Dialog aparece somente em confirmação/interrupção.
- Substituir uma imagem não destrói a imagem publicada se o upload falhar e não limpa metadados de assinatura.
- Centralização vertical/horizontal da caixa respeita clamp e continua compatível com PDFKit.
- Alinhamento vertical de texto, se entregue, é renderizado no preview e no PDF e é testado com quebra de linha.
- Conteúdo, geometria, aparência e diagnóstico têm labels semânticos e não repetem controles sem efeito.
- Sobreposição permanece aviso; geometria fora da página permanece erro estrutural; regras de emissão continuam no servidor.

## Índice de fontes primárias

- Figma: [Properties panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel), [Layers panel](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-assets-in-the-Layers-Panel), [visibility](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers), [position/alignment](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position), [text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-Text-Properties), [image properties](https://help.figma.com/hc/en-us/articles/360041098433-Adjust-the-properties-of-an-image), [groups/frames](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups).
- Adobe Spectrum: [Application frame](https://spectrum.adobe.com/page/application-frame/), [Side navigation](https://spectrum.adobe.com/page/side-navigation/), [Slider](https://spectrum.adobe.com/page/slider/), [Text field](https://spectrum.adobe.com/page/text-field/), [Tray](https://spectrum.adobe.com/page/tray/).
- Material Web: [Sliders](https://material-web.dev/components/slider/), [Text field](https://material-web.dev/components/text-field/), [Dialogs](https://material-web.dev/components/dialog/), [project status](https://material-web.dev/).
- Radix/shadcn: [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Radix Slider](https://www.radix-ui.com/primitives/docs/components/slider), [Radix Tabs](https://www.radix-ui.com/primitives/docs/components/tabs), [Radix Accordion](https://www.radix-ui.com/primitives/docs/components/accordion), [shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet), [shadcn Dialog](https://ui.shadcn.com/docs/components/radix/dialog), [shadcn Slider](https://ui.shadcn.com/docs/components/radix/slider).
- Canva: [Layers announcement](https://www.canva.com/newsroom/news/highly-requested-launches/), [transparency](https://www.canva.com/en_gb/help/transparency/), [elements](https://www.canva.com/es_es/help/elements/), [keyboard shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/), [image uploader](https://www.canva.com/features/image-upload/), [uploading/importing](https://www.canva.com/en_gb/help/uploading-importing/).
- Google Slides: [Arrange/align/Size & Position](https://support.google.com/docs/answer/1696521?hl=en), [insert/replace images](https://support.google.com/docs/answer/97447?hl=en&ref_topic=1694924), [measurement units](https://support.google.com/docs/answer/3447672?hl=en).

**Limite:** Figma, Canva e Google Slides são produtos criativos completos. A evidência sustenta padrões de organização e interação; não autoriza adicionar campos arbitrários, pixels persistidos, seleção múltipla ou mudanças no lifecycle de certificados.
