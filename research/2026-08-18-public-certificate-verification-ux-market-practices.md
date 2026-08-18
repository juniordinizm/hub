# Página pública de verificação de certificado: pesquisa de UX

**Data da pesquisa:** 2026-08-18  
**Fuso:** America/Sao_Paulo  
**Escopo:** páginas e orientações oficiais de plataformas de credenciais e LMS. A pesquisa trata da experiência pública de visualização, verificação, compartilhamento e download; não substitui a especificação de segurança e privacidade do Hub.

## Conclusão executiva

Uma página pública de certificado deve ser uma experiência de verificação de propósito único: deixar claro que a credencial é válida, mostrar o documento com destaque e oferecer poucas ações previsíveis. As plataformas analisadas usam uma URL dedicada por credencial e mantêm `copiar link`/`baixar` próximos ao documento; informações adicionais, recomendações e chamadas de marketing são opcionais.

Para o refinamento solicitado no Hub, a composição mais coerente é:

1. marca discreta e título curto de verificação;
2. status inequívoco, como `Certificado válido`;
3. documento como elemento dominante da página;
4. ações primárias próximas ao documento: `Baixar PDF` e `Copiar link`;
5. abaixo do documento, somente o `Código do certificado` em uma linha compacta.

Nome da aluna, Curso, emissor, datas e carga horária podem continuar impressos no PDF, sem repetir a mesma lista no HTML. Essa simplificação reduz ruído e aproxima a página de um visual premium. Há, porém, uma consequência: quem valida deixa de comparar facilmente as alegações do PDF com uma fonte HTML independente. Se essa comparação continuar sendo requisito de segurança, o Hub deve manter ao menos um resumo curto acima do documento ou oferecer uma seção de detalhes de verificação sob demanda, sem recolocar uma lista pesada abaixo do PDF.

## Evidências de mercado

### Thinkific: documento primeiro, ações no rodapé

O Thinkific gera uma página pública única para cada certificado e informa que ela pode ser consultada para ver os detalhes atuais e a validade. A plataforma coloca `Copy Link` e `Download PDF` na parte inferior da página, imediatamente associados ao certificado. Seções extras abaixo do certificado, como chamadas para cursos, são uma customização opcional do administrador.

Fonte: [Sharing Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360049252673-Sharing-Thinkific-Certificates), especialmente as seções “Public Facing Certificate Page”, “Sharing Certificates” e “Customize Your Certificate Page”.

**Aplicação ao Hub:** o PDF deve ser o foco visual; ações utilitárias devem ficar em uma faixa curta; qualquer promoção ou conteúdo complementar deve ficar fora da primeira versão da página de validação.

### LinkedIn Learning: compartilhamento público com exposição controlada

O LinkedIn Learning usa um link compartilhável que leva a uma página com o certificado e detalhes do Curso. A página pode ser vista por qualquer pessoa que tenha o link e a visibilidade pode ser desligada pelo titular. A documentação informa que, conforme o contexto de visibilidade, podem aparecer nome e sobrenome, headline e foto; o certificado sempre contém nome e data de conclusão. O histórico de aprendizagem funciona como arquivo separado, enquanto a página compartilhada serve para apresentação pública.

Fontes: [Share Certificates of Completion FAQ](https://www.linkedin.com/help/learning/answer/a706118) e [View and download Certificates of Completion in Learning](https://www.linkedin.com/help/linkedin/answer/a700836/view-and-download-learning-certificates-of-completion?lang=en).

**Aplicação ao Hub:** manter a rota pública dedicada e o arquivo global separado; não transformar a página pública em uma segunda biblioteca ou perfil. A informação pública deve ser deliberada e mínima.

### Credly: contexto verificável e privacidade por escolha

O Credly descreve o badge como uma representação digital ligada a metadados que fornecem contexto e verificação. Ao clicar no badge, o visitante retorna à página de detalhes da conquista. O download/compartilhamento parte da página de detalhes, e a documentação também registra que badges e perfis podem ser públicos ou privados; e-mail não é exibido no badge.

Fontes: [What is a badge?](https://support.credly.com/hc/en-us/articles/360021222071-What-is-a-badge), [Can I download and print my badge certificate?](https://support.credly.com/hc/en-us/articles/360026639872-Can-I-download-and-print-my-badge-certificate) e [Can I hide my name from appearing within my Badge?](https://support.credly.com/hc/en-us/articles/360026919551-Can-I-hide-my-name-from-appearing-within-my-Badge).

**Aplicação ao Hub:** status e ações devem ser fáceis de encontrar, mas dados pessoais que não fazem parte do documento não devem aparecer. O código público é suficiente para reencontrar a credencial; não expor e-mail, ID interno ou dados de matrícula.

### Accredible: página dedicada, status visível e branding consistente

O Accredible trata cada credencial como uma página pública dedicada, verificável sem conta. A documentação de produto destaca banners para credenciais expiradas ou revogadas e a página de recursos recomenda personalização de marca, visual do certificado, CTA de compartilhamento e suporte. A própria orientação separa a página da credencial, que comprova a conquista, de seções opcionais de explicação, FAQ, resultados ou marketing.

Fontes: [Digital Credentials in Higher Education](https://www.accredible.com/guides/digital-credentials-in-higher-education), especialmente as seções sobre página pública, status expirado/revogado e branding, e [Build Your Learner-Facing Digital Credential Page](https://www.accredible.com/guides/build-your-learner-facing-digital-credential-page), especialmente o template modular e os blocos opcionais.

**Aplicação ao Hub:** usar um status de alta legibilidade e uma superfície visual consistente com a marca. Não misturar a verificação com recomendações, depoimentos, FAQ ou outras conversões nesta página enxuta; esses blocos podem existir em outra landing page.

### Udemy: acesso contextual e ação direta

O Udemy mostra o certificado a partir do Curso concluído e oferece download e compartilhamento na própria página do certificado. A URL do certificado também fica disponível para compartilhamento manual.

Fonte: [Certificates of completion – Udemy](https://support.udemy.com/hc/en-us/sections/360011037194-Certificates-of-Completion).

**Aplicação ao Hub:** manter o acesso contextual pelo Curso e uma página pública canônica, com CTA primário de download e compartilhamento por link, sem criar ações redundantes.

## Padrão visual recomendado para o Hub

### Hierarquia

- Fundo neutro ou teal muito escuro do produto, sem gradientes decorativos.
- Container único, com largura confortável para leitura e uma borda/sombra discreta.
- Identidade pequena no topo; o status deve ter mais peso visual que o texto auxiliar.
- Preview do PDF em moldura clara, proporcional ao A4 e sem deixar o visualizador nativo dominar a tela com uma área preta vazia.
- Uma única faixa de ações, com `Baixar PDF` como ação principal e `Copiar link` como secundária.
- Depois do preview, apenas o código em tipografia monoespaçada ou tabular, com botão de copiar e feedback acessível.

### Estados

- `Válido`: status verde/teal, preview e ações normais.
- `Preparando`: status neutro, sem preview nem download; mensagem curta e orientada à espera.
- `Revogado`: status vermelho/âmbar, explicação de uma linha; o documento e novos downloads permanecem bloqueados conforme o contrato do Hub.
- `Indisponível`: status neutro/erro, explicação curta e contato com suporte; não exibir detalhes técnicos.

Todos os estados devem manter a mesma estrutura e variar apenas status, copy e ações disponíveis. Isso reduz deslocamento visual e torna o estado atual reconhecível rapidamente.

### Conteúdo abaixo do PDF

Para atender ao objetivo de minimalismo:

- manter somente `Código do certificado`;
- não repetir nome, Curso, emissor, CNPJ, datas ou carga horária abaixo do documento;
- preservar o texto no PDF, que é o artefato que a pessoa pode baixar e apresentar;
- não adicionar recomendações de Cursos, depoimentos, FAQ ou links de marketing na primeira tela;
- se a verificação independente exigir confronto de alegações, colocar um resumo curto antes do PDF ou um disclosure explícito `Detalhes de verificação`, em vez de uma grade permanente abaixo.

## Decisões de produto recomendadas

1. **A página pública não é um relatório:** ela deve confirmar a credencial e facilitar o compartilhamento.
2. **O PDF é o artefato principal:** HTML apoia descoberta, status e ações, mas não deve competir visualmente com o documento.
3. **Código como rodapé funcional:** o código continua visível para conferência manual e copia, sem expor identificadores internos.
4. **Metadados não devem ser duplicados por estética:** remover repetição melhora densidade e legibilidade, mas a equipe deve aceitar a perda de comparação independente ou manter um resumo compacto acima.
5. **Status nunca pode ser sutil:** válido, pendente, falho e revogado precisam ser percebidos sem ler o PDF.
6. **Compartilhamento é link, não arquivo temporário:** `Copiar link` deve apontar para a URL canônica; o PDF continua sendo uma ação separada.
7. **Privacidade por padrão:** não expor e-mail, CPF, telefone, ID de aluno, compra, progresso ou logs; a página deve continuar `noindex` e sem terceiros desnecessários.

## Limites da pesquisa

As fontes são documentação oficial de produto, não uma auditoria visual de cada implementação atual. Credly e Accredible são plataformas de credenciais digitais e possuem recursos de badge, wallet e marketing que o Hub não precisa replicar. O padrão recomendado aqui é o núcleo comum: página dedicada, status claro, documento dominante, ações curtas, link compartilhável e divulgação mínima.

