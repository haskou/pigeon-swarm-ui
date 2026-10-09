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

| Scope                                | Group                                           |
| ------------------------------------ | ----------------------------------------------- |
| Community text, polls, reactions     | one group, `groupId = communityId`              |
| Role-restricted channel              | one extra group, `groupId = communityId:channelId` |
| Call media, attachments              | MLS exporter of the owning group (below)        |
| Direct and group conversations       | out of scope here, tracked by the same issue    |

Each leaf is a **device**, not an identity. An identity is in the group while
at least one of its devices is. Removing an identity removes all its leaves.

The old shared `communityKey`, `EncryptedCommunityKey`, invite key envelopes and
`Session.keychain.conversations[communityId]` community keys are removed. There
is no fallback to them and no migration path: a community created before this
change must be recreated.

### Identity binding

A leaf credential is `basic` and carries the Pigeon identity id. That is not
authentication by itself. A leaf is accepted only if all of these hold:

1. The key package was published as a signed node record authored by the same
   identity that the credential names (the node already verifies the signer).
2. That identity is a current member of the community according to the
   authoritative community operation log (not according to the MLS roster).
3. For a channel group, the identity can see that channel.

A client that receives a commit adding a leaf failing these checks rejects the
commit and does not advance the epoch. The community roster, which is signed and
converges independently, is the source of truth; the MLS roster must follow it.

### Transport

The node stores opaque, signed records and never parses MLS content. One record
shape for every group, `communities-api`:

```
POST /communities/{communityId}/mls/records
GET  /communities/{communityId}/mls/records?groupId=&kind=&afterEpoch=&limit=
{ id, groupId, kind: 'key_package' | 'commit' | 'welcome',
  epoch?, recipientIdentityId?, payload (base64), createdAt, mutation }
```

- `id` is derived from the record content, so a retry is idempotent.
- `key_package`: author must be a community member. One use only; a client
  publishes a fresh one whenever it has fewer than 4 unused.
- `commit`: author must be a member; for a channel group, able to see the
  channel. `epoch` is the epoch the commit applies to.
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

- Add: the member that admits a newcomer (invite creator, approver, or the first
  online member that sees a `member_joined` operation without a leaf).
- Remove: the moderator that performs kick or ban commits immediately. Every
  other member that notices a leaf without a roster member (kick, ban, leave)
  waits a random 0 to 5 seconds and, if the leaf is still there, commits the
  removal. Races are resolved by the lowest-id rule above.
- Update: each device commits an empty update at most every 24 hours or after
  1000 sent messages, whichever comes first, to bound post-compromise exposure.

### History policy

A new member receives a Welcome for the current epoch only. They cannot read
messages from earlier epochs. The UI shows that fact when the history is missing.
Sharing earlier history is a separate, explicit feature and is not implied by
joining.

### Channel groups

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
