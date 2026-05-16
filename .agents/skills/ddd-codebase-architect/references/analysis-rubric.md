# DDD codebase analysis rubric

Use this rubric to distinguish architecture discovery from migration and enforcement.

## Bounded context rubric

A bounded context should represent a coherent business capability or domain language. Strong evidence includes:

- Repeated nouns and verbs across routes, pages, services, tests, models, and workflows.
- Independent rules or invariants.
- Separate persistence ownership or tables that change together.
- Separate external integrations attached to a business capability.
- Commands, queries, events, or use cases that naturally group together.

Weak evidence includes:

- A folder named `components`, `services`, `api`, `utils`, `lib`, `common`, or `shared`.
- A single UI component with no business workflow.
- A database table with no behavior or separate language.
- A one-off helper.

## Tactical classification rubric

### Aggregate root

Use this label only when the code appears to own consistency and lifecycle. Aggregate roots usually have behavior, not only data fields. Repository ports usually save and load aggregate roots.

### Entity

Use this label when an object has identity and lifecycle but may be owned by an aggregate root.

### Value object

Use this label when the object has no identity, represents a value, and should be compared by value. Common examples: Money, Email, Address, DateRange, Quantity, Currency, Name, PhoneNumber, Percentage, Slug.

### Domain service

Use this label for pure business logic that spans multiple domain objects and does not belong naturally to one entity or value object.

### Application use case

Use this label for orchestration of a business action. Use cases coordinate domain objects, repositories, ports, and transactions.

### Repository port

Use this label for interfaces that load/save aggregate roots or domain entities. Concrete implementations are infrastructure adapters.

### Infrastructure adapter

Use this label for database, ORM, HTTP, queue, email, cache, storage, analytics, auth provider, external SDK, or browser API implementations.

### Presentation delivery

Use this label for controllers, routes, GraphQL resolvers, REST handlers, server actions, frontend pages, components, hooks, stores, forms, and view models.

## Confidence levels

High confidence: multiple files and responsibilities support the classification.

Medium confidence: naming and placement are suggestive, but business rules or lifecycle are not fully visible.

Low confidence: only one file, a generic name, or a persistence/UI shape suggests the classification.

## Reporting principles

- Report evidence paths for each major conclusion.
- Separate findings from recommendations.
- Use `candidate` when the classification is plausible but not proven.
- Prefer fewer, stronger bounded contexts over many tiny contexts.
- Do not recommend file moves in this analysis skill unless the user asks for implementation.
