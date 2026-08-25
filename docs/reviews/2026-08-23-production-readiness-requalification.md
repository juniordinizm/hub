---
status: accepted
owner: engineering
last_verified_commit: 36019cf0a609a7283046d71c694f16d8afd6fec3
requalification_result: in_progress
requalification_date: 2026-08-24
current_sprint: 6
---

# Requalificação de Production Readiness

## 1. Estado da execução

**Sprint 0:** `PASS` em 24 de agosto de 2026, às `02:37:28Z`.

A fotografia somente leitura foi repetida no commit
`9f2b8f177e7531f1c19242099f403c55b3820d08`. Vercel, Neon, Resend, DNS,
migrations, gates locais e viabilidade de backup gratuito foram comprovados sem
escrita em Production. O intervalo de backup recomendado é **6 horas**, igual ao
RPO alvo.

O inventário Sentry autenticado foi concluído por uma integração somente leitura,
sem exposição de credencial. O token configurado depois em `.env.local` também
foi validado sem registrar seu valor, mas possui somente `org:ci`: serve ao upload
de releases/source maps e recebe `403` ao tentar listar projetos. Uma inspeção
local futura exige outro token com `org:read`; nenhum deles precisa de escopo
administrativo. A ausência do token no build, a ausência de source maps e a
configuração Sentry divergente são findings reproduzíveis destinados ao Sprint 5;
deixaram de impedir o início do Sprint 1.

Não foi emitido evento sintético, alterado projeto Sentry, alterado provider,
aberto compute de escrita deliberadamente, aplicado migration, feito deploy ou
enviado backup.

## 2. Identidade da execução

- horário de encerramento da coleta: `2026-08-24T00:54:29Z`;
- operadora: Codex, execução local supervisionada;
- worktree: `C:/Users/Junior/Documents/0 - Dev/hub`;
- branch de trabalho: `codex/production-readiness-remediation`;
- commit base: `9f2b8f177e7531f1c19242099f403c55b3820d08`;
- ancestralidade: `main` é ancestral do commit base;
- mudanças preexistentes: documentação preservada, sem descarte ou sobrescrita;
- repositório GitHub: público, `juniordinizm/hub`, branch padrão `main`.

O branch foi criado para isolar a remediação no worktree atual. Não foi criado
outro worktree porque os documentos ainda não commitados pertenciam à mesma
mudança e movê-los exigiria descarte, stash ou commit não autorizado.

## 3. Baseline local

### 3.1 Runtime e dependências

- Bun global encontrado: `1.4.0`;
- Bun fixado e usado nos gates: `1.3.11`, conforme `packageManager`;
- Node local: `v22.20.0`;
- Node contratado pelo repositório e pela Vercel: `24.x`;
- Next.js: `16.2.11`;
- Better Auth: `1.6.25`;
- Resend: `^6.17.2`;
- Drizzle ORM: `^0.45.2`;
- Drizzle Kit: `^0.31.10`;
- Playwright: `1.58.2`;
- cliente PostgreSQL usado na medição: `pg_dump 18.6`.

O Bun global divergente não foi usado para validar a base. Todos os comandos
abaixo foram executados por `npx -y bun@1.3.11`, sem modificar lockfile ou
dependências.

### 3.2 Schema e migrations

- entradas locais no journal: `65`;
- migration superior local: `0064_certificates_preview_sha256`;
- timestamp superior: `1787421713994`;
- `LATEST_COMPATIBLE_MIGRATION_TIMESTAMP`: `1_787_421_713_994`;
- tabelas exportadas pelo schema: `43`;
- Production: `65` registros, timestamp superior `1787421713994` e `43`
  tabelas em `public`.

Não há drift de topo, contagem ou quantidade de tabelas entre o commit, o
journal e Production.

## 4. Gates locais

O perfil completo levou `92,08 s` e terminou com exit code `0`:

- `bun run docs:check`: `33` documentos canônicos válidos;
- `bun run db:migrations:check`: migrations válidas;
- `bun run typecheck`: aprovado;
- `bun run check`: `778` arquivos, nenhuma correção necessária;
- `bun run test`: `289` arquivos e `1.981` testes aprovados;
- `bun run build`: Next.js `16.2.11` compilado e `18` páginas estáticas geradas;
- `bun run knip`: exit code `0`; quinze sugestões de configuração, sem finding
  impeditivo;
- `bun audit --production`: nenhuma vulnerabilidade, `5,26 s`, exit code `0`.

E2E e integração PostgreSQL não foram executados neste Sprint. O plano proíbe
apontá-los para Production e nenhuma branch Neon descartável foi criada durante
a fotografia somente leitura.

## 5. Vercel

### 5.1 Projeto e deployment

- projeto: `hub`;
- project ID: `prj_oHQOBsqhr7wlWpJoGVMTlw7ciyFg`;
- team ID: `team_mHFcEG9cedToJWgCu8ikH8VE`;
- deployment: `dpl_7k5G2GLpqiG3Na7r5ouMp13aNZHa`;
- estado: `READY`;
- target: `production`;
- SHA: `9f2b8f177e7531f1c19242099f403c55b3820d08`;
- branch Git: `main`;
- região: `gru1`;
- Node: `24.x`;
- alias canônico presente: `app.neurocapacitar.com.br`;
- erro de alias: nenhum.

O estado coincide com `docs/operations/release-state.md`.

### 5.2 Variáveis e Sentry no build

A CLI Vercel local não possuía sessão não interativa utilizável; a tentativa foi
interrompida sem mutação e sem arquivo temporário residual. O inventário foi
continuado pela integração Vercel autenticada e pelos logs do deployment.

O bundle público contém exatamente um project ID Sentry:
`4511951566798848`. Isso comprova DSN cliente no artefato, sem expor a DSN.
Os logs do build registram o SDK `@sentry/nextjs 10.68.0`, seguido de:

```text
No auth token provided. Will not create release.
```

Consequências comprovadas: o build não criou release e não realizou o upload
autenticado de source maps. A presença do DSN servidor não pôde ser provada sem
ler valores secretos da Vercel.

## 6. Neon e PostgreSQL

### 6.1 Alvo Production

- organização: `neurocapacitar`;
- projeto: `neurocapacitar-lms-ci.`;
- project ID: `damp-snow-22911188`;
- região: `aws-sa-east-1`;
- branch: `production`;
- branch ID: `br-dark-boat-ac5ju6m4`;
- parent: nenhum, branch primária;
- estado da branch: `ready`;
- compute: `ep-hidden-tooth-ac843qc2`;
- estado do compute na fotografia: `active`;
- tipo: `read_write`;
- escala: `0.25-2 CU`;
- retenção histórica: `21.600 s`, equivalente a `6 h`;
- branch protegida no Neon: não.

As GitHub Environment Variables de `vercel-production` confirmam o mesmo
project ID, branch ID e host. O `.env.local` aponta corretamente para a branch
`development`, não para Production.

### 6.2 Transação somente leitura

A consulta explícita à branch Production começou com `SET TRANSACTION READ ONLY`
e `statement_timeout=15s`. Resultado:

- PostgreSQL `18.6`;
- database `neondb`;
- role `neondb_owner`;
- réplica: não;
- tamanho retornado por `pg_database_size`: `11.255.808 bytes`;
- tamanho lógico da branch na API Neon: `35.225.600 bytes`;
- journal: `65` entradas;
- tabelas `public`: `43`.

As duas medidas de tamanho têm escopos diferentes e não devem ser somadas. A
API mede armazenamento lógico da branch; PostgreSQL mede o database selecionado.

### 6.3 Grants

Não foi observada concessão a `PUBLIC`. A role conectada é proprietária e possui,
nas 43 tabelas, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`
e `TRIGGER`. A role não é superuser, mas possui `CREATEDB`, `CREATEROLE`,
`REPLICATION` e `BYPASSRLS`.

Esse é o contrato atual dos workflows de migration, não o contrato aceitável
para o backup recorrente. O Sprint 2 deve criar uma credencial separada somente
leitura; o dump recorrente não poderá reutilizar `neondb_owner`.

### 6.4 Consumo observado

No projeto que contém Production:

- armazenamento sintético: `89.838.304 bytes`;
- transferência somada nas branches retornadas: `29.810.896 bytes`;
- branches inventariadas: `8`, com limite Free atual de `10`;
- janela de restore Free: `6 h`.

Esses números são fotografia da API, não fatura. Branches de release com TTL e o
cleanup existente continuam necessários para preservar headroom.

## 7. Resend, DNS e remetentes

### 7.1 Conta e templates

- domínio: `neurocapacitar.com.br`;
- estado: `verified`;
- região: `sa-east-1`;
- sending: `enabled`;
- receiving: `disabled`;
- templates publicados: `6` de `6`, contrato aprovado pelo checker;
- webhooks: `0`.

O comando `bun run check:resend-templates -- --environment=production` terminou
com exit code `0` sem imprimir HTML, variáveis, chave ou PII.

### 7.2 DNS público

- SPF raiz, Lark: `v=spf1 +include:spf.onlarksuite.com -all`;
- MX raiz: `mx1.larksuite.com`, `mx2.larksuite.com`, `mx3.larksuite.com`;
- SPF Resend em `send`: `v=spf1 include:amazonses.com ~all`;
- MX Resend em `send`: `feedback-smtp.sa-east-1.amazonses.com`;
- seletor DKIM: `resend._domainkey`;
- SHA-256 do DKIM público: `c06935ff3d1f1acc3de554a51ecbeb171a8c3700a7027795a583694250d32113`;
- mesmo hash no painel Resend e no DNS público;
- DMARC: `v=DMARC1; p=none;`.

Fontes legítimas confirmadas:

- Resend, responsável pelo envio transacional, SPF/DKIM próprios e Receiving
  desativado;
- Lark Mail, responsável pelas caixas institucionais e pelo SPF/MX raiz.

A caixa `suporte@neurocapacitar.com.br` permanece a caixa institucional
documentada e monitorada. Nenhum terceiro remetente foi localizado. O endereço
de relatório agregado `rua` será configurado junto da progressão DMARC no
Sprint 5; nenhum endereço pessoal será publicado.

## 8. Sentry

### 8.1 Configuração observada

- organização real: `neurocapacitar`, ID `4511808020414464`;
- organização codificada no build: `summit-studio-ij`, divergente da real;
- slug codificado no upload: `protear`, inexistente no inventário real;
- projeto com histórico: `hub-development`, ID `4511808556564480`;
- projeto Production criado separadamente: `hub-production`, ID
  `4511951566798848`;
- project ID público de Production: `4511951566798848`;
- project ID público de Staging: `4511808556564480`;
- Development local usa o mesmo project ID de Staging, `4511808556564480`;
- DSN cliente: presente no bundle, valor não registrado;
- DSN servidor: valor e presença não inferíveis do bundle público;
- token de source maps nos builds Vercel Production e Staging: ausente;
- inventário autenticado: concluído por integração somente leitura;
- token local atual: válido, somente `org:ci`, adequado para upload e incapaz de
  listar projetos por CLI;
- `hub-development`: 23 releases, todas ainda marcadas como `unreleased`;
- `hub-production`: zero releases;
- release do SHA implantado: não criada pelo deployment observado;
- source maps: não comprovados e upload autenticado não executado;
- ambientes de `hub-development`: `development`, `staging` e `production`;
- ambientes de `hub-production`: somente `production`;
- monitores: quatro ativos, um `error` e um `issue_stream` por projeto;
- alertas: dois workflows ativos, um por projeto;
- ações por workflow: e-mail para `issue_owners` e Sentry App, ambas ativas;
- integrações retornadas pelo endpoint de integrações da organização: zero;
- canal institucional explícito: não configurado; o destino de e-mail atual é
  dinâmico (`issue_owners`) e a segunda ação é uma Sentry App;
- Issues não resolvidas por filtro de ambiente: `hub-production/production` 0,
  `hub-development/production` 3, `hub-development/staging` 1 e
  `hub-development/development` 17;
- eventos nos buckets dos últimos 14 dias: 18, todos em `development`, cobrindo
  sete Issues; os outros três filtros tiveram zero evento no período.

### 8.2 Diagnóstico autenticado do 403

O helper somente leitura consultou:

- `/api/0/projects/summit-studio-ij/protear/issues/`;
- `/api/0/projects/summit-studio-ij/hub-production/issues/`.

Ambas responderam HTTP `403`, sem vazamento do token. Na retomada, a integração
somente leitura devolveu o slug canônico `neurocapacitar` e os dois projetos.
Isso provou a configuração obsoleta no repositório. Já o token local `org:ci`
autentica a CLI, mas `projects list` contra a organização canônica retorna `403`
por ausência de `org:read`; esse resultado é esperado e não indica alvo incorreto
nem exige escopo administrativo.

O Sentry CLI `3.6.2` listou 23 releases em `hub-development` e nenhuma em
`hub-production`. O endpoint legado de regras retornou HTTP `410` com
`{"message":"This API no longer exists."}`. O inventário então usou os endpoints
GET atuais do Workflow Engine:

- `/api/0/organizations/neurocapacitar/workflows/`;
- `/api/0/organizations/neurocapacitar/detectors/`;
- `/api/0/projects/neurocapacitar/<project>/environments/`;
- `/api/0/projects/neurocapacitar/<project>/issues/`;
- `/api/0/organizations/neurocapacitar/integrations/`.

O helper somente leitura da skill Sentry também retornou sucesso com
`org=neurocapacitar`. O maior `statsPeriod` aceito pelo endpoint de Issues nessa
execução foi `14d`; `30d` retornou HTTP `400` e não foi tratado como ausência de
dados. Nenhum valor de token, DSN, destinatário ou payload bruto foi versionado.

### 8.3 Dois projetos ou um projeto com ambientes

Os dois project IDs recebem a mesma aplicação Next.js. O segundo não representa
outro serviço: Staging e Development compartilham o projeto não Production. A
documentação atual do Sentry define projetos como fronteira entre aplicações ou
serviços e `environment` como separação entre estágios de release. Portanto, a
topologia mais simples para este repositório é um projeto único com ambientes
`production`, `staging` e `development`.

A consolidação não será feita sem inventário. Projetos separados isolam ciclo de
vida de Issues, DSN, alertas e ruído; um projeto único reduz DSNs, tokens, regras e
drift, além de permitir acompanhar o mesmo release entre ambientes. A cota é
observada no nível da organização, portanto o segundo projeto não cria uma nova
cota gratuita independente.

Decisão após inventário: consolidar em um projeto único, preservando o projeto
com histórico, ID `4511808556564480`, hoje chamado `hub-development`. No Sprint 5
ele deverá receber um slug neutro, recomendado `hub-web`, e os três ambientes
obrigatórios. Preservá-lo evita perder a associação de 23 releases, Issues e
eventos históricos. O projeto `hub-production` está sem releases e Issues, mas
seu DSN está no bundle Production atual; portanto ele não pode ser retirado antes
de um novo deployment validado apontar para o projeto canônico.

A migração deve recriar ou ajustar alertas no projeto canônico com filtro
`environment=production`, substituir o destino dinâmico por canal institucional
monitorado, validar ingestão e source maps em Staging e Production e manter
`hub-production` sem novos eventos durante a janela de observação. Remoção ou
arquivamento só ocorrerá depois dessa janela, por ação separada e reversível
quando possível. Nenhum projeto foi renomeado, removido ou alterado nesta Sprint.

Nenhum evento sintético foi emitido. Release, source maps, evento sanitizado e
recebimento no canal institucional continuam como aceite do Sprint 5.

## 9. Viabilidade gratuita do backup

### 9.1 Limites confirmados em 23 de agosto de 2026

Neon Free:

- `0,5 GB` de armazenamento por projeto;
- `5 GB/mês` de transferência pública;
- `10` branches por projeto;
- restore de `6 h`.

Cloudflare R2 Free Standard:

- `10 GB-mês`;
- `1 milhão` de operações Classe A/mês;
- `10 milhões` de operações Classe B/mês.

O repositório GitHub é público. Os runners GitHub-hosted padrão permanecem
gratuitos para repositórios públicos; o workflow ainda deverá limitar timeout e
concorrência.

Referências:

- [Neon billing metrics](https://neon.com/docs/introduction/billing);
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/);
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions);
- [parâmetros do instalador PostgreSQL](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/).

### 9.2 Medição do dump

O cliente oficial PostgreSQL `18.6` foi baixado em diretório temporário. O
instalador teve o SHA-256
`cae561e98d09f3f4a1a95759249240f86f66d71dcf33d14b6f7be894078401d1`
validado antes da extração. Não foram instalados servidor, serviço ou atalhos.

Comando equivalente:

```text
pg_dump -Fc -Z9 --no-password --file=<temporário>
```

Resultado:

- bytes comprimidos: `167.366`;
- duração: `11,07 s`;
- dump local removido: sim;
- cliente e instalador temporários removidos: sim;
- upload: não executado.

### 9.3 Projeções

Fórmula: `bytes_dump * execuções_mensais * 1,25`.

- 6 h: `120` execuções, `25.104.900 bytes/mês`;
- 8 h: `90` execuções, `18.828.675 bytes/mês`;
- 12 h: `60` execuções, `12.552.450 bytes/mês`.

Com o uso Neon observado, 6 h projeta aproximadamente `54.915.796 bytes/mês`,
cerca de `1,02%` da cota decimal de 5 GB e muito abaixo do teto operacional de
80%. Sem considerar deduplicação ou compressão adicional, 120 objetos iguais
ocupam cerca de `20,1 MB` antes da política de retenção, também muito abaixo de
10 GB-mês do R2.

**Decisão:** RPO alvo e recomendado de `6 h`; cron a implementar no Sprint 2:
`17 */6 * * *`. Não é necessária aceitação de degradação para 8 ou 12 horas.

## 10. Gate do Sprint 0

- comandos locais: `PASS`;
- Vercel e deployment: `PASS`;
- Neon, schema e migrations: `PASS`;
- Resend e templates: `PASS`;
- DNS e inventário de remetentes: `PASS`, DMARC continua finding planejado;
- medição e cadência gratuita: `PASS`, 6 h;
- ausência de escrita em Production: `PASS`;
- Sentry: `PASS` para o inventário somente leitura; configuração de build,
  upload de source maps e canal institucional permanecem findings do Sprint 5;
- resultado agregado: `CONTINUE` para o Sprint 1.

## 11. Transição para o Sprint 1

O Sprint 0 está encerrado. O Sprint 1 iniciou no mesmo SHA base, preservando as
mudanças documentais preexistentes. O token local `org:ci` não será reutilizado
para inspeção. Sua configuração protegida no build, a consolidação dos projetos e
o evento sintético permanecem reservados ao Sprint 5.

## 12. Execução parcial da Sprint 1

Checkpoint de `2026-08-24T05:18:06Z`: a matriz granular, as projeções contextuais
de `support`, as negações diretas, a reemissão restrita do Certificado mais
recente, o fluxo TOTP/backup code e o reembolso integral estão implementados em
código e cobertos pelos testes focados. O enforcement permanece deliberadamente
desligado por default até o gate operacional com duas Contas Admin distintas.

A migration local `0065_gray_siren` adiciona o modelo exato do plugin Better Auth
`1.6.25` e os triggers de revogação de sessão. Ela passou
`db:migrations:check` e foi ensaiada na branch Neon descartável
`br-plain-field-acrxo0ru`, filha de Production. O postflight comprovou sete
colunas, um índice, dois triggers, zero seed TOTP, revogação das sessões anteriores
e preservação da sessão pós-challenge. Fixtures e branch foram removidos; nenhum
ambiente persistente recebeu a migration.

Evidência local até este checkpoint:

- gate agregado `bun run verify` aprovado;
- `docs:check`: 33 documentos canônicos válidos;
- `db:migrations:check`, `typecheck` e Ultracite aprovados;
- Vitest: 307 arquivos e 2.088 testes aprovados;
- build Next.js `16.2.11` aprovado, com as duas páginas de segundo fator
  confirmadas como dinâmicas;
- Knip: exit code `0`, com quinze sugestões de configuração já conhecidas.

Pendências do gate da Sprint 1: cadastrar TOTP em duas Contas Admin reais num
ambiente apropriado e comprovar o consumo de um backup code sem registrar segredo,
QR ou código. Production só terá `PRIVILEGED_MFA_ENFORCED=true` depois dessas
provas e de autorização de deploy.

Uma consulta explícita em transação somente leitura ao banco Development
configurado localmente encontrou uma única Conta com papel `admin`; nenhum ID ou
dado pessoal foi coletado. Portanto, o gate não pode ser simulado com duas pessoas
nesse ambiente: é necessário provisionar uma segunda Conta Admin distinta antes
do rollout. A consulta terminou em rollback e não alterou o banco.

Como preparação sem escrita externa, `db:seed:staging-admin` passou a exigir duas
Contas Admin distintas, senhas distintas de pelo menos oito caracteres e execução
atômica. Atualização de credencial/papel revoga as sessões das duas Contas. O
workflow de reset de Staging injeta os quatro secrets separados e verifica o
invariante sanitizado `2 Admins, 0 Pedidos, 0 Cursos`. O seed não gera TOTP nem
backup code e ainda não foi executado; os novos secrets também não foram criados
no GitHub Environment.

A prova integrada de assurance privilegiada também foi concluída em PostgreSQL
real. A migration completa foi aplicada somente à branch Neon descartável
`br-weathered-meadow-ac4httb1`, filha de Production. O teste passou duas vezes e
comprovou setup pelo `totpURI`, ativação e challenge TOTP, consumo único de backup
code, revogação de sessão na mudança `admin` => `support`, lockout após cinco
falhas e recusa de um TOTP válido durante o bloqueio. O `trustDevice=false` não
produziu cookie confiável. A fixture foi excluída no teardown; a branch foi
apagada e uma nova listagem confirmou sua ausência. Nenhum ambiente persistente
foi alterado e nenhum segredo, QR, código ou URL de conexão foi registrado.

Com isso, o gate técnico de TOTP, backup code, lockout e revogação por mudança de
papel está aprovado. Permanece aberto somente o gate humano de duas Contas Admin
reais em Staging, incluindo setup individual e recuperação real antes do
enforcement de Production.

## 13. Execução parcial da Sprint 2

Checkpoint de `2026-08-24T06:00:26Z`: o núcleo local do backup independente,
restore fail-closed e gate de frescor foi implementado sem criar ou alterar
recursos Cloudflare. R2 Standard foi mantido por ser a classe coberta pelo Free;
o planejamento considera 10 GB-mês, 1 milhão de operações Class A e 10 milhões
Class B, mas interrompe em 80%.

O manifesto versão 1 tem parsing estrito, migration conhecida, chaves isoladas e
retenção `frequent`/`daily`/`weekly` por UTC. A publicação envia e confirma todas
as cifras antes de publicar manifestos. `pg_dump` recebe conexão por variáveis
libpq, nunca URL/senha em argumentos. O dump claro é apagado antes do upload e o
diretório temporário é removido também em falha. O workflow fixa cron de seis
horas, Bun `1.3.11`, PostgreSQL 18 e `age` `1.3.1` com checksum oficial.

O restore recusa hosts protegidos, banco não `hub_restore_*`, catálogo não vazio,
identidade dentro do repositório, hash divergente e archive com objeto
privilegiado ou schema inesperado. Ele usa `pg_restore` com exit-on-error,
single transaction, sem owner/privileges, e postflight de journal, tabelas,
constraints e índices críticos. O deploy Production agora exige manifesto
`frequent` de no máximo seis horas e trinta minutos antes de criar a branch Neon
de release ou aplicar migration.

Evidência focal local: sete arquivos de teste, 58 testes aprovados, typecheck e
Ultracite aprovados. Ainda não existe prova de job remota, bucket privado,
Bucket Lock/lifecycle, role read-only, duas execuções reais, restore completo,
PITR, RPO ou RTO. Portanto, todos os gates finais do Sprint 2 permanecem abertos.

Gate agregado após a documentação: `docs:check` aprovou 33 documentos canônicos;
`verify:quick` aprovou migrations, typecheck, Ultracite em 827 arquivos e Vitest
com 315 arquivos e 2.154 testes. Nenhuma conexão externa é aberta por esse gate.

## 14. Sprint 3 concluída

Checkpoint de `2026-08-24T14:31:21Z`: `F-003` e `F-004` foram encerrados. O
formulário de suporte agora valida antes da conexão e executa advisory lock,
contagem, insert e outbox no mesmo client/transação. Em PostgreSQL real, quatro
requisições simultâneas da mesma Conta produziram três commits, uma rejeição,
três solicitações e três mensagens; duas Contas adquiriram locks independentes.

Avisos de expiração novos usam payload v2 fechado e chave com epoch da validade.
O delivery lê estado/validade sem filtrar `active`, classifica a geração duas
vezes antes do Resend e somente `current` resolve identidade e envia. Geração
alterada, Matrícula inativa/expirada, janela ultrapassada e payload v1 terminam
como `superseded`, com código fechado, `delivered_at` nulo, sem retry ou dead
letter. Pruning e snapshot operacional contam o terminal separadamente.

A migration `0066_gifted_retro_girl` adiciona enum, `superseded_at` e índice. O
primeiro ensaio na branch `br-holy-wildflower-achkx0vn` reverteu porque o índice
parcial gerado referenciava o novo enum na mesma transação. O índice foi tornado
não parcial; a migration passou e a segunda execução confirmou idempotência.
Nove testes integrados de suporte/expiração passaram. O script v1 passou em
dry-run e execute com zero elegíveis. Fixtures e branch foram removidos; nova
listagem confirmou ausência.

Evidência local final da Sprint: 10 arquivos/85 testes focados; integração
PostgreSQL com 2 arquivos/9 testes; `docs:check` com 33 documentos; migrations,
typecheck e Ultracite em 834 arquivos; Vitest agregado com 318 arquivos e 2.175
testes. Nenhum alvo persistente recebeu `0065` ou `0066`.

## 15. Implementação local da Sprint 4

Checkpoint de `2026-08-24T15:25:28Z`: o lifecycle Resend foi implementado sem
enviar e-mail real. A máquina de estados passou todas as transições e 5.040
permutações; `delivered` e `complained` não regridem, e evidência conflitante
fica preservada como `delivery_event_conflict`.

A migration `0067_sparkling_ghost_rider` cria `email_messages` e
`resend_webhook_events` com enums, hashes, IDs e timestamps, sem recipient,
remetente, assunto, HTML, texto, URL, token, payload ou headers. O request vira
somente HMAC-SHA256. A tentativa é gravada antes do IO, tags são fechadas,
provider ID encerra retry sem nova chamada e a deadline automática é 23 horas.

`POST /api/webhooks/resend` verifica corpo bruto e três headers Svix, grava
envelope mínimo somente após assinatura, responde 200 a duplicata/schema
inválido assinado e 503 em falha de banco. O cron de cinco minutos possui lease
próprio, doze tentativas, fila, retenção e alertas. Auditoria separa aceitos,
entregues, bounces, complaints, retries e dead letters.

`0067` passou duas vezes na branch descartável `br-falling-mouse-acqm8mw7`. Dois
testes PostgreSQL provaram webhook `delivered` antes da aceitação local e eventos
conflitantes fora de ordem; ambos convergiram sem reenvio. Fixtures e branch
foram removidos, e a ausência foi confirmada.

Evidência local: 17 arquivos/242 testes focados antes do ensaio, integração
PostgreSQL 1 arquivo/2 testes, `docs:check` com 33 documentos, migrations,
typecheck, Ultracite em 850 arquivos e Vitest agregado com 326 arquivos/2.228
testes. A Sprint permanece aberta: rota não implantada, signing secret não
configurado e nenhum evento real controlado foi recebido.

## 16. Implementação local da Sprint 5

Checkpoint de `2026-08-24T16:29:05Z`: o analisador DMARC aceita XML, GZIP ou
ZIP único com limites de entrada, expansão e razão, recusa arquivos cifrados,
DOCTYPE/ENTITY e estruturas ambíguas, e produz somente agregados sem persistir
mensagem ou identidade pessoal. O runbook mantém `p=none` até duas janelas
representativas sem fonte legítima desconhecida; progressão para `quarantine` e
`reject` continua externa, gradual e reversível.

A configuração Sentry passou a derivar `release` do SHA completo, separar
`environment`, remover query string, headers, cookies, corpos, request data,
endereço IP e usuário antes do envio e bloquear qualquer upload no modo E2E. O
build local foi executado com tokens zerados: compilou, produziu `565` source
maps internos e zero arquivo `.map` em `.next/static`. Isso prova que artefatos
de depuração não são publicados pelo Next.js, mas não substitui o upload e a
validação de source map em um deployment real.

O inventário autenticado mais recente, executado somente para leitura, encontrou
dois projetos da mesma aplicação:

- `hub-development`, ID `4511808556564480`: ambientes `development`, `staging`
  e `production`, 24 releases e 22 Issues não resolvidas;
- `hub-production`, ID `4511951566798848`: ambiente `production`, uma release,
  uma Issue não resolvida e três Issues totais.

A triagem GET repetida encontrou zero atividade nas 48 horas anteriores à
coleta. `HUB-PRODUCTION-1` e `HUB-PRODUCTION-3` estão resolvidas, tiveram uma
ocorrência e não recorreram; a única Issue não resolvida,
`HUB-PRODUCTION-2`, é uma notificação de teste com um evento, vista pela última
vez em `2026-08-22T04:00:38Z`. Nada foi resolvido ou reaberto pela auditoria e
nenhum título, stack, URL, usuário ou payload foi persistido no relatório. As
22 Issues do projeto histórico também não tiveram atividade nessa janela. Isso
reduz o risco do corte, mas não substitui o evento sanitizado e a observação do
novo DSN.

A decisão permanece consolidar em um único projeto preservando o histórico de
`hub-development`, depois renomeado para `hub-web`. O projeto Production atual
não será removido antes de triagem, troca do DSN no candidato, evento
sanitizado, source map, alerta institucional, janela de observação sem novos
eventos e rollback documentado. Nenhum projeto, DSN, alerta ou evento foi
alterado neste checkpoint.

O checker de release cruza Vercel, Neon, PostgreSQL e o documento de estado pelo
mesmo SHA, projeto, branch, migration e alias; o checker Sentry exige evento,
release, ambiente, project ID, source map e alerta. A verdade documental passou
a validar relações entre decisões, fatos derivados e planos superseded. Todos os
componentes estão verdes localmente, mas `F-006` e `F-007` permanecem abertos
até as provas reais de provider.

## 17. Implementação local da Sprint 6

Checkpoint de `2026-08-24T17:12:51Z`: toda criação, reset, seed e bootstrap de
senha usa a política compartilhada de no mínimo oito caracteres. Better Auth
recebe a mesma constante, revoga sessões no reset e mantém expiração de token em
uma hora. A busca de contrato não encontrou outro mínimo em código de produção.

A matriz Playwright agora possui projeto Chromium desktop completo para os
viewports aplicáveis e projeto Pixel 7 limitado às jornadas `@mobile`. O caso
que depende exclusivamente do menu móvel usa `@mobile-only`, portanto a matriz
final contém 41 casos: 33 desktop e oito mobile. As jornadas cobrem
landing/compra indisponível, login e
recuperação, aula e matrícula, challenge TOTP, navegação mobile, fronteira de
Suporte, gestão contextual de alunas, confirmação de reembolso sem submissão e
ciclo de Certificados. Cliente Asaas sintético e e-mail são exclusivos por
execução, evitando colisão entre projetos paralelos.

O helper Axe trata impactos `moderate`, `serious` e `critical` como falha e
registra somente ID da regra, impacto, URL de ajuda e até três seletores, sem
HTML, valor de campo ou payload. Foram adicionadas superfícies públicas,
Aluno, Suporte e Admin. O shell autenticado possui skip link visível ao foco; os
testes também exercitam Tab, Enter, Escape, retorno de foco, TOTP, crop de
Certificado, menu Suporte e confirmação destrutiva de reembolso.

Dependabot usa o ecossistema oficial `bun`, mantém GitHub Actions, agrupa apenas
minor/patch de produção e desenvolvimento e deixa major individual. Métricas
Playwright são agregadas por projeto, duração, resultado e retry; CI mantém um
retry diagnóstico e o relatório reprova qualquer retry observado.

Evidência final local:

- Ultracite: `880` arquivos, nenhuma correção necessária;
- TypeScript: `tsc --noEmit` aprovado;
- documentação: `35` documentos canônicos válidos;
- Vitest: `339` arquivos e `2.278` testes aprovados;
- build Next.js `16.2.11`: compilação, TypeScript e 20 páginas estáticas
  aprovados com token Sentry zerado;
- artefatos públicos: zero source map em `.next/static`;
- `bun audit --production`: nenhuma vulnerabilidade encontrada;
- YAML Dependabot válido e descoberta Playwright: 33 desktop, oito mobile.

O gate funcional foi executado em `2026-08-24` na branch Neon descartável
`br-gentle-leaf-a6l1zf61`, filha de `main` (`br-mute-waterfall-a6jxtobr`) no
projeto CI `red-unit-15241478`. Antes da prova final, a branch foi resetada para
o parent e recebeu a cadeia completa pelo migrador E2E usando conexão direta
não pooler. A qualificação de integração PostgreSQL aprovou 45 de 45 testes.

O Playwright compilou e iniciou a saída standalone, criou o seed protegido e
aprovou 41 de 41 casos em `7,7 min`, com um worker, zero skip, zero retry e zero
flaky. Isso incluiu Axe `moderate+`, teclado/foco/dialogs, desktop, Pixel 7,
Suporte, reembolso sintético, compra pública, Certificados e 2FA. O rate limit do
checkout foi elevado para 100 somente sob `CI=true` e `E2E_TEST_MODE=true`; o
limite de Production permaneceu em cinco tentativas por dez minutos.

O teardown removeu os objetos externos da fixture. A branch Neon foi apagada
logo após a execução e a consulta posterior retornou HTTP `404`, confirmando a
ausência. Nenhum banco persistente recebeu migration ou seed. O repositório
público usa runners padrão gratuitos e ilimitados; dois caches ativos somam
`70.698.566` bytes de 10 GB, encerrando o gate de cota. Assim, `F-008` e `F-009`
estão encerrados no working tree. `F-010` permanece implementado localmente,
mas só poderá ser encerrado quando um PR real do Dependabot alterar `bun.lock` e
passar os gates no SHA candidato remoto.
