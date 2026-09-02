---
status: canonical
owner: product
last_verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
---

# Produto PROTEA-R Hub

## Propósito

Centralizar venda, entrega e operação de Cursos da PROTEA-R. O Hub permite que uma Aluna compre ou receba acesso, percorra conteúdo em ordem, acompanhe progresso, interaja nas Aulas e obtenha Certificado. A equipe publica conteúdo, cuida de acessos e resolve exceções financeiras e de dados com rastreabilidade.

## Público

- **Aluna:** aprende, acompanha acesso/progresso, comenta, baixa materiais e consulta Certificados.
- **Compradora:** fornece identidade no checkout hospedado Asaas. Na compra de Curso
  atual, Compradora e Aluna são a mesma pessoa; compra para terceiro permanece fora do
  escopo.
- **Especialista:** define conteúdo, experiência pedagógica e decisões de produto.
- **Suporte:** atende acesso, financeiro, Certificados e solicitações de dados conforme permissão.
- **Admin:** opera todas as capacidades administrativas e configurações.

Os termos têm definição estrita no [glossário](CONTEXT.md).

## Jornadas atuais

### Compra e liberação

1. Visitante ou Aluna autenticada escolhe Curso ativo e inicia checkout.
2. Hub persiste o Pedido e seus snapshots antes de criar o checkout hospedado Asaas com
   item inline; não existe produto remoto por Curso.
3. Webhook autenticado entra em inbox durável e o worker atualiza o Pedido.
4. Pagamento válido vincula a compra à Conta existente pelo e-mail local ou cria uma
   Conta não verificada, depois cria Concessão e recompõe a Matrícula.
5. Hub envia ativação ou aviso de acesso pela outbox; divergência financeira cria revisão
   humana.

A jornada pública aprovada está implementada em código: usa o link estável
`/comprar/[slug]`, copiável pela administração e consumido pela landing page externa; o
handoff cria o Checkout sem formulário local e mantém `/` protegida. O worker enriquece a
identidade fora da transação e trata Conta de equipe, bloqueio e revogação sem liberar
acesso. A execução E2E em PostgreSQL descartável e o handoff público no Sandbox foram
homologados. Uma compra pública em 3x, o bloqueio de identidade revogada e o reembolso
integral do parcelamento foram homologados manualmente no Sandbox de Staging; somente o
corte controlado de Production permanece pendente.

### Aprendizagem

1. Aluna autenticada vê Cursos acessíveis e catálogo.
2. Acesso depende de Conta e Matrícula efetivas.
3. Aulas são liberadas sequencialmente pelo progresso da publicação vigente do Curso para toda Matrícula ativa.
4. Vídeo, texto, materiais e comentários formam a experiência.
5. A primeira Conclusão do Curso pode iniciar a emissão automática de Certificado conforme regra vigente; a Aluna acompanha preparo, disponibilidade ou falha. O Curso oferece a entrada contextual, `/app/certificados` mantém o arquivo global e `/certificados/[code]` é a página canônica de validação, preview, download e compartilhamento quando o documento está válido e pronto.
6. Analytics técnico minimizado fica habilitado por padrão para melhoria das Aulas; a Aluna pode desligá-lo em Configurações sem afetar a jornada pedagógica.

### Operação

1. Admin cria Curso, Módulos e Aulas.
2. Admin publica conteúdo quando dados mínimos estão prontos.
3. Admin/Suporte consulta Alunas, acessos, financeiro, Certificados e auditoria conforme permissão.
4. Exceções usam ajustes, bloqueios, revisões, reembolso e revogação/reemissão; pedidos de dados são tratados excepcionalmente, não por inbox permanente.
5. O painel de aprendizagem mostra somente métricas agregadas por Aula e Publicação; não há acompanhamento individual por inatividade.
6. Admin controla separadamente entrega, presença na vitrine e novas vendas. Pausar vendas preserva o acesso vigente; “Em breve” aceita interesse sem cobrança ou Matrícula.
7. Admin pode reconciliar Conclusões históricas sem Certificado, somente após confirmação explícita e em lotes limitados; não existe backfill silencioso em migration, deploy ou leitura.

## Escopo implementado

- autenticação por e-mail/senha, recuperação e sessões;
- cadastro público fechado por padrão;
- papéis `admin`, `support` e `student` com permissões próprias;
- autoria e publicação de Cursos/Módulos/Aulas;
- vídeo JMVStream, texto rico, anexos e imagens R2;
- catálogo, Matrícula, expiração, bloqueio, progresso e analytics técnico minimizado;
- comentários com uma camada de resposta e moderação;
- núcleo Asaas anterior da compra autenticada, inbox/worker, conciliação e reembolso
  integral implementados e homologados em Sandbox, ainda sem corte de Production;
- API, jornada pública e revisão de identidade implementadas, cobertas por E2E em
  PostgreSQL descartável e homologadas no handoff Sandbox;
- oferta comercial por Curso com Pix, cartão ou ambos, preço único entre os métodos e
  teto de parcelamento; a Vendedora absorve as taxas, conforme homologado no Checkout
  Sandbox com pagamento e reembolso reais em 3x;
- disponibilidade comercial por Curso, pré-lançamento com interesse autenticado e cancelamento durável de Checkouts ao fechar vendas;
- Certificados com objeto PDF em storage privado e acesso público mediado, rate-limited e não indexável somente no estado válido/pronto; revogação, reemissão e reconciliação administrativa limitada de Conclusões históricas;
- manutenção técnica de sessões, rate limits e analytics com retenção limitada;
- banners, FAQ, configurações, auditoria e crons operacionais.

## Não objetivos atuais

- marketplace, múltiplas especialistas, multi-tenancy ou organizações de clientes;
- assinaturas recorrentes e coortes de conteúdo;
- assinaturas recorrentes ou parcelamento fora do agregado nativo do Asaas;
- aplicativo móvel nativo;
- pipeline próprio de vídeo no lugar de JMVStream;
- ferramenta de CRM/reengajamento baseada em analytics;
- declarar conformidade jurídica integral somente por controles técnicos;
- inferir que política implementada já foi aprovada.

O racional histórico para Next.js, Neon, Better Auth, JMVStream, R2, Resend e Vercel não
foi localizado. A substituição direta do provedor de pagamentos anterior pelo Asaas está
documentada no plano de migração; esses provedores descrevem o estado atual, não uma
decisão arquitetural retroativamente inventada.

## Políticas ainda abertas

O [registro de decisões](docs/decisions.md) separa comportamento implementado, decisão aprovada, implementação aguardando ratificação e pendência real.

Pendências principais: tratamento da compra pública cujo e-mail já pertença a
Admin/Suporte, critérios de incidente/SLO e racional não localizado para alguns
providers externos. Pedidos de dados serão tratados como caso excepcional quando
houver política jurídica formal e demanda real.

## Capacidades administrativas vigentes

`admin` possui todas as permissões em `rolePermissions`, de `src/lib/auth-policy.ts`.
A fronteira granular aprovada no
[DEC-DISC-014](docs/decisions.md#dec-disc-014) autoriza `support` a analisar Cursos,
Alunas, Matrículas e finanças; operar validade e bloqueio de Matrícula; reemitir
somente o Certificado mais recente; e executar reembolso integral. Autoria,
configuração, moderação, analytics detalhado, decisão financeira, conciliação,
retry, bloqueio de plataforma, emissão e revogação permanecem exclusivas de
`admin`. As projeções e as mutações aplicam essa matriz no servidor. MFA
administrativo não faz parte do produto atual; uma adoção futura exigirá decisão e
especificação próprias. Não há workflow de anonimização ou solicitações de dados
no produto atual.

## Critérios de qualidade

- decisões financeiras e de acesso rastreáveis;
- acesso negado por padrão quando identidade ou estado são ambíguos;
- conteúdo utilizável com semântica, teclado e hierarquia de títulos;
- operação recuperável por logs, IDs externos e runbooks;
- dados históricos preservados por snapshots;
- limitações comunicadas sem prometer garantias inexistentes.
