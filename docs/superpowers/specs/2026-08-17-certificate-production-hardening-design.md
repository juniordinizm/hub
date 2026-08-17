---
status: accepted
owner: engineering
last_verified_commit: f8da69a78d382408d90f33545469d71be237f5e3
---

# Hardening de conclusão e Certificados para Production

## Objetivo

Tornar determinístico, recuperável e verificável o fluxo que começa na conclusão
da última Aula obrigatória e termina com Certificado pronto, e-mail entregue,
download privado e validação pública. O sprint também restaura a CI quebrada pela
separação entre entrega, vitrine e vendas.

## Decisões de produto

- A primeira `CourseCompletion` é o único gatilho automático de emissão.
- Conclusões anteriores à habilitação do Certificado não geram emissão silenciosa.
- Um Admin vê a quantidade elegível e confirma explicitamente a reconciliação.
- A reconciliação processa lotes limitados, auditados e idempotentes; a interface
  mantém a contagem restante até não haver pendências.
- Revogação continua bloqueando qualquer nova emissão automática. Uma substituição
  exige `reissueCertificate`.
- O PDF permanece privado. A consulta pública nunca entrega o artefato.

## Fluxo de conclusão consistente

`completeLesson` adquire o mesmo advisory lock de Conta + Curso usado pelo ciclo
de Certificado antes de gravar o progresso e apurar a publicação vigente. Com o
lock mantido até o commit, duas últimas Aulas concluídas em paralelo são
serializadas: a segunda transação enxerga ambas e cria a conclusão.

`issueCompletionCertificateIfEligible` insere `CourseCompletion` com
`ON CONFLICT DO NOTHING RETURNING`. Somente a transação que criar a primeira
conclusão tenta a emissão automática. Retries e eventos tardios continuam
idempotentes, mas não transformam habilitação posterior em gatilho implícito.

## Reconciliação confirmada pelo Admin

A projeção administrativa do Curso expõe uma contagem de `CourseCompletion` sem
qualquer Certificado histórico para o mesmo par Conta + Curso, desde que o Curso
esteja com Certificado habilitado, template publicado e perfil emissor válido.

No painel de Certificado, o Admin recebe uma seção compacta com contagem e ação
`Emitir certificados pendentes`. A confirmação explica que cada emissão produzirá
PDF e e-mail. A Server Action exige `confirmed=yes` e permissão administrativa.

Cada execução bloqueia o Curso, seleciona no máximo 100 conclusões elegíveis em
ordem estável e cria Certificados usando:

- a publicação e data preservadas em `CourseCompletion`;
- o título e carga horária da publicação de origem;
- o nome atual da Conta no instante da emissão;
- o template publicado e perfil emissor atuais.

Cada criação grava auditoria com origem `admin_reconciliation` e uma intenção
`certificate.render`. Ao final, a ação devolve quantidade emitida e restante. A
unicidade parcial de Certificado válido e o lock Conta + Curso tornam retries
seguros.

## Outbox e fencing

Todas as transições de mensagem reivindicada passam a informar se a worker ainda
possuía o lease. Zero linhas alteradas significa `lease_lost`, interrompe o lote e
não contabiliza entrega, retry ou dead letter.

Para `certificate.render`, mover a mensagem para `dead_letter` e mudar o
Certificado de `pending` para `failed` ocorre numa única operação transacional
condicionada ao `locked_by` vigente. O runner deixa de alterar o agregado numa
segunda etapa sem fencing.

Backlog antigo e qualquer dead letter da outbox geram alertas operacionais na
Auditoria. O cron agregado não atribui todas as falhas ao Resend; os códigos
`certificate_render_failed`, `resend_delivery_failed` e demais códigos de tópico
continuam sendo a fonte da triagem.

## Segurança e confirmação

Os schemas de emissão, revogação, reemissão e reconciliação exigem
`confirmed=yes`. A confirmação cliente melhora a experiência, mas não é a
autoridade do comando.

A redação de códigos de Certificado usa uma função única para request URL,
breadcrumbs, transações e spans do Sentry. O caminho normalizado preserva a rota
`/certificados/[certificate-code]`, sem query string ou código real.

## Experiência da Aluna

Ao criar Certificado na conclusão manual, o redirect inclui um sinal descartável
para que a página do Curso apresente confirmação acessível de conclusão e emissão.
O estado `failed` informa falha e aponta para suporte; não usa texto de preparo.

Enquanto houver Certificado `pending`, a lista atualiza os dados em intervalo
moderado somente quando a aba estiver visível e encerra o polling quando não houver
pendências. O e-mail direciona à área autenticada `/app/certificados`, onde o PDF
fica disponível, mantendo o código no corpo para validação pública.

## E2E e ambiente de teste

O seed principal cria o Curso comprável com `catalog_visibility=listed` e
`sales_status=open`, restaurando as jornadas quebradas.

O Curso de conclusão E2E recebe uma Aula obrigatória, template publicado, perfil
emissor e Certificado habilitado. A jornada:

1. conclui a última Aula pela interface;
2. confirma estado `pending`;
3. chama o cron autenticado da outbox;
4. confirma estado `ready` em `/app/certificados`;
5. baixa o PDF privado como proprietária;
6. valida o código na página pública;
7. confirma que `email.certificate-issued` foi entregue.

O transporte de e-mail E2E é um sink em memória, habilitado somente quando
`CI=true`, `E2E_TEST_MODE=true` e as origens canônicas são loopback. O sink não
existe como rota utilizável em Development, Staging ou Production e nunca chama o
Resend. O teste consulta seu resultado por uma fronteira igualmente protegida.

A integração PostgreSQL acrescenta:

- duas últimas Aulas distintas concluídas em paralelo;
- reconciliação concorrente e repetida;
- revogação e reemissão com locks reais;
- reclaim da outbox seguido por terminalização tardia;
- retry de `certificate.render` de `failed` até `ready`.

## Documentação e rollout

Atualizar o domínio de Certificados, aprendizagem, outbox, observabilidade, R2,
ambiente E2E e ADR-0006. A documentação deve registrar que publicação posterior
exige reconciliação confirmada e que a primeira conclusão é o único gatilho
automático.

Gates obrigatórios:

- testes focais em red-green;
- `bun run db:migrations:check`;
- `bun run docs:check`;
- `bun run verify`;
- integração PostgreSQL isolada;
- E2E Chromium completo sem retry;
- `git diff --check`.

Depois dos gates locais, a branch deve passar integralmente pela CI. Somente então
pode ser promovida para Staging, onde a homologação real confirma cron, R2 e Resend
com uma Conta de teste autorizada. Production permanece fora do escopo até essa
homologação e autorização explícita de release.

## Fora de escopo

- emissão pública sem autenticação;
- download público do PDF;
- editor de campanhas de e-mail;
- alteração de snapshots já emitidos;
- emissão silenciosa em massa ao publicar template;
- mudança do modelo de currículo vivo definido no ADR-0007.
