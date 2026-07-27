---
status: accepted
owner: engineering
last_verified_commit: 4068ea5b4b48ced0cd5295207756bfee5189c440
---

# Release simplificado e migrations de Development

## Objetivo

Reduzir o trabalho manual de uma pessoa desenvolvedora júnior sem remover os
controles que impedem migrations no banco errado ou deploy de código sem CI
verde.

O fluxo resultante terá:

- dois comandos locais fáceis de memorizar;
- deploy Production iniciado por uma confirmação, sem copiar SHA;
- migration da branch Neon Development por workflow manual e protegido;
- documentação explícita sobre o limite do Preview persistente.

## Decisões

### Verificação local

`bun run verify:quick` executará os gates rápidos usados durante o
desenvolvimento:

1. integridade das migrations;
2. typecheck;
3. Ultracite;
4. testes automatizados.

`bun run verify` executará o conjunto completo anterior, acrescentando:

1. documentação;
2. build Production;
3. Knip.

Os scripts serão implementados por um orquestrador TypeScript comum. Ele
executará os comandos sequencialmente, mostrará o gate atual, interromperá no
primeiro erro e devolverá o mesmo status de falha ao terminal. O CI continuará
sendo a autoridade final.

O gate `build` receberá a mesma classe de configuração sintética da CI: origem
`.invalid` e segredo descartável para as variáveis mínimas exigidas. Assim,
`verify` funciona em worktree limpo sem copiar `.env.local`.

Como o projeto é desenvolvido em Windows e validado em Linux, o Biome
preservará a terminação nativa por arquivo com `lineEnding: auto` também para
JSON e CSS. Isso evita centenas de falsos erros CRLF/LF sem reformatar o
repositório.

### Deploy Production

O workflow `Deploy Vercel production` deixará de solicitar `release_sha`.
Permanecerá somente a confirmação booleana de Production.

O workflow fará checkout da `main`, resolverá o SHA completo do próprio
checkout e provará que:

- o checkout corresponde ao `origin/main` atual;
- existe uma execução bem-sucedida do workflow CI para esse SHA na `main`;
- a confirmação de Production foi marcada.

As etapas posteriores permanecem iguais: migration com lock, auditoria,
deployment não promovido, readiness e promoção.

### Migration Development

Um workflow manual `Migrate Neon development` será adicionado. Ele:

1. aceitará somente uma confirmação booleana;
2. usará o GitHub Environment `neon-development`;
3. fará checkout da `main`;
4. exigirá CI verde para o SHA atual da `main`;
5. exigirá `DATABASE_URL_DIRECT` como secret do Environment;
6. exigirá `DEVELOPMENT_DATABASE_HOST` como variable do Environment;
7. normalizará host pooled/direto e recusará qualquer URL cujo hostname não
   corresponda ao host esperado;
8. reutilizará o advisory lock global do migrador;
9. aplicará somente migrations pendentes;
10. auditará o journal e o catálogo depois da aplicação;
11. usará concorrência sem cancelamento para impedir migrations simultâneas.

O workflow não aplicará migrations de uma feature antes do merge. Development
representará sempre o schema da `main`, evitando que código ainda não aprovado
quebre o ambiente compartilhado.

### Preview e migrations

O Preview persistente não receberá migrations de PR. Os testes PostgreSQL e E2E
continuarão usando branches Neon descartáveis já migradas.

Consequências:

- Preview continua adequado para mudanças sem dependência de schema novo;
- mudanças dependentes de migration são comprovadas pela CI isolada;
- a validação manual anterior ao merge deve usar uma branch Neon temporária
  quando a jornada precisar do schema novo;
- não será aplicada migration de PR no banco Preview compartilhado, evitando
  colisão entre PRs.

Uma branch Neon por PR, conectada ao deployment Vercel correspondente, fica fora
deste escopo. Ela só se justifica quando houver vários PRs simultâneos que
precisem de validação manual completa com schema próprio.

## Interfaces e configuração

### Comandos

```powershell
bun run verify:quick
bun run verify
```

### GitHub Environment

O workflow de Development requer:

- Environment: `neon-development`;
- secret: `DATABASE_URL_DIRECT`;
- variable: `DEVELOPMENT_DATABASE_HOST`;

`DEVELOPMENT_DATABASE_HOST` contém somente o hostname do compute Development,
sem usuário, senha ou nome do banco.

### Workflows

- `CI`: continua automático em PR e push para `main`;
- `Migrate Neon development`: manual, usa exclusivamente a `main`;
- `Deploy Vercel production`: manual, usa exclusivamente a `main`, sem entrada
  de SHA.

## Tratamento de falhas

- Um gate local falho encerra imediatamente `verify:quick` ou `verify`.
- Host Development divergente encerra o workflow antes de abrir conexão.
- Ausência de CI verde encerra migrations Development e deploy Production.
- Migration falha encerra o workflow; não há tentativa de rollback SQL.
- Concorrência não cancela uma migration em andamento.
- Production só troca o domínio depois de readiness bem-sucedida.

## Seams de teste

Os testes observarão somente interfaces públicas:

1. `runVerificationProfile(profile, executor)`:
   - executa os gates na ordem documentada;
   - interrompe no primeiro status diferente de zero;
   - diferencia os perfis `quick` e `full`.
2. `getMigrationTargetProblems(environment, target)`:
   - aceita a URL direta do host esperado;
   - normaliza hostname pooled/direto;
   - rejeita URL ausente, inválida ou de outro compute.
3. Validação estrutural dos workflows:
   - Production não expõe `release_sha`;
   - ambos derivam o SHA do checkout da `main`;
   - Development exige confirmação, CI verde, Environment, host guard,
     migration, auditoria e concorrência sem cancelamento.

Os testes não executarão GitHub Actions nem acessarão Neon real. CI e uma
execução manual posterior do workflow serão as provas de integração externa.

## Documentação afetada

Serão atualizados:

- `docs/operations/shared-development-and-release-guide.md`;
- `docs/operations/database-and-migrations.md`;
- `docs/operations/testing-and-ci.md`;
- `docs/operations/deploy-and-incidents.md`, se ainda mencionar SHA manual.

## Fora de escopo

- deploy automático após merge;
- migration automática de PR em banco persistente;
- cópia de dados entre Development e Production;
- branch Neon/Vercel exclusiva por PR;
- rollback destrutivo de migrations.
