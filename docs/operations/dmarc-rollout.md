---
status: runbook
owner: operations
last_verified_commit: 1c6062d6ce3e637be2e7521a66aed2ae2a17019f
---

# Progressão DMARC

## Estado

### Baseline histórico — 2026-08-25

O analisador local já estava implementado. Na fotografia de 25 de agosto,
Cloudflare (`1.1.1.1`) e Google (`8.8.8.8`) resolveram `p=none`, mas o TXT
ainda não declarava `rua`. Esse registro é mantido aqui como histórico e não
descreve mais o valor público atual.

### Estado atual — 2026-08-29T00:06:50Z

O registro publicado na Hostinger foi confirmado pelos dois resolvers:

```text
v=DMARC1; p=none; pct=100; rua=mailto:suporte@neurocapacitar.com.br; adkim=r; aspf=r; ri=86400
```

Esse horário inicia a janela de observação de 14 dias do primeiro estágio,
com término previsto para `2026-09-12T00:06:50Z` (aproximadamente
11/09/2026 às 21:06 no horário de São Paulo). A publicação e a propagação
estão confirmadas; `F-006` continua aberto até analisar relatórios suficientes
e concluir todas as etapas até `reject; pct=100`.

Antes de qualquer mudança, repetir a resolução e guardar somente o valor/TTL,
sem anexar XML, headers ou e-mail bruto:

```powershell
Resolve-DnsName -Server 1.1.1.1 -Type TXT _dmarc.neurocapacitar.com.br
Resolve-DnsName -Server 8.8.8.8 -Type TXT _dmarc.neurocapacitar.com.br
```

### Revalidação externa — 2026-08-29T19:49:38Z

Os dois comandos acima foram executados contra os resolvers públicos e
retornaram o mesmo TXT publicado, com `p=none`, `pct=100`, `rua` institucional,
`adkim=r`, `aspf=r` e `ri=86400`. A propagação está consistente, mas essa
consulta não substitui os relatórios agregados: a janela inicial continua
aberta até `2026-09-12T00:06:50Z` e nenhuma progressão de política foi feita.

### Decisão de adiamento — 2026-08-29

A progressão foi explicitamente adiada pelo responsável. O registro continua
em `p=none; pct=100`; isso não autoriza saltar etapas nem fecha `F-006`.
Retomar exige janela completa, análise dos relatórios agregados e autorização
para o valor exato do próximo TXT.

## Coleta e análise gratuita

Use a caixa institucional definida em `rua`. Baixe anexos agregados XML, gzip ou
zip para `.dmarc-reports/`, diretório ignorado pelo Git. Não encaminhe e-mail
bruto, XML, headers ou endereço de destinatário para chat, issue ou commit.

```powershell
bun run ops:analyze:dmarc -- .dmarc-reports/report-1.xml .dmarc-reports/report-2.xml.gz
```

O parser limita entrada a 2 MiB, expansão a 10 MiB e razão a 100×; rejeita ZIP
com múltiplos arquivos, XML malformado, `DOCTYPE` e `ENTITY`. A saída contém
somente organização emissora, ID/intervalo do relatório, source IP, contagem,
disposição e alinhamento SPF/DKIM. Relatórios repetidos são deduplicados por
organização e ID.

## Registro recomendado

```text
v=DMARC1; p=<policy>; pct=<percent>; rua=mailto:<caixa-institucional>; adkim=r; aspf=r; ri=86400
```

Não configurar `ruf`. Preserve um único TXT em `_dmarc.neurocapacitar.com.br`.

## Estágios obrigatórios

1. `p=none; pct=100` por 14 dias completos;
2. `p=quarantine; pct=25` por 72 horas;
3. `p=quarantine; pct=100` por 7 dias;
4. `p=reject; pct=25` por 72 horas;
5. `p=reject; pct=100` por pelo menos 7 dias.

Antes de cada mudança, inventarie fontes legítimas, registre valor/TTL anterior,
reduza TTL com antecedência, confirme SPF/DKIM e obtenha autorização humana para
o valor exato. Depois, consulte ao menos dois resolvers e observe relatórios,
bounce e complaint. Avance somente sem falha legítima inexplicada e depois de
toda a janela.

## Rollback e STOP

Falha de remetente legítimo exige retorno imediato ao estágio anterior,
restauração do `pct`, registro da causa e reinício integral da janela. Nunca
pule de `none` para `reject`, não use serviço pago recorrente e não feche
`F-006` antes de sete dias estáveis em `reject; pct=100`.
