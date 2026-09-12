## Base do PR

- PR normal: base `staging`.
- Hotfix urgente: branch `hotfix/*`, base `main` e label `hotfix`.

## Checklist

- [ ] Confirmei a branch-base correta.
- [ ] Atualizei a documentação operacional quando alterei fluxo, ambiente,
      migration, cron ou backup.
- [ ] Mantive migrations forward-only e compatíveis com a versão anterior.
- [ ] Testei o comportamento afetado e registrei riscos ou rollback.
- [ ] Executei o [CodeRabbit](../docs/operations/code-review-with-coderabbit.md)
      contra a base correta e triagei os achados; ou registrei o motivo do skip
      quando a ferramenta não estava disponível.

Hotfixes para `main` devem explicar no corpo por que a homologação em Staging
não pode aguardar e como serão reconciliados antes da próxima release.
