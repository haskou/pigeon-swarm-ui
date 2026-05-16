# DDD enforcement rule reference

## Canonical target

Use this as the preferred structure for both frontend and backend unless the user selected another flavor:

```text
src/
  modules/
    <module>/
      domain/
        entities/
        value-objects/
        aggregates/
        domain-services/
        events/
        repositories/
      application/
        commands/
        queries/
        use-cases/
        dto/
      infrastructure/
        prisma/
        postgres/
        redis/
        email/
        http/
      presentation/
        controllers/
        routes/
        graphql/
        rest/
```

The four layer folders are the important enforcement boundary. The inner folders are recommended structure. They should be created when they hold real code or when the user asked for scaffolding.

Naming is also an enforcement concern. Files must be lowerCamelCase, folders kebab-case, classes/types PascalCase, variables lowerCamelCase, and constants SCREAMING_SNAKE_CASE only where necessary. Ubiquitous language is the naming source of truth.

## Layer responsibility matrix

| Layer | Owns | Must not own |
| --- | --- | --- |
| domain | entities, value objects, aggregates, domain events, policies, repository/gateway interfaces | UI, HTTP, DB, ORM, framework, browser, analytics, SDK code |
| application | use cases, commands, queries, orchestration, application DTOs, ports | controllers, pages, components, concrete DB/API adapters |
| infrastructure | concrete adapters for external systems such as prisma, postgres, redis, email, http, browser storage, SDKs | core business decisions |
| presentation | controllers, routes, resolvers, pages, components, hooks, forms, view models | domain rules that should be reusable outside the UI/delivery mechanism |

For the `frontend-feature` flavor, `api` maps to infrastructure and `ui` maps to presentation.

## Severity guide

Fail:

- Domain imports UI/framework/database/network code.
- Application imports presentation or UI code.
- Most business code is only in technical folders with no module/feature boundaries.
- A module directly imports another module's private infrastructure or presentation code.

Warn:

- Missing layer folder in a small module.
- Missing recommended inner subfolder in a canonical module.
- Large `shared` folder with domain-specific names.
- Generic names like `services` or `models` dominate the structure.
- Files or folders violate the naming convention.
- Module or tactical DDD names ignore obvious ubiquitous language.
- Barrel exports make boundaries unclear.
- Project uses a valid DDD-like structure that differs from the canonical `src/modules/<context>` layout.

Pass:

- Business-first modules exist under `src/modules` or the selected equivalent.
- Names reflect ubiquitous language and follow the file/folder/symbol convention.
- Domain has no outward dependencies.
- Use cases coordinate domain and ports.
- Infrastructure implements ports.
- Presentation invokes use cases.
