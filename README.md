<p align="center">
  <img src="./public/logo.png" alt="pigeon-swarm logo">
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

* Local identity registration and login by identity id or handle.
* Profile editing with handle, name, biography, avatar and banner CIDs.
* Client-owned encrypted keychains for conversations and communities.
* One-to-one and group conversations with encrypted messages, replies,
  attachments, deletion tombstones and unread state.
* Public and private communities with members, text channels, encrypted channel
  messages and owner management UI.
* Conversation, group conversation and community invitations.
* Public IPFS uploads for profile/community media.
* Private encrypted IPFS uploads for message attachments, including large-file
  chunking.
* Realtime updates over WebSocket for conversations, communities,
  notifications and peer state.
* Node first-run flow, public/private network management, peer metrics and
  connection-loss handling.
* English-only i18n surface today, with the language selector already wired for
  future locales.

## Architecture

The frontend is organized around bounded frontend contexts plus shared
application composition:

* `src/contexts`: feature contexts such as identities, conversations,
  communities, messages, attachments, calls, polls, stickers, notifications and
  networks. Each context owns its application, domain, infrastructure and
  presentation slices where they are needed.
* `src/app`: application composition, workspace orchestration and high-level
  presentation shell.
* `src/shared`: cross-context domain primitives, HTTP/realtime infrastructure,
  media helpers, shared UI components, hooks and i18n.
* `docs/api`: checked-in API specs used by the frontend.

The UI uses `@haskou/value-objects` for cryptographic value objects and signing
primitives where possible. Private keys, passwords, decrypted keychains and
decrypted conversation/community keys are not sent to the node.

## Backend Contract

The UI expects a `pigeon-swarm-node` instance running locally at:

```http
http://localhost:8080/
```

The default API URL is currently configured in:

* [`src/app/API_SERVER_URL.ts`](./src/app/API_SERVER_URL.ts)

Important backend docs live in the node repository:

* [`docs/api.md`](https://github.com/haskou/pigeon-swarm-node/blob/main/docs/api.md)
* [`docs/frontend-websocket-realtime.md`](https://github.com/haskou/pigeon-swarm-node/blob/main/docs/frontend-websocket-realtime.md)
* [`src/apps/apis/open-api.yaml`](https://github.com/haskou/pigeon-swarm-node/blob/main/src/apps/apis/open-api.yaml)

Frontend-local API specs:

* [OpenAPI aggregate](./docs/api/open-api.yaml)
* [Conversations API](./docs/api/conversations.yaml)
* [Identities API](./docs/api/identities.yaml)
* [IPFS API](./docs/api/ipfs.yaml)
* [Keychains API](./docs/api/keychains.yaml)

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

This repository does not currently require a `.env` file. The node URL is a
source constant in `src/config.ts`.

## Runtime Dependencies

For the full experience, the browser client expects:

* A running `pigeon-swarm-node` HTTP/WebSocket API.
* A claimed or claimable local node.
* At least one configured node network.
* IPFS public/private upload endpoints exposed by the node.
* Signed request support from the active identity.
* WebSocket `/ws` support for realtime domain events.

The app can still render connection-loss and first-run screens when the node is
offline or unclaimed.

## Security Model

The frontend is responsible for:

* generating identity keypairs;
* deriving and using encrypted private keys locally;
* keeping passwords local;
* signing HTTP and WebSocket authentication payloads;
* signing domain payloads for identities, messages, deletions and keychains;
* encrypting keychains before publication;
* encrypting conversation and community message payloads;
* encrypting private attachments before IPFS upload;
* decrypting attachments only when previewing or downloading them.

The backend is responsible for:

* verifying signed requests and domain signatures;
* storing public identity/community metadata;
* storing opaque encrypted payloads;
* publishing and retrieving IPFS content;
* routing realtime events to related identities;
* syncing node state through configured networks.

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
## Disclaimer

Pigeon Swarm is not affiliated with, endorsed by, or sponsored by Discord Inc.
Discord is a trademark of Discord Inc.
