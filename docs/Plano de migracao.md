# Planejamento de migração do gateway de pagamento

## Resumo executivo

**Resultado:** a troca do AbacatePay pelo Asaas exige redesenhar a fronteira entre o gateway e o domínio financeiro. Não é uma simples substituição de endpoints.

### Diagnóstico central

- **Fato confirmado:** o Hub é um monólito modular em Next.js 16, React 19 e PostgreSQL. Pedido é o contrato financeiro; Concessão é a fonte do direito; Matrícula é uma projeção de acesso.
- **Fato confirmado:** AbacatePay está acoplado ao checkout, criação de Cursos, schema, Concessões, Matrículas, webhooks, reembolsos, ambiente, observabilidade, administração e documentação.
- **Fato confirmado:** o checkout atual usa pagamento único com PIX e cartão. Não há assinatura, parcelamento, reembolso parcial ou boleto implementados no Hub.
- **Fato confirmado:** todos os registros financeiros atuais são dados de teste descartáveis. Não será necessário migrar dados, manter compatibilidade legada, executar dual-write ou operar dois gateways.
- **Inferência técnica:** preservar apenas `pending/paid/refunded` comprimiria indevidamente o ciclo mais rico do Asaas, que distingue checkout, pagamento, análise de risco, confirmação, recebimento, estorno e disputa.
- **Recomendação arquitetural:** criar um módulo profundo de comércio, com regras financeiras neutras, e um adapter Asaas estreito. Não criar um framework genérico de múltiplos gateways.
- **Recomendação operacional:** persistir e deduplicar webhooks antes de responder HTTP `200`; processar os efeitos financeiros separadamente, com retry durável.
- **Recomendação de corte:** substituição direta. Depois que o primeiro pagamento real Asaas existir, rollback significa pausar novos checkouts e corrigir o fluxo Asaas, não reativar automaticamente o AbacatePay.

### Decisões fechadas

- Checkout hospedado Asaas.
- Pagamento único.
- PIX e cartão.
- Boleto, parcelamento, assinatura e compra para terceiros fora desta migração.
- PIX libera acesso em `PAYMENT_RECEIVED`.
- Cartão libera acesso em `PAYMENT_CONFIRMED` quando não há risco pendente ou reprovado;
  aprovação de risco posterior pode destravar uma confirmação já armazenada.
- `CHECKOUT_PAID` não é autoridade financeira.
- Compradora pública informa os dados no Checkout Asaas; o Hub os consulta somente após
  evento financeiro autoritativo e não considera o provider prova de verificação.
- Dados do provider não verificam nem alteram automaticamente uma Conta.
- Divergência monetária tem tolerância zero e abre Revisão.
- Reembolso confirmado, disputa e chargeback prevalecem e revogam acesso.
- Reembolso oferecido pelo Hub continuará sendo apenas integral.

**Decisão posterior ao escopo original:** em 2026-07-30, Produto aprovou como evolução
uma oferta de pagamento própria por Curso, com Pix, cartão ou ambos e limite de parcelas
administrável. O padrão desejado é até 3x com juros. Isso é backlog pós-migração, não
falha retroativa deste escopo. A viabilidade dos juros e o agregado de múltiplos
pagamentos permanecem pendentes conforme
[DEC-DISC-011](decisions.md#dec-disc-011).

### Evidência desta fase

- Base analisada: commit `d64fc66bdf04`.
- Worktree: limpo.
- Arquivos alterados: nenhum.
- Testes executados: nenhum, porque esta fase foi estritamente de leitura e planejamento.
- Documentação atual de Asaas e AbacatePay consultada via Context7 e fontes oficiais em 2026-07-28.
- Tempo registrado da análise: aproximadamente 17 minutos.

## Revisão pós-sprint de 2026-07-30

O núcleo Asaas foi implementado e homologado em Sandbox, mas a substituição operacional
do AbacatePay ainda não está concluída. O resultado detalhado, achados priorizados,
novas regras e ordem de correção estão na
[revisão pós-sprint](reviews/2026-07-30-asaas-sprint-review.md).

Gates novos ou reabertos pela revisão:

1. separar e versionar Release A de contenção e Release B Asaas;
2. desativar o ingresso AbacatePay na Release A antes da limpeza e remover a rota e o
   código legado na Release B, antes de aplicar a migration `0044`;
3. **Concluído em código na Release B:** restringir conciliação e importação de extrato
   à capacidade mutável `manageFinancialOperations`, exclusiva de Admin;
4. disponibilizar a jornada pública real, não apenas a API;
5. **Concluído em código na Release B:** aceitar `externalReference=null` no reembolso
   somente com pagamento e sessão de Checkout exatos e nenhum identificador conflitante;
6. **Concluído em código na Release B:** incluir Checkout `uncertain` no backlog e na
   auditoria operacional;
7. concluir corte, smoke real e estabilização antes de declarar a migração encerrada;
8. tratar parcelamento como evolução arquitetural própria.

**Desenho aprovado para o item 4 em 2026-07-30:** as landing pages permanecem em outro
repositório e usam o link estável `APP_URL/comprar/[slug]`, copiável na configuração do
Curso. O handoff inicia uma tentativa por `POST` e redireciona automaticamente ao Asaas,
sem formulário ou segundo clique visível em condições normais. O Checkout Asaas coleta a
identidade; o worker consulta o cliente antes da transação financeira. Conta Student é
vinculada/criada sem sobrescrita nem verificação implícita. Identidade de Admin/Suporte,
Conta com bloqueio geral ou Matrícula `revoked` no Curso abre Revisão, não concede acesso e
só permite reembolso integral pelo Suporte e nova compra elegível. Quando sessão já revela
bloqueio/revogação, a cobrança é impedida. A especificação aceita está em
`docs/superpowers/specs/2026-07-30-public-course-purchase-handoff-design.md` e o plano TDD
em `docs/superpowers/plans/2026-07-30-public-course-purchase-handoff.md`. Histórico da
execução TDD: na Task 1, o parser único de identidade foi implementado antes do
enriquecimento das Tasks seguintes. A Task 1
passou em 45 testes focais, typecheck, Ultracite e revisões independentes de conformidade e
qualidade. A migration `0052_public_buyer_identity`, timestamp `1785424607559`, foi gerada
com backfill seguro e validada em 12 testes e na cadeia Drizzle; não foi aplicada a ambiente
persistente. O núcleo público agora cria Pedido sem PII com identidade `pending`, exige Curso
ativo e publicado, bloqueia acesso ativo ou revogado antes do provider e restringe a action
autenticada a Student; a Task 3 passou em 51 testes focais, typecheck, Ultracite e duas
revisões independentes. Esse histórico incremental foi concluído pelas Tasks 5–11
descritas a seguir. Naquele checkpoint, nenhum commit, merge ou deploy havia sido
executado. API sem PII e página de
handoff concluídas. A
matriz HTTP estrita passou em 49 testes focais e nas revisões de conformidade e qualidade.
O handoff `/comprar/[slug]` está implementado e homologado com compra PIX real no Sandbox.
A projeção é read-only, usa o relógio do PostgreSQL para acesso efetivo e o Client faz um
único POST, sem formulário ou PII. A navegação aceita somente HTTPS nos hosts Asaas exatos
documentados/permitidos e falha fechada para qualquer outro destino. A Task 5 passou em 44
testes focais, typecheck, Ultracite e revisões independentes.
O link copiável foi implementado na configuração do Curso, com disponibilidade derivada de
modo público, estado ativo, publicação e preço mínimo. Clipboard possui fallback acessível;
18 testes focais e as duas revisões passaram. Verificação visual não foi usada, conforme a
regra do projeto.
Adapter `getCustomer` e worker bifásico concluídos. O contrato descarta toda PII além
de `id`, `name` e `email`, exige correlação exata e passou em 67 testes focais e duas
revisões independentes.
O worker agora é bifásico: correlação e `getCustomer` acontecem antes de `pool.connect()` e
`BEGIN`; nenhuma chamada externa ocorre dentro da transação. Envelope e todos os IDs
presentes precisam convergir antes da busca de PII. A Task 8 passou em 78 testes unitários e
duas revisões; a integração PostgreSQL e o E2E foram executados depois em branches Neon
descartáveis.
Resolução transacional da identidade concluída em código: Student existente, Conta nova não
verificada, Admin, Suporte, papel ausente, bloqueio geral, revogação no mesmo Curso,
revogação em outro Curso e corrida de e-mail estão cobertos. CAS de PII e vínculo é
write-once/idempotente; colisão abre Revisão `buyer_identity`, preserva `paid` e bloqueia
Concessão/outbox. A Task 9 passou em 75 testes e duas revisões. Revisão
`buyer_identity` agora rejeita decisões genéricas e encerra somente depois de reembolso
integral confirmado; a UI mantém uma única operação de reembolso por Pedido mesmo com
paginação independente. A Task 10 passou em 80 testes, typecheck, Ultracite e revisões
independentes de conformidade e qualidade. Callbacks cancelado/expirado agora carregam a
tentativa nos fluxos público e autenticado, validam UUID antes da consulta e retornam ao
link estável do Curso; retorno inválido ou ausente oferece login/Suporte, nunca a raiz
protegida nem uma nova tentativa. A Task 11 passou em 62 testes, typecheck, Ultracite e
revisões independentes de conformidade e qualidade. A prova de concorrência em PostgreSQL
real continua pendente pela mesma ausência de banco local descartável.

Checkpoint da jornada pública:

- [x] Link estável e handoff sem formulário — unitários e E2E fake aprovados.
- [x] Identidade Asaas pós-evento — unitários e processor aprovados.
- [x] Conta de equipe/bloqueada/revogada — Revisão sem acesso aprovada.
- [x] Homologação Sandbox real pós-mudança — checkout, PIX, webhooks, acesso, entrega do
  e-mail de ativação, criação da senha, login e abertura do Curso foram comprovados.

O harness E2E inclui servidor Asaas local determinístico, seed sem PII, guard fail-closed
que rejeita banco divergente ou o compute de produção conhecido, compra pública e
autenticada, remount com UUID estável, callbacks, idempotência e colisões pós-pagamento.
As 24 jornadas Chromium passaram em branch Neon CI efêmero já migrado; o teardown concluiu
e o branch foi excluído. Os gates locais finais passaram com 214 arquivos/1.314 testes,
typecheck, Ultracite em 622 arquivos, 32 documentos canônicos, cadeia de migrations e
`git diff --check`. Nesse fechamento local anterior ao corte, nenhum commit, merge,
push ou deploy havia sido executado.

Preflight Sandbox de 2026-07-31: a credencial local autenticou a listagem de webhooks. O
webhook `testeneuro` está habilitado, não interrompido, com 33 eventos e aponta para o
domínio ngrok reservado em `/api/webhooks/asaas`. O pacote oficial `Ngrok.Ngrok` foi
instalado e atualizado do agente `3.3.1` para `3.39.10`; o domínio existente foi reutilizado
sem alterar a configuração Asaas. O CLI imprimiu o authtoken durante o upgrade da
configuração, portanto esse token deve ser rotacionado antes do próximo uso.

O ensaio pós-mudança usou somente a branch Neon CI descartável
`br-sparkling-thunder-acsoydjw`. Cinco Pedidos de teste herdados foram removidos nessa branch
para permitir a migration `0046`; a cadeia completa então foi aplicada com
`db:migrate:e2e`. O handoff público respondeu `200` pelo túnel e criou um Checkout real
Sandbox em estado local `ready`. O formulário hospedado aceitou identificação, endereço e
cartão/Pix, mas o reCAPTCHA reiniciou a jornada nas tentativas headless antes de criar um
Payment. A fonte autoritativa permaneceu com Pedido `pending`, sem `provider_payment_id` e
zero webhooks. A conclusão exige uma interação humana para gerar o Pix; nenhuma cobrança foi
confirmada. Ao encerrar o ensaio, app e ngrok foram parados e a branch descartável foi
excluída. Nenhum ambiente persistente, configuração Asaas, deploy ou Production foi alterado.

A continuação humana gerou o PIX do mesmo Checkout. Como a primeira branch já havia sido
excluída, o estado mínimo do Pedido foi reconstruído somente na branch Neon CI descartável
`br-bitter-morning-ac77jova`. O Sandbox confirmou o pagamento
`pay_osaegxudgt1s8kbb`; `CHECKOUT_PAID` e `PAYMENT_RECEIVED` atravessaram o ngrok com
HTTP `200`, e o worker processou dois eventos sem falha. O Pedido terminou `paid`, com
R$ 250,00 bruto, R$ 248,01 líquido e R$ 1,99 de taxa. Foram criadas exatamente uma
Concessão e uma Matrícula até 2027-07-31, e a repetição do worker não duplicou nenhum
efeito. A entrega de ativação revelou uma incompatibilidade entre a normalização inicial
da Compradora e o Sentinel do Better Auth: Gmail/Googlemail com pontos ou `+tag` não
convergiam. O contrato foi alinhado em `normalizeBuyerEmail`, coberto por regressão, e a
outbox entregou o e-mail pelo Resend (`delivered=1`, `retried=0`). A Compradora confirmou
a criação da senha, o login e a abertura do Curso. A auditoria final encontrou exatamente
uma credencial, uma Concessão ativa e uma Matrícula ativa. Nenhum ambiente persistente,
deploy, Production ou configuração Asaas foi alterado.

No reteste manual seguinte, o app foi reaberto pelo mesmo domínio ngrok contra
Development. A superfície Admin revelou que o código em `0052` estava à frente do
journal desse alvo, ainda em `0043`. Depois de confirmar zero Pedidos, Webhooks e
Concessões financeiras, a promoção de `0044` a `0052` foi autorizada e executada com
`db:migrate:development`. A auditoria confirmou 53 entradas, a consulta administrativa
antes incompatível, um único Admin preservado e uma segunda execução idempotente. O
reteste manual foi aprovado; app e ngrok foram então encerrados. Production permaneceu
inalterada em `0043`, e o webhook Sandbox continua apontando para o domínio reservado
agora offline.

## Como o sistema funciona hoje

### Arquitetura geral

O sistema é um único deploy serverless:

- Entradas HTTP e páginas: `C:\Users\Junior\Documents\0 - Dev\hub\src\app`.
- Capacidades de negócio: `C:\Users\Junior\Documents\0 - Dev\hub\src\features`.
- Autenticação, ambiente e observabilidade: `C:\Users\Junior\Documents\0 - Dev\hub\src\lib`.
- Schema e migrations: `C:\Users\Junior\Documents\0 - Dev\hub\src\db`.
- PostgreSQL é a autoridade persistida.
- Drizzle descreve o schema, enquanto grande parte da lógica usa SQL explícito por meio de `pg`.
- Better Auth administra Contas e credenciais.
- A outbox administra parte das notificações por e-mail.
- Pagamentos produzem Concessões; Concessões recompõem Matrículas.

A documentação canônica está em:

- `C:\Users\Junior\Documents\0 - Dev\hub\README.md`
- `C:\Users\Junior\Documents\0 - Dev\hub\PRODUCT.md`
- `C:\Users\Junior\Documents\0 - Dev\hub\CONTEXT.md`
- `C:\Users\Junior\Documents\0 - Dev\hub\docs\architecture.md`
- `C:\Users\Junior\Documents\0 - Dev\hub\docs\domain\commerce-and-access.md`
- `C:\Users\Junior\Documents\0 - Dev\hub\docs\integrations\abacatepay.md`
- ADR-0004 e ADR-0005, ainda com estado `proposed`.

### 1. Criação de Curso vendável

Fluxo atual:

1. A administração cria um Curso.
2. O preço é convertido para centavos.
3. O Hub cria primeiro um produto remoto no AbacatePay.
4. Somente depois insere o Curso no PostgreSQL.
5. O ID remoto é armazenado em `courses.payment_provider_product_id`.

Implementação principal:

- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\admin\authoring.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\server.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\courses\presentation.ts`

Problemas confirmados:

- Indisponibilidade do gateway impede criar até um Curso em rascunho.
- Se o produto remoto for criado e o insert local falhar, o produto fica órfão.
- Alterações posteriores de preço não sincronizam explicitamente o produto remoto.
- A publicação apresenta uma instrução específica para “Vincular produto AbacatePay”.

No Asaas Checkout, os itens podem ser enviados inline. Portanto, essa vinculação remota deve desaparecer.

### 2. Checkout autenticado

Fluxo atual:

1. A action valida sessão e papel de Aluna.
2. Carrega o Curso ativo.
3. Impede compra quando já há Matrícula ativa.
4. Exige preço positivo e produto remoto.
5. Gera `externalId` no formato `order_UUID`.
6. Cria o checkout AbacatePay com PIX e cartão.
7. Somente depois persiste o Pedido `pending`.
8. Redireciona a Aluna à URL hospedada.

Implementação:

- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\actions.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\server.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\abacatepay.ts`

Risco confirmado: o checkout pode ser criado externamente e o Pedido local falhar. Não há reconciliação ou idempotência externa comprovada para recuperar essa divergência.

### 3. Checkout público

Entrada:

- `POST /api/checkouts/course`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\app\api\checkouts\course\route.ts`

Orquestração:

- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\public-checkout.ts`

Características atuais:

- Recebe Curso por ID ou slug.
- Cria checkout sem `userId`.
- Persiste Pedido com origem `landing`.
- Deixa a identificação da Compradora para o webhook.
- Usa limite de cinco tentativas por IP e Curso a cada dez minutos.

Problemas:

- O rate limit vive em um `Map` na memória do processo. Em ambiente serverless, não é global nem durável.
- Checkout autenticado e público duplicam leitura do Curso, validações, geração do identificador, chamada externa e persistência.
- Erros do provider podem chegar perto demais da resposta pública.
- O Hub não registra localmente a identidade pretendida antes do redirect.

### 4. Retorno e liberação de acesso

As páginas de sucesso consultam `/api/enrollments/access` a cada 2,5 segundos, no máximo 30 vezes. A janela total é de aproximadamente 75 segundos.

Com processamento assíncrono, essa experiência precisa consultar o estado seguro do Pedido, além da Matrícula, para diferenciar:

- pagamento ainda não recebido;
- análise de risco;
- webhook recebido e aguardando processamento;
- Revisão financeira;
- acesso concedido;
- falha recuperável.

### 5. Webhook AbacatePay

Entrada:

- `POST /api/webhooks/abacatepay`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\app\api\webhooks\abacatepay\route.ts`

Validação atual:

- Lê o corpo bruto.
- Aceita segredo em query/header.
- Verifica HMAC por headers compatíveis com mais de uma variante documental.

Processamento atual:

1. Mapeia o evento externo.
2. Abre uma transação.
3. Registra e deduplica `webhook_events`.
4. Resolve Curso e produto.
5. Resolve a Conta por `metadata.userId` ou e-mail.
6. Cria ou altera Conta e Perfil.
7. Compara valor.
8. Atualiza Pedido ou abre Revisão.
9. Cria ou revoga Concessão.
10. Recompõe Matrícula.
11. Registra notificação na outbox ou tenta iniciar recuperação de senha.
12. Só então responde ao gateway.

Falha arquitetural confirmada:

- O primeiro registro de `webhook_events` é inserido dentro da mesma transação dos efeitos de negócio.
- Se um efeito posterior falhar, o rollback remove também o registro do evento.
- O tratamento tenta atualizar o evento para `failed` depois do rollback, mas esse registro pode não existir.
- Assim, a primeira falha pode não ficar durável para retry administrativo.

Outros riscos:

- A requisição externa fica bloqueada durante todo o processamento.
- O payload bruto, contendo PII, não possui política de retenção localizada.
- Eventos desconhecidos são ignorados, mas falta uma política operacional completa para novos enums.
- A vinculação pública trata e-mail de pagamento como identidade verificada.

### 6. Reembolso

Fluxo atual:

1. Admin ou Suporte confirma a senha.
2. Um token temporário, de uso único, é persistido.
3. O Hub cria `refund_requests` e auditoria.
4. Confirma a transação local.
5. Chama `/checkouts/refund` no AbacatePay.
6. Salva o ID externo.
7. Aguarda webhook para confirmar o reembolso e revogar acesso.

Implementação:

- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\refunds.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\actions.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\app\(admin)\admin\financeiro\financial-operations.tsx`

Risco confirmado: se o provider aceitar o reembolso e a gravação local falhar, o código pode marcar a solicitação como `failed`. Uma nova tentativa pode repetir uma operação já aceita externamente.

### 7. Administração e operação

A área financeira:

- mostra Pedidos, Revisões e reembolsos;
- permite aprovar divergência de valor;
- restringe conflitos terminais;
- usa consultas com janelas pequenas, como os últimos 40 Pedidos;
- oferece reembolso apenas entre um subconjunto recente de Pedidos pagos.

Acoplamentos operacionais:

- backlog de webhooks filtra `provider='abacatepay'`;
- observabilidade tipa o provider como `abacatepay`;
- operações usam nomes como `webhook.abacatepay`;
- preflight de desenvolvimento exige credenciais AbacatePay;
- preview proíbe as variáveis atuais;
- não existe worker financeiro independente.

## Mapa do módulo de pagamento

### Componentes e responsabilidades

| Área | Componente atual | Responsabilidade |
|---|---|---|
| Cliente HTTP | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\abacatepay-client.ts` | Bearer auth, serialização, chamadas de produto, checkout e reembolso |
| Contrato externo | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\abacatepay.ts` | Payloads, HMAC, eventos e conversão para estados internos |
| Construção do provider | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\provider.ts` | Instancia o client a partir do ambiente |
| Orquestração financeira | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\server.ts` | Pedido, Conta, Curso, Revisão, webhook, Concessão e notificação |
| Checkout público | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\public-checkout.ts` | Checkout anônimo, Pedido e rate limit |
| Ações protegidas | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\actions.ts` | Checkout autenticado, confirmação e reembolso |
| Reembolso | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\refunds.ts` | Confirmação de senha, reserva, auditoria e chamada externa |
| Webhook HTTP | `C:\Users\Junior\Documents\0 - Dev\hub\src\app\api\webhooks\abacatepay\route.ts` | Validação externa e execução síncrona |
| Checkout HTTP público | `C:\Users\Junior\Documents\0 - Dev\hub\src\app\api\checkouts\course\route.ts` | Entrada pública e resposta com URL |
| Acesso | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\enrollments\server.ts` | Concessão, revogação e recomposição de Matrícula |
| Autoria | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\admin\authoring.ts` | Cria produto remoto antes do Curso |
| Apresentação | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\courses\presentation.ts` | Regras de publicação e mensagens específicas |
| Persistência | `C:\Users\Junior\Documents\0 - Dev\hub\src\db\schema.ts` | Tabelas e enums financeiros |
| Operações | `C:\Users\Junior\Documents\0 - Dev\hub\src\features\operations\server.ts` | Backlog de webhooks |
| Observabilidade | `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\observability.ts` | Providers, operações e sinais |
| Ambiente | `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\env.ts` | Validação de variáveis |
| Preflight | `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\development-environment.ts` | Requisitos para desenvolvimento |
| Produção | `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\production-environment.ts` | Requisitos de deploy |
| Preview | `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\preview-environment.ts` | Proibição de credenciais financeiras |

### Contratos externos atuais

O Hub usa `fetch`, sem SDK AbacatePay instalado:

- `POST /products/create`
- `POST /checkouts/create`
- `POST /checkouts/refund`
- `Authorization: Bearer ...`
- Valores em centavos inteiros.
- Métodos hardcoded: `PIX` e `CARD`.
- Frequência: `ONE_TIME`.

O client não concentra adequadamente:

- timeout;
- retry/backoff;
- classificação de erros;
- resultado ambíguo;
- rate limit;
- telemetria;
- chave de idempotência.

### Persistência financeira

| Estrutura | Uso atual | Mudança esperada |
|---|---|---|
| `courses.payment_provider_product_id` | Produto AbacatePay | Remover; Asaas Checkout usa item inline |
| `orders.provider` | Default `abacatepay` | Manter para auditoria, sem default implícito |
| `orders.provider_order_id` | ID do checkout | Separar checkout, pagamento e cliente |
| `orders.external_id` | Correlação local única | Preservar como referência opaca |
| `webhook_events` | Deduplicação e payload bruto | Tornar inbox durável com tentativas e retenção |
| `payment_reviews` | Divergência e conflito | Preservar e ampliar para eventos anômalos |
| `refund_requests` | Reembolso integral | Preservar, distinguindo solicitado, incerto e confirmado |
| `enrollment_grants.source_type` | `abacatepay_order` ou `manual` | Generalizar para `paid_order` e `manual` |
| `enrollment_grants` | Fonte do direito | Preservar |
| `enrollments` | Projeção do acesso | Preservar |

### Modelo financeiro-alvo

Não é necessário copiar todos os enums Asaas para o domínio. A recomendação é armazenar:

- estado externo bruto para auditoria;
- estado interno normalizado;
- ID do checkout;
- ID do pagamento;
- ID do cliente quando emitido;
- correlação do reembolso pelo `provider_payment_id` do Pedido e pelo
  `refund_requests.id` local;
- evidências reais do reembolso: status, data, `endToEndIdentifier`, comprovante e valor;
- método de pagamento;
- valor bruto em centavos;
- estado de análise de risco;
- estado de confirmação/liquidação;
- estado de reembolso;
- estado de disputa/chargeback;
- datas relevantes;
- referência externa local.

Checkout, pagamento e liquidação devem permanecer conceitos distintos, ainda que sejam armazenados na mesma tabela inicialmente.

### Estados internos atuais

- Pedido: `pending`, `paid`, `refunded`, `disputed`, `cancelled`.
- Webhook: `received`, `processed`, `ignored`, `failed`.
- Revisão: `pending`, `approved`, `rejected`.
- Reembolso: `requested`, `failed`, `confirmed`.
- Concessão: `active`, `expired`, `refunded`, `disputed`, `cancelled`.
- Matrícula: `active`, `expired`, `revoked`.

O estado atual é insuficiente para representar análise de risco, confirmação versus liquidação, chargeback em andamento, refund em andamento e resultado externo incerto.

### Cobertura atual de testes

Existem testes para:

- client HTTP AbacatePay;
- criação de produto, checkout e reembolso;
- HMAC e segredo;
- mapeamento básico de eventos;
- rate limit em memória;
- token de confirmação de reembolso;
- inspeções estáticas de SQL e source type;
- erro seguro de checkout sem provider em E2E.

Não foram encontrados testes comportamentais para:

- webhook completo contra PostgreSQL;
- primeira falha persistida;
- deduplicação concorrente;
- eventos fora de ordem;
- conflito terminal ponta a ponta;
- checkout externo aceito e persistência local falha;
- reembolso aceito e persistência local falha;
- rota de webhook válida e inválida;
- ativação pública;
- fluxo Asaas;
- conciliação;
- polling até acesso.

## Onde o AbacatePay está acoplado

A exploração encontrou referências rastreadas a AbacatePay em 95 caminhos. Parte está em migrations e histórico, mas 33 caminhos correspondem a código ou testes atuais e pelo menos 15 a documentação canônica.

### Adapter e protocolo externo

- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\abacatepay-client.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\abacatepay.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments\provider.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\app\api\webhooks\abacatepay\route.ts`

### Autoria e catálogo

- Produto remoto é obrigatório para criar Curso.
- `courses.payment_provider_product_id` guarda uma identidade AbacatePay.
- A interface de publicação menciona o provider nominalmente.
- Preço e produto podem divergir após edição.

### Domínio de acesso

O provider vaza para um módulo que deveria conhecer apenas direitos de acesso:

- `source_type='abacatepay_order'`;
- `abacatepay_dispute`;
- `abacatepay_refund`;
- filtros SQL específicos;
- mensagens apresentadas à Aluna.

Esse é o principal vazamento de locality: trocar a implementação financeira exige editar Concessão e Matrícula.

### Ambiente e credenciais

Variáveis atuais:

- `ABACATE_PAY_API_KEY`
- `ABACATEPAY_API_KEY`
- `ABACATEPAY_API_BASE_URL`
- `ABACATEPAY_WEBHOOK_SECRET`
- `DEVELOPMENT_ABACATEPAY_DEV_MODE`

Locais afetados:

- `C:\Users\Junior\Documents\0 - Dev\hub\.env.example`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\env.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\development-environment.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\production-environment.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\src\lib\preview-environment.ts`
- `C:\Users\Junior\Documents\0 - Dev\hub\.vscode\mcp.json`

### Administração, observabilidade e operação

- Backlog operacional filtra explicitamente AbacatePay.
- Tipos de observabilidade aceitam `abacatepay`, mas não Asaas.
- Sinais e nomes de operação incluem o provider.
- Documentos e runbooks descrevem credenciais, incidentes e diagnóstico AbacatePay.
- A área financeira não expõe claramente checkout, pagamento, liquidação e evento externo como dimensões separadas.

### Avaliação arquitetural

**Módulos com profundidade útil:**

- O client externo esconde autenticação, serialização e HTTP. Um adapter equivalente deve continuar existindo.
- A orquestração financeira esconde transações, Pedido, Revisão, Conta, Concessão e outbox. Essa profundidade deve ser preservada.

**Módulos ou seams frágeis:**

- `provider.ts` é raso e é contornado pelo fluxo de reembolso.
- A criação de produto é quase um pass-through.
- Checkout público e autenticado duplicam implementação.
- A semântica externa e as regras do domínio estão misturadas.
- O provider aparece dentro do domínio de acesso.
- A identidade pública está escondida dentro do processamento do webhook.

**Recomendação:**

- Aprofundar o módulo de comércio após a normalização do provider.
- Não manter AbacatePay como adapter alternativo.
- Não construir seletor dinâmico de gateways.
- Usar adapter Asaas real e fake contratual nos testes.
- Fazer a rota conhecer apenas autenticação, persistência de evento e resposta HTTP.

## Comparação entre AbacatePay e Asaas

| Dimensão | AbacatePay atual | Asaas | Impacto no Hub |
|---|---|---|---|
| Autenticação | Bearer token | Header `access_token`; `User-Agent` identificável | Novo adapter e novas regras de ambiente |
| Ambientes | Ambiente determinado pela chave | URLs e chaves distintas para sandbox e produção | Preflight deve impedir cruzamento de credenciais |
| Valores | Centavos inteiros | Decimal em reais | Converter somente na fronteira, sem usar float como fonte de verdade |
| Catálogo | Checkout referencia produto remoto | Checkout recebe itens inline | Remover produto remoto e desacoplar Curso |
| Checkout hospedado | PIX, cartão e boleto segundo documentação atual | PIX e cartão | Paridade exata com o código atual do Hub |
| Boleto | Disponível na plataforma, mas não usado pelo Hub | Disponível por cobrança/invoice, não no Checkout | Fora do escopo |
| Parcelamento | Disponível para cartão, não usado | Disponível para cartão | Fora do escopo |
| Assinaturas | Disponíveis, não usadas | Disponíveis, com cobranças próprias | Fora do escopo |
| Cliente | Checkout atual entrega dados do pagador no webhook | Cobrança direta exige customer; Checkout aceita dados inline | Hub deve ser autoridade da identidade pretendida |
| Estado pago | Modelo mais compacto | `CONFIRMED` e `RECEIVED` são diferentes | Política por método obrigatória |
| Webhook | Segredo + HMAC documentado, com divergências de headers | Token em `asaas-access-token` e allowlist; HMAC não documentado | Persistência durável, token forte e restrição de IP |
| Retry | Progressivo, sem limites claros nas páginas consultadas | Timeout de 10 s, retry progressivo, pausa após 15 falhas, retenção de 14 dias | Responder `200` rapidamente e alertar fila |
| Idempotência | Reembolso integral documenta repetição idempotente por ID | `externalReference` não possui garantia documentada de unicidade/idempotência | Idempotência e resultado incerto precisam ser locais |
| Reembolso | Checkout integral para PIX/cartão | Integral ou parcial conforme método; boleto tem fluxo separado | Hub manterá apenas integral |
| Chargeback | Modelo atual mapeia disputa de forma simples | Eventos específicos de chargeback e disputa | Ampliar matriz e precedência |
| Conciliação | Checkout/status/saldos | Pagamentos, webhooks e extrato financeiro | Melhor reparo, mas com rate limits |
| Limites | HTTP 429, sem quota global pública localizada | 25.000 requisições por 12 h e 50 GET concorrentes | Webhook como fluxo normal; consulta apenas para reparo |
| Sandbox | Dev Mode próprio | Sandbox isolado e parcialmente simulado | Homologação deve incluir smoke controlado em produção |

Fontes oficiais:

- [Autenticação Asaas](https://docs.asaas.com/docs/autenticação)
- [Checkout Asaas](https://docs.asaas.com/docs/checkout-asaas)
- [Criar cobrança Asaas](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Webhooks de cobrança Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Recebimento de webhooks Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook)
- [Rate e quota Asaas](https://docs.asaas.com/reference/rate-e-quota-limit)
- [Reembolso Asaas](https://docs.asaas.com/reference/estornar-cobranca)
- [Checkout AbacatePay](https://docs.abacatepay.com/pages/payment/create)
- [Segurança de webhooks AbacatePay](https://docs.abacatepay.com/pages/webhooks/security)
- [Reembolso AbacatePay](https://docs.abacatepay.com/pages/payment/refund)

### Impactos por camada

**Domínio**

- Separar checkout, cobrança, risco, confirmação, liquidação, reembolso e disputa.
- Preservar Pedido como contrato de venda.
- Preservar Concessão como fonte do direito.
- Remover o provider do vocabulário de acesso.

**Banco**

- Remover produto remoto do Curso.
- Persistir IDs externos distintos.
- Transformar `webhook_events` em inbox operacional durável.
- Generalizar origem de Concessão.
- Não executar backfill nem migração de dados AbacatePay.

**Backend**

- Substituir o client.
- Criar Pedido antes do efeito externo.
- Centralizar checkout público e autenticado.
- Separar ingresso e processamento de webhook.
- Implementar resultado externo incerto e conciliação.

**Frontend**

- Capturar identidade antes do checkout público.
- Ajustar callbacks e mensagens.
- Exibir análise, processamento e Revisão sem prometer acesso imediato.
- Melhorar busca e acompanhamento financeiro no admin.

**Operação e suporte**

- Monitorar fila Asaas, eventos falhos, Pedidos sem pagamento correlacionado, reembolsos incertos e Revisões.
- Diferenciar valor bruto, valor líquido e tarifas.
- Documentar como pausar vendas sem interromper webhooks.
- Usar API e extrato apenas para reconciliação.

## Riscos, premissas e dúvidas em aberto

### Riscos confirmados no estado incremental

As etapas concluídas já mitigaram rollback da primeira falha de webhook, criação externa
antes do Pedido, dependência de produto remoto para Curso, rate limit apenas em memória,
ausência de retenção técnica e falta de decisões ratificadas. Permanecem:

1. **Alto:** processor, worker e agenda Asaas existem e as migrations passaram em banco
   descartável, mas nenhum ambiente persistente recebeu DDL ou deploy; a fila permanece
   pausada.
2. **Alto:** reserva, checkout, `CHECKOUT_CREATED`, pagamento PIX, resultado financeiro e
   entrega de acesso foram provados no Sandbox; a nova jornada de cartão e seu
   parcelamento ainda dependem de homologação.
3. **Médio:** factory, parser, delivery e enfileiramento de ativação passaram no
   PostgreSQL descartável, no E2E local e em uma compra PIX Sandbox; o Resend aceitou o
   e-mail real, criação da senha, login e abertura do Curso.
4. **Médio:** checkout e conciliação preservam resultado incerto e precedência sem retry
   cego; a correlação real entre Checkout, pagamento PIX e eventos foi comprovada, mas
   cartão e eventos de risco permanecem pendentes.
5. **Médio:** a página de sucesso possui uma janela finita de espera e pode terminar antes
   de fluxos financeiros assíncronos; o estado durável, não a tela, continua autoritativo.
6. **Médio:** as provas unitária, transacional e E2E passaram, mas não substituem os
   cenários financeiros e diferenças conhecidas do sandbox.
7. **Médio:** credenciais e webhook Sandbox foram configurados e validados por túnel
   temporário; credenciais, allowlist e comportamento de produção pertencem ao corte e
   ainda não foram validados.

### Riscos específicos da migração

- Um checkout Asaas pode ser criado e a resposta se perder. Repetir cegamente pode duplicá-lo.
- A documentação não garante idempotência de `externalReference`.
- É necessário provar como Checkout, pagamento e `externalReference` aparecem juntos nos eventos reais.
- Eventos financeiros não relacionados ao Hub também podem chegar pelo webhook da conta.
- O Asaas não documenta HMAC de corpo. Segurança dependerá de TLS, token forte, allowlist e correlação rigorosa.
- Eventos podem chegar duplicados ou fora de ordem.
- Uma fila sequencial pode ser bloqueada por um único evento problemático.
- Converter centavos para decimal com `number` binário pode introduzir divergência.
- Sandbox não reproduz todo o comportamento de produção.
- Novos enums Asaas podem surgir; parsers fechados não podem derrubar a fila.
- Um rollback após o primeiro pagamento real Asaas não pode simplesmente restaurar o AbacatePay.

### Premissas ratificadas

- Dados AbacatePay atuais são de teste e descartáveis.
- Não haverá migração de dados financeiros.
- Não haverá dual gateway.
- Não haverá migração gradual.
- Não haverá tratamento de pedidos legados.
- Checkout hospedado com PIX e cartão é suficiente.
- O Hub continua armazenando valores em centavos.
- O Asaas é autoridade do estado externo; o Hub é autoridade do Pedido, acesso e identidade pretendida.
- Eventos adversos não podem ser revertidos automaticamente por evento pago tardio.
- Eventos desconhecidos ou contraditórios não quebram a fila; abrem alerta ou Revisão.
- Curso pago custa no mínimo `1000` centavos, equivalentes a R$ 10; autoria e checkout
  validam o limite, e dados de teste abaixo dele são ajustados ou removidos.
- DEC-DISC-001: a intenção durável de ativação guarda somente `userId` e `orderId`, sem
  outros dados pessoais ou token; no processamento, o worker resolve a Conta e chama Better Auth
  `requestPasswordReset`; o token nasce apenas no envio e falha mantém retry.

Essa política está implementada de forma incremental: identidade local, factory, parser,
delivery e enfileiramento de `auth.account-activation` existem, com payload sem PII e
idempotência de e-mail. Ativação legada AbacatePay e recuperação pública de senha
continuam fora da outbox.

### Validações externas confirmadas

Evidência operacional fornecida pelo controlador em 2026-07-28:

- `GET /v3/myAccount/status/` no sandbox retornou `commercialInfo`,
  `bankAccountInfo`, `documentation` e `general` como `APPROVED`;
- `GET /v3/pix/addressKeys?status=ACTIVE` retornou uma chave Pix ativa;
- o webhook já cadastrado retornou `enabled=false`, `interrupted=true`,
  `sendType=SEQUENTIALLY` e `hasAuthToken=true`; sua seleção não inclui eventos
  `CHECKOUT`.
- um probe de R$ 1 retornou `invalid_object` por estar abaixo do mínimo de R$ 10; outro
  probe de R$ 10 sem `imageBase64` criou checkout `ACTIVE`, cancelado em seguida com
  estado `CANCELED`.

Essa era a configuração inicial. Em 2026-07-29, após a rota durável existir, o mesmo
webhook Sandbox foi corrigido para `NON_SEQUENTIALLY`, passou a incluir os 33 eventos
necessários e foi apontado a um túnel temporário. Duas entregas reais
`CHECKOUT_CREATED` retornaram `200`, foram deduplicadas, correlacionadas e processadas na
branch Neon descartável. A evidência não valida credencial de produção, token forte
dedicado nem allowlist de produção.

O checkout criado pelo probe de R$ 10 foi cancelado, e nenhum ID, URL ou conteúdo da
chave Pix é registrado. O OpenAPI marca `imageBase64` como obrigatória, mas o guia não
estabelece essa exigência e o sandbox aceitou sua ausência. O adapter inicial omitirá a
imagem.

### Pendências de validação externa

1. Confirmar no sandbox como o ID do Checkout se relaciona ao ID do pagamento.
2. Confirmar se `externalReference` é propagado em todos os eventos necessários.
3. Confirmar em produção que a omissão de `imageBase64` continua aceita e monitorar
   breaking changes na divergência entre OpenAPI, guia e comportamento observado.
4. Confirmar se a conta Asaas de produção está verificada e apta a receber PIX/cartão.
5. Criar chave de API com menor privilégio compatível.
6. Criar token de webhook forte e registrar allowlist de IPs oficiais.
7. Confirmar formalmente se existe mecanismo de assinatura além do token.
8. Ratificar juridicamente a retenção e o acesso aos payloads com PII; a retenção técnica
   de 30 dias com sanitização posterior já está implementada.
9. Definir configuração de fila não sequencial e serialização local por Pedido.
10. Definir como pesquisar um checkout após timeout de resultado incerto.
11. Confirmar tarifas e campos financeiros que o suporte precisa visualizar.

## Plano de migração por etapas

### Etapa 0: diagnóstico e decisões de escopo

- **Objetivo:** estabelecer o estado atual e impedir que decisões críticas fiquem escondidas na implementação.
- **O que analisar ou preparar:** arquitetura, fluxos, schema, documentação, eventos, riscos, testes e capacidades dos providers.
- **Componentes/arquivos/áreas impactadas:** todo o módulo financeiro, acesso, autoria, admin, ambiente e documentação canônica.
- **Dependências:** acesso de leitura ao repositório e documentação oficial.
- **Riscos:** o diagnóstico ficar desatualizado antes da execução.
- **Validação:** revisão no commit `d64fc66bdf04`, pesquisa oficial e decisões registradas neste documento.
- **Responsável sugerido:** Tech Lead com Produto/Financeiro.
- **Status:** Concluído.

### Etapa 1: ratificar contratos e confirmar prontidão sandbox

- **Objetivo:** transformar decisões em contratos aceitos e registrar a prontidão
  cadastral e os probes não financeiros do sandbox.
- **O que analisar ou preparar:**
  - ratificar ADR-0004 e ADR-0005;
  - fechar DEC-DISC-002, DEC-DISC-003, DEC-DISC-007 e DEC-DISC-010;
  - aprovar a matriz evento, estado e efeito;
  - aprovar preço mínimo de `1000` centavos na autoria e no checkout;
  - validar cadastro sandbox e chave Pix;
  - registrar os probes de preço mínimo, imagem opcional e cancelamento;
  - manter o webhook existente desabilitado e sem ativação antecipada;
  - registrar checklist de breaking changes.
- **Componentes/arquivos/áreas impactadas:** `C:\Users\Junior\Documents\0 - Dev\hub\docs\decisions.md`, ADRs, integração e runbooks.
- **Dependências:** Produto, Financeiro e acesso de leitura ao sandbox Asaas.
- **Riscos:** confundir prontidão cadastral com checkout PIX E2E ou ativar webhook antes
  da rota durável.
- **Validação:** decisões registradas; cadastro sandbox aprovado; chave Pix ativa; probes
  documentados e checkout criado pelo probe cancelado.
- **Responsável sugerido:** Tech Lead; apoio de Produto/Financeiro e Plataforma.
- **Status:** Concluído.

### Etapa 2: definir e aprofundar a arquitetura financeira

- **Objetivo:** posicionar a seam correta entre o Asaas e o domínio.
- **O que analisar ou preparar:**
  - módulo de comércio responsável por Pedido, Revisão, reembolso e efeitos de acesso;
  - adapter Asaas responsável apenas pelo true external;
  - comandos e resultados neutros para Concessão;
  - implementação interna compartilhada entre checkout público e autenticado;
  - rota de webhook fina;
  - fake contratual de testes;
  - regra de dependências para impedir imports Asaas fora do adapter/ingresso.
- **Componentes/arquivos/áreas impactadas:** `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments`, `C:\Users\Junior\Documents\0 - Dev\hub\src\features\enrollments`, rotas e testes.
- **Dependências:** Etapa 1.
- **Riscos:** criar abstração genérica demais ou mover complexidade sem aumentar locality.
- **Validação:** deletion test; remover o adapter deve expor apenas complexidade externa, e remover nomes Asaas do acesso deve reduzir complexidade sem duplicá-la.
- **Responsável sugerido:** Tech Lead/Backend.
- **Status:** Concluído.

### Etapa 3: desenhar schema e limpeza dos dados de teste

- **Objetivo:** suportar o ciclo Asaas sem carregar estruturas AbacatePay.
- **O que analisar ou preparar:**
  - remover `courses.payment_provider_product_id`;
  - remover defaults AbacatePay;
  - generalizar `abacatepay_order` para `paid_order`;
  - separar IDs de checkout, pagamento, cliente e reembolso;
  - armazenar estado externo bruto e estado interno normalizado;
  - registrar tentativas, erros e próxima execução de webhook;
  - definir retenção de payload;
  - definir índices únicos e locks por Pedido;
  - preparar remoção seletiva e em ordem de FK dos dados financeiros de teste;
  - ajustar ou remover Cursos pagos de teste abaixo de `1000` centavos;
  - recompor Matrículas afetadas sem apagar Concessões manuais.
- **Componentes/arquivos/áreas impactadas:** `C:\Users\Junior\Documents\0 - Dev\hub\src\db\schema.ts`, migrations, scripts de verificação e tabelas financeiras.
- **Dependências:** matriz financeira da Etapa 1 e arquitetura da Etapa 2.
- **Riscos:** apagar Concessões manuais, Cursos ou Contas que não fazem parte dos testes; enum incompatível; migration não reversível.
- **Validação:** dry-run com contagens; revisão das FKs; `bun run db:migrations:check`; banco vazio; seed; `bun run db:smoke:empty`.
- **Responsável sugerido:** Backend responsável por dados; revisão do Tech Lead.
- **Status:** Concluído.

Não haverá transformação, backfill ou importação de dados AbacatePay. Haverá apenas DDL e remoção controlada dos registros de teste.

Contrato de persistência aprovado e implementado no schema:

- `orders.status` permanece canônico em
  `pending | paid | refunded | disputed | cancelled`;
- checkout, pagamento, cliente, risco, liquidação, reembolso e disputa têm IDs ou estados
  externos separados;
- checkout e inbox registram tentativas, erro, próxima execução e locks necessários;
- payload bruto da inbox expira em 30 dias e será sanitizado depois desse prazo,
  preservando metadados operacionais;
- `paid_order` substitui a origem vinculada ao gateway no domínio de acesso;
- `refund_requests` continua sendo a dimensão do reembolso. O Asaas não fornece um ID
  próprio de estorno: a correlação usa `provider_payment_id` do Pedido e o
  `refund_requests.id` local;
- a evidência real devolvida pelo provider fica em status, data de criação, EndToEnd ID,
  URL de comprovante e valor reembolsado, sem inventar `provider_refund_id`.

O schema e as migrations `0044_asaas_commerce_persistence` a
`0051_asaas_financial_statement` foram gerados. Checkout, webhook, reembolso e
conciliação Asaas já usam o contrato novo; o reembolso não escreve
`provider_refund_id` nem depende da coluna de produto remoto removida. A cadeia foi
primeiro aplicada e auditada em branch descartável removida depois da Etapa 9. Em
2026-07-31, após autorização explícita e auditoria das pré-condições vazias, Development
recebeu `0044` a `0052` e chegou a 53 entradas no journal; Production permanece em
`0043`. A limpeza dos dados de teste de Production e sua aplicação controlada continuam
pendentes.

### Etapa 4: implementar o adapter Asaas

- **Objetivo:** encapsular toda a comunicação externa.
- **O que analisar ou preparar:**
  - autenticação `access_token`;
  - `User-Agent` estável;
  - URLs distintas por ambiente;
  - timeout com `AbortSignal`;
  - conversão exata centavos para decimal;
  - parsing seguro de sucesso e erro;
  - classificação de 4xx, 429, 5xx, timeout e resultado incerto;
  - telemetria sem segredos;
  - criação de checkout hospedado;
  - reembolso integral;
  - consulta por ID para reconciliação;
  - validação e mapeamento de webhooks;
  - enums desconhecidos como dados, não exceções fatais.
- **Componentes/arquivos/áreas impactadas:** novo adapter sob `C:\Users\Junior\Documents\0 - Dev\hub\src\features\payments`, testes de contrato e ambiente.
- **Dependências:** Etapas 1 a 3.
- **Riscos:** repetir operação após timeout; erro monetário; expor token; assumir enum incompleto.
- **Validação:** testes de contrato HTTP, snapshots de payload, 429, timeout, resposta inválida, centavos e eventos desconhecidos.
- **Responsável sugerido:** Backend.
- **Status:** Concluído.

O adapter estreito, o parser estrutural de envelopes e o fake contratual estão
implementados e cobertos por testes locais. O adapter está conectado ao checkout
autenticado e público da aplicação. A rota de webhook e o reembolso administrativo ainda
pertencem às Etapas 6 e 8. As revisões independentes de especificação e qualidade do
adapter foram aprovadas.

### Etapa 5: migrar autoria e checkout

- **Objetivo:** criar Pedidos localmente antes do efeito externo e eliminar produto remoto.
- **O que analisar ou preparar:**
  - permitir criar e editar Curso sem gateway;
  - remover requisito de produto na publicação;
  - gerar item inline a partir do snapshot do Pedido;
  - validar preço mínimo de `1000` centavos na autoria e novamente no checkout;
  - persistir Pedido antes do checkout;
  - representar criação em andamento e resultado incerto;
  - checkout autenticado usa `userId` imutável da sessão;
  - checkout público nasce sem PII e resolve nome/e-mail do cliente Asaas somente após
    evento financeiro autoritativo;
  - não alterar Conta com dados Asaas;
  - usar implementação interna compartilhada;
  - substituir rate limit em memória por mecanismo coordenado;
  - callbacks de sucesso, cancelamento e expiração;
  - mensagens seguras para falhas do provider.
- **Componentes/arquivos/áreas impactadas:** autoria, ações, checkout público, rotas, páginas de sucesso, apresentação do Curso e schema.
- **Dependências:** adapter e schema.
- **Riscos:** checkout externo órfão; duplicidade por clique/retry; experiência pública
  mais longa; produção ou breaking change passar a exigir `imageBase64`.
- **Validação:** Curso criado com Asaas indisponível; clique duplicado produz um Pedido; checkout autenticado/público; retorno cancelado/expirado; falha externa não perde a intenção local.
- **Responsável sugerido:** Backend com Frontend.
- **Status:** Concluído. A autoria usa somente
  preço local e rejeita Curso pago abaixo de `1000` centavos. O núcleo compartilhado
  persiste Pedido e snapshots antes da mutação externa, deduplica a tentativa UUID e
  representa rejeição ou resultado incerto. As entradas autenticada e pública agora usam
  esse núcleo e o adapter Asaas; a identidade autenticada vem exclusivamente da sessão e a
  pública é capturada localmente sem criar ou alterar Conta. O limite público coordenado
  permite cinco novas intenções por dez minutos usando HMAC de IP e Curso canônico, sem
  persistir IP, e a duplicata da mesma tentativa não o consome. Callbacks absolutos cobrem
  sucesso, cancelamento e expiração sem afirmar pagamento antes do evento financeiro.
  E-mail e nome locais são validados antes de DB/provider; erros esperados são tipados e
  falha inesperada retorna `503` genérico. Development e Production aceitam somente as
  origens oficiais sandbox e produção do Asaas, respectivamente, enquanto Preview proíbe
  credenciais do provider. As
  migrations `0046`, `0047` e `0048_asaas_public_checkout_rate_limit` foram geradas, mas não
  aplicadas. A implementação duplicada de checkout AbacatePay foi removida; cliente,
  webhook e reembolso legados permanecem até suas etapas próprias. As revisões
  independentes de especificação e qualidade foram aprovadas. Rejeições anteriores ao
  provider removem somente a reserva inequivocamente pré-provider; reservas abandonadas
  nessa condição são removidas pela manutenção após 15 minutos.

### Etapa 6: criar inbox e processamento durável de webhooks

- **Objetivo:** responder rapidamente sem perder efeitos financeiros.
- **O que analisar ou preparar:**
  - rota `/api/webhooks/asaas`;
  - validação do token e estrutura mínima;
  - deduplicação por ID do evento;
  - persistência antes do HTTP `200`;
  - resposta exatamente `200`;
  - evento inválido ou não autenticado rejeitado;
  - executor separado com tentativas e backoff;
  - lock por evento/Pedido;
  - retry administrativo;
  - reconciliação para eventos esgotados;
  - desconhecidos persistidos e ignorados com alerta;
  - política de retenção/PII;
  - fila Asaas não sequencial, com ordenação resolvida pela matriz interna.
- **Componentes/arquivos/áreas impactadas:** rota Asaas, `webhook_events`, executor/job, operações, observabilidade e runbooks.
- **Dependências:** Etapas 2 a 4.
- **Riscos:** responder `200` antes da persistência; duplicar efeitos; worker não ser executado; fila Asaas pausada.
- **Validação:** primeiro erro permanece durável; duplicata retorna `200`; concorrência produz um efeito; banco indisponível não retorna sucesso; p95 do ingresso bem abaixo de 10 segundos.
- **Responsável sugerido:** Backend/Plataforma.
- **Status:** Concluído em código. Inbox durável, autenticação exclusiva por header, limite de
  corpo, deduplicação persist-before-200, sanitização após 30 dias e infraestrutura
  genérica de claim/retry/conclusão foram implementados. Retry administrativo possui
  serviço transacional com motivo e auditoria; action/UI ficam para a Etapa 8. O worker
  exige processor injetado e oferece contrato transacional de row lock por Pedido.
  `/api/cron/asaas-webhooks` injeta o processor real a cada minuto UTC, sob
  `CRON_SECRET`, kill switch, lease de seis minutos e deadline de 270 segundos.
  Migration `0049` e anteriores não foram aplicadas; o teste PostgreSQL real permanece
  pendente para a Etapa 9/ambiente por ausência local de
  `CERTIFICATE_CONCURRENCY_DATABASE_URL`. Deploy e homologação não foram executados.

### Etapa 7: aplicar ciclo financeiro, identidade e acesso

- **Objetivo:** normalizar eventos Asaas e produzir efeitos determinísticos.
- **O que analisar ou preparar:**
  - matriz completa de precedência;
  - PIX libera em `PAYMENT_RECEIVED`;
  - cartão libera em `PAYMENT_CONFIRMED`;
  - risco `AWAITING_RISK_ANALYSIS` ou `REPROVED_BY_RISK_ANALYSIS` não libera;
  - `PAYMENT_APPROVED_BY_RISK_ANALYSIS` posterior pode destravar confirmação armazenada;
  - `CHECKOUT_PAID` não libera;
  - comparar `value` bruto com snapshot em centavos;
  - divergência abre Revisão;
  - reembolso, disputa e chargeback revogam;
  - evento pago tardio não reativa estado adverso;
  - cancelamento tardio não revoga pagamento;
  - vinculação pública por e-mail local normalizado;
  - Conta nova não nasce como verificada pelo provider;
  - ativação via outbox durável;
  - Concessão com source neutro;
  - Matrícula permanece projeção.
- **Componentes/arquivos/áreas impactadas:** comércio, acesso, identidade, outbox, payment reviews, admin.
- **Dependências:** inbox, schema e decisões ratificadas.
- **Riscos:** acesso duplicado, acesso prematuro, revogação incorreta, takeover de Conta e conflito fora de ordem.
- **Validação:** testes por método, valor, ordem de eventos, identidade existente/nova e efeito único sobre Concessão.
- **Responsável sugerido:** Backend de domínio; revisão de Produto e Segurança.
- **Status:** Concluída em código. Matriz, processor transacional, correlação exata, persistência
  de Revisão idempotente, identidade local, Concessão/revogação, projeção de Matrícula e
  outbox de ativação/acesso e schedule do worker foram implementados e passaram pelos
  gates locais. As migrations `0044` a `0051` e o worker passaram em PostgreSQL
  descartável, sem promoção para branch persistente. Deploy e homologação financeira
  pertencem às etapas de ambiente e validação seguintes.

### Etapa 8: migrar reembolso, administração, conciliação e observabilidade

- **Objetivo:** tornar o ciclo operável por Financeiro e Suporte.
- **O que analisar ou preparar:**
  - manter confirmação recente de senha;
  - reservar intenção antes da chamada externa;
  - resultado ambíguo permanece `requested/reconciling`, não `failed`;
  - correlacionar pelo ID do pagamento e pelo ID local da solicitação, pois o Asaas não
    devolve ID próprio de estorno;
  - persistir status, data de criação, EndToEnd ID, URL de comprovante e valor
    reembolsado quando devolvidos;
  - confirmar revogação por evento financeiro;
  - oferecer somente reembolso integral;
  - registrar que tarifas podem não ser devolvidas;
  - ampliar busca/paginação de Pedidos;
  - mostrar checkout, pagamento, método, gross, net, taxas e estado;
  - criar reconciliação por pagamento e extrato;
  - alertas para fila, eventos falhos, Checkouts incertos, Pedidos sem correlação e
    reembolsos incertos;
  - remover strings operacionais AbacatePay.
- **Componentes/arquivos/áreas impactadas:** refunds, actions, admin financeiro, operations, observability e outbox.
- **Dependências:** Etapas 4, 6 e 7.
- **Riscos:** reembolso duplicado; estado local falso; suporte sem visibilidade; excesso de polling e 429.
- **Validação:** sucesso, falha definitiva e resultado incerto; retry não duplica; auditoria completa; reconciliação corrige somente o Pedido alvo.
- **Responsável sugerido:** Backend com Financeiro/Suporte e Plataforma.
- **Status:** Concluída em código. O reembolso integral Asaas reserva intenção antes da
  mutação, mantém confirmação recente de senha, não inventa ID externo e diferencia
  rejeição definitiva de resultado incerto sem retry cego. Evidências reais são
  persistidas pela resposta e pelo webhook; `dateCreated` permanece texto exato porque
  o provider não publica fuso. O painel financeiro ganhou busca paginada, IDs de
  checkout/pagamento, método, bruto, líquido, tarifa, estados e ações de conciliação.
  A conciliação por pagamento exige IDs convergentes e altera somente o Pedido
  bloqueado; ela e a importação de extrato exigem `manageFinancialOperations`, exclusiva
  de Admin. O extrato por período fechado é paginado e deduplicado em
  `asaas_financial_transactions`, sem inventar correlação entre movimento e pagamento.
  A resposta do reembolso exige pagamento exato, evidência integral, nenhum
  identificador conflitante e `externalReference` ou sessão de Checkout exata. Alertas
  operacionais agora cobrem fila/falhas Asaas, Checkouts incertos, Pedidos pagos sem
  correlação e reembolsos incertos. As migrations `0044` a `0051` não foram aplicadas;
  PostgreSQL real, sandbox, deploy e homologação pertencem às etapas seguintes.

### Etapa 9: homologar ponta a ponta

- **Objetivo:** provar o fluxo antes de abrir vendas.
- **O que analisar ou preparar:**
  - suíte unitária, contrato, integração e E2E;
  - sandbox PIX e cartão;
  - eventos duplicados e fora de ordem;
  - expiração, cancelamento, risco, refund, dispute e chargeback quando simuláveis;
  - callbacks e polling;
  - observabilidade e retry;
  - teste de fila pausada;
  - diferenças conhecidas do sandbox.
- **Componentes/arquivos/áreas impactadas:** testes Vitest, Playwright, sandbox, runbooks e monitoramento.
- **Dependências:** todas as etapas de implementação.
- **Riscos:** falso positivo do sandbox; teste criar registro financeiro simulado;
  webhook sandbox configurado na conta errada.
- **Validação:** todos os gates sandbox da seção seguinte aprovados e evidência anexada
  ao release. A Etapa 9 termina no sandbox; nenhuma compra, reembolso ou validação de fila
  em produção ocorre aqui.
- **Responsável sugerido:** QA/Backend com Financeiro e Plataforma.
- **Status:** Concluído. Os gates sem provider passaram em 2026-07-29:
  1.031 testes unitários/contrato em 197 arquivos, build de produção e Knip. A auditoria
  corrente sinaliza duas vulnerabilidades transitivas no CLI `shadcn` de Development,
  ainda sem atualização compatível publicada; migrations `0044` a `0051` aplicadas e auditadas na branch Neon
  descartável `br-autumn-mouse-ac9ti4dr`; 20 testes PostgreSQL reais e 19 jornadas
  Chromium aprovados. O ensaio confirmou a pré-condição do corte: os Pedidos e webhooks
  AbacatePay de teste precisam ser removidos antes de `0046`, que adiciona snapshots
  `NOT NULL` sem backfill legado.

  Em 2026-07-29, as quatro variáveis Sandbox foram configuradas no `.env.local` ignorado
  do worktree e a autenticação de leitura do Asaas respondeu HTTP `200`. A branch Neon
  descartável `br-sparkling-truth-acx2m6pf` foi criada sem Pedidos legados, recebeu e
  passou a auditoria das migrations `0044` a `0051`. Um Curso fictício de R$ 10 foi
  criado somente nessa branch. Ao final, o worktree voltou ao banco normal de
  Development; a solicitação de remoção da branch temporária foi enviada, mas o
  connector Neon retornou `UNAVAILABLE` e não confirmou a operação.

  O webhook Sandbox único `testeneuro` deixou de apontar ao Preview protegido da Vercel,
  passou a usar a rota temporária ngrok `/api/webhooks/asaas` e foi corrigido de
  `SEQUENTIALLY` para `NON_SEQUENTIALLY`. Pelo endpoint público, token ausente retornou
  `401`, a primeira entrega sintética retornou `200`, a duplicata retornou `200` e o
  PostgreSQL preservou exatamente uma entrada.

  O launcher de Development passou a preservar chaves Asaas iniciadas por `$` e a
  preparar o ambiente antes de o Next reler `.env.local`; o formato canônico local é
  `ASAAS_API_KEY=\$...`. Testes cobrem tanto o subprocesso público quanto a fronteira do
  Next. A homologação também revelou e corrigiu casts ausentes em dois SQLs PostgreSQL:
  rate limit público e correlação do processor de webhook.

  Sessões reais de checkout Sandbox foram criadas pelo endpoint público do Hub com HTTP
  `200`, estado `ready` e URL hospedada do Asaas. O contrato real usa
  `minutesToExpire`; `customerData` com apenas nome/e-mail retornou `invalid_object`
  exigindo `cpfCnpj`, então o adapter passou a omitir o objeto conforme a decisão de não
  coletar nem inventar CPF. Eventos `CHECKOUT_CREATED` originados pelo Asaas atravessaram
  o túnel, foram correlacionados aos Pedidos e terminaram `processed`; o evento futuro
  sintético terminou `ignored`. A fila Sandbox foi pausada preservando `enabled=true`,
  envio `NON_SEQUENTIALLY`, token e 33 eventos e entregou os eventos acumulados ao ser
  reativada.

  O ensaio manual concluiu PIX em `PAYMENT_RECEIVED` e cartão em
  `PAYMENT_CONFIRMED`. Cada compra criou exatamente uma Concessão e uma Matrícula ativa.
  A primeira tentativa revelou que o Curso fictício não possuía a publicação vigente
  exigida pelo domínio; depois de completar somente a fixture descartável, o retry
  durável processou os dois eventos na quarta tentativa. O cancelamento de Checkout
  também atravessou a rota e encerrou o Pedido pendente sem conceder acesso.

  O reembolso integral do cartão passou pela confirmação de senha e reserva local. A
  chamada externa ficou `uncertain` e não foi repetida; o webhook
  `PAYMENT_REFUNDED` confirmou a operação, o valor integral e a solicitação, alterou o
  Pedido e a Concessão para `refunded` e recompôs a Matrícula como `revoked`. A consulta
  real mostrou que o `Payment` criado por Checkout conserva `checkoutSession`, mas omite
  `externalReference`. A conciliação passou a aceitar essa omissão somente quando os IDs
  de pagamento e sessão forem exatos e continuou rejeitando qualquer identificador
  conflitante; depois disso, a consulta Sandbox foi concluída.

  Um `PAYMENT_CONFIRMED` sintético tardio foi entregue duas vezes depois do reembolso.
  A inbox preservou uma entrada, o worker abriu uma única Revisão `terminal_conflict` e
  não reativou Pedido, Concessão ou Matrícula. O launcher passou a preservar os overrides
  isolados do Playwright, e setup, servidor e teardown E2E agora compartilham a mesma
  origem loopback. As 19 jornadas Chromium passaram; uma repetição diagnóstica ocorreu
  na jornada de avanço de Aula e permanece sinalizada como flakiness.

  A expiração real também foi concluída. A primeira entrega `CHECKOUT_EXPIRED` encontrou
  a aplicação desligada e recebeu `502`; o Asaas repetiu a entrega duas vezes, alcançou
  `200` depois da recuperação da rota e a inbox preservou um evento. O worker processou
  a entrada uma vez, encerrou o Pedido como `cancelled/expired` e não criou Conta,
  Concessão ou Matrícula. O webhook Sandbox foi pausado ao final, preservando
  `enabled=true`, token, envio `NON_SEQUENTIALLY` e 33 eventos.

  A compra real de cartão observada não emitiu eventos de análise de risco, portanto
  esse ramo não foi simulável no Sandbox. A matriz de risco permanece coberta pelos
  testes de contrato e processor; a ausência do evento real está registrada como
  limitação do ambiente, não como comportamento garantido do provider.

  Em 2026-07-31, o novo handoff público também concluiu uma compra PIX real ponta a
  ponta: Checkout hospedado, `CHECKOUT_PAID`, `PAYMENT_RECEIVED`, resultado financeiro,
  Conta sem credencial, ativação via Resend, criação de senha, login e abertura do Curso.
  O ensaio revelou e corrigiu a divergência de identidade entre Compradora e a
  normalização de e-mail do Sentinel. A auditoria final encontrou um Pedido `paid`, uma
  credencial, uma Concessão ativa e uma Matrícula ativa, sem duplicação após retry. App,
  ngrok e branch Neon descartável foram removidos; nenhum deploy ou ambiente persistente
  foi alterado. O webhook Sandbox `testeneuro` permaneceu habilitado e apontando para o
  domínio ngrok reservado, agora offline, até decisão operacional explícita.

  O fechamento local repetiu `verify:quick` com migrations, typecheck, Ultracite e
  1.314 testes em 214 arquivos; o build Next.js de produção e o Knip também passaram.
  Durante esse gate, o Knip revelou que carregar `playwright.config.ts` sem
  `E2E_DATABASE_URL` emitia erro sem status diferente de zero. O perfil de verificação
  agora fornece ao Knip apenas URLs PostgreSQL sintéticas sob host `.invalid`, cobertas
  por teste, sem conexão ou credencial real.

  `db:smoke:empty` também não roda neste host porque não há PostgreSQL local; sua guarda
  recusa corretamente usar Neon ou outro banco remoto. Nenhum ambiente de produção foi
  acionado.

### Etapa 10: executar o corte direto

- **Objetivo:** desligar AbacatePay e abrir Asaas sem coexistência.
- **O que analisar ou preparar:**
  1. Entregar primeiro uma release de contenção compatível com o schema `0043`,
     pausar novos checkouts e desativar o ingresso do webhook AbacatePay com resposta
     `204` antes de ler corpo, validar segredo ou acessar banco.
  2. Confirmar que os dados AbacatePay são somente testes.
  3. Confirmar que rota durável, inbox, worker, deduplicação e retry foram homologados
     sem ativar o webhook de produção.
  4. Verificar conta de produção, aptidão para PIX/cartão, credencial e comportamento da
     omissão de `imageBase64`.
  5. Confirmar zero processamento novo do AbacatePay e então executar a limpeza
     controlada, inclusive dados de teste abaixo de `1000` centavos,
     preservando somente a Conta Admin atual.
  6. Remover a rota e o código executável AbacatePay, aplicar DDL e publicar o código
     Asaas com checkout e webhook ainda desabilitados.
  7. Validar health e readiness da rota publicada, inbox, worker, banco, retry e alertas,
     ainda sem tráfego financeiro.
  8. Criar chave de API restrita e token forte, configurar allowlist e cadastrar o
     webhook de produção não sequencial com os eventos necessários. Ativar de forma
     controlada somente após o readiness.
  9. Com checkout público ainda desabilitado, realizar compra controlada real PIX e
     cartão, reembolso integral, smoke de Pedido, webhook, Concessão e Matrícula,
     conferência de taxas e extrato e confirmação da fila e dos alertas.
  10. Reabrir checkout.
  11. Revogar as credenciais e a configuração remota AbacatePay que já não possuem
      endpoint executável no Hub.
- **Componentes/arquivos/áreas impactadas:** deploy, banco, secrets, Asaas, AbacatePay, observabilidade e suporte.
- **Dependências:** Etapa 9 aprovada, rota durável homologada e janela de mudança.
- **Riscos:** indisponibilidade de checkout; webhook apontar para versão errada; migration parcialmente aplicada.
- **Validação:** conta e credenciais de produção verificadas; token forte e allowlist
  ativos; webhook aponta somente para a rota durável e não usa fila sequencial; smoke
  completo; métricas verdes; zero novo evento AbacatePay e fila Asaas ativa.
- **Responsável sugerido:** Tech Lead/Plataforma, com Backend e Financeiro presentes.
- **Status:** Corte autorizado e em execução controlada. Release A publicada e
  contenção comprovada; Release B ainda não integrada. Em 2026-07-29, a inspeção
  somente leitura inicial confirmou:
  - Production permanece no deployment Vercel `READY` do commit `1414bf5`;
    `origin/main` está em `d64fc66`, com CI verde. Em 2026-07-30, a implementação Asaas
    foi reunida no commit local `384db5a`, ainda sem push, Pull Request ou CI remota; o
    commit combina Release A e Release B e precisa ser separado antes do caminho de
    corte especificado;
  - o GitHub Environment `vercel-production` possui os secrets e IDs exigidos pelo
    workflow de deploy, mas a Vercel Production ainda não possui `ASAAS_API_KEY`,
    `ASAAS_API_BASE_URL`, `ASAAS_USER_AGENT` nem `ASAAS_WEBHOOK_TOKEN`; as variáveis
    AbacatePay continuam configuradas;
  - a branch Neon Production está no topo `0043`, com 44 entradas no journal. Ela
    contém cinco Pedidos AbacatePay de R$ 250, sendo dois `paid` e três `pending`, dois
    webhooks AbacatePay e duas Concessões `abacatepay_order`. Esses agregados coincidem
    com o ensaio descartável, mas não provam tecnicamente que os registros são testes;
    a exclusão exige confirmação explícita da responsável pelo negócio;
  - não havia erro de runtime Vercel agrupado nem log `error`/`fatal` no deployment
    Production nas 24 horas inspecionadas.

  Nenhuma variável, migration, dado, deployment ou workflow de Production foi alterado.
  Em 2026-07-29, a responsável confirmou explicitamente que todos os dados de todas as
  branches são testes descartáveis, incluindo pagamentos, Cursos, Contas de Aluna e
  demais registros da aplicação. A limpeza pode, portanto, remover todo o conteúdo
  operacional, preservando somente infraestrutura, schema e journal necessários para a
  promoção. A decisão posterior determinou preservar a Conta Admin atual e apagar as
  demais Contas e dados da aplicação. O desenho escrito e auto-revisado está em
  `docs/superpowers/specs/2026-07-29-asaas-production-cutover-cleanup-design.md`.
  A especificação foi aprovada e o plano de implementação detalhado está em
  `docs/superpowers/plans/2026-07-29-asaas-production-cutover-cleanup.md`.
  Ele separa uma Release A de contenção, compatível com `0043`, da Release B Asaas;
  define limpeza manual com modo `plan`, fingerprint, backup Neon, alvo verificado e
  transação única; e nunca incorpora exclusão ao deploy recorrente. Em 2026-07-29, as Tasks 1 a 3
  do plano foram concluídas por TDD: a política `PAYMENTS_CHECKOUT_MODE`, os contratos
  de Production/Preview e os guards autenticado/público estão implementados no worktree
  Asaas. A Release A foi reaplicada isoladamente sobre `origin/main` no worktree
  `codex/asaas-cutover-containment`; 173 arquivos/695 testes, TypeScript e build Next.js
  passaram, sem migrations `0044` a `0051`. Commit, push, Pull Request e corte continuam
  exigindo autorização específica. A Task 4 também foi concluída por TDD:
  `ASAAS_WEBHOOK_ENABLED` agora é explícita com Asaas em Production, permanece
  desabilitada em Preview e interrompe tanto o ingresso quanto o worker antes de body,
  persistência ou lease. Os 91 testes focais e o typecheck passaram. As Tasks 5 a 9
  também foram concluídas em código: contrato puro, executor PostgreSQL transacional,
  integração em schema isolado, CLI `plan|execute` e workflow manual com backup Neon.
  A suíte PostgreSQL de limpeza passou em sete cenários, incluindo drift, lock,
  rollback e reexecução; os 27 testes focais finais do contrato/CLI passaram.
  O `plan` real foi executado em uma clone descartável de Production, validou as 38
  tabelas, 44 migrations até `0043`, exatamente um Admin utilizável e as contagens sem
  escrever no banco. A branch temporária foi removida. A comparação do journal preserva
  os quatro hashes históricos realmente aplicados e normaliza LF para evitar falso drift
  em checkout Windows. Nenhuma branch persistente, variável, migration, deployment ou
  dado de Production foi alterado. A documentação canônica passou em 32 documentos.
  A verificação final passou com 27 testes PostgreSQL em quatro arquivos de integração,
  201 arquivos/1.083 testes no `bun run verify`, typecheck, Ultracite, migrations,
  build Next.js, Knip e 19 jornadas Playwright. O E2E revelou e corrigiu uma corrida do
  próprio teste: o botão de conclusão já existia no stream React, mas ainda estava em
  um container oculto; a jornada agora aguarda o heading visível antes de decidir se
  conclui ou avança. Builds E2E também não tentam criar release ou enviar source maps
  ao Sentry. A branch Neon efêmera usada para o gate foi removida.
  Em 2026-07-30, Produto autorizou commit, push e Pull Request da Release A e confirmou
  que o AbacatePay pode ser removido. A sequência foi corrigida: a Release A desativa
  o ingresso legado antes da limpeza, com `204` para não provocar retentativas, e a
  Release B remove definitivamente a rota e o código legado antes da migration `0044`.
  A Release A foi versionada isoladamente no commit `dd78e0f`, publicada na branch
  `codex/asaas-cutover-containment-release-a` e aberta no Pull Request
  [#18](https://github.com/juniordinizm/hub/pull/18). O diff possui somente contenção
  compatível com `0043`: `PAYMENTS_CHECKOUT_MODE`,
  `ABACATEPAY_WEBHOOK_ENABLED`, guards antecipados, testes e documentação
  correspondente. O gate completo passou com 174 arquivos/706 testes, TypeScript,
  Ultracite, migrations, build Next.js, Knip e 32 documentos canônicos. As revisões
  independentes de especificação e qualidade foram aprovadas sem achados. A CI remota
  do PR passou em quality gates, integração PostgreSQL, jornadas Chromium, build,
  auditoria de dependências e candidato Preview Vercel. Merge, configuração das flags
  e deploy de Production ainda não foram executados.
  Por decisão de Produto em 2026-07-30, o PR permanecerá aberto sem merge enquanto a
  Release B é concluída e validada localmente, reduzindo builds intermediários. Essa
  espera não altera a ordem do corte: quando todo o pacote estiver pronto, a Release A
  ainda será integrada e publicada primeiro; somente depois da contenção comprovada e
  da limpeza será permitido integrar e publicar a Release B.

  Em 2026-07-31, Produto liberou merge, deploy e Production após a homologação manual
  de Development. O PR #18 foi integrado por squash no commit `0e043fa`, e a CI da
  `main` passou em quality gates, PostgreSQL, Chromium e build/auditoria. Vercel
  Production recebeu `PAYMENTS_CHECKOUT_MODE=disabled` e
  `ABACATEPAY_WEBHOOK_ENABLED=false`. A primeira tentativa de deploy falhou antes da
  promoção porque o pipeline PowerShell usado para definir as flags acrescentou `CR`;
  o readiness rejeitou os dois enums. Os valores foram substituídos por stdin sem
  terminador e o run `30602278594` concluiu migration/auditoria `0043`, build,
  readiness e promoção. O smoke público retornou `200` na raiz, `503` no checkout
  público e `204` no webhook AbacatePay; Pedidos, Webhooks e Concessões pagas
  permaneceram em `5/2/2`. O login Admin ainda precisa de confirmação humana antes da
  limpeza destrutiva.

**Rollback:**

- Antes do primeiro pagamento real Asaas: pausar checkout e reverter release/schema conforme runbook.
- Depois do primeiro pagamento real Asaas: pausar novos checkouts, manter webhook e reconciliação Asaas ativos e corrigir para frente.
- Nunca ocultar um pagamento Asaas já existente restaurando silenciosamente o AbacatePay.

### Etapa 11: estabilizar e remover resíduos

- **Objetivo:** encerrar a migração somente após um período operacional seguro.
- **O que analisar ou preparar:**
  - observar ao menos a janela de retenção de 14 dias do Asaas;
  - resolver todos os eventos falhos e Pedidos sem correlação;
  - remover código, testes, envs, MCP e documentação AbacatePay;
  - manter referências somente em migrations históricas quando necessário;
  - atualizar documentação canônica e runbooks;
  - ratificar ADRs;
  - revisar retenção de payloads e custos de API.
- **Componentes/arquivos/áreas impactadas:** todo o repositório, dashboard Asaas e documentação.
- **Dependências:** corte concluído.
- **Riscos:** remover credencial antiga cedo demais; deixar referência executável; acumular PII.
- **Validação:** busca rastreada com allowlist histórica; `bun run docs:check`; backlog zero; aceite Financeiro/Suporte.
- **Responsável sugerido:** Tech Lead/Plataforma.
- **Status:** Não iniciado.

## Estratégia de validação e testes

### Matriz mínima de eventos

| Evento/situação | Estado interno esperado | Efeito no acesso |
|---|---|---|
| `CHECKOUT_CREATED` | Checkout ativo | Nenhum |
| `CHECKOUT_PAID` | Jornada paga, aguardando autoridade financeira | Nenhum |
| Risco pendente ou reprovado | Pagamento sem autoridade de acesso | Nenhum |
| PIX `PAYMENT_RECEIVED` | Pago e recebido | Conceder uma vez |
| Cartão `PAYMENT_CONFIRMED` sem risco bloqueante | Pago e confirmado | Conceder uma vez |
| Risco aprovado após confirmação armazenada | Pago e confirmado | Conceder uma vez |
| Cartão `PAYMENT_RECEIVED` | Liquidação atualizada | Não duplicar |
| Valor divergente | Revisão pendente | Não conceder |
| Checkout expirado/cancelado antes do pagamento | Encerrado | Nenhum |
| Cancelamento tardio após pagamento | Ignorado/revisado | Não revogar |
| Reembolso em andamento | Reembolso pendente | Aguardar confirmação |
| Reembolso confirmado | Reembolsado | Revogar |
| Reembolso parcial externo | Revisão | Não aplicar regra automática |
| Disputa/chargeback | Estado adverso | Revogar |
| Pago após refund/chargeback | Conflito terminal | Não reativar |
| Evento duplicado | Duplicata processada | Nenhum efeito adicional |
| Evento desconhecido | Ignorado com alerta | Nenhum |
| Primeira tentativa falha | `failed/retryable` durável | Nenhum até retry |

### Testes unitários

- Conversão de `12990` centavos para `129.90`.
- Autoria rejeita `999` centavos e aceita `1000` centavos para Curso pago.
- Checkout rejeita snapshot abaixo de `1000` centavos sem chamar o provider.
- Valores com zero, centavos e limites aceitos nos fluxos não comerciais aplicáveis.
- Mapeamento de todos os eventos usados.
- Enum desconhecido.
- Precedência fora de ordem.
- Valor bruto versus `netValue`.
- Reembolso, disputa e chargeback.
- Identidade autenticada e pública.
- Normalização de e-mail sem alterar Conta.
- Sanitização de logs.

### Testes de contrato HTTP

- URL sandbox/produção.
- Header `access_token`.
- `User-Agent`.
- Checkout PIX/cartão e item inline.
- Adapter não envia checkout abaixo de R$ 10.
- Callback URLs.
- Timeout.
- 400/401/403/404.
- 429 e headers de rate limit.
- 500 e resposta inválida.
- Resultado incerto.
- Reembolso integral.
- Consulta de reparo.
- Token de webhook correto/incorreto.

### Testes de integração com PostgreSQL

- Pedido local existe antes da chamada externa.
- ID de checkout e pagamento são associados ao Pedido correto.
- Primeiro webhook falho continua persistido.
- Duas entregas simultâneas produzem um efeito.
- Eventos fora de ordem respeitam precedência.
- Rollback não apaga a inbox.
- Concessão e Matrícula permanecem consistentes.
- Outbox é criada na mesma transação do efeito de acesso.
- Reembolso aceito com falha local fica em reconciliação.
- A migration de neutralização não remove Concessões manuais; a limpeza destrutiva
  separada da Etapa 10 remove todas as Concessões de teste.

### Testes de rota

- Token ausente/incorreto não processa.
- Payload malformado não processa.
- Evento válido persistido retorna exatamente `200`.
- Duplicata retorna `200`.
- Banco indisponível não retorna sucesso.
- Processamento de negócio não bloqueia a resposta.
- PII e secrets não aparecem em logs.

### Testes E2E

- Curso nasce sem produto remoto.
- Checkout autenticado.
- Checkout público com captura local de identidade.
- Autoria e checkout impedem Curso pago abaixo de `1000` centavos.
- Clique duplicado.
- Cancelamento e expiração.
- Retorno com pagamento pendente.
- Acesso após PIX.
- Acesso após cartão confirmado.
- Revisão de valor.
- Reembolso e revogação.
- Conta nova e ativação durável.
- Conta existente sem alteração indevida.
- Admin e Suporte com permissões corretas.

### Homologação Asaas

Executar no sandbox:

- checkout PIX;
- checkout cartão;
- expiração;
- cancelamento;
- duplicata manual de webhook;
- entrega fora de ordem;
- reembolso;
- indisponibilidade temporária do endpoint;
- consulta de conciliação;
- verificação do ID do pagamento gerado pelo Checkout.

A Etapa 9 termina após essas validações sandbox. Compras reais, reembolso, conferência de
taxas e extrato e validação da fila e dos alertas em produção ocorrem exclusivamente na
Etapa 10: depois da publicação com checkout desabilitado, do health/readiness e da
configuração controlada do webhook, e antes de reabrir vendas.

Isso não constitui migração gradual nem dual gateway. O único provider ativo é validado
em produção apenas durante o corte controlado da Etapa 10.

### Comandos de gate

O gate de dados deve falhar se restar Curso pago de teste abaixo de `1000` centavos. A
suíte precisa provar a validação tanto na autoria quanto no checkout antes do corte.

Na futura implementação:

```text
bun run test
bun run typecheck
bun run check
bun run docs:check
bun run db:migrations:check
bun run db:smoke:empty
bun run build
bun run test:e2e
bun run verify
```

### Critérios de aceite

- Nenhum Pedido duplicado por clique, retry ou webhook.
- Nenhuma Concessão duplicada.
- Primeiro erro de webhook é recuperável.
- Ingresso responde antes do timeout Asaas.
- PIX e cartão liberam no evento definido.
- Valor divergente não libera.
- Evento adverso revoga.
- Conta não é verificada ou alterada pelo provider.
- Curso não depende do gateway.
- Curso pago abaixo de `1000` centavos é rejeitado na autoria e no checkout.
- Nenhum dado de teste pago abaixo do mínimo permanece no corte.
- Reembolso incerto não é repetido cegamente.
- Conciliação não é o fluxo normal.
- Nenhum secret aparece em logs ou respostas.
- Documentação canônica e runbooks refletem o sistema executado.
- Referências AbacatePay executáveis foram removidas.

## Checklist de acompanhamento

### Governança

- [x] **Concluído:** mapear arquitetura e fluxo atual.
- [x] **Concluído:** pesquisar documentação oficial.
- [x] **Concluído:** fechar escopo PIX + cartão, pagamento único.
- [x] **Concluído:** fechar política de liberação de acesso.
- [x] **Concluído:** fechar política de identidade pública.
- [x] **Concluído:** fechar processamento durável de webhook.
- [x] **Concluído:** fechar fronteira arquitetural.
- [x] **Concluído:** fechar divergência e precedência financeira.
- [x] **Concluído:** ratificar ADR-0004 e ADR-0005.
- [x] **Concluído:** encerrar DEC-DISC-002, 003 e 007.
- [x] **Concluído:** aprovar DEC-DISC-010 e o preço mínimo de Curso pago.

### Conta e segurança Asaas

- [x] **Concluído:** validar cadastro sandbox e chave Pix.
- [ ] **Não iniciado:** verificar conta e credenciais de produção na Etapa 10.
- [ ] **Não iniciado:** criar chave de API restrita na Etapa 10.
- [ ] **Não iniciado:** criar token forte de webhook na Etapa 10.
- [ ] **Não iniciado:** configurar allowlist na Etapa 10.
- [ ] **Não iniciado:** configurar e ativar webhook de produção na Etapa 10, somente
  após a rota durável homologada.
- [ ] **Não iniciado:** confirmar ausência ou disponibilidade de HMAC na Etapa 10.
- [x] **Concluído:** definir retenção de payload bruto por 30 dias e sanitização posterior.

### Arquitetura e dados

- [x] **Concluído:** desenhar fronteira financeira neutra do módulo de comércio.
- [x] **Concluído:** definir adapter Asaas e fake contratual, com testes e revisões
  independentes aprovados.
- [x] **Concluído:** remover provider da origem de Concessão no schema e no domínio de acesso.
- [x] **Concluído:** desenhar estados internos normalizados.
- [x] **Concluído:** separar IDs de checkout, pagamento, cliente e reembolso.
- [x] **Concluído:** remover produto remoto do Curso e dos checkouts.
- [x] **Concluído em código e validado em clone descartável:** preparar limpeza
  integral dos dados de teste, preservando somente a Conta Admin atual, infraestrutura,
  schema e journal. Desenho em
  `docs/superpowers/specs/2026-07-29-asaas-production-cutover-cleanup-design.md`; plano
  executável em
  `docs/superpowers/plans/2026-07-29-asaas-production-cutover-cleanup.md`.
- [x] **Concluído:** validar migration, snapshot, índices e FKs em PostgreSQL
  descartável, sem aplicar DDL a branch persistente.

### Checkout

- [x] **Concluído:** persistir Pedido antes do checkout nas duas entradas.
- [x] **Concluído:** reservar a tentativa como `pending` antes da autorização coordenada e
  exigir CAS para `creating` antes de chamar o provedor.
- [x] **Concluído:** compartilhar o núcleo entre checkout público e autenticado.
- [x] **Concluído:** resolver a identidade pública do cliente Asaas somente após evento
  financeiro autoritativo e criar ou vincular a Conta sem sobrescrever identidade.
- [x] **Concluído:** validar preço mínimo na autoria e no checkout ativo.
- [x] **Concluído:** substituir rate limit em memória por janela coordenada no PostgreSQL.
- [x] **Concluído:** validar item inline e omissão de imagem no adapter Asaas.
- [x] **Concluído:** adaptar callbacks e páginas de sucesso, cancelamento e expiração.
- [x] **Concluído:** núcleo preserva resultado externo incerto sem retry cego; a
  reconciliação durável pertence às Etapas 6 e 8.

### Webhooks e domínio

- [x] **Concluído:** criar rota Asaas.
- [x] **Concluído:** criar inbox durável.
- [x] **Concluído:** responder `200` apenas após persistência.
- [x] **Concluído:** criar infraestrutura de executor com retry.
- [x] **Concluído:** implementar deduplicação concorrente no ingresso e ownership por
  evento no worker.
- [x] **Concluído:** implementar matriz pura de precedência e processor transacional sob
  lock do Pedido.
- [x] **Concluído:** persistir evidências, correlação exata, alertas seguros e Revisão
  idempotente por Webhook.
- [x] **Concluído:** neutralizar Concessão e razões de revogação no módulo de acesso.
- [x] **Concluído:** implementar e enfileirar factory, parser e delivery duráveis de
  ativação pública; acesso de Conta com credencial usa outbox idempotente.
- [x] **Concluído:** revisar 7C e executar os gates focais e completos locais.
- [x] **Concluído em código:** habilitar o schedule do worker em unidade própria, a cada
  minuto UTC, com `CRON_SECRET`, kill switch, lease e deadline.

### Reembolso e operação

- [x] **Concluído em código:** implementar reembolso integral Asaas.
- [x] **Concluído em código:** modelar resultado incerto.
- [x] **Concluído em código:** criar conciliação por ID/extrato com precedência
  financeira, correlação exata, concorrência limitada e backoff em `429`.
- [x] **Concluído em código:** atualizar admin financeiro.
- [x] **Concluído em código:** atualizar auditoria e observabilidade.
- [x] **Concluído em código:** criar alertas da fila Asaas, incluindo eventos
  `retryable`.
- [x] **Concluído em código:** atualizar runbooks de incidente.

### Validação e corte

- [x] **Concluído:** concluir testes unitários.
- [x] **Concluído:** concluir testes de contrato.
- [x] **Concluído:** concluir testes PostgreSQL.
- [x] **Concluído:** concluir E2E.
- [x] **Validado localmente:** implementar e provar contenção, cleanup e workflow do
  corte Asaas; `verify`, PostgreSQL descartável e 19 jornadas E2E passaram em
  2026-07-30.
- [x] **Concluído em Development:** aplicar `0044` a `0052` após autorização,
  auditar 53 entradas no journal, preservar o único Admin, comprovar idempotência e
  aprovar o reteste manual da superfície administrativa em 2026-07-31.
- [x] **Concluído:** homologar checkout PIX/cartão E2E no sandbox, incluindo pagamento,
  acesso, cancelamento, expiração, duplicata, entrega fora de ordem, reembolso,
  indisponibilidade temporária, retry e conciliação. A compra de cartão observada não
  emitiu eventos de risco; esse ramo permanece coberto por testes automatizados e
  registrado como limitação não simulável do Sandbox.
- [ ] **Não iniciado:** executar smoke real controlado.
- [x] **Release A publicada:** checkout pausado e ingresso do webhook AbacatePay
  desativado antes da limpeza. O PR
  [#18](https://github.com/juniordinizm/hub/pull/18) foi integrado, a CI da `main`
  passou e o deployment Production `0e043fa` foi promovido. Smoke confirmou raiz
  `200`, checkout público `503`, webhook legado `204` e zero alteração nas contagens
  financeiras.
- [ ] **Pendente de execução:** remover dados de teste; `plan` real já validado em
  clone descartável e `execute` ainda não foi acionado.
- [ ] **Não iniciado:** publicar Asaas.
- [x] **Concluído em código na Release B:** rota, cliente, parser, processor, retry,
  configuração operacional e documentação canônica AbacatePay removidos. Typecheck,
  Ultracite, 1.062 testes, docs:check e allowlist estática passaram em 2026-07-30;
  credenciais/configuração remota só serão revogadas após o smoke Asaas.
- [ ] **Não iniciado:** monitorar por pelo menos 14 dias.
- [ ] **Não iniciado:** remover resíduos e ratificar documentação.

