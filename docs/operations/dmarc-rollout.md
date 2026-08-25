---
status: runbook
owner: operations
last_verified_commit: 36019cf0a609a7283046d71c694f16d8afd6fec3
---

# Progressão DMARC

## Estado

O analisador local está implementado. A progressão DNS ainda não começou neste
registro e `F-006` permanece aberto. Nenhuma política pode ser avançada sem
janela completa, relatórios suficientes e confirmação humana.

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
