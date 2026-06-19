# Configuracao JMVStream

Este projeto usa JMVStream como provedor padrao de video das aulas.

## Como preparar na JMVStream

1. Contrate ou habilite um plano com acesso a video hosting e API.
2. Entre no painel da JMVStream.
3. Obtenha o `planId` e o `resource` usados pela API.
4. Crie ou confirme um usuario de API capaz de autenticar em `POST /v1/authenticate`.
5. Se usar protecao por dominio/hotlink, libere os dominios da plataforma:
   - dominio de producao;
   - dominio de preview da Vercel, se for testar videos em preview;
   - `localhost` apenas se a JMV permitir e se for necessario testar localmente.

## Como o upload funciona no admin

O admin usa o fluxo S3 atual do playground da JMVStream:

1. Crie ou edite a aula.
2. Selecione um arquivo em `Upload JMVStream`.
3. O servidor inicia o upload em `/v2/upload/multipart/s3`, garante a galeria `Curso - Modulo` e cria uma sessao de asset como `uploading` ja vinculada a aula.
4. O navegador tenta enviar as partes direto para as URLs assinadas e guarda cada `ETag`.
5. Se a JMVStream/S3 bloquear o PUT no navegador por CORS ou nao expuser o header `ETag`, o admin falha com uma mensagem acionavel para configurar `CORS/Expose-Headers: ETag` na JMVStream/S3 ou usar um backend dedicado de upload.
6. O servidor finaliza em `/v2/upload/multipart/complete` com `filename`, `size`, `video_hash`, `objectName`, `uploadId`, `uploadSessionId` e `parts`. A `gallery` e enviada apenas no init; reenviar no complete faz a JMVStream/S3 responder `NoSuchUpload`.
7. A aula recebe o `video_hash`. O player so e gravado se a JMVStream retornar uma URL oficial `https://player.jmvstream.com/...`.

Se a JMVStream ainda nao retornar o player oficial, a aula fica aguardando processamento/player e nao conta como video pronto na saude do curso. Se o usuario sair da pagina durante o upload, a sessao continua visivel na aula como pendente/falha, com acao de retry/limpeza, em vez de virar um video orfao invisivel.

## Pastas

O Hub cria galerias JMVStream por modulo para organizar os uploads. Como o endpoint publico `POST /v1/folders` documenta apenas a criacao de galerias planas com `name`, cada modulo usa uma galeria nomeada como `Curso - Modulo`. O sistema reutiliza galerias existentes pelo nome antes de criar novas, valida se o `folder_uuid` local ainda existe em `GET /v1/folders` e recria a galeria quando a pasta remota foi removida.

Ao apagar uma aula, o Hub tenta excluir o video vinculado na JMVStream pelo `video_hash`. Depois da exclusao, se a galeria do modulo nao tiver videos remotos nem assets locais ativos, o Hub apaga a pasta vazia na JMVStream e marca o registro local para revisao.

## Variaveis de ambiente

Nenhuma variavel da JMVStream deve usar `NEXT_PUBLIC_*`.

```env
JMVSTREAM_API_BASE_URL=https://api.jmvstream.com
JMVSTREAM_PLAN_ID=
JMVSTREAM_AUTH_EMAIL=
JMVSTREAM_AUTH_PASSWORD=
# UUID do recurso/aplicacao JMVStream usado no POST /v1/authenticate. Nao use JWT/Bearer token aqui.
JMVSTREAM_AUTH_RESOURCE=

# Fallback manual opcional. Expira e deve ser renovado se usado sem as credenciais acima.
JMVSTREAM_API_TOKEN=
```

Na Vercel, cadastre essas variaveis em Production e Preview. O sistema reutiliza JWT valido, renova automaticamente com as credenciais e mostra erro acionavel quando a autenticacao falha. Se voce tiver apenas um JWT antigo, leia o payload e use o `planUuid` como `JMVSTREAM_AUTH_RESOURCE`; o JWT em si deve ficar apenas em `JMVSTREAM_API_TOKEN` quando usado como fallback manual.

## Observacoes tecnicas

- O token da API e secreto de servidor.
- O caminho de producao envia o arquivo direto para as URLs assinadas da JMVStream/S3.
- A Vercel nao deve proxyar bytes de video: Vercel Functions tem limite de corpo pequeno para requests/responses, enquanto multipart S3 exige partes grandes.
- O upload TUS direto no frontend nao e usado porque a JMVStream confirmou que ele exige o JWT Bearer normal e nao existe token temporario/scoped.
- O header `ETag` precisa estar disponivel no PUT direto; sem ele o upload nao e finalizado.
- O player e renderizado em iframe dentro da area autenticada da aluna.
- O controle real de acesso continua sendo feito pela plataforma: apenas alunas com matricula ativa e aula desbloqueada conseguem abrir a pagina da aula.
- A protecao adicional contra hotlink deve ser configurada no painel JMVStream.
