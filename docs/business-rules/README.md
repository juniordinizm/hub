# Governança de regras de negócio

## Autoridade documental

1. Decisões aprovadas em `decision-register.md` definem o TO-BE.
2. `discovery/` registra somente evidência AS-IS; não cria regra de produto.
3. Código, migrations e testes demonstram a implementação corrente, mas não substituem decisão aprovada.
4. Documentos históricos devem declarar seu status e apontar para esta pasta.

## Estados permitidos

- `AS-IS CONFIRMADO`: comportamento evidenciado.
- `AS-IS PARCIAL`: comportamento observado com lacunas.
- `PROPOSTA`: ainda sem aprovação.
- `DECIDIDO`: regra aprovada, ainda não necessariamente implementada.
- `IMPLEMENTADO`: regra decidida, implementada e verificada.
- `BLOQUEADO`: depende de decisão, requisito legal ou infraestrutura externa.
- `NÃO APLICÁVEL`: domínio não faz parte do produto atual.

Cada alteração de regra deve registrar: identificador, fonte de autoridade, responsável, data, impacto em dados/API/UI/jobs e evidência de verificação.

## Convenções

- IDs de descoberta usam `*-DISC-*`.
- IDs de decisão usam `DEC-DISC-*`.
- Evite renomear conceitos de domínio sem uma decisão vinculada.
- Todo texto que não for AS-IS confirmado deve declarar se é proposta, decisão ou histórico.
