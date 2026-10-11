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
- Read token: 32 random bytes chosen and persisted by the recipient. It is not derived.
- Node-side capability hashes: SHA-256 hex of the token string (`MailboxCapability.hash`).

Pinned vector: secret `0x01 × 32`, recipient `identity-bob`, epoch 0. The vector asserts the derived mailbox id, post token, and envelope key.

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

| Action | Route | Auth |
| --- | --- | --- |
| Create | `PUT /mailboxes/{id}` (201 created, 200 repeat) | creation proof body |
| Append | `POST /mailboxes/{id}/envelopes` | post token (Bearer) |
| Read | `GET /mailboxes/{id}/envelopes?after=&limit=` | read token (Bearer) |
| Acknowledge | `POST /mailboxes/{id}/ack` with `{ upTo }` (204) | read token (Bearer) |

- A 404 maps to `MailboxUnavailableError`. A 400 on create that names `requiredDifficultyBits` maps to `MailboxCreationDifficultyError`. Other 400s, 409, and 429 propagate as `HttpJsonError`.
- Empty success bodies (PUT 200/201, POST 204) resolve to `undefined` in `HttpJsonClient`.

## Creation difficulty and recovery

- `createInbox` mines at the default 16 bits. If `PUT` returns 400 with `requiredDifficultyBits`, it re-mines once at that value and retries the `PUT`. A second refusal, or a value outside 17 to 24, propagates without re-mining.
- Recipient `read` and `acknowledge` re-create an evicted mailbox once on 404, with the same id and capability hashes, then retry the operation. A second 404 propagates.
- Senders (`send`) do not re-create. They lack the read-token hash, so they recover after the recipient's next read or acknowledgement.

## Receive

- Forged or undecryptable envelopes are dropped silently. Nothing about them is logged.
- The returned cursor includes dropped envelopes, so acknowledging up to it removes them.
- Logs never contain decrypted payloads or topics.

## Direct messages (spike)

- Scope: one-to-one text with no attachments, reply, or sticker. Anything else stays on the legacy path (`deliver` returns `skipped`).
- Send: the legacy POST runs first and is unchanged. The sent record is then appended to the recipient's inbox (`DirectMessageMailbox.deliver`). A failed append returns `failed` and is silent for the user. The facade logs one count-only debug line (no ids, content, or error details). There is no automatic retry, so the legacy copy is never duplicated.
- Recipient: the active one-to-one conversation is polled about every 5 s (`useDirectMessageMailboxSync`). Each page is decrypted, applied to the timeline, then acknowledged. The cursor advances only after a successful ack. Replays collapse by message id in `MessageCollection.merge`.
- A 404 on append means the recipient has not opened the conversation yet, so their inbox does not exist. That is expected, so it returns `failed` with no user notice.
- A failing sync shows one notice unless another error is already shown. The next successful pass clears only that notice.
- Cursor and read token are stored in localStorage under `pigeon.direct-mailbox.<mailboxId>` (scoped per client). There is no cross-device recovery.
- Gaps: home-node discovery assumes `API_SERVER_URL`; polling only (no realtime hint); no retry beyond the next poll; epoch fixed at 0.
- Send-failure notice: hidden while the legacy path still delivers every message. It returns when the legacy path is retired and the mailbox is the only delivery path.

## Open questions (not decided, not implemented)

- Home-node discovery: how a sender learns which node hosts a recipient's mailbox.
- Read-token persistence and recovery across devices.
- Epoch rotation announcement.
- Realtime hint for new envelopes.

## Verification

- Pinned vectors and envelope/proof behavior: `src/test/contexts/mailboxes/**` under the real-crypto suite (`yarn test:crypto`).
- HTTP client and worker client: default jest.
- `HttpJsonClient` empty-body handling was proven red without the fix.
