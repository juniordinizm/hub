---
status: accepted
owner: product
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# ADR-0008: analytics de aprendizagem minimizado, padrão e com opt-out

## Contexto

O Hub precisa encontrar falhas técnicas e entender, de forma agregada, como as Aulas são usadas. O público atual é pequeno e íntimo; por isso, uma lista nominal de inatividade e um fluxo de contato baseado em telemetria criariam mais complexidade e risco do que benefício pedagógico.

`lesson_progress` e `lesson_watch_progress` são necessários para acesso, retomada, sequência, conclusão e Certificado. Eles não são substituídos por analytics.

## Decisão

O Hub registra por padrão eventos minimizados de início, checkpoint por faixa de 10%, conclusão e falha técnica. A Aluna pode desativar essa análise em **Conta > Configurações**, sem modal, bloqueio ou tela dedicada. A preferência é oposição/opt-out, nunca consentimento.

Ausência de uma linha em `learning_analytics_preferences` significa analytics habilitado. Ao desativar, o Hub remove os eventos brutos identificáveis da Aluna, deixa de aceitar eventos futuros e exclui seu progresso essencial das consultas analíticas. Métricas diárias já materializadas permanecem somente agregadas.

O Admin vê métricas por Aula e `CoursePublication`, com exportação CSV sem Conta, Matrícula, e-mail ou outro identificador pessoal. O Hub não mantém lista de Alunas inativas, registro de reengajamento, ação de contato nem automação de mensagens baseada nesses dados.

Eventos brutos ficam até 90 dias; métricas agregadas, até 13 meses. A limpeza programada continua condicionada à habilitação operacional e à referência jurídica formal.

## Consequências

O painel continua útil para qualidade de Aula, mas não é ferramenta de acompanhamento individual. Falha da coleta não pode alterar acesso, progresso, sequência, conclusão ou Certificado.

O aviso público de privacidade informa a finalidade, categorias, retenção e controle. Esta decisão de produto não comprova base legal nem conformidade LGPD: a ativação em produção exige ratificação jurídica documentada da base legal, transparência e prazos aplicáveis.

## Alternativas rejeitadas

- Tela obrigatória de consentimento: torna uma coleta minimizada em fricção de onboarding e não é a base escolhida para o padrão.
- Reengajamento manual ou automático após inatividade: trata um sinal incompleto como acompanhamento individual e não é necessário para o escopo atual.
- Coletar replay, IP, user agent, comentário, texto assistido ou conteúdo de Aula: não é necessário para as métricas definidas.
