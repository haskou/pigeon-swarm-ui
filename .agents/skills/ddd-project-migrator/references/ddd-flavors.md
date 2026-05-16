# DDD structure flavors

The canonical target for both frontend and backend is `strict`. Use the other flavors only when the user explicitly chooses them or when the existing project already clearly follows that style.

## strict

Recommended for both frontend and backend projects. Use business modules under `src/modules` and the same four layers everywhere.

```text
src/
  modules/
    orders/
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

For frontend projects using `strict`, put API clients under `infrastructure/http` and UI delivery code under `presentation` with frontend-specific subfolders such as `pages`, `components`, `hooks`, `stores`, `forms`, and `view-models`.

## frontend-feature

Use only when the user prefers frontend-native naming.

```text
src/
  features/
    orders/
      domain/
      application/
      api/
      ui/
```

`api` maps to infrastructure. `ui` maps to presentation.

## backend-module

Use when the user wants a backend-focused name for the strict structure. It is structurally the same as `strict`.

```text
src/
  modules/
    orders/
      domain/
      application/
      infrastructure/
      presentation/
```

`presentation` contains controllers, routes, GraphQL resolvers, RPC handlers, subscribers, validators, and request/response DTOs.

## fullstack-split

Use for monorepos or apps with separate frontend and backend packages. Keep app boundaries separate, but use the canonical module layout inside each app.

```text
apps/
  web/
    src/
      modules/
        orders/
          domain/
          application/
          infrastructure/
          presentation/
  api/
    src/
      modules/
        orders/
          domain/
          application/
          infrastructure/
          presentation/
```

Do not force the frontend and backend to share a domain model unless there is a deliberate shared contract or primitive package.

## custom

Use when the project already has strong conventions. Preserve existing names when they express the same boundaries. For example, `adapters` can map to `infrastructure`, and `delivery` can map to `presentation`.

```text
src/
  domains/
    orders/
      domain/
      application/
      adapters/
      delivery/
```

A custom mapping must still preserve dependency direction.

## Naming and language

All flavors still use the same naming convention: files lowerCamelCase, folders kebab-case, classes/types PascalCase, variables lowerCamelCase, and constants SCREAMING_SNAKE_CASE when necessary. Ubiquitous language outranks mechanical naming preference; use the business term with the strongest evidence.
