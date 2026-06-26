# Hub

This context defines the product language for paid course access and student enrollment management.

## Language

**Acesso pago**:
O acesso a um curso criado a partir de um pagamento confirmado pelo AbacatePay. Ele pode ter ajustes de prazo, mas nao nasce manualmente.
_Avoid_: Matricula manual, acesso falso

**Expiracao original**:
A data de fim calculada quando o pagamento libera o curso. Ela deve preservar o que foi vendido naquele pagamento.
_Avoid_: Expiracao atual, prazo ajustado

**Expiracao atual**:
A data que vale hoje para o acesso do aluno, depois de ajustes feitos pelo suporte.
_Avoid_: Expiracao original

**Acesso do aluno**:
A situacao atual de um aluno em um curso: ativo, expirado ou bloqueado.
_Avoid_: Fonte da verdade

**Ajuste de prazo**:
Uma mudanca feita pelo suporte na expiracao atual de um acesso pago. Pode aumentar ou reduzir o prazo, mas nao cria acesso por si so.
_Avoid_: Matricula manual

**Bloqueio manual**:
Uma acao do suporte que impede o aluno de acessar um curso ja pago quando o estado do pagamento ou uma excecao operacional precisa ser corrigida manualmente.
_Avoid_: Excluir matricula, reembolso manual

**Bloqueio da plataforma**:
Uma acao do suporte que impede o aluno de usar a plataforma inteira, independentemente dos cursos que ele possui.
_Avoid_: Bloqueio de curso
