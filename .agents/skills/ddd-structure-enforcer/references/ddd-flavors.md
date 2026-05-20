# DDD flavors

Always show these options when asking the user which flavor to use. The recommended default is `strict`.

## strict, recommended default

Best for backend, frontend, and full-stack apps that should share one consistent DDD shape.

```txt
src/
  modules/
    order/
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

## frontend-feature

Acceptable for frontend teams that prefer feature wording while preserving DDD internals.

```txt
src/
  features/
    order/
      domain/
      application/
      infrastructure/
      presentation/
```

## backend-module

Acceptable for backend-only apps that already use modules.

```txt
src/
  modules/
    order/
      domain/
      application/
      infrastructure/
      presentation/
```

## fullstack-split

Acceptable when frontend and backend are separate runtime roots.

```txt
src/
  backend/
    modules/
      order/
        domain/
        application/
        infrastructure/
        presentation/
  frontend/
    modules/
      order/
        domain/
        application/
        infrastructure/
        presentation/
```

## custom

Use only when the user gives a project-specific structure. Preserve the DDD dependency direction and naming rules.
