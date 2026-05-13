<p align="center">
  <img src="./public/logo.png" alt="pigeon-swarm logo">
</p>

# pigeon-swarm-ui

`pigeon-swarm-ui` is the browser client for `pigeon-swarm-node`: a
Discord-ish, peer-to-peer communication platform designed around self-hosted
nodes, user-owned identities and client-side encrypted conversations.

The UI talks to a local node over signed HTTP requests and an authenticated
WebSocket connection. It is responsible for identity creation and login,
profile editing, keychain handling, message encryption, attachment encryption
and the user experience around conversations, groups and communities.

The backend stores and syncs opaque encrypted payloads. The browser keeps the
private material local.

## Why pigeons?

Carrier pigeons are low-tech, decentralized message delivery with excellent
branding. They do not need a corporate inbox, a central timeline, or a blessed
server to know where they are going.

The name is partly a joke, partly a design reminder: messages should move
through the swarm without asking permission from one big place.

## Capabilities

- Local identity registration and login by identity id or handle.
- Profile editing with handle, name, biography, avatar and banner CIDs.
- Client-owned encrypted keychains for conversations and communities.
- One-to-one and group conversations with encrypted messages, replies,
  attachments, deletion tombstones and unread state.
- Private communities with members, text channels, encrypted channel messages
  and owner management UI.
- Conversation, group conversation and community invitations.
- Public IPFS uploads for profile/community media.
- Private encrypted IPFS uploads for message attachments, including large-file
  chunking.
- Realtime updates over WebSocket for conversations, communities,
  notifications and peer state.
- Node first-run flow, network management, peer metrics and connection-loss
  handling.
- English-only i18n surface today, with the language selector already wired for
  future locales.

## Architecture

The frontend is organized around a small application layer over domain and
infrastructure modules:

- `src/application`: use-case classes that coordinate UI actions.
- `src/domain`: client-side domain logic for identities, keychains,
  conversations, messages, attachments and network invite codes.
- `src/infrastructure`: HTTP, request signing, API mapping and realtime
  gateways.
- `src/presentation`: reusable hooks and browser persistence helpers.
- `src/components`: React UI for auth, conversations, communities, settings,
  notifications, profiles and chat primitives.
- `src/i18n`: copy and language selection.
- `docs/api`: checked-in API specs used by the frontend.

The UI uses `@haskou/value-objects` for cryptographic value objects and signing
primitives where possible. Private keys, decrypted keychains and decrypted
conversation/community keys are not sent to the node.

## Backend Contract

The UI expects a `pigeon-swarm-node` instance running locally at:

```http
http://localhost:8080/
```

The default API URL is currently configured in:

- [`src/config.ts`](./src/config.ts)

Important backend docs live in the node repository:

- `/home/hasko/Projects/pigeon-swarm-node/docs/api.md`
- `/home/hasko/Projects/pigeon-swarm-node/docs/frontend-websocket-realtime.md`
- `/home/hasko/Projects/pigeon-swarm-node/src/apps/apis/open-api.yaml`

Frontend-local API specs:

- [OpenAPI aggregate](./docs/api/open-api.yaml)
- [Conversations API](./docs/api/conversations.yaml)
- [Identities API](./docs/api/identities.yaml)
- [IPFS API](./docs/api/ipfs.yaml)
- [Keychains API](./docs/api/keychains.yaml)

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

- A running `pigeon-swarm-node` HTTP/WebSocket API.
- A claimed or claimable local node.
- At least one configured node network.
- IPFS public/private upload endpoints exposed by the node.
- Signed request support from the active identity.
- WebSocket `/ws` support for realtime domain events.

The app can still render connection-loss and first-run screens when the node is
offline or unclaimed.

## Security Model

The frontend is responsible for:

- generating identity keypairs;
- deriving and using encrypted private keys locally;
- signing HTTP and WebSocket authentication payloads;
- signing domain payloads for identities, messages, deletions and keychains;
- encrypting keychains before publication;
- encrypting conversation and community message payloads;
- encrypting private attachments before IPFS upload;
- decrypting attachments only when previewing or downloading them.

The backend is responsible for:

- verifying signed requests and domain signatures;
- storing public identity/community metadata;
- storing opaque encrypted payloads;
- publishing and retrieving IPFS content;
- routing realtime events to related identities;
- syncing node state through configured networks.

## Project Status

This is active development software. Conversations, communities, invitations,
attachments and realtime behavior are already usable, but contracts may still
move as the backend and frontend settle.

Expect APIs, UI flows and cryptographic payload shapes to keep evolving while
the project grows.
