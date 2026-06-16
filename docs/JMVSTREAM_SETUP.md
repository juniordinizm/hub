# Configuracao JMVStream

Este projeto usa JMVStream como provedor padrao de video das aulas.

## Como preparar na JMVStream

1. Contrate ou habilite um plano com acesso a video hosting e API.
2. Entre no painel da JMVStream.
3. Envie os videos finais das aulas pelo painel da JMVStream. No MVP, o upload de arquivos nao acontece no admin do Hub.
4. Para cada video, copie:
   - o `video_hash` ou identificador do video;
   - o link de compartilhamento do player ou o iframe oficial.
5. Se usar protecao por dominio/hotlink, libere os dominios da plataforma:
   - dominio de producao;
   - dominio de preview da Vercel, se for testar videos em preview;
   - `localhost` apenas se a JMV permitir e se for necessario testar localmente.

## Como cadastrar uma aula no admin

Depois do upload no painel JMVStream, cadastre o player em `Admin > Catalogo > Nova aula`:

1. Em `Provider`, selecione `JMVStream`.
2. Em `Hash ou ID do video`, cole o `video_hash`.
3. Em `URL ou iframe do player`, cole o link `https://player.jmvstream.com/...` ou o iframe oficial copiado da JMVStream.
4. Salve a aula.

O sistema normaliza o iframe e salva apenas a URL segura do player. Para aulas com provider `JMVStream`, URLs fora de `https://player.jmvstream.com` sao recusadas e a aula fica como "Video em configuracao".

## Decisao operacional do MVP

O Hub nao recebe arquivos de video diretamente. A cliente sobe e organiza os videos no painel da JMVStream, e o admin do Hub cadastra apenas o `video_hash` e o iframe/link oficial do player. Essa decisao evita expor token secreto da API no navegador, evita proxy de arquivos grandes pela Vercel e mantem o fluxo de transcodificacao/protecao dentro da plataforma especializada de video.

## Variaveis de ambiente

O player atual nao precisa expor token no frontend. As variaveis abaixo ficam preparadas para automacoes futuras pela API:

```env
JMVSTREAM_API_BASE_URL=https://api.jmvstream.com/v1
JMVSTREAM_API_TOKEN=
JMVSTREAM_PLAN_ID=
```

Na Vercel, cadastre essas variaveis em Production e Preview se for usar automacao de API. Nunca exponha o token como `NEXT_PUBLIC_*`.

## Observacoes tecnicas

- O token da API e secreto de servidor.
- O player e renderizado em iframe dentro da area autenticada da aluna.
- O controle real de acesso continua sendo feito pela plataforma: apenas alunas com matricula ativa e aula desbloqueada conseguem abrir a pagina da aula.
- A protecao adicional contra hotlink deve ser configurada no painel JMVStream.
