# Opaque mailboxes (client)

Client side of haskou/pigeon-swarm-node#289. Module: `src/contexts/mailboxes/`.

## Scope

- 1:1 channel at epoch 0 only.
- Wired into direct 1:1 messages (spike): sent, edited, deleted, and reactions. See Direct messages below.
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
- Cap: the node's `maxReaders` (`MAILBOX_MAX_READERS`) defaults to 129 on nodes that include haskou/pigeon-swarm-node#437: the root reader plus one reader per device, up to 128 devices. A device enrol past the cap is refused (409) and logged with the fixed inbox-create debug line. Its read then gets 404, recovers, and fails again on enrol with 409. That surfaces as the sync error notice. A reader whose device was removed still counts until pruned; the first pass of an app session prunes before the read, so that slot can free in the same pass.
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
- Forget is local only: forgetting a device does not revoke its reader on the node.
- Revoked devices keep root authority: the root token derives from the identity root key, which a device keeps after it is revoked. Devices never prune the root reader, and any reader can add or remove any other reader. The node checks only that a token is registered, so a revoked device keeps reading and acknowledging the inbox until someone removes the root reader on the node.
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

- A 404 maps to `MailboxUnavailableError`. A 400 on create that names `requiredDifficultyBits` maps to `MailboxCreationDifficultyError`. Other 400s, 409, and 429 propagate as `HttpJsonError`.
- Empty success bodies (PUT 200/201, POST 204) resolve to `undefined` in `HttpJsonClient`.

## Creation difficulty and recovery

- `createInbox` mines at the default 16 bits. If `PUT` returns 400 with `requiredDifficultyBits`, it re-mines once at that value and retries the `PUT`. A second refusal, or a value outside 17 to 24, propagates without re-mining.
- Recipient `read` and `acknowledge` re-create an evicted mailbox once on 404, with the same id and capability hashes, then retry the operation. A second 404 propagates. Both report `recreated: true` when this happened. The re-creation enrols the device reader again (`createInbox(root)`, then `addReader(device)`).
- A re-created inbox numbers its envelopes from 1 again, because node `nextCursor` starts at 1 for each mailbox. A cursor stored for the old inbox would hide new envelopes. `DirectMessageMailbox.sync` therefore re-reads from 0 when `read` reports `recreated`, and stores cursor 0 when `acknowledge` does.
- Senders (`send`) do not re-create. They lack the read-token hash, so they recover after the recipient's next read or acknowledgement.

## Receive

- Forged or undecryptable envelopes are dropped silently. Nothing about them is logged.
- The returned cursor includes dropped envelopes, so acknowledging up to it removes them.
- Logs never contain decrypted payloads or topics.

## Direct messages (spike)

- Scope: one-to-one conversations only. Group conversations stay on the legacy path (`skipped`). Attachments, replies, and stickers travel as opaque encrypted payload inside the sent record.

| Kind | Mailbox record | Status |
| --- | --- | --- |
| Sent: text, reply, attachments, sticker | `sent` (`replyToMessageId` for replies) | Carried |
| Edited | `edited` (`targetMessageId`) | Carried |
| Deleted | `deleted` (`targetMessageId`) | Carried |
| Reaction add / remove | `reaction` (`action`, `emoji`, `targetMessageId`) | Carried |
| Read receipts | none | Not carried: `ConversationReadMarker.mark` is actor-local, so no peer-visible receipt exists to deliver. |
| Thread send, edit, delete, reaction | none | Not carried: thread hooks do not route through the mailbox and stay legacy-only. |
| Pins | none | Not carried: known gap. Pin state does not reach the mailbox. |

- Envelope: plaintext is `{kind:'direct-message', version:2, record}`. `record.type` is `sent`, `edited`, `deleted`, or `reaction`. `DirectMessageMailboxRecord.decode` returns null for a wrong kind or version, a wrong conversation, missing or invalid fields, an unknown type, or a bad reaction action.
- v1 `direct-text` envelopes decode to null and are acknowledged, so they do not block the inbox. Legacy delivery covers them; nothing is migrated.
- Size: a record whose plaintext exceeds `MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES` is skipped and stays on the legacy path (see Envelopes).
- Send: the legacy POST runs first and is unchanged. The mailbox append follows through `deliverSent`, `deliverEdit`, `deliverDelete`, or `deliverReaction`. Each returns `delivered`, `failed`, or `skipped`. `skipped` covers no peer, a group conversation, or an oversized record. `failed` covers any throw, including a 404 and a missing conversation key. A failed append is silent for the user. The facade logs one count-only debug line (no ids, content, or error details). There is no automatic retry, so the legacy copy is never duplicated.
- Recipient: the active one-to-one conversation is polled about every 5 s (`useDirectMessageMailboxSync`). Each page is decrypted in envelope order into timeline changes (`message`, `edit`, `removed`, `reaction`), applied, then acknowledged. The cursor advances only after a successful ack. Messages collapse by id in `MessageCollection.merge`. A sent or edited change is dropped when its message does not decrypt.
- Known limit: a reaction add replayed after a later legacy remove can resurrect the reaction until the mailbox remove applies.
- Pre-create: the first sync creates the recipient inbox and enrols this device's reader before the first read. Overlapping passes share one creation (`MailboxChannel.createInbox`), so a StrictMode remount sends one PUT. A failure is silent; the read's 404 recovery covers it on the next pass.
- A 404 on append means the recipient inbox does not exist: the recipient has not opened the conversation yet, or it was evicted and not re-created. That is expected, so the sender returns `failed` with no user notice. The legacy copy still delivers.
- A failing sync shows one notice unless another error is already shown. The next successful pass clears only that notice.
- The cursor is stored in localStorage under `pigeon.direct-mailbox.<mailboxId>` (scoped per client). Both reader tokens are derived, so clearing storage loses only the cursor. A legacy `readToken` in an existing entry is adopted on the first pass (see Read token, Residual risk).
- A stored cursor is reset to 0 when the inbox is re-created (see Creation difficulty and recovery).
- Gaps: home-node discovery assumes `API_SERVER_URL`; polling only (no realtime hint); no retry beyond the next poll; epoch fixed at 0.
- Multi-device: each device reads and acknowledges with its own device reader, and the node keeps an envelope until every reader has acknowledged it. An ack from one device therefore cannot remove a message another device has not read. The reader set holds at most `maxReaders` readers per inbox (129 by default: the root plus 128 devices), so a device past the cap cannot enrol (see Reader set).
- Send-failure notice: hidden while the legacy path still delivers every message. It returns when the legacy path is retired and the mailbox is the only delivery path.

## Open questions (not decided, not implemented)

- Home-node discovery: how a sender learns which node hosts a recipient's mailbox.
- Epoch rotation announcement.
- Realtime hint for new envelopes.

## Verification

- Pinned vectors and envelope/proof behavior: `src/test/contexts/mailboxes/**` under the real-crypto suite (`yarn test:crypto`).
- Sync, reader adoption and pruning (including a full legacy inbox and a removed device's slot), the reader cap on a fake node set to 8, storage-loss recovery, and single-flight creation: `src/test/contexts/messages/infrastructure/mailbox/DirectMessageMailbox.spec.ts` (`yarn test:crypto`). Live multi-device behaviour against a real node is not covered.
- HTTP client and worker client: default jest.
- `HttpJsonClient` empty-body handling was proven red without the fix.
