# Pesquisa: carregamento perceptivo dos banners

Data: 2026-07-18  
Escopo: carrossel da aluna e previews administrativos dos banners 4:1.

## Veredito

O melhor resultado para este produto e combinar tres camadas:

1. Reservar o espaco 4:1 antes da requisicao da imagem.
2. Persistir um LQIP (imagem muito pequena e borrada) de cada banner no upload.
3. Revelar a imagem final com uma transicao curta de opacidade ao concluir o carregamento.

Um skeleton neutro deve ser somente o fallback quando ainda nao existir LQIP ou quando a imagem falhar. Ele evita uma area em branco, mas nao preserva a identidade visual da campanha; para banners promocionais, o blur-up e mais informativo e parece mais rapido.

## O que foi verificado no codigo atual

- A pagina da aluna usa `next/image` com `fill` dentro de um item `aspect-[4/1]` em `src/app/(student)/app/student-banners-carousel.tsx`. O espaco visual ja e reservado, portanto o relato e de troca visual abrupta, nao de um layout shift causado por altura desconhecida.
- O componente marca **todos** os slides com `priority`. No Next.js 16.2.9 essa prop esta depreciada; para um carousel, pre-carregar todas as imagens cria concorrencia de rede e nao melhora necessariamente a primeira imagem vista.
- O carousel tambem usa `unoptimized`. Isso impede que o `next/image` gere variantes responsivas. Como o banner enviado tem 1680 px de largura, uma tela pequena pode baixar a mesma imagem grande. O dominio publico do R2 ja e previsto condicionalmente em `next.config.ts`; se estiver configurado em producao, o banner publico da aluna pode voltar a usar a otimizacao do Next.js.
- O preview administrativo usa uma rota autenticada que redireciona para URL assinada do R2 e tambem usa `unoptimized` (`src/app/(admin)/admin/configuracoes/banners/sortable-banner-item.tsx`). Manter essa opcao e justificavel: o otimizador padrao do Next.js nao encaminha cabecalhos ao buscar a origem protegida. Portanto, este preview deve ganhar LQIP/skeleton e fade, sem tentar mover sua requisicao para o otimizador.
- Nenhuma dessas telas fornece hoje `placeholder`, `blurDataURL`, `onLoad` ou um estado visual de carregamento.

## Recomendacao de implementacao

### 1. Gerar e armazenar o LQIP no mesmo upload

Depois que o recorte final for gerado e validado, o servidor ja recebe um WebP 1680 x 420. Usar `sharp` para derivar uma versao de aproximadamente 10 px de largura, codificada como `data:image/webp;base64,...`, e salvar esse valor em uma coluna, por exemplo `dashboard_banners.blur_data_url`.

O LQIP deve ser pequeno. A documentacao do Next.js recomenda imagem de aproximadamente 10 px ou menos para evitar que o proprio `blurDataURL` se torne custo relevante. Como ha no maximo cinco banners, o pequeno dado adicional no banco e desprezivel e permite mostrar o placeholder antes de qualquer request de imagem final.

O tipo de banner e as consultas de aluna e administracao devem retornar esse campo. Nao e necessario guardar o original para isso: o derivado pode ser criado a partir do WebP final que ja sera publicado.

### 2. Criar um componente reutilizavel de imagem de banner

Um componente client, por exemplo `BannerImage`, deve receber `src`, `blurDataURL`, `alt` e `sizes` e:

- manter um fundo LQIP durante a carga;
- passar `placeholder="blur"` e `blurDataURL` ao `Image` quando houver LQIP;
- iniciar a imagem final com `opacity-0` e aplicar `opacity-100` em 150 a 200 ms no `onLoad`;
- manter o LQIP visivel como fallback se ocorrer `onError`;
- respeitar `prefers-reduced-motion`, removendo a transicao para esse publico.

`onLoad` e o callback adequado: ele roda quando a imagem terminou de carregar e o placeholder do Next foi removido. Como usa funcao, o componente precisa ser Client Component, o que ja e compativel com os dois componentes atuais.

### 3. Aplicar prioridade somente ao banner inicialmente visivel

No carousel da aluna:

- trocar `priority` por `preload={index === 0}` no primeiro banner, se ele continuar sendo o maior elemento visivel no topo da pagina;
- deixar os demais com o comportamento lazy padrao;
- nao combinar `preload` com `loading` ou `fetchPriority` na mesma imagem;
- informar `sizes="100vw"`, pois o banner ocupa toda a largura do container. Se no futuro o container tiver largura maxima conhecida, descrever essa largura em `sizes` para reduzir ainda mais o download em telas largas.

No preview administrativo, deixar o carregamento lazy padrao. A miniatura nao e candidata a LCP e pode estar fora da viewport.

### 4. Decisao sobre `unoptimized`

- **Aluno:** remover `unoptimized` somente depois de confirmar em staging/producao que `R2_PUBLIC_BASE_URL` esta configurada e que a URL publica dos banners casa com `images.remotePatterns`. Isso habilita `srcset` responsivo e faz `sizes` ter efeito prático. Avaliar no Network se a imagem escolhida corresponde ao viewport.
- **Admin:** manter `unoptimized` enquanto o preview passar por `/api/banners/[bannerId]/image`, porque essa rota exige sessao e redireciona para URL assinada. Otimiza-la exigiria desenhar uma rota/loader autorizado e cacheavel; isso e um trabalho separado, nao um ajuste visual.

## Alternativas avaliadas

### Somente skeleton

Mais simples e suficiente para miniaturas sem contexto visual, mas ainda troca um bloco abstrato pela arte final. Recomendado como fallback de erro/ausencia de LQIP, nao como experiencia principal do banner.

### Somente fade sem placeholder

Suaviza a troca, mas deixa a area vazia ou com cor solida ate a resposta da rede. E inferior ao LQIP para uma peca de divulgacao.

### Preload de todos os slides

Nao recomendado. O Next.js orienta usar preload para a imagem LCP/acima da dobra, nao para multiplas candidatas. Em um carousel, priorizar todas concorre por banda com a imagem inicialmente visivel e com o restante da pagina.

## Criterios de aceite sugeridos

1. Em rede limitada, o espaco 4:1 aparece imediatamente, sem empurrar o conteudo abaixo.
2. A primeira imagem do carousel mostra LQIP desde a primeira pintura e revela a arte final sem salto perceptivel.
3. As demais imagens nao recebem preload; o primeiro slide sim, apenas se for LCP real em medicao.
4. Os previews administrativos nao mostram branco durante carregamento: usam LQIP ou skeleton de fallback.
5. Em erro de imagem, o placeholder permanece e a interface nao fica vazia.
6. Lighthouse/Web Vitals confirmam ausencia de regressao em LCP e CLS antes de remover `unoptimized` no fluxo publico.

## Fontes primarias

- [Next.js Image API: width, height e fill](https://nextjs.org/docs/app/api-reference/components/image#width-and-height) - dimensoes intrinsecas reservam a proporcao e evitam layout shift; `fill` exige pai posicionado.
- [Next.js Image API: sizes](https://nextjs.org/docs/app/api-reference/components/image#sizes) - com `fill`, `sizes` informa o tamanho renderizado; sem isso, o navegador assume `100vw` e pode baixar imagem maior que o necessario.
- [Next.js Image API: placeholder e blurDataURL](https://nextjs.org/docs/app/api-reference/components/image#placeholder) - `blur` exige `blurDataURL` para URLs dinamicas; a recomendacao e manter o dado por volta de 10 px ou menos.
- [Next.js Image API: preload](https://nextjs.org/docs/app/api-reference/components/image#preload) - uso para LCP/hero acima da dobra; nao combinar com `loading` ou `fetchPriority`. A pagina de versoes informa que `priority` foi depreciada no Next.js 16.
- [Next.js Image API: loading](https://nextjs.org/docs/app/api-reference/components/image#loading) - lazy e o padrao; eager e apenas para imagens que precisam iniciar imediatamente.
- [Next.js Image API: onLoad](https://nextjs.org/docs/app/api-reference/components/image#onload) - callback ocorre apos o carregamento e a remocao do placeholder; callbacks requerem Client Component.
- [Next.js Image API: unoptimized](https://nextjs.org/docs/app/api-reference/components/image#unoptimized) - desabilita a otimizacao; a mesma documentacao observa que o otimizador padrao nao encaminha cabecalhos ao buscar a origem, relevante para o preview autenticado.
