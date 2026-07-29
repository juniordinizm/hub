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
- Cartão libera acesso em `PAYMENT_CONFIRMED`, após análise de risco.
- `CHECKOUT_PAID` não é autoridade financeira.
- Compradora pública informa nome e e-mail no Hub antes do redirect.
- Dados do provider não verificam nem alteram automaticamente uma Conta.
- Divergência monetária tem tolerância zero e abre Revisão.
- Reembolso confirmado, disputa e chargeback prevalecem e revogam acesso.
- Reembolso oferecido pelo Hub continuará sendo apenas integral.

### Evidência desta fase

- Base analisada: commit `d64fc66bdf04`.
- Worktree: limpo.
- Arquivos alterados: nenhum.
- Testes executados: nenhum, porque esta fase foi estritamente de leitura e planejamento.
- Documentação atual de Asaas e AbacatePay consultada via Context7 e fontes oficiais em 2026-07-28.
- Tempo registrado da análise: aproximadamente 17 minutos.

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
- ID do reembolso;
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

### Riscos confirmados no estado atual

1. **Crítico:** primeira falha de webhook pode ser apagada pelo rollback.
2. **Alto:** checkout externo é criado antes do Pedido local.
3. **Alto:** reembolso aceito externamente pode ser marcado localmente como falho.
4. **Alto:** dados do pagador são tratados como identidade e verificação de e-mail.
5. **Alto:** criação de Curso depende do gateway financeiro.
6. **Alto:** não há timeout, idempotência ampla ou tratamento de resultado incerto.
7. **Médio:** rate limit público não é coordenado entre instâncias.
8. **Médio:** ativação de Conta sem credencial não tem retry durável.
9. **Médio:** payload bruto com PII não possui retenção definida.
10. **Médio:** políticas de conflito, valor e identidade ainda não foram ratificadas nos ADRs.
11. **Médio:** sucesso aguarda no máximo cerca de 75 segundos, insuficiente para alguns fluxos assíncronos.
12. **Médio:** testes estáticos de SQL não comprovam comportamento transacional.

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

### Pendências de validação externa

1. Confirmar no sandbox como o ID do Checkout se relaciona ao ID do pagamento.
2. Confirmar se `externalReference` é propagado em todos os eventos necessários.
3. Confirmar o comportamento real de item/imagem no Checkout e eventual exigência de Base64.
4. Confirmar se a conta Asaas de produção está verificada e apta a receber PIX/cartão.
5. Confirmar que existe chave Pix registrada.
6. Criar chave de API com menor privilégio compatível.
7. Criar token de webhook forte e registrar allowlist de IPs oficiais.
8. Confirmar formalmente se existe mecanismo de assinatura além do token.
9. Definir política de retenção e acesso aos payloads com PII.
10. Definir configuração de fila não sequencial e serialização local por Pedido.
11. Definir como pesquisar um checkout após timeout de resultado incerto.
12. Confirmar tarifas e campos financeiros que o suporte precisa visualizar.

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

### Etapa 1: ratificar contratos e preparar a conta Asaas

- **Objetivo:** transformar as decisões deste plano em contratos aceitos.
- **O que analisar ou preparar:**
  - ratificar ADR-0004 e ADR-0005;
  - fechar DEC-DISC-002, DEC-DISC-003 e DEC-DISC-007;
  - aprovar a matriz evento, estado e efeito;
  - criar conta sandbox;
  - verificar conta de produção, chave Pix, API key e token de webhook;
  - definir fila não sequencial e IP allowlist;
  - registrar checklist de breaking changes.
- **Componentes/arquivos/áreas impactadas:** `C:\Users\Junior\Documents\0 - Dev\hub\docs\decisions.md`, ADRs, integração e runbooks.
- **Dependências:** Produto, Financeiro, Segurança e acesso administrativo ao Asaas.
- **Riscos:** implementar uma política não ratificada ou descobrir impedimentos da conta tarde demais.
- **Validação:** decisões assinadas; sandbox operacional; credenciais existentes sem exposição; webhook de teste recebido.
- **Responsável sugerido:** Tech Lead; apoio de Produto/Financeiro e Plataforma.
- **Status:** Não iniciado.

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
- **Status:** Não iniciado.

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
  - recompor Matrículas afetadas sem apagar Concessões manuais.
- **Componentes/arquivos/áreas impactadas:** `C:\Users\Junior\Documents\0 - Dev\hub\src\db\schema.ts`, migrations, scripts de verificação e tabelas financeiras.
- **Dependências:** matriz financeira da Etapa 1 e arquitetura da Etapa 2.
- **Riscos:** apagar Concessões manuais, Cursos ou Contas que não fazem parte dos testes; enum incompatível; migration não reversível.
- **Validação:** dry-run com contagens; revisão das FKs; `bun run db:migrations:check`; banco vazio; seed; `bun run db:smoke:empty`.
- **Responsável sugerido:** Backend responsável por dados; revisão do Tech Lead.
- **Status:** Não iniciado.

Não haverá transformação, backfill ou importação de dados AbacatePay. Haverá apenas DDL e remoção controlada dos registros de teste.

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
- **Status:** Não iniciado.

### Etapa 5: migrar autoria e checkout

- **Objetivo:** criar Pedidos localmente antes do efeito externo e eliminar produto remoto.
- **O que analisar ou preparar:**
  - permitir criar e editar Curso sem gateway;
  - remover requisito de produto na publicação;
  - gerar item inline a partir do snapshot do Pedido;
  - persistir Pedido antes do checkout;
  - representar criação em andamento e resultado incerto;
  - checkout autenticado usa `userId` imutável da sessão;
  - checkout público captura nome/e-mail antes do redirect;
  - não alterar Conta com dados Asaas;
  - usar implementação interna compartilhada;
  - substituir rate limit em memória por mecanismo coordenado;
  - callbacks de sucesso, cancelamento e expiração;
  - mensagens seguras para falhas do provider.
- **Componentes/arquivos/áreas impactadas:** autoria, ações, checkout público, rotas, páginas de sucesso, apresentação do Curso e schema.
- **Dependências:** adapter e schema.
- **Riscos:** checkout externo órfão; duplicidade por clique/retry; experiência pública mais longa; exigência inesperada de imagem Base64.
- **Validação:** Curso criado com Asaas indisponível; clique duplicado produz um Pedido; checkout autenticado/público; retorno cancelado/expirado; falha externa não perde a intenção local.
- **Responsável sugerido:** Backend com Frontend.
- **Status:** Não iniciado.

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
- **Status:** Não iniciado.

### Etapa 7: aplicar ciclo financeiro, identidade e acesso

- **Objetivo:** normalizar eventos Asaas e produzir efeitos determinísticos.
- **O que analisar ou preparar:**
  - matriz completa de precedência;
  - PIX libera em `PAYMENT_RECEIVED`;
  - cartão libera em `PAYMENT_CONFIRMED`;
  - risco pendente não libera;
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
- **Status:** Não iniciado.

### Etapa 8: migrar reembolso, administração, conciliação e observabilidade

- **Objetivo:** tornar o ciclo operável por Financeiro e Suporte.
- **O que analisar ou preparar:**
  - manter confirmação recente de senha;
  - reservar intenção antes da chamada externa;
  - resultado ambíguo permanece `requested/reconciling`, não `failed`;
  - persistir ID externo;
  - confirmar revogação por evento financeiro;
  - oferecer somente reembolso integral;
  - registrar que tarifas podem não ser devolvidas;
  - ampliar busca/paginação de Pedidos;
  - mostrar checkout, pagamento, método, gross, net, taxas e estado;
  - criar reconciliação por pagamento e extrato;
  - alertas para fila, eventos falhos, Pedidos sem correlação e reembolsos incertos;
  - remover strings operacionais AbacatePay.
- **Componentes/arquivos/áreas impactadas:** refunds, actions, admin financeiro, operations, observability e outbox.
- **Dependências:** Etapas 4, 6 e 7.
- **Riscos:** reembolso duplicado; estado local falso; suporte sem visibilidade; excesso de polling e 429.
- **Validação:** sucesso, falha definitiva e resultado incerto; retry não duplica; auditoria completa; reconciliação corrige somente o Pedido alvo.
- **Responsável sugerido:** Backend com Financeiro/Suporte e Plataforma.
- **Status:** Não iniciado.

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
  - compra controlada real em produção antes da abertura;
  - reembolso controlado real;
  - diferenças conhecidas do sandbox.
- **Componentes/arquivos/áreas impactadas:** testes Vitest, Playwright, sandbox, runbooks e monitoramento.
- **Dependências:** todas as etapas de implementação.
- **Riscos:** falso positivo do sandbox; teste real criar registro financeiro; webhook configurado na conta errada.
- **Validação:** todos os gates da seção seguinte aprovados e evidência anexada ao release.
- **Responsável sugerido:** QA/Backend com Financeiro e Plataforma.
- **Status:** Não iniciado.

### Etapa 10: executar o corte direto

- **Objetivo:** desligar AbacatePay e abrir Asaas sem coexistência.
- **O que analisar ou preparar:**
  1. Pausar novos checkouts.
  2. Confirmar que os dados AbacatePay são somente testes.
  3. Executar limpeza controlada e DDL.
  4. Publicar código Asaas.
  5. Configurar secrets, webhook e allowlist.
  6. Realizar smoke PIX e cartão.
  7. Confirmar Pedido, webhook, Concessão, Matrícula e reembolso.
  8. Reabrir checkout.
  9. Revogar chaves e webhook AbacatePay.
- **Componentes/arquivos/áreas impactadas:** deploy, banco, secrets, Asaas, AbacatePay, observabilidade e suporte.
- **Dependências:** homologação aprovada e janela de mudança.
- **Riscos:** indisponibilidade de checkout; webhook apontar para versão errada; migration parcialmente aplicada.
- **Validação:** smoke completo, métricas verdes, zero novo evento AbacatePay e fila Asaas ativa.
- **Responsável sugerido:** Tech Lead/Plataforma, com Backend e Financeiro presentes.
- **Status:** Não iniciado.

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
| Análise de risco pendente | Pagamento em análise | Nenhum |
| PIX `PAYMENT_RECEIVED` | Pago e recebido | Conceder uma vez |
| Cartão `PAYMENT_CONFIRMED` | Pago e confirmado | Conceder uma vez |
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
- Valores com zero, centavos e limites aceitos.
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
- Limpeza não remove Concessões manuais.

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

Depois, ainda com checkout público pausado, executar em produção:

- uma compra real PIX de baixo valor;
- uma compra real cartão de baixo valor;
- reembolso integral;
- conferência de taxas e extrato;
- confirmação da fila e alertas.

Isso não constitui migração gradual nem dual gateway. É um gate de homologação do único provider ativo.

### Comandos de gate

Na futura implementação:

```text
bun test
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
- [ ] **Não iniciado:** ratificar ADR-0004 e ADR-0005.
- [ ] **Não iniciado:** encerrar DEC-DISC-002, 003 e 007.

### Conta e segurança Asaas

- [ ] **Não iniciado:** criar e validar sandbox.
- [ ] **Não iniciado:** verificar conta de produção.
- [ ] **Não iniciado:** registrar chave Pix.
- [ ] **Não iniciado:** criar chave de API restrita.
- [ ] **Não iniciado:** criar token forte de webhook.
- [ ] **Não iniciado:** configurar allowlist.
- [ ] **Não iniciado:** confirmar ausência ou disponibilidade de HMAC.
- [ ] **Não iniciado:** definir retenção de payload e PII.

### Arquitetura e dados

- [ ] **Não iniciado:** desenhar módulo profundo de comércio.
- [ ] **Não iniciado:** definir adapter Asaas e fake contratual.
- [ ] **Não iniciado:** remover provider do domínio de acesso.
- [ ] **Não iniciado:** desenhar estados internos normalizados.
- [ ] **Não iniciado:** separar IDs de checkout, pagamento, cliente e reembolso.
- [ ] **Não iniciado:** remover produto remoto do Curso.
- [ ] **Não iniciado:** preparar limpeza dos dados de teste.
- [ ] **Não iniciado:** validar migrations e FKs.

### Checkout

- [ ] **Não iniciado:** persistir Pedido antes do checkout.
- [ ] **Não iniciado:** unificar implementação pública/autenticada.
- [ ] **Não iniciado:** capturar identidade pública localmente.
- [ ] **Não iniciado:** substituir rate limit em memória.
- [ ] **Não iniciado:** validar item e imagem no Checkout Asaas.
- [ ] **Não iniciado:** adaptar callbacks e página de sucesso.
- [ ] **Não iniciado:** tratar resultado externo incerto.

### Webhooks e domínio

- [ ] **Não iniciado:** criar rota Asaas.
- [ ] **Não iniciado:** criar inbox durável.
- [ ] **Não iniciado:** responder `200` apenas após persistência.
- [ ] **Não iniciado:** criar executor com retry.
- [ ] **Não iniciado:** implementar deduplicação concorrente.
- [ ] **Não iniciado:** implementar matriz de precedência.
- [ ] **Não iniciado:** implementar Revisão de divergência.
- [ ] **Não iniciado:** generalizar Concessão.
- [ ] **Não iniciado:** tornar ativação pública durável.

### Reembolso e operação

- [ ] **Não iniciado:** implementar reembolso integral Asaas.
- [ ] **Não iniciado:** modelar resultado incerto.
- [ ] **Não iniciado:** criar conciliação por ID/extrato.
- [ ] **Não iniciado:** atualizar admin financeiro.
- [ ] **Não iniciado:** atualizar auditoria e observabilidade.
- [ ] **Não iniciado:** criar alertas da fila Asaas.
- [ ] **Não iniciado:** atualizar runbooks de incidente.

### Validação e corte

- [ ] **Não iniciado:** concluir testes unitários.
- [ ] **Não iniciado:** concluir testes de contrato.
- [ ] **Não iniciado:** concluir testes PostgreSQL.
- [ ] **Não iniciado:** concluir E2E.
- [ ] **Não iniciado:** homologar sandbox.
- [ ] **Não iniciado:** executar smoke real controlado.
- [ ] **Não iniciado:** pausar checkout para o corte.
- [ ] **Não iniciado:** remover dados de teste.
- [ ] **Não iniciado:** publicar Asaas.
- [ ] **Não iniciado:** revogar AbacatePay.
- [ ] **Não iniciado:** monitorar por pelo menos 14 dias.
- [ ] **Não iniciado:** remover resíduos e ratificar documentação.

