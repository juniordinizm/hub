> **Status: rascunho de descoberta, não normativo, baseado no estado observado e sujeito a decisão e aprovação.**

# Descoberta de regras de negócio

Data: 2026-07-17. Estado observado: Git `main` no commit `7274db6`; Neon `protear`, branch `production` (`br-winter-voice-ace5lsla`).

Objetivo: registrar evidências AS-IS da plataforma privada PROTEA-R sem converter comportamento atual em decisão de produto.

Escopo: app Next.js em `src/`, schema/migrations Drizzle, testes, documentos locais, documentação oficial e metadados read-only do Neon. A consulta ao banco restringiu-se a catálogo, objetos, constraints e estado de RLS: não leu linhas, segredos, payloads, dados pessoais ou configurações de provedores. Nenhuma implementação, migration ou dado foi alterado.

Classificações: `AS-IS CONFIRMADO` tem evidência coerente nas camadas relevantes; `AS-IS PARCIAL` deixa bordas sem confirmação; `AS-IS INFERIDO` é hipótese identificada; `TO-BE DOCUMENTADO` é planejamento existente; `LACUNA`, `CONTRADIÇÃO`, `BUG PROVÁVEL` e `OBRIGAÇÃO EXTERNA` exigem decisão, correção ou validação posterior. Severidade mede risco observado, não prioridade aprovada.

Documentos produzidos: mapa do sistema, atores, entidades/estados, fluxos, inventário de regras, invariantes, rastreabilidade, lacunas, perguntas, fontes e plano documental. Nenhum deles é política, contrato ou requisito aprovado.

Limitações: o catálogo Neon confirma que RLS está desabilitado nas 23 tabelas `public`, mas não prova credenciais/privilégios usados pela aplicação, rede, backups, deploy ou dados. Não houve E2E, browser, e-mail, webhook real, logs, métricas nem acesso a configurações dos provedores.
