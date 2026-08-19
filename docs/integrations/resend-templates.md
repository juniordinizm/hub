---
status: canonical
owner: engineering
last_verified_commit: cf6a129
---

# Catálogo de templates do Resend

## Topologia

O Hub usa o Team Resend já conectado e o domínio verificado
`neurocapacitar.com.br`. Existe um único catálogo de templates; Development,
Staging e Production usam os mesmos aliases. Não criar cópias por ambiente.

O Hub continua responsável por destinatário, allowlist, `from`, `replyTo`,
subject inicial, URLs, variáveis, idempotência e regras de negócio. O Resend é
responsável pelo markup, plain text gerado, preview e versionamento editorial.

## Identidade visual

As seis templates pertencem à mesma família Neuro Capacitar/PROTEA-R. O shell
editorial usa canvas creme, faixa teal escura, acento laranja, card claro,
CTA teal e rodapé institucional. Cada alias acrescenta uma variação semântica:
segurança da conta, acesso liberado, atenção à expiração, abertura de vendas,
conquista de certificado ou solicitação operacional de suporte.

O asset oficial da marca é `public/protear/logo-negativo.svg`, referenciado no
HTML Hosted por URL HTTPS absoluta:
`https://app.neurocapacitar.com.br/protear/logo-negativo.svg`. O HTML sempre
deve incluir `alt="PROTEA-R"`, dimensões explícitas, `border="0"` e
`display:block`. Não usar ngrok, localhost, bucket Development, data URI ou
fonte externa como dependência da identidade visual compartilhada.

A paleta editorial deriva do Hub: `#0f2224` (teal escuro), `#326c71` (teal
primário), `#234e52` (teal secundário), `#d97b34` (laranja), `#e8f0f0`
(texto claro), `#7fa8aa` (muted), `#f7f3ef` (canvas), `#eadfd8` (borda quente)
e `#17292b` (texto principal). O corpo usa fallback seguro
`Arial, Helvetica, sans-serif`; não carregar Lexend remotamente em email.

Antes de uma publicação ou promoção, verificar que a URL pública da logo não
retorna erro e que clientes sem carregamento de imagens ainda exibem o
wordmark pelo `alt` e pela composição textual do cabeçalho. Se a aplicação
estiver em manutenção e o asset retornar `503`, corrigir a disponibilidade do
asset antes de declarar a renderização visual como homologada.

Staging compartilha a estrutura Resend, mas a aplicação exige
`STAGING_EMAIL_RECIPIENT_ALLOWLIST` antes de renderizar ou chamar o provider.

## Aliases e estado atual

Os seis templates foram criados e publicados em 2026-08-19 pela integração
Resend, depois da validação estrutural e de variáveis. Nenhuma versão posterior
está em draft nesta etapa.

| Nome lógico | Alias | Estado |
|---|---|---|
| `auth-password-reset` | `auth-password-reset` | published |
| `access-released` | `access-released` | published |
| `access-expiry-warning` | `access-expiry-warning` | published |
| `certificate-issued` | `certificate-issued` | published |
| `course-sales-opened` | `course-sales-opened` | published |
| `support-request` | `support-request` | published |

Os IDs do Resend não são necessários no runtime e não devem ser espalhados pelo
código. O adapter resolve o alias canônico pelo nome lógico.

## Contrato de variáveis

| Template | Variáveis |
|---|---|
| `auth-password-reset` | `USER_NAME`, `ACTION_URL` |
| `access-released` | `USER_NAME`, `COURSE_TITLE`, `ACTION_URL`, `PASSWORD_RESET_URL` |
| `access-expiry-warning` | `USER_NAME`, `COURSE_TITLE`, `DAYS_REMAINING`, `ACTION_URL` |
| `certificate-issued` | `USER_NAME`, `COURSE_TITLE`, `CERTIFICATE_CODE`, `ACTION_URL` |
| `course-sales-opened` | `USER_NAME`, `COURSE_TITLE`, `ACTION_URL` |
| `support-request` | `STUDENT_NAME`, `STUDENT_EMAIL`, `COURSE_TITLE`, `SUPPORT_SUBJECT`, `MESSAGE` |

`DAYS_REMAINING` é uma string já formatada como `1 dia` ou `7 dias`. O suporte
usa fallback `Não informado` para `COURSE_TITLE`; `MESSAGE` fica limitado pelo
Hub a 1.800 caracteres e demais strings não ultrapassam 2.000 caracteres.

`ACTION_URL`, `PASSWORD_RESET_URL` e o link público do certificado são sempre
construídos no Hub. Nenhum token é criado, persistido ou derivado no template.

## Ownership do envelope

- `from`: `RESEND_FROM_EMAIL`, controlado pelo Hub;
- `to`: derivado pelo Hub;
- `replyTo`: `SUPPORT_EMAIL` por padrão e e-mail da aluna no suporte;
- `subject`: enviado pelo Hub durante a migração para preservar paridade;
- conteúdo e plain text: Resend;
- alias: catálogo server-only.

O payload Hosted não pode misturar `template` com `html`, `text` ou `react`.

## Workflow editorial

1. editar o draft no Resend;
2. testar com variáveis controladas;
3. revisar HTML, plain text, subject, links e conteúdo fornecido pela aluna;
4. publicar somente após os testes locais e o checker;
5. tratar `has_unpublished_versions` como warning enquanto houver uma versão publicada válida;
6. depois de um revert, testar e publicar o novo draft antes de reprocessar a outbox.

Publicação é uma ação externa e não deve ser executada automaticamente pelo
build, typecheck ou lint.

## Checker manual

O checker é uma operação explícita e somente leitura contra a API administrativa
do Resend. Configure `RESEND_TEMPLATES_ADMIN_API_KEY` apenas no shell da
execução e rode:

```bash
bun run check:resend-templates -- --environment=production
```

O teste local sem rede do checker fica em `src/tooling` para ser descoberto pela
configuração do Vitest:

```bash
bun run test -- src/tooling/check-resend-templates.test.ts
```

Também são aceitos `development` e `staging`; os três ambientes resolvem os
mesmos seis aliases. A chave é lida somente quando esse comando é executado e
não faz parte de `getServerEnv` nem do runtime web. O checker não publica drafts,
não roda no build, `check` ou `typecheck` e não imprime HTML, valores de
variáveis, chave ou PII.

Status, alias, data de publicação, variáveis, conteúdo e envelope incompatíveis
terminam com exit code `1`. `has_unpublished_versions=true` é apenas warning e
mantém exit code `0` quando a versão publicada também passa no contrato.
