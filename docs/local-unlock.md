# Local unlock and browser key exposure

This document describes the browser client (`pigeon-swarm-ui`) as it behaves
on `main`. It covers what is stored locally, what unlocks it, what logout
removes, and what each choice does and does not protect against.

## Unlock

Each identity on this device unlocks with its device password plus the
device-bound factor key (`DeviceIdentityVault.unlock`). The client has no
automatic-unlock mode and no passkey or WebAuthn unlock: every browser gets
the same password unlock, so none falls back to a weaker one.

The password is the only secret a person types, so `DeviceIdentityVault`
enforces the password policy (`IdentityPassword.assertStrong`: 20 to 256
characters with uppercase, lowercase, number and symbol) every time it wraps
the root key: creating an identity, recovery-key login, pairing a new device
and changing the password. A caller that skips the form check still cannot
store a weak envelope. The password form also shows non-blocking guidance: a
long phrase of four or more unrelated words, not reused elsewhere.

Re-authentication before sensitive actions (authorizing a new device,
exporting a history backup) types the device password again
(`DeviceIdentityVault.confirmUnlock`).

### Offline guessing

The root-key envelope is scrypt (N = 2^18, r = 8, p = 1) plus HKDF and
AES-GCM. One guess costs about 0.3 s and 256 MiB on one desktop core, so an
attacker who copied the browser profile pays that per guess with no attempt
limit. Assuming an attacker who runs about a thousand guesses per second, a
password chosen at random from 2^40 possibilities lasts about 35 years, and
four words drawn at random from a 7,776-word list (about 2^51) far longer; a
compliant but predictable password (a known phrase, a reused password) can
still fall to a dictionary.
The envelope never leaves this browser: the node stores no password-wrapped
key, and the root key reaches another device only encrypted to that device
during pairing.

A person who loses the password signs in again with the recovery key or pairs
this browser from another signed-in device; both register the device with a
new password. A device that an earlier build switched to passkey unlock holds
an envelope no password opens; it signs in the same way. No migration runs.

| Local state                                                              | Holds                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Device vault (IndexedDB `pigeon-swarm-device-vault`, store `identities`) | Identity material encrypted under a root key, one scrypt-protected root-key envelope, and a non-extractable HMAC factor key |
| Session                                                                  | Keys and session state in memory. Gone on reload; unlocking again is required                                               |

Plaintext values that stay in `localStorage` after login: the identity ID of
the last login (`pigeon-swarm-last-login-identity-v1`). Workspace preferences
and the last conversation ID are also kept. Drafts are encrypted with the
session before they are stored.

In the independent-client build (`VITE_INDEPENDENT_CLIENT=true`), the device
vault database name and the last-login key carry a `:<node scope>` suffix, so
each node has its own copy.

## What each choice protects against

- **Someone reading the browser profile on disk.** The device vault contents
  are encrypted. Reading them needs the password and the non-extractable factor
  key; with a copy of both, the password can be guessed offline (see Offline
  guessing). Identity IDs and workspace preferences are not encrypted.
- **Same-origin script (for example injected content).** A script running in
  the page can unlock if it knows the password, and can use the factor key
  while the page is alive. The factor key cannot be exported. The production
  build sends a Content Security Policy that blocks inline and eval scripts
  (see below). A script from an allowed origin is not stopped.
- **A compromised device or browser session.** Not protected. A compromised
  browser can wait for the user to unlock and read the session.
- **A same-origin script while the session is alive.** It can read
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

Logout also stops the direct and group message outboxes, closes realtime
sockets, and terminates the message decrypt, attachment cipher and mailbox
miner workers (`stopSessionWork`). It drops the contact presence held in
memory and closes the MLS state. In-flight decrypts and attachment encrypt or
decrypt calls reject; a new worker starts on the next use. The workspace
deletes this device's push subscription, which always unsubscribes in the
browser, even if the backend delete fails.

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
   through `DeviceMailboxRepository`, then its sealed contact directory (see
   `opaque-mailboxes-client.md`) through `ContactDirectoryRepository`;
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
the stored one-to-one and group history, the MLS state, the contact directory,
the decrypted message projections, the pending device-sealed recovery records,
and the drafts and workspace state in localStorage. Last,
`identities.forgetDeviceUnlock` deletes
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
- Also erased: the contact presence sharing choices and the contact presence
  held in memory.
- Not erased: contact pins, archived notification ids, call audio, presence
  and recent emoji preferences, the locally seen message ids, and the direct
  message availability records.

## Recovery-key sign-in

Recovery-key sign-in (`PigeonIdentitiesGateway.recover`) first proves the key:
`PigeonDeviceAuthorizationApi.recover` derives the identity key and recovery
authority from it, refuses a key whose identity id or recovery authority does
not match the identity ("Recovery kit does not belong to this identity."),
and submits a signed recovery transition that replaces every device with this
one. Only then does `DeviceSealedRootRotation.openAfterRecovery` run:

1. it replays the signed transitions (`verifiedDevices`, never the node's
   device list) and refuses unless this device is the only authorized device;
2. it generates a fresh device-sealed root and replaces any existing keychain
   head, which cannot open under a root just generated, with an empty keychain
   sealed under it, chained to the head it replaces
   (`PigeonKeychainApi.replaceHeadAfterRecovery`);
3. it then publishes the root sealed to this verified device only.

The keychain head was sealed under the root of the replaced devices, which no
authorized device holds any more, so its conversation keys are lost: every
one-to-one and group conversation must invite the identity again. The login
form says so under the recovery key input before the user confirms. A failed
replacement publishes no root, so running the recovery again repeats both
steps.

Unlock and pairing never replace a head: they open the root with
`DeviceSealedRootRotation.current`, which refuses to mint over a head it
cannot read (unlock reports `deviceRootUnavailable`). A node that serves a
corrupt or withheld head can stop an unlock or a pairing but cannot make
either clear the keychain. During a real recovery a node can serve a fake
head; the replacement then chains to that head and the node may accept or
refuse it, which a node can already do to any keychain write.

A history backup file exported before the recovery still opens after it: its
key is derived from the identity root, which the recovery key rebuilds, not
from the device-sealed root (see "History backup" below). It brings back the
one-to-one history only; sending in those conversations still needs the new
invitation.

## User-presence check before unlock

The typed password is the only user-presence check. A click or prompt that
does not gate the key would not stop a same-origin script, so the client adds
none: without the password the root key cannot be unwrapped. After unlock, the
session is in memory and the check no longer applies (see "What each choice
protects against").

## Other protections

- **Links in messages.** Only `http`, `https`, and `www.` targets become
  anchors. `javascript:`, `data:`, and `vbscript:` targets stay plain text, and
  raw HTML is escaped. Content longer than the composer's 4000-character
  limit (`MESSAGE_CONTENT_MAX_LENGTH`) comes from another client; it is shown
  as text with links and mentions only, so a flood of formatting delimiters
  cannot keep the parser busy. Mentions are matched with one pattern per
  message, not one per text segment. Covered by `markdownMessage.spec.ts`,
  including a 100,000-character delimiter flood and a flood of links and
  mentions that must each render within one second.
- **Link previews.** A preview shows only its title, description, site name
  and address. The sender-chosen preview image and the site favicon are never
  loaded, because fetching them would tell that site the reader's address and
  when the message was read. Only `http` and `https` targets render, and the
  text is escaped. Covered by `LinkPreviewCard.spec.ts`.
- **Profile pictures and banners.** Anyone can set them, so only embedded
  base64 PNG, JPEG, GIF, WebP and AVIF images render directly. Remote, path
  and SVG references are ignored; content IDs load through the node. Covered
  by `identityDisplay.spec.ts`.
- **Attachments and notifications.** Reviewed: attachments render only as
  image, video or audio elements from decrypted blobs, or download through a
  generated link. The service worker shows the notification text the node
  sends, always with the app's own icon and badge (the browser fetches those
  outside the page policy), and opens only app routes. Covered by
  `IndependentClientServiceWorker.spec.ts`.
- **Protected-root envelope.** The KDF is pinned to
  `v1.scrypt.N262144.r8.p1.hkdf-sha256.aes-256-gcm`. Other scrypt cost, block
  size, or parallelism values are rejected. Covered by
  `DeviceSecurityValueObjects.spec.ts`.
- **Logs and errors.** Reviewed logging call sites do not log keys, decrypted
  payloads, or topics. The realtime gateway constructor's signed-URL log was
  fixed in PR #246, which is on `main`.
- **Diagnostics.** The call diagnostic report (`callDiagnosticReport.ts`)
  holds connection state, not keys or message content. The client has no crash
  reporter.
- **Adding a device.** Profile → Security → "Add another device" hands the
  identity root and the history secret to the new device. Authorizing it
  first asks again for the device password
  (`PigeonIdentitiesGateway.authorizeDevicePairing`, through
  `DeviceIdentityVault.confirmUnlock`); a refusal publishes and authorizes
  nothing. This stops someone at an unlocked, unattended screen. It does not
  stop a same-origin script, which holds the session already (see "What each
  choice protects against").
- **History backup.** Profile → device storage → Backup writes one file with
  this identity's stored one-to-one history and contact pins
  (`PigeonHistoryBackup`, `HistoryBackupFile`). Exporting first asks again for
  the device password (`DeviceIdentityVault.confirmUnlock`, no side effects);
  a refusal exports nothing. The file is AES-256-GCM under a key derived with
  HKDF-SHA256 from the identity root, labelled for backups and bound to the
  identity id, which is also authenticated as associated data and never
  written in clear. The identity root is the one the recovery key rebuilds, so
  any device of the identity opens the file, also after a password change or
  device-root rotation, and no other identity can. The file holds stored
  records only: no private keys, keychain entries, MLS state, ratchet state or
  session keys, and no group history. Format `pigeon-swarm-backup` version 1
  is the only one read: another version is refused as unsupported, and a
  wrong identity, a changed byte or a malformed payload as unreadable, before
  anything is stored. Restore re-tags own records under the current device
  root, skips records already stored, and merges contact pins so pins on this
  device win and a restored pin never takes a handle held here.
  **Guarantee change:** forward secrecy no longer covers backed-up messages.
  Whoever holds a backup file and later steals the identity root or the
  recovery key reads the history in it, even after it was deleted from every
  device (`PigeonHistoryBackup.spec.ts` opens a file with the identity root
  alone). Keep backup files private and delete old ones. Group forward
  secrecy is described in `mls-group-encryption.md`, Security properties and
  limits.
- **Content Security Policy.** The production build injects a
  `Content-Security-Policy` meta tag (policy in
  `src/shared/infrastructure/security/contentSecurityPolicy.ts`, applied in
  `vite.config.ts`). Scripts come only from the app origin and
  `'wasm-unsafe-eval'`. Inline scripts and `eval` are blocked. Styles allow
  `'unsafe-inline'`. Objects, base URIs, and frames are blocked. Images load
  only from the app origin, `data:` and `blob:` URLs, and, in builds whose
  `VITE_API_SERVER_URL` is on another origin, that API origin (stickers). The
  dev server sends no policy. `frame-ancestors` is ignored in a meta tag: the
  node serving the client (`PublicStaticContent`) sends
  `frame-ancestors 'none'` and `X-Frame-Options: DENY`, and the independent
  client server (`client/server.mjs` in pigeon-swarm) sends
  `frame-ancestors 'none'`. Covered by `contentSecurityPolicy.spec.ts`.

## Tests

`DeviceIdentityVault.spec.ts` and `DeviceIdentityProtector.spec.ts` run in the
`crypto` jest project (`yarn test:crypto`), which `yarn test` runs together
with the `unit` project. They are listed in `REAL_CRYPTO_SPECS` in
`jest.config.cjs` because the `unit` project's `@haskou/pigeon-swarm-crypto`
fake does not implement the device factor. The vault spec covers that a
password change replaces the old password, that confirming the password
changes nothing, and that every path that wraps the root key (creating,
registering, changing the password) refuses a password below the policy.

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

Recovery-key sign-in: `DeviceSealedRootRotation.spec.ts` checks that
`openAfterRecovery` refuses while the signed transitions authorize another
device or a different one, when they do not verify, and on a session that
already holds a root; that it replaces the head before publishing the root and
publishes nothing when the replacement fails; and that `current` never replaces
a corrupt or withheld head. `PigeonKeychainApi.spec.ts` checks the replacement
chains to the unreadable head at the next version and opens under the new root,
and leaves a readable or missing head alone. `PigeonIdentitiesGateway.spec.ts`
and `PigeonIdentitySessionApi.spec.ts` check that a refused key opens no root,
and that pairing and unlock over an unreadable head refuse without replacing
it. `e2e/recovery-key-keychain.spec.ts` recovers on a new device against a
real node after the identity saved a conversation key, checks the loss notice,
and restores a backup exported before the recovery.

## Out of scope

- **Sealed conversation keys in session memory.** Raw conversation keys stay in
  session memory while the session is alive. Sealing them at rest in memory was
  evaluated and not adopted: it does not stop a same-origin script, which can
  call the same paths.
- **Clickjacking on other hosting.** Serving the built client from anything
  other than the node or the independent client server needs its own
  `frame-ancestors` response header.
