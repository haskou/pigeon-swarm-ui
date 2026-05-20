---
name: ddd-project-migrator
description: Migrate a frontend, backend, or full-stack project to a DDD structure, with strict mode as the default. Enforces ubiquitous language, OO DDD, SOLID dependency injection, and large-file decomposition.
---

# DDD project migrator

Use this skill when the user asks to migrate or restructure an existing project into DDD.

This skill changes code and file structure. Before making changes, inspect the project and produce a concise migration plan.

## Required references

Read these before migrating:

- `references/strict-ddd-structure.md`
- `references/ddd-flavors.md`
- `references/naming-and-ubiquitous-language.md`
- `references/file-decomposition-srp-and-oo-ddd.md`
- `references/migration-playbook.md`

## Flavor prompt

If the user has not explicitly chosen a flavor, ask which flavor to use and show examples. Recommend `strict`.

The prompt must include these options:

```txt
strict, recommended:
src/modules/<module>/
  domain/
  application/
  infrastructure/
  presentation/

frontend-feature:
src/features/<feature>/
  domain/
  application/
  infrastructure/
  presentation/

backend-module:
src/modules/<module>/
  domain/
  application/
  infrastructure/
  presentation/

fullstack-split:
src/backend/modules/<module>/...
src/frontend/modules/<module>/...

custom:
User-defined structure with DDD dependency direction preserved.
```

If the user says to choose, choose `strict`.

## Canonical target

The default target is:

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

For frontend projects, the same layers still apply. Presentation may contain pages, components, hooks, forms, stores, and view models if those are the actual delivery mechanism.

## Mandatory migration rules

### Ubiquitous language

Use business terms from the project. Do not create generic modules like `utils`, `services`, `data`, `common`, or `helpers` unless the domain truly uses those terms.

### Naming

- Files: `lowerCamelCase`.
- Folders: `kebab-case`.
- Classes and types: `PascalCase`.
- Variables, functions, methods, and properties: `lowerCamelCase`.
- Constants: `SCREAMING_SNAKE_CASE` only when they are true constants.

### Large files and mixed files

During migration, explicitly inspect files that are large or mixed. Do not leave a large mixed file intact.

Split this:

```txt
example.ts
```

Into this only when the file is large or mixed enough to justify it:

```txt
example/
  index.ts
  example.ts
  example.types.ts
  example.constants.ts
  example.helpers.ts
```

Move exported types/interfaces/enums into `.types.ts`. Move exported constants into `.constants.ts`. Create `.helpers.ts` only for genuine helper functions. Keep simple files as simple files.

Do not create this useless wrapper:

```txt
local-temp-file-storage/
  index.ts
  localTempFileStorage.server.ts
```

If there is only one implementation file and no companion files, keep it as:

```txt
localTempFileStorage.server.ts
```

### Single responsibility

A source file should have one primary responsibility. In domain and application layers, prefer one exported class per implementation file. Split files that export many classes.

### OO DDD and SOLID

Do not migrate domain/application behavior into exported function bags. Prefer classes for aggregates, entities, value objects, domain services, use cases, repositories/adapters, and controllers where the framework supports it.

Use cases should usually look like this:

```ts
export class BackupDatabase {
  constructor(private readonly backupRepository: BackupRepository) {}

  async execute(command: BackupDatabaseCommand): Promise<BackupDatabaseResult> {
    // orchestration
  }
}
```

### Dependency injection

Classes in domain/application must not instantiate concrete dependencies as fields or inside constructors. Replace concrete construction with constructor injection and move wiring to a composition root.

Incorrect:

```ts
private readonly botConfigStore = new LowdbBotConfigStore();
private readonly folderRepository = new LowdbFolderRepository();
private readonly backupDatabase = createDatabaseBackupUseCases().backupDatabase;
```

Correct:

```ts
constructor(
  private readonly botConfigStore: BotConfigStore,
  private readonly folderRepository: FolderRepository,
  private readonly backupDatabase: BackupDatabasePort,
) {}
```

Concrete classes may be instantiated in composition roots, infrastructure factories, or framework-required wiring locations.

## Migration process

1. Run or emulate `scripts/analyzeProjectDdd.mjs` to identify candidate modules, large files, mixed files, multi-class files, procedural domain/application files, and DI violations.
2. Produce a migration plan with old path to new path mapping.
3. Split large/mixed files before or during movement.
4. Create strict module/layer folders.
5. Move domain model first, then application use cases, then infrastructure adapters, then presentation delivery code.
6. Convert procedural use cases into classes when they represent business/application behavior.
7. Extract interfaces for repository/service ports.
8. Inject dependencies through constructors.
9. Create composition roots for wiring concrete infrastructure.
10. Update imports.
11. Run tests/typecheck/lint and the enforcer validator.
12. Report remaining violations.

## Never do this

- Do not create folders just to hold one file plus a useless `index.ts`.
- Do not dump all constants into one module-wide constants file.
- Do not dump all types into one module-wide types file.
- Do not put infrastructure imports in domain.
- Do not put direct concrete infrastructure construction inside use cases.
- Do not leave large files with many public classes after migration.
- Do not convert every function to a class blindly. Presentation hooks, framework handlers, pure helpers, and mappers can remain functions when appropriate.
