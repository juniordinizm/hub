# Pesquisa: dados de aprendizagem e LGPD

> Nota de pesquisa, 22/07/2026. Nao e decisao de produto nem parecer juridico.

## Pergunta

Uma plataforma de cursos precisa pedir consentimento da Aluna para registrar
progresso e conclusao? Analytics individual de aprendizagem pode existir sem
essa pergunta?

## Achados

### Dados necessarios para entregar o curso

Conta autenticada, matricula/acesso, versao curricular, conclusao declarada da
Aula e instante da conclusao podem ser necessarios para entregar o curso,
aplicar sequenciamento, preservar o progresso e emitir Certificado. Se forem
indispensaveis a essas promessas, a base a avaliar e a execucao de contrato
(LGPD, art. 7, V), e nao consentimento.

Consentimento nao deve ser usado para uma operacao essencial cuja recusa
impediria a prestacao contratada: ele precisa ser livre, informado, inequivoco,
especifico para finalidades determinadas e revogavel; autorizacoes genericas
sao nulas (LGPD, arts. 5, XII, e 8). A ANPD orienta de forma analoga que
consentimento nao e a hipotese adequada para dados estritamente necessarios ao
funcionamento ou a prestacao adequada de um servico.

Mesmo com outra base legal, a Aluna deve receber informacao clara sobre
finalidade, forma e duracao do tratamento, controlador, compartilhamentos e
direitos (LGPD, art. 9). Direitos de acesso, correcao, eliminacao de dados
excessivos e outros continuam aplicaveis (art. 18).

### Dados opcionais de analytics

Percentual assistido, checkpoints, erros tecnicos associados a uma Aluna,
ultima atividade, inferencia de inatividade e contato individual por esse
motivo nao sao necessarios para uma conclusao manual ou para disponibilizar a
Aula. Sao telemetria/analytics separados da entrega do curso.

Para esse grupo, consentimento granular, opcional e sem reduzir acesso,
progresso ou Certificado em caso de recusa e a opcao prudente enquanto nao ha
avaliacao juridica formal para outra base. O consentimento precisa ser facil de
revogar; a ANPD confirma esse direito sem necessidade de justificativa.

Legitimo interesse nao deve ser adotado por conveniencia. A ANPD exige
finalidade concreta, necessidade e balanceamento com salvaguardas, alem de
respeitar direitos, liberdades e expectativa legitima do titular. Para
analytics individual facultativo, isso exigiria documentacao juridica antes de
substituir o consentimento.

### Limites adicionais

- Retencao termina quando a finalidade acaba ou o dado deixa de ser necessario,
  salvo hipotese legal de conservacao (LGPD, arts. 15-16).
- Nao usar analytics para negar acesso, certificado ou classificar a Aluna.
  Decisoes automatizadas que afetem interesses do titular exigem possibilidade
  de revisao e explicacao (art. 20).
- Havendo criancas, aplicar melhor interesse; para criancas, o consentimento
  deve ser especifico e destacado por responsavel e nao pode condicionar a
  atividade a dados alem do estritamente necessario (art. 14).

## Leitura do Hub no commit analisado

O Hub ja separa os dois fluxos corretamente no codigo:

- `src/features/courses/server.ts`: `lesson_progress` e
  `lesson_watch_progress` gravam o progresso operacional. A conclusao manual
  continua permitida e o limiar de 98% e apenas uma via automatica.
- `src/features/learning-analytics/server.ts`:
  `recordLearningAnalyticsEvent` somente insere evento quando existe
  consentimento ativo; a falha da coleta e isolada do fluxo de aprendizagem.
- `src/app/(student)/app/privacidade/page.tsx`: a unica tela dedicada e uma
  preferencia de analytics opcional; nao e uma sessao de aprendizagem e nao
  bloqueia curso, progresso ou Certificado.

Portanto, nao ha motivo tecnico ou juridico para obrigar a Aluna a aceitar
analytics para estudar. Se o produto nao precisa de metricas administrativas,
o caminho mais simples e remover analytics individual e sua preferencia; o
registro essencial de acesso e progresso permanece. Se o produto o mantiver,
a preferencia deve permanecer separada e acessivel, sem transformar o estudo em
uma experiencia condicionada a aceite.

## Fontes primarias

- [LGPD consolidada, Lei 13.709/2018, arts. 5-10 e 14-20](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [ANPD, Guia orientativo: Cookies e protecao de dados pessoais](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf)
- [ANPD, Guia orientativo: Hipoteses legais de tratamento - Legitimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_legitimo_interesse.pdf)
- [ANPD, Direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
