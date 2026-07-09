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

## Visual audit

The visual audit captures the login and the main authenticated UI states on
desktop, tablet, and mobile. Screenshots and layout metrics are written to
`visual-audit/` and are intentionally ignored by Git. Every device folder also
contains a `manifest.json` with the states that were captured or skipped.

```bash
VISUAL_AUDIT_USER=<handle-or-identity-id> \
VISUAL_AUDIT_PASSWORD=<password> \
E2E_BASE_URL=http://127.0.0.1:5174 \
yarn audit:visual
```

Run one viewport while iterating:

```bash
VISUAL_AUDIT_USER=<handle-or-identity-id> \
VISUAL_AUDIT_PASSWORD=<password> \
E2E_BASE_URL=http://127.0.0.1:5174 \
yarn audit:visual --project=mobile-chromium
```

Development accounts can be kept in an ignored `.env.visual-audit.local` file:

```bash
# Add comments describing the permissions and purpose of each account.
VISUAL_AUDIT_USER=<admin-handle>
VISUAL_AUDIT_PASSWORD=<admin-password>
VISUAL_AUDIT_CALL_USER_A=<regular-member-handle>
VISUAL_AUDIT_CALL_USER_B=<regular-member-handle>
VISUAL_AUDIT_CALL_PASSWORD=<shared-development-password>
```

Load the file before running the audit:

```bash
set -a
source .env.visual-audit.local
set +a
E2E_BASE_URL=http://127.0.0.1:5174 yarn audit:visual
```

Optional environment variables:

- `VISUAL_AUDIT_LANGUAGE`: `es` by default; accepts `en`.
- `VISUAL_AUDIT_RECOVERY_KEY`: enables the recovery-key login path.
- `VISUAL_AUDIT_OUTPUT_DIR`: overrides the default `visual-audit/` folder.

Without credentials, the audit still captures the login screen and skips the
authenticated states.
