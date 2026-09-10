---
status: research
owner: engineering
research_date: 2026-09-08
repository_branch: staging
repository_commit: a2f458834c0aa28f68abc4bae83f3ee8acfea115
---

# Pesquisa externa: superfície administrativa, operadores e fornecedores

## Escopo e método

Esta pesquisa responde à Tarefa E da auditoria do Admin do Hub. O código foi
consultado no commit `a2f4588`, branch `staging`, sem alterações de código,
testes, configuração ou documentação canônica. A única escrita desta tarefa é
este arquivo.

Foram lidos o `SKILL.md` de `research`, o playbook obrigatório
`.agents/skills/improve/references/audit-playbook.md` e, como contexto local,
`docs/README.md`, `README.md`, `PRODUCT.md`, `CONTEXT.md`,
`docs/architecture.md`, os guias de Asaas e JMVStream, ADR-0003, ADR-0005 e
ADR-0008, além das páginas administrativas diretamente relacionadas.

As seções relevantes do playbook foram aplicadas: Tech Debt & Architecture,
Docs, Direction, `Finding format` e o critério de priorização por impacto,
esforço, confiança e risco. Cada achado abaixo usa o formato obrigatório. A
pesquisa separa:

- evidência oficial: documentação do fornecedor ou documentação oficial do
  produto;
- sinal recorrente de comunidade: discussões, padrões publicados ou exemplos
  de operadores, sem tratá-los como contrato universal;
- inferência aplicada ao Hub: recomendação de superfície, ownership ou escopo,
  explicitamente marcada como recomendação.

Nenhum segredo, token, chave, senha, URL assinada ou valor de credencial é
reproduzido. Quando uma credencial é relevante, a referência é somente ao
arquivo/linha e ao tipo de credencial.

## Limitações externas

O Asaas possui documentação pública atual e relativamente detalhada sobre
configuração, eventos, entrega, logs, pagamentos e extrato. A documentação
oficial informa que os logs de entrega ficam na interface web e que há retenção
limitada de eventos; portanto, o portal do Asaas continua sendo uma fonte
operacional complementar, não substituível por uma lista local de eventos.

Para JMVStream, a documentação técnica pública consultada é suficiente para
upload multipart, galerias, consulta de vídeo, deleção assíncrona e status de
conversão. Não encontrei, na referência técnica pública, um contrato completo de
webhooks de VOD com catálogo de eventos, payloads, assinatura, retenção e
replay. Uma página pública de API, atualizada em 2026-05-04, anuncia webhooks,
retry, HMAC e reenvio manual, mas não publica esse contrato no mesmo nível de
detalhe. Isso é uma limitação verificável da pesquisa, não prova de que o
recurso não exista no plano ou no portal autenticado. A decisão de acoplar o
Hub a webhooks JMV exige confirmação do fornecedor e uma prova controlada.

Discussões de comunidade são usadas somente para identificar dores recorrentes:
deduplicação, persistência antes do processamento, processamento assíncrono,
status de tentativa, replay com guardrails e necessidade de visibilidade para
operadores. Elas não estabelecem uma regra de produto para o Hub.

## Síntese por superfície

- **Manter no Hub:** estado canônico de Pedido, acesso, Revisão financeira,
  inbox local de webhook, auditoria, relação Aula/ativo JMVStream, estado de
  upload/processamento/deleção e métricas agregadas de aprendizagem.
- **Exibir como alerta:** falhas persistentes, backlog stale, risco de retenção,
  fila do provider penalizada, processamento de vídeo atrasado, deleção pendente
  ou divergência entre projeção local e provider.
- **Deixar em detalhe:** Pedido e suas evidências, evento e tentativa local,
  decisão financeira, Aula e ativo de vídeo, IDs externos e motivo seguro da
  falha.
- **Exportar:** extrato importado e evidências normalizadas para reconciliação,
  com indicação explícita do que não tem correlação contratual; métricas de
  aprendizagem agregadas; mapeamento Aula/ativo somente quando necessário para
  operação ou migração.
- **Linkar para o portal:** logs de entrega e fila do Asaas, configurações e
  operações nativas do Asaas, catálogo/analytics/controles de mídia da
  JMVStream. O link deve respeitar ambiente e conta, sem transportar
  credenciais.

## Achados

### [ARCH-01] Remova a lista duplicada de webhooks da home operacional

- **Evidence**: `src/features/admin/server.ts:24-90` — `getAdminOverview` carrega os mesmos oito `recentWebhooks` para as superfícies administrativas.
- **Evidence**: `src/app/(admin)/admin/(dashboard)/page.tsx:367-423` — a home renderiza uma lista detalhada de eventos, chave, erro, status e data.
- **Evidence**: `src/app/(admin)/admin/financeiro/page.tsx:523-570` — Financeiro renderiza novamente a lista e acrescenta o retry para eventos falhos.
- **Evidence**: [Asaas Webhook Logs](https://docs.asaas.com/docs/webhooks-logs) — o próprio provider separa a investigação de entrega em uma superfície de logs, com tentativa, status HTTP, timeout, erro e quantidade de tentativas.
- **Impact**: duas listas do mesmo read model competem pela função de investigação. A home fica mais pesada e a operadora pode interpretar uma amostra recente como fila completa; Financeiro já é o local com contexto, autorização e ação de retry. O custo é duplicação de leitura, atenção e manutenção visual, não duplicação de dados persistidos.
- **Effort**: S (horas) — reduzir a home a contagem/sinal e preservar a lista detalhada em Financeiro, com teste de navegação e autorização.
- **Risk**: LOW — o dado e o fluxo de retry permanecem; o risco é perder descoberta se o link para Financeiro não for explícito.
- **Confidence**: HIGH — a mesma coleção é carregada no servidor e exibida em duas superfícies com responsabilidades diferentes.
- **Fix sketch**: Remover a lista de eventos da home e manter ali somente contagem, severidade e link para Financeiro/Auditoria. Preservar a lista, o detalhe e o retry no Financeiro; não remover `webhook_events` nem o read model compartilhado.

### [DIRECTION-01] Preserve a separação entre operação, analytics e configurações

- **Evidence**: `src/app/(admin)/admin/admin-sidebar-nav.tsx:23-31` — Admin já separa `Painel`, `Aprendizagem`, `Financeiro`, `Auditoria` e `Configurações`; `:33-37` limita o menu de Support a operação de Cursos e Financeiro.
- **Evidence**: `src/app/(admin)/admin/aprendizagem/page.tsx:27-55` — Aprendizagem é uma superfície própria, agregada, com exportação CSV.
- **Evidence**: `src/app/(admin)/admin/configuracoes/page.tsx:55-215` — configurações globais, saúde JMVStream, banners e FAQ ficam fora das telas de operação e analytics.
- **Evidence**: [Thinkific Analytics](https://support.thinkific.com/hc/en-us/articles/360040037093-Thinkific-Analytics) — o produto separa dashboards de Marketing, Enrollments, Orders, Revenue e Engagement, com filtros e exportação, enquanto a documentação de [Site Settings](https://support.thinkific.com/hc/en-us/articles/360030719753-Site-Settings) trata configurações globais em `Settings`.
- **Evidence**: [Shopify Admin](https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview?links=false) — a navegação distingue Orders/Products/Customers, Analytics/Reports, apps/canais e Settings; a home prioriza métricas e tarefas urgentes.
- **Impact**: misturar tendência, ação mutável, incidente e configuração na mesma tela aumenta a carga de decisão e amplia o risco de permissões confusas. O mercado observado usa a home para orientação e alertas, analytics para análise/exportação e settings para configuração durável.
- **Effort**: M (um dia-ish) — consolidar IA, links e hierarquia de superfícies, sem reescrever o domínio.
- **Risk**: MED — mover uma ação pode reduzir descobribilidade ou alterar expectativa de Admin/Support; autorização server-side e links precisam ser preservados.
- **Confidence**: HIGH — há convergência entre a estrutura local e dois produtos maduros, além de uma decisão local explícita sobre analytics agregado.
- **Fix sketch**: Manter `Painel` como triagem curta; deixar operações financeiras, backlog e auditoria em detalhe; manter `Aprendizagem` como analytics agregado/exportável; manter `Configurações` sem filas operacionais. Sinais devem apontar para a superfície que resolve o caso, em vez de acumular novas tabelas na home.

### [DIRECTION-02] Mantenha a operação Asaas no Hub e linke os logs de entrega do provider

- **Evidence**: [Create a Webhook through the web application](https://docs.asaas.com/docs/create-new-webhook-via-web-application) — o Asaas oferece no portal a configuração manual de endpoint, eventos, token, fila e tipo de entrega, inclusive para monitorar e editar a configuração.
- **Evidence**: [Webhooks Logs](https://docs.asaas.com/docs/webhooks-logs) — logs de tentativa, endpoint, status HTTP, erros, timeout e tentativas estão disponíveis na interface web, não pela API; eventos/logs ficam disponíveis por até 14 dias.
- **Evidence**: [Queue Penalty](https://docs.asaas.com/docs/queue-penalty) — 15 falhas consecutivas interrompem a fila; o portal permite remover a penalização depois que a causa foi corrigida.
- **Evidence**: `src/app/(admin)/admin/financeiro/page.tsx:267-269` e `:523-570` — o Hub exibe estado local, erro seguro, data e retry de eventos falhos, mas não os dados de tentativa HTTP e fila que só existem no portal Asaas.
- **Evidence**: `src/app/(admin)/admin/auditoria/page.tsx:265-293` — o Hub calcula backlog local e idade de webhooks recebidos, prontos, em retry e falhos.
- **Impact**: sem link para o portal, a operadora consegue saber que o Hub recebeu/processou mal um evento, mas não consegue partir da mesma tela para confirmar se o Asaas tentou entregar, sofreu timeout, penalizou a fila ou removeu eventos antigos. Replicar toda a telemetria do provider seria frágil e não cobriria a janela histórica de 14 dias.
- **Effort**: S (horas) — link contextual e indicação de ambiente/conta; nenhum espelhamento de payload ou credencial.
- **Risk**: LOW — link incorreto por ambiente ou conta é o principal risco; a ação no portal continua manual e auditável.
- **Confidence**: HIGH — a limitação do portal é declarada pelo Asaas e a lacuna entre tentativa externa e estado local é observável no código.
- **Fix sketch**: Manter no Hub o resumo operacional e a ação de retry local; adicionar no alerta/detalhe um link seguro para `Integrations > Webhooks > Webhook Logs` e para a configuração correta do ambiente. Não automatizar remoção de penalidade nem copiar o token de autenticação para a interface.

### [DIRECTION-03] Preserve a inbox local e o replay financeiro com guardrails

- **Evidence**: [Webhooks FAQ do Asaas](https://docs.asaas.com/docs/webhooks-faq) — o provider documenta entrega at-least-once, duplicatas, idempotência por `id`, processamento assíncrono, persistência de eventos e retenção máxima de 14 dias.
- **Evidence**: [Delivery Types](https://docs.asaas.com/docs/send-types) — envio sequencial preserva ordem quando a lógica depende do lifecycle; a recomendação oficial é persistir antes de processar, processar de forma assíncrona, deduplicar e usar logs para auditoria.
- **Evidence**: `src/features/payments/asaas-webhook-inbox.ts:40-77` — `persistAsaasWebhook` insere antes do processamento, usa chave única `(provider, event_key)` e trata duplicata sem nova entrada.
- **Evidence**: `docs/integrations/asaas.md:359-409` — o contrato local é persist-before-200, worker durável, CAS/backoff, limite de tentativas, sanitização e retry administrativo com motivo.
- **Evidence**: `src/app/(admin)/admin/financeiro/financial-operations.tsx:399-458` — o replay local exige motivo, é restrito ao evento falho e volta a atualizar a tela.
- **Evidence**: [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md) e a discussão [How can I prevent duplicate webhook events?](https://stackoverflow.com/questions/79998813/how-can-i-prevent-duplicate-webhook-events-from-being-processed-in-laravel/79998827) — padrão recorrente de comunidade: chave estável, inserção atômica, estado de processamento e resposta rápida; isso é sinal de prática, não contrato específico do Hub.
- **Impact**: remover a inbox ou terceirizar toda a recuperação para o portal deixaria o Hub sem a evidência que liga evento externo a Pedido, Concessão, Matrícula, Revisão e outbox. Também impediria distinguir duplicata, retry seguro, falha antes da transação e efeito já aplicado.
- **Effort**: M (um dia-ish) — manter a arquitetura atual e, se necessário, melhorar detalhe, filtros e explicação de estados; não exige nova fila externa.
- **Risk**: HIGH — alterações no ledger ou no replay podem liberar/revogar acesso ou repetir efeitos financeiros.
- **Confidence**: HIGH — a necessidade é explicitamente sustentada pelo contrato Asaas, pelo ADR-0005 e pelo código atual.
- **Fix sketch**: Não remover `webhook_events`, `payment_reviews` ou o retry auditado. Exibir no Hub somente chave, evento, status, tentativas, idade, erro seguro, correlação e resultado; deixar payload bruto fora da tela comum e bloqueado após sanitização. Reprocessar apenas evento falho, não sanitizado e dentro da política, com motivo e permissão; usar o portal para a camada de entrega.

### [DIRECTION-04] Trate o extrato como evidência exportável, não como cópia do painel Asaas

- **Evidence**: [Retrieve extract](https://docs.asaas.com/reference/retrieve-extract) — o extrato oficial representa movimentos que impactaram o saldo e é recomendado para reconciliação, auditoria, relatórios, taxas, transferências, reembolsos e sincronização com sistemas externos.
- **Evidence**: [List payments with summary data](https://docs.asaas.com/reference/list-payments-with-summary-data) — o Asaas oferece paginação e filtros por cliente, método, status, parcelamento, referência externa, data de pagamento e checkout.
- **Evidence**: `src/app/(admin)/admin/financeiro/financial-operations.tsx:215-270` — o Hub já importa períodos fechados, pagina, deduplica e informa inserções/atualizações e retomada por cursor.
- **Evidence**: `docs/integrations/asaas.md:527-567` — a conciliação por Pedido e por extrato são comandos distintos; o extrato não possui vínculo contratual direto com `payment`, e o Hub deliberadamente não associa tarifa por proximidade de data/valor.
- **Evidence**: `src/app/(admin)/admin/financeiro/page.tsx:291-323` e `:492-521` — a superfície atual mostra métricas agregadas e receita por Curso, mas a importação do extrato não tem, nesta página, uma saída operacional equivalente para reconciliação externa.
- **Impact**: sem exportação normalizada, a operadora precisa reconstruir uma conciliação em duas telas ou extrair manualmente do provider. Se a tela tratar receita por Curso como livro contábil, pode esconder taxas, transferências e movimentos sem correlação direta; uma associação aproximada pode atribuir dinheiro ao Pedido errado.
- **Effort**: M (um dia-ish) — contrato de exportação, seleção de período/filtros, testes de valores e marcação de linhas não correlacionadas.
- **Risk**: HIGH — dinheiro, arredondamento, estados terminais e exportação para áreas externas exigem verificação cuidadosa.
- **Confidence**: HIGH — o endpoint oficial explicita a finalidade do extrato e o próprio domínio local já separa evidência financeira de projeção de acesso.
- **Fix sketch**: Manter no Hub o resumo por Pedido/Curso e a fila de Revisões; oferecer exportação de extrato importado, evidências de pagamento, `payment_reviews` e chaves de correlação, declarando quando uma linha não tem vínculo contratual. Linkar o Asaas para o movimento original e para filtros/ajustes que o provider não replica; não construir um segundo painel contábil completo.

### [DIRECTION-05] Use a JMVStream como provider de mídia e mantenha uma projeção local mínima

- **Evidence**: [JMVStream Public API](https://jmvstream.com/en/developer) — a API pública documenta listagem paginada de vídeos, consulta por hash, galerias, movimentação, renomeação, thumbnail, deleção assíncrona e consulta de conversão/status.
- **Evidence**: [JMVStream REST API for Videos](https://jmvstream.com/pt-br/rest-api-for-videos/) — a página oficial afirma que o portal e a API cobrem gerenciamento de vídeos/galerias e que a plataforma se integra a plataformas de cursos; o portal é usado para geração de token e operações nativas.
- **Evidence**: `docs/integrations/jmvstream.md:42-48` — o modelo local declara que `jmvstream_folders` e `jmvstream_video_assets` precisam ser reconciliados com o ativo externo e não o substituem.
- **Evidence**: `src/features/admin/jmvstream-assets.ts:3-23` — a projeção consumida pelo Admin é pequena: hash, galeria, arquivo, estado de upload/deleção e erro seguro.
- **Evidence**: `src/features/jmvstream/player-sync.ts:58-103` — o Hub consulta o vídeo por hash, obtém player/thumbnail, consulta status de conversão e persiste `ready`, `pending` ou falha; `:166-208` trata divergência de galeria como estado operacional separado.
- **Evidence**: `src/app/(admin)/admin/configuracoes/page.tsx:63-106` e `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx:63-105` — o Admin já mostra saúde agregada na configuração e o ativo ligado à Aula, sem tentar renderizar o catálogo inteiro do provider.
- **Impact**: replicar catálogo, tags, analytics, controles de privacidade e gestão de arquivos da JMVStream dentro do Hub criaria duas interfaces e duas fontes de verdade para operações destrutivas. Ao mesmo tempo, guardar somente a URL do player deixaria a Aula sem join estável, sem recuperação de upload e sem diagnóstico de processamento/deleção.
- **Effort**: M para explicitar ownership e links; L se a equipe decidir importar catálogo/analytics ou sincronização bidirecional.
- **Risk**: HIGH — deleção, mudança de galeria, player inválido ou hash incorreto afetam conteúdo entregue às Alunas.
- **Confidence**: HIGH para a separação de responsabilidades do código/API; MED para detalhes do portal, porque a documentação pública de operação é limitada.
- **Fix sketch**: Manter no Hub Curso/Módulo/Aula, publicação, acesso, comentários, progresso e o vínculo mínimo do provider: hash, galeria esperada, player, thumbnail, estado de upload/processamento/deleção, timestamps e erro seguro. Exibir alerta na saúde operacional, detalhe na Aula e link para o portal para catálogo completo, analytics e controles nativos. Exportar o mapeamento somente para reconciliação/migração; não clonar a administração de mídia.

### [RISK-01] Bloqueie a dependência de webhooks JMVStream até validar o contrato

- **Evidence**: [JMVStream Public API](https://jmvstream.com/en/developer) — a referência técnica pública consultada documenta polling de conversão (`converting` e `job-status`) e estados `COMPLETED`, `CONVERTING`, `ERROR` e `AWAIT_CONVERSION`, mas não apresenta um catálogo equivalente de webhooks de VOD, payloads, assinatura ou replay.
- **Evidence**: [JMVStream REST API for Videos](https://jmvstream.com/pt-br/rest-api-for-videos/) — uma página oficial atualizada em 2026-05-04 anuncia webhooks para upload/conversão/live/views, retry exponencial, HMAC e reenvio manual no portal, sem publicar o schema operacional desses eventos na referência técnica consultada.
- **Evidence**: `docs/integrations/jmvstream.md:69-80` — o repositório já registra uma contradição de contrato em `gallery` e exige prova controlada antes de alterar o payload.
- **Evidence**: `docs/integrations/jmvstream.md:82-101` e `src/features/jmvstream/player-sync.ts:80-103` — o fluxo atual usa cron/sincronização e consulta de status para recuperar player, processamento, erro e posição na galeria.
- **Impact**: acoplar o Admin a nomes de eventos, assinatura ou semântica de replay não publicados pode gerar um painel que parece em tempo real, mas perde estados, duplica sincronizações ou trata um retry do provider como novo upload. A complexidade de uma segunda inbox só se justifica depois de contrato verificável.
- **Effort**: S para um spike/probe com o fornecedor; L para implementar uma integração durável depois de confirmar schema, assinatura, retry, retenção, ordenação e escopo do plano.
- **Risk**: HIGH — contrato externo incompleto e efeitos em ativos reais; `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION` não cria isolamento técnico.
- **Confidence**: HIGH sobre a diferença entre as duas páginas públicas; MED sobre a disponibilidade real no plano, no portal ou em documentação privada.
- **Fix sketch**: Não substituir o polling atual por webhook por inferência da página de marketing. Solicitar ao fornecedor o contrato de VOD e confirmar plano, endpoint, assinatura, eventos, reenvio e retenção; capturar request/response sem segredos em ambiente controlado e registrar a decisão. Até então, mostrar atraso/falha como alerta, manter a sincronização periódica e linkar o portal.

### [DIRECTION-06] Defina ownership explícito para metadados Aula versus vídeo

- **Evidence**: `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx:151-185` — o Hub exibe Curso, Módulo, título, duração, conteúdo, anexos, comentários e status de publicação no editor da Aula.
- **Evidence**: `src/features/admin/lesson-video-form.ts:64-106` — o formulário decide entre link manual e ativo JMVStream e pode apagar o ativo externo quando a Aula passa a usar outro link.
- **Evidence**: [Canvas Studio API: search all media](https://community.instructure.com/en/discussion/409368/studio-api-to-search-all-media) — operadores relataram precisar saber quem possui cada mídia e em que cursos ela é usada; a falta de transparência administrativa foi apontada como obstáculo.
- **Evidence**: [Canvas Studio API discussion](https://community.instructure.com/en/discussion/528097/the-new-api-support-for-studio-ready-to-explore-it) — discussão de operadores e mantenedores separa o LMS como contexto de curso/uso e o sistema de mídia como gestão account-wide, retenção, ownership e insights.
- **Evidence**: [Canvas embedding documentation](https://community.instructure.com/en/kb/articles/660489) — o LMS pode embutir a mídia e preservar contexto de detalhes, captions, comentários e analytics no fluxo de aprendizagem, sem implicar que todo o gerenciamento do ativo deva ser duplicado no LMS.
- **Impact**: sem ownership explícito, título, descrição, thumbnail, permissões, localização de Curso e estado de processamento podem divergir entre Hub e JMVStream. A operadora passa a corrigir o mesmo fato em dois portais, enquanto a Aluna pode receber uma Aula publicada com player ou metadata desatualizados.
- **Effort**: M (um dia-ish) — registrar contrato de campos, exibir IDs/estado dos dois lados e ajustar links; não exige sincronização bidirecional ampla.
- **Risk**: MED/HIGH — a decisão errada pode transformar um campo editorial ou de acesso em mutação destrutiva no provider.
- **Confidence**: MED — os relatos são observações de uma comunidade específica; a recomendação é uma inferência aplicada à arquitetura local, não uma regra universal de LMS.
- **Fix sketch**: Tornar o Hub autoridade para Curso, Módulo, Aula, publicação, acesso e experiência pedagógica; tornar a JMVStream autoridade para arquivo, conversão, player, galeria, entrega e analytics do provider. Mostrar no detalhe o mapeamento e a última sincronização; deixar edição de mídia nativa no portal, salvo upload/deleção já encapsulados e auditados pelo Hub.

## Veredito sobre redundância e remoção

- A remoção mais bem sustentada é a lista detalhada de webhooks da home. O dado,
  a inbox e o detalhe financeiro devem permanecer.
- Não há evidência externa para remover a inbox Asaas, `payment_reviews`, o
  extrato importado ou os ativos JMVStream locais. Eles representam estado local,
  correlação, recuperação e auditoria que os portais não conhecem.
- O candidato real a evitar é uma nova réplica do portal JMVStream ou dos logs de
  entrega Asaas. A recomendação é alerta/resumo local, detalhe acionável e link
  provider, não duplicação de catálogo, fila e analytics externos.
- Receita confirmada, saúde de checkout e backlog podem aparecer resumidos em
  mais de uma superfície quando a função for triagem versus detalhe. A lista de
  webhooks é diferente: é a mesma coleção e os mesmos campos, com ação de retry
  somente em Financeiro; por isso a duplicação é de baixa utilidade.

## Referências externas consultadas

### Documentação oficial do Asaas

- [Webhook Events](https://docs.asaas.com/docs/webhooks-events)
- [Create a new Webhook through the web application](https://docs.asaas.com/docs/create-new-webhook-via-web-application)
- [Webhooks FAQ](https://docs.asaas.com/docs/webhooks-faq)
- [Delivery Types](https://docs.asaas.com/docs/send-types)
- [Webhooks Logs](https://docs.asaas.com/docs/webhooks-logs)
- [Queue Penalty](https://docs.asaas.com/docs/queue-penalty)
- [List payments with summary data](https://docs.asaas.com/reference/list-payments-with-summary-data)
- [Retrieve extract](https://docs.asaas.com/reference/retrieve-extract)
- [Introduction - Payments](https://docs.asaas.com/docs/payments-overview)

### Documentação oficial do JMVStream

- [JMV Public API](https://jmvstream.com/en/developer)
- [REST API for Videos](https://jmvstream.com/pt-br/rest-api-for-videos/)
- [JMVStream platform](https://jmvstream.com/en)

### Plataformas de cursos/commerce e produtos de Admin

- [Thinkific Analytics](https://support.thinkific.com/hc/en-us/articles/360040037093-Thinkific-Analytics)
- [Thinkific Site Settings](https://support.thinkific.com/hc/en-us/articles/360030719753-Site-Settings)
- [Shopify: Navigating the Shopify admin](https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview?links=false)
- [Shopify Analytics dashboard](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/overview-dashboard)
- [Shopify order analytics](https://help.shopify.com/en/manual/fulfillment/managing-orders/analytics/order-analytics)
- [Kajabi dashboard](https://help.kajabi.com/articles/account-settings/my-kajabi/dashboard-explained)

### Discussões, padrões e relatos de operadores

- [Standard Webhooks specification](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- [Stack Overflow: duplicate webhook events in Laravel](https://stackoverflow.com/questions/79998813/how-can-i-prevent-duplicate-webhook-events-from-being-processed-in-laravel/79998827)
- [Stack Overflow: consistency of data from webhook](https://stackoverflow.com/questions/44869495/how-to-ensure-consistency-of-data-from-webhook)
- [Reddit: best practices for handling webhooks reliably](https://www.reddit.com/r/webdev/comments/1nrtlcp/best_practices_for_handling_webhooks_reliably/)
- [Instructure Community: search all Studio media](https://community.instructure.com/en/discussion/409368/studio-api-to-search-all-media)
- [Instructure Community: Studio API and admin/media operations](https://community.instructure.com/en/discussion/528097/the-new-api-support-for-studio-ready-to-explore-it)
- [Canvas: embedding Studio media](https://community.instructure.com/en/kb/articles/660489)

Pesquisa acessada em 2026-09-08. As recomendações são inferências para o Hub,
não afirmações de que uma plataforma externa seja universalmente superior.
