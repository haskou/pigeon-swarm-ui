# MLS group encryption for communities (ADR)

Status: accepted for implementation. Issue: haskou/pigeon-swarm-ui#174.

## Problem

A community has one AES-256-GCM key that is generated at creation, stored in
every member's keychain and handed to newcomers inside the invite. Kicking,
banning or losing a member does not change it, so a removed member keeps
reading everything that was and will be encrypted with it. The same key also
protects call media. A role-restricted channel was only hidden by the node API;
its content was encrypted with the community key anyway.

## Decision

Use MLS (RFC 9420) through `@haskou/pigeon-swarm-crypto/mls` (`MlsGroup`,
`MlsKeyPackage`; its `docs/mls-group.md`), which wraps `ts-mls` with the
cipher suite `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`. The client
imports no `ts-mls` code of its own.

| Scope                               | Group                                            |
| ----------------------------------- | ------------------------------------------------ |
| Community text, polls, reactions    | one group, `groupId = communityId`               |
| Role-restricted channel             | its own group, `groupId = communityId:channelId` |
| Call media, attachments             | MLS exporter of the owning group (below)         |
| Group conversations (non-community) | one group, `groupId = conversationId` (below)    |
| Direct conversations                | out of scope: opaque 1:1 mailboxes               |

Group conversations do not use the node record transport. Their commits,
welcomes, messages, polls, typing notices and identity updates travel through
per-member group mailboxes, and the mailbox generation `gen_k` is the MLS exporter
`("pigeon/group-mailbox/gen/v1", "", 32)` of the epoch after the last add or
removal, so a joiner exports it from its welcome. See "Generations from MLS" in
`docs/opaque-mailboxes-client.md`. The engine is `GroupMailboxMlsEngine`; it
reuses `MlsGroup` and `MlsStateStore` in a separate IndexedDB database. Its
leaves carry the same identity-signed credential as community leaves (see
"Identity binding"), each must be on the conversation roster, and only the
roster's managers may commit an add or a removal. A manager's add of another
member is committed by the device, and the session, that asked that member
for its key package; any other device of the manager ignores the answer, so a
sibling that never reads it cannot hold the add back (#509). The engine's
state, its plaintext cache and its generations are sealed with the device
root, like the community state (see "Security properties and limits").

Each leaf is a **device**, not an identity. An identity is in the group while
at least one of its devices is. Removing an identity removes all its leaves. In
a group conversation every device of a member holds its own leaf (#417): the
device leading its identity's leaves adds the identity's other devices and
removes the leaves of revoked ones, without a manager (see Device add and
Reconcile in `docs/opaque-mailboxes-client.md`). Which devices are current
comes from the identity's signed device transitions, replayed and verified
on the device, never from the node's device list (#441).

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
  (`CommitmentId.mlsRecord` from `@haskou/pigeon-swarm-crypto`, pinned by
  the library's shipped `vectors/commitment-ids.json`).
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
  roster decides first (see "Which roster judges a commit"); otherwise the
  one with the **lowest record id** wins. In a group conversation, the
  conversation roster ranks them first and the **lowest commit id** only
  settles equal ranks (see "Same-epoch rivals" in
  `docs/opaque-mailboxes-client.md`). A client that applied a different
  commit for epoch `n` rolls back to its retained epoch-`n` state (MLS
  states are immutable values) and applies the winner. Application messages
  encrypted in the losing epoch stay readable because that state is retained
  read-only. A group in epoch `m` lists commits with `afterEpoch = m - 2` and
  drops any older one the node lists anyway, so a rival only ever displaces
  the last commit it took.
- The loser re-issues its proposals on top of the winning epoch. Removals are
  idempotent: the client first checks whether the leaf is still in the group.
- A client never applies a commit with a gap. It fetches missing epochs and, if
  it cannot get them, asks to be re-added with a fresh key package. Rejoin uses
  the same Add and Welcome path.

A client keeps its own commit pending until the node holds it, as group
conversations do (#380, #418):

- Before publishing, it saves the group the commit leads to under
  `<groupId>#pending`, with the commit itself, its record id, the epoch and
  the welcome with its recipients. The stored group stays in its epoch.
- If publishing fails, the commit is abandoned: the group, its stored state
  and every secret derived from it stay in the epoch the other members are in.
  The pending stays, because the answer may have been lost after the node
  stored the commit.
- Once the node returns the record, the group advances and is saved, the
  welcomes are published, and only then is the pending cleared.
- On sync, a device that stopped after publishing adopts its pending group
  only when the node lists that record id at that epoch carrying the exact
  commit bytes it saved, instead of trying to open its own commit. A record
  under that id with other bytes or at another epoch is not this device's
  commit: the pending is dropped, never adopted, and the device syncs as
  usual. While the group stays in the pending's epoch the pending is kept.
  Once the group moved on, the welcome is sent again (welcome record ids are
  idempotent) only if this device's commit won its epoch, and the pending is
  dropped. It won once the group took it, in that sync or as the record of
  what the group took says, until a rival replaced it or a commit of an
  earlier epoch undid it; the record forgetting that epoch as the group
  moves on, two epochs later, does not make it lose, so a sync that applies
  many commits after it still sends the welcome. The welcome goes out before
  the group is saved, so a stop in between sends it again on the next sync.
  A commit that lost its epoch is not in the group, so neither is the joiner
  it named, and a manager's `reconcile` admits that joiner again.
- A commit that never reached the node is not re-sent. The device stays in the
  previous epoch and `reconcile` makes the change again from the roster.
  `admit` and `remove` sync first, whoever calls them, so a commit that did
  land is adopted before a new commit is built, in the epoch the others are
  in, and replaces the pending.
- One device commits one change at a time per group. A call that caught up
  before another call of the same device committed would build on that
  commit's group; if the other commit is still pending, because its welcome
  was not sent or its answer was lost and the node lists it, the commit is
  refused (`MlsRejectedError`) rather than replacing the pending, and the
  next sync settles it first. A pending in the group's epoch that the node
  does not list never reached it and is replaced.
- Once sync finds the device removed, it deletes `<groupId>#pending`, with
  the welcome in it, so a device admitted again never sends a welcome from
  its earlier membership. A welcome that lets the device in again deletes it
  too, as well as what its earlier group took, even when the sync that
  would have seen the removal never ran. A device that forgets an identity
  deletes every group of it, pending commits included.
- Which commit the group took in each epoch sync still lists is kept under
  `<groupId>#taken` (`MlsTakenCommits`), saved before the group state and
  only trusted for the epoch that state is in: a stop between the two saves
  leaves the group in the epoch it was in, whose record it ignores, never a
  group past an epoch whose commit it does not know. Across a restart, sync
  skips a commit the group already took rather than applying it again, and
  judges whether its own pending commit won the epoch by that record rather
  than by which commits it could still apply.

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
- Update: anyone on the roster rotates their own leaf. Every device commits
  an update of its own leaf on a cadence (`MlsUpdateCadence`): a day plus a
  random jitter of up to an hour after its leaf keys were last renewed, or
  once it sent 1000 messages since. Creating or joining the group, and every
  update or removal this device commits, renews them; an add, which carries
  no update path, does not. A cadence stamped after the current time, from a
  skewed clock or a written store, is due. The cadence is checked before each
  message this device encrypts (community) or queues (group conversation),
  and on each reconcile, so a device that comes back after a day updates on
  its first pass. Before a due update the device catches up: a community
  syncs its commits, and a group conversation reads its inboxes, keeping the
  records it read for the next sync, so the update is made in the epoch the
  other members are in. A read that ends after its identity stopped keeps
  nothing; the history replays what it read. A failed read still lets it
  update, as it does offline. In a group conversation's reconcile the update
  comes after the lead device's removals of revoked devices, so a failing
  update never holds one back. When the update a group message needs fails,
  the message is not queued: it shows as failed with a retry, and the update
  stays due. The
  cadence is sealed next to the group state; a group without a readable
  cadence is due. Two devices updating in the same epoch race like any
  commits: the losing device's update is undone, its cadence is due again
  and it updates once more. A group message this device sealed in the
  generation of an update that then lost is not lost with it: the outbox
  keeps each delivered message, with the members its copies reached, while
  a rival commit could still win the epoch of their generation (8 epochs,
  the states the group keeps to switch to a rival), and once a rival won,
  however long ago, it re-encrypts the message in the epoch that won and
  sends it again to those members; a member that already read it keeps one
  copy, by its record id. One it can no longer encrypt, as after this
  device's removal, is dropped like any record the outbox drops
  (`opaque-mailboxes-client.md`, Outbox). A message an older build queued
  lacks that state: on load it is re-encrypted in the current epoch for the
  members its copies had not reached, and a commit takes the generation of
  its index, or is dropped once that one drained. In a community a manager's device also
  commits an update when the roster revision the group bound
  grants other rights than the latest, or when the group took an add by a
  member the latest roster no longer lets add members and no member it lets
  add members has committed since (`bindRoster`). In a group conversation an
  update advances the generation like every commit
  (`opaque-mailboxes-client.md`).

Every commit is checked against these rules both when it is made and when it
is received, by the roster at the revision the commit binds (see "Which
roster judges a commit"); a commit that breaks them is skipped and the epoch
does not advance. A welcome opens only when the leaf that signed it, whoever
the node names as its author, is a manager by the roster at the revision the
welcome binds, and every leaf in its tree is a member at that revision, so a
member cannot welcome anyone into a look-alike group. When the joiner's
latest roster no longer lets that signer add members, the welcome opens only
once a member that roster lets add members has committed in the group after
it, so a demoted manager cannot either. A removed device rejoins
only from a welcome newer than its last membership.

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
  followed by the digests, one per line, at most 256 (library
  `MlsRosterFrontier`).
- A receiver replays the roster from the operations the frontier stands for
  (`CommunityRosterHistory.rosterAt`) and checks the commit against it. A
  frontier that names an operation the receiver has not verified judges
  nothing yet: the commit is skipped until the operation arrives. When the
  latest roster the receiver verified lets the committer add members, the
  commit also proves the node holds operations it has not served, which may
  demote a manager the receiver still trusts (see "Where community roles get
  their trust").
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
  latest one, or took an add by a member the latest roster no longer lets add
  members with no commit since by one it does, commits an empty update
  binding the latest revision on its next `reconcile`
  (`MlsCommunityEngine.bindRoster`).

What a node or a member can forge about this order:

- The node cannot forge or alter an operation (signed by its author's
  identity key) or a frontier (signed by the committer's leaf, under the
  epoch's AEAD). It can only withhold operations or commits. Withholding a
  commit delays a verdict and never changes it; withholding an operation a
  served commit binds stops the group until it arrives (see "Where
  community roles get their trust").
- A committer chooses which existing revision to bind, never one that does
  not exist. A demoted manager can backdate an add to a revision before the
  demotion, as long as no commit has yet bound the demotion or anything after
  it; that window closes once a manager who saw the demotion reconciles, and
  a backdated commit that loses the race for its epoch is discarded like
  any other.
- A device joining from a welcome has no baseline yet, so it cannot tell a
  backdated welcome from an honest one. Such a welcome lands a roster member
  on a fork no other member follows; it never admits anyone the bound roster
  did not. Nothing welcomes the member into the real group while this device
  holds the fork: what it sends there reaches only the fork's leaves (a known
  residual).
- A joiner that already sees a welcome's author demoted cannot tell an add
  every member took while the author was allowed from a backdated one. It
  keeps its key package and opens the welcome only once a member its latest
  roster lets add members has committed in the group after the add
  (`MlsCommunityEngine.open`). Every manager that sees the demotion commits
  one on its next `reconcile` (`bindRoster`), so the joiner gets in on its
  next sync without anyone welcoming it again. That commit proves a manager
  the joiner trusts took the add; a demoted manager's look-alike group, or
  an add no such manager took, never gets one from a manager's device the
  demotion was served to. A manager's device the node withholds the
  demotion from may still commit there, or welcome the joiner itself, as
  long as the node keeps withholding it from that device (see the bounds
  below).
- A commit or welcome that binds no revision (made before #420) is judged by
  the roster of no operations, which admits nobody, so such a group stops
  taking membership commits until a manager binds a revision.

### Where community roles get their trust

Members and roles come from the community's operation log, never from the
community the node folds and serves. Every operation is signed by its author's
identity key, the same key that signs the leaf credentials, so its trust goes
back to the community's creator and to nobody else:

- An operation's id is `community:<communityId>:op:<digest>`, where `digest`
  is `base64url(sha256(CanonicalJson.serialize(content)))` and `content` is the
  operation without `id` and `identitySignature`. `identitySignature` is the
  author's ed25519 signature, with its identity key, over
  `pigeon:community-operation:v1\n` followed by the id
  (`CommunityOperationProof`). Clients send it with every community change;
  `@haskou/pigeon-swarm-crypto/vectors/community-operation.json` pins the
  same bytes the node checks.
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

The node can still withhold operations, but a member detects a demotion it
withholds as soon as it is served a commit that binds it. A commit whose
frontier names an operation the member has not verified, made by someone the
latest roster the member verified lets add members, is a witness
(`MlsGroup.waiting`). Until the operations it names arrive, the group takes
no commit and makes none, and it steps back to before the first add by
another leaf that it took in or after the witness's epoch: whoever a manager
the withheld operations may demote added is out again. Messages are still
sent and read in the epoch it stays in, and once the operations arrive it
takes again the commits that still hold, resuming the epochs it left, so its
sending generations there go on. A step back never undoes a commit this
device made, which the node could not have withheld from it. Since sync
takes no commit from before the epoch preceding the group's, one step back
undoes at most the last commit the device took; a node serving older
witnesses sync after sync walks it back one commit at a time, and a removal
in what it undoes is undone with it. Any state it steps back to is one the
node could already keep the member in by withholding commits. A
member the latest roster does not let add members cannot stop a group this
way; a manager binding a digest of no operation stops it until that manager
is demoted, and what it keeps readable meanwhile it could forward anyway.
The node can still delay distrust:

- until a manager's commit that binds the demotion is served: an add the
  demoted manager made before any such commit stands, as any backdated add
  does;
- by withholding those commits too, or serving one only once the member has
  moved more than one epoch past it, beyond what sync takes;
- across a restart, which keeps only which commit a group took, not the
  states before them, and forgets the epochs it left: it then steps back
  from nothing, a manager no longer commits for a
  joiner left waiting, who waits for the next manager commit instead, and a
  commit taken again after a step back starts this device's sending
  generations in that epoch over, so members refuse its messages there up to
  the generations they already read (MLS's reuse guard keeps the nonces
  apart);
- for a joiner's welcome, which has no earlier epoch to step back to; and
- while replication lags, which only delays.

Joins by `invitation` or `invite_link` are trusted on the joiner's signature
alone, since the client cannot see the invitation they cite. Neither they
nor withheld operations let a node give anyone a right no signed operation
granted. An `invite_link` join names the link by its reference, never by the
token: every member reads the operations, and the token alone lets anyone
join. The reference is
`base64url(sha256("pigeon:community-invite-reference:v1\n" + token))`
(`CommunityInviteReference.of`). The `invite_link_created` moderation log entry
names the link by the same reference, since roles that may read the log
need not be allowed to invite.

The token itself is
`base64url(sha256(JSON([communityId, creatorIdentityId, nonce, maxUses,
expiresAt ?? null])))` (`CommitmentId.communityInviteToken`), with `maxUses` 1 and
`expiresAt` null when the creator sets none. It commits to the limits, so the
node refuses a link whose stored limits differ from those the creator chose.
Only the accepting node counts uses against `maxUses`; replicas do not cap
joins per reference, and the join operation does not carry the limits.

### History policy

A new member receives a Welcome for the current epoch only. They cannot read
messages from earlier epochs. The UI shows that fact when the history is missing.
Sharing earlier history is a separate, explicit feature and is not implied by
joining.

### Channel groups

A channel that only some roles may see (its signed `visibleRoleIds` do not
include `everyone`) has its own group, `communityId:channelId`. Its messages
and call media keys come from that group; the community group secret is never
used for it, so a member without access has no key material to decrypt it.
Every channel everyone may see stays on the community group.

- The channel group's roster is the community roster narrowed to the members
  who may see the channel by the signed operations: the owner and the members
  holding one of its visible roles (`CommunityMlsRoster.replay(operations,
channelId)`). Its managers are those members who may add members. A
  channel's restriction, its roles and their assignments count only when a
  `channel_permissions_updated`, `role_created` or `member_roles_updated`
  signed by an author allowed to make it says so (`CommunityAuthority`); the
  node's `visibleRoleIds` change nothing. A deleted or unknown channel has an
  empty roster. A commit judged by a frontier is checked against the channel
  roster at that revision (`CommunityRosterHistory.of(operations,
channelId)`); frontiers stay community operation heads.
- Granting a role adds its members to the group, as a manager reconciles.
  Removing the grant, the role from a member, or the member from the
  community makes the member's leaves removable by any member, and every
  manager who may see the channel removes them on its next reconcile; the
  next epoch excludes them.
- Who starts it: only the device whose identity signs the restricting
  `channel_permissions_updated`, only in a community that is not public, and
  only when that identity manages the channel roster, this device holds no
  state for the group and the node holds no commit for it. It then syncs
  every group at once, which admits the others. Before signing, the client
  refuses a restriction whose group its identity could not start: it must be
  the owner, or may add members and keeps seeing the channel
  (`CommunityAuthority.canKeyRestrictedChannel`,
  `CommunityChannelRestrictionRefusedError`). Other managers never start a
  channel group, so two of them cannot fork one.
- Each device syncs the community group, then the group of every restricted
  channel it may see; a channel group that fails to sync is unreadable and
  does not stop the others. The channel's state ("awaiting group access" or
  ready) is that of the group of the channel shown.
- Writes follow the signed operations read at the time of the write: a
  message or a call media key goes to the channel group from the first write
  after the restriction, and back to the community group once the channel is
  open to everyone. A channel the signed operations do not show (created
  before them, or by an operation they reject) cannot be restricted by them
  and stays on the community group. A message opens only with the community group or the
  group of the channel it was listed in, as its MLS framing names it, so the
  node cannot move a message from one channel into another. A channel open
  again stops syncing its group, which still reads what it sealed; restricted
  again, the same group resumes.
- Key packages are published per group (`groupId` of the `key_package`
  record). A device keeps a stock of 4 unused ones for each group it may
  read, so admitting it into one group never spends another's stock.
  Packages stored before this change carry no group and are never counted.

### Purpose-separated secrets

Attachments keep a random per-attachment key, sent inside the message. Call
media keys come from the exporter of the owning group, through the library's
fixed-label `MlsGroup.callMediaKey(callId)`:
`exporter(label = "pigeon/call-media/v1", context = callId, length = 32)`.
The client has no generic exporter, so it cannot export under another label.
Labels are distinct per purpose; there is no shared secret between text, media
and attachments, and a missing group is an error, not a fallback.

A private call (a conversation call, or a call in a community whose signed
genesis does not make it public) never falls back to plaintext media
(`resolveWorkspaceCallMediaEncryption`, `useCallStartActions`). Visibility comes
from folding the community's signed operations (`CommunityOperationFold`), not
from the node's community list; operations that fail to load or fold count as
private. There is no switch to turn call E2EE off.

- Each audio and video frame is sealed in the library's PSCE2 format
  (`CallMediaFrameSealer`, `CallMediaFrameOpener`, haskou/pigeon-swarm-crypto#54):
  `PSCE2`, the key epoch, a random sealer id and a frame sequence, then the
  AES-GCM ciphertext, with the call id, the sender's identity id and the track
  (`audio`, `video`, `screen-audio`, `screen-video`) bound in. A frame moved
  to another call, sender or track does not open, and each opener drops a
  frame it already opened (a 1024-frame replay window). Each device seals with
  one sealer per call and epoch, shared by all its senders, and opens each
  member with one opener, shared by all receivers of that member and dropped
  when the member leaves. Whether a peer's media is encrypted comes from its
  negotiation, never from the frame bytes: on a private call every inbound
  frame goes to the opener, and one that does not open is dropped. PSCE1
  frames and version 1 offers are refused.
- Community call keys carry the MLS epoch they were exported in. During a
  private community call the client synchronises the channel group every 15 s
  (`useCallMediaRekey`) and moves the call to the key of a newer epoch: it
  seals with a new sealer from then on, and each opener keeps the previous
  epoch only until the first frame of the new one opens. Conversation calls
  stay on epoch 0.
- `CallMediaFrameCodec` runs the sealer and openers. A browser with
  `RTCRtpScriptTransform` runs it in a dedicated worker: the raw key of each
  epoch is transferred to that worker, and the media cipher on the page keeps
  no copy of it. A Chromium build without `RTCRtpScriptTransform` runs the
  same codec on encoded insertable streams (`createEncodedStreams`). Both
  produce the same frames, so members on either path hear each other.
- A worker transform is attached to each sender and receiver in the task
  that creates it: when a local track is added, when a receive-only peer is
  created, and when a remote description changes the signaling state.
  Chromium lets the frames of a sender or receiver that has no transform by
  the end of that task pass untouched for good, even if a transform is set
  later. A peer that admits the other side checks every sender and receiver
  again. The encoded-streams path does not have this gap: a peer created
  with `encodedInsertableStreams` holds every frame until its streams exist.
- A browser with neither `RTCRtpScriptTransform` nor encoded streams cannot
  encrypt call media. It does not start, join or answer a private call: the
  check runs before the microphone prompt and before the node is asked, and
  an incoming call is declined. The refusal asks to update the browser or use
  another one; it names no browser.
- If a frame transform cannot be attached, or the encryption worker fails,
  the call's media cipher fails for good. That sender's or receiver's media
  is stopped instead of passing unencrypted, and no local track is added to
  a peer again. A private call on a browser with no cipher adds none either.
  The call then announces no encrypted media and admits no peer, and its
  remote tiles stop showing E2EE as active.
- A device with no key for the call (no conversation key, or no community
  group) finds out only once the node has created or joined the call. It
  leaves the call at once and shows the reason. Until the leave lands, the
  other side may see the call ring, or this identity in the channel; no media
  is sent.
- Public community calls never use media E2EE and stay open to every browser.
- A group call (node scope `group_capability`, named by a capability hash and
  not by its group) has no media key on this client, which does not offer
  group calls yet (#492). The client never starts one
  (`GroupCallCannotBeStartedError`), refuses its media
  (`resolveWorkspaceCallMediaEncryption`) and ends or dismisses one it sees
  (`workspace:call:ended-unsupported-group-call`).
- A device in a private call refuses any peer whose offer or answer does not
  announce PSCE2 encrypted media (`CallMediaEncryption.admits`): it never sets
  that peer's description, so no media flows either way. Outbound frames are
  always sealed, and inbound frames that do not open for their sender and
  track are dropped rather than played.

`resolveWorkspaceCallMediaEncryption.spec.ts`, `useCallStartActions.spec.ts`,
`PigeonCallRepository.spec.ts`, `CallPeerConnections.spec.ts`,
`ScriptTransformCallMediaCipher.spec.ts`, `serveCallMediaEncryption.spec.ts`
and `EncodedStreamsCallMediaCipher.spec.ts` (`yarn test`) cover the refusals,
the frame format and the public community exception.
`e2e/call-media-encryption.spec.ts` proves in CI that a private call between
Firefox or Chromium and Chromium decodes audio only when both ends hold the
call key. Safari is not covered by CI.

## Security properties and limits

- Forward secrecy and post-compromise recovery are those of MLS, limited as
  follows (the library's `MlsGroup` specs; `MlsCommunityEngine.spec.ts`,
  `yarn test:crypto`):
  - A message key is deleted once it is used. The reader cannot open the
    message again, also not from its stored state, and the sender keeps no
    key for its own message. A copy of the state taken before the read still
    opens it.
  - Epoch secrets are kept for the current epoch and the 8 before it
    (`retainKeysForEpochs`) and then deleted. A message of an older epoch
    that this device has not read stays unreadable, also from the stored
    state. Within those epochs, MLS keeps the keys of up to 10 skipped
    messages per sender (`retainKeysForGenerations`).
  - In memory, a group also keeps the state before every commit it applied
    in this app session, so that it can switch to a competing commit. Those
    states hold older epoch secrets, call-media exporters included, until the
    app reloads (#479).
  - Forward secrecy covers keys, not what was read. The community engine
    keeps every plaintext it sent or decrypted (the plaintext cache, sealed
    as below), so a restarted device reads a message again after its key is
    gone. Group conversation histories keep their records too. Whoever opens
    the device's state reads whatever it still stores.
  - Post-compromise recovery is per device. A device whose state leaked
    recovers only when it commits its own update: the update path encrypts
    the new path secrets to the other members' keys only, so a copy of the
    old state cannot apply that commit and holds no secret of a later epoch.
    By the library (`needsUpdatePath`), a removal it commits carries an update
    path too and a commit that only adds carries none; no spec covers those
    two cases. Commits by other members, their updates included, do not heal
    it: a copy of its state follows them and keeps reading messages and
    call-media keys until the device commits an update or a removal, or is
    removed. Every device commits an update on the cadence of "Who commits",
    so a device that keeps running heals within a day and an hour, or
    within 1000 messages it sends; one that stays offline stays exposed
    until it comes back or is removed. The specs: "commits an update of its
    own leaf on a cadence" in `MlsCommunityEngine.spec.ts` and
    `GroupMailboxMlsEngine.spec.ts`, which also show a copy of the old state
    cannot read what follows; `MlsUpdateCadence.spec.ts`; and
    `GroupMailboxInboxSync.spec.ts`, where no message of the epoch an update
    starts or ends is lost.
  - An update replaces the leaf's encryption key, not its signature key, and
    the identity-signed credential binds that signature key. Whoever copied a
    device's state can therefore sign as that leaf until the device is
    removed, even after it healed.
  - History backups hold one-to-one records and contact pins only, never MLS
    state or group history. Forward secrecy does not cover them (see
    `local-unlock.md`, History backup; `PigeonHistoryBackup.spec.ts`).
- A member that is removed can read everything up to the epoch that removed
  them, including that commit. Messages sent after it are unreadable for them.
- The node and replicas see group ids, epochs, record sizes, authors and times,
  never content or keys.
- The credential is bound to the Pigeon identity by the rules above, not by an
  X.509 chain.
- `ts-mls` has not had a formal external audit (its README says so). This
  design is not audited either. The issue stays open until a specialist review.
- The library builds commits itself where `ts-mls` 1.6.4 gets RFC 9420
  §12.4.2 wrong: a commit that changes the GroupContext and carries an
  UpdatePath, as a group conversation's roster removal does, encrypts that
  path to the new context (library `docs/mls-group.md`, "UpdatePath and
  GroupContextExtensions"). The client applies no patch to `ts-mls`.
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
  XSS in an unlocked session still reads the state in memory, including the
  states before earlier commits (#479).
- The roster, not MLS, is authoritative. Clients refuse to add identities that
  are not on the roster. Every commit, made or received, in a community or a
  group conversation, is judged by verified leaf owners only: the committer's
  leaf, every removed leaf and every added key package must carry a
  credential that both the identity and the device it names signed for that
  leaf's key, so the device chains to the identity (#375, #441). The identity
  in the credential alone counts for nothing; a commit whose committer leaf
  does not verify is rejected, whatever it carries. The commit's update path
  must leave the committer's leaf verified as the same identity and device,
  so a committer cannot hand its leaf to another identity. In a community,
  every add or removal commit, made or received, is checked against the
  community roster at the revision it binds (see "Which roster judges a
  commit"). In a
  group conversation, every add or removal commit, made or received, is
  checked against the conversation roster: only the creator and the admins
  still on it (every member when it names neither) add devices or remove
  members; a removal of someone still on the roster follows the conversation
  rule (never the creator or the remover, an admin only by the creator). A
  commit that only rotates the committer's own leaf, or only adds or removes
  leaves of the committer's own identity, needs no role. A group conversation
  welcome opens only when the leaf that signed it belongs to the identity the
  welcome arrived from. A device welcomed by its own identity joins only when
  the welcoming device is in that identity's verified device set, the group
  already holds another leaf of that identity and an identity other than it,
  and the roster lists the identity of every leaf. A device makes or applies
  a commit by its own identity, whatever it changes, only when the committing
  device is in that verified set; until the set is known, it accepts none.
  The verified set is replayed from the
  identity's signed device transitions at their head, fetched with this
  device's proof before each such check, so a revoked device is refused at
  once, before its leaf is removed; a fetch that fails or does not verify
  leaves the welcome or commit to be tried again. Residuals: the transitions
  of another identity are readable only by that identity's own devices, so
  for a peer's commit the only device chain a member checks is the leaf
  credential. A revoked device that keeps the identity key can still sign
  credentials as that identity, so other members accept its commits, with
  whatever the roster lets that identity do, until its leaf is removed. A
  legitimate welcome or commit made just before its author was revoked is
  refused by a
  sibling that checks after the revoke: a refused welcome leaves the
  sibling's leaf in the group unread by it, and a refused commit leaves the
  sibling behind the group's epoch, a denial of service, never a read. When
  an identity's only leaf device is revoked, a
  manager must add the identity again.
- Same-epoch rivals in a group conversation rank by the receiver's latest
  roster before their commit id: a commit by the creator first, then one that
  removes another identity, then the rest. A commit id is derived from the
  commit bytes, which the committer chooses, so it can grind a low id; that
  only wins among equal ranks, so a member cannot win back the epoch of its
  own removal, nor an admin one the creator commits. Residuals: rivals of
  equal rank still fall to the id, so an admin that grinds a low id wins
  against another admin's removal, and any commit by the creator, also one
  that only adds a device, displaces an admin's removal; the displaced
  removal waits for the next reconcile to commit it again. Two devices of
  one identity rank alike, so a revoked device that races the removal of its
  own leaf by a sibling device wins on a lower id wherever its commit is
  still accepted (see the residual above), until the sibling's next
  reconcile removes it again. A member that was offline may adopt the losing
  commit first and switches when the winner arrives; one offline for longer
  than its inbox keeps the winner may never see it and stays on the losing
  branch.
- A community welcome's author is the one the node records. A node that lies
  about it can only name a manager, by the signed operations, who already
  holds a leaf in that group.
- `authorIdentityId` inside a message payload is asserted by the sender. MLS
  authenticates the sender's leaf, and the UI does not yet display that proof.
- Call media keys follow the channel group's epoch only through the 15 s poll:
  for up to one poll after a member joins or leaves, devices may seal under
  different epochs, and a device that missed an epoch in between cannot open
  the frames of one two epochs ahead until it catches up. Restricting or
  reopening a channel during a call moves it to another group, so a device
  that joins afterwards derives a different key and gets no media.
- Every member of a call holds the same call key, so a member can seal frames
  as any other sender of the call and can use up the 64 sealers an opener
  accepts per epoch. Call media has no per-sender authentication.
- Each device keeps the newest epoch's call key for the call's duration, to key
  the opener of a member it first hears later; the bytes are overwritten with
  zeros when a newer epoch replaces them or the call ends.
- A peer refused for plaintext media is not remembered. Later ICE candidates or
  a call reconcile may create a fresh peer connection for it, which is refused
  again at its next description; expect connection churn but no media.
- A client from before #472 that offers unencrypted media cannot join a private
  call with this one.
- The community id is derived from the network, author and nonce, not the
  genesis arguments. The author could sign two geneses with the same id and
  different visibility; the node cannot forge one.
- A channel group exists only once the identity that restricted the channel
  has started it. If that device loses its state before its first commit
  reaches the node, or a channel is restricted by a client without this
  change, the group is never started: members see "awaiting group access" for
  the channel until a manager signs its permissions again. Restricting a
  channel to roles none of whose members is online leaves them waiting until
  a manager who sees it syncs. The restriction is signed before the group
  starts; if starting fails, the user sees the error and the restriction
  stays.
- A node that withholds a channel group's commits from the identity signing
  a restriction can make its device start a second group for the same
  channel, a fork whose members cannot read each other. It can deny access,
  never grant it.
- The security audit view lists the community group's leaves only.
- A community created before this change has no group. Its owner sees
  "awaiting group access" and must recreate the community; nothing bootstraps
  a group automatically, so two owner devices cannot fork one.
- Leaf credentials changed from `v1` (identity signature only) to `v2`
  (identity and device signatures, #417). There is no migration: MLS state and
  key packages stored with `v1` leaves no longer verify, so a group or
  community created before this change must be recreated.
