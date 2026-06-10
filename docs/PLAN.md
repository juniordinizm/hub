# Roadmap PROTEA-R Hub

## Summary
Construir uma plataforma própria de cursos da cliente, em **Next.js 16/Vercel**, com **Neon Postgres + Drizzle**, **Better Auth**, **Resend**, checkout externo via **AbacatePay**, vídeo com POC **JMVStream vs Panda**, admin próprio e área da aluna pronta para produção.

O repositório atual ainda é basicamente um starter; a maior parte do produto será implementada do zero, usando `.0Ref/protear-area de aluno` como referência de experiência e `.0Ref/dgimports` como referência de arquitetura, testes, auth, banco e deploy.

## Decisões Travadas
- Modelo: cursos da cliente, não marketplace multi-produtor.
- MVP: produção completa, não protótipo.
- Escopo comercial: checkout externo AbacatePay, sem página pública de vendas no MVP.
- Pagamento: Pix + cartão.
- Acesso: 12 meses por matrícula; expiração bloqueia aulas e preserva histórico/certificado.
- Reembolso: revogação automática por webhook, com auditoria e idempotência.
- Curso: multi-curso desde o início, lançando com PROTEA-R.
- Conclusão: clique manual + desbloqueio sequencial.
- Certificado: PDF com código único, QR/URL pública de validação.
- Suporte: FAQ + WhatsApp.
- Admin: papéis `admin` e `support`; `admin` gerencia tudo, `support` vê alunos/pedidos/matrículas e pode reenviar convite/ajuda de acesso.
- Fora do MVP: comentários por aula, tickets completos, cupons, carrinho, afiliados, assinatura recorrente, landing pages públicas, multi-produtor.

## Key Changes
- Criar arquitetura por áreas: `(auth)`, `(student)`, `(admin)` e `api/webhooks`.
- Adicionar Better Auth com convite para definir senha, recuperação de senha e sessão via cookie seguro.
- Adicionar Drizzle/Neon com migrations versionadas e branches separadas para dev/preview/prod.
- Modelar domínio principal:
  - `profiles`, `courses`, `modules`, `lessons`
  - `enrollments`, `lesson_progress`
  - `orders`, `webhook_events`
  - `certificates`, `faq_items`, `audit_logs`, `app_settings`
- Criar abstrações:
  - `VideoProvider`: começa com adaptadores JMV/Panda na POC; app guarda provider + ID/embed seguro.
  - `PaymentProvider`: AbacatePay com mapeamento de checkout externo para curso.
  - `CertificateRenderer`: gera PDF e página pública de validação por código.
- Criar endpoint `POST /api/webhooks/abacatepay` com verificação de assinatura, armazenamento do evento bruto, processamento idempotente e suporte a eventos pagos/reembolsados.
- Criar área da aluna com dashboard, continuar assistindo, módulos/aulas, player embed, progresso sequencial, FAQ, WhatsApp e certificado.
- Criar admin próprio para cursos, módulos, aulas, vídeos, alunas, matrículas, pedidos, webhooks, certificados, FAQ e configurações.
- Refinar visual PROTEA-R atual: PT-BR, teal/laranja, Lexend ou equivalente local, acessível, responsivo mobile e desktop.

## Roadmap
1. **Fase 0: Preparação**
   - Confirmar domínios, contas Vercel/Neon/Resend/AbacatePay/JMV/Panda, termos LGPD, política de privacidade e dados reais do curso.
   - Rodar POC JMV vs Panda com 2 aulas reais: embed, mobile, domínio/token, watermark, analytics, API, suporte e custo.
   - Definir provedor final de vídeo antes da implementação do player definitivo.

2. **Fase 1: Fundação Técnica**
   - Instalar dependências de auth, banco, validação, testes, e-mail e observabilidade.
   - Criar env validation, conexão Drizzle, migrations iniciais, seed do curso PROTEA-R e estrutura de testes.
   - Implementar layouts protegidos, guards por papel, páginas de erro, loading states e audit logs.

3. **Fase 2: Auth e Operação**
   - Implementar login, convite para definir senha, reset de senha e sessão.
   - Criar perfis `admin`, `support` e `student`.
   - Implementar envio Resend para convite, acesso liberado, redefinição de senha, certificado e avisos de expiração.

4. **Fase 3: Admin/CMS Próprio**
   - CRUD de cursos, módulos e aulas.
   - Campos de vídeo por aula conforme provider escolhido.
   - Gestão de alunas, matrículas, expiração, renovação, reenvio de convite e certificados.
   - Gestão de FAQ, WhatsApp de suporte, dados do certificado e configurações AbacatePay.

5. **Fase 4: Pagamentos e Acesso**
   - Mapear produtos/checkouts externos AbacatePay para cursos.
   - Processar pagamento aprovado criando/reativando usuária, criando pedido e matrícula de 12 meses.
   - Processar reembolso/cancelamento revogando matrícula automaticamente.
   - Registrar todos os webhooks, falhas e reprocessamentos no admin.

6. **Fase 5: Área da Aluna**
   - Dashboard com progresso geral, continuar assistindo e módulos.
   - Página de aula com player, sidebar de conteúdo, busca simples e botão concluir.
   - Bloqueio real de acesso direto a aulas fora de sequência, curso expirado ou matrícula revogada.
   - FAQ e CTA WhatsApp, sem comentários no MVP.

7. **Fase 6: Certificados**
   - Emitir certificado ao concluir 100% do curso.
   - Gerar PDF com nome, curso, carga horária, data, código único e QR.
   - Criar página pública de validação do certificado sem expor dados sensíveis além do necessário.

8. **Fase 7: Hardening e Deploy**
   - Configurar Vercel Production/Preview, Neon prod/preview/e2e, envs, domínio, Resend domain, AbacatePay webhook prod/test e provider de vídeo final.
   - Adicionar Sentry ou equivalente, health check, logs de webhook e checklist LGPD.
   - Rodar smoke pós-deploy: login, convite, webhook pago, matrícula, aula, progresso, certificado, refund, expiração.

## Test Plan
- Unitários: cálculo de progresso, desbloqueio sequencial, expiração, certificado, papéis, mapeamento AbacatePay e idempotência.
- Integração: webhook pago/refund, criação/reativação de aluna, renovação de matrícula, PDF/validação, Resend mockado.
- E2E Playwright: admin cadastra curso/aula, webhook libera aluna, aluna define senha, assiste em ordem, conclui curso, baixa certificado, refund bloqueia aula.
- Qualidade obrigatória: `bun run check`, `bun run typecheck`, `bun run build`, testes unitários e E2E antes do deploy.
- POC vídeo: JMV/Panda em mobile e desktop, com métricas de carregamento, proteção, custo e facilidade operacional.

## Assumptions
- O conteúdo base do PROTEA-R está pronto o suficiente para seed inicial, mas vídeos finais podem ser cadastrados pelo admin.
- O checkout e páginas de venda ficam fora da plataforma no MVP.
- O admin próprio substitui CMS externo para o núcleo do curso.
- A implementação deve consultar os guias locais em `node_modules/next/dist/docs/` antes de tocar código.
- Fontes externas consultadas: AbacatePay docs, Panda Pricing, JMVStream, Cloudflare Stream, Mux Pricing e Bunny Stream.
