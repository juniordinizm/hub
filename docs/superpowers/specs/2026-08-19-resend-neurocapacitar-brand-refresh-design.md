---
status: accepted
owner: design-and-engineering
last_verified_commit: cf6a129
---

# Refresh visual das templates de email Neuro Capacitar

## Objetivo

Transformar as seis templates hospedadas no Resend em uma família visual
coerente com o PROTEA-R Hub e com a marca proprietária Neuro Capacitar. A
mudança será editorial e visual: o Hub continuará responsável pelo envelope,
destinatário, assunto, URLs, idempotência e variáveis; o Resend continuará
responsável pelo HTML, plain text e publicação da versão editorial.

O resultado precisa parecer uma extensão do produto, não um email genérico:
logo presente, paleta reconhecível, hierarquia de conteúdo, blocos de contexto,
CTA com acabamento e variações semânticas para segurança, acesso, venda,
certificado, expiração e suporte.

## Evidências de branding utilizadas

- Logo oficial: `public/protear/logo-negativo.svg`.
- Fundo principal do produto: `#0f2224`.
- Superfície/card: `#162b2d` no produto e branco nas superfícies de leitura.
- Teal primário: `#326c71`.
- Teal secundário: `#234e52`.
- Laranja de acento: `#d97b34`.
- Texto claro: `#e8f0f0`.
- Texto muted: `#7fa8aa`.
- Superfície clara já usada nos emails legados: `#f7f3ef`.
- Borda quente: `#eadfd8`.
- Tipografia do Hub: Lexend Deca; nos emails será usado `Arial, Helvetica,
  sans-serif` como fallback seguro, sem carregar fonte remota.

O logo será referenciado por URL HTTPS absoluta e pública:
`https://app.neurocapacitar.com.br/protear/logo-negativo.svg`. O HTML terá
`alt="PROTEA-R"`, dimensões explícitas e `display:block` para clientes de email.

## Direção visual aprovada

### Shell compartilhado

Cada template repetirá o mesmo shell porque o editor Hosted do Resend não
oferece um componente compartilhado local:

1. canvas externo creme (`#f7f3ef`), com espaçamento amplo;
2. faixa superior escura (`#0f2224`) com detalhe/linha de acento laranja;
3. logo oficial branca, alinhada à esquerda e com largura controlada;
4. card central branco, largura máxima de aproximadamente 600px, raio e sombra
   sutis;
5. label editorial pequena em teal/laranja, headline com peso e line-height
   controlados;
6. corpo com measure confortável e parágrafos curtos;
7. bloco de destaque quando houver curso, prazo, código ou dados de suporte;
8. CTA teal com texto branco e área de toque confortável;
9. rodapé discreto com “Neuro Capacitar · PROTEA-R Hub” e suporte quando
   relevante.

O desenho deve ser elegante por contraste, espaçamento e composição, sem
gradientes, animações ou efeitos que prejudiquem Outlook/Gmail. O dark teal
será usado como marca e moldura; o conteúdo continuará claro para leitura.

### Tipografia e ritmo

- corpo principal entre 16px e 17px, line-height entre 1.5 e 1.6;
- headline entre 28px e 32px, line-height próximo de 1.1;
- eyebrow/label em 11px–12px, uppercase apenas via estilo, com letter-spacing
  positivo;
- destaque numérico de expiração com fonte maior e `font-variant-numeric:
  tabular-nums`;
- links secundários sempre sublinhados ou visualmente identificáveis;
- copy em português natural, sem substituir acentos por ASCII.

### Compatibilidade de email

- HTML completo com `DOCTYPE`, `html`, `head` e `body`;
- layout baseado em tabelas;
- estilos inline;
- sem fontes externas, CSS moderno obrigatório, JavaScript, formulários ou
  background images;
- imagens com URL absoluta, `alt`, `width`, `height`, `border="0"` e
  `display:block`;
- `bgcolor` junto de `background-color` nas células relevantes;
- plain text equivalente ao conteúdo principal e aos links;
- todos os valores inseridos pelas variáveis continuam escapados pelo motor do
  Resend.

## Tratamento por template

| Alias | Tratamento visual e editorial |
| --- | --- |
| `auth-password-reset` | Estado de segurança: label “SEGURANÇA DA CONTA”, headline forte, texto curto, CTA “Criar nova senha” e aviso de expiração em painel suave. |
| `access-released` | Estado positivo: label “SEU ACESSO ESTÁ PRONTO”, card de curso em teal claro, CTA principal “Acessar curso” e link secundário de recuperação. |
| `access-expiry-warning` | Estado de atenção: acento laranja, bloco numérico grande para `DAYS_REMAINING`, explicação objetiva e CTA para continuar o curso. |
| `course-sales-opened` | Estado de anúncio: acento laranja/teal, bloco de curso destacado, copy de retorno do interesse e CTA “Conhecer o curso”. |
| `certificate-issued` | Estado de conquista: selo/linha de reconhecimento em teal, código do certificado em painel monoespaçado discreto e CTA “Ver e validar certificado”. |
| `support-request` | Estado operacional: label “NOVA SOLICITAÇÃO”, resumo visual com nome, email, curso e assunto, mensagem em painel de leitura e resposta apontando para a aluna. |

## Contratos que não mudam

- aliases canônicos permanecem idênticos;
- variáveis permanecem exatamente as documentadas em
  `docs/integrations/resend-templates.md`;
- `from`, `replyTo` e assunto enviados pelo Hub não serão substituídos por
  valores editoriais incompatíveis;
- nenhuma URL será criada no template;
- nenhuma versão será publicada antes de validar variáveis, HTML, plain text e
  renderização por envio controlado;
- uma atualização do draft será seguida de publicação explícita no Resend;
- o checker existente continuará sendo a verificação estrutural do catálogo.

## Critérios de aceitação

1. As seis templates publicadas exibem a logo PROTEA-R e a paleta Neuro
   Capacitar de forma consistente.
2. Cada template possui uma composição visual própria, sem perder a família
   compartilhada.
3. O conteúdo continua legível em largura móvel e desktop, com contraste
   suficiente e CTA identificável.
4. HTML e plain text não deixam placeholders sem resolver quando testados com
   payloads controlados.
5. O checker aceita status publicado, aliases, variáveis, envelope e conteúdo.
6. Um novo smoke test enviado para a caixa controlada confirma remetente,
   `Reply-To`, links, HTML, plain text e estado `delivered`.

## Fora de escopo

- alteração do contrato server-side;
- criação de logos ou ilustrações novas;
- mudança de domínio, remetente, ambiente ou Team Resend;
- alteração das jornadas de autenticação, compra, acesso, certificado ou
  suporte;
- remoção imediata do renderer legado em `templates.tsx`.
