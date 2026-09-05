---
status: runbook
owner: engineering
last_verified_commit: 635bc05
---

# Rollout da liberação temporal por Módulo

Este runbook cobre somente a validação operacional do drip relativo. A regra
de runtime continua no servidor: não crie scheduler, job de desbloqueio,
coorte ou regra por Aula.

## Piloto em Staging

1. Aplique a migration pelo fluxo normal de Staging e confirme
   `bun run db:migrations:check`.
2. Crie um Curso piloto com dois Módulos: D+0 e D+1. Use uma Matrícula de
   teste cuja âncora esteja controlada; não espere dias reais.
3. Abra o overview como Aluna e confirme:
   - título, contagem e duração do Módulo futuro aparecem;
   - título, thumbnail, player, material e comentário de Aula futura não
     aparecem;
   - Aula concluída anteriormente continua revisável;
   - o dashboard aponta para overview quando a próxima Aula ainda é futura.
4. Tente URL direta, comentário, download, preview de material, watch e
   conclusão da Aula futura. Todos devem negar sem inserir progresso,
   comentário, certificado ou URL assinada.
5. Revogue a Matrícula durante uma conclusão concorrente e confirme no banco
   que não houve `lesson_progress`, `course_completions` ou `certificates`.
6. Altere o schedule publicado durante o checkout. O checkout deve esperar o
   lock do Curso, retornar conflito de digest e não criar Pedido nem chamar o
   provider.

## R2 e JMVStream

Para cada Aula que usa R2, verifique no ambiente de Staging, com um objeto de
teste:

- TTL e escopo da signed URL;
- ausência de signed URL em resposta bloqueada;
- expiração de uma URL já emitida;
- comportamento do origin e do player quando o objeto expira.

Para JMVStream, confirme com o player real que o domínio/origin/token não
permite atravessar a tela de bloqueio e que um player já aberto não recebe uma
nova URL depois da revogação. O sistema não promete revogar um link externo já
entregue; registre essa limitação no aceite do piloto.

Não salve tokens, cookies, URLs assinadas ou PII nos artefatos de teste.

## Copy e jurídico

Antes da primeira venda real com drip, Produto e Jurídico devem aprovar a copy
da página de compra e dos termos. A copy precisa dizer que:

- os Módulos são liberados em períodos exatos de 24 horas a partir do início
  efetivo do acesso;
- a liberação progressiva é uma forma de organização/segurança do conteúdo;
- ela não reduz nem sugere renúncia ao direito legal de arrependimento;
- o cronograma exibido antes do POST financeiro é o mesmo preservado no
  snapshot do Pedido.

Guarde a aprovação fora do banco; o código não substitui revisão jurídica.

## Ativação e rollback

1. Faça o deploy com todos os Cursos existentes em D+0.
2. Ative o drip somente para um Curso piloto.
3. Monitore `content_release_invalid_state`,
   `content_release_digest_conflict`, `content_release_override_rejected`,
   `content_release_override_granted`, falhas de player e certificados.
4. Para desativar, publique todos os Módulos em D+0. Não remova colunas,
   snapshots ou a migration.
5. Rollback de código não desfaz a migration: o schema e snapshots são
   compatíveis com o código anterior. Se houver estado inválido, mantenha o
   fail-closed e corrija a configuração antes de reabrir o Curso.
