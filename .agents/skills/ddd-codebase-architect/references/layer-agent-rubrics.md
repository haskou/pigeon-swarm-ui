# Layer-specific DDD rubrics

## Domain rubric

Domain code is pure business meaning. It must not depend on UI frameworks, HTTP frameworks, ORMs, database clients, browser APIs, external SDKs, queues, caches, or transport formatting.

Expected strict folders:

```text
domain/entities/
domain/value-objects/
domain/aggregates/
domain/domain-services/
domain/events/
domain/repositories/
```

Repository files in domain should be ports/interfaces. Concrete implementations belong in infrastructure.

## Application rubric

Application code coordinates use cases. It depends on domain and ports. It does not own UI rendering, HTTP response formatting, ORM queries, SQL, fetch calls, or SDK calls.

Expected strict folders:

```text
application/commands/
application/queries/
application/use-cases/
application/dto/
```

Commands mutate state. Queries read state. Use cases orchestrate behavior. DTOs cross boundaries.

## Infrastructure rubric

Infrastructure code implements ports and talks to external systems. It may depend inward on domain/application abstractions. It must not define core business invariants.

Expected strict folders include only what the module actually uses:

```text
infrastructure/prisma/
infrastructure/postgres/
infrastructure/redis/
infrastructure/email/
infrastructure/http/
```

Other valid adapter folders include `queue`, `storage`, `payments`, `auth`, `analytics`, `browser-storage`, and `mappers` when the project needs them.

## Presentation rubric

Presentation adapts delivery mechanisms to application use cases.

Backend examples:

```text
presentation/controllers/
presentation/routes/
presentation/graphql/
presentation/rest/
```

Frontend examples:

```text
presentation/pages/
presentation/components/
presentation/hooks/
presentation/stores/
presentation/forms/
presentation/view-models/
```

Presentation may validate transport-level shape and format responses. It should not own business invariants or direct persistence behavior.
