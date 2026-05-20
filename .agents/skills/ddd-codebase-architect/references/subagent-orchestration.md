# Subagent orchestration

The main agent orchestrates analysis in deterministic phases.

## Phase 1, main agent inventory

The main agent scans the project using sorted traversal and freezes a module inventory. Module names must be lower-kebab-case and derived from ubiquitous language.

The main agent must not ask subagents to invent modules independently. Subagents receive the frozen module list and classify code inside or related to those modules.

## Phase 2, four analysis tracks

Run these tracks with the same frozen module inventory:

1. `ddd_domain_analyst`: domain model and tactical DDD analysis.
2. `ddd_application_analyst`: use cases, commands, queries, DTOs, orchestration, application ports.
3. `ddd_infrastructure_analyst`: adapters, repositories, storage, SDKs, external systems, framework and platform integrations.
4. `ddd_presentation_analyst`: delivery mechanisms, routes, controllers, GraphQL, REST, frontend pages/components/hooks/stores.

Each track must also report:

- Large files.
- Files with mixed constants/types/implementation.
- Files exporting many classes or many functions.
- Procedural code that should be class-based under DDD/SOLID.
- Classes that instantiate their own dependencies instead of receiving them through constructors.
- Useless one-file wrappers with `index.ts`.

## Phase 3, main agent merge

The main agent merges reports in stable order:

1. Module name ascending.
2. Layer order: domain, application, infrastructure, presentation.
3. File path ascending.
4. Severity order: error, warning, info.

The main agent must produce:

- Bounded context/module inventory.
- Per-module DDD layer map.
- Tactical DDD element list.
- Ubiquitous language glossary.
- Naming conflicts.
- Large-file decomposition plan.
- OO/SOLID refactoring plan.
- Dependency-injection violations.
- Proposed strict DDD tree.
- Suggested next skill: migrator or enforcer.

## Determinism

Use sorted traversal. Do not use random sampling. Do not vary module names if the same codebase is analyzed repeatedly. When confidence is low, mark `uncertain` instead of guessing.
