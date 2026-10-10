# Local unlock and browser key exposure

This document describes the browser client (`pigeon-swarm-ui`) as it behaves
on `main`. It covers what is stored locally, what unlocks it, what logout
removes, and what each choice does and does not protect against.

## Modes

There is one local unlock mode today: the device vault, which always requires
the password. The client has no automatic-unlock mode.

| Local state                                                              | Holds                                                                                                                     | Unlock requires                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Device vault (IndexedDB `pigeon-swarm-device-vault`, store `identities`) | Identity material encrypted under a root key, a scrypt-protected root-key envelope, and a non-extractable HMAC factor key | Password (`DeviceIdentityVault.unlock`) plus the device-bound factor key                    |
| Remember-me (`localStorage` `pigeon-swarm-credentials`)                  | Identity ID only                                                                                                          | Password. Restoring a remembered identity is rejected, so the login form is only pre-filled |
| Session                                                                  | Keys and session state in memory                                                                                          | Gone on reload. Logging in again is required                                                |

Plaintext values that stay in `localStorage` after login: the identity ID of
the last login (`pigeon-swarm-last-login-identity-v1`), and the remembered
identity preview (`pigeon-swarm-identity-preview`: identity ID, display name,
picture URL). Workspace preferences and the last conversation ID are also kept.
Drafts are encrypted with the session before they are stored.

## What each choice protects against

- **Someone reading the browser profile on disk.** The device vault contents
  are encrypted. Reading them needs the password and the non-extractable factor
  key. Identity IDs, the display-name preview, and workspace preferences are
  not encrypted.
- **Same-origin script (for example injected content).** A script running in
  the page can call unlock if it knows the password, and can use the factor key
  while the page is alive. The factor key cannot be exported. The client has no
  Content Security Policy yet, so this is not mitigated.
- **A compromised device or browser session.** Not protected. Unlock has no
  user-presence step.

## Logout

`clearSession` in `src/app/presentation/useAppBootstrap.ts` runs on logout. It:

- clears the remember-me record;
- removes the decrypted message projection caches
  (`pigeon-message-projection-cache`, `pigeon-community-message-projection-cache`);
- drops the in-memory session and preloaded conversation messages.

It keeps, on purpose:

- the device vault. Deleting it would force a recovery-key login on the next
  visit;
- the identity preview, last-login identity ID, workspace preferences, and
  community unread counts.

This document does not claim that logout stops every background task or that
JavaScript memory is cleared. Neither is verified.

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

## Not in this change

- **Session-only versus remembered-device split.** It overlaps branch
  `security/session-only-auth` in the primary checkout.
- **Passkey PRF.** `WebAuthnPrfKeyProtector` has no production callers, and no
  identity is created with PRF. The `localDeviceUnlock*` copy and
  `PasskeyPrfUnavailableNotice` describe that unused feature. Wiring or removing
  it is a product decision.
- **Deleting the device vault on logout** as an option.
- **User-presence check** before unlock.
- **Content Security Policy.** The node URL is user-configurable, so a policy
  needs a browser smoke test first.
- **Logout stops background work.** Needs verification.
- **Diagnostic export and crash reports.** Not reviewed.
- **Vault tests.** `DeviceIdentityVault.spec.ts` and
  `DeviceIdentityProtector.spec.ts` are excluded in `jest.config.cjs`.
