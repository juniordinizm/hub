---
status: proposed
owner: engineering
last_verified_commit: 1281924625070c4ca2c7a5ff3fb0bc170149e3ec
---

# Auditoria completa da documentação de parcelamentos do Asaas

## Escopo e método

Auditoria realizada em 3 de agosto de 2026 sobre a documentação oficial v3, o OpenAPI
publicado pelo Asaas, a Central de Ajuda oficial e as páginas oficiais dos módulos de
e-commerce. O índice `llms.txt` foi pesquisado integralmente por termos relacionados a
parcelamento, cartão, Checkout, Link de Pagamento, taxas, juros, antecipação, estorno,
chargeback, PCI e Webhooks. O contrato OpenAPI foi consultado pelo MCP oficial do Asaas.

Esta pesquisa corrige uma conclusão incompleta da pesquisa anterior: o painel web do
Asaas possui uma opção nativa para repassar taxas do cartão ao pagador ao criar uma
cobrança. Essa capacidade não aparece, porém, nos contratos públicos revisados de
Checkout, Link de Pagamento, cobrança ou parcelamento pela API.

## Conclusão executiva

Há três capacidades diferentes que não devem ser confundidas:

1. **Repasse automático no painel Asaas.** Ao criar uma cobrança exclusivamente por
   cartão no painel, o Asaas exibe `Repassar taxas do cartão` e acrescenta a taxa ao total
   cobrado do cliente. Isso é oficial e invalida a afirmação ampla de que o Asaas não
   possui repasse automático.
2. **Juros comerciais a partir de uma parcela.** A própria Central de Ajuda responde que
   não é possível começar a cobrar juros a partir de determinada quantidade de parcelas.
   O `interest` da API é somente juros de mora após o vencimento.
3. **Configuração em módulos de e-commerce.** WooCommerce, Nuvemshop e Magento oferecem
   juros por quantidade de parcelas em seus próprios módulos. A documentação limita essa
   capacidade ao módulo/checkout da loja; ela não aparece no schema do Checkout v3.

Para o Hub, a regra desejada, “vendedora absorve até N parcelas; acima de N a compradora
paga o acréscimo”, **não está disponível como um único campo no Checkout v3**. A opção
simples do painel resolve o caso “repassar a taxa integral do cartão” ao criar cobranças
manualmente, mas não documenta uma exceção para 1x, não é configurável por Curso e não é
exposta nos contratos públicos usados pelo Hub.

O mecanismo público mais simples para a regra exata continua sendo definir previamente a
quantidade e o preço final e criar a cobrança com `installmentCount` + `totalValue` ou
`installmentValue`. Isso não exige calcular parcelas individuais quando se usa
`totalValue`; o Asaas faz a divisão e corrige eventual diferença na última parcela. A
escolha precisa ocorrer antes da criação da cobrança. Uma Fatura hospedada preserva os
dados do cartão fora do Hub, mas a combinação exata “parcelamento predefinido +
`invoiceUrl`” ainda precisa de prova de Sandbox porque a documentação contém
inconsistências descritas abaixo.

## Matriz dos produtos e contratos

### Checkout Asaas v3

`POST /v3/checkouts` recebe itens com preço único e, para parcelamento, apenas:

```json
{
  "chargeTypes": ["INSTALLMENT"],
  "installment": {
    "maxInstallmentCount": 6
  }
}
```

O comprador escolhe 1x ou uma quantidade até o teto. O schema
`CheckoutSessionInstallmentDTO` contém exclusivamente `maxInstallmentCount`, de 1 a 21.
Não contém `interest`, tabela por parcela, `interestPayer`, repasse de taxa, desconto em
1x ou preço variável segundo a escolha. O total deriva da soma dos itens.

A frase “the installment option will appear automatically based on the amount and
settings” se refere às opções disponíveis conforme valor e configurações/limites. Ela não
documenta alteração do total nem quem paga a taxa. A documentação diz explicitamente que
o cliente divide o total.

**Contraprova procurada:** nenhum campo de repasse ou juros comerciais foi encontrado no
OpenAPI de `POST /v3/checkouts`, nas páginas gerais do Checkout, no exemplo de cartão ou
nos eventos de Checkout. A opção do painel `Repassar taxas do cartão` não é mencionada
como configuração herdada por uma sessão de Checkout.

Fontes:

- [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas)
- [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito)
- [Criar novo Checkout](https://docs.asaas.com/reference/criar-novo-checkout)
- [Eventos para Checkout](https://docs.asaas.com/docs/eventos-para-checkout)

### Link de Pagamento

`POST /v3/paymentLinks` permite valor fixo ou aberto, `chargeType=INSTALLMENT` e
`maxInstallmentCount`. O pagador preenche os próprios dados e escolhe a quantidade até o
máximo. O Link dispensa cliente previamente cadastrado e pode ser reutilizado.

O contrato público não contém tabela de juros, repasse de taxa ou preço por quantidade.
Com `value=500` e máximo de 10, o exemplo oficial descreve “até 10x de R$ 50”, preservando
o total. Ele também não suporta split segundo o comparativo oficial entre cobrança e
Link.

Consequência: o Link é simples para venda pública, mas não implementa “1x pelo preço-base
e parcelas maiores com total crescente”. Pré-aumentar o `value` cobraria o mesmo total
majorado em todas as quantidades.

Fontes:

- [Introdução ao Link de Pagamento](https://docs.asaas.com/docs/link-de-pagamentos)
- [Criando um Link de Pagamento](https://docs.asaas.com/docs/criando-um-link-de-pagamentos)
- [Criar um Link de Pagamento](https://docs.asaas.com/reference/criar-um-link-de-pagamentos)
- [Atualizar um Link de Pagamento](https://docs.asaas.com/reference/atualizar-um-link-de-pagamentos)

### Cobranças `POST /v3/payments` e `POST /v3/lean/payments`

Os dois endpoints usam `PaymentSaveRequestDTO`; a diferença principal é a resposta. A
rota `lean` retorna `PaymentLeanGetResponseDTO`, que omite vários detalhes da cobrança.

Para uma cobrança 1x, use apenas `value`. Para duas ou mais parcelas, a referência atual
determina uma destas combinações:

- `installmentCount` + `totalValue`: Asaas calcula cada parcela;
- `installmentCount` + `installmentValue`: a aplicação define o valor de cada parcela.

Quando `totalValue` não divide exatamente, o guia informa que o Asaas ajusta a última
parcela. Exemplo oficial: R$ 350 em 12x gera 11 parcelas de R$ 29,16 e uma de R$ 29,24.

`customer` é obrigatório e identifica um cliente já cadastrado no Asaas. Criar cliente
exige, no contrato atual, `name` e `cpfCnpj`; e-mail é opcional. O Asaas permite clientes
duplicados e atribui à integração a prevenção/reutilização.

Na cobrança completa, a resposta inclui `invoiceUrl`. A documentação de cartão orienta
criar a cobrança sem cartão e redirecionar à Fatura para o pagador informar o cartão. A
captura direta também é possível enviando `creditCard`, `creditCardHolderInfo` e
`remoteIp`, mas amplia o escopo PCI.

**Inconsistência atual:** o guia em português passou a exemplificar `/v3/lean/payments` e
manda redirecionar para `invoiceUrl`, mas o OpenAPI de `PaymentLeanGetResponseDTO` não
expõe `invoiceUrl`. A resposta completa de `/v3/payments` expõe. Uma integração não deve
assumir a URL na resposta `lean` sem teste do contrato.

Fontes:

- [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Criar cobrança com dados resumidos](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)
- [Cobranças via cartão](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- [Introdução a cobranças](https://docs.asaas.com/docs/guia-de-cobrancas)
- [Criar cliente](https://docs.asaas.com/reference/criar-novo-cliente)
- OpenAPI oficial: `PaymentSaveRequestDTO`, `PaymentGetResponseDTO` e
  `PaymentLeanGetResponseDTO`.

### Recurso agregado `installments`

`POST /v3/installments` cria o agregado sem dados de cartão. `POST /v3/installments/`
possui outro contrato para criação e processamento com cartão, incluindo cartão/token,
titular e IP. Ambos recebem quantidade, cliente, valor/total, forma e primeiro vencimento.

O agregado retorna:

- `id` próprio;
- `value`, total bruto;
- `netValue`, total líquido;
- `paymentValue`, valor da parcela;
- `installmentCount`;
- `billingType`, cliente e vínculos opcionais com `paymentLink` e `checkoutSession`.

Cada parcela é também uma cobrança com seu próprio `payment.id`. O endpoint
`GET /v3/installments/{id}/payments` lista essas cobranças. O Asaas envia um
`PAYMENT_CREATED` para cada uma, contendo tanto `payment.id` quanto `installment`.

Fontes:

- [Criar uma cobrança parcelada](https://docs.asaas.com/docs/criar-uma-cobranca-parcelada)
- [Criar parcelamento](https://docs.asaas.com/reference/criar-parcelamento)
- [Criar parcelamento com cartão](https://docs.asaas.com/reference/criar-parcelamento-com-cart%C3%A3o-de-cr%C3%A9dito)
- [Parcelamentos: identificação](https://docs.asaas.com/docs/duvidas-frequentes-parcelamentos)
- [Listar cobranças do parcelamento](https://docs.asaas.com/reference/listar-cobran%C3%A7as-de-um-parcelamento)

## Quem escolhe as parcelas e quando

- **Checkout v3:** comprador escolhe na página hospedada, depois da criação, até
  `maxInstallmentCount`.
- **Link de Pagamento:** comprador escolhe na página hospedada, depois da criação, até
  `maxInstallmentCount`.
- **Cobrança/parcelamento pela API:** a integração informa `installmentCount` ao criar. O
  comparativo oficial do Link diz expressamente que uma cobrança não permite ao cliente
  escolher a quantidade, enquanto o Link permite.
- **Painel Asaas:** a Central descreve a cobrança parcelada e a Fatura como permitindo ao
  cliente escolher entre opções definidas. Isso conflita com o comparativo técnico e com
  o nome/semântica de `installmentCount`. A documentação não explica como essas “opções”
  são representadas na API.

Até teste de Sandbox ou resposta formal do Asaas, o contrato mais seguro para uma
integração é: `installmentCount` em cobrança direta é quantidade definida, não teto.

Fontes:

- [Introdução ao Link de Pagamento](https://docs.asaas.com/docs/link-de-pagamentos)
- [Como funcionam cobranças parceladas](https://central.ajuda.asaas.com/hc/pt-br/articles/37832954204699-Como-funcionam-as-cobran%C3%A7as-parceladas)

## Cartão, boleto e Pix não representam o mesmo parcelamento

### Cartão de crédito

É uma compra única parcelada pela operadora: o valor total consome o limite do cartão no
momento da confirmação. A conta Asaas recebe cada parcela no seu prazo, salvo
antecipação. Visa e Mastercard aceitam até 21x; demais bandeiras, até 12x. O Hub pode
manter teto comercial de 12x independentemente do máximo do fornecedor.

### Boleto e Pix

O parcelamento cria cobranças com vencimentos sucessivos. Cada boleto/Pix precisa ser pago
separadamente; não há consumo único de limite. A Central atual informa até 180x para
boleto/Pix, ou 24x enquanto a conta está em análise. O plugin WooCommerce documenta
limites próprios menores e diz que parcelamento direto por Pix não é suportado naquele
módulo; isso não anula a capacidade geral da API/conta, em que o QR Pix pode acompanhar
cada fatura/boleto.

### Pisos e bandeiras

A Central de Ajuda atual informa piso do fornecedor de R$ 5 por parcela no cartão e R$ 10
em boleto/Pix. Esses são limites gerais publicados; uma configuração de conta pode ser
mais restritiva. O piso comercial de R$ 10 adotado pelo Hub é válido e deliberadamente
mais restritivo para cartão.

Fontes:

- [Formas de pagamento e limites](https://central.ajuda.asaas.com/hc/pt-br/articles/31689121385627-Quais-as-formas-de-pagamento-dispon%C3%ADveis-para-cobran%C3%A7as)
- [Como funcionam cobranças parceladas](https://central.ajuda.asaas.com/hc/pt-br/articles/37832954204699-Como-funcionam-as-cobran%C3%A7as-parceladas)
- [Diferença entre assinatura e parcelamento](https://docs.asaas.com/docs/assinaturas)

## Taxa, `netValue`, juros e repasse

### Taxa/MDR e líquido

O Asaas cobra a taxa quando a cobrança é paga/compensada. Em parcelamentos, a taxa é
calculada sobre o total e diluída na compensação das parcelas. `netValue` representa o
valor após a taxa. O endpoint `GET /v3/myAccount/fees/` expõe as condições da conta:

- taxa fixa de operação;
- percentual de 1x;
- percentual de 2x a 6x;
- percentual de 7x a 12x;
- percentual de 13x a 21x;
- promoções, expiração e dias para receber.

`POST /v3/payments/simulate` retorna, para valor, forma e quantidade, o total, líquido,
percentual, taxa operacional e valor/líquido por parcela. Ele é adequado para simular ou
conferir preço, não é documentado como comando que altera uma cobrança.

Fontes:

- [Taxas de cobranças](https://central.ajuda.asaas.com/hc/pt-br/articles/31688295012123-Quais-s%C3%A3o-as-taxas-para-criar-e-receber-cobran%C3%A7as)
- [Recuperar taxas da conta](https://docs.asaas.com/reference/recuperar-taxas-da-conta)
- [Simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas)

### Repasse automático do painel

A Central de Ajuda afirma, sem ambiguidade:

- funciona somente quando a cobrança usa exclusivamente cartão de crédito;
- a criação da cobrança no painel mostra `Repassar taxas do cartão`;
- quando habilitada, a taxa é adicionada automaticamente ao total do cliente;
- o cliente deve ser informado previamente.

Os Termos de Uso atuais detalham o contrato econômico: a Plataforma ajusta o valor
final para preservar o líquido desejado pelo vendedor; o repasse abrange taxas de
processamento e transação, não antecipação; e a remuneração do Asaas é calculada sobre o
total transacionado. Portanto, não basta somar nominalmente a taxa ao preço-base: o
recurso nativo faz o `gross-up` necessário para manter o líquido.

A página não afirma que a opção existe em Checkout, Link de Pagamento ou API e não
documenta um identificador de campo. Uma busca no OpenAPI não encontrou `interestPayer`,
`passFee`, `creditCardFee`, `surcharge` ou equivalente nos requests de pagamentos,
parcelamentos, Checkout ou Links.

Como a opção só aparece quando a cobrança oferece exclusivamente cartão, também não há
base documental para aplicá-la ao Checkout único Pix + cartão usado pelo Hub.

Fonte decisiva:

- [Repasse automático das taxas](https://central.ajuda.asaas.com/hc/pt-br/articles/31691238010139-As-taxas-cobradas-pelo-Asaas-podem-ser-repassadas-automaticamente-para-meus-clientes-ao-criar-cobran%C3%A7as)
- [Termos e Condições de Uso](https://central.ajuda.asaas.com/hc/pt-br/articles/32096847160859-Termos-e-Condi%C3%A7%C3%B5es-de-Uso)

### Juros comerciais por quantidade

A Central também responde que não é possível adicionar juros somente a partir de uma
determinada parcela. Portanto, o repasse nativo do painel não prova a regra “1x absorvido,
2x em diante repassado”. A documentação não esclarece se o repasse inclui toda a taxa de
1x, somente o incremento por parcelamento ou outra fórmula. Não se deve inferir uma
exceção para 1x.

Fonte decisiva:

- [Juros a partir de determinada parcela](https://central.ajuda.asaas.com/hc/pt-br/articles/33791142996123-%C3%89-poss%C3%ADvel-adicionar-juros-a-partir-de-um-determinado-n%C3%BAmero-de-parcelas)

### `interest` é mora

Nos schemas `PaymentInterestRequestDTO`, o campo é o percentual mensal sobre pagamento
após o vencimento. A Central explica cálculo proporcional aos dias de atraso. Ele não é
juros do financiamento, não varia por `installmentCount` e não deve ser reutilizado para
o acréscimo comercial do cartão.

Fonte:

- [Juros, multa e desconto](https://central.ajuda.asaas.com/hc/pt-br/articles/31965188701083-Como-adicionar-juros-multa-e-desconto-nas-cobran%C3%A7as)

## Módulos oficiais de e-commerce

### WooCommerce

O módulo oficial permite máximo de 0 a 12 parcelas, juros específicos por quantidade,
valor mínimo de parcela, antecipação automática, tokenização e split. As configurações
são realizadas no WooCommerce e aplicadas no checkout da loja.

### Nuvemshop

O módulo permite quantidade máxima, mínimo por parcela, descontos por forma e juros
específicos por quantidade. A FAQ afirma que essas regras alteram automaticamente o valor
final apresentado no checkout do módulo.

### Magento

O campo de parcelas do módulo define máximo e pode associar um percentual de juros a cada
quantidade. A configuração está no painel Magento e depende do módulo instalado.

Essas páginas provam que o padrão comercial é suportado por integrações oficiais do
Asaas. Elas não provam que o backend do Checkout v3 calcule juros: são produtos com
configuração própria no checkout da plataforma de comércio. A documentação não publica o
algoritmo ou o payload final usado pelos módulos, então atribuir o cálculo ao plugin é uma
inferência forte, mas ainda uma inferência.

Fontes:

- [WooCommerce: formas de pagamento](https://docs.asaas.com/docs/forma-de-pagamento)
- [Nuvemshop: configurações iniciais](https://docs.asaas.com/docs/initial-settings-1)
- [Nuvemshop: FAQ](https://docs.asaas.com/docs/faq)
- [Magento: configurações iniciais](https://docs.asaas.com/docs/initial-settings-2)

## Antecipação não é juros do comprador

Sem antecipação, cartão à vista é compensado 32 dias após confirmação; no parcelado,
cada parcela é compensada em sua janela. A antecipação adianta recebíveis e desconta uma
taxa adicional do valor líquido do vendedor. Pode ser simulada/solicitada para uma
cobrança ou agregado e também ativada automaticamente na conta.

Não há vínculo documentado entre a taxa de antecipação e o total cobrado do comprador.
Repassá-la como “juros do parcelamento” seria uma decisão comercial própria e instável,
pois depende de elegibilidade, momento e fluxo de caixa posterior.

O Asaas permite antecipar uma cobrança com repasse, mas calcula a antecipação somente
sobre o valor original do produto/serviço. O valor repassado ao pagador não compõe o
líquido nem a base da antecipação. Isso confirma a separação entre custo de transação e
custo financeiro de antecipar recebíveis.

Fontes:

- [Prazos de compensação](https://central.ajuda.asaas.com/hc/pt-br/articles/31689840437019-Em-quanto-tempo-receberei-as-cobran%C3%A7as-pagas-pelos-meus-clientes)
- [Simular antecipação](https://docs.asaas.com/reference/simular-antecipacao)
- [Configurar antecipação automática](https://docs.asaas.com/changelog/endpoint-para-configurar-antecipa%C3%A7%C3%A3o-autom%C3%A1tica-de-cobran%C3%A7as-de-cart%C3%A3o-de-cr%C3%A9dito)
- [Antecipar cobrança com repasse](https://central.ajuda.asaas.com/hc/pt-br/articles/39311400852891-Posso-antecipar-cobran%C3%A7as-de-cart%C3%A3o-com-repasse-de-taxas)

## Webhooks, agregado e autoridade financeira

Webhooks de Checkout (`CHECKOUT_*`) descrevem o ciclo da sessão. Webhooks financeiros
continuam sendo `PAYMENT_*`. Para um parcelamento, cada parcela possui `payment.id` e
emite eventos; o payload contém `installment`, `installmentNumber`, `value`, `netValue`,
`status`, cartão, reembolsos e chargeback quando aplicável.

Eventos relevantes incluem confirmação/recebimento, risco, falha de captura, antecipação,
vencimento, estorno total/parcial/em processamento e chargeback. A entrega é `at least
once`; a integração deve persistir, responder rapidamente, processar de forma idempotente
e tolerar novos campos.

Consequência para o Hub: nunca liberar acesso apenas por `CHECKOUT_PAID` ou callback.
Validar a cobrança/agregado e o total bruto contratado. Em parcelamento direto, conciliar
o `installment.id` e todas as cobranças relacionadas, sem tratar uma parcela isolada como
o preço completo do Curso.

Fontes:

- [Eventos de cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Eventos de Checkout](https://docs.asaas.com/docs/eventos-para-checkout)
- [Parcelamentos: um evento por cobrança](https://docs.asaas.com/docs/duvidas-frequentes-parcelamentos)

## Estorno e chargeback

`POST /v3/installments/{id}/refund` permite estorno integral, omitindo `value`, ou
parcial, informando o valor. Aplica-se a parcelamento de cartão confirmado ou recebido.
O histórico permanece no agregado. Em estorno parcial com split, o Asaas escolhe a ordem
de débito; não é possível escolher parcela ou participante específico.

A Central informa para cartão: prazo máximo de 365 dias, saldo livre quando o valor já
foi recebido/antecipado, devolução da taxa de transação somente no estorno total e nunca
da taxa de antecipação. Há divergência de prazo de visualização: a referência de
parcelamento fala em até 10 dias úteis, enquanto artigo da Central atualizado em julho de
2026 fala em até 5 dias úteis. A integração não deve prometer prazo menor; usar “conforme
operadora” ou confirmar com o suporte.

Chargebacks aparecem no pagamento/agregado e geram sequência própria de Webhooks. Um
estado adverso deve prevalecer sobre confirmações tardias e revogar acesso segundo as
regras financeiras do Hub.

Fontes:

- [Estornar parcelamento](https://docs.asaas.com/reference/estornar-parcelamento)
- [Estornos](https://docs.asaas.com/docs/estornos)
- [Estorno de cartão](https://central.ajuda.asaas.com/hc/pt-br/articles/53120539626139-Como-estornar-um-pagamento-feito-por-cart%C3%A3o-de-cr%C3%A9dito)
- [Eventos de cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Recuperar chargeback](https://docs.asaas.com/reference/recuperar-um-unico-chargeback)

## PCI e coleta de dados

Checkout, Fatura e Link mantêm a entrada de cartão no ambiente Asaas; a documentação os
associa tipicamente a SAQ-A. Enviar cartão pela API faz os dados transitarem no backend e
leva ao escopo SAQ-D. O Asaas declara não oferecer tokenização client-side; tokenização
server-side não retira o backend desse escopo. HTTPS é obrigatório e CVV nunca pode ser
armazenado.

Para o Hub, a Fatura hospedada é preferível a construir checkout transparente apenas para
juros. O custo de PCI, antifraude, logs e tratamento de dados seria desproporcional.

Fonte:

- [PCI-DSS no Asaas](https://docs.asaas.com/docs/pci-dss-1)

## Contradições e ambiguidades encontradas

1. **Repasse existe no painel, não no OpenAPI.** A Central confirma a opção, mas nenhum
   request público revisado publica o campo nem seu algoritmo.
2. **Cobrança direta e escolha de parcelas.** O comparativo do Link diz que cobrança não
   permite ao cliente escolher; a Central descreve o cliente escolhendo opções na Fatura.
3. **`lean` e `invoiceUrl`.** O guia orienta redirecionar usando criação `lean`, mas o
   schema resumido não inclui essa URL.
4. **`value` nos schemas.** Guias dizem substituir `value` por
   `installmentValue`/`totalValue`; alguns schemas de `installments` ainda marcam `value`
   como obrigatório e o descrevem como valor por parcela.
5. **Limites variam por produto.** API/conta chegam a 21x no cartão e 180x em
   boleto/Pix; módulos oficiais documentam 12x/60x. Não generalizar limite de um módulo.
6. **Prazo do estorno.** Referência fala em até 10 dias úteis; Central mais nova, em até
   5 dias úteis.

Essas divergências justificam teste de Sandbox para a combinação específica e uma
consulta formal ao suporte antes de trocar o fluxo do Hub.

## Decisão recomendada para o Hub

### O que pode ser afirmado agora

- O Checkout atual divide o preço fixo e desconta taxas do recebível do Hub.
- O Asaas possui repasse automático simples no painel para cobranças exclusivas de cartão.
- O Asaas não oferece, segundo a Central, juros iniciando em determinada parcela.
- Os módulos oficiais implementam juros por quantidade, provando que a regra comercial é
  normal, mas não que esteja disponível no Checkout v3.
- A API permite ao Hub informar a quantidade e o preço final, deixando a divisão para o
  Asaas com `totalValue`.

### Menor caminho para validar a regra aprovada

Não implementar checkout transparente próprio. Fazer um experimento contratual isolado:

1. Criar cliente de teste e parcelamento `CREDIT_CARD` de 3x sem enviar cartão.
2. Usar `/v3/payments`, não `lean`, para garantir acesso documentado à `invoiceUrl`.
3. Abrir a Fatura e confirmar se a quantidade fica fixa, quais dados são solicitados e se
   o total permanece o `totalValue`.
4. Repetir em 1x usando apenas `value`.
5. Capturar os `PAYMENT_*`, consultar o agregado e fazer estorno integral.
6. Perguntar ao suporte se o repasse do painel possui API pública, se pode excluir 1x e se
   pode ser aplicado ao Checkout/Link por sessão.

Se o suporte revelar um campo público ou configuração herdada pelo Checkout, reavaliar.
Se não, a regra exata exige uma escolha de parcelas antes da criação da Fatura e um total
calculado pelo Hub. Isso ainda é muito menor do que um checkout transparente: o Hub
coleta/define apenas a condição comercial; nome/documento precisam existir para criar o
cliente, mas o cartão continua exclusivamente na Fatura do Asaas.

## Inventário das páginas e endpoints consultados

### Guias e Central de Ajuda

- Asaas Checkout; Checkout para cartão; eventos de Checkout.
- Introdução e criação de Link de Pagamento.
- Introdução a cobranças; cobranças via cartão; cobrança parcelada.
- Parcelamentos e identificação de cobranças associadas.
- Limites e formas de pagamento; funcionamento de cobranças parceladas.
- Repasse automático de taxas; juros a partir de determinada parcela; juros/multa.
- Taxas de cobrança; simulador; compensação e antecipação.
- Estornos; estorno de cartão; chargeback; PCI-DSS.
- WooCommerce: formas de pagamento e formas de cobrança.
- Nuvemshop: configurações iniciais e FAQ.
- Magento: configurações iniciais.

### OpenAPI v3

- `POST /v3/checkouts` e `POST /v3/checkouts/{id}/cancel`.
- `POST /v3/paymentLinks`, `PUT /v3/paymentLinks/{id}` e consultas relacionadas.
- `POST /v3/payments`, `POST /v3/payments/`, `POST /v3/lean/payments` e
  `POST /v3/lean/payments/`.
- `POST /v3/installments`, `POST /v3/installments/`,
  `GET /v3/installments/{id}` e `GET /v3/installments/{id}/payments`.
- `POST /v3/installments/{id}/refund`, cancelamento e remoção de parcelas pendentes.
- `POST /v3/payments/simulate` e `GET /v3/myAccount/fees/`.
- endpoints de antecipação, estorno e chargeback.

Nenhuma fonte secundária foi usada como autoridade.
