# DDD Architecture Analysis

## Project classification

## Ubiquitous language glossary

| Context | Accepted term | Evidence | Rejected/alternate terms | Reason |
| --- | --- | --- | --- | --- |

## Main agent module inventory

| Module | Responsibility | Evidence | Confidence |
| --- | --- | --- | --- |

## Subagent findings summary

| Subagent | Scope | Key findings | Conflicts or gaps |
| --- | --- | --- | --- |

## Tactical DDD map

### <module>

#### Domain
- Aggregate roots:
- Aggregates:
- Entities:
- Value objects:
- Domain services:
- Domain events:
- Repository ports:
- Invariants:
- Misplaced domain logic:

#### Application
- Commands:
- Queries:
- Use cases:
- DTOs:
- Application ports:
- Misplaced application logic:

#### Infrastructure
- Repository implementations:
- External adapters:
- Mappers/serializers:
- Infrastructure risks:

#### Presentation
- Delivery files:
- Request/response/view models:
- Presentation risks:

## Proposed strict structure

```text
src/modules/...
```

## Misplaced responsibilities and dependency risks

## Migration readiness

## Recommended next step
