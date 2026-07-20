# Plan 010: Ratificar conclusão, versões de conteúdo e coortes antes de modelar

> **Instruções ao executor**: este é um plano de decisão. Não crie migration ou UI até
> as decisões D1–D5 serem aprovadas e registradas.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- PRODUCT.md CONTEXT.md docs/domain/learning-content-and-progress.md docs/decisions.md src/db/schema.ts src/features/courses`

## Status

- **Prioridade**: P1 de decisão, P2 de implementação
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: `003-ci-and-risk-based-testing.md`
- **Categoria**: direction, domain-modeling
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

Matrículas apontam para um curso mutável. O progresso usa todas as aulas ativas no
momento, e o certificado é emitido quando esse conjunto está concluído. Adicionar,
remover ou reordenar aula pode mudar a promessa para alunas em andamento. Criar
Turma/Drip sem decidir qual versão de conteúdo ela entrega só desloca o problema.

## Estado atual

- Curso → Módulo → Aula, sem versão;
- matrícula referencia curso, sem coorte;
- conclusão: manual ou evento de vídeo com 98%;
- curso concluído quando todas as aulas ativas estão concluídas;
- certificado guarda snapshots de nome/título/carga, mas não versão curricular;
- `DEC-DISC-004` e `DEC-DISC-005` aguardam ratificação;
- Frappe separa Batch de Course, mas ainda recalcula matriculados quando a aula muda;
- Teachable preserva conclusão/certificado de quem já concluiu quando entra nova aula.

## Decisões obrigatórias

### D1. Conteúdo vivo ou versão congelada?

Recomendação: `Course` representa identidade comercial; `CourseVersion` representa a
estrutura publicada que uma aluna recebeu.

Alternativas:

- conteúdo vivo: simples, mas muda promessa histórica;
- snapshot completo por matrícula: forte, mas caro e duplicado;
- versão imutável por publicação: melhor equilíbrio.

### D2. Quem recebe uma nova aula?

Recomendação: nova versão para novas matrículas; migração opcional e auditada para
coortes/alunas existentes. Concluídas não perdem conclusão/certificado.

### D3. O que conta para conclusão?

Recomendação inicial:

- aulas obrigatórias da versão;
- manual permitido apenas se isso continuar sendo promessa pedagógica;
- 98% de vídeo como evidência auxiliar;
- aulas opcionais não alteram denominador;
- certificado prova conclusão, não domínio do conteúdo.

### D4. Coorte e drip são necessários agora?

Recomendação: somente criar se houver calendário/grupo real. `Cohort` deve referenciar
uma versão e conter janela, membros e políticas. `DripRule` responde por liberação
temporal; não misturar com grant/expiração.

### D5. Como corrigir conteúdo publicado?

Recomendação: correção editorial compatível pode entrar na mesma versão com audit;
mudança que altera objetivo, ordem obrigatória ou conclusão cria nova versão.

## Escopo

**Em escopo após ratificação**

- ADR/decisão;
- `CourseVersion`, estrutura versionada e vínculo da matrícula;
- aulas obrigatórias/opcionais;
- política de migração;
- coorte/drip mínimo se aprovado;
- progresso e certificado com version ID;
- read models e UI compatíveis.

**Fora de escopo**

- marketplace;
- múltiplos instrutores;
- learning path entre vários produtos;
- assinatura;
- gamificação;
- copiar Batch do Frappe;
- alterar matrículas históricas silenciosamente.

## Passos

### 1. Fazer workshop com exemplos concretos

Usar cenários:

- nova aula antes do módulo 2;
- aula removida por erro;
- correção clínica importante;
- aluna 30%, 99% e concluída;
- certificado já baixado;
- cohort futura com calendário.

**Verificar**: D1–D5 respondidas sem “depende” não operacional.

### 2. Registrar decisão e invariantes

IDs estáveis, estados e regras:

- versão draft/published/retired;
- published é imutável salvo correção compatível definida;
- matrícula aponta para uma versão;
- denominador não muda silenciosamente;
- certificado aponta para versão;
- migração é evento auditado.

**Verificar**: exemplos do passo 1 têm resultado determinístico.

### 3. Fazer migration forward-compatible

Backfill da versão atual para todas as matrículas/certificados sem alterar seus
estados. Criar constraint/índices. Deploy em expand → backfill → switch → contract.

**Verificar**: contagens, progresso e certificados antes/depois equivalentes.

### 4. Adaptar autoria/publicação

Editar draft; publicar nova versão; comparar diff; selecionar público de migração
quando permitido. Preview usa draft, aluna usa versão vinculada.

**Verificar**: nova versão não altera aluna antiga até migração explícita.

### 5. Adicionar coorte/drip somente se aprovado

Coorte vincula versão; regra de liberação não muda validade da concessão. UI explica
“ainda não liberado” versus “sem acesso/expirado”.

**Verificar**: matriz temporal cobre timezone, DST, alteração e override auditado.

## Critérios de pronto

- [ ] D1–D5 ratificadas;
- [ ] versão publicada tem semântica clara;
- [ ] conclusão histórica é estável;
- [ ] certificado referencia currículo;
- [ ] backfill não altera progresso;
- [ ] coorte e drip permanecem separados de acesso;
- [ ] todos os cenários de workshop têm testes.

## Condições STOP

- qualquer decisão segue pendente;
- backfill não consegue identificar currículo histórico;
- migration alteraria certificado já emitido;
- coorte está sendo usada para resolver entitlement;
- versão é proposta sem estratégia para resources/JMVStream.

## Manutenção

Revisar a definição de “correção compatível” com produto. Toda mudança de denominador
de conclusão precisa de evento e comunicação.

