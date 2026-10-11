# Opaque mailboxes (client)

Client side of haskou/pigeon-swarm-node#289. Module: `src/contexts/mailboxes/`.

## Scope

- 1:1 channel at epoch 0 only.
- Not yet wired into the chat send/receive pipeline.
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
- SHA-256 must start with at least 16 zero bits.
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

- A 404 maps to `MailboxUnavailableError`. 400, 409, and 429 propagate as `HttpJsonError`.
- Empty success bodies (PUT 200/201, POST 204) resolve to `undefined` in `HttpJsonClient`.

## Receive

- Forged or undecryptable envelopes are dropped silently. Nothing about them is logged.
- The returned cursor includes dropped envelopes, so acknowledging up to it removes them.
- Logs never contain decrypted payloads or topics.

## Open questions (not decided, not implemented)

- Home-node discovery: how a sender learns which node hosts a recipient's mailbox.
- Read-token persistence and recovery across devices.
- Epoch rotation announcement.
- Realtime hint for new envelopes.

## Verification

- Pinned vectors and envelope/proof behavior: `src/test/contexts/mailboxes/**` under the real-crypto suite (`yarn test:crypto`).
- HTTP client and worker client: default jest.
- `HttpJsonClient` empty-body handling was proven red without the fix.
