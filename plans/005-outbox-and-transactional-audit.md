# Plan 005: Entregar efeitos externos e auditoria crítica de forma confiável

> **Instruções ao executor**: não envie e-mail ou webhook dentro de transação longa.
> Registre intenção atomicamente e entregue depois.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/features/email src/features/courses src/features/privacy src/features/payments src/db`

## Status

- **Prioridade**: P1
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: `001-database-evolution-and-safe-tooling.md`,
  `002-certificate-issuance-concurrency.md`
- **Categoria**: reliability, architecture
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

Hoje, falhar e-mail de certificado não desfaz o certificado, mas também não deixa uma
fila recuperável. Em privacidade, registrar/aprovar e inserir audit log ocorrem em
queries separadas; uma parte pode persistir sem a outra. O projeto já documenta
ausência de outbox como limitação.

## Estado atual

- `completeLesson` envia `sendCertificateIssuedEmail` após commit e engole falha.
- `registerPrivacyRequest` insere request e depois audit com outro `getPool().query`.
- `approvePrivacyRequest` atualiza status e depois audita fora de transação.
- `executePrivacyAnonymization` já usa transaction e serve como referência local.
- webhooks recebidos possuem idempotência própria; não devem ser misturados à outbox
  de efeitos enviados.

## Escopo

**Em escopo**

- tabela e worker de transactional outbox;
- e-mails transacionais críticos;
- audit logs que fazem parte de operação regulatória/financeira;
- retry, idempotency key, dead-letter e observabilidade;
- cron/route autenticada para delivery se não houver worker dedicado.

**Fora de escopo**

- campanha de marketing;
- fila genérica para todo evento;
- Kafka/Redis apenas por arquitetura;
- audit de telemetria best-effort como se fosse ledger;
- apagar registros dead-letter automaticamente.

## Passos

### 1. Classificar efeitos

Criar catálogo com:

- operação de origem;
- efeito;
- criticidade;
- chave idempotente;
- máximo de tentativas;
- política de retenção;
- PII presente;
- owner do incidente.

Começar por certificado, ativação/recuperação de conta e notificações financeiras.

**Verificar**: catálogo aprovado e sem payload de segredo.

### 2. Modelar outbox mínima

Campos mínimos:

- `id`, `topic`, `aggregate_type`, `aggregate_id`;
- `idempotency_key` unique;
- payload versionado;
- `status`, `attempts`, `available_at`;
- `locked_at`, `locked_by`;
- `last_error_code`, timestamps.

Payload deve conter apenas o necessário. Preferir IDs/snapshots mínimos, não dados
sensíveis completos.

**Verificar**: migration em banco vazio e constraint de idempotência.

### 3. Registrar intenção na mesma transação

Na emissão de certificado, inserir outbox somente quando `INSERT ... RETURNING`
devolver vencedor. Em privacidade, envolver state transition + audit no mesmo
`PoolClient`.

**Verificar**: falha provocada no audit/outbox faz rollback da operação correspondente.

### 4. Implementar consumidor concorrente

Usar claim atômico (`FOR UPDATE SKIP LOCKED` ou equivalente), lease, backoff com
jitter e limite de tentativas. Marcar sucesso somente após confirmação do adaptador.
Retry deve reutilizar idempotency key quando o provedor suportar.

**Verificar**: dois workers não entregam o mesmo item simultaneamente; processo morto
libera lease expirado.

### 5. Criar reprocessamento operacional

Expor lista e retry apenas para permissão explícita. Nunca editar payload histórico.
Registrar quem reprocessou e motivo.

**Verificar**: item dead-letter pode ser reativado uma vez e gera audit.

## Testes obrigatórios

- commit de domínio + outbox atômicos;
- rollback;
- dois workers;
- retry transitório;
- falha permanente/dead-letter;
- payload versionado desconhecido;
- idempotency key duplicada;
- PII não aparece em log.

## Critérios de pronto

- [ ] efeitos críticos têm intenção durável;
- [ ] auditoria crítica é atômica;
- [ ] falhas são visíveis e reprocessáveis;
- [ ] concorrência não duplica entrega;
- [ ] retenção e PII estão documentadas;
- [ ] testes, typecheck, check e build passam.

## Condições STOP

- provider não permite distinguir sucesso de timeout ambíguo;
- payload exigiria armazenar credencial;
- não há owner/cron confiável para consumir fila;
- política de retenção de PII não foi aprovada.

## Manutenção

Outbox não substitui analytics nem audit ledger. Cada novo tópico precisa de versão,
idempotency key, owner e runbook.

