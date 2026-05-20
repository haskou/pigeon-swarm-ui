# Layer analyst rubrics

## Domain analyst

Look for aggregate roots, aggregates, entities, value objects, domain services, domain events, repository ports, invariants, policies, and ubiquitous language. Reject framework, persistence, and UI concerns in domain code.

## Application analyst

Look for use cases, commands, queries, DTOs, application services, orchestration policies, transactions, authorization boundaries, and application ports. Prefer class-based use cases with constructor-injected ports.

## Infrastructure analyst

Look for concrete adapters: database repositories, Prisma/Postgres/Redis/email/http implementations, SDK clients, mappers, local storage, filesystem access, browser APIs, platform APIs, and composition roots.

## Presentation analyst

Look for controllers, routes, REST, GraphQL, pages, forms, components, hooks, stores, server actions, loaders, request/response mapping, view models, and delivery-specific validation.
