# Configuracao JMVStream

Este projeto usa JMVStream como provedor padrao de video das aulas.

## Como preparar na JMVStream

1. Contrate ou habilite um plano com acesso a video hosting e API.
2. Entre no painel da JMVStream.
3. Envie os videos finais das aulas.
4. Para cada video, copie:
   - o `video_hash` ou identificador do video;
   - o link de compartilhamento do player ou o iframe oficial.
5. Se usar protecao por dominio/hotlink, libere os dominios da plataforma:
   - dominio de producao;
   - dominio de preview da Vercel, se for testar videos em preview;
   - `localhost` apenas se a JMV permitir e se for necessario testar localmente.

## Como cadastrar uma aula no admin

Em `Admin > Catalogo > Nova aula`:

1. Em `Provider`, selecione `JMVStream`.
2. Em `Hash ou ID do video`, cole o `video_hash`.
3. Em `URL ou iframe do player`, cole o link `https://player.jmvstream.com/...` ou o iframe oficial copiado da JMVStream.
4. Salve a aula.

O sistema normaliza o iframe e salva apenas a URL segura do player. Para aulas com provider `JMVStream`, URLs fora de `https://player.jmvstream.com` sao recusadas e a aula fica como "Video em configuracao".

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
