# Plan 007: Fechar jornadas administrativas de certificado e privacidade

> **Instruções ao executor**: capacidade server não conta como jornada pronta. Prove
> autorização, confirmação, feedback, audit e recuperação no browser.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/features/certificates src/features/privacy src/features/admin src/app/\\(admin\\) src/db`

## Status

- **Prioridade**: P1
- **Esforço**: L
- **Risco**: HIGH
- **Depende de**: `003-ci-and-risk-based-testing.md`,
  `005-outbox-and-transactional-audit.md`
- **Categoria**: product-correctness, compliance
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

O produto/documentação atribui a Admin/Suporte operações de certificado e direitos de
dados. Porém `knip` identifica `src/features/certificates/actions.ts` e
`src/features/privacy/actions.ts` sem consumidor, e não existe rota administrativa de
privacidade. Backend implementado sem ponto de operação aumenta o risco de processo
manual, acesso direto ao banco e falsa sensação de completude.

## Estado atual

- `src/features/certificates/server.ts`: emissão, revogação, reemissão e rate limit
  público;
- `src/features/certificates/actions.ts`: actions não ligadas a uma rota;
- `src/features/privacy/server.ts`: registrar, aprovar, anonimizar e retenção;
- `src/features/privacy/actions.ts`: actions não ligadas a uma rota;
- `src/app/(admin)/admin/financeiro/page.tsx`: lista certificados recentes, sem
  lifecycle completo;
- `src/app/(admin)/admin/alunos/[userId]/page.tsx`: acesso/bloqueio, sem direitos de
  dados;
- política jurídica de anonimização continua pendente e protegida por flag.

## Escopo

**Em escopo**

- superfícies admin para pesquisar, emitir, revogar e reemitir certificado;
- registrar, aprovar e executar solicitações de privacidade conforme flag/política;
- detalhes, estados, confirmações, motivos e audit;
- permissões `manageCertificates` e `managePrivacy`;
- E2E e testes de transação.

**Fora de escopo**

- definir obrigação jurídica sem assessoria;
- apagar ledger financeiro exigido para defesa/auditoria;
- permitir bypass de flag;
- bulk operations na primeira versão;
- expor dados pessoais em logs/toasts.

## Passos

### 1. Ratificar matriz operacional

Para cada operação, definir:

- quem solicita;
- quem aprova;
- segregação de função;
- motivo obrigatório;
- reversibilidade;
- retenção;
- notificação à aluna;
- SLA e owner.

**Verificar**: matriz aprovada por produto/operação/jurídico quando aplicável.

### 2. Criar tela de certificado por aluna/curso

Mostrar estado, snapshot, emissão, revogação, substituição e link público. Ações
destrutivas exigem confirmação com contexto e motivo. A UI deve deixar explícito que
download antigo não pode ser recolhido.

**Verificar**: E2E cobre emitir, impedir duplicata, revogar, verificar publicamente e
reemissão vinculada.

### 3. Criar inbox de privacidade

Listar solicitações por estado e idade. Detalhe mostra histórico e dados que serão
afetados. A ação de anonimizar fica ausente/desabilitada com explicação quando
`DATA_RETENTION_ENABLED` estiver falsa.

**Verificar**: aluna/admin sem permissão não acessa; suporte segue matriz ratificada.

### 4. Tornar transições atômicas

Consumir o plano 005: state transition + audit na mesma transaction. Usar
compare-and-set por estado para impedir aprovação/execução duplicada.

**Verificar**: duas aprovações simultâneas produzem um único evento.

### 5. Remover dead entry points

Depois que as actions estiverem consumidas, rodar `knip`. Se exports continuarem sem
uso, remover apenas os realmente redundantes, preservando API usada por testes/jobs.

**Verificar**: `bun run knip` não lista certificados/privacidade como órfãos.

## Testes obrigatórios

- permissão por papel;
- transição válida e inválida;
- concorrência/retry;
- confirmação e motivo;
- flag jurídica desabilitada;
- certificado revogado no verificador público;
- audit correlacionado;
- navegação por teclado e anúncio de resultado.

## Critérios de pronto

- [ ] toda operação documentada tem caminho de UI ou runbook explícito;
- [ ] nenhuma action de lifecycle fica órfã;
- [ ] autorização é server-side;
- [ ] audit é atômico;
- [ ] anonimização respeita flag e política;
- [ ] E2E de ambos os ciclos passa;
- [ ] `knip`, testes, typecheck, check e build passam.

## Condições STOP

- política jurídica/retention não aprovada;
- matriz permite mesma pessoa solicitar e executar sem aceitação explícita;
- operação exigiria apagar ledger financeiro;
- lifecycle de reemissão diverge da decisão documental;
- UI só poderia funcionar por acesso direto ao banco.

## Manutenção

Revisar permissões e políticas semestralmente. Toda nova transição precisa de
compare-and-set, audit e teste de retry.

