# Canonical DDD module template

```text
src/
  modules/
    <module>/
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

Use the listed subfolders when the responsibility exists. Do not add empty folders just to satisfy the template unless the user asked for scaffolding.
