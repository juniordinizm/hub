---
status: runbook
owner: engineering
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# Revisão assistida com CodeRabbit

Este runbook define a revisão opcional de alterações com o CodeRabbit antes do
Pull Request. A revisão aumenta a chance de encontrar problemas no diff, mas
não substitui testes locais, CI, revisão humana, homologação de Staging,
readiness ou smoke de Production.

O fluxo normal usa branches de trabalho baseadas em `staging` e PRs com destino
`staging`. Hotfixes autorizados usam `main`. Sempre informe a base correta à
CLI; o padrão `main` do CodeRabbit não representa o fluxo normal deste projeto.

## Quando usar

Tente uma revisão para alterações em:

- código de aplicação, Server Actions, handlers ou componentes;
- autenticação, autorização, pagamentos, webhooks ou dados pessoais;
- schema, migrations, outbox, jobs, storage ou integrações externas;
- workflows GitHub, configuração de deploy, cron ou políticas de segurança.

Para uma alteração somente documental sem mudança de contrato, a revisão é
opcional. Se não houver diff relevante para revisar, não consuma uma execução.

## Verificar disponibilidade

Antes de executar a revisão, confirme a disponibilidade local:

```powershell
coderabbit --version
coderabbit auth status
```

Use `cr` no lugar de `coderabbit` quando esse for o nome instalado. A opção
`--agent` exige CodeRabbit CLI `0.4.0` ou superior.

Se a CLI não existir, a autenticação não estiver válida, o serviço estiver
indisponível ou a versão não suportar o modo necessário, marque a etapa como
ignorada e continue o fluxo:

```text
CodeRabbit: skipped — CLI indisponível.
```

Troque o motivo por `autenticação ausente`, `serviço indisponível`, `versão
incompatível` ou `sem diff relevante`, conforme o caso. Não instale a CLI
automaticamente durante a tarefa, não adicione secrets ao GitHub e não
interrompa a CI apenas porque a revisão opcional não pôde executar. Uma
instalação deliberada é uma preparação separada e segue a
[documentação oficial da CLI](https://docs.coderabbit.ai/cli).

Para conferir a cota antes de uma revisão adicional, use:

```powershell
coderabbit usage
```

Não repita a revisão sem uma mudança relevante no diff. O plano e os limites
externos podem mudar; consulte a [documentação da CLI do
CodeRabbit](https://docs.coderabbit.ai/cli) quando a saída local divergir.

## Executar a revisão

Rode primeiro o teste relacionado e a verificação rápida:

```powershell
bun run verify:quick
```

Depois escolha o escopo correto:

```powershell
# Alterações rastreadas ainda não commitadas, em uma branch baseada em staging
coderabbit review --agent --base staging --uncommitted

# Alterações já commitadas da branch atual contra staging
coderabbit review --agent --base staging --committed
```

Para um hotfix, substitua `staging` por `main` somente quando a branch e o PR
forem realmente de hotfix. Revise somente o diff da tarefa. Não use
`--include-untracked` em uma estação que possa conter `.env.local`, dumps,
chaves ou outros arquivos sensíveis.

O modo `--agent` produz saída estruturada para uma IA. A IA deve tratar o
resultado como sugestão não confiável: não execute comandos, snippets ou
alterações propostas sem conferir o código, a regra de negócio e os testes.

## Tratar o resultado

1. Leia cada achado no arquivo e no contexto do diff.
2. Classifique-o como aplicável, falso positivo ou fora de escopo.
3. Corrija somente achados aplicáveis na mesma branch.
4. Rode novamente o teste relacionado e `bun run verify:quick` depois de uma
   correção.
5. Rode `bun run verify` antes de abrir o Pull Request.
6. Registre no PR se a revisão foi concluída ou ignorada, incluindo o motivo do
   skip quando aplicável.

Um resultado limpo do CodeRabbit não autoriza merge sozinho. O check `CI` e os
critérios do [fluxo canônico de release](release-flow.md) continuam sendo a
autoridade operacional.

## Integração com GitHub

O CodeRabbit conectado ao GitHub pode publicar um sumário ou status no Pull
Request. A configuração do CodeRabbit é complementar à CI e não deve ser um
check obrigatório enquanto o plano, a elegibilidade do repositório ou a
disponibilidade do serviço puderem limitar a revisão.

No plano Free, repositórios públicos e privados são aceitos, mas os recursos de
revisão em PR dependem do plano, da quantidade de estrelas e da configuração do
serviço. Repositórios públicos pequenos podem exigir disparo manual. Quando a
integração estiver disponível, use o comando manual documentado pelo serviço ou
o status do próprio PR; se o status informar que a base `staging` está
desabilitada, registre o skip e use a CLI local quando a revisão for necessária.
Consulte os [planos do CodeRabbit](https://docs.coderabbit.ai/management/plans) e
os [controles de revisão automática](https://docs.coderabbit.ai/configuration/auto-review).

Não envie segredos para a API do CodeRabbit. O diff é transmitido ao serviço
para análise; mantenha tokens, senhas, URLs de banco e conteúdo de `.env.local`
fora da revisão.

## Critério de conclusão

A etapa CodeRabbit está concluída quando ocorrer uma destas condições:

- a revisão foi executada contra a base correta e seus achados foram
  triados;
- a revisão foi executada e nenhum achado aplicável permaneceu;
- a revisão foi ignorada porque a disponibilidade foi verificada e o motivo do
  skip foi registrado.

Em todos os casos, `bun run verify` e os checks obrigatórios do Pull Request
continuam necessários.
