---
status: accepted
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# ADR-0002 Dois buckets R2 e lifecycle de publicação

## Contexto

Materiais de Aula exigem acesso autenticado; capas e banners precisam de leitura pública eficiente. Uploads devem ser validados antes de se tornarem públicos e imagens precisam de placeholder leve.

## Decisão

Usar:

- bucket privado `R2_BUCKET_NAME` para origem, materiais e uploads;
- bucket público `R2_PUBLIC_BUCKET_NAME` para cópias publicadas;
- `publishR2Object` para copiar explicitamente privado => público;
- `R2_PUBLIC_BASE_URL` para leitura pública;
- LQIP armazenado com o registro;
- banner 4:1, 1680×420, máximo 5 MiB.
- imagens administrativas enviadas diretamente ao privado por PUT assinado;
- referências temporárias vinculadas ao Admin e à finalidade, com reconciliação
  após 24 horas.

## Alternativas consideradas

- um único bucket público: reduz configuração, mas expõe materiais e uploads;
- um único bucket privado com URL assinada para toda imagem: evita publicação, mas dificulta cache/URL estável em superfícies públicas;
- servir bytes pelo Next.js: centraliza autorização, mas adiciona custo e gargalo.

## Consequências

- fronteira de acesso é clara;
- publicação e remoção precisam operar nos dois buckets;
- CORS é necessário para upload direto;
- presigned URLs são bearer tokens de curta duração;
- infraestrutura precisa garantir domínio público e política CORS;
- cópia e atualização de banco não são uma transação única.

## Evidências

`getR2Config`, `getPublicR2Config`, `publishR2Object`,
`createLessonResourceUploadUrl`, `createStagedAdminImageUploadUrl` e
`uploadDashboardBannerFile` em `src/features/storage/r2.ts`; contrato em
`src/features/storage/staged-image-upload.ts`; constantes em
`src/features/storage/banner-image.ts`; testes em `src/features/storage`.
