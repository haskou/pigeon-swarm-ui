# Large-file decomposition, SRP, and OO DDD rules

Use these rules whenever analyzing, migrating, or enforcing a project.

## Keep simple files simple

Do not wrap every small file in a folder. A cohesive 30-line file should usually remain a simple file.

Use a decomposition folder only when at least one of these is true:

1. The file is large enough to make navigation difficult.
2. The file contains multiple exported classes or distinct responsibilities.
3. The file mixes implementation, exported types, exported constants, and helpers.
4. The file contains server-only code plus code that could be shared with client code.
5. The file has enough collaborators that extracting types/constants/helpers improves clarity.

Default thresholds:

- Candidate large file: more than 250 lines or more than 20 KB.
- Strong split candidate: more than 350 lines, more than 30 KB, more than one exported class, or mixed exported classes/types/constants/functions.

## Decomposition folder pattern

For a large or mixed-responsibility source file named `example.ts`, prefer:

```txt
example/
  index.ts
  example.ts
  example.types.ts
  example.constants.ts
  example.helpers.ts
```

Rules:

- Folder name: `kebab-case`.
- Main implementation file: exactly matches the primary public export when the file has a single public export.
- Types: `<concept>.types.ts`.
- Constants: `<concept>.constants.ts`.
- Helpers: `<concept>.helpers.ts`, only when necessary.
- Server-only unit: `<concept>.server.ts`.
- Do not create `.helpers.ts`, `.types.ts`, or `.constants.ts` files unless content exists for them.
- `index.ts` is useful only when the folder contains the main implementation plus additional companion files or when the folder is a stable public module boundary.

Multiword concept example:

```txt
local-temp-file-storage/
  localTempFileStorage.server.ts
```

The example above must not have `index.ts` if it only contains that one implementation file.

If there are companion files, then `index.ts` is useful:

```txt
local-temp-file-storage/
  index.ts
  localTempFileStorage.server.ts
  localTempFileStorage.types.ts
  localTempFileStorage.constants.ts
```

`index.ts` should export the public API of the folder. It should not exist merely to re-export one file from a one-file folder.

## Split types and constants deterministically

When a file contains implementation plus exported type/interface/enum declarations, move those declarations to `<concept>.types.ts` unless the type is private to the implementation and should not be exported.

When a file contains exported domain or application constants, move them to `<concept>.constants.ts` unless the constant is a private local detail.

When a file contains multiple unrelated constants or configuration maps, split by concept. Do not put all constants for a whole module into one dumping-ground file.

Correct:

```txt
backup/
  index.ts
  backup.ts
  backup.types.ts
  backup.constants.ts
```

Incorrect:

```txt
backup.ts // contains class Backup, BackupOptions, BackupResult, MAX_BACKUP_SIZE, BACKUP_FORMATS, helpers, and adapter code
```

## Single responsibility and class-per-file rule

A file should have one primary responsibility.

In domain and application layers:

- Prefer one public class per implementation file.
- Do not place many exported classes in the same file.
- Do not create class bags, function bags, or catch-all services.
- If a file exports multiple classes, split them unless the secondary class is an intentionally private implementation detail.

Example:

```txt
application/use-cases/backup-database/
  index.ts
  backupDatabase.ts
  backupDatabase.types.ts
```

```ts
export class BackupDatabase {
  constructor(private readonly backupRepository: BackupRepository) {}

  async execute(command: BackupDatabaseCommand): Promise<BackupDatabaseResult> {
    // orchestration here
  }
}
```

## OO and SOLID guidance

DDD domain and application code should not default to exported procedural functions.

Prefer classes for:

- Aggregates and aggregate roots.
- Entities.
- Value objects.
- Domain services.
- Application use cases.
- Repository implementations.
- Infrastructure adapters.
- Controllers and resolvers when the framework supports classes.

Prefer interfaces for:

- Repository ports.
- External service ports.
- Stores/gateways used by application use cases.

Allowed exported functions:

- Pure helper functions in `.helpers.ts`.
- Factory functions when they are intentionally part of the ubiquitous language.
- Framework-required handlers such as SvelteKit `load`, `actions`, `GET`, `POST`, or route handlers.
- React/Svelte/Vue components and hooks in presentation code.
- Small mappers when placed in infrastructure or presentation and named clearly.

Flag exported function bags in `domain` and `application`. Convert them to classes when they represent behavior, orchestration, policy, or use cases.

## Dependency injection rule

Classes must not instantiate their own dependencies as property initializers or inside constructors unless the dependency is a simple value object or language primitive.

Incorrect:

```ts
export class BackupDatabase {
  private readonly botConfigStore = new LowdbBotConfigStore();
  private readonly folderRepository = new LowdbFolderRepository();
  private readonly thumbnailStore = new LocalThumbnailStore();
  private readonly backupDatabase =
    createDatabaseBackupUseCases().backupDatabase;
}
```

Correct:

```ts
export class BackupDatabase {
  constructor(
    private readonly botConfigStore: BotConfigStore,
    private readonly folderRepository: FolderRepository,
    private readonly thumbnailStore: ThumbnailStore,
    private readonly backupDatabase: BackupDatabasePort,
  ) {}
}
```

Composition roots may instantiate concrete dependencies. Application and domain classes should receive dependencies through constructors.

Valid composition-root locations include:

```txt
src/app/container.ts
src/app/composition-root.ts
src/modules/<module>/infrastructure/composition/
src/modules/<module>/presentation/routes/ // when the framework requires route-local wiring
```

## Avoid useless folder wrappers

Do not convert this:

```txt
localTempFileStorage.server.ts
```

Into this:

```txt
local-temp-file-storage/
  index.ts
  localTempFileStorage.server.ts
```

That folder adds no value. Create the folder only if there are companion files, for example types/constants/helpers/tests, or if the folder is a deliberate public module boundary.
