---
status: approved
owner: product_and_engineering
last_verified_commit: eface31a0aa431ef5750e24f5395dff8731ca69c
---

# Refinar a apresentação de conteúdo bloqueado

## Objetivo

Módulos e aulas futuras devem continuar visíveis na trilha e no outline da aula,
com a mesma riqueza visual dos conteúdos ativos, mas sem oferecer navegação ou
qualquer caminho de acesso antes da liberação temporal.

## Direção visual

O estado bloqueado usa a composição existente de cards, não uma caixa vazia
separada. A diferença é expressa por estado:

- thumbnail e metadados da Aula permanecem visíveis;
- o card usa lock badge, menor ênfase visual, grayscale/opacidade já suportados
  pelo `LessonCard` e não recebe hover de navegação;
- o cabeçalho do Módulo mantém título, descrição, contagem e duração;
- o cabeçalho acrescenta um estado compacto de bloqueio e a disponibilidade
  formatada, sem alerta dominante ou layout paralelo;
- números e datas mantêm alinhamento estável e os textos usam truncamento seguro.

O visual ativo permanece inalterado, evitando uma segunda linguagem visual para
a trilha.

## Trilha do Curso

O servidor passa a projetar todas as aulas ativas de um Módulo `time_locked`,
incluindo somente metadados de apresentação: título, duração, thumbnail,
indicação de vídeo, progresso já existente e disponibilidade. Conteúdo rico,
URL de player, materiais e mutações continuam fora da projeção bloqueada.

O cliente renderiza o mesmo layout de módulo para estados `available` e
`time_locked`. Cards bloqueados são wrappers não interativos, sem `Link`, foco
de teclado ou handler de navegação. Aulas concluídas anteriormente continuam
revisáveis conforme a regra existente.

## Sidebar direito e navegação mobile

O workspace da Aula lista todos os Módulos e Aulas da publicação vigente. Aulas
de módulo futuro recebem estado `isAvailable=false` e o módulo carrega sua
informação de release. O item bloqueado é um elemento estático com:

- lock icon;
- título e duração;
- texto `Disponível em <data>` para bloqueio temporal;
- texto de sequência existente para bloqueio por Aula anterior.

Aulas liberadas continuam usando `SidebarMenuLink` e preservam estado ativo. A
mesma árvore alimenta desktop e mobile, portanto as duas superfícies ficam
consistentes.

## Segurança e contrato

O bloqueio server-side continua sendo a autoridade. Renderizar metadados não
libera rota, player, material, comentário, progresso ou conclusão. O teste de
URL direta continua esperando redirect/indisponibilidade para Aula futura.

## Verificação

- projeção de overview preserva todas as aulas futuras e seus metadados;
- módulo bloqueado usa o layout de cards, com nenhum link de aula futura;
- sidebar lista aulas bloqueadas como estáticas e as aulas ativas como links;
- datas, lock state e mensagens de sequência são acessíveis;
- testes existentes de acesso, bypass e integração permanecem verdes.

## Fora do escopo

- alterar regras de release, Matrícula ou migrations;
- liberar conteúdo rico ou URLs assinadas antecipadamente;
- alterar identidade visual geral, fontes, palette ou layout de outras páginas;
- fazer deploy em Staging.
