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
- `AUTH_PUBLIC_SIGNUP_ENABLED=false` salvo decisao explicita de cadastro aberto.
- `NEXT_PUBLIC_APP_URL`
- `CERTIFICATE_PUBLIC_BASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ABACATEPAY_WEBHOOK_SECRET`
- `JMVSTREAM_PLAN_ID`
- `JMVSTREAM_AUTH_EMAIL`
- `JMVSTREAM_AUTH_PASSWORD`
- `JMVSTREAM_AUTH_RESOURCE` com UUID do recurso/aplicacao, nao JWT
- Opcional recomendado: `BETTER_AUTH_API_KEY`, `BETTER_AUTH_API_URL` e `BETTER_AUTH_KV_URL` para habilitar Better Auth Dash/Sentinel.

## Provedores
- Dominio de envio validado no Resend.
- Webhook AbacatePay configurado para `POST /api/webhooks/abacatepay`.
- Segredo do webhook registrado no AbacatePay e em `ABACATEPAY_WEBHOOK_SECRET`.
- JMVStream configurado como provedor de video final.
- Dominios da plataforma liberados na JMVStream quando usar protecao por dominio/hotlink.
- JMVStream/S3 configurado para aceitar PUT direto do navegador e expor `ETag` em CORS/Expose-Headers.
- Upload via admin validado com um MP4 pequeno.
- Upload grande validado sem proxy pela Vercel; bytes de video devem ir direto para URLs assinadas.
- Cron `/api/cron/jmvstream` configurado no `vercel.json` e protegido por `CRON_SECRET`.
- `Admin > Configuracoes > JMVStream` mostra conexao ativa e galerias de curso acessiveis.
- Aulas enviadas pelo admin ficam com player oficial antes de contar como prontas.
- `JMVSTREAM_API_TOKEN` e apenas fallback manual; prefira credenciais de auth server-only para renovar JWT expirado.

## Smoke pos-deploy
- `GET /api/health` retorna `ok: true`.
- Admin consegue entrar.
- `POST /api/auth/dev/bootstrap-admin` retorna 503 sem `INTERNAL_BOOTSTRAP_SECRET` e 401 com bearer incorreto em preview/dev.
- `POST /api/auth/sign-up/email` retorna 404 quando `AUTH_PUBLIC_SIGNUP_ENABLED=false`.
- Admin cria ou atualiza curso, confirma a galeria JMVStream do curso, modulo e aula.
- Admin envia video pela aula e confirma que a aluna ve o player.
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
