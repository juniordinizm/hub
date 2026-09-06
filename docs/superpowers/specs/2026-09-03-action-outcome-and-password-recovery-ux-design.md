---
status: accepted
owner: engineering
last_verified_commit: 10c9cb8dd187482144850015841fb4485eacbd5f
---

# Estados de conclusão de ações e recuperação de senha

## Objetivo

Impedir que uma pessoa repita acidentalmente uma ação importante porque a
interface continua exibindo o mesmo formulário depois que a primeira tentativa
termina. A primeira entrega aplica o padrão aos dois passos públicos de
recuperação de senha e registra o contrato para uma auditoria posterior das
demais ações mutáveis do Hub.

## Contexto atual

O fluxo público usa componentes Client em:

- `src/app/(auth)/recuperar-senha/request-password-reset-form.tsx`;
- `src/app/(auth)/redefinir-senha/reset-password-form.tsx`.

Os dois componentes usam `onSubmit` com `fetch` manual e uma flag booleana
`isPending`. A flag é desativada assim que a requisição termina, mas o JSX
continua renderizando os campos e o mesmo botão.

Há três consequências diferentes:

1. Depois de aceitar uma solicitação de recuperação, o botão volta a permitir
   outro disparo de e-mail sem uma decisão explícita da pessoa.
2. Depois de redefinir a senha, o formulário continua disponível mesmo que o
   token de redefinição já tenha sido consumido.
3. A solicitação de recuperação trata uma falha de rede como se fosse sucesso;
   a redefinição de senha não trata uma falha de rede e pode manter a tela em
   estado pendente.

O callback público de e-mail em `src/lib/auth-password-reset.ts` agenda a
   entrega com `after`. Portanto, uma resposta HTTP aceita não comprova que o
   provedor entregou a mensagem. O texto da interface precisa continuar
   indistinguível entre Conta existente, Conta inexistente e falha de entrega,
   conforme o contrato de identidade em
   `docs/domain/identity-and-authorization.md`.

## Objetivos

- Bloquear submissões concorrentes da mesma tentativa, inclusive dois eventos
  disparados antes de a próxima renderização atualizar o botão.
- Representar explicitamente o resultado da ação, em vez de usar uma mensagem
  solta para todos os estados.
- Remover o formulário de solicitação de recuperação depois de uma resposta
  aceita, preservando somente uma retomada iniciada por ação explícita.
- Remover o formulário de nova senha depois de uma redefinição bem-sucedida.
- Manter uma saída acionável para falhas de rede, respostas HTTP não aceitas e
  validações locais.
- Informar sucesso e erro de forma compreensível e anunciável por tecnologia
  assistiva.
- Preservar anti-enumeração, token, expiração, revogação de sessões e contrato
  de entrega existentes.
- Criar testes de componente e atualizar a prova E2E da mensagem indistinguível.

## Fora de escopo

- Migrar os componentes para Server Actions ou alterar a rota catch-all do
  Better Auth.
- Criar uma tabela de idempotência ou mudar o provedor de e-mail.
- Definir um novo limite numérico de rate limit, cooldown ou política de
  reenvio.
- Alterar hashing, política de senha, expiração ou revogação de sessões.
- Aplicar o padrão agora a todos os formulários administrativos, de comércio,
  aprendizagem e operação.
- Redirecionar automaticamente após a redefinição; a confirmação permanecerá
  visível e oferecerá um link explícito para login.

## Decisão de interação

### Modelo de estados

Cada componente de recuperação usará um estado discriminado local:

```text
idle -> submitting -> accepted/success
                 \-> error -> idle
```

Uma referência local de submissão em andamento bloqueará chamadas repetidas
antes da atualização de estado do React. A flag visual continuará controlando
`disabled`, `aria-busy` e o texto do botão.

O padrão usa `useState` e `useRef` porque os dois componentes enviam `fetch` para
Route Handlers. `useFormStatus` é apropriado para observar uma ação declarada
no `<form>`, e `useActionState` é apropriado quando a ação já segue o modelo de
Actions do React; nenhuma dessas condições existe atualmente nesses dois
componentes. A documentação do React também diferencia estado pendente de
estado retornado pela ação e documenta que chamadas sucessivas de
`useActionState` são enfileiradas.

### Solicitação de recuperação

No estado `idle`, a tela mantém o campo de e-mail e o botão **Enviar link**.

No estado `submitting`:

- o formulário fica ocupado;
- campos e botão ficam desabilitados;
- o botão mostra **Enviando...**;
- uma segunda submissão não inicia outro `fetch`.

No estado `accepted`:

- o formulário deixa de ser renderizado;
- aparece uma confirmação com status acessível;
- o texto usa a forma genérica: se houver uma Conta para o endereço, um link
  será enviado em instantes;
- a pessoa é orientada a verificar caixa de entrada e spam;
- há um link para login;
- há uma ação secundária claramente nomeada para **Tentar com outro e-mail**.

Essa ação secundária apenas retorna ao estado `idle`; ela não dispara envio
automaticamente. Assim, repetir o fluxo continua possível quando necessário,
mas exige uma decisão perceptível.

Uma resposta HTTP não aceita ou uma exceção de rede produz `error`, mantém o
formulário e mostra uma mensagem genérica para tentar novamente. A interface não
expõe se o e-mail existe nem detalhes do provedor.

### Definição da nova senha

No estado `idle`, a tela mantém os dois campos e o botão **Salvar senha**.

No estado `submitting`:

- os dois campos e o botão ficam desabilitados;
- o formulário recebe `aria-busy`;
- a segunda submissão é ignorada;
- o botão mostra **Salvando...**.

No estado `success`:

- os campos, o token e o botão deixam de ser renderizados;
- aparece **Senha definida com sucesso**;
- a descrição informa que a pessoa já pode entrar com a nova senha;
- existe um link primário para `/entrar`.

Não haverá ação de repetir usando o mesmo token. O token é uma credencial
temporária e o projeto já configura revogação de sessões após a redefinição.

Uma resposta HTTP não aceita segue o mapeamento de códigos e status definido na
seção **Contrato de erros do reset** abaixo: `INVALID_TOKEN` oferece recuperação;
`PASSWORD_TOO_LONG` usa texto seguro de senha sem link; códigos desconhecidos,
`429`, `5xx`, corpos vazios ou malformados usam retry genérico sem link. Erros de
rede permanecem genéricos e sem link. O guard de token ausente mantém o link
explícito de recuperação. A tela preserva a possibilidade de corrigir a entrada
ou usar outro link, e a validação local continua acontecendo antes do `fetch`.

## Acessibilidade e conteúdo

### Contrato de erros do reset

Respostas HTTP não aceitas usam o código JSON do Better Auth: `INVALID_TOKEN`
mostra **Link inválido ou expirado** e oferece `/recuperar-senha`;
`PASSWORD_TOO_LONG` mostra uma mensagem segura de senha muito longa, sem link.
Códigos desconhecidos, `429`, `5xx`, corpos vazios ou malformados usam a
mensagem genérica de tentar novamente, sem link de recuperação. Erros de rede
permanecem genéricos e sem link. O guard de token ausente preserva o link de
recuperação exigido quando não há token utilizável.

- O estado de sucesso será uma região `role="status"` com `aria-live="polite"`
  e conteúdo persistente enquanto a confirmação estiver visível. Quando o
  componente existente `Alert` for usado, a propriedade `role` explícita deverá
  substituir seu padrão de alerta.
- Erros continuarão sendo alertas assertivos e não serão confundidos com
  sucesso.
- O formulário pendente usará `aria-busy` e um `fieldset disabled` para impedir
  edição durante a requisição, seguindo o comportamento de bloqueio de controles
  documentado pelo React.
- Os textos serão suficientemente explícitos para que a pessoa não precise
  inferir o resultado pela mudança do botão.
- O link de login permanecerá navegável por teclado e não dependerá de clique
  em uma área não semântica.
- Não haverá spinner ou cor como único indicador de estado.

O W3C recomenda feedback explícito após submissão bem-sucedida e identifica
`role="status"` como técnica adequada para mensagens de status que não mudam o
contexto da página. A confirmação também segue os padrões de confirmação de
e-mail e de confirmação de transação usados em serviços públicos digitais.

## Segurança e semântica da resposta

Esta mudança trata a prevenção de reenvio acidental no cliente, não garante
execução exatamente uma vez no servidor.

O primeiro plano preservará:

- mensagem indistinguível para Conta existente e inexistente;
- envio assíncrono já existente no callback público;
- ausência de e-mail, token, URL secreta ou erro bruto em mensagens da UI;
- token de redefinição de uso único e expiração controlados pelo Better Auth;
- revogação de sessões configurada no `AUTH_PASSWORD_POLICY`.

Rate limiting específico por Conta e idempotência durável para solicitações
públicas continuam como risco de hardening separado. A OWASP recomenda esses
controles porque um cliente pode ser automatizado ou pode perder a resposta de
uma requisição já aceita.

## Auditoria posterior do padrão

O repositório contém formulários com quatro comportamentos diferentes:

1. ações repetíveis de edição, como configurações, disponibilidade e comentários;
2. ações que mudam a tela após sucesso, como login, cadastro e operações que
   fecham um diálogo;
3. ações críticas que devem mudar o estado visual após conclusão, como
   publicação, arquivamento, reembolso, bloqueio e emissão/revogação;
4. ações com resultado indeterminado após timeout, como checkout e integrações
   externas.

O próximo ciclo deverá classificar cada formulário por essa semântica. Não será
aplicado um `disabled` permanente global: ações repetíveis precisam continuar
editáveis, enquanto ações terminais precisam renderizar o novo estado ou
oferecer retry deliberado. Ações externas também precisarão de idempotência
server-side antes de serem tratadas como exatamente uma vez.

## Arquivos da primeira implementação

- Modificar `src/app/(auth)/recuperar-senha/request-password-reset-form.tsx`.
- Modificar `src/app/(auth)/redefinir-senha/reset-password-form.tsx`.
- Criar testes de componente adjacentes aos dois formulários.
- Modificar `tests/e2e/critical-journeys.spec.ts` para validar confirmação,
  retomada explícita e anti-enumeração.
- Atualizar `docs/domain/identity-and-authorization.md` para registrar o estado
  terminal da solicitação aceita e da redefinição concluída.

Não haverá migration, mudança de variável de ambiente, alteração de integração
ou modificação nos demais fluxos nesta entrega.

## Critérios de aceitação

- Uma resposta aceita no formulário de recuperação não deixa o botão de envio
  disponível na mesma tela.
- Um segundo envio só acontece depois de a pessoa acionar explicitamente a
  retomada e submeter novamente.
- Uma redefinição bem-sucedida não deixa o formulário ou o token disponíveis
  para nova submissão.
- Dois eventos de submissão durante a mesma requisição resultam em um único
  request.
- Falha de rede não é mostrada como sucesso e não deixa o formulário preso em
  `submitting`.
- A mensagem para endereço conhecido e desconhecido permanece equivalente.
- A confirmação é visível, semântica e anunciável por tecnologia assistiva.
- Nenhuma regra de segurança ou entrega existente é enfraquecida.

## Referências externas

- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [W3C G199: Providing success feedback](https://www.w3.org/WAI/WCAG21/Techniques/general/G199)
- [W3C WCAG 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
- [React `useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [React `useActionState`](https://react.dev/reference/react/useActionState)
- [Auth0 password reset flow](https://auth0.com/docs/authenticate/database-connections/password-change)
- [Clerk custom forgot-password flow](https://clerk.com/docs/guides/development/custom-flows/authentication/forgot-password)
- [GOV.UK confirm an email address](https://design-system.service.gov.uk/patterns/confirm-an-email-address/)
