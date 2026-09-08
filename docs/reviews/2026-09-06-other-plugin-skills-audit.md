# Auditoria dos demais plugins Codex

154 SKILL.md do snapshot, distintos por SHA-256. Revisão de descrições e regras operacionais, com leitura integral por ferramenta para triagem e inspeção semântica direcionada. Não certifica exemplos de API, scripts executáveis ou todas as referências transitivas. Versões em cache não equivalem a plugins ativos.

## Achados prioritários

- P1: gh-fix-ci:15,57-59 exige nova aprovação mesmo para pedido explícito de corrigir CI. Condicionar a decisão material de escopo/risco, preservando autorização já recebida.
- P2: visualize:22-28 proíbe mensagens de progresso e anúncio da skill. Conflita com comunicação do host; remover proibição absoluta.
- P2: plugin-management:32,37 nomeia search_plugins/suggest_plugins. Descobrir capacidades atuais; não tratar request_plugin_install como substituto irrestrito, pois exige pedido explícito de plugin.
- P2: pstack principle-sequence-verifiable-units:12 exige rebase no trunk e impede qualquer lote. Isso não é pré-condição universal de auditoria ou mudança local. Preservar unidades verificáveis sem alterar Git não solicitado.
- P2: pstack unslop:3 combina Must always apply com invocação explícita. Eliminar a contradição. poteto-mode:17 cria ritual de leitura e citação de princípios; simplificar sem perder gatilho opt-in.
- P2: Vercel antigo ai-sdk:123 fixa modelo de imagem universal e :173 restringe modelos por nome. Preferências temporais não devem substituir modelo do usuário ou capacidade efetivamente disponível.
- P2: Sites inclui commit/push no fluxo de hospedagem e preview local. A tarefa de construir um site não revoga a proibição de commit/push e URL local do usuário. Condicionar ao escopo autorizado.
- Preservar limites úteis: templates nomeados pelo usuário, proteção do arquivo de referência, consentimento OAuth, credenciais fora do chat, writes Slack explicitamente solicitados e isolamento de ownership Sites.

## Disposição por arquivo

### computer-use

`C:/Users/Junior/.codex/plugins/cache/openai-bundled/computer-use/26.901.51231/skills/computer-use/SKILL.md`

SHA-256: `8211E4B11A19A0DC4F0ACE91096C74C5B36037CA4CB2C8988F0F535BB209E951`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### sites-building

`C:/Users/Junior/.codex/plugins/cache/openai-bundled/sites/0.1.57/skills/sites-building/SKILL.md`

SHA-256: `F036A18BE47D3012CA8993C82EED2350CB8920FFACD4576C99849846952EA880`. Ajustar conflito de instruções/capacidades descrito acima.

### sites-hosting

`C:/Users/Junior/.codex/plugins/cache/openai-bundled/sites/0.1.57/skills/sites-hosting/SKILL.md`

SHA-256: `3DFB59FA4F08DC5E5CACA99C5E2BF7182851990B3F6197996EEF87B7A55CBFD7`. Ajustar conflito de instruções/capacidades descrito acima.

### visualize

`C:/Users/Junior/.codex/plugins/cache/openai-bundled/visualize/1.0.29/skills/visualize/SKILL.md`

SHA-256: `25F8B5C2C882F26C65DED05D0485984FCBC07C13F0363ABFC3B3A9704D997008`. Ajustar conflito de instruções/capacidades descrito acima.

### deep-research

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/deep-research-work/0.1.14/skills/deep-research/SKILL.md`

SHA-256: `C7B924A736D715BF90941C5E75460B3387EC90B1FDB3A7C79D3E9BFB10427DC6`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### artifact-template-analytics-dashboard

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-analytics-dashboard/SKILL.md`

SHA-256: `CF5360FD8B197673BB237C52C603C97FA319C875C3DFA2CD8EFFF52D4422F513`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-business-review

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-business-review/SKILL.md`

SHA-256: `27721FC1D67D1B41949CAA75AC8F94F81952FF124406878AF6524047929E60D2`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-design-report

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/SKILL.md`

SHA-256: `563722F53854E606F8A9F87E37E72D7EF70A22D46D5836B8E4D6ABFB1B79E9E0`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-experiment-analysis

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-experiment-analysis/SKILL.md`

SHA-256: `0B05EFFC47DF0A14F8E0C3E3597E6722224747435546385D38A2CAE279BD20B9`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-financial-budget

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-financial-budget/SKILL.md`

SHA-256: `C0B6B7A62A15597AAF2B1EC679E21DA48F533B756127F0AEF957CDFE9F3DA738`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-investment-committee-memo

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-investment-committee-memo/SKILL.md`

SHA-256: `68ABD08CFE5E073E3C446A3F675F44C5BF98F57434DBA679E8ACD8A763379A8B`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-legal-memorandum

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-legal-memorandum/SKILL.md`

SHA-256: `51FB9D21BAF6119C4CCB1903638A6BAC0E859210DE63460FFFA7025D52E997E0`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-market-trends-report

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/SKILL.md`

SHA-256: `D58D019B89CB6F292AC3AB991D561489EEF477FF53CE05FB024A0C936F5AF26A`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-minimal-letterhead

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-minimal-letterhead/SKILL.md`

SHA-256: `880EF094D4D0C89A7BDE5CE9BBE4086625C186651E9E6EFC8BA8BDD7CC77F9D5`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-operating-calendar

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-operating-calendar/SKILL.md`

SHA-256: `33BB660791A0B9A21628A42C34934932220203B6AABD84E98CB1B45327D0384C`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-operating-review

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-operating-review/SKILL.md`

SHA-256: `6D63C5CD025FFE936E7BAB5DB3023672BBAEC26AF55C2BB8B057D38C202C9C32`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-project-kickoff

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-project-kickoff/SKILL.md`

SHA-256: `AA893EBD89E7C8D1DB4261D01CC2B1ADD35D78D00785871CCAAA5FC8DB783EC9`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-project-tracker

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-project-tracker/SKILL.md`

SHA-256: `D97D5BE20189B7F53DD269B6E1C5F694EAF53E5A72F6559FCB1578911B7CDA82`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-sales-pipeline

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-sales-pipeline/SKILL.md`

SHA-256: `15CFEEEDF440021F16ED3F3AD8C7C1EF6D48898B9447741E223D2FB41CFC9800`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-simple-dark-mode

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-simple-dark-mode/SKILL.md`

SHA-256: `B7C8D0C05F75878B9BC21E56A57C41EC1AA29700ACA0A24822BE0F9F1BD53207`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-simple-light-mode

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-simple-light-mode/SKILL.md`

SHA-256: `7C68430C6CF57B55B457D4735DBD1A46B889BEF135A32222902DD0848B6E1752`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-strategy-memorandum

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-strategy-memorandum/SKILL.md`

SHA-256: `51D7882AC94E8E57B323394825728C33925AF878806E37277217C2DC12A912E5`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-system-design

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-system-design/SKILL.md`

SHA-256: `87F7B7ED1B0D8410F5E5971CD7F7DB9A4165E2F37069E97E52DBFB469B75A57C`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-team-alignment

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-team-alignment/SKILL.md`

SHA-256: `26D7CAFDCD1899A937B325C5D02AC57C162D45002153BE33A934D35F81EB6110`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### artifact-template-three-statement-forecast

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-three-statement-forecast/SKILL.md`

SHA-256: `74F4A5CCCEC0107B861548B157E04C51D9B58EC13A990C86394B4C529B8ECF41`. Manter gatilho por template selecionado e referência preservada; nenhuma adoção genérica.

### plugin-management

`C:/Users/Junior/.codex/plugins/cache/openai-curated-remote/plugin-management/0.1.0/skills/plugin-management/SKILL.md`

SHA-256: `653841CC21205269F08B0CE135891E1518DAC616A766BCFB0B57D788D3F68B10`. Ajustar conflito de instruções/capacidades descrito acima.

### gh-address-comments

`C:/Users/Junior/.codex/plugins/cache/openai-curated/github/11c74d6b/skills/gh-address-comments/SKILL.md`

SHA-256: `B70F8C4A1C1E48C39848FFB8D3E5867BFFCA84F4F70C297B4221C66B780C24BC`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### gh-fix-ci

`C:/Users/Junior/.codex/plugins/cache/openai-curated/github/11c74d6b/skills/gh-fix-ci/SKILL.md`

SHA-256: `DABCC2A34DD5F1271E4FFDED65B8C65CE53E84B98560B6E9CEAFFCF1C50FC120`. Ajustar gate de aprovação para respeitar correção já solicitada.

### github

`C:/Users/Junior/.codex/plugins/cache/openai-curated/github/11c74d6b/skills/github/SKILL.md`

SHA-256: `380D663305EB74B44858F58D76BDB21173A4D4C63D5885299AD6005D6FFC80B9`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### yeet

`C:/Users/Junior/.codex/plugins/cache/openai-curated/github/11c74d6b/skills/yeet/SKILL.md`

SHA-256: `9D70C68282ACBC7FBEE678F142ADBF84B4F1091890D6CB93B3106E5E629FC0CB`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### google-calendar-daily-brief

`C:/Users/Junior/.codex/plugins/cache/openai-curated/google-calendar/11c74d6b/skills/google-calendar-daily-brief/SKILL.md`

SHA-256: `683B87CA5024404FD82DB7F0A12574A36708FE24AFA046CF8D4466A5846CBCDD`. Manter separação entre leitura, proposta e escrita; preservar timezone e janela limitada de busca.

### google-calendar-free-up-time

`C:/Users/Junior/.codex/plugins/cache/openai-curated/google-calendar/11c74d6b/skills/google-calendar-free-up-time/SKILL.md`

SHA-256: `A4F42210C8E951D285D7E13C8A98988093E4D3740735941C8CAE40F1ACE58E13`. Manter separação entre leitura, proposta e escrita; preservar timezone e janela limitada de busca.

### google-calendar-group-scheduler

`C:/Users/Junior/.codex/plugins/cache/openai-curated/google-calendar/11c74d6b/skills/google-calendar-group-scheduler/SKILL.md`

SHA-256: `70028029DD059CEFEF0B2C32E82A821E876C543F3FB4BF921DB5A21B15FA485D`. Manter separação entre leitura, proposta e escrita; preservar timezone e janela limitada de busca.

### google-calendar-meeting-prep

`C:/Users/Junior/.codex/plugins/cache/openai-curated/google-calendar/11c74d6b/skills/google-calendar-meeting-prep/SKILL.md`

SHA-256: `4BB79DC0240A565A6A0B08D0F689E2EF06AC1D74A238DA6B1BCB9144DE8BD26C`. Manter separação entre leitura, proposta e escrita; preservar timezone e janela limitada de busca.

### google-calendar

`C:/Users/Junior/.codex/plugins/cache/openai-curated/google-calendar/11c74d6b/skills/google-calendar/SKILL.md`

SHA-256: `E8626B2DDCAD251176D96A64971670C1CF172C8067B36C56CCFDACC1BC307143`. Manter separação entre leitura, proposta e escrita; preservar timezone e janela limitada de busca.

### neon-postgres-egress-optimizer

`C:/Users/Junior/.codex/plugins/cache/openai-curated/neon-postgres/11c74d6b/skills/neon-postgres-egress-optimizer/SKILL.md`

SHA-256: `AFDCD73DDCBA17BFB3FBA4C282D73C1F77A373BF651EFEE3BD343C5053A7A4E4`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### neon-postgres

`C:/Users/Junior/.codex/plugins/cache/openai-curated/neon-postgres/11c74d6b/skills/neon-postgres/SKILL.md`

SHA-256: `D869532C0AB31906F20E6BCB77F1DB6A26BD8F175F9955E770316454B7BC1C69`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### sentry

`C:/Users/Junior/.codex/plugins/cache/openai-curated/sentry/11c74d6b/skills/sentry/SKILL.md`

SHA-256: `CE816E37E0790D01EC9AAE9640889033B3FD8B144E9387C52AD621746650D601`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### slack-channel-summarization

`C:/Users/Junior/.codex/plugins/cache/openai-curated/slack/11c74d6b/skills/slack-channel-summarization/SKILL.md`

SHA-256: `22C850678F86FA51C81777E4BB8113837EC6A72850CFFEE549747DF386DDBFF2`. Manter especialidade e autorização explícita de envio; flexibilizar formato repetido por necessidade do destinatário.

### slack-daily-digest

`C:/Users/Junior/.codex/plugins/cache/openai-curated/slack/11c74d6b/skills/slack-daily-digest/SKILL.md`

SHA-256: `48309FBBB5938296611B85281B43031CDD231325BCA805FB715D1950CDBDEF16`. Manter especialidade e autorização explícita de envio; flexibilizar formato repetido por necessidade do destinatário.

### slack-notification-triage

`C:/Users/Junior/.codex/plugins/cache/openai-curated/slack/11c74d6b/skills/slack-notification-triage/SKILL.md`

SHA-256: `6A4DFF3C4C3E743DE44EDAEAE40510D1FAF4461651D226E68D16286CB7DBC9B9`. Manter especialidade e autorização explícita de envio; flexibilizar formato repetido por necessidade do destinatário.

### slack-outgoing-message

`C:/Users/Junior/.codex/plugins/cache/openai-curated/slack/11c74d6b/skills/slack-outgoing-message/SKILL.md`

SHA-256: `EE4BA4E26BB5BA0DB5C868FFEF4C0A3E3D8F3033100A8BAAE2792C1ECBEE9CA4`. Manter especialidade e autorização explícita de envio; flexibilizar formato repetido por necessidade do destinatário.

### slack-reply-drafting

`C:/Users/Junior/.codex/plugins/cache/openai-curated/slack/11c74d6b/skills/slack-reply-drafting/SKILL.md`

SHA-256: `990F6F118D890521022EDEF5BCAD954CC4B0E983CA14DCCDB621E86144B92734`. Manter especialidade e autorização explícita de envio; flexibilizar formato repetido por necessidade do destinatário.

### slack

`C:/Users/Junior/.codex/plugins/cache/openai-curated/slack/11c74d6b/skills/slack/SKILL.md`

SHA-256: `EA2BA119D90B56B6C4893616C3FA0FBE5CBEECE3DE0E3377EE73AD27C0D97197`. Manter especialidade e autorização explícita de envio; flexibilizar formato repetido por necessidade do destinatário.

### brainstorming

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/brainstorming/SKILL.md`

SHA-256: `4625FBFAAFB229D41364B77A3591F9559E0D9D73AB0ED3589BB8E3C63F0CB734`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### dispatching-parallel-agents

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/dispatching-parallel-agents/SKILL.md`

SHA-256: `EE429867974830F3FA1DC2A3B0CF5C98C742A1C33EC0FB156AC3727A255D24B5`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### executing-plans

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/executing-plans/SKILL.md`

SHA-256: `F24E0FDBCDB973B34F81AB481D10BE0E494B5809D9E11F00FCF646A3E268C7A2`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### finishing-a-development-branch

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/finishing-a-development-branch/SKILL.md`

SHA-256: `604AEDD210874565F91207829226305819F3B6CADC323E3DE813A2D9D20AEAFE`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### receiving-code-review

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/receiving-code-review/SKILL.md`

SHA-256: `BDA6F19EBD6D4EC043E448C8D233DE8308F76B72230DE2297B306BC49B8A6E93`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### requesting-code-review

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/requesting-code-review/SKILL.md`

SHA-256: `59F0C7D3180A47946734C03AFA975B417428C49EDAF7526D8E589EF40BB3AA7E`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### subagent-driven-development

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/subagent-driven-development/SKILL.md`

SHA-256: `6BD8B947BAD82CD59BD440B64A6F2A2E92E7C89282CF26187E6EA3BA44F1B199`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### systematic-debugging

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/systematic-debugging/SKILL.md`

SHA-256: `530855DFA2B10D5B9F92AC170FE41C5F8FBC4918957A564855B50A896CA625A2`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### test-driven-development

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/test-driven-development/SKILL.md`

SHA-256: `4F090E919B7310192864F1D046910C53FA7CA353F5CC2B8D07717C7A897F0183`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### using-git-worktrees

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/using-git-worktrees/SKILL.md`

SHA-256: `498BA68274DA48E3B96473BE8CBDDCDC35399E0969D6933D6E7B8FE2D8E89C07`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### using-superpowers

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/using-superpowers/SKILL.md`

SHA-256: `8052A1248970AEE7DDD272BF27E9873AEC08177D5065B75BA8C53D9B68D89D5F`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### verification-before-completion

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/verification-before-completion/SKILL.md`

SHA-256: `C35AC975D145F74D9F3668C1B035A3754D3C0F4EDB491CC80A6A0265CFDF7749`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### writing-plans

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/writing-plans/SKILL.md`

SHA-256: `CD8550405FC7FD224489F0B993FCE822F69626FC0C612B3C9829D991CB4314C6`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### writing-skills

`C:/Users/Junior/.codex/plugins/cache/openai-curated/superpowers/11c74d6b/skills/writing-skills/SKILL.md`

SHA-256: `4D99CD4E235947D27D58241335DFD5CA89B4E873AF5051B19AE32A3AC92851EA`. Enxugar workflow universal, gates e repetição; conferir diferenças desta versão antes de consolidar com a instalação pessoal.

### agent-browser-verify

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/agent-browser-verify/SKILL.md`

SHA-256: `51E0C58EB6FDED833FACCC44CE1F5161DB78DBAEFAA8AF16187F3DFBC6AEC26B`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### agent-browser

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/agent-browser/SKILL.md`

SHA-256: `FB2F5649EA808479A50F3F25DE36DE1ED55CDFAE3971A45C79C29ADA042D8A4C`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### ai-elements

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/ai-elements/SKILL.md`

SHA-256: `F31A5CEB606FBDF1CA0E81527CB55978DD957981F7E70DB3CA678AAA4862E564`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### ai-gateway

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/ai-gateway/SKILL.md`

SHA-256: `D5AC2858E3984B92B818F6EE28D7F9DD9E53B545052D0A6FB84E52E37FA1074B`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### ai-generation-persistence

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/ai-generation-persistence/SKILL.md`

SHA-256: `82FB7247D1357DD0AAC0CB4593D06A27DC9EAA8D982FF5557C187D63B4FBD373`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### ai-sdk

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/ai-sdk/SKILL.md`

SHA-256: `3778B957FD0AFFCD032BCD4CC6F5313C5086789EA20E95D12D32B34D8D571D78`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### auth

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/auth/SKILL.md`

SHA-256: `D292766F2D581A9A5AC73621DBDA541361DEB4A55D530CB60451F880A65B4604`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### bootstrap

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/bootstrap/SKILL.md`

SHA-256: `188C0D6A909C0410F73C86539891925E426321ADC513F2A1940EDB6D237DAE3B`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### chat-sdk

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/chat-sdk/SKILL.md`

SHA-256: `4178A28EE30CAD911E1BCF8E109BE3F236F61617950B940B11DD36BE1D7B800A`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### cms

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/cms/SKILL.md`

SHA-256: `52E4EF01C12B1F142C449218DFF8F6BF11D052E83B65E7206906F736D9A78FCF`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### cron-jobs

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/cron-jobs/SKILL.md`

SHA-256: `2A580546FEDDC73E6658E776AED9053FD6A480574748D6427499679A934A460E`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### deployments-cicd

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/deployments-cicd/SKILL.md`

SHA-256: `69EF3404BB8643A3070FC6BC0AEA165927F38286E5D22041AA82C909822D0AF6`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### email

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/email/SKILL.md`

SHA-256: `481AF3949749EC564FEBD539458BDFFB152AC868FBF6D0D0F1C82B6FCA63A39E`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### env-vars

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/env-vars/SKILL.md`

SHA-256: `6F5B31BD2CB2C9F050E2CF3752C266F45B74DF57B0832516B80D93130F105D3B`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### geist

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/geist/SKILL.md`

SHA-256: `9DF187819184E0CE620B78E2A0AF97661075B463CA61D0322569378A93EB9D63`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### geistdocs

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/geistdocs/SKILL.md`

SHA-256: `92C51F3A579917B238E793C5B677D1AEB71FAE4E97B95D10CBD79D2818608BBA`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### investigation-mode

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/investigation-mode/SKILL.md`

SHA-256: `59D9DD4660FC1C10750EC511DECB8564AB0343F9B52FAA0948BFB2F522DEACFA`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### json-render

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/json-render/SKILL.md`

SHA-256: `FDCDB49618F5CDF925130D43771A1364060A58B0499B4ED47A27508B4879C007`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### marketplace

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/marketplace/SKILL.md`

SHA-256: `F4B68B1CFDB617EC7A2AAD338FCFB72E21CB9BC98B0011A6E5E6525308D739F3`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### micro

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/micro/SKILL.md`

SHA-256: `1C7AC4D7544F00222EF3894988F6D4D75FB087B5045941F793FD03FB4E141991`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### ncc

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/ncc/SKILL.md`

SHA-256: `8D42FE90C5AF043CE384D7F57C1EF68843C3935D4D1603AB557984F8BC849764`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### next-forge

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/next-forge/SKILL.md`

SHA-256: `6CE4505A8836187120FEAEB06773897D0841229C292CC3B202DF19380CD7AF3E`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### nextjs

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/nextjs/SKILL.md`

SHA-256: `66AC7942B8E320388E1663C2108A18354E8D70D541C67969807B4F634AC604F7`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### observability

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/observability/SKILL.md`

SHA-256: `1EEF5A68BE48543A3527B968E9C9C20458F1951141D23F67C6A84970FB69D5B5`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### payments

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/payments/SKILL.md`

SHA-256: `E26A3FAB1D430F0FABFB909420CBC07ECC678D10D29952497BBBB5205EC60E93`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### react-best-practices

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/react-best-practices/SKILL.md`

SHA-256: `78E7BB6698085D75207FEC61616B12E162BB96114B81BC2A89A2A137EB1F1BC6`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### routing-middleware

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/routing-middleware/SKILL.md`

SHA-256: `3560DEA241982F6C15BC9BCC66A2AD12B6E902DC94EC7AA4C8A47DE1953C604D`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### runtime-cache

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/runtime-cache/SKILL.md`

SHA-256: `FAD272FC3589B0A59A26B7D124276B41982E58C16FB49FA999085762A0AB18D6`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### satori

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/satori/SKILL.md`

SHA-256: `AF0488FB0D5CC63CAAD0592297ADCB703788DAD0E9D944B6014A50B8C6337F9D`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### shadcn

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/shadcn/SKILL.md`

SHA-256: `3ACFC1F7F1F0CC19380D641A894DB8B54552F0BD47C97A786E85AE74F748E6E0`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### sign-in-with-vercel

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/sign-in-with-vercel/SKILL.md`

SHA-256: `70E607A7CDEF782D2AD2D2FD747FCEEDB2F7584DA5F25F879421F4CF9592334D`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### swr

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/swr/SKILL.md`

SHA-256: `C22A1535FD6950DF4F046C43700471F415D60D5FB046CF90B64B9D77D4E4AEA4`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### turbopack

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/turbopack/SKILL.md`

SHA-256: `3F665CF083C39D5F7D0DDD16C4A2F04C251E488DE87C72BD9FADB04B804691F6`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### turborepo

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/turborepo/SKILL.md`

SHA-256: `8A2B3AD8E259AA01A484D1D63CF53580FECE2A9176119E07725D58A6785E3A04`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### v0-dev

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/v0-dev/SKILL.md`

SHA-256: `2B6AC0B65DA7FAFC3CF4525FE287D58EE9E7C528E0B56715F672E15CDA774E4C`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-agent

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-agent/SKILL.md`

SHA-256: `DFE32ED9100F0FA46D345972D70604A0E820D0738BD9423B2A4229FFF78E72E7`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-api

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-api/SKILL.md`

SHA-256: `21362B293106F9ACEEC723EBA2394047C7756EBEFD6AB8D994DCD8CDDC3853A1`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-cli

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-cli/SKILL.md`

SHA-256: `D967A7BD682B2D6035A3D5C82EA830BE2E44C9A7B0FD1832D223D9CD70703727`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-firewall

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-firewall/SKILL.md`

SHA-256: `B7698D1E779AAF070297E033059D556C6B111F6CBD4CEBC08B23284451F86B57`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-flags

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-flags/SKILL.md`

SHA-256: `D062E65EB879C2FE7B99BBD204B007A55DB301878DE46E3D34A9DEB21B1B1D7E`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-functions

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-functions/SKILL.md`

SHA-256: `5233EA1DAD73A6B277251F33A6557BF4DDD71CD55A315915B1242D15D2D6688C`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-queues

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-queues/SKILL.md`

SHA-256: `CB2362DBBD83027FB50C5BF148D888F09503EC9345E54E648A7C1014FC958871`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-sandbox

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-sandbox/SKILL.md`

SHA-256: `9215B8F0E33EFDA8E650DEE8B9339D6324D0E8BBE4FC39EE74BFAED3B146A06B`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-services

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-services/SKILL.md`

SHA-256: `C8CEC6753B8198003A25543F20E53671210F854D6B4C40DAC1FFAE1CD6F8C0C6`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### vercel-storage

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/vercel-storage/SKILL.md`

SHA-256: `E3B3343FEF16FB9CF0E8251F81965B8F9A1A777E6C9C60A5AE512F9A1904D43D`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### verification

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/verification/SKILL.md`

SHA-256: `61CD8B14A1869591A8026B30B57005C5BD9159A474129D61E8B67048D088E87A`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### workflow

`C:/Users/Junior/.codex/plugins/cache/openai-curated/vercel/11c74d6b/skills/workflow/SKILL.md`

SHA-256: `53BF37F07F9A4027BA4B2AD4F1BD2727D5A6B90874E04F0848CB113AD3A1E162`. Manter referência especializada sob demanda; consolidar versão ativa e revisar imposições temporais/provedor. Não copiar regras do cache para o Hub.

### documents

`C:/Users/Junior/.codex/plugins/cache/openai-primary-runtime/documents/26.904.11930/skills/documents/SKILL.md`

SHA-256: `9FCC13C3CC34746B134D4ECF4A3C96C9F464D59944FCC99862B2E69AC953F19E`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### pdf

`C:/Users/Junior/.codex/plugins/cache/openai-primary-runtime/pdf/26.904.11930/skills/pdf/SKILL.md`

SHA-256: `9E429BFC5ADA20CCF25A531484E3DCC5DA59811D936A7CC5DFD23DBF2DFADD31`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### presentations

`C:/Users/Junior/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations/SKILL.md`

SHA-256: `B1A05947DD5A98D40C7E9BEEE2596A09A9FF475D2B1138E6E3A8D60B04EF1823`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### excel-live-control

`C:/Users/Junior/.codex/plugins/cache/openai-primary-runtime/spreadsheets/26.904.11930/skills/excel-live-control/SKILL.md`

SHA-256: `3E87AE705DDF2F5110F7C2DE11BC3827DDB26984BBC159D4858EBB69D8DEE7FA`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### spreadsheets

`C:/Users/Junior/.codex/plugins/cache/openai-primary-runtime/spreadsheets/26.904.11930/skills/spreadsheets/SKILL.md`

SHA-256: `B2477F39319682CF156C8FAA36EAC9F039AAEA03A5F09AE72111C76910AE4E75`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### template-creator

`C:/Users/Junior/.codex/plugins/cache/openai-primary-runtime/template-creator/26.904.11930/skills/template-creator/SKILL.md`

SHA-256: `244BFEF01D3E17C6013952CCF34621A90DDFEE9C7828058245C3C46F51114944`. Manter especialidade e limites de dados; requisitos de ferramenta devem ser conferidos no host. Sem defeito específico confirmado na triagem.

### reproduce-and-fix-issues

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/automations/benny/skills/reproduce-and-fix-issues/SKILL.md`

SHA-256: `BD9D688415CABEE95247738F9EA927325BA0EAD7796D0D18CB57CF82DD35DF54`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### setup-benny

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/automations/benny/skills/setup-benny/SKILL.md`

SHA-256: `1B8D0BAE5265413A65B03C9B3B883F1D91EFC0E7C1CB3A28E66C215B3A2094F7`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### triage-issue-reports

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/automations/benny/skills/triage-issue-reports/SKILL.md`

SHA-256: `8122F1C1E65062BF0F1103A587C08ED7D14779C64625643A9F488F262FD21AD8`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### architect

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/architect/SKILL.md`

SHA-256: `A932E383C55EB672E530F28046A7049BBC273960780D86BD27762A2252F1760D`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### arena

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/arena/SKILL.md`

SHA-256: `D1FD28735F8B542FE9040476C3843267EE3572329A5A1A6E315430C4A98E8D65`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### automate-me

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/automate-me/SKILL.md`

SHA-256: `B7A650236A173CCB400C48D226911C9FFD62F0D8C902DF9EDC684EB627546F9A`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### blast-radius

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/blast-radius/SKILL.md`

SHA-256: `E09F560BA1817F95E7C5F2081040E1EBAEC3A88C285DD4D64A99AE6BF1DC1393`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### create-verification-skill

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/create-verification-skill/SKILL.md`

SHA-256: `B7DC1877C14889C6086076891C6E57668F9AB8272AAEA33E8FC2F75E3B2332BB`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### figure-it-out

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/figure-it-out/SKILL.md`

SHA-256: `7A84ADDB25B57D1C524EF99CE7F54570A84E21FA08FF2E1A5A90C01A972479EF`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### how

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/how/SKILL.md`

SHA-256: `B07BECA701E465C6EEB2C816DD9AB1DD381EFA3F95A62C531408F23C77C178D9`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### interrogate

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/interrogate/SKILL.md`

SHA-256: `138CD38FD973AE1D2C76E36B5D78699CD3D0FD1DD75579B913C27A91C9817C3C`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### maintain-verification-skill

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/maintain-verification-skill/SKILL.md`

SHA-256: `F2EC658E27F481BBBB2D3DE867E1D2925B99209D73EE9451B07B463439CB838D`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### poteto-mode

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/poteto-mode/SKILL.md`

SHA-256: `2F6776DC33CA37BBDF134D767BB2FB2884C5361F6A8655C2B5946CA9C64F4179`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-boundary-discipline

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-boundary-discipline/SKILL.md`

SHA-256: `4240C4F31E0FE0E4F77109A1CB9FD8766EAE6001074B4476D1EC630BDA26BB9D`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-build-the-lever

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-build-the-lever/SKILL.md`

SHA-256: `9F9F6D6F1A2829BF80B24BCD9E21BBC38D0B7E1631E3DD9CC99C15A003E982B2`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-encode-lessons-in-structure

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-encode-lessons-in-structure/SKILL.md`

SHA-256: `4B2547640A16404807A6871B5D7EDEB40373817B0D4D1AB39BB7741661CFD385`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-exhaust-the-design-space

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-exhaust-the-design-space/SKILL.md`

SHA-256: `95B366E0A8E1C1ADE4C234B8AA7DBCEBCE2DFE0EA312E0B395F4D6058279EAB1`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-experience-first

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-experience-first/SKILL.md`

SHA-256: `024F1D5E3D6D95C77D9322A8E0CF8BADA0F8D0D4D8B8BC229AF723209D56B4EA`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-fix-root-causes

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-fix-root-causes/SKILL.md`

SHA-256: `99D942A5AEB3534B6B602D617D50F6019B601A625D2E9314A453224E6C0ADA2A`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-foundational-thinking

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-foundational-thinking/SKILL.md`

SHA-256: `5A82D9D76BD86DE946D59C64CD9D6ADE115A5FEFF812A8C55072E2EE4BBF6A9C`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-guard-the-context-window

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-guard-the-context-window/SKILL.md`

SHA-256: `F0C9A2A3AC8EA8FF7731F08BD314D8EEA5177ACD5565577C30655333B0104639`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-laziness-protocol

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-laziness-protocol/SKILL.md`

SHA-256: `AE1F6C0E906F8995F1C3F5A37E4707DF69A0A57718AC2739A4D0AF135C538F54`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-make-operations-idempotent

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-make-operations-idempotent/SKILL.md`

SHA-256: `BF015DCB9941E7DDA4C8280B594FC255AB351F8D88A96C94EBA46A4E712D9CA1`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-migrate-callers-then-delete-legacy-apis

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md`

SHA-256: `0373E27867E5203C5217DED890A32D0DC638F19E3BDACFF2ECB51B76AE0DC56F`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-minimize-reader-load

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-minimize-reader-load/SKILL.md`

SHA-256: `A8A7A10F521885F0CCFC5B7E374FCC1829924B92622157E5A2BBF1D414D8AD47`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-model-the-domain

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-model-the-domain/SKILL.md`

SHA-256: `3C35FEEA40055AC3B1DEB03F67D4ECC082470A017C305C1E120A6F86BF558E3B`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-never-block-on-the-human

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-never-block-on-the-human/SKILL.md`

SHA-256: `8D0FC8373354F3DF49ACDDFEC60418D35F4A02AA224BA3009B0D4B330FE1077D`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-outcome-oriented-execution

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-outcome-oriented-execution/SKILL.md`

SHA-256: `BF9E0F8DFD097C0F9A322455764C5A688041DB78F495460D48894F7203BF519E`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-prove-it-works

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-prove-it-works/SKILL.md`

SHA-256: `F9426E1FEC002D9B4DA01D45B921848B9B44181B3531D04335DCAA8DD5E63113`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-redesign-from-first-principles

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-redesign-from-first-principles/SKILL.md`

SHA-256: `79D7BE1E019C810D25803BE8FD254048475CE9C4C498EEFDDAE1136195FE2547`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-separate-before-serializing-shared-state

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-separate-before-serializing-shared-state/SKILL.md`

SHA-256: `8E0BE543002E9D1F3B779B4D50FE217560C3B2092BAD0627A82E63DC75633ACC`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-sequence-verifiable-units

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-sequence-verifiable-units/SKILL.md`

SHA-256: `8D19F64EE637FF155BE0A153E1807CAE01DC3AEF3B3328E8CE7F320A5C00197E`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-subtract-before-you-add

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-subtract-before-you-add/SKILL.md`

SHA-256: `833A8A09424B22FEE6A1C84A8E704EA00331DEDECBFB3C6A658EBD17888C30BD`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### principle-type-system-discipline

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/principle-type-system-discipline/SKILL.md`

SHA-256: `B5B35E085A03937D9792375D900C40D6DEA4D18B3D5E2929E2981062045097F0`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### recall

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/recall/SKILL.md`

SHA-256: `57AC2949B1DFCE9947EE882A267C3AC6B542A918CD36A4EE5BABD25C06029B78`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### reflect

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/reflect/SKILL.md`

SHA-256: `63A2E507EAEEBB5B8864E25B77C86074FCF5661D4A8FA099CBE5D0B88E061D79`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### setup-pstack

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/setup-pstack/SKILL.md`

SHA-256: `3D0173BF999FA304BF037239F0397CC5DCF1682554BA818DE4C0A36E75B05BF4`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### show-me-your-work

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/show-me-your-work/SKILL.md`

SHA-256: `8EAF77D538D06A0F3155CF4DE96ED224204818F434B22321C12446B80F88BAC0`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### tdd

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/tdd/SKILL.md`

SHA-256: `7B8796C529BE3D9C9E949FD2D36883501AA169FACB063D2F39E53A2931C8242E`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### teach

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/teach/SKILL.md`

SHA-256: `BE8F7F66CA9EF95FE1CA8803086A1279351F7B11E5AEBB3004F3B65274D0F624`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### typescript-best-practices

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/typescript-best-practices/SKILL.md`

SHA-256: `ADEDC52EABF185D685E1DC8712C5554B83953562660DAECE52365A77941D3C6D`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### unslop

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/unslop/SKILL.md`

SHA-256: `080904EEDB28A3A1C066A6C4CC963A303AAFBF6270D3342ADE41F9714C55D43B`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.

### why

`C:/Users/Junior/.codex/plugins/cache/sm0ol/pstack-codex/0.1.0/skills/why/SKILL.md`

 SHA-256: `18B23628623F5DF1D63C836D86DB52EAD620A594714310288A8248C025284845`. Manter opt-in e limites do workflow; reduzir roteamento redundante e princípios que impõem etapas universais. Ver achados específicos acima.
