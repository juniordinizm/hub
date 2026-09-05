---
status: accepted
owner: product
last_verified_commit: 6bec63f
---

# ADR-0007: publicações internas e conteúdo vivo por Curso

## Contexto

O Hub atende poucos alunos e o produto decidiu que alterações de um Curso devem chegar a todas as Matrículas ativas desse mesmo Curso. Um Curso integralmente novo, refilmado e vendido separadamente é outro `Course`, não uma revisão do anterior.

## Decisão

`CoursePublication` substitui a versão curricular entregue individualmente. Ela é uma revisão interna de publicação em lote, com estados `draft`, `published` e `retired`.

- Matrícula concede acesso ao `Course`; não guarda `course_publication_id`.
- Toda Matrícula ativa lê a única publicação `published` vigente.
- Criar rascunho copia a vigente. Publicar aposenta a anterior e troca a vigente atomicamente, com número, data e autora no audit log.
- A publicação e a edição do rascunho compartilham um lock transacional por Curso; a cópia das Capas R2 ocorre fora de transações abertas e a publicação revalida o rascunho antes da troca atômica.
- Módulos e Aulas pertencem a uma publicação. Aulas obrigatórias definem o progresso vivo; opcionais não entram no denominador.
- Alteração de conteúdo é sempre preparada e publicada em lote. Não há edição direta da publicação publicada.
- Retirar conteúdo preserva a publicação anterior, mídia, progresso, analytics e auditoria.

`CourseCompletion` registra a primeira conclusão de Aluna + Curso independentemente de certificado. Certificado conserva a publicação de origem e seus snapshots, mas a unicidade de certificado válido é Aluna + Curso. Depois de uma publicação nova, progresso pode diminuir; recuperar 100% não emite nem reemite certificado automaticamente.

## Consequências

O histórico de certificado prova uma conclusão passada, não que a Aluna completou todo o currículo vivo atual. Revogação e reemissão não alteram `CourseCompletion`; reemissão mantém a publicação de origem. Atualização pedagógica não é motivo de reemissão.

## Alternativas rejeitadas

- currículo fixado por Matrícula: preserva promessa individual, mas exige migração administrativa e contradiz entrega contínua escolhida;
- snapshot JSON por Matrícula: duplica conteúdo e dificulta mídia, auditoria e evolução;
- publicação imediata a cada salvamento: expõe alterações incompletas e não permite validação em lote.
