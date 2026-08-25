---
status: canonical
owner: engineering
last_verified_commit: aceeaf830cf75667df8ce21e5b586d47155dd5ac
---

# Resend e e-mail institucional

## Responsabilidades

O Resend envia e-mails transacionais. Ele não hospeda a caixa de suporte do
produto:

- domínio verificado: `neurocapacitar.com.br`;
- remetente: `Neuro Capacitar <notificacoes@neurocapacitar.com.br>`;
- resposta padrão: `suporte@neurocapacitar.com.br`;
- recebimento de suporte: Lark Mail.

Depois que o domínio é verificado, o Resend permite usar endereços remetentes
nesse domínio sem criar uma caixa correspondente. Isso não transforma
`notificacoes@neurocapacitar.com.br` em endereço capaz de receber mensagens.
`sendTransactionalEmail` usa `SUPPORT_EMAIL` como `Reply-To` padrão; o chamado
de suporte é a exceção e aponta a resposta diretamente à Aluna.

## Decisão de reputação

O Resend recomenda um subdomínio para isolar reputação. A proprietária escolheu
o domínio raiz para apresentar um endereço mais simples. O risco aceito é que
reclamações, bloqueios ou má reputação do envio transacional possam afetar
outros e-mails de `neurocapacitar.com.br`.

Esse risco é limitado por:

- e-mail apenas transacional e solicitado pelo produto;
- lista sem contatos comprados;
- idempotência na outbox;
- remetente, assunto e conteúdo identificáveis;
- caixa de suporte real;
- SPF, DKIM e DMARC válidos;
- monitoramento de bounces e complaints antes de ampliar volume.

Relatórios DMARC são analisados localmente, sem SaaS pago, pelo procedimento de
[progressão DMARC](../operations/dmarc-rollout.md). XML bruto permanece fora do
repositório e a política avança somente pelas cinco janelas aprovadas.

## DNS

A Hostinger continua como autoridade DNS. Registros de website, Vercel e e-mail
coexistem; não se troca nameserver para configurar o Resend.

O painel do Resend é a única autoridade sobre nomes e valores. Para o domínio
raiz, ele normalmente fornece:

- MX e TXT de SPF em um Return-Path como `send`;
- DKIM em um seletor sob `_domainkey`;
- opcionalmente registros de tracking.

Nunca crie dois registros SPF com o mesmo nome. O SPF do Lark no domínio raiz e
o SPF Resend no Return-Path `send` têm nomes diferentes e podem coexistir. Não
habilite Receiving no Resend: a caixa de suporte pertence ao Lark Mail.

Referências oficiais:

- [Domínios no Resend](https://resend.com/docs/dashboard/domains/introduction)
- [Falhas de verificação DNS](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying)
- [DNS na Hostinger](https://support.hostinger.com/en/articles/1583249-how-to-manage-dns-records-at-hostinger)

## Variáveis e segredo

- `RESEND_API_KEY`: segredo Production, com o menor escopo de envio disponível;
- `RESEND_WEBHOOK_SECRET`: signing secret diferente da API key, obrigatório em
  Staging e Production e proibido em Preview;
- `RESEND_FROM_EMAIL`: valor não secreto do remetente verificado;
- `SUPPORT_EMAIL`: caixa operacional real e monitorada.

Não registre a API key em chat, documento, commit ou GitHub Variable. Cadastre-a
como variável sensível no ambiente Production da Vercel. Preview não reutiliza
a chave de Production nem envia mensagens a clientes.

## Lifecycle de aceitação e entrega

`outbox_messages.delivered` significa que o handler aceitou o efeito, não que o
destinatário recebeu a mensagem. O lifecycle real vive em `email_messages`:
`sending`, `acceptance_unknown`, `accepted`, `delayed`, `delivered`, `failed`,
`suppressed`, `bounced` e `complained`. O painel de Auditoria exibe aceite e
entrega separadamente.

Antes do IO, o servidor calcula HMAC-SHA256 canônico do request com
`BETTER_AUTH_SECRET`, persiste somente o fingerprint e abre uma janela automática
de 23 horas. Tags enviadas ao Resend são fechadas: `hub_topic` usa slug ASCII
allowlisted e `hub_correlation` usa UUID local da mensagem. Se o provider ID já
chegou por webhook, o retry conclui sem novo IO. Fingerprint diferente, deadline
vencida ou conflito de idempotência mantêm `acceptance_unknown`; nunca se cria
uma chave nova.

O webhook `POST /api/webhooks/resend` lê o corpo bruto uma vez e verifica os
três headers Svix com `resend.webhooks.verify`. A inbox grava somente digest,
IDs do provider, tipo, horário e correlação allowlisted; não grava corpo,
destinatário, remetente, assunto, tags completas ou headers. Duplicata por
`svix-id` retorna 200, schema assinado inválido vira dead letter mínimo e falha
de banco retorna 503.

O cron `/api/cron/resend-webhooks` processa a inbox a cada cinco minutos com
lease próprio. Eventos fora de ordem usam precedência determinística e nunca
acionam reenvio ou alteram Conta, Matrícula ou Pedido. Retenção: eventos
processados/ignorados 180 dias, dead letter 365 dias e mensagens terminais 365
dias, em lotes de 500 e sem apagar mensagem com evento pendente.

### Development

Development entrega mensagens reais usando o domínio verificado
`neurocapacitar.com.br`, compartilhado com Production por decisão operacional.
O remetente deve ser identificado com `Dev` e
`DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST` permanece obrigatório. A aplicação
recusa qualquer destinatário Development fora da lista antes de construir o
cliente Resend.

Compartilhar domínio e credencial aumenta o impacto de um vazamento local. A
allowlist reduz o risco de envio acidental, mas não substitui o cuidado com a
API key. Não registre a chave em chat, documento, commit ou log.

### Staging

Staging compartilha a estrutura Resend aprovada para Production: domínio
verificado, credencial de envio e configuração de remetente no domínio
`neurocapacitar.com.br`. O catálogo de templates também é único: Staging usa os
mesmos aliases canônicos da aplicação, sem cópias `staging-*` ou `production-*`.

O preflight exige `STAGING_EMAIL_RECIPIENT_ALLOWLIST`, separada por vírgula, e
bloqueia o runtime quando a variável está ausente, vazia ou contém somente um
placeholder. A lista contém endereços destinatários controlados, não aliases de
template, e deve ser mantida mínima e revisada.

`STAGING_RESEND_USES_PRODUCTION=true` é um acknowledgement independente de que
a estrutura Resend é compartilhada. Ele não substitui a allowlist nem libera
destinatários. Nesta etapa, a allowlist já faz parte do contrato e do preflight;
a aplicação já bloqueia destinatários fora da lista antes de renderizar ou
chamar o Resend.

Staging não possui isolamento forte de credencial, domínio ou reputação. Um uso
indevido pode consumir cota, afetar a reputação compartilhada do domínio ou
alcançar um destinatário permitido; a allowlist reduz o alcance, mas não elimina
esse risco.

## Verificação operacional

Estado da liberação inicial:

1. [x] Confirmar o domínio como `Verified` no Resend.
2. [x] Enviar de uma conta externa para `suporte@neurocapacitar.com.br`.
3. [x] Responder pela caixa de suporte e confirmar entrega.
4. [x] Cadastrar `RESEND_API_KEY` e `SUPPORT_EMAIL` na Vercel.
5. [x] Enviar um e-mail controlado pelo Resend para a caixa de suporte.
6. [x] Confirmar remetente, `Reply-To` e estado `delivered`.
7. [x] Executar um reset de senha real após o primeiro deployment.
8. [ ] Confirmar SPF, DKIM e DMARC nos cabeçalhos da mensagem de aplicação.
9. [x] Implantar a rota e cadastrar somente `email.sent`,
   `email.delivery_delayed`, `email.delivered`, `email.failed`,
   `email.suppressed`, `email.bounced` e `email.complained`.
10. [ ] Provar assinatura, duplicata e corrida webhook/aceitação no ambiente
    real sem registrar endereço ou conteúdo.

Em 2026-08-25, Staging recebeu a migration `0067`, a rota implantada e a
inscrição Resend `72383e2a-c8f4-4d9b-9d59-e25a700f74b8`, apontando somente para
`https://preview.neurocapacitar.com.br/api/webhooks/resend` com os sete eventos
allowlisted. O signing secret está apenas na variável sensível do target
Staging da Vercel; seu valor não foi lido, exibido ou versionado.

Um evento controlado com envelope Svix e formato do provider retornou HTTP 200;
a repetição byte a byte do mesmo `svix-id` também retornou 200, provando
assinatura e idempotência no ambiente persistente sem enviar e-mail. Essa prova
fecha a parte de assinatura/duplicata, não todo o item 10: ainda faltam um
lifecycle originado pelo Resend, a corrida real webhook/aceitação, confirmação
de entrega final e alerta operacional gratuito para dead letter/retry/bounce e
complaint.

O lifecycle controlado é reproduzido por dispatch do workflow
`Run Staging jobs` na branch `staging`, operação `verify-resend-lifecycle`, com a
confirmação literal `SEND_CONTROLLED_STAGING_PASSWORD_RESET`. O job usa a Conta Admin controlada já
recusa outro origin/host/branch, chama a rota de readiness com segredo próprio,
aciona o worker autenticado e exige `email.sent` e `email.delivered` processados,
mensagem `delivered`, zero conflito e zero erro. Não execute o script localmente
nem copie identidade ou conteúdo para a saída. A prova não cria sessão, não
altera senha e não envolve checkout.

A primeira execução real, run `32875321220`, falhou de forma fechada após um
único request. Better Auth respondeu 200, mas o runtime registrou
`password_reset_email_delivery_failed`; nenhum `email_messages` ou evento foi
criado. O problema era anterior ao lifecycle e expôs o acoplamento indevido à
Conta Admin configurada no GitHub, que não provava pertencer à allowlist do
runtime.

A correção usa `POST /api/health/resend`, somente em Staging, bearer exclusivo
`RESEND_READINESS_SECRET` e corpo literal
`{"confirmation":"EMIT_RESEND_READINESS_EMAIL"}`. A rota escolhe internamente a
primeira interseção entre Conta existente e allowlist, envia uma mensagem
controlada com lifecycle e retorna apenas `correlationId`. O checker consulta
somente esse UUID. Segredo ausente, ambiente divergente, bearer ou corpo inválido
não consultam banco nem enviam. O segredo de 64 caracteres existe somente como
Sensitive no target Staging da Vercel e secret do GitHub Environment
`vercel-staging`; nenhum valor foi exibido ou versionado.

Em 2026-07-27, a aplicação Production aceitou o reset real com HTTP 200 e a
Vercel não registrou erro de envio. O conector Resend disponível na sessão de
operação aponta para outra conta e não deve ser usado como autoridade sobre a
API key instalada na Vercel. A confirmação de entrega e dos cabeçalhos continua
na caixa destinatária.

## Evidências

`src/features/email/server.ts`, `src/features/email-delivery/*`,
`src/app/api/webhooks/resend/route.ts`,
`src/app/api/cron/resend-webhooks/route.ts`, migration `0067`,
`src/lib/env.ts`, `src/lib/production-environment.ts`,
`scripts/check-staging-resend-lifecycle.ts` e os workflows de Staging.
