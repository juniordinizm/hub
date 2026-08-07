# Editor de certificado: sobreposição e refinamento de UX/UI

**Status:** Aprovado pelo usuário em 2026-08-07

## Objetivo

Permitir que administradores salvem e publiquem templates de certificado mesmo quando campos visíveis se sobrepõem, porque a sobreposição pode ser uma decisão intencional. O editor deve avisar claramente, sem transformar o aviso em bloqueio, e tornar a edição mais segura e acessível.

## Decisões

1. A validação estrutural continua bloqueante: arte de fundo ausente, campo fora da área imprimível, campo duplicado, campo obrigatório oculto, cor inválida, fonte não permitida e tamanho de fonte fora do limite.
2. Sobreposição é diagnóstico advisory. O servidor não rejeita o draft nem a publicação por esse motivo.
3. O cliente exibe a quantidade e os pares de campos sobrepostos, destaca os retângulos no preview e informa explicitamente que salvar/publicar continua permitido.
4. O diagnóstico usa os mesmos dados de posição enviados ao servidor; não haverá uma segunda regra visual divergente.
5. Nome, cargo e imagem da assinatura ficam sob uma seção de assinatura coerente; o cargo continua sendo um campo posicionável individualmente.
6. Alterações locais recebem proteção contra fechamento/recarregamento, e os controles de teclado mostram foco visível.

## Fluxo de usuário

- Ao mover, redimensionar ou ativar um campo, o diagnóstico é recalculado.
- Se houver sobreposição, um aviso não destrutivo aparece próximo ao preview: “X sobreposições detectadas. Isso não impede salvar ou publicar.”
- Cada par usa os rótulos humanos dos campos. O preview aplica destaque visual aos campos envolvidos.
- Salvar rascunho e salvar/publicar permanecem habilitados quando a única pendência é sobreposição.
- Se houver erro estrutural, a ação falha com uma mensagem que orienta a correção; o aviso de sobreposição continua separado do erro.
- Com alterações não salvas, o fechamento ou recarregamento da página solicita confirmação nativa do navegador.

## Acessibilidade e conteúdo

- Avisos que mudam durante a edição usam `aria-live="polite"` para não interromper a digitação.
- O destaque visual não é a única forma de comunicar o problema; os pares também aparecem em texto.
- Gatilhos de acordeão recebem uma substituição de foco `focus-visible`.
- Estados de ação usam reticências tipográficas (`Salvando…`, `Publicando…`).
- A mensagem de erro estrutural permanece com `role="alert"` e próxima ao preview até haver mapeamento granular por campo.

## Não objetivos

- Não criar um editor drag-and-drop nesta mudança.
- Não alterar o formato persistido do template nem a geometria percentual.
- Não remover as validações de segurança/consistência que não sejam sobreposição.
- Não publicar automaticamente nem exigir uma confirmação extra para uma decisão intencional do administrador.

## Verificação

- Testes de regras: sobreposição é encontrada como diagnóstico, mas não aparece em `validateCertificateTemplate`.
- Testes de servidor: draft com sobreposição persiste e mantém a transação/auditoria.
- Testes do editor: aviso, destaque, ações habilitadas, proteção de alterações e foco visível.
- `bun x ultracite check`, testes direcionados, `bun run typecheck`, `bun run docs:check` e `bun run build`.
