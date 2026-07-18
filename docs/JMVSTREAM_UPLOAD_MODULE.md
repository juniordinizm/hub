# Modulo JMVStream Upload de Video

Este documento descreve a integracao de upload de video do admin com a JMVStream.

## Objetivo

O modulo permite enviar videos grandes pelo admin, vincular cada video a uma aula, aguardar o processamento da JMVStream e exibir o player oficial para a aluna somente quando ele existir.

## Arquivos principais

- `src/features/jmvstream/client.ts`: client HTTP server-only da API JMVStream.
- `src/features/jmvstream/server.ts`: regras de negocio, assets locais, pastas, sync, delecao e reconciliacao.
- `src/features/jmvstream/upload.ts`: upload direto do navegador para URLs assinadas S3/JMVStream.
- `src/features/jmvstream/upload-config.ts`: tamanho de partes e concorrencia do upload.
- `src/components/jmvstream-upload-panel.tsx`: UI do admin para enviar, acompanhar, sincronizar e remover video.
- `src/components/lesson-kind-controls.tsx`: integra upload, link manual, preview e campos do formulario da aula.
- `src/components/lesson-video-editor-preview.tsx`: preview do admin, incluindo estado de processamento.
- `src/components/lesson-video-player.tsx`: player da aluna quando `video_embed_url` existe.
- `src/app/api/cron/jmvstream/route.ts`: reconciliacao periodica de videos em processamento.
- `src/db/schema.ts` e `src/db/migrations/0005_*`, `0013_*`, `0014_*`: tabela `jmvstream_video_assets`, pastas e enums.

## Dependencias externas

A JMVStream confirmou que:

- Nao existe token temporario/scoped para upload.
- O JWT Bearer normal e o unico mecanismo de autenticacao.
- Nao existe webhook de upload/transcoding pronto.
- `GET /v1/videos/application` retorna `playerSource` e `player` quando o VOD esta pronto para uso.
- O upload TUS aceita CORS direto, mas exigiria expor o JWT normal no frontend.

Por isso, o projeto usa S3 multipart com URLs assinadas, nao TUS direto e nao proxy pela Vercel.

## Variaveis

Nenhuma chave JMVStream deve ser `NEXT_PUBLIC_*`.

```env
JMVSTREAM_API_BASE_URL=https://api.jmvstream.com
JMVSTREAM_PLAN_ID=
JMVSTREAM_AUTH_RESOURCE=
JMVSTREAM_API_TOKEN=
CRON_SECRET=
```

`JMVSTREAM_PLAN_ID` pode aparecer como `OD-20790` em alguns contextos comerciais, mas o endpoint de delete da JMVStream espera o id numerico. O client normaliza `OD-20790` para `20790` apenas no path de delecao.

## Fluxo de upload

1. Admin seleciona o arquivo na aula.
2. Server action `initJmvstreamUploadAction` chama `initJmvstreamUpload`.
3. `initJmvstreamUpload` garante a pasta do curso, chama `/v2/upload/multipart/s3` e grava um asset local:
   - `lesson_id`
   - `course_id`
   - `module_id`
   - `video_hash`
   - `upload_id`
   - `object_name`
   - `gallery_uuid`
   - `upload_status = 'uploading'`
   - `delete_status = 'none'`
4. Browser envia as partes direto para as URLs assinadas.
5. Cada PUT precisa retornar `ETag`; sem `ETag`, o complete nao e seguro.
6. Server action `completeJmvstreamUploadAction` chama `/v2/upload/multipart/complete`.
7. Se a JMVStream ja retornar player oficial, a aula recebe:
   - `video_external_id = video_hash`
   - `video_embed_url = playerSource`
   - `thumbnail_url`
   - asset `ready`
8. Se a JMVStream ainda nao retornar player, a aula recebe `video_external_id`, mas `video_embed_url` fica `null` e o asset fica `processing`.

## Contrato entre aula e video

O video da aula e um lifecycle independente do formulario editorial da aula.

- `Salvar aula` salva titulo, descricao, conteudo, ordem, status e duracao.
- Upload JMVStream nao depende do botao `Salvar aula`: quando o complete termina, o servidor grava `lessons.video_external_id` imediatamente.
- Remover video JMVStream tambem e acao imediata: limpa a aula e tenta deletar o video remoto.
- O save da aula nao pode apagar assets JMVStream por inferencia quando o formulario nao trouxe video. Isso preserva uploads `uploading`/`processing` e evita videos remotos orfaos quando o admin salva metadados durante um upload.
- A limpeza de asset JMVStream no save so acontece quando existe intencao explicita de substituicao/remocao, como trocar um upload salvo por link manual ou marcar `removeVideo`.

### Troca de video

Ao trocar um upload existente por outro upload:

1. O video antigo continua sendo o video atual da aula enquanto o novo arquivo e enviado.
2. O novo upload cria uma nova sessao vinculada a mesma aula.
3. Depois do complete, a aula passa a apontar para o novo `video_hash`.
4. So depois desse vinculo local existir o sistema tenta apagar assets antigos da aula.
5. Se a JMVStream falhar ao apagar o antigo, o asset fica com `delete_status = 'failed'` e retry visivel no admin; a aula ja permanece vinculada ao novo video.

Ao trocar um upload existente por link manual, o save passa a ter uma intencao explicita de substituicao: o link manual e salvo na aula e o asset JMVStream antigo entra no fluxo de delecao/retry.

## Estados

### `uploading`

O arquivo esta sendo enviado ou a sessao foi criada. O admin mostra progresso real. Se a aba for fechada durante envio de bytes, o navegador aborta o upload e o asset antigo sera marcado como falha pela rotina de stale upload.

### `processing`

O arquivo ja chegou na JMVStream, mas o player oficial ainda nao apareceu em `GET /v1/videos/application`.

Comportamento esperado:

- Admin mostra “Video em processamento”.
- Admin pode clicar em “Verificar player agora”.
- A pagina aberta faz polling leve a cada 15 segundos.
- A rota cron `/api/cron/jmvstream` tenta sincronizar assets `processing` mesmo sem navegador aberto.
- A area da aluna mostra um placeholder claro em vez de parecer aula quebrada.

### `ready`

`video_embed_url` oficial existe e o player pode ser renderizado.

### `failed`

Upload falhou antes do complete ou a sessao expirou. O admin deve reenviar ou limpar/remover.

## Reconciliacao

Como a JMVStream nao oferece webhook, a reconciliacao e ativa:

- Manual: `syncJmvstreamLessonPlayerAction` no botao “Verificar player agora”.
- Browser: polling leve na aula enquanto o asset esta `processing`.
- Cron: `GET /api/cron/jmvstream`, protegido por `CRON_SECRET`, executado pelo `vercel.json` a cada 5 minutos.

O reconciliador chama `syncPendingJmvstreamPlayers`, que busca assets `processing`, chama `syncJmvstreamLessonPlayer` e grava `ready` quando `playerSource` aparece.

## Organizacao na JMVStream

O projeto usa uma pasta por curso, criada no save do curso e garantida antes do upload. Todos os videos do curso vao para essa pasta. Se a JMVStream deixar o video em `default`, o Hub tenta mover o video para a pasta do curso apos o complete ou durante a sincronizacao.

## Delecao

Ao remover video da aula ou deletar a aula, o sistema:

1. Busca assets por `lesson_id` e/ou `video_external_id`.
2. Chama `DELETE /v1/videos/deleteVideo/[videohash]/[planid]`.
3. Se a JMVStream retorna erro, lista videos em `/v1/videos/application`.
4. Se o hash nao aparece mais, marca localmente como `deleted`.
5. Se o hash ainda aparece, marca `delete_status = 'failed'` e deixa retry visivel no admin.

A pasta do curso nao e apagada quando a ultima aula e removida. Ela e uma unidade operacional estavel do curso.

## Protecao contra Vercel estourar

O projeto nao proxyia bytes de video pela Vercel. O upload de partes e direto browser -> JMVStream/S3 usando URLs assinadas. Server actions apenas iniciam/finalizam metadados e nunca recebem o arquivo de video.

Para funcionar, a JMVStream/S3 precisa permitir CORS para o dominio do admin e expor `ETag`.

## Comportamento ao sair da pagina

- Durante envio de bytes, o painel registra `beforeunload` para avisar antes de fechar/recarregar.
- Se o usuario fecha mesmo assim, o upload em andamento pode ser abortado pelo navegador.
- Assets `uploading` antigos sao marcados como `failed` pela limpeza de stale upload.
- Depois que o complete terminou e o asset esta `processing`, sair da pagina nao e problema: cron e sync manual continuam resolvendo o player.

## Falhas conhecidas e resposta esperada

- CORS ou `ETag` ausente: falha clara no admin e sem complete especulativo.
- Player demora varios minutos: asset fica `processing`, admin/aluna veem placeholder e cron reconcilia.
- JMVStream retorna 500 ao deletar: sistema verifica se o hash ainda existe; se existir, deixa retry.
- Video fica em `default`: sync tenta mover para a pasta do curso.
- JWT expira: servidor renova via `POST /v2/authenticate` usando o UUID server-only do recurso.

## Checklist manual

1. Criar curso e confirmar pasta na JMVStream.
2. Criar aula e enviar MP4 pequeno.
3. Confirmar asset `uploading` durante envio.
4. Confirmar asset `processing` se o player ainda nao apareceu.
5. Confirmar placeholder na area da aluna enquanto processa.
6. Rodar `GET /api/cron/jmvstream` com `Authorization: Bearer $CRON_SECRET`.
7. Confirmar `video_embed_url` preenchido quando `playerSource` aparece.
8. Remover video da aula e confirmar delecao ou retry pendente.
