# Ubiquitous language

| Term | Meaning | Context | Conflicts/aliases | Source |
| --- | --- | --- | --- | --- |
| Identity | Stable public identity plus protected private key material | identities | `IdentityResource` is a transport/read shape | backend and UI |
| Session | Unlocked identity, keypair, master key and keychain reference | identities | not a backend session cookie | frontend |
| Keychain | Encrypted collection of conversation/community key entries | identities | local keychain vs remote keychain resource | frontend/backend |
| Conversation | Direct or group message scope | conversations | not a message timeline | frontend/backend |
| Message | Timeline event with content and relation to replies/threads | messages | `MessageResource` is transport shape | frontend/backend |
| Community | Governance boundary for members, roles and channels | communities | public visibility is not public membership | frontend/backend |
| Channel | Text or voice scope within a community | communities | message channel relation is a foreign reference | frontend/backend |
| Network | Node/IPFS membership and relay boundary | networks | not a community | frontend/backend |
| Notification | User attention record and policy scope | notifications | not a websocket event | frontend/backend |
| Notification setting | Delivery, mute, mention and visibility policy for a conversation, community, or channel scope | notifications | channel settings inherit from community settings before defaults | frontend/backend |
| Push subscription | Browser endpoint and credentials used to deliver Web Push to one identity | notifications | browser permission is not itself a subscription | frontend/backend/browser |
