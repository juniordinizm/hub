---
status: accepted
owner: engineering
last_verified_commit: 63f64106eef197d59a7929fabc6d64fb239ecfe6
requalification_result: no_go
requalification_date: 2026-08-26
---

# Requalificação de Production Readiness — 2026-08-26

## Resultado

`NO-GO` para uma nova promoção protegida. Production está no ar e o checkout
real já registrou uma venda, mas a recuperação independente ainda não possui uma
cópia válida e Sentry/DMARC continuam sem os gates externos finais. O bloqueio
imediato reproduzível é `configuration-database` no workflow de backup.

Esta revisão atualiza o estado operacional após a janela emergencial. A decisão
`NO-GO` histórica de 23 de agosto permanece intacta.

## Identidade e escopo

- repositório: `juniordinizm/hub`;
- branch avaliada: `main`;
- SHA de código verificado: `63f64106eef197d59a7929fabc6d64fb239ecfe6`;
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
`HEAD` confirmou expiração configurada. Isso prova a configuração das regras,
não a restauração.

Execuções relevantes:

1. `32929589649`: falha inicial corrigida no código; o runner não preservava o
   caminho do cliente PostgreSQL 18 entre steps.
2. `32931613267`: PostgreSQL 18 encontrado; falha sanitizada `database`.
3. `32932523075`: falha sanitizada `database-query`.
4. `32933557220`: SQLSTATE inexistente; diagnóstico permaneceu seguro.
5. `32934526658`: fase de conexão/consulta rotulada; falha ainda genérica.
6. `32981304412` e `32982879681`: a proveniência Vercel/Neon passou após a
   correção de domínio; a falha final foi `configuration-database`.

`configuration-database` ocorre antes da conexão/inspeção: a secret
`BACKUP_DATABASE_URL` não satisfaz a validação local. O valor correto deve ser
mantido apenas no Environment, apontar para o host direto da branch Production,
conter banco e credenciais válidos, usar `sslmode=verify-full` e não conter
parâmetros fora de `sslmode` e `channel_binding`. A próxima ação depende da
edição manual dessa secret; nenhum token ou URL deve ser enviado ao chat.

Ainda faltam: manifesto `frequent` válido, verificação de idade/RPO, restore em
target descartável, PITR, medição de RTO, duas execuções consecutivas e
agendamento do exercício periódico.

## Matriz atual de Sprints

| Sprint | Estado | Evidência | Próximo fechamento |
|---|---|---|---|
| 0 | `COMPLETED` | baseline, providers e cotas registrados | nenhuma ação imediata |
| 1 | `IMPLEMENTED_EXTERNAL_PROOF_PENDING` | matriz `support`, TOTP e testes verdes | provar duas contas Admin e recuperação por backup code |
| 2 | `BLOCKED_CONFIGURATION_DATABASE` | bucket/lock/lifecycle e workflow publicados | corrigir `BACKUP_DATABASE_URL`, backup verde, restore/PITR/RPO/RTO |
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
  recuperáveis no histórico;
- nenhuma credencial foi adicionada a código ou documentação;
- a venda real não é convertida em gate retroativo nem repetida;
- o fluxo normal passa a ser PR → quatro checks CI → backup válido → checker →
  deploy protegido → observabilidade → documentação.

## Condição de continuação

Após a operadora atualizar `BACKUP_DATABASE_URL` sem expô-la, executar novamente
o workflow `Backup Production database`. Se o resultado for verde, seguir para
manifesto/restore/PITR e só então requalificar Sentry, DMARC, Dependabot e a
promoção. Se falhar, preservar a última cópia válida (atualmente inexistente)
e parar no novo diagnóstico sanitizado.
