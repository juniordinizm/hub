# Configuração do Cloudflare R2

Este guia configura o armazenamento de arquivos usado pelo Hub em duas etapas:

1. **localhost**, para testar uploads sem afetar produção;
2. **produção**, com buckets separados, domínio público e credenciais protegidas.

## Como o código usa o R2

O projeto usa a API S3-compatible do Cloudflare R2 e espera estas variáveis:

```env
R2_ACCOUNT_ID=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

O fluxo é:

- materiais de aulas, anexos e arquivos originais vão para `R2_BUCKET_NAME`;
- o navegador recebe uma URL pré-assinada temporária para fazer o upload;
- o servidor valida tamanho e `Content-Type` usando `HeadObject`;
- banners e capas publicados são copiados para `R2_PUBLIC_BUCKET_NAME`;
- as URLs públicas são montadas a partir de `R2_PUBLIC_BASE_URL`;
- materiais de aulas continuam privados e são lidos por URL pré-assinada.

Por isso, **não use um único bucket para tudo**.

## Nomes dos buckets

Use estes nomes:

| Ambiente | Bucket privado | Bucket público |
| --- | --- | --- |
| Localhost | `hub-local-private` | `hub-local-public` |
| Produção | `hub-prod-private` | `hub-prod-public` |

Os nomes são apenas uma recomendação; se já estiverem ocupados na sua conta, acrescente um identificador curto, por exemplo `hub-prod-private-123`.

Regras para os nomes:

- use somente letras minúsculas, números e hífens;
- não inclua chaves, tokens ou informações sensíveis;
- não reutilize o bucket de produção no localhost;
- mantenha o par privado/público na mesma conta R2.

## Parte 1 — Configurar o localhost

### 1. Criar os buckets locais

No painel Cloudflare:

1. Acesse **R2 Object Storage**.
2. Clique em **Create bucket**.
3. Crie `hub-local-private`.
4. Crie `hub-local-public`.
5. Use a mesma jurisdição/localização para os dois buckets.

No bucket `hub-local-private`:

- não habilite acesso público;
- não habilite `r2.dev`;
- não adicione domínio customizado.

No bucket `hub-local-public`:

1. Abra **Settings**.
2. Em **Public Development URL**, clique em **Enable**.
3. Confirme digitando `allow`.
4. Copie a URL gerada, parecida com:

```text
https://<subdominio>.r2.dev
```

O endereço `r2.dev` é apropriado para desenvolvimento e testes. Não o use como domínio final de produção.

### 2. Criar o token de desenvolvimento

No Cloudflare:

1. Abra **R2 > Manage R2 API Tokens**.
2. Clique em **Create API token**.
3. Dê um nome como `hub-local-app`.
4. Conceda **Object Read & Write** para os buckets `hub-local-private` e `hub-local-public`.
5. Crie o token.
6. Copie imediatamente o `Access Key ID` e o `Secret Access Key`.

O secret só deve ficar no servidor. Nunca o coloque em código, componente React, `NEXT_PUBLIC_*` ou commit Git.

### 3. Configurar CORS do bucket privado local

Abra `hub-local-private` > **Settings** > **CORS policy** e aplique:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Essa política é necessária porque o browser faz `PUT` diretamente para a URL pré-assinada. `ETag` precisa estar em `ExposeHeaders` para que o frontend consiga ler o resultado do upload.

Se você usar outra porta, adicione a origem exata, por exemplo `http://localhost:3001`. Não adicione barra no final.

### 4. Configurar CORS do bucket público local

Abra `hub-local-public` > **Settings** > **CORS policy** e aplique:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [],
    "ExposeHeaders": [
      "ETag",
      "Content-Type",
      "Content-Length"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

Não permita `PUT` no bucket público. O navegador nunca deve fazer upload diretamente nele.

### 5. Preencher o `.env.local`

No arquivo `.env.local` do projeto, use:

```env
R2_ACCOUNT_ID=SEU_ACCOUNT_ID
R2_BUCKET_NAME=hub-local-private
R2_ACCESS_KEY_ID=SEU_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=SEU_SECRET_ACCESS_KEY
R2_PUBLIC_BUCKET_NAME=hub-local-public
R2_PUBLIC_BASE_URL=https://<subdominio>.r2.dev
```

`R2_ACCOUNT_ID` é o identificador da conta Cloudflare, não o nome da conta. Ele pode ser encontrado em **Cloudflare Dashboard > Account ID**.

Não coloque aspas, espaços ou barra no final de `R2_PUBLIC_BASE_URL`.

Depois de alterar o `.env.local`, reinicie o servidor Next.js.

### 6. Configurar o Next.js para imagens

O projeto usa `R2_PUBLIC_BASE_URL` para permitir imagens externas. Portanto, confirme que a variável está definida antes de iniciar o servidor:

```powershell
bun run dev
```

Se o domínio público mudar, reinicie o servidor para que o `next.config.ts` seja recarregado.

### 7. Testar localhost

Faça estes testes na aplicação:

1. Crie ou edite uma aula e envie um anexo.
2. Confirme que o upload termina sem erro de CORS.
3. Abra o DevTools > Network e verifique:
   - a requisição `PUT` foi para uma URL pré-assinada;
   - a resposta possui `ETag` acessível;
   - não houve upload para o bucket público.
4. Publique uma capa ou banner.
5. Confirme que a imagem abre em `R2_PUBLIC_BASE_URL`.
6. Tente abrir diretamente a URL de um material de aula privado; ela não deve funcionar sem URL pré-assinada.

Teste rápido do bucket público, substituindo a chave por uma existente:

```powershell
curl.exe -I "https://<subdominio>.r2.dev/banners/arquivo-teste.webp"
```

O resultado esperado é `200 OK` para um arquivo publicado.

## Parte 2 — Configurar produção

### 1. Criar os buckets de produção

Crie exatamente:

```text
hub-prod-private
hub-prod-public
```

No `hub-prod-private`:

- acesso público desativado;
- `r2.dev` desativado;
- nenhum domínio público.

No `hub-prod-public`:

- não use `r2.dev`;
- publique por um domínio customizado do seu domínio principal.

### 2. Adicionar o domínio público

No bucket `hub-prod-public`:

1. Abra **Settings**.
2. Vá até **Custom Domains**.
3. Adicione, por exemplo:

```text
media.seu-dominio.com
```

4. Aguarde o status `Active`.
5. Confirme que o DNS do domínio está gerenciado pela Cloudflare.

Use exatamente este valor em produção:

```env
R2_PUBLIC_BASE_URL=https://media.seu-dominio.com
```

O domínio customizado é preferível em produção porque permite cache, WAF e regras de segurança. O Cloudflare documenta essa configuração em [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

### 3. Criar o token de produção

Crie um token separado, por exemplo `hub-prod-app`.

Para o código atual, ele precisa de **Object Read & Write** nos dois buckets de produção:

- `hub-prod-private`;
- `hub-prod-public`.

Isso é necessário porque o servidor grava no bucket privado, copia banners/capas para o público e remove versões públicas antigas.

Crie outro token administrativo, separado do token da aplicação, para tarefas como CORS, lifecycle e manutenção. Não use esse token administrativo no Vercel.

### 4. CORS de produção no bucket privado

No `hub-prod-private`, aplique somente os domínios reais da aplicação:

```json
[
  {
    "AllowedOrigins": [
      "https://app.seu-dominio.com",
      "https://www.seu-dominio.com"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Se a aplicação de produção estiver em outro domínio, substitua os valores. Não use `*`.

### 5. CORS de produção no bucket público

No `hub-prod-public`, aplique:

```json
[
  {
    "AllowedOrigins": [
      "https://app.seu-dominio.com",
      "https://www.seu-dominio.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [],
    "ExposeHeaders": [
      "ETag",
      "Content-Type",
      "Content-Length"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

Não inclua `PUT`, `POST` ou `DELETE` no bucket público.

### 6. Lifecycle

Configure em ambos os buckets uma regra para abortar uploads multipart incompletos após 1 dia:

```text
Rule ID: abort-incomplete-multipart-uploads
Status: Enabled
Abort incomplete multipart uploads after: 1 day
```

Não configure expiração global dos objetos do bucket privado, porque materiais de aulas podem continuar sendo usados por muito tempo.

Não configure expiração global do bucket público. O código usa chaves versionadas e remove as versões públicas antigas quando uma capa ou banner é substituído.

O Cloudflare documenta lifecycle em [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

### 7. Variáveis no Vercel

Em **Vercel > Project > Settings > Environment Variables**, configure para **Production**:

```env
R2_ACCOUNT_ID=SEU_ACCOUNT_ID
R2_BUCKET_NAME=hub-prod-private
R2_ACCESS_KEY_ID=SEU_ACCESS_KEY_ID_DE_PRODUCAO
R2_SECRET_ACCESS_KEY=SEU_SECRET_ACCESS_KEY_DE_PRODUCAO
R2_PUBLIC_BUCKET_NAME=hub-prod-public
R2_PUBLIC_BASE_URL=https://media.seu-dominio.com
```

Não reutilize as credenciais de localhost.

Para **Preview**, use os buckets `hub-local-private` e `hub-local-public` (ou crie um par `hub-staging-*`). Nunca aponte Preview para `hub-prod-*`.

Depois de salvar as variáveis, faça um novo deploy. Variáveis alteradas não corrigem um deployment já construído até que ele seja redeployado.

### 8. Migrar arquivos existentes

A publicação automática só vale para novos uploads e novas alterações. Arquivos antigos que já estão no bucket privado não são copiados sozinhos.

Antes de abrir produção:

1. liste banners ativos e capas atuais no banco;
2. localize os objetos correspondentes no bucket privado;
3. copie-os para o bucket público mantendo as mesmas chaves;
4. valide `Content-Type` e as URLs públicas;
5. só depois remova qualquer dependência antiga de URL privada.

Não apague o bucket privado durante a migração.

### 9. Checklist final de produção

- [ ] `hub-prod-private` existe e não é público.
- [ ] `hub-prod-public` existe e usa domínio customizado.
- [ ] `media.seu-dominio.com` está ativo.
- [ ] CORS privado permite somente a aplicação oficial.
- [ ] CORS público permite apenas `GET`/`HEAD`.
- [ ] Token da aplicação não está exposto no frontend.
- [ ] Variáveis foram configuradas no ambiente Production do Vercel.
- [ ] O projeto foi redeployado após configurar as variáveis.
- [ ] Upload privado funciona por URL pré-assinada.
- [ ] Banner/capa publicado abre pelo domínio `media.*`.
- [ ] URL direta de material privado sem assinatura retorna erro.
- [ ] Arquivos antigos foram migrados.
- [ ] Uploads multipart incompletos expiram após 1 dia.

## Erros comuns

### `AccessDenied` ou `403` no upload

Verifique, nesta ordem:

1. `R2_BUCKET_NAME` aponta para o bucket privado correto;
2. o token possui Object Read & Write nesse bucket;
3. a origem exata está no CORS;
4. `Content-Type` está em `AllowedHeaders`;
5. o servidor foi reiniciado depois de alterar `.env.local`.

### A imagem publicada retorna `404`

Verifique:

1. `R2_PUBLIC_BUCKET_NAME` aponta para o bucket público;
2. `R2_PUBLIC_BASE_URL` é o domínio correto, sem barra final;
3. o objeto foi copiado para o bucket público;
4. a chave da URL corresponde à chave do objeto;
5. o domínio customizado está com status `Active`.

### A imagem aparece no servidor, mas não no Next.js

Verifique `R2_PUBLIC_BASE_URL` e reinicie/redeploye o Next.js. O domínio usado pelas imagens precisa estar permitido no `next.config.ts`.

## Referências oficiais

- [Cloudflare R2 — Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 — CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Cloudflare R2 — S3 API tokens](https://developers.cloudflare.com/r2/api/tokens/)
- [Cloudflare R2 — Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
