---
status: canonical
owner: engineering
last_verified_commit: 63f64106eef197d59a7929fabc6d64fb239ecfe6
---

# Asaas

## Estado

O contrato financeiro neutro, o schema de persistência, o adapter Asaas estreito e o
núcleo compartilhado de intenção de checkout estão implementados no código. As
migrations `0044_asaas_commerce_persistence` a
`0051_asaas_financial_statement` foram geradas e passaram em branch Neon descartável,
antes da promoção autorizada de `0044` a `0052` para Development em 2026-07-31. A
auditoria desse alvo confirmou 53 entradas no journal, o único Admin preservado e
idempotência. No mesmo dia, a Release B foi promovida para Production após limpeza
controlada dos dados descartáveis; o journal chegou a `0052`, a Conta Admin foi
preservada e todas as tabelas operacionais ficaram vazias. O adapter está conectado às entradas
autenticada e pública de checkout, e a inbox durável
recebe e deduplica webhooks antes do processor financeiro transacional. O worker é
chamado a cada minuto pela rota cron protegida, com lease de seis minutos e prazo interno
de 270 segundos. Checkout, pagamento PIX/cartão, cancelamento, expiração, reembolso,
conciliação e recuperação após indisponibilidade foram comprovados no Sandbox. O corte
comercial de Production aconteceu depois do deployment `177259f` de 2026-08-20: a chave
Sandbox foi removida do ambiente, a credencial Asaas real e o
`ASAAS_WEBHOOK_TOKEN` de Production foram configurados, e o ambiente foi aberto com
`PAYMENTS_CHECKOUT_MODE=public`, `ASAAS_WEBHOOK_ENABLED=true` e
`SCHEDULED_JOBS_ENABLED=true`, sem novo deploy. As sondas públicas de 2026-08-21
confirmaram checkout habilitado (GET `/api/checkouts/course` sem parâmetros => `400`) e
webhook ativo exigindo token (POST sem token => `401`). Em 2026-08-26, a
operadora confirmou uma venda real pelo checkout público. A confirmação de
e-mail, acesso, reembolso e demais estados do ciclo permanece pendente de
registro sanitizado; não repetir cobrança para produzir evidência.
Checkout, processamento financeiro e reembolso usam exclusivamente Asaas.

O release de manutenção de 2026-08-02 promoveu o código e a migration
`0053_course_payment_offers` para Production pelo workflow protegido
`30735668308`. O deployment permaneceu com checkout e webhook desabilitados e todas as
superfícies de produto em manutenção; isso atualiza o runtime/schema, mas não constitui o
corte comercial para a conta Asaas de Production.

Staging usa a conta Sandbox e
`https://preview.neurocapacitar.com.br/api/webhooks/asaas`. O webhook está
ativo, não interrompido, com envio sequencial, token próprio e os 18 eventos
tratados pelo domínio financeiro. Em 2026-08-01, readiness retornou `200`; a
rota recusou requisição sem token com `401` e aceitou o token antes de rejeitar
um payload sintaticamente inválido com `400`. Em 2026-08-01, a migration
`0053_course_payment_offers` foi aplicada duas vezes no compute guardado de
Staging: o journal permaneceu idempotente com 54 entradas e o Curso existente
recebeu a oferta padrão Pix + cartão em até 3x. O deployment
`dpl_9UYQJxnrWMZXqWBdQaZai4imkLkU` publicou o SHA exato da implementação no
Custom Environment `staging`; readiness retornou `200` e a Vercel não registrou
erros de runtime durante a homologação.

O schema mantém `orders.status` como estado canônico
`pending | paid | refunded | disputed | cancelled`. O ciclo externo fica separado:

- checkout usa estado interno próprio e guarda tentativas, próxima execução, erro e URL;
- IDs de checkout, pagamento e cliente são independentes e opcionais até a associação;
- estados brutos de checkout, pagamento, risco, liquidação, reembolso e disputa não
  substituem o estado canônico;
- reembolso externo pertence a `refund_requests`; o Asaas não devolve ID próprio de
  estorno, portanto a correlação usa `provider_payment_id` para pagamento único,
  `provider_installment_id` para parcelamento e `refund_requests.id` local;
- `provider` é obrigatório e não possui default implícito;
- a inbox associa opcionalmente o Pedido e mantém estado, tentativas, lock e próxima
  execução.

A remoção de `courses.payment_provider_product_id` está no schema e na migration. As
rotas e clientes do provedor anterior foram removidos antes da aplicação desse DDL.
As colunas obrigatórias de snapshot de item e slug das migrations
`0046_order_checkout_item_snapshot` e `0047_order_checkout_course_slug_snapshot` também
pressupõem a limpeza dos Pedidos de teste legados antes do DDL.

## Escopo do checkout

O Hub cria Checkout hospedado com Pix, cartão ou ambos, conforme a oferta do Curso.
Cartão pode ser à vista (`DETACHED`) ou admitir `INSTALLMENT` até o teto configurado.
Cada Checkout tem item inline com um único valor para todos os métodos e quantidades de
parcelas; Curso não possui produto remoto no Asaas. A Vendedora absorve as taxas
descontadas do recebível.

- `externalReference` carrega somente uma referência local opaca, sem nome, e-mail ou
  outro dado pessoal;
- o Hub não envia `customerData`: no Sandbox, nome/e-mail sem `cpfCnpj` são rejeitados,
  e a política local não coleta nem inventa CPF; o checkout hospedado coleta os dados
  exigidos pelo Asaas;
- valores internos permanecem em centavos inteiros;
- Curso pago custa no mínimo `1000` centavos, equivalentes a R$ 10; autoria e checkout
  validam o limite antes da chamada externa;
- conversão para o decimal em reais acontece somente na borda HTTP e deve ser exata;
- o contrato atual do endpoint marca `imageBase64` como obrigatória em cada item;
- o adapter rasteriza para PNG o logo institucional versionado em
  `public/protear/logo-negativo.svg` e envia o Base64 bruto resultante em cada item.
  O checkout não depende de capa do Curso, URL externa, dado pessoal ou imagem
  fornecida pela Compradora;
- o resultado histórico do Sandbox sem `imageBase64` não é evidência suficiente para
  Production e não deve ser usado para remover esse campo;
- callback não é autoridade financeira nem libera acesso.

### Configuração comercial por Curso

O Admin configura `payment_allow_pix`, `payment_allow_credit_card` e
`payment_max_installment_count` por Curso. Novos Cursos usam Pix + cartão e até 3x; cada
Pedido captura os três snapshots antes da chamada externa. O adapter transforma esses
campos em `billingTypes`, `chargeTypes` e `installment.maxInstallmentCount`.

Antes de criar o Pedido, o Hub calcula o teto efetivo por
`floor(price_in_cents / 1000)`, limitado entre 1, o teto configurado e 12. Os `1000`
centavos são a política comercial aprovada tanto para a cobrança quanto para cada parcela.
O Asaas documenta o valor mínimo por parcela como configuração da conta que limita as
parcelas disponíveis; o piso externo deve permanecer abaixo ou igual ao contrato interno.
A recusa histórica de 3x de R$ 6,63 ocorreu quando a conta estava configurada com mínimo
de R$ 10,00 e não constitui um limite fixo da API. A configuração do Curso permanece
intacta e o Pedido recebe somente o teto efetivo, preservando o padrão de novos Cursos em
3x.

- o Checkout não documenta campo por sessão para escolher se Compradora ou Vendedora
  absorve o custo do parcelamento;
- Pix, cartão à vista e cartão parcelado usam o mesmo total do item; a quantidade de
  parcelas não altera o preço pago pela Compradora;
- `interest` nas APIs de cobrança significa juros por atraso;
- cada parcela possui um ID de pagamento próprio;
- Pix + cartão parcelado no mesmo Checkout foi comprovado no Sandbox.

Na prova de 2026-08-01, o Admin alterou e persistiu o teto de 3x para 5x e o
restaurou para 3x. O link público da configuração redirecionou diretamente ao
Checkout Sandbox, que exibiu Pix e cartão. A resposta oficial ao cancelamento
confirmou `billingTypes=PIX,CREDIT_CARD`, `chargeTypes=DETACHED,INSTALLMENT` e
`maxInstallmentCount=3`. O webhook e o worker encerraram o Pedido como
`cancelled/CANCELED` sem efeito financeiro.

Em 2026-08-02, uma compra pública de R$ 99,00 foi paga em 3x no Checkout Sandbox de
Staging. O Asaas criou um agregado de parcelamento e três IDs de pagamento, enquanto o
Hub persistiu R$ 99,00 bruto, R$ 95,07 líquido e R$ 3,93 de taxa. O e-mail pertencia a
um acesso anteriormente revogado no Curso: o Pedido foi pago, mas permaneceu sem Conta,
Concessão ou Matrícula e abriu Revisão `buyer_identity_course_revoked`, conforme a regra
de bloqueio aprovada.

O estorno integral do parcelamento devolveu três evidências de R$ 33,00, uma por
cobrança, em vez de uma evidência isolada de R$ 99,00. Resposta da mutação, webhook e
conciliação agora somam somente evidências positivas, não canceladas e cujo total exato
corresponde ao snapshot do Pedido. Evidência agregada integral confirma a solicitação e
encerra a Revisão de identidade; valor parcial, cancelado ou divergente continua falhando
fechado. Na conciliação, um Pedido público em `buyer_identity_status=review_required`
sem `user_id` é o estado esperado desse bloqueio e não cria uma Revisão financeira
`event_anomaly`; ausência de Conta fora desse estado continua sendo anomalia.

O Hub guarda o ID comum em `provider_installment_id`, valida o agregado oficial fora da
transação local, preserva a primeira cobrança em `provider_payment_id`, concilia todas as
cobranças e usa o endpoint de estorno do parcelamento. O contrato está descrito em
[DEC-DISC-011](../decisions.md#dec-disc-011) e nos casos da
[pesquisa oficial](../reviews/2026-07-30-asaas-payment-configuration-research.md).

`src/features/payments/checkout.ts` usa o UUID estável fornecido pela entrada como ID do
Pedido e uma `externalReference` opaca sem PII. O insert `pending` com identidade local
e snapshots reserva a tentativa antes da autorização coordenada. Somente o insert vencedor
executa essa autorização; depois, uma CAS `pending → creating` precede `createCheckout`.
Se a autorização rejeitar a nova intenção, inclusive por rate limit público, o Hub remove
por CAS somente a reserva ainda `pending`, com zero tentativas e sem URL, ID ou estado do
provedor, e devolve o erro original. Pedidos `creating`, `uncertain`, `active`, `failed` ou
com qualquer evidência de efeito externo nunca entram nessa remoção.
Repetições da mesma tentativa são
resolvidas pelo Curso e slug históricos do Pedido antes de consultar o Curso atual;
colisões de Curso ou Compradora falham sem revelar o Pedido. Resultado externo desconhecido permanece `uncertain` para reconciliação e nunca
é repetido automaticamente. Nome e descrição do item são limitados de forma segura a
30 e 150 caracteres Unicode, respectivamente.

`GET /api/checkouts/course` recupera uma tentativa pública já reservada pela dupla exata
`checkoutAttemptId` + `courseSlug`. A resposta nunca inclui PII nem estado bruto do Asaas:
somente `ready`, `processing`, `failed` ou `unavailable`; a URL hospedada aparece apenas
para `checkout_status=active` com URL persistida. Ausência e divergência produzem a mesma
resposta genérica, todas as leituras usam `Cache-Control: no-store`, e sessão de equipe ou
Conta bloqueada continua recusada. O UUID é uma capacidade opaca armazenada no navegador,
compartilhada entre abas por 60 minutos e enviada sem nome ou e-mail.

Ao receber `processing`, o handoff consulta a mesma tentativa após 1, 2, 4, 8 e 16
segundos. Depois desse limite, oferece `Verificar novamente`; essa ação é outra leitura,
nunca outro `POST`. Somente falha definitiva com `retryAllowed=true` permite que um clique
explícito descarte a tentativa e crie uma nova. Refresh, aba adicional e resposta repetida
reutilizam o UUID ainda válido; timer é cancelado no unmount.

## Cliente HTTP e ambientes

A API usa o header `access_token` e um `User-Agent` estável e identificável, conforme
[Autenticação Asaas](https://docs.asaas.com/docs/autenticação). Sandbox e produção usam
URLs, contas e credenciais separadas. O preflight deve rejeitar cruzamento de ambiente,
credencial ausente ou configuração incompleta.

`ASAAS_USER_AGENT` não é fornecido nem gerado pelo painel Asaas. É uma identificação
definida pela própria aplicação, estável entre chamadas e sem segredo, por exemplo
`NeuroCapacitar-Hub/1.0 (suporte@neurocapacitar.com.br)`. Não use token, chave, URL de
deploy variável ou PII de cliente nesse valor.

`ASAAS_WEBHOOK_TOKEN` também é definido pelo Hub: gere um segredo aleatório com ao menos
32 caracteres, salve o mesmo valor no secret de Production e no campo “Token de
autenticação” do webhook Asaas. O Asaas o envia no header `asaas-access-token`; ele não é
a API key e não deve ser reutilizado como `ASAAS_API_KEY`.

O runtime lê exclusivamente no servidor `ASAAS_API_KEY`, `ASAAS_API_BASE_URL`,
`ASAAS_USER_AGENT`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_WEBHOOK_ENABLED` e
`PAYMENTS_CHECKOUT_MODE`. O parser permite ausência das credenciais em build e testes
isolados; o factory do adapter exige as três primeiras antes de qualquer chamada e a rota
de webhook falha de forma segura sem um token próprio de ao menos 32 caracteres. Preview
recusa credenciais de provider, exige checkout desabilitado e não permite ativar o
webhook.

As variáveis do Vercel são capturadas por implantação. Alterar `ASAAS_API_KEY` ou
`ASAAS_API_BASE_URL` no ambiente `Production` não altera Functions que já estão
publicadas; é obrigatório criar e promover uma nova implantação antes de validar a
conta. A rotação de uma conta Asaas deve sempre ser seguida por: conferir a origem
`https://api.asaas.com`, publicar a nova implantação, executar um checkout
controlado sem abrir o link e confirmar o pedido no painel da conta nova. Nenhuma
API key ou token deve aparecer em log, chat ou documento.

A aplicação também versiona o namespace de `localStorage`/`sessionStorage` usado
pela tela de compra. O namespace `v3` foi emitido no corte de 2026-08-25 para
que tentativas persistidas antes da troca não reutilizem um `checkout_url` da
conta anterior; pedidos antigos permanecem somente para conciliação e não são
apagados.
Development aceita somente a origem `https://api-sandbox.asaas.com`; Production aceita
somente `https://api.asaas.com`. Uma barra final é tolerada, mas path, query, credenciais
embutidas, HTTP, hostname alternativo ou cruzamento sandbox/produção são rejeitados.
O deploy Production pré-corte permite que as quatro variáveis permaneçam ausentes enquanto
checkout, webhook e worker estão desabilitados. `PAYMENTS_CHECKOUT_MODE=disabled` deve
anteceder a Release A; `ASAAS_WEBHOOK_ENABLED=false` deve anteceder a Release B. Quando
as credenciais forem configuradas na Etapa 10, continuam
sujeitas às validações acima; adapter e rota falham de forma segura antes disso.

Secrets não entram no repositório, payload persistido, `externalReference`, logs ou
respostas ao navegador.

`src/features/payments/asaas-client.ts` implementa criação e cancelamento de checkout,
consulta individual de cliente, consulta/listagem de pagamentos e solicitação de reembolso
integral. `getCustomer` usa `GET /v3/customers/{id}`, exige correlação exata e expõe somente
`id`, `name` e `email`; CPF/CNPJ, telefones, endereço e demais campos da resposta oficial são
descartados antes de sair do adapter. A fronteira:

- recebe e devolve dinheiro em centavos inteiros seguros;
- converte decimal em reais somente ao serializar ou validar a resposta externa;
- codifica IDs inseridos em paths e não envia body ou `Content-Type` em consultas;
- usa timeout abortável e classifica rejeição conhecida, resultado incerto e
  retentabilidade; `outcome: unknown` implica sempre `retryable: false` e exige consulta
  ou reconciliação antes de nova mutação, enquanto falhas transitórias de consulta e
  rejeições `429` podem ser retentáveis;
- só expõe `providerCode` no formato técnico permitido e nunca copia token, descrição,
  body ou causa externa para o erro;
- quando uma mutação de checkout é rejeitada, `checkout_error_message` pode incluir
  somente esse `providerCode` seguro, entre o tipo do erro e o estado final; nunca
  persiste a mensagem ou o corpo devolvido pelo Asaas;
- preserva status e tipos de pagamento desconhecidos como strings;
- rasteriza o logo institucional para `imageBase64` PNG e nunca inventa CPF ou
  identificador de reembolso.

`src/features/payments/asaas.ts` contém a porta estreita.
`src/features/payments/asaas-financial-events.ts` contém o parser estrutural do envelope
e a matriz financeira pura. `src/features/payments/fake-asaas-gateway.ts` implementa a
porta com respostas e erros determinísticos e registro de chamadas. Essa unidade não
seleciona múltiplos gateways. As entradas da aplicação chamam o adapter somente depois
de persistir uma nova intenção local.

## Entradas de checkout

`POST /api/checkouts/course` não é cacheado e aceita JSON com exatamente:

- `checkoutAttemptId`, UUID opaco e idempotente;
- exatamente um entre `courseId` e `courseSlug`.

Nome, e-mail, CPF, preço, callbacks, método de pagamento, gifting e quaisquer campos extras
são rejeitados antes do checkout. Visitante segue sem identidade local; Student elegível usa
nome/e-mail da sessão; Admin, Suporte e Student com bloqueio geral recebem `403`. `ready`
retorna `200` com `status`, `orderId` e `redirectUrl`; `processing` retorna `202` com
`status` e `orderId`; rejeição externa conhecida retorna `502` com retry explícito;
resultado incerto retorna `202` sem retry automático. Validação retorna `400`. Limite
público retorna `429` e `Retry-After`, sem ecoar PII ou payload externo.

O núcleo normaliza e valida nome/e-mail somente para a identidade autenticada. A tentativa
pública persiste `user_id`, nome e e-mail nulos com identidade `pending`; o Checkout Asaas
coleta os dados. Erros esperados são tipados como validação, conflito ou indisponibilidade;
falhas inesperadas de DB, ambiente ou runtime retornam `503` genérico.

O limite permite cinco novas intenções em dez minutos por HMAC-SHA-256 de IP e ID
canônico do Curso, usando `BETTER_AUTH_SECRET`. O PostgreSQL coordena a janela em
`public_checkout_rate_limits`; IP e Curso não são persistidos em claro. Slug e ID do
mesmo Curso compartilham a chave. Repetir `checkoutAttemptId` já persistido é resolvido
antes do hook e não incrementa o contador. Tentativas concorrentes com o mesmo ID disputam
a reserva local, portanto consomem no máximo uma autorização. UUIDs distintos rejeitados
depois do limite não conservam Pedido, nome ou e-mail.

A ação autenticada recebe somente Curso e tentativa pelo formulário; Conta, nome e e-mail
vêm da sessão. Os callbacks absolutos são:

- autenticado: sucesso em `/app/checkout/sucesso?courseId=...`;
- público: sucesso em `/checkout/sucesso`;
- ambos: cancelamento em `/checkout/cancelado?attemptId=...` e expiração em
  `/checkout/expirado?attemptId=...`.

Cancelamento e expiração validam o UUID antes de consultar somente o snapshot do slug no
Pedido Asaas e oferecem nova tentativa pelo link estável `/comprar/[slug]`. Referência
inválida ou inexistente oferece login e contato com Suporte, nunca navega para `/` nem cria
tentativa em GET. Páginas de retorno informam processamento ou ausência de confirmação;
callback de checkout não é autoridade para declarar pagamento.

A raiz da aplicação continua protegida. O handoff estável `/comprar/[slug]` é público,
read-only no `GET` e não contém formulário; um Client Component cria/reutiliza um UUID no
`sessionStorage`, faz um único `POST` e redireciona ao Checkout hospedado. Falha de rede ou
resposta malformada permite retry manual com a mesma tentativa; recusa terminal substitui a
tentativa somente no clique. A navegação aceita somente HTTPS, sem credenciais ou porta, nos
hosts exatos `sandbox.asaas.com`, `www.asaas.com` ou `asaas.com`; qualquer outro destino
falha fechado. O runtime E2E permite adicionalmente apenas
`http://127.0.0.1:4570`, condicionado a `NEXT_PUBLIC_E2E_TEST_MODE=true`; essa origem não é
aceita no build normal. Em 2026-08-01, a jornada foi homologada novamente no
Sandbox pelo domínio estável de Staging, sem página ou formulário intermediário.
A configuração administrativa do Curso mostra esse link absoluto somente quando checkout
público, Curso ativo, publicação `published` e preço mínimo estão válidos. O botão usa a
Clipboard API e, quando indisponível, seleciona o campo read-only para cópia manual.

## Identidade

O contrato alvo mantém o Hub como autoridade sobre Contas e usa o Asaas apenas como fonte
da identidade pretendida do pagador:

- checkout autenticado usa a Conta da sessão;
- checkout público nasce sem PII e o Asaas coleta os dados do pagador;
- após evento financeiro autoritativo, o Hub consulta somente nome/e-mail do cliente;
- no fluxo público, Compradora = Aluna;
- a compra pode ocorrer antes de existir credencial;
- o Asaas não verifica Conta e não sobrescreve Conta existente;
- compra como presente ou para terceiro está fora do escopo.

Após pagamento autoritativo, o processor vincula pelo e-mail normalizado, cria Conta local
não verificada quando necessário e envia ativação por outbox. A resolução usa CAS
write-once para PII, vínculo e status de identidade; retry idêntico converge sem sobrescrita.
Colisão com Conta Admin/Suporte, bloqueio geral ou Matrícula `revoked` no Curso abrirá
Revisão sem acesso e permitirá somente reembolso integral pelo Suporte seguido de nova
compra elegível. Aprovação ou rejeição genérica não resolve `buyer_identity`; somente a
confirmação financeira do reembolso integral encerra automaticamente a Revisão. Reembolso
parcial, incerto ou apenas solicitado mantém a Revisão pendente. A tela financeira oferece
uma única operação por Pedido, inclusive quando Pedido e Revisão aparecem em paginações
independentes. Quando a sessão já revela o impedimento, o Checkout falha antes da cobrança.
A entrada e o Pedido públicos nascem sem PII; o enriquecimento e a resolução das colisões
já estão implementados em código. A homologação PostgreSQL/Sandbox da jornada completa
ainda está pendente. Ver [DEC-DISC-007](../decisions.md#dec-disc-007).

## Inbox de webhook

`POST /api/webhooks/asaas` autentica exclusivamente o header `asaas-access-token` contra
`ASAAS_WEBHOOK_TOKEN`, com comparação resistente a timing. Token ausente, fraco,
incorreto ou configuração incompleta falha sem ler nem persistir o corpo. TLS pertence à
borda de hospedagem; não há HMAC de corpo nem allowlist inventados no contrato atual.
O corpo é lido por stream até o limite de 256 KiB antes de JSON ou banco.

Com `ASAAS_WEBHOOK_ENABLED=false`, ingresso retorna indisponibilidade antes de token,
body ou banco, e o cron retorna skip seguro antes de adquirir lease ou executar worker.
Essa flag é independente de `SCHEDULED_JOBS_ENABLED`: a segunda controla todos os crons;
a primeira controla somente o pipeline Asaas.

O ingresso segue persist-before-200:

1. autenticar e validar estruturalmente a entrega;
2. persistir payload, identidade externa, chave de deduplicação e estado inicial;
3. responder `200` somente depois do commit da inbox;
4. processar negócio em executor durável com retry.

Banco indisponível ou falha antes da persistência não retorna sucesso. Duplicata
persistida retorna `200` sem reaplicar efeitos. Nome de evento desconhecido também é
persistido para classificação segura posterior. A rota não executa regra de negócio.
Evento financeiro conhecido exige `payment.id`, `payment.status`,
`payment.billingType` não vazio e `payment.value` finito, não negativo e representável
com no máximo duas casas decimais. Essa exigência estrutural não fecha os valores de
método ou status em enum e não se aplica a eventos futuros desconhecidos.
Esse desenho considera o timeout e os retries descritos
em [Recebimento de webhooks Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

`claimAsaasWebhookEvents`, `processClaimedAsaasWebhookEvent` e
`runAsaasWebhookWorker` formam a infraestrutura genérica agendada a cada minuto. O claim usa
`FOR UPDATE SKIP LOCKED`, posse por worker, recuperação de lock após dez minutos, lote
máximo de 50, cinco tentativas e backoff exponencial iniciado em um minuto. Conclusão
`processed`/`ignored`, retry e falha usam CAS pela mesma posse e guardam somente códigos
seguros. O processor é obrigatório e injetado; para alterar um Pedido, recebe cliente
transacional e deve obter `lockOrder`, que executa lock da linha do Pedido. Nenhuma
recuperação executa uma sexta tentativa: um lock abandonado na quinta é terminalizado
como `failed` sem reinvocar o processor.
O processor é bifásico. `prepare` valida o envelope e a convergência de todos os IDs,
correlaciona somente por `Pool.query` e consulta o cliente Asaas antes de `pool.connect()`;
zero, múltiplos ou IDs divergentes não consultam PII. Somente depois o worker abre a
transação e chama `process`. Nenhuma chamada HTTP externa ocorre dentro da transação local.
Falha de preparação usa o CAS/backoff da inbox pelo próprio Pool, sem `BEGIN`.

Exceção: se `getInstallment` falhar durante `PAYMENT_REFUNDED`, disputa ou chargeback e
o `provider_installment_id` do Pedido já coincidir exatamente com o payload, o processor
não espera o enriquecimento para proteger o acesso. Na transação da inbox ele persiste
somente o estado bruto seguro de refund/disputa, revoga a Concessão com a razão canônica
e abre Revisão `event_anomaly` com razão `installment_enrichment_pending`; não declara o
Pedido inteiro `refunded`/`disputed` sem o agregado. O worker então confirma a transação e
reagenda o mesmo evento com o backoff normal. Quando `getInstallment` volta, o payload
agregado percorre a matriz normal, converge o estado e encerra ou transforma a Revisão.
Após cinco tentativas, o evento fica `failed`, a Revisão permanece e a revogação não é
desfeita. Evento positivo continua falhando antes da transação e jamais concede sem o
enriquecimento necessário.

`GET /api/cron/asaas-webhooks` usa o guard compartilhado de `CRON_SECRET` e
`SCHEDULED_JOBS_ENABLED`, adquire lease persistente de seis minutos e entrega ao worker o
prazo interno de 270 segundos e a verificação de posse. Sobreposição retorna sucesso
seguro sem processar. A agenda `* * * * *` em `vercel.json` é UTC.
O agendamento está ativo em Production desde 2026-08-21 (`SCHEDULED_JOBS_ENABLED=true`), e o retry administrativo de evento Asaas `failed` com payload presente está implementado como action (`retryFailedAsaasWebhookAction`, permissão `retryWebhook`) e exposto no painel de operações financeiras do Admin, exigindo motivo e gravando `asaas_webhook.requeued`.

## Eventos, valor e acesso

A matriz aprovada é:

- `CHECKOUT_PAID`: não libera;
- `CHECKOUT_CREATED` ou `CHECKOUT_PAID` após `cancelled`/`expired` abre Revisão sem
  regredir o checkout; conflito entre `cancelled` e `expired` preserva o primeiro;
- PIX `PAYMENT_RECEIVED`: libera uma vez;
- cartão `PAYMENT_CONFIRMED`: libera uma vez quando o snapshot de risco não está em
  `AWAITING_RISK_ANALYSIS` nem `REPROVED_BY_RISK_ANALYSIS`;
- cartão confirmado enquanto o risco está `AWAITING_RISK_ANALYSIS` registra a
  confirmação sem liberar nem abrir revisão; `PAYMENT_APPROVED_BY_RISK_ANALYSIS`
  posterior completa a liberação uma vez;
- risco `APPROVED_BY_RISK_ANALYSIS` ou `REPROVED_BY_RISK_ANALYSIS` já registrado não é
  sobrescrito por `AWAITING_RISK_ANALYSIS` tardio; conflito entre os dois terminais
  preserva o primeiro e abre revisão;
- cartão `PAYMENT_RECEIVED` posterior: atualiza liquidação sem duplicar acesso;
- valor bruto `value`: deve coincidir exatamente com o snapshot do Pedido em centavos,
  com tolerância zero;
- valor divergente: não libera e abre revisão;
- Revisão pendente anterior bloqueia pagamento posterior de marcar o Pedido como pago ou
  conceder acesso; somente IDs, método e estados seguros do provider são preservados;
- `provider_payment_status` avança de `CONFIRMED` para `RECEIVED`; `RECEIVED` e Pedidos
  pagos/adversos não regridem por `CONFIRMED`, `OVERDUE`, `DELETED` ou `PENDING`, e a
  regressão abre Revisão no Pedido correlacionado;
- reembolso confirmado, disputa ou chargeback: prevalece e revoga;
- falha temporária ao consultar o agregado parcelado não adia a revogação quando o ID de
  parcelamento já está persistido e coincide exatamente; sem essa igualdade, abre anomalia
  e tenta novamente sem alterar acesso;
- `PAYMENT_REFUND_IN_PROGRESS` e `PAYMENT_REFUND_DENIED`: registram somente evidência
  externa de reembolso, sem revogar nem reabrir Pedido;
- `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`: preserva método e estado seguro da cobrança,
  abre `event_anomaly` e não concede acesso; o nome do evento permanece como contexto
  operacional, sem inventar um status financeiro terminal não publicado pelo provider;
- pago tardio após estado adverso: não reativa;
- cancelamento ou expiração tardios após pagamento: não revoga;
- `PAYMENT_PARTIALLY_REFUNDED`: sempre abre revisão `partial_refund` e não transiciona;
- referências locais exatas e conflitantes: anomalia sem efeito financeiro;
- evento desconhecido, regressivo ou contraditório: revisão ou alerta.

`decideAsaasFinancialEvent`, em `src/features/payments/asaas-financial-events.ts`,
normaliza somente os identificadores exatos disponíveis e devolve essa decisão sem SQL.
`processAsaasWebhookEvent`, em `asaas-webhook-processor.ts`, correlaciona referências e
IDs exatos, bloqueia e relê o Pedido, associa o evento por CAS e persiste a decisão na
transação do worker. Todos os identificadores existentes precisam convergir; conflito
ambíguo não escolhe Pedido e grava alerta durável seguro. Revisões são únicas por
`webhook_event_id`. Uma referência local `order_<uuid>` só é válida quando o UUID é o
próprio `orders.id` e `orders.external_id` contém exatamente a mesma referência.

Revisão pendente, seja do Webhook atual ou anterior, bloqueia `grant`, mas não neutraliza
um evento adverso autoritativo. `grant`
resolve a identidade local, aplica a Concessão `paid_order`, recompõe a Matrícula e
enfileira `auth.account-activation` ou `email.access-released`. Snapshot de acesso
inválido ou erro determinístico de identidade preserva a evidência financeira, abre
Revisão `event_anomaly` e não concede acesso nem enfileira mensagem. Falhas inesperadas
continuam causando rollback e retry. `revoke` é no-op sem
Conta ou sem Concessão paga `active`/`expired`; quando ambas existem, aplica a razão
canônica `payment_refund`/`payment_dispute` e recompõe a projeção. Pedido já adverso e
conflito terminal não impedem essa revogação; Concessão já terminal impede duplicar
evento/projeção. O predicado `active`/`expired` está no próprio `UPDATE`; zero linhas
alteradas retorna no-op antes de evento ou recomposição. Reembolso integral confirmado
também confirma a solicitação local
elegível somente quando o valor bruto corresponde exatamente ao snapshot; divergência,
evidência monetária ausente, parcial, em andamento e negado não o fazem.

Decisão manual exige permissão, motivo e auditoria. O efeito financeiro altera a
Concessão de origem neutra `paid_order`; Matrícula é recomposta como projeção. Ver
[ADR-0004](../adr/0004-access-grants-and-enrollment-projection.md) e
[ADR-0005](../adr/0005-financial-precedence-and-manual-review.md).

## Reembolso e reconciliação

O Hub oferece somente reembolso integral. A solicitação usa o endpoint oficial de
[estorno de cobrança](https://docs.asaas.com/reference/estornar-cobranca), registra a
intenção antes da chamada e trata timeout ou resposta perdida como resultado incerto.
Resultado incerto não autoriza repetição cega: exige consulta e reconciliação.

A resposta de estorno não contém um identificador próprio de reembolso. O Hub não cria
um ID externo fictício. `refund_requests` registra, quando presentes, somente os campos
reais retornados: status, data de criação, EndToEnd ID, URL do comprovante e valor
reembolsado em centavos. A migration `0045_asaas_refund_evidence` remove
`provider_refund_id` e adiciona essas evidências. A associação operacional permanece
determinística pelo ID do pagamento em `orders` e pelo ID local da solicitação.
Reembolso é do valor da cobrança; tarifas do processamento podem não ser devolvidas e
devem ser conferidas no extrato, sem prometer estorno de tarifa ao suporte.
`dateCreated` é preservado como texto exato porque o contrato publicado não informa
fuso; convertê-lo para `timestamptz` inventaria um instante. A reserva nasce
`processing`; rejeição definitiva vira `failed`; timeout, transporte, `5xx` ou resposta
semanticamente inválida viram `uncertain`. Somente `failed` aceita nova solicitação,
sempre com nova confirmação recente de senha. `processing`, `uncertain` e `confirmed`
impedem repetição cega.

A confirmação de senha é limitada por Admin: cinco falhas em uma janela móvel de 15 minutos
por ator. A sexta tentativa é recusada antes de verificar a senha. As tentativas são
serializadas por lock transacional, expiram no servidor e são removidas após confirmação
válida; senha, hash digitado, e-mail e demais PII não entram na contagem, auditoria ou logs.
Esse controle protege a autorização local e não substitui a reserva idempotente do reembolso.

No Sandbox, o recurso `Payment` originado pelo Checkout devolveu
`externalReference=null`. A solicitação de reembolso aceita essa omissão somente quando
o ID do pagamento e a `checkoutSession` são exatamente os reservados no Pedido. Todos
os identificadores presentes precisam convergir, ao menos `externalReference` ou
`checkoutSession` precisa corresponder, e a evidência deve comprovar o valor integral.
Resposta com qualquer identificador conflitante permanece `uncertain`, sem repetição
cega.

Webhook é o fluxo normal. Consultas de cobrança, webhook e extrato servem para reparo
direcionado, respeitando os limites publicados de 25.000 requisições por 12 horas e 50
GETs concorrentes em [Rate e quota limit](https://docs.asaas.com/reference/rate-e-quota-limit).
Reconciliador deve limitar concorrência, aplicar backoff em `429` e nunca corrigir outro
Pedido por aproximação.

As consultas administrativas são serializadas por runtime e repetem somente respostas
`429`, no máximo três tentativas, respeitando `Retry-After` com teto operacional de 30
segundos. Falhas diferentes de rate limit não recebem retry automático nessa camada.

A conciliação administrativa tem dois comandos separados:

- por Pedido, consulta `GET /v3/payments/{id}`, exige igualdade do ID do pagamento e
  convergência de todos os identificadores presentes. O `Payment` criado por Checkout
  pode omitir `externalReference`; nesse caso, `checkoutSession` deve ser exatamente o
  `provider_checkout_id` do Pedido. Referência ou sessão conflitante é rejeitada. A
  consulta também exige igualdade entre `value` e o snapshot interno, preserva estados
  terminais e evidência de pagamento segundo a ADR-0005, abre Revisão em conflito e
  atualiza somente o Pedido bloqueado. Reembolso integral exatamente comprovado pode
  revogar a Concessão e confirmar a solicitação na mesma transação;
- por extrato, consulta `GET /v3/financialTransactions` em período fechado, páginas de
  100 e ordem crescente, persistindo cada movimento em
  `asaas_financial_transactions` com deduplicação pelo ID do Asaas. Cada página é um
  único lote transacional; `asaas_statement_import_cursors` avança na mesma transação.
  Uma execução interrompida retoma do último offset confirmado, sem reler páginas já
  concluídas, e o resultado separa linhas inseridas de atualizadas. Consulta ao Asaas
  continua fora da transação PostgreSQL.

A consulta por Pedido é adaptada por `decideQueriedAsaasPayment` para a mesma matriz do
webhook. A aplicação local passa por `applyConfirmedPaymentAccess`: PIX exige
`RECEIVED`; cartão aceita `CONFIRMED` ou a evidência posterior `RECEIVED`; risco
reprovado, estado terminal, Revisão pendente ou identidade bloqueada impedem acesso.
Compra pública válida cria ou vincula a Conta e enfileira ativação/acesso exatamente
como o webhook.

Os dois comandos mutáveis exigem `manageFinancialOperations`, capacidade exclusiva de
Admin. Resolução manual de Revisão exige `manageFinancialReviews`, também exclusiva de
Admin; `viewFinancials` permite somente leitura. `buyer_identity`, `event_anomaly` e
`partial_refund` não aceitam decisão genérica e permanecem pendentes até o fluxo
financeiro correspondente comprovar seu efeito. O snapshot e a tela de auditoria contam separadamente Checkouts com
`checkout_status='uncertain'`, reembolsos incertos e Pedidos pagos sem pagamento
correlacionado. Também exibem contagem e idade dos webhooks prontos, em retry e falhos. Os
sinais `webhook_ready_stale`, `webhook_retry_stale` e `webhook_failed_stale` surgem em 15
minutos, 6 horas e 24 horas; `webhook_payload_retention_risk` surge em 25 dias, antes da
sanitização obrigatória do payload em 30 dias. Os sinais exigem o runbook, não replay
automático.

O extrato publicado expõe `id`, `type`, `value` e `date`, mas não um vínculo contratual
direto com `payment`. Portanto, o Hub não tenta correlacionar tarifa e Pedido por
proximidade de data ou valor. O painel mostra bruto, líquido e tarifa derivados da
cobrança detalhada/webhook; o extrato permanece evidência contábil independente.

## PII e retenção

Persistir somente dados necessários para correlação financeira, auditoria, retry e defesa.
`externalReference` é opaca; logs omitem tokens, nome, e-mail, documento, endereço e
payload integral. O payload bruto da inbox expira 30 dias após a persistência. Depois
desse prazo, um processo de sanitização remove os dados pessoais e registra
`payload_sanitized_at`, preservando chave, nome, provider, estado, tentativas, correlação,
erros seguros e datas. `runMaintenance` executa essa sanitização em lotes de 500 sob o
lease e deadline existentes, sem disputar um evento `processing` com lock vigente.
Eventos ainda `received`, `retryable` ou `processing` abandonados tornam-se `failed` com
`webhook_payload_expired`, sem locks ou próxima tentativa; o claim e o retry administrativo
também recusam payload sanitizado ou vencido.

A manutenção diária repara interrupções entre a reserva e a autorização: sob o lease e o
deadline existentes, remove em lotes somente reservas Asaas com mais de 15 minutos, estado
canônico e checkout `pending`, zero tentativas e nenhuma URL, ID ou situação de provedor.
Essa assinatura identifica a fase pré-provedor sem abranger falhas ou efeitos incertos.

## Validações externas confirmadas

Em 2026-07-28, o sandbox retornou os cadastros geral, comercial, bancário e documental
como `APPROVED`, e a consulta de chaves Pix ativas retornou uma chave `ACTIVE`. Essa
evidência confirma a prontidão cadastral e a existência da chave no sandbox, sem expor
seu identificador ou conteúdo. Ela não prova o checkout PIX ponta a ponta nem qualquer
configuração de produção.

Na mesma data, um probe oficial resolveu a divergência sobre imagem no ambiente observado:
uma tentativa de R$ 1 retornou `invalid_object` por estar abaixo do mínimo de R$ 10; uma
tentativa de R$ 10 sem `imageBase64` criou checkout `ACTIVE`, depois cancelado com estado
`CANCELED`. Nenhum ID, URL ou dado do checkout é registrado aqui.

O mínimo de `1000` centavos é política aprovada e já é validado na autoria e no núcleo
Asaas antes de persistir ou chamar o provider. As entradas legadas de checkout já foram
substituídas; o ajuste ou remoção dos dados de teste abaixo do limite permanece pendente.

Em 2026-07-29, a credencial local de Sandbox autenticou `GET /v3/myAccount/status/` com
HTTP `200`. O webhook `testeneuro` foi corrigido para envio `NON_SEQUENTIALLY` a uma rota
ngrok temporária. Pelo caminho público, token ausente retornou `401`, uma entrega
sintética autenticada e sua duplicata retornaram `200`, e a inbox da branch Neon
descartável preservou exatamente uma entrada. Essa prova cobre transporte, autenticação,
persistência e deduplicação do Hub.

Na continuação do ensaio, o Hub criou sessões reais de checkout Sandbox com resposta
HTTP `200` e estado local `ready`. O contrato observado exigiu `minutesToExpire`; enviar
`customerData` apenas com nome/e-mail retornou `invalid_object` porque `cpfCnpj` era
obrigatório. O adapter passou a omitir esse objeto, coerente com a decisão de não coletar
CPF. Eventos `CHECKOUT_CREATED` originados pelo Asaas atravessaram a rota pública, foram
correlacionados aos Pedidos e terminaram `processed`. O evento futuro sintético terminou
`ignored`; uma duplicata autenticada preservou uma única entrada.

Depois de uma pausa controlada da fila, os eventos acumulados foram entregues na
reativação. PIX em `PAYMENT_RECEIVED` e cartão em `PAYMENT_CONFIRMED` tornaram os Pedidos
pagos e criaram exatamente uma Concessão e uma Matrícula ativa por compra. A primeira
tentativa de efeito revelou que a fixture temporária não possuía a publicação vigente
exigida pelo domínio; depois de completar a fixture, o retry durável processou ambos na
quarta tentativa. O cancelamento de Checkout foi recebido e processado sem conceder
acesso.

O reembolso integral do cartão exercitou confirmação recente de senha, reserva local
antes da mutação e resultado externo incerto sem repetição cega. O webhook
`PAYMENT_REFUNDED` confirmou valor integral, solicitação e Pedido, mudou a Concessão para
`refunded` e recompôs a Matrícula como `revoked`. A consulta real do pagamento mostrou
que o `Payment` do Checkout conserva `checkoutSession`, mas devolve
`externalReference=null`. A conciliação foi ajustada para aceitar essa omissão somente
quando IDs de pagamento e sessão de Checkout forem exatos; valores presentes e
conflitantes continuam sendo rejeitados. A consulta Sandbox então concluiu com sucesso.
Um `PAYMENT_CONFIRMED` sintético tardio, entregue duas vezes depois do reembolso, gerou
uma única entrada, uma única Revisão `terminal_conflict` e nenhum novo efeito de acesso.

## Validações pendentes

O ensaio de expiração real manteve a aplicação desligada até a primeira entrega
`CHECKOUT_EXPIRED`. O túnel registrou duas respostas `502`; depois da recuperação da
rota, o próprio Asaas repetiu a entrega e recebeu `200`. A inbox preservou um evento, o
worker o processou uma vez e encerrou o Pedido como `cancelled/expired`, sem criar Conta,
  Concessão ou Matrícula. O webhook Sandbox foi pausado ao final daquele ensaio.

Em 2026-07-31, o pacote oficial `Ngrok.Ngrok` foi instalado no Windows e o agente foi
atualizado de `3.3.1` para `3.39.10`. O domínio já configurado no webhook `testeneuro`
estava reservado na conta e foi reutilizado com sucesso; nenhuma URL ou configuração Asaas
foi alterada. O upgrade do arquivo de configuração imprimiu o authtoken no terminal, então
ele deve ser rotacionado antes de uma nova exposição.

A homologação pós-mudança usou a branch Neon CI descartável
`br-sparkling-thunder-acsoydjw`, aplicou a cadeia completa de migrations e expôs o app local
pelo domínio existente. O handoff público respondeu `200` e o Hub criou um Checkout real
Sandbox em estado `ready`. O reCAPTCHA do Checkout hospedado rejeitou as tentativas
headless de finalizar cartão ou gerar Pix: o Pedido permaneceu `pending`, sem
`provider_payment_id`, e nenhum webhook foi recebido. A prova financeira ainda exigia uma
interação humana no formulário hospedado naquele ponto; ela foi concluída na continuação
descrita abaixo. App e túnel foram encerrados e a branch
descartável foi excluída ao final; nenhum banco persistente, deploy, Production ou
configuração Asaas foi alterado.

A interação humana posterior gerou o PIX do Checkout aberto. O ensaio foi retomado na
branch Neon CI descartável `br-bitter-morning-ac77jova`, reconstruindo somente o Pedido de
homologação porque a branch anterior já havia sido excluída. A confirmação oficial do
Sandbox emitiu `CHECKOUT_PAID` e `PAYMENT_RECEIVED`; ambos receberam HTTP `200` pelo
ngrok. O worker confirmou o Pedido de R$ 250,00, registrou R$ 248,01 líquido e R$ 1,99 de
taxa, criou uma Concessão, uma Matrícula e uma intenção de ativação. Uma segunda execução
não duplicou efeitos. A primeira entrega da ativação expôs que o Sentinel do Better Auth
remove pontos e `+tag` de Gmail/Googlemail, enquanto a identidade da Compradora removia
apenas espaços e caixa. `normalizeBuyerEmail` agora usa o mesmo contrato, inclusive para
provedores conhecidos de `+tag`; os testes de regressão passaram e o retry da outbox foi
entregue pelo Resend. A Compradora confirmou a criação da senha, o login e a abertura do
Curso; a auditoria encontrou uma credencial, uma Concessão ativa e uma Matrícula ativa.
App, túnel e branch descartável foram removidos ao final. O webhook Sandbox `testeneuro`
permaneceu habilitado e apontando para o domínio ngrok reservado, agora offline, até
decisão operacional explícita.

Um reteste manual posterior reabriu o app pelo domínio reservado contra Development. A
leitura administrativa detectou incompatibilidade porque esse alvo ainda estava em
`0043`; depois da promoção autorizada até `0052`, a consulta original passou e a pessoa
operadora aprovou o reteste. App e túnel foram encerrados novamente. Essa evidência não
altera Production nem substitui o smoke controlado da Etapa 10.

Estas afirmações não são assumidas como comportamento do provider e precisam ser
comprovadas no sandbox ou na conta:

- eventos de risco do cartão, que não foram emitidos na compra Sandbox observada e
  permanecem cobertos por testes automatizados;
- situação e aptidão da conta de produção (a credencial real e o webhook token já estão configurados e comprovados por sondas públicas em 2026-08-21);
- confirmar em produção que a omissão de `imageBase64` continua aceita e monitorar
  breaking changes na divergência entre OpenAPI, guia e comportamento;
- ausência ou disponibilidade futura de HMAC oficial;

Referências adicionais:

- [Webhooks de cobrança Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Criar cobrança Asaas](https://docs.asaas.com/reference/criar-nova-cobranca)
