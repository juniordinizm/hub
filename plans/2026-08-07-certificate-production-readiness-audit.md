# Auditoria de prontidão para produção: Certificados

**Data:** 2026-08-07  
**Commit auditado:** `6fdfcfd`  
**Implementação pós-auditoria:** branch `staging`, working tree sem commit  
**Escopo:** módulo de Certificados, emissores e templates, conclusão de Curso, painel Admin/Suporte, área da Aluna, verificador público, PDF/QR/R2, outbox/e-mail, manutenção, banco, testes, documentação e gates de release.  
**Decisão:** **NO-GO para produção do fluxo de Certificados no estado atual.**

## Atualização de implementação cautelosa — 2026-08-07

O relatório abaixo registra a fotografia inicial. A implementação posterior encerrou ou reduziu os achados técnicos marcados nesta seção:

- ✅ CERT-001: reemissão do último registro revogado, sem reescrever histórico; UI exibe a ação apenas quando o registro é o último.
- ✅ CERT-002: código público uniforme `PRT-` + 32 caracteres hexadecimais, retry transacional em colisão e testes de conflito.
- ✅ CERT-003: verificador agora compara emissor, CNPJ e conclusão com o snapshot imutável; página instrui a conferência.
- ✅ CERT-004: cargo é campo renderizável; configuração global funciona como default explícito quando o template não define signatário.
- ✅ CERT-005: Server Actions de emissão/revogação/reemissão retornam estado tipado via `useActionState`.
- ✅ CERT-006: save/publish/enable/disable de template/curso gravam auditoria na mesma transação.
- ✅ CERT-007: pathname de certificado é redigido no Sentry e a página pública usa `noindex,nofollow`.
- ◐ CERT-008: migration `0056_certificate_state_invariants` foi promovida pelo runner oficial em staging e verificada; production ainda está até a 0054 e precisa receber 0055 e 0056.
- ◐ CERT-009: o teste remoto encontrou e corrigiu um default de template cujo QR ultrapassava a área imprimível; preflight e metadados mínimos do PDF estão implementados, mas QR final, matriz de caracteres, acessibilidade e revisão física continuam pendentes.
- ◐ CERT-010: hash de artefato é persistido como metadata em novas gravações e conferido no download quando disponível; legado e reconciliação externa ainda pendentes.
- ◐ REL-001: suíte local, lint, typecheck, build, audit e integração PostgreSQL real verdes; R2/e-mail reais e E2E do artefato ainda não foram exercitados.
- ⏳ GOV-001, CERT-011 e CERT-012: permanecem pendentes; REL-001 está parcial pelos testes reais de R2/e-mail, E2E e operação de staging.

A decisão continua **NO-GO** até o aceite jurídico/operacional, a promoção da cadeia restante em production, a evidência de staging e os testes reais de R2/e-mail/artefato serem concluídos. Staging recebeu a 0056 pelo runner oficial e passou o postflight; production continua até a 0054, portanto o gate de migration permanece aberto somente para a promoção de production.

## Evidência conectada a Vercel, Neon e R2 — 2026-08-07

As consultas iniciais de Vercel, Neon e R2 foram somente de leitura. Depois, para não apontar uma suíte destrutiva aos ambientes principais, o SQL da 0056 e os testes de integração foram executados em duas branches Neon descartáveis; ambas foram apagadas ao final. Por último, a migration 0056 foi aplicada em staging pelo runner oficial protegido do projeto. Production e os buckets R2 não foram alterados.

### Vercel

- O projeto `hub` existe e o deployment de staging `dpl_BvCMmAyU7foN5nfyeUrdcgLiDg8Z` está `READY`, região `gru1`, com os aliases `preview.neurocapacitar.com.br` e `hub-env-staging-neuro-capacitar.vercel.app`.
- O deployment de produção `dpl_HquonccfkfWzyjJ7DDNkWX25U8Qb` também está `READY`, mas ainda aponta para o commit de produção antigo `cde26cf`; o deployment de staging aponta para o commit-base `6fdfcfd`.
- O working tree local contém as mudanças da auditoria sem commit/push. Logo, o Vercel remoto ainda não valida essas mudanças locais; ele valida somente o commit-base.
- Após a reconciliação, o banco de staging está na 0056 enquanto o deployment Vercel continua no commit-base `6fdfcfd`; antes do E2E, o workflow deve publicar o commit compatível e confirmar readiness nessa combinação.
- O build remoto de staging terminou sem erro. O único aviso retornado foi a ausência de token de release do Sentry.
- Smoke HTTP sem inspeção visual: `/api/health/ready` retorna `401` sem o segredo esperado; um código de certificado inexistente retorna `404` com `X-Robots-Tag: noindex, nofollow` e `Cache-Control: no-store`. Isso comprova proteção e roteamento, não o fluxo de emissão.
- Não houve erro de runtime agrupado nas rotas de certificado nos últimos sete dias. Como os bancos consultados não possuem certificados, isso não substitui um E2E com fixture real.

### Neon/PostgreSQL

- Branch `staging` (`br-rapid-rain-acnqzhiv`): PostgreSQL 18.4, zero certificados; o runner oficial registrou a migration local 0056 (linha 57, `created_at` `1786099773858`, hash `a65efc91...e22f1`). O postflight encontrou as três constraints de revogação e FK `course_id` em `ON DELETE RESTRICT`.
- Branch `production` (`br-dark-boat-ac5ju6m4`): PostgreSQL 18.4, journal com 55 linhas; a linha mais recente corresponde à migration local 0054. A 0055 e a 0056 não estão aplicadas e as constraints permanecem ausentes.
- A evidência agora separa os estados: staging está reconciliado e production está atrasado. A mesma cadeia deve ser promovida a production pelo workflow oficial, com backup e preflight, sem aplicar SQL manualmente.
- Em uma branch descartável foi aplicado o SQL da 0056 e foram verificadas as três constraints de revogação e a FK `ON DELETE RESTRICT`. As branches de teste foram apagadas; isso comprova o SQL e a suíte, mas não substitui a promoção oficial em production.
- `bun run db:migrate:staging` passou duas vezes com URL direta, branch e confirmação de staging; a segunda execução foi idempotente. O postflight permaneceu em 57 linhas, hash da 0056, três constraints e FK `RESTRICT`.

### Cloudflare R2

- A API Cloudflare lista quatro buckets esperados: `hub-development-private`, `hub-development-public`, `neuro-prod-private` e `neuro-prod-public`.
- Com a credencial de Development, `HeadBucket` e `ListObjectsV2` passaram nos buckets privado e público; o prefixo `staging/` também retornou objetos nos dois buckets, confirmando a fronteira de namespace documentada.
- Há objetos nas categorias `certificates`, `courses`, `banners` e `uploads` no privado de Development. O primeiro artefato legado de certificado encontrado não possui metadata `sha256`; isso confirma, em ambiente real, o risco já registrado de backfill/reconciliação legada.
- `GetBucketCors` retornou `AccessDenied` para a chave usada. Isso é uma limitação de escopo da credencial, não prova de CORS incorreto; a política precisa ser revalidada com uma credencial de leitura administrativa antes do GO.

## Resumo executivo

A arquitetura-base é boa e, em vários pontos, mais rigorosa que implementações comuns de LMS: snapshots imutáveis, PDF privado, verificador separado, outbox durável, lease com fencing, upload condicional, revogação histórica, auditoria das operações de ciclo de vida e autorização por objeto no download.

Os três bloqueios técnicos do snapshot inicial foram implementados nesta branch: reemissão do último histórico revogado, código público com espaço uniforme e claims comparáveis no verificador. O veredito permanece NO-GO por gates que não podem ser inferidos de testes locais: aceite jurídico/operacional, promoção da cadeia em production, R2/e-mail reais, E2E do artefato e operação completa em staging.

Há ainda um gate não técnico: a documentação canônica declara pendentes a política jurídica de retenção/direitos/anonimização, a base legal e a verificação externa da infraestrutura de cron. Sem essas decisões e evidências, não é possível afirmar prontidão LGPD ou operacional.

O veredito não significa que o módulo precise ser refeito. O núcleo assíncrono, a privacidade do artefato e a concorrência já têm desenho consistente. As correções aplicadas preservam a arquitetura existente; os itens restantes são evidência, governança e hardening de artefato.

## Escala

- **P0:** bloqueia produção ou viola contrato central, segurança ou obrigação ainda não decidida.
- **P1:** necessário antes do lançamento ou imediatamente no hardening, conforme exposição real.
- **P2:** dívida relevante, mas não bloqueia isoladamente.
- **Confiança alta:** caminho de execução e contrato confrontados diretamente.
- **Confiança média:** risco real, mas impacto depende de configuração, escala ou decisão jurídica.

## Resultado consolidado

| ID | Prioridade | Achado | Confiança | Esforço |
| --- | --- | --- | --- | --- |
| CERT-001 | P0 | ✅ Implementado — reemissão após revogação | Alta | M |
| CERT-002 | P0 | ✅ Implementado — código uniforme e retry de colisão | Alta | M |
| CERT-003 | P0 | ✅ Implementado — claims comparáveis no verificador | Alta | S |
| GOV-001 | P0 | ⏳ Pendente — retenção, base legal, direitos e cron | Alta | Decisão/Operação |
| CERT-004 | P1 | ✅ Implementado — signatário por Curso + default global | Alta | M |
| CERT-005 | P1 | ✅ Implementado — estado tipado nas Server Actions | Alta | S |
| CERT-006 | P1 | ✅ Implementado — auditoria transacional de mutações | Alta | M |
| CERT-007 | P1 | ✅ Implementado — redaction Sentry + noindex | Alta | S |
| CERT-008 | P1 | ◐ Parcial — staging 0056 verificada; production 0054, faltam 0055/0056 | Alta | M |
| CERT-009 | P1 | ◐ Parcial — default inválido corrigido; QR/acessibilidade/E2E pendentes | Alta | M/L |
| REL-001 | P1 | ◐ Parcial — integração PostgreSQL real 27/27; R2/e-mail/E2E ainda pendentes | Alta | S/M |
| CERT-010 | P2 | ◐ Parcial — metadata e conferência no download; legado/reconciliação pendentes | Alta | M |
| CERT-011 | P2 | ⏳ Pendente — serviço central ainda concentrado | Alta | M |
| CERT-012 | P2 | ⏳ Pendente — rate limit ainda responde via `404` | Alta | S |

## Alinhamento com o domínio aprovado

### Implementado de forma consistente

- um Certificado representa evidência histórica de uma Aluna e um Curso;
- snapshots de nome, Curso, carga horária, emissor e template são persistidos na emissão;
- alterar Curso, perfil ou template não reescreve Certificados históricos;
- PDF fica em bucket privado e a URL de leitura expira em cinco minutos;
- rota pública do PDF sempre retorna não encontrado;
- download da Aluna exige sessão e ownership; Admin/Suporte usam capability explícita;
- revogação preserva o registro e separa categoria pública de detalhe interno;
- emissão automática é idempotente por índice parcial de Certificado válido;
- renderização usa outbox, lease persistido, fencing token, chave determinística e `PUT` condicional;
- e-mail é enfileirado somente depois de o PDF chegar a `ready`;
- reconciliação cobre artefato órfão, claim expirado e limpeza segura de assets;
- verificador público não expõe PDF, e-mail, IDs internos nem detalhe livre de revogação.

### Parcial ou divergente

- os três desvios técnicos do snapshot inicial foram corrigidos e têm testes unitários; a concorrência PostgreSQL real passou em branch descartável, mas E2E completo de artefato/R2/e-mail continua sem evidência;
- a promessa de rastreabilidade agora cobre save, publish, enable e disable de template na mesma transação, mas ainda depende de consulta/alerta operacional dos `audit_logs`;
- o schema/migration local declara `ON DELETE RESTRICT` e checks de estado/categoria; staging recebeu e verificou a 0056, enquanto production ainda está em 0054 e precisa da promoção oficial de 0055/0056;
- o renderizador agora rejeita overflow vertical, mas QR no PDF final, caracteres suportados, acessibilidade e revisão física ainda não foram comprovados;
- a documentação reconhece pendências jurídicas e operacionais incompatíveis com uma afirmação de “pronto para produção”.

## Achados detalhados

### CERT-001 — P0 — Reemissão impossível depois de revogação

**Status atual:** ✅ Implementado em `server.ts` com lock por Aluna/Curso, seleção do último histórico, preservação da revogação anterior e UI condicionada a `canReissue`. Testes unitários e a suíte PostgreSQL descartável cobrem predecessor revogado, concorrência e ausência de reescrita.

**Evidência**

- `reissueCertificate` bloqueia somente quando o predecessor não é o último registro do par Aluna/Curso ou já possui sucessor;
- a revogação anterior não é reescrita; a reemissão cria novo código, snapshots e vínculo auditável;
- `src/features/certificates/server.ts` usa lock transacional por Aluna/Curso para impedir duas reemissões concorrentes;
- `src/app/(admin)/admin/alunos/[userId]/certificate-operations.tsx` oferece reemissão no último registro revogado elegível;
- `docs/decisions.md:81` e `docs/domain/certificates-and-data-rights.md` determinam que, após revogação, somente reemissão manual pode criar novo válido;
- testes cobrem predecessor revogado e preservação do histórico; o smoke concorrente real continua pendente.

**Impacto**

No snapshot inicial, revogar por correção, elegibilidade ou integridade criava um beco sem saída. O risco foi fechado no código; permanece apenas a necessidade de provar corrida entre duas reemissões com Postgres real.

**Correção recomendada**

Implementação concluída para os quatro primeiros itens. O item restante é o smoke de concorrência `valid -> revoked -> replacement`, `revoked -> replacement` e corrida entre duas reemissões.

### CERT-002 — P0 — Código público curto e colisão silenciosa

**Status atual:** ✅ Implementado. `createCertificateCode` produz `PRT-` + 32 hexadecimais; emissão manual e automática usam a mesma forma e savepoints distinguem colisão de código da idempotência. Testes cobrem retry automático/manual.

**Evidência**

- `createCertificateCode` agora produz `PRT-` + 32 caracteres hexadecimais para novas emissões; códigos legados continuam sendo aceitos no lookup;
- emissão automática e manual usam savepoints e repetem somente em colisão da constraint global de código;
- a idempotência por Aluna/Curso continua separada do conflito de `code` por `ON CONFLICT ... WHERE status = 'valid'`;
- testes cobrem colisão na emissão automática e manual; a integração PostgreSQL descartável confirmou a constraint, retry e idempotência em ambiente real.

**Impacto**

No snapshot inicial, o código curto aumentava enumeração e colisão. Novas emissões usam o material hexadecimal completo de UUIDv4 (32 caracteres; entropia efetiva de UUIDv4); constraints/retry passaram na integração e o risco residual é acompanhar códigos legados e telemetria de colisões.

**Correção recomendada**

Implementação concluída para novas emissões, retry e compatibilidade de lookup legado. Telemetria específica de colisões e smoke de integração continuam recomendados.

### CERT-003 — P0 — Verificador não prova correspondência do documento

**Status atual:** ✅ Implementado. O lookup lê emissor, CNPJ e conclusão do `render_snapshot`; a página os exibe e orienta a comparação. O teste E2E de adulteração do PDF ainda é pendente.

**Evidência**

- `issuerName` é campo obrigatório do template em `src/features/certificates/template-rules.ts:44`;
- o PDF pode imprimir `completedAt`, `issuedAt`, emissor, CNPJ, nome, Curso e carga em `src/features/certificates/rendering.ts:12`;
- `getCertificateByCode` seleciona emissor, CNPJ e conclusão do `render_snapshot`;
- `src/app/certificados/[code]/page.tsx` mostra nome, Curso, carga, emissão, código, status, emissor, CNPJ e conclusão;
- a página instrui a confrontar as alegações do documento com o registro; E2E de adulteração do PDF ainda é pendente.

**Impacto**

O verificador agora oferece os campos necessários para revelar divergência de emissor, CNPJ e conclusão. Isso continua sendo comparação de claims, não assinatura digital do PDF; o E2E deve comprovar cada alegação adulterada.

**Correção recomendada**

Implementação concluída para o registro, a página e a instrução de comparação. Falta o E2E que adultera cada alegação do documento e comprova a detecção.

### GOV-001 — P0 — Política jurídica e operação externa não verificadas

**Evidência**

`docs/domain/certificates-and-data-rights.md:93` mantém pendentes:

- política jurídica de retenção, direitos e anonimização;
- base legal de produção;
- verificação externa da infraestrutura de cron.

Nome, Curso, datas, código, PDF e histórico são dados pessoais. A LGPD não define retenção universal; finalidade, base, transparência, canal de direitos e conservação precisam de decisão documentada.

**Impacto**

Não há base para prometer conformidade LGPD, responder pedidos de titular ou garantir que renderização/manutenção serão executadas no ambiente-alvo.

**Saída do gate**

- matriz jurídica por dado/finalidade/base/prazo/destino/exceção;
- decisão sobre divulgação pública por link e aviso à Aluna;
- procedimento de correção, bloqueio, eliminação e conservação histórica;
- evidência de cron, alertas, restore DB+R2 e smoke completo no ambiente de homologação/produção.

### CERT-004 — P1 — Controles de assinatura sem efeito

**Status atual:** ✅ Implementado. `signerRole` integra regras, preview e render; `app_settings` é fallback somente quando o template do Curso não define o valor, e o valor resolvido é congelado no snapshot.

**Evidência**

- o editor, contrato de campos, prévia e `fieldValues()` incluem `signerRole`;
- emissões resolvem signatário do template do Curso, com `app_settings` como fallback explícito;
- nome e cargo resolvidos são congelados no snapshot, preservando o PDF histórico;
- teste de renderização verifica que o cargo chega ao PDF.

**Impacto**

Admin pode acreditar que cargo/nome configurados serão impressos e emitir Certificados sem a identificação pretendida do responsável.

**Correção recomendada**

Escolher uma única regra: signatário por Curso, como define a documentação, ou defaults globais explícitos. Remover o controle legado ou usá-lo somente como default. Incluir `signerRole` no contrato de campo, prévia, PDF e testes se ele permanecer na UI.

### CERT-005 — P1 — Erros esperados ficam opacos em produção

**Status atual:** ✅ Implementado nas três ações de operação manual com estado discriminado e `useActionState`; falhas inesperadas continuam escapando para o boundary/telemetria.

**Evidência**

- `src/features/certificates/actions.ts` retorna `CertificateActionState` e usa `useActionState` na UI;
- erros esperados de domínio/Zod retornam mensagem tipada; exceções inesperadas continuam escapando para boundary/telemetria;
- a documentação oficial do Next.js 16 recomenda retornar erros esperados de Server Functions como valores e consumi-los com `useActionState`;
- em produção, mensagens de erros Server Component/Server Action são mascaradas para evitar vazamento;
- as ações de template no mesmo projeto já usam `CertificateTemplateActionState`, provando o padrão local adequado.

**Impacto**

Operadores verão erro genérico em falhas previsíveis como matrícula ausente, Certificado revogado ou publicação inexistente. O fluxo crítico perde diagnóstico justamente em produção.

**Correção recomendada**

Retornar união discriminada/estado tipado para erros esperados, registrar erro inesperado com correlation ID e deixar somente falhas de infraestrutura escaparem para o boundary.

**Fonte:** [Next.js 16.2 — Error Handling](https://nextjs.org/docs/app/getting-started/error-handling).

### CERT-006 — P1 — Template não é auditado

**Status atual:** ✅ Implementado. Save, publish, enable e disable gravam ator, ação, alvo e metadados dentro da transação que altera o estado.

**Evidência**

- emissão, revogação e reemissão gravam `audit_logs` com ator e metadados;
- salvar rascunho, publicar, habilitar e desabilitar template gravam eventos específicos na mesma transação da mutação; rascunho registra digest do spec e publicação registra o template;
- o template define conteúdo, emissor visual e signatário de todo Certificado futuro, e o snapshot preserva o valor resolvido.

**Impacto**

Após uma emissão incorreta não é possível responder com segurança quem publicou qual versão e quando. O snapshot preserva o “o quê”, mas não a autoria da mudança.

**Correção recomendada**

Gravar, na mesma transação da mutação, ator, Curso, template/version, ação, chaves de assets e digest do spec; evitar guardar conteúdo binário ou URL assinada. Tornar publicação e enable/disable eventos distintos.

### CERT-007 — P1 — Vazamento de código em observabilidade e indexação

**Status atual:** ✅ Implementado no código: Sentry redige segmentos de `/certificados/<code>` e a página exporta metadata `noindex,nofollow`. CDN/cache e sitemap precisam de verificação no ambiente-alvo.

**Evidência**

- `src/lib/sentry-options.ts` remove query string e redige segmentos `/certificados/<code>`;
- a página pública exporta metadata `robots: noindex,nofollow`;
- smoke HTTP do alias de Preview retornou `404`, `X-Robots-Tag: noindex, nofollow` e `Cache-Control: private, no-cache, no-store` para código inexistente;
- CDN, sitemap e headers efetivos ainda precisam ser verificados no ambiente-alvo;
- a política global `strict-origin-when-cross-origin` evita enviar o path a terceiros cross-origin, o que é positivo.

**Impacto**

O código é um localizador público não enumerável para dados pessoais. Logs, traces ou indexação ampliam o círculo de posse do código e enfraquecem o modelo de disclosure por link.

**Correção recomendada**

Normalizar pathnames de certificado antes de telemetria, usar `noindex, nofollow`, não incluir as rotas em sitemap/analytics identificável e revisar cache/CDN. Decidir juridicamente se o nome/Curso deve ser sempre público para qualquer portador do link.

### CERT-008 — P1 — Invariantes históricos incompletos no banco

**Status atual:** ◐ Implementado e verificado em staging pelo runner oficial: staging está na migration local 0056 com checks e FK `RESTRICT`; production está até a 0054 e ainda precisa receber 0055 e 0056 antes do GO.

**Evidência**

- o schema Drizzle local declara `certificates.course_id` como `ON DELETE RESTRICT`, preservando a evidência histórica;
- `certificate_template_id` usa `SET NULL`, apesar de o snapshot preservar o render;
- a migration 0056 normaliza legado e adiciona checks para `revoked_at`, categoria e campos de revogação;
- o postflight de staging confirmou o hash SHA-256 do arquivo local (`a65efc91...e22f1`), linha 57 do journal, zero certificados, três constraints e FK `RESTRICT`;
- `certificate_template_id SET NULL` permanece intencional: o snapshot é a fonte do artefato histórico.
- em branch Neon descartável, o SQL da 0056 foi aplicado com sucesso e as três constraints e a FK `RESTRICT` foram consultadas depois da alteração;
- em staging, o runner oficial registrou a 0056 no journal e o postflight confirmou o mesmo hash do arquivo local, três constraints, FK `RESTRICT` e zero certificados;
- uma segunda execução do runner oficial não criou nova linha nem reaplicou DDL, confirmando idempotência operacional;

**Impacto**

No snapshot inicial, operações diretas podiam apagar história ou criar estado que a UI interpretava com fallbacks. A migration materializa o contrato; staging já passou o backfill/preflight. O risco residual é a promoção controlada de 0055/0056 em production e o lock/tempo do backfill se houver dados no alvo.

**Correção recomendada**

Staging já foi reconciliado pelo runner oficial. Promover a cadeia 0055 e 0056 para production pelo workflow protegido, com backup e preflight de dados, confirmar hashes/journal/checks/FK e não registrar migrations manualmente fora do runner.

### CERT-009 — P1 — Qualidade e acessibilidade do artefato não estão comprovadas

**Status atual:** ◐ Parcial. O render agora falha explicitamente quando texto excede a altura configurada. A integração remota revelou que o default antigo colocava o QR fora da área imprimível; o layout foi corrigido para manter todos os campos dentro da página e ganhou regressão unitária. QR decodificado, extração integral, acessibilidade e revisão física continuam pendentes.

**Evidência**

- o renderizador mede `heightOfString` antes de escrever e falha explicitamente em overflow vertical;
- o PDF agora inclui metadados `Title`, `Author`, `Subject`, `Creator` e `Keywords`, além do código textual configurável;
- nomes e títulos longos ainda exigem matriz de caracteres e revisão do produto;
- testes confirmam bytes, hash, fonte e presença básica, mas não extraem e comparam todos os textos;
- QR é gerado, mas ainda não é decodificado a partir do PDF final em teste;
- não há teste físico de impressão/câmera;
- o PDF agora define `Title`, `Author`, `Subject`, `Creator` e `Keywords`, mas não idioma, tags, ordem de leitura ou alternativa semântica para QR/background;
- só Helvetica/Helvetica-Bold são permitidas, sem matriz explícita de caracteres/nomes suportados.
- a correção do default reduz o risco de emissão nova falhar logo no template inicial, mas não substitui a validação de templates já persistidos.

**Impacto**

Pode haver credencial com nome/Curso incompleto ou QR ilegível. O PDF contém texto real, mas não há evidência para declará-lo acessível ou PDF/UA.

**Correção recomendada**

- preflight de layout com falha explícita ou autofit limitado por regra de produto;
- teste de extração integral, acentos, nomes longos, apóstrofos, hífens e Unicode suportado;
- decodificar QR do PDF rasterizado e executar matriz física;
- fornecer URL/código textual e metadados mínimos;
- registrar acessibilidade atual como gap aceito ou trocar/adaptar o gerador para PDF marcado.

PDF/A, PDF/UA formal e PAdES são condicionais a requisito. Não são necessários apenas para “parecer moderno”.

### REL-001 — P1 — Gate global de release vermelho

**Status atual:** ◐ Parcial. A suíte global, o lint, o typecheck, o build, o audit de dependências e a integração PostgreSQL real estão verdes. O gate ainda não fecha porque R2/e-mail reais, E2E do artefato, restore e o smoke operacional completo de staging não foram comprovados; a migration de staging já foi promovida e verificada.

**Evidência executada em 2026-08-07**

- build de produção: passou após tornar o helper de classificação privado ao módulo de Server Actions;
- typecheck: passou;
- testes direcionados de Certificados/outbox/verificador/migrations/UI: passaram; a contagem final é autoritativa na suíte completa abaixo;
- suíte completa: 234/234 arquivos passaram, 1504/1504 testes passaram;
- Ultracite: 667 arquivos verificados, sem correções pendentes;
- docs: 32 documentos canônicos válidos;
- migrations: válidas;
- `bun run db:migrate:staging`: PASS duas vezes; staging na 0056, journal/hash/constraints/FK confirmados e segunda execução idempotente;
- integração `bun run test:certificates:integration`: passou em branch Neon descartável após aplicar o SQL da 0056, com 4 arquivos e 27/27 testes. A branch foi apagada; o teste de emissão foi executado contra PostgreSQL real, enquanto R2, render e e-mail permanecem mocks da suíte;
- na primeira execução global houve uma falha transitória no teste de concorrência do worker Asaas (2 claims em vez de 1); o arquivo passou em cinco reexecuções consecutivas e a suíte global foi repetida com 27/27, portanto o risco residual é flakiness de infraestrutura e não falha reproduzida do certificado;
- `bun audit`: passou sem vulnerabilidades após fixar overrides compatíveis para `@hono/node-server`, `hono`, `ip-address` e `js-yaml`.

**Impacto**

O audit local e a integração PostgreSQL estão verdes. O release ainda não pode ser declarado pronto porque o ambiente principal está atrasado nas migrations e faltam provas reais de R2/e-mail, QR, restore e operação de staging.

**Correção recomendada**

O launcher, o lint, as transitivas vulneráveis, o fixture de template padrão e as integrações PostgreSQL foram corrigidos/revalidados. Resta executar o smoke completo em staging com R2/e-mail reais e a migration oficial registrada no journal.

### CERT-010 — P2 — Hash sem verificação operacional

**Status atual:** ◐ Parcial. A reutilização de artefato existente durante o render compara o SHA-256 armazenado; novas gravações persistem o digest em metadata R2 e o download confere essa metadata antes de emitir URL assinada. Artefatos legados sem metadata e reconciliação periódica ainda pendem. Hash interno não substitui assinatura digital.

O upload condicional impede overwrite pelo caminho normal. Uma mutação externa de artefato novo é detectada no download; objetos legados sem metadata continuam exigindo backfill ou verificação amostral/periódica. Adicionar `size_bytes` e MIME à evidência operacional continua recomendado.

`src/app/(student)/app/certificados/[code]/pdf/route.ts` retorna `503` com `Retry-After` e não emite URL quando a metadata do objeto diverge, desaparece ou está indisponível. A ausência de metadata em legado retorna estado `unknown` e permanece permitida por compatibilidade até o backfill.

**Evidência externa:** a listagem read-only do bucket privado de Development encontrou objetos em `staging/certificates/`; o primeiro objeto legado inspecionado via `HeadObject` não possuía `sha256`. O comportamento de compatibilidade está, portanto, ativo em um caso real e não deve ser confundido com verificação forte.

### CERT-011 — P2 — Módulo central profundo demais

`src/features/certificates/server.ts` tem 1188 linhas e agrega elegibilidade, emissão manual, revogação, reemissão, consultas públicas/privadas, claim, fetch de assets, render, upload e reconciliação. O código ainda é legível, mas a concentração dificulta provar transições e favoreceu a inconsistência de reemissão. Separar por responsabilidade depois de adicionar testes de caracterização; não fazer refactor simultâneo às correções P0.

### CERT-012 — P2 — Rate limit usa resposta semanticamente incorreta

**Status atual:** ⏳ Pendente. A página ainda transforma limite excedido em `notFound()`; a correção para `429`/`Retry-After` requer uma superfície de resposta HTTP compatível com o App Router.

O limitador Postgres é atômico, durável e usa HMAC do IP, mas a página transforma limite excedido em `404`. Isso não envia `429` nem `Retry-After`, prejudica clientes legítimos, observabilidade e testes. Uma resposta genérica continua possível com status correto.

## Segurança e privacidade

### Controles aprovados

- autorização por objeto no PDF privado;
- URL assinada de cinco minutos;
- rota pública de PDF indisponível;
- código separado do ID e da chave R2;
- rate limit durável por IP sem persistir IP bruto;
- motivo livre de revogação nunca é público;
- uploads de Admin têm ownership do staging, limites, magic/decode e re-encode canônico;
- assets antigos só são limpos após carência e nova checagem de referências;
- novos PDFs carregam digest SHA-256 em metadata privada e o download bloqueia divergência;
- sem recursos remotos controlados pelo template durante render.

### Gaps

- novas emissões usam 128 bits brutos de UUIDv4; códigos legados continuam aceitos no lookup e requerem acompanhamento de migração;
- CDN/cache, sitemap e headers efetivos ainda precisam de verificação no ambiente-alvo;
- página pública sempre expõe nome e Curso a qualquer portador sem decisão jurídica concluída;
- não existe teste explícito inspirado em IDOR cross-course para assets/elementos, embora somente Admin global edite template hoje;
- constraints de ciclo de vida estão materializadas na migration 0056 e foram verificadas em staging; production ainda aguarda a promoção da cadeia.

## Concorrência, falhas e efeitos assíncronos

O desenho é adequado:

- emissão e outbox estão na mesma transação;
- índice parcial garante um válido por Aluna/Curso;
- worker reivindica mensagens com `SKIP LOCKED`;
- renderização lenta não mantém conexão/transaction abertas durante Sharp/PDFKit/R2;
- lease e fencing evitam worker antigo finalizando estado novo;
- chave determinística e upload `If-None-Match` evitam sobrescrita;
- revogação concorrente impede retorno a `ready` e o reconciliador remove órfão;
- dead-letter e reprocessamento auditado existem.

Gaps de prova:

- reemissões concorrentes;
- revogado reemitido posteriormente;
- colisão de código;
- fluxo real “última Aula -> conclusão -> render R2 -> e-mail” com serviços integrados;
- restore combinado Postgres + R2 e conferência de hash.

## UX e acessibilidade

### Pontos positivos

- operações destrutivas têm confirmação, categoria e detalhe;
- área da Aluna distingue pendente, pronto, falhou e revogado;
- verificador usa HTML semântico com `dl` e não oferece PDF;
- ações e links são elementos nativos com rótulos;
- E2E existente executa axe em superfícies do template.

### Gaps

- a reemissão agora aparece no último registro elegível, inclusive quando ele está revogado; permanecem pendentes apenas o smoke de concorrência real e o aceite operacional;
- erros esperados das operações manuais agora retornam estado tipado; falhas inesperadas continuam dependendo do boundary/telemetria de produção;
- editor controla estado sujo, mas não protege navegação contra perda de rascunho;
- textos de loading usam `...` em vez de `…`, detalhe não bloqueante;
- não houve inspeção visual em runtime por restrição explícita do projeto; a revisão de UI foi estática e por testes;
- acessibilidade do HTML não prova acessibilidade do PDF.

## Comparação com mercado e padrões atuais

Pesquisa completa: [`research/2026-08-07-certificate-production-best-practices.md`](../research/2026-08-07-certificate-production-best-practices.md).

### Moodle Workplace / Custom Certificate

- confirma demanda por templates, QR, código único, emissão manual e verificação;
- o changelog registra bugs reais de corrida, duplicidade, colisão e IDOR cross-course, incluindo CVE-2026-30884;
- o Hub está melhor alinhado ao preservar reemissão como nova evidência, em vez de regenerar o mesmo arquivo/código;
- falta ao Hub testar colisão e ownership contextual com a mesma agressividade.

### Open edX

- separa status de elegibilidade, disponibilidade e revogação;
- usa soft deletion/retenção e eventos assíncronos;
- mantém VC opcional e extensível;
- reforça a decisão do Hub de manter Postgres como autoridade, PDF como projeção e outbox como fronteira.

### Canvas Credentials / Open Badges 3.0

- emissão, consulta e revogação são operações distintas e escopadas;
- Open Badges 3.0 é útil para wallets/interoperabilidade, não requisito para este baseline;
- se adotado, deve ser projeção feature-flagged de snapshots e status, nunca segunda fonte de verdade.

### Padrões aplicáveis

- OWASP: autorização por objeto em todo acesso privado; token complexo é defesa em profundidade;
- RFC 9562: UUIDv4 oferece 122 bits aleatórios, mas não deve ser tratado como autorização;
- W3C/WCAG: texto real, idioma, ordem, tags e alternativa ao QR para acessibilidade de PDF;
- LGPD/ANPD: retenção depende de finalidade e contexto; não existe prazo universal;
- PDF/A, PDF/UA, PAdES e ICP-Brasil só entram com requisito explícito;
- Open Badges 3.0 e VC 2.0 são roadmap de interoperabilidade, não bloqueio do lançamento convencional.

## Cobertura de testes

### Forte

- regras, parser estrito de snapshot e template;
- determinismo de PDF/hash;
- normalização/crop de imagem;
- rate limit;
- asset cleanup/reconciliation;
- há suíte dedicada para emissão concorrente e render lease/fencing; a integração PostgreSQL real passou em branch Neon descartável;
- há cenários E2E para estados da área da Aluna, verificador público e ownership do download, mas o ambiente não estava disponível;
- formulário de template, crop, save/publish e axe.

### Faltante antes do GO

1. promoção oficial de 0055 e 0056 em production (staging 0056 já foi verificada) e verificação do journal/constraints;
2. smoke real com R2 privado, e-mail de staging e download assinado;
3. E2E de todas as alegações do PDF versus verificador;
4. extração de texto com dados extremos, QR decodificado do PDF final e teste físico;
5. restore/reconciliação DB+R2, backfill de metadata legada e validação de integridade;
6. verificação operacional de cache/CDN, sitemap e cron; `noindex` já está aplicado no código;
7. aceite jurídico da retenção, direitos, base legal e disclosure público;

## Verificações executadas

| Comando | Resultado |
| --- | --- |
| `bun run test -- src/features/certificates ...` | PASS: testes direcionados passaram; a suíte completa abaixo é a contagem autoritativa |
| `bun run test` | PASS: 234/234 arquivos; 1504/1504 testes |
| `bun typecheck` | PASS |
| `bun run build` | PASS: Next.js 16.2.11, páginas e rotas compiladas |
| `bun x ultracite check` | PASS: 667 arquivos verificados |
| `bun run docs:check` | PASS: 32 documentos canônicos |
| `bun run db:migrations:check` | PASS |
| `bun audit` | PASS: nenhuma vulnerabilidade encontrada |
| `bun run verify:quick` | PASS: migrations, typecheck, Ultracite e suíte completa |
| `bun run test:certificates:integration` | PASS: 4 arquivos; 27/27 testes em branch Neon descartável com SQL da 0056 aplicado; branch removida ao final |
| Neon MCP — schema/migration | PARCIAL: staging em 0056 com hash/constraints/FK verificados; production em 0054, faltam 0055/0056 |
| Cloudflare R2 API + S3 SDK — `HeadBucket`/`ListObjectsV2` read-only | PASS em Development privado/público e prefixo `staging/`; `GetBucketCors` sem permissão da chave |
| Vercel MCP + HTTP `curl` — deployments, build, runtime, health e verificador | PASS: deployments `READY`, build sem erro, sem erros agrupados nas rotas de certificado; `401` no health sem segredo e `404`/`noindex` para código inexistente |

Não executado:

- E2E completo com R2/e-mail reais, emissão, renderização, download, QR, revogação e reemissão; a suíte PostgreSQL usa mocks para R2/render/e-mail;
- restore/reconciliação DB+R2 e backfill dos artefatos legados;
- revalidação de CORS R2 com credencial administrativa;
- inspeção visual local: proibida pelas instruções do projeto;
- teste físico de PDF/QR e leitor de tela.

## Plano de saída para produção

### Fase 1 — Contratos centrais implementados; provas externas ainda pendentes

1. ✅ state machine de reemissão e UI corrigido;
2. ✅ código novo com 32 caracteres hexadecimais (16 bytes de UUIDv4), conflitos diferenciados e retry;
3. ✅ verificador com alegações comparáveis;
4. ✅ regressões unitárias adicionadas e 12/12 testes de emissão concorrente passaram em PostgreSQL real; E2E de artefato/R2/e-mail continua pendente.

**Gate:** nenhum predecessor revogado fica sem caminho de correção; código tem entropia aprovada; PDF adulterado é detectável por comparação.

### Fase 2 — Rastreabilidade e privacidade implementadas; verificação de ambiente pendente

1. ✅ save/publish/enable/disable de template auditados na mesma transação;
2. ✅ signatário por Curso, default global explícito e cargo renderizado;
3. ✅ resultados das Server Actions tipados;
4. ✅ path do Sentry redigido e `noindex,nofollow` aplicado; CDN/cache e sitemap ainda precisam de verificação;
5. ✅ constraints de estado e FK `RESTRICT` comprovados em branch descartável e staging; production ainda precisa da promoção oficial da migration; política jurídica de exclusão/arquivamento continua pendente.

**Gate:** toda mudança que afeta Certificados futuros é atribuível; nenhuma rota/telemetria vaza código desnecessariamente; estados inválidos são rejeitados no banco.

### Fase 3 — Provar o artefato e a operação

1. preflight de texto, extração, QR final e matriz de caracteres;
2. ✅ smoke PostgreSQL de emissão/outbox/worker passou em branch descartável; smoke com R2 e e-mail de staging ainda pendente;
3. teste de restore e reconciliação de hash;
4. alertas para backlog, render failed, lease expirado, órfãos e cron ausente;
5. ✅ resolver testes/lint/audit globais e integração PostgreSQL; integração de release em CI/staging continua pendente.

**Gate:** pipeline inteiro verde e falhas simuladas recuperáveis.

### Fase 4 — Aceite jurídico e release

1. aprovar finalidade, base legal, transparência e disclosure público;
2. aprovar matriz de retenção e direitos;
3. executar checklist de cron/env/ACL/domínio/QR;
4. canary com Certificado real controlado, revogação e reemissão;
5. registrar aceite de riscos residuais de acessibilidade do PDF.

**Gate:** evidência assinada por Produto/Operação/Privacidade; somente então alterar decisão para GO.

## Critérios objetivos de GO

- CERT-001, CERT-002 e CERT-003 encerrados com testes;
- política GOV-001 aprovada e refletida em produto/runbook;
- integração e E2E em ambiente isolado verdes;
- suíte completa, typecheck, Ultracite, migrations, build e dependency audit sem achado não aceito;
- staging prova conclusão, render, download, verificação, revogação, reemissão, e-mail e reconciliação;
- alertas e restore testados;
- nenhum PDF/asset público permanente;
- revisão humana de PDF, QR e acessibilidade concluída.

## Riscos aceitos ou não aplicáveis

- ausência de Open Badges/VC: aceitável sem consumidor real;
- ausência de PAdES/ICP-Brasil: aceitável sem requisito de verificação offline/força probatória;
- ausência de PDF/A: aceitável sem requisito arquivístico formal;
- exactly-once distribuído: não necessário; idempotência, constraints e reconciliação são suficientes;
- página pública sem PDF: decisão correta de minimização;
- renderização assíncrona: decisão correta; disponibilidade eventual é comunicada na área da Aluna.

## Conclusão

O módulo está arquiteturalmente próximo de produção, mas **não está pronto para produção**. Os bloqueios técnicos P0 do snapshot foram implementados; a emissão concorrente, outbox e workers passaram em PostgreSQL real (27/27 na suíte de integração), e staging recebeu/verificou a 0056. Permanecem governança jurídica/operacional, promoção de 0055/0056 em production, integração real R2/e-mail, E2E do artefato/QR, evidência de restore/reconciliação e uma superfície HTTP nativa para `429`/`Retry-After` no verificador.

Durante a implementação cautelosa, foram alterados arquivos do módulo, schema, migration, testes e documentação canônica. Mudanças não relacionadas já existentes na árvore foram preservadas. Nenhum commit ou push foi feito.
