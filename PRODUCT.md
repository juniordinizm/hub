---
status: canonical
owner: product
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Produto PROTEA-R Hub

## Propósito

Centralizar venda, entrega e operação de Cursos da PROTEA-R. O Hub permite que uma Aluna compre ou receba acesso, percorra conteúdo em ordem, acompanhe progresso, interaja nas Aulas e obtenha Certificado. A equipe publica conteúdo, cuida de acessos e resolve exceções financeiras e de dados com rastreabilidade.

## Público

- **Aluna:** aprende, acompanha acesso/progresso, comenta, baixa materiais e consulta Certificados.
- **Compradora:** fornece identidade e dados financeiros no checkout; pode não ser a Aluna.
- **Especialista:** define conteúdo, experiência pedagógica e decisões de produto.
- **Suporte:** atende acesso, financeiro, Certificados e solicitações de dados conforme permissão.
- **Admin:** opera todas as capacidades administrativas e configurações.

Os termos têm definição estrita no [glossário](CONTEXT.md).

## Jornadas atuais

### Compra e liberação

1. Visitante escolhe Curso ativo e inicia checkout.
2. Hub cria produto/checkout AbacatePay e persiste Pedido com snapshots.
3. Webhook autenticado atualiza Pedido.
4. Pagamento válido cria ou atualiza Conta, Concessão e projeção de Matrícula.
5. Hub envia e-mail de acesso; divergência financeira cria revisão humana.

### Aprendizagem

1. Aluna autenticada vê Cursos acessíveis e catálogo.
2. Acesso depende de Conta e Matrícula efetivas.
3. Aulas são liberadas sequencialmente pelo progresso da Versão de Curso vinculada à Matrícula.
4. Vídeo, texto, materiais e comentários formam a experiência.
5. Conclusão do Curso habilita emissão de Certificado conforme regra vigente.
6. Analytics técnico minimizado fica habilitado por padrão para melhoria das Aulas; a Aluna pode desligá-lo em Configurações sem afetar a jornada pedagógica.

### Operação

1. Admin cria Curso, Módulos e Aulas.
2. Admin publica conteúdo quando dados mínimos estão prontos.
3. Admin/Suporte consulta Alunas, acessos, financeiro, Certificados e auditoria conforme permissão.
4. Exceções usam ajustes, bloqueios, revisões, reembolso e revogação/reemissão; pedidos de dados são tratados excepcionalmente, não por inbox permanente.
5. O painel de aprendizagem mostra somente métricas agregadas por Aula e Versão; não há acompanhamento individual por inatividade.

## Escopo implementado

- autenticação por e-mail/senha, recuperação e sessões;
- cadastro público fechado por padrão;
- papéis `admin`, `support` e `student` com permissões próprias;
- autoria e publicação de Cursos/Módulos/Aulas;
- vídeo JMVStream, texto rico, anexos e imagens R2;
- catálogo, Matrícula, expiração, bloqueio, progresso e analytics técnico minimizado;
- comentários com uma camada de resposta e moderação;
- checkout, webhook, revisão de divergências e reembolso AbacatePay;
- Certificados públicos, PDF, revogação e reemissão;
- manutenção técnica de sessões, rate limits e analytics com retenção limitada;
- banners, FAQ, configurações, auditoria e crons operacionais.

## Não objetivos atuais

- marketplace, múltiplas especialistas, multi-tenancy ou organizações de clientes;
- assinaturas recorrentes e coortes de conteúdo;
- aplicativo móvel nativo;
- pipeline próprio de vídeo no lugar de JMVStream;
- ferramenta de CRM/reengajamento baseada em analytics;
- declarar conformidade jurídica integral somente por controles técnicos;
- inferir que política implementada já foi aprovada.

O racional histórico para Next.js, Neon, Better Auth, AbacatePay, JMVStream, R2, Resend e Vercel não foi localizado. Esses provedores descrevem o estado atual, não uma decisão arquitetural retroativamente inventada.

## Políticas ainda abertas

O [registro de decisões](docs/decisions.md) separa comportamento implementado, decisão aprovada, implementação aguardando ratificação e pendência real.

Pendências principais: base legal e texto final de transparência para analytics padrão antes da produção; identidade entre Compradora e Aluna; precedência financeira; reversão de ajustes encadeados; critérios de incidente/SLO e escopo definitivo de Suporte. Pedidos de dados serão tratados como caso excepcional quando houver política jurídica formal e demanda real.

## Capacidades administrativas vigentes

`admin` possui todas as permissões em `rolePermissions`, de `src/lib/auth-policy.ts`. `support` pode ver painel e financeiro, executar reembolso e gerenciar Certificados e Matrículas; não pode gerenciar conteúdo, configurações nem retry de webhook. Não há workflow de anonimização ou solicitações de dados no produto atual. Essa matriz está implementada; sua ratificação de produto fica em [Identidade e autorização](docs/domain/identity-and-authorization.md).

## Critérios de qualidade

- decisões financeiras e de acesso rastreáveis;
- acesso negado por padrão quando identidade ou estado são ambíguos;
- conteúdo utilizável com semântica, teclado e hierarquia de títulos;
- operação recuperável por logs, IDs externos e runbooks;
- dados históricos preservados por snapshots;
- limitações comunicadas sem prometer garantias inexistentes.
