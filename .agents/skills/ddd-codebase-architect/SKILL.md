---
name: ddd-codebase-architect
description: Orchestrated DDD architecture analysis for frontend, backend, or full-stack codebases. Use when the user asks to discover app modules, bounded contexts, domains, aggregate roots, value objects, use cases, repositories, adapters, presentation delivery, or a strict DDD target structure before migration. This skill analyzes and reports; it does not move files by default.
---

# DDD Codebase Architect

Use this skill when the user wants a senior software architect analysis of an existing codebase before migration, enforcement, or refactoring.

This skill is analytical and design-focused. It should identify what the app currently does, infer bounded contexts, map code to tactical DDD patterns, and propose the strict DDD structure. It should not migrate, move, rename, or enforce files unless the user explicitly asks for implementation work. For implementation, hand off to `ddd-project-migrator`. For validation of an already implemented DDD structure, use `ddd-structure-enforcer`.

## Clear role compared with the other DDD skills

Use this skill for discovery, modeling, and planning:

- Discover app modules and bounded contexts.
- Understand the existing domain language.
- Identify domain aggregates, aggregate roots, entities, value objects, domain services, events, repository ports, application use cases, commands, queries, DTOs, infrastructure adapters, and presentation delivery code.
- Produce a proposed strict DDD module map.
- Produce a migration plan without applying it.
- Explain the architecture and reasoning thoroughly to the user.

Use `ddd-project-migrator` for applying the chosen structure, moving files, rewriting imports, creating ports/adapters, and converting the codebase to strict DDD.

Use `ddd-structure-enforcer` for validating an implemented DDD structure, checking dependency direction, checking misplaced folders/imports, and normalizing an existing DDD-like layout.

## Canonical target structure

The default architectural target is the strict DDD structure for both frontend and backend:

```text
src/
  modules/
    <bounded-context>/
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

For frontend projects using the strict structure, `presentation` may also contain delivery folders such as `pages`, `components`, `hooks`, `stores`, `forms`, and `view-models`. API clients belong in `infrastructure/http`. Browser storage, auth providers, analytics, and framework adapters belong in `infrastructure`.

Do not recommend creating every inner folder when there is no responsibility for it yet. The strict structure is the architectural model. Concrete folders should reflect real behavior unless the user asks for scaffolding.

## Naming conventions and ubiquitous language

This skill must treat ubiquitous language as a primary architectural output. The analysis should discover the vocabulary of the app before proposing module names or tactical DDD element names.

Required naming conventions for the proposed structure:

```text
Files: lowerCamelCase, for example order.ts, orderRepository.ts, placeOrder.ts
Folders: kebab-case, for example value-objects, use-cases, domain-services
Classes and types: PascalCase, for example Order, Money, PlaceOrder
Variables and functions: lowerCamelCase, for example orderTotal, placeOrder
Constants: SCREAMING_SNAKE_CASE only for true constants, for example MAX_ORDER_ITEMS
```

The proposed architecture must include a ubiquitous-language glossary per context when enough evidence exists. Source terms from product UI, route/API names, GraphQL operations, commands, events, database concepts, tests, and repeated business rules. Prefer those terms over generic implementation names.

Do not recommend `PascalCase` filenames. A file exporting `Order` should be proposed as `order.ts`; a file exporting `PlaceOrder` should be proposed as `placeOrder.ts`.

Use `references/naming-and-ubiquitous-language.md` as the canonical naming reference.

## Orchestrated subagent workflow

This skill should behave as a main architect agent that coordinates four focused analysis tracks.

First, the main agent inspects the app and determines the candidate modules or bounded contexts. Then the main agent delegates the same module list to four layer-focused subagents:

1. Domain subagent: discovers the domain model for each module.
2. Application subagent: discovers application commands, queries, use cases, orchestration, DTOs, and ports.
3. Infrastructure subagent: discovers persistence, external systems, concrete adapters, mappers, SDK wrappers, cache, queue, email, HTTP, and storage code.
4. Presentation subagent: discovers controllers, routes, GraphQL, REST, pages, components, hooks, stores, forms, view models, request/response formatting, and delivery concerns.

When Codex subagent workflows are available and the user invoked this skill for a real codebase, spawn the four subagents in parallel after the main module inventory is complete. Ask each subagent to work in read-only mode, analyze the same canonical module list, return the required structured report, and avoid editing files.

Preferred custom agent names when available:

```text
ddd_domain_analyst
ddd_application_analyst
ddd_infrastructure_analyst
ddd_presentation_analyst
```

If these custom agents are not available, spawn built-in `explorer` subagents with the role-specific instructions in `references/subagent-orchestration.md`. Do not skip subagents solely because custom agent files are unavailable.

If subagent spawning is unavailable in the current runtime, perform the four tracks sequentially in the main agent and label the sections as simulated subagent analyses. State that the result was produced sequentially.

Subagents must not spawn additional subagents. Keep the depth to one level.

## Determinism requirement

Make the analysis as repeatable as the runtime allows. Do not promise mathematical determinism from model reasoning, but enforce deterministic operating rules:

- Analyze files in sorted path order.
- Normalize context names to lower-kebab-case.
- Apply file/folder/symbol naming conventions consistently in all proposed paths.
- Preserve ubiquitous language and keep a glossary of accepted terms and rejected alternatives.
- Use the same module inventory for every subagent.
- Do not let each subagent invent its own module list.
- Use fixed evidence thresholds and confidence labels from `references/deterministic-analysis-contract.md`.
- Prefer direct code evidence over names, comments, or guesses.
- Treat generated files as evidence only for integration boundaries, not domain ownership.
- Sort final modules alphabetically unless the user asks for business-priority ordering.
- Sort tactical elements by module, then layer, then symbol or file path.
- When two names tie, choose the name already used in routes, package names, or public domain language before internal implementation names.
- Mark uncertain items as candidates instead of final architectural decisions.

Run the helper script when useful:

```bash
node .agents/skills/ddd-codebase-architect/scripts/scan-codebase-ddd.mjs --root . --format json
```

To produce a subagent prompt packet from the scan output:

```bash
node .agents/skills/ddd-codebase-architect/scripts/prepare-ddd-subagent-plan.mjs --root . --format markdown
```

The scripts provide deterministic first-pass evidence. They are not a substitute for reading representative files.

## Required workflow

### 1. Inspect the repository before making claims

Start by identifying:

1. Project kind: frontend, backend, full-stack, monorepo, package, library, or unknown.
2. Frameworks and build tools.
3. Existing folder boundaries, especially `modules`, `features`, `domains`, `controllers`, `routes`, `pages`, `components`, `services`, `models`, `repositories`, `api`, `clients`, `stores`, `hooks`, `schemas`, `dto`, `commands`, `queries`, and `use-cases`.
4. Existing tests, fixtures, generated files, migrations, OpenAPI/GraphQL schemas, Prisma or ORM schema files, package boundaries, path aliases, and dependency injection setup.
5. Public language in routes, UI labels, controller names, database tables, API endpoints, event names, commands, and test descriptions.
6. Naming convention violations and generic names that hide business language.

Use the helper script as a first pass when the repository is JavaScript or TypeScript, or when a broad scan is useful:

```bash
node .agents/skills/ddd-codebase-architect/scripts/scan-codebase-ddd.mjs --root . --format markdown
```

Use script output as clues. Always inspect representative files manually before final classification.

### 2. Main agent: build the canonical module inventory

The main agent owns module discovery. Subagents do not redefine the module list.

Find candidate bounded contexts from repeated business language and ownership boundaries, not only from folder names.

Good context signals include:

- Route groups and API namespaces, such as `/orders`, `/billing`, `/users`, `/inventory`, `/checkout`, `/identity`, or `/subscriptions`.
- Controllers, resolvers, pages, features, modules, or packages with stable business names.
- Database tables and ORM models that change together.
- Use cases that share the same nouns and invariants.
- Domain events, commands, policies, permissions, or workflows.
- UI flows that represent business capabilities, not only screens.
- External integrations that belong to a business capability, such as payment provider adapters inside billing.

Avoid false contexts such as `components`, `utils`, `hooks`, `api`, `common`, `shared`, `services`, `lib`, `types`, or `helpers`. These are technical buckets unless the code inside reveals a business concept.

For each module, record:

- Proposed context name.
- Business responsibility.
- Current evidence files.
- Current folders that contain its code.
- Related contexts and likely integration points.
- Confidence level: high, medium, or low.
- Ubiquitous language terms and their evidence.
- Naming alternatives when the existing code uses inconsistent names.

After this inventory is complete, freeze it for the rest of the run. Give the exact frozen module list to all four subagents.

### 3. Spawn four layer-focused subagents

Spawn these four tracks with the frozen module list and evidence paths. Instruct each subagent to return only its assigned layer and to cite files/symbols.

#### Subagent 1: Domain analyst

Scope: `domain/` only.

Find, for each module:

- Aggregate roots.
- Ubiquitous language terms used by the domain model.
- Aggregates.
- Entities.
- Value objects.
- Domain services.
- Domain events.
- Repository ports.
- Domain invariants and business rules.
- Domain code currently misplaced in services, models, components, hooks, controllers, routes, or infrastructure.

Rules:

- Do not mark every ORM model as an aggregate root. ORM models are persistence shapes until proven by behavior and invariants.
- An aggregate root owns a consistency boundary, has identity and lifecycle, controls changes to related objects, enforces invariants, and is normally loaded/saved by a repository.
- An entity has identity and lifecycle but may live inside an aggregate.
- A value object has no business identity, is immutable or treated as immutable, and is compared by value.
- A domain service holds pure business logic that does not naturally belong inside an entity or value object.
- A domain event names something meaningful that already happened inside the domain.
- A repository port is an interface for loading and saving aggregate roots. Concrete persistence belongs in infrastructure.

#### Subagent 2: Application analyst

Scope: `application/` only.

Find, for each module:

- Commands.
- Ubiquitous language terms used in workflows and use cases.
- Queries.
- Use cases.
- DTOs.
- Application services or handlers.
- Transaction boundaries.
- Authorization and policy orchestration.
- Ports consumed by application use cases.
- Application logic currently misplaced in controllers, pages, hooks, services, API handlers, or infrastructure.

Rules:

- A use case coordinates one user/system action.
- Commands mutate state. Queries read state.
- Use cases may call domain objects, repository ports, external ports, policies, and transaction boundaries.
- Use cases should not render UI, format HTTP responses, own route/controller concerns, or contain ORM-specific queries.
- DTOs are boundary shapes. Do not confuse DTOs with domain objects.

#### Subagent 3: Infrastructure analyst

Scope: `infrastructure/` only.

Find, for each module:

- Concrete repository implementations.
- Infrastructure adapter names that should align with domain/application ports.
- ORM adapters, Prisma code, Postgres/SQL code, Redis caches, email providers, HTTP/API clients, payment gateways, queues, storage clients, browser storage, auth SDK wrappers, analytics adapters, mappers, serializers, and generated client usage.
- Infrastructure code currently mixed with domain/application logic.
- Repository implementations currently placed in domain or application folders.
- External systems that should become ports/adapters.

Rules:

- Infrastructure implements ports defined by domain/application.
- Infrastructure may depend inward, but domain must not depend on infrastructure.
- External SDKs, HTTP clients, database clients, browser APIs, queues, email providers, caches, and generated clients belong here.
- Detect business rules hidden inside persistence mappers or API clients.

#### Subagent 4: Presentation analyst

Scope: `presentation/` only.

Find, for each module:

- Controllers.
- Presentation terms that reveal user-facing domain language.
- Routes.
- REST handlers.
- GraphQL resolvers.
- Frontend pages.
- Components.
- Hooks.
- Stores.
- Forms.
- View models.
- Request/response formatters.
- Presentation code currently containing application orchestration or domain rules.

Rules:

- Presentation adapts delivery mechanisms to application use cases.
- Controllers, routes, pages, components, hooks, resolvers, and stores must not own business invariants.
- Hooks and stores may coordinate UI state, but business decisions should move to application/domain.
- Request validation and response formatting belong near presentation unless the data shape is an application DTO.

### 4. Merge subagent findings

The main agent must reconcile the four reports into one coherent architecture. Do not simply concatenate the subagent outputs.

Merge rules:

- Use the main agent’s frozen module list as the source of truth.
- If a subagent proposes a new module, treat it as a candidate and explain the evidence.
- Resolve conflicting classifications by dependency direction and responsibility, not by file name alone.
- If two subagents claim the same file, decide the dominant responsibility and list any secondary concerns as misplaced responsibilities.
- Preserve uncertainty. Do not upgrade confidence without concrete evidence.
- Identify missing ports and adapters when application/domain code directly calls external systems.
- Identify missing use cases when presentation directly performs business workflows.
- Identify missing domain objects when application/infrastructure contains repeated invariants.

### 5. Propose the strict DDD module map

Produce a proposed tree based on the discovered contexts. Use only contexts justified by evidence. For low-confidence contexts, mark them as candidates instead of final module names.

Example output:

```text
src/
  modules/
    orders/
      domain/
        aggregates/
          order.ts
        entities/
          orderItem.ts
        value-objects/
          money.ts
          orderStatus.ts
        events/
          orderPlaced.ts
        repositories/
          orderRepository.ts
      application/
        commands/
          placeOrderCommand.ts
        queries/
          getOrderQuery.ts
        use-cases/
          placeOrder.ts
          cancelOrder.ts
        dto/
          orderDto.ts
      infrastructure/
        http/
          apiOrderRepository.ts
        postgres/
          postgresOrderRepository.ts
      presentation/
        controllers/
          orderController.ts
        routes/
          orderRoutes.ts
```

For frontend modules, the same strict layers apply:

```text
src/
  modules/
    orders/
      domain/
      application/
      infrastructure/
        http/
          apiOrderRepository.ts
      presentation/
        pages/
          orderPage.tsx
        components/
          orderForm.tsx
        hooks/
          usePlaceOrder.ts
```

### 6. Produce a thorough architecture report

The final answer should explain what the app appears to be, what modules it contains, and how each module maps into strict DDD. It should include evidence and confidence labels, not only conclusions.

Required sections:

1. Project classification.
2. Ubiquitous language glossary and naming conflicts.
3. Main agent module inventory.
4. Subagent findings summary.
5. Context-by-context tactical DDD map.
6. Proposed strict DDD structure.
7. Misplaced responsibilities and dependency risks.
8. Migration readiness.
9. Recommended next step, usually using `ddd-project-migrator` to implement the proposed structure or `ddd-structure-enforcer` to validate an existing DDD layout.

When confidence is low, say so and explain what evidence is missing.

## Output format

Prefer this structure:

~~~markdown
# DDD Architecture Analysis

## Project classification

## Ubiquitous language glossary

| Context | Accepted term | Evidence | Rejected/alternate terms | Reason |
| --- | --- | --- | --- | --- |

## Main agent module inventory

| Module | Responsibility | Evidence | Confidence |
| --- | --- | --- | --- |

## Subagent findings summary

| Subagent | Scope | Key findings | Conflicts or gaps |
| --- | --- | --- | --- |

## Tactical DDD map

### <module>

#### Domain
- Aggregate roots:
- Aggregates:
- Entities:
- Value objects:
- Domain services:
- Domain events:
- Repository ports:
- Invariants:
- Misplaced domain logic:

#### Application
- Commands:
- Queries:
- Use cases:
- DTOs:
- Application ports:
- Misplaced application logic:

#### Infrastructure
- Repository implementations:
- External adapters:
- Mappers/serializers:
- Infrastructure risks:

#### Presentation
- Controllers/routes/resolvers/pages/components/hooks/stores:
- Request/response/view models:
- Presentation risks:

## Proposed strict structure

```text
src/modules/...
```

## Misplaced responsibilities and dependency risks

## Migration readiness

## Recommended next step
~~~

## Quality rules

- Prefer ubiquitous business language over technical folder names.
- Proposed files must be lowerCamelCase and proposed folders must be kebab-case.
- Proposed classes and types must be PascalCase, variables lowerCamelCase, and constants SCREAMING_SNAKE_CASE only when necessary.
- Do not invent bounded contexts without evidence.
- Do not treat every table, component, or API endpoint as a separate context.
- Do not over-model CRUD apps. Simple modules may only need use cases, DTOs, repository ports, and infrastructure adapters.
- Keep `shared` small. Recommend shared code only for true cross-context primitives, framework setup, generic UI components, logging, HTTP clients, or test utilities.
- A context should own its domain language. Avoid placing business rules in global `utils`, `services`, or `helpers`.
- Preserve current behavior. This skill should not recommend behavior changes unless a current dependency risk or domain leak requires refactoring.
- Mention generated or external code separately and do not ask to migrate generated files unless the project intentionally treats them as source.
- Do not make code edits in this skill unless the user explicitly asks for implementation.
