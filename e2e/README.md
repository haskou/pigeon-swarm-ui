# E2E tests

The stale ICE candidate and call recovery tests run in CI. Other Playwright
scenarios run on demand against a configured application backend.

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

## Call recovery

```bash
yarn test:e2e e2e/call-recovery.spec.ts --project=desktop-chromium
```

This self-contained Vite fixture uses two separate Chromium browsers, the real
call connection manager and native WebRTC audio tracks. It withholds candidate
exchange until automatic recovery is exhausted, clicks the real retry control,
and checks increasing inbound audio bytes in both directions. It also checks
that connections and audio elements are not duplicated, leaving releases them,
and the opt-in diagnostic download contains only redacted connection metrics.
A separate scenario delivers simultaneous restart offers to both peers and
checks that resolving the collision preserves bidirectional audio. Candidates
are deliberately delivered before the answer, whose SDP omits them, to verify
that early candidates survive the collision. The fixture suppresses
development-server hot reload while the call is active.

Signaling delivery is controlled by the test. This is local direct-media
coverage, not backend authorization, TURN, public NAT, or mobile-browser
validation. Cross-node relay coverage belongs to the wrapper integration suite.

## Call page departure

`call-page-departure.spec.ts` registers two identities on a real node, rings the
second one from a direct conversation and navigates its page away while the call
is still ringing. The page departure must send a signed decline, and the caller
must see the call as declined. The node derives `declined` for a ringing
participant, so a `left` proof for it is never recorded. Run it against a node
that has a network, with `E2E_NETWORK_ID` when the node lists none:

```bash
yarn test:e2e e2e/call-page-departure.spec.ts --project=desktop-chromium
```

`community-mls-kick.spec.ts` registers two identities on a real node, creates
a private community, invites the second one, exchanges messages in both
directions through the MLS group and then removes the member. A message sent
after the removal must never show in the removed member's page. It needs a node
that runs the `GET /communities/{id}/frontier` response with `networkId` and
takes several minutes on a development node:

```bash
yarn test:e2e e2e/community-mls-kick.spec.ts --project=desktop-chromium
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
- `VISUAL_AUDIT_TECHNICAL_DETAILS`: `true` turns on the technical details
  preference so conversation/community data, realtime events, the keychain and
  call technical data are captured. Otherwise those states are recorded as
  skipped with that reason.
- `VISUAL_AUDIT_OUTPUT_DIR`: overrides the default `visual-audit/` folder.

Without credentials, the audit still captures the login screen and skips the
authenticated states.

## Live call presence

`voice-channel-stability.spec.ts` uses two existing accounts in the same community
and checks visible membership, received media tracks, and stable request traffic.
Set `VOICE_STABILITY_USER_A`, `VOICE_STABILITY_PASSWORD_A`,
`VOICE_STABILITY_USER_B`, and `VOICE_STABILITY_PASSWORD_B`. Optional
`VOICE_STABILITY_COMMUNITY` and `VOICE_STABILITY_CHANNEL` select the call.
For separate nodes, set `VOICE_STABILITY_BASE_URL_B` to the second UI URL; the
first uses `E2E_BASE_URL`. Both UIs must target their respective nodes.

The stable interval must contain no full call GET requests. Heartbeats continue
and must return 204 without a participant roster. This verifies browser traffic
and local media behavior; only an external-network run can validate NAT.

Call lifecycle WebSocket events carry `attributes.callId`, `attributes.liveCall`,
and `attributes.liveCallRevision`. The client applies the snapshot directly and
ignores duplicate or lower revisions for that call. Revisions are scoped to the
current socket connection and reset on connection acknowledgement. Reconnection
loads the active-call list; failed recovery is retried at most twice with one- and
two-second delays. Duplicate recovery requests coalesce, and reconnect cancels
older response application. Malformed snapshots trigger bounded per-call recovery;
older or duplicate revisions do not. Snapshots received during a recovery supersede
the response. Community snapshots need no creator or creation time;
participants need no join/leave times or remote media diagnostics. Offer initiation
uses identity ordering, independent of historical join times.
