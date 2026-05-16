# DDD subagent orchestration

This reference defines how the main `ddd-codebase-architect` skill should delegate work to subagents.

## Main agent responsibilities

The main agent owns the full workflow. It must:

1. Inspect the project and run the deterministic scan script when useful.
2. Build a frozen module inventory.
3. Pass the same module inventory to all subagents.
4. Ensure subagents analyze only their assigned layer.
5. Merge the reports into one coherent architecture.
6. Explain conflicts, uncertainty, and recommended next steps.

The main agent must not let subagents redefine the architecture independently. Subagents can suggest missing or split modules, but those suggestions must be reported as candidates.

## Subagent prompts

Use custom agents when available:

- `ddd_domain_analyst`
- `ddd_application_analyst`
- `ddd_infrastructure_analyst`
- `ddd_presentation_analyst`

If unavailable, spawn built-in `explorer` subagents with the exact role instructions below.

All subagent prompts must include:

- Project root.
- Project kind.
- Frozen module list.
- Evidence paths for each module.
- Read-only instruction.
- Deterministic output contract.
- Naming convention and ubiquitous-language requirements.
- A warning not to migrate, rename, or edit files.

## Domain analyst prompt template

Analyze only the domain layer for the frozen module list. For each module, identify aggregate roots, aggregates, entities, value objects, domain services, events, repository ports, invariants, ubiquitous language terms, and domain logic currently misplaced outside domain. Use direct code evidence. Do not treat ORM models, DTOs, or database tables as domain objects unless behavior or invariants prove it. Return the structured output schema.

## Application analyst prompt template

Analyze only the application layer for the frozen module list. For each module, identify commands, queries, use cases, DTOs, application services or handlers, transaction boundaries, application ports, and orchestration currently misplaced in presentation, infrastructure, or technical services. Use direct code evidence. Return the structured output schema.

## Infrastructure analyst prompt template

Analyze only the infrastructure layer for the frozen module list. For each module, identify concrete repository implementations, ORM/persistence adapters, Redis/cache adapters, email adapters, HTTP/API clients, payment gateways, queue/storage/auth/analytics adapters, mappers, generated clients, and business logic hidden inside adapters. Use direct code evidence. Return the structured output schema.

## Presentation analyst prompt template

Analyze only the presentation layer for the frozen module list. For each module, identify controllers, routes, REST handlers, GraphQL resolvers, frontend pages, components, hooks, stores, forms, view models, request/response formatting, and business/application logic misplaced in presentation. Use direct code evidence. Return the structured output schema.

## Required subagent output

Every subagent must return:

```json
{
  "agent_role": "domain|application|infrastructure|presentation",
  "analyzed_modules": [
    {
      "module": "lower-kebab-case-name",
      "confidence": "high|medium|low",
      "summary": "one-paragraph responsibility summary for this layer",
      "ubiquitous_language_terms": ["accepted business terms used by this layer"],
      "elements": [
        {
          "kind": "aggregate-root|aggregate|entity|value-object|domain-service|domain-event|repository-port|command|query|use-case|dto|application-port|repository-implementation|external-adapter|mapper|controller|route|resolver|page|component|hook|store|form|view-model|formatter|other",
          "name": "symbol or file name",
          "target_path": "suggested strict DDD path",
          "current_paths": ["path/from/root"],
          "evidence": "why this classification is justified",
          "confidence": "high|medium|low"
        }
      ],
      "misplaced_responsibilities": [
        {
          "current_path": "path/from/root",
          "issue": "specific misplaced responsibility",
          "recommended_layer": "domain|application|infrastructure|presentation",
          "confidence": "high|medium|low"
        }
      ],
      "open_questions": ["question only if it materially affects classification"]
    }
  ],
  "new_module_candidates": [
    {
      "name": "candidate-module",
      "evidence": ["path/from/root"],
      "reason": "why this may deserve a separate module",
      "confidence": "high|medium|low"
    }
  ],
  "global_risks": ["cross-module or cross-layer risk"]
}
```

The final main-agent report may be markdown, but subagent outputs should use this structured shape so they can be merged consistently.

All proposed target paths must use kebab-case folders and lowerCamelCase filenames. All proposed class/type names in the evidence or element names should use PascalCase when they represent types/classes. Prefer ubiquitous business language over generic words.
