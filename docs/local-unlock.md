# Local unlock and browser key exposure

This document describes the browser client (`pigeon-swarm-ui`) as it behaves
on `main`. It covers what is stored locally, what unlocks it, what logout
removes, and what each choice does and does not protect against.

## Modes

Each identity on this device has one local unlock mode at a time. The client
has no automatic-unlock mode.

| Mode     | Unlock requires                                                                                            | Turned on                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Password | The password plus the device-bound factor key (`DeviceIdentityVault.unlock`)                               | Default after creating an identity, recovery-key login or pairing               |
| Passkey  | A user-verified passkey assertion whose PRF output replaces the password, plus the device-bound factor key | Profile, Security, "Unlock with a passkey", confirmed with the current password |

In passkey mode the 32-byte WebAuthn PRF output (`WebAuthnPasskeyPrf`, salt
stored next to the credential ID) is the secret for the same scrypt envelope
the password uses. The authenticator must verify the user
(`userVerification: 'required'`), so it enforces its own PIN or biometric
attempt limits in hardware. A short PIN checked by JavaScript was not chosen:
anyone who can copy the browser profile could guess it offline.

Switching to a passkey rewraps the root key to the PRF secret and stores only
the new envelope, so the password no longer unlocks this device. Switching back
asks for a new password and a passkey assertion and stores only the password
envelope. Other devices keep their own unlock. Changing the password is not
offered while a passkey unlocks the device.

If the browser has no WebAuthn, no secure context, or reports no PRF support,
the option says so and the device keeps the password. An authenticator that
creates a passkey without PRF is rejected before anything is stored. Records
written before this change have no `passkey` field and stay in password mode;
no migration runs.

A lost passkey cannot be replaced from the login screen. Recovery-key login or
pairing from another device registers this device again in password mode. A
passkey created during a setup that then fails (for example, the vault write
fails) stays in the authenticator but unlocks nothing.

| Local state                                                              | Holds                                                                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device vault (IndexedDB `pigeon-swarm-device-vault`, store `identities`) | Identity material encrypted under a root key, one scrypt-protected root-key envelope, a non-extractable HMAC factor key, and in passkey mode the credential ID and PRF salt |
| Session                                                                  | Keys and session state in memory. Gone on reload; unlocking again is required                                                                                               |

Plaintext values that stay in `localStorage` after login: the identity ID of
the last login (`pigeon-swarm-last-login-identity-v1`). Workspace preferences
and the last conversation ID are also kept. Drafts are encrypted with the
session before they are stored.

In the independent-client build (`VITE_INDEPENDENT_CLIENT=true`), the device
vault database name and the last-login key carry a `:<node scope>` suffix, so
each node has its own copy.

## What each choice protects against

- **Someone reading the browser profile on disk.** The device vault contents
  are encrypted. In password mode, reading them needs the password and the
  non-extractable factor key. In passkey mode, they need a user-verified
  assertion from the passkey; the stored credential ID and salt alone do not
  derive the secret. Identity IDs and workspace preferences are not encrypted.
- **Same-origin script (for example injected content).** In password mode a
  script running in the page can unlock if it knows the password, and can use
  the factor key while the page is alive. In passkey mode it can request an
  assertion, but the authenticator still asks the user for a PIN or biometric.
  The factor key cannot be exported in either mode. The production build sends a
  Content Security Policy that blocks inline and eval scripts (see below). A
  script from an allowed origin is not stopped.
- **A compromised device or browser session.** Not protected in either mode. A
  compromised browser can wait for the user to unlock and read the session.
- **A same-origin script while the session is alive.** In both modes it can read
  the in-memory session, including the conversation keys and the master key. It
  can also call the message and attachment crypto paths. Logout drops the
  session but does not clear JavaScript memory.

There is no separate session-only mode: the session already lives only in
memory. On a shared computer, use "Log out and forget this device" (below).

## Logout

`clearSession` in `src/app/presentation/useAppBootstrap.ts` runs on logout. It:

- removes the decrypted message projection caches
  (`pigeon-message-projection-cache`, `pigeon-community-message-projection-cache`);
- drops the in-memory session.

It keeps, on purpose:

- the device vault. Deleting it would force a recovery-key login on the next
  visit;
- the last-login identity ID, workspace preferences, and
  community unread counts.

Logout also closes realtime sockets, terminates the message decrypt worker, and
terminates the attachment cipher worker. In-flight decrypts and attachment
encrypt or decrypt calls reject; a new worker starts on the next use. Removing a
push subscription always unsubscribes in the browser, even if the backend
delete fails.

This document does not claim that JavaScript memory is cleared.

### Log out and forget this device

The profile menu has a second action, "Log out and forget this device". It
asks for confirmation first. Then `identities.forgetCurrentDevice` runs the
identities use case `CurrentDeviceForgetter`, which:

1. revokes this device's own credential on the node through
   `OwnDeviceRepository` (`PigeonOwnDeviceRepository`, which calls
   `PigeonDeviceAuthorizationApi.retireOwnDevice`). This is the same revocation
   as "Remove access" under "Manage devices". The node never revokes the only
   credential of an identity. For that case the user confirms again, and step 2
   is skipped: the device stays authorized and keeps its reader;
2. releases this device's reader from each direct conversation inbox through
   `DeviceMailboxRepository`. This step is best effort (see
   `opaque-mailboxes-client.md`);
3. wipes this identity's local direct history and queued one-to-one sends
   through `DeviceMailboxRepository`;
4. deletes the device vault record for the identity (IndexedDB
   `pigeon-swarm-device-vault`) through `IdentityUnlockRepository.forget`;
5. runs the logout described above.

If step 1 fails, the user stays signed in with the device still authorized, and
sees an inline error. Nothing local is removed. If step 4 fails after the
revocation, the user stays signed in, sees an inline error, and pressing the
button again finishes the local removal. The node returns 401 with code 401020
("Invalid signed request") for a rejected signature. Only that code is read as
"already revoked"; any other 401 fails step 1. A bad signature that returns
401020 is read the same way. This is a known residual risk.

Signing in here again needs the recovery key, or a device pairing from a
signed-in device when one exists. After a revoke this device's authorization is
gone. After the only-device forget the device stays authorized, so the recovery
key is the way back.

Password sign-in on this browser then explains that the browser no longer has
the sign-in key for the identity and points to the recovery key or "New
device". It does not show the generic "username or password is incorrect"
message. A wrong password on a browser that still has the local unlock keeps
the generic message.

### Revoked device on unlock

Unlock makes one device-signed read of
`GET /identity-devices/:id/transitions` and passes the served log to
`PigeonDeviceAuthorizationApi.synchronize`. The log is the node's signed
device-authorization history: the recovery lineage, the recoveries that lost a
checkpoint, and the transitions in replay order. Nothing in it is trusted
until this browser replays it:

1. The genesis comes from the identity record, not from the node. The record
   must carry a valid identity signature and the same genesis device
   (`IdentityMailboxHomeVerifier.isTrusted`), and its recovery authority must
   equal the one in this device's vault.
2. `DeviceRemovalDomainService.verify` replays the log from that genesis with
   `DeviceAuthorizationPolicy`, the node replay rules ported to the client.
   Every transition must carry valid signatures from keys the replayed state
   authorizes and apply in causal order. A recovery that lost a checkpoint
   must apply from the one replayed state in its epoch, whether that is on the
   lineage or another lost recovery, at no higher revision than the last
   recovery of the lineage and only once. Otherwise the log does not replay.
   The client and the node both pass the shared vectors in
   `src/test/fixtures/device-authorization-transition-log-vectors.json`.
3. The device is removed only when the replay contains a transition above the
   local authorization revision that takes this device's credential out: a
   revocation of it, or a recovery that leaves it out. Otherwise the replayed
   head must still authorize the device at no lower revision than the local
   one, and the vault stores that head.

A verified removal rejects with `DeviceRemovedError` naming the identity and
the operation id, and no session is returned. The sign-in screen then runs
`eraseRemovedDevice` for the identity without asking. It erases the outbox,
the stored one-to-one and group history, the MLS state, the decrypted message
projections, the pending device-sealed recovery records, and the drafts and
workspace state in localStorage. Last, `identities.forgetDeviceUnlock` deletes
the vault record, which holds the identity key material and the device-sealed
root, as in step 3 above. The vault record goes only when every other step
succeeded. A partial erase keeps it, so the next unlock proves the removal
again and retries. The screen says "This device was removed from your
account." and that the saved messages were erased, forgets the remembered
identity (only after the vault record is gone, and only when it is this
identity), and offers "Pair this device again". When the erase failed, it says
so instead. Nothing is revoked on the node, and the identity stays recoverable
with the recovery key.

A device that stays signed in makes the same read every 30 seconds
(`DeviceRemovalWatch.CHECK_INTERVAL_MS`), counted from sign-in or from the
last change of its session, one read at a time. A revoke made on another
device is therefore verified within 30 seconds plus one transitions read. On
a verified removal the session stops its outboxes, realtime connections and
workers and closes; once the workspace has unmounted, `eraseRemovedDevice`
runs as above, and the login screen shows the same notice. A newer head that
still authorizes the device is stored and replaces the session's checkpoint.
Every other outcome of an in-session read, listed below, is ignored: the
session stays open, nothing is erased, and the next read tries again.

Anything else is not a removal and erases nothing:

- A 401 (including 401020), 404, 409 or 5xx response, a timeout, and a network
  error (a `TypeError` from `fetch`) are rethrown unchanged.
- A log that does not replay (a bad or missing signature, a transition signed
  by a key the state does not authorize, another identity, a malformed body),
  a removal at or below the local revision, an untrusted identity record and a
  recovery authority mismatch all fail sign-in with "This node could not prove
  that this device is still authorized" (`copy.auth.deviceAuthorizationUnproven`).

Residual risks:

- A node can delay the wipe or suppress it. It can withhold the log, refuse
  the read, or serve the history only up to before the removal; the device
  then keeps signing in and stays signed in while the node lets it, or fails
  sign-in, and keeps its data. The 30-second bound holds only while the node
  serves the log. A node cannot forge a removal: that needs a signature from a
  key the replayed state authorizes.
- The verdict depends on the transitions the node serves. Leaving out a
  concurrent sibling transition, or choosing which of several genuine
  competing recoveries to serve, can change which device a log removes.
- Anyone holding the key of an authorized device, or the recovery authority,
  can sign a genuine revocation of this device and so trigger the wipe.
- The local epoch and revision of a vault written before transitions were
  verified may have come from the node unverified.
- Ties between transitions sharing an operation id are broken with
  `localeCompare` on the served encoding, as on the node; a runtime with a
  different collation could order them differently.
- The strict parsing turns a record the policy does not expect into a sign-in
  error rather than a removal.
- Not erased: contact pins, archived notification ids, call audio, presence
  and recent emoji preferences, the locally seen message ids, and the direct
  message availability records.

Residual: detection runs only at unlock. A revoked device that stays signed in
keeps its session until its next sign-in, and its stored history until the
user erases it.

## User-presence check before unlock

Passkey mode is the user-presence check. A click or prompt that does not gate
the key would not stop a same-origin script, so the passkey's PRF output is the
unlock secret itself: without a user-verified assertion the root key cannot be
unwrapped. After unlock, the session is in memory and the check no longer
applies (see "What each choice protects against").

## Other protections

- **Links in messages.** Only `http`, `https`, and `www.` targets become
  anchors. `javascript:`, `data:`, and `vbscript:` targets stay plain text, and
  raw HTML is escaped. Covered by `markdownMessage.spec.ts`.
- **Protected-root envelope.** The KDF is pinned to
  `v1.scrypt.N262144.r8.p1.hkdf-sha256.aes-256-gcm`. Other scrypt cost, block
  size, or parallelism values are rejected. Covered by
  `DeviceSecurityValueObjects.spec.ts`.
- **Logs and errors.** Reviewed logging call sites do not log keys, decrypted
  payloads, or topics. The realtime gateway constructor's signed-URL log was
  fixed in PR #246, which is on `main`. Passkey errors carry only a copy key;
  the PRF output, salt and credential ID are never logged or shown.
- **Diagnostics.** The only export is the call diagnostic report
  (`callDiagnosticReport.ts`), which holds connection state, not keys or
  message content. The client has no crash reporter.
- **Content Security Policy.** The production build injects a
  `Content-Security-Policy` meta tag (policy in
  `src/shared/infrastructure/security/contentSecurityPolicy.ts`, applied in
  `vite.config.ts`). Scripts come only from the app origin and
  `'wasm-unsafe-eval'`. Inline scripts and `eval` are blocked. Styles allow
  `'unsafe-inline'`. Objects, base URIs, and frames are blocked. The dev server
  sends no policy. `frame-ancestors` is ignored in a meta tag, so clickjacking
  protection must come from the hosting server's response header. Covered by
  `contentSecurityPolicy.spec.ts`.

## Tests

`DeviceIdentityVault.spec.ts` and `DeviceIdentityProtector.spec.ts` run in the
`crypto` jest project (`yarn test:crypto`), which `yarn test` runs together
with the `unit` project. They are listed in `REAL_CRYPTO_SPECS` in
`jest.config.cjs` because the `unit` project's `@haskou/pigeon-swarm-crypto`
fake does not implement the device factor. The vault spec covers switching to a
passkey and back, that the replaced secret no longer unlocks, and that a wrong
password creates no passkey. `WebAuthnPasskeyPrf.spec.ts` covers browsers
without WebAuthn, without a secure context, or without PRF, and cancelled or
aborted requests. `e2e/passkey-unlock.spec.ts` sets up a passkey and unlocks
with it in Chromium against a real node.

Revoked device: `DeviceRemovalDomainService.spec.ts` and
`PigeonDeviceAuthorizationApi.spec.ts` (`yarn test:crypto`) replay the shared
vectors, prove the removal above the local revision, and check that a forged,
retargeted, unsigned, stale or foreign removal, an untrusted identity record, a
recovery authority mismatch and every HTTP or network failure never yield
`DeviceRemovedError`. `eraseRemovedDevice.spec.ts` and
`deviceRemovedCopy.spec.ts` (`yarn test`) cover the erase steps, the vault
record kept after a failed step, the remembered identity forgotten only after
a full erase, the failure result, and the sign-in copy.
`DeviceRemovalWatch.spec.ts` (`yarn test`) covers the 30-second interval,
that only `DeviceRemovedError` closes the session while HTTP, network and
unproven-log failures are ignored, no overlapping reads, the advanced head,
and nothing after stop. `e2e/device-revoke-mailbox.spec.ts` keeps the revoked
device signed in on a real node while its transition reads are refused, and
checks that it stays signed in, keeps its rows and never shows a message sent
after the revoke. Once the reads go through, the still signed-in device shows
the removal notice within the bound, no history row is left and the login
screen no longer remembers the identity. It then serves a forged revocation to
the signed-in surviving device for longer than the bound, and refuses the read
and forges a revocation at its sign-in, and checks that none of these shows
the removal notice or erases anything.

## Out of scope

- **Sealed conversation keys in session memory.** Raw conversation keys stay in
  session memory while the session is alive. Sealing them at rest in memory was
  evaluated and not adopted: it does not stop a same-origin script, which can
  call the same paths.
- **Clickjacking.** Needs a `frame-ancestors` response header from the hosting
  server; see "Other protections".
