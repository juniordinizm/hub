> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Perguntas abertas materiais

1. Concluir aula por clique é a regra final ou vídeo assistido deve ser obrigatório?
2. Nova compra deve remover bloqueio manual de curso?
3. Qual transição vence quando webhook pago, refund e disputa chegam fora de ordem?
4. O valor pago deve corresponder exatamente ao preço/snapshot para conceder acesso?
5. Como preservar progresso, certificado e carga horária quando conteúdo publicado muda?
6. Certificado continua válido após refund/disputa? Há revogação e reemissão?
7. Qual retenção/exclusão/anonimização atende compras, certificados, suporte e logs?
8. Quais dados podem ser enviados ao suporte e como prevenir dados de pacientes?
9. Qual nível WCAG 2.2, legenda/transcrição e acessibilidade de PDF são requisito?
10. As URLs canônicas de auth/app são obrigatórias em todos os deploys?
11. Qual provedor/garantia operacional entrega e-mails, retry e rastreio?
12. A plataforma precisa validar identidade por e-mail antes de login/acesso?

## Perguntas que a inspeção resolveu

| Pergunta candidata | Evidência/resposta atual |
| --- | --- |
| Há uma matrícula por conta/curso? | Sim, índice único em `enrollments`; grants podem ser múltiplos por user/course se vierem de pedidos distintos. |
| Evento duplicado cria acesso duplicado? | Mesmo `event_key` não; índice e `ON CONFLICT` comprovam. |
| A URL direta ignora sequência? | Não para os handlers/página que usam `getStudentLessonData`. |
| A conclusão depende só de vídeo? | Não: clique manual basta; vídeo pode concluir em 95%/fim. |
| Acesso é vitalício? | Não como padrão: curso tem duração de acesso positiva, padrão de 12 meses. |
| Há matrículas manuais? | O modelo de grant aceita somente origem `abacatepay_order`; support ajusta/bloqueia a projeção, não cria grant manual observado. |
| Há suporte/ticket persistente? | Não foi localizada tabela de ticket; mensagem tenta ser encaminhada por e-mail. |
| Há status de certificado revogado? | Não foi localizado. |
