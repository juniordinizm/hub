---
status: proposed
owner: engineering
last_verified_commit: 1281924625070c4ca2c7a5ff3fb0bc170149e3ec
---

# Pesquisa sobre repasse economico automatico no Asaas

## Pergunta e conclusao

O Hub pode substituir uma tabela manual de percentuais por um calculo atualizado a
partir das condicoes da propria conta Asaas. A automacao e tecnicamente viavel, mas nao
e uma configuracao do Checkout hospedado: ela precisa ser implementada pelo Hub antes
da criacao da cobranca.

A solucao mais confiavel usa dois contratos oficiais:

1. `GET /v3/myAccount/fees/` le as taxas vigentes da conta autenticada, inclusive
   percentuais promocionais e expiracao;
2. `POST /v3/payments/simulate` simula um valor bruto e uma quantidade de parcelas e
   devolve o liquido estimado pelo Asaas.

Uma formula local fornece o primeiro candidato e o simulador confirma ou corrige os
centavos. A formula sozinha nao e suficiente: o Asaas nao publica a regra de
arredondamento e o Sandbox produziu resultados diferentes para quantidades pertencentes
a mesma faixa percentual.

Esta automacao elimina a manutencao cotidiana de percentuais pelo Admin, mas nao oferece
garantia perpetua de um liquido exato. Nao existe webhook documentado de alteracao de
taxas, o simulador apresenta estimativas e pode haver mudanca contratual entre a cotacao,
a criacao e a compensacao. O Pedido precisa preservar a cotacao utilizada.

## Confirmacao do suporte Asaas

Em 3 de agosto de 2026, o suporte confirmou que o repasse nativo para o pagador nao pode
ser ativado por API e nao esta disponivel para Links de Pagamento criados por API. Pela
API, a integracao deve calcular o valor final e envia-lo ja acrescido. O suporte tambem
confirmou que `maxInstallmentCount` apenas limita a quantidade e que nao e possivel
remover a opcao 1x do Link.

Essa resposta nao altera a recomendacao; ela elimina a hipotese de um campo nativo ainda
nao documentado. A nomenclatura correta passa a ser **precificacao automatica pelo Hub**,
nao **repasse automatico do Asaas**.

A orientacao do suporte sobre `value`, `installmentValue` e total nao fornece campos
contabeis separados. No contrato oficial, `installmentValue` define manualmente cada
parcela e `totalValue` define o bruto agregado a parcelar. Nenhum deles preserva sozinho
preco-base e acrescimo. O Hub deve armazenar `base_amount_in_cents`,
`surcharge_amount_in_cents` e `amount_in_cents`; o Asaas recebe o bruto final.

## Contratos oficiais

### Taxas da conta

`GET /v3/myAccount/fees/` retorna `MyAccountGetAccountFeesResponseDTO`. Em
`payment.creditCard`, o OpenAPI atual publica:

- `operationValue`: taxa operacional fixa por cobranca;
- `oneInstallmentPercentage`: percentual de 1x;
- `upToSixInstallmentsPercentage`: percentual de 2x a 6x;
- `upToTwelveInstallmentsPercentage`: percentual de 7x a 12x;
- `upToTwentyOneInstallmentsPercentage`: percentual de 13x a 21x;
- os quatro equivalentes promocionais, prefixados por `discount`;
- `discountExpiration` e `daysToReceive`.

O endpoint e explicitamente das taxas da conta autenticada. Para o teto comercial de
12 parcelas do Hub, interessam as faixas 1x, 2-6x e 7-12x. O OpenAPI nao define a regra
de fallback entre taxa promocional e normal. O Sandbox devolveu adicionalmente
`hasValidDiscount`, campo que nao aparece no schema revisado; a integracao precisa
validar campos conhecidos e tolerar adicoes.

O mesmo retorno possui um objeto separado `anticipation.creditCard` com taxas mensais
de antecipacao a vista e parcelada. Ele nao informa se a antecipacao automatica esta
habilitada; essa configuracao pertence a outro endpoint. A taxa parcelada aparece
incorretamente tipada como inteiro no OpenAPI, embora represente percentual mensal.

Fonte: [Recuperar taxas da conta](https://docs.asaas.com/reference/recuperar-taxas-da-conta).

### Simulador de vendas

`POST /v3/payments/simulate` recebe:

```json
{
  "value": 100,
  "installmentCount": 3,
  "billingTypes": ["CREDIT_CARD"]
}
```

`value` e `billingTypes` sao obrigatorios; `installmentCount` e opcional. Para cartao, a
resposta publica:

- `netValue`: liquido total estimado;
- `feePercentage`: percentual aplicado;
- `operationFee`: taxa operacional;
- `installment.paymentValue`: bruto por parcela;
- `installment.paymentNetValue`: liquido por parcela.

O endpoint exige autenticacao, nao recebe `accountId` e, no Sandbox, refletiu exatamente
as taxas atuais devolvidas pelo endpoint da conta. Portanto, e uma inferencia forte e
comprovada na conta de teste que a simulacao usa as condicoes da credencial autenticada;
a pagina nao usa literalmente o termo `account-specific`.

O simulador nao retorna antecipacao, nao publica formula de gross-up, precisao decimal,
piso ou regra de arredondamento. A pagina o descreve como apropriado para apresentar
estimativas antes da contratacao. Todos os campos de resposta sao opcionais no OpenAPI;
o adapter deve recusar resposta incompleta, valor nao finito ou forma inesperada.

Fontes: [Simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas) e
[changelog do simulador](https://docs.asaas.com/changelog/endpoint-para-simular-taxas-de-cobran%C3%A7as).

## O que significa "comprador paga"

Existem duas politicas economicamente diferentes:

### Repasse integral das taxas do cartao

O preco do Curso e o liquido-alvo. O total cobrado e aumentado ate o Asaas estimar que o
Hub recebera o preco completo depois da taxa percentual e operacional.

Se `B` e o liquido-alvo, `p` a taxa percentual em forma decimal e `f` a taxa fixa, o
candidato matematico e:

```text
G = (B + f) / (1 - p)
```

Somar apenas `B * p + f` nao faz gross-up: a taxa percentual tambem incide sobre o
acrescimo. O recurso nativo de repasse do painel segue o principio de preservar o
liquido, mas o Asaas nao publica sua formula nem um campo equivalente na API.

### Repasse somente do custo incremental do parcelamento

Esta e a traducao precisa da regra "1x a vendedora absorve; 2x ou mais a compradora paga
o acrescimo". Primeiro se simula o preco-base em 1x e se obtem o liquido que a vendedora
aceitou receber. Para cada quantidade maior, procura-se o menor total cujo `netValue`
seja pelo menos esse liquido de 1x.

Assim, a vendedora continua absorvendo a taxa normal do cartao a vista e a compradora
cobre somente a diferenca economica causada pelo parcelamento. Esta politica produz um
acrescimo muito menor que o repasse integral e corresponde melhor a decisao de produto
discutida.

## Evidencia real do Sandbox

Em 3 de agosto de 2026, os endpoints oficiais foram chamados com a credencial Sandbox
do projeto, sem criar cliente, cobranca ou outro recurso persistente.

Taxas retornadas:

- operacao: R$ 0,49;
- 1x: 2,99%;
- 2-6x: 3,49%;
- 7-12x: 3,99%;
- 13-21x: 4,29%;
- promocao expirada e `hasValidDiscount=false`;
- antecipacao separada: 1,25% a.m. a vista e 1,70% a.m. parcelada.

Para R$ 100,00, o simulador retornou:

| Parcelas | Liquido estimado | Percentual | Operacao |
| --- | ---: | ---: | ---: |
| 1x | R$ 96,52 | 2,99% | R$ 0,49 |
| 2x | R$ 96,04 | 3,49% | R$ 0,49 |
| 3x | R$ 96,04 | 3,49% | R$ 0,49 |
| 6x | R$ 96,04 | 3,49% | R$ 0,49 |
| 7x | R$ 95,58 | 3,99% | R$ 0,49 |
| 12x | R$ 95,56 | 3,99% | R$ 0,49 |

Para preservar R$ 96,52, liquido de 1x, a busca em centavos encontrou:

| Parcelas | Total cobrado | Acrescimo sobre R$ 100 |
| --- | ---: | ---: |
| 2x | R$ 100,50 | R$ 0,50 |
| 3x | R$ 100,48 | R$ 0,48 |
| 6x | R$ 100,48 | R$ 0,48 |
| 7x | R$ 101,00 | R$ 1,00 |
| 12x | R$ 100,96 | R$ 0,96 |

As diferencas entre 2x, 3x e 6x, apesar do mesmo percentual, provam que ha
arredondamento por quantidade/parcela. Para repasse integral e liquido-alvo de R$ 100,
os menores totais encontrados tambem variaram: R$ 104,10 em 2x, R$ 104,11 em 3x,
R$ 104,08 em 6x e R$ 104,56 em 12x. Uma formula local arredondada para cima e segura,
mas pode cobrar centavos alem do necessario; o simulador e necessario quando a regra
exige o menor total possivel.

### Prova de cobranca parcelada por Fatura

Ainda em 3 de agosto de 2026, foi criada no Sandbox uma cobranca pendente de cartao,
sem dados de cartao, com `installmentCount=3` e `totalValue=100.48`. O Asaas retornou
`invoiceUrl` e um identificador agregado de parcelamento. A consulta do parcelamento
confirmou:

- total contratado: R$ 100,48;
- quantidade fixa: 3 parcelas;
- liquido agregado: R$ 96,52, exatamente igual ao simulado e ao liquido-alvo de 1x;
- parcelas brutas de R$ 33,49, R$ 33,49 e R$ 33,50;
- parcelas liquidas de R$ 32,17, R$ 32,17 e R$ 32,18;
- cada parcela possui seu proprio pagamento e vencimento, ligados ao mesmo
  `installment` e `externalReference`.

Essa prova elimina a incerteza sobre a criacao sem cartao, o `invoiceUrl`, o total
agregado e o arredondamento antes da liquidacao. Ainda falta uma confirmacao manual na
Fatura de que a interface nao oferece outra quantidade e um pagamento Sandbox para
comparar o agregado liquidado com a simulacao.

Uma tentativa de enviar `callback.successUrl` falhou porque o Sandbox nao possui um
dominio cadastrado nas Informacoes da conta. O planejamento deve incluir cadastrar o
dominio de Staging no Asaas ou omitir esse callback e manter uma jornada de retorno
explicita, sem confundir callback de navegacao com webhook financeiro.

## Antecipacao

O repasse economico de processamento nao deve incluir antecipacao:

- `/payments/simulate` nao a inclui;
- a antecipacao depende de prazo, elegibilidade e decisao operacional posterior;
- o Asaas possui simulador proprio de antecipacao, aplicado a uma cobranca ou
  parcelamento ja existente;
- o artigo oficial sobre antecipar cobrancas com repasse afirma que a antecipacao
  considera o valor original e que a parcela de taxa repassada nao integra o liquido.

Incluir antecipacao no preco do Curso seria outra politica comercial, instavel e
incompativel com a semantica do repasse nativo. O Hub deve exclui-la.

Fontes: [Simular antecipacao](https://docs.asaas.com/reference/simular-antecipacao) e
[antecipar cobranca com repasse](https://central.ajuda.asaas.com/hc/pt-br/articles/39311400852891-Posso-antecipar-cobran%C3%A7as-de-cart%C3%A3o-com-repasse-de-taxas).

## Algoritmo recomendado para futura implementacao

Para a politica incremental:

1. ler e armazenar por curto prazo as taxas da conta por ambiente;
2. simular o preco-base em 1x para obter `targetNet`;
3. para cada quantidade permitida, gerar um candidato com a formula fechada usando a
   taxa da faixa;
4. validar o candidato no simulador e ajustar em centavos ate encontrar o menor total
   com `netValue >= targetNet`;
5. no momento da escolha/finalizacao, repetir a simulacao da opcao escolhida;
6. persistir a cotacao e criar a cobranca com aquele total fixo;
7. tratar qualquer alteracao posterior de taxa como variacao contabil do provedor, sem
   alterar silenciosamente um Pedido ja contratado.

Uma busca binaria em centavos e monotona e correta, mas multiplicada por 11 opcoes pode
consumir muitas chamadas. O desenho mais eficiente e calcular as opcoes no servidor com
cache, usar a formula como seed e simular apenas a opcao selecionada novamente. A cota
geral publicada e 25 mil chamadas por conta a cada 12 horas, e endpoints podem ter
limites adicionais. Nao disparar 11 simulacoes em cada renderizacao.

Fonte: [Limites da API](https://docs.asaas.com/docs/api-limits-1).

### Expiracao e concorrencia

Nao ha webhook documentado para mudanca de taxas. A atualizacao automatica depende de
TTL e nova leitura. `discountExpiration` permite encurtar o TTL perto do fim de uma
promocao, mas nao cobre renegociacao manual ou mudanca extraordinaria.

A cotacao precisa ter validade curta e ser confirmada antes de reservar o Pedido. Depois
de o total ser mostrado e aceito, o Pedido deve preservar aquele total. Se a taxa mudar
entre a confirmacao e a compensacao, o Hub nao deve alterar o que a compradora pagara;
essa diferenca vira custo ou ganho da vendedora. Nao existe transacao atomica entre
`simulate` e `create payment`.

## Limite estrutural do fluxo hospedado atual

O Hub hoje cria um Asaas Checkout com um item de preco fixo e
`maxInstallmentCount`. A pagina hospedada escolhe a quantidade depois da criacao e nao
possui campo publico para variar o total conforme a escolha. Portanto, o calculo
automatico nao pode ser encaixado no payload atual.

O Link de Pagamento tem o mesmo problema: o valor e fixo e
`maxInstallmentCount` e um teto, nao uma tabela de totais. Criar um link por quantidade
nao fixa necessariamente a quantidade e pode cobrar o total de uma quantidade maior
quando a compradora escolher menos parcelas.

A cobranca direta com `installmentCount + totalValue` fixa a quantidade e permite o
total calculado. `POST /v3/payments` retorna `invoiceUrl`, de modo que o cartao ainda
pode ser informado na Fatura hospedada e nao atravessar o Hub. Esse e o contrato tecnico
adequado ao repasse automatico.

Fontes: [Checkout para cartao](https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito),
[Criar nova cobranca](https://docs.asaas.com/reference/criar-nova-cobranca) e
[Cobrancas via cartao](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito).

## Lacuna de identidade publica

A troca de Checkout por Fatura nao e transparente para a jornada atual:

- o Checkout anonimizado permite que o proprio Asaas colete nome, documento e e-mail;
- a cobranca direta exige um `customer` Asaas ja existente;
- criar `customer` exige `name` e `cpfCnpj` no OpenAPI atual; para vincular a compra
  publica ao futuro cadastro, o Hub tambem precisa do e-mail;
- o Hub deliberadamente nao coleta esses dados antes do Checkout.

Consequentemente, a politica exata exige uma destas decisoes antes do planejamento:

1. introduzir uma etapa minima, hospedada pelo Hub, para nome, CPF/CNPJ e e-mail antes
   da Fatura;
2. obter do Asaas um contrato oficial diferente que crie Fatura/cliente e colete a
   identidade depois, ainda nao encontrado;
3. manter o Checkout atual e aceitar que o repasse dinamico por quantidade nao e
   possivel nesse fluxo.

Nao existe evidencia oficial de que o Checkout compartilhe os dados preenchidos antes
de criar a cobranca de modo que o Hub possa recalcular seu total no meio da sessao.

Fonte: [Criar novo cliente](https://docs.asaas.com/reference/criar-novo-cliente).

## Impactos necessarios no Hub antes de planejar

O adapter atual `AsaasGateway` cria Checkout e consulta/reembolsa pagamentos e
parcelamentos. O fluxo dinamico exigira novas responsabilidades estreitas para taxas,
simulacao, cliente e criacao de cobranca, sem expor cartao ao backend.

### Oferta e cotacao

- adicionar politica por Curso, distinguindo `seller_absorbs_all`,
  `buyer_pays_incremental_installment_cost` e, somente se produto aprovar,
  `buyer_pays_all_card_fees`;
- manter 1-12x e piso de R$ 10 por parcela sobre o total final;
- apresentar quantidade, valor por parcela, acrescimo e total, sem chamar taxa de
  processamento de juros de mora;
- definir validade, fallback e comportamento quando Asaas/simulador estiver indisponivel.

### Persistencia financeira

O Pedido hoje usa `amount_in_cents` como preco vendido e compara esse valor com o bruto
do Asaas com tolerancia zero. Para o repasse, deve preservar separadamente:

- preco-base do Curso;
- politica escolhida;
- quantidade de parcelas;
- acrescimo cobrado;
- total bruto contratado;
- liquido-alvo e liquido simulado;
- percentual, taxa operacional e instante/validade da cotacao;
- identificador ou versao do algoritmo.

`amount_in_cents` deve continuar representando inequivocamente o total bruto contratado,
ou ser renomeado/migrado; acesso, divergencia, extrato, reembolso e Admin precisam usar a
mesma semantica. Reembolso integral devolve o total pago, inclusive acrescimo.

### Efeitos externos e recuperacao

A jornada passa de uma mutacao externa (`createCheckout`) para pelo menos cliente e
cobranca. Isso exige:

- reutilizacao segura de cliente e prevencao de duplicatas;
- idempotencia e estados intermediarios independentes para cada efeito;
- `externalReference` opaca e unica na cobranca;
- recuperacao quando o resultado de criar cliente ou cobranca for desconhecido;
- conciliacao que nao dependa de `checkoutSession`;
- manutencao do tratamento agregado de parcelamento, eventos por parcela e estorno do
  `installment`.

### Disponibilidade e seguranca

- cache deve ser isolado por ambiente/conta e nunca conter API key;
- falha ao obter ou validar cotacao deve fechar o fluxo de repasse, nao usar taxa velha
  silenciosamente;
- respostas externas devem ser validadas como `unknown` e aceitar campos aditivos;
- logs nao devem registrar dados de cliente nem credenciais;
- dados do cartao permanecem exclusivamente na Fatura Asaas, preservando o objetivo PCI.

## O que ainda falta provar

Antes de transformar esta pesquisa em plano de implementacao, restam provas de contrato
e decisoes de produto:

1. Sandbox: confirmar manualmente se a Fatura permite pagamento somente na quantidade predefinida e
   se nao oferece 1x ou outra quantidade com o mesmo total.
2. Sandbox: comparar `netValue` simulado com o agregado real confirmado, inclusive
   arredondamento, e repetir perto do piso de R$ 10 por parcela.
3. Suporte Asaas: confirmar quando a taxa e fixada, se simulacao e cobranca podem divergir
   por mudanca contratual e se existe API nao publicada para o repasse nativo.
4. Produto: ratificar que a politica desejada e incremental acima de 1x, nao repasse
   integral de todas as taxas.
5. Produto/UX: decidir se a etapa minima de identidade antes da Fatura e aceitavel ou se
   a ausencia de formulario adicional prevalece sobre o repasse dinamico.
6. Contabilidade/juridico: confirmar como acrescimo, nota fiscal, cancelamento e estorno
   devem ser apresentados e escriturados.

Sem a decisao de identidade, o algoritmo economico esta resolvido, mas a jornada publica
nao esta. Esse e o bloqueio real para o planejamento, nao o calculo das taxas.

## Recomendacao

Adotar como alvo a politica `buyer_pays_incremental_installment_cost`:

- 1x permanece no preco-base e a vendedora absorve sua taxa normal;
- 2-12x usam o liquido de 1x como alvo;
- taxas sao lidas automaticamente da conta;
- o simulador confirma a opcao escolhida e corrige centavos;
- antecipacao fica excluida;
- a cotacao completa e imutavel no Pedido.

Esta e superior a tabela manual porque acompanha negociacoes e promocoes da conta sem
edicao administrativa. Tambem e superior ao repasse integral porque preserva a regra de
produto aprovada e nao transfere ao comprador a taxa normal de 1x que a vendedora decidiu
absorver.

O proximo passo nao deve ser implementar o calculador isoladamente. Primeiro deve-se
provar a Fatura parcelada no Sandbox e decidir a coleta minima de identidade, porque
essas escolhas determinam a arquitetura, o schema e a jornada publica.
