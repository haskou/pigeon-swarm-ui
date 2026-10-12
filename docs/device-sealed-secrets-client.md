# Device sealed secrets (client)

Client side of haskou/pigeon-swarm-node#451. Design: `docs/design/device-sealed-secrets.md` in the node repo. Module: `src/contexts/identities/`.

## Scope

- Seal, open, publish (`PUT`), and fetch the caller's own entry (`GET`).
- Wired into the app. Unlock opens the device-sealed root (`PigeonIdentitySessionApi`) and falls back to `masterKey` when none is open. Mailbox readers, the authorship tag (`DirectMessageAuthorship.tag`) and the keychain cipher (`KeychainCipher`) derive from `sessionRootKey(session)`: the opened root, else `masterKey`. A keychain head sealed under `masterKey` before the root existed opens once through a legacy fallback, and the next keychain publish seals it under the root. #320 removes that fallback. The node has no re-encryption endpoint for the keychain, so the client re-seals it.

## Seal

- One fresh payload per generation, sealed to every recipient device credential with `PublicKey.encrypt`. The design doc says "fresh payload per credential"; this client uses one payload across recipients because every device must derive the same mailbox root from it. Each entry is still sealed separately to its recipient.
- Each entry is signed by the publishing device key over the preimage (`DeviceSealedSecretPreimage`). Key order is fixed by the node contract: `purpose`, `identityId`, `generation`, `authorizationRevision`, `publisherCredential`, `recipientCredential`, `sealedSecret`.
- The client checks 1 to 128 recipients. The node also rejects a `sealedSecret` longer than 4096 characters with `400`; the client does not check that length.

## Publish

- `PUT /identity-devices/{identityId}/sealed-secrets` with device proof headers only (`X-Timestamp`, `X-Device-Credential`, `X-Device-Signature`). Body: `{ generation, authorizationRevision, entries }`, where `authorizationRevision` is the session revision.
- The ack must echo `identityId`, `generation`, and `authorizationRevision`. Any other ack throws.
- A `409` is not retried here. The caller refetches the head and rebuilds the publication.

## Rotation

- Revoke: `PigeonIdentitiesGateway.revokeDevice` reads the keychain head under the current root, revokes, publishes a fresh root to the remaining devices with `DeviceSealedRootRotation.rotate`, then rewraps the head under the new root. A rotation or rewrap failure is no longer count-only: it propagates after the revoke has applied, and the residuals below apply.
- Unlock: `current` runs at the end of `unlock`. It reads the device's own entry when the authorization revision matches, else it publishes. A device without an entry publishes on its first unlock. A failure falls back to a session with no root (`masterKey`).
- Enrolment keeps the root. `PigeonIdentitiesGateway.authorizeDevicePairing` refuses without an open root, then `DeviceSealedRootRotation.reseal` publishes the same root at the new revision to every device, so the keychain stays readable. Only a revoke mints a fresh root. The root is shared across recipients, so every device derives the same mailbox root from it. This deviates from the node design's per-credential payload; the node side should confirm it accepts one payload across recipients.
- Concurrent publishes: the later generation wins. A device that lost the race re-enrols on its next unlock.
- Residuals (#300, follow-up #320): a pairing that fails after `apply` but before `reseal` leaves an authorized device with no completion code; revoke it and pair again. A failed keychain rewrap after the new root is published strands the keychain under the previous root, and survivors cannot open it until a device that still holds that root republishes it; nothing retries automatically. A revoked device holding `masterKey` and its identity key can publish a `masterKey`-sealed head that survivors accept through the legacy fallback until #320 removes it.
- Forget: `forgetCurrentDevice` does not publish. `retireOwnDevice` revokes the forgetting device unless it is the only device; then its mailbox readers are released (not for the only device) and the local unlock is dropped. The forgetter gets 401 on its own publish. A publish before the revoke would have to list the forgetter as a recipient, because the node's `DeviceSealedSecretBundle.assertPublishableBy` requires the recipients to equal every authorised credential. The forgetter would then receive the new root too, so publishing first cannot exclude it. The fresh root therefore comes from a remaining device on its next unlock. Exposure window: a forgotten device that still holds the old root keeps read access until then. A tighter bound needs a node contract change (`haskou/pigeon-swarm-node#289`).
- Multi-rotation residual: a device that missed several generations bridges each inbox on its next open. The previous root stays registered until every listed credential has a sealed device reader. Pruning runs only under a device-sealed session (see `opaque-mailboxes-client.md`, Pruning).

## Fetch

- `GET` with device proof. Returns the caller's own entry of the stored generation, opened with the device key. Returns `null` on `404`, meaning no entry exists for this device yet.
- Opening checks that the identity and recipient match, verifies the publisher signature over the preimage, then decrypts.

## Generation

- `max(stored generation, clock) + 1`. A device without its own entry cannot read the stored generation, so the clock keeps the next generation ahead of a stale head. Resolved in `DeviceSealedRootRotation`.

## Tests

- The specs use real keys, so they run in the real-crypto suite (`yarn test:crypto`), registered in `jest.real-crypto.config.cjs` and excluded from `jest.config.cjs`, like `PigeonDeviceAuthorizationApi.spec.ts`.
