# Disponibilidade comercial e interesse em Cursos

**Data:** 2026-08-17  
**Escopo:** visibilidade, novas vendas, acesso adquirido e pré-lançamento.

## Conclusão

Plataformas maduras não tratam presença na vitrine, novas inscrições e acesso
adquirido como o mesmo estado. Para o Hub, pausar vendas deve fechar novas
aquisições sem alterar Matrícula ou Concessão; “Em breve” deve captar interesse
sem cobrar ou matricular.

## Evidências primárias

- [Podia](https://help.podia.com/en/articles/11370334-editing-product-availability-settings): separa publicação, visibilidade e acesso; fechar acesso impede novas inscrições sem afetar clientes atuais.
- [LearnWorlds](https://support.learnworlds.com/support/solutions/articles/12000040783): distingue `Coming Soon`, `Enrollment Closed`, `Private` e estados vendáveis.
- [Teachable](https://support.teachable.com/en/articles/11682484-publishing-and-product-visibility): separa publicação de visibilidade; arquivar preços fecha novas compras sem remover matrículas.
- [Thinkific](https://support.thinkific.com/hc/en-us/articles/360030738053-Private-and-Hidden-Products): `Private` fecha checkout e `Hidden` controla descoberta sem retirar acesso existente.
- [Kajabi](https://help.kajabi.com/articles/sales/offers/offers-overview): separa conteúdo (`Product`) de comércio (`Offer`) e vitrine (`Store`).
- [Asaas](https://docs.asaas.com/reference/cancel-a-checkout): oferece `POST /v3/checkouts/{id}/cancel` para cancelar Checkout já criado.

## Decisão aplicada

- Estado de entrega, visibilidade de catálogo e estado de vendas são dimensões distintas.
- O Admin opera presets simples, sem editar combinações inválidas.
- Interesse é opt-in autenticado, reversível e consumido uma vez na abertura.
- Pré-venda paga, captura pública de email e campanhas ficam fora do escopo.

