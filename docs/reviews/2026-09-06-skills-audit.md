# Auditoria de skills e AGENTS.md

Estado: auditoria estática concluída para as skills pessoais/de projetos, instalações e caches de plugins identificados, e os AGENTS.md encontrados no escopo de busca. Revisão orientada a risco do desenho de instruções, não certificação de cada exemplo de API ou script.

## Referência

Lido o texto de [Rethinking skills and prompts for GPT-6 Astra, Eric Provencher](https://x.com/pvncher/status/2095991462416490862), publicado em 4 de setembro de 2026, recuperado pelo endpoint público FxTwitter. As duas imagens de exemplos não foram inspecionadas. [Nota da leitura](2026-09-06-skills-article-research.md).

Critério aplicado: gatilhos específicos, referências sob demanda, menos receitas universais, limites de aprovação proporcionais ao risco e conclusão definida pelo resultado. O artigo não fornece um limite numérico de skills nem justifica apagar salvaguardas locais.

## Cobertura e limitações

O [inventário](2026-09-06-instructions-inventory.csv) registra 1.521 arquivos SKILL.md e 38 AGENTS.md encontrados no perfil C:/Users/Junior, com caminho, hash SHA-256, tamanho e classificação preliminar. O total inclui dez adições Cloudflare/Sentry anunciadas durante a sessão. São arquivos físicos, incluindo fontes de marketplaces, caches de dependências, outros clientes, fixtures e worktrees. Não são 1.521 skills ativas no Codex. A classificação por caminho é triagem, não prova de instalação.

Excluídos da busca: AppData, node_modules, .git, .next, dist, build, caches chamados .cache, diretórios de sessões/logs e credenciais. Junctions não foram percorridas indiscriminadamente. A junction conhecida .agents/skills/superpowers foi resolvida para .codex/superpowers/skills. A busca não cobre outros discos/perfis. Hash e leitura por script não equivalem a revisão semântica.

A [matriz de cobertura](2026-09-06-audit-coverage.csv) associa cada caminho a um parecer ou à classificação de fonte de terceiros. São 604 SKILL.md com parecer: 249 pessoais/de projetos, 59 Vercel/Neon, 154 demais plugins Codex e 142 suplementares. Os 38 AGENTS.md têm parecer próprio. Nenhum desses caminhos ficou sem associação e os hashes conferidos permaneceram iguais ao snapshot. A revisão semântica é direcionada a gatilhos, limites, precedência, receitas e trechos de risco; a leitura integral por ferramenta não é apresentada como revisão humana de cada linha.

Outros 917 SKILL.md são fontes em diretórios temporários, vendor_imports, dependências e extensões de editor: foram inventariados, não auditados semanticamente nem tratados como skills pessoais instaladas. Sua presença no disco não prova consumo. Essa exclusão não se aplica às skills apresentadas no catálogo da sessão, que estão nos pareceres. Não foi feita auditoria de segurança de todo o software de terceiros do computador.

## Achados consolidados

### P1: receitas globais competem com a tarefa

- `hub/.agents/skills/using-superpowers/SKILL.md:11` exige ativação com 1% de chance de relevância; linhas 18–24 reivindicam precedência sobre o system prompt. Isso aumenta carregamento e cria uma hierarquia que a skill não pode conceder. Retirar a precedência fictícia e condicionar invocação à tarefa.
- `vercel/0.21.4/skills/marketplace/SKILL.md:19–43` determina provisionar integrações antes de escrever qualquer arquivo e escolher o primeiro resultado. `knowledge-update/SKILL.md:84` amplia esse fluxo para qualquer capacidade externa. Condicionar a novos projetos ou provisionamento solicitado, respeitando provedores e contas existentes.
- `vercel/0.21.4/skills/ai-elements/SKILL.md:99` torna uma biblioteca obrigatória para qualquer exibição de texto de IA. `ai-sdk/SKILL.md:74` manda instalar pacote apenas para consultar documentação; linha 90 manda escolher o modelo com maior versão. São decisões de produto/dependência indevidas como regra universal.

### P1: verificação pode terminar antes da correção

`vercel/0.21.4/skills/verification/SKILL.md:150–161` manda parar na primeira fronteira quebrada e oferece verificação depois da implementação. Adequado como limite de diagnóstico isolado, inadequado como término de uma tarefa que inclui corrigir e verificar. Encerrar diagnóstico, continuar a correção autorizada e verificar o fluxo afetado.

### P2: conflito com preferência explícita de navegador

`vercel/0.21.4/skills/agent-browser-verify/SKILL.md:75` exige navegador após iniciar todo servidor. O arquivo global `C:/Users/Junior/.codex/AGENTS.md` proíbe abrir URL local. A preferência do usuário prevalece. O gatilho deve reconhecer a restrição e usar evidências permitidas, declarando a ausência de inspeção visual.

### P2: gatilhos de provedor abrangem tecnologias de outros provedores

`neon-postgres/2.0.0/skills/neon/SKILL.md` inclui database, backend, S3, logs e observability na descrição. As skills filhas exigem carregar a mãe primeiro. Para uma tarefa R2 do Hub, isso pode adicionar documentação de outro produto. Restringir a Neon explícito, integração existente ou comparação solicitada. Preservar isolamento de branches e controles de produção.

### P2: AGENTS.md carrega regras pouco discriminantes

`hub/AGENTS.md:15` aponta para aidd_docs, mas Test-Path aidd_docs retornou False. A documentação vigente está em docs. A leitura obrigatória do índice e de todo seu percurso deve ser condicionada ao domínio alterado. As regras genéricas de sintaxe repetem responsabilidades atribuídas ao Ultracite no próprio documento; candidatas a poda, mantendo exceções reais do projeto.

`Hub Imports/AGENTS.md` contém bloco de memória vazio seguido de obrigação de ler todos os arquivos de aidd_docs/memory. Trocar por ponteiros condicionais. Algumas cópias de worktree acrescentam inventário completo de branches, stashes e PRs em toda fronteira de tarefa. Restringir essa rotina a limpeza/release solicitados; preservar as proteções contra perda de dados.

### P2: roteamento sobreposto e links quebrados

As famílias UI, revisão, brainstorming e documentação aparecem em cópias pessoais, de projeto e plugins. Escolher um responsável por intenção e host; não apagar cópias de outros projetos como se fossem duplicatas ativas.

Oito junctions em `.copilot/skills` e `.gemini/config/skills` apontam para quatro destinos ausentes em `.agents/skills`: postgresql-table-design, signup-flow-cro, software-architecture e supabase-best-practices. Test-Path retornou False para os destinos. Reparar somente após decidir se essas skills ainda devem existir nesses clientes.

## Ordem de remediação proposta

1. Corrigir precedência fictícia, instalações obrigatórias e commits implícitos nas skills de workflow.
2. Delimitar gatilhos por intenção/provedor e consolidar sobreposições do catálogo efetivamente carregado.
3. Enxugar AGENTS.md, corrigir aidd_docs e transformar leituras universais em ponteiros condicionais.
4. Divulgar referências extensas por tópico, preservando regras de domínio, produção e segurança.
5. Verificar a seleção em tarefas representativas antes/depois. Não inferir ganho de latência ou tokens sem medição.

Nenhuma skill ou AGENTS.md foi alterado. Nenhum commit, push, instalação ou exclusão foi executado nesta auditoria. Alterações preexistentes em pagamentos permanecem fora do escopo.

## Entrega e verificação

Pareceres: [pessoais/projetos](2026-09-06-personal-skills-audit.md), [AGENTS.md](2026-09-06-agents-files-audit.md), [Vercel/Neon](2026-09-06-vercel-neon-skills-audit.md), [demais plugins Codex](2026-09-06-other-plugin-skills-audit.md) e [outros clientes/adições](2026-09-06-supplemental-skills-audit.md).

Verificação: reconciliação por caminho e SHA-256, zero caminhos pessoais/de plugins sem parecer, zero arquivos de entrada modificados contra o snapshot. `bun run docs:check` valida a documentação canônica do repositório; não é um teste de qualidade semântica das skills. Os relatórios foram conferidos por consistência de contagens, referências e limites.

Conclusão: a prioridade é corrigir roteamento e limites de execução antes de reduzir volume indiscriminadamente. Manter procedimentos especializados e salvaguardas reais; retirar obrigações universais que escolhem provedor, instalam pacotes, pedem nova aprovação ou terminam antes do resultado solicitado. Implementação dessas recomendações não foi solicitada e não foi executada. Nada pendente para a auditoria estática delimitada acima.
