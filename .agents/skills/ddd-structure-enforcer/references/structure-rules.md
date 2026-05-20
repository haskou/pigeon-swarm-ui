# Enforcer rules

The enforcer validates structure, naming, SRP, large-file decomposition, OO DDD, and dependency direction.

Severity guidance:

- Error: strict structure missing, invalid dependency direction, concrete infrastructure usage inside domain/application, multiple public classes in one file, dependency instantiation inside domain/application classes, or non-DDD module layout when strict mode was requested.
- Warning: large files, files with many exported constants/types not yet split, procedural functions in domain/application, one-file folders with useless `index.ts`, naming inconsistencies, missing recommended subfolders.
- Info: opportunities to improve ubiquitous language, possible context boundaries, possible helper extraction.

When a project already has a DDD-like structure, do not rewrite it silently. Ask whether to keep the current structure or normalize to the strict canonical structure.
