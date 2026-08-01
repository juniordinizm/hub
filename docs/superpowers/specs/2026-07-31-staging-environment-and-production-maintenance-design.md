---
status: accepted
owner: engineering
last_verified_commit: 9419c09b9c7f4a4f3f977e896f51374548080dd8
---

# Staging persistente e manutenção integral de Production

## Contexto

O Hub possui quatro perfis operacionais:

- Development compartilhado, executado localmente ou por túnel;
- E2E efêmero e automatizado;
- Preview técnico, efêmero, sem credenciais de providers;
- Production persistente.

O Preview atual comprova build e readiness na Vercel, mas não permite homologar as
jornadas reais do produto. Seus guardas recusam Asaas, JMVStream, R2, Resend,
Sentry, cadastro público e jobs. Usar uma URL de Preview como ambiente funcional
também mistura deployments transitórios com dados persistentes.

A responsável precisa testar, antes de Production, cadastro público, administração de
Cursos, uploads, checkout Asaas Sandbox, webhooks, ativação de Conta, matrículas,
progresso, certificados e e-mails. Production deve permanecer indisponível a todos os
usuários enquanto essa homologação acontece.

Esta especificação define a arquitetura aprovada. Ela não autoriza commit, push,
criação de infraestrutura, alteração de DNS ou deploy por si só.

## Objetivos

- Criar um Custom Environment Vercel persistente chamado `staging`.
- Associar a branch persistente `staging` ao domínio
  `preview.neurocapacitar.com.br`.
- Executar no Staging todas as jornadas funcionais com providers reais de teste.
- Isolar banco e configuração financeira de Production.
- Permitir cadastro público a qualquer pessoa que conheça a URL do Staging.
- Colocar toda a experiência Production em manutenção, sem exceção para Admin.
- Manter somente health, readiness e operações internas autenticadas acessíveis em
  Production.
- Promover código por `feature -> staging -> main`, com homologação manual.
- Separar merge em `main` do deploy manual de Production.
- Desativar o Preview técnico depois que o primeiro ciclo Staging estiver validado.

## Fora de escopo

- Copiar dados do Staging para Production.
- Usar chave Asaas Production antes da abertura comercial.
- Criar novos buckets R2, conta Resend ou plano JMVStream.
- Proteger o Staging por convite, senha compartilhada ou allowlist de e-mail.
- Aplicar retenção ou limpeza automática aos dados Staging.
- Dar acesso a Admin, Suporte ou Aluna durante a manutenção de Production.
- Excluir o alvo padrão Preview da plataforma Vercel, que continuará existindo
  nominalmente.

## Topologia de ambientes

### Development

Development mantém o contrato atual:

- branch Neon `development`;
- buckets `hub-development-private` e `hub-development-public`;
- Asaas Sandbox;
- domínio e credencial Resend compartilhados;
- plano JMVStream Production compartilhado por decisão operacional;
- Sentry Development.

### E2E

E2E continua efêmero, automatizado e sem chamadas reais aos providers. Nenhum estado
E2E é promovido.

### Preview técnico

O Preview técnico será desativado:

- nenhum workflow criará deployment ou branch Neon de Preview;
- nenhuma credencial será atribuída ao alvo Preview;
- deployments automáticos de branches não associadas serão impedidos;
- os guardas Preview poderão permanecer como defesa dormente;
- ambiente, secrets e recursos remanescentes só serão removidos depois do primeiro
  ciclo Staging aprovado.

### Staging

Staging será um Custom Environment no projeto Vercel existente:

- slug `staging`;
- branch matcher exato para `staging`;
- domínio estável `preview.neurocapacitar.com.br`;
- banco Neon persistente e exclusivo;
- providers configurados conforme esta especificação;
- dados integralmente descartáveis;
- cadastro público habilitado;
- jobs habilitados por agendador externo à Vercel Cron.

O hostname escolhido contém `preview`, mas o ambiente funcional continua se chamando
Staging. Código e documentação devem usar `staging` como identidade; `preview` é
somente parte do domínio público.

### Production

Production permanece associada a `main`, mas entra em manutenção integral:

- nenhuma página, login ou área Admin fica disponível;
- Server Actions e APIs públicas são bloqueadas;
- navegação recebe página de manutenção;
- APIs bloqueadas respondem `503`;
- checkout, cadastro e webhook Asaas permanecem desligados;
- jobs Production permanecem desligados durante a manutenção;
- health, readiness e operações internas autenticadas permanecem roteáveis;
- assets necessários para renderizar a manutenção permanecem acessíveis.

A chave Asaas Sandbox cadastrada anteriormente em Production deve ser removida.
Production não exige chave ou token Asaas enquanto checkout e webhook estiverem
desligados.

## Identidade e validação do runtime

Staging será detectado por `VERCEL_TARGET_ENV=staging`. `VERCEL_ENV` não é autoridade
suficiente, pois um Custom Environment pode pertencer ao tipo técnico `preview`.

O runtime terá um contrato explícito para Staging e falhará antes de atender tráfego
quando encontrar:

- `VERCEL_TARGET_ENV` diferente de `staging`;
- URL canônica diferente de `https://preview.neurocapacitar.com.br`;
- conexão com o banco Production;
- base Asaas diferente de `https://api-sandbox.asaas.com`;
- chave Asaas com formato Production;
- cadastro público desligado;
- ausência de valores explícitos para checkout, webhook ou jobs;
- ausência das confirmações explícitas de compartilhamento de R2, Resend e
  JMVStream.

Mensagens de validação exibem somente nomes de variáveis e classificações seguras.
Nunca exibem credenciais, connection strings, destinatários ou tokens.

Checkout, webhook e jobs preservam kill switches operacionais. O runtime aceita o
estado explicitamente desligado durante contenção de incidente; o gate de homologação,
e não o startup, exige que os três estejam habilitados antes do aceite funcional.

Production terá uma variável explícita de manutenção. A validação Production exige
combinação coerente entre manutenção, cadastro, checkout, webhook e jobs. Uma
configuração parcialmente aberta deve falhar fechada.

## Acesso e indexação do Staging

Qualquer pessoa que receba a URL poderá:

- criar Conta;
- autenticar;
- recuperar senha;
- acessar jornadas autorizadas à sua função;
- comprar Cursos pelo Asaas Sandbox.

A URL não é tratada como mecanismo de segurança. Ainda assim, o Staging:

- envia `X-Robots-Tag: noindex, nofollow`;
- publica metadados `noindex`;
- não aparece em sitemap;
- apresenta indicação visual permanente de ambiente de teste;
- mantém as proteções gerais já existentes na aplicação.

Não serão adicionados convite, allowlist, limite de envio Resend ou rate limit
exclusivo de Staging. Proteções gerais existentes não serão removidas.

`noindex` é uma solicitação aos crawlers, não uma garantia de sigilo ou remoção
imediata de índices externos. A URL continua pública e deve ser tratada como tal.

## Banco e ciclo de dados

O banco Staging será criado limpo, receberá todas as migrations e terá um Admin
próprio. Nenhuma Conta, credencial ou dado Production será clonado.

Os dados são descartáveis, mas não terão expiração automática. A limpeza ocorre
somente sob demanda para não interromper uma homologação ativa.

Um procedimento manual de reset deve:

1. confirmar inequivocamente o banco Staging;
2. criar backup Neon antes de uma limpeza material;
3. limpar dados sem tocar em outro ambiente;
4. reaplicar migrations quando necessário;
5. recriar o Admin Staging;
6. produzir somente contagens e identificadores não sensíveis.

Dados Staging nunca são copiados para Production. Promoção leva apenas código,
migrations e configuração revisada.

## Integrações

### Asaas

Staging usa:

- endpoint Sandbox;
- chave Sandbox;
- User-Agent canônico do projeto;
- token de webhook exclusivo;
- webhook em
  `https://preview.neurocapacitar.com.br/api/webhooks/asaas`;
- checkout público habilitado;
- worker de webhook habilitado.

O checkout hospedado e a compra pública preservam o contrato homologado:

1. landing page externa usa o link público do Curso;
2. a Compradora abre o checkout Asaas Sandbox;
3. o Asaas entrega eventos ao webhook Staging;
4. a inbox persiste o evento antes de responder sucesso;
5. o worker projeta Pedido, Concessão e Matrícula;
6. o e-mail da compra vincula ou cria a Conta;
7. a Compradora ativa a credencial e acessa o Curso.

Preço, métodos, parcelamento e juros continuam definidos por Curso. Nenhuma
configuração financeira Staging é promovida como dado Production.

### Cloudflare R2

Staging reutiliza:

- `hub-development-private`;
- `hub-development-public`;
- a credencial Development já aprovada.

Objetos criados pelo Staging recebem prefixo `staging/`. O prefixo deve ser aplicado
de forma consistente a uploads temporários, materiais, capas, banners, publicação e
certificados. A limpeza Staging nunca percorre nem remove chaves fora desse namespace.

O CORS do bucket privado passa a aceitar
`https://preview.neurocapacitar.com.br`, preservando as origens Development atuais.
O valor exato aplicado deve ser lido e verificado antes de qualquer alteração.

### JMVStream

Staging reutiliza o mesmo plano, resource e credenciais usados por Production e
Development. Não haverá nova allowlist, plano, credencial ou guarda externa.

O banco Staging registra seus próprios folders, sessões e hashes, mas o provider não
oferece isolamento técnico entre ambientes nesta decisão. A responsável aceitou que
uma alteração acidental possa ser corrigida pelo painel JMVStream.

Nenhuma rotina de reset Staging apaga vídeos JMVStream automaticamente. Exclusões são
manuais e conferidas no painel.

### Resend

Staging reutiliza a estrutura atual:

- mesma conta;
- mesma credencial;
- mesmo domínio verificado;
- mesmo remetente;
- mesma caixa de suporte.

Não haverá allowlist, limite diário, remetente específico ou configuração adicional
para Staging. O risco aceito é que qualquer pessoa com a URL possa provocar envios
reais e afetar cota ou reputação do domínio.

### Sentry

Staging reutiliza o projeto Sentry Development. Eventos devem ser classificados com
`environment=staging` para permitir filtro operacional sem criar outro projeto.

## Jobs do Staging

Custom Environments não executam Vercel Cron. Um workflow GitHub Actions chama os
endpoints Staging com `CRON_SECRET` exclusivo:

- Asaas webhooks, outbox e JMVStream a cada cinco minutos;
- matrículas no horário diário vigente;
- manutenção no horário diário vigente.

O GitHub Actions tem intervalo mínimo de cinco minutos e pode atrasar ou descartar
execuções sob carga. A responsável aceitou que uma compra Sandbox possa levar alguns
minutos para liberar acesso.

Os endpoints preservam autenticação, advisory locks, leases, idempotência e deadlines.
O scheduler não substitui essas garantias.

## DNS

Depois que o Custom Environment e o domínio forem associados na Vercel:

1. consultar o registro exigido pela Vercel;
2. abrir Hostinger em Domínios, DNS/Nameservers e Registros DNS;
3. criar CNAME com nome `preview` e destino exatamente igual ao informado pela
   Vercel;
4. preservar registros não conflitantes;
5. remover registro `A`, `AAAA` ou `CNAME` de `preview` somente se a inspeção provar
   conflito;
6. aguardar propagação;
7. confirmar domínio verificado e certificado HTTPS na Vercel.

Não é necessário criar um website ou subdomínio no plano de hospedagem Hostinger.
Se os nameservers autoritativos não forem da Hostinger, o registro pertence ao
provedor DNS efetivo.

## CI/CD e promoção

### Feature para Staging

Pull Requests executam:

- lint e formatação;
- typecheck;
- testes unitários e de integração;
- regras arquiteturais;
- verificação documental;
- build;
- E2E efêmero.

Pull Requests não criam deployment Vercel.

O merge em `staging`:

1. valida identidade, variáveis e recursos;
2. cria backup Neon anterior a migrations materiais;
3. aplica migrations no banco Staging;
4. executa `vercel deploy --target=staging`;
5. valida domínio, health, readiness e `noindex`;
6. preserva o deployment anterior para rollback.

### Staging para Production

A promoção usa Pull Request de `staging` para `main` e repete todas as verificações.
O merge não dispara deploy Production.

O workflow manual Production:

- aceita somente SHA existente em `main`;
- exige confirmação literal e explícita;
- usa o GitHub Environment Production;
- valida alvo e configuração antes de migration;
- cria backup Neon;
- aplica somente migrations aprovadas;
- publica o SHA confirmado;
- executa health/readiness;
- confirma que o modo manutenção permaneceu ativo.

## Sequência de implantação

1. Aprovar esta especificação.
2. Criar e aprovar um plano de implementação granular.
3. Remover a credencial Asaas Sandbox indevida de Production.
4. Implementar contrato Staging e manutenção Production com testes.
5. Criar branch Git `staging`.
6. Criar banco Neon Staging e Admin próprio.
7. Criar Custom Environment Vercel e associar a branch.
8. Configurar variáveis e secrets Staging.
9. Associar o domínio e configurar DNS Hostinger.
10. Atualizar CORS R2 sem remover origens existentes.
11. Cadastrar webhook Asaas Sandbox no domínio estável.
12. Configurar scheduler GitHub Actions.
13. Publicar e homologar Staging.
14. Ativar manutenção integral em Production e verificar as exceções técnicas.
15. Alterar o fluxo de promoção para deploy Production manual.
16. Desativar deployments Preview.
17. Remover recursos Preview somente depois do primeiro ciclo aprovado.

## Falhas e recuperação

- Contrato Staging incoerente: startup falha antes de atender tráfego.
- DNS não verificado: não habilitar webhook nem divulgar a URL.
- Migration Staging falhou: não publicar; restaurar backup ou corrigir adiante.
- Deploy Staging falhou: manter deployment anterior.
- CORS R2 falhou: restaurar política anterior e reaplicar preservando origens.
- Scheduler atrasou: worker idempotente processa o backlog na execução seguinte.
- Webhook duplicado ou fora de ordem: precedência e idempotência do domínio decidem o
  estado, nunca a ordem de chegada.
- Provider compartilhado falhou: preservar referência local e reconciliar; não fazer
  limpeza ampla.
- Production deixou de responder manutenção: rollback imediato do deployment ou
  reativação do kill switch antes de qualquer investigação pública.
- Deploy Production falhou depois de migration: manter manutenção e fazer
  forward-fix; não restaurar banco destrutivamente por padrão.

## Verificação

### Automática

- detecção de `VERCEL_TARGET_ENV=staging`;
- rejeição de URL, banco e Asaas incompatíveis;
- rejeição de configuração Production parcialmente aberta;
- roteamento de manutenção para página, API e Server Action;
- exceções estritas de health/readiness e crons autenticados;
- namespace R2 Staging em todas as classes de objeto;
- workflow Staging sem secrets em logs;
- workflow Production manual e desacoplado do merge;
- ausência de deploy Preview;
- cabeçalhos e metadados `noindex`;
- testes integrais, build, Ultracite, arquitetura e documentação.

### Homologação manual

- cadastro, login e recuperação de senha;
- criação, edição, publicação e link público de Curso;
- upload R2 e JMVStream;
- preço, PIX, cartão, parcelamento e juros por Curso;
- compra pública PIX e cartão no Sandbox;
- webhook duplicado, atrasado e fora de ordem;
- ativação pós-compra e normalização de e-mail;
- matrícula, progresso, certificado e download;
- outbox e e-mail Resend;
- jobs e recuperação de backlog;
- reset manual de dados;
- Production em manutenção para visitante, Aluna, Suporte e Admin;
- health/readiness Production ainda operacionais;
- Staging ausente do sitemap, com cabeçalhos `noindex` confirmados e consulta manual
  aos principais mecanismos registrada como verificação de melhor esforço.

## Critérios de aceite

- Especificação e plano aprovados.
- Custom Environment, branch, domínio e banco Staging confirmados.
- Nenhum dado Production copiado.
- Asaas Sandbox comprovado ponta a ponta.
- Uploads, e-mails, vídeo, progresso e certificado comprovados.
- Production integralmente fechada, exceto endpoints técnicos autorizados.
- Merge em `main` incapaz de publicar Production automaticamente.
- Deploy Production exige ação manual e SHA confirmado.
- Preview técnico sem deployment ou credenciais.
- Runbooks canônicos atualizados.
- Todas as verificações relevantes verdes.
