---
status: canonical
owner: product
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Produto PROTEA-R Hub

## Propósito

Centralizar a venda, entrega e operação de cursos da PROTEA-R. O Hub deve permitir que uma Aluna compre ou receba acesso, percorra conteúdo em ordem, acompanhe progresso, interaja nas Aulas e obtenha Certificado; a equipe deve publicar conteúdo, cuidar de acessos e resolver exceções financeiras e de dados com rastreabilidade.

## Público

- **Aluna:** aprende, acompanha acesso/progresso, comenta, baixa materiais e consulta Certificados.
- **Compradora:** fornece identidade e dados financeiros no checkout; pode ou não ser a Aluna.
- **Especialista:** define conteúdo e políticas pedagógicas.
- **Suporte:** atende acesso, financeiro, Certificados e solicitações de dados dentro das permissões vigentes.
- **Admin:** opera todas as capacidades administrativas e configurações.

Os termos têm definição estrita no [glossário](CONTEXT.md).

## Jornadas atuais

### Compra e liberação

1. Visitante escolhe Curso ativo e inicia checkout.
2. Hub cria produto/checkout na AbacatePay e persiste Pedido com snapshots.
3. Webhook autenticado atualiza o Pedido.
4. Pagamento válido cria/atualiza Conta, Concessão e projeção de Matrícula.
5. Hub envia e-mail de acesso. Divergência financeira cria revisão humana.

### Aprendizagem

1. Aluna autenticada vê Cursos acessíveis e catálogo.
2. Acesso ao Curso depende de Conta e Matrícula efetivas.
3. Aulas são liberadas sequencialmente pelo progresso.
4. Vídeo, texto, materiais e comentários compõem a experiência.
5. Conclusão do Curso habilita emissão de Certificado conforme regra vigente.

### Operação

1. Admin cria Curso, Módulos e Aulas.
2. Admin publica conteúdo somente quando os dados mínimos estão prontos.
3. Admin/Suporte consulta Alunas, acessos, financeiro e auditoria conforme permissão.
4. Exceções são tratadas por ajustes, bloqueios, revisões, reembolsos, revogação/reemissão e solicitações de privacidade.

## Escopo implementado

- autenticação por e-mail/senha, recuperação de senha e sessões;
- cadastro público fechado por padrão;
- papéis `admin`, `support` e `student` com permissões próprias;
- autoria e publicação de Cursos/Módulos/Aulas;
- vídeo JMVStream, texto rico, anexos e imagens R2;
- catálogo, Matrícula, expiração, bloqueio e progresso;
- comentários com uma camada de resposta e moderação;
- checkout, webhook, revisão de divergências e reembolso AbacatePay;
- Certificados públicos, PDF, revogação e reemissão;
- solicitações de privacidade, anonimização controlada e retenção limitada;
- banners, FAQ, configurações, auditoria e crons operacionais.

## Não objetivos atuais

- marketplace ou múltiplas especialistas;
- multi-tenancy, organizações ou equipes de clientes;
- assinaturas recorrentes e coortes de conteúdo;
- aplicativo móvel nativo;
- substituir JMVStream por pipeline próprio de vídeo;
- declarar conformidade jurídica integral apenas porque existem controles técnicos;
- inferir que toda política implementada já foi aprovada.

O racional histórico para Next.js, Neon, Better Auth, AbacatePay, JMVStream, R2, Resend e Vercel não foi localizado. Esses provedores descrevem o estado atual, não uma decisão arquitetural retroativamente inventada.

## Políticas ainda abertas

O [registro de decisões](docs/decisions.md) separa:

- comportamento implementado;
- decisão aprovada;
- implementação aguardando ratificação;
- pendência real.

As principais pendências são a regra pedagógica de conclusão, precedência financeira, tratamento de divergência de valor, lifecycle de Certificados, vinculação de identidade, coortes, retenção/anonimização e escopo definitivo do papel Suporte.

## Capacidades administrativas vigentes

`admin` possui todas as permissões em `rolePermissions`, de `src/lib/auth-policy.ts`. `support` pode ver o painel e financeiro, executar reembolso, gerenciar Certificados, acesso a Matrículas e solicitações de privacidade; não pode gerenciar conteúdo, configurações, retry de webhook nem executar anonimização. Essa matriz está implementada, mas sua ratificação de produto deve ser registrada em [Identidade e autorização](docs/domain/identity-and-authorization.md).

## Critérios de qualidade do produto

- decisões financeiras e de acesso rastreáveis;
- acesso negado por padrão quando identidade ou estado são ambíguos;
- conteúdo utilizável com semântica, teclado e hierarquia de títulos;
- operação recuperável por logs, IDs externos e runbooks;
- dados históricos preservados por snapshots;
- limitações comunicadas sem prometer garantias inexistentes.
