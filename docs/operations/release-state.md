---
status: runbook
owner: engineering
last_verified_commit: cf6a129
deployed_commit: 12d7e7e
deployed_environment: staging
verified_commit: cf6a129
verified_environment: staging
documented_commit: cf6a129
documented_environment: staging
---

# Estado de release

Este documento separa três fatos que não podem ser tratados como sinônimos:

- `deployed_*`: último commit conhecido como publicado no ambiente indicado;
- `verified_*`: último commit que passou os gates locais/remotos conhecidos;
- `documented_*`: commit contra o qual esta documentação foi conferida.

O estado atual deste checkout registra `12d7e7e` como o último deployment de
Staging conhecido. O HEAD `cf6a129` foi verificado localmente, mas ainda exige
execução e promoção pelo workflow oficial antes de ser declarado implantado.

Nenhuma linha deste documento autoriza migration, deploy, rollback ou alteração
de dados. O [guia de Production](production-release-guide.md) continua sendo o
procedimento operacional; este arquivo é somente o registro verificável do estado.

## Atualização

Atualize os seis campos de estado na mesma mudança que altera o procedimento de
release. Não substitua `deployed_commit` por `verified_commit` enquanto o deployment
não tiver passado pelo smoke test do ambiente correspondente.
