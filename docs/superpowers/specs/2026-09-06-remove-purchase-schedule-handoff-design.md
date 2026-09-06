---
status: approved
owner: product_and_engineering
last_verified_commit: c67c6545c99403ed7acb999dbf8d7800e3564ee1
---

# Remover cronograma visual do handoff de compra

## Decisão

A tela `/comprar/[slug]` volta a ser uma etapa transitória de checkout. Ela não
exibe o cronograma de liberação nem exige confirmação manual antes de iniciar o
checkout. Ao montar, continua criando/reutilizando a tentativa idempotente e
redirecionando automaticamente quando o checkout estiver pronto.

## Preservado

- o servidor continua calculando o cronograma publicado;
- o digest continua sendo enviado de forma invisível pelo handoff;
- o servidor continua recusando checkout quando o cronograma mudou;
- o snapshot do cronograma continua persistido no Pedido;
- segurança do redirect, retry e polling permanecem inalterados.

Quando o servidor retornar `schedule_changed`, o handoff mostra somente a
indisponibilidade genérica já existente. Não exibe detalhes do cronograma.

## Alterações

`PurchaseHandoffClient` deixa de receber o snapshot completo e deixa de manter o
estado `review`. Recebe somente o digest necessário para a validação server-side
e inicia o checkout para qualquer cronograma. O estado específico
`schedule_changed` não é exposto na UI.

Os testes passam a provar que um cronograma D+N ainda dispara o POST automático,
que o digest é preservado no body e que a página não renderiza o cronograma.

## Fora do escopo

- remover o snapshot do schema ou do Pedido;
- remover a validação de digest no servidor;
- alterar a regra de liberação da Matrícula;
- alterar a página pública de compra além do handoff;
- alterar o fluxo de retry, polling ou redirect seguro.
