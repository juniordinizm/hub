> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Fluxos ponta a ponta observados

## Compra e concessão

Checkout público aplica limite local por IP+curso e envia metadata ao AbacatePay (`payments/public-checkout.ts:94-165`). Webhook assinado cria evento, resolve curso/usuária, atualiza pedido, grant e matrícula na transação; e-mail é tentado depois (`payments/server.ts:595-745`). Duplicidade do mesmo evento é idempotente por índice. Falha parcial: comunicação por e-mail não é entregue porque o adaptador atual é no-op.

## Acesso à aula e materiais

Página/handler recebe sessão; para student, `getStudentLessonData` exige grant/matrícula ativa, janela temporal, curso/módulo/aula ativos e sequência (`courses/server.ts:857-925`). Download/preview repetem a consulta, portanto URL direta não é bypass confirmado.

## Progresso e certificado

Clique manual conclui aula; player também marca em 95%/fim. A conclusão revalida o acesso e cria progresso idempotente; a última aula tenta inserir um certificado único e e-mail pós-commit (`courses/server.ts:1088-1198`). Concorrência pode duplicar comunicação, não certificado.

## Operação

Cron de matrícula expira grants e envia avisos; sem lock de reserva do aviso, execução concorrente pode duplicar e-mail (`enrollments/maintenance.ts:28-140`). Cron JMVStream reconcilia vídeo pendente. Ambos dependem de configuração externa não verificada.

## Suporte

Student autenticada envia assunto/mensagem/nome/e-mail a `SUPPORT_EMAIL` via e-mail (`app/(student)/app/actions.ts:101-124`). Não há ticket, retenção, classificação de conteúdo sensível ou aviso para não enviar dados de pacientes.

## Falhas, compensação e rastreio

| Fluxo | Falha/compensação observada | Auditoria/testes |
| --- | --- | --- |
| Webhook | evento é registrado; duplicado é ignorado; erro fica como falho | mapping, assinatura e contratos SQL; sem integração real/concorrência |
| Refund/disputa | grant fonte é revogado e projeção é reconstruída | regras/contratos SQL; sem evento fora de ordem |
| Expiração | cron recalcula status; aviso é marcado após tentativa de e-mail | risco de aviso duplicado em concorrência |
| Upload JMV | status pendente/falha e sync manual/cron | testes do client/upload; serviço real não chamado |
| Certificado | certificado único sobrevive à corrida; e-mail é pós-commit | unitário de regra; sem teste concorrente/PDF público |
| Recurso R2 | URL assinada com prazo; ação de deleção lança em erro de lote | testes de objetos/chave; bucket não verificado |

Timezone: timestamps usam `timestamp with time zone`; a origem de calendário, timezone de negócio e política de arredondamento de expiração não estão documentadas. Percentual de curso arredonda com `Math.round`; watch position também normaliza para inteiros (`src/features/progress/rules.ts:23-112`).
