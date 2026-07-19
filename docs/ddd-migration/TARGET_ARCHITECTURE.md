# Target DDD architecture

## Scope

Frontend domain, application, and infrastructure boundaries for Pigeon Swarm UI.

## Current structure summary

Contexts already exist, but `app/composition` owns a cross-context API gateway
and several context-specific gateways. Many `domain/*Resource.ts` files are
external shapes rather than behavior-rich models.

## Target structure

```text
src/
  app/
    composition/                 # dependency wiring only
    presentation/                # shell, bootstrap, cross-context UI assembly
  contexts/
    <context>/
      domain/                    # aggregates, entities, value objects, policies
      application/
        <workflow>/
          messages/              # primitive boundary conversion where needed
      infrastructure/
        http/                    # signed REST, DTO/resource mappers, cache
        crypto/                  # context-owned encryption and key envelopes
        browser/                 # context-owned browser adapters
      presentation/              # context UI, view models and hooks
  shared/
    domain/                      # only genuinely shared primitives
    infrastructure/http/         # generic HTTP client, URL builder, signer
```

## Bounded contexts / modules

| Context/module | Owns | Does not own | Integrates with | Boundary style |
| --- | --- | --- | --- | --- |
| identities | Identity, profile, presence, session key material | Conversation/community keys | conversations, communities | signed identity/keychain adapters |
| conversations | participants and direct/group lifecycle | Community channels | identities, messages | conversation repository and context-owned HTTP adapters |
| messages | message lifecycle, replies, reactions, pins, drafts | channel membership | conversations, communities, attachments | message repositories and context-owned adapters |
| communities | community membership, roles, channels, permissions | identity profile/session | identities, messages, polls | community adapters and policies |
| attachments | public/private media and upload progress | message lifecycle | messages, networks | file/IPFS adapter ports |
| calls | call lifecycle, participants, signaling, media state | presence persistence | identities, communities, conversations | WebRTC and signaling adapters |
| notifications | notification settings, decisions, push subscriptions | message decryption | identities, conversations, communities | REST/push/browser adapters |
| networks | node, network membership, relay and replication | community membership | identities, attachments | node/relay adapters |
| polls | poll lifecycle and vote state | message storage | messages, communities | poll repository and HTTP mapper |
| stickers | sticker packs, sticker metadata and usage | media transport | attachments, messages | sticker adapter port |

## Aggregates and aggregate roots

| Aggregate root | Owns | Invariants | Repository | Events |
| --- | --- | --- | --- | --- |
| Identity | profile, network memberships, keychain reference | stable identity id; profile constraints | identity/keychain HTTP adapter | identity updated |
| Conversation | participants and key-entry relationship | participant membership and deterministic scope | conversation adapter | conversation created/invited |
| Message | content, reply/thread relation, reaction lifecycle | author-only edit/delete; thread root consistency | message adapter | sent, edited, deleted, reacted |
| Community | membership, roles, channel configuration | permission and role transitions | `CommunityRepository` | member/channel/role changes |
| Call | scope, participants and lifecycle | valid joins/leaves/signals | calls adapter | started, joined, ended |
| Notification | attention type and decision state | only pending, actionable notifications can be accepted or declined | notification adapter | notification accepted/declined |
| NotificationSetting | delivery policy for one scope | valid scope hierarchy, mute period and mention suppression | notification settings adapter | setting saved/reset |
| PushSubscription | browser delivery endpoint and credentials | endpoint and both delivery credentials are required | push subscription adapter | subscription registered/removed |
| Poll | options, votes and state | open/closed vote rules | poll adapter | created, voted, closed |
| StickerPack | pack metadata, stickers and library lifecycle | binary media transport | sticker repository | created, updated, saved, removed |

## Application boundaries

| Use case/workflow | Message/command/query | Inputs | Result | Contracts touched |
| --- | --- | --- | --- | --- |
| Send message | `SendMessageMessage` | content, attachments, reply/thread relation | projected message | encrypted message REST/event |
| Create community | `CreateCommunityInput` composition workflow | profile, visibility, channels | community and keychain update | community REST/keychain |
| Update membership | membership command | actor, community, member, decision | community update | community REST/event |
| Unlock identity | `LoginIdentityMessage` | identity id and local unlock proof | authenticated session | identity/keychain REST |
| Configure node | relay configuration message | public host, ports, relay policy | node configuration | node REST |
| Search notifications | identity query | actor identity id | notifications | notification repository |
| Decide notification | notification command | actor, notification id, decision, timestamp | notification | notification repository |
| Resolve notification settings | identity and scope query | actor identity id, scope | effective setting | notification setting repository |
| Register push subscription | subscription command | actor identity id, endpoint, credentials, expiration | none | push subscription repository |
| Remove push subscription | subscription command | actor identity id, endpoint, credentials, expiration | none | push subscription repository |

## Infrastructure boundaries

| Adapter/repository/gateway | Domain/application port | External system or persistence model | Mapping strategy |
| --- | --- | --- | --- |
| `<context>/infrastructure/http/*` | domain repositories or explicit query contracts | signed backend REST | DTO to context resource/aggregate mapper |
| `<context>/infrastructure/crypto/*` | encryption/key ports | Web Crypto and value objects | encrypted payload/envelope mapper |
| `shared/infrastructure/http/*` | generic transport | fetch, URL, HTTP signature | no context semantics |
| `app/composition/*` | concrete construction only | browser application bootstrap | dependency wiring only |

## Read models / query side

Timeline, member lists, discovery, notifications, and node diagnostics are read
models. They may use immutable resources/view models, but must not be presented
as aggregate roots or used to enforce domain transitions.

## Compatibility strategy

Keep current application façades while a context adapter moves. Migrate all
callers in the same capability slice, then delete the compatibility façade.
External REST/websocket payloads remain stable unless their contract is explicitly
changed and documented.

For `COMMUNITY-001`, channel timelines, drafts, pins, discovery, and moderation
logs remain explicit query-side resources. They are not hydrated into the
`Community` aggregate merely because their HTTP paths are community-scoped.

## Migration order

1. Context-owned HTTP gateways and cache seams.
2. Identity/session/keychain workflow.
3. Message command/query and encrypted payload mapping.
4. Community membership, roles and channels.
5. Conversation and call cross-context coordination.
6. Presentation orchestration cleanup.

## Future folders not yet created

No repository or event folders are created until the frontend has a real local
persistence or event-translation responsibility that belongs to a context.
