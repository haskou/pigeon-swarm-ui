# Migration playbook

1. Analyze the existing project before moving files.
2. Ask the user which flavor to use unless the user has already selected one.
3. Default recommendation is `strict`.
4. Build a migration map from old paths to new paths.
5. Migrate one bounded context at a time.
6. Preserve behavior. Do not rewrite business logic unless required by the requested architecture change.
7. Split large files and mixed-responsibility files using the decomposition rules.
8. Extract exported types to `.types.ts` and exported constants to `.constants.ts` before moving files if the current file mixes concerns.
9. Convert procedural domain/application use cases to OO classes when they represent behavior or orchestration.
10. Replace direct dependency construction inside domain/application classes with constructor injection.
11. Update imports after moves.
12. Run tests, type checks, linters, and the validation script if available.
13. Report every skipped or ambiguous migration item explicitly.

Do not make broad renames that break ubiquitous language. If terminology is unclear, propose the canonical term and continue with the safest local migration.
