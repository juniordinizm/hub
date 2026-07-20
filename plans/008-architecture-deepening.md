# Plan 008: Aprofundar módulos centrais sem reescrever o produto

> **Instruções ao executor**: refatoração deve preservar comportamento. Extraia por
> responsabilidade e invariantes, não por tamanho arbitrário.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/features/courses src/features/admin src/features/enrollments src/features/payments src/features/jmvstream src/components/lesson-kind-controls.tsx src/app/\\(student\\)/app/aulas`

## Status

- **Prioridade**: P2
- **Esforço**: L
- **Risco**: MED
- **Depende de**: `003-ci-and-risk-based-testing.md`
- **Categoria**: architecture, tech-debt, performance
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

Arquivos grandes não são automaticamente ruins. Aqui, porém, alguns módulos misturam
consulta, autorização, agregação, regra, transação e efeito externo. Isso cria
interfaces rasas, dificulta testes comportamentais e favorece duplicação entre autoria
e player.

## Estado atual

Arquivos centrais:

- `src/features/courses/server.ts`: 1.396 linhas;
- `src/features/jmvstream/server.ts`: 1.281;
- `src/features/enrollments/server.ts`: 1.044;
- `src/features/payments/server.ts`: 1.037;
- `src/features/admin/server.ts`: 1.025;
- `src/features/admin/actions.ts`: 1.018;
- `src/features/admin/authoring.ts`: 914;
- `src/components/lesson-kind-controls.tsx`: 1.181;
- página de aula da aluna: aproximadamente 1.000.

Duplicação observada entre autoria e player: extensão, tamanho, label, ícone e tom de
resource. Admin carrega cursos, módulos e aulas inteiros em algumas superfícies e
agrega alunas em memória.

## Princípios

- módulo profundo: interface pequena, muita decisão escondida;
- regra de domínio não depende de React/FormData;
- boundary valida/autentica, application service coordena, repository persiste;
- efeito externo atrás de adapter;
- não criar barrel files;
- não introduzir service/repository genérico sem caso real;
- medir query/payload antes de otimizar.

## Escopo

**Em escopo**

- cursos/conclusão;
- admin read models/actions/authoring;
- enrollments/grants;
- payments/webhooks;
- JMVStream;
- apresentação compartilhada de resources;
- paginação/read models onde volume medido justificar.

**Fora de escopo**

- microservices;
- trocar SQL por ORM genérico;
- reescrever todas as features de uma vez;
- mudar APIs/UX;
- abstração compartilhada sem dois consumidores reais;
- importar arquitetura das referências.

## Passos

### 1. Criar mapa de responsabilidades e mudanças

Para cada módulo, listar símbolos públicos, consumidores, invariantes, transações,
queries e efeitos. Marcar quais motivos de mudança são independentes.

**Verificar**: cada extração proposta tem consumidor e teste; eliminar extrações
baseadas apenas em contagem de linhas.

### 2. Extrair certificado/conclusão como primeiro corte

Após o plano 002, mover cálculo e emissão para um application service de certificado,
mantendo `completeLesson` como coordenador. Interface deve receber IDs/contexto
necessário e devolver resultado persistido.

**Verificar**: diff de comportamento E2E zero; testes concorrentes continuam passando.

### 3. Separar read models administrativos

Dividir:

- catálogo/autoria;
- alunas/acesso;
- financeiro;
- audit;
- settings.

Cada página consulta apenas projeção necessária. Introduzir paginação cursor-based
para alunas/enrollments quando teste de volume mostrar payload/latência acima do
budget definido.

**Verificar**: teste com volume sintético mede quantidade de rows, payload e queries;
nenhuma N+1.

### 4. Reduzir duplicação de resources

Extrair modelo de apresentação puro para extensão, label, tamanho e tom. Ícones React
podem ficar em adapters de UI; regra pura não importa componente.

**Verificar**: autoria e player compartilham testes das mesmas extensões/edge cases.

### 5. Fatiar JMVStream por lifecycle

Separar contratos:

- client HTTP;
- upload session;
- complete/poll/sync;
- delete;
- mapper de provider;
- persistence.

Preservar upload multipart direto, sem proxy/TUS.

**Verificar**: testes de contract existentes e casos de timeout/retry passam.

### 6. Substituir FormData manual repetido

Criar schemas por comando de admin. Action autentica, valida e chama caso de uso.
Não criar um parser universal que apague tipos/intenção.

**Verificar**: input inválido falha antes de SQL/provider.

### 7. Remover somente código comprovadamente órfão

Resolver `knip` após jornadas 007. Remover dependência/import/export apenas com busca
de consumidores e teste.

**Verificar**: `bun run knip` exit 0 ou allowlist documentada e mínima.

## Critérios de pronto

- [ ] cada módulo alterado tem responsabilidade nomeável;
- [ ] regras puras não dependem de UI;
- [ ] queries administrativas têm budget e paginação quando necessária;
- [ ] duplicação de resource foi removida;
- [ ] JMVStream mantém contratos e fluxo direto;
- [ ] nenhum comportamento/API/schema muda;
- [ ] E2E, integration, test, typecheck, check, knip e build passam.

## Condições STOP

- ausência de teste para comportamento que será movido;
- extração exige API genérica maior que os consumidores;
- query “otimizada” piora plano medido;
- refatoração muda transação/invariante;
- módulo novo apenas redistribui complexidade sem esconder decisão.

## Manutenção

Revisar profundidade, locality e deletion test em cada módulo novo. Tamanho é sinal;
interface e motivos de mudança são o critério.

