---
status: proposed
owner: engineering
last_verified_commit: e34e556581494ac7e75a2dc3c494a735d8208dee
---

# Pesquisa: política de fuso horário do Hub

## Conclusão executiva

Adotar duas regras distintas:

1. **Persistência:** guardar instantes em UTC (o schema atual usa
   `withTimezone: true`), nunca um horário local sem fuso.
2. **Apresentação:** formatar horários do produto sempre com o fuso fixo
   `America/Sao_Paulo` e uma opção explícita `timeZone`.

Não usar o fuso implícito do processo, a região da Function da Vercel ou a
localização aproximada do IP como contrato de apresentação. O comportamento atual
já segue essa direção: `src/lib/formatters.ts` informa `timeZone: "America/Sao_Paulo"`,
e `src/db/schema.ts` define os timestamps com `withTimezone: true`.

## Evidência primária

### ECMA-402 (`Intl.DateTimeFormat`)

- O algoritmo de `Intl.DateTimeFormat` usa `SystemTimeZoneIdentifier()` quando a
  opção `timeZone` é omitida. Portanto `new Intl.DateTimeFormat("pt-BR")` depende do
  fuso do host, não do usuário nem da região geográfica da requisição.
- Quando fornecido, `timeZone` é um identificador de fuso IANA (por exemplo,
  `America/Sao_Paulo`) e passa por canonicalização/validação; um identificador
  inválido causa `RangeError`.
- Implementações com suporte a fuso usam a base IANA, inclusive suas regras de
  transição. Uma zona nomeada é preferível a fixar `-03:00`.

Fontes: [ECMA-402, `Intl.DateTimeFormat`](https://tc39.es/ecma402/#sec-intl.datetimeformat),
[ECMA-402, uso da base IANA](https://tc39.es/ecma402/#sec-use-of-the-iana-time-zone-database),
[ECMA-262, `SystemTimeZoneIdentifier`](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-system-time-zone-identifier).

### ECMAScript `Date`

Um valor de tempo ECMAScript representa um instante com época em UTC; `Date.now()`
retorna o instante UTC e `Date.prototype.toISOString()` serializa na escala UTC com
o sufixo `Z`. Isso torna instantes/ISO-8601 UTC apropriados para contratos e
persistência, deixando a conversão para a camada de apresentação.

Fonte: [ECMA-262, valores de tempo e `Date`](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-time-values-and-time-range),
[`Date.prototype.toISOString`](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-date.prototype.toisostring).

### Node.js

O Node documenta `TZ` como a configuração do fuso do processo e suporta
identificadores IANA básicos, como `Etc/UTC` e `America/New_York`; abreviações e
aliases não são garantidos. Assim, mudar `TZ` pode mudar o resultado de APIs que
dependem do fuso local, mas não substitui uma opção `timeZone` explícita para uma
interface determinística.

Fonte: [Node.js CLI, `TZ`](https://nodejs.org/api/cli.html#tz).

### Vercel

- Functions Node.js são executadas em regiões configuráveis (novos projetos usam
  `iad1` por padrão; failover pode mudar a região). Região é localização de
  computação, não fuso do usuário.
- Edge Functions podem executar perto da requisição e também mudar de região; isso
  não cria um fuso de usuário confiável.
- O header `x-vercel-ip-timezone`, quando disponível, é o fuso estimado para o IP
  público do requisitante. É uma pista de geolocalização, não uma preferência
  persistida do usuário.
- Os Runtime Logs da Vercel exibem horários em UTC, independentemente da região.

Fontes: [regiões das Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region),
[runtime Node.js](https://vercel.com/docs/functions/configuring-functions/runtime),
[header `x-vercel-ip-timezone`](https://vercel.com/docs/headers/request-headers),
[Runtime Logs (UTC)](https://vercel.com/docs/logs/runtime),
[Edge Runtime](https://vercel.com/docs/functions/runtimes/edge).

## Política recomendada

### Armazenamento e contratos

- Criar e persistir `Date`/timestamps como instantes; serializar em ISO-8601 UTC
  (`...Z`) nas APIs e eventos.
- Manter `withTimezone: true` nos timestamps do schema atual. Campos civilmente
  definidos, como uma data de relatório (`metricDate`), permanecem datas sem horário
  e não devem ser convertidos silenciosamente para UTC.
- Ao receber um horário civil digitado por uma pessoa, interpretar esse valor em
  `America/Sao_Paulo` (ou no fuso explicitamente escolhido), convertê-lo para um
  instante e só então persistir.

### Apresentação

- Centralizar formatadores com `locale: "pt-BR"` e
  `timeZone: "America/Sao_Paulo"` para páginas, e-mails, certificados e mensagens
  administrativas.
- Evitar `Date#toString`, `Date#toLocaleString` ou `Intl.DateTimeFormat` sem
  `timeZone` em saída user-facing ou em lógica de negócio.
- Testar formatadores com `TZ=UTC` e outro fuso para revelar dependências acidentais
  do host. `TZ` é útil para testes; não é a política de produto.

### O que não fazer

- Não selecionar uma região Vercel no Brasil para “corrigir” o fuso; isso só trata
  latência e disponibilidade.
- Não derivar a preferência definitiva de fuso do `x-vercel-ip-timezone`; proxies,
  VPNs e usuários viajando tornam essa estimativa inadequada como dado de perfil.
- Não usar offsets fixos (`-03:00`) no lugar de `America/Sao_Paulo`, pois a zona
  nomeada carrega as regras IANA vigentes.

Se o produto passar a oferecer fuso por pessoa, adicionar uma preferência explícita
validada contra identificadores IANA, usar `America/Sao_Paulo` como fallback e manter
UTC para armazenamento. Até lá, a política fixa acima é a decisão recomendada.
