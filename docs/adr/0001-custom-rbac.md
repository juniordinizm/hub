---
status: accepted
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# ADR-0001 RBAC próprio sem Admin/Organization Plugin

## Contexto

O produto possui três papéis globais e capacidades pequenas e explícitas. Não há tenant, organização, convite, equipe ou administração de usuários do Better Auth como conceito de domínio.

## Decisão

Manter papéis em `roleEnum`/`users.role` e capacidades em `rolePermissions`, de `src/lib/auth-policy.ts`. Better Auth permanece responsável por autenticação e sessão, não pela autorização de negócio. Não habilitar Admin Plugin nem Organization Plugin sem nova necessidade de domínio.

## Alternativas consideradas

- Admin Plugin: adicionaria modelo e API administrativa que não representam as capacidades atuais.
- Organization Plugin: adicionaria organizações, membros, convites e times inexistentes no produto.
- checagem direta de papel em cada tela: simples no início, mas dispersa a política.

## Consequências

- autorização é legível e testável em um arquivo;
- cada Server Action ainda precisa chamar a política;
- mudanças de permissão exigem revisão de produto e segurança;
- não há UI/fluxo pronto para organizações;
- migrar futuramente para plugins exigirá mapear papéis e dados.

## Evidências

`rolePermissions`, `canPerform` e `rolesForPermission` em `src/lib/auth-policy.ts`; `roleEnum` em `src/db/schema.ts`; `src/lib/auth-policy.test.ts`.
