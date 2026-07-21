---
status: canonical
owner: product
last_verified_commit: 19a268ca8b72bd8c2ac6875bfe68ca9f4ed7f18b
---

# Glossário do Hub

Este arquivo fixa o vocabulário do produto. Regras, implementação e decisões ficam na [documentação canônica](docs/README.md).

## Pessoas e identidades

**Aluna**  
Pessoa que consome cursos no Hub. É um papel de negócio; não implica que ela mesma tenha efetuado a compra.

**Conta**  
Identidade autenticável no Hub, identificada por e-mail e protegida por credenciais e sessões. Uma conta pode ter papel técnico de `student`, `support` ou `admin`.

**Compradora**  
Pessoa que informa seus dados no checkout e assume a relação financeira do pedido. Pode ser a própria Aluna ou outra pessoa. E-mail de compra e e-mail da Conta não devem ser tratados como sinônimos sem uma regra explícita de vinculação.

**Especialista**  
Responsável pelo conteúdo, pela experiência pedagógica e por decisões de produto. No escopo atual há uma única especialista; não existe marketplace nem tenancy por especialista.

**Admin**  
Operadora com todas as permissões administrativas do Hub. “Admin” descreve autorização, não propriedade comercial do produto.

**Suporte**  
Operadora com um subconjunto explícito de permissões administrativas. Não é um “admin limitado por convenção”: cada capacidade precisa estar autorizada.

## Comércio e acesso

**Pedido**  
Registro da intenção e do resultado financeiro de uma compra. Mantém preço, duração e identidade da compra como snapshots para que alterações futuras no curso não reescrevam o passado.

**Concessão de acesso**  
Direito de uma Conta acessar um curso, originado por uma fonte identificável, como um Pedido pago. Pode estar ativa, expirada, reembolsada, em disputa ou cancelada.

**Matrícula**  
Visão consolidada do acesso atual de uma Conta a um curso. A mesma matrícula pode refletir mais de uma Concessão. Ela não deve ser confundida com a origem do direito.

**Bloqueio de matrícula**  
Revogação manual do acesso a um curso específico. Não bloqueia automaticamente a Conta inteira.

**Bloqueio de plataforma**  
Suspensão da Conta na experiência da Aluna. É mais amplo que um bloqueio de matrícula e não apaga histórico.

**Revisão financeira**  
Fila humana criada quando o sistema não consegue aplicar com segurança um evento financeiro, por exemplo conflito entre estados terminais ou divergência de valor.

## Aprendizagem e conteúdo

**Curso**  
Produto educacional vendável e publicável, composto por Módulos e Aulas.

**Versão de Curso (`CourseVersion`)**
Currículo publicado e imutável de um Curso, que define a estrutura de aprendizagem recebida por uma Matrícula. O Curso preserva a identidade comercial; a Versão de Curso preserva a promessa curricular.

**Módulo**  
Agrupamento ordenado de Aulas dentro de um Curso.

**Aula**  
Unidade ordenada de aprendizagem. Pode combinar vídeo, texto rico e materiais.

**Progresso**  
Evidência de consumo de Aulas e do Curso. Não é a mesma coisa que direito de acesso.

**Conclusão**  
Estado em que uma Aula ou Curso satisfaz a regra vigente de completude. Conclusão e expiração são independentes.

**Certificado**  
Documento emitido para uma Aluna e um Curso, com snapshots dos dados exibidos. Pode ser válido, revogado e reemitido.

## Durações

**Duração pedagógica da Aula**  
Tempo estimado de consumo: duração do vídeo mais tempo estimado de leitura. Serve à experiência de aprendizagem.

**Carga horária do Curso**  
Soma das durações pedagógicas das Aulas. Não define validade de acesso.

**Duração comercial de acesso**  
Quantidade de meses vendida para o Curso e capturada no Pedido/Concessão.

**Janela efetiva de acesso**  
Intervalo real entre liberação e expiração, após extensões, reduções, renovação ou bloqueio.

**Duração de upload**  
Validade técnica de URLs temporárias e sessões de envio de arquivos. Não tem significado pedagógico ou comercial.

## Estados documentais

**Implementado**  
Comportamento comprovado no `HEAD`. Não significa aprovação de produto.

**Aprovado**  
Decisão com trade-off e autoridade registrada. Pode ainda não estar implementada.

**Aguardando ratificação**  
Comportamento existe no código, mas a documentação histórica não comprova aprovação de produto.

**Pendente**  
Pergunta real sem decisão ou implementação conclusiva.
