---
status: accepted
owner: engineering
last_verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
audit_result: no-go
audit_date: 2026-08-23
---

# Auditoria de Production Readiness

## 1. Executive Summary

**Veredito:** `NO-GO` em 23 de agosto de 2026.

O sistema apresentou uma base técnica consistente, build e testes amplos aprovados,
integrações principais funcionais e nenhum P0 confirmado. Ainda assim, dois P1 impedem
uma liberação responsável:

1. o papel `support` atravessa fronteiras de autorização e consegue executar operações
   de banner e consultar/exportar analytics fora da matriz ratificada;
2. a recuperação do banco depende de uma janela curta do Neon e de backups de release,
   sem cópia independente, retenção adequada e restauração integral comprovada.

Foram confirmados ainda cinco P2 e três P3. Eles incluem corrida no rate limit de
suporte, avisos de expiração obsoletos, ausência de lifecycle real de e-mail, DMARC sem
enforcement, documentação operacional divergente, senha inconsistente, cobertura E2E
reduzida e ausência de atualização automática de dependências JavaScript/Bun.

O resultado não significa que o produto esteja estruturalmente instável. Significa que
os mecanismos de segurança, recuperação e prova operacional ainda não sustentam o
nível de confiança exigido para clientes reais.

### Contagem por severidade

- P0: 0
- P1: 2
- P2: 5
- P3: 3

### Principais sinais positivos

- documentação, migrations, tipos, lint, testes unitários e build aprovados;
- 1.981 testes aprovados na execução registrada;
- auditorias de dependências sem vulnerabilidade conhecida no momento da inspeção;
- banco em PostgreSQL 18.6, sem grants indevidos para `PUBLIC`;
- deployment Vercel em estado `READY`, sem erros, warnings ou fatals observados na
  janela consultada;
- domínio Resend verificado, com SPF e DKIM válidos;
- CI principal verde no commit auditado;
- inbox, outbox, pagamentos, acesso e Certificados possuem mecanismos explícitos de
  idempotência e auditoria, embora existam as lacunas descritas abaixo.

## 2. Escopo e evidências da auditoria

### Base examinada

- repositório local no commit
  `9f2b8f177e7531f1c19242099f403c55b3820d08`;
- documentação canônica iniciada em `docs/README.md`;
- código Next.js, regras de domínio, schema, migrations, testes e workflows;
- estado de Production em Vercel, Neon/PostgreSQL, Resend e Sentry;
- relatórios de CI, dependências e comandos locais não destrutivos;
- decisões ratificadas em `docs/decisions.md` e guias de domínio/operação.

### Método

A auditoria foi somente leitura. Cada suspeita foi confrontada com código, testes,
schema, documentação e, quando disponível, estado real do provider. Ausência de
evidência foi registrada como unknown ou gate pendente, não convertida automaticamente
em finding.

As categorias examinadas incluíram:

- arquitetura e separação de responsabilidades;
- identidade, sessão, autenticação e autorização;
- comércio, Asaas, reembolso, acesso e projeções;
- PostgreSQL, Neon, migrations, backup e recuperação;
- Vercel, jobs, deploy e operação;
- Resend, outbox, reputação e lifecycle de entrega;
- Sentry, logs, alertas e source maps;
- frontend, UX, mobile e acessibilidade;
- testes, CI, dependências e supply chain;
- privacidade, dados sensíveis e trilhas de auditoria;
- custos e compatibilidade com os planos vigentes.

### Limites deliberados

Não foram executados durante a auditoria:

- venda real em Production;
- restauração destrutiva sobre banco compartilhado;
- jornadas E2E que exigissem criar ou mutar uma branch Neon não isolada;
- alteração DNS de DMARC;
- injeção de erro em Production;
- qualquer correção ou commit.

Essas exclusões preservaram o caráter somente leitura. Onde impediram conclusão,
aparecem como gate ou unknown.

## 3. Visão da arquitetura

O Hub é uma aplicação Next.js App Router executada na Vercel. PostgreSQL/Neon é a fonte
de estado. Better Auth implementa identidade e sessão; RBAC próprio define
`student`, `support` e `admin`. Asaas fornece checkout e eventos financeiros. Resend
envia e-mails. Cloudflare R2 armazena mídia e artefatos privados/públicos. JMVStream
fornece vídeo. Sentry recebe telemetria.

Os principais fluxos duráveis usam inbox e outbox:

1. o evento externo é autenticado e persistido;
2. o worker reivindica a mensagem com lease;
3. regras de domínio atualizam Pedido, Concessão e Matrícula em transação;
4. efeitos externos são enfileirados;
5. workers executam entrega, retry ou dead letter.

A arquitetura é adequada ao porte atual. Os problemas encontrados não exigem
substituição da plataforma; exigem aprofundar fronteiras, lifecycle e provas de
recuperação.

## 4. Production Blockers

### F-001: `support` atravessa fronteiras administrativas

- **Severidade:** P1
- **Status na auditoria:** confirmado
- **Confiança:** alta

#### Evidência

- `deleteBannerAction` e `reorderBannersAction`, em
  `src/features/admin/actions.ts`, aceitam `admin` e `support` diretamente.
- `saveBannerAction` exige apenas `admin`, demonstrando uma matriz contraditória dentro
  do mesmo agregado.
- `getLessonAnalyticsMetrics`, em
  `src/features/learning-analytics/server.ts`, exige somente `viewAdminPanel`.
- a exportação administrativa reutiliza a mesma fronteira ampla.
- `src/lib/auth-policy.ts` concede `viewAdminPanel` a `support`, mas não
  `manageSettings` nem `manageLearningAnalytics`.
- a versão então vigente de `DEC-DISC-014`, em `docs/decisions.md`, ratificava os
  nomes agregados das permissões sem enumerar operações permitidas e proibidas;
  ela não estabelecia uma necessidade positiva para banners ou analytics.

#### Cenário reproduzível

Uma sessão válida com papel `support` chama diretamente as Server Actions de remoção ou
reordenação de banner, ou acessa a projeção/exportação de analytics. O servidor aceita
a sessão por papel ou pela permissão genérica do painel. Ocultar botões não impede a
chamada.

#### Impacto

- alteração ou remoção de conteúdo público sem autoridade;
- exclusão de objetos associados nos buckets privado e público;
- acesso a dados administrativos sem necessidade operacional ratificada;
- impossibilidade de afirmar least privilege para uma Conta operacional;
- risco maior caso a role seja atribuída a terceiros.

#### Correção requerida

- substituir gates por papel ou `viewAdminPanel` por capacidades específicas;
- cobrir consultas, Route Handlers, Server Actions, exports e mídia privada;
- adicionar testes negativos de chamada direta para `support`;
- auditar toda a superfície administrativa, não apenas os dois pontos detectados.

#### Decisão posterior à fotografia

Após a auditoria, o produto aprovou um redesenho completo de `support`. O papel poderá
ver operação de Cursos, Alunas e financeiro; ajustar Matrícula existente; executar
reembolso integral; e reemitir o último Certificado. Autoria, configurações, analytics
pedagógico, mutações financeiras técnicas, bloqueio de plataforma, emissão/revogação de
Certificado e auditoria global permanecem exclusivas de `admin`. A decisão detalhada
está na especificação de remediação; ela não altera o fato de `F-001` estar aberto no
commit auditado.

#### Validação de encerramento

- matriz positiva e negativa para `student`, `support` e `admin`;
- chamadas diretas a todos os comandos proibidos retornam negação antes de mutação;
- queries proibidas não são executadas;
- navegação e UI refletem, sem substituir, a proteção do servidor;
- sessões são revogadas em mudança de papel;
- TOTP de contas privilegiadas é exercitado.

### F-002: recuperação do Neon é insuficiente e não foi restaurada

- **Severidade:** P1
- **Status na auditoria:** confirmado
- **Confiança:** alta

#### Evidência externa datada

- projeto Neon: `damp-snow-22911188`;
- branch de Production: `br-dark-boat-ac5ju6m4`;
- branch sem proteção no provider;
- `history_retention_seconds=21600`, equivalente a 6 horas;
- backups de release com retenção operacional de 14 dias mitigam releases, mas não
  formam política independente de backup de dados;
- o drill existente validava passos e evidência operacional, mas não comprovava
  restauração integral de um banco representativo;
- não foi localizada prova atual de PITR/restauração com RPO e RTO medidos.

#### Cenário

Corrupção lógica descoberta após a janela, perda de projeto/provider, credencial
comprometida ou erro operacional pode deixar o time sem ponto independente e testado.
Uma instrução de recuperação sem restauração real não prova que versões, chaves,
extensions, migrations e dados são recuperáveis no prazo.

#### Impacto

- perda irreversível ou restauração parcial de dados de clientes;
- RPO e RTO desconhecidos;
- release sem capacidade comprovada de rollback de dados;
- dependência de um único provider e de uma janela curta.

#### Correção requerida

- cópia lógica independente em storage privado;
- credenciais mínimas e backup sem secrets;
- manifestos, checksums, retenção e alerta de frescor;
- restauração em PostgreSQL 18 descartável;
- medição de RPO/RTO e consumo das cotas gratuitas;
- gate de release quando backup estiver ausente ou inválido.

#### Restrição posterior aprovada

O projeto deve permanecer em planos gratuitos, exceto Vercel por enquanto. A solução
aprovada combina Neon, GitHub Actions e bucket Cloudflare R2 exclusivo. O alvo é RPO de
6 horas e RTO de 4 horas, condicionado à medição real das cotas. Upgrade ou trial não
pode ser fallback silencioso.

#### Validação de encerramento

- dump íntegro, criptografado e verificável;
- retenção das últimas 24 horas, 7 dias e 4 semanas;
- restauração completa e checks de domínio aprovados;
- evidência sanitizada do tempo de recuperação;
- projeção mensal dentro dos limites gratuitos;
- último backup dentro da janela no gate de promoção.

## 5. Findings completos

### F-003: rate limit de suporte possui corrida check-then-act

- **Severidade:** P2
- **Status:** confirmado
- **Confiança:** alta

`createSupportRequest`, em `src/features/support/server.ts`, conta solicitações recentes
usando o pool antes de abrir a transação que insere `support_requests` e a mensagem da
outbox. Duas chamadas simultâneas podem observar a mesma contagem e ultrapassar o limite
de três solicitações em dez minutos.

O risco é abuso, spam operacional e quebra de um controle anunciado. O insert e a
outbox já são atômicos; a decisão do rate limit não é.

**Correção:** adquirir advisory lock transacional por Conta, executar contagem e insert
na mesma conexão/transação e manter a outbox no mesmo commit.

**Teste decisivo:** integração PostgreSQL com múltiplas conexões liberadas em paralelo,
provando que no máximo três agregados e três efeitos são persistidos.

### F-004: aviso de expiração pode entregar uma geração obsoleta

- **Severidade:** P2
- **Status:** confirmado
- **Confiança:** alta

`rebuildEnrollmentProjection`, em `src/features/enrollments/server.ts`, limpa os flags de
aviso quando a validade muda. Isso permite aviso para a nova validade, como esperado.
Porém `createAccessExpiryWarningMessage`, em `src/features/outbox/rules.ts`, constrói a
idempotency key apenas com Matrícula e tipo `7d`/`1d`. `enqueueOutboxMessage`, em
`src/features/outbox/server.ts`, usa conflito idempotente sem atualizar a intenção. Em
`deliverOutboxMessage`, `src/features/outbox/delivery.ts` busca a Matrícula atual, mas
não compara sua validade com a validade que originou a mensagem.

Uma mensagem antiga pode sobreviver a extensão/redução da validade, bloquear a nova
geração por conflito e enviar texto incorreto dias depois.

**Correção:** incluir `expectedExpiresAt` no payload e na chave, revalidar estado,
validade e janela imediatamente antes do envio e terminar mensagens antigas como
`superseded`, nunca como entregues.

**Testes decisivos:** extensão entre enqueue e delivery, redução, expiração, bloqueio,
retry duplicado e concorrência com o worker.

### F-005: o Resend não possui lifecycle de entrega no Hub

- **Severidade:** P2
- **Status:** confirmado
- **Confiança:** alta

`sendHostedEmail`, em `src/features/email/server.ts`, trata resposta sem erro como
sucesso. `runOutboxWorker`, em `src/features/outbox/worker.ts`, terminaliza o efeito
interno após o adapter retornar. Não existe Route Handler de webhook Resend, inbox,
tabela de eventos ou projeção de `delivered`, `bounced` e `complained`. O domínio Resend
consultado possuía zero webhooks configurados.

Aceitação pelo provider não prova entrega ao destinatário. Isso impede medir falhas,
tratar bounce/complaint e distinguir transport accepted de recipient delivered.

**Correção:** registrar aceitação por message ID, receber webhooks assinados em inbox
idempotente, guardar eventos sanitizados append-only e derivar estado sem regressão por
evento fora de ordem.

Recuperação de senha deve permanecer fora da outbox conforme `DEC-DISC-015`; o lifecycle
não pode persistir token, URL ou corpo sensível.

**Testes decisivos:** assinatura inválida, duplicata, evento anterior à aceitação local,
ordem invertida, bounce após accepted, complaint terminal e ausência de secrets.

### F-006: DMARC não aplica política

- **Severidade:** P2
- **Status:** confirmado
- **Confiança:** alta

O domínio estava verificado no Resend em `sa-east-1`, com SPF e DKIM válidos. O registro
DMARC permanecia em `p=none`. Esse estado coleta sinal, mas não orienta quarantine ou
rejeição de mensagens não alinhadas.

**Impacto:** proteção incompleta contra spoofing e ausência de estado final explícito de
reputação.

**Correção ratificada:** relatórios em caixa institucional e progressão
`none -> quarantine 25% -> quarantine 100% -> reject 25% -> reject 100%`, com janelas de
observação, inventário de remetentes e rollback ao estágio anterior.

**Validação:** SPF/DKIM alinhados para todos os remetentes legítimos, relatórios sem falha
não explicada e `p=reject; pct=100` estável.

### F-007: documentação canônica diverge do runtime

- **Severidade:** P2
- **Status:** confirmado
- **Confiança:** alta

Na data da auditoria:

- Vercel Production executava o commit `9f2b8f1`, enquanto
  `docs/operations/release-state.md` declarava `bbf89ad`;
- `README.md`, `docs/architecture.md` e
  `docs/operations/database-and-migrations.md` declaravam migration superior `0062`;
- o journal local e Production estavam em `0064`, com 65 entradas aplicadas;
- `docs/domain/identity-and-authorization.md` afirmava que `support` aguardava
  ratificação, mas `DEC-DISC-014` já estava ratificada;
- `bun run docs:check` continuava verde porque verificava forma, links e existência do
  commit, não essas relações semânticas.

**Impacto:** operador pode tomar decisão de release, rollback ou migração com base em
estado antigo.

**Correção:** sincronizar fatos atuais agora; fazer `docs:check` comparar a migration
superior; e criar check online separado para Vercel/Neon. Workflow deve falhar, nunca
editar Markdown automaticamente.

**Validação:** documento canônico, journal, banco e deployment concordam; um fixture de
documentação obsoleta falha com erro explícito.

### F-008: política de senha diverge entre cadastro e redefinição

- **Severidade:** P3
- **Status:** confirmado
- **Confiança:** alta

Servidor e cadastro exigem mínimo de 8 caracteres. A interface/schema de redefinição
exige 10. Uma senha aceita no cadastro pode ser recusada ao ser redefinida, sem decisão de
produto que justifique a diferença.

**Correção ratificada:** mínimo de 8 em Better Auth, cadastro, redefinição, mensagens e
testes, a partir de fonte compartilhada.

**Validação:** 7 falha e 8 passa em todas as superfícies; reset revoga sessões e mantém
proteções existentes.

### F-009: cobertura de acessibilidade e mobile é estreita

- **Severidade:** P3
- **Status:** confirmado
- **Confiança:** média-alta

A configuração observada executava Playwright principalmente em Desktop Chrome. Axe
bloqueava somente violações `serious` e `critical`. Existiam testes e mitigações
pontuais de teclado/mobile, mas não uma matriz sistemática das jornadas críticas.

**Impacto:** regressões moderadas, foco, ordem de tabulação e layouts mobile podem passar
pela CI.

**Correção:** Chromium desktop e emulação mobile; jornadas essenciais por teclado; Axe a
partir de `moderate`; divisão da matriz entre PR/main/schedule para respeitar a cota
gratuita.

**Validação:** falha intencional de fixture é detectada, nenhuma exceção global e
jornadas críticas passam sem retry.

### F-010: dependências JavaScript/Bun não recebem atualização automática

- **Severidade:** P3
- **Status:** confirmado
- **Confiança:** alta

`.github/dependabot.yml` cobre apenas `github-actions`. Não existe automação equivalente
para `package.json` e o lockfile Bun.

**Impacto:** patches de segurança e compatibilidade dependem de inspeção manual e podem
ficar invisíveis entre auditorias.

**Correção:** atualização semanal gratuita compatível com Bun, agrupamento pequeno para
patch/minor, major isolado e todos os quality gates.

**Validação:** execução cria proposta válida que atualiza manifest/lockfile e passa
auditoria, tipos, testes e build.

## 6. Segurança

### Achados confirmados

- `F-001` é o finding principal de autorização.
- `F-008` é uma divergência de política, não quebra criptográfica.
- `F-005` e `F-006` reduzem visibilidade e postura de e-mail.

### Evidências positivas

- sessão e permissão são resolvidas no servidor para fluxos sensíveis examinados;
- reembolso integral exige confirmação recente e correlação estrita do Pedido;
- webhooks Asaas entram por fronteira autenticada e inbox durável;
- banco não concedia privilégios de tabelas a `PUBLIC`;
- secrets não foram encontrados em documentação versionada;
- redefinição pública preserva resposta uniforme e não expõe existência de Conta;
- tokens de ativação/redefinição não são persistidos na outbox.

### Observações sem finding

As tabelas não usam RLS. O sistema atual é single-tenant e acessa o banco apenas pelo
backend; por isso a ausência, isoladamente, não foi classificada como vulnerabilidade.
Ela deve ser reavaliada se acesso direto, tenancy ou clientes de banco forem
introduzidos.

## 7. Banco e Neon

### Snapshot datado de Production

- PostgreSQL 18.6;
- aproximadamente 35 MB;
- 43 tabelas da aplicação;
- 65 entradas no journal, até `0064`;
- zero grants de tabela para `PUBLIC`;
- zero tabelas com RLS;
- 12 Pedidos `pending`, 2 `cancelled` e 0 `paid`;
- 4 webhooks processados;
- zero mensagens de outbox, revisões financeiras, Certificados e solicitações de
  suporte;
- 3 sessões persistidas.

Os números são uma fotografia operacional, não expectativas de negócio. Nenhuma PII foi
copiada para este relatório.

### Conclusão

Schema e migrations estavam coerentes entre journal e Production em `0064`. O finding
é de recuperação e documentação, não de migration pendente ou corrupção observada.

## 8. Infraestrutura e Vercel

### Snapshot datado

- deployment mais recente em estado `READY`;
- alias `app.neurocapacitar.com.br`;
- região `gru1`;
- Node.js 24;
- commit implantado `9f2b8f1`;
- nenhum log `error`, `warn` ou `fatal` observado na janela de 24 horas consultada.

Ausência de log não prova ausência de erro. O Sentry permaneceu sem evidência suficiente,
conforme seção própria.

### Conclusão

Não foi confirmado blocker de runtime Vercel. A divergência documental aparece em
`F-007`. A venda real foi deliberadamente excluída da auditoria e permanece validação
pós-deploy.

## 9. E-mail e Resend

### Snapshot datado

- domínio verificado;
- região `sa-east-1`;
- SPF e DKIM verificados;
- seis templates hospedados publicados;
- zero webhooks configurados;
- DMARC em `p=none`.

### Conclusão

O envio básico e os templates existem. Os gaps são lifecycle de destinatário e
enforcement de domínio, `F-005` e `F-006`. A auditoria não sustentou reescrita editorial
ou remoção de React Email como requisito de Production Readiness.

## 10. Sentry e observabilidade

A inspeção da API Sentry retornou 403. Isso impede confirmar por evidência externa:

- release associada ao commit;
- source maps resolvidos;
- issues recentes;
- regras de alerta;
- recebimento pelo canal operacional.

O código possui integração e instrumentação, mas código não prova ingestão nem alerta.
Por isso Sentry é gate crítico desconhecido, não finding confirmado de quebra.

**Gate:** token mínimo de leitura, evento sintético sem PII, stack desminificada e alerta
recebido. Falha em qualquer etapa mantém `NO-GO`.

## 11. Frontend, UX e acessibilidade

Não foi confirmado fluxo essencial visualmente quebrado. Componentes e testes existentes
cobrem semântica e acessibilidade em várias superfícies. O risco confirmado é de
cobertura, descrito em `F-009`:

- apenas um perfil principal de navegador;
- inspeção automatizada limitada a severidades altas;
- teclado e mobile não sistemáticos em todas as jornadas críticas.

A correção não exige redesign visual. Exige matriz reproduzível e critérios de falha.

## 12. Testes e validações executadas

Na auditoria, os seguintes gates terminaram aprovados:

- `bun run docs:check`;
- `bun run db:migrations:check`;
- `bun run typecheck`;
- `bun run check`;
- `bun test`, com 1.981 testes aprovados;
- `bun run build`, com upload/integração externa do Sentry desabilitada somente para a
  execução de auditoria;
- `bun run knip`;
- auditorias de dependências Bun/npm aplicáveis, sem vulnerabilidade conhecida.

Também foi inspecionada a CI remota, em estado verde para o commit auditado.

Não foram executados E2E completos nem integração que exigisse mutação de branch Neon
compartilhada. Essa limitação impede transformar a aprovação local em prova de jornada
real.

## 13. Sistemas ou proteções ausentes

Foram confirmadas as seguintes ausências relevantes:

- backup independente com retenção e restore ensaiado;
- lifecycle de entrega Resend por webhook;
- capacidade granular para cada projeção administrativa;
- validação semântica de migration e estado externo de release;
- atualização automática de dependências JavaScript/Bun;
- matriz E2E mobile/teclado/Axe suficiente;
- evidência operacional verificável do Sentry.

Não foram classificados como ausentes, por já existirem em forma suficiente para a
auditoria: inbox Asaas, outbox transacional, confirmação forte de reembolso, auditoria de
mutações críticas, rate limit público, migration ledger e checks de CI.

## 14. Dívida técnica relevante para Production

- `viewAdminPanel` é usado como permissão de entrada e como autorização de dados;
- alguns módulos verificam papel diretamente enquanto outros usam capacidades;
- `manageEnrollmentAccess` e `manageCertificates` agregam operações de risco distinto;
- fatos voláteis, como migration superior e deployment, estão duplicados em vários
  documentos;
- outbox não modela explicitamente efeito obsoleto;
- estado `delivered` do efeito interno pode ser confundido com entrega de e-mail;
- limites de senha aparecem em mais de uma camada;
- testes de rate limit usam mocks e não provam serialização real.

Essa dívida é relevante porque contribui diretamente para os findings; não é uma lista
genérica de refactors desejáveis.

## 15. Unknowns e itens não verificáveis

- Sentry: API 403, sem prova de issue/source map/alerta.
- Restore: nenhuma restauração integral representativa observada.
- DMARC: relatórios agregados e inventário de remetentes não analisados.
- E2E: matriz completa não executada contra ambiente isolado nesta auditoria.
- Venda real: não executada; por decisão posterior, ocorrerá somente após deploy em
  Production.
- Crescimento: a cadência de backup de 6 horas ainda não foi medida contra 5 GB/mês de
  transferência pública do Neon e 10 GB de storage gratuito do R2.

## 16. Checklist pré-produção

### Bloqueadores

- [ ] Implementar e testar a matriz granular de `support`.
- [ ] Negar banner, configurações, autoria e analytics pedagógico a `support`.
- [ ] Ativar assurance TOTP para Contas privilegiadas.
- [ ] Criar backup independente e retenção gratuita.
- [ ] Restaurar um backup em PostgreSQL 18 dentro do RTO.

### Confiabilidade e comunicação

- [ ] Serializar o rate limit de suporte.
- [ ] Versionar avisos de expiração e descartar gerações obsoletas.
- [ ] Receber e validar webhooks Resend.
- [ ] Separar accepted de delivered/bounced/complained.
- [ ] Avançar DMARC segundo o rollout aprovado.

### Operação e qualidade

- [ ] Corrigir fatos canônicos de release/migration/autorização.
- [ ] Adicionar checks semânticos offline e online.
- [ ] Provar Sentry, source maps e alertas.
- [ ] Uniformizar senha mínima em 8 caracteres.
- [ ] Ampliar mobile, teclado e Axe.
- [ ] Automatizar dependências JavaScript/Bun.
- [ ] Executar todos os gates e emitir nova revisão.

### Pós-deploy

- [ ] Executar smoke tests não destrutivos.
- [ ] Observar jobs, outbox, Resend, Sentry e backup.
- [ ] Obter aprovação humana para uma venda real supervisionada.
- [ ] Registrar Pedido, webhook, acesso, e-mail, financeiro e estorno/conciliação sem
  expor PII.

## 17. Reavaliação do relatório preliminar

### Confirmado

- fronteiras de `support` estavam incompletas;
- recuperação era insuficiente;
- lifecycle Resend e DMARC precisavam de hardening;
- documentação possuía drift;
- quality gates mobile/a11y e dependências eram estreitos.

### Refutado ou reduzido

- não foi confirmado defeito geral de normalização de e-mail no reset: a versão Better
  Auth instalada normaliza o caminho relevante;
- senha mínima de 10 não era contrato do backend; era divergência localizada na
  redefinição;
- não havia evidência para exigir remoção de React Email ou migração editorial ampla dos
  templates;
- ausência de RLS, no modelo single-tenant atual, não foi elevada artificialmente a
  vulnerabilidade.

### Permaneceu desconhecido

- operação real do Sentry;
- restauração completa;
- venda real de ponta a ponta em Production.

## 18. Veredito final

**`NO-GO`.**

O veredito decorre de dois blockers P1 confirmados e de gates críticos ainda sem
evidência. Build e testes verdes não compensam autorização excessiva nem recuperação
não comprovada.

O caminho de reavaliação é objetivo:

1. encerrar `F-001` e `F-002`;
2. implementar os P2 e P3 sem regressão;
3. comprovar Sentry, restore e coerência externa;
4. executar a matriz completa de verificação;
5. publicar nova revisão `GO/NO-GO`;
6. somente após `GO` e deploy, realizar a venda supervisionada.

Este relatório é histórico. Nenhuma implementação posterior deve alterar sua decisão
original; a resolução será registrada com commits e evidências em revisão separada.
