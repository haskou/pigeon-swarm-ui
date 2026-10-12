# Opaque mailboxes (client)

Client side of haskou/pigeon-swarm-node#289. Module: `src/contexts/mailboxes/`.

## Scope

- 1:1 channel at epoch 0 only.
- Wired into direct 1:1 messages (spike): sent, edited, deleted, reactions, and read receipts. See Direct messages below.
- No rotation announcement and no realtime hint.

## Key schedule

HKDF-SHA256 (`@noble/hashes/hkdf.js`, no salt, 32-byte outputs) over a shared 32-byte secret.

- `info` = label ‖ recipient UTF-8 ‖ u32be(epoch).
- Labels: `pigeon/mailbox/id/v1` (mailbox id), `pigeon/mailbox/post/v1` (post token), `pigeon/mailbox/envelope/v1` (envelope key).
- Read token: derived from the identity root key. See Read token below.
- Node-side capability hashes: SHA-256 hex of the token string (`MailboxCapability.hash`).

Pinned vector: secret `0x01 × 32`, recipient `identity-bob`, epoch 0. The vector asserts the derived mailbox id, post token, and envelope key.

## Read token

- `MailboxReadToken.derive(rootKey, mailboxId)`: HKDF-SHA256 (no salt, 32 bytes) over the identity user root key (`session.masterKey`). Info = `pigeon/mailbox/read/v1` ‖ mailbox id. Output is base64url.
- Pinned vector: root key `0x09 × 32`, mailbox id `mailbox-fixture-id`, token `MCkFZKBU05ZYpDeepqRuly-xXmS0bx7Hgq_m0ydOqPI`.
- The token is the same on every device that holds the root key, and it survives re-authorization. A device that lost its storage reads and acknowledges the same inbox without a new PUT. New inboxes persist only the cursor.
- The root key never reaches the node. Pairing seals it to the enrolling device's transport key (`DevicePairingCompletion`).
- The peer holds the conversation secret, which yields the mailbox id, post token, and envelope key, but not the root key. It cannot derive the token, so it cannot read, acknowledge, or delete the inbox.
- The root key also decrypts the identity keychain, which holds the conversation keys. Compromising it already exposes the messages, so the read token adds only the ability to read, acknowledge, or delete the inbox.
- Who can use it: holders of the identity root key, i.e. this identity's own devices. The 1:1 peer holds only the conversation secret, so it cannot read, acknowledge, or delete the inbox.
- What the node sees: create sends only `MailboxCapability.hash(token)`. Each read and acknowledge sends the raw token as `Authorization: Bearer`, and the node checks it against that hash. The node therefore learns the raw token on every read and ack. It can already read and delete the inbox's ciphertext envelopes, and the token adds no new capability beyond that.
- Groups: do not reuse this derivation with a shared conversation or group secret as the input. Every holder of that secret could then read, acknowledge, and delete each member's inbox. Group inboxes need a per-member token.

### Reader set

- Device reader: `MailboxReadToken.deriveDevice(rootKey, mailboxId, deviceCredential)`, same HKDF with info = `pigeon/mailbox/device-read/v1` ‖ u32be(len(mailboxId)) ‖ mailboxId ‖ credential UTF-8. Pinned vector: root key `0x09 × 32`, mailbox `mailbox-fixture-id`, credential `-----BEGIN PUBLIC KEY-----`, `AAAA`, `-----END PUBLIC KEY-----` joined by LF, gives `js4BVkg1uGoEfwYGrPmaTvGh7s8MuZnZhSg1zaYJzDA`.
- A device reads and acknowledges with its device reader. The same token rules as the root apply: the node sees the raw device token on each read and ack.
- The root reader lists, enrols, and removes readers, and it mirrors each acknowledgement, so the root cursor tracks the latest device ack.
- A device enrols its reader when it creates the inbox and when it adopts a legacy inbox. Recovery enrols it again after a re-creation.
- Cap: the node's `maxReaders` (`MAILBOX_MAX_READERS`) defaults to 129 on nodes that include haskou/pigeon-swarm-node#437: the root reader plus one reader per device, up to 128 devices. A device enrol past the cap is refused (409) and logged with the fixed inbox-create debug line. Its read then gets 404, recovers, and fails again on enrol with 409. `addReader` maps that 409 to `MailboxReaderLimitError`, and the sync shows the reader-limit notice instead of the generic one. A reader whose device was removed still counts until pruned; the first pass of an app session prunes before the read, so that slot can free in the same pass.
- Pruning: once per app session per mailbox, a device lists the readers and removes any hash that is neither the root, its own device, nor a credential in the identity's device list. A failed pass logs a fixed debug line and retries on the next sync. The root reader is never removed. A stored legacy inbox is pruned under its legacy token before adoption, on every sync until adoption succeeds, so a full legacy inbox frees dead readers before it is adopted.
- Mixed versions: a client from before this change reads and acknowledges with the root token only. Its acks do not move the device readers, so envelopes stay until the device readers acknowledge. Update every device.

### Alternatives

- Random token, persisted (previous design): lost with local storage. The node keeps the old inbox, so reads return 404 and the recreate PUT returns 409 until the 14-day retention expires.
- Derived from the conversation secret: rejected. The peer could read, acknowledge, and delete.
- Derived per device (`deviceId`): rejected. The device id changes on re-authorization and on "forget this device", which reproduces the loss.
- Epoch bump on 409 with a fresh mailbox id: rejected. Senders derive from the constant epoch 0, and the rotation announcement is not implemented. Senders would keep appending to the abandoned inbox, so messages would be lost silently. This needs the announcement from the node design doc first.

### Residual risk

- Legacy inboxes: a `readToken` stored by the previous design is adopted on the first pass: both readers are registered under it, then the stored token is dropped. The first reconcile after adoption removes that token's reader, so a client still holding it loses access until it updates. If storage was cleared before adoption, the inbox stays unrecoverable until retention removes it.
- Mixed versions and the reader cap: see Reader set.
- Forget is best effort on readers: forgetting a device removes its device reader through the root token. A failed removal is left to the reader prune that other devices run on sync. The only device of an identity keeps its reader, because its revocation is never sent.
- Revoke rotates the root for the remaining devices (see `device-sealed-secrets-client.md`, Rotation). A revoked device holding `masterKey` keeps the legacy root until the remaining devices have bridged every inbox. After that it has no reader, because it cannot fetch the sealed root (401). The authorship tag and the keychain still derive from `masterKey`, so a revoked device can still forge its own-inbox tags.
- Silent readers: a registered reader that stops acknowledging holds every envelope above its cursor until the node's retention expires them (default 14 days). While it is silent the mailbox can fill, and appends return 409. Pruning removes only readers whose device is gone, so a silent device that is still listed keeps its backlog.

## Creation proof

- Preimage: `[pigeon-mailbox-creation:v1, mailboxId, postTokenHash, readTokenHash, nonce].join(':')`.
- SHA-256 must start with at least `difficultyBits` zero bits. The default is 16 (`MailboxCreationProof.DEFAULT_DIFFICULTY_BITS`). A `PUT` 400 that names `requiredDifficultyBits` raises the requirement; see Creation difficulty and recovery.
- `nonce` is the first passing decimal integer from 0, at most 64 characters.
- Mining runs in a dedicated worker: `mailboxCreationWorker.ts`, driven by `MailboxCreationWorkerClient`, constructed by `createMailboxWorkerClient()`.
- Pinned nonce for the vector: `47805`.

## Envelopes

- Fixed buckets for the decoded body: 1024, 4096, 16384, 65536 bytes.
- Body = base64url(iv ‖ ciphertext ‖ tag), AES-256-GCM with the envelope key.
- AAD = `${mailboxId}.${envelopeId}`.
- Plaintext framing: u32be(length) ‖ plaintext, zero-padded to the bucket.
- `MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES` (65504) is the largest plaintext that fits: the largest bucket minus IV, tag, and length prefix.

## HTTP (`PigeonMailboxClient`)

| Action      | Route                                            | Auth                |
| ----------- | ------------------------------------------------ | ------------------- |
| Create      | `PUT /mailboxes/{id}` (201 created, 200 repeat)  | creation proof body |
| Append      | `POST /mailboxes/{id}/envelopes`                 | post token (Bearer) |
| Read        | `GET /mailboxes/{id}/envelopes?after=&limit=`    | read token (Bearer) |
| Acknowledge | `POST /mailboxes/{id}/ack` with `{ upTo }` (204) | read token (Bearer) |
| Readers     | `GET /mailboxes/{id}/readers`                    | root token (Bearer) |
| Enrol       | `POST /mailboxes/{id}/readers` (201 added)       | root token (Bearer) |
| Remove      | `DELETE /mailboxes/{id}/readers/{hash}` (204)    | root token (Bearer) |

- A 404 maps to `MailboxUnavailableError`. A 400 on create that names `requiredDifficultyBits` maps to `MailboxCreationDifficultyError`. A 409 on enrol maps to `MailboxReaderLimitError`. Other 400s, 409s, and 429 propagate as `HttpJsonError`.
- Empty success bodies (PUT 200/201, POST 204) resolve to `undefined` in `HttpJsonClient`.

## Creation difficulty and recovery

- `createInbox` mines at the default 16 bits. If `PUT` returns 400 with `requiredDifficultyBits`, it re-mines once at that value and retries the `PUT`. A second refusal, or a value outside 17 to 24, propagates without re-mining.
- Rate limit: the node caps creations per client address (`MAILBOX_CREATE_RATE_LIMIT_PER_MINUTE`, 30 per 60 s by default). An over-limit create returns 429, which surfaces as `HttpJsonError`. The recipient pass stops at the first 429 and reports incomplete. An inbox whose open failed, rate-limited or not, is not tried again for 60 s (`OPEN_RETRY_MS`), so creation work stays bounded per conversation. Senders never create.
- Recipient `read` and `acknowledge` re-create an evicted mailbox once on 404, with the same id and capability hashes, then retry the operation. A second 404 propagates. Both report `recreated: true` when this happened. The re-creation enrols the device reader again (`createInbox(root)`, then `addReader(device)`).
- A re-created inbox numbers its envelopes from 1 again, because node `nextCursor` starts at 1 for each mailbox. A cursor stored for the old inbox would hide new envelopes. `DirectMessageMailbox.sync` therefore re-reads from 0 when `read` reports `recreated`, and stores cursor 0 when `acknowledge` does.
- Senders (`send`) do not re-create. They lack the read-token hash, so they recover after the recipient's next read or acknowledgement.

## Receive

- Forged or undecryptable envelopes are dropped silently. Nothing about them is logged.
- The returned cursor includes dropped envelopes, so acknowledging up to it removes them.
- Logs never contain decrypted payloads or topics.

## Direct messages (spike)

- Scope: one-to-one conversations only. Group conversations stay on the legacy path (`skipped`). Attachments, replies, and stickers travel as opaque encrypted payload inside the sent record.

| Kind                                    | Mailbox record                                    | Status                                                                                     |
| --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Sent: text, reply, attachments, sticker | `sent` (`replyToMessageId` for replies)           | Carried                                                                                    |
| Edited                                  | `edited` (`targetMessageId`)                      | Carried                                                                                    |
| Deleted                                 | `deleted` (`targetMessageId`)                     | Carried                                                                                    |
| Reaction add / remove                   | `reaction` (`action`, `emoji`, `targetMessageId`) | Carried                                                                                    |
| Read receipts                           | `read` (`targetMessageId`)                        | Own devices only: other devices of this identity clear unread. The peer never receives it. |
| Thread send, edit, delete, reaction     | none                                              | Not carried: thread UI is group-only. One-to-one has no threads to carry.                  |
| Pin and unpin                           | `pin` (`action`, `targetMessageId`)               | Carried. Applied last-writer-wins by `createdAt`; see Pin order.                           |

- Envelope: plaintext is `{kind:'direct-message', version:2, record}`. `record.type` is `sent`, `edited`, `deleted`, `reaction`, `pin`, or `read`. `DirectMessageMailboxRecord.decode` returns null for a wrong kind or version, a wrong conversation, missing or invalid fields, an unknown type, or a bad reaction or pin action.
- v1 `direct-text` envelopes decode to null and are acknowledged, so they do not block the inbox. Legacy delivery covers them; nothing is migrated.
- Size: a record whose plaintext exceeds `MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES` is skipped and stays on the legacy path (see Envelopes). The bound applies to every kind, including a very long text message. Attachment bytes upload as private blobs first; the payload carries only their references, download tokens, expiry, the attachment key, and per-chunk IVs. Each part adds to the payload, so a message with many or large attachments is skipped whole and never split across envelopes.
- Send: the legacy POST runs first and is unchanged. The mailbox append follows through `deliverSent`, `deliverEdit`, `deliverDelete`, `deliverReaction`, or `deliverPin`. Each returns `delivered`, `failed`, `no-inbox`, or `skipped`. `skipped` covers no peer, a group conversation, or an oversized record. `no-inbox` is a 404 from the node with no other fault (see 404). `failed` covers any other throw, including a missing conversation key. A failed send append shows one non-blocking notice (`workspace.directMailboxDeliveryError`) while its conversation is active; `no-inbox` shows none. The legacy send still delivers and is not blocked. Edit, delete, reaction, and pin appends stay silent on failure. The facade logs one count-only debug line for each `failed` append (no ids, content, or error details). There is no automatic retry, so the legacy copy is never duplicated.
- Send notice: one notice per conversation, not one per failure. A repeated `failed` keeps the same notice. A later `delivered` for that conversation clears it, and a legacy send error replaces it in the shared error slot. `no-inbox` and `skipped` neither show nor clear it, so an earlier `failed` keeps its notice. There is no timer, so the notice stays until one of those happens or the user switches conversations. Switching clears the error slot, and the notice is not re-shown on return. Only sends are covered.
- Own copy: after the peer copy, the same record is appended to this identity's self-inbox (the inbox the peer writes into), tagged with an authorship tag (see Authorship), so the other devices of this identity apply the change. The record is built once. The own copy runs even when the peer append fails, never changes the returned result, and is not retried. A throw while building it (for example, no root key) is logged as one count-only line. Callers `void` the deliver calls, so the extra append adds no visible latency.
- Pin send: `useConversationPins` calls `deliverPin` only after the legacy pin or unpin resolves. It takes `createdAt` on the client before the legacy call. A failed legacy call appends nothing, so the mailbox never carries a pin the server refused.
- Recipient home: the append goes to `<mailboxHome>/mailboxes/...` when the recipient's identity serves a `mailboxHome` base URL (origin plus optional path prefix, published as the UI's API base) that verifies against the identity signature (`IdentityMailboxHomeVerifier`). Private hosts are rejected; `localhost` is accepted for development. Otherwise, or when the home append throws, the append goes to the connected node. Each fallback logs one count-only debug line (no URL or id). Home calls use an isolated client (`credentials: omit`, `redirect: error`). Reads and acks stay on the connected node. Each send adds one identity lookup. A failed home append can still have stored the envelope, so the fallback can land the same envelope twice; the timeline collapses duplicates by message id. The published hint is last-write-wins across a user's devices.
- Recipient: the active one-to-one conversation is polled about every 5 s (`useDirectMessageMailboxSync`). Each page is decrypted in envelope order into timeline changes (`message`, `edit`, `removed`, `reaction`, `pin`, `read`), applied, then acknowledged. The cursor advances only after a successful ack. Messages collapse by id in `MessageCollection.merge`. A sent or edited change is dropped when its message does not decrypt.
- Own-copy echo: a record whose id this device appended as an own copy is acknowledged and not applied, since this device already shows it. The skip set is keyed by identity and record id and keeps the 512 most recent own copies, in memory only. After a reload the set is empty, so own records appended but not yet read are applied again. The reaction and pin clocks are also empty then, and edits and deletes have no clock, so a replay can override a later local change only when that change never reached the mailbox.
- Reaction order: a mailbox reaction applies only when its `createdAt` is newer than the newest write seen for the same message, author, and emoji. A remove leaves its clock on the message (`reactionClocks`), so a replayed older add cannot reopen the reaction. Legacy and local writes apply in arrival order and advance the same clock. The clock is timeline state: it survives a same-id merge but not a reload. After a reload a reaction can reopen only if its remove was never appended to the mailbox, or was acknowledged before an add that was appended later. Mailbox writes use the sender's `createdAt`; legacy writes use the realtime `createdAt` attribute, else the server `occurred_on`. Ordering across the two sources assumes the clocks agree to within the gap between the two actions.
- Pin order: a mailbox `pin` change applies only when its `createdAt` is newer than the last applied change for the same message, so a replayed or out-of-order record cannot undo a newer one. Within one pass, changes apply in order. The clock lives in the sync effect and resets when the conversation or session changes. A pin change updates only the pinned set, never the timeline.
- Pin residual risk: legacy and realtime pin writes carry no clock. A mailbox pin or unpin delivered after a local change to the same message can override that local state. The server copy returns on the next `listPins` load (a conversation change or opening the pinned list).
- Read receipts: `deliverRead` appends a `read` record (`targetMessageId` is the last delivered message loaded) to this identity's own inbox, after the legacy read-until PUT, which is unchanged. It runs only for the active one-to-one conversation, once per read mark, with no dedupe; each record is small. The peer's inbox is never written.
- Read receipt apply: the active sync hook and the background pass (`useDirectMessageBackgroundReadSync`) apply a fresh `read` record from this identity's inbox by calling `onConversationRead`, which clears unread for that conversation on this device. The timeline is unchanged. Records from other authors are acknowledged and ignored.
- Freshness: a `read` record applies only when `createdAt` is at most 14 days old and at most 30 s ahead of the local clock, matching the node's `MessageReadProof` limits. Both edges are inclusive. Stale or future-dated records are acknowledged and ignored.
- Trust: a `read` record is authenticated by the conversation key and, when this identity authored it, by its authorship tag (see Authorship). The peer holds the conversation secret, which derives this identity's self-inbox keys, but not the root key. A receipt it writes as this identity is dropped, so it cannot clear this identity's own unread state.
- Authorship: a record whose `authorId` is this identity is applied only when its envelope carries `authorTag`: HKDF-SHA256 (no salt, 32 bytes) over the identity's root key (`session.masterKey`), with the label `pigeon/mailbox/own-record/v1` followed by the record's JSON with keys sorted. Only the own-inbox copy is tagged. The peer copy and records from other authors need no tag. The sync path and the background read pass both check the tag, so a record that claims this identity without a valid tag is acknowledged and dropped. A peer that writes into the self-inbox cannot forge or replay a sent, edited, deleted, reaction, pin, or read record as this identity.
- Authorship residual: the sender needs its root key to tag its own copy, which it already holds for reads. An own copy that cannot be tagged (no root key) or exceeds the envelope bound is skipped, and the peer copy's result is unchanged.
- Authorship rollout: own copies written before this change carry no tag, so upgraded devices drop them on read. Peer copies are unchanged and the envelope version stays 2, so no version bump is needed. Pre-upgrade own records are not replayed to other devices of this identity.
- Background pass: `useDirectMessageBackgroundReadSync` clears unread on the other one-to-one conversations with `unreadCount > 0`, so a read on another device shows here. Each tick (5 s) visits at most 2 conversations, and each conversation is visited at most once per 30 s. A visit reads at most 4 pages of 50 envelopes. It never acknowledges, writes the shared cursor, or creates an inbox, and it skips an inbox this device has not opened or one that still holds a legacy `readToken`. A clear applies only when the visit reaches the end of the inbox and no sent message from another identity follows the last fresh own read, so an unread message is never hidden. A visit that hits the page limit clears nothing and retries on a later pass. The active conversation is never visited by this pass. On the active sync path, a delayed older `read` can still clear unread for a newer message that arrived after it; the legacy path has the same behavior.
- Pre-create: the recipient inbox of every one-to-one conversation this identity holds a key for is opened (created, device reader enrolled) on session start and whenever the session or the conversation list changes (`useDirectMessageInboxPrewarm`, which calls `DirectMessageMailbox.openInboxes`), not only for the active conversation. Opens run one at a time and skip inboxes already open. A pass that leaves an inbox unopened, or rejects, is retried after 60 s. The sync path opens the active inbox the same way before its first read. Overlapping passes share one creation (`MailboxChannel.createInbox`), so a StrictMode remount sends one PUT. A failure is silent; the read's 404 recovery covers it on the next pass.
- Open marker: `{cursor: 0}` is stored only after the device reader is enrolled. A failed or rate-limited open stores nothing, so the next open retries it instead of skipping it.
- A 404 on append means the node holding the inbox has no inbox for this recipient. A 404 from the recipient's home falls back to the connected node. A 404 with no other fault seen returns `no-inbox`, with no notice. Usually the recipient has not opened the conversation yet, or it was evicted and not re-created. That is expected. A home lookup failure, or a home append that is not a 404, is a fault. If the connected node then answers 404, the fault is rethrown and the sender returns `failed`, with the non-blocking notice (see Send). The legacy copy still delivers. The own copy gets the same 404 until a device of this identity has opened the conversation's self-inbox, and it is silent.
- A failing sync shows one notice unless another error is already shown. The next successful pass clears only that notice.
- The cursor is stored in localStorage under `pigeon.direct-mailbox.<mailboxId>` (scoped per client). Both reader tokens are derived, so clearing storage loses only the cursor. A legacy `readToken` in an existing entry is adopted on the first pass (see Read token, Residual risk). The background pass keeps its own read cursor under `pigeon.direct-mailbox-read.<mailboxId>`, so it never moves the shared cursor.
- A stored cursor is reset to 0 when the inbox is re-created (see Creation difficulty and recovery).
- Gaps: polling only (no realtime hint); no retry beyond the next poll; epoch fixed at 0.
- Multi-device: each device reads and acknowledges with its own device reader, and the node keeps an envelope until every reader has acknowledged it. An ack from one device therefore cannot remove a message another device has not read. The reader set holds at most `maxReaders` readers per inbox (129 by default: the root plus 128 devices), so a device past the cap cannot enrol (see Reader set).
- Retiring the legacy 1:1 path (the mailbox becomes the only delivery path) is blocked until these are settled:
  - Oversized records have no mailbox copy. Attachment-heavy messages need a split or a larger bound first.
  - Attachment references carry `expiresAt`. How node blob lifetime compares with the 14-day mailbox retention was not checked.
  - A silent or evicted reader can fill the mailbox, so appends return 409 and nothing else delivers. The 128-device reader cap also leaves extra devices with no read path.
  - Group conversations stay on the legacy path, so the legacy endpoint remains either way.
  - Whether history load or new-device recovery depends on the legacy copy was not traced.
  - Own copies double the envelopes this identity's self-inbox holds. A full self-inbox refuses both the own copy and the peer's sends into it, so a stuck own device blocks the peer as well.
  - An own copy is not a backfill. It reaches only devices that read the self-inbox within the 14-day retention, so a new or restored device gets no older history from it. The node design doc (`docs/design/own-copy-and-history-backfill.md`) lists the backfill options.

## Open questions (not decided, not implemented)

- Epoch rotation announcement.
- Realtime hint for new envelopes.
- Root rotation on revoke or forget (blocked): the remaining devices need a secret that only they can open, delivered through a device-authenticated read or sealed to each device's credential. The node has neither today. The identity key pair is shared by all devices, and the node's only identity-level read check is a signature against that key. Rotating the identity key or the root key would also re-key the recovery material, which is a product decision. Until one of these lands, revoke and forget keep the existing reader handling.

## Verification

- Pinned vectors and envelope/proof behavior: `src/test/contexts/mailboxes/**` under the real-crypto suite (`yarn test:crypto`).
- Sync, reader adoption and pruning (including a full legacy inbox and a removed device's slot), the reader cap on a fake node set to 8, storage-loss recovery, single-flight creation, and the background read pass (`syncReads`, including its read cursor and page limit): `src/test/contexts/messages/infrastructure/mailbox/DirectMessageMailbox.spec.ts` (`yarn test:crypto`). The hook `src/test/app/presentation/workspace/components/useDirectMessageBackgroundReadSync.spec.ts` runs under `yarn test`. Live multi-device behaviour against a real node is not covered.
- Recipient prewarm (`openInboxes`) is in `DirectMessageMailbox.spec.ts` (`yarn test:crypto`): every eligible inbox opens, groups and keyless conversations are skipped, one open runs at a time, a failed open is retried only after 60 s, a 429 stops the pass, and a sender delivers over the real channel after the prewarm. The hook `src/test/app/presentation/workspace/components/useDirectMessageInboxPrewarm.spec.ts` runs under `yarn test`.
- Pin records: `DirectMessageMailboxRecord.spec.ts`, the pin cases in `DirectMessageMailbox.spec.ts`, `useDirectMessageMailboxSync.spec.ts`, and `useConversationPins.spec.ts`.
- Own copy and echo rule: the `own copy` cases in `DirectMessageMailbox.spec.ts` (`yarn test:crypto`). They cover second-device convergence for sent, edited, deleted, reaction, and pin records, an own-copy failure (including a sender that cannot tag its own copy) that leaves the peer copy and the result unchanged, a peer failure that still appends the own copy, and a sending device that does not re-apply its own copy. Authorship: the `records a peer writes into the self-inbox as this identity` cases (forged sent, edited, deleted, reaction, pin, and read records, a replayed peer copy, a tampered own copy, and an own copy tagged under another identity's root key) and `syncReads`' forged-read case, all in `DirectMessageMailbox.spec.ts`; the tag itself is in `src/test/contexts/messages/infrastructure/mailbox/DirectMessageAuthorship.spec.ts` (`yarn test:crypto`).
- Attachment, sticker, and size-bound payloads: the `deliverSent` cases in `DirectMessageMailbox.spec.ts` use real encrypted payloads (`yarn test:crypto`). Legacy fallback on `skipped`, `no-inbox`, and `failed`, and the copy notice rules, are in `useConversationMessageDelivery.spec.ts` (`yarn test`). The outcome callback of `runMailboxSideEffect` is in `runMailboxSideEffect.spec.ts`.
- Home routing: `IdentityMailboxHomeVerifier.spec.ts` runs under `yarn test:crypto`. `RecipientMailboxRouter.spec.ts` (the fault rule: a home fault rethrown on a local 404, a home 404 kept benign) and `IsolatedHttpJsonClient.spec.ts` run under the default suite.
- HTTP client and worker client: default jest.
- `HttpJsonClient` empty-body handling was proven red without the fix.
