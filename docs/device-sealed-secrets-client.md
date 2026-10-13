# Device sealed secrets (client)

Client side of haskou/pigeon-swarm-node#451. Design: `docs/design/device-sealed-secrets.md` in the node repo. Module: `src/contexts/identities/`.

## Scope

- Seal, open, publish (`PUT`), and fetch the caller's own entry (`GET`).
- Wired into the app. Unlock opens the device-sealed root (`PigeonIdentitySessionApi`) and falls back to `masterKey` when none is open. Mailbox readers and the authorship tag (`DirectMessageAuthorship.tag`) derive from `sessionRootKey(session)`: the opened root, else `masterKey`. The keychain cipher (`KeychainCipher`) opens and seals only under the opened root, with no `masterKey` fallback (#320). The node has no re-encryption endpoint for the keychain, so the client re-seals it under the root.

## Seal

- One fresh payload per generation, sealed to every recipient device credential with `PublicKey.encrypt`. The design doc says "fresh payload per credential"; this client uses one payload across recipients because every device must derive the same mailbox root from it. Each entry is still sealed separately to its recipient.
- Each entry is signed by the publishing device key over the preimage (`DeviceSealedSecretPreimage`). The node rebuilds it with alphabetical keys: `authorizationRevision`, `generation`, `identityId`, `publisherCredential`, `purpose`, `recipientCredential`, `sealedSecret` (`DeviceSealedSecretBundle.signingPayload`). Credentials are the body-only base64 form, without PEM headers, both in the preimage and in the entries. The node design doc's purpose-first order is stale; the node verifier is the contract.
- The client checks 1 to 128 recipients. The node also rejects a `sealedSecret` longer than 4096 characters with `400`; the client does not check that length.

## Publish

- `PUT /identity-devices/{identityId}/sealed-secrets` with device proof headers only (`X-Timestamp`, `X-Device-Credential`, `X-Device-Signature`). Body: `{ generation, authorizationRevision, entries }`, where `authorizationRevision` is the session revision.
- The ack must echo `identityId`, `generation`, and `authorizationRevision`. Any other ack throws.
- A `409` is not retried here. The caller refetches the head and rebuilds the publication.

## Rotation

- Revoke: `PigeonIdentitiesGateway.revokeDevice` reads the keychain head under the current root and records that root, sealed under `masterKey`, before the revoke (`DeviceSealedRecovery.rememberKeychainRewrap`). It then revokes, publishes a fresh root to the remaining devices with `DeviceSealedRootRotation.rotate`, and rewraps the head under the new root (`rewrapAfterRevoke`). If the record cannot be written, the revoke does not run. If the rewrap fails after the revoke has applied, the record stays and unlock retries it.
- Unlock: `current` runs at the end of `unlock`. It reads the device's own entry when the authorization revision matches, else it publishes. A device without an entry reads the identity keychain head first. A head that does not open fails that step, so no root is minted over it. With no root open, every head fails, because the `masterKey` fallback is gone (#320). No head publishes. A failure falls back to a session with no root (`masterKey`). Pending recovery then runs: `resumeRootReseal` after `synchronize` reseals a recorded pairing root at the synchronized revision, without needing an open root; once the root is open, `resumeKeychainRewrap` rewraps a head that a revoke left under the previous root. A record is kept while no root is open or the step fails, and dropped on success, or when its revision no longer matches. Unlock no longer migrates a `masterKey`-sealed head (see Legacy masterKey heads).
- Enrolment keeps the root. `PigeonIdentitiesGateway.authorizeDevicePairing` opens the root first when the session holds none (`DeviceSealedRootRotation.current`), and refuses if no root results. An unreadable keychain head fails that open, so no root is minted over it. It then records the root under `masterKey` (`DeviceSealedRecovery.resealAfterPairing`). `DeviceSealedRootRotation.reseal` publishes the same root at the new revision to every device, so the keychain stays readable. A failed reseal keeps the record, and unlock retries it. The completion code is returned either way. Only a revoke mints a fresh root. The root is shared across recipients, so every device derives the same mailbox root from it. This deviates from the node design's per-credential payload; the node side should confirm it accepts one payload across recipients.
- Concurrent publishes: the later generation wins. A device that lost the race re-enrols on its next unlock.
- Residuals (#300):
  - Pairing: a new device whose reseal failed cannot read a root-sealed keychain until the authorizer's next unlock. If the pending record also cannot be written, nothing retries the reseal. The device stays authorized, and the completion code was still returned. Revoke it and pair again.
  - Pending records are stored per identity in localStorage (`scopeClientStorageKey`, `device-sealed-recovery:v1:<identityId>`). Their root copies are sealed under `masterKey`, so they are not plaintext. An encrypted copy of the root still stays at rest until its step clears. Clearing browser storage loses pending records, and nothing retries those steps.
  - Recovery runs only on the device that recorded it. If that device never unlocks again, the step stays pending. Survivors then cannot open the keychain until a device that still holds the previous root republishes it.
  - A revoke whose rotate fails after the revoke applied leaves a stale own entry holding the old root. Recovery does not reseal stale-entry roots, because a compromised root could be republished.
- No-entry guard residual: a device whose head read fails at its first unlock keeps no root and cannot read the keychain until a device that holds the root reseals it. Unlock still succeeds.
- Forget: `forgetCurrentDevice` does not publish. `retireOwnDevice` revokes the forgetting device unless it is the only device; then its mailbox readers are released (not for the only device) and the local unlock is dropped. The forgetter gets 401 on its own publish. A publish before the revoke would have to list the forgetter as a recipient, because the node's `DeviceSealedSecretBundle.assertPublishableBy` requires the recipients to equal every authorised credential. The forgetter would then receive the new root too, so publishing first cannot exclude it. The fresh root therefore comes from a remaining device on its next unlock. Exposure window: a forgotten device that still holds the old root keeps read access until then. A tighter bound needs a node contract change (`haskou/pigeon-swarm-node#289`).
- Multi-rotation residual: a device that missed several generations bridges each inbox on its next open. The previous root stays registered until every listed credential has a sealed device reader. Pruning runs only under a device-sealed session (see `opaque-mailboxes-client.md`, Pruning).

## Fetch

- `GET` with device proof. Returns the caller's own entry of the stored generation, opened with the device key. Returns `null` on `404`, meaning no entry exists for this device yet.
- Opening checks that the identity and recipient match, verifies the publisher signature over the preimage, then decrypts.

## Generation

- `max(stored generation, clock) + 1`. A device without its own entry cannot read the stored generation, so the clock keeps the next generation ahead of a stale head. Resolved in `DeviceSealedRootRotation`.

## Legacy masterKey heads (#320)

- Keychain heads open and seal only under the device-sealed root. A head sealed under `masterKey` (the pre-root format) does not open, and a publish without an open root throws.
- The `masterKey` fallback and the unlock migration (`PigeonKeychainApi.migrateLegacyHead`) are removed. Unlock no longer reseals a `masterKey` head.
- Migration window closed: per the maintainer, no legacy identities exist, so no node check or marker is kept. A `masterKey`-sealed head that still exists stays unreadable, and nothing recovers it.
- Covered by the red-first tests in `KeychainCipher.spec.ts`, `PigeonKeychainApi.spec.ts`, and `PigeonIdentitySessionApi.spec.ts`.

## Tests

- The specs use real keys, so they run in the real-crypto suite (`yarn test:crypto`), registered in `jest.real-crypto.config.cjs` and excluded from `jest.config.cjs`, like `PigeonDeviceAuthorizationApi.spec.ts`.
