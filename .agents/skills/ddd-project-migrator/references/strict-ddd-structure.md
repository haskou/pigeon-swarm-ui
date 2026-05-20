# Strict DDD structure

Use this structure as the canonical default for frontend, backend, and full-stack web projects:

```txt
src/
  modules/
    user/
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

Each folder under `src/modules` is a bounded context or module expressed in ubiquitous language. Folder names must use `kebab-case`.

Layer rules:

1. `domain` contains business rules only. It must not import UI frameworks, HTTP clients, databases, ORMs, SDKs, filesystem APIs, browser APIs, framework stores, or environment/config loaders.
2. `application` coordinates use cases. It depends on domain abstractions and application ports. It must not directly use concrete infrastructure implementations.
3. `infrastructure` implements ports and adapters. It may use frameworks, databases, SDKs, HTTP clients, local storage, queues, file systems, and platform-specific code.
4. `presentation` handles delivery. Backend examples are controllers, routes, REST, GraphQL. Frontend examples are pages, components, hooks, forms, stores, and view models. Presentation may call application use cases but should not embed domain rules.

The default target is the strict structure. Other flavors are allowed only when the user explicitly selects them.
