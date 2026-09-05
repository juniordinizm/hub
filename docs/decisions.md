---
status: canonical
owner: product
last_verified_commit: 4125866
---

# Registro de decisões de produto

## Como ler

- **Implementado:** comprovado no `HEAD`.
- **Aprovado:** trade-off ratificado em ADR aceito ou decisão explícita registrada neste
  documento.
- **Aguardando ratificação:** código escolheu política sem aprovação documentada.
- **Pendente:** ainda não há resposta suficiente.

Implementação não promove política a aprovada sozinha.

## DEC-DISC-001

**Tema:** entrega de e-mail.
**Estado:** implementado no fluxo Asaas.

A intenção durável de ativação guarda somente `userId` e `orderId`, sem outros dados
pessoais, token ou URL de callback. No processamento, o worker resolve a Conta e chama Better Auth
`requestPasswordReset`; o token nasce somente durante o envio. Falha de resolução ou
entrega mantém a intenção elegível para retry, sem persistir o token.

`auth.account-activation` implementa a intenção sem PII e resolve os dados no delivery. O
processor financeiro Asaas escolhe e enfileira essa intenção no mesmo commit do acesso.
Os demais e-mails transacionais mantêm o contrato descrito em
[Outbox e efeitos transacionais](operations/outbox-and-transactional-effects.md).

## DEC-DISC-002

**Tema:** precedência financeira.
**Estado:** aprovado e implementado no fluxo Asaas.

`CHECKOUT_PAID` não libera. PIX libera em `PAYMENT_RECEIVED`; cartão libera em
`PAYMENT_CONFIRMED` quando não há risco pendente ou reprovado. Aprovação posterior pode
destravar confirmação armazenada. Reembolso confirmado, disputa e chargeback
prevalecem e revogam. Pago tardio não reativa estado adverso; cancelamento ou expiração
tardios não revogam Pedido pago. Evento parcial, desconhecido, regressivo ou contraditório
abre revisão ou alerta. Ver
[ADR-0005](adr/0005-financial-precedence-and-manual-review.md).

`decideAsaasFinancialEvent`, em `src/features/payments/asaas-financial-events.ts`,
materializa a matriz como decisão pura, sem SQL ou efeitos de acesso.
`processAsaasWebhookEvent` aplica a decisão sob lock na transação do worker.

## DEC-DISC-003

**Tema:** divergência de valor.
**Estado:** aprovado e implementado no fluxo Asaas.

O valor bruto Asaas `value` deve coincidir exatamente com o snapshot do Pedido em
centavos, com tolerância zero. Divergência não libera acesso e abre revisão. Decisão manual
exige permissão, motivo e auditoria. A comparação e o código seguro da revisão são
produzidos por `decideAsaasFinancialEvent`; o processor persiste a Revisão idempotente
por Webhook.

## DEC-DISC-004

**Tema:** conclusão de Aula e Curso.
**Estado:** aprovado e implementado.

Toda Aula obrigatória pode ser concluída manualmente sem mínimo de visualização. Evento JMVStream válido em 98% ou mais também conclui automaticamente. Curso conclui quando todas as Aulas obrigatórias da publicação vigente estão concluídas; opcionais não entram no denominador. Certificado prova conclusão histórica, não domínio de conteúdo nem currículo vivo atual.

## DEC-DISC-005

**Tema:** currículo vivo, coortes e liberação temporal.
**Estado:** currículo e liberação temporal implementados e cobertos por testes de domínio, checkout, enforcement e integração PostgreSQL quando o ambiente descartável está disponível.

`Course` é identidade comercial; `CoursePublication` é revisão interna em lote. Matrícula ativa sempre recebe a publicação vigente; Curso novo e refilmado é novo produto e nova compra/concessão. A primeira conclusão é histórica por Aluna + Curso; certificado permanece válido após atualização de conteúdo e não é reemitido automaticamente.

Não haverá coorte. A necessidade real foi delimitada a liberação relativa por Módulo: `D+N` equivale a `N × 24 horas` em UTC desde o início do episódio contínuo de entrega. Renovação preserva a âncora; recompra após perda total reinicia. Matrículas anteriores ao rollout mantêm acesso integral. Depois da primeira Matrícula agendada, publicação pode reduzir atrasos, mas não aumentar o atraso efetivo de Aula existente, inclusive por movimentação. Admin pode liberar integralmente uma Matrícula com motivo e auditoria, sem restauração do bloqueio no mesmo episódio. Ver [ADR-0007](adr/0007-course-versioning-and-enrollment-curriculum.md), [ADR-0010](adr/0010-relative-module-content-release.md) e a [especificação aceita](superpowers/specs/2026-09-04-module-content-release-design.md).

## DEC-DISC-006

**Tema:** ciclo de Certificados.
**Estado:** aprovado e implementado.

Certificado tem snapshots, código público, estado válido/revogado e reemissão. Revogado bloqueia emissão automática; somente reemissão manual cria novo válido. Admin pode emitir, revogar e reemitir com confirmação e motivo: correção de identidade, snapshot de Curso, duplicidade/falha técnica, elegibilidade, integridade, obrigação legal/conformidade ou outro motivo documentado. `support` pode somente reemitir o Certificado existente mais recente da Aluna no Curso, com confirmação, motivo e auditoria; não pode emitir, revogar nem reconciliar manualmente. Essa separação, ratificada no [DEC-DISC-014](#dec-disc-014), está implementada com bloqueio transacional do registro mais recente e negação servidor-side. `/certificados/[code]` é a página canônica para validação, preview e compartilhamento. O PDF só pode ser obtido publicamente quando o Certificado está `valid` e `ready`, por rota rate-limited que verifica o hash e entrega URL assinada curta; `pending`, `failed` e `revoked` não oferecem download. A revogação bloqueia novos downloads, sem prometer recolher cópias já obtidas. O verificador público mostra status, data e categoria legível, sem detalhes internos. O e-mail aponta para a página canônica; Curso é a entrada contextual e `/app/certificados` o arquivo global autenticado. Ver [ADR-0006](adr/0006-certificate-lifecycle.md).

## DEC-DISC-007

**Tema:** identidade, verificação e recuperação.
**Estado:** aprovado e implementado em código; homologação PostgreSQL/Sandbox pendente.

No checkout autenticado, a Conta é a da sessão; o provider não pode alterar nome, e-mail,
verificação ou credenciais. No checkout público, o Pedido nasce sem PII e o Asaas coleta
os dados do pagador. Depois do evento financeiro autoritativo, o Hub consulta o cliente
Asaas, persiste uma vez somente nome/e-mail necessários e registra Compradora = Aluna. O
provider informa identidade pretendida, mas não verifica Conta.

O e-mail normalizado vincula o Pedido a uma Conta Student existente ou cria Conta local
não verificada; a ativação permite definir a senha. Conta existente não é sobrescrita.
Identidade ausente, inválida, divergente, pertencente a Admin/Suporte, vinculada a Conta
com bloqueio geral ou a Matrícula `revoked` no Curso não concede acesso: abre Revisão sem
opção de aprovação e permite somente reembolso integral e nova compra elegível. Quando a
sessão já revela bloqueio ou revogação, o Checkout é impedido antes da cobrança e a pessoa
é orientada ao Suporte. Transferência manual e compra para terceiro ficam fora do escopo.

A entrada comercial é um link estável do Hub em `/comprar/[slug]`, copiado da configuração
do Curso e usado pela landing page externa. O handoff não possui formulário ou segundo
clique visível em condições normais, mas cria a tentativa por `POST` para evitar que o
`GET` de robôs e previews produza Checkout. Ver a
[especificação aceita](superpowers/specs/2026-07-30-public-course-purchase-handoff-design.md).

## DEC-DISC-008

**Tema:** retenção, privacidade e acessibilidade.
**Estado:** manutenção técnica implementada; política jurídica de dados pendente.

O workflow de solicitações e anonimização foi removido: não havia solicitante, operação administrativa recorrente ou plano aprovado. O cron de manutenção preserva apenas limpeza técnica de sessões, rate limits, analytics e mensagens de suporte (expiradas após 90 dias desde 2026-08-22). Se houver pedido real no futuro, será necessário definir política jurídica, fluxo e auditoria antes de criar nova funcionalidade. Ledger financeiro e evidências necessárias para auditoria/defesa não devem ser apagados por atalho.

## DEC-DISC-009

**Tema:** analytics de aprendizagem padrão com opt-out.
**Estado:** aprovado, implementado e ratificado juridicamente em 2026-08-21.

Para a plataforma pequena atual, analytics técnico minimizado fica habilitado por padrão, sem modal, consentimento ou área dedicada. A Aluna tem controle claro em **Conta > Configurações** para desligar análises opcionais. Desativar remove eventos brutos identificáveis, bloqueia eventos futuros e exclui a Aluna das consultas analíticas; não altera acesso, sequência, progresso, conclusão ou Certificado.

Admin vê somente métricas agregadas por Aula e `CoursePublication`. Não há lista nominal de inatividade, reengajamento manual, contato automático ou CRM analítico. Retenção é 90 dias para eventos brutos e 13 meses para métricas agregadas. Ver [ADR-0008](adr/0008-optional-learning-analytics.md).

A ratificação jurídica exigida por esta decisão foi concedida pelo responsável de produto em 2026-08-21, cobrindo base legal, transparência, prazos e canal de direitos declarados na política de privacidade pública.

## DEC-DISC-010

**Tema:** preço mínimo de Curso pago.
**Estado:** aprovado e implementado.

Curso pago custa no mínimo `1000` centavos, equivalentes a R$ 10. A autoria valida o
limite ao criar ou editar o Curso, e o checkout repete a validação antes de persistir o
Pedido ou chamar o provider. Dados de teste abaixo desse mínimo devem ser ajustados ou
removidos.

Em 2026-07-28, o sandbox Asaas rejeitou uma tentativa de R$ 1 com `invalid_object` e
mínimo de R$ 10. Autoria e checkout validam o mesmo limite no Hub. Ver
[Comércio e acesso](domain/commerce-and-access.md#reg-com-001-pedido-preserva-o-contrato-vendido)
e [Asaas](integrations/asaas.md).

## DEC-DISC-011

**Tema:** oferta de pagamento configurável por Curso.
**Estado:** decisão final ratificada em 2026-08-21; preço único com taxas absorvidas pela Vendedora.

Cada Curso pago deve possuir configuração própria de preço e oferta:

- Pix, cartão ou ambos;
- cartão à vista ou parcelado;
- quantidade máxima de parcelas definida pelo Admin, entre 1 e 12;
- preço único para Pix e cartão, independentemente da quantidade de parcelas;
- taxas de pagamento e parcelamento absorvidas pela Vendedora.

O padrão inicial é Pix + cartão e cartão em até 3x. Preço e oferta
efetiva devem ser copiados para o Pedido, para que a edição posterior do Curso não altere
o contrato vendido.

O Asaas Checkout recebe um único valor de item para Pix e cartão. Ele documenta
`billingTypes`, `chargeTypes=INSTALLMENT` e `installment.maxInstallmentCount`, mas não
documenta, por sessão, a escolha de quem absorve o custo do parcelamento nem valores
diferentes por método. O campo `interest` das APIs de cobrança significa juros por
atraso. Portanto, o Admin configura métodos e teto de parcelas; o Hub envia o mesmo total
em todos os métodos e a Vendedora absorve as taxas descontadas do recebível. O teto
comercial do Hub é 12x, mesmo que contratos ou bandeiras específicos do provider admitam
mais.

Cada parcela possui ID de pagamento próprio. O Hub correlaciona o
`provider_installment_id`, valida o bruto do agregado antes de conceder acesso, aceita os
IDs individuais sob esse agregado, concilia a lista completa e estorna o parcelamento
integral pelo endpoint específico. A migration
`0053_course_payment_offers` adiciona a configuração do Curso e os snapshots do Pedido;
`0055_limit_course_installments` reduz configurações vigentes acima de 12x e passa a
impedir novos valores fora do teto comercial, sem reescrever snapshots históricos.

Ver a
[pesquisa da configuração comercial do Checkout Asaas](reviews/2026-07-30-asaas-payment-configuration-research.md).

## DEC-DISC-012

**Tema:** disponibilidade comercial e interesse de venda.
**Estado:** aprovado e implementado em código.

Entrega, vitrine e novas vendas são dimensões independentes. Vendas pausadas
preservam Matrículas efetivas e podem ser ocultadas. “Em breve” coleta interesse
autenticado sem Pedido ou acesso. Abrir vendas avisa pela outbox; fechar vendas
cancela Checkouts ativos. Ver [ADR-0009](adr/0009-course-availability-and-sale-interest.md).

## DEC-DISC-013

**Tema:** gestão contextual de Alunas no painel Admin.
**Estado:** aprovado e implementado em código.

`/admin/alunos` permanece como lista canônica. A ficha de uma Aluna abre em um
`StudentManagementSheet` lateral, sem estado de seleção na URL, e carrega os dados sob
demanda por GET administrativo protegido. O mesmo Sheet é usado pela aba de Alunos do
Curso: a lista geral mostra plataforma, todas as Matrículas e todos os Certificados;
o contexto do Curso mostra somente a Matrícula e os Certificados daquele Curso.

Os dialogs anteriores de Aluna e Matrícula são substituídos pelo Sheet compartilhado.
Mutação mantém o Sheet aberto, refaz a leitura e mostra confirmação. A rota individual
`/admin/alunos/[userId]` é removida e acessos antigos retornam 404; autorização das
actions e regras de domínio não mudam.

## DEC-DISC-014

**Tema:** escopo definitivo do papel `support`.
**Estado:** aprovado em 2026-08-23 e implementado em código no Sprint 1.
Em 2026-09-01, o produto decidiu não adotar MFA administrativo neste momento;
a implementação ativa foi removida e as migrations históricas foram preservadas.

`support` é uma função operacional distinta de `student` e `admin`, autorizada a:

- abrir o painel operacional e consultar contagens de Cursos e Alunas por Curso;
- consultar identidade mínima, Matrícula, progresso, Certificados, Pedidos e
  histórico auditável restrito à Aluna e ao Curso;
- ajustar validade e bloquear ou restaurar uma Matrícula, sempre com motivo e
  auditoria;
- consultar toda a operação financeira da plataforma, incluindo receita,
  Pedidos, disputas, reembolsos e Revisões;
- executar reembolso integral após confirmação recente de senha, digitação do
  identificador do Pedido, motivo e auditoria;
- reemitir somente o Certificado existente mais recente da Aluna no Curso.

`support` não pode administrar Curso, conteúdo, preço, disponibilidade, template,
banner, FAQ, configuração ou provider; acessar analytics pedagógico detalhado ou
exportá-lo; alterar Conta, Perfil, papel ou bloqueio de plataforma; emitir,
revogar ou reconciliar Certificado; conciliar pagamento, importar extrato ou
decidir Revisão; reenfileirar webhook/outbox; moderar conteúdo ou consultar a
auditoria global.

O alvo usa capacidades positivas granulares e autorização em cada página, Route
Handler, Server Action, projeção e exportação. Navegação oculta não substitui a
negação no servidor. A matriz central, as projeções operacionais e as mutações
estão implementadas no branch de remediação. Admin e `support` usam sessão Better
Auth e RBAC; MFA administrativo não é requisito do produto atual. Uma adoção
futura exigirá nova decisão e especificação próprias. Mudança de papel revoga
sessões existentes.

## DEC-DISC-015

**Tema:** e-mails fora da outbox.
**Estado:** aprovado e ratificado em 2026-08-21 pelo responsável de produto.

Somente a recuperação pública de senha permanece fora da outbox, por decisão de
segurança: a URL contém token secreto e não deve ser persistida na fila. A falha de
envio nesse caminho é apenas registrada em log e a Aluna precisa solicitar de novo.
Ativação legada de conta e mensagem do formulário de suporte são entregues pela outbox
com retentativa, idempotência e dead-letter; o suporte migrou para a outbox no PR do
Sprint 1 de 2026-08-21, com o agregado `support_requests`.

## DEC-DISC-016

**Tema:** compartilhamento consciente de providers entre ambientes.
**Estado:** risco aceito formalmente em 2026-08-22 pelo responsável de produto.

Development e Staging compartilham recursos de Production em dois providers, por decisão
explícita e não por acidente:

- JMVStream: o plano Production `OD-20912` é reutilizado por Development e Staging;
  não há isolamento técnico entre vídeos de teste e reais. A regra operacional proíbe
  remoção/movimentação de ativos preexistentes e exige vídeos descartáveis.
- Resend: o domínio verificado `neurocapacitar.com.br` é compartilhado; Development e
  Staging permanecem restritos por allowlist de destinatários.

Owner: engenharia. Mitigações: allowlists por ambiente, remetente identificado com
sufixo Dev em Development, guarda de ambiente que rejeita credenciais fora do escopo
aprovado. Reabrir se um terceiro passar a operar os ambientes ou se um provider oferecer
isolamento sem custo adicional.
## Outras ratificações necessárias

- tratamento de compra pública com e-mail já pertencente a Admin/Suporte;
- critérios de incidente e SLOs;
- uso de provedores externos; racional histórico não localizado.

Ratificações concluídas em 2026-08-21 pelo responsável de produto:

- DEC-DISC-005: a ausência de coorte foi ratificada com vendas reais ativas; publicar
  altera a experiência de todas as Matrículas elegíveis e isso é aceito. Reabrir somente
  com calendário ou turma real.
- DEC-DISC-009: analytics ratificado juridicamente; a base legal, a transparência e os
  prazos declarados na política de privacidade pública foram confirmados como aprovados.
- DEC-DISC-011: decisão final; preço único com custo do parcelamento absorvido pela
  Vendedora. Reabrir somente com dados reais de venda que justifiquem acréscimo
  comercial por parcelamento.
- Escopo de `support`: ver DEC-DISC-014.
- Reversão de ajustes encadeados: encerrada por remoção; `reverseExpirationAdjustment`
  foi deletada como código inalcançável e a REG-COM-006 registra o histórico.
