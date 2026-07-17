# Context map

## Candidate bounded contexts

| Context | Capability | Owned model | Persistence owner | Public contracts | Notes |
| --- | --- | --- | --- | --- | --- |
| identities | identity unlock and profile | identity, session, keychain reference | backend/IPFS keychain | identities, presence, keychains | source of authenticated session |
| conversations | direct and group scopes | conversation and participant set | backend | conversations, messages | shares message transport with messages |
| messages | timeline and interaction lifecycle | message, reply, thread, reaction, pin, draft | backend/IPFS | conversation/channel messages | encrypted payload boundary |
| communities | membership and channel governance | community, roles, channels | backend | communities, channels, invites | permission owner |
| calls | realtime call lifecycle | call and participants | backend/WebRTC | calls, websocket signals | media is browser infrastructure |
| attachments | file transport | attachment metadata and encryption state | IPFS/backend | IPFS upload/download | shared by messages and stickers |
| notifications | user attention policy | settings and notification decisions | backend/browser push | notification settings/push | does not own message content |
| networks | node configuration and discovery | network and relay policy | node backend | node, peers, relay | infrastructure-facing context |
| polls | poll state | poll, option and vote | backend | polls | embedded in message timeline |
| stickers | sticker catalogue and usage | packs and stickers | backend/IPFS | stickers | uses attachments for binary data |

## Relationships

| Upstream | Downstream | Relationship | Contract | Translation/ACL | Notes |
| --- | --- | --- | --- | --- | --- |
| identities | conversations | customer/supplier | session identity and key material | keychain entry mapper | no identity DTO inside conversation domain |
| conversations | messages | customer/supplier | conversation id and participant scope | message application message | messages do not mutate conversation membership or own identity keychain entries |
| communities | messages | customer/supplier | channel permissions and community key | channel message command | community owns authorization |
| messages | notifications | published language | mention/read state | notification preview mapper | notification does not decrypt messages |
| networks | attachments | provider | private network id | upload adapter | attachments own file encryption |
| calls | conversations/communities | partnership | call scope | call scope mapper | scope resolves to one context |

## Shared kernel candidates

- Generic HTTP client, URL builder, request signer and error type.
- Value-object library integration.
- Serialized identity id only at transport boundaries.

## Anticorruption layers

- Backend `*Resource` payloads map at context HTTP boundaries.
- IPFS CIDs and encrypted envelopes map at attachments/identities/communities
  infrastructure boundaries.
- Websocket events map to context-specific event handlers before presentation.
