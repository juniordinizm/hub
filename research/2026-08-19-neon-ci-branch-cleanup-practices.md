# Limpeza de branches efêmeras do Neon na CI: práticas oficiais

**Data da pesquisa:** 2026-08-18
**Fuso:** America/Sao_Paulo
**Escopo:** Neon API/OpenAPI, actions e guias oficiais do Neon, e documentação oficial do GitHub Actions. O foco é ciclo de vida de branches efêmeras, TTL, retries e cancelamentos, limites de branches e separação entre CI, Staging e Production. Nenhum segredo ou valor de ambiente do Hub é reproduzido.

## Conclusão executiva

A limpeza de uma branch Neon de CI deve ter defesa em profundidade:

1. remover explicitamente a branch no caminho normal e de falha do job;
2. definir `expires_at` na criação para que o Neon faça a contenção quando o runner for cancelado, perder a conexão ou morrer;
3. executar um janitor agendado, com allowlist de nomes, paginação e limite por execução, para cobrir branches cujo ID nunca chegou ao cleanup.

TTL não é um relógio exato nem substitui a limpeza explícita: o Neon usa um job em background e informa que a exclusão pode ocorrer depois do timestamp. O GitHub também pode interromper o runner antes de uma etapa final; `always()` ajuda, mas não garante que a chamada externa termine.

Branches de CI devem ser criadas com nome estável por execução/tentativa, parent explícito e um projeto Neon dedicado. O nome estável permite que a action oficial reutilize a branch depois de uma resposta transitória, enquanto o projeto separado impede que um workflow de PR ou de CI opere acidentalmente no banco de Staging ou Production. A contagem de branches é uma cota de projeto: o janitor precisa tratar paginação e o plano contratado como limites operacionais reais.

## Evidências do Neon

### Expiração e TTL

- A API aceita `branch.expires_at` em RFC 3339, com precisão de segundos. O timestamp agenda a exclusão automática; a execução é feita por um job em background e pode não ocorrer exatamente no horário informado. A resposta também expõe `ttl_interval_seconds`, valor somente de leitura que preserva o intervalo configurado para reaplicá-lo em um reset da branch. Fonte: [OpenAPI v2 do Neon, schemas `Branch`, `BranchCreateRequest` e `BranchUpdateRequest`](https://neon.com/api_spec/release/v2.json).

- A action oficial de criação expõe `expires_at`; seu default é vazio, isto é, sem expiração. Ela aceita `parent_branch`, cujo default é a branch primária/default do projeto. A action deve receber um timestamp explícito e um parent explícito quando usada para CI. Fonte: [Neon Create Branch Action](https://github.com/neondatabase/create-branch-action), especialmente `action.yml` e a seção “Advanced usage”.

- A documentação de lançamento de 15 de agosto de 2025 registra que a expiração ficou disponível para todos os usuários e que a API, CLI, GitHub Actions e Console aceitam uma data de até 30 dias à frente; na expiração, a branch e seus compute endpoints são excluídos permanentemente. Fonte: [changelog do Neon sobre branch expiration](https://neon.com/docs/changelog/2025-08-15). O OpenAPI atual ainda contém a observação antiga de “Early Access Program” no campo `expires_at`; há uma divergência documental. Para automação, usar a regra de 30 dias anunciada no changelog e validar a capacidade efetiva da conta, sem tratar a nota antiga do schema como limite atual.

- A API permite remover a expiração com `PATCH` e `expires_at: null`. Isso não deve ser feito para branches efêmeras sem uma decisão explícita, porque transforma um recurso que deveria autodestruir em branch permanente. Fonte: [OpenAPI v2 do Neon, `BranchUpdateRequest`](https://neon.com/api_spec/release/v2.json).

### Criação, parent e isolamento de dados

- Sem `parent_id`/`parent_branch`, a branch é criada a partir da branch default do projeto. A API permite informar `parent_id`, `parent_lsn`/`parent_timestamp` e `init_source`; `parent-data` copia schema e dados, enquanto `parent-schema`/`schema-only` evita copiar as linhas. Fonte: [Create branch, API Neon](https://api-docs.neon.tech/reference/createprojectbranch) e [OpenAPI v2 do Neon](https://neon.com/api_spec/release/v2.json).

- O guia de workflow do Neon recomenda criar uma branch por execução de teste, apagá-la ao fim e usar uma branch-base dedicada quando for necessária maior separação de dados. Ele também recomenda nomes que carreguem o tipo de uso e a identidade da execução. Fonte: [Database branching workflow primer](https://neon.com/docs/get-started-with-neon/workflow-primer).

- A action oficial aceita nome da branch e, se uma branch com aquele nome já existe, retorna/reutiliza a existente. Isso torna o nome estável uma forma de absorver retries sem criar uma branch diferente a cada tentativa. Ainda assim, duas execuções concorrentes não devem compartilhar o mesmo nome. Fonte: [README da Neon Create Branch Action](https://github.com/neondatabase/create-branch-action) e [código da action](https://github.com/neondatabase/create-branch-action/blob/main/src/main.ts).

- A API de criação retorna a branch sem compute quando nenhum endpoint é solicitado; o compute e a URL podem só estar utilizáveis depois de a operação terminar. A action retorna `branch_id` e URLs de conexão, mas o guia do Neon alerta para não imprimir `DATABASE_URL`, pois ela contém credenciais. Fonte: [Create branch, API Neon](https://api-docs.neon.tech/reference/createprojectbranch), [Create Branch Action](https://github.com/neondatabase/create-branch-action) e [integração Neon com GitHub](https://neon.com/docs/guides/neon-github-integration).

### Exclusão e recuperação

- `DELETE /projects/{project_id}/branches/{branch_id}` coloca os computes em estado idle, interrompe conexões existentes e só conclui depois das operações pendentes. A API não permite excluir a branch root/default nem uma branch que tenha filhos. Fonte: [Delete branch, API Neon](https://api-docs.neon.tech/reference/deleteprojectbranch).

- No delete manual, o default atual da API é recuperação por até sete dias quando o recurso de Branch Recovery está disponível; `hard_delete=true` remove imediatamente e está em preview. O endpoint retorna `204` quando a branch não existe ou já foi excluída, o que permite cleanup repetido sem tratar “já removida” como falha. Isso é diferente da exclusão por expiração, descrita pelo changelog como permanente. Fonte: [Delete branch, API Neon](https://api-docs.neon.tech/reference/deleteprojectbranch) e [changelog de branch expiration](https://neon.com/docs/changelog/2025-08-15).

- A action oficial de delete aceita nome ou ID da branch e é destinada a cleanup após testes. Fonte: [Neon Delete Branch Action](https://github.com/neondatabase/delete-branch-action).

## Retries, operações transitórias e cancelamento

### Neon API

- A referência da API classifica `POST`, `PATCH`, `DELETE` e `PUT` como métodos não idempotentes: se não houver resposta, uma repetição pode duplicar ou repetir uma operação que já foi aceita. `GET`, `HEAD` e `OPTIONS` são seguros para retry; respostas `503 Service Unavailable` e `423 Locked` são explicitamente seguras para retry. Fonte: [Create branch, API Neon](https://api-docs.neon.tech/reference/createprojectbranch), [Delete branch, API Neon](https://api-docs.neon.tech/reference/deleteprojectbranch) e [Update branch, API Neon](https://api-docs.neon.tech/reference/updateprojectbranch).

- Para criação, não usar retry cego de `POST` com nomes aleatórios. Preferir nome determinístico por execução, reutilização da action oficial ou uma leitura/consulta que confirme se o nome já existe antes de tentar de novo. Para delete, o `204` de branch ausente/já apagada torna a repetição do cleanup tolerante; para erros de lock/serviço, limitar o retry às respostas declaradas seguras e preservar o erro final.

- A API de listagem oferece `cursor`, `limit` de 1 a 10.000, ordenação e `include_deleted`; o default lista apenas branches ativas. O endpoint de contagem permite conferir o total e contar por filtro de nome. Um janitor não deve assumir que uma única página contém todo o projeto. Fonte: [List branches, API Neon](https://api-docs.neon.tech/reference/listprojectbranches), [count branches, API Neon](https://api-docs.neon.tech/reference/countprojectbranches) e [OpenAPI v2 do Neon](https://neon.com/api_spec/release/v2.json).

### GitHub Actions

- Em um grupo de concorrência, o GitHub mantém no máximo um job/workflow executando; por padrão, uma execução pendente é substituída pela nova. `cancel-in-progress: true` também cancela a execução em andamento. `queue: max` permite até 100 pendentes, mas não pode ser combinado com `cancel-in-progress: true`. Grupos são case-insensitive e nomes iguais entre workflows podem cancelar trabalhos de workflows diferentes. Fonte: [Control the concurrency of workflows and jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

- `always()` retorna true mesmo quando o workflow está sendo cancelado e é recomendado no nível de step para tarefas como envio de logs. O GitHub alerta para não usá-lo em tarefas críticas que possam travar. Fonte: [Evaluate expressions in workflows and actions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions).

- Durante o cancelamento, o servidor reavalia as condições dos jobs; o runner envia sinais ao processo, espera a saída e, depois de cinco minutos, força a terminação dos jobs/steps ainda marcados para cancelamento. Logo, um step `if: always()` pode ser iniciado e mesmo assim não completar a chamada de delete. Fonte: [Workflow cancellation reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).

**Implicação:** cleanup imediato com `always()` reduz o vazamento normal; TTL deve ser o limite de segurança para cancelamentos, timeouts e falhas antes de o `branch_id` virar output; o janitor cobre ainda a perda de output, falha de action e concorrência interrompida.

## Limites de branches e custo operacional

- A tabela de preços atual informa 10 branches por projeto incluídas nos planos Free e Launch e 25 no Scale; branches além da franquia nos planos pagos são cobradas por branch-hora. A mesma página recomenda expiração e limpeza automatizada para evitar acumulação. Fonte: [Neon pricing](https://neon.com/pricing).

- A FAQ oficial do site do Neon registra que o Free tem 10 branches por projeto, que a contagem é um limite contínuo (não reinicia mensalmente) e que a criação falha quando chega a 10 até uma branch ser excluída ou o plano ser alterado. Fonte: [FAQ oficial sobre limites do Free](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md), atualizada em 2026-08-14.

- O limite `limit=10000` da API de listagem é apenas o máximo de registros por resposta, não uma permissão para criar 10.000 branches. O total permitido/cobrado depende do plano e da conta; a automação deve consultar a contagem e tratar erro de cota como falha explícita. Fonte: [List branches, API Neon](https://api-docs.neon.tech/reference/listprojectbranches), [count branches, API Neon](https://api-docs.neon.tech/reference/countprojectbranches) e [Neon pricing](https://neon.com/pricing).

- Branches protegidas têm limites próprios nos planos pagos: o guia atual informa até 2 no Launch e até 5 no Scale. A proteção impede excluir/resetar a branch e faz o Neon gerar novas senhas dos roles correspondentes ao criar uma filha, evitando reutilizar a senha da branch protegida. Fonte: [Protected branches](https://neon.com/docs/guides/protected-branches).

**Implicação:** serializar jobs que consomem uma cota pequena pode ser correto, mas isso é uma política do projeto, não um limite fixo da API. A limpeza agendada deve paginar, contar antes/depois, parar em um máximo por execução e nunca apagar por “qualquer nome antigo”.

## Separação entre CI, Staging e Production

- O guia de multitenancy do Neon recomenda um projeto dedicado para o ambiente não produtivo; dentro dele, uma branch-base pode conter os dados de teste e as branches filhas podem ser efêmeras e isoladas. A recomendação é combinar esse desenho com CI/CD e automações. Fonte: [Multitenancy with Neon, seção “Dev/test environments”](https://neon.com/docs/guides/multitenancy).

- Um projeto Neon é o contêiner que reúne branches, databases, roles e computes. Separar o projeto de CI do projeto de Staging/Production reduz o blast radius de uma API key ou workflow incorreto; separar apenas por nome de branch não substitui essa fronteira. Fonte: [Manage projects, Neon](https://neon.com/docs/manage/projects) e [Multitenancy with Neon](https://neon.com/docs/guides/multitenancy).

- Se uma branch protegida for usada como parent, o Neon gera novas senhas para os roles nas branches filhas, em vez de copiar a senha da branch protegida. Isso reduz o risco de expor a credencial do parent, mas não transforma um clone com dados reais em dataset seguro. Para dados sensíveis, o Neon documenta branches schema-only/anonymized e o workflow deve escolher a modalidade adequada. Fonte: [Protected branches](https://neon.com/docs/guides/protected-branches) e [branching workflow primer](https://neon.com/docs/get-started-with-neon/workflow-primer).

- No GitHub Actions, secrets não são enviados ao runner em workflows disparados por forks; workflows disparados por eventos do Dependabot não recebem os Actions secrets normais. Secrets de environment só ficam disponíveis a jobs que referenciam aquele environment e, quando há proteção, apenas depois de as regras passarem. Fonte: [Using secrets in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [Dependabot on GitHub Actions](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-on-actions) e [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

**Implicação para o Hub:** manter uma API key limitada ao projeto de CI, uma branch-base sem dados de Production e um environment separado para qualquer credencial de Staging/Production. Jobs de PR externo e Dependabot devem ficar nos gates que não exigem Neon; os gates com banco devem rodar em push confiável ou em fluxo explicitamente aprovado.

## Práticas recomendadas para o workflow do Hub

As recomendações abaixo são inferências operacionais a partir das fontes anteriores, não regras impostas pelo Neon:

1. **Identidade:** nomear cada branch com prefixo allowlisted e identidade estável da execução, por exemplo `ci-integration-<run>-<attempt>`; não reutilizar o nome entre jobs concorrentes.
2. **Origem:** passar sempre `project_id` e `parent_branch`; validar que o parent pertence ao projeto CI e é a branch-base de teste esperada antes do `POST`.
3. **TTL:** definir `expires_at` na criação, dentro da janela permitida; considerar 24 horas apenas como uma decisão do produto, não como default do Neon. Não remover o TTL após sucesso do job.
4. **Cleanup imediato:** guardar `branch_id` e apagar com `if: always()` depois de migradores/testes; tratar branch inexistente como sucesso idempotente.
5. **Janitor:** executar em schedule, listar com cursor, aceitar apenas prefixos exatos, excluir somente branches não protegidas e não-default, limitar o número de exclusões e manter `dry-run`/confirmação para execução manual.
6. **Retries:** repetir criação somente com nome estável e após erro transitório permitido ou confirmação de estado; não repetir indiscriminadamente todo `POST`. Repetir conexão/migração em uma branch já criada é uma preocupação separada da criação da branch.
7. **Concorrência:** agrupar jobs que disputam a cota do projeto CI ou serializar as fases que criam branches; não usar um grupo de concorrência genérico que possa cancelar o janitor ou um workflow de Staging.
8. **Dados e credenciais:** não derivar CI de Production sem uma decisão de mascaramento; não imprimir URLs de conexão; manter a chave Neon project-scoped e fora de jobs de PR não confiável.

## Limites da pesquisa

- O changelog de disponibilidade geral e o OpenAPI atual não estão perfeitamente sincronizados sobre Early Access; a regra de 30 dias foi tratada como a informação mais recente de produto, mas a execução ainda deve confirmar o comportamento da conta.
- As fontes oficiais descrevem as primitivas (TTL, delete, API, concorrência e secrets); o tamanho do lote do janitor, os prefixos permitidos, a janela de stale e o uso de projetos distintos são decisões operacionais do Hub.
- A pesquisa não executou chamadas autenticadas à API Neon e não inspecionou valores de secrets. O relatório não prova a cota do projeto da CI nem o estado atual de qualquer branch.
