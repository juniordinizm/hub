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
3. O servidor inicia o upload em `/v2/upload/multipart/s3` e cria o asset como `uploading`.
4. O navegador tenta enviar as partes direto para as URLs assinadas e guarda cada `ETag`.
5. Se a JMVStream/S3 bloquear o PUT no navegador por CORS, o admin usa o fallback same-origin `/api/jmvstream/upload-part`, protegido por sessao admin, para enviar aquela parte no servidor.
6. O servidor finaliza em `/v2/upload/multipart/complete`.
7. A aula recebe o `video_hash`. O player so e gravado se a JMVStream retornar uma URL oficial `https://player.jmvstream.com/...`.

Se a JMVStream ainda nao retornar o player oficial, a aula fica aguardando processamento/player e nao conta como video pronto na saude do curso.

## Pastas

O Hub cria galerias JMVStream para organizar os uploads. Como o endpoint publico `POST /v1/folders` documenta apenas a criacao de galerias planas com `name`, cursos usam uma galeria com o nome do curso e modulos usam uma galeria nomeada como `Curso - Modulo`. O sistema reutiliza galerias existentes pelo nome antes de criar novas.

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
- O caminho preferencial envia o arquivo direto para as URLs assinadas da JMVStream/S3.
- Quando o navegador recebe `Failed to fetch` por CORS no PUT assinado, o fallback envia partes de 8 MiB pela rota server-side `/api/jmvstream/upload-part`.
- O header `ETag` precisa estar disponivel no PUT direto ou no fallback; sem ele o upload nao e finalizado.
- O player e renderizado em iframe dentro da area autenticada da aluna.
- O controle real de acesso continua sendo feito pela plataforma: apenas alunas com matricula ativa e aula desbloqueada conseguem abrir a pagina da aula.
- A protecao adicional contra hotlink deve ser configurada no painel JMVStream.
