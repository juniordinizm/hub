---
status: proposed
owner: engineering
last_verified_commit: 9d0450a275d5bdacfaa44e306ca1ad8958053c89
---

# Base documental para auditoria de skills

## Fonte e acesso

Artigo de Eric Provencher, publicado em 4 de setembro de 2026: [Rethinking skills and prompts for GPT-6 Astra](https://x.com/i/article/2095989703967125509), vinculado pelo [post solicitado](https://x.com/pvncher/status/2095991462416490862).

O acesso direto pelo navegador de pesquisa falhou. Em 6 de setembro de 2026, o endpoint público [FxTwitter](https://api.fxtwitter.com/status/2095991462416490862) respondeu HTTP 200 via PowerShell e retornou título, autoria, data e todos os blocos textuais em `tweet.article.content.blocks`. Trata-se de uma reprodução por terceiro do artigo primário, não de validação independente das afirmações sobre o modelo. Duas imagens incorporadas não foram inspecionadas; suas legendas foram recuperadas. Nenhum texto das imagens é utilizado nesta análise.

## Síntese do artigo

O autor recomenda revisar instruções acumuladas após mudanças de modelo. Skills funcionam melhor como orientação para tarefas específicas. Catálogos extensos e descrições longas prejudicam seleção; gatilhos amplos e concorrentes podem carregar orientação irrelevante.

Descrições devem ser curtas e precisas. Skills com vários fluxos devem usar uma entrada mínima que encaminhe para referências sob demanda. Receitas excessivas podem restringir o julgamento; instruções compartilhadas precisam considerar diferentes modelos.

Em AGENTS.md, leituras obrigatórias e testes indiscriminados podem gerar trabalho desnecessário. Limites de autorização devem identificar fluxos seguros. A definição de conclusão deve incluir o trabalho esperado até o resultado verificado, evitando paradas prematuras para revisão.

## Critérios operacionais para a auditoria

Os critérios abaixo são uma aplicação local da síntese, não limites numéricos prescritos pelo artigo:

1. Medir quantidade, tamanho das descrições e duplicação entre origens.
2. Identificar gatilhos universais, sobrepostos ou desproporcionais ao propósito da skill.
3. Separar contexto obrigatório de referências carregadas por necessidade.
4. Verificar se sequências rígidas agregam proteção concreta ou apenas cerimônia.
5. Localizar aprovações e pontos de parada conflitantes com o escopo já autorizado.
6. Preservar limites justificados por efeitos externos e riscos reais.
7. Comparar regras com instruções existentes antes de propor novas regras.
8. Distinguir custo observado de contexto de hipóteses sobre desempenho; extensão isolada não prova inutilidade.

Esta nota não altera skills, configurações nem regras do projeto.
