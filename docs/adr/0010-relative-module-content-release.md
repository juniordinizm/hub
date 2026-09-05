---
status: accepted
owner: product
last_verified_commit: 6bec63f
---

# ADR-0010 Liberação temporal relativa por Módulo

## Contexto

O Hub precisa entregar parte de um Curso imediatamente e Módulos posteriores depois de
um intervalo relativo ao início do acesso de cada Aluna. A decisão precisa preservar o
ledger de Concessões, a projeção de Matrícula, o currículo vivo e a sequência
pedagógica sem introduzir coortes ou jobs de desbloqueio.

## Decisão

Configurar `D+0` ou `D+N` exclusivamente no Módulo. `D+N` representa `N × 24 horas` em
UTC desde o início do episódio contínuo de entrega persistido na Matrícula. Renovação e
Concessões sobrepostas preservam a âncora; recompra depois de perda total reinicia.

Matrículas existentes recebem acesso integral. Depois da primeira Matrícula agendada,
uma publicação pode reduzir atrasos, mas não aumentar o atraso efetivo de uma Aula
existente, inclusive por movimentação entre Módulos. Admin pode conceder acesso
integral com motivo e auditoria; a operação não é revertida no mesmo episódio.

A disponibilidade é calculada em cada request e composta com Matrícula, publicação e
sequência. Scheduler não é autoridade de acesso.

Cada novo Pedido preserva um snapshot compacto do cronograma apresentado. Esse snapshot
prova a oferta aceita, mas não governa o acesso; o runtime segue a publicação vigente
sob a regra monotônica. Um digest do snapshot impede criar checkout quando a política
mudou entre apresentação e confirmação.

## Alternativas rejeitadas

- regra por Aula: flexibilidade sem necessidade atual e maior superfície de autoria;
- “primeiras N Aulas”: reordenação mudaria a política por acidente;
- linha por Matrícula e Aula: cardinalidade, jobs e reconciliação desnecessários;
- coorte ou calendário absoluto: resolvem outro problema;
- cron de desbloqueio: adiciona atraso e falhas a uma decisão derivável do relógio.

## Consequências

A Aula herda a regra do Módulo atual. Alterações mais restritivas exigirão no futuro
política versionada ou novo Curso. A oferta deve comunicar o cronograma. O recurso
reduz exposição do acervo, mas não impede cópia nem altera o direito de arrependimento.
