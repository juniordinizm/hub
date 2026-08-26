---
status: accepted
owner: engineering
last_verified_commit: 76e77e68f9a14f2f96f3412917bf3d3c08de398c
requalification_result: no_go
requalification_date: 2026-08-26
---

# Requalificação de Production Readiness — 2026-08-26

## Resultado

`NO-GO` para uma nova promoção protegida. Production está no ar e o checkout
real já registrou uma venda. O backup independente agora está verde e o checker
de frescor passou, mas restore/PITR/RTO, Sentry/DMARC e outros gates externos
continuam pendentes. O bloqueio atual é a ausência de credencial R2 read-only
separada no Environment `vercel-production`.

Esta revisão atualiza o estado operacional após a janela emergencial. A decisão
`NO-GO` histórica de 23 de agosto permanece intacta.

## Identidade e escopo

- repositório: `juniordinizm/hub`;
- branch avaliada: `main`;
- SHA de código verificado: `76e77e68f9a14f2f96f3412917bf3d3c08de398c`;
- deployment Production observado: `dpl_8TdrhAsLdPF6BCDSuw5ArE8VCkFb`;
- SHA atualmente servido: `1c0202f935934285901f90e2b8c68f887f00222e`;
- horário dos últimos comandos remotos: 2026-08-26, UTC;
- dados sensíveis, URLs assinadas, conteúdo de e-mail e PII foram omitidos.

## Evidência técnica

### CI e mudanças de código

Os PRs de normalização de backup, diagnóstico seguro de erros, fases de consulta
e verificação de domínio foram integrados somente após os quatro jobs verdes:
Quality gates, PostgreSQL integration, Browser journeys e Build/dependency audit.
As execuções recentes totalizaram zero retry e zero job skipped no caminho do
repositório. O último CI completo do checker de domínio foi `32981961009`.

O checker agora consulta o deployment e `GET /v9/projects/{idOrName}/domains`.
Um domínio só é aceito quando `verified=true` e `projectId` coincide; o alias
`*.vercel.app` continua sendo validado separadamente. Isso corresponde ao DNS
canônico observado e impede que uma lista incompleta de aliases falsifique a
proveniência.

### Production, checkout e jobs

O deployment observado está `READY`, `target=production`, em `gru1`, com Node.js
24. O DNS de `app.neurocapacitar.com.br` aponta para a infraestrutura DNS da
Vercel. A operadora confirmou uma venda real pelo checkout público. Essa prova é
pós-deploy e não deve ser repetida cobrando outra pessoa.

Os cron jobs Production observados estão alinhados ao contrato:

- Asaas webhook: a cada 1 minuto;
- JMVStream, outbox e webhook Resend: a cada 5 minutos;
- matrícula: diariamente às 10:00 UTC;
- manutenção: diariamente às 04:00 UTC.

Os quatro workers retornaram HTTP 200 no intervalo recente. Os poucos 500 nas
agregações de 24 horas estão concentrados no deployment anterior e foram
associados ao segredo ausente do webhook Resend; não são tratados como prova de
estabilidade histórica perfeita.

### Backup R2 e diagnóstico

O bucket dedicado `neurocapacitar-production-backups` e o Environment GitHub
`production-backup` existem. Objetos de teste nas classes frequent, daily e
weekly tiveram remoção recusada durante o lock (exit code sanitizado `254`) e o
`HEAD` confirmou expiração configurada. A listagem autenticada passou depois da
atualização dos secrets R2. Isso prova a configuração das regras, não a
restauração.

Execuções relevantes:

1. `32929589649`: falha inicial corrigida no código; o runner não preservava o
   caminho do cliente PostgreSQL 18 entre steps.
2. `32931613267`: PostgreSQL 18 encontrado; falha sanitizada `database`.
3. `32932523075`: falha sanitizada `database-query`.
4. `32933557220`: SQLSTATE inexistente; diagnóstico permaneceu seguro.
5. `32934526658`: fase de conexão/consulta rotulada; falha ainda genérica.
6. `32981304412` e `32982879681`: a proveniência Vercel/Neon passou após a
   correção de domínio; a falha final ainda era `configuration-database`.
7. `32993456881` e `32996629032`: a URL direta passou conexão e inspeção até o
   checker rejeitar o formato válido `18.6 (3484359)` retornado pelo Neon.
8. `32997132194`: o PR da correção de versão e do diagnóstico sanitizado passou
   Quality gates, PostgreSQL integration, Browser journeys e Build/dependency
   audit sem retry ou job skipped.
9. `32998006707`: PostgreSQL 18.6, migration, role e inspeção passaram; a
   primeira leitura do bucket R2 falhou e o workflow registrou `storage`.
10. `33014013409`, `33015400778` e `33016894916`: a listagem R2 passou, mas o
    `pg_dump` falhou antes das fases de leitura do catálogo.
11. A matriz sanitizada `33018097673`–`33018947445` confirmou a mesma falha em
   dez variantes e a assinatura `connection to server ... file does not exist`.
   O runner não tinha o CA padrão usado pelo libpq para `sslmode=verify-full`.
12. `33019958869`: o `pg_dump` concluiu depois de fornecer o CA; o upload da
    cifra falhou com requisição streaming não reexecutável, antes do manifesto.
13. O probe controlado `33022570244` fez cinco variantes: `Buffer` passou em
    1, 8 e 32 MB; `Readable` falhou com `IncompleteBody`/`ECONNRESET`. A causa
    é o corpo streaming não replayável no caminho S3/R2, não credencial ou
    tamanho do bucket.
14. `33023906420`: backup completo passou em `main`; foram publicados seis
    objetos (cifra e manifesto em `frequent`, `daily` e `weekly`) e todos os
    HEADs foram confirmados.
15. `ops:check:production-backup` passou com idade de 2 minutos e migration
    `0067_sparkling_ghost_rider`. As variables R2 não sensíveis também foram
    adicionadas ao Environment `vercel-production`.

O bloqueio `configuration-database` foi encerrado: `BACKUP_DATABASE_URL` aponta
para o host direto da branch Production, usa `sslmode=verify-full` e passou pela
conexão/inspeção. O bloqueio `storage` de credenciais e streaming foi encerrado:
o backup e o checker de frescor passaram depois da atualização dos secrets e da
correção para `Buffer` replayável. O bloqueio agora é externo: as secrets
`RESTORE_R2_ACCESS_KEY_ID` e `RESTORE_R2_SECRET_ACCESS_KEY` não existem no
Environment `vercel-production`. Nenhum token, chave ou URL deve ser enviado ao
chat.

A presença nominal de uma secret no Environment não prova seu conteúdo nem a
conectividade. O workflow de backup está verde; não substitua o gate de release
por `emergency_skip_backup`.

Ainda faltam: credencial R2 read-only separada, restore em target descartável,
PITR, medição de RTO, duas execuções consecutivas e agendamento do exercício
periódico.

## Matriz atual de Sprints

| Sprint | Estado | Evidência | Próximo fechamento |
|---|---|---|---|
| 0 | `COMPLETED` | baseline, providers e cotas registrados | nenhuma ação imediata |
| 1 | `IMPLEMENTED_EXTERNAL_PROOF_PENDING` | matriz `support`, TOTP e testes verdes | provar duas contas Admin e recuperação por backup code |
| 2 | `BACKUP_GREEN_EXTERNAL_PROOF_PENDING` | backup, R2, Neon, CA, manifestos e checker de frescor verdes | credencial read-only, restore/PITR/RPO/RTO |
| 3 | `COMPLETED_CODE` | concorrência e validade cobertas em PostgreSQL descartável | manter monitoramento |
| 4 | `EXTERNAL_PROOF_PENDING` | Resend lifecycle controlado verde em Staging; workers Production 200 recentes | aceite/delivery no painel e alertas dead-letter/retry |
| 5 | `EXTERNAL_GATES_PENDING` | checker e integração Sentry locais; DNS/alertas não fechados | token de upload, privacidade, alerta institucional, DMARC reject |
| 6 | `DEPENDABOT_PROVIDER_PENDING` | configuração Bun publicada; PRs existentes são antigos/divergentes | PR real do ecossistema Bun alterando lockfile e gates |
| 7 | `NO-GO` | CI integral verde em SHAs recentes; externos abertos | repetir matriz completa no mesmo SHA após Sprints 2/5/6 |
| 8 | `PARTIAL_POST_PRODUCTION` | deployment observado e uma venda confirmada | documentar e-mail/acesso/refund sem nova cobrança; programar revisões |

## Desvios emergenciais encerrados

- não há autorização para novos `emergency_skip_backup` ou
  `emergency_skip_ci`;
- PRs/workflows diagnósticos temporários de Asaas foram fechados; commits ficam
  recuperáveis no histórico. As branches temporárias de Asaas, R2 e deploy
  emergencial também foram removidas; a branch histórica de remediação foi
  preservada;
- nenhuma credencial foi adicionada a código ou documentação;
- a venda real não é convertida em gate retroativo nem repetida;
- o fluxo normal passa a ser PR → quatro checks CI → backup válido → checker →
  deploy protegido → observabilidade → documentação.

## Condição de continuação

Após criar a credencial R2 read-only no Environment `vercel-production`,
executar o checker do gate, seguir para restore/PITR/RPO/RTO e só então
requalificar Sentry, DMARC, Dependabot e a promoção. O workflow de backup já
está verde; não há necessidade de novo bypass emergencial.
