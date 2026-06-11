# E2E tests

These Playwright tests are on-demand only. They are not part of CI.

Run all device profiles:

```bash
yarn test:e2e
```

Run a single profile:

```bash
yarn test:e2e --project=desktop-chromium
```

By default Playwright starts Vite on `http://127.0.0.1:5176`.
To reuse an existing app:

```bash
E2E_BASE_URL=http://127.0.0.1:5174 yarn test:e2e
```

The app must point to a backend with at least one node network. If the node has
no networks, provide a fallback network id:

```bash
E2E_NETWORK_ID=<network-id> yarn test:e2e
```
