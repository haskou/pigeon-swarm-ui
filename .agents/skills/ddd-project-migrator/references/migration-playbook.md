# Migration playbook

Before moving files, build a ubiquitous-language glossary. Use it to choose module names, use-case names, aggregate names, adapter names, and event names. Apply the naming convention: files lowerCamelCase, folders kebab-case, classes/types PascalCase, variables lowerCamelCase, constants SCREAMING_SNAKE_CASE when necessary.

## Safe sequence

1. Inspect current structure and identify contexts.
2. Choose flavor.
3. Move one context at a time.
4. Start with leaf files that have few imports.
5. Extract domain code from framework or persistence models.
6. Introduce interfaces before concrete adapters when needed.
7. Update imports and path aliases.
8. Run checks after each coherent batch.
9. Report results.

## Mapping guide

| Current name | Likely DDD destination |
| --- | --- |
| models with pure business logic | domain |
| ORM models/schemas | infrastructure |
| services that coordinate use cases | application |
| services that call APIs, DBs, SDKs | infrastructure/api |
| controllers/routes/resolvers | presentation |
| pages/components/hooks | ui/presentation |
| stores for UI state | ui/presentation |
| repositories interfaces | domain or application ports |
| repository implementations | infrastructure/api |
| validators for HTTP/form input | presentation/ui |
| value objects | domain |
| DTOs for use cases | application |
| request/response DTOs | presentation |

## Commit sizing

Prefer small batches:

- Scaffold target folders.
- Migrate one bounded context.
- Fix imports.
- Run tests.
- Repeat.

Avoid mixing unrelated cleanups with the structural migration.
