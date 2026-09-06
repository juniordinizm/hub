---
status: approved
owner: product_and_engineering
last_verified_commit: a7c8133
---

# Refinamento visual de conteúdo bloqueado

Esta especificação é uma continuação de polish da implementação registrada em
`2026-09-06-refine-locked-content-ui-design.md`. O documento anterior permanece
como histórico da primeira versão; esta especificação registra somente o delta
visual aprovado nesta rodada.

## Objetivo

Refinar a apresentação de módulos e aulas com liberação temporal ou bloqueio por
sequência, reduzindo ruído visual e densidade no mobile/desktop sem esconder
conteúdo nem alterar a autoridade server-side de acesso.

## Direção aprovada

### Trilha do Curso

- Remover o fundo, borda e padding extra aplicados somente aos módulos bloqueados.
- Reusar a mesma composição estrutural dos módulos liberados.
- Para módulo `time_locked`, substituir métricas/progresso no lado direito por um
  estado compacto com relógio, `Em breve` e data/hora de disponibilidade.
- Para módulos liberados, preservar quantidade de aulas, duração e progresso.
- Diferenciar o motivo do bloqueio nos cards:
  - `time_locked`: `Em breve`, com ícone de relógio e tratamento temporal;
  - `sequence_locked`: `Continue a sequência`, com ícone de bloqueio e tratamento
    de progresso;
  - aulas concluídas continuam revisáveis e com o estado existente.
- Cards bloqueados continuam wrappers estáticos, sem `Link`, foco ou handler de
  navegação.

### Próxima liberação

Quando a próxima aula está temporalmente bloqueada, substituir o botão desabilitado
do cabeçalho por um status não interativo e compacto, com cópia curta, ícone e
data/hora tabular. O elemento não deve parecer uma ação disponível.

### Sidebar da Aula

- Usar o componente Accordion shadcn existente com `type="multiple"`.
- Abrir inicialmente o módulo da aula atual; a Aluna poderá manter vários módulos
  abertos manualmente.
- O cabeçalho de cada módulo exibirá somente o título à esquerda. No lado direito,
  um módulo temporal exibirá relógio + data/hora, sem repetir o texto `Em breve`;
  um módulo com aulas futuras por sequência exibirá o estado de sequência em uma
  única linha.
- O aviso do bloqueio aparecerá uma vez no nível do módulo, não repetido em cada
  aula.
- Aulas futuras permanecem listadas apenas com título e marcador visual, sem duração,
  texto de disponibilidade repetido, link ou foco de teclado.
- Aulas liberadas continuam usando `SidebarMenuLink`, com active state e preview
  preservados.
- Desktop e navegação móvel usarão a mesma árvore e os mesmos estados.

### Configuração administrativa

- Substituir os radios nativos de `Liberação do conteúdo` por
  `RadioGroup`/`RadioGroupItem` shadcn, mantendo os valores de formulário
  `immediate` e `delayed`.
- Preservar a validação server-side e a cópia explicativa de 24 horas.

## Invariantes

- A disponibilidade continua calculada no servidor.
- A UI nunca renderiza links para aula temporalmente ou sequencialmente bloqueada.
- Conteúdo rico, player, materiais, comentários, progresso e conclusão continuam
  protegidos pelo workspace server-side.
- Nenhuma migration, regra de matrícula ou flag de rollout será alterada.

## Acessibilidade e responsividade

- Estados bloqueados usam `aria-disabled`, texto acessível e não dependem somente de
  cor ou grayscale.
- O Accordion mantém foco, teclado e `aria-expanded` providos pelo primitivo shadcn.
- O trigger remove sublinhado decorativo, mas mantém ring de foco visível.
- Datas e percentuais usam números tabulares; títulos longos usam truncamento seguro
  ou quebra controlada.
- O layout evita botão desabilitado como mensagem e mantém alvos ativos com a mesma
  linguagem visual existente.

## Verificação

- Testes da trilha cobrem os rótulos distintos e a remoção de links bloqueados.
- Testes do sidebar cobrem Accordion múltiplo, módulo aberto inicialmente e avisos
  agrupados por módulo.
- Testes admin cobrem `RadioGroup`, valores submetidos e defaults imediato/atrasado.
- Rodar testes focados, typecheck, Ultracite e `git diff --check`.
- Não executar deploy neste ciclo.

## Fora do escopo

- Alterar regras de acesso, migrations ou comportamento de Matrícula.
- Criar novo sistema de tokens, paleta ou fonte.
- Persistir a expansão do Accordion entre páginas.
- Alterar outras telas fora da trilha, aula/sidebar e edição de módulo.
