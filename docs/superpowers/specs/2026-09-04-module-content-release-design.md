---
status: accepted
owner: product
last_verified_commit: 9d0450a
---

# Liberação temporal de conteúdo por Módulo

## Resultado

O Hub poderá liberar Módulos progressivamente depois do início efetivo do acesso de
cada Aluna. A configuração pertence ao Módulo, usa períodos exatos de 24 horas e
compõe com a Matrícula, a publicação vigente e a sequência pedagógica existentes.

A primeira versão preserva simplicidade:

- `D+0` ou `D+N` por Módulo;
- sem configuração por Aula;
- sem coortes ou datas absolutas;
- sem cron para liberar conteúdo;
- sem re-bloqueio depois que uma regra se torna aplicável;
- Matrículas existentes permanecem com acesso integral.

## Motivação

Parte do Curso deve poder ser entregue imediatamente e o restante depois de um
intervalo configurável. O objetivo combina ritmo pedagógico com redução da exposição
do acervo durante os primeiros dias de uma compra.

O controle reduz a quantidade de conteúdo que pode ser copiada rapidamente, mas não
elimina gravação de tela, compartilhamento de credenciais, cópia de material já
liberado ou chargeback posterior. Ele não altera nem condiciona o direito de
arrependimento.

A pesquisa de mercado, jurídica e do repositório que fundamenta esta decisão está em
[`plans/000-lms-staged-access-evidence.md`](../../../plans/000-lms-staged-access-evidence.md).

## Vocabulário

**Disponibilidade temporal do Módulo** é a condição que determina quando um Módulo
publicado pode ser consumido durante uma Matrícula efetiva. Ela não concede direito ao
Curso, não altera a validade comercial e não substitui a sequência pedagógica.

**Início da entrega de conteúdo** é a âncora do episódio contínuo de acesso. Um novo
episódio começa quando uma Conta volta a ter acesso depois de não possuir nenhuma
Concessão efetiva.

**Acesso integral** é a ausência deliberada de restrição temporal para uma Matrícula.
Não significa acesso sem expiração, dispensa de sequência ou imunidade a reembolso,
disputa, bloqueio e arquivamento.

## Separação de responsabilidades

O acesso a uma Aula resulta da composição de cinco dimensões independentes:

1. **Concessão/Matrícula**: prova se a Conta possui direito efetivo ao Curso.
2. **Validade comercial**: limita o intervalo de acesso ao Curso.
3. **Publicação**: define o currículo vivo que a Matrícula lê.
4. **Disponibilidade temporal**: define quando o Módulo pode ser consumido.
5. **Sequência pedagógica**: define qual Aula é a próxima dentro do currículo.

Uma Aula só pode ser consumida quando todas as dimensões aplicáveis permitirem. O
cliente nunca é autoridade para nenhuma delas.

## Decisões de escopo

### Liberação exclusivamente por Módulo

Cada Módulo define seu atraso. Todas as suas Aulas herdam a mesma disponibilidade.
Não existe override por Aula.

Mover uma Aula para outro Módulo muda sua disponibilidade temporal para a regra do
destino. Depois que o Curso possui Matrícula agendada, a publicação deve recusar uma
movimentação que aumente o atraso efetivo de uma Aula existente.

Essa regra usa a `curriculum_key` já preservada entre publicações para reconhecer a
mesma Aula. O Módulo não precisa receber chave curricular própria.

### Tempo relativo, não calendário

`D+N` significa `N × 24 horas` depois do Início da entrega de conteúdo. O cálculo usa
instantes UTC; a interface apresenta a data no fuso `America/Sao_Paulo`.

Exemplo: acesso iniciado em `2026-09-04T17:30:00Z` e Módulo configurado como `D+8`
resulta em liberação em `2026-09-12T17:30:00Z`, apresentada como 14:30 em São Paulo.

Não haverá interpretação por meia-noite, dia civil, horário do navegador ou timezone
do servidor.

### Sem scheduler como autoridade

O Módulo fica disponível quando:

```text
agora >= início da entrega + atraso do Módulo
```

A decisão é calculada em cada leitura ou mutação protegida. Nenhuma linha precisa ser
atualizada no instante da liberação. Jobs futuros poderão enviar notificações, mas uma
falha de job nunca poderá atrasar ou antecipar o acesso.

### Política monotônica

Matrículas existentes no rollout recebem Acesso integral. Depois da primeira
Matrícula sujeita ao cronograma:

- reduzir um atraso é permitido;
- remover um atraso é permitido;
- aumentar o atraso efetivo de uma Aula existente é recusado;
- mover uma Aula existente para um Módulo mais restritivo é recusado;
- uma Aula inteiramente nova pode ser adicionada a qualquer Módulo;
- conteúdo já concluído permanece acessível enquanto a Matrícula for efetiva.

Não haverá versionamento de cronogramas na primeira versão. Se Produto precisar vender
o mesmo Curso simultaneamente com calendários diferentes, a necessidade deverá abrir
uma nova decisão sobre política versionada ou coorte.

## Modelo de dados aceito

### Módulo

Adicionar a `modules`:

```text
release_delay_days integer not null default 0
```

Invariantes:

- valor inteiro;
- valor maior ou igual a zero;
- `0` significa liberação imediata;
- o valor é copiado ao criar o rascunho de uma nova `CoursePublication`;
- reordenar o Módulo não altera o valor;
- mover uma Aula não copia regra para a Aula: a regra é sempre lida do Módulo atual.

### Matrícula

Adicionar a `enrollments`:

```text
content_release_mode full_access | scheduled not null default full_access
content_release_started_at timestamptz null
```

Semântica:

- `full_access` exige âncora `null` e significa ausência deliberada de restrição
  temporal;
- `scheduled` exige uma âncora e significa que a Matrícula segue a política temporal
  da publicação vigente;
- a coluna é autoridade da âncora, não `orders.created_at`, primeiro login ou horário
  fornecido pelo navegador.

Uma constraint garante as duas combinações válidas. Assim, falha ao gravar a âncora
não pode ser interpretada como Acesso integral.

### Pedido

Adicionar a `orders` um snapshot JSON obrigatório para novas compras:

```text
content_release_schedule_snapshot {
  version: 1,
  clock: "elapsed_24h",
  modules: Array<{
    title: string,
    sortOrder: number,
    releaseDelayDays: number
  }>
}
```

O snapshot registra a oferta aceita; não é usado para decidir o acesso no runtime. O
runtime continua lendo a publicação vigente sob a política monotônica. Pedidos
anteriores recebem o marcador histórico `{ version: 1, clock: "elapsed_24h",
modules: [] }`, que significa “cronograma não capturado”, sem inventar a oferta antiga.

O snapshot é criado antes da chamada ao Asaas, junto dos demais snapshots comerciais.
Título, ordem e atraso vêm da publicação vigente. Não incluir IDs internos, conteúdo de
Aula, URLs ou PII.

O handoff também recebe um digest SHA-256 do snapshot canônico. Ao iniciar o checkout,
o navegador devolve apenas esse digest. O servidor recalcula o snapshot vigente e exige
igualdade antes de persistir o Pedido ou chamar o Asaas. Se a política mudou enquanto a
compradora lia a página, o request é recusado e a interface pede atualização. O digest
não torna o navegador autoridade: ele apenas comprova que a versão mostrada ainda é a
vigente.

Não adicionar tabela por Aluna × Aula, estado materializado de Módulo desbloqueado,
entidade versionada de cronograma ou entidade de coorte.

### Eventos

Registrar no ledger de Matrícula somente mudanças significativas:

- início ou reinício da entrega programada;
- concessão administrativa de Acesso integral.

O evento administrativo inclui ator e motivo normalizado. Não incluir conteúdo de
Aula, PII desnecessária ou URLs de mídia nos metadados.

## Regra central de disponibilidade

Uma função pura deve receber:

- estado de Matrícula já autorizado;
- `contentReleaseMode`;
- `contentReleaseStartedAt`;
- `releaseDelayDays` do Módulo;
- conclusão da Aula;
- disponibilidade pela sequência;
- relógio injetado.

Ela retorna uma união discriminada:

```text
available
time_locked { availableAt }
sequence_locked
```

Precedência:

1. ausência de direito, publicação ou conteúdo ativos é resolvida antes da função e
   nega acesso;
2. Aula concluída retorna `available`;
3. Matrícula `full_access` ignora tempo;
4. Matrícula `scheduled` sem âncora é estado inválido e nega acesso;
5. prazo temporal não atingido retorna `time_locked`;
6. sequência não satisfeita retorna `sequence_locked`;
7. caso contrário retorna `available`.

`availableAt` é sempre calculado no servidor. O cliente pode formatá-lo, mas não pode
substituir a decisão com `Date.now()`.

## Ciclo da âncora

### Primeiro acesso efetivo

Quando a recomposição transforma ausência de acesso em Matrícula ativa:

- a transação serializa Conta + Curso antes de ler ou criar a projeção;
- se a publicação não contém Módulo com atraso positivo, usar `full_access` e âncora
  `null`;
- se contém atraso positivo, usar `scheduled` e gravar o instante efetivo da concessão;
- pagamento pendente, checkout criado e evento não autoritativo não iniciam o relógio.

### Renovação contínua

Nova Concessão criada enquanto a Matrícula continua efetiva preserva a âncora, mesmo
que amplie a expiração.

### Concessões sobrepostas

Se uma Concessão é reembolsada ou disputada, mas outra continua sustentando acesso sem
interrupção, preservar a âncora. A mudança do menor `starts_at` entre Concessões não
pode re-bloquear conteúdo.

### Bloqueio manual

Bloquear e restaurar Concessões pelo motivo canônico de bloqueio manual preserva a
âncora. O bloqueio impede acesso enquanto vigente, mas não cria nova jornada
pedagógica.

### Perda total e recompra

Reembolso, disputa, cancelamento ou expiração que deixe a Conta sem Concessão efetiva
encerra o episódio. A âncora pode permanecer no histórico da linha revogada, mas uma
nova ativação depois da interrupção deve substituí-la por um novo instante quando o
Curso possuir atraso positivo.

### Retry e reconciliação

Webhook duplicado, retry e conciliação do mesmo Pedido não alteram uma âncora já
definida. Se a conciliação concede pela primeira vez um direito que nunca esteve ativo,
o relógio começa quando o Hub efetivamente libera o acesso.

### Concessão manual

Concessão manual segue o cronograma atual por padrão. Não oferece backdate na primeira
versão. Admin pode usar a operação separada de Acesso integral quando necessário.

## Acesso integral administrativo

Admin com `manageEnrollmentAccess` poderá executar:

> Liberar todos os Módulos desta Matrícula

A operação:

- exige motivo explícito;
- bloqueia a Matrícula durante a mudança;
- define `content_release_mode = full_access` e
  `content_release_started_at = null`;
- registra evento de Matrícula e audit log na mesma transação;
- não altera Concessões, validade, Progresso ou Certificados;
- é idempotente;
- não oferece operação inversa no mesmo episódio de acesso.

Suporte com `manageEnrollmentSupport` pode visualizar âncora e próximas liberações,
mas não executar o override.

## Autoria

O formulário de Módulo no rascunho terá um único grupo “Liberação do conteúdo”:

- opção `Imediatamente`;
- opção `Após` com inteiro em dias;
- ajuda: “Cada dia equivale a 24 horas desde o início do acesso da Aluna.”

A árvore de conteúdo apresenta `Liberação imediata` ou `Liberação em D+N` no cabeçalho
do Módulo. A Aula não repete o indicador.

Salvar um Módulo valida formato e intervalo. A publicação, e não cada operação de
arrastar, é a fronteira transacional que compara o rascunho ao currículo vigente.

## Validação de publicação

Quando existir ao menos um evento histórico de início de entrega programada para o
Curso, publicar deve
comparar cada Aula reconhecida pela `curriculum_key`:

```text
atraso novo <= atraso vigente => permitido
atraso novo > atraso vigente  => recusado
sem Aula vigente equivalente  => Aula nova, permitido
```

A comparação usa o atraso dos Módulos de origem e destino. Assim, cobre simultaneamente:

- edição direta do atraso do Módulo;
- movimentação de Aula;
- remoção e recriação de Módulo;
- combinação de edição e movimentação no mesmo rascunho.

A publicação também recusa uma configuração quando um Módulo obrigatório ficaria
indisponível durante toda a janela de alguma Matrícula agendada afetada. Para novas
vendas, checkout deve recusar configuração em que o cronograma vigente não caiba na
duração comercial anunciada.

O erro deve citar Módulo e Aula afetados sem expor Alunas. A publicação vigente não é
alterada quando qualquer validação falha.

## Experiência da Aluna

### Overview do Curso

Módulos futuros permanecem visíveis como unidades bloqueadas. Mostrar:

- título do Módulo;
- quantidade de Aulas;
- data e hora de liberação em São Paulo;
- texto “Disponível em …”.

Não entregar antes da data:

- links ou IDs navegáveis das Aulas;
- descrições e texto rico;
- URLs de player;
- materiais ou previews;
- comentários.

Módulos liberados mantêm a navegação e a sequência atuais.

### Próximo passo

`nextLessonId` deve apontar apenas para Aula disponível e pendente. Quando todas as
Aulas atualmente disponíveis estiverem concluídas, mas houver Módulo futuro, o Curso
mostra a próxima data de liberação. Não mostra “Curso concluído” nem dispara
Certificado.

### Progresso e Certificado

Todas as Aulas obrigatórias da publicação vigente continuam no denominador, incluindo
as temporalmente bloqueadas. Atraso não transforma Aula obrigatória em opcional.

Como a conclusão protegida rejeita Aulas futuras, o Certificado só pode nascer depois
que todas as Aulas obrigatórias forem liberadas e concluídas. Conclusões e Certificados
históricos não são revertidos.

### URL direta

Abrir diretamente uma Aula futura redireciona para o overview do Curso, que apresenta
o Módulo e sua data. O redirecionamento não inclui título, mídia ou material em query
string.

### Atualização do relógio

Não adicionar contador regressivo, timer permanente ou liberação otimista. Uma nova
navegação ou atualização depois do instante consulta o servidor e libera o Módulo.

## Pontos obrigatórios de enforcement

A mesma decisão deve proteger:

- lista e overview de Cursos;
- sidebar e escolha da próxima Aula;
- rota direta da Aula;
- conclusão manual;
- gravação de Progresso do player;
- leitura e criação de comentários;
- preview e download de materiais R2;
- resolução de URL de vídeo;
- cálculo de conclusão e emissão de Certificado.

Não implementar a política apenas em JSX. Um request com ID conhecido deve receber a
mesma negação que a interface.

Materiais R2 bloqueados respondem como não encontrados. Mutações retornam erro de
domínio sem conteúdo interno. O overview, que já prova a Matrícula, pode exibir
`availableAt`.

## Segurança de mídia

Este projeto protege o momento em que o Hub entrega uma URL ou material. Depois da
entrega:

- URL R2 já emitida continua válida por sua janela curta;
- arquivo baixado não pode ser recolhido;
- URL externa não pode ser revogada pelo Hub;
- player já aberto depende das garantias do JMVStream.

Token de sessão, whitelist de domínio, DRM e watermark JMVStream não fazem parte desta
implementação até serem verificados no plano contratado e no player de Production.
Não anunciar que o drip impede pirataria.

## Comércio, reembolso e transparência

O cronograma não altera Pedido, valor, Concessão, expiração, reembolso ou precedência
financeira.

- reembolso confirmado, disputa e chargeback continuam revogando a origem;
- reembolso em andamento segue a matriz financeira existente;
- evento tardio não reativa Concessão terminal;
- D+N é uma regra de entrega, não uma regra de elegibilidade para reembolso.

Antes de abrir vendas com atraso, a oferta deve informar quais Módulos são imediatos e
quando os demais ficam disponíveis. Checkout e confirmação precisam preservar essa
informação de forma compatível com o contrato anunciado.

O handoff público apresenta o resumo antes de iniciar a criação do Checkout hospedado.
Quando existe atraso positivo, a ação deixa de ser automática e exige o botão
“Continuar para pagamento”. Cursos integralmente imediatos preservam o comportamento
atual. O resumo usa o mesmo snapshot calculado pelo servidor que será persistido no
Pedido; o navegador não envia nem escolhe atrasos. Mudança entre render e clique causa
recusa antes de qualquer mutação e atualização do resumo.

Nenhuma mensagem pode afirmar que assistir determinada porcentagem elimina o direito
legal de arrependimento. A ausência atual de autoatendimento eletrônico de
arrependimento será avaliada em trabalho jurídico/comercial separado; ela não amplia o
escopo técnico deste recurso.

## Falhas e comportamento fail-closed

- atraso inválido => Módulo não é salvo;
- modo `scheduled` sem âncora => negar conteúdo e
  registrar sinal operacional seguro;
- overflow ou data inválida => negar conteúdo;
- publicação mais restritiva => recusar toda a publicação;
- cronograma incompatível com expiração => recusar publicação/checkout conforme a
  origem;
- falha ao calcular overview => fallback de erro existente, sem liberar conteúdo;
- eventual falha de notificação => nenhum efeito sobre acesso.

## Migração e rollout

1. Adicionar `modules.release_delay_days` com `default 0` e constraint não negativa.
2. Adicionar `enrollments.content_release_mode` com `default full_access`, a âncora
   nullable e constraint de consistência.
3. Adicionar o snapshot comercial ao Pedido; Pedidos antigos recebem `modules: []`.
4. Matrículas existentes permanecem `full_access` com âncora `null`.
5. Copiar `release_delay_days` ao clonar publicação.
6. Implantar leitura e enforcement ainda com todos os Módulos em `D+0`.
7. Configurar cronograma em rascunho e publicar.
8. Somente novas ativações posteriores seguem o cronograma.

O rollout não requer backfill por Aula, job de desbloqueio ou alteração de Progresso.

## Testes exigidos

### Regras puras

- `D+0` disponível;
- um instante antes de D+8 bloqueado;
- exatamente em D+8 disponível;
- modo `full_access` com âncora `null` concede Acesso integral;
- modo `scheduled` sem âncora é rejeitado;
- Aula concluída permanece disponível;
- tempo vencido com sequência pendente retorna `sequence_locked`;
- relógio do navegador não participa da decisão.

### Matrícula e concorrência

- primeira ativação agendada define a âncora uma vez;
- Curso integral mantém `null`;
- renovação contínua preserva;
- Concessões sobrepostas preservam quando uma é revogada;
- bloqueio/restauração manual preserva;
- perda total e recompra reiniciam;
- duplicata/retry não reiniciam;
- override Admin é idempotente e auditável;
- Suporte não pode executar override.

### Publicação

- clone preserva atraso do Módulo;
- diminuir atraso é permitido;
- aumentar atraso após Matrícula agendada é recusado;
- mover Aula para atraso maior é recusado;
- mover para atraso igual ou menor é permitido;
- Aula nova em Módulo futuro é permitida;
- falha preserva publicação vigente;
- cronograma posterior à expiração é recusado.

### Superfícies

- overview mostra Módulo futuro sem conteúdo interno;
- URL direta redireciona;
- progresso, conclusão, comentários e materiais negam bypass;
- próxima Aula não atravessa Módulo futuro;
- próxima data aparece quando não há Aula disponível;
- Certificado não nasce antes do último Módulo obrigatório;
- preview Admin ignora tempo sem gravar Progresso.

### Integração e E2E

- migrations em PostgreSQL descartável;
- transições reais da projeção sob transação;
- jornada com relógio controlado, sem espera real de oito dias;
- compra nova recebe cronograma e Matrícula histórica mantém acesso integral.
- handoff com atraso exige confirmação e persiste exatamente o snapshot exibido;
- handoff integralmente imediato preserva o início automático atual.

## Fora do escopo

- configuração por Aula;
- coortes, turmas ou grupos de entrega;
- data/hora absoluta;
- liberação por quiz, nota ou percentual;
- expiração por Módulo;
- cron de desbloqueio;
- e-mail ou push de novo Módulo;
- cronogramas simultâneos para o mesmo Curso;
- restauração do bloqueio depois de Acesso integral;
- DRM, watermark ou limite de sessões;
- coleta adicional de dados antifraude;
- mudança do fluxo de arrependimento/reembolso.

## Critérios de aceite

- Matrículas existentes não perdem conteúdo.
- Nova Matrícula começa um cronograma somente quando o Curso possui atraso positivo.
- Módulo abre exatamente no instante UTC calculado.
- Aula não pode contornar o bloqueio por URL, action, comentário, vídeo ou material.
- Renovação contínua, Concessão sobreposta e retry não reiniciam a âncora.
- Recompra depois de perda total reinicia.
- Publicação nunca aumenta silenciosamente o atraso de Aula existente.
- Admin pode conceder Acesso integral uma vez, com motivo e auditoria.
- Suporte pode diagnosticar, mas não alterar a política.
- Progresso e Certificado permanecem coerentes com Módulos futuros.
- Nenhum scheduler é necessário para o acesso.
- Oferta comunica o cronograma antes de novas vendas.
- Pedido preserva o snapshot exato do cronograma apresentado.
