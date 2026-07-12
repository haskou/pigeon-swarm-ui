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
- Keep automated tests under `src/test`, mirroring their bounded context and
  layer.
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

- Id: `APPLICATION-011`
- Title: Replace compatibility aggregators with explicit application use cases
- Size: L
- Status: in progress
- Business capability: Context-owned application workflows and transport
- Source area: `src/app/composition/PigeonApiGateway.ts`
- Target boundary: context application services and context infrastructure
  adapters
- Target files/folders: `contexts/*/application` and their owning
  `infrastructure/http` or `crypto` modules
- Compatibility constraints: REST, websocket, encrypted payload, and existing
  presentation APIs remain stable while callers migrate by capability
- Validation level: L2
- Affected behavior/tests: application bootstrap, messages, conversations,
  communities, identities, notifications, and attachments
- Tests/checks run: typecheck, lint, message context tests, and gateway tests
- Full-suite status: deferred until the infrastructure milestone closes
- Done criteria: no context behavior is reached through `PigeonApiGateway`; it
  is reduced to composition wiring or removed

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

## Completed progress inside APPLICATION-011

- `APPLICATION-011A`: identity composition no longer uses a generic
  `IdentityContextPorts` aggregate. Identity profile, registration, session,
  keychain, presence, and protection workflows receive explicit capabilities
  from the composition root.
- Identity infrastructure owns the translation from profile Value Objects and
  network memberships to the registration HTTP contract.
- Conversation and community keychain publishers use the explicit
  `publishKeychain` capability instead of a generic `publish` method.
- `APPLICATION-011B`: removed the pass-through conversation/message gateways.
  Each action now owns its application dependency and its boundary message;
  the composition root binds the required capabilities explicitly.
- `APPLICATION-011C`: invitation acceptance is an application use case again.
  Decryption, keychain publication, and notification update are explicit
  outbound capabilities; infrastructure only adapts browser crypto and HTTP.
- `APPLICATION-011D`: moved all colocated `*.spec.ts` files to `src/test`,
  preserving context/layer paths and keeping test imports outside production
  modules.
- `APPLICATION-011E`: replaced the broad application contracts in attachments,
  calls, polls, and stickers with action-scoped contracts colocated with their
  application actions. The composition root now binds each capability
  explicitly instead of passing a complete context gateway.
- `APPLICATION-011F`: colocated notification settings, notification listing,
  push, reset, save, and update contracts with their application actions.

## Next slices

1. `APPLICATION-011G`: replace remaining broad compatibility methods in
  communities, identities, networks, and notifications with context-owned
  application entrypoints.
2. `IDENTITY-001`: complete identity material/session/keychain infrastructure.
3. `COMMUNITY-001`: complete community membership/channel aggregate behavior.
