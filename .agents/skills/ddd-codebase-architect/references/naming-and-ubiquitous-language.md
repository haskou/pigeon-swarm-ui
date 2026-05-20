# Naming and ubiquitous language

These conventions are mandatory unless the project has a documented language-specific exception.

## Names

- Files: exactly match the primary public export when a file has a single public export, including casing.
- Folders: `kebab-case`.
- Classes and types: `PascalCase`.
- Variables, functions, methods, and properties: `lowerCamelCase`.
- Constants: `SCREAMING_SNAKE_CASE` only when they are true constants. Local immutable values and ordinary configuration fields should still use `lowerCamelCase`.

Examples:

```txt
src/modules/order/domain/aggregates/order/order.ts
src/modules/order/domain/aggregates/order/order.types.ts
src/modules/order/domain/value-objects/money.ts
src/modules/order/application/use-cases/placeOrder.ts
src/modules/order/infrastructure/postgres/postgresOrderRepository.ts
src/modules/order/presentation/controllers/orderController.ts
```

Inside those files:

```ts
export class Order {}
export type OrderSnapshot = {};
export interface OrderRepository {}
export class PlaceOrder {}
export class PostgresOrderRepository implements OrderRepository {}
```

## Ubiquitous language

Ubiquitous language is more important than cosmetic naming. Names must come from the business domain, not from technical implementation or arbitrary CRUD naming.

Prefer:

```txt
order
subscription
invoice
payment-method
folder
thumbnail
backup
```

Avoid generic module names unless the product domain actually uses those words:

```txt
models
services
helpers
utils
managers
data
common
misc
stuff
handlers
```

If the code uses different names for the same concept, identify the conflict and choose one canonical term. Preserve the chosen term across modules, file names, class names, method names, DTO names, ports, adapters, tests, and user-facing route/controller names where applicable.

Do not rename blindly. When a term is ambiguous, explain the ambiguity and propose the safest canonical term before changing code.
