> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Fontes externas consultadas

Consulta em 2026-07-17. Estas fontes sustentam avaliações técnicas ou temas a validar. Não constituem parecer jurídico, fiscal, educacional ou profissional.

## Registros de fonte

### LGPD — Lei nº 13.709/2018

- **Organização/endereço:** Senado Federal, [texto consolidado](https://legis.senado.gov.br/norma/27457334).
- **Publicação/versão/jurisdição/natureza:** 2018; texto consolidado consultado; Brasil; norma legal.
- **Conclusão e aplicabilidade:** o projeto trata dados pessoais em identidade, pedidos, suporte, logs e certificados; privacidade, finalidade, retenção e compartilhamento com fornecedores precisam de definição e validação especializada.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz decisão sem base e exposição indevida; custa governança e operação; a lei é obrigatória quando aplicável, a regra concreta de produto não é inferida daqui.
- **Limitação:** não define sozinha base legal, prazo, papel de controlador/operador ou obrigação setorial no caso concreto.

### Guia orientativo sobre segurança da informação para agentes de tratamento de pequeno porte

- **Organização/endereço:** ANPD, [PDF](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-vf.pdf).
- **Publicação/versão/jurisdição/natureza:** 2021; versão publicada; Brasil; orientação oficial.
- **Conclusão e aplicabilidade:** reforça controle de acesso, gestão de fornecedores, registros e resposta a incidentes para os domínios de auth, suporte, e-mail, R2 e certificados.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz lacunas operacionais; requer processos e documentação; recomendação, não substitui assessoramento jurídico.
- **Limitação:** não comprova conformidade nem resolve a arquitetura específica.

### WCAG 2.2

- **Organização/endereço:** W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **Publicação/versão/jurisdição/natureza:** 2023; 2.2; internacional; recomendação técnica W3C.
- **Conclusão e aplicabilidade:** há critérios para foco, teclado, autenticação, ajuda, mídia e conteúdo. Aplicável ao login, player, diálogos, admin e PDF, onde não há avaliação observada.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz barreiras de uso; exige auditoria, correções e testes; meta de conformidade é decisão de produto/contrato salvo exigência aplicável.
- **Limitação:** não foi executada avaliação WCAG nem validado leitor de tela/PDF.

### OWASP ASVS

- **Organização/endereço:** OWASP, [Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/).
- **Publicação/versão/jurisdição/natureza:** ASVS 5.0, conforme página oficial consultada; internacional; standard técnico.
- **Conclusão e aplicabilidade:** oferece roteiro de verificação para autenticação, sessão, autorização, uploads, logging e integrações de pagamento.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz dependência de julgamentos ad hoc; requer tempo de assessment; opcional como framework, sem alegação de certificação.
- **Limitação:** nenhum assessment ASVS foi feito.

### Webhooks — verificação e segurança

- **Organização/endereço:** AbacatePay, [documentação oficial](https://docs.abacatepay.com/pages/webhooks/security).
- **Publicação/versão/jurisdição/natureza:** data de publicação não informada; documentação corrente consultada em 2026-07-17; contratual/técnica do provedor.
- **Conclusão e aplicabilidade:** confirma segredo de URL, assinatura HMAC e retentativas; sustenta a leitura do handler local, não a configuração efetiva do endpoint.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz falsificação/reaplicação quando o contrato é implementado; custa gestão de segredo e idempotência; obrigatório conforme contrato/integração adotada.
- **Limitação:** não foram acessados painel, segredo, eventos inscritos ou entregas reais.

### Send Email API

- **Organização/endereço:** Resend, [referência oficial](https://resend.com/docs/api-reference/emails/send-email).
- **Publicação/versão/jurisdição/natureza:** data/versão não informadas; documentação corrente consultada em 2026-07-17; contratual/técnica do provedor.
- **Conclusão e aplicabilidade:** a API suporta chave de idempotência para evitar e-mail duplicado; é aplicável somente se Resend for escolhido/configurado, pois o repositório atual tem adaptador stub e não confirma provedor.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz duplicidade de notificações; exige outbox/chave e observabilidade; opcional até decisão de provedor.
- **Limitação:** não prova conta, domínio, entregabilidade, DPA ou configuração existente.

### Presigned URLs — Cloudflare R2

- **Organização/endereço:** Cloudflare, [documentação oficial](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
- **Publicação/versão/jurisdição/natureza:** atualizada em 2026-04-24; documentação corrente; contratual/técnica do provedor.
- **Conclusão e aplicabilidade:** URLs assinadas concedem operação/objeto temporários e funcionam como bearer tokens; a documentação recomenda expiração curta, Content-Type assinado e CORS controlado. Aplicável ao código R2 local.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz exposição de credenciais e abuso; exige configuração correta e pode dificultar compartilhamento; obrigatório apenas se a integração R2 for efetivamente operada.
- **Limitação:** bucket, CORS, TTL, criptografia, retenção e logs não foram acessados.

### Email e Security — Better Auth

- **Organização/endereço:** Better Auth, [email](https://better-auth.com/docs/concepts/email) e [security](https://better-auth.com/docs/reference/security).
- **Publicação/versão/jurisdição/natureza:** data/versão de página não informadas; documentação corrente consultada em 2026-07-17; documentação oficial de framework.
- **Conclusão e aplicabilidade:** verificação de e-mail requer remetente configurado e só vira gate quando explicitamente exigida; headers de proxy só devem ser confiados quando a infraestrutura os controla. Aplicável aos riscos de signup e deploy.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz conta não verificada e spoofing de origem; adiciona atrito e dependência de e-mail; escolha de política é de produto.
- **Limitação:** documentação não prova a configuração do projeto ou do proxy.

### JMVStream Public API

- **Organização/endereço:** JMVStream, [documentação pública](https://jmvstream.com/en/developer).
- **Publicação/versão/jurisdição/natureza:** data/versão não informadas; consultada em 2026-07-17; documentação técnica do provedor.
- **Conclusão e aplicabilidade:** sustenta o fluxo multipart/ETag observado no repositório, mas não autoriza concluir CORS, hotlink, retenção ou configuração de processamento.
- **Risco reduzido / trade-off / obrigatoriedade:** reduz incompatibilidade com o contrato de upload; requer monitoramento e testes de integração; aplicável apenas enquanto o provedor for usado.
- **Limitação:** sem acesso a conta, plano, credenciais ou ambiente.
