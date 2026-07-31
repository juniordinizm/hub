---
status: accepted
owner: product-and-engineering
last_verified_commit: 384db5ad9bca03ff5723f6c7e2602c80d9e0755c
---

# Compra pública por link estável de Curso

## Contexto

As landing pages comerciais vivem em outro repositório. O Hub não deve transformar a
rota `/` em catálogo público: ela permanece como entrada protegida do dashboard. Cada
landing page precisa apenas de um CTA estável que leve a pessoa ao Checkout Asaas do
Curso correspondente.

Uma URL direta do Asaas não atende esse contrato. Cada Checkout é uma tentativa
temporária, com validade entre 10 e 1440 minutos, e precisa ser correlacionado a um
Pedido local criado antes do efeito externo. O Hub fornecerá o link permanente
`/comprar/[slug]` e criará uma tentativa Asaas nova a cada início humano da jornada.

O backend atual possui `POST /api/checkouts/course`, mas exige nome e e-mail antes do
redirect e nenhuma página do produto o consome. Produto decidiu eliminar esse formulário
duplicado: o Checkout hospedado coletará os dados do pagador. A documentação oficial
confirma que, quando `customerData` e `customer` são omitidos, o pagador informa seus
dados na página Asaas; eventos de Checkout fornecem o ID `checkout.customer`, consultável
em `GET /v3/customers/{id}`.

Referências oficiais:

- [How to provide customer data](https://docs.asaas.com/docs/how-to-provide-customer-data);
- [Checkout events](https://docs.asaas.com/docs/checkout-events);
- [Retrieve a single customer](https://docs.asaas.com/reference/retrieve-a-single-customer);
- [Create new Checkout](https://docs.asaas.com/reference/create-new-checkout).

## Objetivos

- Entregar um link público permanente e copiável por Curso pago.
- Levar o CTA externo ao Asaas sem formulário nem segundo clique visível em condições
  normais.
- Persistir Pedido e snapshots comerciais antes de criar o Checkout externo.
- Obter a identidade pública do cliente Asaas somente depois do pagamento autoritativo.
- Criar ou vincular Conta Student sem considerar o provider prova de verificação.
- Manter Contas Admin/Suporte fora do domínio de acesso da Aluna.
- Preservar retry, idempotência, precedência financeira, auditoria e fail-closed.

## Fora de escopo

- Hospedar ou editar landing pages comerciais no Hub.
- Tornar `/` ou o dashboard públicos.
- Coletar nome, e-mail, CPF, telefone ou endereço antes do Asaas para visitante.
- Persistir CPF, telefone ou endereço retornados pelo Asaas.
- Transferir manualmente uma compra paga para outro e-mail.
- Considerar callback ou navegação do navegador confirmação de pagamento.
- Alterar a oferta de métodos e parcelamento por Curso; essa evolução possui desenho
  próprio em `DEC-DISC-011`.

## Decisões de produto

### Link estável e handoff transparente

O CTA da landing page usa `APP_URL/comprar/[slug]`. A rota é um handoff técnico, não uma
segunda página comercial. Ela mostra apenas estado de carregamento e inicia a tentativa
por `POST` no navegador, redirecionando imediatamente à URL recém-criada pelo Asaas.

O `GET` não cria Pedido nem chama provider. Isso evita que previews de WhatsApp, robôs,
prefetch e scanners que apenas abrem o link gerem tentativas financeiras. Se o início
automático falhar de forma recuperável, uma ação manual permite tentar novamente.

O `slug` é gerado uma vez na criação do Curso e não é alterado pela autoria atual. O link
é derivado, não persistido. Alterações de preço, métodos ou parcelamento não alteram a
URL pública.

### Identidade pública vem do Asaas

O Checkout anônimo é criado sem `customerData` e sem `customer`. O Pedido nasce sem
`user_id`, nome ou e-mail, mas com Curso, valor, duração, item e slug em snapshots.

Depois de um evento financeiro autoritativo, o worker usa o ID de cliente presente no
payload Asaas para consultar nome e e-mail. A chamada externa ocorre antes de abrir a
transação financeira. Falha temporária deixa o evento `retryable`; nenhuma Conta,
Concessão ou Matrícula é criada por suposição.

O primeiro snapshot válido de nome/e-mail é persistido por compare-and-set e nunca é
substituído por uma consulta posterior. O Asaas fornece identidade pretendida, não
verificação da Conta. Conta nova permanece `email_verified=false` e recebe ativação
durável para definir senha.

### Sessão autenticada permanece autoridade

Quando uma Student autenticada abre o link:

- acesso já efetivo mostra a ação de entrar no Curso e não cria Checkout;
- sem acesso, o Pedido usa a Conta da sessão;
- dados preenchidos no Asaas não alteram nome, e-mail, papel ou verificação locais.

Admin e Suporte não podem iniciar compra autenticada. Student com bloqueio geral da
plataforma ou Matrícula `revoked` para o Curso também não pode iniciar Checkout; a página
orienta contato com o Suporte.

### Colisão com Conta de equipe

Como o Hub só conhece o e-mail público depois do pagamento, não existe bloqueio
pré-provider. Se o e-mail normalizado pertencer a Admin/Suporte, a uma Conta com bloqueio
geral ou a uma Student com Matrícula `revoked` para o Curso:

- o Pedido preserva a evidência financeira;
- nenhuma Conta é alterada;
- nenhuma Concessão ou Matrícula é criada;
- abre-se Revisão específica de identidade;
- a Revisão não oferece aprovação de acesso;
- a única resolução permitida é reembolso integral e nova compra com e-mail pessoal.

Identidade ausente ou inválida segue a mesma política de Revisão sem acesso. A pessoa é
orientada a contatar o Suporte para o reembolso. Não haverá transferência manual para outro
e-mail, pois isso exigiria comprovação de titularidade e criaria risco de fraude fora do
escopo.

## Arquitetura

### Handoff público

`/comprar/[slug]` valida que o Curso existe, está publicado, custa ao menos o mínimo
financeiro e que checkout público está habilitado. A página entrega um Client Component
pequeno que:

1. cria ou recupera um UUID de tentativa no `sessionStorage`;
2. envia uma única requisição `POST` para a API pública;
3. redireciona quando recebe `status=ready`;
4. preserva o mesmo UUID contra dupla execução/hidratação;
5. não repete automaticamente `processing/uncertain`;
6. oferece fallback manual somente após falha recuperável.

A API aceitará somente `checkoutAttemptId` e exatamente um identificador de Curso. Nome,
e-mail, Conta, papel, preço, URLs e métodos enviados pelo cliente serão rejeitados.

### Núcleo de checkout

O núcleo compartilhado passa a aceitar três origens de identidade:

- `authenticated`: `userId`, nome e e-mail da sessão;
- `provider_pending`: visitante sem PII local;
- `provider_resolved`: estado interno produzido somente pelo enriquecimento do webhook.

Somente as duas primeiras iniciam Checkout. `provider_resolved` nunca é aceito de uma
entrada HTTP.

Reserva, autorização coordenada, CAS `creating`, persistência de URL e resultado incerto
continuam iguais. O rate limit permanece HMAC de IP e Curso no PostgreSQL.

### Adapter Asaas

`AsaasGateway` ganhará `getCustomer(customerId)`. O adapter:

- escapa o ID no path;
- usa os mesmos timeout, autenticação, User-Agent, sanitização e classificação de erro;
- valida objeto, ID, nome e e-mail sem aceitar coerção;
- descarta CPF, telefone, endereço e campos desconhecidos;
- nunca registra payload ou PII em erro operacional.

### Enriquecimento antes da transação

O processamento do evento será dividido em duas fases explícitas:

1. parse e correlação segura identificam Pedido, pagamento, Checkout e cliente Asaas;
2. se o Pedido público ainda estiver `pending`, o worker consulta o cliente antes de
   abrir a transação do processor;
3. o processor bloqueia o Pedido, confirma que o snapshot continua vazio e grava a
   identidade uma vez;
4. a resolução local verifica papel, cria/vincula Student, aplica precedência e cria
   Concessão/outbox na mesma transação;
5. corrida perdida relê o snapshot persistido; divergência abre Revisão e não escolhe
   identidade por aproximação.

### Modelo de dados

`orders` ganhará `buyer_identity_status`:

- `pending`: tentativa pública aguardando identidade;
- `resolved`: Conta Student vinculada;
- `review_required`: identidade inválida, ausente, divergente ou de equipe.

Pedidos autenticados nascem `resolved`. Pedidos públicos nascem `pending`.

`payment_review_type` ganhará `buyer_identity`. O motivo persistido será um código seguro,
como `buyer_identity_missing`, `buyer_identity_conflict` ou
`buyer_identity_team_account`; não conterá nome ou e-mail.

Uma Revisão `buyer_identity` não aceita decisão genérica de aprovação ou rejeição. As
razões seguras incluem identidade ausente, inválida ou divergente, Conta de equipe,
bloqueio geral e Matrícula revogada no Curso. Quando o reembolso integral for confirmado,
ela é encerrada automaticamente com razão segura e sem ator fictício.

## Administração do Curso

A configuração do Curso exibirá uma seção “Link de compra”:

- URL absoluta derivada de `APP_URL` e `slug`;
- ação “Copiar link de compra” com confirmação acessível;
- fallback que permite selecionar a URL quando Clipboard API falhar;
- estado indisponível com motivo para Curso gratuito, rascunho, não publicado, preço
  inválido ou checkout global desabilitado.

O servidor deriva a disponibilidade. A interface não é autoridade para liberar venda.

## Retornos e falhas

- Sucesso público informa que o pagamento está em processamento e orienta verificar o
  e-mail para ativação.
- Sucesso autenticado mantém o polling seguro de acesso.
- Cancelamento e expiração preservam o slug estável do Curso e oferecem nova tentativa
  em `/comprar/[slug]`.
- Nenhuma página de retorno navega para `/`.
- Curso indisponível falha antes de banco financeiro/provider.
- Provider não configurado ou checkout desabilitado produz indisponibilidade amigável,
  sem lançar Runtime Error na UI.
- Criação `uncertain` mostra referência local segura e proíbe repetição automática.
- Consulta de cliente com timeout, transporte, `429` ou `5xx` usa retry durável do evento.
- Cliente ausente, ID divergente, nome/e-mail inválido ou papel de equipe produz Revisão,
  nunca fallback inventado.

## Segurança e privacidade

- O link público não contém PII, segredo nem preço.
- O UUID de tentativa é idempotência, não autenticação.
- A API rejeita chaves extras e identidade fornecida pelo navegador.
- A correlação exige IDs convergentes de Pedido, Checkout, pagamento e cliente presentes.
- Conta existente nunca é sobrescrita.
- `email_verified` não deriva do Asaas.
- Logs, auditoria e erros usam IDs e códigos seguros; nome/e-mail não entram em telemetria.
- Payload bruto continua sujeito à retenção e sanitização já definidas para a inbox.

## Testes

### Unitários e componentes

- link absoluto e disponibilidade por estado do Curso;
- handoff inicia uma vez, redireciona e oferece fallback;
- hidratação/efeito duplicado reutiliza o mesmo UUID;
- estados `ready`, `processing`, falha recuperável e falha terminal;
- botão de cópia, feedback acessível e fallback;
- Revisão de identidade não renderiza aprovação.

Testes de UI renderizam componentes e interações; não inspecionam strings do source.

### Contrato HTTP

- API anônima aceita apenas Curso e UUID;
- campos de identidade e chaves desconhecidas são rejeitados;
- client Asaas consulta `/v3/customers/{id}` com path escapado;
- resposta válida retém somente ID, nome e e-mail;
- resposta incompleta, ID divergente, `401`, `404`, `429`, `5xx`, timeout e transporte;
- nenhum erro vaza PII ou mensagem privada do provider.

### PostgreSQL

- Pedido público nasce antes do provider com identidade `pending` e snapshots completos;
- primeira identidade válida vence por CAS;
- retry idêntico é idempotente;
- identidade divergente abre uma Revisão;
- Conta Student existente é vinculada sem alteração;
- Conta nova é criada não verificada com Perfil Student e ativação na outbox;
- Admin/Suporte, Conta bloqueada ou Matrícula revogada abre Revisão, sem
  Concessão/outbox de acesso;
- reembolso confirmado encerra a Revisão de identidade;
- falha de consulta externa ocorre sem transação aberta;
- concorrência não duplica Conta, Revisão, Concessão ou ativação.

### E2E e Sandbox

O servidor Asaas determinístico, os helpers financeiros e os casos Playwright abaixo estão
implementados. A execução local permanece bloqueada sem `E2E_DATABASE_URL` descartável; a
homologação Sandbox real pós-mudança permanece pendente e não autoriza deploy antecipado.

- CTA simulado acessa o handoff, cria Checkout fake e redireciona;
- webhook autoritativo cria Conta, Concessão, Matrícula e ativação;
- Student autenticada compra sem trocar identidade;
- retorno cancelado/expirado permite nova tentativa sem navegar a `/`;
- Sandbox sem `customerData` comprova que o evento contém `customer` e que a consulta
  retorna nome/e-mail utilizáveis;
- Sandbox comprova PIX, cartão, ativação e idempotência após a mudança.

## Critérios de aceite

- Link estável copiável aparece na configuração de Curso elegível.
- CTA externo exige somente esse link e chega ao Asaas sem formulário ou segundo clique
  visível em condições normais.
- `/` permanece protegida e inalterada como entrada do dashboard.
- Pedido anônimo existe antes do Checkout e não contém PII até o evento autoritativo.
- Consulta de cliente e retry não mantêm transação PostgreSQL aberta.
- Conta nova exige ativação; Conta existente não é sobrescrita.
- Colisão de equipe, bloqueio geral ou Matrícula revogada nunca concede acesso e só
  permite reembolso.
- Retornos, erros e resultado incerto são tratados na UI.
- Gates unitários, HTTP, PostgreSQL, E2E, Sandbox, tipos, Ultracite e documentação passam.
- Nenhum commit, push, merge, deploy ou mutação Production faz parte desta especificação.
