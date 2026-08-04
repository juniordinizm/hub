---
status: accepted
owner: product
last_verified_commit: 1281924625070c4ca2c7a5ff3fb0bc170149e3ec
---

# ADR-0009: precificação automática e Fatura Asaas

## Contexto

Cada Curso precisa controlar métodos e parcelamento. A regra comercial aprovada mantém
Pix e cartão 1x no preço-base e permite que, em 2x ou mais, a Compradora pague somente o
custo incremental necessário para preservar o líquido estimado de 1x. O suporte Asaas
confirmou que o repasse do painel não pode ser ativado pela API e não é herdado por
Checkout ou Link criados pela API.

O Checkout v3 aceita um único total e um teto de parcelas. Ele não recalcula esse total
conforme a parcela escolhida. A API de cobrança direta aceita uma quantidade e um total
já determinados e devolve uma Fatura hospedada, sem expor dados de cartão ao Hub.

## Decisão

O Hub calcula uma cotação curta a partir de `GET /v3/myAccount/fees/` e confirma os
centavos por `POST /v3/payments/simulate`. A Compradora escolhe método e quantidade em
`/comprar/[slug]`. O Hub revalida a escolha, persiste o Pedido imutável e cria uma Fatura
direta. Em 1x envia somente `value`; em 2x a 12x envia `installmentCount` + `totalValue`.

Cada Curso escolhe `seller_absorbs_all` ou
`buyer_pays_incremental_installment_cost`. Novos Cursos usam a segunda política, Pix +
cartão e 3x; Cursos existentes migram para absorção. Cobrança e cada parcela têm piso
interno de R$ 10. O Pedido preserva preço-base, acréscimo, bruto, cotação e parâmetros de
taxa; o Asaas recebe somente o bruto final.

CPF/CNPJ é validado e usado apenas para resolver o Cliente Asaas. O banco mantém e-mail
normalizado e fingerprint HMAC, nunca o documento em claro. Dados de cartão permanecem
na Fatura. Webhook e conciliação, não o retorno do navegador, autorizam acesso.

## Consequências

Mudanças tarifárias passam a aparecer sem edição manual depois do TTL; uma divergência
no submit expira a cotação para que a atualização gere outra. A estimativa não é garantia
de líquido futuro: o Hub mostra no Admin valores cotados e realizados separadamente. O
reembolso integral devolve o bruto pago, inclusive acréscimo.

Pedidos históricos de Checkout continuam legíveis, conciliáveis e reembolsáveis pelo
fluxo de compatibilidade. Novas compras usam origem `invoice`.

## Alternativas rejeitadas

- Tabela manual de percentuais: diverge do contrato real da conta e exige manutenção.
- Checkout v3 com `maxInstallmentCount`: limita parcelas, mas mantém um único total.
- Um Link por quantidade: multiplica artefatos externos e não implementa o preço por
  Curso de forma confiável.
- Repasse nativo do painel: não possui contrato de API aplicável ao fluxo.
- Coleta de cartão no Hub: amplia escopo de segurança e é desnecessária.
