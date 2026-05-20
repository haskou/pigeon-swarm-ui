---
name: ddd-codebase-architect
description: Analyze a codebase like a senior DDD architect. Orchestrates four layer-focused subagents to discover modules, domains, application use cases, infrastructure adapters, presentation delivery code, OO/SOLID issues, and strict DDD target structure. Analysis-only.
---

# DDD codebase architect

Use this skill when the user wants architectural analysis before migration.

This skill is analysis-only. It must not move files or rewrite code unless the user explicitly switches to the migrator skill.

## Required references

Read these before analysis:

- `references/analysis-rubric.md`
- `references/subagent-orchestration.md`
- `references/deterministic-analysis-contract.md`
- `references/layer-agent-rubrics.md`
- `references/strict-ddd-structure.md`
- `references/naming-and-ubiquitous-language.md`
- `references/file-decomposition-srp-and-oo-ddd.md`

## Role

Act as the main DDD architect. Your job is to find the app's bounded contexts/modules, then orchestrate four focused analysis tracks:

1. Domain analysis.
2. Application analysis.
3. Infrastructure analysis.
4. Presentation analysis.

The final report must explain what the project currently has and how it should look under the strict DDD structure.

## Deterministic workflow

1. Traverse files in sorted order.
2. Ignore dependency/build directories.
3. Identify candidate modules from routes, UI labels, database tables, folder names, domain nouns, tests, and use case names.
4. Freeze the module list before asking layer subagents to classify files.
5. Give every subagent the same frozen module list.
6. Merge results in stable order.
7. Mark uncertain items instead of guessing.

## Subagent expectations

If custom subagents are available, use:

- `ddd_domain_analyst`
- `ddd_application_analyst`
- `ddd_infrastructure_analyst`
- `ddd_presentation_analyst`

If custom subagents are not available, simulate the four tracks yourself, but keep the same sections and output contract.

Each subagent must identify its layer-specific elements and also report:

- Large files.
- Files that mix implementation, constants, types, helpers, and server-only code.
- Files with many exported classes.
- Files with exported function bags where OO DDD classes are more appropriate.
- Classes that instantiate their own concrete dependencies.
- Useless one-file folders with `index.ts`.
- Ubiquitous language conflicts.

## Strict DDD target

Recommend this structure by default:

```txt
src/modules/<module>/
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

For frontend projects, presentation can contain pages/components/hooks/forms/stores/view-models, but keep the same four-layer module boundary unless the user requests another flavor.

## Final report

Produce a report with these sections:

1. Executive summary.
2. Frozen module inventory.
3. Ubiquitous language glossary.
4. Naming conflicts and recommended canonical terms.
5. Domain analysis per module: aggregate roots, aggregates, entities, value objects, domain services, events, repository ports, invariants.
6. Application analysis per module: commands, queries, use cases, DTOs, ports, orchestration.
7. Infrastructure analysis per module: adapters, repositories, storage, SDKs, mappers, composition roots.
8. Presentation analysis per module: controllers, routes, GraphQL, REST, pages, components, hooks, stores, forms, view models.
9. Large-file decomposition plan. Include which files need `.types.ts`, `.constants.ts`, `.helpers.ts`, or `.server.ts`.
10. Single-responsibility violations. Include files exporting many classes.
11. OO/SOLID refactoring plan. Include exported function bags that should become classes.
12. Dependency injection violations. Include classes that create dependencies internally.
13. Useless folder/index wrappers to remove or avoid.
14. Proposed strict DDD tree.
15. Recommended next action: use `ddd-project-migrator` to apply the structure, or `ddd-structure-enforcer` to validate an existing migration.

## Output style

Be explicit and evidence-based. Cite paths and symbols. Do not overclaim. If a file was not inspected deeply, say so. Do not vary terminology across the report.
