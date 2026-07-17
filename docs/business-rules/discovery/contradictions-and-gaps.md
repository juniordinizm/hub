> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Contradições, lacunas e bugs prováveis

## Identidade

- **CONTRADIÇÃO P2:** a documentação trata `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` como obrigatórias em produção, enquanto o ambiente aceita fallback localhost. Evidências: `docs/AUTH_MODULE.md`; `src/lib/env.ts:27-29,44,89-97`.
- **LACUNA P1:** `emailVerified` não é condição de acesso. Torna-se material se o cadastro público for habilitado.

## Autorização

- **LACUNA P2:** rate limit, cookies, duração de sessão e confiança de proxy dependem da infraestrutura não auditada. UI não é proteção: as actions server-side são a evidência de autorização.
- **AS-IS PARCIAL P2:** support é negado no servidor para conteúdo/configuração/financeiro, mas a UI pode expor caminhos que terminam em negação.

## Conteúdo

- **LACUNA P2:** não há versão/coorte nem efeito definido para inclusão, remoção, reordenação ou arquivamento de aula ativa após a venda.
- **AS-IS PARCIAL P3:** `lessons.is_published` e `status` coexistem, enquanto a aluna usa `status`; divergência possível.

## Matrículas

- **BUG PROVÁVEL P1:** reversão de ajuste pode sobrescrever ajuste posterior, pois restaura `previous_expires_at` sem provar que o ajuste é o último e sem estado de reversão. `enrollments/server.ts:747-841`; `schema.ts:438-469`.
- **LACUNA P2:** não há política explícita para nova compra após bloqueio manual.

## Pagamentos

- **BUG PROVÁVEL P1:** eventos distintos concorrentes podem gravar transição desatualizada e reabrir acesso após refund. `payments/server.ts:274-472`.
- **LACUNA P2:** valor pago não é comparado explicitamente ao snapshot esperado antes da concessão. `payments/server.ts:327-377,435-448`.

## Progresso

- **BUG PROVÁVEL P1:** uma aluna pode enviar `durationSeconds` para action que altera duração editorial e carga horária. `app/(student)/app/actions.ts:42-64`; `courses/server.ts:1350-1395`.
- **LACUNA P2:** o produto ainda não escolheu se clique manual, visualização mínima ou regra híbrida define conclusão.

## Certificados

- **LACUNA P2:** não há política/modelo para refund, disputa, expiração, correção, reemissão ou revogação.
- **LACUNA P2:** a consulta pública devolve nome completo sem evidência de minimização, limitação de tentativas ou rate limit.

## Suporte

- **LACUNA P2:** mensagem livre não alerta contra dados de pacientes, não gera ticket e não define retenção, SLA ou auditoria.

## Privacidade

- **OBRIGAÇÃO EXTERNA P2:** PII ocorre em identidade, pedidos, suporte, logs e certificado público; não foi localizada política de privacidade, retenção, exclusão/anonimização ou governança de fornecedores. Requer validação especializada, não conclusão jurídica.

## Acessibilidade

- **LACUNA P2:** não foram localizadas legendas/transcrições, testes de teclado/leitor de tela, PDF acessível ou avaliação WCAG para player e autenticação.

## Operação

- **BUG PROVÁVEL P1:** o adaptador atual de e-mail resolve sem entregar a mensagem. `src/features/email/server.ts:18-132`.
- **LACUNA P2:** não há outbox, DLQ, alerta ou evidência de monitoramento para falhas de e-mail, webhook ou cron.

## Testes

- **LACUNA P2:** 257 testes unitários/contratuais passaram, mas não há evidência de E2E, concorrência de eventos, webhook real, e-mail real, acessibilidade ou configuração de deploy.
