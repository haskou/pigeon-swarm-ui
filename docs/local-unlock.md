# Local unlock and browser key exposure

This document describes the browser client (`pigeon-swarm-ui`) as it behaves
on `main`. It covers what is stored locally, what unlocks it, what logout
removes, and what each choice does and does not protect against.

## Modes

There is one local unlock mode today: the device vault, which always requires
the password. The client has no automatic-unlock mode.

Passkey PRF is not a local unlock mode. Its code was removed because no
identity was created with it. Wiring it back is a product decision.

| Local state                                                              | Holds                                                                                                                     | Unlock requires                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Device vault (IndexedDB `pigeon-swarm-device-vault`, store `identities`) | Identity material encrypted under a root key, a scrypt-protected root-key envelope, and a non-extractable HMAC factor key | Password (`DeviceIdentityVault.unlock`) plus the device-bound factor key |
| Session                                                                  | Keys and session state in memory                                                                                          | Gone on reload. Logging in again is required                             |

Plaintext values that stay in `localStorage` after login: the identity ID of
the last login (`pigeon-swarm-last-login-identity-v1`). Workspace preferences
and the last conversation ID are also kept. Drafts are encrypted with the
session before they are stored.

## What each choice protects against

- **Someone reading the browser profile on disk.** The device vault contents
  are encrypted. Reading them needs the password and the non-extractable factor
  key. Identity IDs and workspace preferences are not encrypted.
- **Same-origin script (for example injected content).** A script running in
  the page can call unlock if it knows the password, and can use the factor key
  while the page is alive. The factor key cannot be exported. The client has no
  Content Security Policy yet, so this is not mitigated.
- **A compromised device or browser session.** Not protected. Unlock has no
  user-presence step.

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

This document does not claim that logout stops every background task or that
JavaScript memory is cleared. Neither is verified.

### Log out and forget this device

The profile menu has a second action, "Log out and forget this device". It
asks for confirmation first. Then it:

1. deletes the device vault record for the identity (IndexedDB
   `pigeon-swarm-device-vault`) through `DeviceUnlockForgetter`, which calls
   `IdentityUnlockRepository.forget`;
2. removes legacy remember-me records (`pigeon-swarm-credentials`,
   `pigeon-swarm-identity-preview`) that older builds wrote;
3. runs the logout described above.

If step 1 fails, the user stays signed in and sees an inline error. Nothing
else is removed in that case.

The action does not revoke this device's server-side authorization. Revoke it
under "Manage devices" if it must stop working. Signing in here again needs the
recovery key or a device pairing from a signed-in device.

## Transition from the previous local format

Earlier builds stored a local unlock in IndexedDB database
`pigeon-swarm-device-unlock` (store `sessions`). It held the identity master
key and identity key pair, encrypted with an AES key kept in the same database.
That format was removed in `b03d913`.

`deleteLegacyLocalDeviceUnlockStore`
(`src/contexts/identities/infrastructure/storage/deleteLegacyLocalDeviceUnlockStore.ts`)
deletes that database. `useAppBootstrap` calls it once on mount, after a node
is selected, so node-scoped storage keys resolve.

- A missing database is not created.
- Without `indexedDB`, the step is skipped.
- A delete blocked by another open tab completes when that tab closes.
- Nothing on `main` reads the legacy store, so deleting it changes no unlock
  behaviour.

Covered by `deleteLegacyLocalDeviceUnlockStore.spec.ts`.

Older builds also stored remember-me records under `pigeon-swarm-credentials`
and `pigeon-swarm-identity-preview`. `deleteLegacyRememberedIdentityStorage`
(`src/contexts/identities/infrastructure/storage/deleteLegacyRememberedIdentityStorage.ts`)
removes them on mount and when a device is forgotten. The current build no
longer writes them. Covered by `deleteLegacyRememberedIdentityStorage.spec.ts`.

## Other protections

- **Links in messages.** Only `http`, `https`, and `www.` targets become
  anchors. `javascript:`, `data:`, and `vbscript:` targets stay plain text, and
  raw HTML is escaped. Covered by `markdownMessage.spec.ts`.
- **Protected-root envelope.** The KDF is pinned to
  `v1.scrypt.N262144.r8.p1.hkdf-sha256.aes-256-gcm`. Other scrypt cost, block
  size, or parallelism values are rejected. Covered by
  `DeviceSecurityValueObjects.spec.ts`.
- **Logs.** The realtime gateway logs connection URLs with `signature` removed.
  The URL keeps `identityId` and `timestamp`. Reviewed logging call sites do not
  log keys, decrypted payloads, or topics.

## Tests

`DeviceIdentityVault.spec.ts` and `DeviceIdentityProtector.spec.ts` run in
`yarn test:crypto` (`jest.real-crypto.config.cjs`), which `yarn test` runs after
the main jest suite. The main jest config excludes them because its
`@haskou/pigeon-swarm-crypto` mock does not implement the device factor.

## Not in this change

- **Session-only versus remembered-device split.** It overlaps branch
  `security/session-only-auth` in the primary checkout.
- **User-presence check** before unlock.
- **Content Security Policy.** The node URL is user-configurable, so a policy
  needs a browser smoke test first.
- **Logout stops background work.** Needs verification.
- **Diagnostic export and crash reports.** Not reviewed.
