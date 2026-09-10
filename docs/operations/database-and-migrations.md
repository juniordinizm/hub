---
status: canonical
owner: engineering
last_verified_commit: b6e6d63
current_migration_tag: 0075_installment_schedule_and_observed_evidence
migration_entry_count: 76
schema_table_count: 49
---

# Banco e migrations

## Ambientes

Production e Staging são branches Neon persistentes e independentes no uso da
aplicação. A CI usa PostgreSQL local e não cria branches Neon.

| Ambiente | Uso | Migration automática |
|---|---|---|
| Development | desenvolvimento compartilhado/local | workflow manual |
| CI | integração e E2E descartáveis | PostgreSQL local do runner |
| Staging | homologação online | operação após `push` em `staging` |
| Production | dados reais | workflow de release |

Branch Git e branch Neon são conceitos diferentes. Trocar a branch Git não
altera o banco conectado.

## Criar migration

Quando `src/db/schema.ts` mudar:

```powershell
bun run db:generate -- --name nome_objetivo
bun run db:migrations:check
```

Revise SQL, journal e snapshot. Nunca edite journal ou snapshot manualmente e
não use `db:push` para acelerar uma release.

## Índice do histórico de liberação

A migration `0071_content_release_observability_indexes` adiciona
`enrollment_events_course_event_idx` para a consulta de histórico que filtra
`course_id` e `event_type`. Antes de aplicar em um ambiente com dados grandes,
capture o plano real com o mesmo filtro usado pela publicação:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT EXISTS (
  SELECT 1
  FROM enrollment_events
  WHERE course_id = '<course-id>'
    AND event_type = 'content_release_scheduled'
);
```

Depois da migration, repita o comando e arquive o plano sem dados pessoais.
Aceite a mudança somente se o plano deixar de fazer um `Seq Scan` relevante ou
reduzir o custo/leituras de forma observável; se o ambiente tiver poucos
eventos, registre que o ganho é preventivo e não faça benchmark artificial.

A migration `0072_admin_order_installment_count` adiciona
`orders.payment_installment_count` para preservar a quantidade efetiva de
parcelas retornada pelo agregado Asaas. O campo é opcional porque pedidos
históricos podem ter somente o ID do parcelamento ou não ter passado pelo
enriquecimento do agregado; o limite máximo configurado da oferta não é usado
como substituto da quantidade escolhida.

A migration `0073_strange_inertia` adiciona um índice composto pela data e pelo
ID do Pedido para manter a ordenação paginada do Financeiro determinística e
eficiente. A consulta deve continuar usando os dois campos na mesma ordem;
antes de aplicar em uma base grande, capture o plano real com `EXPLAIN`.

A migration `0074_boring_nitro` cria `financial_events`, uma trilha financeira
append-only com chave idempotente, data de ocorrência, vínculos opcionais ao
Pedido, webhook, reembolso e Revisão, identificadores do Asaas e valores
normalizados. Registros existentes entram como snapshots de backfill marcados
em `metadata`; eles não reconstroem transições anteriores à migration. Triggers
registram criações e mudanças financeiras futuras em Pedido, webhook,
sincronização de movimentações, reembolso e Revisão. Payloads brutos não são
copiados para essa trilha e continuam sujeitos à retenção própria da inbox.

A migration `0075_installment_schedule_and_observed_evidence` adiciona a fonte
`installment` à trilha financeira, persiste as cobranças individuais de um
parcelamento Asaas quando a conciliação as valida e guarda valores observados
nas Revisões de divergência. Datas das parcelas permanecem texto do provedor,
sem assumir fuso horário; ausência de taxa ou líquido continua sendo evidência
incompleta, não taxa zero confirmada.

Na verificação de escala do Financeiro em Development, a base tinha 8 Pedidos e a
busca textual usou `Seq Scan` com 2 buffers e 0,111 ms de execução; a ordenação por
status usou 2 buffers e 0,092 ms. Como a população é pequena e não há evidência de
ganho prático para um índice trigram ou cache, nenhum índice adicional foi criado.
Repetir a medição antes de alterar essa decisão quando a população crescer.

## CI

O runner cria dois bancos PostgreSQL locais, aplica a cadeia completa e executa
integração e E2E. Nenhum banco Neon é usado para validar migrations de PR.

Isso remove custo, quota e risco de branches Neon de teste abandonadas. A
migration ainda é exercitada numa implementação PostgreSQL real; somente o
provedor de hospedagem muda.

## Staging

Depois de um merge em `staging`, o workflow pequeno de preparação aplica
migrations no branch Neon de Staging. Ele valida hostname e branch configurados
antes de abrir conexão. A Git Integration da Vercel publica o código de forma
independente.

Staging não é apagado ou recriado a cada release. O banco mantém seus dados de
sandbox; reset é uma operação manual protegida e não copia dados reais.

O seed `db:seed:staging-admin` mantém uma única conta Admin controlada, com senha
de pelo menos oito caracteres, transação única e revogação das sessões existentes.
Não há conta de recuperação nem seed de fator adicional.

## Production

O workflow de Production detecta migrations entre o deployment promovido e o
candidato.

Sem migration:

- não cria branch Neon de release;
- não exige backup de release adicional;
- não executa migration;
- valida apenas o deployment e os smokes aplicáveis.

Com migration:

1. a build Production termina sem domínio;
2. um backup independente de até seis horas e meia é exigido;
3. uma branch Neon de recuperação é criada com expiração;
4. a migration é aplicada com lock;
5. o journal é auditado;
6. readiness é testado;
7. somente então o deployment é promovido.

Migrations Production são forward-only e devem ser compatíveis com o código
anterior durante a janela entre alteração do banco e promoção.

A migration histórica `0065_gray_siren` contém estruturas de uma tentativa de MFA
administrativo. Elas permanecem no schema e no histórico para evitar uma remoção
destrutiva, mas não são registradas no adaptador Better Auth nem usadas pelo
runtime atual. Não crie uma nova migration para removê-las sem decisão explícita.

## Backup e restore

O backup criptografado PostgreSQL continua a cada seis horas no R2 privado.
Branches de recuperação de release só são criadas para alterações de schema.
Use o runbook [Backup Production e restauração](production-backup-restore.md)
para qualquer restore; não execute SQL manual de reversão.

## Neon Free

Production e Non-production devem usar projetos Neon separados para impedir que
homologação consuma a cota de Production. Computes não produtivos usam
scale-to-zero e limites conservadores. O projeto exclusivo da CI será
desativado somente após observação e inventário.

Quando uma migration, reset ou mudança de conexão falhar, pare o fluxo e
registre o ambiente, branch, migration e etapa. Não substitua o alvo por outra
URL sem revisar a segurança do destino.
