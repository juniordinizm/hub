# Correção das instruções auditadas

Solicitação: corrigir diretamente todos os achados da auditoria. Execução em andamento; os relatórios de auditoria são snapshots anteriores, não prova de correção.

## Plano de execução

1. Corrigir precedência fictícia, ativação universal e roteiros de planejamento que impõem aprovação/commit.
2. Corrigir AGENTS.md: ponteiros, leitura contextual, higiene condicionada e redundância mecânica.
3. Corrigir gatilhos sobrepostos, escolhas de provedor/modelo e efeitos externos nos plugins.
4. Corrigir limites de diagnóstico/verificação, referências contraditórias, ferramentas ausentes e junctions quebradas.
5. Separar referências extensas quando a divisão tiver um ramo real, verificar metadados e conferir todos os achados contra o estado final.

Cada alteração conserva backup fora das pastas de skills e registra hashes anterior/posterior. Aplicações em cache também exigem tratamento da fonte de instalação quando disponível, para não depender de uma cópia que será substituída em atualização. Não haverá commit, push ou alteração no produto.

## Critérios de conclusão

- Cada achado confirmado possui alteração e evidência de validação, ou foi refutado com evidência específica.
- Regras conflitantes são substituídas no local, não encobertas por mais uma regra contraditória.
- Frontmatter válido, referências preservadas e restrições reais de segurança mantidas.
- Verificação de cenários: correção pequena sem aprovação repetida; auditoria sem instalação; provider existente preservado; conclusão após correção e verificação relevante.
- `bun run docs:check` passa e alterações preexistentes do produto permanecem preservadas.

## Execução registrada

Primeiro lote aplicado: 18 arquivos. O script `remediate-instructions.ps1` substituiu using-superpowers e writing-plans nas cópias auditadas com os padrões identificados, corrigiu ponteiros aidd_docs onde docs/README.md existe e condicionou higiene de worktrees a limpeza/release solicitados.

Removidos dos entrypoints alterados: ativação com 1% de chance, precedência fictícia sobre system, aprovação universal de planejamento, commits frequentes como requisito e escolha obrigatória de modo de execução. Mantidos escopo do usuário, verificação relevante e limites do host.

Evidência: `2026-09-06-remediation-changes.csv` registra cada caminho, hash anterior/posterior e backup. Os 18 resultados e backups foram conferidos por SHA-256. Segunda execução sem Apply retornou zero alterações, demonstrando idempotência deste lote. `bun run docs:check` passou.

Ainda pendentes: brainstorming e demais workflows; roteamento e providers nos plugins; redundância restante dos AGENTS; diagnóstico/verificação; referências e junctions; durabilidade das correções em caches. O objetivo integral permanece ativo.

Segundo lote: mais oito arquivos corrigidos, totalizando 26. Brainstorming passou a atender ideação solicitada ou decisões materiais em aberto, sem aprovações por seção, commits automáticos ou companion obrigatório. Verification-before-completion passou a exigir evidência correspondente ao estado, permitindo reutilizar checks válidos de entradas inalteradas; preserva regressões práticas e proibição de alegar conclusão parcial como total. Os 26 hashes finais e backups foram conferidos, a reaplicação não produziu mudanças e docs:check passou. As demais frentes continuam pendentes.

Terceiro lote: gh-fix-ci agora executa a correção local já solicitada e a verificação relevante, sem nova aprovação automática; mantém commit/push sujeitos a pedido explícito. Hub Imports agora seleciona memória pelo domínio afetado em vez de ler todos os arquivos. Dois arquivos adicionais, 28 no total; backups registrados, reaplicação sem mudanças e docs:check passou. Restam as demais frentes listadas no plano.

Quarto lote: 13 arquivos adicionais, 41 no total. Descrições de Neon, gateway, functions e storage agora exigem o produto selecionado/integrado ou avaliação explícita. Skills filhas consultam a mãe somente quando falta contexto. Auth/payments Vercel agora têm gatilhos limitados aos provedores documentados, preservando Better Auth/Asaas e outros provedores existentes. Metadados e exemplos foram preservados; cabeçalhos conferidos e reaplicação sem mudanças. docs:check passou. Roteamento por hooks/metadados e outras imposições nos corpos ainda exigem revisão antes de declarar essa frente completa.

Quinto lote: três cópias Vercel verification, 44 arquivos no total. Parar no primeiro defeito agora é limite de diagnóstico isolado; correção autorizada prossegue até verificar o fluxo afetado. Removido teto de duas execuções que impediria retestar correções e eliminada exigência de novo pedido para verificar implementação. Preservada distinção entre evidência disponível e comportamento não observado. Reaplicação sem mudanças e docs:check passou; demais achados continuam pendentes.

Sexto lote: gatilhos de agent-browser e agent-browser-verify condicionados à relevância e permissão de navegador/URL local. O corpo de agent-browser-verify agora permite checks alternativos e explicita que processo em execução não prova renderização. Exemplos de comandos permanecem condicionais. Backups no ledger; reaplicação sem mudanças e docs:check passou. Ainda é necessário revisar a política correspondente de Sites e outros providers, além das demais frentes abertas.

Sétimo lote: visualize deixou de proibir comunicação exigida pelo host e de mandar reler o arquivo inteiro após toda compactação. Mantidos o contrato de artefato e o escopo de visualizações em conversa. Total: 49 arquivos; reaplicação sem mudanças e docs:check passou. Objetivo integral ainda em andamento.

Oitavo lote: quatro arquivos investigation-mode/observability ajustados, total 53. Ausência de logs deixa de ser declarada como causa; diagnóstico seleciona evidência útil e instrumentação responde a hipótese concreta. Encontrar a causa não encerra uma correção já autorizada. Reaplicação sem alterações e docs:check passou. Demais frentes permanecem abertas.

Nono lote: quatro arquivos AI SDK corrigidos, total 57. Removidas instalação só para leitura, escolha pelo maior número de versão, modelo de imagem obrigatório e migração automática ao gateway. Mantida consulta ao catálogo/documentação do provedor escolhido. Reaplicação sem mudanças e docs:check passou. Demais achados ainda pendentes.

Décimo lote: AI Elements condicionado à biblioteca selecionada; removidas adoção obrigatória para todo texto, suposição de Markdown universal e migração automática de primitivas UI. A verificação de compatibilidade continua exigida quando pertinente. Alterações registradas no CSV, reaplicação sem mudanças e docs:check passou. A conclusão integral permanece pendente.

Décimo primeiro lote: duas skills neon-postgres passaram a preservar a abordagem SQL/migrations existente sem exigir ORM. React Email consulta a URL de produção disponível antes de perguntar, preservando a proteção contra links localhost em produção. Três arquivos adicionais registrados; reaplicação sem mudanças e docs:check passou. Demais frentes permanecem pendentes.

Décimo segundo lote: pstack sequence-verifiable-units permite lotes verificáveis, retira rebase obrigatório e condiciona commits/PRs à solicitação. unslop perdeu a contradição entre always apply e invocação explícita. Dois arquivos registrados; reaplicação sem mudanças e docs:check passou. Demais achados continuam pendentes.

Décimo terceiro lote: plugin-management agora descobre capacidades reais do host, respeita as precondições de request_plugin_install e diferencia remoção de app de remoção de plugin. Removidas exigências de ferramentas ausentes. Backup registrado; reaplicação sem mudanças e docs:check passou. Nenhuma instalação ou remoção de plugin foi executada. Demais achados pendentes.

Lotes seguintes: Marketplace deixou de exigir provisionamento antes de toda alteração e de recomendar automaticamente o primeiro resultado. knowledge-update agora consulta arquitetura/provedores existentes antes de encaminhar para Marketplace, sem provisionar durante perguntas ou auditorias. O CSV contém os caminhos e backups de cada alteração. Reaplicação sem mudanças e docs:check passou. Os nove caminhos do antigo cache Cloudflare estão ausentes e são ignorados explicitamente, sem reinstalação. Permanecem abertas as demais frentes do plano, incluindo durabilidade de caches, referências, junctions e roteamento UI.

CI/CD: três cópias deployments-cicd passaram a condicionar prebuilt à estratégia real de release, preservando builds nativos e promoção manual. Backups registrados, reaplicação sem mudanças e docs:check passou. Nenhum workflow de produto ou deployment foi alterado. Restam as demais frentes do plano.

Vercel Queues: removidos preço/status temporal da descrição e limitado o gatilho ao serviço escolhido ou integrado. Os hashes das alterações anteriores foram reconferidos, sem divergência nos arquivos existentes. Reaplicação sem mudanças e docs:check passou. Ainda não há evidência de conclusão de todos os achados.

Persistência de IA: gatilho e regras condicionados a histórico/artefatos duráveis, com retenção, minimização e acesso autorizado. Respostas efêmeras não exigem armazenamento; o object store existente é preservado. Exemplos continuam disponíveis para o caso durável. Reaplicação sem mudanças e docs:check passou. Demais frentes do plano continuam pendentes.

shadcn: três cópias deixaram de exigir Radix por adoção hipotética de AI Elements. Preservam primitivas existentes e pedem análise da compatibilidade concreta do componente antes de propor migração. Reaplicação sem mudanças e docs:check passou. Demais achados continuam pendentes.

Sites: handoff local condicionado à permissão de URLs locais e não bloqueia implementação quando indisponível. Commit/push da hospedagem agora respeitam exigência explícita de autorização do projeto, após validação local. Alterações nos entrypoints registradas; referências transitivas ainda devem ser conferidas na verificação final. Reaplicação sem mudanças e docs:check passou.

Diagnosing-bugs: retirado gate que proibia hipóteses sem comando executável. Agora permite prova estática/capturada com premissas e limitação runtime explícitas, preservando reprodução quando viável. Número de hipóteses depende de evidência, não de quota fixa. Reaplicação sem mudanças e docs:check passou. Verificação completa das variantes e dos demais achados ainda pendente.

Improve-ui: gatilho limitado a auditoria/planejamento. Pedido de implementação direta deixa de ser convertido em oferta de plano e segue workflow apropriado, mantendo o caráter somente leitura quando a auditoria é o pedido real. Reaplicação sem mudanças e docs:check passou. Demais achados permanecem pendentes.

Impeccable/Araute: teto fixo de duas inspeções substituído por conclusão baseada nos critérios pedidos, com novas passagens justificadas por defeito confirmado, mudança relevante ou evidência pendente. Mantida contenção de polimento especulativo e respeito às restrições de inspeção. Reaplicação sem mudanças e docs:check passou. Demais achados permanecem pendentes.

Better-ui: valores de animação passaram a exemplos subordinados ao sistema existente e acessibilidade; relatório em tabela e encerramento com Approve deixaram de ser obrigatórios. Três cópias atualizadas, backups registrados, reaplicação sem mudanças e docs:check passou. Exemplos e demais referências ainda entram na conferência final de consistência.

Emil-design-eng: descrição passou a indicar uso concreto; abertura promocional e espera roteirizada removidas. Contexto conhecido permite execução direta; sem alvo, pergunta-se apenas o necessário. Conteúdo especializado preservado. Reaplicação sem mudanças e docs:check passou. Divulgação progressiva e consolidação UI ainda pendentes.

Executing-plans: execução respeita checkpoints explícitos, continua correções autorizadas e trata falhas por diagnóstico. Retiradas dependências universais de worktree/subagentes e menu de integração, sem permitir commits/push não pedidos. Reaplicação sem mudanças e docs:check passou. Outras skills Superpowers e demais achados ainda pendentes.

Using-git-worktrees: três cópias corrigidas para verificar a regra de ignore sem commit automático. Mantida a proteção contra descoberta/inclusão acidental do worktree no repositório. Reaplicação sem mudanças e docs:check passou. Nenhum worktree ou commit foi criado nesta correção.

Improve-animations: gatilho limitado a auditoria/roadmap; planos já pedidos não exigem nova seleção e pedidos de correção seguem implementação. Removida quota artificial de oportunidades adicionais. Reaplicação sem mudanças e docs:check passou. Mudanças de produto encontradas no checkout continuam fora desta tarefa. Permanecem pendentes a consolidação, referências, durabilidade e conferência completa de achados.

Orchestration: descrição e corpo limitados ao runtime Orca existente ou solicitado. Delegação genérica usa capacidades autorizadas do host; ownership de tarefas Orca continua preservado. Guia servido pelo binário e resolução segura do CLI mantidos. Reaplicação sem mudanças e docs:check passou. Demais achados ainda pendentes.

Subagent-driven-development: removidas duas revisões obrigatórias e worktree obrigatório por tarefa. Delegação exige autorização/utilidade, ownership distinto e revisão de artefatos proporcional ao risco. Preservados checks relevantes, estado compartilhado e limites de ações externas. Reaplicação sem mudanças e docs:check passou. Restam consolidação, referências, durabilidade e validação integral.

Consistência de descoberta: descrições investigation-mode/verification alinhadas aos corpos corrigidos; palavras de frustração e início de servidor não impõem auditoria completa ou sequência fixa. Reaplicação sem mudanças e docs:check passou. Metadados de hooks e demais referências seguem na lista de validação integral.

Metadados agent-browser-verify: removidos padrões de comandos dev e sinais genéricos como loading/page; preservados sinais específicos de verificação por navegador. Cabeçalho resultante conferido, reaplicação sem mudanças e docs:check passou. Outros metadados e validação de carregamento ainda pendentes.

Metadados auth/payments: retirados caminhos genéricos de middleware/login/auth e checkout, preservando padrões específicos dos provedores. Clerk deixa de ser recomendação incondicional no título. Reaplicação sem mudanças e docs:check passou. Demais pendências do plano permanecem abertas.

## Conferência de integridade em 7 de setembro

106 arquivos distintos alterados foram conferidos contra o último hash registrado; todos existem e correspondem ao resultado esperado. Os backups correspondentes também conferem. Evidência: `2026-09-07-remediation-integrity.csv`. Esse check comprova integridade das alterações, não fechamento semântico dos achados.

Pendências concretas para a próxima passagem: contradição useEffectEvent nas referências React; junctions ausentes; fontes duráveis dos plugins alterados em cache; frontmatter com parser real; referências transitivas e termos antigos após substituições; sobreposição de descoberta UI; divulgação progressiva de referências extensas; redundância mecânica dos AGENTS e procedimentos de revisão/TDD ainda universais. A tarefa permanece ativa até essas frentes serem verificadas.

Referências React: Context7 consultado com library React e docs /reactjs/react.dev. A documentação oficial https://react.dev/reference/react/useEffectEvent confirma identidade instável e uso apenas em Effects/Effect Events. Compilações AGENTS auditadas corrigidas no parágrafo, títulos e âncoras; exemplo de busca explicitamente condicionado à semântica não reativa de onSearch. Reaplicação sem mudanças e docs:check passou. Arquivos individuais de regras/referências ainda serão varridos para a mesma afirmação.

Conferência adicional: 11 arquivos advanced-event-handler-refs.md corrigidos e registrados no CSV. Varredura dos diretórios React auditados encontrou zero ocorrências restantes da afirmação literal falsa sobre identidade estável. Total atual: 128 caminhos alterados. Frontmatter dos 95 SKILL.md alterados foi analisado pelo parser YAML instalado, com name/description textuais obrigatórios: 95 válidos, zero inválidos. Isso valida sintaxe, não todas as regras de ativação ou referências. Demais pendências permanecem abertas.

Junctions: os oito links em .copilot/skills e .gemini/config/skills continuavam apontando para destinos ausentes. Removidos somente os objetos Junction, sem recursão ou remoção de conteúdo de destino. Não foram instaladas skills substitutas de origem não confirmada. Caminhos e targets preservados em C:/Users/Junior/.codex/instruction-remediation/2026-09-06/dangling-junctions.json para reversão. Verificação posterior confirmou ausência dos oito links quebrados.

Sites/references/environment.md: alinhado o passo de open_in_codex à permissão de URLs locais; ausência de handoff não bloqueia implementação. Backup e hash registrados, trecho final conferido e docs:check passou. Permanecem outras frentes de consolidação e verificação integral.
