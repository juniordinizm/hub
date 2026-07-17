> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Invariantes preliminares

| Invariante | Situação | Local de proteção | UI basta? | Servidor | Banco | Teste localizado | Concorrência/impacto | Recomendação preliminar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Matrícula pertence a uma conta e curso | confirmado | `enrollments` | não | cria/projeta matrícula | unique user+course | contrato SQL | baixo para duplicata; projeção serial não provada | manter constraint e testar projeções concorrentes |
| Grant por pedido fonte é único | confirmado | `enrollment_grants` | não | webhook cria grant | unique source | unitário/SQL | reduz duplicata do mesmo pedido | manter e testar retry real |
| Evento repetido não reaplica efeito | parcial | `webhook_events` | não aplicável | conflito ignorado | unique provider key | unitário | não cobre eventos diferentes fora de ordem | definir precedência e serialização por pedido |
| Sem direito ativo não há aula/material | confirmado | guard de entitlement | não | `getStudentLessonData` | não é RLS | contrato de acesso | depende de aplicação; RLS está desligado | manter guard e cobrir URL direta/E2E |
| URL direta não contorna sequência | confirmado | regra de sequência | não | `getStudentLessonData` | não é RLS | `progress/rules` | múltiplas abas não cobertas | teste integrado com próxima aula |
| Progresso pertence à aluna e aula corretas | confirmado | progress/watch progress | não | sessão e ownership | unique user+lesson, FKs | regras puras/SQL | última escrita não avaliada | teste de múltiplas abas/dispositivos |
| Conclusão repetida não duplica certificado | parcial | emissão transacional | não | regra de emissão | unique user+course e code | certificado | e-mail pode duplicar; corrida não medida | outbox/idempotência para efeitos externos |
| Refund não reabre acesso por evento tardio | ausente | nenhuma serialização localizada | não aplicável | leitura/escrita por evento | unicidade não ordena eventos | nenhum cenário concorrente | P1: conteúdo pode ser reativado | decidir máquina monotônica e lock/transação |
| Reversão preserva ajuste posterior | ausente | histórico insuficiente | não | restauração cega | FK; sem estado exclusivo de reversão | não localizado | P1: expiração pode retroceder | modelar reversão e testar cadeia |
| Carga horária vem de fonte editorial | ausente | action aceita valor da aluna | não | autorização editorial ausente | checks só garantem não-negativo | não localizado | P1: certificado pode refletir carga alterada | restringir origem da duração |
| Certificado público minimiza PII e pode ser corrigido/revogado | ausente | página por código | não | consulta pública | código único; sem status | não localizado | privacidade/credibilidade | decisão de produto e validação especializada |
| Ações administrativas sensíveis são auditadas | parcial | actions/admin logs | não | várias actions escrevem audit log | sem imutabilidade/RLS | não cobre catálogo completo | omissões não detectadas | catálogo de ações e teste de cobertura |
| Segredos não alcançam cliente | parcial | módulos server-side | não | variáveis observadas no servidor | não aplicável | não localizado | deploy pode divergir | revisar artefato/deploy sem expor segredos |

O catálogo Neon confirmou as constraints/índices citados e RLS desabilitado nas tabelas `public`; isso não invalida os guards server-side, mas impede tratá-los como defesa em profundidade no banco. Riscos prioritários de concorrência: transição pedido/grant, reversões encadeadas, aviso de expiração e último certificado. Os testes atuais são principalmente unitários/contratos SQL, sem concorrência ou integração real.
