# DDD migration

## Goal

Turn Pigeon Swarm UI into a context-owned frontend architecture: domain behavior
lives in domain models, workflows live in context application services, and HTTP,
crypto, cache, browser, and IPFS adapters live in the infrastructure of the
context that owns them.

## Scope

- Move context-specific infrastructure out of `src/app/composition`.
- Replace shared resource-shaped domain types with domain models where behavior
  and invariants belong together.
- Keep `src/app` limited to composition, bootstrap, and presentation assembly.
- Preserve public REST, websocket, encrypted payload, and keychain contracts.

## Non-goals

- Rewrite backend contracts.
- Change identity, community, conversation, or attachment wire formats without
  an explicit product requirement.
- Create empty DDD folders or generic abstraction buckets.

## Current architecture summary

The project has useful bounded-context folders and several aggregate/value-object
implementations, but many context-facing concepts are still `Resource` types.
`src/app/composition/PigeonApiGateway.ts` owns HTTP clients, context cache policy,
crypto orchestration, mappers, and workflow behavior from multiple contexts.
Several context-specific gateways also live under `src/app/composition/gateways`.

## Target direction

Each context owns its domain behavior and adapters. Shared HTTP/signing remains
under `src/shared/infrastructure/http`. `src/app/composition` wires concrete
adapters into application services without containing context behavior.

## Active slice

- Id: `INFRA-002`
- Title: Move remaining context-specific gateway seams
- Size: L
- Status: in progress
- Business capability: Context-owned transport, cache, and signing adapters
- Source area: `src/app/composition/PigeonApiGateway*` and remaining
  composition compatibility adapters
- Target boundary: `src/contexts/*/infrastructure/http` and `crypto`
- Target files/folders: real adapters only; no placeholder folders
- Expected files: identities, notifications, attachments, stickers and shared
  request-cache adapters plus composition wiring
- Compatibility constraints: Existing UI/application method contracts remain
  stable while consumers migrate to context ports
- Validation level: L2
- Affected behavior/tests: calls, node networks, presence, push subscriptions,
  identity and message bootstrap
- Tests/checks run: typecheck, lint, targeted moved-adapter tests
- Full-suite status: deferred until the infrastructure milestone closes
- Done criteria: no context-specific HTTP gateway remains in
  `src/app/composition`; the compatibility facade is replaced by context ports

## Risks

- Keychain, invitation, and encrypted-message workflows currently cross
  identity, conversation, community, and message boundaries.
- Cached reads must move with their owning query; moving them without tests can
  regress startup performance.
- Existing `Resource` types are often both external DTO and presentation model.

## Validation strategy

- Default level: L2
- Affected-test selection rule: run adapter/application tests for each migrated
  context plus typecheck and lint
- Milestone/full validation trigger: after `INFRA-001` and before PR handoff
- Known expensive commands: `yarn test`
- Full-suite deferral policy: use only at coherent migration milestones

## Next slices

1. `INFRA-002`: finish context ports and remove the compatibility facade.
2. `IDENTITY-001`: identity/session/keychain lifecycle model and ports.
3. `MESSAGE-001`: message command workflow and message resource mapper seam.
4. `COMMUNITY-001`: community membership/channel aggregate behavior.
