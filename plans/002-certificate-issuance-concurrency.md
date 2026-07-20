# Plan 002: Garantir uma única emissão de certificado sob concorrência

> **Instruções ao executor**: implemente teste de integração concorrente antes da
> correção. Não altere a política pedagógica de conclusão.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/features/courses/server.ts src/features/certificates src/db`

## Status

- **Prioridade**: P0
- **Esforço**: M
- **Risco**: HIGH
- **Depende de**: `001-database-evolution-and-safe-tooling.md`
- **Categoria**: bug, concurrency
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

`completeLesson` faz `INSERT ... ON CONFLICT DO NOTHING`, mas define
`certificateIssued = true` sem saber se inseriu uma linha. Duas conclusões
concorrentes podem enviar dois e-mails; uma delas pode anunciar um código que nunca
existiu no banco.

## Estado atual

Em `src/features/courses/server.ts`, símbolo `completeLesson`:

```sql
insert into certificates (...)
values (...)
on conflict do nothing
```

Logo depois, a função sempre executa `certificateIssued = true`. O e-mail é enviado
após o commit com o código gerado por aquela requisição. O schema já possui
unicidade parcial para um certificado válido por aluna/curso em
`src/db/schema.ts`, tabela `certificates`.

## Escopo

**Em escopo**

- `src/features/courses/server.ts`;
- extração mínima para `src/features/certificates/`;
- testes de integração de conclusão/certificado;
- migration apenas se a constraint atual for insuficiente;
- evento/outbox somente se o plano 005 já estiver implementado.

**Fora de escopo**

- mudar regra de 98% do vídeo;
- mudar quais aulas contam;
- reemitir certificados existentes;
- criar nova UI;
- decidir versionamento do curso.

## Passos

### 1. Reproduzir a corrida

Criar duas conexões reais ao Postgres e disparar `completeLesson` simultaneamente
para a última aula da mesma aluna/curso.

O teste deve provar a falha atual:

- uma única linha válida existe;
- ambas as chamadas atuais podem reportar `certificateIssued: true`;
- dois efeitos de e-mail podem ser solicitados;
- um código solicitado não é consultável.

**Verificar**: teste falha antes do reparo pelo motivo acima, não por mock.

### 2. Fazer o insert declarar o vencedor

Alterar o insert para `RETURNING id, code` e considerar emissão apenas quando a
consulta retornar linha. A resposta e o evento de e-mail devem usar o código
retornado pelo banco, nunca um código candidato que perdeu o conflito.

Não use apenas um `SELECT` anterior: isso mantém a janela de corrida.

**Verificar**: teste concorrente retorna exatamente um `certificateIssued: true`,
uma linha e um código persistido.

### 3. Garantir snapshot e transação

Manter na mesma transação:

- conclusão da aula;
- cálculo sob estado consistente;
- insert do certificado;
- registro de evento/outbox, quando disponível.

Se a consulta de contagem puder observar phantom relevante no isolamento atual,
obter lock no par aluna/curso ou serializar por advisory lock transacional.

**Verificar**: 20 iterações concorrentes consecutivas sem duplicidade nem falso
positivo.

### 4. Cobrir retry e idempotência

Reexecutar `completeLesson` para aula já concluída e para callback de vídeo repetido.
Nenhum deles deve criar novo certificado ou novo evento de emissão.

**Verificar**: contagem de certificados e eventos permanece 1.

## Testes obrigatórios

- conclusão simples da última aula;
- duas conclusões simultâneas;
- retry após sucesso;
- evento de vídeo duplicado;
- certificado válido existente;
- certificado revogado com política atual explicitamente preservada;
- falha de e-mail não desfaz emissão.

## Critérios de pronto

- [ ] somente o insert vencedor retorna emissão;
- [ ] todo código enviado existe no banco;
- [ ] exatamente um evento/e-mail por emissão;
- [ ] teste usa Postgres real;
- [ ] testes do domínio, `typecheck`, `check` e `git diff --check` passam.

## Condições STOP

- constraint de unicidade não existe no banco migrado;
- comportamento esperado após revogação não está ratificado;
- correção exige mudar critérios pedagógicos;
- teste só pode ser escrito inspecionando texto-fonte.

## Manutenção

O revisor deve procurar qualquer novo efeito externo disparado a partir de um código
candidato, e não de uma linha efetivamente inserida.

