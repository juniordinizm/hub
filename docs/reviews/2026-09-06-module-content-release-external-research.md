---
status: research_only
owner: product_and_engineering
last_verified_commit: 961476f
---

# Pesquisa externa para a revisão final da liberação por Módulo

Pesquisa atualizada em 2026-09-06. Este documento confronta o desenho já
implementado no Hub com fontes primárias. Não redefine a especificação aceita,
não é parecer jurídico e não transforma alternativas de mercado em requisitos.

## Conclusão

O desenho do Hub é tecnicamente defensável e deliberadamente simples:

- D+N é calculado no servidor como N períodos exatos de 24 horas;
- a âncora explícita vive na Matrícula e é preservada no episódio contínuo;
- a publicação vigente continua sendo a regra de runtime;
- o Pedido guarda um snapshot compacto e o checkout compara seu digest;
- não existe scheduler como autoridade, tabela Aluna × Aula ou regra por Aula;
- o override administrativo libera integralmente uma Matrícula e é monotônico.

Esse conjunto é coerente com práticas encontradas em LMSs e com a recomendação
da OWASP de negar por padrão e verificar autorização em toda requisição. Os
gates externos que continuam obrigatórios são: playback real da JMVStream,
comportamento de URLs R2, transparência jurídica/comercial e execução do CI no
commit que efetivamente será promovido.

## Comparação com plataformas

Não há uma semântica universal de “dia”:

- [Thinkific](https://support.thinkific.com/hc/en-us/articles/360030741033-Drip-Schedule)
  documenta modalidades relativas em períodos de 24 horas e permite acesso
  integral individual.
- [Teachable](https://support.teachable.com/en/articles/11682465-drip-content)
  usa seções e primeira matrícula, mas libera na meia-noite UTC da data
  calculada.
- [Hotmart](https://help.hotmart.com/en/article/213467588/how-to-set-up-a-drip-schedule-and-expiration-date-for-content-in-hotmart-club-)
  oferece dias após compra, data fixa e regras por grupo, com horário GMT-3.
- [Kajabi](https://help.kajabi.com/articles/products/courses/schedule-and-drip-content-in-courses)
  aplica drip a módulos/submódulos e permite ajustar a data de acesso de uma
  pessoa.
- [Kiwify](https://ajuda.kiwify.com.br/pt-br/article/como-programar-a-liberacao-e-limitacao-do-conteudo-dnja5g/)
  oferece liberação imediata, relativa à compra ou por data.

Consequência: “24 horas desde o início efetivo do acesso”, já adotado pelo Hub,
precisa continuar explícito na autoria, no checkout e no suporte. Copiar a
semântica de meia-noite de outro LMS seria uma quebra de contrato.

As plataformas também confirmam que uma exceção individual é útil. O Hub
escolheu a forma mais simples: acesso integral por Matrícula, irreversível no
episódio. Não há evidência que obrigue um override por Módulo na primeira
versão.

## Autorização e concorrência

A [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
recomenda negar por padrão, verificar permissão em toda requisição e não
depender do cliente. A
[OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
reforça que os dados decisivos devem ser gerados ou confirmados no servidor.

No Hub, isso significa manter a mesma barreira em workspace, conclusão, watch,
comentários, materiais e vídeo. Um check antes de uma mutação não deve ficar
separado da gravação por uma janela em que revogação ou expiração possa ocorrer.

O [PostgreSQL](https://www.postgresql.org/docs/18/explicit-locking.html)
documenta que locks de linha permanecem até o fim da transação e que deadlocks
dependem da ordem de aquisição. As
[funções de advisory lock](https://www.postgresql.org/docs/18/functions-admin.html)
distinguem locks de sessão de `pg_advisory_xact_lock`, liberado com a
transação. A ordem única Curso → Conta+Curso usada pelo Hub deve ser preservada
por qualquer nova mutação.

`READ COMMITTED` permite que comandos sucessivos vejam commits diferentes.
Logo, o lock e a releitura dentro da transação são a garantia; abrir uma
transação sem revalidar não seria suficiente.

## Snapshot e publicação viva

O snapshot do Pedido já preserva versão, relógio, título, ordem e atraso dos
Módulos, e o digest impede iniciar um novo checkout com uma apresentação
obsoleta. O snapshot é evidência comercial, não a autoridade de acesso.

Por isso, não é necessário adicionar chave curricular de Módulo, digest à
Matrícula ou tabela de releases materializados nesta versão. A monotonicidade é
garantida por `curriculum_key` da Aula ao comparar publicações. Essas
alternativas só fariam sentido se o produto passasse a vender cronogramas
simultâneos ou históricos por coorte, hoje fora do escopo.

## Cloudflare R2

A documentação de
[presigned URLs do R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
define cada URL como um bearer token temporário, específico de operação e
objeto, válido por 1 segundo a 7 dias. Qualquer pessoa que possua a URL pode
usá-la até expirar.

Práticas compatíveis com o Hub:

- manter materiais no bucket privado;
- autorizar Matrícula, Módulo e Aula antes de assinar;
- assinar uma única chave/operação com TTL curto;
- não persistir a URL nem colocá-la em cache compartilhado;
- responder do Hub com `Cache-Control: private, no-store` quando possível;
- aceitar que revogação posterior não invalida uma URL já emitida até o TTL.

O guia de [CORS do R2](https://developers.cloudflare.com/r2/buckets/cors/)
recomenda origens, métodos e headers estritos. Um 403 de URL expirada pode não
expor headers CORS ao JavaScript; a recuperação deve pedir nova URL ao Hub, não
abrir CORS para `*`.

## JMVStream

A [documentação pública da JMVStream](https://jmvstream.com/en/developer)
descreve autenticação da API, dados de vídeo e URLs de upload, mas não prova de
forma suficiente o TTL, vínculo ao usuário, restrição por domínio ou revogação
da URL de playback entregue ao navegador.

Portanto, antes de Production é necessário validar no plano e no player reais:

1. se a URL de reprodução é assinada;
2. qual é o TTL;
3. se há restrição de domínio/origin/referer;
4. o que ocorre com um player já aberto após revogação;
5. se copiar a URL permite reprodução fora do Hub.

Sem essa evidência, o Hub protege a emissão do player, mas não pode prometer
revogação instantânea nem prevenção de pirataria.

## Transparência e direito de arrependimento

O [CDC, art. 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)
prevê arrependimento em contratação fora do estabelecimento. O
[Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm)
exige informação clara sobre condições da oferta, prazo de disponibilização,
restrições de fruição, resumo antes da contratação e canal eficaz de
cancelamento.

O drip pode reduzir exposição do acervo, mas não deve ser usado para eliminar
ou condicionar o direito legal. Antes da primeira venda, Jurídico e Comercial
devem aprovar:

- o cronograma mostrado antes do POST financeiro;
- a definição da âncora e das 24 horas;
- a cópia durável da contratação/confirmação;
- o canal eletrônico de arrependimento;
- a ausência de mensagens que vinculem consumo a perda automática do direito.

## Evidência anedótica de comunidades

Os relatos abaixo não medem fraude nem substituem fonte oficial:

- criadores discutem o risco de consumo rápido seguido de reembolso, mas
  também relatam que o problema pode ser menor que o receio inicial
  ([r/elearning](https://www.reddit.com/r/elearning/comments/1fh0bf3/));
- criadores reconhecem que drip e revogação reduzem exposição, mas não eliminam
  compartilhamento, download ou gravação
  ([r/onlinecourses](https://www.reddit.com/r/onlinecourses/comments/1r3d2zf/how_do_you_deliver_and_protect_your_digital/));
- há recomendação anedótica de liberar parte antes e parte depois da janela de
  reembolso
  ([r/content_marketing](https://www.reddit.com/r/content_marketing/comments/f8tix7));
- consumidores reclamam quando critérios de consumo/reembolso são opacos
  ([r/Udemy](https://www.reddit.com/r/Udemy/comments/1p3cwmv/6_of_the_course_is_too_much_content_to_request/));
- relatos de drip sem entrega clara terminam em pedido de reembolso ou
  chargeback
  ([r/patreon](https://www.reddit.com/r/patreon/comments/1l8u6v5)).

O sinal consistente é de produto: transparência e previsibilidade importam
tanto quanto o bloqueio técnico.

## Critérios externos antes de promoção

- CI completo no commit final, incluindo PostgreSQL real e Playwright mobile;
- merge limpo com o `staging` remoto que será promovido;
- `EXPLAIN (ANALYZE, BUFFERS)` antes de justificar novo índice;
- teste de URL R2 emitida, expirada e usada após revogação;
- teste de playback JMVStream dentro e fora do domínio;
- aprovação jurídica/comercial da copy e do fluxo de cancelamento;
- piloto D+0/D+1/D+8 em Staging sem conteúdo futuro no DOM/rede.
