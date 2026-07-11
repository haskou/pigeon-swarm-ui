# Migration slice log

## Slice INFRA-001: Calls and networks own their HTTP gateways

- Date: 2026-07-11
- Size: L
- Status: completed
- Goal: Move calls and networks gateway adapters out of `src/app/composition`
  into their owning context infrastructure while preserving application APIs.
- Changed files:
  - `src/contexts/calls/infrastructure/http/PigeonCallsGateway.ts`
  - `src/contexts/networks/infrastructure/http/PigeonNodeGateway.ts`
  - composition imports and the affected calls/networks application tests
- Behavior changed/preserved: behavior preserved
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - `yarn typecheck`
  - `yarn lint`
  - targeted calls/networks adapter and application tests: 3 suites, 74 tests
- Decisions: ADR-0001, ADR-0002
- Risks: keychain and encrypted-message orchestration currently crosses contexts
- Next slice: `INFRA-002`, migrate identities, notifications, attachments and
  stickers gateways with their cache/crypto seams

## Slice INFRA-002: Remaining context-owned gateway seams

- Date: 2026-07-11
- Size: L
- Status: in progress
- Goal: Move remaining context-specific gateways and their owned cache/crypto
  collaborators out of `src/app/composition`, leaving a temporary compatibility
  seam only until application consumers migrate.
- Changed files:
  - moved attachments, identities, notifications and stickers gateways to their
    context infrastructure folders
  - moved generic request cache to `shared/infrastructure/http`
  - moved message/community/conversation transport inputs from app composition
    to their owning context infrastructure folders
  - removed duplicated community channel message input types from app
- Behavior changed/preserved: behavior preserved
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - `yarn typecheck`
  - `yarn lint`
  - targeted migrated-adapter tests: 6 suites, 83 tests
- Decisions: ADR-0001
- Risks: keychain and invitation flows cross identity, conversation, community
  and notification contexts
- Next slice: complete `INFRA-002` by replacing `PigeonApiGateway` consumers
  with context ports; then `IDENTITY-001`
