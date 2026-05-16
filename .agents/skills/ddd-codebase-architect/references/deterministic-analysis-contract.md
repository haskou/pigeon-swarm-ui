# Deterministic DDD analysis contract

This reference makes the architecture analysis as repeatable as possible.

## Stable processing order

Use this order every time:

1. Read config and package files.
2. Read routing, API, and entrypoint files.
3. Read schema, ORM, migration, and generated client boundaries.
4. Read current module/feature/domain folders.
5. Read technical buckets such as `services`, `models`, `api`, `components`, `hooks`, `stores`, `utils`, `lib`, and `shared`.
6. Read tests that describe business behavior.

Within every group, sort paths alphabetically.

## Module naming

Normalize module names to lower-kebab-case.

Apply the naming convention consistently: files lowerCamelCase, folders kebab-case, classes/types PascalCase, variables lowerCamelCase, constants SCREAMING_SNAKE_CASE when necessary.

Tie-breakers:

1. Public route/API namespace.
2. Existing business folder name under `modules`, `features`, `domains`, `contexts`, `packages`, or `apps`.
3. Database or schema concept used across multiple files.
4. UI flow label or page group.
5. Most common noun in use cases, commands, tests, or event names.

Avoid using technical buckets as module names.

Treat ubiquitous language as the tie-breaker for all tactical DDD names. Preserve the term with the strongest public/domain evidence and list weaker alternatives instead of inventing a new name.

## Confidence labels

Use `high` confidence only when at least two independent evidence types agree, such as route namespace plus use cases, or database schema plus controller/page flow.

Use `medium` confidence when there is one strong evidence type, or when file names and symbols agree but behavior has not been inspected deeply.

Use `low` confidence when the item is inferred from names, isolated files, or weak references.

Do not mark low-confidence items as final architecture. Mark them as candidates.

## Tactical DDD classification

Classify by responsibility, not by current path.

An aggregate root needs evidence of identity, lifecycle, consistency boundary, invariant enforcement, or repository loading/saving. A name ending with `Model`, `Entity`, or `Record` is not enough.

A value object needs evidence of equality by value, immutability, validation, normalization, or domain-specific value behavior. Common primitive wrappers like `Email`, `Money`, `DateRange`, and `Quantity` are candidates only when code confirms validation or behavior.

A use case needs evidence of orchestration for one user/system action. A generic service method is not automatically a use case.

A repository port is an interface or abstraction used by domain/application. A concrete class using Prisma, Postgres, fetch, Redis, or external SDKs is infrastructure.

A presentation element is a delivery adapter. If it makes domain decisions, classify the file as presentation with misplaced domain/application responsibility.

## Final report ordering

Order the final report by:

1. Project classification.
2. Module inventory, alphabetically by module name.
3. Subagent findings in this order: domain, application, infrastructure, presentation.
4. Tactical maps alphabetically by module.
5. Proposed tree alphabetically by module.
6. Risks by severity, then path.

Do not vary output order based on discovery order, random sampling, or subjective importance unless the user explicitly requests prioritization.
