# Architecture decisions

## ADR-0001: Contexts own their infrastructure adapters

- Date: 2026-07-11
- Status: accepted
- Context: `src/app/composition` currently contains context-specific HTTP gateways
  and a cross-context API gateway.
- Decision: Move HTTP, cache, crypto, browser and IPFS adapters to the
  infrastructure folder of the context that owns the capability. Keep only
  generic transport in `shared` and dependency wiring in `app/composition`.
- Consequences: Application services depend on context ports/adapters rather than
  `PigeonApiGateway`; compatibility façades are temporary and removed per slice.
- Related slices: `INFRA-001`

## ADR-0002: Resources are boundary shapes, not default domain models

- Date: 2026-07-11
- Status: accepted
- Context: many files under `domain` are `Resource` or DTO-shaped types.
- Decision: Keep immutable resources for query/presentation mapping, but model
  lifecycle, invariants and decisions in aggregates, entities, value objects and
  policies. New domain behavior must not be added to resource types.
- Consequences: Each migration slice introduces a model only when it owns an
  actual rule; read models remain lightweight.
- Related slices: `IDENTITY-001`, `MESSAGE-001`, `COMMUNITY-001`
