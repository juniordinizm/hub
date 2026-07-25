# Cadastro público e recuperação da jornada E2E

## Objetivo

Disponibilizar o cadastro público de uma nova Aluna sem conceder Curso ou Matrícula, e restaurar a jornada da Biblioteca para acessos expirados e revogados que hoje falha em produção na CI.

## Decisões aprovadas

- O cadastro público é permitido.
- A nova Conta entra imediatamente como `student` e é autenticada após o cadastro.
- Verificação de e-mail não faz parte desta versão.
- Cadastro não cria Concessão, Matrícula, Pedido ou acesso a Curso.
- O endpoint público continua protegido por `AUTH_PUBLIC_SIGNUP_ENABLED`, usado como kill switch operacional. Ele deve ser configurado como `true` no Coolify somente após o deploy desta versão.

## Cadastro público

`/cadastro` reutiliza a casca de autenticação e os componentes shadcn já adotados pelo projeto. O formulário recebe nome, e-mail, senha e confirmação de senha. A confirmação é validada antes da chamada de rede; a senha continua sujeita à política do Better Auth.

O formulário chama o endpoint Better Auth de cadastro. Depois de uma resposta bem-sucedida, a sessão emitida pelo provedor é confirmada pelo redirecionador existente e a Aluna segue para `/app`. Erros externos retornam uma mensagem segura e genérica para não transformar a tela em mecanismo de enumeração de e-mails.

O formulário de entrada passa a ter um link explícito para `/cadastro`. Pessoas já autenticadas não veem a tela de cadastro: seguem para a área correspondente ao seu papel, como já ocorre em `/entrar`.

## Perfil e autorização

O Better Auth é a única autoridade que cria `users`. Um trigger PostgreSQL cria o `profiles` correspondente com o papel `student` na mesma transação da Conta. A operação é idempotente para suportar fluxos legítimos já existentes. O hook `after` documentado pelo Better Auth não oferece esse contrato transacional e, por isso, não é a fronteira de persistência usada aqui.

Fluxos internos que elevam uma Conta para `admin` ou `support` devem fazer upsert no perfil, em vez de pressupor sua ausência. Isso preserva o princípio de menor privilégio: uma requisição pública jamais fornece ou escolhe papel.

`profiles` passa a representar todas as Contas criadas de modo normal. A listagem administrativa mostra a nova Aluna, inclusive sem Matrícula, mas a Biblioteca continua mostrando somente catálogo e estados bloqueados enquanto não houver Concessão efetiva.

## Recuperação da jornada de acesso expirado

O contrato observável continua: uma Aluna com Matrícula expirada vê “Acesso expirado” e “Renovar acesso”; uma Aluna revogada vê a ação de suporte. A boundary genérica nunca é um resultado de negócio válido para esses estados.

O defeito será reproduzido contra uma branch Neon descartável que a CI já usa. A correção será feita na fonte da exceção, identificada pelo log do processo Next em modo de produção; não haverá captura ampla que converta falha inesperada em UI de acesso.

A job de E2E preservará o log do processo Next como artefato quando falhar. Isso mantém mensagens sensíveis fora da interface, mas deixa a causa disponível para engenharia dentro do artefato privado do GitHub.

## Verificação

- política: endpoint de cadastro bloqueado quando o kill switch é falso e permitido quando é verdadeiro;
- identidade: criação normal gera perfil `student`; upsert interno mantém a elevação de papel explícita;
- interface: confirmação de senha, mensagem segura de erro, link de entrada e redirecionamento pós-cadastro;
- E2E: nova Aluna autenticada vê a Biblioteca sem Cursos liberados; os cenários expirado e revogado renderizam suas ações sem boundary;
- CI: em falha de E2E, o log Next é incluído no artefato;
- gates: testes focados, `docs:check`, typecheck, check, build e E2E em branch Neon descartável.

## Fora de escopo

- confirmação de e-mail;
- convite, recuperação adicional de identidade e seleção de papel no cadastro;
- atribuição automática de Curso, Concessão ou Matrícula;
- alteração de regras de expiração ou revogação.
