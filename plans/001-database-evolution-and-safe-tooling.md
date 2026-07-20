# Plan 001: Restaurar migrations reproduzíveis e ferramentas locais seguras

> **Instruções ao executor**: leia este plano inteiro antes de agir. Não execute
> `db:reset`, `db:seed`, `db:seed:student`, `db:push` ou qualquer SQL destrutivo
> contra banco compartilhado. Rode cada verificação. Pare nas condições STOP.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- package.json scripts src/db docs/operations/database-and-migrations.md`

## Status

- **Prioridade**: P0
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: nenhum
- **Categoria**: migration, correctness, dx
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

O diretório contém 31 arquivos SQL, dois pares com o mesmo prefixo e apenas 24
entradas no journal. Sete migrations posteriores não são reconhecidas pelo Drizzle.
Um banco novo não é prova do mesmo schema usado pelo código. Ao mesmo tempo, os
scripts de reset/seed podem destruir dados ou escrevem colunas removidas.

Qualquer plano que adicione tabela, teste com banco ou deploy seguro depende desta
base.

## Estado atual

- `src/db/migrations/meta/_journal.json`: termina em `0024_dashboard_banners`.
- Arquivos ausentes do journal:
  - `0023_precise_text_reading_duration.sql`;
  - `0024_enrollment_grants.sql`;
  - `0025_manual_access_block_events.sql`;
  - `0026_student_platform_block.sql`;
  - `0027_case_insensitive_user_email.sql`;
  - `0028_billing_operations_privacy.sql`;
  - `0029_dashboard_banner_blur_data_url.sql`.
- Prefixos duplicados: `0023` e `0024`.
- `scripts/reset-db-keep-users.ts`: executa `TRUNCATE TABLE users CASCADE` e
  `TRUNCATE TABLE courses CASCADE`, sem bloqueio de produção.
- `scripts/seed-initial-data.mjs`: usa colunas antigas como `modules.color`,
  `lessons.type` e `faq_items.category`.
- `scripts/bootstrap-student.ts`: cria `enrollments` sem a `enrollment_grant` que
  deveria ser sua fonte.
- Vocabulário obrigatório: Concessão é fonte de direito; Matrícula é projeção de
  acesso. Ver `CONTEXT.md` e `docs/domain/commerce-and-access.md`.

## Escopo

**Em escopo**

- `src/db/migrations/**`;
- um novo `scripts/check-migrations.ts`;
- `scripts/reset-db-keep-users.ts`;
- `scripts/seed-initial-data.mjs`;
- `scripts/bootstrap-student.ts`;
- testes novos sob `scripts/` ou `src/db/`;
- scripts de `package.json`;
- atualização estritamente necessária de
  `docs/operations/database-and-migrations.md`.

**Fora de escopo**

- alterar regra de produto ou schema de domínio;
- apagar ou reescrever histórico aplicado sem auditoria de cada ambiente;
- usar `drizzle-kit push` como reparo;
- executar reset/seed em produção;
- copiar dados de produção para teste.

## Passos

### 1. Provar o estado de cada banco antes de renomear arquivos

Para cada ambiente conhecido, registrar sem segredos:

- branch/database;
- entradas da tabela de migrations do Drizzle;
- existência de tabelas, colunas, índices e constraints criados pelos sete SQLs;
- se cada mudança está ausente, parcial ou presente;
- data e operador da verificação.

Use conexão direta para inspeção/migration e conexão pooled apenas em runtime.

**Verificar**: relatório aprovado contendo todos os sete SQLs por ambiente.

**STOP**: se produção não puder ser inspecionada, não altere nomes nem journal.
Entregue apenas o checker do passo 2 e o relatório do bloqueio.

### 2. Criar um checker determinístico

Criar `scripts/check-migrations.ts` sem dependência nova. Ele deve falhar quando:

- dois arquivos têm o mesmo número;
- um arquivo SQL não tem entrada correspondente no journal;
- o journal aponta para arquivo inexistente;
- a ordem numérica diverge da ordem do journal;
- um nome não segue `NNNN_slug.sql`.

Adicionar `db:migrations:check` ao `package.json`.

**Verificar**: antes da reconciliação, `bun run db:migrations:check` deve falhar e
listar exatamente os prefixos duplicados e sete entradas ausentes.

### 3. Escolher uma única estratégia de reconciliação

Use o relatório do passo 1:

- se nenhum ambiente aplicou as mudanças, renumerar em ordem monotônica, gerar
  journal coerente com Drizzle e preservar o conteúdo SQL;
- se todos aplicaram as mesmas mudanças fora do journal, criar um procedimento
  explícito de baseline por ambiente e uma migration forward-only de verificação;
- se ambientes divergem, criar migrations de reconciliação forward-only por estado.
  Não marque SQL como aplicado sem provar seus objetos.

Não edite migration que já conste aplicada em qualquer ambiente.

**Verificar**:

- `bun run db:migrations:check` => exit 0;
- busca por prefixos duplicados => nenhuma ocorrência;
- banco vazio recebe todas as migrations => exit 0;
- schema introspectado do banco vazio é equivalente a `src/db/schema.ts`.

### 4. Tornar reset impossível por acidente

Em `scripts/reset-db-keep-users.ts`, exigir simultaneamente:

- ambiente explicitamente local/test;
- host/database em allowlist local;
- token de confirmação digitado que inclua o nome do banco;
- flag explícita `--allow-destructive-local-reset`;
- mensagem que liste tabelas afetadas.

Renomear o script para refletir que ele remove usuários; o nome atual
`reset-db-keep-users` contradiz o `TRUNCATE users`.

**Verificar**: testes provam rejeição para URL Neon/Vercel, `NODE_ENV=production`,
flag ausente e confirmação incorreta.

### 5. Reescrever seeds contra o domínio atual

- Atualizar o seed de catálogo para colunas atuais e transação única.
- Torná-lo idempotente por chaves de domínio, não apenas posição.
- Fazer bootstrap da aluna criar primeiro uma Concessão manual de teste e então
  projetar a Matrícula pela mesma função de domínio usada pelo app.
- Recusar execução fora de ambiente local/test.

**Verificar**:

1. banco vazio + migrate + seed => exit 0;
2. rodar seed novamente => exit 0, sem duplicatas;
3. toda matrícula criada pelo seed possui concessão ativa correspondente;
4. `bun run typecheck` e testes dos scripts passam.

### 6. Adicionar o fluxo reproduzível ao CI

Expor um comando único de teste de banco vazio para o plano 003 consumir. O comando
deve criar banco efêmero, migrar, seedar, verificar invariantes e remover o banco.

**Verificar**: duas execuções consecutivas terminam em exit 0 e não deixam branch ou
database órfão.

## Testes obrigatórios

- checker com fixture de prefixo duplicado;
- checker com SQL sem journal e journal sem SQL;
- guardas do reset;
- seed idempotente;
- grant → enrollment;
- smoke test de banco vazio;
- comparação de objetos essenciais do schema.

## Critérios de pronto

- [ ] nenhum prefixo de migration duplicado;
- [ ] todo SQL e journal têm correspondência um-para-um;
- [ ] banco vazio chega ao schema esperado;
- [ ] produção não aceita reset/seed;
- [ ] seed roda duas vezes sem drift;
- [ ] matrícula de seed deriva de concessão;
- [ ] `bun run db:migrations:check` passa;
- [ ] `bun run test`, `typecheck`, `check`, `build` e `git diff --check` passam.

## Condições STOP

- estado de produção desconhecido;
- environments aplicaram subconjuntos diferentes sem forma de identificar estado;
- Drizzle geraria operação destrutiva não prevista;
- reconciliação exigiria perda ou transformação de dados sem plano aprovado;
- qualquer valor de credencial aparecer em log ou relatório.

## Manutenção

O checker deve virar gate de CI. Nunca reutilizar número de migration. Migration
aplicada é imutável; correção posterior deve ser forward-only.

