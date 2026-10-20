# E2E tests

The stale ICE candidate, call recovery, call network recovery, call microphone,
composer edit and real-node suites run in CI. Other Playwright scenarios run on
demand against a configured application backend.

`composer-edit.spec.ts` renders the composer from a fixture page and holds
animation frames, as a busy main thread does. When the composer enters edit
mode it is focused with the caret after the original text before the next
frame. A late frame never collapses a selection made over that text, so the
typed text replaces the original instead of being appended to it.

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

## Real node suite

`login-methods.spec.ts` (login choices, recovery-key sign-in and device pairing),
`direct-message-sync.spec.ts` (1:1 send and receive across two isolated browser
contexts), `direct-message-outbox.spec.ts` (a 1:1 send made while the
recipient's inbox is absent survives a reload and is delivered once the
recipient accepts), `device-revoke-mailbox.spec.ts` (a paired device that
the other device revokes keeps the messages sent before the revoke while it
stays signed in, never shows a message sent after it while the surviving
device does, at its next sign-in (from the identity the login screen
remembers, without typing it) verifies the signed revocation, says it was
removed and erases its stored history and the remembered identity, and a
refused transition read or a forged revocation for a still-authorized device
erases nothing),
`community-mls-kick.spec.ts` (a private community shows encryption as active
for its creator and an invited member, both exchange messages through the MLS
group, the creator's manage dialog drops the kicked member once the kick and
the key rotation are done, and a message sent after the removal never shows in
the removed member's page), `community-invite-link.spec.ts` (the creator of a
private community creates an invite link, another identity signs in through
it, joins the community, sees encryption as active and reads the creator's
next message; the node only accepts a link whose token commits to its limits),
`call-page-departure.spec.ts` (a ringing call is
declined when the callee leaves the page), `call-browser-support.spec.ts` (a
Chromium without WebRTC and a Chromium with neither call media cipher both
refuse a direct call with the reason, before the microphone or the node is
asked, while Firefox starts a private call that rings the callee) and
`group-conversation.spec.ts`
(three users share a group conversation over MLS and per-member mailboxes,
each invitee, not a contact of the creator, accepts the invitation from its
notifications before it joins, each message reaches the other two, and after
the creator removes one member a
later message reaches the remaining member and never shows in the removed
member's page during 90 s of polling; and a member pairs a second device,
which joins the group through its own leaf without a re-invite, so both
devices read the group and the second device's message reaches the others
once; after the first device revokes it, a commit removes its leaf, it never
shows a message sent after the revoke, and the remaining device keeps reading
after a reload; and a welcome a laptop sent its phone, read by the phone only
after the laptop was revoked, is refused and nothing sent later shows on the
phone) run against a real node. Login,
direct-message sync, the outbox spec and the security audit run on
`desktop-chromium`, `desktop-firefox` and `mobile-chromium`; the browser
support spec runs there too, each test on the desktop engine it targets; the
call, revoke, community kick and group conversation specs run on
`desktop-chromium`. On Firefox the decline sent when the callee leaves the
page did not reach the node in CI, so the call spec does not run there.
`history-backup.spec.ts` (a wrong password exports nothing; the right one
downloads one encrypted file that holds no message or handle in clear;
another identity and a file with one changed character are refused; once the
same device has lost its stored history and the node serves it no envelopes,
the file restores the history rows, and both sides of the conversation show
after a new sign-in) runs on `desktop-chromium`.
`recovery-key-keychain.spec.ts` (an identity that saved a conversation key
signs in with its recovery key on a new device, sees the notice that its
conversations must invite it again, and restores a backup exported before the
recovery) runs on `desktop-chromium`.
`contact-presence.spec.ts` (two identities on the same node turn on "Share
status" in their direct conversation; before that the contact shows no
status, then it shows Online, and once the contact picks Invisible it shows
Offline when the last update expires, within its 90-second lifetime plus the
30-second read interval, and never shows Invisible) runs on
`desktop-chromium`. The harness runs one node, so the spec does not cover
contacts whose mailboxes live on different nodes.
The `real-node-e2e` job in
`.github/workflows/ci.yml` builds the node image from the pins below and runs
these specs. It is the check that catches UI and node
contract breaks before merge.

The pins are:

- `.github/node-sha`: the pigeon-swarm-node commit the image runs.
- `.github/wrapper-sha`: the pigeon-swarm commit whose `Dockerfile` builds the
  image with `--target production`.

The UI is always the commit under test. The image clones it by SHA from GitHub,
so CI passes the PR head SHA as `PIGEON_SWARM_UI_SHA`. A UI commit must be
pushed before it can be built locally.

Run the suite locally against an image built from the pins and the current
commit:

```bash
docker build --target production \
  --build-arg PIGEON_SWARM_NODE_SHA=$(cat .github/node-sha) \
  --build-arg PIGEON_SWARM_UI_SHA=$(git rev-parse HEAD) \
  -t pigeon-swarm-node:local \
  "https://github.com/haskou/pigeon-swarm.git#$(cat .github/wrapper-sha)"

PIGEON_NODE_IMAGE=pigeon-swarm-node:local yarn test:e2e:real-node
```

The script starts the image on `127.0.0.1:8080`, registers a network through the
node API, runs the specs, then removes the container. A failed run prints the
last 200 node log lines. `yarn test:ci` runs the unit suites followed by this
suite and needs `PIGEON_NODE_IMAGE` set.

To bump the pins:

1. Choose the node commit and the wrapper commit whose `Dockerfile` builds it.
   The wrapper's `.github/workflows/validate.yml` pins are the reference for a
   pair the wrapper already validates.
2. Write both SHAs to `.github/node-sha` and `.github/wrapper-sha` in one commit.
3. Let `real-node-e2e` run on the PR, or run the local build and suite above.
4. Merge only when `real-node-e2e` is green.

Tablet and WebKit are not covered by this suite.

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

## Call network recovery

```bash
yarn test:e2e e2e/call-network-recovery.spec.ts --project=desktop-chromium
```

Two Chromium browsers render the production call session hook and call bar
from `fixtures/call-session.html`. Media flows only through a local UDP relay
the test owns: signalled candidates are rewritten to relay ports and SDP
candidates are stripped. One scenario changes the network path by closing the
relay and toggling the caller offline, as a Wi-Fi to cellular switch does; the
other stops the signalling backend for 10 s, as a restart does, and then
recovers the realtime connection. After each, both peers must reconnect
through a fresh relay with a new ICE username fragment, carry audio both ways,
and keep exactly one native connection, one audio element and one participant
entry per identity. Like the call recovery suite this is local coverage, not
public NAT/CGNAT reachability or a restart of a real node.

## Call microphone

```bash
yarn test:e2e e2e/call-microphone.spec.ts --project=desktop-chromium --project=desktop-firefox --project=desktop-webkit
```

The caller runs on the engine under test and the callee always on Chromium.
One scenario joins with microphone permission denied, the other with no
microphone connected. Both check that the caller still hears the callee, that
the call bar names the cause, and that the call uses the microphone once it is
allowed or plugged in, with no duplicated connection or participant. Chromium
denies through its real permission model and grants at runtime. Firefox denies
through `permissions.default.microphone`; it cannot grant at runtime, so its
denied scenario ends after a retry that stays denied. A denial offers
"Allow microphone" and no "Retry". Playwright cannot grant
microphone access on WebKit, so there `getUserMedia` is replaced by an
oscillator stream and denial is simulated with the `NotAllowedError` WebKit
raises; WebKit gathers no host candidates without capture permission, so it
connects through the candidates Chromium learns from it. A missing device is
simulated on every engine by raising `NotFoundError` and hiding audio inputs
from `enumerateDevices`. Mobile browsers are not covered; see
[calls: browser support](../docs/calls-browser-support.md).

## Call media encryption

```bash
yarn test:e2e e2e/call-media-encryption.spec.ts --project=desktop-chromium --project=desktop-firefox
```

The caller runs on the engine under test and the callee always on Chromium,
both rendering `fixtures/call-session.html` as a private call with a call key.
With the same key on both ends, each end must decode audio from the other
(`totalAudioEnergy` of its inbound audio grows), report media E2EE active with
the other identity, and run an `RTCRtpScriptTransform` on its audio sender and
receiver. With a different key on each end, audio packets still arrive but
decode to nothing, which shows the audio is encrypted and that frames the key
does not decrypt are dropped. The encoded streams path of Chromium builds
without `RTCRtpScriptTransform` is not exercised: every engine in CI has it.
WebKit is skipped because Playwright cannot grant it a microphone, so Safari
support is not proven here.

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

## Engines and viewports

Projects: `desktop-chromium`, `desktop-firefox`, `desktop-webkit`,
`tablet-chromium` and `mobile-chromium`. Install the extra engines with
`yarn playwright install firefox webkit`. Login, recovery-key sign-in, device
pairing and last-login-prefill specs pass on Chromium desktop, Chromium mobile
and Firefox. `last-login-prefill` checks the remembered identity preview the
login screen settles in, not the identity input it shows until the lookup
resolves; it passes on every project and runs in the real node suite
(`yarn test:e2e:real-node`) on Chromium desktop, Chromium mobile and Firefox.
