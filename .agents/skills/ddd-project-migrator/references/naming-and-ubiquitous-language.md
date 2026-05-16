# Naming conventions and ubiquitous language

These conventions are part of the DDD boundary rules, not optional formatting.

## Required naming conventions

- Files: `lowerCamelCase`, for example `order.ts`, `orderRepository.ts`, `placeOrder.ts`, `orderController.ts`.
- Folders: `kebab-case`, for example `value-objects`, `use-cases`, `domain-services`, `browser-storage`.
- Classes and types: `PascalCase`, for example `Order`, `Money`, `PlaceOrder`, `OrderRepository`.
- Variables and function names: `lowerCamelCase`, for example `orderTotal`, `placeOrder`, `currentUser`.
- Constants: `SCREAMING_SNAKE_CASE` only when the value is a true constant, for example `MAX_ORDER_ITEMS`.

Do not use `PascalCase` filenames even when the file exports a `PascalCase` class or type. A file exporting `Order` should be named `order.ts`; a file exporting `PlaceOrder` should be named `placeOrder.ts`.

## Ubiquitous language is the primary rule

Prefer the project and business vocabulary over generic programming vocabulary. Module names, aggregate names, value objects, commands, queries, use cases, events, DTOs, repository ports, adapters, and presentation names should express the language used by the product and domain.

Good names come from routes, API paths, UI labels, database concepts, test descriptions, event names, workflow names, and repeated business terms in the code.

Avoid generic names when a business term exists:

```text
Bad: src/modules/data/
Good: src/modules/billing/

Bad: genericService.ts
Good: calculateSubscriptionRenewal.ts

Bad: item.ts when the business calls it line item
Good: lineItem.ts

Bad: process.ts
Good: capturePayment.ts
```

When names conflict, keep a visible glossary and use the term with the strongest public/domain evidence. Do not rename concepts casually. If a rename affects public API, persistence, user-facing copy, or external contracts, report it separately before making the change.

## Deterministic naming decisions

Resolve naming conflicts in this order:

1. Public product language and user-facing UI labels.
2. API route, GraphQL, command, or event language.
3. Domain test descriptions and business rules.
4. Existing module, package, or folder names.
5. Database table/model names.
6. Internal implementation names.

If evidence is weak, keep the current name and mark the alternative as a candidate instead of renaming it.
