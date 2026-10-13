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
asks for confirmation first. Then it:

1. revokes this device's own credential on the node through
   `PigeonDeviceAuthorizationApi.retireOwnDevice`. This is the same revocation
   as "Remove access" under "Manage devices". The node never revokes the only
   credential of an identity. For that case the user confirms again, and step 2
   is skipped: the device stays authorized and keeps its reader;
2. releases this device's reader from each direct conversation inbox. This step
   is best effort (see `opaque-mailboxes-client.md`);
3. deletes the device vault record for the identity (IndexedDB
   `pigeon-swarm-device-vault`) through `DeviceUnlockForgetter`, which calls
   `IdentityUnlockRepository.forget`;
4. runs the logout described above.

If step 1 fails, the user stays signed in with the device still authorized, and
sees an inline error. Nothing local is removed. If step 3 fails after the
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

Unlock makes one device-signed read of `GET /identity-devices/:id/devices`. If
the node answers 401 with code 401020 ("Invalid signed request"), this browser
does not decide yet. It repeats the same read signed with the recovery
authority and checks the device catalog. Only when this device's credential is
missing from that catalog is the device treated as removed. A bad signature or
a stale timestamp also returns 401020, so the code alone never counts.

When the device is treated as removed, unlock throws `DeviceRemovedError`
naming the identity, and no session is returned. The sign-in screen shows
"This device was removed from your account." and says that the messages saved
on this browser stay until the user erases them. It erases nothing by itself,
because the removal signal is not signed (see the residual risk below). Two
actions follow:

- "Pair this device again" opens the new-device pairing flow. Pairing
  overwrites the stale local record through `DeviceIdentityVault.register`,
  which uses `store.put`, so no wipe is needed first.
- "Erase local copy and start over" runs `eraseRemovedDevice` for that
  identity: it wipes the stored one-to-one history, the outbox, and the pending
  device-sealed recovery records (see `opaque-mailboxes-client.md`,
  "Same-device history"). It then calls `identities.forgetDeviceUnlock` for the
  identity, which deletes the device vault record as in step 3 above. When the
  wipe fails, the screen says the messages could not be erased, the vault
  record stays, and the action stays so it can be retried. It revokes nothing
  on the node, and the identity stays recoverable with the recovery key.

Other outcomes are not removal:

- A 401 with any other code, a 5xx response, and a network error (a `TypeError`
  from `fetch`) are rethrown unchanged.
- If the catalog check itself fails, the original error is rethrown. A
  transient failure never becomes "removed".
- Detection erases nothing. Only the explicit erase action wipes the stored
  history, outbox and pending recovery records and deletes the vault record.

Residual risk: the removal signal is the node's answer. Neither the 401020
code nor the device catalog is signed by a key this browser already trusts, so
a node, or a party that controls its responses, can report removal for a
device that is still authorized. It must reject the device-signed read with
401020 and also leave this device out of the catalog. The device then shows the
removal notice and cannot sign in until it pairs again or the node answers
honestly; its stored data stays. An automatic erase needs a catalog signed by
a trusted key, at a revision no older than the session's local authorization
revision, so an older valid catalog cannot be replayed.

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

Revoked device: `PigeonDeviceAuthorizationApi.spec.ts` (`yarn test:crypto`)
checks that `DeviceRemovedError` names the identity. `eraseRemovedDevice.spec.ts`
and `deviceRemovedCopy.spec.ts` (`yarn test`) cover the wipe steps, the failure
result, and the sign-in copy. `e2e/device-revoke-mailbox.spec.ts` signs the
revoked device in again against a real node and checks the message, that the
history rows stay, and that "Erase local copy and start over" leaves none. It
then forges the 401020 answer and a catalog without the device for a device
that is still authorized, and checks that the notice shows and nothing is
erased.

## Out of scope

- **Sealed conversation keys in session memory.** Raw conversation keys stay in
  session memory while the session is alive. Sealing them at rest in memory was
  evaluated and not adopted: it does not stop a same-origin script, which can
  call the same paths.
- **Clickjacking.** Needs a `frame-ancestors` response header from the hosting
  server; see "Other protections".
