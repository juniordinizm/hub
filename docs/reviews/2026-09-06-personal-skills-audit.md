# Auditoria de skills pessoais e de projetos, 2026-09-06

Escopo: 249 arquivos SKILL.md/SKILL.MD fora de plugins/cache, 169 corpos distintos por SHA-256 e 80 ocorrências adicionais de conteúdo exatamente igual. Inclui skills de outros provedores, scratch, outros projetos e worktrees. Presença no disco não prova carregamento no Codex atual. Junction .agents/skills/superpowers resolvida pelo inventário suplementar para .codex/superpowers/skills. AGENTS.md e plugins são auditados separadamente.

Método: todos os 249 arquivos foram lidos integralmente por ferramenta para hashing, extração de frontmatter, varredura de instruções e referências locais explícitas; revisão semântica direcionada aos gatilhos, gates, receitas, routers e trechos sinalizados. Não é alegação de leitura semântica linha a linha dos exemplos de API, scripts e de todas as referências transitivas. Disposições de retenção são triagem do desenho da instrução, não certificação técnica do SDK ou validação de execução. Originais preservados.

Referências de avaliação: [Eric Provencher, Rethinking skills and prompts for GPT-6 Astra](https://x.com/pvncher/status/2095991462416490862), conteúdo recuperado pelo coordenador; e C:/Users/Junior/.codex/skills/writing-for-agents/SKILL.md, especialmente linhas 12-18 (gatilhos), 29-41 (disclosure) e 76-81 (poda). A recomendação é reduzir imposições genéricas e redundância; preservar restrições locais, procedimentos especializados e evidência útil. Não deletar skills em bloco.

## Achados prioritários

1. **P1: ativação universal e precedência fictícia.** hub/.agents/skills/using-superpowers/SKILL.md:3,11-24 exige invocação com 1% de chance e afirma que skills sobrepõem o system prompt. O mesmo corpo aparece no pacote superpowers. Remover a política universal; roteamento deve depender da tarefa. Skill nunca redefine a hierarquia do host. A exceção explícita de subagente nas linhas 6-8 é útil, mas não corrige o restante.
2. **P1: gates repetidos antes de trabalho já autorizado.** Hub Imports/.agents/skills/brainstorming/SKILL.md:13,18,25-32,129-154, também copiado em hub e superpowers, exige aprovação para todo projeto, oferta de companion, commit de spec e nova aprovação. hub/.agents/skills/writing-plans/SKILL.md:10,43,52 acrescenta TDD, commits e execução via outras skills. Tornar brainstorming opt-in para design incerto; respeitar decisões já dadas; retirar commits automáticos e companion universal.
3. **P1: diagnóstico impede usar evidência disponível.** araute/.agents/skills/diagnosing-bugs/SKILL.md:55-66 exige comando red-capable antes de hipótese; suas variantes têm o mesmo padrão. Ausência de ambiente reproduzível pode coexistir com prova estática decisiva. Preservar reprodução e teste falsificável quando viáveis, permitir prova estática e declarar o limite em vez de interromper investigação útil.
4. **P1: ação legítima cai em skill que só planeja.** Hub Imports/.agents/skills/improve-ui/SKILL.md:3,106 inclui refine/improve e depois exige oferecer plano mesmo quando pedido é corrigir diretamente. A fronteira read-only é útil para auditoria explícita; reduzir gatilhos a auditoria e handoff, excluindo execução. improve-animations tem tensão equivalente entre improve e stop/wait na linha 78.
5. **P1: pacotes de workflow impõem commits/testes/reviews por hábito.** .codex/superpowers/skills/using-git-worktrees/SKILL.md:66 determina commit de .gitignore; subagent-driven-development/SKILL.md:8,51,267-268 impõe dois reviews por tarefa e worktree obrigatório; verification-before-completion/SKILL.md:22 exige comando na mesma mensagem mesmo havendo evidência recente válida. Preservar isolamento quando necessário e evidência correspondente ao estado; eliminar repetição automática e respeitar autorização de commit.
6. **P2: roteamento UI sobreposto e valores viram lei.** better-ui, make-interfaces-feel-better, emil-design-eng, frontend-design, impeccable, better-typography, apple-design e transitions cobrem grande parte da mesma tarefa. araute/.agents/skills/better-ui/SKILL.md:53,61 determina valores exatos e sempre scale(0.96); Hub Imports/.agents/skills/better-ui/SKILL.md:89 determina tabela para toda mudança. Consolidar entrada UI por intenção; manter referências de cor/tipo/motion; tratar valores como defaults subordinados ao sistema local. emil-design-eng possui ~675 linhas e abertura promocional/espera :10-14 condicionada a invocação sem pergunta; mover exemplos por tópico e retirar ritual de abertura.
7. **P2: documentação especializada se confunde com gatilho genérico.** .agents/skills/find-docs/SKILL.md:3-17 repete a política ctx7 do projeto; .agents/skills/orchestration/SKILL.md:25-33 exige Orca para coordenação genérica embora o host possua colaboração própria. Manter ctx7 como fonte única e router Orca condicionado a estado realmente gerenciado pelo Orca. As referências servidas pelo próprio binário e proteção contra o leitor de tela Linux são limites locais úteis, a preservar.
8. **P2: orçamento de loop arbitrário.** araute/.agents/skills/impeccable/SKILL.md:12 limita todo o ciclo a duas inspeções mesmo se ainda houver defeito confirmado. O objetivo de evitar polimento infinito é útil; término deve ser checks relevantes concluídos ou bloqueio explícito, não um teto que deixa correção necessária incompleta.
9. **P2: APIs de ferramentas de outro host.** Referências a Skill, TodoWrite e Task existem em corpos abaixo. Não são prova de arquivo faltante nem tornam skills Claude/Gemini inválidas no host original. Na distribuição Codex, substituir por descoberta/leitura e ferramentas existentes. Evitar importar regras de permissão e comandos de outros provedores para a sessão atual.

Prefixos de caminhos nos achados: hub, araute e Hub Imports estão sob C:/Users/Junior/Documents/0 - Dev/; .codex e .agents sob C:/Users/Junior/. Os caminhos absolutos de todas as cópias estão no catálogo. Números de linha referem-se ao snapshot auditado.

## Disposição de cada corpo único

Manter = nenhuma razão de remoção observada na triagem; não certifica ausência de defeitos. Enxugar = preservar a especialidade e reduzir gatilho/receita. Consolidar = escolher proprietário por host/projeto, não apagar cópias de outro projeto sem verificar consumo. Referências locais ausentes são somente links markdown relativos explícitos e literais; templates, URLs e âncoras não entram. A resolução foi testada em cada cópia, pois corpos iguais podem ter pacotes auxiliares diferentes.

### 1. domain-modeling

SHA-256: `004D5CB6258658F2E9CBF0D9F90BDC9104F8B83BD296556783800C31D503814F`. 75 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/domain-modeling/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/domain-modeling/SKILL.md`

### 2. grilling

SHA-256: `00D2CCB00B7C02E448330F6405077A9CEE664B92E5734228323B164ABB9B8DBB`. 23 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/grilling/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L22: The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

### 3. better-ui

SHA-256: `01AA5D64C94BDB847D4153D2A90D25EB1A284F9EBD294D2F511E0579F8EA41C3`. 142 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/better-ui/SKILL.md`

### 4. external-deliberation

SHA-256: `0690C47D46257729C3D0CB644248FB1C2637412954F6B913994CEBB94B9C205F`. 233 linhas; 10 ocorrência(s). **Manter opt-in e independência dos relatórios; divulgar contrato/estado extenso por referência e carregar só documentação pertinente ao alvo.**

- `C:/Users/Junior/.codex/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/certificate-preview-font-parity/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/codex-module-content-release-hardening/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/codex-module-content-release/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/fix-lesson-resource-upload-resilience/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/fix-lesson-resource-upload-staging/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/refine-locked-content-ui/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/remove-purchase-schedule-handoff/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/simplify-release-flow/.agents/skills/external-deliberation/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/external-deliberation/SKILL.md`

### 5. interface-design

SHA-256: `06B09967CFDD8B5F67CDCF8ED593AFD67F85370C170D0EE79F409F29B45A6856`. 321 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/interface-design/SKILL.md`

### 6. find-animation-opportunities

SHA-256: `079D3634BDF4DE829D3D312654A7612E122FCA8A4B82AE48D9B0709DAA87D9C4`. 133 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/find-animation-opportunities/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/find-animation-opportunities/SKILL.md`

### 7. next-dev-loop

SHA-256: `07C8721871D56E7A0F19296BCE8472AD518F8BF1C69065D06CEC337FC1FDB491`. 189 linhas; 1 ocorrência(s). **Manter especialidade; manter requisitos de versão explícitos, mas não ampliar escopo para upgrade/adoção sem pedido. Evitar pausas fixas entre etapas já autorizadas.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/next-dev-loop/SKILL.md`

### 8. subagent-driven-development

SHA-256: `081AD3869E55C80BF8F890B4768A90C0E8057DAF94B1B6FADEBFC85EA5B8304A`. 278 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/subagent-driven-development/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L58: "Mark task complete in TodoWrite" [shape=box];
- L61: "Read plan, extract all tasks with full text, note context, create TodoWrite" [shape=box];
- L66: "Read plan, extract all tasks with full text, note context, create TodoWrite" -> "Dispatch implementer subagent (./implementer-prompt.md)";
- L79: "Code quality reviewer subagent approves?" -> "Mark task complete in TodoWrite" [label="yes"];
- L80: "Mark task complete in TodoWrite" -> "More tasks remain?";

### 9. antigravity-guide

SHA-256: `0999FC13D3091E8C2833019CC9AC9C2CADBE0DF356BDC80700CD7DA49915E6E7`. 55 linhas; 2 ocorrência(s). **Manter no provedor/projeto original; inventariado, não presumido ativo no Codex. Não importar sua política de ferramentas/permissões para outro host.**

- `C:/Users/Junior/.gemini/antigravity-cli/builtin/skills/antigravity_guide/SKILL.md`
- `C:/Users/Junior/.gemini/antigravity-ide/builtin/skills/antigravity_guide/SKILL.md`

### 10. research

SHA-256: `0B6597C453178536B50C044A9E57CBC32DBFFA47607A370E40768332F54BF8C2`. 13 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/research/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/research/SKILL.md`

### 11. next-cache-components-adoption

SHA-256: `1153536F9A52830E7537A0A0FE5D20A2FBD7A2B2CFB9F4A2DF41076DC513C219`. 236 linhas; 1 ocorrência(s). **Manter especialidade; manter requisitos de versão explícitos, mas não ampliar escopo para upgrade/adoção sem pedido. Evitar pausas fixas entre etapas já autorizadas.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/next-cache-components-adoption/SKILL.md`

### 12. impeccable

SHA-256: `14C4642368557AF1F7BBAAAC0AA184B791E6D70665DFD8FC53D8D4124F81ABB8`. 176 linhas; 2 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/impeccable/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/impeccable/SKILL.md`

### 13. neon-postgres

SHA-256: `15013E353F25A7CC854FC0A067A1C5332B47937F210E0B076FBA09C6D5C733E4`. 187 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/neon-postgres/SKILL.md`

### 14. better-ui

SHA-256: `18A6E9B576B4A4ECF9DAD880EE1DC4A318489CB4033F2EC8C1134FFCC76BCBCD`. 126 linhas; 2 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/better-ui/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/better-ui/SKILL.md`

### 15. tdd

SHA-256: `193B791C489D1640CCFB58D7CBD60FC9E059EF44632B3C92F208784CFE45AB78`. 39 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/tdd/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/tdd/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L26: When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "codebase-design" for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, levera...

### 16. qa

SHA-256: `199B4D8CBEA7A2B69DE091E221F42B7835A3D0B3215D4D1EFF53F6E9FD7F3A6C`. 131 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/qa/SKILL.md`

### 17. grill-me

SHA-256: `19E660207B447ACF6EE0D600471C02E549C7ACA8FB3AB38FDC2C7056AA442FC8`. 8 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/grill-me/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/grill-me/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L7: Call the Skill tool with "grilling".

### 18. writing-fragments

SHA-256: `1B56725F41C463F562416C820B139E6A582F5165A33F38E65D1F2EA7D18C0BFC`. 80 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/writing-fragments/SKILL.md`

### 19. writing-for-agents

SHA-256: `1C0C4EBF2D221917591144F0CED4FE46DAE13301CB3D6D93FC88ECF0DDA6AED2`. 82 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/writing-for-agents/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/writing-for-agents/SKILL.md`

### 20. orchestrate

SHA-256: `1EAA114F4271A76AB67429D43A7CC05462994E3C61685A5C40CF19CA041CBE71`. 9 linhas; 1 ocorrência(s). **Enxugar gatilho; Orca somente quando seu estado for fonte de verdade. Manter guia versionado do binário e escolha segura de executável.**

- `C:/Users/Junior/.codex/skills/orchestrate/SKILL.md`

### 21. migrate-to-shoehorn

SHA-256: `200C11163ECD56D908EC431154E4B452CD6AFEB3DE91E5B54434F543F0822201`. 119 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/migrate-to-shoehorn/SKILL.md`

### 22. codebase-design

SHA-256: `22D3815E5629DDEA7ED7C9F8E7C330F6A1559466EE904E58371E1E8A10BE0C4B`. 115 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/codebase-design/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/codebase-design/SKILL.md`

### 23. permissioned-github

SHA-256: `25B1849D73AB81DCE8495A7080169CF3F6686ABB74797CC8512F6B837A1FF727`. 151 linhas; 1 ocorrência(s). **Manter no provedor/projeto original; inventariado, não presumido ativo no Codex. Não importar sua política de ferramentas/permissões para outro host.**

- `C:/Users/Junior/.gemini/antigravity-ide/builtin/skills/permissioned-github/SKILL.md`

### 24. grill-with-docs

SHA-256: `269376D5146332F597C4194FA1ADEF93B879AD62E0183C0D111A447E7AF51BE9`. 8 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/grill-with-docs/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/grill-with-docs/SKILL.md`

### 25. pick-ui-library

SHA-256: `26C7DC79E9F38550076BD2643F591BBBD2B839895E4861FDD3E8354AF4F0775D`. 78 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/pick-ui-library/SKILL.md`

### 26. skill-installer

SHA-256: `2892D8B2FB11631132118F340AED80AE17E59D5A571FC2C4F4A4A7E73F139D52`. 59 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/.system/skill-installer/SKILL.md`

### 27. improve-codebase-architecture

SHA-256: `29944DFBD0D0EE73F45FB28B275DD566281F9D61849F00B13EED5656D4C50813`. 72 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/improve-codebase-architecture/SKILL.md`

### 28. find-docs

SHA-256: `2CFC2B3AC1AC150EF084CAC53F899AD198A5BF332532A2C88EE83F00996529C2`. 162 linhas; 1 ocorrência(s). **Manter busca de fonte atual; encurtar sinônimos no gatilho e evitar recarregar política já definida pelo host/projeto.**

- `C:/Users/Junior/.agents/skills/find-docs/SKILL.md`

### 29. tdd

SHA-256: `2DE14B893E7A1BF7030B9EB778A3714A19DA70C4284AD18A6E43B2402AA693EF`. 37 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/tdd/SKILL.md`

### 30. triage

SHA-256: `2FF6A0F1BB2411B40A50962CDF5BE66817E2B27138A1B04E5F204FE15B9ECDF4`. 113 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/triage/SKILL.md`

### 31. implement

SHA-256: `30CD7BC1EBFB3891E85A1EED3B3B81AEA0FA4AD4553A784DE7F8E421B2D223E0`. 16 linhas; 3 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/implement/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/implement/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/implement/SKILL.md`

### 32. using-superpowers

SHA-256: `316E29381219ADF0CAC62190C67AEABF427D6E6E5F2735541D502B3D339BE7AA`. 118 linhas; 2 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/using-superpowers/SKILL.md`
- `C:/Users/Junior/.codex/superpowers/skills/using-superpowers/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L3: description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
- L11: If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.
- L46: **Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.
- L55: "Invoke Skill tool" [shape=box];
- L58: "Create TodoWrite todo per item" [shape=box];

### 33. wayfinder

SHA-256: `3362FA360948F8526E88EBE8184F5402F9B5F4D9DCED2BA0ED2721F64AE3DE5A`. 129 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/wayfinder/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/wayfinder/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L77: - **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases to surface a fact a decision waits on. Resolved by a subagent that calls the Skill tool with "research". Use when knowledge outside the current working directory is required.
- L78: - **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to (an outline, a rough take, a stub, or UI/logic code) by calling the Skill tool with "prototype". Links the prototype as an asset. Use when "how should it look" or ...
- L79: - **Grilling** (HITL): Conversation. The default case. Always call the Skill tool twice, for "grilling" and "domain-modeling".
- L111: 1. **Name the destination.** Call the Skill tool twice, for "grilling" and "domain-modeling", to pin down what this map is finding its way to: the spec, decision, or change. The destination fixes the scope, so it's settled first.
- L112: 2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** (the way to the destination is already clear, the whole...

### 34. ask-matt

SHA-256: `340D410E124D193DCC759EC489A45050AB23AC8F63BC36AA229E93D8104702B5`. 91 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/ask-matt/SKILL.md`

### 35. setup-ts-deep-modules

SHA-256: `3440BA47E2092B28CF771E801BE012845A138FC39C2A48C85628A9507CBB27A0`. 103 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/setup-ts-deep-modules/SKILL.md`

Links locais literais sem alvo no pacote (validar intenção antes de corrigir):
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/setup-ts-deep-modules/SKILL.md:93 -> ./src/packages/README.md`

### 36. frontend-design

SHA-256: `35C43B9D10C2388DBB228047AD028C989A14033750812125F351C85AA42C7A4A`. 56 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/frontend-design/SKILL.md`

### 37. codebase-design

SHA-256: `362B0BEC828219D9F4B08CA7C466164E67253BDD817359258E60D2E9C5692A8F`. 115 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/codebase-design/SKILL.md`

### 38. wayfinder

SHA-256: `3691FEA552C00C944A2705CF5C514EF889D8AB1F8DFA8B36C140829886B6C15A`. 129 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/wayfinder/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L112: 2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way to the destination is already clear, the whol...

### 39. writing-skills

SHA-256: `38BA648975AE6BA512D6695676F146163DB61A496B867F716F4BDFB0EE3ACA3E`. 656 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/writing-skills/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L598: **IMPORTANT: Use TodoWrite to create todos for EACH checklist item below.**

### 40. find-animation-opportunities

SHA-256: `38EDD3C52F6FAD37A27934B947C9E807736459BA0EEEBF6CCF1FC869AADC01CC`. 133 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/find-animation-opportunities/SKILL.md`

### 41. code-review

SHA-256: `3ABBDFE52540F9242E16589FAE2CC423B3D98994C37683944462B29BAB89495C`. 88 linhas; 2 ocorrência(s). **Consolidar entrada duplicada de revisão; manter eixos standards/spec e evidência. Paralelizar só quando o escopo justificar.**

- `C:/Users/Junior/.codex/skills/code-review/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/code-review/SKILL.md`

### 42. next-cache-components-optimizer

SHA-256: `3B444C1BB0B28E8B6B4E8781EEA81FFCEAB07B069338DD56CF0A63DF9541C733`. 480 linhas; 1 ocorrência(s). **Manter especialidade; manter requisitos de versão explícitos, mas não ampliar escopo para upgrade/adoção sem pedido. Evitar pausas fixas entre etapas já autorizadas.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/next-cache-components-optimizer/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L240: > **C-gate: do not start optimizing until the RED is verified trustworthy.** A

### 43. to-issues

SHA-256: `3C816358D257C446550F0873F0F14AFC40EE5C879BD0F001D414299CDC8A1145`. 85 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/to-issues/SKILL.md`

### 44. diagnosing-bugs

SHA-256: `3DFE5EC16B89A01DBC1BF606A1A1CFC32349E225F3BB75A3FB86117974A83CB8`. 135 linhas; 1 ocorrência(s). **Enxugar o gate de reprodução: permitir prova estática e investigação quando runtime indisponível; manter hipóteses falsificáveis.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/diagnosing-bugs/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L80: Do not proceed until you have reproduced **and** minimised.

### 45. improve-codebase-architecture

SHA-256: `411F295E0BF467FA46E8D8FC6AE3742135A5647380A5F9512C339C9FDDB3CB17`. 72 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/improve-codebase-architecture/SKILL.md`

### 46. improve-ui

SHA-256: `426E0C61B61F9AA6D831EBACE493D81217B19BD1A24A9D2F9025F21390C6E88A`. 117 linhas; 2 ocorrência(s). **Restringir gatilho a auditoria/planos/handoff; preservar read-only. Não interceptar pedido direto de implementação.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/improve-ui/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/improve-ui/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L106: If findings survive, stop and ask which to turn into plans. If the user already selected a finding or explicitly requested a plan for a described improvement, continue with that scope. If asked to fix or improve directly, offer a plan; never implement it.

### 47. openai-docs

SHA-256: `4371FCC6652D78309CCF5E7710A4FD22314AD7F1F4928A6C172DDAE80C87CC87`. 39 linhas; 1 ocorrência(s). **Manter busca de fonte atual; encurtar sinônimos no gatilho e evitar recarregar política já definida pelo host/projeto.**

- `C:/Users/Junior/.codex/skills/.system/openai-docs/SKILL.md`

### 48. permissioned-github

SHA-256: `4487FF1517BFD0A9DDE575F00D02A0C44E3B3E9DD5A71567A7311FCC5A7D1CB6`. 170 linhas; 1 ocorrência(s). **Manter no provedor/projeto original; inventariado, não presumido ativo no Codex. Não importar sua política de ferramentas/permissões para outro host.**

- `C:/Users/Junior/.gemini/antigravity-cli/builtin/skills/permissioned-github/SKILL.md`

### 49. systematic-debugging

SHA-256: `4999CB851360485ECA5074E727BBDD62EF20549C5D5B01216FCBF5831BADB473`. 297 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/systematic-debugging/SKILL.md`

### 50. tdd

SHA-256: `4BC06151A5D5C37AF1EE5613DC07B67ECF18B2E22E6A26E8538A3A995A8AAFCA`. 39 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/tdd/SKILL.md`

### 51. boneyard

SHA-256: `4C8FB9AF6415666A320618F442C2A0A948F4B11226911601D1A5AEC17B394B30`. 205 linhas; 1 ocorrência(s). **Manter no provedor/projeto original; inventariado, não presumido ativo no Codex. Não importar sua política de ferramentas/permissões para outro host.**

- `C:/Users/Junior/.gemini/antigravity-ide/brain/73d725f0-2d6a-48c6-9c18-d25b401bc0bd/scratch/boneyard/.claude/skills/boneyard/SKILL.md`

### 52. request-refactor-plan

SHA-256: `4DE61540351FEE4DB9B18352C53023A9C586F574E7291FAFA0E88793A3F6609A`. 69 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/request-refactor-plan/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/request-refactor-plan/SKILL.md`

### 53. agy-customizations

SHA-256: `4F8B0EAB3C1420A73EDDC48D4041B62178B8BA552A7D6B00D2412DEAB3A39315`. 105 linhas; 2 ocorrência(s). **Manter no provedor/projeto original; inventariado, não presumido ativo no Codex. Não importar sua política de ferramentas/permissões para outro host.**

- `C:/Users/Junior/.gemini/antigravity-cli/builtin/skills/agy-customizations/SKILL.md`
- `C:/Users/Junior/.gemini/antigravity-ide/builtin/skills/agy-customizations/SKILL.md`

### 54. writing-plans

SHA-256: `4FD4627D2C02367879C0307D7249270BED633317FF9BE82E926A6D57BF5D331B`. 153 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/writing-plans/SKILL.md`

### 55. cloudflare

SHA-256: `5075ACE615F53270B28C1DEB712B3CE993AFDAA8905011982E654A17BD87822D`. 246 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/cloudflare/SKILL.md`

### 56. transitions-dev

SHA-256: `51E28449A2B1F08DC1FA1A90C7B31F76E71167D9B0D0BA7CC1255006A2A78EA5`. 238 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/transitions-dev/SKILL.md`

### 57. research

SHA-256: `524B404B1CA373A8B00F63A64667EC4B0A61C3C9CF4E8F246E639BE859BB6979`. 13 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/research/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/research/SKILL.md`

### 58. better-colors

SHA-256: `5A41A24EAF200A0881513934EFF2FB77AE735015433C608905E7C60311FA4766`. 114 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/better-colors/SKILL.md`

### 59. setup-matt-pocock-skills

SHA-256: `5BB39F7C7468525677CB3CE7B0EF64D596570F9DF489D88CAFC4E302EF08810E`. 117 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/setup-matt-pocock-skills/SKILL.md`

### 60. to-prd

SHA-256: `5D811E22E4F0834072706FDBD3672104AF6A20B24B566C2B5F9C87ADE94C1171`. 76 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/to-prd/SKILL.md`

### 61. find-skills

SHA-256: `5DF70A7A474AAED217246277E17882E3EB9025077189026DFB028A713B480926`. 143 linhas; 1 ocorrência(s). **Restringir a pedido de descoberta/instalação de skills; perguntas genéricas sobre como fazer X não exigem instalação.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/find-skills/SKILL.md`

### 62. improve

SHA-256: `603A27B4BBD24E26B4ECCE23CB705235FA4716EF7ED6933DE9141C71385528CD`. 123 linhas; 3 ocorrência(s). **Restringir gatilho a auditoria/planos/handoff; preservar read-only. Não interceptar pedido direto de implementação.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/improve/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/improve/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/improve/SKILL.md`

### 63. edit-article

SHA-256: `608E98E8B2277E3A023AB94D925E7EC884FD3A26E50D3171B38E0180943F878D`. 16 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/edit-article/SKILL.md`

### 64. triage

SHA-256: `652C815971C2DF925CEE0F250AE2596F50FDE19328305F3C55AFD157A7F06FE6`. 113 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/triage/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/triage/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L76: 4. **Grill (if needed).** If the request needs fleshing out, call the Skill tool twice, for "grilling" and "domain-modeling", and grill it into shape a round of questions at a time, sharpening domain terms and updating CONTEXT.md/ADRs inline as decisions land.

### 65. handoff

SHA-256: `65E80725923677F128B1D3CF23397B4BF0CC8659CD408AAEE5AB285D01AA54AF`. 17 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/handoff/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/handoff/SKILL.md`

### 66. cloudflare-r2

SHA-256: `6A10E6924E09537BB0A77FAA72A7A6852AAB74092A9B31C5F656683A5148DD8F`. 1166 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/cloudflare-r2/SKILL.md`

### 67. review

SHA-256: `6B9188CBF826B04EE4535CE3E7BA97F765631E117404EF4F59CFA5A174F73A9F`. 70 linhas; 1 ocorrência(s). **Consolidar entrada duplicada de revisão; manter eixos standards/spec e evidência. Paralelizar só quando o escopo justificar.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/review/SKILL.md`

### 68. frontend-design

SHA-256: `70044BBC8E4C21D23B8C8B864956AA1515C1C6CB2F9DF14148DBB8C4AF6187E5`. 43 linhas; 4 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/.codex/skills/frontend-design/SKILL.md`
- `C:/Users/Junior/.gemini/antigravity-backup/skills/frontend-design/SKILL.md`
- `C:/Users/Junior/.gemini/antigravity-ide/skills/frontend-design/SKILL.md`
- `C:/Users/Junior/.gemini/config/skills/frontend-design/SKILL.md`

### 69. imagegen

SHA-256: `706D4D96E1D5C9E6023FE3CCABBA1BB34B364024D344FD25B8515EC7D28FE3C4`. 316 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/.system/imagegen/SKILL.md`

### 70. create-auth-skill

SHA-256: `71C69571523058188EB8172A137AC3E3CC357D31643F7CED4181DC479C288CD3`. 322 linhas; 1 ocorrência(s). **Enxugar entrevista: perguntar somente métodos/features/UI ainda não determinados; manter detecção de stack e configuração especializada.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/create-auth-skill/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L46: 4. **Authentication methods** (always ask, allow multiple)
- L64: 8. **Features & plugins** (always ask, allow multiple)
- L69: 9. **Auth pages** (always ask, allow multiple — pre-select based on earlier answers)
- L77: 10. **Auth UI style** (always ask)

### 71. vercel-react-best-practices

SHA-256: `71ED7794962FA6E803EE83030517B5B93A9F70FBFEB431EC4535C5480A8D8355`. 150 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/vercel-react-best-practices/SKILL.md`

### 72. resolving-merge-conflicts

SHA-256: `726CC35E566C3FC7E2D648AA580383B40460ECF99C17448C0282C705C0C5BC1D`. 15 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/resolving-merge-conflicts/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/resolving-merge-conflicts/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L10: 3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behaviour. Always resolve; never --abort.

### 73. grilling

SHA-256: `74B36EF0C3C5402681CF821CA20BEDB1B62CC970AE1ABBAB5DBAFE767AD27BD7`. 13 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/grilling/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L12: Do not act on it until I confirm we have reached a shared understanding.

### 74. dispatching-parallel-agents

SHA-256: `76806091C7F923BA2596546B19CCCD98A08E57A68745DF77C3A7B998FE838E2B`. 183 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/superpowers/skills/dispatching-parallel-agents/SKILL.md`

### 75. to-questionnaire

SHA-256: `77825120815C21400F82E2794FAF342D1D1A4AB1493BE3FE061857885D26B768`. 55 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/to-questionnaire/SKILL.md`

### 76. to-tickets

SHA-256: `78C2B786C75E9F89CCB21EC70EF30363AC67C679373E104BEBEE9F9022F35505`. 108 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/to-tickets/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/to-tickets/SKILL.md`

### 77. to-spec

SHA-256: `7D7FD04F7E47B8EBAC52ABE1497725570CBC1C15A56C673FE386950F95931CFB`. 76 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/to-spec/SKILL.md`

### 78. test-driven-development

SHA-256: `7DEE67B4AF6BDCCC7A914CA34533184D64592D0F5B23AEAE631538168DB14994`. 372 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/test-driven-development/SKILL.md`

### 79. diagnosing-bugs

SHA-256: `7FF486208DFCAD5EC4D27ED0C091EEE4183F3812581F55638E9DDF6FCF7ABA1A`. 141 linhas; 1 ocorrência(s). **Enxugar o gate de reprodução: permitir prova estática e investigação quando runtime indisponível; manter hipóteses falsificáveis.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/diagnosing-bugs/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L86: Do not proceed until you have reproduced **and** minimised.

### 80. loop-me

SHA-256: `8214DF9C466030E90172421D1D26F2A71DC3197FFBC7F354BAC20C7D88318169`. 33 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/loop-me/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/loop-me/SKILL.md`

### 81. writing-beats

SHA-256: `8249958A32DDB95794EA6262D44CED9E29CF327A3E765CCF1BF433DDD33401A4`. 68 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/writing-beats/SKILL.md`

### 82. wayfinder

SHA-256: `824E3CBB5BEB15C5B17045070C4664F348ABC506997A781F749258D2DB49872A`. 129 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/wayfinder/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L112: 2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way to the destination is already clear, the whol...

### 83. better-colors

SHA-256: `82F34B00B16FC880D1673BAFC15B34AA2D926A5D493EAE0E70B6D7BDA79AE462`. 92 linhas; 2 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/better-colors/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/better-colors/SKILL.md`

### 84. reui

SHA-256: `83F90ADF1E69B532C4846A43361263B3322E8FEEA1CA30F80ED0529E5F82AEAA`. 68 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/reui/SKILL.md`

### 85. setup-matt-pocock-skills

SHA-256: `86C0DEE483FB69F7F5ECFCD010F6D7CBB30DF2C47A9B059AC95F98380F383D86`. 117 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/setup-matt-pocock-skills/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/setup-matt-pocock-skills/SKILL.md`

### 86. design-an-interface

SHA-256: `88193AB179032918CDEA0AFE74B8610D6D079AC51191F286C10E9E47839A9E6B`. 95 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/design-an-interface/SKILL.md`

### 87. impeccable

SHA-256: `89B6AA1FC9A3ADC3853BCF4274CEE05880E459C16FF965AD819B6A320D81A7C1`. 80 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/impeccable/SKILL.md`

### 88. writing-great-skills

SHA-256: `8C38389DBCFDB3605690C5CE2FE0FA433E7A2F2371A7F1E697D080D81D15FDEA`. 84 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/writing-great-skills/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/writing-great-skills/SKILL.md`

### 89. writing-plans

SHA-256: `90056BAD3D5F196FA7C9FEC0FFE592E6D9C86BC983E406642A51D1A4198B7024`. 153 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/writing-plans/SKILL.md`

### 90. wizard

SHA-256: `95F87B47DB940D6FFB41A8B85C5B3806EA8F4CD3328F1A4E9212ABCD6BFD3D7C`. 46 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/wizard/SKILL.md`

### 91. claude-handoff

SHA-256: `9609292BAF51009831DEC6397E0F01D7817989C5ABB08BF060BEA36B37658139`. 19 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/claude-handoff/SKILL.md`

### 92. handoff

SHA-256: `96F8045F01F569DAA3737150D918B7201CCD090905FB10CEFEDD326E4001F551`. 17 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/handoff/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/handoff/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L10: Include a "suggested skills" section in the document, naming which skills the next agent should call the Skill tool for.

### 93. teach

SHA-256: `99C077A05F66237C95392DC440974E9D144C1267309E978C7A18AAF065CE7FD3`. 141 linhas; 3 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/teach/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/teach/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/teach/SKILL.md`

### 94. review-animations

SHA-256: `9B9766965A0D9CA2AFD0A1B44E74386810008A1AFDD968C62B6AA84C150CC20F`. 113 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/review-animations/SKILL.md`

### 95. grill-me

SHA-256: `9C71927D4F0FD32D815247B4CA1FC782D4C5F2F3C1D6D023D188D4A7E0299B21`. 8 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/grill-me/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/grill-me/SKILL.md`

### 96. plugin-creator

SHA-256: `9DBA03C079ABFBC680E8FCA146069F054C1B0C5E9BCB5E5A9EFFCF86A95F67C6`. 250 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/.system/plugin-creator/SKILL.md`

### 97. sentry

SHA-256: `A032A72760B958AB9AA96E3481DCBE2E677F93697B152C85FC84A1D421B214E2`. 124 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/sentry/SKILL.md`

### 98. ask-matt

SHA-256: `A0F30D3072DE6121353CD513F1B6BEDD526D0A296EDD9CDDEFAE5B3F27F367B2`. 79 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/ask-matt/SKILL.md`

### 99. triage

SHA-256: `A1007F142B7C53D1C027D7D5081E430841F997CA4DE6B904126EA6A22E232E02`. 113 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/triage/SKILL.md`

### 100. ubiquitous-language

SHA-256: `A1EFAFD7EC7A630ED2B0753BE2DDBCF53E50573E5C20A3D43E98056DA25AFCE2`. 94 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/ubiquitous-language/SKILL.md`

### 101. requesting-code-review

SHA-256: `A5FF68586CCF62D1803CEDEB71D60FD96EC05591D29C8D123196117EEFD34CD0`. 106 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/requesting-code-review/SKILL.md`

### 102. executing-plans

SHA-256: `A711F83FB762E2EA0FA151F598893DA9911A408895C91CC7A7E0770DD59A27B3`. 71 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/executing-plans/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L22: 4. If no concerns: Create TodoWrite and proceed
- L39: ## When to Stop and Ask for Help
- L55: **Don't force through blockers** - stop and ask.

### 103. orchestration

SHA-256: `A7E3350F037698EBBCE36B2818D8383EC6E96C2A4825537CAAB39A83B4FB4B7F`. 86 linhas; 1 ocorrência(s). **Enxugar gatilho; Orca somente quando seu estado for fonte de verdade. Manter guia versionado do binário e escolha segura de executável.**

- `C:/Users/Junior/.agents/skills/orchestration/SKILL.md`

### 104. to-spec

SHA-256: `A8FFE2ECD1692F012D310DCA3F3C9A75F61086DF77DBB0A5BC38DDBC0BD2E6BC`. 76 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/to-spec/SKILL.md`

### 105. emil-design-eng

SHA-256: `AA528A78AB11F91D7DB49D091B573440B98B819EA75587E3F8ED8E79AB45091E`. 680 linhas; 2 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/emil-design-eng/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/emil-design-eng/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L14: Do not provide any other information until the user asks a question.

### 106. improve-codebase-architecture

SHA-256: `AB67DC77F7FB0E82AC2CE45E3680C4F90BD68F638C86522996CDF03426084AC7`. 72 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/improve-codebase-architecture/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L13: - Call the Skill tool with "codebase-design" for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles (the deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two...
- L64: Once the user picks a candidate, call the Skill tool with "grilling" to walk the decision tree with them: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.
- L66: Side effects happen inline as decisions crystallize; call the Skill tool with "domain-modeling" to keep the domain model current as you go:
- L71: - **Want to explore alternative interfaces for the deepened module?** Call the Skill tool with "codebase-design" and use its design-it-twice parallel sub-agent pattern.

### 107. better-interface

SHA-256: `AB9D3846F1DE9F8DC465028AAC916760F85E68D0011931ABC56CAEF83F28D560`. 186 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/better-interface/SKILL.md`

### 108. grill-with-docs

SHA-256: `ABC0FA7948DB18B5FB0E1CC1C522AC5FF47D874E2DA1E5DF60619D79BE11F38B`. 8 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/grill-with-docs/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/grill-with-docs/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L7: Call the Skill tool twice, for "grilling" and "domain-modeling".

### 109. hatch-pet

SHA-256: `AC22EC3CBABC95BA03EE3D7CF43A1209FCD139D56C69D35B10C57B9B5F794DA0`. 924 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/hatch-pet/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L226: - Keep recording elapsed time, retries, validation failures, and QA cost throughout the run, but do not pause or stop solely because elapsed time crosses 45 or 60 minutes. Continue until the pet passes, the user cancels, or a genuine external blocker prevents further progress.
- L623: The hidden answer key contains seven horizontal pairs and seven vertical pairs. The cardinal pairs (000 vs 180 and 090 vs 270) are hard gates: a mismatch or ambiguous majority keeps validation at ok: false. All intermediate pairs are review gates: mismatches, same-direction votes...
- L889: - Apply the Direction Acceptance Policy to look cells. Cardinals are hard gates. Intermediate blind uncertainty is a warning unless labeled normal-size review confirms a wrong quadrant, missing axis, or loop reversal.

### 110. prototype

SHA-256: `AD67A04D7F5CBBA64D0B7F257B9922B27453E9093DC711BA9663B3048E41152E`. 27 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/prototype/SKILL.md`

### 111. vercel-deploy

SHA-256: `AFAC6B5B71952AF08F8DCD19C01EC1D80A040240CC50929E3ADD8200B3FCD459`. 78 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/vercel-deploy/SKILL.md`

### 112. github-actions-docs

SHA-256: `B06BC480F7608C43896F85257BC61B1DE6D48F005468B734713155B849DAED6A`. 99 linhas; 2 ocorrência(s). **Manter busca de fonte atual; encurtar sinônimos no gatilho e evitar recarregar política já definida pelo host/projeto.**

- `C:/Users/Junior/.codex/skills/github-actions-docs/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/github-actions-docs/SKILL.md`

### 113. next-best-practices

SHA-256: `B090E6C6766783066E15F15EEEA45C743573D6BA653C98498C3195D78B3D267B`. 154 linhas; 1 ocorrência(s). **Manter especialidade; manter requisitos de versão explícitos, mas não ampliar escopo para upgrade/adoção sem pedido. Evitar pausas fixas entre etapas já autorizadas.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/next-best-practices/SKILL.md`

### 114. integrate-uppy-transloadit-s3-uploading-to-nextjs

SHA-256: `B1207E4288B873A7F5E97F2FCC1FDCB780DF2136D4C95495EC2249BC97B6A813`. 208 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/integrate-uppy-transloadit-s3-uploading-to-nextjs/SKILL.md`

### 115. setup-pre-commit

SHA-256: `B2380F2334A7B3CC14521070A41E14D0B5FDCBC1236F872C35F8543FA3E1421B`. 92 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/setup-pre-commit/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/setup-pre-commit/SKILL.md`

### 116. shadcn

SHA-256: `B46ADBAD775BE22A03B6827F046D8682E52EF83ACE529BCA4E9C55FC5E990E6B`. 243 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/shadcn/SKILL.md`

### 117. better-layout

SHA-256: `B66C8AA0A69BDCB25F73B9A9807FA1B7B560EEFF4EB3D7480BF3907518B3EE94`. 115 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/better-layout/SKILL.md`

### 118. to-tickets

SHA-256: `B9478FAA82B40C653BBA2EA110682B5AE22A6736E4600768AE158C17DB861AE2`. 106 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/to-tickets/SKILL.md`

### 119. shadcn

SHA-256: `BA95C02A6F2A05B7D7D55956E9662103EECC6AF0500C2E3EB60134498BEA8435`. 268 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/shadcn/SKILL.md`

### 120. review-animations

SHA-256: `BAF2411580CB727F782A0EC9B3F094B5DEC3D08ABE5A186C9A3514BB31B52E58`. 113 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/review-animations/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/review-animations/SKILL.md`

### 121. review-agent

SHA-256: `BB46315F6BC4B7051C05F807D19B1689B20418AC6C42590406D805C10FA2FD1A`. 58 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/.system/review-agent/SKILL.md`

### 122. brainstorming

SHA-256: `BBA47904A7F6BBEE3BF8A107EBBE84E65D392BE683BBB898DED736B29E415F90`. 165 linhas; 3 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/brainstorming/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/brainstorming/SKILL.md`
- `C:/Users/Junior/.codex/superpowers/skills/brainstorming/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L12: <HARD-GATE>
- L13: Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
- L14: </HARD-GATE>

### 123. writing-shape

SHA-256: `BC89A8A041C35DF2922F0F023A41CDED155055DBA60D61F54CFBFD758B3C0396`. 80 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/writing-shape/SKILL.md`

### 124. diagnosing-bugs

SHA-256: `BCA66B7141DA7D225B7DFD1ABF6F2BEE657B8044D3897604055E760749C71724`. 139 linhas; 2 ocorrência(s). **Enxugar o gate de reprodução: permitir prova estática e investigação quando runtime indisponível; manter hipóteses falsificáveis.**

- `C:/Users/Junior/.codex/skills/diagnosing-bugs/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/diagnosing-bugs/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L86: Do not proceed until you have reproduced **and** minimised.

### 125. find-skills

SHA-256: `C00EEEA0E13E74FE4A9D84BA0A8542205A1B736D65F13134FE1A6647EB14976F`. 142 linhas; 1 ocorrência(s). **Restringir a pedido de descoberta/instalação de skills; perguntas genéricas sobre como fazer X não exigem instalação.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/find-skills/SKILL.md`

### 126. next-partial-prefetching-adoption

SHA-256: `C0A05C12F0EB9393BCEE851870BDD5A4425D06FD36BED35C29A93D7EBE225A8C`. 143 linhas; 1 ocorrência(s). **Manter especialidade; manter requisitos de versão explícitos, mas não ampliar escopo para upgrade/adoção sem pedido. Evitar pausas fixas entre etapas já autorizadas.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/next-partial-prefetching-adoption/SKILL.md`

### 127. find-skills

SHA-256: `C1D9628984991D7ED59AB3A7BF6A4DAD3D731EF68C71F409F64A0CA258E8028E`. 142 linhas; 8 ocorrência(s). **Restringir a pedido de descoberta/instalação de skills; perguntas genéricas sobre como fazer X não exigem instalação.**

- `C:/Users/Junior/.config/superpowers/worktrees/hub/certificate-preview-font-parity/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/codex-module-content-release-hardening/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/codex-module-content-release/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/fix-lesson-resource-upload-resilience/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/fix-lesson-resource-upload-staging/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/refine-locked-content-ui/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/remove-purchase-schedule-handoff/.agents/skills/find-skills/SKILL.md`
- `C:/Users/Junior/.config/superpowers/worktrees/hub/simplify-release-flow/.agents/skills/find-skills/SKILL.md`

### 128. better-auth-best-practices

SHA-256: `C2257B23160993345D8AA60C3C7F2273495A61DAC50335AE436DB1477EB8ED4E`. 175 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/better-auth-best-practices/SKILL.md`

### 129. prototype

SHA-256: `C2A9CC5492E99B4FABE047DE8AEF02765E241AB77B19DB44A3664D385EC881BD`. 27 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/prototype/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/prototype/SKILL.md`

### 130. to-spec

SHA-256: `C73A2250BEAC0479E384F5466E834BB54CE6E30B7F8705E9999BA840D9D59B36`. 76 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/to-spec/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/to-spec/SKILL.md`

### 131. receiving-code-review

SHA-256: `C9382E92B8F32363566068ECFED19D3B2651EAF40D3942B24840F839DEDFC406`. 214 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/superpowers/skills/receiving-code-review/SKILL.md`

### 132. better-auth-security-best-practices

SHA-256: `C9D0BC218CF000ABC05EDF906786924D5545073DA3E7152E7C6D07BE2788FE71`. 433 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/better-auth-security-best-practices/SKILL.MD`

### 133. vercel-react-best-practices

SHA-256: `CA1C66C7B2E0EB9D4C0D1E01644B8398D1CCE572E097F827DBFEFD797F35A23F`. 126 linhas; 4 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/vercel-react-best-practices/SKILL.md`
- `C:/Users/Junior/.gemini/antigravity-backup/skills/vercel-react-best-practices/SKILL.md`
- `C:/Users/Junior/.gemini/antigravity-ide/skills/vercel-react-best-practices/SKILL.md`
- `C:/Users/Junior/.gemini/config/skills/vercel-react-best-practices/SKILL.md`

### 134. skill-creator

SHA-256: `CCCD291077EC57C6F50CA6529F0F3FB93212DA09473EFFB2FCEC808E81B21288`. 230 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/.system/skill-creator/SKILL.md`

Links locais literais sem alvo no pacote (validar intenção antes de corrigir):
- `C:/Users/Junior/.codex/skills/.system/skill-creator/SKILL.md:141 -> references/redlining.md`
- `C:/Users/Junior/.codex/skills/.system/skill-creator/SKILL.md:142 -> references/ooxml.md`

### 135. orca-cli

SHA-256: `CDD5D9C8A95837A6CC24D68B150A117684AFE9BBB2D763DE2CC7FBA1DA1ED163`. 80 linhas; 1 ocorrência(s). **Enxugar gatilho; Orca somente quando seu estado for fonte de verdade. Manter guia versionado do binário e escolha segura de executável.**

- `C:/Users/Junior/.agents/skills/orca-cli/SKILL.md`

### 136. obsidian-vault

SHA-256: `CF6FE426576D108207FDCF3EF3E6C2BA5DE8E78F2B9C6BFA2D7E0D69D43B15E6`. 60 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/obsidian-vault/SKILL.md`

### 137. deploy-to-vercel

SHA-256: `CFCC3DD479AB2E0AE721DDF39B8AF84D977321487672F1487C8D6855F576927B`. 297 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/deploy-to-vercel/SKILL.md`

### 138. make-interfaces-feel-better

SHA-256: `D180FDA81E7996D0B632692BC4B4F4E244E9C99C4FC80F7F1C9A854BF9828203`. 149 linhas; 2 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/make-interfaces-feel-better/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/make-interfaces-feel-better/SKILL.md`

### 139. grilling

SHA-256: `D806733216B16E51ADAD834E724BFEC5540A436D06395BFC75B843CDA9F7404B`. 29 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/grilling/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/grilling/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L28: The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

### 140. ask-matt

SHA-256: `D8934DB5CCF28B8C6E43D44D88801936D3831AB5666280B26D6F0852A312DC63`. 91 linhas; 2 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/.codex/skills/ask-matt/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/ask-matt/SKILL.md`

### 141. resolving-merge-conflicts

SHA-256: `D97E7320010BBE7D32313C574ACD47CEC830D64EDD59C956BD0CE2CBA84E6AD7`. 15 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/resolving-merge-conflicts/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/resolving-merge-conflicts/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L10: 3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behaviour. Always resolve; never --abort.

### 142. apple-design

SHA-256: `DA9581408C2B37A49565A9C7E32F26763F78B581C7E802DFA2357738E43BA7D5`. 283 linhas; 3 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/apple-design/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/apple-design/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/apple-design/SKILL.md`

### 143. wizard

SHA-256: `DBEFB750EAE07D9F8B05AB1084F6ACFDDA2752DF2A6B577C46A505E2BC790164`. 45 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/wizard/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/wizard/SKILL.md`

### 144. wait-what

SHA-256: `DCAA44EF972D5A3F9BDA65A69442FB11E36EB41B7E9BB0DC8B63031BA0582FDB`. 8 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/wait-what/SKILL.md`

### 145. finishing-a-development-branch

SHA-256: `DD2F82C6DC8582B621F9EB57FCB65F557F88EADF872727AC81D0840AE12C504E`. 201 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/finishing-a-development-branch/SKILL.md`

### 146. domain-modeling

SHA-256: `DD4C753A617BD7DB97C34FD3E049581C4BC0C0590E8A8B1F97D3B9D6013131DC`. 75 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/.codex/skills/domain-modeling/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/domain-modeling/SKILL.md`

### 147. scaffold-exercises

SHA-256: `DE28DB7A0954DB55C11BA1E3CC0FD4C037BF0F5CB8313CB292E319BCCE47F424`. 107 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/scaffold-exercises/SKILL.md`

### 148. animation-vocabulary

SHA-256: `DE5828E11055239691504B288519B894FD4B355D6BFC418A88762E9D75568267`. 174 linhas; 2 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/animation-vocabulary/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/animation-vocabulary/SKILL.md`

### 149. better-typography

SHA-256: `DE5A40F78CE35C5AB82EB740CAFBE4F1500CD989106336251F83AED22A908D97`. 167 linhas; 2 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/better-typography/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/better-typography/SKILL.md`

### 150. using-git-worktrees

SHA-256: `DE9DCDE34840EEE074047EC327D4EA6CA4954C5A73A6D874DC48F25FE46C9E7C`. 219 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/using-git-worktrees/SKILL.md`

### 151. emil-design-eng

SHA-256: `DEFFFFF8BEA4583897B001B9173CCD6FB6F8341FFFC63A1891A38372137A1848`. 675 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/emil-design-eng/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L14: Do not provide any other information until the user asks a question.

### 152. code-review

SHA-256: `E32441CE3F64628DAEB6270BF56104F461B1341AA472CC3968424E90ECE17BC4`. 88 linhas; 1 ocorrência(s). **Consolidar entrada duplicada de revisão; manter eixos standards/spec e evidência. Paralelizar só quando o escopo justificar.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/code-review/SKILL.md`

### 153. vercel-composition-patterns

SHA-256: `E38E0EAA609316B10423A9A138ED95E35099ACCD3F735585295C8A8F165C28A3`. 90 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/vercel-composition-patterns/SKILL.md`

### 154. shadcn

SHA-256: `E39871B64B1BA34F1AEFC50FFEA1B162C5A0750BC42A9BA54282AC503534429B`. 278 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/shadcn/SKILL.md`

### 155. code-review

SHA-256: `E5507100AC01A04D082AC23AC6311D0FEC8699D1AB00C599DB7064039B819F63`. 90 linhas; 1 ocorrência(s). **Consolidar entrada duplicada de revisão; manter eixos standards/spec e evidência. Paralelizar só quando o escopo justificar.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/code-review/SKILL.md`

### 156. cloudflare

SHA-256: `E6E05ADA5F112E95D9578064D21814E467D298546989A648078D32764FBCAD90`. 229 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/cloudflare/SKILL.md`

### 157. setup-matt-pocock-skills

SHA-256: `E6EF895B9285AE0B0CF6AEDCFDC12BCA6123170D79F27D40D685388B75288FAB`. 117 linhas; 1 ocorrência(s). **Manter como entrada explícita; o workflow deliberado é parte do pedido, não deve ativar em tarefas adjacentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/setup-matt-pocock-skills/SKILL.md`

### 158. revenue-centric-design

SHA-256: `E85CD0FAEB98F58FEB4FC5DBC49DBA5463902C814D2651D80DC4FA0662894A4E`. 81 linhas; 3 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/revenue-centric-design/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/revenue-centric-design/SKILL.md`

Links locais literais sem alvo no pacote (validar intenção antes de corrigir):
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:63 -> references/conversion-and-landing-pages.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:64 -> references/onboarding-and-activation.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:65 -> references/churn-and-retention.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:66 -> references/pricing-and-monetization.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:67 -> references/behavioral-science-toolkit.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:68 -> references/product-strategy-and-features.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:69 -> references/revenue-centric-design.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:70 -> references/positioning-icp-and-gtm.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:71 -> references/ai-era-differentiation.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/revenue-centric-design/SKILL.md:72 -> references/metrics-and-experimentation.md`

### 159. git-guardrails-claude-code

SHA-256: `E8993A2B4453AC7E22E4E5E035E5A519532467A3A7A80C7335B76A25C1ABC819`. 96 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/git-guardrails-claude-code/SKILL.md`

### 160. verification-before-completion

SHA-256: `EA52D15AABAF72BC6B558EFE2C126F161B53961090DDCD712000273BFE8C7B6C`. 140 linhas; 1 ocorrência(s). **Enxugar e restringir a workflow solicitado; retirar gates, commits e checagens repetidas que não dependem do risco da tarefa. Preservar evidência e isolamento quando necessários.**

- `C:/Users/Junior/.codex/superpowers/skills/verification-before-completion/SKILL.md`

### 161. email-and-password-best-practices

SHA-256: `EAF6ABEC84C6E5ECA8523C88ACF5BB5F0CC2BB076C0D9BCC8239FD2118FAA9D8`. 213 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/email-and-password-best-practices/SKILL.md`

### 162. vercel-react-best-practices

SHA-256: `ECC1059BDF353C977AA43FA4B25E21346FBAAC5841CB8EA7A7490359CD4EF801`. 146 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/vercel-react-best-practices/SKILL.md`

### 163. make-interfaces-feel-better

SHA-256: `EE05E66E71BF3472DF02D29E3A88A659751B36B09CD5CC5D47F42DB5C5CAC07F`. 188 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/make-interfaces-feel-better/SKILL.md`

### 164. organization-best-practices

SHA-256: `F10771FF150BF7AB68776C2F43943A585A21B7F4FA781CB2348BA0675EAE340E`. 480 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/organization-best-practices/SKILL.md`

### 165. web-design-guidelines

SHA-256: `F4647CA866A3ACCF763777F83E7682954F0187CD6BEA7EEA0399796652414E8F`. 40 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/web-design-guidelines/SKILL.md`

### 166. two-factor-authentication-best-practices

SHA-256: `F67F02F4FD879720C0DA9F4A9A060110B4E65B5588BFFDABDC8B47055EB8DA44`. 332 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/two-factor-authentication-best-practices/SKILL.md`

### 167. improve-animations

SHA-256: `F7BCD002F28BE07C3C4D53A57AF59950CFF80645A9B4B94F59FA1F4810B66D5B`. 102 linhas; 3 ocorrência(s). **Restringir gatilho a auditoria/planos/handoff; preservar read-only. Não interceptar pedido direto de implementação.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/improve-animations/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/improve-animations/SKILL.md`
- `C:/Users/Junior/Documents/0 - Dev/hub/.agents/skills/improve-animations/SKILL.md`

Sinais para edição direcionada (não são todos defeitos isoladamente):
- L78: Then **stop and wait for the user to select** which findings become plans. If running non-interactively, default to the top 3–5 by leverage.

### 168. vercel-composition-patterns

SHA-256: `FB8F849B4D46C0C4D364AE6FB398A5CB693B54F9A4C31765A1EC0689C7CB93D5`. 90 linhas; 1 ocorrência(s). **Manter; especialidade delimitada. Preservar limites locais e consultar referências apenas quando pertinentes.**

- `C:/Users/Junior/Documents/0 - Dev/Hub Imports/.agents/skills/vercel-composition-patterns/SKILL.md`

### 169. transitions-polish

SHA-256: `FEF70F9EC366175FB97AE453722B29BC5685B63FFC6032BF934DDAE50E490726`. 143 linhas; 1 ocorrência(s). **Consolidar roteamento UI e enxugar descrição. Preservar referências técnicas; divulgar exemplos por tópico e subordinar números/formatos ao sistema do projeto.**

- `C:/Users/Junior/Documents/0 - Dev/araute/.agents/skills/transitions-polish/SKILL.md`

## Verificação e limites

Inventários JSON lidos, SHA-256 calculado para todos os arquivos e catálogo gerado para cada corpo único. Originais não alterados. Não executados os workflows das skills, comandos de serviços, instalações ou exemplos de APIs. Esta é revisão do sistema de instruções; performance real exige comparação em tarefas representativas antes/depois. docs:check é executado pelo coordenador após integração dos relatórios.
