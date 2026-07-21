---
status: accepted
owner: product
last_verified_commit: 7f536570d38eefface3a6c54092c7acc6f3c0fac
---

# ADR-0008: analytics de aprendizagem opcional e reengajamento manual

## Contexto

O Hub precisava identificar aula com falha ou baixa continuidade sem transformar o uso da Aluna em perfil comportamental. Não existe parecer jurídico formal que autorize uma coleta ampla ou campanhas automáticas.

## Decisão

Analytics é opcional, depende de consentimento explícito e revogável e coleta somente eventos de aprendizagem definidos: início, checkpoint em faixa de 10%, conclusão, falha de material e falha de player. O cliente nunca informa `userId`; o servidor deriva Conta, Matrícula e `CourseVersion` da sessão e do acesso autorizado.

Eventos brutos ficam por 90 dias. Métricas agregadas podem ficar por 13 meses. Dados de reengajamento manual ficam por 180 dias. A retenção programada exige ativação operacional e ratificação jurídica antes de apagar registros.

"Sem atividade registrada há 14 dias" é um filtro operacional, não diagnóstico de desinteresse. Somente Admin pode registrar uma iniciativa manual, individual, auditada, com intervalo mínimo de 30 dias. Não há disparo automático, segmentação preditiva ou uso de conteúdo de comentários.

## Consequências

Métricas exibem versão curricular e distinguem elegibilidade, início, conclusão e erro. `lesson_progress` continua a fonte de verdade da conclusão; analytics não muda acesso, progresso ou certificado. A implementação não afirma conformidade LGPD: a política e a base jurídica precisam de ratificação jurídica formal antes de qualquer ampliação.

## Alternativas rejeitadas

- Coleta automática por interesse legítimo: exigiria avaliação jurídica e transparência que o projeto ainda não possui.
- Replay, IP, user agent, comentário ou texto assistido: desnecessários para as ações definidas.
- E-mail automático após inatividade: aumenta risco de contato indevido e não prova benefício pedagógico.
