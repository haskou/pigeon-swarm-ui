<p align="center">
  <img src="./public/logo.png" alt="pigeon-swarm logo">
</p>

<p align="center">
  <a href="https://github.com/haskou/pigeon-swarm-ui/actions/workflows/ci.yml">
    <img src="https://github.com/haskou/pigeon-swarm-ui/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg" alt="License: PolyForm Noncommercial 1.0.0">
  </a>
</p>

# pigeon-swarm-ui

`pigeon-swarm-ui` is the browser client for `pigeon-swarm-node`, the backend
node of Pigeon Swarm: a peer-to-peer communication platform built around
self-hosted nodes, user-owned identities, and client-side encrypted
conversations.

The UI talks to a local node over signed HTTP requests and an authenticated
WebSocket connection. It is responsible for identity creation and login,
profile editing, keychain handling, message encryption, attachment encryption,
and the user experience around conversations, channels, groups, communities,
networks, and node management.

The backend stores and syncs opaque encrypted payloads. The browser keeps
private keys, passwords, decrypted keychains, and decrypted conversation or
community keys local.

## Why pigeons?

Carrier pigeons are low-tech, decentralized message delivery with excellent
branding. They do not need a corporate inbox, a central timeline, or a blessed
server to know where they are going.

The name is partly a joke, partly a design reminder: messages should move
through the swarm without asking permission from one big place.

## Networks and communities

The UI exposes two different access layers: networks and communities.

Networks define which nodes can discover, connect, and exchange events with each
other. Public networks can be joined openly. Private networks require permission
before outside nodes can connect, so unknown nodes cannot simply appear and
participate.

Communities define the social spaces users interact with inside those networks.
Public communities can be visible and accessible to users in the network.
Private communities can restrict who can see them, join them, or participate in
their channels and conversations.

In short: networks control node access, while communities control user and
content access. Keeping both separate avoids turning every permission check into
a tiny distributed hostage negotiation.

## Capabilities

- Local identity registration and login by identity id or handle.
- Profile editing with handle, name, biography, avatar and banner CIDs.
- Client-owned encrypted keychains for conversations.
- Private communities encrypted with MLS (RFC 9420) groups, one leaf per
  device, rekeyed when members leave or are removed. See
  [MLS group encryption](./docs/mls-group-encryption.md).
- One-to-one and group conversations with encrypted messages, replies,
  attachments, deletion tombstones and unread state.
- Public and private communities with members, text channels, encrypted channel
  messages and owner management UI.
- Conversation, group conversation and community invitations.
- Public IPFS uploads for profile/community media.
- End-to-end encrypted message attachments stored as private blobs, including
  large-file chunking.
- Realtime updates over WebSocket for conversations, communities,
  notifications and peer state.
- Node first-run flow, public/private network management, peer metrics and
  connection-loss handling.
- Direct and community voice calls; see
  [calls: browser support](./docs/calls-browser-support.md) for which
  browsers can make which calls.
- English and Spanish UI copy, selectable from the profile menu.

## Architecture

The frontend is organized around bounded frontend contexts plus shared
application composition:

- `src/contexts`: feature contexts such as identities, conversations,
  communities, messages, attachments, calls, polls, stickers, notifications and
  networks. Each context owns its application, domain, infrastructure and
  presentation slices where they are needed.
- `src/app`: application composition, workspace orchestration and high-level
  presentation shell.
- `src/shared`: cross-context domain primitives, HTTP/realtime infrastructure,
  media helpers, shared UI components, hooks and i18n.

The UI uses `@haskou/value-objects` for cryptographic value objects and signing
primitives where possible. Private keys, passwords, decrypted keychains and
decrypted conversation/community keys are not sent to the node.

Conversation creation and group roster changes (add, remove, leave, promote and
demote admin) are signed by the active device credential as conversation
operations over the node's current frontier. Group ids are derived client-side
from a creator-chosen nonce, and the node only verifies and replicates them.

## Backend Contract

The UI expects a `pigeon-swarm-node` instance running locally at:

```http
http://localhost:8080/
```

The default API URL is currently configured in:

- [`src/app/API_SERVER_URL.ts`](./src/app/API_SERVER_URL.ts)

Important backend docs live in the node repository:

- [`docs/api.md`](https://github.com/haskou/pigeon-swarm-node/blob/main/docs/api.md)
- [Realtime WebSocket API](https://github.com/haskou/pigeon-swarm-node/blob/main/docs/api.md#realtime-websocket-api)
- [`src/apps/apis/open-api.yaml`](https://github.com/haskou/pigeon-swarm-node/blob/main/src/apps/apis/open-api.yaml)

### Identity admission proof

Publishing an identity (`POST /identities/`, and `PUT /identities/{id}`
when the networks change) carries an `admissionNonce` mined at 16 bits
(`ProofOfWork.identityAdmission` from `@haskou/pigeon-swarm-crypto`). A busy node answers `400` with
`requiredDifficultyBits`. `PigeonIdentityCommandsApi` then re-mines at that
value, signs again and retries, also for updates whose networks did not
change. It retries at most twice and never mines above 24 bits
(`IdentityAdmissionDifficultyPolicy`); any other refusal propagates. While it
re-mines, the create and profile save buttons show the requested difficulty
and the retry number.

### Signed formats

Every signed preimage (identities, keychains, device authorization
transitions, device sealed secrets, device pairing, community operations,
public mutations, signed HTTP requests) is built, signed and verified by
`@haskou/pigeon-swarm-crypto` 6 (`*Signature` classes, `CanonicalJson`,
`DeviceCredentialCommitment`). The UI keeps no local preimage builder. Specs
check those bytes against the vectors the library ships
(`@haskou/pigeon-swarm-crypto/vectors/*.json`), not against local copies.

This is a clean cutover. Identities, keychains, sealed secrets and records
signed before 6 are rejected; there is no reader for the old formats. Wipe the
browser storage of the site (IndexedDB and localStorage) and create a new
identity against a node that also runs crypto 6.

`CanonicalJson` throws on lone UTF-16 surrogates. Group names and member
identities that contain one are rejected by `GroupMailboxRoster`, so a create
or rename with such a name fails before anything is sent.

## Development

Install dependencies:

```bash
yarn
```

Run the development server:

```bash
yarn dev
```

The Vite dev server listens on all interfaces. If the default port is busy,
Vite will choose the next available port.

Common commands:

```bash
yarn lint
yarn test
yarn typecheck
yarn build
yarn preview
```

CI runs lint, typecheck, tests, the Chromium end-to-end specs and the builds on each pull request and on pushes to `main`. A change that only touches Markdown outside `.github/`, or images under `docs/`, skips the `Test` job; its required check still reports.

`yarn test` is a single `jest` run with two projects. `unit` replaces `@haskou/pigeon-swarm-crypto` with the deterministic fake in `src/test/valueObjectsMock.ts`. `crypto` runs the specs listed in `REAL_CRYPTO_SPECS` in `jest.config.cjs` (signatures, KEMs, KDFs and wire vectors) against the real library. `yarn test:unit` and `yarn test:crypto` run one project each. Mocks are cleared before every test (`clearMocks`).

Jest needs Node 24.22.0 or later; CI installs the latest Node 24. Earlier Node 24 releases ship a V8 whose Sparkplug baseline compiler can make a garbage collection crash a jest worker with SIGSEGV in an unrelated suite ([nodejs/node#62393](https://github.com/nodejs/node/issues/62393)); 24.22.0 carries the fix. `src/test/jestRuntime.spec.ts` fails on an older runtime.

This repository does not currently require a `.env` file. The default node URL
is `http://localhost:8080/`, set in `src/app/API_SERVER_URL.ts`. Set
`VITE_API_SERVER_URL` when Vite starts to point the combined build at another
node.

Set `VITE_MAILBOX_AVAILABILITY_SERVERS` to a comma-separated list of up to three
public node API bases to keep a copy of each direct inbox on those nodes as
well. See [Availability servers](docs/opaque-mailboxes-client.md#availability-servers).

## Runtime Dependencies

For the full experience, the browser client expects:

- A running `pigeon-swarm-node` HTTP/WebSocket API.
- A claimed or claimable local node.
- At least one configured node network.
- Public IPFS upload and private blob endpoints exposed by the node.
- Signed request support from the active identity.
- WebSocket `/realtime/v1` support for realtime domain events, authenticated with single-use tickets.

The app can still render connection-loss and first-run screens when the node is
offline or unclaimed.

## Security Model

The frontend is responsible for:

- generating separate stable identity, recovery-authority and per-device keys;
- wrapping the local root key with the password and a random, non-exportable
  device factor stored in IndexedDB;
- keeping passwords, root-key envelopes and private keys out of published
  identity, IPFS and OrbitDB state;
- changing passwords by rewrapping local material without rotating identity keys;
- enrolling devices through short-lived, mutually authenticated QR transfers;
- replacing every enrolled device from the offline recovery kit;
- signing HTTP requests, including the request that issues each realtime WebSocket ticket;
- signing domain payloads for identities, messages, deletions and keychains;
- encrypting keychains before publication;
- encrypting conversation and community message payloads;
- encrypting private attachments, padded to size buckets, before upload;
- decrypting attachments only when previewing or downloading them.

The backend is responsible for:

- verifying signed requests and domain signatures;
- storing public identity/community metadata;
- storing opaque encrypted payloads;
- publishing and retrieving IPFS content;
- routing realtime events to related identities;
- syncing node state through configured networks.

### Attachment size padding

Private attachment plaintext is framed before AES-256-GCM encryption, so the
uploaded length reveals a size bucket rather than the exact file size:

- Frame: the 8-byte ASCII magic `PGPAD001`, an 8-byte big-endian payload length,
  the payload, then zero bytes up to the bucket size.
- Buckets: 1 KiB, 4 KiB, 16 KiB, 64 KiB, 256 KiB, 1 MiB, 4 MiB, 16 MiB, then
  52,428,688 bytes (50 MiB minus 112). That top frame encrypts to exactly 50 MiB,
  the node's default `PRIVATE_BLOB_MAX_BYTES`, because each 8 MiB AES-GCM chunk
  adds a 16-byte tag. The bucket is the smallest one that holds the whole frame,
  header included. Frames above the top bucket are not padded.
- Marker: new encryptions set `padding: "length-prefix-v1"` in the attachment's
  `encryption` metadata. Receivers strip the frame only when the marker is present
  and reject a frame whose magic or length is invalid.
- Attachments without the marker were encrypted before padding and are decrypted
  unchanged.

### Attachment blob origins

- Each private attachment part records the canonical base URL of the node that
  stores it in `origin`. Receivers read the part from that node, even when their
  session is on another node.
- The origin uses the `MailboxHomeBase` canonical form: `https` (or `http` on
  loopback for development), no credentials, query, or fragment, no trailing
  slash, at most 255 characters, and no private or loopback IP addresses. The
  `localhost` name is accepted for development.
- An origin that fails this rule is ignored. The part is read from the session
  node instead, and the invalid value is never fetched.
- References without `origin` were created before the field existed and are read
  from the session node.
- Reads use an isolated client with `credentials: omit` and `redirect: error`.
  A body whose size differs from the reference, or a 404, reports the attachment
  as unavailable. Other failures surface as the original error.
- Each part is stored on every origin the sender chooses. An origin that
  fails is skipped. A send is posted only after every part has at least one
  stored replica. If a part has none, the stored replicas are removed with a
  best-effort `DELETE` and the send fails.
- A reference keeps at most two alternates besides its primary origin. Reads
  try the primary origin, then each valid alternate in order.
- After the message is posted, its replicas are no longer tracked for
  removal.

## Project Status

This is active development software. Conversations, communities, invitations,
attachments and realtime behavior are already usable, but contracts may still
move as the backend and frontend settle.

Expect APIs, UI flows and cryptographic payload shapes to keep evolving while
the project grows.

## License

Pigeon Swarm is licensed under the PolyForm Noncommercial License 1.0.0. See
[LICENSE](LICENSE) for the full license text.

Commercial use requires a separate commercial license from the author.

## Notice

Additional usage notices are available in [NOTICE](NOTICE).

## Third-party assets

This project may include or reference third-party assets. See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

## Disclaimer

Pigeon Swarm is not affiliated with, endorsed by, or sponsored by Discord Inc, NEXON, NEXON Games, Yostar, or the Blue Archive team.
Discord is a trademark of Discord Inc.

## Independent client build

Build with `VITE_INDEPENDENT_CLIENT=true yarn build` to choose a separate node before application bootstrap. `VITE_API_SERVER_URL` configures the existing combined build and is ignored by the independent client.

The node must expose `GET <node-base>/client-contract`, including the selected API prefix (for example, `/api/client-contract`), with HTTP 200 and JSON `{ "protocol": "pigeon-swarm", "apiVersion": 2 }`. This public, non-cacheable discovery endpoint uses the node API’s CORS policy. The version identifies the breaking-major API contract, independently of the software release; an unsupported version prevents application startup. The authoritative [API contract](https://github.com/haskou/pigeon-swarm-node/blob/main/docs/api.md#client-compatibility-discovery), [endpoint schema](https://github.com/haskou/pigeon-swarm-node/blob/main/src/apps/apis/nodes-api/swagger.yaml), and [aggregate OpenAPI declaration](https://github.com/haskou/pigeon-swarm-node/blob/main/src/apps/apis/open-api.yaml) are maintained in the backend repository.

The independent build must be served from a trusted client origin with the static server and security headers provided by [the deployment repository](https://github.com/haskou/pigeon-swarm/blob/main/docs/INDEPENDENT_CLIENT.md). That guide covers verified images, TLS, updates, rollback, node-scoped storage, and distributor trust. The service worker retains notifications but bypasses resource caching in this mode.

Independent-client HTTP fetches omit ambient cookies and reject redirects. Realtime WebSocket connections authenticate with a single-use ticket rather than cookies or signed query parameters: every connection, including each reconnect, first requests a ticket from `POST <api-base>/realtime/v1/tickets` and then presents it in the `ticket.<token>` subprotocol, so the URL never carries credentials. Browsers may still attach cookies for the selected node to the handshake, and the node ignores them for authentication. Use an API hostname outside unrelated services’ cookie scopes, while recognizing that dedicated hosting does not guarantee an empty cookie jar. Credentialless realtime transport is tracked in [pigeon-swarm-node#291](https://github.com/haskou/pigeon-swarm-node/issues/291).
