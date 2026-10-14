# MLS group encryption for communities (ADR)

Status: accepted for implementation. Issue: haskou/pigeon-swarm-ui#174.

## Problem

A community has one AES-256-GCM key that is generated at creation, stored in
every member's keychain and handed to newcomers inside the invite. Kicking,
banning or losing a member does not change it, so a removed member keeps
reading everything that was and will be encrypted with it. The same key also
protects call media. A role-restricted channel is only hidden by the node API;
its content is encrypted with the community key anyway.

## Decision

Use MLS (RFC 9420) through `ts-mls` with the cipher suite
`MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`.

| Scope                               | Group                                         |
| ----------------------------------- | --------------------------------------------- |
| Community text, polls, reactions    | one group, `groupId = communityId`            |
| Role-restricted channel (not yet)   | planned: `groupId = communityId:channelId`    |
| Call media, attachments             | MLS exporter of the owning group (below)      |
| Group conversations (non-community) | one group, `groupId = conversationId` (below) |
| Direct conversations                | out of scope: opaque 1:1 mailboxes            |

Group conversations do not use the node record transport. Their commits,
welcomes and messages travel through per-member group mailboxes, and the
mailbox generation `gen_k` is the MLS exporter
`("pigeon/group-mailbox/gen/v1", "", 32)` of the epoch after the last add or
removal, so a joiner exports it from its welcome. See "Generations from MLS" in
`docs/opaque-mailboxes-client.md`. The engine is `GroupMailboxMlsEngine`; it
reuses `MlsGroup` and `MlsStateStore` in a separate IndexedDB database. Its
leaves carry the same identity-signed credential as community leaves (see
"Identity binding"), each must be on the conversation roster, and only the
roster's managers may commit an add or a removal. Its state, its plaintext
cache and its generations are sealed with the device root, like the community
state (see "Security properties and limits").

Each leaf is a **device**, not an identity. An identity is in the group while
at least one of its devices is. Removing an identity removes all its leaves.

The old shared `communityKey`, `EncryptedCommunityKey`, invite key envelopes and
`Session.keychain.conversations[communityId]` community keys are removed. There
is no fallback to them and no migration path: a community created before this
change must be recreated.

### Identity binding

A leaf credential is `basic`. It names the Pigeon identity and device, and
carries the identity key's signature over the leaf's signature public key
(domain `pigeon:mls-leaf-credential:v1`). Nobody can present a leaf as another
identity's without that identity's key. A leaf is accepted only if all of these
hold:

1. The identity key it names signed the leaf's signature public key. A key
   package whose credential fails this check is skipped; a commit or welcome
   carrying such a leaf is rejected.
2. That identity is a current member of the community according to the
   authoritative community operation log (not according to the MLS roster), or
   on the conversation roster for a group conversation.
3. For a channel group, the identity can see that channel.

A client that receives a commit adding a leaf failing these checks rejects the
commit and does not advance the epoch. The community roster, which is signed and
converges independently, is the source of truth; the MLS roster must follow it.

### Transport

The node stores opaque, signed records and never parses MLS content. One record
shape for every group, `communities-api`:

```
POST /communities/{communityId}/mls/records
GET  /communities/{communityId}/mls/records?groupId=&kind=&afterEpoch=
{ id, groupId, kind: 'key_package' | 'commit' | 'welcome',
  epoch?, recipientIdentityId?, payload (base64), createdAt, mutation }
```

- `id` is derived from the record content, so a retry is idempotent:
  `base64url(sha256(canonicalize({epoch?, groupId, kind, payload,
recipientIdentityId?})))`, with an empty recipient omitted
  (`deriveMlsRecordId`). `src/test/fixtures/mls-record-id-vectors.json` is a
  copy of the node's fixture and pins the same bytes.
- `key_package`: author must be a community member. One use only; a client
  publishes a fresh one whenever it has fewer than 4 unused.
- `commit`: author must be a member; for a channel group, able to see the
  channel. `epoch` is the epoch the commit applies to.
  `afterEpoch` is strict: it returns records with `epoch > afterEpoch`.
- `welcome`: author must be a member; only the recipient (and the author) can
  read it.
- Reads return only what the caller may see: community members get key packages
  and commits for groups they can access; welcomes only to their recipient.

The node cannot order commits across replicas. Clients do it:

- A commit for epoch `n` is applied when received in order. Commits for epoch
  `n` from different authors are competing. The one with the **lowest record
  id** wins. A client that applied a different commit for epoch `n` rolls back
  to its retained epoch-`n` state (`ts-mls` states are immutable values) and
  applies the winner. Application messages encrypted in the losing epoch stay
  readable because that state is retained read-only.
- The loser re-issues its proposals on top of the winning epoch. Removals are
  idempotent: the client first checks whether the leaf is still in the group.
- A client never applies a commit with a gap. It fetches missing epochs and, if
  it cannot get them, asks to be re-added with a fresh key package. Rejoin uses
  the same Add and Welcome path.

### Who commits

The community roster (`CommunityMlsRoster`, built from the node's community)
decides, with the node's own rule for kicking: the managers are the owner and
the members whose roles, including `everyone`, grant `manage_members`.

- Add: only a manager. Every manager that sees a roster member's device
  without a leaf adds it, so each device of an identity joins, not only the
  first. One welcome per identity carries every new device of it; each device
  opens it with its own key package.
- Remove: any member removes a leaf whose identity left, was kicked or banned.
  Only a manager removes an identity still on the roster, and nobody removes
  the owner. Races are resolved by the lowest-id rule above.
- Update: anyone on the roster rotates their own leaf. Each device commits an
  empty update at most every 24 hours or after 1000 sent messages, whichever
  comes first, to bound post-compromise exposure.

Every commit is checked against these rules both when it is made and when it
is received; a commit that breaks them is skipped and the epoch does not
advance. A welcome opens only when the node names a manager as its author and
that manager holds a leaf in the welcomed group, so a member cannot welcome
anyone into a look-alike group. A removed device rejoins only from a welcome
newer than its last membership.

### History policy

A new member receives a Welcome for the current epoch only. They cannot read
messages from earlier epochs. The UI shows that fact when the history is missing.
Sharing earlier history is a separate, explicit feature and is not implied by
joining.

### Channel groups (not implemented)

Restricted channels currently share the community group, exactly as they shared
the old community key: the node API hides them, the cryptography does not.
The design below is the intended follow-up.

Granting a role access to a restricted channel adds that role's members to the
channel group; removing the grant or the role from a member removes the leaf.
The community group secret is never used for a restricted channel, so a member
without access has no key material to decrypt it.

### Purpose-separated secrets

Attachments keep a random per-attachment key, sent inside the message. Call
media keys come from the exporter of the owning group:
`exporter(label = "pigeon/call-media/v1", context = callId, length = 32)`.
Labels are distinct per purpose; there is no shared secret between text, media
and attachments, and a missing group is an error, not a fallback.

## Security properties and limits

- Forward secrecy and post-compromise security are those of MLS with the
  update cadence above. They hold only while every member updates.
- A member that is removed can read everything up to the epoch that removed
  them, including that commit. Messages sent after it are unreadable for them.
- The node and replicas see group ids, epochs, record sizes, authors and times,
  never content or keys.
- The credential is bound to the Pigeon identity by the rules above, not by an
  X.509 chain.
- `ts-mls` has not had a formal external audit (its README says so). This
  design is not audited either. The issue stays open until a specialist review.
- Concurrent commits depend on the lowest-id rule and on clients retaining the
  previous epoch state. Lost records are repaired by fetching, not guessed.
- MLS client state (leaf private keys, epoch secrets, key packages), the
  plaintext cache, the group generation log and the handled group control
  letters are sealed in IndexedDB with AES-256-GCM (`DeviceSealedEntryStore`,
  #376), each store under its own key derived by HKDF-SHA256 from the
  device-sealed root and its label: `pigeon-mls-state` (communities),
  `pigeon-group-mls`, `pigeon-group-generations` and `pigeon-group-control`
  (group conversations). A row is keyed by the identity id, its kind (`group`,
  `key-package`, `plaintext`, `generations`, `control-letter`) and an
  HMAC-SHA256 tag of its kind and ids; the AAD binds identity, kind and tag,
  and the ids are sealed with the value. At rest, only the identity id, the
  kinds and the row count per kind are readable. Values are decrypted when
  read; up to 2,048 plaintexts stay decrypted in memory (LRU), dropped on
  sign-out. A per-identity canary detects a root change: a canary that opens
  only under the root the session replaced (`previousDeviceSealedRootKey`,
  after a revoke) re-seals every row of the identity under the new root in one
  transaction, so the device keeps its groups, and its group generation
  inboxes bridge their readers to the new root (#405, see
  `opaque-mailboxes-client.md`, Group readers); one that opens under neither
  root drops the identity's rows. Forgetting the device deletes them. Rows
  stored unsealed before #376 are dropped by the database upgrade, never read.
  XSS in an unlocked session still reads the state in memory. Only the last 8
  epochs of secrets are retained (`retainKeysForEpochs`), so older ciphertext
  this device has not decrypted yet becomes unreadable.
- The roster, not MLS, is authoritative. Clients refuse to add identities that
  are not on the roster. In a community, every add or removal commit, made or
  received, is checked against the community roster (see "Who commits"). In a
  group conversation, every add or removal commit, made or received, is
  checked against the conversation roster: only the creator and the admins
  still on it (every member when it names neither) add devices or remove
  members; a removal of someone still on the roster follows the conversation
  rule (never the creator or the remover, an admin only by the creator). A
  commit that only rotates the committer's own leaf needs no role.
- A community welcome's author is the one the node records. A node that lies
  about it can only name a manager who already holds a leaf in that group.
- `authorIdentityId` inside a message payload is asserted by the sender. MLS
  authenticates the sender's leaf, and the UI does not yet display that proof.
- Call media keys are derived once, when the call starts. A group epoch change
  during a call (member join or leave) does not rekey it. Devices that derive
  the key in different epochs cannot decrypt each other's media.
- A community created before this change has no group. Its owner sees
  "awaiting group access" and must recreate the community; nothing bootstraps
  a group automatically, so two owner devices cannot fork one.
