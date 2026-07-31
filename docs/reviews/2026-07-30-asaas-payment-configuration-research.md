---
status: proposed
owner: engineering
last_verified_commit: 384db5ad9bca03ff5723f6c7e2602c80d9e0755c
---

# Contrato do Asaas Checkout para configuração de pagamento por Curso

## Escopo e método

Pesquisa concluída em 30 de julho de 2026 contra a documentação e o OpenAPI oficiais do Asaas v3. A consulta usou o índice oficial fornecido ao Context7 e confirmou os campos no schema `CheckoutSessionSaveRequestDTO` publicado pelo Asaas. Nenhuma conclusão abaixo depende de SDK ou artigo de terceiros.

O objetivo foi verificar o que a integração pode configurar por checkout para sustentar preço e meios de pagamento próprios por Curso, parcelamento no cartão e a decisão inicial de oferecer até 3x com juros.

## Conclusão executiva

O Asaas Checkout permite definir, por checkout:

- Pix, cartão de crédito ou ambos, por meio de `billingTypes`;
- cobrança avulsa ou parcelada, por meio de `chargeTypes`;
- o máximo de parcelas, por meio de `installment.maxInstallmentCount`;
- um preço por item no payload.

O contrato publicado **não oferece um campo para configurar juros de parcelamento, repasse de taxa ou uma tabela de acréscimo por quantidade de parcelas no Asaas Checkout**. O único campo documentado em `installment` é `maxInstallmentCount`.

Portanto, preço, meios permitidos e quantidade máxima de parcelas podem ser administrados por Curso. “Com juros” ou “sem juros” não deve ser modelado como uma capacidade já suportada pelo Checkout hospedado. Essa decisão permanece pendente de uma solução comercial/técnica específica e de validação com o Asaas.

## Fatos confirmados no contrato oficial

### Formas de pagamento

`billingTypes` é obrigatório, aceita uma lista não vazia e tem somente dois valores no Asaas Checkout:

- `PIX`;
- `CREDIT_CARD`.

Logo, os três arranjos pedidos pelo produto são representáveis:

```json
["PIX"]
["CREDIT_CARD"]
["PIX", "CREDIT_CARD"]
```

Fonte: [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas) e [referência de criação de Checkout](https://docs.asaas.com/reference/criar-novo-checkout).

### Compra à vista e parcelamento

`chargeTypes` é obrigatório e aceita `DETACHED`, `INSTALLMENT` e `RECURRENT`. Para a venda unitária de Curso:

- sem parcelamento: `["DETACHED"]`;
- com parcelamento no cartão: incluir `INSTALLMENT`;
- ao incluir `INSTALLMENT`, enviar `installment`.

O guia de cartão demonstra `["DETACHED", "INSTALLMENT"]` para expor compra à vista e parcelada. O exemplo completo usa apenas `["INSTALLMENT"]`, mas ainda informa que o comprador pode escolher à vista ou parcelado. A combinação exata escolhida pelo projeto deve ser fixada por teste de contrato no Sandbox, em vez de depender dessa inconsistência editorial.

Fontes: [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito) e [referência de criação de Checkout](https://docs.asaas.com/reference/criar-novo-checkout).

### Limite de parcelas

O OpenAPI atual define `installment.maxInstallmentCount` como inteiro entre 1 e 21. Esse valor é um **teto**, não uma garantia de que todas as opções aparecerão ao comprador.

O Asaas informa que a quantidade exibida também pode variar segundo valor da compra e configurações aplicáveis. Na documentação geral de cobranças por cartão, Visa e Mastercard admitem até 21x; as demais bandeiras continuam limitadas a 12x. O padrão de até 3x está dentro de todos esses limites conhecidos.

Fontes: [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas), [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito) e [cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito).

### Limites relacionados

O contrato também define:

- `minutesToExpire`: de 10 a 1440 minutos;
- `externalReference`: até 200 caracteres;
- `items[].name`: até 30 caracteres;
- `items[].description`: até 150 caracteres.

Esses limites devem ser validados antes da chamada externa, principalmente porque títulos e descrições de Curso podem exceder os limites do item.

Fonte: [referência de criação de Checkout](https://docs.asaas.com/reference/criar-novo-checkout).

## Juros: três conceitos que não podem ser misturados

### 1. Juros comerciais do parcelamento

É o acréscimo no preço pago pelo comprador conforme o número de parcelas. Essa é a decisão expressa como “com ou sem juros” por Curso.

**Fato:** o schema atual do Asaas Checkout não documenta `interest`, percentual, tabela por parcela ou repasse de taxa dentro do objeto `installment`. O objeto contém somente:

```json
{
  "maxInstallmentCount": 3
}
```

**Inferência:** um único Checkout hospedado não oferece, pelo contrato publicado, como manter o preço à vista e recalcular automaticamente o total conforme a quantidade de parcelas escolhida na página do Asaas.

Alguns plugins oficiais do Asaas para plataformas de e-commerce documentam configuração de juros por parcela. Isso é capacidade específica desses plugins e não aparece no contrato da API de Checkout; não deve ser extrapolada para esta integração.

### 2. Taxas de processamento do Asaas

São os custos descontados do recebimento do vendedor. Não são, por si, juros cobrados do comprador.

**Fato:** as taxas variam por contrato, período promocional, forma de pagamento, quantidade de parcelas e antecipação. O próprio Asaas orienta consultar as condições efetivas na conta. O endpoint `POST /v3/payments/simulate` recebe `value`, `installmentCount` e `billingTypes` e retorna estimativas de valor líquido e taxas.

**Implicação:** percentuais não devem ser fixados no código nem usados como verdade contábil. O simulador pode apoiar a configuração administrativa; extrato e eventos financeiros continuam sendo a fonte de conciliação efetiva.

Fontes: [simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas) e [preços e taxas](https://www.asaas.com/precos-e-taxas).

### 3. Juros por atraso

O campo `interest` das APIs de cobranças e parcelamentos se refere a juros incidentes **após o vencimento**. Ele não controla o acréscimo comercial quando o comprador escolhe 2x ou 3x.

**Implicação:** reutilizar esse campo para implementar “parcelamento com juros” seria semanticamente incorreto e produziria cobrança diferente da oferta.

Fontes: [criar parcelamento](https://docs.asaas.com/reference/criar-parcelamento) e [juros, multa e desconto em cobranças](https://central.ajuda.asaas.com/hc/pt-br/articles/31965188701083-Como-adicionar-juros-multa-e-desconto-nas-cobran%C3%A7as).

## Recebimento e impacto financeiro

No cartão parcelado, o valor total compromete o limite do comprador, enquanto o recebimento do vendedor gera recebíveis parcelados. A antecipação é uma operação separada e sujeita a elegibilidade e taxa; o Asaas permite solicitá-la para o parcelamento completo ou para uma parcela individual.

Consequências para o projeto:

- não assumir que venda parcelada disponibiliza imediatamente o valor líquido total;
- não conceder acesso com base em previsão de recebimento, callback ou redirecionamento;
- continuar usando o evento financeiro confirmado para conceder acesso;
- conciliar valor bruto, taxa, valor líquido e antecipações como grandezas diferentes;
- projetar fluxo de caixa com as datas efetivas dos recebíveis, não apenas com o valor do pedido.

Fontes: [como funcionam cobranças parceladas](https://central.ajuda.asaas.com/hc/pt-br/articles/37832954204699-Como-funcionam-as-cobran%C3%A7as-parceladas), [solicitar antecipação](https://docs.asaas.com/reference/solicitar-antecipacao) e [simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas).

## Contrato recomendado para o domínio

As capacidades confirmadas podem ser modeladas assim:

- `allowedPaymentMethods`: conjunto não vazio de `pix` e `credit_card`;
- `cardInstallmentsEnabled`: booleano;
- `maxInstallmentCount`: inteiro entre 2 e 21 quando o parcelamento estiver habilitado;
- padrão inicial: Pix + cartão e máximo de 3 parcelas;
- a configuração efetiva deve ser copiada para o snapshot do Pedido, para que mudanças futuras no Curso não reescrevam a oferta já aceita.

Regras de validação:

- Curso somente Pix => `billingTypes: ["PIX"]` e `chargeTypes: ["DETACHED"]`;
- Curso somente cartão sem parcelamento => `billingTypes: ["CREDIT_CARD"]` e `chargeTypes: ["DETACHED"]`;
- Curso com cartão parcelado => incluir `CREDIT_CARD`, `INSTALLMENT` e `installment.maxInstallmentCount`;
- nunca enviar `INSTALLMENT` para uma oferta sem cartão;
- interpretar `maxInstallmentCount` como teto;
- não expor “com juros” como configuração funcional até existir contrato comprovado.

O caso Pix + cartão parcelado no mesmo Checkout não possui exemplo oficial inequívoco. Antes de liberá-lo, é necessário testar no Sandbox o payload com `billingTypes: ["PIX", "CREDIT_CARD"]`, `chargeTypes: ["DETACHED", "INSTALLMENT"]` e `maxInstallmentCount: 3`, verificando as opções exibidas e os objetos financeiros gerados para cada escolha.

## Decisão pendente: parcelamento com juros

Há três caminhos possíveis, mas nenhum deve ser tratado como aprovado por esta pesquisa:

1. Confirmar com o suporte técnico/comercial do Asaas se existe configuração de conta ou recurso não publicado aplicável ao Checkout v3.
2. Manter o Checkout hospedado e assumir parcelamento sem acréscimo ao comprador, absorvendo taxas no preço/margem do Curso.
3. Criar uma etapa própria de seleção de condição e usar outro fluxo oficial do Asaas que permita controlar o valor final antes do pagamento. Isso amplia escopo, segurança, UX e conciliação e exige nova avaliação de arquitetura.

A decisão “até 3x com juros” é desejada pelo produto, mas **não é implementável de modo comprovado pelo contrato atual do Asaas Checkout**. Até esclarecimento do fornecedor, o estado correto no planejamento é “pendente de viabilidade”, não “configuração padrão implementada”.

## Fontes oficiais consultadas

- [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas)
- [Criar novo Checkout](https://docs.asaas.com/reference/criar-novo-checkout)
- [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito)
- [Checkout para Pix](https://docs.asaas.com/docs/checkout-para-pix)
- [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- [Simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas)
- [Solicitar antecipação](https://docs.asaas.com/reference/solicitar-antecipacao)
- [Como funcionam as cobranças parceladas](https://central.ajuda.asaas.com/hc/pt-br/articles/37832954204699-Como-funcionam-as-cobran%C3%A7as-parceladas)
- [Como adicionar juros, multa e desconto](https://central.ajuda.asaas.com/hc/pt-br/articles/31965188701083-Como-adicionar-juros-multa-e-desconto-nas-cobran%C3%A7as)
- [Preços e taxas](https://www.asaas.com/precos-e-taxas)
