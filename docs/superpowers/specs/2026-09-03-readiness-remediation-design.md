---
status: accepted
owner: engineering
last_verified_commit: 10c9cb8dd187482144850015841fb4485eacbd5f
---

# Remediação de prontidão e higiene operacional

## Objetivo

Tornar o repositório uma base confiável para novas melhorias e features,
resolvendo as lacunas técnicas e documentais verificadas em 2026-09-03. A
observação e a progressão DMARC ficam explicitamente fora deste trabalho.

## Decisões

1. vercel.json é a fonte de verdade para a cadência dos crons. A documentação
   deve refletir os quinze minutos atualmente configurados para workers
   frequentes; não haverá alteração de frequência neste trabalho.
2. A matriz de support já implementada em src/lib/auth-policy.ts e aprovada
   em docs/decisions.md prevalece sobre descrições antigas de domínio.
3. Falhas esperadas de Server Actions retornam resultados serializáveis; falhas
   inesperadas continuam sanitizadas e correlacionadas, conforme o contrato do
   Next.js 16.
4. lefthook continua instalado porque o script local de hooks o invoca por
   caminho dinâmico. O Knip receberá uma exceção mínima e testada em
   ignoreDependencies, sem ignorar o restante da análise.
5. Integração PostgreSQL e E2E continuam exigindo alvos descartáveis. Nenhum
   segredo, banco persistente ou provider real será usado como atalho local.
6. Nenhuma branch, worktree, objeto Git, secret, DNS ou provider será removido
   sem inventário do alvo exato, estado e possibilidade de recuperação.
7. A ausência de MFA administrativo permanece decisão vigente e não será
   reintroduzida por este trabalho.

## Escopo por sprint

### Sprint 0 — baseline e proteção

Reconfirmar SHA, branches, worktrees, alterações preexistentes, links locais,
gates e evidências remotas. Esta sprint não altera Production nem remove dados.

### Sprint 1 — verificação reproduzível

Corrigir o falso vermelho local do Knip, criar contrato de configuração e fazer
bun run verify passar sem depender de CI=true manualmente. Preservar o
comportamento de CI e os quinze minutos dos workers.

### Sprint 2 — documentação semanticamente coerente

Alinhar cron, suporte, estado de release, evidências externas, planos ativos e
links. Adicionar contrato automatizado para impedir novo drift entre
vercel.json e os runbooks.

### Sprint 3 — hygiene de branches e worktrees

Reconciliar a base de desenvolvimento em origin/staging, classificar o
worktree local antigo e os objetos dangling. Apenas alvos comprovadamente
descartáveis poderão ser removidos; GC fica adiado pela janela de recuperação.

### Sprint 4 — prontidão operacional sem DMARC

Registrar as provas atuais de CI, deploy, backup, Resend e Sentry. Manter como
pendências somente evidências realmente ausentes, sem repetir cobrança, e-mail,
restore ou evento Sentry já comprovados.

### Sprint 5 — requalificação

Executar todos os gates locais e remotos disponíveis, revisão independente e
publicar uma decisão nova de prontidão. DMARC permanece registrado como
observação aceita pelo escopo desta solicitação.

## Critérios de aceite

- bun run verify passa em uma sessão normal de desenvolvimento;
- docs:check, db:migrations:check, TypeScript, Ultracite, testes, build, Knip e
  audit passam;
- os crons documentados coincidem com vercel.json;
- a documentação não declara que support está sem a separação já implementada;
- o estado de release distingue código verificado, código implantado e código
  documentado;
- links locais da documentação indexada existem;
- nenhum alvo externo é alterado sem evidência sanitizada e rollback;
- não há nova promoção Production sem decisão formal atualizada;
- DMARC não é alterado.

## Segurança e rollback

Alterações de código usam testes RED/GREEN e podem ser revertidas por commit
isolado. Alterações de documentação não alteram runtime. Worktrees e branches
com conteúdo não classificado são preservados. Em caso de divergência entre
provider, código e documento, o fluxo para e registra a divergência; não edita o
Markdown automaticamente.

## Resultado da execução — 2026-09-03

O contrato foi implementado sem alteração de runtime dos crons ou de DMARC.
`npx -y bun@1.3.11 run verify` passou com 367 arquivos de teste, 2.456 testes,
build e Knip em uma sessão normal, deixando somente 14 configuration hints.
Os contratos focados de Knip, documentação e workflows passaram 24 testes; a
suíte de authoring passou 35 testes.

Os runs remotos `33716424503`, `33718401953`,
`33778673874` e `33718939437` terminaram `success` no
SHA `10c9cb8dd187482144850015841fb4485eacbd5f`. O CI comprovou integracao e E2E
com PostgreSQL descartavel; localmente esses comandos continuam condicionados
a presenca explicita de URLs descartaveis.

O responsável confirmou os itens externos 1 a 8, incluindo R2/restore,
lock/lifecycle, cabeçalhos Production e rotação de secrets Vercel/Resend.
DMARC permanece em observação até 2026-09-12, sem alteração.

O worktree vinculado e os objetos dangling foram preservados; são higiene de
desenvolvimento e não bloqueiam novas features ou promoções protegidas.
