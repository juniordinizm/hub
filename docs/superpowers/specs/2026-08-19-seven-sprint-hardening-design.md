---
status: proposed
owner: engineering
last_verified_commit: cf6a129
---

# Hardening incremental em sete sprints

## Objetivo

Reduzir os riscos comprovados de operação, autorização, escala administrativa,
identidade e segurança privilegiada sem introduzir CourseOffering, multitenancy,
fila externa ou reescritas amplas antes de demanda ou evidência.

## Escopo aprovado

1. Estado de release e documentação verificável.
2. Isolamento do Neon para CI e limpeza segura de branches.
3. Policy canônica de acesso a conteúdo e cobertura da rota de acesso.
4. Paginação e projeção limitada no Admin.
5. Identidade de e-mail com política explícita e auditoria de colisões.
6. Prova operacional de observabilidade e recuperação.
7. Autenticação reforçada para Admin/Suporte, após definir recovery.

Cada sprint será uma fatia reversível, com teste RED antes de produção, documentação
na mesma mudança e verificação local. Nenhum sprint pode alterar o comportamento de
pagamento, matrícula ou certificado sem teste de regressão correspondente.

## Fora de escopo nesta sequência

CourseOffering/coortes, avaliações, assignments, subscriptions, SCORM, worker
separado, multitenancy e decomposição estrutural ampla. Esses itens permanecem
condicionados a demanda, métricas ou decisão de produto.

## Princípios de segurança

- CI nunca deve clonar nem migrar o banco de Production.
- A rota pública de certificado continua independente do bloqueio de conta.
- A normalização de e-mail preserva o valor original e não presume regras de todos os provedores.
- Paginação não será adicionada sem confirmar ordenação, cursor e índice.
- MFA exige recovery testado antes de enforcement obrigatório.

## Critério de passagem entre sprints

O sprint só avança quando os testes focais, typecheck, lint, documentação e diff
passarem; integração PostgreSQL, Browser e Build permanecem gates de CI quando
dependem de secrets ou providers externos.
