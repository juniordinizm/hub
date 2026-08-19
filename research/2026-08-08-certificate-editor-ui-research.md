# Pesquisa de UX/UI para o editor de certificado

**Data:** 2026-08-08  
**Fuso:** America/Sao_Paulo  
**Escopo:** pesquisa de padrões de editores visuais e formulários densos para orientar uma futura evolução do editor de template de certificado do Hub. As referências externas são documentação, especificações ou repositórios mantidos pelos próprios projetos. Este arquivo não altera o contrato do domínio e não é uma decisão de implementação.

## Conclusão executiva

O editor atual já tem a separação correta entre preview e configurações, mas a unidade de interação é pequena demais: cada um dos 13 campos padronizados é um acordeão que abre 8 controles (4 sliders de geometria, tamanho, cor, alinhamento e fonte). O resultado é um painel longo, com muitas paradas de teclado e pouco contexto sobre qual campo está sendo editado. O campo `signerName` ainda concentra nome, cargo e imagem de assinatura, enquanto `signerRole` aparece como outro item, sem um segundo conjunto de valores. Isso torna a estrutura difícil de entender, apesar de cada controle isolado funcionar.

O padrão mais forte encontrado em editores profissionais é **canvas + seleção + inspector**:

1. O canvas continua sempre visível e vira a fonte de contexto.
2. Uma lista compacta de campos/layers mostra visibilidade, estado e avisos.
3. Um único inspector mostra as propriedades do item selecionado, agrupadas por intenção (conteúdo, posição, tipografia e avançado).
4. Posição usa entrada numérica para precisão e slider/drag para ajuste rápido; ambos representam o mesmo valor.
5. Ações globais (desfazer, refazer, restaurar, salvar e publicar) ficam em uma barra persistente, não dentro do cabeçalho do preview.

Essa direção é mais próxima do modelo de propriedades da Figma e do application frame da Adobe do que de uma sequência de acordeões. Não exige transformar o certificado em um editor livre: os campos continuam padronizados e as regras de domínio continuam sendo a autoridade. A recomendação é migrar em duas fases, começando por seleção/lista/inspector e controles numéricos, antes de adicionar arrastar/redimensionar diretamente no canvas.

## Evidência do estado atual

Os achados abaixo são baseados no código atual, não em uma captura visual:

- [`certificate-template-fields.tsx`](../src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx#L43-L171) repete quatro sliders de geometria e quatro controles de estilo para cada campo.
- O mesmo arquivo usa uma chave de `Accordion` para cada campo e permite vários itens abertos ao mesmo tempo (`type="multiple"`, linhas 293–304). O usuário pode, portanto, deixar vários grupos extensos abertos simultaneamente.
- O cabeçalho de cada item tem dois destinos de interação: `Switch` para visibilidade e `Accordion.Trigger` para abrir propriedades (linhas 197–218). Isso aumenta a quantidade de focos e exige que o usuário saiba qual parte da linha faz o quê.
- `signerName` contém nome, cargo e upload da assinatura (linhas 226–268); o campo `signerRole` continua sendo renderizado como item da lista. O modelo visual não comunica que nome e cargo são valores de uma mesma assinatura.
- [`certificate-template-form.tsx`](../src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx#L473-L560) coloca preview e configurações em duas colunas e cria uma área de configurações com altura mínima de 600 px e scroll próprio (linhas 552–604). Em telas menores, a rolagem interna e a rolagem da página podem competir.
- O preview já sabe quais campos estão sobrepostos e marca os campos com `ring`/`data-overlap` em [`certificate-template-preview.tsx`](../src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx#L109-L155), mas ainda não há seleção de um campo a partir do canvas nem vínculo explícito entre um marcador e o painel de propriedades.

Esses pontos são problemas de organização e custo de interação, não uma crítica às regras de certificado. A quantidade de controles é consequência do modelo padronizado; o objetivo é expor a mesma capacidade com menos troca de contexto.

## O que os projetos de referência fazem

### Figma: canvas, lista de layers e properties panel

A documentação oficial da Figma descreve quatro áreas separadas: painel de navegação, toolbar, canvas rolável e properties panel. O painel de propriedades muda com a seleção e consolida os controles de alinhamento, posição, tamanho, texto, preenchimento, efeitos e exportação em um só lugar. A Figma também oferece abas `Design` e `Prototype`, labels de propriedades opcionais, minimização dos painéis e largura ajustável.

Fontes:

- [Design, prototype, and view code in the Properties Panel](https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel)
- [View layers and pages in the Layers Panel](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-Layers-Panel)
- [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties)

Implicações para o Hub:

- Uma lista compacta de campos deve representar a estrutura do certificado; a seleção deve dirigir o inspector.
- O inspector deve mostrar somente propriedades do campo selecionado, e não todas as propriedades de todos os campos ao mesmo tempo.
- Labels e agrupamentos explícitos são preferíveis a uma lista de sliders sem contexto. A Figma inclusive oferece uma opção de labels de propriedades para tornar o painel mais compreensível.
- Um canvas clicável é uma melhoria de alto valor: selecionar o texto ou QR no preview deve abrir o campo correspondente e rolar o inspector até ele.
- Minimizar o painel pode ser útil para conferir a arte em tamanho maior, mas deve existir um botão claro para retornar às propriedades.

### Adobe Spectrum: application frame, modos e disclosure

O Spectrum modela aplicações criativas como um application frame: header persistente para ações globais, sidebar para ferramentas e ações, e panels para conteúdo contextual. A documentação recomenda sidebar em desktop/tablet e uma alternativa para telefone. Também recomenda agrupar ações relacionadas e manter ações globais (por exemplo, sincronização e desfazer) visíveis no header.

O Spectrum alerta que tabs devem conter conteúdo no mesmo nível hierárquico e que tabs aninhadas devem ser evitadas; quando há hierarquia ou progressive disclosure, side navigation, acordeões ou painéis colapsáveis são alternativas melhores. Side navigation deve ter largura suficiente e não deve ultrapassar três níveis.

Fontes:

- [Application frame](https://spectrum.adobe.com/page/application-frame/)
- [Tabs](https://spectrum.adobe.com/page/tabs/)
- [Side navigation](https://spectrum.adobe.com/page/side-navigation/)
- [Action bar](https://spectrum.adobe.com/page/action-bar/)
- [Form errors](https://spectrum.adobe.com/page/form-errors/)

Implicações para o Hub:

- Salvar/publicar, desfazer/refazer e restaurar devem viver em uma barra de ações do editor, com posição estável, e não misturados ao título do preview.
- `Conteúdo`, `Posição` e `Estilo` podem ser abas/segmentos no inspector porque são grupos do mesmo item; não criar abas para cada campo nem abas dentro de abas.
- No mobile, o inspector deve virar drawer/tray ou uma seção abaixo do canvas, em vez de manter duas áreas com scroll independente.
- Um resumo de erros/avisos no topo do inspector pode agregar problemas e manter o erro próximo ao grupo que precisa de correção. A sobreposição intencional deve permanecer como aviso, não erro bloqueante.

### Material Design/Web: slider com valor, campo numérico e tabs semânticas

O Material Web documenta que sliders são adequados para selecionar um valor em uma escala contínua, discreta ou de intervalo. O componente suporta `step`, marcas (`ticks`) e labels de valor que aparecem quando o controle está ativo. Para edição de layout, isso significa que o slider é bom para ajuste rápido, mas não deve ser o único mecanismo para digitar uma coordenada exata.

Os text fields do Material têm label persistente, supporting text e error text. Os tabs agrupam conteúdo no mesmo nível, e cada tab deve apontar para um `tabpanel` com relação acessível explícita.

Fontes:

- [Material Web — Sliders](https://material-web.dev/components/slider/)
- [Material Web — Tabs](https://material-web.dev/components/tabs/)
- [Material Web — Text fields](https://github.com/material-components/material-web/blob/main/docs/components/text-field.md)

Implicações para o Hub:

- Posição deve ser um grid de quatro campos numéricos (`X`, `Y`, `Largura`, `Altura`) com `%` visível e limites claros. O slider pode permanecer como affordance secundária ou surgir ao focar o campo.
- Use incremento coerente (por exemplo, 1% para teclado e 0,1% quando houver necessidade de precisão) e um botão de restauração do grupo.
- Labels de valor devem atualizar junto com o slider e estar disponíveis para leitor de tela por `aria-valuetext` quando a unidade ou o contexto não forem óbvios.
- Cor, fonte e tamanho devem mostrar supporting text curto; erros de formato devem aparecer no próprio campo, não apenas como um alerta distante do preview.
- Tabs só devem ser usadas para os grupos do campo selecionado. Não usar tabs como substituto de fluxo ou para esconder todos os 13 campos em uma segunda camada.

### Radix Primitives: comportamento acessível dos primitives

Radix define Accordion como uma pilha vertical de headings que revela conteúdo associado. Ele oferece navegação de teclado, modo single/multiple e `collapsible`. O Slider segue o padrão WAI-ARIA e suporta setas, `Home`, `End` e passos maiores. Tabs usa roving focus, `role="tab"`, `aria-selected` e `aria-controls`.

Fontes:

- [Accordion](https://www.radix-ui.com/primitives/docs/components/accordion)
- [Slider](https://www.radix-ui.com/primitives/docs/components/slider)
- [Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)
- [Radix Primitives introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)

Implicações para o Hub:

- Se o acordeão for mantido como solução intermediária, usar `type="single"` e `collapsible` reduz a quantidade de conteúdo aberto e preserva o modelo de teclado. O cabeçalho deve ter uma única ação de seleção/abertura; o switch de visibilidade pode ser separado, com label próprio e estado anunciado.
- Se tabs forem adotadas no inspector, manter um único tablist por campo, com ativação e foco consistentes. O estado selecionado não pode depender apenas de cor.
- O slider deve coexistir com um input numérico ou com uma operação de drag precisa; a API acessível do slider não elimina a necessidade de um modo de entrada alternativo.

### Apple Human Interface Guidelines: painel e controle direto

As diretrizes da Apple para panels descrevem painéis como superfícies de informação contextual e recomendam referir-se a eles pelo título. A mesma página cita sliders e steppers como controles para oferecer controle direto. A página de layout descreve o uso de sidebar/inspector ao lado do conteúdo.

Fontes:

- [Panels](https://developer.apple.com/design/human-interface-guidelines/panels)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders)
- [Steppers](https://developer.apple.com/design/human-interface-guidelines/steppers)

As páginas atuais da Apple carregam parte do conteúdo via JavaScript; as recomendações acima são as descritas nos próprios títulos e trechos oficiais indexados. A aplicação prática é independente de adotar visual Apple: um inspector nomeado, valores ajustáveis diretamente e agrupamento por contexto são padrões generalizáveis.

### W3C APG/WAI: disclosure, tabs, sliders e formulários

O W3C define accordion como uma pilha de headings interativos que reduz rolagem, mas observa que todos os controles dos painéis continuam na sequência de `Tab`. Também recomenda evitar excesso de landmarks `region` quando muitos painéis podem ficar abertos. O padrão de slider exige `aria-valuenow`, limites, label e, quando necessário, `aria-valuetext`; ele alerta que alguns usuários de tecnologia assistiva por toque podem ter dificuldade com sliders. O tutorial de formulários recomenda labels explícitos, `fieldset`/`legend`, instruções e mensagens junto aos campos.

Fontes:

- [Accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- [Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [Slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [Forms tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [Labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- [Form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/)

Implicações para o Hub:

- Treze acordeões com oito controles cada criam uma sequência de teclado longa mesmo quando visualmente fechados; selecionar um único campo reduz essa carga.
- Toda propriedade precisa de label visível ou associação programática. Warnings de sobreposição devem identificar os campos e ser vinculados ao grupo relevante, não depender somente de um anel colorido no canvas.
- O plano deve testar teclado e tecnologia assistiva antes de considerar o novo editor pronto, principalmente se houver drag/resize.

### Vercel Web Interface Guidelines: qualidade operacional da interface

As diretrizes oficiais da Vercel recomendam teclado em todos os fluxos, foco visível, `aria-live` para atualizações assíncronas, rótulos em todos os controles, erro junto ao campo e foco no primeiro erro, proteção para alterações não salvas, estados de carregamento com label original e reticências, responsividade em mobile/laptop/ultrawide, e persistência de estado de tabs/painéis quando apropriado.

Fonte:

- [Web Interface Guidelines — command.md](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)

Aplicação direta:

- Não esconder a única indicação do campo selecionado em uma cor; use label, outline, badge ou texto.
- Se a aba/seleção for estado de navegação importante, considerar query/hash ou restaurar a última seleção no retorno à página.
- Manter o botão de salvar habilitado até o início da submissão; bloquear apenas durante a requisição.
- Usar `Salvando…`/`Publicando…`, anunciar sucesso/erro com `aria-live` e preservar o texto da ação.
- Usar `beforeunload`/guard de navegação para dados não salvos, já que o editor possui estado local e upload temporário.
- Verificar a experiência em viewport pequena e ultrawide; não transformar o painel de configurações em um segundo scroll permanente no celular.

## Alternativas de layout

### Opção A — canvas + lista de campos + inspector (recomendada)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Certificado  • Rascunho   Desfazer  Refazer  Restaurar  Salvar  Publicar │
├───────────────┬───────────────────────────────────┬─────────────────┤
│ Campos        │ Preview A4                        │ Propriedades    │
│               │                                   │ Campo: Nome     │
│ ✓ Nome aluno  │   [campo selecionado]            │ Conteúdo        │
│ ✓ Curso       │   [overlap / limites]            │ Posição         │
│ · Data        │                                   │ Tipografia      │
│ ⚠ Assinatura  │                                   │ Avançado        │
└───────────────┴───────────────────────────────────┴─────────────────┘
```

**Como funciona:** o campo pode ser escolhido na lista ou clicando no preview. A lista mostra visibilidade, campo selecionado, avisos e, se necessário, estado vazio. O inspector trabalha em um campo por vez.

**Vantagens:** menor densidade, contexto permanente, caminho claro para selecionar, boa correspondência com Figma/Adobe e preparação para drag/resize.

**Riscos:** exige estado de seleção e mapeamento preview → campo; no mobile o inspector precisa virar drawer ou seção abaixo do canvas.

### Opção B — seções de intenção em um único inspector

Manter a coluna de configurações, mas substituir os 13 acordeões por:

- seletor compacto `Campo: Nome do aluno`;
- grupos colapsáveis `Conteúdo`, `Posição`, `Tipografia`, `Visibilidade`;
- grid de inputs para `X`, `Y`, `Largura`, `Altura`;
- sliders opcionais apenas para ajustes finos;
- `Restaurar posição` e `Restaurar estilo` por grupo.

**Vantagens:** menor risco de implementação; preserva o preview atual e reduz drasticamente a rolagem.

**Riscos:** a seleção não fica visível como estrutura; o usuário precisa abrir o seletor para trocar de campo e não consegue descobrir a relação espacial tão rapidamente quanto na Opção A.

### Opção C — lista/tabela de campos + popover rápido

Exibir uma tabela compacta com campo, visibilidade, resumo de posição e warning. Ao selecionar uma linha, um popover ou drawer oferece controles. O preview permanece maior.

**Vantagens:** eficiente para operadores que editam muitos campos; permite mostrar status e valores resumidos.

**Riscos:** popover grande vira um segundo acordeão; menos adequado para explicar a relação visual entre elemento e certificado; exige foco e posicionamento cuidadosos.

### Escolha recomendada

Adotar a Opção A como destino e entregar a Opção B como primeiro incremento se o escopo exigir menor risco. A Opção C pode ser um modo avançado posterior, não a interface padrão.

## Estrutura recomendada do inspector

Para o campo selecionado:

1. **Cabeçalho do campo**
   - nome humano (`Nome da aluna`, `QR de validação`);
   - switch `Exibir campo` com label completo;
   - badge `2 avisos`/`Fora da página` quando aplicável;
   - ação `Restaurar campo` com confirmação/undo quando houver perda de alterações.
2. **Conteúdo**
   - somente para propriedades editáveis do campo (por exemplo, nome/cargo da assinatura);
   - descrição curta sobre de onde o valor será obtido na emissão;
   - upload da assinatura sob uma seção `Assinatura`, não dentro de um item chamado apenas `Nome`.
3. **Posição**
   - `X`, `Y`, `Largura`, `Altura` em uma grade de inputs numéricos com `%`;
   - slider/drag como atalho, com `Home`/`End`, passos previsíveis e `aria-valuetext`;
   - botões `Restaurar posição` e, se houver, `Alinhar ao centro`/`Ajustar à largura`.
4. **Tipografia**
   - fonte, tamanho, alinhamento e cor;
   - presets de estilo quando vários campos usarem a mesma configuração;
   - controles avançados escondidos apenas quando não fizerem sentido para o tipo de campo.
5. **Diagnóstico**
   - sobreposição como aviso não bloqueante;
   - overflow/limite como erro bloqueante;
   - links/botões que selecionam o outro campo envolvido e levam o foco ao respectivo item.

Para a lista de campos:

- uma linha por campo, sem abrir oito controles;
- nome + preview de valor ou tipo (texto, QR, imagem);
- switch de visibilidade;
- indicador textual de warning/erro, não apenas cor;
- seleção única, com `aria-current`/estado acessível;
- pesquisa só se a quantidade de campos crescer; hoje 13 itens cabem em uma lista curta.

## Controles que devem ser reduzidos ou reagrupados

- **Quatro sliders sempre expostos:** trocar por quatro inputs numéricos e um modo de ajuste por slider/drag. Sliders sozinhos são lentos para valores exatos e difíceis de revisar.
- **Switch + trigger no mesmo cabeçalho:** transformar a linha em um item selecionável com switch trailing; o item inteiro seleciona, e não existem duas áreas ambíguas para abrir/fechar.
- **Nome, cargo e assinatura separados:** modelar visualmente como um único grupo `Assinatura`; manter `signerRole` como campo de layout apenas se ele continuar sendo uma caixa independente no canvas.
- **Fonte/alinhamento/cor repetidos em todos os itens:** exibir somente no inspector do campo ativo e oferecer presets quando o produto quiser consistência entre campos.
- **Ações do preview misturadas ao conteúdo:** mover salvar/publicar, undo/redo e reset para a barra global do editor; deixar `Dados longos/curtos` como menu de preview ou controle secundário.
- **Configuração de arte fora de uma hierarquia clara:** agrupar arte A4, assinatura e dados em seções de documento, ou manter arte em um painel `Documento` separado do inspector de campos.

## Fluxo de interação proposto

1. Usuário abre o editor e vê preview + lista de campos; o primeiro campo selecionável recebe foco apenas se isso não roubar foco de uma tarefa em andamento.
2. Usuário clica em `Nome da aluna` na lista ou no canvas.
3. O campo recebe outline/handles no canvas; a lista mostra `Selecionado`; o inspector abre a seção relevante.
4. Usuário altera `X` pelo input para precisão ou arrasta o handle/slider para ajuste rápido. Ambos atualizam a mesma fonte de estado.
5. O sistema recalcula warnings imediatamente, com texto e marcação visual. Sobreposição não impede salvar/publicar.
6. `Restaurar posição` restaura somente geometria; `Restaurar estilo` restaura somente tipografia. Se a ação for destrutiva, oferecer `Desfazer`/janela de undo.
7. `Salvar rascunho` aparece sempre na barra; `Publicar` mantém os pré-requisitos de negócio, mas não bloqueia por sobreposição intencional.
8. Ao sair com alterações locais, a aplicação avisa. Depois de sucesso, remove o estado sujo e mantém a seleção se a atualização da página permitir.

## Responsividade

- **Desktop largo:** canvas central, lista estreita à esquerda e inspector à direita; ambos com largura ajustável ou tokens fixos, sem min-height arbitrária que force scroll duplo.
- **Laptop:** ocultar a lista em um drawer ou combinar lista + inspector em uma coluna; manter o canvas com largura mínima suficiente para ler o certificado.
- **Mobile/tablet estreito:** canvas no topo, barra de ações compacta, lista como select/drawer e inspector em sheet/tray abaixo. Não renderizar dois scroll containers concorrentes.
- **Zoom:** permitir reduzir/expandir o canvas sem alterar valores do template; respeitar zoom do navegador.
- **Acessibilidade:** alvo de toque mínimo, foco visível, labels persistentes, ordem de foco previsível e suporte completo a teclado antes de adicionar drag/resize.

## Plano de entrega incremental

### Fase 1 — redução de densidade, baixo risco

- criar estado de campo selecionado;
- trocar múltiplos acordeões por lista compacta + inspector de um campo;
- separar `Assinatura` de `Nome`/`Cargo` na hierarquia visual;
- substituir geometria somente por sliders por grid de inputs numéricos + sliders opcionais;
- adicionar reset por grupo, status textual de warning e foco no primeiro erro;
- mover ações para uma barra persistente do editor;
- preservar o contrato de `CertificateTemplateField` e as regras existentes.

### Fase 2 — manipulação direta e eficiência

- clicar/selecionar campos no preview;
- arrastar/redimensionar com handles, snap opcional e limites visíveis;
- undo/redo com histórico local limitado e atalhos `Ctrl/Cmd + Z`;
- presets tipográficos e alinhamentos;
- persistir/restaurar seleção e seção no retorno ao editor quando isso for compatível com o fluxo.

### Fase 3 — polimento e operação

- drawer/responsive layout dedicado para mobile;
- teste com teclado, leitor de tela e touch assistive technology;
- telemetria de campos alterados, resets e warnings (sem registrar dados pessoais desnecessários);
- teste de viewport mobile, laptop e ultrawide e revisão de motion com `prefers-reduced-motion`.

## Critérios de aceite de UX/UI

- Um operador encontra e edita qualquer campo sem abrir mais de um painel de propriedades por vez.
- A posição pode ser ajustada por teclado com valor exato, e o valor é anunciado com unidade.
- A seleção no canvas e na lista é sincronizada e não depende apenas de cor.
- Sobreposição é visível, explicada e acionável, mas salvar/publicar continua possível.
- Erros estruturais ficam junto do grupo/controle que precisa de correção e o foco vai para o primeiro erro no envio.
- Não há dois scroll containers concorrentes no layout móvel.
- A sequência de teclado não passa por dezenas de controles ocultos; tabs/accordions obedecem ao padrão WAI-ARIA.
- Salvar/publicar, undo/redo e restaurar permanecem visíveis e têm estados de carregamento acessíveis.
- Alterações não salvas geram aviso antes de navegação/reload.
- Suíte automatizada cobre seleção, reset, inputs numéricos, warnings, teclado, responsividade estrutural e publicação com sobreposição.

## Limites da pesquisa

Figma, Adobe e Apple são referências de produtos criativos completos; o Hub deve reutilizar os princípios de organização e interação, não copiar aparência ou adicionar liberdade que contradiga o modelo de campos padronizados. Os documentos não substituem testes com operadores reais nem a validação de acessibilidade em navegador/assistive technology.

