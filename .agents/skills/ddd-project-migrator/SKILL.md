---
name: ddd-project-migrator
description: Migrate a frontend, backend, or full-stack web project toward a DDD/Clean/Hexagonal structure. Use when the user asks to refactor, reorganize, or migrate an existing project into domain-driven modules, bounded contexts, application use cases, infrastructure adapters, and presentation/UI delivery layers.
---

# DDD Project Migrator

Use this skill when the user wants a web project migrated to a Domain-Driven Design style structure. The project may be frontend, backend, or full-stack.

If the user first asks to analyze the codebase, discover bounded contexts, identify aggregate roots, map tactical DDD elements, or propose a strict structure without moving files, use `ddd-codebase-architect` instead. Use this migration skill when the user wants structural changes applied.

The preferred structure for both frontend and backend is the canonical modular DDD layout:

```text
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

    billing/
      domain/
      application/
      infrastructure/
      presentation/

    orders/
      domain/
      application/
      infrastructure/
      presentation/
```

Use this as the default target unless the user chooses a different flavor. Do not create empty folders mechanically when a project has no responsibility for that folder yet, unless the user explicitly asks for scaffolding. The layout is the target boundary model; the actual files should still reflect real project behavior.

The migration must be incremental, behavior-preserving, and reviewable. Do not rewrite business behavior unless the user explicitly asks for a functional change.

## Naming conventions and ubiquitous language

Apply these rules during analysis and migration:

```text
Files: lowerCamelCase, for example order.ts, orderRepository.ts, placeOrder.ts
Folders: kebab-case, for example value-objects, use-cases, domain-services
Classes and types: PascalCase, for example Order, Money, PlaceOrder
Variables and functions: lowerCamelCase, for example orderTotal, placeOrder
Constants: SCREAMING_SNAKE_CASE only for true constants, for example MAX_ORDER_ITEMS
```

Ubiquitous language is more important than a mechanically neat folder layout. Preserve and strengthen the vocabulary used by the business, product UI, API routes, tests, domain events, and workflows. Do not replace precise domain terms with generic names such as `service`, `manager`, `data`, `item`, `model`, or `logic` when a real business term is available.

When creating or renaming files, the filename remains `lowerCamelCase` even if the exported class or type is `PascalCase`; for example `order.ts` may export `Order`, and `placeOrder.ts` may export `PlaceOrder`.

Use `references/naming-and-ubiquitous-language.md` as the canonical naming reference.

## Required first step

Before moving files or editing imports, inspect the repository and identify:

1. Whether it is primarily frontend, backend, or full-stack.
2. Frameworks and build tools.
3. Existing feature/module boundaries.
4. Existing domain-like concepts, such as entities, models, services, repositories, stores, controllers, routes, hooks, use cases, DTOs, schemas, or API clients.
5. Existing tests and commands that can verify behavior.
6. Existing ubiquitous language from routes, UI labels, API contracts, database concepts, events, commands, tests, and documentation.

If the user has not selected a DDD flavor, ask them to choose one before making structural changes. Show the options with examples, and mark `strict` as the recommended default for both frontend and backend:

```text
Choose a DDD flavor:

1. strict (recommended for both frontend and backend)
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

2. frontend-feature (frontend-oriented naming alternative)
   src/
     features/
       orders/
         domain/
         application/
         api/
         ui/

3. backend-module (backend-focused alias of the strict module layout)
   src/
     modules/
       orders/
         domain/
         application/
         infrastructure/
         presentation/

4. fullstack-split (same canonical module layout, split per app/package)
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

5. custom
   Adapt the canonical layout to existing conventions, for example:
   src/domains/orders/{domain,application,adapters,delivery}
```

If the user asks you to choose, default to `strict` for frontend-only repositories, `strict` or `backend-module` for backend-only repositories, and `fullstack-split` for monorepos or projects with separate frontend/backend applications. Prefer `strict` unless the existing repository already clearly follows another DDD-like flavor.

## Canonical layer responsibilities

### domain

Pure business logic. It should contain:

```text
domain/
  entities/
  value-objects/
  aggregates/
  domain-services/
  events/
  repositories/
```

The repository files in `domain/repositories` are interfaces or ports, not database/API implementations.

The domain layer must not import framework, database, network, browser, UI, routing, controller, storage, ORM, analytics, or external SDK code.

### application

Use case orchestration. It should contain:

```text
application/
  commands/
  queries/
  use-cases/
  dto/
```

The application layer coordinates domain objects and ports. It should not import concrete infrastructure implementations or presentation/UI code.

### infrastructure

External adapters. It should use specific adapter folders when applicable:

```text
infrastructure/
  prisma/
  postgres/
  redis/
  email/
  http/
```

Other valid infrastructure folders include `storage`, `queue`, `analytics`, `auth-provider`, `browser-storage`, `mappers`, and `persistence` when those names better match the project.

### presentation

Delivery layer. It should contain, when applicable:

```text
presentation/
  controllers/
  routes/
  graphql/
  rest/
```

For frontend code using the strict flavor, `presentation` may contain `pages`, `components`, `hooks`, `stores`, `forms`, and `view-models`. Use `ui` only when the user selected the `frontend-feature` flavor.

## Canonical dependency rule

The dependency direction is inward:

```text
presentation -> application -> domain
infrastructure -> application/domain ports
```

For the `frontend-feature` flavor, the same rule maps to:

```text
ui -> application -> domain
api -> application/domain ports
```

Infrastructure implements external adapters, such as database repositories, HTTP clients, browser storage, external service gateways, queues, mailers, file systems, ORMs, analytics, and third-party SDKs.

Presentation exposes behavior to the outside world, such as pages, components, controllers, routes, resolvers, request handlers, hooks, view models, and stores.

## Migration workflow

Follow this workflow in order.

### 1. Create a migration map

Create a concise migration map before changing files. Include:

- Current structure summary.
- Selected flavor.
- Proposed bounded contexts/modules.
- File movement plan.
- Ubiquitous language glossary and any naming conflicts.
- Import rewrite strategy.
- Test/build commands to run.
- Risks and files that should not be touched.

Do not move everything into DDD layers mechanically. Group by business capability first, then by layer.

### 2. Identify modules and preserve ubiquitous language

Infer modules from business language and project structure. Prefer names like `auth`, `users`, `orders`, `billing`, `inventory`, `catalog`, `checkout`, `notifications`, or project-specific domain terms.

Avoid generic modules such as `services`, `utils`, `helpers`, `common`, `models`, or `components` unless the existing project genuinely exposes those as product capabilities.

Use `shared` only for primitives that are genuinely reused across modules. Do not hide business logic in `shared`.

Before renaming anything, identify the dominant term from user-facing labels, route/API names, tests, commands, events, and business rules. Keep a short glossary in the migration map. If two terms compete, keep the existing term with stronger public/domain evidence and list the alternative instead of guessing.

### 3. Move pure business concepts into `domain`

Move or create:

- Entities.
- Value objects.
- Aggregates.
- Domain events.
- Domain services.
- Repository or gateway interfaces.
- Domain errors.
- Policies and specifications.

Remove framework and persistence concerns from domain code during migration. If a model is currently an ORM model, split it into a pure domain object plus a mapper or persistence schema in infrastructure.

### 4. Move orchestration into `application`

Move or create use cases that coordinate domain objects and ports:

- Commands.
- Queries.
- Use cases.
- DTOs that belong to application boundaries.
- Application services.
- Port interfaces if the project prefers application-owned ports.

Use case names should be business actions, for example `RegisterUser`, `CreateOrder`, `CancelSubscription`, `GetCurrentUser`, or `ChangeEmail`.

### 5. Move external adapters into `infrastructure`

Backend examples:

- Database repository implementations.
- ORM schemas and mappers.
- External API clients.
- Message queues.
- Email providers.
- File storage.
- Cache adapters.

Frontend examples when using the strict flavor:

- API clients under `infrastructure/http`.
- Browser storage adapters under `infrastructure/browser-storage` or `infrastructure/storage`.
- Auth-provider SDK adapters under `infrastructure/auth-provider`.
- Analytics adapters under `infrastructure/analytics`.
- Feature-flag clients under `infrastructure/feature-flags`.

For the `frontend-feature` flavor only, use `api` instead of `infrastructure` unless the user chooses otherwise.

### 6. Move delivery code into `presentation`

Backend examples:

- Routes.
- Controllers.
- GraphQL resolvers.
- RPC handlers.
- HTTP request/response DTOs.
- Request validators.

Frontend examples when using the strict flavor:

- Pages.
- Components.
- Hooks.
- View models.
- Stores that exist only for UI state.
- Form adapters.

For the `frontend-feature` flavor only, use `ui` instead of `presentation` unless the user chooses otherwise.

### 7. Rewrite imports safely

Before import rewrites, enforce the naming convention in moved files when it is safe: folders should be `kebab-case`, files should be `lowerCamelCase`, and exported classes/types should remain `PascalCase`. Avoid changing public contracts, database names, or API paths only for style.


After moves, update imports using the project’s existing alias conventions. Prefer existing path aliases over inventing new aliases.

If aliases are missing and the migration would benefit from them, propose aliases but do not add them unless the user requested a complete migration or the change is clearly necessary.

Do not create barrel exports everywhere by default. Use them only if the project already follows that style or if they reduce import churn without hiding boundaries.

### 8. Preserve tests

Move tests with the code they verify unless the project has a clear separate test convention.

After each coherent migration batch, run available checks such as:

- Typecheck.
- Unit tests.
- Integration tests.
- Lint.
- Build.

If checks fail, fix migration-caused failures before continuing. Do not mask failures by deleting tests or weakening assertions.

### 9. Leave a concise migration report

At the end, provide:

- Selected flavor.
- New structure.
- Important files moved.
- Dependency rule applied.
- Commands run and their result.
- Known follow-up work.

## Optional helper script

This skill includes `scripts/analyze-project-ddd.mjs`. When useful, run it from the repository root:

```bash
node .agents/skills/ddd-project-migrator/scripts/analyze-project-ddd.mjs --root .
```

If the skill is installed globally, adjust the path to the installed skill directory.

Use the script output as a starting point, not as a substitute for reading code.

## Anti-patterns to avoid

Do not create a structure like this as the end state:

```text
src/controllers
src/services
src/models
src/repositories
src/components
src/hooks
```

That groups by technical type instead of business capability.

Do not put all domain models in `shared/domain`.

Do not let domain import React, Vue, Angular, Express, NestJS, Prisma, TypeORM, Sequelize, Mongoose, Axios, browser storage, router packages, or external SDKs.

Do not rename business concepts without a reason grounded in ubiquitous language evidence.

Do not use `PascalCase` filenames such as `Order.ts`; use `order.ts` while exporting `Order`.

Do not perform a massive migration in one unreviewable commit unless the user explicitly requests it.

## Done criteria

A migration is done only when:

- The project has business-first modules.
- The selected flavor is explicit.
- Naming conventions are applied or documented as deferred work.
- Ubiquitous language has been preserved and obvious generic names have been flagged.
- The default target is `src/modules/<context>/{domain,application,infrastructure,presentation}` unless the user selected another flavor.
- Domain code is framework-free.
- Use cases live in application code.
- External adapters live outside domain and application business rules.
- Presentation code depends inward.
- Imports compile.
- Existing tests/builds/lints are preserved or known failures are documented.
