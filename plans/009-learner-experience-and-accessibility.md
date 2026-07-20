# Plan 009: Criar uma experiência resiliente, acessível e orientada à continuidade

> **Instruções ao executor**: não redesenhe a marca. Preserve o shell atual e corrija
> estados/fundamentos comprováveis por comportamento.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/app src/components src/features/courses src/features/comments`

## Status

- **Prioridade**: P2
- **Esforço**: L
- **Risco**: MED
- **Depende de**: `003-ci-and-risk-based-testing.md`,
  `006-observability-and-recovery.md`
- **Categoria**: ux, accessibility, reliability
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

O Hub já tem sidebar, progresso, próxima/anterior, vídeo, texto, material e comentários.
A maior lacuna de UX não é estética: não existem fallbacks de erro/loading/not-found,
baseline WCAG, testes de teclado ou uma experiência comprovada para falha/retomada.
Referências visualmente polidas também falham em labels, títulos de iframe e teclado.

## Estado atual

- nenhum `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`;
- nenhuma suite axe/keyboard;
- Vitest somente `node`;
- player suporta progresso de vídeo e conclusão;
- comments têm resposta/moderação, mas não comunidade/notificação ampla;
- sem notas privadas/highlights;
- Hotmart oferece offline/app, mas app nativo continua não objetivo do Hub;
- `component-reference.jsx` está vazio e não é referência.

## Escopo

**Em escopo**

- estados loading/error/empty/not-found;
- foco, teclado, landmarks, labels e anúncios;
- player/sidebar/responsividade;
- retomada de aula;
- feedback de bloqueio/expiração;
- notas privadas simples somente após validação de produto;
- instrumentação de UX.

**Fora de escopo**

- rebrand;
- app nativo/offline;
- gamificação;
- comunidade/feed/DM;
- copiar template Sanity;
- declarar conformidade WCAG sem auditoria.

## Passos

### 1. Definir jornadas e baseline

Avaliar em viewport mobile/desktop e teclado:

- primeiro acesso;
- continuar curso;
- vídeo processando/falhando;
- material indisponível;
- aula bloqueada;
- acesso expirado/revogado;
- concluir/avançar;
- comentar/responder;
- certificado.

Registrar problemas por impacto, não preferência visual.

**Verificar**: cada problema tem reprodução, critério de aceitação e screenshot somente
se a política do ambiente permitir artefato, sem abrir URL local automaticamente.

### 2. Adicionar boundaries do App Router

Criar fallbacks por área e global. Erro deve:

- explicar ação possível;
- oferecer retry/navigation;
- manter foco correto;
- mostrar correlation ID seguro;
- não revelar erro interno.

**Verificar**: E2E injeta falha de DB/provider e alcança fallback acessível.

### 3. Estabelecer baseline semântico

Cobrir:

- heading hierarchy;
- landmarks;
- nome de botões/inputs;
- título de iframe;
- alt;
- foco visível;
- dialog focus trap/restore;
- controles de sidebar mobile;
- anúncios de progresso/erro;
- redução de movimento;
- contraste.

**Verificar**: axe sem violações críticas/sérias nas páginas-alvo e jornada completa
somente por teclado.

### 4. Melhorar continuidade

Exibir “continuar de onde parou” a partir do estado server-authoritative, sem marcar
conclusão apenas por visita. Preservar escolha manual/98% atual até plano 010.

**Verificar**: fechar/reabrir browser retorna à aula/posição esperada, inclusive
mobile.

### 6. Melhorar apoio contextual antes de comunidade

Adicionar notificação de resposta/menção somente se houver owner e preferências.
Manter comments vinculados à aula.

**Verificar**: opt-out, deduplicação e deep link para contexto.

## Critérios de pronto

- [ ] falhas e loading têm boundary acessível;
- [ ] jornadas críticas funcionam por teclado;
- [ ] axe não reporta violações críticas/sérias;
- [ ] retomada não altera conclusão;
- [ ] estados de bloqueio/expiração são claros;
- [ ] mobile player/sidebar passam E2E;
- [ ] nenhuma comunidade ou app nativo entrou por escopo implícito.

## Condições STOP

- mudança exige alterar política de conclusão;
- JMVStream não oferece controle/evento necessário;
- nota privada não tem política de acesso/retenção;
- “correção” depende de ocultar controle sem semântica;
- auditoria precisaria alegar conformidade não testada.

## Manutenção

Executar axe/keyboard em cada nova superfície crítica. Medir erro e abandono antes de
redesign amplo.

