---
status: proposed
owner: engineering
last_verified_commit: 9d0450a275d5bdacfaa44e306ca1ad8958053c89
---

# Paridade de fonte entre PDF e preview PNG de Certificados

## Contexto e causa confirmada

O PDF é renderizado pelo PDFKit com a fonte padrão `Helvetica`, baseada em
arquivos AFM internos. O preview PNG cria um SVG com
`font-family="Helvetica, Arial, sans-serif"` e o rasteriza com Sharp/librsvg.
No ambiente Node da Vercel, o primeiro acesso ao preview registrou:

```text
Fontconfig error: Cannot load default config file: File not found
```

O servidor não possui fontes Helvetica/Arial instaladas nem uma configuração
Fontconfig disponível. O SVG ainda é convertido em PNG, mas os glifos ausentes
viram quadrados. O PDF não sofre do problema porque o PDFKit possui as métricas
AFM da Helvetica internamente.

## Decisões aprovadas

### Fonte oficial

Usar a família **Inter**, com os arquivos estáticos `Inter-Regular.ttf` e
`Inter-Bold.ttf`, distribuídos sob a SIL Open Font License 1.1. A licença e os
arquivos devem ser obtidos da distribuição oficial do projeto Inter e mantidos
no repositório junto com o aviso de licença. A escolha evita fontes clássicas,
é adequada para leitura em telas e possui suporte aos caracteres portugueses.

Os nomes persistidos `Helvetica` e `Helvetica-Bold` continuam aceitos para
preservar templates existentes. Eles passam a ser aliases internos:

- `Helvetica` => Inter Regular;
- `Helvetica-Bold` => Inter Bold.

### Paridade de renderização

PDFKit e Sharp devem consumir os mesmos arquivos físicos de fonte. O PDF deixa
de usar a Helvetica AFM padrão para novas emissões e passa a incorporar Inter.
O PNG continua usando o pipeline Sharp + SVG + composite, mas o SVG será
rasterizado com uma configuração Fontconfig empacotada que aponta para os
mesmos arquivos Inter. Nenhuma fonte do sistema será necessária.

O preview administrativo no navegador também usará Inter para que o editor,
o PNG final e o PDF tenham a mesma família tipográfica. O carregamento web
deve ser feito com os arquivos locais, sem alterar a fonte global do produto.

### Assets e bundle Vercel

As fontes e o arquivo de configuração Fontconfig viverão em um diretório
pertencente ao módulo de certificados, com um helper único para resolver os
caminhos absolutos e preparar o runtime Node. O `next.config.ts` incluirá os
assets no output tracing da função. A rota de preview permanecerá no runtime
Node.js, pois depende de Sharp e filesystem para localizar os assets.

O pipeline existente de imagem será preservado:

1. baixar a arte privada;
2. redimensionar para `1200x848` com Sharp;
3. compor SVG, QR e assinatura;
4. codificar PNG;
5. calcular e persistir `preview_sha256`;
6. servir o objeto privado por redirect assinado.

Não haverá `data:` font embutida no SVG, pois o librsvg/Sharp não suporta esse
modelo de forma confiável. A resolução será feita pelo Fontconfig empacotado.

### Cache e histórico

Não haverá backfill, invalidação ou revalidação semântica dos previews
existentes. O ambiente atual só possui certificados de teste. Previews antigos
podem permanecer como estão; novos previews serão criados corretamente após o
deploy.

`preview_sha256` continuará sendo a única validação do objeto armazenado. Não
será criado versionamento de renderer, hash de fonte ou nova regra de
reconstrução. A integridade criptográfica existente será preservada sem
complexificar o fluxo.

## Escopo técnico

### Código

- criar um módulo único de assets/fontes para mapear peso lógico, caminho do
  arquivo PDF e configuração Fontconfig;
- atualizar `renderCertificatePdf` para usar o arquivo Inter correspondente;
- atualizar `renderCertificatePreview` para preparar o Fontconfig empacotado e
  usar a família Inter no SVG;
- atualizar o layout do preview administrativo para usar a fonte local Inter;
- manter posições, dimensões, clipping, alinhamentos, QR, assinatura e hash
  inalterados;
- explicitar o runtime Node da rota de preview se necessário para preservar o
  uso de Sharp.

### Testes

Adicionar ou ajustar testes para provar:

- arquivos Inter Regular/Bold e licença existem no pacote esperado;
- o alias `Helvetica`/`Helvetica-Bold` resolve para os pesos Inter corretos;
- PDFKit recebe os arquivos Inter, não apenas os nomes AFM padrão;
- o PNG renderiza texto com acentos (`Ação`, `João`, `Responsável`) sem
  depender de fontes da máquina;
- o PNG mantém `1200x848`, PNG válido e hash SHA-256;
- o fluxo de preview continua regenerando somente quando o objeto não existe ou
  o hash não corresponde;
- a rota mantém redirect inline e não expõe chave R2;
- o bundle Vercel inclui os assets de fonte e Fontconfig;
- o editor usa a mesma família Inter sem alterar a tipografia global.

Os testes não devem exigir revalidação de previews históricos nem comparar
bytes do PDF e do PNG. A paridade será validada pela mesma fonte, peso,
acentuação e geometria, não por igualdade de formato.

## Fora de escopo

- regenerar certificados ou previews de teste existentes;
- alterar schema, migrations ou `preview_sha256`;
- criar uma segunda estratégia de rasterização via PDF;
- trocar a arte, o QR, a assinatura ou o contrato A4;
- mudar a tipografia global do Hub;
- adicionar dependência externa de CDN ou fonte instalada no sistema;
- criar validação visual em runtime além da integridade SHA-256 existente.

## Critério de aceite

Um novo Certificado emitido em Development, Staging ou Production apresenta os
mesmos textos, acentos, pesos e geometria visual no PDF e no preview PNG. O
preview é gerado sem erro de Fontconfig em uma função Vercel limpa, continua
com `1200x848`, mantém a verificação SHA-256 e não exige qualquer fonte
instalada na infraestrutura.

## Referências

- [Inter: repositório oficial e licença OFL](https://github.com/rsms/inter)
- [SIL Open Font License 1.1](https://openfontlicense.org/)
- [Sharp: Fontconfig e fontes em SVG](https://github.com/lovell/sharp/blob/main/docs/src/content/docs/install.md)
- [PDFKit: fontes padrão e fontes externas](https://github.com/foliojs/pdfkit/blob/master/docs/text.md)
