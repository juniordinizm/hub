# Plan 012: Transformar eventos de aprendizagem em decisões acionáveis

> **Instruções ao executor**: comece por perguntas e ações. Não crie dashboard de
> métricas vaidosas nem capture conteúdo pessoal desnecessário.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/features/progress src/features/courses src/features/admin src/db docs/domain`

## Status

- **Prioridade**: P2
- **Esforço**: L
- **Risco**: MED
- **Depende de**: `005-outbox-and-transactional-audit.md`,
  `010-learning-policy-content-versions-and-cohorts.md`
- **Categoria**: product, analytics
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

O Hub responde melhor a “quem pagou/tem acesso?” que a “onde as alunas travam?”.
Thinkific e Circle mostram conclusão por aula, tempo, drop-off e alunas desengajadas.
O objetivo não é copiar dashboards, mas permitir uma ação: melhorar aula, contatar
aluna ou identificar falha técnica.

## Estado atual

- `lesson_progress` registra conclusão;
- `lesson_watch_progress` registra posição/percentual;
- admin mostra dados operacionais e receita;
- não há evento de aula iniciada, retomada, abandono, erro do player ou material;
- não há definição de “desengajada”;
- sem coorte/versão, comparações históricas podem misturar currículos;
- comentários podem indicar dúvida, mas não são analytics.

## Perguntas prioritárias

1. Quantas alunas elegíveis começaram cada aula?
2. Onde param de assistir/ler?
3. Quanto tempo até próxima aula?
4. Quem não progride há N dias, ainda com acesso?
5. Qual aula concentra erro, comentário ou rewatch?
6. Qual versão/coorte está sendo comparada?
7. Uma comunicação de apoio melhorou retomada?

## Escopo

**Em escopo**

- taxonomia pequena de eventos;
- eventos server-authoritative e client quando necessário;
- versão/coorte;
- agregações por aula/curso;
- dashboard de funil/drop-off;
- lista de desengajadas com ação manual;
- export;
- retenção/consentimento.

**Fora de escopo**

- gravar sessão/replay;
- conteúdo de nota/comentário em analytics;
- score preditivo/AI;
- marketing automation ampla;
- comparar alunas sem base legal;
- contagem de page view sem decisão associada.

## Passos

### 1. Definir evento e pergunta

Para cada evento, documentar:

- pergunta;
- ação possível;
- source of truth;
- deduplicação;
- timestamp/version;
- dados pessoais;
- retenção.

Eventos iniciais: lesson_started, watch_checkpoint, lesson_completed,
resource_open_failed, player_error.

**Verificar**: remover evento sem owner ou ação.

### 2. Modelar ingestão idempotente

Client event recebe session identity no servidor, nunca userId informado. Usar
event ID/idempotency key, limites e batch quando útil. Completion continua em tabela
de domínio; analytics não vira autoridade.

**Verificar**: replay não duplica métrica nem altera progressão.

### 3. Derivar métricas com definições estáveis

- eligible;
- started;
- completed;
- median time-to-complete;
- video drop-off bucket;
- inactive enquanto acesso ativo;
- error rate.

Segmentar por course version/cohort quando existir.

**Verificar**: dataset fixture tem resultados calculados manualmente.

### 4. Criar dashboard acionável

Priorizar:

- funil por aula;
- pontos de drop-off;
- erros;
- alunas inativas;
- comentários/dúvidas como link separado, não métrica de sentimento.

Cada card explica definição e período.

**Verificar**: especialista consegue responder às sete perguntas sem export manual.

### 5. Adicionar reengajamento manual primeiro

Permitir selecionar aluna elegível e iniciar comunicação aprovada. Registrar intenção,
opt-out e resultado. Automação só após provar benefício e capacidade de suporte.

**Verificar**: nenhuma mensagem duplicada; opt-out é respeitado.

## Critérios de pronto

- [ ] toda métrica tem definição, owner e ação;
- [ ] eventos são idempotentes;
- [ ] analytics não altera domínio;
- [ ] PII e retenção aprovadas;
- [ ] versão/coorte evita comparação enganosa;
- [ ] dashboard responde às perguntas prioritárias;
- [ ] reengajamento começa manual e auditado.

## Condições STOP

- versão de conteúdo não foi decidida;
- base legal/retenção não foi aprovada;
- evento dependeria de userId client-supplied;
- métrica não leva a ação;
- automação de mensagem não tem opt-out/owner.

## Manutenção

Versionar definições. Mudança de fórmula deve preservar comparabilidade ou marcar
ruptura.

