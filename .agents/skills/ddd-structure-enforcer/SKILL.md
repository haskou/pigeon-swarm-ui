---
name: ddd-structure-enforcer
description: Validate, enforce, and repair a DDD/Clean/Hexagonal project structure for frontend, backend, or full-stack web software. Use when the user asks to check architecture, validate DDD boundaries, enforce layers, review module structure, detect dependency violations, or align an existing DDD-like structure to a chosen flavor.
---

# DDD Structure Enforcer

Use `ddd-codebase-architect` when the user asks for architectural discovery, bounded-context analysis, or tactical DDD mapping before any enforcement. Use this enforcement skill when there is already a structure to validate or normalize.

Use this skill when the user wants to validate, enforce, or repair a DDD-style structure in a web project.

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

Validate this layout as the default target unless the user selected another flavor. Treat missing top-level layers as stronger issues than missing inner subfolders. Inner subfolders should be checked as recommended structure, not as mandatory evidence that the project is broken.

This skill is not primarily a migration skill. Use it to inspect the implemented structure, report violations, propose fixes, and make focused changes when requested.

## Naming conventions and ubiquitous language

Validate these conventions as architecture rules:

```text
Files: lowerCamelCase, for example order.ts, orderRepository.ts, placeOrder.ts
Folders: kebab-case, for example value-objects, use-cases, domain-services
Classes and types: PascalCase, for example Order, Money, PlaceOrder
Variables and functions: lowerCamelCase, for example orderTotal, placeOrder
Constants: SCREAMING_SNAKE_CASE only for true constants, for example MAX_ORDER_ITEMS
```

Ubiquitous language is the highest-priority naming rule. A structurally valid DDD project is still weak if its modules and objects are named with generic technical words instead of the domain vocabulary. Validate that module names, aggregate names, value objects, use cases, events, repository ports, adapters, and presentation files use business language found in routes, UI copy, APIs, tests, domain events, and workflows.

Use `references/naming-and-ubiquitous-language.md` as the canonical naming reference.

## Required first step

Inspect the repository before making changes. Determine:

1. Whether the project is frontend, backend, or full-stack.
2. Whether the project already has a DDD-like structure.
3. Which flavor it appears to follow.
4. Whether dependency direction is respected.
5. Which checks are available: typecheck, lint, tests, build.
6. Whether files, folders, symbols, variables, and constants follow the naming convention.
7. Whether module and tactical DDD names use ubiquitous language instead of generic technical vocabulary.

A structure is DDD-like when business capabilities are grouped into modules/features and at least two of these layer concepts are visible inside them:

- `domain`
- `application`
- `infrastructure`
- `presentation`
- `api`
- `ui`
- `adapters`
- `delivery`
- `use-cases`

## If the project already has DDD-like structure

If the project is DDD-like but differs from the canonical `src/modules/<context>` structure, ask whether the user wants to:

```text
Choose how to enforce or normalize the DDD structure:

1. keep-current
   Keep the detected structure and only enforce dependency rules.

2. strict (recommended for both frontend and backend)
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

3. frontend-feature
   src/
     features/
       orders/
         domain/
         application/
         api/
         ui/

4. backend-module
   src/
     modules/
       orders/
         domain/
         application/
         infrastructure/
         presentation/

5. fullstack-split
   apps/
     web/
       src/modules/orders/{domain,application,infrastructure,presentation}
     api/
       src/modules/orders/{domain,application,infrastructure,presentation}

6. custom
   Preserve current naming but map it to domain/application/infrastructure/presentation responsibilities.
```

Do not rename or move an already DDD-like project into a different flavor without that choice.

## If the project does not have DDD-like structure

Report that the project does not currently follow a DDD-like structure. Ask whether the user wants to migrate it using the `ddd-project-migrator` skill and which flavor they prefer. Show the same flavor examples above.

If the user asks you to proceed without choosing, recommend a default:

- Frontend-only: `strict`.
- Backend-only: `strict` or `backend-module`.
- Full-stack/monorepo: `fullstack-split`.
- Unknown: `strict`.

Prefer `strict` unless the existing repository already clearly follows another DDD-like flavor.

## Validation rules

### Business-first grouping

Passes when source code is grouped by business capability:

```text
src/modules/orders/...
src/modules/billing/...
src/modules/users/...
```

Warns when the project uses another DDD-like but non-canonical container:

```text
src/features/auth/...
src/domains/orders/...
```

Fails or warns when most source code is grouped only by technical type:

```text
src/controllers
src/services
src/models
src/repositories
src/components
src/hooks
```

Technical folders are acceptable inside a business module when they do not replace the business grouping.

### Required layer concepts

For `strict` and `backend-module`, each substantial module should contain:

```text
domain
application
infrastructure
presentation
```

For `strict`, the canonical inner subfolders are:

```text
domain/entities
domain/value-objects
domain/aggregates
domain/domain-services
domain/events
domain/repositories
application/commands
application/queries
application/use-cases
application/dto
infrastructure/prisma
infrastructure/postgres
infrastructure/redis
infrastructure/email
infrastructure/http
presentation/controllers
presentation/routes
presentation/graphql
presentation/rest
```

Treat missing inner subfolders as warnings or suggestions unless the user requested scaffolding or strict folder enforcement. Do not create unused adapter folders unless the user wants a complete scaffold.

For `frontend-feature`, each substantial feature should contain:

```text
domain
application
api
ui
```

For `fullstack-split`, validate each app/package separately with the canonical module layout:

```text
apps/web/src/modules/<context>/{domain,application,infrastructure,presentation}
apps/api/src/modules/<context>/{domain,application,infrastructure,presentation}
```

Small modules may omit a layer if there is genuinely no code for that responsibility. Treat omissions as warnings unless the user requested strict enforcement.

### Dependency direction

Allowed direction:

```text
presentation -> application -> domain
infrastructure -> application/domain ports
```

For `frontend-feature`:

```text
ui -> application -> domain
api -> application/domain ports
```

Forbidden examples:

- `domain` imports `application`.
- `domain` imports `infrastructure`, `api`, `presentation`, or `ui`.
- `domain` imports framework, ORM, database, HTTP client, browser, route, controller, analytics, or SDK packages.
- `application` imports `presentation` or `ui`.
- `application` imports concrete infrastructure adapters unless the project has explicitly chosen that compromise.
- Cross-module imports bypass public use cases or explicit contracts.

### Shared folder rule

`shared` should contain genuine cross-cutting primitives, not feature-specific business logic.

Acceptable examples:

```text
shared/domain/entity.ts
shared/domain/result.ts
shared/infrastructure/httpClient.ts
shared/ui/button.tsx
```

Suspicious examples:

```text
shared/domain/user.ts
shared/services/orderService.ts
shared/models/product.ts
shared/utils/calculateSubscriptionRenewal.ts
```

### Naming and ubiquitous language rule

Use business language for modules and use cases. Prefer `orders`, `billing`, `checkout`, `users`, `auth`, or project-specific terms over generic names like `services`, `models`, `data`, or `logic`.

Check naming conventions:

```text
Files: lowerCamelCase
Folders: kebab-case
Classes and types: PascalCase
Variables and functions: lowerCamelCase
Constants: SCREAMING_SNAKE_CASE only when necessary
```

Report `PascalCase` filenames such as `Order.ts` as warnings and recommend `order.ts` while keeping the exported `Order` type/class. Report non-kebab-case folders as warnings. Report generic names as architecture warnings when a clearer domain term is visible.

Do not force renames that would break public contracts, persistence names, API paths, route URLs, or user-facing copy. When a rename crosses those boundaries, propose it separately and explain the migration risk.

## Enforcement workflow

Follow this workflow:

1. Inspect the repository tree and representative files.
2. Detect the apparent DDD flavor, if any.
3. Run the helper validator if available and useful.
4. Produce an architecture report with pass/warn/fail items, including naming and ubiquitous-language issues.
5. If the user asked for changes, apply small, focused repairs.
6. Update imports safely.
7. Run available checks.
8. Report what changed and what still needs attention.

Do not perform a whole-project migration unless the user explicitly asks for enforcement plus repair or migration. If migration is required, invoke or follow the `ddd-project-migrator` workflow.

## Optional helper script

This skill includes `scripts/validate-ddd-structure.mjs`. Run it from the repository root:

```bash
node .agents/skills/ddd-structure-enforcer/scripts/validate-ddd-structure.mjs --root . --flavor auto
```

Useful options:

```bash
node .agents/skills/ddd-structure-enforcer/scripts/validate-ddd-structure.mjs --root . --flavor strict
node .agents/skills/ddd-structure-enforcer/scripts/validate-ddd-structure.mjs --root . --flavor backend-module --fail-on-warn
node .agents/skills/ddd-structure-enforcer/scripts/validate-ddd-structure.mjs --root . --flavor frontend-feature
node .agents/skills/ddd-structure-enforcer/scripts/validate-ddd-structure.mjs --root . --format text
node .agents/skills/ddd-structure-enforcer/scripts/validate-ddd-structure.mjs --root . --format json
```

The script is intentionally conservative. Treat its output as a checklist, then read the code to confirm.

## Report format

Use this structure for reports:

```text
DDD structure report

Detected project type: frontend | backend | full-stack | unknown
Detected flavor: strict | frontend-feature | backend-module | fullstack-split | custom | none
Recommended action: keep | enforce | normalize | migrate
Canonical target: src/modules/<context>/{domain,application,infrastructure,presentation}
Naming convention: files lowerCamelCase; folders kebab-case; classes/types PascalCase; variables lowerCamelCase; constants SCREAMING_SNAKE_CASE when necessary

Pass
- ...

Warn
- ...

Fail
- ...

Suggested fixes
- ...

Checks run
- command: result
```

## Done criteria

Validation or enforcement is done when:

- The current or target DDD flavor is explicit.
- The canonical target is considered first unless the user chose another flavor.
- Violations are listed with file paths.
- Domain purity has been checked.
- Application dependency direction has been checked.
- Business-first module grouping has been checked.
- Recommended inner subfolders are checked where applicable.
- Naming conventions and obvious ubiquitous-language violations are checked.
- Any applied changes are small and explained.
- Tests/builds/lints are run when available, or skipped with a reason.
