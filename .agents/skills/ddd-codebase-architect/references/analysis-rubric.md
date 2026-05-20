# Analysis rubric

The architect skill is analysis-only. It discovers modules and tactical DDD elements, then produces a migration-ready architecture report.

Primary goals:

1. Identify bounded contexts/modules using ubiquitous language.
2. Identify domain objects: aggregate roots, aggregates, entities, value objects, domain services, domain events, repository ports.
3. Identify application objects: commands, queries, use cases, DTOs, application services, orchestration policies, ports.
4. Identify infrastructure objects: adapters, repository implementations, SDK wrappers, persistence models, mappers, filesystem/browser/platform integrations.
5. Identify presentation objects: controllers, routes, GraphQL resolvers, REST handlers, pages, components, hooks, stores, forms, view models.
6. Identify large-file and SRP violations.
7. Identify procedural code that should become OO DDD classes.
8. Identify dependency-injection violations.
9. Propose a strict DDD target structure.

Do not migrate files. The output should be usable by the migrator skill.
