# Certificados de conclusão em LMS: práticas de produção e critérios para o Hub

**Data da pesquisa:** 2026-08-07  
**Fuso:** America/Sao_Paulo  
**Data de acesso de todas as fontes externas:** 2026-08-07  
**Escopo:** pesquisa externa, somente leitura, contra especificações, legislação, documentação oficial e repositórios mantidos pelos próprios projetos.  
**Limite:** este documento define referências e critérios de avaliação. Não é auditoria jurídica, não afirma conformidade do código atual e não transforma extensões opcionais em requisitos do produto.

## Conclusão executiva

O desenho canônico do Hub parte de fundamentos fortes para um certificado de conclusão convencional: artefato privado e imutável, snapshots no momento da emissão, consulta pública mínima por código/QR, revogação sem apagamento e reemissão como nova evidência. Essa escolha é mais auditável do que regenerar o mesmo certificado com dados ou template atuais e é coerente com a separação entre conclusão histórica e estado atual do curso definida em [Certificados e direitos de dados](../docs/domain/certificates-and-data-rights.md) e no [ADR-0006](../docs/adr/0006-certificate-lifecycle.md).

Para produção, o padrão mínimo não é “gerar um PDF”. É manter um registro autoritativo, um ciclo de estados explícito, emissão idempotente, artefato imutável, download autorizado, verificação pública que permita confrontar as alegações visíveis, revogação imediatamente observável, controles contra enumeração e IDOR, acessibilidade, retenção definida e operação recuperável. A OWASP exige autorização por objeto em toda operação privada e ressalta que identificadores complexos são apenas defesa em profundidade, nunca substituto para autorização ([IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html); [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)).

Open Badges 3.0, W3C Verifiable Credentials 2.0, PAdES e PDF/A são extensões distintas:

- **Open Badges 3.0:** apropriado se o Hub precisar de portabilidade, wallets, critérios/evidências estruturados e interoperabilidade educacional. Não é requisito para um PDF verificável no site.
- **W3C Verifiable Credentials 2.0:** camada geral de credenciais verificáveis. Para conclusão educacional, Open Badges 3.0 é um perfil mais específico e evita inventar um vocabulário próprio.
- **PAdES/assinatura digital do PDF:** apropriado se for necessário provar autoria e integridade do arquivo fora do Hub, inclusive offline. O hash SHA-256 interno, isoladamente, não oferece essa propriedade a terceiros.
- **PDF/A:** apropriado quando houver requisito real de preservação de longo prazo; não é sinônimo de acessibilidade nem requisito automático para todo certificado.
- **PDF/UA ou PDF devidamente marcado:** apropriado para acessibilidade do próprio arquivo. Uma página HTML acessível é uma alternativa de acesso importante, mas não torna um PDF inacessível em PDF acessível.

O bloqueio externo mais claro para declarar prontidão LGPD é a falta de uma política formal que fixe finalidade, base legal, transparência, canal de direitos e prazos de retenção. A LGPD não fornece um prazo universal: o tratamento termina quando a finalidade é atingida ou os dados deixam de ser necessários, com conservação apenas nas hipóteses do art. 16 ([Lei 13.709/2018, arts. 15 e 16](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)); a própria ANPD confirma que o prazo depende da finalidade e do contexto ([FAQ ANPD, item 5.5](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes)).

## 1. Enquadramento do Hub

O Hub define certificado como evidência histórica para uma Aluna e um Curso. A emissão guarda snapshots, o PDF fica em armazenamento privado, o QR/código abre somente uma consulta pública mínima, revogação preserva histórico e reemissão cria novo código e novo artefato. A conclusão histórica não é apagada por publicação posterior nem pela revogação do certificado. Fontes internas: [Produto](../PRODUCT.md), [Glossário](../CONTEXT.md), [guia de domínio](../docs/domain/certificates-and-data-rights.md), [ADR-0006](../docs/adr/0006-certificate-lifecycle.md) e [DEC-DISC-006/008](../docs/decisions.md).

Esses contratos posicionam o Hub como emissor de **certificado de conclusão**, não como autoridade certificadora, carteira de credenciais, sistema de identidade descentralizada ou serviço de assinatura qualificada. “Certificado digital” no sentido ICP-Brasil é uma identidade criptográfica emitida por uma Autoridade Certificadora e não deve ser confundido com o certificado educacional ([ITI, Certificação Digital](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital)).

### Critério aplicável ao Hub

Preservar a fronteira atual: a autoridade de negócio é o registro de conclusão/certificado no Postgres; o PDF é uma representação imutável; a consulta pública informa o status atual; qualquer Open Badge, VC ou assinatura PDF futura deve ser uma projeção derivada e sincronizada, não uma segunda fonte de verdade.

## 2. O que é obrigatório, condicionado ou opcional

### Baseline de produção

- Ciclo de emissão, renderização, entrega, revogação e reemissão modelado por estados e transições válidas no servidor.
- Snapshot imutável das alegações exibidas e da versão do template/renderizador.
- Emissão e entrega idempotentes, com restrições de unicidade e recuperação após falhas parciais.
- Código público não sequencial, gerado com CSPRNG, com restrição `UNIQUE` e retry limitado.
- Verificação pública em HTTPS, status atual e campos suficientes para comparar o documento apresentado.
- PDF/objeto privado, download com autorização por objeto e sem URL pública permanente.
- Revogação sem apagar evidência operacional; reemissão com novo identificador e vínculo ao anterior.
- Acessibilidade do conteúdo, QR testado e código/URL também disponíveis como texto.
- Logs/auditoria minimizados, métricas e alertas para falhas de emissão, renderização, e-mail e revogação.
- Política formal de privacidade, retenção, direitos e incidentes.

### Condicionado a requisito explícito

- PDF/UA-2 ou declaração formal de conformidade WCAG do PDF.
- PDF/A-4 para preservação arquivística de longo prazo.
- PAdES/ICP-Brasil para verificação criptográfica do PDF fora do Hub ou requisito jurídico específico.
- Prazo de expiração do certificado. Conclusão de curso normalmente pode ser permanente; validade deve vir de regra pedagógica, regulatória ou comercial, não de padrão técnico.

### Opcional, orientado a interoperabilidade

- Open Badges 3.0.
- W3C Verifiable Credentials 2.0, wallet, DID, apresentação seletiva e Bitstring Status List.
- Página pública indexável, compartilhamento social e evidências públicas. Essas escolhas ampliam exposição e exigem decisão de produto/privacidade.

### Critério aplicável ao Hub

Não bloquear o lançamento por ausência de Open Badges, VC, PAdES ou PDF/A sem requisito aprovado. Bloquear por ausência de autorização por objeto, idempotência, revogação verificável, privacidade mínima, acessibilidade suficiente, recuperação operacional ou política de retenção.

## 3. Modelo de ciclo de vida

### 3.1 Estados separados

Um único campo “status” tende a misturar três fatos diferentes:

1. **Elegibilidade:** a conclusão autoriza emitir?
2. **Validade da evidência:** o certificado está válido ou revogado?
3. **Disponibilidade do artefato:** o PDF está pendente, em renderização, pronto ou falhou?

O Open edX expõe estados como `downloadable`, `notpassing`, `unavailable` e `unverified`; sua decisão registra que certificado invalidado fica `unavailable` e que estados históricos continuam existindo ([Course certificate Status](https://docs.openedx.org/projects/edx-platform/en/latest/references/docs/lms/djangoapps/certificates/docs/decisions/004-cert-status.html)). Isso prova a utilidade de estados explícitos, mas também mostra o custo de condensar elegibilidade, identidade e disponibilidade em uma enumeração única.

O modelo recomendado para o Hub é manter e testar dimensões separadas:

- `certificate_status`: `valid` ou `revoked`;
- `render_status`: `pending`, `processing`, `ready`, `failed/retryable`;
- elegibilidade derivada de `CourseCompletion` e das regras aprovadas, não do estado de renderização;
- entrega de e-mail como efeito durável separado.

### 3.2 Invariantes

1. A emissão só usa uma conclusão persistida e autorizada; nunca confia em percentual ou estado enviado pelo cliente.
2. A mesma intenção de emissão não cria dois certificados por retry, duplo clique, webhook ou worker concorrente.
3. Código público, snapshot e chave do artefato não mudam depois da emissão.
4. Alterar nome, curso, carga horária, template ou marca não reescreve certificado histórico.
5. Revogação é terminal para aquela evidência. O W3C define `revocation` como cancelamento não reversível; `suspension` é o estado reversível, quando essa distinção existe ([Bitstring Status List v1.0, `statusPurpose`](https://www.w3.org/TR/vc-bitstring-status-list/#bitstringstatuslistentry)).
6. Reemissão revoga o anterior e cria nova evidência, novo código, novo snapshot e vínculo predecessor/sucessor na mesma transação lógica.
7. Falha após upload não pode causar outro artefato divergente para o mesmo certificado; o job retoma/finaliza o objeto determinístico.
8. Revogação concorrente com renderização impede transição posterior para “pronto” e impede entrega.
9. O PDF já baixado não pode ser recolhido; a consulta pública é a autoridade para validade atual.
10. A razão interna, autoria e evidências operacionais de revogação não são públicas; a categoria pública deve ser curta e não revelar investigação ou dado pessoal.

### 3.3 Idempotência e consistência

O histórico do plugin open-source `moodle-mod_customcert` registra correções de corrida em emissão, índice único por usuário/certificado, emissão/e-mail únicos e tratamento explícito de colisão de código após tentativas limitadas ([changelog oficial](https://github.com/mdjnelson/moodle-mod_customcert/blob/main/CHANGES.md)). Esses incidentes reais justificam controles no banco, não apenas checagens prévias em aplicação.

Controles recomendados:

- índice/constraint que materialize a cardinalidade aprovada de certificado válido;
- idempotency key estável para emissão automática e para cada comando manual;
- inserção do certificado e da intenção de renderização na mesma transação;
- compare-and-set/lock para transições;
- lease com fencing token para renderização lenta;
- artefato por chave interna determinística, nunca por nome fornecido pelo usuário;
- intenção de e-mail somente após `render_status=ready`;
- reconciliador periódico para mensagens órfãs, lease expirado, PDF órfão e estado divergente;
- auditoria de `actor`, ação, categoria, timestamps, predecessor/sucessor e correlação, sem armazenar conteúdo sensível desnecessário.

### Critério aplicável ao Hub

O desenho canônico já escolhe snapshots, outbox, lease/fencing e artefato determinístico. A revisão de produção deve provar cada invariante por constraint, transação e teste concorrente; não basta a documentação descrevê-los.

## 4. Identificador público, enumeração e anti-IDOR

### 4.1 O código não é autorização

A OWASP define IDOR como acesso indevido a um objeto por referência controlável, inclusive UUID, slug ou nome de arquivo. Identificadores complexos reduzem adivinhação, mas a defesa principal continua sendo autorização por objeto ([IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)).

Há duas superfícies distintas:

- **Consulta pública:** o visitante é deliberadamente autorizado a ver um conjunto mínimo de alegações quando possui o código. Aqui, o código funciona como localizador difícil de enumerar, não como permissão para acessar todo o registro.
- **PDF, administração e dados internos:** exigem sessão, permissão e relação com o objeto em toda requisição. Possuir o código, UUID, ID de template ou chave de armazenamento nunca autoriza download, alteração, revogação ou reemissão.

O RFC 9562 recomenda CSPRNG para UUIDs difíceis de prever e define UUIDv4 com 122 bits aleatórios, mas adverte que UUIDs não devem ser tratados como capacidades de segurança ([RFC 9562, seções 5.4, 6.9 e 8](https://www.rfc-editor.org/rfc/rfc9562.html)).

### 4.2 Formato e geração

Baseline recomendado:

- pelo menos a imprevisibilidade de um UUIDv4 gerado por CSPRNG ou token aleatório equivalente;
- representação URL-safe, sem e-mail, iniciais, ID sequencial, timestamp ou checksum derivado de dado pessoal;
- constraint `UNIQUE` no banco e retry com limite;
- lookup exato e normalização estrita; não aceitar busca parcial, prefixo ou curingas;
- código diferente do ID interno e da chave do objeto;
- código impresso em grupos legíveis, além do QR, se houver entrada manual;
- não registrar o código bruto em logs de aplicação/analytics quando um hash ou ID interno basta.

Um código curto favorece digitação, mas reduz espaço de busca. Moodle Workplace documenta código de dez dígitos mais duas letras e oferece verificação por formulário/QR ([Certificates Configuration](https://docs.moodle.org/502/en/Certificates_Configuration)). Isso é precedente de mercado, não prova de segurança ideal para uma página com dados pessoais. O Hub pode aceitar um código longo porque o QR elimina a maior parte da digitação; se adotar alias curto, deve tratá-lo como superfície própria, com análise de entropia, rate limit e telemetria.

### 4.3 Verificação pública

A página deve exibir, no mínimo:

- emissor/organização;
- status inequívoco: válido ou revogado;
- nome do titular na forma impressa;
- curso/credencial na forma impressa;
- data de conclusão e/ou emissão conforme o documento;
- carga horária, quando ela for alegação do PDF;
- código público;
- data de revogação e categoria pública, se revogado;
- instrução para comparar esses campos com o documento apresentado.

Mostrar apenas “certificado válido” cria uma falha lógica: um atacante pode conservar QR/código legítimo e alterar nome, curso, carga ou data no PDF. A página precisa permitir comparação das alegações relevantes, ou o PDF precisa ter uma assinatura criptográfica externamente verificável. A verificação de Open Badges também separa autenticidade técnica de validação de negócio e recomenda verificar o sujeito por valor conhecido fora de banda ([Open Badges 3.0, seção 9.1](https://www.imsglobal.org/spec/ob/v3p0/#openbadgecredential-verification)).

Não expor na página pública:

- e-mail, CPF, telefone, endereço, ID interno, ID de usuário, nome de operador;
- motivo interno livre, evidência, comentários, logs, IP ou estado de matrícula;
- link direto ao PDF ou chave de armazenamento;
- listagem, busca por nome/e-mail, certificados relacionados ou contagem total;
- metadados de compra, nota, progresso detalhado ou conteúdo não impresso.

Retorno recomendado:

- código existente e válido: `200` com dados mínimos;
- código existente e revogado: `200` com status revogado e dados mínimos necessários para reconhecer a evidência; não transformar em `404`, pois isso elimina a função pública da revogação;
- código inexistente/malformado: resposta genérica, sem sugestões, busca aproximada ou detalhes de banco;
- limite por IP/rede, código e sinais de automação, com `429` e `Retry-After` quando aplicável. A OWASP observa que endpoints públicos podem ser explorados para consumo excessivo e recomenda rate limiting ([REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)).

### 4.4 Indexação, referrer e terceiros

- Usar `noindex`/`X-Robots-Tag: noindex` reduz indexação por mecanismos cooperativos ([Google Search Central](https://developers.google.com/search/docs/crawling-indexing/block-indexing)).
- `robots.txt` não é controle de acesso; o RFC 9309 diz expressamente que o protocolo não substitui medidas de segurança ([RFC 9309, seção 3](https://www.rfc-editor.org/rfc/rfc9309.html#section-3)).
- Aplicar `Referrer-Policy: no-referrer` ou política igualmente restritiva na página evita enviar a URL completa para destinos externos; a política `no-referrer` omite o cabeçalho ([W3C Referrer Policy](https://www.w3.org/TR/referrer-policy/#referrer-policy-no-referrer)).
- Evitar scripts, pixels, fontes e imagens de terceiros na página de verificação. Além de disponibilidade, eles recebem sinais de acesso e podem correlacionar a credencial.
- Não incluir a rota pública em sitemap, busca interna, analytics identificável ou previews sociais com nome.
- Cabeçalhos e cache devem impedir armazenamento compartilhado de dados pessoais quando não houver requisito de cache público; CDN deve variar corretamente e permitir revogação rápida.

### 4.5 Testes anti-IDOR

- Aluna A não baixa o PDF da Aluna B por ID, código, path ou URL assinada reaproveitada.
- Suporte/Admin sem a permissão específica não emite, revoga ou reemite.
- Um operador autorizado em um curso não edita template/elemento de outro contexto apenas trocando IDs.
- Ação, Route Handler, Server Component e acesso direto ao storage aplicam a mesma política.
- Código público não abre PDF, detalhes internos ou APIs administrativas.
- Mudanças de método HTTP, content type, IDs no body e parâmetros duplicados não contornam autorização.

Essa classe de teste não é teórica: em 2026, o `moodle-mod_customcert` corrigiu CVE-2026-30884, em que um usuário com permissão em um curso podia ler/sobrescrever elementos de certificados de outros cursos fornecendo `elementid`; correções subsequentes ampliaram validação de ownership para template, páginas, AJAX, API externa e fragments ([changelog 5.2.0–5.2.4](https://github.com/mdjnelson/moodle-mod_customcert/blob/main/CHANGES.md)).

### Critério aplicável ao Hub

Tratar `/certificados/[code]` como disclosure público deliberado e mínimo. Tratar todos os demais recursos como privados e autorizados por relação/objeto. Exigir testes multiusuário e cross-template como gate de produção.

## 5. QR Code

O QR é um mecanismo de transporte. Ele não assina o PDF, não prova autoria e não deve carregar informação pessoal. Moodle Workplace usa QR para redirecionar à página de verificação, ao lado de código e URL ([Certificates Configuration](https://docs.moodle.org/502/en/Certificates_Configuration)); esse é o padrão adequado para o Hub.

Requisitos recomendados:

- codificar somente a URL HTTPS canônica `https://dominio-estavel/certificados/<code>`;
- domínio controlado de longo prazo; redirects preservados em mudanças de rota;
- não codificar nome, e-mail, ID interno, hash do arquivo, JSON completo, URL temporária ou link direto ao PDF;
- imprimir também código e URL curta em texto para acessibilidade e falha de câmera;
- alto contraste, fundo liso, sem logo sobre módulos, sem deformação;
- “quiet zone” de quatro módulos; a DENSO recomenda margem de quatro módulos e nível M como ponto de partida ([determinando a área do QR](https://www.qrcode.com/en/howto/code.html));
- escolher versão/tamanho considerando comprimento da URL e impressão; conteúdo maior aumenta número de módulos e reduz tolerância prática ([ISO/IEC 18004:2024](https://www.iso.org/standard/83389.html));
- teste automatizado de decodificação da imagem produzida e teste físico em impressora comum, câmera iOS/Android, zoom e compressão;
- QR da versão final do PDF, não de preview do template.

### Critério aplicável ao Hub

O QR deve abrir a mesma página pública usada pelo código impresso. Sua legibilidade e estabilidade de domínio entram no contrato do artefato; mudanças de rota precisam de redirects permanentes e testes regressivos.

## 6. Integridade e autenticidade

### 6.1 Quatro garantias diferentes

1. **Hash do artefato:** detecta se bytes recuperados diferem dos bytes esperados, desde que o hash esperado venha de fonte confiável.
2. **Página autoritativa:** informa status atual e permite comparar alegações visíveis.
3. **Assinatura digital do PDF:** detecta modificação e autentica o signatário conforme a cadeia/chave confiada.
4. **VC/Open Badge assinado:** oferece representação estruturada e verificável da credencial, separada do PDF.

Uma assinatura digital fornece proteção de autenticidade e integridade; não fornece confidencialidade ([NIST, glossário “digital signature”](https://csrc.nist.gov/glossary/term/digital_signature)). O W3C Data Integrity define provas criptográficas para autenticidade e integridade de documentos de dados ([Verifiable Credential Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/)).

### 6.2 Hash SHA-256

Persistir SHA-256 do PDF é útil para:

- verificar corrupção em download/restore;
- provar que o objeto no storage é o artefato final esperado;
- detectar upload sobrescrito;
- apoiar investigação e auditoria.

Mas não permite que um terceiro confirme autoria se ele não consegue obter o digest esperado por canal confiável. Publicar o hash na mesma página comprometida que serve o arquivo não protege contra comprometimento completo do emissor. Também não informa revogação por si só.

Baseline:

- calcular hash sobre bytes finais após metadados, QR e otimização;
- persistir hash, tamanho, MIME real, renderer/template version e chave do objeto;
- conferir hash em reconciliação e, se viável, no caminho de entrega sem tornar download caro;
- não usar ETag de object storage como substituto universal de SHA-256;
- nunca reconstruir “o mesmo” certificado com conteúdo diferente sob o mesmo hash/registro.

### 6.3 PAdES e ICP-Brasil

PAdES é o perfil de assinatura digital incorporada ao PDF. O ETSI EN 319 142-1 define assinaturas PAdES e níveis baseline para necessidades crescentes de validação de longo prazo ([ETSI EN 319 142-1 v1.2.1](https://www.etsi.org/deliver/etsi_EN/319100_319199/31914201/01.02.01_60/en_31914201v010201p.pdf)). No Brasil, o ITI orienta priorizar PAdES ICP-Brasil nos casos abrangidos pelo seu validador ([Guia do Desenvolvedor VALIDAR](https://h-validar.iti.gov.br/guia-desenvolvedor.html)).

Trade-offs:

- **Sem assinatura:** menor complexidade; depende da página pública e comparação visual. Adequado para certificado de conclusão de baixo risco se essa é a promessa do produto.
- **Assinatura self-signed:** detecta alteração, mas o terceiro precisa confiar/distribuir corretamente a chave. Moodle Workplace oferece esse modelo; ele não equivale a confiança pública ([Moodle Certificates Configuration](https://docs.moodle.org/502/en/Certificates_Configuration)).
- **PAdES com certificado confiável:** melhora verificação fora do Hub, mas adiciona gestão de chaves, rotação, timestamp, cadeia, revogação do certificado de assinatura, custo e operação.
- **PAdES ICP-Brasil:** só deve ser adotado com requisito jurídico/negocial explícito e validação especializada. Não é requisito geral de certificado de curso.

Se adotado, a chave privada não pode ficar em repositório, banco comum ou variável exposta ao runtime inteiro. Exigir KMS/HSM ou serviço restrito, rotação, dupla autorização para operações críticas, timestamp conforme perfil escolhido, procedimento para compromisso de chave e validação em ferramentas independentes.

### Critério aplicável ao Hub

Manter SHA-256 como controle operacional. Na página pública, mostrar todos os campos relevantes para comparação. Avaliar PAdES somente se o produto exigir verificação do arquivo fora do Hub ou força probatória adicional; documentar a promessa exata antes da implementação.

## 7. PDF, metadados, acessibilidade e preservação

### 7.1 Conteúdo e metadados mínimos

O PDF deve conter texto real para nome, curso, datas, carga horária, emissor, código e URL; não deve ser uma única imagem raster. Metadados recomendados:

- `Title`: “Certificado de conclusão — <curso>”;
- `Author`/emissor institucional;
- `Subject`: conclusão do curso, sem dados adicionais;
- data de criação coerente com emissão;
- idioma do documento (`pt-BR`);
- identificador público apenas se já for visível no documento;
- versão do produtor/renderizador somente se útil à operação e sem expor detalhes vulneráveis.

Não colocar e-mail, CPF, IDs internos, chave do storage, motivo interno ou dados invisíveis desnecessários em XMP, comentários, anexos, nomes de arquivo ou propriedades. O princípio da necessidade limita tratamento ao mínimo pertinente e não excessivo ([LGPD, art. 6º, III](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)).

### 7.2 Acessibilidade

As técnicas PDF do WCAG 2.2 incluem texto alternativo, ordem de leitura/tabulação, marcação de imagens decorativas, headings, links, idioma padrão e título do documento ([W3C WCAG 2.2 PDF Techniques](https://www.w3.org/WAI/WCAG22/Techniques/#pdf)). Para um certificado simples, verificar ao menos:

- árvore de tags e ordem de leitura coerentes;
- texto selecionável e extraível em ordem natural;
- `Title` e idioma `pt-BR`;
- imagem de fundo marcada como artefato/decorativa;
- logo com texto alternativo quando acrescenta informação;
- QR com alternativa textual contendo URL/código e finalidade;
- contraste de texto e tamanho legível;
- fontes incorporadas e mapeamento Unicode/ToUnicode;
- link de verificação semanticamente marcado;
- leitura satisfatória em NVDA/JAWS/VoiceOver e teclado;
- página HTML de verificação acessível com o mesmo conteúdo essencial.

ISO 14289-2:2024 (PDF/UA-2) especifica como construir PDF 2.0 acessível ([ISO 14289-2](https://www.iso.org/standard/82278.html)). Conformidade declarada exige ferramenta e revisão humana; checagem automática cobre somente parte dos requisitos. `veraPDF` implementa perfis de validação PDF/UA e PDF/A, mas também esclarece que, em PDF/UA, somente os checks verificáveis por máquina são automatizados ([veraPDF Validation](https://docs.verapdf.org/validation/)).

### 7.3 PDF/A

PDF/A-4 é uma forma restrita de PDF 2.0 destinada à preservação de representação visual estática ao longo do tempo ([ISO 19005-4:2020](https://www.iso.org/standard/71832.html)). Não é requisito para toda emissão e não substitui backup, versionamento, integridade, retenção ou PDF/UA.

Adotar se houver um requisito como “o arquivo deve permanecer renderizável por décadas fora do sistema”. Custo: biblioteca compatível, fontes/licenças incorporáveis, perfil de cor, metadados, ausência/restrição de recursos e validação contínua. Se não houver esse requisito, PDF convencional imutável, fontes incorporadas, snapshot e verificação pública podem ser suficientes.

### 7.4 Testes do artefato

- snapshot visual em resoluções/DPI conhecidas;
- extração de texto e comparação dos campos;
- validação de metadados e idioma;
- QR decodificado a partir do PDF renderizado;
- fontes incorporadas e caracteres portugueses/nomes extensos;
- nomes com acentos, hífen, apóstrofo, múltiplos sobrenomes e scripts suportados;
- cursos/cargas longos, datas localizadas e overflow;
- arquivo abre em Chrome, Edge, Firefox, Acrobat e leitores móveis;
- leitura com tecnologia assistiva;
- hash idêntico em retry do mesmo artefato final;
- `Content-Type: application/pdf`, `Content-Disposition` seguro e filename sanitizado;
- se houver declaração PDF/A ou PDF/UA, validação por perfil e revisão humana antes do release.

### Critério aplicável ao Hub

Tratar acessibilidade do PDF como requisito de qualidade do artefato. Se a biblioteca atual não consegue gerar tags/ordem/idioma adequados, registrar o gap e fornecer HTML equivalente não basta para afirmar que o PDF é acessível. PDF/A e PDF/UA formal entram apenas mediante decisão explícita, mas título, idioma, texto real, alternativa ao QR e leitura natural devem ser baseline.

## 8. Open Badges 3.0

Open Badges 3.0 define credenciais de conquistas, critérios, evidências, emissor, destinatário e procedimentos de verificação. A versão 3.0 foi aprovada como Final em junho de 2024 e é baseada em Verifiable Credentials, com provas criptográficas e API de intercâmbio ([roadmap 1EdTech](https://www.1edtech.org/standards/roadmap); [especificação 3.0](https://www.imsglobal.org/spec/ob/v3p0/)).

Na verificação, o padrão distingue:

- conformidade estrutural/schema;
- prova/assinatura;
- refresh, se configurado;
- status revogado/não válido/expirado;
- identificação opcional do destinatário por valor conhecido fora de banda;
- validação de negócio, que permanece responsabilidade do verificador ([Open Badges 3.0, seção 9](https://www.imsglobal.org/spec/ob/v3p0/#verification-and-validation)).

O modelo permite `proof`, `credentialSchema`, `credentialStatus`, `evidence`, período de validade e dados do achievement ([Open Badges 3.0, modelo](https://www.imsglobal.org/spec/ob/v3p0/#openbadgecredential)). Identidade em texto claro não deve ser persistida/transmitida quando vazaria PII; o padrão recomenda hash de identidade nessas situações ([Open Badges 3.0, `IdentityObject`](https://www.imsglobal.org/spec/ob/v3p0/#identityobject)).

### Quando faz sentido para o Hub

- Alunas precisam levar credenciais a wallets/backpacks externos.
- Parceiros querem verificação automática, critérios e evidências estruturados.
- Há estratégia de microcredenciais, competências ou integração com empregadores.
- Interoperabilidade reduz dependência da URL/PDF do Hub.

### Quando não faz sentido ainda

- O único caso é baixar/mostrar um certificado de conclusão.
- Não existe parceiro, wallet ou jornada de exportação aprovada.
- A equipe não pode operar chaves, status, schemas e compatibilidade.
- A adoção seria apenas um selo de “modernidade” sem consumidor real.

### Caminho incremental

1. Preservar certificado relacional/PDF como fonte autoritativa.
2. Definir mapeamento explícito de snapshots para `AchievementCredential`.
3. Gerar Open Badge somente por solicitação da Aluna ou política aprovada.
4. Assinar com chave gerida e publicar material de verificação.
5. Sincronizar revogação do certificado com `credentialStatus`.
6. Testar no 1EdTech Validator e com pelo menos uma wallet/displayer real.
7. Versionar schema, issuer, chave e status sem reescrever credenciais emitidas.

### Critério aplicável ao Hub

Open Badges 3.0 é a primeira opção de interoperabilidade educacional, mas é pós-baseline. Implementá-lo como adaptador/projeção opcional, protegido por feature flag e contrato próprio, seguindo o precedente arquitetural do Open edX, que manteve VC como aplicação opcional e extensível por backends ([ADR Open edX 0008](https://docs.openedx.org/projects/edx-credentials/en/latest/decisions/0008-verifiable-credentials-issuing.html)).

## 9. W3C Verifiable Credentials 2.0

Verifiable Credentials Data Model 2.0 tornou-se W3C Recommendation em 15 de maio de 2025. Define credenciais estruturadas, extensíveis, verificáveis por máquina e protegidas por mecanismos criptográficos; `credentialStatus` permite descobrir suspensão/revogação ([VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)).

Para produção, as considerações de privacidade são essenciais:

- não existe nível de identificação correto para todo caso; a solução depende do uso;
- identificadores persistentes podem permitir correlação;
- consultar status único por credencial pode informar ao emissor onde/quando ela está sendo usada;
- apresentação seletiva e provas não correlacionáveis existem, mas exigem suporte do emissor e não são automáticas ([VC Data Model 2.0, Privacy Considerations](https://www.w3.org/TR/vc-data-model-2.0/#privacy-considerations)).

Bitstring Status List v1.0 é W3C Recommendation de 2025 e publica revogação/suspensão em lista compacta e orientada a privacidade. O padrão define lista mínima de 131.072 entradas para privacidade de grupo e recomenda índices aleatórios para não revelar recência ou tamanho da população ([Bitstring Status List v1.0](https://www.w3.org/TR/vc-bitstring-status-list/)). Isso só é necessário se o Hub emitir VCs compatíveis; o status relacional da página pública não precisa imitar a estrutura.

Custos reais de VC:

- gestão e rotação de chaves/issuer identifiers;
- prova criptográfica e dependências atualizadas;
- schema/context versionados e proteção contra contextos remotos maliciosos/indisponíveis;
- status list altamente disponível e cacheável;
- wallet/deep-link/protocolo de entrega;
- estratégia de backup e recuperação de chaves;
- sincronização de revogação e resposta a comprometimento de chave;
- threat model de correlação e minimização;
- testes de interoperabilidade, não apenas testes unitários.

O Open edX oferece precedente útil de feature flag, modelos/backends e status storage, mas sua documentação atual ainda mostra VC Data Model v1.1, `StatusList2021` e dependências antigas em alguns caminhos ([configuração Open edX VC](https://docs.openedx.org/projects/edx-credentials/en/latest/verifiable_credentials/configuration.html)). Isso é evidência para não copiar versões de projeto sem confrontar as Recomendações W3C atuais.

### Critério aplicável ao Hub

Não criar um VC genérico próprio se Open Badges 3.0 satisfaz o domínio. Se houver adoção, usar VC 2.0 e Bitstring Status List atuais, fixar versões, eliminar chaves de exemplo/configuração, executar revisão criptográfica e manter a funcionalidade opcional até interoperabilidade e operação serem comprovadas.

## 10. LGPD, retenção e direitos

Nome, curso, datas, código ligado a uma pessoa, PDF e histórico de emissão são dados pessoais quando relacionados a pessoa identificada/identificável. O conjunto pode revelar informação mais delicada conforme o tema do curso, mesmo quando cada campo isolado parece inofensivo.

Princípios relevantes:

- finalidade específica e informada;
- adequação;
- necessidade/minimização;
- livre acesso;
- qualidade/exatidão;
- transparência;
- segurança, prevenção e prestação de contas ([LGPD, art. 6º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)).

### 10.1 Decisões que precisam existir antes de produção

- controlador e operadores envolvidos (Vercel, Neon, R2, e-mail, observabilidade etc.);
- finalidade e base legal para emissão, armazenamento, download, verificação pública e auditoria;
- se a publicação do nome/curso é necessária e esperada, ou se depende de escolha de compartilhamento da Aluna;
- aviso de privacidade com campos públicos, duração, compartilhamentos e canal de direitos;
- política de correção: corrigir dados atuais não reescreve evidência; reemissão preserva histórico;
- prazos por categoria: certificado válido, revogado, snapshots, PDF, logs, eventos, backups e auditoria;
- fundamento para conservar histórico após encerramento da conta ou pedido de eliminação;
- procedimento de acesso, correção, oposição, anonimização/bloqueio/eliminação quando aplicável;
- processo de incidente, responsáveis, evidências e comunicação.

A LGPD prevê correção, acesso e eliminação/bloqueio em hipóteses aplicáveis, mas também admite conservação após o término somente para finalidades do art. 16 ([LGPD, arts. 16 e 18](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)). “Auditoria” genérica não é prazo nem base legal; o controlador deve documentar a finalidade e a necessidade de cada categoria.

### 10.2 Página pública e consentimento

Consentimento não é automaticamente a melhor base legal e não deve ser inventado pela engenharia. Se a verificação pública for parte necessária do serviço de certificado, outra base pode ser aplicável; se compartilhamento for opcional, uma escolha explícita de publicação pode reduzir exposição. A definição depende de avaliação jurídica e de expectativas da titular.

Alternativas de produto:

- **Sempre público por link não enumerável:** simples e verificável; expõe nome/curso a qualquer possuidor e pode vazar em logs/referrers.
- **Publicação ativada pela Aluna:** mais controle; QR pode deixar de funcionar quando despublicado, exigindo estado claro.
- **Verificação em duas etapas:** código + valor conhecido (por exemplo, sobrenome); reduz divulgação casual, mas aumenta fricção e ainda trata dados.
- **Página mínima + assinatura/VC:** reduz necessidade de exibir tudo publicamente, mas aumenta complexidade criptográfica.

### 10.3 Retenção

Não adotar “reter para sempre” nem apagar tudo ao encerrar conta. Criar matriz com dado, finalidade, base, início do prazo, duração, destino, exceção e responsável. A ANPD afirma que a LGPD não fixa prazo único; ele depende da finalidade e das circunstâncias ([FAQ ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes)).

Exemplo de categorias a decidir, sem prescrever prazo:

- conclusão histórica;
- registro do certificado e snapshots;
- PDF válido;
- PDF revogado;
- categoria/detalhe de revogação;
- vínculo de reemissão;
- logs de download/consulta;
- rate limits;
- mensagens/outbox;
- backups e réplicas;
- incidentes de segurança.

A Resolução CD/ANPD 15/2024 exige comunicação de incidente relevante à ANPD e titulares em três dias úteis, salvo prazo específico, e registro do incidente por pelo menos cinco anos ([ANPD, Comunicação de Incidente](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)). Esse prazo específico de incidentes não autoriza reter todos os dados do certificado por cinco anos.

### Critério aplicável ao Hub

Considerar política jurídica de certificado/verificação/retenção um gate de produção. A política deve estar refletida em transparência, canal de direitos, runbook, jobs e testes; não prometer conformidade LGPD apenas porque há limpeza técnica.

## 11. Upload, template e armazenamento

Templates e imagens de fundo são conteúdo não confiável mesmo quando enviados por Admin. A OWASP recomenda allowlist de extensões, validação de conteúdo real, filename gerado pela aplicação, limite de tamanho, autenticação/autorização e armazenamento fora do webroot ou em host separado ([File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

Controles:

- formatos mínimos realmente necessários; evitar SVG/SVGZ se a cadeia de sanitização/renderização não for segura;
- conferir magic bytes e decodificar a imagem, não confiar em extensão/MIME;
- limitar bytes, dimensões, pixels, páginas e tempo de decode;
- re-encode para formato canônico quando possível, removendo metadados;
- bloquear URLs remotas, referências externas e SSRF no renderizador;
- chave interna aleatória/determinística, filename original só como dado sanitizado opcional;
- bucket privado, sem listing público, ACL pública ou domínio direto;
- download via aplicação/autorização ou URL assinada curta, vinculada ao objeto correto;
- criptografia em trânsito e repouso, backup/restore testados;
- template versionado e snapshot da arte usada por certificado;
- remoção de arte antiga somente após provar ausência de referências e respeitar carência/lease;
- dependências nativas de imagem/PDF atualizadas e cobertas por análise de vulnerabilidades.

### Critério aplicável ao Hub

Validar a fronteira de upload e a cadeia R2 → decode → PDF como superfície de segurança independente. O fato de somente Admin enviar arquivo reduz frequência, não impacto.

## 12. Evidência de projetos relevantes

### Moodle Workplace

Oferece templates, campos dinâmicos, código único, QR para verificação, assinatura PDF self-signed, expiração, emissão manual e metadados persistidos ([Certificates Configuration](https://docs.moodle.org/502/en/Certificates_Configuration)). Também documenta “regenerar issue file” mantendo data e código, e “revoke” como exclusão. Isso privilegia flexibilidade operacional, mas não preserva necessariamente o mesmo contrato histórico do Hub.

**Aprendizado:** copiar recursos, não semântica. Para o Hub, manter reemissão como nova evidência e não regenerar conteúdo sob o mesmo código é mais coerente com o ADR aceito.

### Moodle Custom Certificate (open source)

O changelog recente registra:

- separação entre services/repositories/renderers;
- índice único e controle de colisão;
- correções de corrida e emissão/e-mail duplicados;
- eventos de emissão/exclusão;
- falhas reais de autorização horizontal entre cursos/templates, inclusive CVE-2026-30884 ([repositório oficial](https://github.com/mdjnelson/moodle-mod_customcert)).

**Aprendizado:** constraints, idempotência e autorização contextual precisam ser sistêmicas. A recente CVE é caso de teste direto para páginas/elementos/templates do Hub.

### Open edX

O LMS mantém requisitos explícitos de elegibilidade e impede emissão regular quando há invalidação; estados atuais incluem disponível, reprovado, indisponível e não verificado ([Certificate Requirements](https://docs.openedx.org/projects/edx-platform/en/latest/references/docs/lms/djangoapps/certificates/docs/decisions/002-cert-requirements.html)). O Credentials Service usa soft deletion para revogados, retendo dados, e separa fonte de verdade, assets e vistas públicas ([Credentials Overview](https://docs.openedx.org/projects/edx-credentials/en/latest/overview.html)). Criação/revogação propagam por eventos assíncronos entre LMS e Credentials ([Event Bus](https://docs.openedx.org/projects/edx-credentials/en/latest/event_bus.html)).

Open edX também fez VC opcional, por feature flag e backends extensíveis, para não acoplar o certificado convencional ao ecossistema de wallets ([ADR 0008](https://docs.openedx.org/projects/edx-credentials/en/latest/decisions/0008-verifiable-credentials-issuing.html)).

**Aprendizado:** status/revogação são dados de domínio; projeções externas consomem eventos idempotentes; interoperabilidade fica atrás de fronteira opcional. A implementação documentada, porém, usa versões antigas de VC/status em partes, então serve como padrão arquitetural, não como fonte normativa de versão.

### Canvas LMS / Canvas Credentials

Canvas LMS é open source, mas a capacidade específica de badges/credentials é documentada como serviço Canvas Credentials. A documentação atual oferece Open Badges 3.0, emissão e revogação de assertions, motivo de revogação, filtros para expirados/revogados e OAuth com escopos ([Canvas Credentials Assertions API](https://developerdocs.instructure.com/services/parchment-digital-badges/openapi/assertions); [Canvas Badges/Credentials](https://community.canvaslms.com/html/assets/Canvas_Badges_Credentials.pdf)).

**Aprendizado:** emitir, revogar e consultar são operações de API distintas; escopo de escrita é separado; Open Badges pode coexistir com certificado visual. Isso não torna a arquitetura proprietária do Canvas uma referência open-source auditável para o Hub.

## 13. Segurança e threat model mínimo

### Ameaças e controles

1. **Enumeração de códigos** => token CSPRNG, rate limit, resposta genérica, noindex, telemetria e nenhuma listagem.
2. **IDOR em PDF** => autorização por owner/permission em toda requisição, objeto privado, teste multiusuário.
3. **IDOR em template/elemento** => query contextualizada por template/curso, não `find(id)` global; teste inspirado na CVE Moodle.
4. **PDF forjado com QR real** => página mostra alegações relevantes para comparação ou assinatura criptográfica.
5. **PDF sobrescrito/corrompido** => chave imutável, hash SHA-256, size/MIME e reconciliação.
6. **Revogação não refletida** => estado autoritativo consultado em tempo real/cache curto e invalidação; testes de propagação.
7. **Emissão duplicada** => unique constraints, idempotency key, transação e concorrência testada.
8. **E-mail duplicado/antes do PDF** => outbox após `ready`, consumer idempotente e dedupe.
9. **Race revogar/renderizar** => compare-and-set e fencing; revogado nunca volta a `ready`.
10. **Template malicioso** => validação de arquivo, re-encode, sem recursos remotos, limites de CPU/memória/pixels.
11. **Vazamento por CDN/storage** => bucket privado, ACL auditada, URL curta, headers corretos.
12. **Vazamento por logs/referrer/analytics** => redaction, hash do código, `no-referrer`, sem terceiros.
13. **Escalada de Suporte** => permissão por ação, confirmação e motivo, auditoria; revisão periódica de privilégios.
14. **Compromisso de chave de assinatura/VC** => KMS/HSM, rotação, status/revogação, runbook e backup seguro.
15. **Domínio do QR perdido** => domínio institucional estável, renovação monitorada e redirects duráveis.
16. **Backup incompatível com retenção** => prazo, restauração seletiva/documentada e exclusão propagada quando aplicável.

A LGPD exige medidas técnicas e administrativas desde a concepção até a execução ([art. 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)). Para baseline verificável, usar OWASP ASVS 5.0.0, a versão estável publicada em maio de 2025, como catálogo de requisitos de segurança e registrar IDs versionados no plano/testes ([OWASP ASVS](https://github.com/OWASP/ASVS)).

### Critério aplicável ao Hub

Cada ameaça acima precisa de evidência em código/configuração, teste ou runbook. “Código aleatório”, “bucket privado” e “permissão de Admin” não são evidência sem verificar todos os caminhos de acesso e falha.

## 14. Operação, observabilidade e recuperação

### Métricas

- emissões solicitadas, criadas, duplicadas evitadas e recusadas;
- latência conclusão → certificado criado → PDF pronto → e-mail entregue;
- renderizações por estado, retry, lease expirado e falha definitiva;
- colisões de código e violações de constraint;
- verificações públicas válidas/inválidas/revogadas e `429`, sem dimensão de código/nome;
- downloads autorizados/negados;
- revogações/reemissões por categoria, em agregação apropriada;
- divergências hash/objeto, PDFs órfãos e reconciliações;
- backlog/idade de outbox.

### Alertas

- render falhando acima de limiar ou backlog envelhecendo;
- outbox sem consumo;
- aumento de `403`/`404`/`429`/enumeração;
- objeto ausente ou hash divergente;
- cron/reconciliador não executado;
- certificado revogado servido como válido;
- URL/QR/domínio indisponível;
- storage público ou alteração de política/ACL;
- segredo/chave perto de expirar.

### Runbooks

- reprocessar render com segurança;
- reconciliar upload concluído antes de crash;
- revogar/reemitir por erro de identidade/template/elegibilidade;
- restaurar banco + R2 mantendo correspondência de hashes;
- responder a objeto público acidental;
- responder a enumeração/scraping;
- rotacionar chave de PAdES/VC e tratar credenciais anteriores;
- migrar domínio/rota do QR;
- cumprir correção/eliminação/bloqueio conforme decisão jurídica;
- comunicar incidente LGPD no prazo aplicável.

### Critério aplicável ao Hub

Produção requer dashboard/alerta e exercício de restore/reconciliação. Um worker idempotente sem alerta ainda permite falha silenciosa prolongada.

## 15. Matriz de testes de produção

### Domínio

- conclusão elegível emite uma vez;
- não elegível/manual sem permissão falha;
- certificado revogado bloqueia emissão automática conforme regra aprovada;
- reemissão cria novo código/hash/snapshot e revoga anterior;
- template/curso/nome alterado não muda certificado emitido;
- categoria `other` exige detalhe interno; detalhe nunca aparece publicamente;
- estados e transições inválidos são rejeitados no servidor.

### Concorrência/falhas

- duas emissões simultâneas;
- dois workers no mesmo certificado;
- lease expira durante upload;
- crash antes/depois de upload e antes/depois de `ready`;
- revogação durante decode/render/upload;
- reemissões concorrentes;
- e-mail falha e repete sem duplicar certificado;
- R2 timeout, objeto já existente, hash divergente;
- transação falha ao persistir outbox.

### Autorização/privacidade

- Aluna A versus PDF da Aluna B;
- suporte/admin por cada permissão;
- IDs trocados em template/página/elemento/certificado;
- código público versus PDF/rotas internas;
- verificador não retorna e-mail, IDs, detalhe, autoria ou certificados relacionados;
- código inexistente não cria oracle adicional;
- logs, traces, Sentry e analytics não capturam PII/código bruto desnecessário;
- cache/CDN não serve resposta de um código para outro.

### PDF/QR

- nomes e cursos nos limites e caracteres suportados;
- QR decodifica em arte real e impressão;
- URL/código textual quando QR não pode ser usado;
- metadados, idioma, texto selecionável e leitura assistiva;
- comparação dos campos da página com o PDF;
- hash, tamanho e MIME corretos;
- arquivos/template adversariais e limites.

### Operação

- backup/restore de DB + objetos;
- reconciliação de órfãos;
- revogação visível após cache;
- domínio/redirect do QR;
- alertas e dashboards com falha simulada;
- runbook executado por pessoa que não escreveu o código.

## 16. Gate recomendado de prontidão

### P0: bloqueia produção

- [ ] Invariantes de emissão/revogação/reemissão comprovados por testes e constraints.
- [ ] Autorização por objeto comprovada em PDF, ações administrativas, templates, páginas e elementos.
- [ ] Código não enumerável, constraint única, rate limit e resposta pública mínima.
- [ ] Página permite confrontar nome, curso, data, carga e emissor com o documento, ou há garantia criptográfica equivalente aprovada.
- [ ] PDF e assets em storage privado; nenhum link permanente público ao objeto.
- [ ] Worker/outbox/lease/fencing recuperam falhas sem duplicação nem estado inválido.
- [ ] Revogação aparece corretamente e não permite retorno a válido/pronto.
- [ ] Upload/render não aceita conteúdo remoto, formato inesperado ou recurso sem limites.
- [ ] Conteúdo essencial acessível no PDF e/ou gap formalmente aceito sem alegação falsa de conformidade; página HTML acessível.
- [ ] Política jurídica de finalidade, base legal, transparência, direitos e retenção aprovada e operacionalizada.
- [ ] Backup/restore, reconciliação, métricas, alertas e runbooks testados.
- [ ] Testes estreitos, suíte, typecheck/lint/build e migrations do ambiente-alvo aprovados.

### P1: necessário para operação madura

- [ ] Teste físico de QR e matriz de leitores PDF.
- [ ] Auditoria de logs/PII, cache, headers e terceiros.
- [ ] Teste de carga/abuso no verificador e renderizador.
- [ ] Threat model e rastreabilidade para OWASP ASVS 5.0.0.
- [ ] Exercício de incidente e prazo ANPD.
- [ ] Testes de acessibilidade com leitor de tela e revisão humana.
- [ ] SLOs para emissão, renderização, verificação e recuperação.

### P2: roadmap condicionado

- [ ] PDF/A-4, se preservação arquivística for requisito.
- [ ] PDF/UA-2 formal, se conformidade formal do arquivo for requisito.
- [ ] PAdES/ICP-Brasil, se verificação offline/força probatória justificar.
- [ ] Open Badges 3.0/VC 2.0, se houver consumidor, wallet ou parceiro real.
- [ ] Apresentação seletiva/privacidade avançada, se a jornada de VC exigir.

## 17. Decisão recomendada para o Hub

1. Manter o certificado PDF convencional e a página autoritativa como baseline.
2. Preservar a semântica atual de snapshots imutáveis, revogação histórica e reemissão com nova evidência.
3. Exigir que a página pública mostre exatamente as alegações necessárias para detectar PDF adulterado, nunca só “válido”.
4. Manter PDF privado e código como localizador público não enumerável, não como autorização.
5. Tratar anti-IDOR de templates/elementos e download como gate explícito, usando a CVE recente do Moodle como caso de regressão.
6. Completar política jurídica de retenção/verificação pública antes de declarar prontidão LGPD.
7. Medir acessibilidade real do PDF; não depender apenas da página HTML nem declarar PDF/UA sem validação.
8. Manter SHA-256 para integridade operacional e avaliar PAdES apenas por requisito.
9. Adiar Open Badges/VC até existir jornada de portabilidade; quando existir, implementar Open Badges 3.0 sobre VC 2.0 como projeção opcional e feature-flagged.
10. Não copiar literalmente Moodle/Open edX/Canvas: seus padrões arquiteturais são úteis, mas ciclos, versões e decisões de privacidade diferem do contrato do Hub.

## 18. Fontes primárias consultadas

Todas acessadas em **2026-08-07**.

### Padrões e especificações

- W3C. [Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/). Recommendation, 2025-05-15.
- W3C. [Verifiable Credential Data Integrity 1.0](https://www.w3.org/TR/vc-data-integrity/). Recommendation.
- W3C. [Bitstring Status List v1.0](https://www.w3.org/TR/vc-bitstring-status-list/). Recommendation, 2025-05-15.
- 1EdTech. [Open Badges Specification v3.0](https://www.imsglobal.org/spec/ob/v3p0/).
- 1EdTech. [Open Badges standards and certification](https://www.1edtech.org/standards/open-badges).
- 1EdTech. [Standards roadmap](https://www.1edtech.org/standards/roadmap).
- ISO. [ISO/IEC 18004:2024, QR code symbology](https://www.iso.org/standard/83389.html).
- ISO. [ISO 14289-2:2024, PDF/UA-2](https://www.iso.org/standard/82278.html).
- ISO. [ISO 19005-4:2020, PDF/A-4](https://www.iso.org/standard/71832.html).
- ETSI. [EN 319 142-1 v1.2.1, PAdES baseline signatures](https://www.etsi.org/deliver/etsi_EN/319100_319199/31914201/01.02.01_60/en_31914201v010201p.pdf).
- IETF. [RFC 9562, UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html).
- IETF. [RFC 9309, Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html).
- W3C WAI. [WCAG 2.2 Techniques, PDF](https://www.w3.org/WAI/WCAG22/Techniques/#pdf).
- W3C. [Referrer Policy](https://www.w3.org/TR/referrer-policy/).

### Segurança e privacidade

- OWASP. [Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).
- OWASP. [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- OWASP. [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
- OWASP. [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- OWASP. [Application Security Verification Standard 5.0.0](https://github.com/OWASP/ASVS).
- Presidência da República. [Lei nº 13.709/2018, LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
- ANPD. [Perguntas frequentes, retenção](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes).
- ANPD. [Comunicação de Incidente de Segurança](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis).
- ANPD. [Guia de Segurança da Informação para Agentes de Tratamento de Pequeno Porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-vf.pdf).
- ITI. [Certificação Digital](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital).
- ITI. [Guia do Desenvolvedor VALIDAR](https://h-validar.iti.gov.br/guia-desenvolvedor.html).
- NIST. [Digital signature glossary](https://csrc.nist.gov/glossary/term/digital_signature).

### Acessibilidade, preservação e QR

- veraPDF. [Validation profiles](https://docs.verapdf.org/validation/).
- DENSO WAVE. [QR code area and quiet zone](https://www.qrcode.com/en/howto/code.html).
- DENSO WAVE. [QR error correction](https://www.qrcode.com/en/about/error_correction.html).
- Google Search Central. [`noindex`](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

### Projetos e produtos LMS

- Moodle Workplace. [Certificates Configuration](https://docs.moodle.org/502/en/Certificates_Configuration).
- Moodle Custom Certificate. [Repositório e changelog](https://github.com/mdjnelson/moodle-mod_customcert).
- Open edX. [Course certificate status](https://docs.openedx.org/projects/edx-platform/en/latest/references/docs/lms/djangoapps/certificates/docs/decisions/004-cert-status.html).
- Open edX. [Regular course certificate requirements](https://docs.openedx.org/projects/edx-platform/en/latest/references/docs/lms/djangoapps/certificates/docs/decisions/002-cert-requirements.html).
- Open edX Credentials. [Overview](https://docs.openedx.org/projects/edx-credentials/en/latest/overview.html).
- Open edX Credentials. [Event Bus](https://docs.openedx.org/projects/edx-credentials/en/latest/event_bus.html).
- Open edX Credentials. [ADR 0008: VC issuance](https://docs.openedx.org/projects/edx-credentials/en/latest/decisions/0008-verifiable-credentials-issuing.html).
- Open edX Credentials. [VC configuration](https://docs.openedx.org/projects/edx-credentials/en/latest/verifiable_credentials/configuration.html).
- Instructure. [Canvas Credentials Assertions API](https://developerdocs.instructure.com/services/parchment-digital-badges/openapi/assertions).
- Instructure. [Canvas Badges/Credentials guide](https://community.canvaslms.com/html/assets/Canvas_Badges_Credentials.pdf).
