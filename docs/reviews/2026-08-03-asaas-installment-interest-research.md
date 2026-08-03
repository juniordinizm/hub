---
status: proposed
owner: engineering
last_verified_commit: a963eed
---

# Pesquisa: repasse do custo do parcelamento por Curso no Asaas

## Escopo e método

Pesquisa concluída em 3 de agosto de 2026, usando somente fontes primárias do Asaas:

- documentação oficial indexada pelo Context7;
- documentação e OpenAPI atuais consultados pelo MCP oficial do Asaas;
- páginas oficiais de documentação e da Central de Ajuda abertas diretamente na web;
- código do Hub apenas para avaliar o impacto da mudança, sem alteração de código.

Foram comparados Checkout hospedado, Link de Pagamento, Fatura Asaas, cobranças e
parcelamentos criados pela API, checkout transparente do plugin WooCommerce,
simulação de taxas, antecipação, webhooks e estornos.

## Conclusão executiva

O Asaas não publica uma opção do tipo `interestPayer`, `passFeeToCustomer` ou equivalente.
Não existe, no Checkout hospedado ou no Link de Pagamento, uma configuração por sessão
para decidir se o custo do parcelamento será absorvido pela vendedora ou acrescentado ao
valor pago pela compradora.

No Checkout hospedado usado atualmente pelo Hub, o objeto `installment` contém somente
`maxInstallmentCount`, de 1 a 21 no contrato do provedor. O Link de Pagamento também
aceita somente um valor fixo e `maxInstallmentCount`. Nos dois produtos, a compradora
escolhe uma quantidade até o teto, mas o valor total não muda por parcela por meio de um
campo do Asaas.

O campo `interest` das APIs de cobranças não resolve o problema. O OpenAPI o define como
percentual mensal cobrado depois do vencimento. Ele representa juros de mora, não o
acréscimo comercial do parcelamento no cartão.

É tecnicamente possível fazer a compradora pagar um preço maior quando escolhe mais
parcelas, mas isso é uma política de preço do Hub, não uma transferência automática de
taxa do Asaas. O Hub precisa conhecer a quantidade escolhida antes de criar a cobrança,
calcular um valor total maior e persistir esse contrato no Pedido. A API de cobranças
permite informar `installmentCount` e `totalValue` ou `installmentValue`, portanto ela é
o mecanismo mais próximo dessa necessidade.

A melhor direção para o projeto é validar primeiro uma **Fatura Asaas de parcelamento
pré-configurado**, criada sem dados do cartão e aberta por `invoiceUrl`. Se o Sandbox e o
suporte confirmarem que a Fatura mantém a quantidade de parcelas fixa, essa abordagem
preserva a coleta hospedada de cartão e evita transformar o Hub em um checkout que
processa dados sensíveis. A documentação combina essas capacidades apenas de forma
indireta; por isso, essa hipótese ainda não deve virar implementação sem teste de
contrato.

## Capacidades confirmadas

### Checkout hospedado

`POST /v3/checkouts` recebe:

- `billingTypes`;
- `chargeTypes`;
- itens e valor;
- `installment.maxInstallmentCount` quando `INSTALLMENT` está habilitado.

O OpenAPI atual não contém percentual, tabela por número de parcelas, custo financeiro
ou escolha do pagador desse custo. O valor dos itens é único para a sessão. A própria
documentação diz que o comprador poderá escolher à vista ou até o máximo configurado.

Consequência: uma sessão não consegue cobrar R$ X em 1x, R$ Y em 3x e R$ Z em 12x.

Fontes:

- [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito)
- [Criar novo Checkout](https://docs.asaas.com/reference/criar-novo-checkout)

### Link de Pagamento

`POST /v3/paymentLinks` publica `value`, `chargeType` e `maxInstallmentCount`. O schema
não publica tabela de juros ou preço variável por quantidade escolhida. O pagamento gera
webhook de cobrança com `paymentLink`, mas o produto não acrescenta ao contrato uma
capacidade ausente no Checkout.

Consequência: trocar o Checkout atual por Link de Pagamento não implementaria a regra.

Fonte: [Criando um Link de Pagamento](https://docs.asaas.com/docs/criando-um-link-de-pagamentos)

### Cobrança e parcelamento pela API

Os endpoints de cobrança/parcelamento permitem definir a condição antes da captura:

- `installmentCount`: quantidade exata;
- `totalValue`: valor total do parcelamento;
- `installmentValue`: valor de cada parcela, como alternativa ao total.

Isso permite ao Hub calcular um preço final diferente para cada quantidade. Não existe
um campo que repasse a taxa: o valor maior é o preço contratado com a compradora, enquanto
o Asaas continua descontando suas taxas do recebimento da vendedora.

O guia de cartão também permite criar uma cobrança `CREDIT_CARD` sem enviar dados do
cartão e redirecionar para a `invoiceUrl` da Fatura Asaas. Entretanto, o exemplo de
redirecionamento é de cobrança avulsa, enquanto o exemplo parcelado envia o cartão pela
API. A combinação “parcelamento exato sem cartão + Fatura hospedada” é uma inferência
plausível a ser comprovada no Sandbox e com o suporte.

Fontes:

- [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- [Criar uma cobrança parcelada](https://docs.asaas.com/docs/criar-uma-cobranca-parcelada)
- [Criar parcelamento com cartão](https://docs.asaas.com/reference/criar-parcelamento-com-cart%C3%A3o-de-cr%C3%A9dito)

### Campo `interest`

No OpenAPI de cobranças, `interest.value` é “percentual de juros por mês sobre o valor
cobrado para pagamento após o vencimento”. A Central de Ajuda confirma cálculo diário
sobre dias de atraso. Usá-lo como juros do parcelamento seria semanticamente incorreto e
não alteraria o preço conforme 2x, 3x ou 12x.

Fonte: [Juros, multa e desconto nas cobranças](https://central.ajuda.asaas.com/hc/pt-br/articles/31965188701083-Como-adicionar-juros-multa-e-desconto-nas-cobran%C3%A7as)

### Plugin WooCommerce

O plugin oficial permite configurar juros exclusivos por quantidade de parcelas e altera
o valor final no checkout transparente da loja. Também limita cartão a 12 parcelas.
Essa é uma capacidade da camada WooCommerce/plugin, que controla seleção e preço antes de
enviar a cobrança, não uma propriedade do Checkout hospedado Asaas.

O plugin prova a viabilidade do padrão “selecionar parcela, recalcular total, criar
cobrança”, mas não pode ser usado como prova de que `POST /v3/checkouts` aceita a mesma
configuração.

Fontes:

- [WooCommerce](https://docs.asaas.com/docs/woocommerce)
- [Formas de pagamento no plugin](https://docs.asaas.com/docs/forma-de-pagamento)
- [FAQ do plugin WooCommerce](https://docs.asaas.com/docs/faq-woocommerce)

### Segurança e PCI-DSS

Se o Hub coletar número, validade e CVV e enviar os dados do cartão pela API, a
documentação do Asaas indica SAQ-D. O Asaas declara que não oferece tokenização
client-side; tokenização server-side ainda faz os dados trafegarem pelo backend.

Checkout, Fatura e Link hospedados mantêm a interação de cartão no ambiente do Asaas e
são associados pelo provedor ao escopo SAQ-A. Portanto, construir checkout transparente
próprio apenas para oferecer juros aumenta materialmente segurança, conformidade e
operação e não é a primeira escolha recomendada.

Fonte: [PCI-DSS no Asaas](https://docs.asaas.com/docs/pci-dss-1)

### Taxas, simulação e antecipação

`POST /v3/payments/simulate` estima `netValue`, percentual e taxa operacional para valor,
quantidade e forma de pagamento. Ele pode apoiar a administração na definição de uma
tabela comercial, mas a documentação não o apresenta como cotação vinculante nem como
comando de repasse ao comprador.

Uma consulta autenticada ao MCP oficial no Sandbox, em 3 de agosto de 2026, simulou uma
venda de R$ 100,00 nesta conta e retornou:

- 1x: 2,99% + R$ 0,49; líquido de R$ 96,52;
- 2x, 3x e 6x: 3,49% + R$ 0,49; líquido de R$ 96,04;
- 12x: 3,99% + R$ 0,49; líquido de R$ 95,56.

Essa amostra prova que a condição pode variar por faixa de parcelas e que o simulador
consegue informar a taxa vigente. Ela não prova estabilidade futura nem autoriza usar a
resposta como preço vinculante sem snapshot e política administrativa.

Antecipação é outra operação. Ela tem sua própria taxa, elegibilidade e simulação, pode
ser aplicada ao parcelamento inteiro ou a parcelas e não deve ser misturada ao “juros do
parcelamento”. Antes de implementar, o produto precisa decidir se “repassar juros” quer
dizer:

1. repassar apenas o custo incremental de parcelar em comparação com 1x;
2. repassar toda a taxa de cartão;
3. repassar também uma eventual antecipação.

A primeira definição é a mais coerente com a linguagem apresentada à compradora. A
terceira não é recomendada como regra automática, pois antecipação é uma decisão de fluxo
de caixa posterior à compra.

Fontes:

- [Simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas)
- [Simular e solicitar antecipação](https://docs.asaas.com/recipes/simular-e-solicitar-antecipa%C3%A7%C3%A3o-de-receb%C3%ADveis)

## Limites e semântica do preço

O limite técnico publicado pelo Asaas é de até 21x para Visa e Mastercard e 12x para as
demais bandeiras. O limite comercial decidido para o Hub pode e deve permanecer em 12x.
O valor mínimo da parcela e as condições da conta podem reduzir o conjunto efetivamente
disponível.

“Compradora paga” não muda quem é contratualmente debitado pelo Asaas. A conta da
vendedora continua recebendo o bruto menos as taxas. O Hub apenas acrescenta ao preço uma
parcela comercial destinada a compensar total ou parcialmente esse custo. A interface e
os snapshots precisam chamar isso de acréscimo/valor do parcelamento, não de “taxa do
Asaas repassada” sem correspondência contábil comprovada.

## Opções arquiteturais

### 1. Manter Checkout hospedado e a vendedora absorver o custo

É a opção já implementada, de menor risco. Preserva um único link, escolha dentro do
Asaas, Checkout hospedado, correlação por `checkoutSession` e o fluxo atual de webhook e
reembolso.

Limitação: não atende o modo em que a compradora paga acréscimo variável por parcela.

### 2. Embutir um preço único maior no Checkout hospedado

É possível elevar o preço do item antes de criar a sessão, mas todas as quantidades pagam
o mesmo total. Uma compradora em 1x subsidiaria quem escolhe mais parcelas.

Conclusão: não recomendar como implementação de “juros por parcela”. Pode existir como
política geral de preço, mas é outro requisito.

### 3. Criar uma sessão hospedada separada para cada quantidade

Não resolve de forma segura. `maxInstallmentCount` é teto, não quantidade exata. Uma
sessão nominalmente criada para 6x ainda permite escolher menos parcelas pagando o preço
preparado para 6x.

Conclusão: rejeitar.

### 4. Selecionar a condição antes e abrir uma Fatura Asaas pré-configurada

Fluxo proposto:

1. A landing page apresenta as condições, sem coletar nome, e-mail ou cartão.
2. Cada CTA chama o link estável do Hub com a quantidade escolhida, por exemplo
   `/comprar/{slug}?parcelas=6`.
3. O Hub valida a oferta efetiva, calcula e captura o preço final como snapshot.
4. O Hub cria o parcelamento com quantidade exata e sem dados de cartão.
5. A compradora é redirecionada para a `invoiceUrl` hospedada pelo Asaas e informa os
   dados apenas ali.
6. O Hub concede acesso somente após evidência financeira autoritativa por webhook.

Vantagens:

- preço correto para a quantidade escolhida;
- CTA continua apontando diretamente para um link do Hub, sem formulário redundante;
- dados do cartão permanecem fora do Hub, se a Fatura se comportar como documentado;
- aproveita o agregado nativo de parcelamento e o reembolso integral do agregado.

Custos e riscos:

- exige que a landing page mostre as opções ou escolha uma condição padrão; um único CTA
  genérico não pode deixar a escolha para o Asaas e ainda variar o total;
- troca `checkoutSession` por correlação de Pedido, parcelamento e cobranças;
- um parcelamento gera IDs próprios e cobranças associadas; os webhooks precisam validar
  o agregado, não comparar uma parcela isolada com o total do Pedido;
- a combinação exata de API + Fatura hospedada ainda precisa de prova.

Conclusão: **alternativa recomendada para protótipo contratual**, não para implementação
direta antes das confirmações listadas abaixo.

### 5. Checkout transparente próprio usando a API de cartão

Permite capturar a quantidade e criar imediatamente o parcelamento no valor calculado,
como faz a integração WooCommerce. Porém coloca o tráfego de dados de cartão sob
responsabilidade do Hub, com SAQ-D indicado pelo Asaas e sem tokenização client-side.

Conclusão: rejeitar para o projeto atual, salvo mudança explícita de estratégia de
segurança e conformidade.

## Política de preço recomendada

O Asaas não oferece a taxa como uma regra de preço pronta. O Hub precisa de uma política
determinística e auditável. A recomendação é:

- `seller_absorbs`: total cobrado é o preço-base para qualquer quantidade;
- `buyer_pays_installment_increment`: o total inclui somente o acréscimo incremental
  aprovado para aquela quantidade, mantendo 1x sem acréscimo;
- tabela efetiva de 2x a 12x versionada e persistida, com padrão global e possibilidade
  de override por Curso;
- simulador do Asaas usado para sugerir/revisar a tabela, não como alteração silenciosa
  de preço no instante da compra;
- arredondamento em centavos definido uma vez e exibido antes do CTA;
- snapshots no Pedido de preço-base, quantidade, percentual/valor do acréscimo, total
  cobrado e versão da política.

Uma tabela persistida é preferível a consultar o simulador em toda compra: evita preço
mudar sem ação administrativa, permite reproduzir o contrato e não pressupõe que uma
simulação seja cotação vinculante. A tabela deve ser revista quando as condições
comerciais da conta mudarem.

Antes de aprovar essa política, Produto/Financeiro precisa confirmar se o objetivo é
repassar apenas o custo incremental sobre 1x. Questões jurídicas e de transparência de
preço devem ser validadas por responsável qualificado; a documentação do Asaas não é
autoridade para essa decisão.

## Impacto no módulo atual

O módulo atual já modela `provider_installment_id`, consulta o agregado, valida seu total
e suporta reembolso integral por `/v3/installments/{id}/refund`. Isso reduz parte do
trabalho. Ainda assim, a alternativa recomendada muda contratos importantes:

- criação: de `POST /v3/checkouts` para criação de cobrança/parcelamento com condição
  exata no fluxo com acréscimo;
- correlação: o agregado criado sem Checkout pode ter `checkoutSession = null`; a
  validação atual exige correlação exata com a sessão;
- identidade: os dados informados na Fatura precisam ser recuperáveis com segurança e
  vinculados ao Pedido público;
- valor: comparar o total bruto do agregado com o novo snapshot, nunca o valor isolado de
  uma parcela;
- eventos: cada parcela possui um `payment` e pode emitir eventos; idempotência e
  precedência terminal continuam obrigatórias;
- reembolso: reembolso integral deve devolver o total bruto pago, inclusive acréscimo,
  e só revogar acesso após confirmação autoritativa;
- conciliação: registrar separadamente preço-base, acréscimo, taxa efetiva do Asaas,
  líquido e eventual custo de antecipação.

Fontes:

- [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Parcelamentos e cobranças associadas](https://docs.asaas.com/docs/installments)
- [Estornos](https://docs.asaas.com/docs/estornos)
- [Estornar um parcelamento](https://docs.asaas.com/reference/estornar-um-parcelamento)

## Webhooks e reembolsos

O provedor documenta `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, eventos de risco,
`PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS` e eventos
de chargeback. O objeto da cobrança expõe `installment`, `value`, `netValue`,
`installmentNumber` e o array `refunds`.

A regra de acréscimo não deve mudar a autoridade financeira:

- redirecionamento nunca confirma compra;
- liberação continua dependendo de evento financeiro e validação do agregado;
- reembolso integral usa o total realmente pago pela compradora;
- taxas não devem ser reconstruídas a partir do acréscimo comercial;
- reembolso parcial continua em revisão humana até existir política própria.

O OpenAPI permite reembolsar o agregado por `/v3/installments/{id}/refund`, inclusive com
`value` opcional para um total específico. A documentação não esclarece nesta pesquisa
se as taxas de processamento são devolvidas, nem a granularidade exata dos eventos em
todos os estados de um parcelamento direto. Esses pontos exigem Sandbox e suporte.

## Gates antes de implementar

### Confirmações com o suporte técnico/comercial do Asaas

1. Existe alguma configuração de conta ou campo não publicado para repassar ao comprador
   o custo do parcelamento no Checkout v3?
2. Um parcelamento `CREDIT_CARD` criado sem `creditCard`/token retorna uma `invoiceUrl`
   que coleta o cartão e processa o agregado?
3. Nessa Fatura, `installmentCount` fica fixo ou a compradora pode escolher outra
   quantidade?
4. A classificação PCI recomendada para esse fluxo permanece SAQ-A?
5. Quais eventos são emitidos para criação, confirmação, recebimento, risco, estorno e
   chargeback de um parcelamento direto? Um evento por agregado ou por cobrança?
6. Qual campo/endpoint é a autoridade para o valor bruto total confirmado e para a
   identidade preenchida na Fatura?
7. `POST /v3/payments/simulate` é apenas estimativa? Por quanto tempo a condição é válida
   e quais taxas inclui?
8. No reembolso integral do agregado, quais taxas são devolvidas ou mantidas e como isso
   aparece em `refunds`, `netValue` e webhooks?
9. Há requisitos ou limites comerciais específicos da conta para usar a Fatura com
   parcelamento e até 12x?

### Provas obrigatórias no Sandbox

1. Criar parcelamentos de 2x, 3x e 12x sem dados de cartão.
2. Abrir a Fatura, conferir preço total, valor das parcelas e impossibilidade de trocar a
   quantidade contratada.
3. Concluir cartão e capturar a sequência completa de webhooks e objetos consultáveis.
4. Confirmar como identidade, `externalReference`, installment ID e payment IDs podem ser
   correlacionados sem `checkoutSession`.
5. Simular falha, expiração/abandono, risco e duplicação de webhook.
6. Fazer reembolso integral e confirmar valor devolvido, eventos e revogação de acesso.
7. Validar bandeiras distintas, mínimo de R$ 10 por parcela e teto comercial de 12x.

Se qualquer teste mostrar que a Fatura permite alterar a quantidade sem recalcular o
total, a alternativa deve ser rejeitada. Nesse caso, restam absorver o custo no Checkout
hospedado ou assumir o escopo PCI-DSS de um checkout próprio.

## Plano recomendado em fases

### Fase 0: decisão comercial

- Definir “repassar juros” como custo incremental do parcelamento sobre 1x.
- Aprovar transparência, arredondamento e regra de reembolso do acréscimo.
- Definir tabela global inicial de 2x a 12x e se cada Curso pode sobrescrever valores.

### Fase 1: spike sem mudança de produto

- Obter respostas do suporte.
- Criar script descartável de Sandbox para Fatura de parcelamento sem cartão.
- Registrar payloads e webhooks sem dados pessoais ou credenciais.
- Encerrar o spike com decisão `go/no-go` para a Fatura hospedada.

### Fase 2: modelo e cálculo, por TDD

- Modelar modo de absorção e tabela versionada.
- Implementar cálculo puro em centavos, limites, arredondamento e snapshots.
- Separar preço-base, acréscimo e total no Pedido sem reescrever históricos.
- Adicionar migration forward-only e invariantes de banco.

### Fase 3: links de condição e criação

- Expor ao Admin links estáveis por quantidade permitida.
- Fazer a landing page escolher a condição; não adicionar formulário de identidade.
- Criar o agregado exato, persistindo intenção antes do efeito externo.
- Redirecionar para Fatura somente depois de validar a resposta e a correlação.

### Fase 4: webhook, conciliação e reembolso

- Adaptar correlação para agregado sem `checkoutSession`, preservando fail-closed.
- Validar total do agregado e quantidade contra snapshots.
- Conceder acesso uma única vez.
- Reembolsar e confirmar o total bruto do agregado; manter parcial em revisão.
- Exibir preço-base, acréscimo, bruto, taxa e líquido separadamente no Admin.

### Fase 5: homologação e rollout

- Cobrir unitários, integração PostgreSQL, contrato HTTP e E2E.
- Homologar 1x, 2x, 3x e 12x em Sandbox, com e sem acréscimo.
- Lançar primeiro em Staging e em um Curso descartável.
- Manter `seller_absorbs` como fallback por Curso.
- Não promover a Production antes de conferência manual do valor exibido, valor pago,
  líquido, webhook, acesso e reembolso.

## Decisão recomendada

Não implementar uma falsa chave “juros pagos pelo cliente” sobre o Checkout atual. Ela
não teria efeito comprovado no Asaas.

Prosseguir com um spike da Fatura hospedada de parcelamento exato. Se aprovado, modelar o
recurso como **política de preço por condição**, com seleção na landing page, snapshot
imutável e cobrança do total calculado. Manter o Checkout hospedado atual para Cursos em
que a vendedora absorve o custo até que uma eventual unificação seja justificada.

Não adotar checkout transparente com cartão no Hub enquanto o Asaas não oferecer
tokenização client-side ou o projeto não aprovar explicitamente o escopo SAQ-D.
