---
status: canonical
owner: product
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Glossário do Hub

Este arquivo fixa vocabulário de produto. Regras, implementação e decisões vivem na [documentação canônica](docs/README.md).

## Pessoas e identidades

**Aluna**  
Pessoa que consome Cursos no Hub. É papel de negócio e não prova que tenha efetuado a compra.

**Conta**  
Identidade autenticável do Hub, identificada por e-mail e protegida por credenciais e sessões. Seu papel técnico é `student`, `support` ou `admin`.

**Compradora**  
Pessoa que informa dados no checkout e assume a relação financeira do Pedido. Pode ser ou não a Aluna; e-mail de compra e e-mail de Conta não são sinônimos sem regra explícita de vínculo.

**Especialista**  
Responsável pelo conteúdo, experiência pedagógica e decisões de produto. No escopo atual há uma única especialista, sem marketplace ou tenancy por especialista.

**Admin**  
Operadora com todas as permissões administrativas. O termo descreve autorização, não propriedade comercial.

**Suporte**  
Operadora com subconjunto explícito de permissões administrativas; não é um Admin limitado por convenção.

## Comércio e acesso

**Pedido**  
Registro da intenção e resultado financeiro de compra, com preço, duração e identidade como snapshots.

**Concessão de acesso**  
Direito de uma Conta acessar Curso, originado em fonte identificável como Pedido pago. Pode estar ativa, expirada, reembolsada, em disputa ou cancelada.

**Matrícula**  
Projeção consolidada do acesso atual de uma Conta a um Curso. Pode refletir mais de uma Concessão e não é a origem do direito. Matrícula ativa lê a publicação vigente do Curso.

**Bloqueio de matrícula**  
Revogação manual de acesso a Curso específico; não bloqueia automaticamente a Conta inteira.

**Bloqueio de plataforma**  
Suspensão da Conta na experiência da Aluna, mais ampla que bloqueio de Matrícula e sem apagar histórico.

**Revisão financeira**  
Fila humana quando o sistema não pode aplicar evento financeiro com segurança, como conflito entre estados terminais ou valor divergente.

## Aprendizagem e conteúdo

**Curso**  
Produto educacional vendável e publicável, composto por Módulos e Aulas.

**Publicação de Curso (`CoursePublication`)**
Revisão interna materializada de Módulos e Aulas, com estados rascunho, publicada e aposentada. A publicação vigente define o currículo vivo de todas as Matrículas ativas do Curso; não é produto nem direito comercial individual.

**Conclusão de Curso (`CourseCompletion`)**
Primeira conclusão histórica de uma Aluna em um Curso, com data e publicação de origem. Não é apagada por publicação posterior, revogação ou reemissão de certificado.

**Módulo**  
Agrupamento ordenado de Aulas dentro de Curso.

**Aula**  
Unidade ordenada de aprendizagem que pode combinar vídeo, texto rico e materiais.

**Progresso**  
Evidência de consumo de Aulas e Curso. Não é direito de acesso.

**Conclusão**  
Estado em que Aula ou Curso satisfaz a regra vigente de completude. É independente de expiração.

**Certificado**  
Documento para uma Aluna e Curso, com snapshots exibidos. Pode ser válido, revogado ou reemitido.

**Evento de aprendizagem**
Registro técnico minimizado e idempotente de início, checkpoint, conclusão ou falha. É analytics, não autoridade de Progresso, acesso ou Certificado.

**Preferência de analytics de aprendizagem**
Controle de opt-out da Aluna para os eventos técnicos opcionais. Por padrão, analytics está habilitado; desativar não muda acesso, sequência, progresso, conclusão ou Certificado.

**Métrica agregada de aprendizagem**
Contagem ou medida por Aula e Publicação de Curso que não apresenta Conta, Matrícula, Aluna, e-mail ou lista de inatividade.

## Durações

**Duração pedagógica da Aula**  
Estimativa de consumo: vídeo mais leitura. Serve à experiência.

**Carga horária do Curso**  
Soma das durações pedagógicas das Aulas; não define validade de acesso.

**Duração comercial de acesso**  
Quantidade de meses vendida e capturada no Pedido/Concessão.

**Janela efetiva de acesso**  
Intervalo real entre liberação e expiração após extensões, reduções, renovação ou bloqueio.

**Duração de upload**  
Validade técnica de URLs temporárias e sessões de envio; não é duração pedagógica ou comercial.

## Estados documentais

**Implementado**: comportamento comprovado no `HEAD`, sem pressupor aprovação de produto.
**Aprovado**: decisão com trade-off e autoridade registrada, ainda que não implementada.
**Aguardando ratificação**: comportamento existe, mas a aprovação histórica não foi comprovada.
**Pendente**: pergunta real sem decisão ou implementação conclusiva.
