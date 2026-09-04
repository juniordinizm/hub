# Pesquisa e análise: liberação temporal de conteúdo no Hub

```yaml
status: research_only
owner: product_and_engineering
researched_at: 2026-09-04
verified_at_commit: 9d0450a
scope: evidence_and_recommendation_without_implementation_plan
```

## Conclusão executiva

A funcionalidade é viável no Hub e encontra um encaixe natural no domínio existente,
mas não deve ser modelada como um cron que "desbloqueia aulas" nem como um campo
"quantidade inicial de aulas" no Curso.

O desenho mais seguro é uma **política de disponibilidade temporal**, independente de:

1. **direito de acesso**: a Concessão/Matrícula diz se a Aluna pode entrar no Curso;
2. **validade comercial**: `starts_at` e `expires_at` dizem por quanto tempo há acesso;
3. **publicação**: a `CoursePublication` diz qual currículo está vigente;
4. **sequência pedagógica**: o Progresso diz qual é a próxima Aula;
5. **disponibilidade temporal**: a regra nova dirá a partir de quando cada conteúdo
   pode ser consumido.

Para uma Aluna, uma Aula só deve ficar utilizável quando **todas** as barreiras forem
satisfeitas: Matrícula efetiva, publicação/conteúdo ativos, prazo temporal atingido e
pré-requisito sequencial cumprido. Admin continua com preview completo, sem gravar
Progresso.

O benefício de segurança é real, porém limitado: reduz a janela em que uma compradora
pode copiar todo o acervo antes de pedir reembolso. Não impede gravação de tela, cópia
de um conteúdo já liberado, compartilhamento de credencial, vazamento de links externos
ou chargeback posterior. Portanto, o recurso deve ser apresentado como **ritmo de
entrega com redução de exposição**, não como proteção absoluta ou mecanismo para negar
o direito de arrependimento.

No Brasil, o bloqueio temporal **não elimina, reduz ou condiciona** o direito de
arrependimento. A política precisa estar clara na oferta e no contrato antes do checkout,
e o canal de cancelamento deve respeitar o Decreto do Comércio Eletrônico. Revisão
jurídica continua necessária antes de publicar a promessa comercial.

## 1. O problema, separado corretamente

Há quatro problemas diferentes frequentemente misturados sob o nome “drip”:

- **rolling drip**: D+0, D+7, D+14 para cada Aluna, relativo à entrada dela;
- **calendário absoluto**: todas recebem um módulo em uma data/hora comum;
- **coorte/turma**: grupo com calendário e, às vezes, currículo próprios;
- **pré-requisito**: Aula B depende de conclusão, nota ou ação na Aula A.

O caso informado é o primeiro: parte do conteúdo imediata e parte após sete ou oito
dias da compra. Isso **não exige coorte**. O Hub pode continuar single-tenant, com uma
única especialista e currículo vivo, adicionando somente uma política relativa à
Matrícula.

O Hub já implementa pré-requisito sequencial: `isLessonAvailable` libera Aulas
concluídas, anteriores e a primeira pendente. A nova regra temporal deve compor com
essa regra; não substituí-la. Exemplo:

- Aulas 1–3 configuradas como D+0;
- Aulas 4–10 configuradas como D+8;
- no D+0, a Aluna ainda percorre 1–3 na ordem, uma por vez;
- no D+8, a Aula 4 torna-se temporalmente elegível, mas só abre se a sequência também
  permitir;
- concluir a Aula 3 no D+2 não antecipa a Aula 4;
- chegar ao D+8 sem concluir a Aula 3 não pula a Aula 3.

## 2. O que as plataformas atuais fazem

### Hotmart Club

A Hotmart permite liberação por dias após a compra, data específica e resultado de
quiz, além de expiração após a liberação. As regras podem atingir conteúdo específico,
todas as turmas ou uma turma. O relógio documentado para dias/data usa 00:00 em GMT-3.
A própria documentação separa expiração de conteúdo do status ativo da pessoa na área
de membros. Também alerta que uma regra pode afetar certificado quando uma Aula não
fica disponível para conclusão.

Fonte oficial: [Hotmart — prazo de liberação e duração de conteúdos](https://help.hotmart.com/pt-br/article/213467588/como-configurar-o-prazo-de-liberacao-e-duracao-de-conteudos-no-hotmart-club-).

Implicações úteis para o Hub:

- conteúdo e Matrícula são dimensões diferentes;
- a interface precisa mostrar data de desbloqueio;
- conflitos entre regras de módulo, Aula e condição ficam difíceis rapidamente;
- decisões de fuso e de “dia” precisam ser explícitas;
- certificado não pode concluir enquanto conteúdo obrigatório futuro permanece
  bloqueado.

### Kiwify

A Kiwify oferece liberação imediata, por número de dias após a compra ou por data
específica. Também permite duração em dias após a liberação e aplicação em massa a
Aulas/Módulos selecionados.

Fonte oficial: [Kiwify — programar liberação e limitação](https://ajuda.kiwify.com.br/pt-br/article/como-programar-a-liberacao-e-limitacao-do-conteudo-dnja5g/).

O padrão de UX é relevante: seleção em massa é conveniente, mas a regra efetiva deve
ficar associada ao conteúdo, não à posição ordinal “primeiras N”.

### Eduzz/Nutror

O Nutror configura agendamento por dias após a compra, data fixa e validade tanto em
Módulo quanto em Aula. Quando Módulo e Aula têm datas, a documentação informa que a
maior data prevalece. A área da Aluna exibe quando o conteúdo ficará disponível.

Fontes oficiais:

- [Nutror — agendamento, data e validade](https://ajuda.eduzz.com/hc/pt-br/articles/4402567974683-Como-configurar-Agendamento-Data-de-libera%C3%A7%C3%A3o-e-Validade-em-m%C3%B3dulos-e-aulas-no-Nutror)
- [Nutror — comportamento da liberação](https://ajuda.eduzz.com/hc/pt-br/articles/8944496029595-Como-funciona-a-libera%C3%A7%C3%A3o-das-aulas-dentro-do-Nutror)

Essa precedência “maior restrição vence” é previsível, mas cria complexidade de suporte.
Na decisão posterior à pesquisa, Produto escolheu o Módulo como unidade exclusiva de
liberação. A Aula herda a regra do Módulo atual, sem override próprio.

### Teachable

O Teachable libera por data específica ou dias desde a **primeira matrícula**, no nível
de seção. A liberação ocorre à meia-noite UTC. Permite conceder acesso total por pessoa
ou para todas e restaurar o cronograma original. A restauração usa a data inicial da
matrícula.

Fonte oficial: [Teachable — Drip Content](https://support.teachable.com/en/articles/11682465-drip-content).

Lições:

- override individual é uma necessidade real de suporte;
- desligar drip e restaurá-lo pode retirar acesso já concedido, portanto deve haver
  confirmação e auditoria;
- o instante de liberação e o fuso não podem ser implícitos.

### Thinkific

O Thinkific suporta três âncoras: primeira matrícula, primeiro acesso ao player ou data
calendário. Em regras relativas, cada “dia” corresponde a 24 horas a partir do horário
da âncora. Reinscrição preserva a primeira data; editar a regra ativa afeta pessoas já
matriculadas e pode retirar acesso a Aulas concluídas. O preview ignora o drip.

Fontes oficiais:

- [Thinkific — Drip Schedule](https://support.thinkific.com/hc/en-us/articles/360030741033-Drip-Schedule)
- [Thinkific — schedule pela matrícula](https://support.thinkific.com/hc/en-us/articles/360038992533-Set-a-Drip-Schedule-by-Student-Enrollment-Date)

Essa documentação expõe duas decisões que o Hub não pode deixar acidentais:

1. recompra reinicia o relógio ou herda a primeira compra?
2. uma edição posterior pode re-bloquear conteúdo?

### Kajabi

O Kajabi calcula o drip pela data de acesso da pessoa, que pode ser a compra ou uma
`Access Date`, e documenta limite de 731 dias. Cancelar e recomprar reinicia a data por
padrão; a operação pode restaurar manualmente a data anterior.

Fontes oficiais:

- [Kajabi — limite temporal do drip](https://help.kajabi.com/articles/products/courses/how-far-in-advance-can-you-drip-a-course)
- [Kajabi — cancelamento e recompra](https://help.kajabi.com/articles/products/courses/what-happens-to-dripped-content-if-a-customer-cancels-and-repurchases)

Kajabi e Thinkific adotam respostas diferentes para recompra. Isso confirma que não há
uma “regra universal” a copiar: é política de produto.

### Moodle e LearnDash

O Moodle oferece restrições compostas por data, conclusão, nota, grupo e perfil. As
datas relativas ainda não cobrem de modo universal o `Restrict access`; a documentação
do Moodle 5.0 as marca como experimentais e limitadas a áreas específicas. Essa
flexibilidade é poderosa, mas muito além do caso do Hub.

O LearnDash registra a data/hora de matrícula e a usa para expiração e drip. Também
oferece início/fim absolutos e grupos, mas são capacidades distintas.

Fontes oficiais:

- [Moodle — Restrict access](https://docs.moodle.org/502/en/Restrict_access)
- [Moodle — Course relative dates](https://docs.moodle.org/500/en/Course_relative_dates)
- [LearnDash — gestão de matrícula](https://learndash.com/support/kb/add-ons/users/user-management/)
- [LearnDash — modos e duração de acesso](https://learndash.com/support/kb/core/courses/course-enrollment-mode/)

Conclusão de mercado: Hotmart, Kiwify e Nutror convergem no modelo pedido, enquanto
Teachable, Thinkific e Kajabi demonstram que **âncora, reentrada, override e edição
retroativa** são os verdadeiros pontos difíceis. Moodle mostra o custo de evoluir cedo
demais para um motor genérico de condições.

## 3. Evidência pública de comunidades

Relatos públicos devem ser tratados como anedota, não como taxa de fraude ou prova de
eficácia:

- criadores relatam preocupação com consumo rápido seguido de reembolso e sugerem
  liberar parte do Curso após a janela de reembolso;
- outros criadores consideram o risco menos frequente do que o medo inicial e apontam
  engajamento/conclusão como problema maior;
- alunas reclamam quando regras de reembolso dependem de percentuais opacos ou quando o
  conteúdo prometido não chega no prazo;
- relatos de compartilhamento e gravação reforçam que drip reduz exposição, mas não
  substitui segurança de mídia.

Fontes anedóticas:

- [Reddit / elearning — risco de acesso integral e reembolso](https://www.reddit.com/r/elearning/comments/1fh0bf3)
- [Reddit / onlinecourses — proteção, progresso e reembolso](https://www.reddit.com/r/onlinecourses/comments/1r3d2zf/how_do_you_deliver_and_protect_your_digital/)
- [Reddit / content_marketing — entrega parcial após janela](https://www.reddit.com/r/content_marketing/comments/f8tix7)
- [Reddit / Udemy — conflito causado por critério opaco de consumo](https://www.reddit.com/r/Udemy/comments/1p3cwmv/6_of_the_course_is_too_much_content_to_request/)

Não foi encontrada fonte pública confiável que quantifique quanto um drip de oito dias
reduz fraude ou chargeback. Qualquer promessa de ROI seria especulação.

## 4. Limites jurídicos no Brasil

Esta seção é análise de risco de produto, não parecer jurídico.

### Direito de arrependimento

O art. 49 do CDC prevê sete dias para desistência em contratação fora do
estabelecimento e devolução imediata, monetariamente atualizada, dos valores pagos. O
texto não cria uma exceção geral para conteúdo digital já iniciado. Os arts. 46, 47 e
51 também protegem conhecimento prévio, interpretação favorável ao consumidor e vedam
cláusulas que retirem reembolso previsto em lei.

Fonte primária: [Lei 8.078/1990, arts. 46–51](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm).

A Senacon reiterou em 2025 que compras online têm o prazo de sete dias, sem necessidade
de justificativa, multa ou condição imposta pelo fornecedor. O Procon-SP trata o prazo
como sete dias corridos e aplica a regra também a cursos contratados fora do
estabelecimento.

Fontes oficiais:

- [Senacon/MJSP — arrependimento em compras online](https://www.gov.br/mj/pt-br/assuntos/noticias/consumidor-tem-direito-ao-arrependimento-em-compras-on-line)
- [Procon-SP — legislação e orientação sobre cursos](https://www.procon.sp.gov.br/legislacao/)

Consequência: **visualizar, concluir ou baixar uma parte do Curso não deve ser usado
automaticamente para negar o arrependimento legal**. Uma garantia comercial além dos
sete dias pode ter regras próprias compatíveis com a lei, mas não reduz o mínimo legal.

### Transparência da entrega

O Decreto 7.962/2013 exige informação clara sobre disponibilidade, forma e prazo de
execução, restrições de fruição, resumo do contrato, atendimento eletrônico e meio
adequado para arrependimento. O consumidor deve poder usar a mesma ferramenta da
contratação para exercer o direito, e deve receber confirmação imediata.

Fonte primária: [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).

O CDC também determina que informação/publicidade precisa integra o contrato e que
descumprimento da oferta pode gerar cumprimento forçado, prestação equivalente ou
rescisão com restituição e perdas e danos.

Consequências para produto:

- checkout e landing page não podem prometer “acesso completo imediato” se parte abrir
  em D+8;
- o calendário precisa aparecer antes da compra, na confirmação e dentro do Curso;
- alterações mais restritivas após a compra têm risco elevado;
- indisponibilidade técnica não pode ser confundida com bloqueio programado;
- “sete dias após compra” não deve ser descrito como encerramento jurídico automático,
  porque a contagem pode depender da contratação ou da disponibilização do serviço no
  caso concreto;
- o Hub deveria revisar separadamente a ausência aparente de autoatendimento de
  arrependimento: hoje o fluxo de reembolso encontrado é administrativo e exige papel
  privilegiado.

### LGPD e medidas antifraude

O mecanismo temporal, por si, precisa apenas dos dados já necessários para contrato e
Matrícula. Não há razão para coletar CPF, biometria, fingerprint invasivo ou histórico
excessivo. A LGPD exige finalidade, adequação, necessidade, transparência, segurança e
prestação de contas. Se dados adicionais forem usados para prevenção a fraude, a ANPD
orienta avaliar finalidade, necessidade, balanceamento e salvaguardas.

Fontes oficiais:

- [LGPD, art. 6º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [ANPD — Guia de legítimo interesse](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse)

## 5. O que o Hub já tem

### Base favorável

- `enrollment_grants` é o ledger do direito por origem; `enrollments` é a projeção
  consolidada por Conta + Curso (`src/db/schema.ts:653`, `src/db/schema.ts:682`).
- pagamento confirmado cria/reativa uma Concessão e recompõe a Matrícula de forma
  transacional (`src/features/enrollments/server.ts:344`).
- renovação durante acesso ativo estende a validade; a Matrícula usa o menor início e a
  maior expiração entre Concessões elegíveis (`src/features/enrollments/server.ts:145`,
  `src/features/enrollments/server.ts:172`).
- reembolso/disputa revoga a Concessão e recompõe a projeção; evento tardio de pagamento
  não reativa estado adverso, conforme ADR-0005.
- `resolveCourseAccess` e `resolveLessonAccess` aplicam Matrícula, início, expiração,
  status do Curso e publicação no servidor (`src/features/enrollments/access.ts:4`,
  `src/features/enrollments/access.ts:33`).
- leitura da Aula, conclusão manual e progresso de vídeo passam por
  `getEnrolledLessonWorkspace` (`src/features/courses/server.ts:1086`,
  `src/features/courses/server.ts:1366`, `src/features/courses/server.ts:1484`).
- download/preview R2 chama a mesma leitura protegida e gera URL assinada de cinco
  minutos (`src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.ts`,
  `src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.ts`,
  `src/features/storage/r2.ts:38`).
- preview Admin já é separado da experiência mutável da Aluna.
- as páginas protegidas são dinâmicas; não dependem de build estático para o relógio.

### Lacunas específicas para drip

- `courses`, `modules` e `lessons` não possuem atraso/liberação temporal
  (`src/db/schema.ts:322`, `src/db/schema.ts:493`, `src/db/schema.ts:522`).
- `enrollments.starts_at` representa a projeção do direito, não uma âncora com semântica
  estável de entrega (`src/db/schema.ts:664`).
- a decisão atual de Aula é booleana e significa somente sequência; ela não distingue
  “aguarde a data” de “conclua a anterior” (`src/features/progress/rules.ts`).
- o overview busca todas as Aulas e calcula `isAvailable` apenas pelo Progresso
  (`src/features/courses/server.ts:768`, `src/features/courses/server.ts:897`).
- comentários duplicam a consulta e a regra de sequência, portanto formam um segundo
  ponto de enforcement (`src/features/comments/server.ts:49`,
  `src/features/comments/server.ts:102`, `src/features/comments/server.ts:128`).
- `video_embed_url` é persistida e entregue ao navegador somente após autorização do
  workspace, mas a segurança após a entrega depende da configuração do player JMVStream.
  O repositório não prova que token por sessão, whitelist de domínio, DRM ou watermark
  estejam ativos em Production.
- recursos externos guardados em `content_json` são URLs permanentes de terceiros. O
  Hub pode ocultá-los antes do desbloqueio, mas não pode revogá-los após a primeira
  exposição.

### Decisão de produto que precisa ser reaberta

`DEC-DISC-005` aprovou não criar coorte nem `DripRule` até existir calendário ou grupo
real. A necessidade agora relatada constitui evidência nova para **drip relativo**, não
para coorte. A decisão deve ser reaberta e atualizada antes de alterar schema/runtime.

O plano histórico `plans/010-learning-policy-content-versions-and-cohorts.md` está
desatualizado: foi escrito antes da implementação de `CoursePublication` e ainda afirma
que o Curso não tem versão. Ele serve como histórico, não como plano executável para
esta funcionalidade.

## 6. Âncora temporal: a decisão mais importante

Não usar `orders.created_at`: checkout criado não prova pagamento nem acesso.

Não usar o primeiro login: adia o relógio indefinidamente e enfraquece o objetivo de
reduzir exposição dentro da janela de arrependimento.

Não usar simplesmente `enrollments.starts_at` sem formalizar sua semântica. Hoje esse
campo é recalculado a partir das Concessões ativas. Em múltiplas compras sobrepostas, a
revogação da Concessão mais antiga pode mover o início para uma compra posterior e
re-bloquear conteúdo já disponível.

Recomendação conceitual: uma âncora explícita de **início do episódio contínuo de
entrega**, persistida na Matrícula.

Comportamento recomendado:

- primeira compra paga ou concessão manual => inicia a âncora;
- renovação enquanto o acesso está contínuo => preserva a âncora;
- uma origem é reembolsada, mas outra mantém acesso contínuo => preserva a âncora;
- bloqueio manual e restauração do mesmo direito => preserva a âncora;
- expiração/revogação total seguida de nova compra => reinicia a âncora;
- retry ou webhook duplicado => não altera a âncora;
- reconciliação atrasada => inicia quando o Hub efetivamente concede acesso, salvo
  decisão explícita para honrar um instante oficial anterior do provider;
- importação/concessão manual => usa instante informado/auditado ou o momento da
  concessão, nunca uma data inferida silenciosamente.

Esse comportamento corresponde melhor ao objetivo antifraude que a regra do Thinkific
(primeira matrícula para sempre) e evita a instabilidade de usar cada `paid_at`.

O relógio recomendado é por duração exata: `anchor + N * 24h`, calculado em UTC. É mais
previsível que “meia-noite local”, evita dias de 23/25 horas e não precisa de cron. A UI
converte o instante para `America/Sao_Paulo`. Se Produto preferir “abre à meia-noite do
D+8”, isso precisa ser outra decisão, porque muda a duração real conforme o horário da
compra.

## 7. Como representar a configuração

### Rejeitado: apenas `initialLessonCount`

Guardar “libere as primeiras 3 Aulas” torna posição uma regra de segurança. Inserir ou
reordenar uma Aula muda retroativamente o conteúdo exposto. Também não representa D+14,
exceções, bônus ou Módulos com ritmos distintos.

### Rejeitado: uma linha por Aluna × Aula

Materializar todo desbloqueio gera cardinalidade proporcional a matrículas vezes aulas,
exige jobs/retries e cria drift quando o currículo muda. Só se justifica no futuro se
cada Aluna tiver uma agenda individual arbitrária.

### Rejeitado: cron como autoridade

Um cron que altera `locked=false` pode atrasar, duplicar ou falhar. O relógio já permite
decisão determinística em cada request. Cron é útil apenas para notificações e métricas,
nunca para conceder acesso.

### Recomendado após decisão: atraso explícito por Módulo

O painel pode oferecer:

- imediato (`D+0`);
- D+7, D+8 ou número inteiro configurável;
- configurar cada Módulo uma única vez;
- preview do cronograma;
- aviso quando a última Aula abre depois da expiração comercial.

Internamente, a primeira versão deve persistir um `release_delay_days >= 0` no Módulo.
A Aula sempre lê o valor do Módulo atual. A regra é clonada com a
`CoursePublication`; a `curriculum_key` da Aula permite impedir que uma movimentação
para Módulo mais restritivo re-bloqueie conteúdo depois das vendas.

Uma evolução futura pode introduzir datas absolutas ou política por turma, mas não deve
entrar no primeiro escopo.

## 8. Estado resultante e contrato de autorização

Um booleano `isAvailable` deixa de ser suficiente. O domínio precisa retornar um estado
explicável, por exemplo:

- `available`;
- `time_locked` com `availableAt`;
- `sequence_locked`;
- `access_denied` permanece na camada de Matrícula e não aparece como Aula normal;
- `unpublished` não aparece à Aluna.

Precedência recomendada para uma Aula publicada:

1. sem Matrícula/Curso elegível => negar o Curso/Aula;
2. atraso temporal não vencido => `time_locked`;
3. pré-requisito não concluído => `sequence_locked`;
4. caso contrário => `available`.

Uma Aula concluída deve permanecer acessível enquanto a Matrícula estiver efetiva,
mesmo que uma edição posterior tente aumentar seu atraso. Isso evita regressão evidente,
mas não resolve sozinho uma Aula já aberta e ainda não concluída; por isso a política de
edição retroativa precisa ser explícita.

Todos os consumidores precisam chamar uma única decisão profunda:

- lista de Cursos e `nextLessonId`;
- overview e sidebar;
- rota direta da Aula;
- conclusão manual;
- progresso do player;
- comentários;
- preview/download de materiais;
- futuras notificações de liberação;
- elegibilidade de Conclusão/Certificado.

Esconder ou desabilitar apenas na interface seria falha de autorização: URL direta,
Server Action, comentários e materiais continuariam alcançáveis.

## 9. Edição, publicação e grandfathering

As plataformas de mercado mostram que editar drip em Curso ativo pode retirar acesso.
No Hub, uma nova `CoursePublication` chega a todas as Matrículas ativas; portanto,
publicar um atraso maior também pode re-bloquear Aulas.

Recomendação de política:

- rollout inicial: Matrículas existentes recebem acesso integral preservado;
- novas Matrículas recebem a política ativa no momento da concessão;
- reduzir atraso pode beneficiar todo mundo imediatamente;
- depois da primeira Matrícula agendada, aumentar o atraso efetivo de uma Aula
  existente é proibido;
- Progresso concluído e Certificado histórico nunca são revertidos;
- movimentação para Módulo mais restritivo é validada na publicação, não aceita como
  efeito colateral silencioso de arrastar uma Aula.

Há duas implementações possíveis:

1. **MVP restrito**: atraso vive no Módulo; Matrícula possui `full_access` ou `scheduled`;
   alterações mais restritivas são proibidas enquanto houver Matrículas agendadas.
2. **Política versionada**: uma versão imutável de cronograma é vinculada à Matrícula;
   novas vendas usam a atual e migrações são explícitas. É mais robusta para alterações
   frequentes, mas tem maior custo de schema, autoria e mapeamento por `curriculum_key`.

Para o Hub atual, o MVP restrito tem melhor relação valor/complexidade **se** Produto
aceitar que atrasos só podem ser relaxados após vendas. Se a especialista precisa mudar
livremente o calendário de pessoas já matriculadas, a política versionada deixa de ser
opcional.

## 10. Experiência da Aluna e da operação

### Aluna

- mostrar Módulo/Aula bloqueada sem revelar texto, vídeo, materiais ou comentários;
- informar “Disponível em 12/09/2026 às 14:32” e, opcionalmente, tempo restante;
- distinguir “aguarde a data” de “conclua a Aula anterior”;
- quando não há próxima Aula disponível, mostrar pausa programada, não “Curso
  concluído”;
- progresso pode usar todas as Aulas obrigatórias no denominador, mas a interface deve
  explicar que parte ainda será liberada;
- certificado só nasce quando todas as Aulas obrigatórias estiverem liberadas e
  concluídas;
- acessibilidade: cadeado não pode depender só de cor; texto e data precisam ser
  legíveis por tecnologia assistiva;
- evitar contadores client-only como autoridade. O servidor decide; o cliente apenas
  apresenta e atualiza após o instante.

### Admin/Suporte

- preview completo ignora drip, claramente marcado;
- simulação por data/âncora para conferir o que uma nova Aluna verá;
- configuração única no formulário do Módulo e resumo antes de publicar;
- alerta de inconsistência: última liberação posterior a `expires_at`/duração vendida;
- acesso total antecipado por Aluna deve exigir permissão, motivo e auditoria;
- Suporte visualiza âncora, próxima liberação e motivo do bloqueio;
- histórico precisa distinguir mudança de validade, bloqueio manual, reembolso e
  override de drip.

### Notificações

Não são necessárias para o controle de acesso. Se forem adicionadas, devem usar a
outbox existente e uma geração idempotente por Matrícula + regra + versão. Alteração do
cronograma deve tornar mensagem antiga `superseded`, seguindo o padrão já usado nos
avisos de expiração. Um job pode descobrir liberações próximas/passadas; a ausência do
e-mail não pode impedir a Aula de abrir.

## 11. Segurança de mídia

O Hub impede obter conteúdo da Aula antes da autorização do servidor, e materiais R2
usam URL assinada curta. Depois que o navegador recebe conteúdo, as garantias mudam:

- URL assinada reduz compartilhamento duradouro, mas não impede salvar o arquivo;
- link externo não é revogável pelo Hub;
- whitelist de domínio protege incorporação, não gravação de tela;
- DRM dificulta extração, não torna vazamento impossível;
- watermark dinâmica pode desestimular e atribuir vazamento, mas envolve dado pessoal,
  transparência e configuração no provider;
- limite de sessões/login simultâneo combate compartilhamento, mas pode gerar falsos
  positivos e impacto de suporte.

A JMVStream anuncia token de sessão, domínio autorizado, criptografia, DRM e watermark,
mas a documentação pública da API consultada não permitiu provar a configuração do
plano/players do Hub. Isso deve virar uma verificação operacional separada, sem assumir
que marketing do fornecedor equivale a controle ativo.

Fontes do fornecedor:

- [JMVStream — hospedagem e camadas de proteção](https://jmvstream.com/pt-br/hospedagem-de-videos/)
- [JMVStream — diferença entre player, link, token e DRM](https://jmvstream.com/pt-br/blog/business/video-vimeo-com-senha-e-seguro-para-curso-pago)

## 12. Reembolso, disputa e chargeback

O Hub já está bem posicionado:

- `PAYMENT_REFUNDED`, disputa e chargeback prevalecem e revogam a Concessão;
- eventos são recebidos em inbox idempotente;
- retries e eventos tardios não devem reabrir acesso adverso;
- reembolso em andamento não deve antecipar uma revogação definitiva sem política;
- reembolso parcial entra em revisão, não em automação simplista.

O Asaas documenta eventos distintos para confirmado, recebido, reembolso em andamento,
reembolsado, reembolso parcial e etapas de chargeback. A documentação também recomenda
idempotência pelo ID único do evento e persistência antes do processamento.

Fontes oficiais:

- [Asaas — eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Asaas — idempotência em webhooks](https://docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks)

O drip não deve alterar essa matriz. Ele só restringe **o que** uma Matrícula ativa pode
ver em certo instante. Reembolso confirmado continua revogando toda a origem; chargeback
pode ocorrer bem depois de D+8 e precisa continuar sendo tratado.

## 13. Casos-limite obrigatórios antes de planejar

1. Compra às 23:59: D+8 significa 192 horas exatas ou meia-noite do oitavo dia?
2. Webhook chega dois dias atrasado: contar da confirmação externa ou do acesso real?
3. Compra PIX e cartão têm a mesma âncora apesar de momentos de confirmação diferentes?
4. Renovação antes de expirar preserva o cronograma?
5. Recompra após reembolso reinicia?
6. Duas Concessões sobrepostas; uma é reembolsada: nada pode re-bloquear.
7. Bloqueio manual e restauração preservam a data?
8. Concessão manual pode informar data anterior? Quem tem permissão?
9. Aula adicionada em nova publicação recebe atraso relativo à âncora antiga. Para uma
   Aluna já há meses no Curso, ela abre imediatamente se o atraso já passou?
10. Reordenar Aula não pode mudar sua regra por acidente.
11. Atraso maior que a validade comercial deve impedir publicação ou apenas alertar?
12. Aula opcional futura entra ou não no total exibido?
13. Aula obrigatória futura impede certificado até abrir e concluir?
14. Conteúdo iniciado antes de uma mudança pode ser re-bloqueado?
15. Override de acesso total é permanente, temporário ou reversível?
16. Downgrade da política deve liberar imediatamente sem job?
17. Horário do servidor, banco e navegador divergem: servidor é autoridade.
18. URL assinada gerada pouco antes do reembolso continua válida por até cinco minutos;
    isso é aceitável e precisa estar documentado.
19. Player JMVStream aberto antes do reembolso pode continuar tocando; política de token
    de sessão precisa ser validada.
20. Conteúdo externo já revelado não pode ser recolhido.

## 14. Recomendação para o Hub

Adotar **drip relativo à Matrícula e exclusivamente por Módulo**, sem coorte, sem data
absoluta, sem expiração por conteúdo e sem motor genérico de condições na primeira
versão.

Contrato recomendado:

- `D+0` como default e migração sem mudança de comportamento;
- cálculo por horas exatas em UTC;
- âncora explícita do episódio contínuo de entrega;
- composição `entitlement AND publication AND time AND sequence` em uma única função de
  domínio retornando razão e `availableAt`;
- enforcement em todos os read models, mutations, comentários e materiais;
- Admin preview completo;
- Matrículas preexistentes com full access preservado no rollout;
- depois da primeira Matrícula agendada, atrasos só podem ser reduzidos; uma Aula não
  pode ser movida para Módulo mais restritivo;
- override individual auditável;
- divulgação do cronograma na oferta, confirmação e área da Aluna;
- snapshot compacto do cronograma em cada novo Pedido, preservando o contrato vendido;
- refund/chargeback continuam independentes;
- notificações ficam para etapa posterior;
- segurança JMVStream é auditada separadamente.

### O que não incluir inicialmente

- coortes/turmas;
- data absoluta;
- liberação por quiz/nota;
- expiração individual de conteúdo;
- learning paths entre Cursos;
- regra booleana arbitrária com AND/OR;
- criação de eventos de desbloqueio por Aluna × Aula;
- tentativa de negar reembolso por percentual assistido;
- fingerprinting ou dados adicionais de fraude;
- DRM/watermark no mesmo projeto sem validar capacidade contratada da JMVStream.

## 15. Decisões que antecedem o plano de implementação

O próximo plano só será seguro após ratificar:

1. **Relógio**: 24 horas exatas em UTC (recomendado) ou meia-noite GMT-3.
2. **Âncora**: início real do episódio contínuo de entrega (recomendado).
3. **Recompra**: reinicia após perda total de acesso (recomendado).
4. **Renovação contínua**: preserva a âncora (recomendado).
5. **Granularidade**: exclusivamente por Módulo; a Aula herda o destino (aprovado).
6. **Política histórica**: existentes em full access (recomendado).
7. **Edição restritiva**: proibir após vendas no MVP ou versionar cronogramas.
8. **Override individual**: acesso total auditável (recomendado).
9. **Comunicação pré-compra**: texto e cronograma que integrarão a oferta.
10. **Arrependimento**: revisão jurídica e decisão sobre autoatendimento eletrônico.

## 16. Verificação realizada e limites

Foram lidos a documentação canônica, schema, domínio de Matrículas, pagamentos,
publicações, Progresso, comentários, materiais R2, player JMVStream e superfícies da
Aluna. Foram consultadas fontes oficiais atuais de Hotmart, Kiwify, Eduzz/Nutror,
Teachable, Thinkific, Kajabi, Moodle, LearnDash, Asaas, Planalto, Senacon, Procon e ANPD,
além de relatos públicos separados como anedota.

Limites:

- nenhuma infraestrutura ou configuração de Production foi alterada ou inspecionada;
- nenhum valor de segredo foi lido ou reproduzido;
- a configuração real de segurança dos players JMVStream não foi comprovada;
- não há estatística pública confiável de redução de fraude por drip;
- jurisprudência específica sobre cada formato de curso digital pode variar; revisão
  jurídica é necessária;
- a suíte Vitest não pôde ser usada como baseline nesta sessão porque o ambiente local
  não resolveu o pacote `vitest`/`server-only`; isso não contradiz a inspeção estática,
  mas impede alegar verificação executável do comportamento atual;
- nenhum plano de implementação foi produzido neste documento.
