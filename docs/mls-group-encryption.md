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
at least one of its devices is. Removing an identity removes all its leaves. In
a group conversation every device of a member holds its own leaf (#417): the
device leading its identity's leaves adds the identity's other listed devices
and removes the leaves of revoked ones, without a manager (see Device add and
Reconcile in `docs/opaque-mailboxes-client.md`).

The old shared `communityKey`, `EncryptedCommunityKey`, invite key envelopes and
`Session.keychain.conversations[communityId]` community keys are removed. There
is no fallback to them and no migration path: a community created before this
change must be recreated.

### Identity binding

A leaf credential is `basic`. It names the Pigeon identity and the device
credential, and carries two signatures over the leaf's signature public key,
one by the identity key and one by the device key (domain
`pigeon:mls-leaf-credential:v2\n`, over the canonical JSON of the identity id,
the device credential and the signature public key). Nobody can present a leaf
as another identity's without that identity's key, and a revoked device that
still holds the identity key cannot present a leaf as a current device's
without that device's key. A leaf is accepted only if all of these hold:

1. The identity key and the device key it names signed the leaf's signature
   public key. A key package whose credential fails this check is skipped; a
   commit or welcome carrying such a leaf is rejected.
2. That identity is a current member of the community according to the
   community's signed operations, replayed by the client itself (see "Where
   community roles get their trust"), not according to the MLS roster; or on
   the conversation roster for a group conversation.
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
  `n` from different authors are competing. In a community, the latest
  roster decides first (see "Which roster judges a commit");
  otherwise, and in a group conversation, the one with the **lowest record
  id** wins. A client that applied a different commit for epoch `n` rolls back
  to its retained epoch-`n` state (`ts-mls` states are immutable values) and
  applies the winner. Application messages encrypted in the losing epoch stay
  readable because that state is retained read-only.
- The loser re-issues its proposals on top of the winning epoch. Removals are
  idempotent: the client first checks whether the leaf is still in the group.
- A client never applies a commit with a gap. It fetches missing epochs and, if
  it cannot get them, asks to be re-added with a fresh key package. Rejoin uses
  the same Add and Welcome path.

A client keeps its own commit pending until the node holds it, as group
conversations do (#380, #418):

- Before publishing, it saves the group the commit leads to under
  `<groupId>#pending`, with the record id, the epoch and the welcome with its
  recipients. The stored group stays in its epoch.
- If publishing fails, the commit is abandoned: the group, its stored state
  and every secret derived from it stay in the epoch the other members are in.
  The pending stays, because the answer may have been lost after the node
  stored the commit.
- Once the node returns the record, the group advances and is saved, the
  welcomes are published, and only then is the pending cleared.
- On sync, a device that stopped after publishing adopts its pending group
  when the node lists that exact record id at that epoch, instead of trying to
  open its own commit. While the group stays in the pending's epoch the pending
  is kept. Once the group moved on, the welcome is sent again (welcome record
  ids are idempotent) if the group took this device's commit, and the pending
  is dropped.
- A commit that never reached the node is not re-sent. The device stays in the
  previous epoch and `reconcile` makes the change again from the roster. It
  syncs first, so a commit that did land is adopted before a new commit
  replaces the pending.

### Who commits

The community roster (`CommunityMlsRoster`, replayed from the community's
signed operations, see below) decides, with the node's own rule for kicking:
the managers are the owner and the members whose roles, including `everyone`,
grant `manage_members`.

- Add: only a manager. Every manager that sees a roster member's device
  without a leaf adds it, so each device of an identity joins, not only the
  first. One welcome per identity carries every new device of it; each device
  opens it with its own key package.
- Remove: any member removes a leaf whose identity left, was kicked or banned.
  Only a manager removes an identity still on the roster, and nobody removes
  the owner. Races are resolved by the epoch rule above.
- Update: anyone on the roster rotates their own leaf. Each device commits an
  empty update at most every 24 hours or after 1000 sent messages, whichever
  comes first, to bound post-compromise exposure.

Every commit is checked against these rules both when it is made and when it
is received, by the roster at the revision the commit binds (see "Which
roster judges a commit"); a commit that breaks them is skipped and the epoch
does not advance. A welcome opens only when the node names as its author a
manager, by the roster at the revision the welcome binds and by the joiner's
latest roster, who holds a leaf in the welcomed group, and every leaf in its
tree is a member at that revision, so neither a member nor a demoted manager
can welcome anyone into a look-alike group. A removed device rejoins only
from a welcome newer than its last membership.

### Which roster judges a commit

Members fold the signed operations at their own pace and the node may hand
them in any order, so "the latest roster" differs between members. A commit
is therefore judged by the roster its committer saw, not by the receiver's
latest one, and every member reaches the same verdict whatever order it sees
a demotion in (#420):

- Each commit binds a roster revision, its frontier: the sorted digests of
  the newest signed operations the committer had folded, standing for them
  and everything they descend from (`CommunityRosterHistory.heads`). The
  commit carries it as MLS authenticated data and its welcome as GroupInfo
  extension `0xf420`, both encoded as `pigeon:community-frontier:v1\n`
  followed by the digests, one per line, at most 256 (`MlsRosterFrontier`).
- A receiver replays the roster from the operations the frontier stands for
  (`CommunityRosterHistory.rosterAt`) and checks the commit against it. A
  frontier that names an operation the receiver has not verified judges
  nothing yet: the commit is skipped until the operation arrives.
- A group remembers the frontier of the last commit it applied, its baseline.
  A commit is accepted only when its frontier stands for every operation of
  the baseline (`CommunityRosterHistory.follows`), so revisions only move
  forward along the commit chain.
- Commits for one epoch rank by one key each, so any number of them
  converge on one winner whatever order they arrive in: first whether the
  latest roster the receiver verified, which holds every revision it can
  judge, still allows the commit, then how many operations its frontier
  stands for (`CommunityRosterHistory.reach`), then the lowest record id.
  A member removed by a commit that bound its removal cannot win that epoch
  back, whatever older or concurrent revision it binds and however low its
  id.
- Members that have verified different operations can rank two rivals
  differently, e.g. when only some already see a later demotion of one
  rival's committer, and then hold different winners for that epoch. A
  rival is ranked again, against the operations verified by then, only
  while sync still lists it and the device has not restarted; past that,
  such members cannot read each other (a known residual).
- A manager whose group bound a revision granting other rights than the
  latest one commits an empty update binding the latest revision on its next
  `reconcile` (`MlsCommunityEngine.bindRoster`).

What a node or a member can forge about this order:

- The node cannot forge or alter an operation (signed by its author's
  identity key) or a frontier (signed by the committer's leaf, under the
  epoch's AEAD). It can only withhold operations or commits, which delays a
  verdict and never changes it.
- A committer chooses which existing revision to bind, never one that does
  not exist. A demoted manager can backdate an add to a revision before the
  demotion, as long as no commit has yet bound the demotion or anything after
  it; that window closes once a manager who saw the demotion reconciles, and
  a backdated commit that loses the race for its epoch is discarded like
  any other.
- A device joining from a welcome has no baseline yet, so it cannot tell a
  backdated welcome from an honest one. Such a welcome lands a roster member
  on a fork no other member follows; it never admits anyone the bound roster
  did not, and the member rejoins from the next welcome.
- A welcome whose author the joiner already sees demoted opens nothing, even
  when the add it belongs to was made while the author was allowed and every
  member accepted it. The joiner's leaf stays in the group unused until a
  manager removes it; no path re-welcomes it.
- A commit or welcome that binds no revision (made before #420) is judged by
  the roster of no operations, which admits nobody, so such a group stops
  taking membership commits until a manager binds a revision.

### Where community roles get their trust

Members and roles come from the community's operation log, never from the
community the node folds and serves. Every operation is signed by its author's
identity key, the same key that signs the leaf credentials, so its trust goes
back to the community's creator and to nobody else:

- An operation's id is `community:<communityId>:op:<digest>`, where `digest`
  is `base64url(sha256(canonicalJson(content)))` and `content` is the
  operation without `id` and `identitySignature`. `identitySignature` is the
  author's ed25519 signature, with its identity key, over
  `pigeon:community-operation:v1\n` followed by the id
  (`CommunityOperationProof`). Clients send it with every community change;
  `src/test/fixtures/community-operation-vectors.json` is a copy of the node's
  fixture and pins the same bytes.
- `GET /communities/{communityId}/operations?after=&limit=` serves the
  operations verbatim, by digest, to members (`PigeonCommunityOperationsApi`).
  The client keeps only those whose content, address, community and identity
  signature check out; the genesis must have no parents and create the very
  id its author derives from it.
- `CommunityOperationFold` replays them as the node does: parents first, the
  lowest digest first among concurrent operations, each one applied only when
  the state before it lets its author make it (`CommunityAuthority`: owner,
  `manage_members`, `manage_roles`, `ban_members`, derived role ids, bans,
  joins), an author's operations beyond 1,000 skipped, nothing applied once
  the community has no members.
- Whatever the signed history does not prove is absent. An operation the node
  forged or altered fails its signature; one its author had no right to make
  is skipped; one whose parents are missing proves nothing, nor does anything
  built on it. Without a genesis no one may commit or welcome.

The node can still withhold operations: a member who does not receive a
demotion keeps trusting the demoted manager until it does. Joins by
`invitation` or `invite_link` are trusted on the joiner's signature alone,
since the client cannot see the invitation they cite. Neither lets a node
give anyone a right no signed operation granted.

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
- Concurrent commits depend on the epoch rule and on clients retaining the
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
  received, is checked against the community roster at the revision it binds
  (see "Which roster judges a commit"). In a
  group conversation, every add or removal commit, made or received, is
  checked against the conversation roster: only the creator and the admins
  still on it (every member when it names neither) add devices or remove
  members; a removal of someone still on the roster follows the conversation
  rule (never the creator or the remover, an admin only by the creator). A
  commit that only rotates the committer's own leaf, or only adds or removes
  leaves of the committer's own identity, needs no role. A device welcomed by
  its own identity joins only when the group already holds another leaf of
  that identity and an identity other than it, and the roster lists the
  identity of every leaf. Residual: until its leaf is removed, a revoked device
  can add or remove leaves of its own identity, and it can welcome a sibling
  device that is still waiting for its leaf into a look-alike group of that
  conversation, whose leaves hold only roster members, so it reads what the
  sibling sends there (a confidentiality gap, not only a denial of service).
  Other members cannot verify an identity's device list; when an identity's
  only leaf device is revoked, a manager must add the identity again.
- A community welcome's author is the one the node records. A node that lies
  about it can only name a manager, by the signed operations, who already
  holds a leaf in that group.
- `authorIdentityId` inside a message payload is asserted by the sender. MLS
  authenticates the sender's leaf, and the UI does not yet display that proof.
- Call media keys are derived once, when the call starts. A group epoch change
  during a call (member join or leave) does not rekey it. Devices that derive
  the key in different epochs cannot decrypt each other's media.
- A community created before this change has no group. Its owner sees
  "awaiting group access" and must recreate the community; nothing bootstraps
  a group automatically, so two owner devices cannot fork one.
- Leaf credentials changed from `v1` (identity signature only) to `v2`
  (identity and device signatures, #417). There is no migration: MLS state and
  key packages stored with `v1` leaves no longer verify, so a group or
  community created before this change must be recreated.
