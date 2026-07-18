# R2 media boundary

## Objetivo

Impedir que metadados declarados pelo browser virem material de aula sem confirmação do objeto privado no R2.

## Mudanças

- Criar um helper puro que só forme URLs públicas para prefixes `banners/` e `courses/`.
- Adicionar `HeadObject` ao adaptador R2 e comparar tamanho e MIME assinados com o objeto efetivamente armazenado.
- Confirmar cada recurso e preview R2 antes do `saveLesson` persistir `content_json`.

## Verificação

- `bun run test -- src/features/storage/public-media.test.ts src/features/admin/authoring.test.ts`
- `bun run typecheck`

## Limites

- Não alterar a autorização de download de materiais.
- Não tornar o bucket privado público.
