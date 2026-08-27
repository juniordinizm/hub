---
status: runbook
owner: operations
last_verified_commit: 76e77e68f9a14f2f96f3412917bf3d3c08de398c
---

# Backup Production e restauração

## Estado e limites

O código, os testes e os workflows estão implementados em `main`. O bucket R2
dedicado e o GitHub Environment `production-backup` já existem. Lock/lifecycle
foram lidos de volta e os objetos descartáveis das três classes recusaram remoção
durante o lock. As execuções `33023906420` e `33026369149` passaram
consecutivamente; a primeira publicou `frequent`, `daily` e `weekly`, e a segunda
publicou `frequent` e `daily` conforme a regra de calendário. O checker de frescor
passou. PITR, restore e RPO/RTO continuam sem prova externa. Até essas provas
passarem, `F-002` e o gate do Sprint 2 permanecem abertos.

O desenho usa exclusivamente planos gratuitos: Neon Free para origem/PITR
disponível e Cloudflare R2 Standard Free para a cópia independente. A reserva
operacional é 20%: no Free atual, o limite interno é 8 GB-mês, 800 mil operações
Class A e 8 milhões Class B. O código testa 6, 8 e 12 horas nessa ordem, mas o
workflow executa a decisão registrada de seis horas; nunca muda a agenda em
runtime nem habilita compra automática.

Checkpoint externo somente leitura de `2026-08-25` (histórico):

- o R2 Standard Free continua oferecendo 10 GB-mês, 1 milhão de operações
  Class A, 10 milhões Class B e egress gratuito;
- as credenciais S3 locais provaram `HeadBucket` e `ListObjectsV2` no bucket da
  aplicação, mas ele não é o bucket exclusivo de backup e não pode ser usado
  para encerrar este gate;
- Wrangler `4.125.0` não possui sessão administrativa local, portanto Bucket
  Lock, lifecycle e estado público do futuro bucket de backup continuam sem
  leitura autenticada;
- o GitHub ainda não possui o Environment `production-backup`, seus secrets ou
  variables; o workflow existe apenas na branch de remediação e a API retorna
  `404` ao procurá-lo na branch padrão;
- o Neon Free mantém janela PITR máxima de seis horas e 1 GB de histórico. A
  branch `production` está pronta, mas não protegida; proteção de branch exige
  plano pago e não será usada como pressuposto deste desenho gratuito;
- duas branches temporárias `production-release-*` expiram em `2026-09-05`.
  Elas ajudam rollback de release, mas não substituem PITR ensaiado nem a cópia
  cifrada externa.

Esse checkpoint registrava o estado anterior ao provisionamento. Não o use para
descrever o estado atual.

## Estado atual — 2026-08-26

- bucket dedicado: `neurocapacitar-production-backups`;
- Environment: `production-backup`, com os nomes de secrets/variables exigidos
  pelo workflow, sem valores versionados ou exibidos neste documento;
- classes `frequent`, `daily` e `weekly`: lock recusou `delete-object` com exit
  code `254` e o `HEAD` confirmou expiração configurada para cada objeto de teste;
- execução `32929589649`: falhou antes do dump por PATH do cliente PostgreSQL;
- execução `32931613267`: PostgreSQL 18 disponível, falha sanitizada `database`;
- execuções posteriores até `32982879681`: alias/proveniência passaram após a
  correção do checker; a falha inicial foi `configuration-database`;
- `32993456881` e `32996629032`: o contrato de conexão passou, mas a versão
  retornada pelo Neon (`18.6 (3484359)`) era rejeitada pelo checker e pelo
  parser de manifesto; essa incompatibilidade foi corrigida e passou no CI;
- `33014013409` e `33015400778`: PostgreSQL 18.6, migration, role, inspeção e
  leitura do bucket R2 passaram; o `pg_dump` falhou antes de iniciar a leitura
  do catálogo;
- os diagnósticos controlados `33017255733`–`33018947445` confirmaram que todas
  as variantes falham na conexão TLS. A assinatura sanitizada combina conexão
  ao servidor com arquivo inexistente; nenhum stderr bruto foi preservado;
- causa operacional identificada: o libpq do runner Ubuntu tentava o CA padrão
  ausente. O workflow agora fornece explicitamente
  `/etc/ssl/certs/ca-certificates.crt` por `PGSSLROOTCERT`, mantendo
  `sslmode=verify-full`;
- `33019958869`: o `pg_dump` concluiu após a correção TLS; o PUT da cifra no R2
  falhou com uma requisição streaming não reexecutável, antes de qualquer
  manifesto;
- o probe controlado `33022570244` confirmou que `Buffer` passa em 1, 8 e 32 MB,
  enquanto `Readable` falha com `IncompleteBody`/`ECONNRESET`; a cifra agora é
  carregada como `Buffer` replayável antes dos PUTs;
- `33023906420`: backup completo passou em `main`, com `pg_dump` 18.6, cifra
  de 205748 bytes, manifestos `frequent`/`daily`/`weekly` e seis objetos
  confirmados por HEAD;
- `33026369149`: segunda execução manual consecutiva passou em 1m03s, com
  `pg_dump` 18.6, cifra de 210286 bytes e manifestos `frequent`/`daily`; a
  classe `weekly` não é criada fora da primeira execução de segunda-feira;
- o manifesto `frequent` mais recente (`e0b48105-1496-4837-b81e-af30f0063781`)
  registra migration `0067_sparkling_ghost_rider`, `cadenceHours=6` e
  `retentionClasses=[frequent,daily]`;
- o checker local `ops:check:production-backup` passou com status `fresh`;
- o manifesto `frequent` é válido e fresco, mas o gate de release e o restore
  permanecem fechados até usar uma credencial R2 read-only separada;
- a role read-only, PITR, restauração em target descartável e medição de RPO/RTO
  ainda precisam de prova; a observação de uma execução agendada permanece
  pendente, pois as duas execuções acima foram disparadas manualmente.

Formato esperado, usando placeholders que nunca devem ser substituídos neste
arquivo:

```text
postgresql://<backup_role>:<url_encoded_password>@<PRODUCTION_DATABASE_HOST>/<database>?sslmode=verify-full
```

Use a conexão **direct** da branch Production, não a conexão pooled. Se o
provider incluir `channel_binding=require`, ele é aceito; remova parâmetros
adicionais como `connect_timeout`, `options` ou `application_name` antes de
guardar a URL no secret.

Na projeção de 30 dias/120 execuções, cada run faz uma listagem e dois PUTs por
classe; cada classe também recebe um HEAD de confirmação. Com 30 cópias diárias
e até cinco semanais, o steady state soma aproximadamente 430 operações Class A
e 155 Class B por mês. Isso usa menos de 0,06% da reserva interna Class A e menos
de 0,002% da reserva Class B. Um gate de release acrescenta uma listagem, um GET
de manifesto e um HEAD; restore, retries e testes controlados devem ser medidos
separadamente, sem invalidar o limite de 80%.

## Fronteiras de segurança

- dump claro existe somente num diretório temporário do runner e é apagado logo
  após hash e cifragem;
- a cifra usa `age` X25519 `1.3.1`; somente o recipient público entra no GitHub;
- a identidade privada possui duas cópias offline sob custódias diferentes;
- dump, cifra, manifesto completo, URL, host, usuário e credencial não entram em
  artifact, summary, ticket ou relatório;
- bucket de backup é privado e exclusivo, sem domínio, `r2.dev`, CORS ou acesso
  público;
- credencial do workflow possui apenas Object Read & Write nesse bucket;
- restore e deploy usam outra credencial, somente Object Read;
- administração de bucket usa credencial temporária separada;
- nenhum comando de restore aceita Production, Staging, Development persistente,
  compute protegido ou banco cujo nome não comece por `hub_restore_`;
- nenhuma venda real faz parte deste exercício.

## Provisionamento sem expor credenciais

Faça todas as etapas no painel do provider ou no seu terminal autenticado. Nunca
cole token, senha, URL de banco, recipient privado ou identidade neste chat, em
issue, commit ou arquivo do repositório.

### 1. Role PostgreSQL somente leitura

Crie uma role Neon exclusiva sem senha literal em SQL salvo. Gere/defina a senha
no painel ou com prompt interativo e guarde somente no secret
`BACKUP_DATABASE_URL` do GitHub Environment `production-backup`.

O contrato da role é:

```sql
create role hub_backup login;
grant pg_read_all_data to hub_backup;
alter role hub_backup set default_transaction_read_only = on;
alter role hub_backup set statement_timeout = '30min';
alter role hub_backup set lock_timeout = '10s';
```

A role não recebe ownership, DDL, escrita nem associação à credencial do
runtime. Antes de Production, clone a branch em um alvo descartável e prove:

1. `SELECT` e `pg_dump --format=custom` funcionam;
2. `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE` e `ALTER TABLE` falham;
3. `current_setting('default_transaction_read_only')` retorna `on`;
4. `pg_has_role(current_user, 'pg_read_all_data', 'member')` retorna `true`;
5. a branch descartável é removida.

Em Production, a automação executa apenas inspeção read-only e `pg_dump`.

### 2. Bucket R2 dedicado

Crie um bucket R2 Standard com nome institucional exclusivo. Não habilite
custom domain, `r2.dev`, CORS ou acesso público. Registre o nome em
`BACKUP_R2_BUCKET_NAME` e o Account ID em `BACKUP_R2_ACCOUNT_ID`; ambos são
variables, não secrets.

Crie três credenciais diferentes:

1. backup: Object Read & Write apenas no bucket;
2. restore/release: Object Read apenas no bucket;
3. operação temporária: administração do bucket para configurar e ler regras.

Guarde as duas primeiras como secrets nos environments correspondentes. Revogue
a terceira depois de ler de volta a configuração.

### 3. Bucket Lock e lifecycle

As regras alcançam cifra e manifesto. Configure prefixos separados; Bucket Lock
tem precedência sobre lifecycle.

| Classe | Prefixo da cifra | Prefixo do manifesto | Lock mínimo | Expiração |
|---|---|---|---:|---:|
| frequent | `postgres/production/frequent/` | `postgres/production/manifests/frequent/` | 1 dia | 2 dias |
| daily | `postgres/production/daily/` | `postgres/production/manifests/daily/` | 7 dias | 8 dias |
| weekly | `postgres/production/weekly/` | `postgres/production/manifests/weekly/` | 28 dias | 29 dias |

Use Wrangler atual no terminal já autenticado. Para cada um dos seis prefixos,
adicione uma regra de lock e uma regra de expiração, por exemplo:

```powershell
npx wrangler@latest r2 bucket lock add $env:BACKUP_R2_BUCKET_NAME frequent-cipher postgres/production/frequent/ --retention-days 1
npx wrangler@latest r2 bucket lifecycle add $env:BACKUP_R2_BUCKET_NAME frequent-cipher-expiry postgres/production/frequent/ --expire-days 2
```

Repita com nomes únicos para os manifestos e classes diária/semanal. Depois use
os comandos `lock list`, `lifecycle list` e `bucket info` da mesma versão do
Wrangler e registre apenas nome do bucket, IDs/nome das regras, prefixos,
períodos e estado público desabilitado.

Crie um objeto descartável sem conteúdo sensível em cada classe. Tente apagá-lo
durante o lock e registre a recusa sanitizada. A confirmação do lifecycle só
fecha depois que um objeto de teste ultrapassar a expiração e desaparecer sem
intervenção.

## GitHub Environment `production-backup`

Configure sem passar valores pela linha de comando ou por este chat:

- secrets: `BACKUP_DATABASE_URL`, `BACKUP_R2_ACCESS_KEY_ID`,
  `BACKUP_R2_SECRET_ACCESS_KEY`, `NEON_API_KEY` e `VERCEL_TOKEN`;
- variables: `BACKUP_R2_ACCOUNT_ID`, `BACKUP_R2_BUCKET_NAME`,
  `BACKUP_AGE_RECIPIENT`, `PRODUCTION_DATABASE_HOST`,
  `PRODUCTION_NEON_BRANCH_ID`, `PRODUCTION_NEON_PROJECT_ID`, `VERCEL_ORG_ID`
  e `VERCEL_PROJECT_ID`.

O Environment `vercel-production` também possui as variables não sensíveis
`BACKUP_R2_ACCOUNT_ID` e `BACKUP_R2_BUCKET_NAME`. As secrets
`RESTORE_R2_ACCESS_KEY_ID` e `RESTORE_R2_SECRET_ACCESS_KEY` foram configuradas
nesse Environment. Isso libera a execução do checker protegido, mas a presença
nominal não prova conteúdo nem conectividade; o gate e o restore continuam sem
prova até serem executados. Não reutilize as credenciais de escrita do workflow
como solução permanente.

O workflow define a variável não sensível `PGSSLROOTCERT` como
`/etc/ssl/certs/ca-certificates.crt` no runner Ubuntu. Ela é necessária para o
`pg_dump` validar o certificado do host quando `sslmode=verify-full` está ativo;
não deve ser adicionada à URL nem ao secret.

No restore local em Windows, defina `PGSSLROOTCERT` para um bundle confiável de
certificados raiz antes de executar o comando. O script preserva esse valor e o
`PATH` da sessão ao iniciar `age` e `pg_restore`, e passa o conteúdo do CA ao
`Pool` do Node. Não troque `verify-full` por `require` para contornar uma falha
de certificado.

O recipient é público. As identidades privadas nunca entram no GitHub. O
workflow `.github/workflows/backup-production-database.yml` usa cron literal
`17 */6 * * *`, dispatch manual, `cancel-in-progress: false` e summary
sanitizado.

## Execução do backup

O comando guardado é `bun run ops:backup:production`. Ele:

1. lê Vercel e Neon sem mutação e prova que o deployment Production `READY`, o
   SHA implantado, o projeto Vercel, o projeto/branch Neon, o endpoint ativo e o
   host direto do dump formam a mesma origem;
2. valida role read-only, PostgreSQL 18, journal e tamanho lógico positivo;
3. executa `pg_dump` custom, compressão 9, sem owner/ACL e sem URL na lista de
   argumentos; o libpq valida TLS com `sslmode=verify-full` e o CA bundle do
   runner em `PGSSLROOTCERT`;
4. calcula bytes e SHA-256 do dump;
5. cifra para arquivo novo e apaga o dump claro;
6. calcula tamanho e SHA-256 da cifra;
7. recusa projeção acima de 80% do Free;
8. carrega a cifra como `Buffer` replayável e envia `frequent` e as cópias
   diária/semanal aplicáveis com PUT condicional; isso evita reutilizar um
   `Readable` consumido quando o SDK reexecuta uma tentativa;
9. confirma HEAD/tamanho/hash de todas as cifras;
10. publica por último manifestos que registram somente a proveniência
    sanitizada, incluindo projeto/branch Neon, SHA realmente implantado, tamanho
    lógico e bytes do dump;
11. remove o diretório temporário no `finally`.

Duas execuções consecutivas devem produzir IDs e chaves diferentes. Inspecione
o workspace e o diretório temporário do runner: nenhum `.dump`, `.age` ou
manifesto deve permanecer.

## Gate de release

`bun run ops:check:production-backup` usa a credencial read-only, encontra o
manifesto `frequent` mais recente, faz parsing estrito, exige migration conhecida
e compara HEAD, tamanho e SHA-256 metadata. A idade máxima é RPO de seis horas
mais trinta minutos.

`deploy-vercel.yml` executa esse gate antes de criar a branch Neon de release e
antes de aplicar migrations. Em falha, dispare manualmente o workflow de backup,
aguarde a execução verde e reinicie o deploy. Não edite manifesto, não substitua
o bucket e não remova o step.

## Restauração da cópia externa

### Preparação

1. crie PostgreSQL 18 descartável cujo database comece por `hub_restore_`;
2. confirme que host não é nenhum compute persistente e que o catálogo está
   vazio;
3. disponibilize temporariamente a credencial R2 read-only;
4. monte uma das identidades `age` offline como arquivo legível fora do
   repositório; mantenha a segunda selada;
5. selecione uma chave de manifesto exata em
   `postgres/production/manifests/{classe}/`;
6. configure a confirmação literal
   `RESTORE_DISPOSABLE_PRODUCTION_BACKUP`.

O comando é `bun run ops:restore:production-backup`. Ele baixa a cifra, verifica
tamanho/hash, valida versões, decifra, verifica o hash do dump, inspeciona
`pg_restore --list`, exige target vazio e executa:

```text
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges
```

A conexão é passada por variáveis libpq, não por argumento. O postflight exige
journal exato, pelo menos 43 tabelas vigentes, constraints, quatro índices
críticos e queries agregadas sem PII. O resultado mostra somente backup ID,
migration, quantidade de tabelas, RTO e status.

Depois, inicie a aplicação no SHA do manifesto contra o target, execute
readiness e os smokes não financeiros. Registre início, conclusão e RTO. Revogue
a URL/credencial do target e remova banco ou branch somente após confirmar o ID
exato. O exercício só passa quando o target inteiro é removido e a identidade
offline volta à custódia.

## Ensaio PITR

Crie uma branch Neon descartável a partir de um timestamp dentro das últimas
seis horas. Leia de volta parent e timestamp, execute readiness/smoke e remova a
branch. Meça:

- RPO: diferença entre o ponto recuperado ou `createdAt` e o incidente simulado;
- RTO: início do procedimento até readiness verde.

PITR e restore R2 são provas independentes; uma não substitui a outra.

## Evidência permitida

Registre somente SHA, ambiente, backup ID, migration, horário UTC, bytes,
classes, idade, RPO, RTO, quantidade de tabelas, nomes/IDs não secretos das
regras e resultado. Proibido registrar URL, host completo se protegido, usuário,
senha, token, recipient privado, identidade, QR, dump, cifra, manifesto completo,
payload ou PII.

## STOP

Interrompa se dump claro persistir, identidade entrar no GitHub, bucket estiver
público, role aceitar escrita, target não estiver vazio/descartável, hash ou
migration divergir, arquivo listar objeto privilegiado/schema inesperado, cota
projetada ultrapassar 80%, PITR/restore ficar parcial ou RPO/RTO não for medido.
