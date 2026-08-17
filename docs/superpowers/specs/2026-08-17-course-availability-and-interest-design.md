---
status: accepted
owner: product
last_verified_commit: d0acbf4c5ad81ec14bf7c2aeab34054091c36526
---

# Disponibilidade comercial e interesse em Cursos

## Resultado

O Hub separa entrega, descoberta e venda. Vendas pausadas preservam acesso,
podem permanecer na vitrine e aceitam interesse. “Em breve” divulga Curso sem
compra ou Matrícula, com data opcional e landing externa opcional.

## Contrato

- Publicar conteúdo não altera disponibilidade comercial.
- Disponível exige publicação e oferta válidas.
- Em breve não é permitido após histórico comercial.
- Interesse pertence à Conta Student, pode ser cancelado e é apagado após o aviso.
- Abrir vendas avisa automaticamente por template fixo; fechar vendas cancela Checkouts ativos.
- Pagamento confirmado durante a corrida de cancelamento é honrado.
- `/comprar/[slug]` prioriza acesso, checkout, pré-lançamento e inscrições fechadas.
- Arquivar bloqueia acesso; restaurar retorna a vendas pausadas ou rascunho.

## Fora do escopo

Vitrine pública nova, pré-venda, lead público, lista nominal, campanhas e
múltiplas ofertas.

