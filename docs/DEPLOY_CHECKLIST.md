# Checklist de deploy PROTEA-R Hub

## Ambientes
- Vercel Production e Preview configurados com as mesmas chaves obrigatorias.
- Neon separado por ambiente: production, preview e e2e/local quando aplicavel.
- `DATABASE_URL` usa pooler/serverless quando estiver em runtime Vercel.
- `DATABASE_URL_DIRECT` fica restrita a migrations e seed.

## Variaveis obrigatorias
- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `CERTIFICATE_PUBLIC_BASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ABACATEPAY_WEBHOOK_SECRET`
- `SUPPORT_WHATSAPP_URL`

## Provedores
- Dominio de envio validado no Resend.
- Webhook AbacatePay configurado para `POST /api/webhooks/abacatepay`.
- Segredo do webhook registrado no AbacatePay e em `ABACATEPAY_WEBHOOK_SECRET`.
- JMVStream configurado como provedor de video final.
- Dominios da plataforma liberados na JMVStream quando usar protecao por dominio/hotlink.
- Videos das aulas enviados para a JMVStream e cada aula cadastrada com `video_hash` e URL/iframe oficial do player.
- Opcional para automacao futura: `JMVSTREAM_API_BASE_URL`, `JMVSTREAM_API_TOKEN` e `JMVSTREAM_PLAN_ID`.

## Smoke pos-deploy
- `GET /api/health` retorna `ok: true`.
- Admin consegue entrar.
- Admin cria ou atualiza curso, modulo e aula.
- Admin cria aluna e reenvia acesso por reset de senha.
- Webhook de pagamento aprovado cria pedido e matricula ativa.
- Aluna entra, acessa dashboard e assiste a primeira aula.
- Bloqueio sequencial impede acesso direto a aula futura.
- Conclusao de 100% emite certificado e pagina publica valida o codigo.
- Webhook de reembolso revoga a matricula.

## LGPD e operacao
- Politica de privacidade publicada fora ou dentro da plataforma.
- Termos de uso aprovados pela cliente.
- Rotina de atendimento por WhatsApp definida.
- Acesso de `support` revisado: nao deve alterar curso/configuracoes sensiveis.
- Retencao de pedidos, webhooks e audit logs definida com a cliente.
