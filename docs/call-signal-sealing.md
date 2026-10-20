# Sealed and signed call signals

Refs haskou/pigeon-swarm-node#698. Call signals (offer, answer, ICE) carry no
plaintext `payload`: each is sealed per recipient device and signed by the
sender device. Only signed callers are accepted; there is no legacy path.

## Sealing keys

Each device keeps an X25519 sealing key per UTC day in IndexedDB
(`pigeon-call-sealing`, `DeviceSealingKeyStore`). `DeviceSealingRecordPublisher`
signs and publishes a DeviceSealingRecord for day D (and D-1 across the
rollover) idempotently; `useDeviceSealingRecords` runs it at session start and
every 15 minutes.

## Send

`CallSignalSealer` reads the recipient's sealing view from the node, seals the
payload to every recipient device key, signs the canonical bytes
(`CallSignalSigningBytes`) and sends with a 20 s lifetime.
`community_channel` and `group_capability` scopes are refused.

## Receive (verdict V1)

`CallSignalVerifier.receive` checks recipient entry, lifetime and clock skew,
the sender device signature, party membership, replay, and that the sender
device is authorised on the identity's authorization chain. The chain is
replayed from the genesis (identity record proven by its own signature) over
at least two independent origins (own node and the sender's verified mailbox
home) that must agree; fewer than two means refusal (`chain-unverified`). The
verifier uses the verified chain head, not the node-claimed revision alone,
and persists a floor so a head older than previously seen is refused
(`stale-head`). Refusals ack the delivery, mark the call failed and show
`calls.signalRefused*` copy. Logs carry only call id and reason.

## Residuals

First-contact window, stale head, seen-set not persisted, skew and envelope
size unmeasured, metadata exposure, transition-history disclosure, in-flight
signals from a removed device refused, floor reset by clearing site storage,
the node-served sealing view's device list is not chain-verified on send.
The signing vectors in `src/test/fixtures/call-signal-signing-vectors.json`
are for the node to adopt.
