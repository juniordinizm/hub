---
status: accepted
owner: product
last_verified_commit: d0acbf4c5ad81ec14bf7c2aeab34054091c36526
---

# ADR-0009 Disponibilidade de Curso em dimensões independentes

## Contexto

`courses.status = active` controlava simultaneamente catálogo, checkout, capa
pública e acesso. Arquivar ou voltar a rascunho fechava vendas, mas também
retirava o Curso de alunas com Matrícula válida.

## Decisão

Manter `course_status` como estado de entrega e adicionar
`course_catalog_visibility` e `course_sales_status`. A interface administrativa
expõe Rascunho, Em breve, Disponível e Vendas pausadas; Arquivado permanece uma
ação explícita de encerramento.

- `draft + hidden + closed` => Rascunho;
- `draft + listed + closed` => Em breve;
- `active + listed + open` => Disponível;
- `active + listed|hidden + closed` => Vendas pausadas;
- `archived + hidden + closed` => Arquivado.

Matrícula efetiva consulta entrega, nunca vitrine ou vendas. Fechar vendas
cancela Checkouts Asaas ativos por outbox. Abrir vendas enfileira avisos para
interesses ativos; o payload guarda apenas IDs locais.

## Alternativas

- enum único: menor, mas recria o acoplamento e cresce a cada combinação;
- entidade Oferta: mais extensível, mas prematura para uma oferta por Curso.

## Consequências

Publicar currículo não abre vendas. Acesso adquirido sobrevive a pausas.
Arquivamento continua bloqueando entrega. Novos tópicos de outbox exigem
monitoramento e retry operacional.

