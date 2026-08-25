---
status: accepted
owner: engineering
last_verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
---

# Remediação da prontidão de Production

## Estado da decisão

Este desenho foi aprovado em 23 de agosto de 2026. Ele consolida as decisões de
produto e engenharia necessárias para transformar a auditoria de Production
Readiness concluída na mesma data em um plano executável.

A auditoria permanece uma fotografia histórica com resultado `NO-GO`. Este
documento não altera esse resultado e não declara nenhuma correção como
implementada. A nova decisão `GO/NO-GO` só poderá existir em uma revisão posterior,
após implementação e verificação de todos os gates definidos aqui.

## Objetivo

Encerrar os dez achados da auditoria, resolver as duas lacunas críticas de
evidência e produzir uma fronteira operacional segura para Production sem depender
de upgrade de plano. Vercel é a única exceção temporária à exigência de operação
gratuita. Todo outro componente deve usar plano gratuito permanente; free trial só
pode apoiar um ensaio descartável e nunca pode sustentar o runtime ou a recuperação.

O trabalho abrange:

- autorização e desenho definitivo do papel `support`;
- backup e restauração independentes do Neon;
- concorrência no formulário de suporte;
- idempotência dos avisos de expiração;
- ciclo real de entrega do Resend e postura DMARC;
- coerência entre documentação, deployment e migrations;
- política uniforme de senha;
- cobertura de acessibilidade, teclado e mobile;
- atualização automatizada de dependências;
- comprovação operacional do Sentry;
- requalificação para Production e validação pós-deploy.

Ficam fora do escopo as mudanças editoriais de templates Resend, a remoção de React
Email e qualquer reorganização de e-mail não exigida pelos achados. O plano anterior
de conclusão de e-mail, autenticação e Resend será preservado como material
histórico, marcado como substituído e não executável.

## Fontes e rastreabilidade

Os achados mantêm os identificadores `F-001` a `F-010`. O relatório histórico será
preservado em
`docs/reviews/2026-08-23-production-readiness-audit.md`. Cada tarefa do plano mestre
deverá citar pelo menos um achado ou uma lacuna crítica de evidência.

A base verificada é o commit
`9f2b8f177e7531f1c19242099f403c55b3820d08`. Fatos externos observados durante a
auditoria, como deployment, cotas e estado de providers, são evidência datada e
devem ser consultados novamente no momento da implementação.

## Arquitetura documental

A documentação terá quatro responsabilidades distintas:

1. O relatório em `docs/reviews/` preserva método, evidências, achados, severidade,
   limitações e a decisão histórica `NO-GO`. Ele não será reescrito para simular que
   o sistema sempre esteve corrigido. Resoluções posteriores entram em apêndice com
   commit e evidência.
2. Esta especificação registra as decisões ratificadas. Ela explica o contrato a
   implementar, mas não substitui o plano de execução.
3. O plano mestre em `docs/superpowers/plans/` será a única fonte executável. Ele
   conterá sprints, arquivos, símbolos, testes, comandos, critérios de aceite,
   rollout, rollback e evidências esperadas.
4. Documentos canônicos descrevem somente o comportamento vigente. Fatos já
   incorretos serão sincronizados agora; comportamento futuro só será promovido à
   documentação canônica junto com a respectiva implementação.

O índice `docs/README.md` distinguirá documentação canônica, especificações aceitas,
planos propostos e material histórico. O plano anterior de e-mail receberá
`execution_status: superseded`, um aviso no topo e uma referência ao plano mestre,
sem ser apagado.

## Resultado e prioridades da auditoria

A fotografia inicial contém zero P0, dois P1, cinco P2 e três P3:

- `F-001` (P1): fronteiras de autorização permitem que `support` execute operações
  de banner e consulte/exporte analytics que não pertencem ao papel.
- `F-002` (P1): a recuperação do Neon não sustenta retenção independente e ensaiada.
- `F-003` (P2): o rate limit de solicitações de suporte possui janela de corrida.
- `F-004` (P2): avisos de expiração podem usar geração e validade obsoletas.
- `F-005` (P2): aceitação pelo Resend é tratada como entrega, sem webhook de ciclo de
  vida.
- `F-006` (P2): DMARC permanece em `p=none`.
- `F-007` (P2): documentos canônicos divergem de deployment, migrations e decisão
  ratificada.
- `F-008` (P3): a redefinição de senha exige 10 caracteres enquanto servidor e
  cadastro exigem 8.
- `F-009` (P3): Axe, teclado e mobile cobrem uma matriz menor que a necessária.
- `F-010` (P3): não existe atualização automatizada de dependências JavaScript/Bun.

Além deles, Sentry e restauração são gates críticos de evidência. O acesso à API do
Sentry retornou 403 durante a auditoria; source maps, evento e alerta precisam ser
comprovados. A venda real supervisionada não é gate pré-deploy: ocorrerá manualmente
e somente após a promoção aprovada para Production.

## Redesenho do papel `support`

### Intenção

`support` é uma operadora de atendimento e operação, distinta de `student` e de
`admin`. Não é um Admin limitado por convenção visual. A aplicação deve expressar o
papel por capacidades positivas e negar todo o restante no servidor.

Somente leitura seria insuficiente: o propósito do produto atribui ao Suporte
problemas de acesso, financeiro e Certificados. Manter as permissões amplas atuais
também é incorreto: `manageEnrollmentAccess`, `manageCertificates` e
`viewAdminPanel` agregam operações com riscos diferentes. O desenho separa consulta,
atendimento e autoridade administrativa.

### Capacidades permitidas

`support` poderá:

- entrar no shell operacional da área administrativa;
- ver título e estado operacional dos Cursos, quantidade de Alunas, Matrículas e
  receita, sem abrir superfícies de autoria;
- ver identidade mínima da Aluna, Matrículas, validade, progresso autoritativo,
  Certificados, Pedidos e histórico contextual necessário ao atendimento;
- ajustar a validade e bloquear ou restaurar uma Matrícula existente, sempre com
  motivo obrigatório e auditoria;
- consultar toda a visão financeira, incluindo Pedidos, receita, disputas,
  reembolsos e revisões pendentes;
- executar reembolso integral após 2FA, confirmação recente de senha, digitação do
  identificador do Pedido, motivo e trilha de auditoria;
- reemitir o Certificado histórico mais recente para resolver atendimento;
- consultar auditoria contextual do Pedido, Matrícula, Certificado ou Aluna em
  atendimento.

O conjunto sugerido de capacidades é:

- `viewAdminPanel`, apenas para entrar no shell, sem autorizar dados;
- `viewCourseOperations`;
- `viewStudentOperations`;
- `viewFinancials`;
- `viewScopedAudit`;
- `manageEnrollmentSupport`;
- `reissueCertificates`;
- `executeRefund`.

Os nomes poderão ser ajustados apenas se a intenção permanecer idêntica e a matriz
continuar explícita.

### Capacidades proibidas

`support` não poderá:

- criar, editar, publicar, arquivar ou alterar disponibilidade, oferta, preço,
  Módulos, Aulas, recursos ou templates de Curso;
- gerenciar banners, FAQ, configurações, credenciais ou providers;
- consultar ou exportar analytics pedagógico detalhado;
- criar Concessões, editar perfil ou papel, ou bloquear uma Conta em toda a
  plataforma;
- emitir Certificado manual, revogar Certificado ou reconciliar conclusões
  históricas;
- conciliar pagamento, importar extrato, decidir revisão financeira ou executar
  tratamento técnico de resultado incerto;
- reprocessar webhook ou outbox;
- moderar conteúdo ou comentários;
- acessar auditoria técnica global.

`manageEnrollmentAccess` e `manageCertificates` deixam de pertencer a `support`.
Ações de suporte passam a exigir as capacidades granulares. Alterações amplas de
Conta, emissão/revogação de credencial, autoria e manutenção técnica permanecem
exclusivas de `admin`.

### Aplicação da matriz

A navegação será filtrada por permissão, mas isso é apenas apresentação. Cada página,
Server Action, Route Handler, projeção de leitura, exportação e rota de mídia privada
deverá verificar sua própria capacidade. Consultas compartilhadas não poderão usar
`viewAdminPanel` como autorização genérica.

O painel de `support` mostrará somente indicadores operacionais: Cursos, Alunas por
Curso, Matrículas, receita, Pedidos e estados de atendimento. Saúde editorial,
prontidão de catálogo, controles de conteúdo, falhas técnicas de webhook e ações de
configuração ficam fora da projeção.

Testes de matriz cobrirão `student`, `support` e `admin` em chamadas diretas. Para
cada permissão concedida a `support`, haverá ao menos um teste positivo; para cada
fronteira proibida relevante, haverá teste negativo no servidor. Testes de interface
não substituem esses casos.

### Assurance de contas privilegiadas

`admin` e `support` deverão usar TOTP pelo plugin two-factor do Better Auth, sem SMS
ou provider pago. A implementação ativa o contrato já iniciado por
`resolveAdminAssurance` e adiciona schema, setup, desafio, backup codes, recuperação
e lockout.

Regras:

- uma Conta privilegiada sem TOTP entra somente no fluxo de configuração;
- promoção ou mudança de papel revoga sessões existentes;
- dispositivo confiável não elimina o desafio para uma nova sessão privilegiada;
- códigos de backup são apresentados uma vez e nunca entram em log;
- a ativação em Production exige recuperação exercitada e pelo menos duas Contas
  Admin capazes de recuperar acesso;
- reembolso continua exigindo confirmação recente de senha mesmo após TOTP;
- falha de assurance nega a operação sem executar parcialmente a mutação.

## Recuperação gratuita e independente

### Alternativas rejeitadas

O Neon Free isolado não satisfaz retenção independente: oferece janela curta de
restauração, um snapshot manual e recuperação limitada de projeto excluído. GitHub
Actions Artifacts também não é repositório de backup: possui cota e retenção voltadas
a artefatos de CI, não a dados duráveis de Production.

Free trial não é alternativa válida, pois transformaria expiração comercial em
risco operacional.

### Arquitetura escolhida

A proteção combina:

- PITR nativo do Neon para incidentes recentes;
- `pg_dump` lógico completo executado por GitHub Actions;
- bucket Cloudflare R2 privado, exclusivo para backups e separado dos buckets da
  aplicação;
- credencial PostgreSQL somente leitura e token R2 limitado ao bucket;
- manifesto verificável por objeto;
- retenção em camadas e ensaio periódico de restauração.

O job produzirá dump no formato apropriado para `pg_restore`, comprimirá, criptografará
antes do upload e calculará SHA-256. A chave pública de criptografia pode existir no
workflow; a chave privada de recuperação deve possuir duas cópias seguras fora do
repositório e dos logs. Nenhuma credencial, URL de conexão ou chave de aplicação entra
no artefato.

O manifesto registra, no mínimo:

- data e hora UTC;
- ambiente e projeto de origem;
- commit implantado;
- migration superior observada;
- versão de PostgreSQL e das ferramentas de dump;
- tamanho lógico e tamanho armazenado;
- digest SHA-256;
- identificador imutável do objeto.

O bucket usará locks e lifecycle compatíveis com três classes:

- quatro pontos das últimas 24 horas, em cadência de 6 horas;
- uma cópia diária por 7 dias;
- uma cópia semanal por 4 semanas.

Uma cópia nova só entra na retenção depois de upload e checksum confirmados. A limpeza
nunca remove a última cópia válida. Falha do job, checksum divergente ou idade superior
a 7 horas gera alerta e bloqueia nova promoção para Production.

### RPO, RTO e cotas

O alvo é RPO de 6 horas e RTO de 4 horas. Esses valores são objetivos medidos, não uma
promessa incompatível com cotas gratuitas.

Antes de ativar a cadência, o implementador medirá um dump real e projetará 30 dias de
transferência e retenção. A projeção deve incluir tráfego normal da aplicação e manter
margem operacional. O Neon Free possui cota de transferência pública e o R2 possui
cota de armazenamento; ambas devem ser consultadas novamente nas fontes oficiais.

Se a cadência de 6 horas não couber com margem, a implementação não compra upgrade nem
reduz silenciosamente a proteção. Ela registra a melhor cadência gratuita sustentável,
o RPO resultante e abre decisão explícita antes do release. O job publica uso acumulado,
projeção mensal e percentual de cada cota.

### Ensaio de restauração

O primeiro backup só encerra `F-002` depois de restauração completa em PostgreSQL 18
descartável. Depois disso, o ensaio é trimestral e após mudança material no schema ou
pipeline.

O procedimento deve:

1. localizar o objeto pelo manifesto;
2. verificar digest antes da descriptografia;
3. descriptografar sem expor a chave;
4. restaurar em banco vazio;
5. executar migrations/checks de compatibilidade;
6. verificar tabelas, journal, constraints e contagens sentinela sem publicar PII;
7. medir tempo total contra o RTO;
8. destruir o ambiente descartável e registrar somente evidência sanitizada.

## Concorrência e idempotência

### Solicitações de suporte

`F-003` será corrigido serializando submissões por Conta dentro do PostgreSQL. A
transação adquire advisory lock derivado do identificador da Conta, conta solicitações
na janela e cria o novo agregado antes do commit. Nenhuma contagem decisória permanece
fora da transação.

O teste de integração usa conexões reais e libera múltiplas submissões simultâneas. O
número persistido nunca pode superar o limite; falhas devem retornar a mesma mensagem
de rate limit sem criar outbox órfã.

### Avisos de expiração

`F-004` será corrigido tratando cada validade como uma geração. O payload e a chave
idempotente incluem `enrollmentId`, tipo do aviso e `expectedExpiresAt`. Reprogramar a
Matrícula cria uma nova chave somente para a nova validade.

Imediatamente antes de qualquer chamada externa, o delivery consulta a Matrícula e
confirma:

- estado ativo;
- validade exatamente igual a `expectedExpiresAt`;
- aviso ainda dentro da janela;
- ausência de envio terminal para a mesma geração.

Qualquer divergência termina o evento como `superseded`, sem envio e sem contá-lo como
entregue. A outbox precisa distinguir efeito executado, efeito obsoleto, retry e dead
letter. Concorrência entre manutenção, alteração de validade e worker será coberta por
integração PostgreSQL.

## Ciclo de entrega de e-mail

### Separação entre intenção, aceitação e entrega

A outbox continua representando a intenção transacional. Para tópicos de e-mail,
concluir o handler significa que o provider aceitou a mensagem, não que a destinatária
recebeu. Superfícies operacionais não podem chamar esse momento de entrega.

O modelo adicionará uma mensagem por aceitação do provider e um histórico append-only
de eventos. A projeção de estado distinguirá, no mínimo:

- `accepted`;
- `delivered`;
- `bounced`;
- `complained`;
- falha transitória;
- falha terminal.

O identificador da mensagem no Resend será único. Eventos terão identificador único do
provider, horário ocorrido, horário recebido, tipo, digest do payload sanitizado e os
metadados mínimos de diagnóstico. Estado derivado não poderá regredir por evento
duplicado ou fora de ordem. Bounce e complaint prevalecem como condições operacionais
terminais.

### Inbox do webhook

O Route Handler recebe o corpo bruto, valida a assinatura com o contrato oficial do
Resend e só então persiste a versão normalizada. Assinatura ausente ou inválida não
gera escrita. Evento válido é confirmado ao provider somente após inserção durável;
duplicata retorna sucesso idempotente.

O processamento ocorre fora da requisição e tolera o webhook chegar antes de a
aceitação local ser gravada. Nesse caso, o evento permanece pendente e é retomado sem
perda. Retry técnico possui limite, backoff e dead letter observável.

Recuperação de senha continua fora da outbox, conforme `DEC-DISC-015`, mas pode registrar
aceitação e lifecycle sem persistir token, URL, corpo ou segredo. Nenhuma tabela de
entrega armazena senha, URL de ativação/redefinição ou conteúdo sensível do template.

## DMARC e reputação do domínio

SPF e DKIM precisam permanecer verificados e alinhados. Relatórios agregados DMARC irão
para caixa institucional, sem analisador pago obrigatório.

Progressão ratificada:

1. `p=none` por 14 dias de relatórios completos;
2. `p=quarantine; pct=25` por 72 horas;
3. `p=quarantine; pct=100` por 7 dias;
4. `p=reject; pct=25` por 72 horas;
5. `p=reject; pct=100` como estado final.

Cada avanço exige todos os remetentes legítimos inventariados, SPF/DKIM alinhados e
ausência de falha legítima não explicada. O valor DNS anterior é registrado antes da
mudança. Falha reverte imediatamente ao estágio anterior e reinicia a janela de
observação. O cronograma DMARC pode atravessar vários sprints, mas não pode ser
declarado concluído antes de `p=reject; pct=100` estável.

## Verdade operacional e observabilidade

### Documentação

Fatos atuais incorretos serão corrigidos ao documentar este trabalho: migration
superior `0064`, estado de Production observado no commit base e ratificação da matriz
anterior de `support`. A nova matriz aprovada será descrita como decisão futura nesta
especificação; os guias canônicos só a adotarão junto com o código.

`docs:check` passará a comparar a migration superior do journal com todas as afirmações
canônicas que declarem esse fato, além de validar metadados e referências de decisão.
Ele continuará offline e determinístico.

Uma verificação separada de release consultará Vercel e Neon com credenciais de leitura.
Ela compara commit implantado, ambiente, branch de banco, migration superior e estado
documentado. O workflow nunca altera Markdown automaticamente: divergência falha com
diagnóstico e exige revisão humana.

### Sentry

O 403 observado é tratado como ausência de evidência, não como prova de falha do SDK. O
gate deverá confirmar:

- token de inspeção com menor escopo necessário;
- release associada ao commit implantado;
- upload e resolução de source map;
- captura de evento sintético sem PII;
- stack apontando arquivo-fonte correto;
- regra de alerta e recebimento pelo canal institucional;
- redação de dados sensíveis.

Evento, source map ou alerta ausente mantém `NO-GO`.

## Senha, acessibilidade e dependências

### Senha

A política única é mínimo de 8 caracteres. Uma constante compartilhada alimentará
configuração Better Auth, cadastro, redefinição, schemas, mensagens e testes. Nenhuma
superfície poderá manter valor 10 ou texto divergente. A mudança não enfraquece hashing,
rate limit, reset uniforme ou revogação de sessões.

### Acessibilidade e jornadas

A matriz E2E mínima terá Chromium desktop e emulação mobile. Jornadas críticas cobrirão
navegação por teclado, foco visível, ordem de tabulação, diálogos, formulários,
autenticação, compra segura em ambiente isolado e superfícies administrativas por papel.

Axe falhará a partir da severidade `moderate` nas superfícies selecionadas. Casos
excluídos exigem justificativa localizada e prazo; não haverá allowlist global. A matriz
mais ampla será distribuída entre PR, branch principal e execução programada para caber
na cota gratuita do GitHub Actions.

### Dependências

Automação semanal cobrirá GitHub Actions e dependências JavaScript/Bun. Atualizações
compatíveis serão agrupadas de forma pequena; major versions permanecem separadas.
Toda proposta passa por auditoria, tipos, testes e build. A solução escolhida deverá
suportar o lockfile real e ser gratuita; se Dependabot não suportar alguma parte do
contrato no momento da implementação, o plano deverá usar alternativa gratuita
verificada, sem fingir cobertura.

## Organização dos sprints

O plano mestre será organizado em nove resultados:

1. baseline reproduzível e evidências externas;
2. RBAC granular de `support` e assurance privilegiada;
3. backup, retenção e restauração;
4. concorrência e idempotência;
5. lifecycle de entrega do Resend;
6. DMARC, observabilidade e verdade operacional;
7. senha, acessibilidade, mobile e dependências;
8. requalificação completa para Production;
9. validação pós-deploy, incluindo venda real supervisionada.

RBAC e recuperação são independentes, mas ambos removem os bloqueadores P1. Nenhum
resultado posterior transforma um deles em opcional. DMARC inicia assim que o inventário
de remetentes estiver pronto e progride pelo calendário próprio.

## Rollout e rollback

Regras comuns:

- autorização e assurance falham fechadas;
- migrations são forward-only e compatíveis com a versão anterior durante promoção;
- uma versão anterior da aplicação deve ignorar com segurança novas tabelas/colunas;
- mudança de papel revoga sessões;
- backup novo não apaga a última cópia válida;
- webhook novo inicia em observação antes de dirigir alertas;
- cada estágio DMARC preserva o registro anterior para rollback;
- nenhum fallback ativa plano pago, cobrança ou trial silenciosamente.

Rollback de aplicação não remove migrations. Se o lifecycle Resend apresentar problema,
o webhook pode ser desativado sem interromper o envio existente, preservando a inbox
para reprocessamento. Se o pipeline de backup falhar, a última cópia válida e o PITR do
Neon permanecem disponíveis enquanto o release fica bloqueado. Rollback de DMARC retorna
ao estágio imediatamente anterior.

## Critérios para nova decisão de Production

Uma revisão posterior só poderá emitir `GO` quando:

- `F-001` a `F-010` estiverem encerrados com teste e evidência;
- a matriz de `support` negar todas as chamadas proibidas;
- TOTP e recuperação de contas privilegiadas estiverem exercitados;
- backup recente estiver dentro do RPO, da cota e restaurado dentro do RTO;
- lifecycle Resend estiver assinado, idempotente e sem segredos persistidos;
- DMARC estiver no estágio esperado sem remetente legítimo quebrado;
- Sentry comprovar evento, source map e alerta;
- senha mínima for 8 em todas as camadas;
- testes unitários, integração PostgreSQL, E2E desktop/mobile, Axe, migrations,
  documentação, lint, tipos e build passarem;
- auditoria de dependências não possuir vulnerabilidade bloqueadora;
- Vercel, Neon e documentação operacional concordarem.

Qualquer P1 aberto, backup não restaurável, evidência Sentry ausente, divergência de
migration/deployment, vazamento de autorização, assinatura não validada ou dependência
operacional de plano pago mantém `NO-GO`.

## Validação pós-deploy

Depois de promoção aprovada, o runbook executará smoke tests não destrutivos, observará
Sentry, outbox, Resend, Neon e jobs de backup e só então solicitará autorização humana
para uma venda real.

A venda será manual, identificada e supervisionada. O operador acompanhará criação do
Pedido, evento Asaas, concessão, Matrícula, e-mail e evidência financeira, seguido do
procedimento aprovado de estorno/conciliação. Ela não será automatizada, não ocorrerá em
CI e não será gate pré-deploy. O resultado será anexado à revisão pós-release.

## Fora de escopo

- upgrade pago de Neon, Cloudflare, GitHub, Resend ou Sentry;
- uso contínuo de free trial;
- venda real antes de Production;
- reescrita editorial de templates ou remoção de React Email;
- marketplace, tenancy ou nova role além de `student`, `support` e `admin`;
- analytics individual de inatividade;
- mudança de preço, parcelamento ou contrato Asaas;
- alteração retroativa do relatório histórico da auditoria.
