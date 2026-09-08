---
status: proposed
owner: engineering
last_verified_commit: 9d0450a275d5bdacfaa44e306ca1ad8958053c89
---

# Título do curso e nome do emissor opcionais no layout do certificado

## Contexto

O editor de certificados possui campos automáticos que podem ser exibidos no
PDF. Atualmente, `courseTitle` e `issuerName` fazem parte da lista de campos
obrigatórios do template, portanto precisam existir e estar visíveis para a
validação estrutural passar. A decisão aprovada nesta conversa é permitir que
esses dois campos sejam ocultados no layout, sem remover os campos do sistema.

## Decisão

Remover `courseTitle` e `issuerName` de `CERTIFICATE_REQUIRED_FIELDS`.

Eles continuarão:

- disponíveis em `CERTIFICATE_FIELDS` e no editor;
- sendo resolvidos automaticamente a partir da publicação do Curso e do
  perfil emissor;
- presentes nos snapshots de emissão e no renderer quando estiverem visíveis;
- compatíveis com templates e certificados históricos.

Depois da mudança, os campos visuais obrigatórios serão `studentName`,
`validationCode` e `qrCode`. A arte de fundo A4 continuará obrigatória, embora
seja uma propriedade do documento e não um campo visual.

O perfil emissor global continuará sendo pré-requisito para publicação. Razão
social, marca exibida e CNPJ não serão alterados; a mudança afeta somente a
visibilidade do campo `issuerName` no layout.

## Implementação e testes

Alterar a regra central em `src/features/certificates/template-rules.ts` e
adicionar cobertura em `src/features/certificates/template-rules.test.ts` para
provar que um template com fundo e somente os três campos visuais obrigatórios
é aceito. A cobertura existente para ausência de campos obrigatórios deve
continuar garantindo que `studentName`, `validationCode` e `qrCode` ainda
bloqueiam a validação quando ocultos ou ausentes.

Não haverá alteração de schema, migration, snapshots, emissão, renderização,
perfil emissor ou campos arbitrários.

## Critério de aceite

Um Admin consegue salvar e publicar um template com `courseTitle` e
`issuerName` ocultos, desde que a arte de fundo, `studentName`, `validationCode`,
`qrCode` e o perfil emissor global estejam configurados. Os dois campos seguem
disponíveis para quem quiser mantê-los visíveis.
