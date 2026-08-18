---
status: research
owner: product
researched_at: 2026-08-18
---

# UX de Certificados para Alunas: práticas de mercado

## Síntese

Plataformas maduras oferecem dois caminhos complementares: uma ação contextual no
Curso, imediatamente após a conclusão, e um arquivo global no perfil/histórico.
O Curso responde à intenção imediata (“terminei, quero ver meu certificado”); o
arquivo resolve recuperação posterior, múltiplos Cursos e acesso depois de uma
expiração comercial.

Também é comum separar a página pública de validação do arquivo privado da
Aluna. O link público comprova a credencial; o download pode continuar vinculado
à conta, dependendo da política de privacidade da plataforma.

## Fontes oficiais

- [Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360040594393-Thinkific-Certificates): oferece `Get your certificate` dentro do Curso e mantém certificados acessíveis pelo menu da conta; a plataforma também documenta o acesso por `My Account > Certificates`.
- [Thinkific: acesso do aluno](https://support.thinkific.com/hc/en-us/articles/360052406593-How-can-a-student-access-their-certificate): descreve a tela de certificados com visualização, cópia do link e download do PDF.
- [LearnWorlds: criação de certificado](https://support.learnworlds.com/support/solutions/articles/12000087212-how-to-create-a-certificate-of-completion): informa que o certificado pode ser baixado pelo Course Player, `my certificate` ou perfil.
- [LearnWorlds: gerenciamento](https://support.learnworlds.com/support/solutions/articles/12000041910): documenta notificações, histórico e download repetido do certificado emitido.
- [Udemy: experiência do Curso](https://support.udemy.com/hc/en-us/articles/34345830524183-Udemy-s-new-course-experience-Frequently-asked-questions): posiciona o certificado no player e na visão geral do Curso, próximo da imagem e do currículo.
- [Udemy: certificados de conclusão](https://support.udemy.com/hc/en-us/sections/360011037194-Certificates-of-Completion): usa um indicador de conclusão/troféu, oferece visualização, download e compartilhamento por link.
- [Teachable: certificados](https://support.teachable.com/en/articles/11682466-certificates-of-completion): mostra o certificado após a última Aula, dentro do currículo, e envia e-mail com link para a aba do certificado.
- [LinkedIn Learning: visualização e download](https://www.linkedin.com/help/linkedin/answer/a700836/view-and-download-learning-certificates-of-completion?lang=en): permite baixar pela página do Curso e pelo Learning History.
- [LinkedIn Learning: compartilhamento](https://www.linkedin.com/help/learning/answer/a706118): usa uma página compartilhável separada do arquivo baixado; o link público mostra detalhes da credencial.

## Padrões aplicáveis ao Hub

1. Manter o Curso como entrada principal e `/app/certificados` como arquivo global.
2. Após a última Aula, mostrar o estado no próprio Curso; não obrigar a Aluna a
   descobrir uma lista genérica para encontrar a credencial recém-criada.
3. Modelar estados visíveis: incompleto, preparando, disponível e falho. `pending`
   precisa de atualização automática e ação manual acessível; falha deve orientar
   suporte, não expor retry técnico.
4. Usar uma página canônica de certificado para combinar visualização, validação,
   download e cópia do link, evitando que “Validar” e “Ver certificado” levem a
   destinos conceitualmente diferentes.
5. Preservar uma rota global para recuperação após expiração, arquivamento ou
   conclusão de vários Cursos.
6. Se o PDF for público, tratar o código como bearer link: aplicar rate limit,
   `noindex`, URL assinada curta, verificação de hash e bloquear novos downloads
   após revogação. Cópias já baixadas não podem ser recolhidas.

## Observação de privacidade

As fontes consultadas favorecem páginas públicas de compartilhamento/validação e
acesso autenticado ao arquivo em diferentes graus. Tornar o PDF público por padrão
é uma decisão específica do Hub e deve ser registrada no ADR de certificados, pois
permite que qualquer pessoa com o código baixe o documento completo.
