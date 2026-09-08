# Auditoria dos arquivos AGENTS.md

Snapshot de 6 de setembro de 2026. Avaliação do desenho de instruções baseada no artigo de Eric Provencher, com originais preservados.

## Cobertura

38 caminhos encontrados, agrupados em 21 corpos distintos por SHA-256. Todos foram classificados; conteúdo integral processado para comparação, com revisão semântica das instruções operacionais e trechos relevantes. Compilações técnicas de milhares de linhas foram revisadas como referências, não certificadas como documentação correta de cada API. O inventário CSV adjacente identifica cada caminho e hash. A busca excluiu node_modules, AppData e outros diretórios descritos no relatório principal.

## Achados

1. **P2, ponteiro obsoleto:** Hub AGENTS.md:15 aponta para aidd_docs, diretório inexistente neste checkout. A seção de documentação indica docs. Substituir o ponteiro antigo pela autoridade vigente, sem criar uma segunda árvore documental.
2. **P2, leitura universal:** Hub AGENTS.md:77 exige seguir o percurso completo de docs/README.md. Esse percurso inclui README, PRODUCT, CONTEXT e arquitetura antes do domínio. Condicionar a leitura ao impacto da tarefa; manter runbooks obrigatórios para operações reais de ambiente/banco/release. Não remover contexto de autorização e regras financeiras.
3. **P2, memória indiscriminada:** Hub Imports tem bloco de memória vazio e manda ler cada arquivo de aidd_docs/memory. Usar índice por intenção e contexto solicitado. Não aplicar essa regra histórica ao Hub atual.
4. **P2, higiene fora do escopo:** quatro cópias de worktree (hash AC2DBCE1) exigem inventário de worktrees, branches, stashes e PRs em toda fronteira de tarefa. Um ajuste pequeno herda trabalho de limpeza não solicitado. Condicionar inventário completo a tarefas de limpeza/release, preservando proteção de main/staging, dados e mudanças não commitadas.
5. **P2, regras mecânicas duplicadas:** os documentos de Hub e Hub Imports têm seções extensas de sintaxe enquanto atribuem a autoridade de estilo ao Ultracite. Remover gradualmente regras realmente cobertas pela configuração, após conferir cobertura; manter regras de domínio, segurança e exceções que o linter não verifica. Não inferir que toda recomendação genérica é inútil para todos os modelos.
6. **P2, referência internamente contraditória:** hub/.agents/skills/vercel-react-best-practices/AGENTS.md contém afirmações opostas sobre estabilidade de identidade de useEffectEvent nas regiões 3643 e 3763. É evidência de manutenção divergente dentro de uma compilação; requer conciliar com a versão de React adotada antes de usar o exemplo. Esta auditoria não altera nem certifica a API.
7. **P3, identificação ritual:** a frase obrigatória AI-Driven Development ON e instruções repetidas de tom consomem contexto sem caracterizar contrato do projeto. São preferências explícitas atuais e foram respeitadas. Candidatas a simplificação pelo proprietário, não exclusão automática.

## Disposição por classe

- **Global .codex/AGENTS.md:** preservar preferências de ambiente e ausência de rg; centralizar o procedimento ctx7 para evitar cópia na find-docs. O limite de três comandos é orçamento operacional, não prova de pesquisa completa.
- **Hub e cópias hash B6609DB1:** enxugar conforme achados 1, 2, 5 e 7. Seis ocorrências físicas, não seis instruções simultâneas.
- **Worktrees hash AC2DBCE1:** mesmas recomendações do Hub, mais escopo explícito para higiene. Não sincronizar worktrees ou remover branches durante auditoria.
- **Hub Imports:** reduzir memória universal e genericidade. Sua política histórica não é autoridade do Hub.
- **Araute:** preservar contratos próprios e verificação proporcional; reduzir regras sintáticas duplicadas e ritual de abertura. Sua permissão documentada para .skip difere do Hub, mas são projetos distintos, portanto não é conflito global.
- **Documents/Codex/2026-08-30/inv/work:** cópia de instruções de projeto, contabilizada por hash; não presumir atividade ou descarte seguro.
- **Fixtures consumer-standard e consumer-standard-src:** são entradas de testes do Araute. Não simplificar como instruções pessoais; qualquer mudança exige verificar o contrato do teste.
- **Compilações React Best Practices (cinco hashes, múltiplas cópias):** preservar como referência sob demanda, escolher fonte por instalação e revisar divergências. Não carregar milhares de linhas para todo ajuste React.
- **Compilações React Composition Patterns (dois hashes):** preservar referência especializada; evitar duplicar os exemplos no AGENTS raiz.
- **Superpowers e cópia Zcode:** AGENTS contém somente CLAUDE.md. O alvo existente contém políticas de contribuição upstream, incluindo revisão humana antes de PR. São limites daquele repositório, não uma exigência para auditar skills ou trabalhar no Hub. Tornar o ponteiro explícito melhora portabilidade; não contornar políticas upstream.
- **Resend no cache Zcode:** regra útil para distinguir fonte autoral de skills sincronizadas. Preservar; editar cache seria sobrescrito.
- **Next no cache Bun:** aviso restrito à biblioteca instalada. Não transformar em leitura universal de todo projeto.
- **Recharts no cache Bun (duas versões):** instruções de contribuição contextualizadas e testes estreitos; sem motivo de alteração nesta auditoria.
- **Cytoscape no cache Bun:** fluxo técnico condicionado ao tipo de mudança, com proteção de gerados. Preservar como instrução upstream; não aplicar navegador local ao Hub contra a preferência do usuário.
- **Zoom em .codex/.tmp:** descrição de propósito de plugin, sem fluxo excessivo observado. Fonte de marketplace, não regra pessoal ativa comprovada.
- **Supabase em .codex/.tmp:** router com referências sob demanda, alinhado à recomendação do artigo; preservar como fonte upstream.
- **VS Code references/agents.md:** documentação de custom agents, encontrada pela busca case-insensitive. Não é AGENTS de configuração do usuário. Excluir de decisões de limpeza pessoal.

## Limite do parecer

O objetivo aqui é auditar escopo, precedência, carregamento e manutenção das instruções. Não houve execução de exemplos, benchmark do comportamento do modelo ou validação de todas as APIs das compilações. Nenhum arquivo auditado foi alterado. A lista de caminhos e hashes permite localizar todas as cópias sem recomendar exclusões cegas.
