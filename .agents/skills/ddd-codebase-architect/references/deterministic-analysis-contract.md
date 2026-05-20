# Deterministic analysis contract

The skill cannot guarantee mathematical determinism from a model, but it must make the workflow as stable as possible.

Rules:

1. Traverse files in lexicographic path order.
2. Ignore dependency/build directories consistently.
3. Freeze the module list before layer analysis.
4. Use fixed confidence levels: `high`, `medium`, `low`, `uncertain`.
5. Do not rename modules based on style preference alone.
6. Prefer ubiquitous language terms already present in the code, routes, UI labels, database tables, and test names.
7. Use stable output ordering.
8. If two classifications are plausible, state both and choose the safer one with a confidence score.
9. Do not make migrations in the architect skill.
