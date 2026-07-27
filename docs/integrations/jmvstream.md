---
status: canonical
owner: engineering
last_verified_commit: 4b3c9b8a80b3bf3628b53c983dfd56d7ebec5b8d
---

# JMVStream

## Responsabilidade

Hospedar vídeo, organizar galerias por Curso e fornecer player/thumbnail. O Hub persiste a sessão operacional e relaciona `video_hash` à Aula.

Contrato oficial consultado: [Public API JMVStream](https://jmvstream.com/en/developer), que documenta upload multipart direto e `gallery` opcional no complete. Em 2026-07-27, o recurso configurado autenticou e a consulta somente leitura retornou as três pastas reais. CORS, upload multipart e o contrato `gallery` continuam dependendo de um envio funcional controlado.

## Configuração correta

- `JMVSTREAM_API_BASE_URL`: default `https://api.jmvstream.com`.
- `JMVSTREAM_AUTH_RESOURCE`: UUID do recurso/aplicação enviado a `/v2/authenticate`; não é e-mail, senha nem JWT.
- `JMVSTREAM_API_TOKEN`: JWT opcional de fallback.
- `JMVSTREAM_PLAN_ID`: identificador usado em operações que exigem plano.

Preferir `JMVSTREAM_AUTH_RESOURCE`; `authenticateJmvstreamApi` renova token. `assertValidJmvstreamResource` rejeita valor que não pareça UUID e orienta quando recebeu JWT.

## Modelo local

- `jmvstream_folders`: pasta por Curso/Módulo, estados `active`, `failed`, `needs_review`.
- `jmvstream_video_assets`: upload, player, thumbnail e deleção.
- estados de upload incluem sessão ativa, processamento, pronto e falha conforme enums de `src/db/schema.ts`.

O registro local não substitui o ativo externo; ambos precisam ser reconciliados.

## Upload multipart

1. `ensureJmvstreamCourseFolder` localiza/cria galeria do Curso.
2. `initJmvstreamUpload` valida arquivo, calcula partes e chama `/v2/upload/multipart/s3`.
3. O navegador executa `uploadFileParts` diretamente nas URLs assinadas.
4. Cada PUT retorna ETag; o cliente coleta `{ partNumber, etag }`.
5. `completeJmvstreamUpload` chama `/v2/upload/multipart/complete`.
6. `syncJmvstreamLessonPlayer` busca player/thumbnail e associa à Aula.

Parâmetros em `src/features/jmvstream/upload-config.ts`:

- chunk 64 MiB;
- concorrência 4;
- mínimo multipart 5 MiB;
- máximo 10.000 partes;
- máximo 5 TiB.

Arquitetura e racional: [ADR-0003](../adr/0003-jmvstream-direct-multipart-upload.md).

## Contradição `gallery`

A documentação histórica do projeto orientava omitir `gallery` no complete. `createJmvstreamClient.completeMultipartUpload`, no `HEAD`, sempre envia `gallery: input.galleryUuid`; a documentação oficial atual define o campo como opcional.

Isso permanece bloqueio de contrato, não uma correção assumida. Antes de mudar:

1. capturar request/response em ambiente de teste sem secrets;
2. confirmar se o UUID de `jmvstream_folders` é o valor aceito no complete;
3. testar com e sem o campo;
4. registrar o contrato validado e adicionar teste.

Até lá, a documentação descreve o payload real do código e não promete compatibilidade de produção.

## Sincronização e limpeza

- cron `/api/cron/jmvstream` chama `syncPendingJmvstreamPlayers` a cada cinco minutos;
- a execução adquire advisory lock de sessão; uma segunda invocação retorna
  `skipped` sem repetir chamadas externas;
- `expireStaleJmvstreamUploads` marca sessões abandonadas;
- remoções chamam funções por Aula/Módulo/Curso e persistem falha para retry;
- `retryJmvstreamAssetDelete` só deve operar após conferir o hash;
- upload manual por URL usa `syncManualJmvstreamVideoAsset`.

## Falhas e recuperação

- 401/403 => conferir resource/token e autenticação, sem expor valores;
- CORS/ETag ausente => conferir origem, métodos PUT e headers expostos no provedor;
- parte falhou => repetir a parte, preservando ETags válidos;
- complete falhou => não criar nova sessão até consultar estado da atual;
- player pendente => cron/manual sync;
- player com ativo local `failed` => a experiência da Aluna interrompe o polling e oferece suporte; não expor `last_error` do provedor;
- deleção falhou => manter registro `needs_review` e tentar pelo comando autorizado;
- hash já associado => `assertJmvstreamVideoHashAvailable` deve impedir duplicidade.

## Segurança

URLs assinadas são temporárias; credenciais ficam server-only. Validar tipo/tamanho antes de iniciar. Não logar token, URLs assinadas completas ou payload com credenciais.

## Retomada de reprodução

O Hub persiste `current_seconds` e `max_position_seconds`. Depois de receber um evento válido do player em resposta a `jmvplayer-sync`, envia `jmvplayer-jump` com a última posição (`jump`) para restaurar a Aula sem iniciar nem concluir automaticamente. A primeira resposta após o salto é descartada pela gravação de progresso para impedir conclusão por reabertura.

O comando é documentado na página oficial de eventos do player, marcada pelo próprio provedor como referência antiga; ele deve ser confirmado contra um player real antes de promover uma mudança de versão da integração.

## Evidências

- cliente: `src/features/jmvstream/client.ts`;
- upload browser: `src/features/jmvstream/upload.ts`;
- orquestração: `src/features/jmvstream/server.ts`;
- ações: `initJmvstreamUploadAction`, `completeJmvstreamUploadAction`;
- cron: `src/app/api/cron/jmvstream/route.ts`;
- testes: `src/features/jmvstream/*.test.ts`.
