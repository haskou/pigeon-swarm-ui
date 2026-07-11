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

## Slice MESSAGE-001: Behavior-rich message lifecycle model

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Stop using `ChatMessage` and API-shaped reaction records as domain
  state. Keep those shapes at the presentation/infrastructure boundary while
  the message aggregate owns editability and reaction lifecycle behavior.
- Planned changes:
  - represent message state with value objects instead of boolean/type checks
    spread across presentation code
  - make reactions domain entities owned by the message aggregate
  - replace `Message.toChatMessage()` with a presentation mapper
  - move `MessageEditPolicy` callers behind a presentation adapter
- Changed files:
  - `contexts/messages/domain/aggregates/Message.ts`
  - `contexts/messages/domain/entities/MessageReactionEntry.ts`
  - `contexts/messages/domain/value-objects/MessageDeliveryState.ts`
  - `contexts/messages/domain/value-objects/MessageKind.ts`
  - `contexts/messages/domain/value-objects/MessageVisibility.ts`
  - `contexts/messages/presentation/view-models/MessageReadModelMapper.ts`
  - `contexts/messages/presentation/view-models/MessageEditability.ts`
  - moved `MessageProjector` and `PollMessageProjection` to message
    infrastructure crypto
  - moved `ChatMessage` to presentation view models and message API resources
    to infrastructure HTTP
- Behavior changed/preserved: preserve current edit-menu eligibility and
  optimistic reaction behavior
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - message context tests
  - gateway and message projection tests
  - `yarn typecheck`
  - `yarn lint`
- Risks: encrypted or special message types must remain non-editable exactly as
  before
- Next slice: `INFRA-002`, replace composition gateway consumers by capability
  owned ports and adapters

## Slice CONTRACT-001: Move conversation and message DTOs to infrastructure

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Stop presenting REST resources for conversations, drafts, and pins as
  domain files.
- Changed files:
  - `contexts/conversations/infrastructure/http/ConversationResource.ts`
  - `contexts/messages/infrastructure/http/*Resource.ts`
  - context barrel exports and domain-to-contract imports
- Behavior changed/preserved: wire shapes and public imports preserved
- Contracts changed: none
- Validation level: L1
- Tests/checks:
  - message and conversation suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: additional community, identity, notification, network, poll, and
  sticker resources remain to be classified and moved in later slices
- Next slice: `INFRA-002`, replace composition gateway consumers by capability
  owned ports and adapters

## Slice APPLICATION-001: Move message application boundary into its context

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Keep message workflows and their application boundary under the
  messages context instead of `app/composition`.
- Changed files:
  - `contexts/messages/application/PigeonMessagesApplication.ts`
  - `contexts/messages/application/ports/MessagesGateway.ts`
  - composition root wiring and moved application tests
- Behavior changed/preserved: message send/load/edit/delete/reaction, draft,
  pin, and thread operations preserved
- Contracts changed: none
- Validation level: L1
- Tests/checks:
  - message and application composition suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: `PigeonApiGateway` still implements the port temporarily; its HTTP and
  crypto responsibilities are being extracted by `INFRA-002`
- Next slice: `INFRA-002`, replace the temporary gateway implementation

## Slice CONVERSATION-001: Conversation aggregate without resource state

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Keep conversation identity, participants, activity and peer rules in
  the aggregate instead of storing the REST resource as domain state.
- Changed files:
  - `contexts/conversations/domain/aggregates/Conversation.ts`
  - `contexts/conversations/application/list-conversations/ConversationTimeline.ts`
  - `contexts/conversations/presentation/view-models/ConversationPeer.ts`
- Behavior changed/preserved: conversation ordering, activity bumping, group
  peer exclusion, and keychain peer fallback preserved
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - conversation, message, and identity login suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: `ConversationResource` remains a boundary read model until the
  conversation HTTP/application port migration is complete
- Next slice: `INFRA-002`, replace composition gateway consumers by capability
  owned ports and adapters
