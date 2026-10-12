# Opaque mailboxes (client)

Client side of haskou/pigeon-swarm-node#289. Module: `src/contexts/mailboxes/`.

## Scope

- 1:1 channel at epoch 0 only.
- Wired into direct 1:1 text (spike). See Direct messages below.
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

### Alternatives

- Random token, persisted (previous design): lost with local storage. The node keeps the old inbox, so reads return 404 and the recreate PUT returns 409 until the 14-day retention expires.
- Derived from the conversation secret: rejected. The peer could read, acknowledge, and delete.
- Derived per device (`deviceId`): rejected. The device id changes on re-authorization and on "forget this device", which reproduces the loss.
- Epoch bump on 409 with a fresh mailbox id: rejected. Senders derive from the constant epoch 0, and the rotation announcement is not implemented. Senders would keep appending to the abandoned inbox, so messages would be lost silently. This needs the announcement from the node design doc first.

### Residual risk

- Legacy inboxes: a `readToken` stored by the previous design stays in its localStorage entry and is still used, because the node accepts only that token for the inbox. If that storage is cleared, the inbox stays unrecoverable until retention removes it.
- Multi-device consumption: see Direct messages.

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

## HTTP (`PigeonMailboxClient`)

| Action      | Route                                            | Auth                |
| ----------- | ------------------------------------------------ | ------------------- |
| Create      | `PUT /mailboxes/{id}` (201 created, 200 repeat)  | creation proof body |
| Append      | `POST /mailboxes/{id}/envelopes`                 | post token (Bearer) |
| Read        | `GET /mailboxes/{id}/envelopes?after=&limit=`    | read token (Bearer) |
| Acknowledge | `POST /mailboxes/{id}/ack` with `{ upTo }` (204) | read token (Bearer) |

- A 404 maps to `MailboxUnavailableError`. A 400 on create that names `requiredDifficultyBits` maps to `MailboxCreationDifficultyError`. Other 400s, 409, and 429 propagate as `HttpJsonError`.
- Empty success bodies (PUT 200/201, POST 204) resolve to `undefined` in `HttpJsonClient`.

## Creation difficulty and recovery

- `createInbox` mines at the default 16 bits. If `PUT` returns 400 with `requiredDifficultyBits`, it re-mines once at that value and retries the `PUT`. A second refusal, or a value outside 17 to 24, propagates without re-mining.
- Recipient `read` and `acknowledge` re-create an evicted mailbox once on 404, with the same id and capability hashes, then retry the operation. A second 404 propagates. Both report `recreated: true` when this happened.
- A re-created inbox numbers its envelopes from 1 again, because node `nextCursor` starts at 1 for each mailbox. A cursor stored for the old inbox would hide new envelopes. `DirectMessageMailbox.sync` therefore re-reads from 0 when `read` reports `recreated`, and stores cursor 0 when `acknowledge` does.
- Senders (`send`) do not re-create. They lack the read-token hash, so they recover after the recipient's next read or acknowledgement.

## Receive

- Forged or undecryptable envelopes are dropped silently. Nothing about them is logged.
- The returned cursor includes dropped envelopes, so acknowledging up to it removes them.
- Logs never contain decrypted payloads or topics.

## Direct messages (spike)

- Scope: one-to-one text with no attachments, reply, or sticker. Anything else stays on the legacy path (`deliver` returns `skipped`).
- Send: the legacy POST runs first and is unchanged. The sent record is then appended to the recipient's inbox (`DirectMessageMailbox.deliver`). A failed append returns `failed` and is silent for the user. The facade logs one count-only debug line (no ids, content, or error details). There is no automatic retry, so the legacy copy is never duplicated.
- Recipient: the active one-to-one conversation is polled about every 5 s (`useDirectMessageMailboxSync`). Each page is decrypted, applied to the timeline, then acknowledged. The cursor advances only after a successful ack. Replays collapse by message id in `MessageCollection.merge`.
- Pre-create: the first sync creates the recipient inbox before the first read. Overlapping passes share one creation (`MailboxChannel.createInbox`), so a StrictMode remount sends one PUT. A failure is silent; the read's 404 recovery covers it on the next pass.
- A 404 on append means the recipient inbox does not exist: the recipient has not opened the conversation yet, or it was evicted and not re-created. That is expected, so `deliver` returns `failed` with no user notice. The legacy copy still delivers.
- A failing sync shows one notice unless another error is already shown. The next successful pass clears only that notice.
- The cursor is stored in localStorage under `pigeon.direct-mailbox.<mailboxId>` (scoped per client). The read token is derived, so clearing storage loses only the cursor. A legacy `readToken` in an existing entry is still used (see Read token, Residual risk).
- A stored cursor is reset to 0 when the inbox is re-created (see Creation difficulty and recovery).
- Gaps: home-node discovery assumes `API_SERVER_URL`; polling only (no realtime hint); no retry beyond the next poll; epoch fixed at 0.
- Multi-device: all devices of an identity read one inbox. An ack from one device removes envelopes the others have not read. Per-device delivery needs a node design change.
- Send-failure notice: hidden while the legacy path still delivers every message. It returns when the legacy path is retired and the mailbox is the only delivery path.

## Open questions (not decided, not implemented)

- Home-node discovery: how a sender learns which node hosts a recipient's mailbox.
- Per-device delivery for identities with more than one device (see Direct messages).
- Epoch rotation announcement.
- Realtime hint for new envelopes.

## Verification

- Pinned vectors and envelope/proof behavior: `src/test/contexts/mailboxes/**` under the real-crypto suite (`yarn test:crypto`).
- Sync, storage-loss recovery, and single-flight creation: `src/test/contexts/messages/infrastructure/mailbox/DirectMessageMailbox.spec.ts` (`yarn test:crypto`).
- HTTP client and worker client: default jest.
- `HttpJsonClient` empty-body handling was proven red without the fix.
