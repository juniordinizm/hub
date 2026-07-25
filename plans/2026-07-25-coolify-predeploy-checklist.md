# Checklist de prontidão do Hub para Coolify

Base auditada: `72600abe9f85e945b15b6d81db5fb259bff22d7e`

Objetivo: remover os bloqueadores de repositório identificados na auditoria
pré-deploy e tornar o primeiro release no Coolify reproduzível, verificável e
recuperável.

## Bloqueadores de aplicação

- [x] Corrigir o SQL inválido da manutenção de Matrículas.
  - Evidência esperada: teste de regressão falha antes da correção e passa
    depois; rotina deixa de conter vírgula antes de `FROM`.
  - Concluído: removida a vírgula inválida e adicionado teste de regressão que
    foi observado falhando antes da correção e passando depois.
- [x] Atualizar dependências diretas em faixas vulneráveis.
  - Escopo: Next.js, Better Auth e Sharp, com lockfile atualizado e auditoria
    de produção revisada.
  - Concluído: Next.js atualizado para `16.2.11`, Better Auth para `1.6.25`,
    Sharp para `0.35.3`, dependências de build correlatas atualizadas e
    resoluções transitivas seguras fixadas. `bun audit --production` passou
    sem vulnerabilidades.
- [x] Fazer a configuração de produção falhar cedo quando capacidades
  obrigatórias estiverem sem ambiente.
  - Preservar liveness independente dos providers e readiness protegida.
  - Concluído: contrato central de produção valida nomes obrigatórios e
    variáveis proibidas no startup Node; liveness continua sem providers.

## Artefato de execução

- [x] Habilitar `output: "standalone"` e proteção contra version skew.
  - Incluir `deploymentId` por commit e contrato da chave estável de Server
    Actions.
  - Concluído: standalone habilitado, `deploymentId` recebe o SHA e a chave de
    Server Actions entra exclusivamente como BuildKit secret estável.
- [x] Criar Dockerfile multi-stage para `linux/arm64`.
  - Bun `1.3.11` no builder, Node LTS no runner, usuário não-root, health check,
    `public` e `.next/static`.
  - Concluído: builder Bun fixado e runtime Node 24 Debian/glibc sem root, com
    standalone completo e health check por liveness.
- [x] Criar `.dockerignore` que impeça envio de segredos e artefatos locais ao
  builder.
  - Concluído: `.env*`, Git, dependências, outputs e relatórios ficam fora do
    contexto; `.env.example` permanece disponível como contrato.
- [x] Garantir que a imagem contenha apenas runtime e ferramentas operacionais
  deliberadas.
  - Concluído: além do standalone, somente runner de cron, migrador one-shot e
    SQL versionado são copiados deliberadamente.
- [x] Adicionar build e smoke da imagem ARM64 ao CI e publicar imagem imutável
  por SHA na `main`.
  - Concluído: CI carrega e testa imagem AArch64 via QEMU, UID não-root, Sharp,
    runner e liveness; depois publica GHCR por SHA com SBOM/provenance. Build e
    smoke também passaram nativamente na VPS Oracle AArch64.

## Ambiente e segredos

- [x] Separar ambiente público de build, segredo de build, configuração de
  runtime e segredo de runtime.
  - Concluído: Dockerfile, CI e runbook definem quatro classes; segredos de
    build usam mounts e não `ARG`.
- [x] Remover a dependência do ambiente secreto completo durante
  `next build`.
  - Concluído: layout usa configuração pública mínima e o build da imagem não
    recebe credenciais de banco/providers.
- [x] Impedir que `DATABASE_URL_DIRECT`, segredos E2E e
  `INTERNAL_BOOTSTRAP_SECRET` sejam necessários no container web.
  - Concluído: contrato de produção rejeita URL direta/bootstrap; E2E e smoke
    não integram o runtime web.
- [x] Documentar a configuração exata do Coolify sem registrar valores.
  - Concluído: runbook cobre imagem por SHA, porta, domínio, health, GHCR,
    classes de ambiente e gates externos sem valores sensíveis.

## Agendamentos e trabalho assíncrono

- [x] Substituir `vercel.json` como autoridade exclusiva por um contrato de
  agendamento provider-neutral e testado.
  - Concluído: `scheduled-jobs.ts` é a autoridade tipada e um teste mantém o
    `vercel.json` temporário em paridade.
- [x] Criar runner HTTP versionado para as quatro tarefas do Coolify sem
  imprimir o bearer.
  - Concluído: runner com whitelist, Bearer em header, timeout e erro por exit
    code é empacotado na imagem sem imprimir segredo/URL.
- [x] Proteger a sincronização JMVStream contra execuções sobrepostas.
  - Concluído: advisory lock de sessão faz invocações concorrentes retornarem
    `skipped` e libera lock/conexão em `finally`.
- [x] Documentar UTC, timeout, retries, execução manual e alertas.
  - Concluído: comandos e expressões UTC, política de não sobreposição,
    repetição e sinais operacionais estão no runbook de deploy.

## Saúde, banco e releases

- [x] Aplicar timeout à conexão Postgres usada pela readiness.
  - Concluído: pool aguarda conexão por no máximo um segundo e limita conexões.
- [x] Fazer a readiness validar a migration mínima compatível.
  - Concluído: readiness exige o timestamp atual do journal; teste impede que
    o marcador fique atrás de migrations futuras.
- [x] Manter `/api/health` como liveness e usar `/api/health/ready` no smoke
  autenticado.
  - Concluído: Docker usa liveness pública; readiness autenticada e consciente
    do schema fica reservada ao smoke de release.
- [x] Definir migration one-shot com lock e política expand/contract; nunca
  migrar no startup do web container.
  - Concluído: migrador separado exige URL direta e advisory lock; está
    disponível por Bun e na imagem, sem vínculo com o entrypoint web.
- [x] Documentar rollback por imagem imutável e compatibilidade de schema.
  - Concluído: rollback fixa SHA anterior e exige compatibilidade forward do
    schema; reset/rollback SQL continuam proibidos.

## Segurança de borda

- [x] Remover a preferência por segredo de webhook em query string ou tornar o
  fallback legado explicitamente controlado e não registrável.
  - Concluído: documentação oficial confirmou que query + HMAC é o contrato
    atual, não legado; preservado o fluxo compatível e proibido log de query.
- [x] Tornar a resolução do IP do cliente consciente da cadeia de proxies.
  - Concluído: fonte explícita Traefik/Cloudflare, validação IPv4/IPv6 e
    reutilização em checkout/rate limit substituem parsing duplicado.
- [x] Adicionar cabeçalhos HTTP de endurecimento compatíveis com Next.js,
  JMVStream e Sentry.
  - Concluído: CSP compatível com HTTPS/frame/media, HSTS em produção,
    nosniff, referrer, permissions policy e negação de framing.
- [x] Documentar proteção do painel, 2FA, atualizações deliberadas, alertas e
  recuperação do control plane como gate externo ao repositório.
  - Concluído: runbook separa claramente os controles da VPS/Coolify que o
    repositório não pode comprovar.

## Verificação final

- [x] `bun run docs:check`
  - Concluído: 23 documentos canônicos válidos.
- [x] `bun run db:migrations:check`
  - Concluído: cadeia, journal, snapshots e catálogo válidos.
- [x] `bun run typecheck`
  - Concluído: TypeScript sem diagnósticos.
- [x] `bun run check`
  - Concluído: Ultracite verificou 515 arquivos sem erro.
- [x] `bun run test`
  - Concluído: 147 arquivos e 558 testes passaram.
- [x] `bun run test:certificates:integration` em banco descartável
  - Concluído: migration one-shot e 15 testes passaram em branch temporária
    Neon PostgreSQL 18, excluída após a execução.
- [x] `bun run build`
  - Concluído: Next.js 16.2.11 compilou, tipou e gerou 14 páginas estáticas.
- [x] `bun run knip`
  - Concluído: sem achados bloqueantes; apenas hints da baseline já
    documentada.
- [x] `bun audit --production`
  - Concluído: nenhuma vulnerabilidade encontrada.
- [x] `git diff --check`
  - Concluído: diff sem erro de whitespace.
- [x] Build e smoke real da imagem `linux/arm64`
  - Concluído: build nativo AArch64 passou; imagem confirmou `arm64`, UID 1001,
    Sharp 0.35.3, ferramentas operacionais e health `healthy`.
- [x] Auditoria final requisito por requisito deste checklist
  - Concluído: todos os bloqueadores de repositório têm implementação,
    documentação e evidência; controles externos permanecem explicitamente
    fora do alcance do código.

## Controles externos registrados

Estes itens não são alterações da branch e exigem operação no Coolify/Oracle:

- ativar 2FA para a conta administradora;
- desativar auto-update do Coolify;
- configurar notificação de falha de deploy, task, backup, disco e servidor;
- preservar `APP_KEY` e chaves SSH fora da VPS;
- testar restauração do backup S3;
- restringir SSH por IP ou VPN.
