---
name: ddd-structure-enforcer
description: Validate and enforce a strict DDD structure, naming conventions, ubiquitous language, large-file decomposition, OO/SOLID use cases, constructor dependency injection, and useful folder/index patterns.
---

# DDD structure enforcer

Use this skill when the user asks to validate, enforce, audit, normalize, or clean up a DDD-like project.

This skill may make changes when the user asks for enforcement. If the user asks only for validation, report issues without modifying files.

## Required references

Read these before validation or enforcement:

- `references/strict-ddd-structure.md`
- `references/structure-rules.md`
- `references/ddd-flavors.md`
- `references/naming-and-ubiquitous-language.md`
- `references/file-decomposition-srp-and-oo-ddd.md`

## Flavor handling

If the project already has a DDD-like structure, ask whether to:

1. Keep current structure and enforce rules within it.
2. Normalize to `strict`, recommended.
3. Normalize to `frontend-feature`.
4. Normalize to `backend-module`.
5. Normalize to `fullstack-split`.
6. Use `custom`.

If the user says to choose, choose `strict`.

Show examples when asking. The strict target is:

```txt
src/modules/<module>/
  domain/
  application/
  infrastructure/
  presentation/
```

## Validation scope

Validate:

- Strict DDD folder layout.
- Required/recommended layer subfolders.
- Folder naming: `kebab-case`.
- File naming: `lowerCamelCase`.
- Class/type naming: `PascalCase`.
- Variables/functions/methods/properties: `lowerCamelCase`.
- Constants: `SCREAMING_SNAKE_CASE` where necessary.
- Ubiquitous language consistency.
- Domain/application dependency purity.
- Large files that should be decomposed.
- Mixed implementation/types/constants/helper files.
- Files exporting many classes.
- Exported function bags in domain/application layers.
- Classes that instantiate their dependencies directly.
- Useless one-file folders containing only `index.ts` plus one implementation file.
- `index.ts` files that re-export only one file without adding a stable public boundary.

## Large-file and split rules

Flag large or mixed files and enforce this pattern when appropriate:

```txt
example/
  index.ts
  example.ts
  example.types.ts
  example.constants.ts
  example.helpers.ts
```

Do not wrap simple files. Do not create `.helpers.ts`, `.types.ts`, or `.constants.ts` unless content exists. Do not create `index.ts` for a folder with only one implementation file.

## OO/SOLID rules

In `domain` and `application`:

- Use classes for aggregates, entities, value objects, domain services, and application use cases.
- Use constructor injection for dependencies.
- Use interfaces for repository and external service ports.
- Do not instantiate concrete infrastructure classes inside domain/application classes.
- Do not leave exported function bags that represent use cases or business behavior.

Allowed functions include helpers in `.helpers.ts`, framework handlers, presentation hooks/components, mappers, and intentional factories.

## Suggested command

Run:

```bash
node .agents/skills/ddd-structure-enforcer/scripts/validateDddStructure.mjs --root . --format markdown
```

Useful thresholds:

```bash
node .agents/skills/ddd-structure-enforcer/scripts/validateDddStructure.mjs --root . --large-file-lines 250 --large-file-bytes 20000
```

## Report

Report errors, warnings, and info grouped by module and layer. Include exact file paths. For every issue, include a concrete fix.

When enforcing, apply small safe changes first: file splits, naming fixes, import updates, dependency-injection refactors, useless index removal, then run tests/typecheck/validator again.
