# R2 publication lifecycle

## Objetivo

Publicar somente derivados editoriais ativos no bucket público e limpar cópias obsoletas sem destruir referências persistidas.

## Mudanças

- Introduzir configuração do bucket e domínio público.
- Copiar banners ativos e capas de cursos ativos ao bucket público; remover cópias ao desativar, substituir, arquivar ou excluir.
- Manter a rota administrativa de banner autenticada e usar URL pública no carousel da aluna.
- Unificar banner em 21:9 e substituir progresso simulado por estado indeterminado.

## Verificação

- Testes de ação para publicação/despublicação e remoção compensável.
- Testes de rota para capa ativa versus rascunho.
- `bun run test`
- `bun run typecheck`

## Limites

- DNS, CORS e políticas do Cloudflare devem ser aplicados fora do repositório antes de habilitar produção.
