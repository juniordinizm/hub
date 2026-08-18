---
status: accepted
owner: product
last_verified_commit: acb1d0b
---

# ADR-0006 Snapshots, revogação e reemissão de Certificados

## Contexto

Certificado é evidência histórica. Nome, Curso e carga horária podem mudar; fraude ou erro pode exigir invalidação sem apagar o passado.

## Proposta

O certificado é um artefato PDF imutável. O Admin configura por Curso uma arte A4 horizontal privada e campos padronizados posicionados manualmente; HTML/CSS livre não é uma opção. A emissão cria um registro pendente e uma mensagem `certificate.render`; a worker usa somente o snapshot para gerar o PDF com PDFKit e o grava no R2 privado. `/certificados/[code]` é a página pública canônica de validação, preview e compartilhamento. Para Certificado `valid` e `ready`, `/certificados/[code]/pdf` aplica rate limit, verifica o digest SHA-256 e redireciona para uma URL assinada curta do objeto privado. Os demais estados não expõem preview, download, chave ou URL assinada. Página e redirect são não indexáveis.

Persistir snapshots no momento da emissão. Revogar com motivo, autoria e data. Reemitir criando novo Certificado e novo código, preservando o anterior revogado. Admin e Suporte podem executar as três operações, sempre com motivo obrigatório e confirmação validada na interface e novamente no servidor.

A emissão automática pertence exclusivamente à transação que insere a primeira `CourseCompletion`. Emissão, reemissão e progresso final compartilham lock transacional por Conta e Curso; encontrar uma Conclusão existente não tenta Certificado nem outbox.

Conclusões históricas podem ser reconciliadas somente por Admin, após confirmação explícita validada no servidor, em lotes de até 100. São elegíveis apenas conclusões de Curso com Certificado habilitado, template publicado, perfil emissor global e nenhum Certificado anterior para a combinação de Conta e Curso. Um Certificado revogado também conta como histórico e exige o fluxo de reemissão, portanto nunca volta à fila automática. Migration, deploy e leitura não executam backfill silencioso.

A reconciliação preserva a publicação e a data da Conclusão, usa título e carga horária daquela publicação, nome atual da Conta e template/emissor publicados no momento do lote. Cada emissão registra `origin: admin_reconciliation` na auditoria e enfileira `certificate.render` na mesma transação; geração de PDF, acesso ao R2 e envio de e-mail permanecem fora dela.

O motivo usa uma categoria padronizada e um detalhe interno. Na consulta pública de um certificado revogado, mostrar somente o estado, a data e a categoria legível; não expor o detalhe, que pode conter dados pessoais ou uma apuração sensível.

O e-mail de emissão aponta para a página pública canônica, não para o arquivo global autenticado nem para a URL assinada. A página do Curso oferece a entrada contextual do Certificado daquela conclusão; `/app/certificados` permanece como arquivo global autenticado de todos os registros da Aluna.

## Alternativas

- renderizar sempre dados atuais: simples, mas reescreve documento histórico;
- apagar e recriar: perde auditoria e permite ambiguidade do código;
- editar snapshots: resolve erro, mas oculta a correção.

## Consequências

- histórico é recuperável;
- dados pessoais permanecem em snapshots e entram na política de retenção;
- UI precisa explicar revogação e reemissão;
- revogação bloqueia novos previews e downloads pelo Hub, mas um download já realizado não pode ser recolhido nem uma cópia anterior desfeita; a invalidação passa a ser verificável pelo código público;
- o detalhe do motivo fica restrito à operação e à auditoria.
- lotes podem exigir execuções sucessivas; o resultado informa quantos foram emitidos e quantos ainda restam;
- retries são idempotentes porque qualquer histórico de Certificado remove a conclusão da elegibilidade.

## Estado

Implementado por `issueManualCertificate`, `revokeCertificate`, `reissueCertificate` e `reconcileHistoricalCourseCertificates`. A política
de que revogação bloqueia nova emissão automática, exigindo reemissão manual, foi ratificada em
2026-07-20. Autoridade, motivos e informação pública foram ratificados em 2026-07-21; veja
[DEC-DISC-006](../decisions.md#dec-disc-006).
