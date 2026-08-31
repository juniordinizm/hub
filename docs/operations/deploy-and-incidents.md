---
status: canonical
owner: engineering
last_verified_commit: d3943758755a49f09e4e3118044a17a91b2e6794
---

# Deploy e incidentes

## Regra de deploy

Staging é publicado automaticamente quando `staging` recebe um merge. O
GitHub Actions não executa um segundo deploy Vercel. Production recebe uma
build automática quando o workflow avança `main`, mas o domínio só muda quando
`Deploy Vercel production` promove o deployment validado.

O domínio Production permanece no deployment anterior até o candidato staged
passar readiness, R2, migrations quando aplicáveis e smoke público.

Não faça deploy manual na Vercel para contornar uma falha. Isso pode usar
variáveis do ambiente errado, criar um deployment duplicado ou servir um SHA
sem homologação.

## Antes de promover

- confirme CI verde do candidato;
- confirme deployment e domínio de Staging saudáveis;
- confirme reconciliação de `main` e `staging`;
- confirme backup recente se houver migration;
- confira Vercel, Neon, R2, Asaas, Resend e JMVStream conforme a mudança;
- identifique o deployment Production anterior compatível para rollback.

## Rollback

1. Registre horário, impacto, SHA e deployment atual.
2. Pare operações de risco, especialmente pagamentos, migrations e limpeza.
3. Verifique se uma migration já foi aplicada.
4. Se o schema continuar compatível, faça rollback Vercel para o deployment
   anterior.
5. Revalide `/`, `/entrar`, `/api/health`, readiness, checkout e webhook.
6. Se o schema não for compatível, não faça rollback cego; prepare forward-fix.

Rollback Vercel troca o alias para um deployment existente. Ele não desfaz
migrations, não restaura dados e não reverte variáveis de ambiente.

## Hotfix

Hotfix parte de `main`, abre PR `hotfix/* → main`, executa CI completa, não pode
conter migration e só é promovido depois de readiness e smoke. Staging pode
continuar recebendo outras alterações enquanto o hotfix está em Production.

Antes da próxima release, execute `Prepare Production release` para incorporar
`main` em `staging`, resolver conflitos e homologar a árvore combinada.

## Falhas por etapa

### CI

Não faça merge. Leia o primeiro erro, reproduza no PostgreSQL local, corrija na
mesma branch e rode a CI novamente.

### Staging

Se migration falhar, o deployment Vercel pode estar usando o schema anterior.
Não execute migration manual. Corrija o alvo ou o código e use o workflow de
preparação novamente.

### Production antes da promoção

O domínio deve continuar na versão anterior. Verifique se a migration foi
aplicada antes de reexecutar o workflow. Não crie um segundo deployment manual.

### Production depois da promoção

Consulte Vercel Runtime Logs, Sentry, Neon e provider afetado. Preserve o
correlation ID e o SHA. Faça rollback somente depois de confirmar compatibilidade
do banco.

## Evidências mínimas

Registre no PR ou no runbook de incidente:

- link do workflow;
- SHA candidato e SHA servido;
- deployment Vercel;
- resultado dos smokes;
- estado das migrations;
- backup usado, quando aplicável;
- horário e correlation ID;
- decisão de rollback ou forward-fix.
