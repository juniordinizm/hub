---
status: canonical
owner: engineering
last_verified_commit: 4b3c9b8a80b3bf3628b53c983dfd56d7ebec5b8d
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
- `RESEND_FROM_EMAIL`: valor não secreto do remetente verificado;
- `SUPPORT_EMAIL`: caixa operacional real e monitorada.

Não registre a API key em chat, documento, commit ou GitHub Variable. Cadastre-a
como variável sensível no ambiente Production da Vercel. Preview não reutiliza
a chave de Production nem envia mensagens a clientes.

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

## Verificação de liberação

Antes do primeiro deploy:

1. [x] Confirmar o domínio como `Verified` no Resend.
2. [x] Enviar de uma conta externa para `suporte@neurocapacitar.com.br`.
3. [x] Responder pela caixa de suporte e confirmar entrega.
4. [x] Cadastrar `RESEND_API_KEY` e `SUPPORT_EMAIL` na Vercel.
5. [x] Enviar um e-mail controlado pelo Resend para a caixa de suporte.
6. [x] Confirmar remetente, `Reply-To` e estado `delivered`.
7. [x] Executar um reset de senha real após o primeiro deployment.
8. [ ] Confirmar SPF, DKIM e DMARC nos cabeçalhos da mensagem de aplicação.

Em 2026-07-27, a aplicação Production aceitou o reset real com HTTP 200 e a
Vercel não registrou erro de envio. O conector Resend disponível na sessão de
operação aponta para outra conta e não deve ser usado como autoridade sobre a
API key instalada na Vercel. A confirmação de entrega e dos cabeçalhos continua
na caixa destinatária.

## Evidências

`src/features/email/server.ts`, `src/features/email/server.test.ts`,
`src/lib/env.ts` e `src/lib/production-environment.ts`.
