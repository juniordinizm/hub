# Auditoria suplementar: outros clientes e novas instalações

142 arquivos: 132 caminhos sem parecer do inventário inicial e 10 adições anunciadas no catálogo (Cloudflare e Sentry). Revisão estática de gatilhos e regras operacionais, com leitura integral por ferramenta e inspeção semântica direcionada. Não certifica APIs, execução dos scripts, ausência de todos os defeitos ou ativação de caches em outro cliente.

## Achados

- P2: Cloudflare building-ai-agent-on-cloudflare tem gatilho genérico build an agent; agents-sdk e sandbox-sdk também alcançam casos sem Cloudflare escolhido. Condicionar ao provedor já adotado ou pedido explícito.
- P2: Cloudflare sandbox-sdk:10-14 apresenta instalação como primeiro passo até para consulta; verificar dependência e intenção antes de modificar projeto. workers-best-practices:62 universaliza Hyperdrive para PostgreSQL/MySQL externo; tratar como decisão contextual.
- P2: Cloudflare web-perf:20 para se Chrome DevTools MCP estiver ausente. Correto declarar impossibilidade de medir com aquela ferramenta; não bloquear análise de fontes/performance que possa continuar com evidência permitida.
- P2: Neon no Zcode, neon-postgres:57, exige ORM sempre. Isso conflita com consultas SQL existentes e não é requisito intrínseco de todo trabalho Neon.
- P2: react-email no Zcode:225 exige perguntar URL de produção sempre. Consultar configuração/documentação conhecida antes; pedir somente quando faltar.
- P2: benchmarks internos Vercel no Zcode fixam caminhos de macOS, equipe vercel-labs e modo sem permissões dentro de sandbox de avaliação. Não são ferramentas genéricas do usuário. Manter fora de roteamento de produto e não copiar defaults para máquina local.
- P2: várias skills Zcode de diagnóstico têm descrições extensas com listas de sintomas. Consolidar sintomas por ramo sem perder o escopo explícito Zcode, que é útil.
- Preservar: autorização para canais externos, allowlists, secrets fora do Git, revisão de política de acesso, limite de contexto por projeto e defaults somente leitura do Sentry.

## find-docs

`C:/Users/Junior/.agent/skills/find-docs/SKILL.md`

SHA-256: `5BF22997630FD5518112AB855C55DDBA8653B7AEFE16E5EFAD70E38966927FCF`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## claimable-postgres

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/claimable-postgres/SKILL.md`

SHA-256: `64CEB9914B88B07E24F3E2055808CA72C278FC5536F3434E97B79943F39F9F63`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon-ai-gateway

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon-ai-gateway/SKILL.md`

SHA-256: `5050589667F69A362B2E66238286D5A9B6FB721C1C5D5EDF99A9455865B6F998`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon-functions

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon-functions/SKILL.md`

SHA-256: `12E040349FB88DCC05BC6A574A8B4CA430261C507C8B03398C6B510D0A5911F8`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon-object-storage

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon-object-storage/SKILL.md`

SHA-256: `684BD263963AA570D4010C3E9717E035AD386BD7C0D39620080FEC26341FC738`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon-postgres-branches

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon-postgres-branches/SKILL.md`

SHA-256: `C3E2E4126F944225E8845177232AD94C0B8D4AD8B946D634A0A55AC17402C24F`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon-postgres-egress-optimizer

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon-postgres-egress-optimizer/SKILL.md`

SHA-256: `5CC66ED51B8AA656670246CE1974CBE8117FE47E9FCD7E9459CB97685E5A578A`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon-postgres

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon-postgres/SKILL.md`

SHA-256: `1FCAC02FD2EC6BD79DCB22D0CF64668F32A7FCBF470870497F3D06D1ABBFCCB6`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## neon

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/neon/1.1.2/skills/neon/SKILL.md`

SHA-256: `70E72A901CE4E62EF39D5861978392308E7F3F235EC09556B51F676AB6E0987A`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## agent-email-inbox

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/resend/1.0.5/skills/agent-email-inbox/SKILL.md`

SHA-256: `A4D107E10C2960ECBFC4BE17679C6D1ABA294BADEBA42E31E267B21EF2ECED33`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## email-best-practices

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/resend/1.0.5/skills/email-best-practices/SKILL.md`

SHA-256: `DE14D134B1B65CC53A926EA251A77F74F6DC639C122E321448C71443A78E45B2`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## react-email

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/resend/1.0.5/skills/react-email/SKILL.md`

SHA-256: `1E6FE4A5DF2C7BB54E91EE0D1947C7BFCF7996F84879C6CBD9C915E5691AE76B`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## resend-cli

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/resend/1.0.5/skills/resend-cli/SKILL.md`

SHA-256: `F1E79C9634D27A9FAA299156A360C9774C3F6E0D7F1A56E1B7EBE8A4FE0E74B1`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## resend

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/resend/1.0.5/skills/resend/SKILL.md`

SHA-256: `C2953E48E806FC6D89720791019EF0B5707F13A974080538E573A59894AF5AB2`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-cli

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry-cli/0.43.0/skills/sentry-cli/SKILL.md`

SHA-256: `9A2BE99FF5527876C760867475D7479BF6682CF2A26C965BF7ED23C9CEE698F3`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-create-alert

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-create-alert/SKILL.md`

SHA-256: `6B77BEF90D5D89283D29079A9E1CCBF58F4917018A5DC406310E2666D36881DB`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-debug-issue

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-debug-issue/SKILL.md`

SHA-256: `7FD7A690060FA09178AE92DAABE96A61B6957D66AB40E21E93DDF8C906F3EC78`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-fix-stack-traces

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-fix-stack-traces/SKILL.md`

SHA-256: `7D520F7450ABD932791B880E050EAFBC948BFE0AC309875DD7326E286ECA989C`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-get-started

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-get-started/SKILL.md`

SHA-256: `CB3F6AF6417680A2D4BDD3B86A6C6D494B14EEC354DCD5600F24C8262063C7D2`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-instrument

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-instrument/SKILL.md`

SHA-256: `DE57176F912ACDEB784F3DE8A6BCE99D39C521989742464F2D9DE482309EED63`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-otel-exporter-setup

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-otel-exporter-setup/SKILL.md`

SHA-256: `8671E32A5D05DC708846889F1081E28C782C24EE1575A33DE89A2D2A9D81C8FC`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-setup-releases

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-setup-releases/SKILL.md`

SHA-256: `BC78F9806552D2ECD388D41327481F7927058F854AC55530F2E824435E8DCE26`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## sentry-snapshots-cocoa

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/sentry/1.3.2/skills/sentry-snapshots-cocoa/SKILL.md`

SHA-256: `1A3E9A08AAC93912E6E26ED766298FEABCE47E77179B641061D57C59FFF9E3D9`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.

## brainstorming

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/brainstorming/SKILL.md`

SHA-256: `74EDF03EA6D24EF53DB48677B93558D14A979BDF052CA3F57ECDCA0C66791608`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## dispatching-parallel-agents

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/dispatching-parallel-agents/SKILL.md`

SHA-256: `1968923066F3B707EB01D1992CDF4C42284C3855F70253B9CD5000FF45FCA13C`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## executing-plans

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/executing-plans/SKILL.md`

SHA-256: `C4C3D8B628C51114CD165FB8246FE02744CD8BE180032328391252E653028D9B`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## finishing-a-development-branch

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/finishing-a-development-branch/SKILL.md`

SHA-256: `8DB5A922B242DD4E1BF824CB91C13B3E8D8E8A86D6CEAF7F0774EB9CCE909D65`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## receiving-code-review

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/receiving-code-review/SKILL.md`

SHA-256: `091DF1629510AF1B92FC4ABD6F96732EBEDB4CB2C0F3457E8F2740B0504A2438`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## requesting-code-review

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/requesting-code-review/SKILL.md`

SHA-256: `D71CC01BA56D2325CF8AF5F7C11837819B63ECD57DE0BFDB812F7F3FF7751DF8`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## subagent-driven-development

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/subagent-driven-development/SKILL.md`

SHA-256: `8DD1B8E698EDEC3700C6D89517DBE96FEBD3BACD3F6EA21C1A3569C62EA104B5`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## systematic-debugging

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/systematic-debugging/SKILL.md`

SHA-256: `808FC5717AA88AD65EFFF312B11C186294D3E6EE301AFB584E2F86599B137787`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## test-driven-development

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/test-driven-development/SKILL.md`

SHA-256: `BF1B8216E523851A411E91D429A7C1C2A173E79D88957BC78E348218D50EDD54`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## using-git-worktrees

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/using-git-worktrees/SKILL.md`

SHA-256: `8CFB86F121269E8F7F12361E6795C4F6738828340E28964C9229D365666C9EDD`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## using-superpowers

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/using-superpowers/SKILL.md`

SHA-256: `30F2AB78E20DDC27EE7158AE8D4A2ABE161C360981C7CC3548070913142D3DC3`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## verification-before-completion

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/verification-before-completion/SKILL.md`

SHA-256: `2BEFE7FC55BCADAA3D97DD9E8EFEB633D2561C0EBE74C5A8B17C4D9E7E4520B3`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## writing-plans

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/writing-plans/SKILL.md`

SHA-256: `48508F44BBFD7D24B029FBF3A314F3CD14C9615599059366E922F47B8DC08CF2`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## writing-skills

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/writing-skills/SKILL.md`

SHA-256: `D34DB5C8AED6A4E0440132BD0613AACE70A693EC7819D5637AD77481D8E10D1B`. Consolidar por cliente e reduzir receitas universais/gates; diferenças de host impedem deduplicação cega.

## benchmark-agents

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/benchmark-agents/SKILL.md`

SHA-256: `95FD9D33BE1B5704987A17CB335A294EB7D7E307C0B2C00D75AC94958468A7AC`. Ferramenta interna de manutenção/eval: restringir ao repositório e ambiente de avaliação correto; não aplicar defaults no Hub.

## benchmark-e2e

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/benchmark-e2e/SKILL.md`

SHA-256: `1F18EC33990B765E7235BFEC8E28B41F088AAD5C5EA977B041C4657465CE624B`. Ferramenta interna de manutenção/eval: restringir ao repositório e ambiente de avaliação correto; não aplicar defaults no Hub.

## benchmark-sandbox

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/benchmark-sandbox/SKILL.md`

SHA-256: `2588BBDA779E1843D131BE656DD89FDCB8599D626B84366FF10F98E13733D4A4`. Ferramenta interna de manutenção/eval: restringir ao repositório e ambiente de avaliação correto; não aplicar defaults no Hub.

## benchmark-testing

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/benchmark-testing/SKILL.md`

SHA-256: `9D5EAD7EED4F56A57CBFBF475614C970589131FF8C279D85738EAA94979152B0`. Ferramenta interna de manutenção/eval: restringir ao repositório e ambiente de avaliação correto; não aplicar defaults no Hub.

## plugin-audit

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/plugin-audit/SKILL.md`

SHA-256: `3179280FFB97921CB5E91FDCE5BB45003DB9B15E76F9F9887A519CCB603EA32A`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## release

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/release/SKILL.md`

SHA-256: `F0BA3B1F281455AC11CF239DEF54F2AB9CCE65AC1CB6C4512D622BC337294025`. Ferramenta interna de manutenção/eval: restringir ao repositório e ambiente de avaliação correto; não aplicar defaults no Hub.

## vercel-plugin-eval

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/.claude/skills/vercel-plugin-eval/SKILL.md`

SHA-256: `5C701868CC662025D01E38700C1E1D13D1CDD4F60C4F7405615F651D759571AB`. Ferramenta interna de manutenção/eval: restringir ao repositório e ambiente de avaliação correto; não aplicar defaults no Hub.

## ai-gateway

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/ai-gateway/SKILL.md`

SHA-256: `7BFDFAA64D0636A3A972B3C93FD6C707B94A3C48E99F81808C5DF79A609747D2`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## ai-sdk

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/ai-sdk/SKILL.md`

SHA-256: `255C0F4BD83A3A6092B31B887E7F42026EED1AEE14BF9D8CF63083D0058BD116`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/ai-sdk/upstream/SKILL.md`

SHA-256: `07E3AC5F423104015BB6E324D9840C61F9DF52542AD6F3141DE0A419D8AEFD2F`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## auth

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/auth/SKILL.md`

SHA-256: `B6B9C4B0C9C214F718EEF37246E0416A44E52F9FBBA11C777892E90AF3300F8F`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## bootstrap

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/bootstrap/SKILL.md`

SHA-256: `ED2F91DBEC2CB2BE24F41466407A5F9B52CAF69D18A5F63064BFA937156B7828`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## cdn-caching

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/cdn-caching/SKILL.md`

SHA-256: `5B5F2FA4057993D97AC47F1352B5714E0B530454CE73F098C3D5EEF61222C17B`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## chat-sdk

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/chat-sdk/SKILL.md`

SHA-256: `82D66D41AF16DCC12085BDD4573FE6358BC9F4033972738E9E753A239BA103F1`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/chat-sdk/upstream/SKILL.md`

SHA-256: `D6D1224C2D01AA145D34FDB4E7877B61DC9DE18315F6BA0344CAD21E5DF1DBEC`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## deployments-cicd

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/deployments-cicd/SKILL.md`

SHA-256: `A0D6C92265015D028F8F42F35C28FDE880E01CDD43D0109F9788C1B373A721BD`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## env-vars

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/env-vars/SKILL.md`

SHA-256: `BA0BDB4DB224E04D1AEBB60CACB0C6D7242A1A75A832B7C9B39FBE6773F8DF61`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## eve

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/eve/SKILL.md`

SHA-256: `C7871BDFD592413006B755C08CEB52C2DAA177D36EA4B3A3F5822C09FD10A00B`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/eve/upstream/SKILL.md`

SHA-256: `E467A328D14991A6486A7A2010046FD89D187258806820D569BFAC2E135D1725`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## knowledge-update

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/knowledge-update/SKILL.md`

SHA-256: `A7F6EDE9545DCB9BBF36209A6642B104B3182657AF893FB828E7F2C9D61468FD`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## marketplace

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/marketplace/SKILL.md`

SHA-256: `E36D17E4A8CFBFD4D95A67B8E7872FB3E75A1206B833A6EC5360D6830C4652E8`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## microfrontends

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/microfrontends/SKILL.md`

SHA-256: `2B846D0E875117919E1720F6E086B09560B9F3EFC5C3B17575D0F23ADF173C1A`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## next-cache-components

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/next-cache-components/SKILL.md`

SHA-256: `4C296AA985079C913F68E5BC0F603C0054FABD2DD7DFDFCC7000198FC5A4B99E`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/next-cache-components/upstream/SKILL.md`

SHA-256: `92FC6AC94C5CABDCD13C7DC7AABD6A4D04921E6295DFC00DD9888E375FD1FF4C`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## next-forge

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/next-forge/SKILL.md`

SHA-256: `97FCEFAA3F0A5174CCEEFEAEA30E92AA7EC5F34D67730649EECAD373EF0849D3`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/next-forge/upstream/SKILL.md`

SHA-256: `BE76E0D67CFD50860E2014643FA085977D73E9D9F775F8132791B8E5D1ED5AC6`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## next-upgrade

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/next-upgrade/SKILL.md`

SHA-256: `96D79DD3CFF54D5C1B00CBF3099DCAFB8140DE673D74ECD313EABA4B0CA1AE54`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/next-upgrade/upstream/SKILL.md`

SHA-256: `562F9834D7C55C37498E0787FE431061F4BB766CD1DD6BB52441790593C7E1A8`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## nextjs

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/nextjs/SKILL.md`

SHA-256: `A84D03AB8E78050515656D94984D98B37BD30D57B9E290A6B5071053DDA5023F`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/nextjs/upstream/SKILL.md`

SHA-256: `C78F952D4E98BF3694856DBF70C03A6037D4E258FF3701F2642BFDF108549A25`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## react-best-practices

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/react-best-practices/SKILL.md`

SHA-256: `1F5A862B4C60FBF157DC98931606A41485223E616840393A00D0A9F053F10F28`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/react-best-practices/upstream/SKILL.md`

SHA-256: `D7B0EC66EA66A17E882F824081EF1D79D5A7C4B0A0304046FDE7345482B8CC06`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## routing-middleware

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/routing-middleware/SKILL.md`

SHA-256: `B582EE4551D744ADFA6F9428FA4268A84C5C83FC042D633DF8AAEB8C1C00619D`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## runtime-cache

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/runtime-cache/SKILL.md`

SHA-256: `22FB4BE9B3B2E39ED5514467C44F5A809A0CCFCCC4EBAAC64273E8918B47A1C2`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## shadcn

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/shadcn/SKILL.md`

SHA-256: `4A24ABF22A6D10A6E4A0917B0CFB73E45DFA15CD5EEC502EC19C661863D8C5F1`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## turbopack

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/turbopack/SKILL.md`

SHA-256: `8EF65187C42680AAE178288BAA02EE8328AD72995CFA7EAD960E12389297EF1C`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-agent

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-agent/SKILL.md`

SHA-256: `C7DDCF740E60690490156E04332D7ED36928811F17B2391AF9816258E3E06E96`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-cli

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-cli/SKILL.md`

SHA-256: `2E41D91935F64834447DA1E50825FA11070C5EF39B8394190A100F0FC76C983E`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-cli/upstream/SKILL.md`

SHA-256: `14984C8339516B9CE016912AF1AD9B08CB9893EF1803560E81FFCF9F7F7D6D4E`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-connect

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-connect/SKILL.md`

SHA-256: `9E2180431C0F6CA3B776AF03605D3377B777FDE08CCCAAA3EB645DA067A9531D`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-firewall

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-firewall/SKILL.md`

SHA-256: `04869E0DB25BF5BF1F0D26C541DC952BD37FC512786FD6838A7C9EF5DC630918`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-functions

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-functions/SKILL.md`

SHA-256: `66234B69F9C9A2FABAFC7C1736B3462AC255D2C286C2465ED0A1F5ED4B35A6A8`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-sandbox

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-sandbox/SKILL.md`

SHA-256: `8A80453DE690FB076D74FA62057FB1E3BA97435A127A71C7B6C645BF8B4790AE`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-sandbox/upstream/SKILL.md`

SHA-256: `15DA32DCA80C4C84E061F6C567DBFBDE1C582C373445554A2D4662F4DF8A6FE3`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## vercel-storage

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/vercel-storage/SKILL.md`

SHA-256: `9365181D819522CB1B206F08FA3261B0F0481382B8518F5A9349C7837D0123CC`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## verification

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/verification/SKILL.md`

SHA-256: `1C9CDB2B04C479A94ADA1994D4EF1C216ACACBA5FCEE4959B40ECA11A05E8070`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## workflow

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/workflow/SKILL.md`

SHA-256: `5D3F2E4A353FD3DF599AF297F34FF556133156BCED5C8B0143ADA60BAB176BE9`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## upstream

`C:/Users/Junior/.zcode/cli/plugins/cache/claude-plugins-official/vercel/0.45.1/skills/workflow/upstream/SKILL.md`

SHA-256: `EE1D6C402C507653B303B0309F660FE975F38010AA9E86EAE577549B585EC7AC`. Manter referência especializada; revisar gatilhos genéricos e escolhas obrigatórias de provedor/modelo/ORM, conforme achados.

## control-browser

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/browser-use/0.3.0/skills/control-browser/SKILL.md`

SHA-256: `8A0CF80A4DDEAFD1593B19CCCABEA3E0512C8E64D9239E4787B3EC1DF94EBC03`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## web-gui-tester

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/browser-use/0.3.0/skills/web-gui-tester/SKILL.md`

SHA-256: `9C02D66665CE3A4322086EBA57A42DF904B157C4A804CDCBE949A49088E57968`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## docx

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/document-skills/0.1.0/skills/docx/SKILL.md`

SHA-256: `AB4F16F1AC259EC4C924DB5EEC4F52FA84D5A398AE2837EDFDE6286C9C79D01E`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## pdf

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/document-skills/0.1.0/skills/pdf/SKILL.md`

SHA-256: `4CF1E51ECF2D45D1C73592605D4E0B5D9D6FE135198105383B11F8ADD6A90A5F`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## pptx

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/document-skills/0.1.0/skills/pptx/SKILL.md`

SHA-256: `5ABAB8185D798488F9E00599E78E3F94CD9FE4BF01CFCC9979AC8D1E91392E11`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## xlsx

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/document-skills/0.1.0/skills/xlsx/SKILL.md`

SHA-256: `5D83D451B40991DE4D5E58AB7EBDF7A50AAED2651B96E88CF818B62D1AD13E7A`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## restore-legacy-sessions

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/restore-legacy-sessions/0.1.0/skills/restore-legacy-sessions/SKILL.md`

SHA-256: `3E1425F8663AF6BF20AEDABEDCEB956CC8D019A41511DDAB990A67B227157138`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## skill-creator

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/skill-creator/0.1.0/skills/skill-creator/SKILL.md`

SHA-256: `F024AF258401F943E15443D5D7BD987A14C2ADDE0FE7AF9A734E3AC110DD237D`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## diagnosing-commands

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.1.0/skills/diagnosing-commands/SKILL.md`

SHA-256: `CAB26C629AA51A0117511FF09E1D69C1E0A73FBEE75AACF273B3F3247FE884D1`. Manter apenas para Zcode; reduzir descrição por ramo e não importar schemas/ferramentas do cliente como regra Codex.

## diagnosing-hooks

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.1.0/skills/diagnosing-hooks/SKILL.md`

SHA-256: `EA9D17D0759606297C30550E0632F3EA04264F5221427FC4E9C44CCADCACF37F`. Manter apenas para Zcode; reduzir descrição por ramo e não importar schemas/ferramentas do cliente como regra Codex.

## diagnosing-mcp

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.1.0/skills/diagnosing-mcp/SKILL.md`

SHA-256: `D68D60801FEA244A94201177170F1AE57B1C6E04F20B5F2644AFC68DA03C16D6`. Manter apenas para Zcode; reduzir descrição por ramo e não importar schemas/ferramentas do cliente como regra Codex.

## diagnosing-plugins

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.1.0/skills/diagnosing-plugins/SKILL.md`

SHA-256: `C037911D16003DD204D585405745F64E23FFA8731EA148C20CCAFC6DB2DDAD0A`. Manter apenas para Zcode; reduzir descrição por ramo e não importar schemas/ferramentas do cliente como regra Codex.

## diagnosing-skills

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.1.0/skills/diagnosing-skills/SKILL.md`

SHA-256: `EF18A29278F31957F9827625DC1350D59FF4811CCABC5DCE81F9FA6DCFA59419`. Manter apenas para Zcode; reduzir descrição por ramo e não importar schemas/ferramentas do cliente como regra Codex.

## zcode-configuration-guide

`C:/Users/Junior/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.1.0/skills/zcode-configuration-guide/SKILL.md`

SHA-256: `A74428CBD36D7D59B9445F54FA73FD5838134BABF6CBD9C83CA1875281D3ACE6`. Manter apenas para Zcode; reduzir descrição por ramo e não importar schemas/ferramentas do cliente como regra Codex.

## access

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/external_plugins/discord/skills/access/SKILL.md`

SHA-256: `4FC3DA872E033C37576A904B15A1BCAC6B1CE6C7BC43F1F96ABD7CAD4855AC7A`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## configure

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/external_plugins/discord/skills/configure/SKILL.md`

SHA-256: `9364D7895D6F38B917A711128E7B391884FB8B8D69A62C7D72A81E95B6E2B948`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## access

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/external_plugins/imessage/skills/access/SKILL.md`

SHA-256: `AC994A86AAB3A2724651A13A62EE9DEAE985196C8687A33BB79C4B7898AA5BE7`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## configure

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/external_plugins/imessage/skills/configure/SKILL.md`

SHA-256: `3AFDC7E9FAA36AA0BA9813DCE68509C45014A75B316D366BA44C46EBD8B098AA`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## access

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/external_plugins/telegram/skills/access/SKILL.md`

SHA-256: `6C87F59841C55A4A4F1B732C7427959581E47234F1B8C6FD633E4A5256CE6A3C`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## configure

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/external_plugins/telegram/skills/configure/SKILL.md`

SHA-256: `16B06BF2AC5EDE250D0C620CE4E6CF3878C9704246B8F52390FDE5F280A17F73`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## claude-automation-recommender

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/claude-code-setup/skills/claude-automation-recommender/SKILL.md`

SHA-256: `441C57E26F0931B64DD085DEAAD9213C4E3EFEA27D916DD7443CD33C7E338227`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## claude-md-improver

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/claude-md-management/skills/claude-md-improver/SKILL.md`

SHA-256: `B06C7420BE08CA1C7F6D75F7F4709FDB787624A2D363E2F8052216D8C780F85B`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## claude-security

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/claude-security/skills/claude-security/SKILL.md`

SHA-256: `866561E1DE52F27EAAD7073CF29CE2F4F5A30143AB00DA04C8D3F594A2A3F4D5`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## cardputer-buddy

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/cwc-makers/skills/cardputer-buddy/SKILL.md`

SHA-256: `DAE31D1459C8EE7B4A03D04BF55485F4ECE04BDD4F5A2650AD39EB3D07D9BE10`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## m5-onboard

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/cwc-makers/skills/m5-onboard/SKILL.md`

SHA-256: `C6BA88FD06F59A3E902FEAD2BB863B6834F189672CFCC75248941C23AE39BD2D`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## example-command

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/example-plugin/skills/example-command/SKILL.md`

SHA-256: `D561981660827F3818B0DAEC456AE5B31894F68C22407D8C495A77B3105BA96D`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## example-skill

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/example-plugin/skills/example-skill/SKILL.md`

SHA-256: `87D90442621ACE039AA3379805F99C3F95BF500E9F7B96F9E7876AC2DCF804F5`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## frontend-design

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`

SHA-256: `1608EA77FBB6FC30D13A97D12CFA8EBF31358D40F0DD97BEED24829D6B3F45DD`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## writing-rules

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/hookify/skills/writing-rules/SKILL.md`

SHA-256: `2994B5D3152243B1A1CBF8358E9D7C18F290F31A23920647F31053C3EFDF990D`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## math-olympiad

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/math-olympiad/skills/math-olympiad/SKILL.md`

SHA-256: `F697E195D343520F3DB551BD4FB44C5120504EE2C47A9CC2016CD57767F23403`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## build-mcp-app

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/mcp-server-dev/skills/build-mcp-app/SKILL.md`

SHA-256: `D2FD94F0096506469EC855C581E48293D35480E58E6405B2BFCDBA0486A0C218`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## build-mcp-server

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/mcp-server-dev/skills/build-mcp-server/SKILL.md`

SHA-256: `088CD04BE7F03EBBDFD24973CBCBF93C7A2E09117C4BBA7B2B06BCC3E0A556F6`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## build-mcpb

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/mcp-server-dev/skills/build-mcpb/SKILL.md`

SHA-256: `6BB90AFD0415754E13F353EE5982D13857C14826EDBCBDF5F1481FA5563CD56B`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## playground

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/playground/skills/playground/SKILL.md`

SHA-256: `521A3D62211E5F47B65ED17B660E001B15CF8D88D058CBF31BC00E889BCB63CC`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## agent-development

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/agent-development/SKILL.md`

SHA-256: `6A2826571320828CC6F8F21CCD8E6EEFD2BCED62000C8C5E43A712C12E2D83A1`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## command-development

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/command-development/SKILL.md`

SHA-256: `C55AD02CFE4CBB2A947EEA3B1ED5FA1871E722D627C3C6792C3ED87C10C4D7A8`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## hook-development

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/hook-development/SKILL.md`

SHA-256: `F47E2D42F6360294216A859AE0C30B93CAAFDD2B2E5FFC007489BA4CA447FA5C`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## mcp-integration

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/mcp-integration/SKILL.md`

SHA-256: `B9319D8E44C8F058C1C4F003168295AB2582567FD6329C8B933409116E938BC6`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## plugin-settings

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/plugin-settings/SKILL.md`

SHA-256: `028B955244B937EBC1A5C268A12776B8CEAE4CBFB60928FBCA927227F4C8851D`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## plugin-structure

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/plugin-structure/SKILL.md`

SHA-256: `A2DBC1E5502AACB360D0CA74732CDD7BE4F6A12A49EDF4F2ADE4134FBC026247`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## skill-development

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/skill-development/SKILL.md`

SHA-256: `D51B4E20043B13E462AA86C47EA82D43E216EB292871538127F4B12A54E4944F`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## project-artifact

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/project-artifact/skills/project-artifact/SKILL.md`

SHA-256: `34E13249DBA8A066F33C5F723DBB7B9CB6174B80CC490DD866FBFD1736F0577F`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## receipts

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/receipts/skills/receipts/SKILL.md`

SHA-256: `5B2F407FF40639727310236F4B34986CACD4BF616C07D2E4198846726842E346`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## session-report

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/session-report/skills/session-report/SKILL.md`

SHA-256: `EF0FBC4259A41B7FD61B517FB1C9A95F02B83EA3C79BA0B3AFBEEE4942570397`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## skill-creator

`C:/Users/Junior/.zcode/cli/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/SKILL.md`

SHA-256: `DCD4803E61E913E6FC27294184CD3A71F09F5E924FF20C8A9A20173E7B3C2BCF`. Fonte de marketplace: não há prova de ativação. Manter separada de configuração pessoal; importar somente workflow requerido e compatível com o host.

## external-deliberation

`C:/Users/Junior/Documents/Codex/2026-08-30/inv/work/.agents/skills/external-deliberation/SKILL.md`

SHA-256: `0690C47D46257729C3D0CB644248FB1C2637412954F6B913994CEBB94B9C205F`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## find-skills

`C:/Users/Junior/Documents/Codex/2026-08-30/inv/work/.agents/skills/find-skills/SKILL.md`

SHA-256: `C1D9628984991D7ED59AB3A7BF6A4DAD3D731EF68C71F409F64A0CA258E8028E`. Manter especialidade delimitada; consolidar cópia somente após conferir consumo por host. Sem defeito específico confirmado nesta triagem.

## agents-sdk

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/agents-sdk/SKILL.md`

SHA-256: `007D6CCF85808A6C779F5B058B1BE970D77785000071CB27A55A5F580FBC845B`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## building-ai-agent-on-cloudflare

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/building-ai-agent-on-cloudflare/SKILL.md`

SHA-256: `31554FF30E2EDB8C2DC9BD5FBA15438691FB07F3541F0A0CC843B6A13CDAA573`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## building-mcp-server-on-cloudflare

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/building-mcp-server-on-cloudflare/SKILL.md`

SHA-256: `D76EE46C043D3876D542245E0C26E9D084F4CA8241D811593E93D8D2594118E8`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## cloudflare

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/cloudflare/SKILL.md`

SHA-256: `613C4C57C19BD6385A870B4D441E00A0D88CC6C348C447F8A88889D34B17B2D0`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## durable-objects

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/durable-objects/SKILL.md`

SHA-256: `CD6797CB18F3AE8F721DFD2E5CB27B73A0AA8636683F1A38163DAB2FD51A8DFB`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## sandbox-sdk

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/sandbox-sdk/SKILL.md`

SHA-256: `0F3501E6510921401BE3F54BCB24D2A432A1B5C63AF8F719EDED3A087AD88EA9`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## web-perf

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/web-perf/SKILL.md`

SHA-256: `746B3490D401C8020900F0A62ECE846C22D3DF15782EE843C082ACFA89F26703`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## workers-best-practices

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/workers-best-practices/SKILL.md`

SHA-256: `099432FF265FF6080327EF0B392C118B835D2A5BDA98A7DE07E1AFD115ED6458`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## wrangler

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/cloudflare/0.1.2/skills/wrangler/SKILL.md`

SHA-256: `0AA6FBE6932DF4392779BFDA67B1A0165697369668CB2DBEF66D018A34F44C11`. Manter especialidade, restringir gatilhos ao produto escolhido e respeitar ferramentas disponíveis; ver achados.

## sentry

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/sentry/0.1.2/skills/sentry/SKILL.md`

SHA-256: `C8AE3A1F7521B9B560ADF8D0824C5FF49B1182D7F8870361B292AD1803B639C6`. Manter fluxo de produto e controle de dados. Não instalar, enviar, resolver incidente remoto ou publicar sem escopo autorizado.
