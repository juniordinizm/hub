---
status: proposed
owner: engineering
last_verified_commit: 1281924625070c4ca2c7a5ff3fb0bc170149e3ec
---

# Pesquisa comunitária sobre parcelamento e repasse no Asaas

## Pergunta investigada

Como desenvolvedores e comerciantes que usam o Asaas implementam, na prática:

- 1x sem acréscimo e 2x ou mais com acréscimo;
- repasse da taxa do cartão ao comprador;
- parcelamento em Checkout, Link, Fatura e API;
- configuração por produto;
- cálculo de taxa, `gross-up` e antecipação.

A pesquisa foi realizada em 3 de agosto de 2026. Foram priorizados código-fonte do
plugin oficial, fórum de suporte do plugin, relatos técnicos rastreáveis e integrações
de terceiros que documentam o próprio comportamento. Alegações comunitárias foram
cruzadas com a documentação oficial atual. Resultados de busca sem conteúdo verificável,
textos de afiliados e páginas de SEO não foram usados como autoridade.

## Conclusão executiva

A comunidade não encontrou nem usa um campo oculto do Asaas para definir “quem paga os
juros”. O padrão observado é mais simples:

1. a loja mostra a quantidade de parcelas antes de criar/processar a cobrança;
2. a própria loja consulta uma tabela de acréscimos;
3. soma o acréscimo ao pedido;
4. envia ao Asaas o total final e a quantidade escolhida por meio de `totalValue` e
   `installmentCount`.

Essa não é apenas uma sugestão de fórum. É exatamente o que faz o plugin oficial
**Asaas Gateway for WooCommerce 2.7.7**, mantido pelo Asaas e usado em mais de 8 mil
instalações ativas. Portanto, a regra “1x sem acréscimo; 2x+ com acréscimo” é trivial no
cálculo e suportada pela API de cobranças. A dificuldade do Hub não está no Asaas
processar o parcelamento; está em manter a escolha dentro do Checkout hospedado, cujo
contrato só recebe `maxInstallmentCount` e um total fixo.

Não há consenso comunitário sobre a melhor política comercial. Foram observados três
modelos recorrentes:

- preço anunciado já cobre o parcelamento e Pix/à vista recebe desconto;
- comprador paga todo o acréscimo do parcelamento;
- loja oferece algumas parcelas sem acréscimo e cobra acima desse limite.

A amostra pública é pequena e enviesada para pessoas com problemas ou necessidades de
customização. Ela não permite afirmar qual política é majoritária. Permite afirmar com
alta confiança como as integrações a implementam tecnicamente.

## Evidência mais forte: código do plugin oficial WooCommerce

Foi inspecionado o pacote oficial 2.7.7, publicado pelo perfil Asaas no WordPress.org. A
página do plugin informa versão 2.7.7, mais de 8 mil instalações e código aberto. O ZIP
inspecionado é o artefato distribuído pelo WordPress, não uma reimplementação de
terceiros.

Fontes:

- [Página oficial do plugin](https://wordpress.org/plugins/woo-asaas/)
- [Pacote oficial 2.7.7](https://downloads.wordpress.org/plugin/woo-asaas.2.7.7.zip)
- [Repositório SVN](https://plugins.svn.wordpress.org/woo-asaas/tags/2.7.7/)
- [Documentação oficial do módulo](https://docs.asaas.com/docs/woocommerce)

### Como o cálculo é feito

`Installments_Calculator_Helper::get_value_with_interest()` calcula:

```text
valor_com_acrescimo = valor_base * (1 + percentual / 100)
```

O resultado é arredondado para cima ao centavo. O mesmo helper limita a quantidade de
parcelas por `floor(total / valor_minimo_por_parcela)`.

Isso é um acréscimo comercial simples sobre o pedido. Não é o objeto `interest` da API,
não é juro de mora e não é calculado pelo emissor do cartão.

### Como a regra por quantidade é representada

`Installments_Checkout` lê `interest_installment[n]`, uma tabela configurável por
quantidade. Se o percentual da quantidade for zero, mostra a parcela sem juros. Se for
maior que zero, calcula e mostra a parcela acrescida junto do percentual.

Logo, a configuração abaixo é natural nesse modelo:

```text
1x => 0%
2x => 2,6%
3x => 3,9%
...
12x => percentual definido pela loja
```

### Como o acréscimo entra no pedido

`Order_Interest_Handler` cria um `WC_Order_Item_Fee` com o valor do acréscimo. O pedido
passa a ter preço-base, item de taxa e total final. Isso deixa o acréscimo explícito para
pedido, conciliação e tributação, em vez de apenas alterar silenciosamente o valor
enviado ao gateway.

### O que é enviado ao Asaas

`Payment_Installments::installment_payment_data()` adiciona o acréscimo ao pedido e envia:

```json
{
  "totalValue": "total final do pedido",
  "installmentCount": "quantidade escolhida"
}
```

Em seguida remove `value`. Para a condição mínima/à vista, mantém `value` sem os campos
de parcelamento.

Conclusão observável no código: o módulo oficial não aciona uma flag de repasse, não
envia um “pagador dos juros” e não pede ao Asaas para escolher o percentual. A loja
define a política, altera o total e entrega ao Asaas uma cobrança fechada.

### Juros e antecipação são configurações independentes

O plugin possui controles separados para:

- tabela de juros por parcela;
- quantidade máxima e valor mínimo por parcela;
- antecipação automática de recebíveis.

O acréscimo não é calculado automaticamente a partir da antecipação. A documentação
oficial do módulo também apresenta “Juros por parcela” e “Antecipação de recebíveis” como
opções distintas. Isso refuta a hipótese de que o custo de antecipação seja
automaticamente repassado ao comprador pelo Asaas.

Fontes:

- [Formas de pagamento no módulo WooCommerce](https://docs.asaas.com/docs/forma-de-pagamento)
- [Simular antecipação](https://docs.asaas.com/reference/simular-antecipa%C3%A7%C3%A3o)

## O que comerciantes e desenvolvedores pedem no fórum oficial

### 1x sem acréscimo e percentuais diferentes nas demais parcelas

Em 2023, um usuário publicou uma configuração real:

```text
1x 0%
2x 2,6%
3x 3,9%
4x 5,2%
```

O objetivo adicional era zerar 1x a 3x para pedidos acima de R$ 900. O pedido não era
por uma capacidade do Asaas, mas por um hook que permitisse modificar dinamicamente a
tabela do plugin. Não houve resposta publicada. Isso confirma que a tabela resolve a
regra estática, enquanto regras condicionais dependem do software da loja.

Fonte: [Aplicar juros/acréscimo nas parcelas de forma dinâmica](https://wordpress.org/support/topic/aplicar-juros-acrescimo-nas-parcelas-de-forma-dinamica/).

### Motivo econômico: não absorver antecipação e parcelamento

Outro comerciante afirmou que o negócio se tornaria inviável se precisasse cobrir o
custo de antecipação. O suporte Asaas respondeu que “juros nas parcelas” já existia no
plugin desde a versão 1.6.0. Após reinstalar, o usuário encontrou a configuração.

O relato não prova que o percentual configurado equivale à taxa efetiva do Asaas. Ele
prova que comerciantes usam uma tabela manual para recuperar custos que não desejam
absorver.

Fonte: [Incluir juros no parcelamento](https://wordpress.org/support/topic/incluir-juros-no-parcelamento/).

### UX do texto de juros causa confusão

No mesmo tópico, o usuário apontou que “10% de juros por parcela” pode ser entendido como
10% multiplicado por 10. Em 2025, outro usuário pediu para ocultar a composição e mostrar
parcela e total. O perfil oficial Asaas respondeu que o plugin não oferece nativamente
essa visualização e não indicou extensão compatível.

Implicação para o Hub: mostrar sempre valor de cada parcela **e total final**, usando
“acréscimo total” ou “total parcelado”, sem o rótulo ambíguo “X% por parcela”.

Fonte: [Como ocultar juros e exibir só o valor total](https://wordpress.org/support/topic/como-ocultar-juros-e-exibir-so-o-valor-total-no-cartao-de-credito/).

### Configuração por produto não é nativa no plugin

Uma solicitação pede máximo de parcelas diferente por produto, inclusive para
infoprodutos. Usuários sugeriram:

- extensão do plugin por hooks/filtros como solução robusta;
- desconto no Pix para produtos específicos;
- ocultar o seletor com jQuery para certos produtos.

O workaround jQuery apenas esconde o campo e o próprio autor reconhece que o
parcelamento continua tecnicamente possível. É um antiexemplo: controle financeiro não
deve depender de DOM, CSS ou JavaScript cosmético. O backend precisa validar a regra do
produto/Curso e criar a cobrança correspondente.

Fonte: [Sugestão: limitar parcelamento por produto](https://wordpress.org/support/topic/sugestao-limitar-parcelamento-por-produto/).

## Outros padrões adotados no ecossistema

### “Preço parcelado” e desconto à vista

Em discussão recente entre prestadores de serviço, um usuário do Asaas sugere formar o
preço já considerando o parcelamento e oferecer desconto à vista. Outro afirma repassar
todo o custo ao cliente. Um terceiro usa a InfinitePay porque o link calcula o repasse e
preserva o líquido.

Esses são relatos individuais, não pesquisa de mercado. Eles mostram por que “preço de
cartão + desconto Pix” é um caminho operacionalmente popular: evita recalcular o total
depois que o comprador escolhe a parcela, mas todos os compradores de cartão pagam o
preço cheio mesmo em 1x.

Fonte: [Parcelado vale a pena para quem vende serviços?](https://www.reddit.com/r/empreendedorismo/comments/1qnm7sf/parcelado_vale_a_pena_para_quem_vende_servi%C3%A7os/).

### Checkout transparente próprio

Um desenvolvedor de plataforma de infoprodutos relata ter substituído Hotmart por um
checkout transparente próprio integrado à API Asaas. Ele define seu próprio percentual
mensal de parcelamento e mantém o spread. O relato também alerta que imposto pode incidir
sobre o total da venda com acréscimo. Essa observação fiscal é experiência do autor, não
parecer contábil; deve ser validada com a contabilidade do Hub.

O valor técnico do relato é confirmar a mesma arquitetura do plugin oficial: a aplicação
controla seleção, preço, entrega e webhook; o Asaas processa a cobrança.

Fonte: [Quem vende infoproduto, o que usa de checkout?](https://www.reddit.com/r/MicroSaaSBR/comments/1v1svse/quem_vende_infoproduto_o_que_voc%C3%AAs_usam_de/).

### Integrações empresariais calculam o acréscimo fora do Asaas

A documentação da integração IXC/Asaas oferece campos próprios para máximo de parcelas,
percentual mensal e “repassar taxa para o cliente”. Quando o repasse é ativado, o IXC
pede percentual e valor fixo a adicionar. A Vendizap também permite personalizar os
percentuais e diz acrescentá-los ao total no checkout.

Essas páginas descrevem comportamento dos sistemas IXC e Vendizap, não campos da API
Asaas. Mesmo assim, reforçam o padrão de mercado observado no plugin: o integrador
calcula e aumenta a cobrança.

Fontes:

- [Integração IXC/Asaas](https://wiki-erp.ixcsoft.com.br/documentacao/guias-tutoriais/carteira-de-cobranca/integracoes-carteira-de-cobranca/integracoes-bancarias---cartao-de-credito/integracoes/asaas---cartao-de-credito.html)
- [Taxas Asaas na Vendizap](https://ajuda.vendizap.com/hc/central-de-ajuda-vendizap/articles/1763473282-taxas-aplicadas-pelo-asaas)

### Hosted Checkout e Link geram frustração quando se espera lógica de loja

Um relato técnico recente critica limitações do Checkout/Link, principalmente correlação
da venda, exposição de dados e diferenças entre formas de parcelamento. A solução final
do autor para identidade foi consultar o cliente pela API a partir do `customer.id` do
evento, em vez de esperar todos os dados no webhook.

O texto mistura Checkout, Link e cobranças e contém afirmações imprecisas; por isso não
serve como contrato do produto. Serve como evidência de uma expectativa recorrente:
desenvolvedores esperam que a página hospedada faça lógica que, na prática, precisa ser
feita pela integração e conciliada pela API.

Fonte: [Asaas como meio de pagamento: relato e solução](https://www.reddit.com/r/MicroSaaSBR/comments/1qm805w/asaas_como_meio_de_pagamento_me_ferrei_bonito/).

## Cruzamento com a documentação oficial atual

### A API confirma o padrão usado pelo plugin

Para cobranças parceladas, a documentação atual oferece exatamente duas formas:

- `installmentCount` + `totalValue`: o Asaas divide o total;
- `installmentCount` + `installmentValue`: a integração determina cada parcela.

O objeto `interest` continua sendo juros após vencimento. Logo, o plugin oficial está
alinhado ao contrato público ao enviar o total já acrescido.

Fontes:

- [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Criar cobrança com resposta resumida](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)
- [Juros, multa e desconto](https://central.ajuda.asaas.com/hc/pt-br/articles/31965188701083-Como-adicionar-juros-multa-e-desconto-nas-cobran%C3%A7as)

### Checkout hospedado continua sendo uma fronteira diferente

O Checkout de cartão recebe itens e apenas `installment.maxInstallmentCount`. A pessoa
escolhe até esse máximo, mas o contrato não recebe uma tabela de totais. Isso explica por
que a abordagem do WooCommerce não pode ser transplantada sem alterar a jornada: no
WooCommerce a loja conhece a quantidade antes de enviar a cobrança; no Checkout Asaas a
quantidade é escolhida dentro da página hospedada depois que o total já foi enviado.

Fonte: [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-for-credit-card).

### O painel possui repasse automático, mas isso não é a API pública

O painel Asaas mostra “Repassar taxas do cartão” quando a cobrança é exclusivamente de
cartão. Isso resolve cobranças manuais com repasse integral. Nenhum relato ou código
inspecionado demonstrou um campo equivalente no Checkout/API pública, nem exclusão de 1x
ou política por Curso.

Fonte: [Repasse automático no painel](https://central.ajuda.asaas.com/hc/pt-br/articles/31691238010139-As-taxas-cobradas-pelo-Asaas-podem-ser-repassadas-automaticamente-para-meus-clientes-ao-criar-cobran%C3%A7as).

### A Central nega juros iniciando automaticamente em determinada parcela

A resposta oficial diz que essa funcionalidade não está disponível no Asaas. Isso não
contradiz o plugin: a regra existe no WooCommerce, que recalcula o pedido antes de chamar
a API, e não como automatismo da cobrança hospedada.

Fonte: [Juros a partir de determinada quantidade](https://central.ajuda.asaas.com/hc/pt-br/articles/33791142996123-%C3%89-poss%C3%ADvel-adicionar-juros-a-partir-de-um-determinado-n%C3%BAmero-de-parcelas).

## Cálculo: acréscimo simples não é `gross-up`

O plugin oficial aplica uma porcentagem comercial simples:

```text
total_final = preço * (1 + percentual)
```

Se o objetivo for apenas cobrar uma tabela comercial, isso basta. Se o objetivo for
garantir que o líquido seja exatamente o preço-base depois de percentual e taxa fixa do
Asaas, somar nominalmente a taxa não basta, porque a taxa percentual incide também sobre
o acréscimo. O cálculo precisa ser um `gross-up`:

```text
total_final = (líquido_desejado + taxa_fixa) / (1 - taxa_percentual)
```

Arredondamento, promoções e condições específicas da conta ainda precisam ser
considerados. A API oferece `GET /v3/myAccount/fees/` e `POST /v3/payments/simulate` para
consultar e conferir essas condições.

Fontes:

- [Recuperar taxas da conta](https://docs.asaas.com/reference/recuperar-taxas-da-conta)
- [Simulador de vendas](https://docs.asaas.com/reference/simulador-de-vendas)

O plugin não tenta preservar exatamente o líquido do lojista; ele cobra o percentual que
o administrador decidiu. Para o Hub, isso exige uma decisão explícita:

- **tabela comercial:** percentual definido pelo Admin, simples e estável para o cliente;
- **repasse econômico exato:** percentual/taxa da conta e `gross-up`, mais fiel ao custo,
  porém variável quando a negociação com o Asaas mudar.

Misturar os dois conceitos produziria diferenças de centavos ou margem não intencional.

## Riscos observados nas soluções comunitárias

### Hacks de interface

Ocultar ou remover opções apenas no DOM não impõe regra financeira. Uma requisição
forjada ou mudança de markup pode contornar o bloqueio. A política precisa ser validada
no servidor.

### Alterar diretamente o plugin

Usuários relatam editar código do plugin, mas reconhecem perda em atualizações. O próprio
fórum sugere hooks/filtros. No Hub, a regra deve pertencer ao domínio de Curso, não a um
patch do cliente Asaas.

### Confundir taxa de transação, acréscimo comercial e antecipação

São valores distintos. Antecipação depende de elegibilidade, prazo e momento posterior à
venda. Repassá-la ao comprador é decisão de preço, não automatismo do parcelamento.

### Rótulo ambíguo

“X% por parcela” gerou reclamações porque pode parecer juros multiplicados pelo número de
parcelas. Total final, quantidade e valor por parcela precisam aparecer juntos.

### Fiscal e nota fiscal

Há relatos de que o valor acrescido compõe o total tributável/documentado. Não foi
encontrado consenso técnico capaz de substituir orientação contábil. O modelo deve
registrar preço-base, acréscimo e total; a contabilidade define como emitir o documento.

### Checkout transparente e PCI

O plugin WooCommerce coleta cartão na loja e envia pela API. Replicar essa parte no Hub
amplia escopo PCI. O padrão de cálculo do plugin pode ser reutilizado sem reutilizar sua
captura de cartão: é possível manter o cartão em uma Fatura hospedada, desde que a
quantidade e o total sejam definidos antes.

## Frequência qualitativa dos achados

Esta classificação descreve a recorrência na amostra, não participação de mercado:

- **Forte e repetido:** calcular o acréscimo na aplicação e enviar total final + parcela.
  Evidência: código oficial, documentação do módulo, IXC, Vendizap e relatos de checkout
  próprio.
- **Repetido:** 1x/algumas parcelas sem acréscimo e percentuais acima do limite. Evidência:
  tabela do plugin e solicitações no fórum.
- **Repetido:** formar preço parcelado e dar desconto à vista/Pix como simplificação.
  Evidência: discussões de comerciantes e sugestão no fórum.
- **Repetido:** insatisfação com personalização/UX do checkout hospedado ou plugin.
  Evidência: fórum WordPress e relatos de desenvolvedores.
- **Pontual:** obter margem/spread sobre juros de parcelamento. Um relato de infoproduto;
  não constitui recomendação geral.
- **Sem evidência:** campo público oculto que faça Checkout v3 variar o total conforme a
  quantidade escolhida.

## Implicação para o Hub

A pesquisa muda a interpretação da complexidade, mas não o contrato do Checkout atual:

- **não é complexo calcular ou criar a cobrança:** o plugin oficial demonstra uma
  implementação direta e madura;
- **é incompatível com o Checkout hospedado atual:** ele recebe total fixo e a escolha
  acontece tarde demais;
- **a regra por Curso é responsabilidade legítima do Hub:** o plugin WooCommerce é global
  e usuários pedem customização por produto; no Hub, Curso já é a unidade correta;
- **não é necessário capturar cartão no Hub:** a escolha comercial pode ocorrer antes e a
  Fatura hospedada receber somente os dados do cartão;
- **não usar hack de UI nem um Link diferente por parcela:** o servidor deve criar a
  condição exata e persistir preço-base, acréscimo, total, quantidade e versão da regra.

O menor desenho consistente com o que outros desenvolvedores fazem é um seletor de
parcelas controlado pelo Hub, uma tabela/configuração por Curso e criação de cobrança com
`totalValue` + `installmentCount`. A diferença para WooCommerce é apenas deixar os dados
do cartão na Fatura Asaas. Se a exigência absoluta for CTA direto para um único Checkout
Asaas sem nenhuma escolha anterior, então o acréscimo variável por quantidade continua
inviável nesse produto específico.

## Fontes comunitárias adicionais consultadas

- [Indicação de checkout transparente](https://www.reddit.com/r/brdev/comments/1tn9iua/indica%C3%A7%C3%A3o_checkout_transparente/): desenvolvedores comparam Asaas por custo de
  parcelamento e capacidade de preço dinâmico; opiniões, não benchmark controlado.
- [Parcelamento de plano em SaaS](https://www.reddit.com/r/brdev/comments/1qcl9q0/parcelamento_de_plano_em_saas/): distingue assinatura de compra única parcelada
  e cita Asaas como opção brasileira; não aborda algoritmo de repasse.
- [Fórum completo do plugin](https://wordpress.org/support/plugin/woo-asaas/): usado para
  localizar solicitações de juros, parcelamento por produto e UX.

## Resposta objetiva às hipóteses

| Hipótese | Resultado |
| --- | --- |
| O Asaas deve ter uma flag simples para isso na API | Não encontrada; plugin oficial não a usa |
| 1x sem juros e 2x+ com acréscimo é incomum | Refutada; é configuração normal no plugin |
| O Asaas precisa calcular o acréscimo | Refutada; a loja calcula e envia o total |
| `totalValue` resolve o processamento | Confirmada, se a quantidade já estiver escolhida |
| Checkout hospedado consegue variar o total | Não demonstrado; contrato só expõe máximo |
| É preciso checkout transparente próprio | Não necessariamente; Fatura pode manter o cartão no Asaas |
| Configuração por Curso virá pronta do Asaas | Não; deve pertencer ao domínio do Hub |
| Somar a taxa nominal preserva o líquido | Não exatamente; preservação exige `gross-up` |
| Antecipação faz parte automática do repasse | Refutada; é custo/configuração separada |

