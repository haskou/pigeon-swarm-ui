# Migration slice log

## Slice COMMUNITY-001: Community aggregate and explicit workflows

- Date: 2026-07-17
- Size: L
- Status: completed
- Goal: replace the resource-shaped community domain and application port facade
  with a behavior-rich aggregate, primitive application messages, domain-owned
  repositories, and context infrastructure adapters.
- Changes:
  - hydrate community membership, roles, and channels through `Community.fromPrimitives`
  - move permission, membership, role, and channel mutations onto the aggregate
  - replace `PigeonCommunitiesApplication` orchestration and application `*Port`
    contracts with explicit use cases and domain repositories
  - keep timelines, drafts, pins, discovery, invitations, and moderation logs as
    explicit workflow/read-model boundaries
- Behavior changed/preserved: preserve REST, encrypted payload, keychain, cache,
  and presentation contracts
- Contracts changed: none planned
- Validation level: L2
- Tests/checks: 29 communities suites / 101 tests, direct aggregate, use-case,
  mapper, access-context, repository, and composition coverage; strict slice
  lint; TypeScript typecheck; full lint and Jest suite
- Next slice: `CONVERSATION-001`

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

## Slice APPLICATION-002: Move conversation application boundary into context

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Keep conversation creation, listing, invitation, and read-state
  workflows inside the conversations context.
- Changed files:
  - `contexts/conversations/application/PigeonConversationsApplication.ts`
  - `contexts/conversations/application/ports/ConversationsGateway.ts`
  - composition root wiring and moved application tests
- Behavior changed/preserved: direct and group creation, listing, invitations,
  and read-until operations preserved
- Contracts changed: none
- Validation level: L1
- Tests/checks:
  - conversation, message, and composition suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: `PigeonApiGateway` still supplies the temporary port implementation
- Next slice: `INFRA-002`, extract the HTTP and workflow adapters from the
  compatibility gateway

## Slice INFRA-002A: Extract message HTTP adapter from compatibility gateway

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Move message timeline, thread, pin, draft, reaction, and link-preview
  transport into context-owned infrastructure.
- Changed files:
  - `contexts/messages/infrastructure/http/PigeonMessagesApi.ts`
  - `contexts/messages/infrastructure/crypto/MessageProjectionPort.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and wiring
- Behavior changed/preserved: signed paths, cache keys, decryption flow, draft
  encryption, and response projections preserved
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - `PigeonMessagesApi.spec.ts`
  - gateway and message context suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: message send/edit/delete encryption orchestration remains in the
  compatibility gateway and is the next message transport extraction
- Next slice: `INFRA-002B`, extract message command encryption and signing

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

## Slice INFRA-002B: Extract message command adapter from compatibility gateway

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Move message send, edit, delete, attachment publication, encryption,
  signing, and link-preview orchestration into message infrastructure.
- Changed files:
  - `contexts/messages/infrastructure/http/PigeonMessageCommandsApi.ts`
  - `contexts/messages/infrastructure/http/MessageAttachmentPublisher.ts`
  - `contexts/messages/infrastructure/http/PigeonMessageCommandsApi.spec.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and wiring
- Behavior changed/preserved: message command paths, encrypted payloads,
  attachment publication, link previews, signatures, and response projection
  remain unchanged at the public boundary
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - command, message adapter, and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: identity, community, network, notification, and remaining keychain
  workflows still use the compatibility gateway
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-003: Move community application boundary into context

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Keep community orchestration inside the communities context and make
  its external capabilities explicit through segregated application ports.
- Changed files:
  - `contexts/communities/application/PigeonCommunitiesApplication.ts`
  - `contexts/communities/application/ports/Community*Port.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: community creation, membership, roles, channels,
  invitations, keychain publication, media upload, and leave reconciliation
  preserve their existing workflows
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - community application, composition, and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: the compatibility gateway still supplies the concrete capabilities;
  the next infrastructure slices will replace those bindings progressively
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-004: Move identity application boundary into context

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Keep identity login, registration, profile, passkey protection, keychain
  publication, and presence orchestration inside the identities context.
- Changed files:
  - `contexts/identities/application/PigeonIdentitiesApplication.ts`
  - `contexts/identities/application/ports/Identity*Port.ts`
  - `app/composition/PigeonApplication.ts` registration adapter and wiring
- Behavior changed/preserved: login progress, registration options, profile
  updates, local passkey unlock, keychain publication, and presence operations
  preserve their existing workflows
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - identity application and composition suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: identity HTTP/material orchestration remains in the compatibility
  gateway until the identity infrastructure slice
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-005: Move call application boundary into context

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Keep call listing, lifecycle, heartbeat, signaling, and ICE-server
  orchestration inside the calls context.
- Changed files:
  - `contexts/calls/application/PigeonCallsApplication.ts`
  - `contexts/calls/application/ports/CallApplicationPort.ts`
  - `contexts/calls/application/PigeonCallsApplication.spec.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: call creation, joining, leaving, heartbeat,
  signaling, ICE-server retrieval, and listing preserve their contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - call application and composition suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: call transport remains implemented by the context HTTP gateway; only
  the application boundary moved in this slice
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-006: Move notification application boundary into context

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Keep notification decisions, settings, invitation acceptance, and push
  subscription orchestration inside the notifications context.
- Changed files:
  - `contexts/notifications/application/PigeonNotificationsApplication.ts`
  - `contexts/notifications/application/ports/PushNotificationPort.ts`
  - `contexts/notifications/infrastructure/http/PushSubscriptionPayloadFactory.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: notification listing, state changes, settings,
  invitation key acceptance, VAPID lookup, and browser subscription validation
  preserve their existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - notification application and context suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: notification HTTP and invitation/keychain orchestration still use the
  compatibility gateway as their concrete adapter
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-007: Move node and network application boundary into context

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Keep network creation, joining, removal, peer queries, relay
  configuration, claiming, and replication reads inside the networks context.
- Changed files:
  - `contexts/networks/application/PigeonNetworksApplication.ts`
  - `contexts/networks/application/ports/NodeApplicationPort.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: anonymous and node-owned network flows, public
  network setup, peer listing, relay configuration, port checks, and replication
  status preserve their existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - network application and context suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: node HTTP transport remains implemented by the context gateway; this
  slice only removes its application dependency on composition
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-008: Move attachment and sticker boundaries into contexts

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Keep attachment publication/download and sticker-pack workflows inside
  their owning contexts instead of coupling them to the composition gateway.
- Changed files:
  - `contexts/attachments/application/PigeonAttachmentsApplication.ts`
  - `contexts/attachments/application/ports/AttachmentApplicationPort.ts`
  - `contexts/stickers/application/PigeonStickersApplication.ts`
  - `contexts/stickers/application/ports/StickerApplicationPort.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: attachment upload/download, sticker CRUD, pack
  listing, favorites, usage tracking, and asset URL generation preserve their
  existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - attachment and sticker application/context suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: concrete HTTP and media adapters remain behind the compatibility
  gateway until the infrastructure milestone replaces those bindings
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-009: Move poll application boundary into context

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Keep poll creation, reads, votes, removal, and closing inside the polls
  context with an explicit application port.
- Changed files:
  - `contexts/polls/application/PigeonPollsApplication.ts`
  - `contexts/polls/application/ports/PollApplicationPort.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: poll lifecycle operations and validated vote
  identifiers preserve their existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - poll application and context suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: poll HTTP transport remains implemented by the compatibility gateway
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice APPLICATION-010: Move session application boundary into identities

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Keep remembered-session restoration and refresh orchestration near the
  identity lifecycle while preserving conversation activity ordering.
- Changed files:
  - `contexts/identities/application/PigeonSessionApplication.ts`
  - `contexts/identities/application/ports/SessionApplicationPort.ts`
  - `app/composition/PigeonApplication.ts` composition wiring
- Behavior changed/preserved: session refresh, remembered-session restoration,
  progress reporting, and latest-activity conversation ordering are preserved
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - identity application and session suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: workspace bootstrap still crosses context boundaries by necessity; the
  session port keeps that coordination explicit
- Next slice: `INFRA-002C`, extract the next context-owned gateway capability

## Slice INFRA-002C: Extract keychain HTTP and crypto coordination

- Date: 2026-07-11
- Size: M
- Status: completed
- Goal: Move remote keychain loading, cache policy, encryption/decryption, and
  publication out of the compatibility gateway into identity infrastructure.
- Changed files:
  - `contexts/identities/infrastructure/http/PigeonKeychainApi.ts`
  - `contexts/identities/infrastructure/http/PigeonKeychainApi.spec.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and wiring
- Behavior changed/preserved: signed keychain reads, 1.5 second startup cache,
  master-key decryption, versioned publication, and cache invalidation preserve
  their existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - keychain and gateway suites (66 tests)
  - `yarn typecheck`
  - `yarn lint`
- Risks: identity material and conversation/community invitation orchestration
  still remain in the compatibility gateway
- Next slice: extract conversation lifecycle and invitation coordination

## Slice INFRA-002D: Extract conversation lifecycle and invitation coordination

- Date: 2026-07-11
- Size: L
- Status: completed
- Goal: Move one-to-one/group conversation creation, key generation, keychain
  publication, conversation POSTs, and encrypted invitations out of the
  compatibility gateway.
- Changed files:
  - `contexts/conversations/infrastructure/http/PigeonConversationCommandsApi.ts`
  - `contexts/conversations/infrastructure/http/PigeonConversationCommandsApi.spec.ts`
  - `contexts/conversations/infrastructure/http/ConversationIdentityReader.ts`
  - `contexts/conversations/infrastructure/http/ConversationKeychainPublisher.ts`
  - `contexts/conversations/infrastructure/http/GroupConversationInput.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and wiring
- Behavior changed/preserved: deterministic one-to-one IDs, random group keys,
  signed conversation creation, keychain versioning, recipient key wrapping,
  invitation types, and conversation-list cache invalidation are preserved
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - conversation command, application, and gateway suites (73 tests)
  - `yarn typecheck`
  - `yarn lint`
- Risks: community invitation orchestration and identity material creation still
  remain in the compatibility gateway
- Next slice: extract community invitation coordination

## Slice INFRA-002E: Extract community invitation coordination

- Date: 2026-07-11
- Size: L
- Status: completed
- Goal: Move public/private community invitations, invite-link envelopes,
  signed invite requests, keychain publication, and invite acceptance out of
  the compatibility gateway.
- Changed files:
  - `contexts/communities/infrastructure/http/PigeonCommunityInvitationApi.ts`
  - `contexts/communities/infrastructure/http/PigeonCommunityInvitationApi.spec.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and wiring
- Behavior changed/preserved: public communities remain keyless, private
  communities keep symmetric key publication, encrypted invitations keep their
  recipient wrapping and signatures, and invite links preserve their payload
  envelope and acceptance flow
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - community invitation, application, and gateway suites (68 tests)
  - `yarn typecheck`
  - `yarn lint`
- Risks: identity material creation and message projection remain the largest
  responsibilities still owned by the compatibility gateway
- Next slice: extract identity material creation and login orchestration

## Slice INFRA-002F: Extract conversation read transport

- Date: 2026-07-11
- Size: S
- Status: completed
- Goal: Move cached conversation listing and read-until transport out of the
  compatibility gateway and into conversation infrastructure.
- Changed files:
  - `contexts/conversations/infrastructure/http/PigeonConversationsApi.ts`
  - `contexts/conversations/infrastructure/http/PigeonConversationsApi.spec.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and wiring
- Behavior changed/preserved: signed conversation listing, 1.5 second cache
  policy, response mapping, and read-until requests preserve their contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - conversation, community, and gateway suites (68 focused tests)
  - `yarn typecheck`
  - `yarn lint`
- Risks: identity material creation remains the largest remaining private
  workflow in the compatibility gateway
- Next slice: extract identity material creation and login orchestration

## Slice INFRA-002G: Extract identity commands and key unlock

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: Move identity creation, signed profile updates, and login key-unlock
  verification out of the compatibility gateway and into identity-owned
  infrastructure.
- Changed files:
  - `contexts/identities/infrastructure/http/PigeonIdentityCommandsApi.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentitySessionApi.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and composition wiring
- Behavior changed/preserved: identity key generation, master-key protection,
  signed identity creation and profile updates, passkey cleanup, login progress,
  recovery-key handling, remembered-session unlock, and identity signature
  validation preserve their existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - identity command and session infrastructure tests
  - identity application and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: keychain hydration and registration orchestration still coordinate
  identity, conversation, and message boundaries in the compatibility gateway
- Next slice: extract session hydration and registration coordination

## Slice INFRA-002H: Extract identity workspace session hydration

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: Move keychain hydration, optional remote-keychain handling, conversation
  bootstrap, and session refresh out of the compatibility gateway.
- Changed files:
  - `contexts/identities/application/ports/IdentityWorkspaceSessionPort.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi.ts`
  - `contexts/identities/infrastructure/http/PigeonKeychainApi.ts`
  - `app/composition/PigeonApiGateway.ts` delegation and composition wiring
- Behavior changed/preserved: login and remembered-session progress, missing
  keychain behavior, keychain external identifiers, conversation bootstrap,
  refresh ordering, and cache-backed keychain reads preserve their contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - workspace session, keychain, identity, and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: registration still coordinates identity material, workspace hydration,
  and optional local passkey setup in the compatibility gateway
- Next slice: extract registration coordination

## Slice INFRA-002J: Extract identity registration coordination

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: Move identity registration, initial workspace hydration, and optional
  local passkey setup out of the compatibility gateway.
- Changed files:
  - `contexts/identities/infrastructure/http/CreatedIdentityMaterial.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentityRegistrationApi.ts`
  - `app/composition/PigeonApiGateway.ts` delegation
- Behavior changed/preserved: identity creation, initial keychain and
  conversation hydration, optional passkey setup, cancellation handling, and
  PRF-protected registration preserve their existing contracts
- Contracts changed: none
- Validation level: L2
- Tests/checks:
  - identity registration and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: application composition still injects the compatibility facade into
  several context application ports; replacing those consumers is the next
  architectural milestone
- Next slice: replace compatibility gateway consumers with context ports

## Slice INFRA-002K: Extract identity login orchestration

- Date: 2026-07-12
- Size: S
- Status: completed
- Goal: Expose login, remembered-session restoration, and session refresh as a
  single identity-owned capability instead of sequencing them in composition.
- Changed files:
  - `contexts/identities/infrastructure/http/PigeonIdentityLoginApi.ts`
  - `app/composition/PigeonApiGateway.ts` delegation
- Behavior changed/preserved: password/passkey/recovery-key login, remembered
  sessions, progress reporting, workspace hydration, and refresh behavior keep
  their existing contracts
- Contracts changed: none
- Validation level: L1
- Tests/checks:
  - identity login, registration, and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: application composition still injects the compatibility facade into
  several context application ports; replacing those consumers is the next
  architectural milestone
- Next slice: replace compatibility gateway consumers with context ports

## Slice INFRA-002I: Extract local passkey configuration

- Date: 2026-07-12
- Size: S
- Status: completed
- Goal: Keep local device-unlock configuration with the identity key-protection
  infrastructure instead of exposing factor verification and local storage
  mechanics through the composition gateway.
- Changed files:
  - `contexts/identities/infrastructure/crypto/PigeonIdentityKeyProtectionGateway.ts`
  - `app/composition/PigeonApiGateway.ts` delegation
- Behavior changed/preserved: enabling local passkey unlock still verifies the
  remote factors before saving; disabling it still clears the local record.
- Contracts changed: none
- Validation level: L1
- Tests/checks:
  - identity protection and gateway suites
  - `yarn typecheck`
  - `yarn lint`
- Risks: registration still coordinates identity material, workspace hydration,
  and optional local passkey setup in the compatibility gateway
- Next slice: extract registration coordination

## Slice APPLICATION-011A: Compose identity through context ports

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: Remove the identity application's dependency on the full composition
  gateway and keep primitive API translation inside identity infrastructure.
- Changed files:
  - `contexts/identities/application/IdentityContextPorts.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentityProfileApi.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentityRegistrationApi.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentityLoginApi.ts`
  - `contexts/identities/infrastructure/http/PigeonKeychainApi.ts`
  - `contexts/conversations/infrastructure/http/ConversationKeychainPublisher.ts`
  - `contexts/communities/infrastructure/http/PigeonCommunityInvitationApi.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
- Behavior changed/preserved: identity registration, login, session refresh,
  profile updates, local protection, presence, keychain publication, and
  conversation/community keychain publication preserve their public behavior.
- Contracts changed: no REST or encrypted-payload contract changes; internal
  infrastructure capability renamed from generic `publish` to
  `publishKeychain`.
- Validation level: L2
- Tests/checks:
  - focused identity, conversation, community, composition, and gateway suites
  - `yarn typecheck`
  - focused ESLint for all changed TypeScript files
- Risks: the remaining conversation, message, community, and notification
  application consumers still receive compatibility capabilities from
  `PigeonApiGateway`.
- Next slice: `APPLICATION-011B`, migrate conversation and message consumers.

## Slice APPLICATION-011B: Compose conversation and message ports

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: Keep conversation and message application services independent from
  the composition facade while preserving their existing read, command,
  encryption, cache, and pagination behavior.
- Changed files:
  - `contexts/conversations/infrastructure/http/PigeonConversationsGateway.ts`
  - `contexts/conversations/infrastructure/http/PigeonConversationsGateway.spec.ts`
  - `contexts/messages/infrastructure/http/PigeonMessagesGateway.ts`
  - `contexts/messages/infrastructure/http/PigeonMessagesGateway.spec.ts`
  - `contexts/messages/infrastructure/http/PigeonMessagesApi.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
- Behavior changed/preserved: conversation creation, group invitations,
  activity ordering fallback, read-until, message loading/decryption, drafts,
  pins, reactions, edits, deletes, sends, attachments and link previews keep
  their existing public behavior.
- Contracts changed: none. Compatibility methods remain on
  `PigeonApiGateway` while application composition uses context adapters.
- Validation level: L2
- Tests/checks:
  - affected conversation, message, composition, and gateway suites
  - `yarn typecheck`
  - affected ESLint scope
- Risks: community, notification, attachment, poll, and sticker application
  services still receive compatibility capabilities from the composition
  facade; the conversation listing fallback intentionally reads the message
  context through an explicit infrastructure dependency until that query is
  extracted.
- Next slice: `APPLICATION-011C`, migrate community and notification consumers.

## Slice APPLICATION-011 corrective: restore explicit application boundaries

- Date: 2026-07-12
- Size: L
- Status: completed
- Goal: remove generic context-port aggregates and infrastructure gateways that
  only forwarded large method bags; keep each application action explicit.
- Changed files:
  - `contexts/conversations/application/*`
  - `contexts/messages/application/*`
  - `contexts/notifications/application/accept-conversation-invitation/*`
  - `contexts/notifications/infrastructure/crypto/PigeonConversationInvitationKeyDecryptor.ts`
  - `app/composition/PigeonApplication.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `src/test/**`
- Behavior changed/preserved: message, conversation, notification invitation,
  registration, pagination, draft, pin, reaction, and keychain workflows keep
  their public behavior; only internal composition boundaries changed.
- Contracts changed: no REST, websocket, encrypted-payload, or keychain wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - `yarn typecheck`
  - `yarn test --runInBand --no-cache`
  - `yarn lint`
- Notes: lint has no errors; it still reports pre-existing test-fixture and
  test-order warnings. All 146 suites and 564 tests pass.

## Slice APPLICATION-011E: Split remaining application contracts by action

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: remove broad gateway-shaped application contracts from attachments,
  calls, polls, and stickers while keeping the application facade as the
  composition point for the existing UI API.
- Changed files:
  - `contexts/attachments/application/*`
  - `contexts/calls/application/*`
  - `contexts/polls/application/*`
  - `contexts/stickers/application/*`
  - `app/composition/PigeonApplication.ts`
  - affected files under `src/test/**`
- Behavior changed/preserved: attachment publication/downloads, call lifecycle
  and signalling, poll commands, and sticker management preserve their public
  behavior; only internal application dependencies were split by capability.
- Contracts changed: no REST, websocket, media, encrypted-payload, or keychain
  wire contract changes.
- Validation level: L2
- Tests/checks:
  - `yarn typecheck`
  - `yarn test --runInBand --no-cache`
  - `yarn lint`
  - `yarn build`
- Notes: lint has no errors; it still reports pre-existing test-fixture and
  test-order warnings. All 146 suites and 564 tests pass.
- Next slice: `APPLICATION-011F`, migrate notification contracts by action.

## Slice APPLICATION-011F: Colocate notification contracts by action

- Date: 2026-07-12
- Size: S
- Status: completed
- Goal: remove the notification context's generic application `ports` bucket
  and keep each outbound capability beside the action that owns it.
- Changed files:
  - `contexts/notifications/application/list-notification-settings/*`
  - `contexts/notifications/application/list-notifications/*`
  - `contexts/notifications/application/push-notifications/*`
  - `contexts/notifications/application/reset-notification-setting/*`
  - `contexts/notifications/application/save-notification-setting/*`
  - `contexts/notifications/application/update-notification/*`
  - `contexts/notifications/application/accept-conversation-invitation/*`
  - affected files under `src/test/**`
- Behavior changed/preserved: notification listing, settings, push
  registration, invitation acceptance, and state updates preserve their public
  behavior; only contract ownership and imports changed.
- Contracts changed: no push, REST, websocket, or encrypted-payload wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - notification application tests
  - `yarn typecheck`
  - focused ESLint for the notification context
- Next slice: `APPLICATION-011G`, migrate networks and then review the larger
  communities and identities application boundaries.

## Slice APPLICATION-011G: Split node capabilities by action

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: remove the broad node application contract and keep node management,
  relay, replication, network, and peer capabilities explicit.
- Changed files:
  - `contexts/networks/application/*`
  - `app/composition/PigeonApplication.ts`
  - affected files under `src/test/**`
- Behavior changed/preserved: node claiming, network creation/join/removal,
  public-network setup, peer listing, relay configuration, port checks, and
  replication reads preserve their public behavior; only composition contracts
  changed.
- Contracts changed: no node, network, relay, or replication wire contract
  changes.
- Validation level: L2
- Tests/checks:
  - network application tests
  - `yarn typecheck`
  - focused ESLint for the network context
- Next slice: `APPLICATION-011H`, migrate the larger community and identity
  application boundaries.

## Slice APPLICATION-011H: Colocate identity capabilities by action

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: remove the identity context's generic application contract bucket and
  keep login, registration, profile, presence, session, keychain publication,
  and local protection capabilities beside their owning actions.
- Changed files:
  - `contexts/identities/application/*`
  - `app/composition/PigeonApplication.ts`
  - affected files under `src/test/**`
- Behavior changed/preserved: identity login, registration, profile updates,
  presence, session recovery, keychain publication, and local passkey unlock
  preserve their public behavior; only application boundaries changed.
- Contracts changed: no identity, keychain, WebAuthn, or encrypted-payload wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - identity application tests
  - `yarn typecheck`
  - focused ESLint for the identity context
- Next slice: `APPLICATION-011I`, remove the remaining generic community
  contract bucket and split its channel and membership capabilities.

## Slice APPLICATION-011I: Split community capabilities by action

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: remove the generic community application `ports` bucket and make
  channel management, channel message reads/commands, pins, drafts, members,
  membership requests, roles, directory, invitation, keychain, and media
  capabilities explicit in the composition root.
- Changed files:
  - `contexts/communities/application/*`
  - `app/composition/PigeonApplication.ts`
  - affected files under `src/test/**`
- Behavior changed/preserved: community creation, discovery, membership,
  roles, channels, messages, pins, drafts, invitations, keychain publication,
  media upload, and leave reconciliation preserve their public behavior; only
  application contract ownership changed.
- Contracts changed: no community, message, invitation, keychain, or media
  wire contract changes.
- Validation level: L2
- Tests/checks:
  - community application tests
  - `yarn typecheck`
  - focused ESLint for the community context
- Next slice: `APPLICATION-011J`, split the remaining community directory and
  invitation capabilities before replacing compatibility gateway adapters.

## Slice APPLICATION-011J: Split community directory capabilities

- Date: 2026-07-12
- Size: S
- Status: completed
- Goal: keep community listing, discovery, lookup, creation, update, and
  moderation-log reads as separate application capabilities.
- Changed files:
  - `contexts/communities/application/create-community/*`
  - `contexts/communities/application/discover-communities/*`
  - `contexts/communities/application/get-community/*`
  - `contexts/communities/application/list-communities/*`
  - `contexts/communities/application/list-community-moderation-logs/*`
  - `contexts/communities/application/update-community/*`
  - `app/composition/PigeonApplication.ts`
  - affected files under `src/test/**`
- Behavior changed/preserved: community listing, discovery, lookup, creation,
  updates, and moderation-log reads preserve their public behavior; only
  capability ownership changed.
- Contracts changed: no community or REST wire contract changes.
- Validation level: L2
- Tests/checks:
  - community application tests
  - `yarn typecheck`
  - focused ESLint for the community context
- Next slice: `APPLICATION-011K`, replace remaining compatibility gateway
  implementations with context-owned adapters.

## Slice APPLICATION-011K: Split community invitation capabilities

- Date: 2026-07-12
- Size: S
- Status: completed
- Goal: keep direct invitations, invite-link creation, invite-link lookup, and
  the two invite-link acceptance flows as separate application capabilities.
- Changed files:
  - `contexts/communities/application/accept-community-invite-link/*`
  - `contexts/communities/application/accept-community-invite-link-with-key/*`
  - `contexts/communities/application/create-community-invitation/*`
  - `contexts/communities/application/create-community-invite-link/*`
  - `contexts/communities/application/get-community-invite-link/*`
  - `app/composition/PigeonApplication.ts`
  - affected files under `src/test/**`
- Behavior changed/preserved: direct invitations, invite links, link lookup,
  and both acceptance flows preserve their public behavior; only capability
  ownership changed.
- Contracts changed: no invitation, community, keychain, or REST wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - community application tests
  - `yarn typecheck`
  - focused ESLint for the community context
- Next slice: `APPLICATION-011L`, replace remaining compatibility gateway
  implementations with context-owned HTTP and crypto adapters.

## Slice APPLICATION-011L: Extract community creation use case

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: move community creation orchestration out of the context facade into
  an explicit application use case.
- Changed files:
  - `contexts/communities/application/create-community/CreateCommunity.ts`
  - `contexts/communities/application/create-community/messages/*`
  - `contexts/communities/application/PigeonCommunitiesApplication.ts`
  - `src/test/contexts/communities/application/create-community/*`
- Behavior changed/preserved: image upload, community creation, initial channel
  creation, private community key publication, and public/private result
  handling preserve their existing behavior.
- Contracts changed: no community, keychain, media, or REST wire contract
  changes.
- Validation level: L2
- Tests/checks:
  - community creation use-case tests
  - community application tests
  - `yarn typecheck`
  - focused ESLint for the community context
- Next slice: `APPLICATION-011M`, extract leave/community-keychain reconciliation
  and then replace remaining compatibility gateway implementations.

## Slice APPLICATION-011M: Add the context-owned community gateway

- Date: 2026-07-12
- Size: L
- Status: completed
- Goal: move the application-facing community adapter out of
  `app/composition/PigeonApiGateway` and wire the communities context through
  its own infrastructure gateway.
- Changed files:
  - `contexts/communities/infrastructure/http/PigeonCommunitiesGateway.ts`
  - `app/composition/PigeonApplication.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `src/test/contexts/communities/infrastructure/http/*`
- Behavior changed/preserved: community HTTP delegation, membership-request
  cache invalidation, membership invitation notification, channel pin cache
  invalidation, draft invalidation, media upload, and invite workflows preserve
  their public behavior. The old gateway methods remain as a compatibility
  surface while callers migrate.
- Contracts changed: no REST, websocket, media, invitation, or keychain wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - community gateway tests
  - composition and compatibility gateway tests
  - `yarn typecheck`
  - focused ESLint for the changed adapter/composition files
- Next slice: `APPLICATION-011N`, make the remaining `PigeonApiGateway`
  community methods thin compatibility delegates and remove duplicated logic.

## Slice APPLICATION-011N: Delegate legacy community methods

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: keep the old community methods on `PigeonApiGateway` as a compatibility
  surface without retaining their cache, invitation, or transport logic.
- Changed files:
  - `app/composition/PigeonApiGateway.ts`
  - `contexts/communities/infrastructure/http/PigeonCommunitiesGateway.ts`
  - affected composition and gateway tests
- Behavior changed/preserved: legacy community method names remain available,
  but all community behavior now routes through the context-owned adapter.
  Cache invalidation and membership invitation side effects have one owner.
- Contracts changed: no REST, websocket, media, invitation, or keychain wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - compatibility gateway tests
  - community gateway tests
  - `yarn typecheck`
  - focused ESLint for composition and community infrastructure
- Next slice: `APPLICATION-011O`, complete the leave/keychain reconciliation
  use case extraction and continue with the next large context.

## Slice APPLICATION-011O: Extract leave/keychain reconciliation use case

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: move community leave reconciliation and keychain cleanup out of the
  community facade into an explicit application use case and message.
- Changed files:
  - `contexts/communities/application/leave-community/*`
  - `contexts/communities/application/PigeonCommunitiesApplication.ts`
  - `src/test/contexts/communities/application/leave-community/*`
- Behavior changed/preserved: leaving a community removes its keychain entry;
  already-applied `CommunityMemberNotFoundError` and `CommunityNotFoundError`
  cases still reconcile the local keychain instead of retrying forever.
- Contracts changed: no community, keychain, or REST wire contract changes.
- Validation level: L2
- Tests/checks:
  - leave use-case tests
  - community application tests
  - `yarn typecheck`
  - focused ESLint for the leave slice
- Next slice: `APPLICATION-011P`, audit the next large context boundary and
  extract its highest-risk orchestration into explicit use cases.

## Slice APPLICATION-011P: Add the context-owned identity gateway

- Date: 2026-07-12
- Size: L
- Status: completed
- Goal: move identity, session, presence, protection, and keychain application
  composition behind an identities-owned infrastructure adapter.
- Changed files:
  - `contexts/identities/infrastructure/http/PigeonIdentitiesGateway.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
  - `src/test/contexts/identities/infrastructure/http/*`
  - affected composition tests
- Behavior changed/preserved: login, remembered-session restoration, identity
  registration/profile updates, presence, local passkey protection, keychain
  publication, and keychain decryption preserve their public behavior. The
  application composition no longer passes the monolithic gateway to identity
  use cases.
- Contracts changed: no identity, WebAuthn, keychain, or encrypted-payload
  wire contract changes.
- Validation level: L2
- Tests/checks:
  - identity gateway tests
  - identity application and infrastructure tests
  - composition tests
  - `yarn typecheck`
  - focused ESLint for the identity adapter/composition files
- Next slice: `APPLICATION-011Q`, make the remaining identity methods on
  `PigeonApiGateway` thin compatibility delegates and remove duplicated logic.

## Slice APPLICATION-011Q: Delegate legacy identity methods

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: keep the old identity/session/keychain methods on
  `PigeonApiGateway` as compatibility delegates while giving the context-owned
  identity gateway the single implementation path.
- Changed files:
  - `app/composition/PigeonApiGateway.ts`
  - `contexts/identities/infrastructure/http/PigeonIdentitiesGateway.ts`
  - affected composition and identity tests
- Behavior changed/preserved: identity creation/profile updates, login,
  remembered-session restoration, session refresh, keychain load/decrypt/
  publish, and local passkey configuration preserve their public behavior.
- Contracts changed: no identity, WebAuthn, keychain, or encrypted-payload
  wire contract changes.
- Validation level: L2
- Tests/checks:
  - compatibility gateway tests
  - identity gateway tests
  - composition tests
  - `yarn typecheck`
  - focused ESLint for the identity adapter/composition files
- Next slice: `APPLICATION-011R`, audit conversations and messages for the
  next high-risk orchestration boundary.

## Slice APPLICATION-011R: Add the context-owned messages gateway

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: keep message HTTP, encryption projection, attachment publication, and
  message command orchestration behind the messages context boundary.
- Changed files:
  - `contexts/messages/infrastructure/http/PigeonMessagesGateway.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
  - `src/test/contexts/messages/infrastructure/http/PigeonMessagesGateway.spec.ts`
  - `app/presentation/workspace/components/ChatColumn.tsx`
- Behavior changed/preserved: message reads, threads, pins, drafts, reactions,
  sends, edits, and deletes keep their existing behavior. One shared thread
  capability predicate is now used by the conversation column and context menu;
  one-to-one conversations do not expose thread actions.
- Contracts changed: no message, thread, encryption, or REST wire contract
  changes.
- Validation level: L2
- Tests/checks:
  - messages gateway delegation tests
  - conversation thread capability tests
  - full test suite
  - `yarn typecheck`
  - focused ESLint for the gateway and composition files
- Next slice: audit the remaining conversation facade and remove duplicated
  application-facing orchestration where a context-owned boundary is justified.

## Slice APPLICATION-011S: Add the context-owned conversations gateway

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: keep conversation creation, group invitations, listing, and read
  markers behind the conversations context boundary.
- Changed files:
  - `contexts/conversations/infrastructure/http/PigeonConversationsGateway.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
  - `src/test/contexts/conversations/infrastructure/http/PigeonConversationsGateway.spec.ts`
  - affected composition tests
- Behavior changed/preserved: one-to-one and group creation, group invitations,
  conversation listing, and read-until updates preserve their existing
  behavior. Legacy facade methods now delegate to the context-owned gateway.
- Contracts changed: no conversation, invitation, keychain, or REST wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - conversation gateway delegation tests
  - composition tests
  - `yarn typecheck`
  - focused ESLint for the gateway and composition files
- Next slice: audit the remaining application composition and infrastructure
  adapters for duplicated notification/poll/sticker boundaries.

## Slice APPLICATION-011T: Route notification and sticker contexts explicitly

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: stop wiring notification, push, and sticker use cases through the
  monolithic application gateway when context-owned gateways already exist.
- Changed files:
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
  - affected composition tests
- Behavior changed/preserved: notification settings, notification decisions,
  push subscription operations, sticker management, and invitation keychain
  publication preserve their existing behavior while their dependencies now
  point at the owning context boundaries.
- Contracts changed: no notification, push, sticker, or invitation wire
  contract changes.
- Validation level: L2
- Tests/checks:
  - composition tests
  - `yarn typecheck`
  - focused ESLint for composition files
- Next slice: audit polls and remaining shared application gateway methods for
  duplicated context boundaries.

## Slice APPLICATION-011U: Route files and polls through context gateways

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: finish the explicit composition boundary for attachments and polls
  without making the global API facade the application port.
- Changed files:
  - `contexts/polls/infrastructure/http/PigeonPollsGateway.ts`
  - `app/composition/PigeonApiGateway.ts`
  - `app/composition/PigeonApplication.ts`
  - `src/test/contexts/polls/infrastructure/http/PigeonPollsGateway.spec.ts`
  - affected composition tests
- Behavior changed/preserved: attachment upload/download/public-file flows and
  poll creation, reads, votes, removals, and closing preserve their existing
  behavior while use cases receive context-owned gateways.
- Contracts changed: no attachment, poll, or REST wire contract changes.
- Validation level: L2
- Tests/checks:
  - poll gateway delegation tests
  - composition tests
  - `yarn typecheck`
  - focused ESLint for the gateway and composition files
- Next slice: inspect the remaining facade-only capabilities and decide which
  are true shared composition concerns versus context infrastructure.

## Slice APPLICATION-011V: Unify compatibility delegates with context gateways

- Date: 2026-07-12
- Size: S
- Status: completed
- Goal: ensure the remaining legacy methods on `PigeonApiGateway` use the same
  context-owned gateway instances that the application composition uses.
- Changed files:
  - `app/composition/PigeonApiGateway.ts`
  - `app/presentation/workspace/components/useConversationThread.ts`
- Behavior changed/preserved: push, poll, attachment, sticker, and notification
  compatibility methods preserve their behavior while avoiding a second
  implementation path. Unsupported conversation thread state is cleared when
  switching to a one-to-one conversation.
- Contracts changed: no public REST or encrypted-payload contract changes.
- Validation level: L2
- Tests/checks:
  - conversation thread capability tests
  - `yarn typecheck`
  - focused ESLint for the compatibility facade and thread hook
- Next slice: extract a cohesive presentation orchestrator from
  `GlassWorkspace` rather than adding more facade methods.

## Slice APPLICATION-011W: Extract realtime call event orchestration

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: move call signal delivery and call resource reconciliation out of the
  workspace component into a cohesive presentation hook.
- Changed files:
  - `app/presentation/workspace/components/useWorkspaceRealtimeCallEvents.ts`
  - `app/presentation/workspace/components/GlassWorkspace.tsx`
- Behavior changed/preserved: incoming call signals are deduplicated,
  acknowledged, and delivered through the existing call session; non-signal
  call events still reload and reconcile their call resource. No WebSocket or
  call payload contract changed.
- Contracts changed: none.
- Validation level: L2
- Tests/checks:
  - call and realtime test suites
  - `yarn typecheck`
  - focused ESLint for the extracted hook
- Next slice: extract the message timeline loading/scroll orchestration from
  `GlassWorkspace`.

## Slice APPLICATION-011X: Extract message history orchestration

- Date: 2026-07-12
- Size: M
- Status: completed
- Goal: move loading older messages, scroll anchoring, cursor progression, and
  near-bottom detection out of the workspace component.
- Changed files:
  - `app/presentation/workspace/components/useWorkspaceMessageHistory.ts`
  - `app/presentation/workspace/components/GlassWorkspace.tsx`
- Behavior changed/preserved: older-message pagination preserves the previous
  viewport anchor, prevents duplicate loads, merges only unknown messages, and
  keeps unread/new-message behavior unchanged.
- Contracts changed: no message or REST wire contract changes.
- Validation level: L2
- Tests/checks:
  - full test suite
  - `yarn typecheck`
  - focused ESLint for the extracted history hook
- Next slice: extract the remaining realtime/community routing from
  `GlassWorkspace` only where it forms a cohesive responsibility.
