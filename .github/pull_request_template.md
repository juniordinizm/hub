## Base do PR

- PR normal: base `staging`.
- Hotfix urgente: branch `hotfix/*`, base `main` e label `hotfix`.

## Checklist

- [ ] Confirmei a branch-base correta.
- [ ] Atualizei a documentação operacional quando alterei fluxo, ambiente,
      migration, cron ou backup.
- [ ] Mantive migrations forward-only e compatíveis com a versão anterior.
- [ ] Testei o comportamento afetado e registrei riscos ou rollback.

Hotfixes para `main` devem explicar no corpo por que a homologação em Staging
não pode aguardar e como serão reconciliados antes da próxima release.
