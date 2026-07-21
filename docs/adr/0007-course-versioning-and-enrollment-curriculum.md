---
status: accepted
owner: product
last_verified_commit: 19a268ca8b72bd8c2ac6875bfe68ca9f4ed7f18b
---

# ADR-0007: versão curricular vinculada à Matrícula

## Contexto

`Course` é o produto comercial, mas Módulos e Aulas são mutáveis no modelo atual. Isso permite que uma alteração de conteúdo mude silenciosamente a promessa curricular, o percentual de progresso e a elegibilidade de Certificado de uma Aluna já matriculada.

## Decisão

Cada publicação cria uma `CourseVersion` com estados `draft`, `published` e `retired`.

- `Course` conserva identidade comercial, preço e duração de acesso.
- Matrícula aponta para uma única Versão de Curso publicada.
- Nova Matrícula recebe a Versão publicada vigente no momento da concessão.
- Nova Versão não altera Matrículas existentes. Migração exige seleção explícita, justificativa, evento auditável e preservação de Conclusão e Certificado já emitidos.
- Módulos e Aulas pertencem a uma Versão. Aula obrigatória entra no denominador; Aula opcional não.
- A Aluna pode concluir manualmente uma Aula obrigatória sem percentual mínimo. Vídeo JMVStream com evento válido de 98% também pode concluí-la automaticamente.
- Certificado referencia a Versão de Curso além de manter seus snapshots exibidos.
- Correção editorial compatível exige auditoria. Mudança de objetivo, ordem obrigatória ou regra de Conclusão exige nova Versão.

## Recursos e vídeo

Uma Versão publicada referencia o `content_json` e o player materializado no momento da publicação. Objetos R2 e ativos JMVStream não podem ser removidos enquanto forem referenciados por qualquer Versão publicada. Publicar versão com vídeo JMVStream sem player pronto falha; upload/processamento não é duplicado como efeito da clonagem curricular.

## Consequências

Autoria edita `draft`; publicação congela a estrutura. A única exceção é a correção editorial compatível em Aula publicada: exige motivo, cria `course_version.compatible_correction` no audit log e não pode mudar módulo, ordem, estado ou obrigatoriedade. Alteração estrutural cria nova Versão. Coorte e `DripRule` não serão criados sem calendário/grupo real e nunca substituirão Concessão de acesso ou Matrícula.

## Alternativas rejeitadas

- Conteúdo vivo para todas as Matrículas: simples, mas altera promessa histórica.
- Snapshot JSON completo por Matrícula: preserva história, porém duplica currículo e torna migração/auditoria dispendiosas.
- Coorte como atalho para entitlement: mistura agenda pedagógica com direito financeiro de acesso.
