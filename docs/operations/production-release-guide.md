---
status: runbook
owner: engineering
last_verified_commit: 9c204a35dc8eaa5855532f83bd1fa88ff959f166
---

# Tutorial: da alteração até Production

Este é o procedimento diário para levar uma alteração do computador até
`https://app.neurocapacitar.com.br`. Foi escrito para uma pessoa em início de
carreira e pressupõe pouca experiência com Git, GitHub Actions, Neon e Vercel.

Siga as etapas na ordem. Não pule um gate vermelho e não execute comandos de
banco por tentativa.

## O que é automático e o que é manual

O fluxo tem cinco momentos diferentes:

1. **Desenvolvimento local:** o código roda no computador e usa os recursos
   Development definidos no `.env.local`.
2. **Pull Request para Staging:** o GitHub executa testes, cria um Preview
   protegido e, após o merge, o deploy controlado atualiza `staging`.
3. **Homologação:** a equipe valida o deployment e o smoke de Staging; provider
   e gates externos são conferidos nessa etapa.
4. **Pull Request `staging → main`:** somente o SHA já homologado entra na
   `main`, que se torna o candidato de Production.
5. **Deploy Production:** uma pessoa executa manualmente o workflow
   `Deploy Vercel production`.

Portanto:

- `git push` não altera Production;
- abrir um Pull Request não altera Production;
- fazer merge em `staging` não altera Production;
- fazer merge de `staging` em `main` atualiza apenas o candidato, não o domínio;
- um Preview não é Production;
- somente o workflow manual de Production pode promover o domínio público;
- não é necessário localizar, copiar ou digitar um SHA.

O workflow resolve sozinho o SHA atual da `main`, confirma que ele possui CI
verde, aplica migrations pendentes, testa o deployment sem domínio e somente
depois promove.

O workflow não possui mais entradas para ignorar o CI ou o backup independente.
Se qualquer gate falhar, corrija a causa e execute novamente; não há caminho de
exceção na interface de execução.

## Os quatro bancos

Branch Git e branch Neon são coisas independentes. `git switch` troca código,
não banco.

| Banco | Uso | Quem aplica migrations |
|---|---|---|
| `development` | testes manuais locais compartilhados | workflow manual `Migrate Neon development` |
| branches efêmeras da CI | integração PostgreSQL e Playwright | a própria CI; a branch é apagada |
| `vercel-preview` | readiness do Preview Vercel limitado | não recebe migrations de Pull Request |
| `production` | dados reais | workflow manual `Deploy Vercel production` |

Gerar uma migration cria arquivos no Git. Isso não aplica a migration em nenhum
banco. Cada branch Neon mantém seu próprio journal.

## Antes de começar

Você precisa de:

- acesso ao repositório `juniordinizm/hub` (publicado temporariamente como público para minutos de CI; a proteção de branches via ruleset exige repo público ou plano pago, e deixa de valer se o repo retornar a privado);
- Git e Bun `1.3.11`;
- `.env.local` de Development já aprovado;
- permissão para abrir Pull Requests;
- para promover Production, permissão para executar GitHub Actions.

Confirme o ambiente local:

```powershell
bun run dev
```

O comando deve mostrar `Development environment verified` antes de iniciar o
Next.js. Se mencionar recurso Production, hostname inesperado ou variável
ausente, pare. Não altere o preflight para fazê-lo passar.

## Etapa 1: começar com a `main` atual

Feche alterações incompletas ou guarde-as em commit próprio. Depois:

```powershell
git switch main
git pull --ff-only origin main
git status
```

Resultado esperado:

- branch atual `main`;
- mensagem semelhante a `Already up to date` ou um fast-forward;
- `git status` sem arquivos alterados.

Crie uma branch para a tarefa:

```powershell
git switch -c feat/nome-curto
```

Exemplos:

```text
feat/email-de-expiracao
fix/upload-de-certificado
docs/guia-de-cadastro
```

Não desenvolva diretamente na `main`.

## Etapa 2: implementar e testar durante o trabalho

Inicie a aplicação:

```powershell
bun run dev
```

Teste a jornada alterada no navegador local. Use somente contas, cursos,
pagamentos e arquivos de teste.

JMVStream é a exceção importante: Development compartilha o plano Production.
Envie somente vídeos descartáveis criados pelo próprio teste e não remova ativos
preexistentes.

Depois de uma parte coerente da implementação, execute:

```powershell
bun run verify:quick
```

Esse comando para no primeiro erro e executa:

1. integridade dos arquivos de migration;
2. typecheck;
3. lint e formatação em modo de verificação;
4. testes automatizados.

Corrija o primeiro erro e rode novamente. Não acumule vários erros antes de
verificar.

## Etapa 3: quando a mudança altera o banco

Uma mudança de banco existe quando `src/db/schema.ts` precisa mudar ou quando a
feature depende de tabela, coluna, índice, constraint ou enum novo.

Gere a migration:

```powershell
bun run db:generate -- --name nome_objetivo
```

Revise:

- o novo `.sql` em `src/db/migrations`;
- a nova entrada em `src/db/migrations/meta/_journal.json`;
- o snapshot gerado;
- o diff de `src/db/schema.ts`.

Se o Drizzle perguntar se uma coluna foi criada ou renomeada, responda conforme
a mudança real. Renomear preserva dados; criar outra e remover a antiga pode
perdê-los. Se você não souber responder, pare e peça revisão.

Nunca use para acelerar:

```text
bun run db:push
bun run db:migrate
bun run db:migrate:production
```

Também não edite o journal ou snapshot JSON manualmente.

### Preview de uma migration nova

O bloqueio histórico entre readiness e a branch persistente `vercel-preview`
foi removido em 2026-07-31. O candidato Preview agora cria uma terceira branch
Neon efêmera, valida o estado herdado, aplica as migrations do PR e substitui
`DATABASE_URL` somente naquele deployment. O smoke autenticado roda antes do
passo `always()` que apaga a branch; expiração de 24 horas cobre cancelamentos.

Se o Pull Request contém migration:

- deixe integração PostgreSQL, E2E e Preview validarem três branches efêmeras
  independentes;
- não aplique migration manualmente em `vercel-preview`, `development` ou
  `production`;
- não reutilize o deployment candidato para revisão posterior, pois seu banco
  é deliberadamente removido depois do gate;
- não faça merge enquanto qualquer gate estiver vermelho.

## Etapa 4: executar a verificação completa

Antes do commit final e do Pull Request:

```powershell
bun run verify
```

O perfil completo executa:

1. documentação;
2. integridade das migrations;
3. typecheck;
4. lint/formatação;
5. testes;
6. build Next.js;
7. Knip.

O build usa valores sintéticos seguros. Ele não precisa de Production e não
publica nada.

Se `verify` falhar:

1. leia o primeiro comando vermelho;
2. corrija a causa;
3. rode o teste mais específico;
4. execute `bun run verify` novamente.

Não faça commit afirmando que passou se o comando terminou com código diferente
de zero.

## Etapa 5: revisar e criar o commit

Veja o que será enviado:

```powershell
git status
git diff
```

Confirme:

- somente arquivos relacionados à tarefa;
- nenhuma senha, token ou URL de banco;
- `.env.local` ausente;
- nenhum relatório ou arquivo temporário;
- documentação atualizada quando mudou contrato, variável, migration,
  integração ou operação.

Adicione arquivos de forma explícita:

```powershell
git add caminho/do/arquivo
git status
```

Crie o commit:

```powershell
git commit -m "tipo: resumo objetivo"
```

Exemplos:

```text
feat: add certificate expiration email
fix: preserve lesson order between modules
docs: clarify production release flow
```

Envie a branch:

```powershell
git push -u origin HEAD
```

Se o Git informar que a branch remota avançou, não use force push sem entender
quem alterou a branch.

## Etapa 6: abrir o Pull Request

No GitHub:

1. abra o repositório `juniordinizm/hub`;
2. clique em **Pull requests**;
3. clique em **New pull request**;
4. escolha `staging` em **base**;
5. escolha sua branch em **compare**;
6. clique em **Create pull request**;
7. escreva o problema, a solução e os testes executados;
8. informe claramente se existe migration;
9. crie o Pull Request.

Um bom texto inclui:

```markdown
## Resumo

- problema resolvido
- comportamento novo

## Testes

- bun run verify
- jornada manual testada

## Banco

- sem migration
```

## Etapa 7: entender a CI

A página do Pull Request mostrará os checks. Aguarde todos:

- `Quality gates`;
- `PostgreSQL integration`;
- `Browser journeys`;
- `Build and dependency audit`;
- `Vercel preview candidate`.

O significado:

- **Quality gates:** documentação, migrations, tipos, estilo, testes e audit;
- **PostgreSQL integration:** regras que exigem Postgres real;
- **Browser journeys:** jornadas Chromium completas;
- **Build and dependency audit:** build e código/dependências sem uso;
- **Vercel preview candidate:** deployment protegido e readiness.

Estados:

- amarelo ou `pending`: ainda está executando;
- verde ou `pass`: aprovado;
- vermelho ou `failure`: falhou;
- cinza ou `skipped`: não executou para aquele tipo de contribuição.

Não faça merge enquanto houver check pendente ou vermelho.

Para investigar uma falha:

1. clique no check vermelho;
2. abra o primeiro step vermelho;
3. leia a menor mensagem de erro decisiva;
4. reproduza localmente quando possível;
5. corrija na mesma branch;
6. execute a verificação local;
7. faça novo commit e push.

O push novo atualiza o mesmo Pull Request e inicia outra CI.

## Etapa 8: revisar o Preview

O Preview comprova build, runtime e readiness em infraestrutura Vercel. Ele é
protegido e limitado:

- não possui credenciais R2, Resend, Asaas nem JMVStream;
- não envia e-mail;
- não executa jobs;
- não representa dados reais;
- pode não permitir revisar uma feature dependente de provider;
- não recebe migration de Pull Request.

Revise no Preview somente o que ele consegue representar. Testes de provider
acontecem no ambiente local Development, usando recursos de teste e as
restrições do guia de Development.

## Etapa 9: fazer merge em Staging e homologar

Faça merge do Pull Request para `staging` somente quando:

- todos os checks estiverem verdes;
- a revisão de código estiver concluída;
- o Preview aplicável estiver aprovado;
- a jornada afetada tiver sido testada;
- não existir migration bloqueada pelo limite descrito acima.

Use o método de merge aprovado no repositório, normalmente squash. O merge
dispara o CI pós-merge e o deploy controlado de Staging. Aguarde ambos e
confirme o smoke no alias estável antes de promover.

Importante: nem o merge nem o deploy de Staging publicam Production.

## Etapa 10: promover o Staging para `main` e aguardar a CI

Depois que Staging estiver homologado:

1. abra um novo Pull Request no GitHub;
2. escolha `main` em **base**;
3. escolha `staging` em **compare**;
4. descreva o SHA/deployment já validado e os gates externos;
5. aguarde a revisão e todos os checks do Pull Request.

Faça esse merge somente quando a homologação de Staging estiver registrada e
nenhum gate externo estiver pendente. A branch `main` passa a representar o
candidato de Production.

Depois do merge, aguarde a CI da `main`:

1. abra **Actions** no GitHub;
2. escolha o workflow **CI**;
3. abra a execução cuja branch é `main`;
4. confirme que ela corresponde ao merge recém-realizado;
5. aguarde todos os jobs ficarem verdes.

A CI verde do Pull Request não substitui a CI da `main`. O workflow Production
recusa um commit sem CI verde na própria `main`.

Na `main`, os gates são repetidos, mas o Preview Vercel não é reconstruído. O
workflow Production criará e testará o deployment definitivo antes da promoção.

Não precisa copiar o SHA. O workflow fará essa conferência.

## Etapa 11: sincronizar Development quando houver migration

Esta etapa só é usada depois que o pipeline de migrations estiver
operacionalmente liberado e o merge com migration tiver CI verde.

No GitHub:

1. abra **Actions**;
2. escolha **Migrate Neon development**;
3. clique em **Run workflow**;
4. selecione `main`;
5. marque `confirm_development`;
6. clique em **Run workflow** uma única vez;
7. aguarde `Apply Development migrations` e
   `Audit Development migration state` ficarem verdes.

Depois:

```powershell
git switch main
git pull --ff-only origin main
bun run dev
```

Teste no Development a jornada que usa o schema novo. Se a migration falhar,
não execute `db:push`, não altere o banco manualmente e não inicie Production.

Se a mudança não contém migration, pule esta etapa.

## Etapa 12: iniciar o deploy Production

Confirme antes:

- CI da `main` verde;
- nenhuma execução Production em andamento;
- migration Development validada, quando aplicável;
- pessoa responsável disponível para observar o pós-deploy;
- não existe incidente ativo no banco ou provider afetado.
- o workflow **Backup Production database** tem uma execução verde nas últimas
  seis horas; não tente contornar o gate com uma branch Neon.

No GitHub:

1. abra **Actions**;
2. escolha **Deploy Vercel production**;
3. clique em **Run workflow**;
4. mantenha a branch em `main`;
5. marque `confirm_production`;
6. clique em **Run workflow** uma única vez.

Não há campo de SHA. Não abra um segundo run enquanto o primeiro estiver ativo.

## Etapa 13: acompanhar o deploy

O workflow executa:

1. checkout da `main`;
2. confirmação de que o checkout ainda é a `main` remota atual;
3. prova de CI verde para o SHA;
4. instalação das dependências;
5. verificação dos secrets operacionais;
6. leitura do manifesto R2 `frequent` mais recente e confirmação de idade máxima
   de 6 h 30 min, bucket, migration, tamanho e hash metadata;
7. criação da branch Neon de release;
8. aplicação das migrations pendentes em Neon Production;
9. auditoria do journal;
10. criação de um deployment Production sem domínio;
11. chamada autenticada de `/api/health/ready`;
12. checker somente leitura confirma deployment Vercel `READY`, projeto/SHA,
    branch Neon `ready`, PostgreSQL 18 e journal/marker da candidata;
13. promoção para `app.neurocapacitar.com.br`;
14. repetição do checker exigindo o alias canônico no mesmo deployment.

Durante o deploy, o checker compara o SHA candidato diretamente com Vercel,
Neon e o journal PostgreSQL. Ele não exige que
[Estado de release](release-state.md) já contenha esse SHA: tal exigência seria
self-referential, pois o commit que documentasse o candidato teria outro SHA.
Depois da promoção e do registro da evidência, uma auditoria separada pode usar
`--documented-checkpoint=verified` para comparar o SHA implantado com o
checkpoint documental. O checker emite apenas `match` e códigos fechados de
divergência. HTTP 401/403, timeout, payload incompleto ou desacordo falham o
workflow; nenhuma consulta lê tabelas de domínio e nenhum provider é alterado.

Se o backup estiver stale ou inválido, dispare manualmente **Backup Production
database**, aguarde a job verde e reinicie o deploy desde o começo. O deploy não
cria backup implícito e a branch Neon de release é apenas a segunda camada.

Se falhar antes da promoção, o domínio continua no deployment anterior. Não
execute Vercel CLI nem migration manual para “terminar” o processo.

Se a migration já foi aplicada e uma etapa posterior falhar, o banco pode ter
avançado mesmo sem promoção. Isso é esperado no desenho forward-only. O próximo
passo depende da compatibilidade do código anterior com o schema novo.

## Etapa 14: verificar Production

Depois de todos os steps verdes:

1. abra `https://app.neurocapacitar.com.br`;
2. confirme que a página carrega e redireciona corretamente;
3. faça login com uma conta de controle;
4. teste apenas a jornada alterada;
5. confira o Sentry Production;
6. confira os logs da Vercel pelo horário, SHA ou `correlationId`;
7. quando houver provider, confira o painel correspondente;
8. registre o resultado no Pull Request ou registro de release.

Não faça pagamento real, envie e-mail a cliente, crie vídeo real ou emita
certificado artificial apenas como smoke genérico. Use dados de controle e a
menor operação capaz de provar a mudança.

### Flags e perfil comercial de Production

Production não permanece em manutenção como estado normal. O smoke pós-promoção
valida o perfil público e comercial: páginas públicas acessíveis, readiness verde,
checkout habilitado e webhook Asaas exigindo autenticação.

Para a liberação comercial atual, mantenha no ambiente Production:

```text
APPLICATION_MAINTENANCE_MODE=off
PAYMENTS_CHECKOUT_MODE=public
ASAAS_WEBHOOK_ENABLED=true
SCHEDULED_JOBS_ENABLED=true
```

Quando a migration ou a promoção exigir manutenção, altere o ambiente
Production na Vercel antes da operação para:

```text
APPLICATION_MAINTENANCE_MODE=full
PAYMENTS_CHECKOUT_MODE=disabled
ASAAS_WEBHOOK_ENABLED=false
SCHEDULED_JOBS_ENABLED=false
```

Depois que o deployment verificado estiver promovido, altere somente
`APPLICATION_MAINTENANCE_MODE` para `off`, faça um novo deployment/promote do
mesmo SHA validado e repita os smokes públicos e de readiness. Ao final da janela
de manutenção, Production volta ao estado comercial vigente, aberto desde
2026-08-21: `PAYMENTS_CHECKOUT_MODE=public`, `ASAAS_WEBHOOK_ENABLED=true` e
`SCHEDULED_JOBS_ENABLED=true`. As flags desabilitadas listadas acima pertencem
somente ao perfil de manutenção durante a operação.

Secrets são reconciliados manualmente, sempre Staging → Production. Confirme
somente nomes, presença e fingerprints seguros entre GitHub Environments,
Vercel e providers. O valor de uma chave não deve ser impresso nem persistido
no repositório. Resend mantém o domínio/remetente verificado; a rotação troca
apenas a chave. A rotação de `BETTER_AUTH_SECRET` em Production exige janela
aprovada e teste de login novamente.

## Se alguma coisa falhar

### CI ou Preview falhou

- não faça merge;
- corrija na branch;
- execute os testes;
- faça novo push.

### Migration Development falhou

- não inicie Production;
- não use `db:push`;
- registre o nome do step e o erro mínimo;
- peça revisão.

### Workflow Production falhou antes da promoção

- o domínio deve continuar no deployment anterior;
- não repita imediatamente;
- descubra se a migration foi aplicada;
- registre o link do run e o step vermelho.

### Production apresentou erro depois da promoção

1. registre horário UTC, impacto, SHA e `correlationId`;
2. interrompa operações de risco;
3. verifique se houve migration;
4. não reverta SQL manualmente;
5. siga [Deploy e incidentes](deploy-and-incidents.md#rollback);
6. use deployment anterior somente se ele continuar compatível com o schema;
7. caso contrário, prepare um forward-fix.

## Informações seguras para pedir ajuda

Envie:

- link do Pull Request ou workflow;
- nome do job e step;
- mensagem de erro mínima;
- horário;
- SHA, quando exibido pelo GitHub;
- `correlationId`, quando existir.

Nunca envie:

- token;
- senha;
- conteúdo do `.env.local`;
- URL de banco;
- URL assinada R2/JMVStream;
- payload financeiro;
- dados pessoais de cliente.

## Checklist de bolso

Antes do Pull Request:

- [ ] branch própria criada a partir da `main`;
- [ ] Pull Request aberto para `staging`;
- [ ] jornada local testada;
- [ ] `bun run verify` verde;
- [ ] diff revisado;
- [ ] nenhum segredo;
- [ ] migration identificada e revisada, se existir.

Antes do merge:

- [ ] cinco checks verdes;
- [ ] Preview aplicável revisado;
- [ ] revisão concluída;
- [ ] nenhuma migration presa no bloqueio conhecido.

Antes do Pull Request `staging → main`:

- [ ] CI pós-merge de Staging verde;
- [ ] deploy e smoke de Staging verdes;
- [ ] gates externos aplicáveis registrados;
- [ ] nenhuma alteração direta na `main`.

Antes de Production:

- [ ] CI da `main` verde;
- [ ] Development sincronizado e testado, quando houver migration;
- [ ] nenhum deploy concorrente;
- [ ] `confirm_production` marcado uma única vez.

Depois de Production:

- [ ] workflow verde;
- [ ] aplicação respondeu;
- [ ] jornada alterada validada;
- [ ] Sentry e logs conferidos;
- [ ] evidência registrada.

## Evidências

`.github/workflows/ci.yml`, `.github/workflows/deploy-vercel.yml`,
`.github/workflows/migrate-development.yml`, `scripts/verify.ts`,
`scripts/migrate-development.ts`, `scripts/migrate-production.ts`,
`src/db/migration-target.ts`, `src/db/migration-state.ts`,
`src/features/operations/readiness.ts` e `package.json`.
