# Device sealed secrets (client)

Client side of haskou/pigeon-swarm-node#451. Design: `docs/design/device-sealed-secrets.md` in the node repo. Module: `src/contexts/identities/`.

## Scope

- Seal, open, publish (`PUT`), and fetch the caller's own entry (`GET`).
- Not wired into the app yet. Nothing publishes after a revoke, and the mailbox root still derives from `session.masterKey`. The follow-up orchestration publishes the next generation, switches the root derivation to the latest opened secret, rotates readers (`docs/opaque-mailboxes-client.md`), and rotates the keychain key.

## Seal

- One fresh payload per generation, sealed to every recipient device credential with `PublicKey.encrypt`. The design doc says "fresh payload per credential"; this client uses one payload across recipients because every device must derive the same mailbox root from it. Each entry is still sealed separately to its recipient.
- Each entry is signed by the publishing device key over the preimage (`DeviceSealedSecretPreimage`). Key order is fixed by the node contract: `purpose`, `identityId`, `generation`, `authorizationRevision`, `publisherCredential`, `recipientCredential`, `sealedSecret`.
- The client checks 1 to 128 recipients. The node also rejects a `sealedSecret` longer than 4096 characters with `400`; the client does not check that length.

## Publish

- `PUT /identity-devices/{identityId}/sealed-secrets` with device proof headers only (`X-Timestamp`, `X-Device-Credential`, `X-Device-Signature`). Body: `{ generation, authorizationRevision, entries }`, where `authorizationRevision` is the session revision.
- The ack must echo `identityId`, `generation`, and `authorizationRevision`. Any other ack throws.
- A `409` is not retried here. The caller refetches the head and rebuilds the publication.

## Fetch

- `GET` with device proof. Returns the caller's own entry of the stored generation, opened with the device key. Returns `null` on `404`, meaning no entry exists for this device yet.
- Opening checks that the identity and recipient match, verifies the publisher signature over the preimage, then decrypts.

## Open point

- A device without its own entry cannot read the stored generation, so a naive `latest + 1` may be stale. Candidate for the follow-up: `max(latest opened generation, clock) + 1`. Not implemented.

## Tests

- The specs use real keys, so they run in the real-crypto suite (`yarn test:crypto`), registered in `jest.real-crypto.config.cjs` and excluded from `jest.config.cjs`, like `PigeonDeviceAuthorizationApi.spec.ts`.
