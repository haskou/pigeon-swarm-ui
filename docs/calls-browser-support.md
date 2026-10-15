# Calls: browser support

This page lists only what the code does and what the tests check. Anything not
listed is not tested and not claimed.

## Which calls work where

| Browser                                       | Direct and private community calls | Public community voice calls | What checks it                                                                                                                          |
| --------------------------------------------- | ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium on desktop (Chrome, Edge)            | Yes, media encrypted end to end    | Yes                          | Unit specs check the media encryption; the call recovery, network recovery, page departure and microphone specs run on desktop Chromium |
| Firefox on desktop                            | Refused with a reason              | Not tested in the app        | `call-browser-support.spec.ts` checks the refusal; `call-microphone.spec.ts` exchanges audio with Chromium                              |
| Safari / WebKit on desktop                    | Refused with a reason              | Not tested in the app        | Unit specs check the refusal; `call-microphone.spec.ts` exchanges audio with Chromium                                                   |
| Any browser without WebRTC (e.g. Tor Browser) | Refused with a reason              | Refused with a reason        | `call-browser-support.spec.ts` removes WebRTC from Chromium                                                                             |
| Mobile browsers                               | Not tested                         | Not tested                   | Nothing yet; real devices are tracked in haskou/pigeon-swarm-node#387                                                                   |

A private call (direct, or in a private community) encrypts its media with the
encoded streams API, which only Chromium has. A browser without it refuses the
call before it asks for the microphone or tells the node, and says that
encrypted calls need Chrome or Edge. It never falls back to unencrypted media.
Firefox and Safari support is haskou/pigeon-swarm-ui#474.

A public community voice call is not encrypted end to end, so it does not need
encoded streams. Firefox and WebKit exchange audio with Chromium in the
microphone spec, which uses a test page instead of the full app.

A browser without `RTCPeerConnection` (WebRTC turned off, or Tor Browser)
refuses every call, public ones too, and asks to turn WebRTC back on or to use
a current Chrome or Edge.

## Microphone problems

A call still joins when the microphone cannot be used: the user hears the
others, and the call bar names the cause with only the actions that can fix
it.

| Cause                                            | Actions shown                                                                                                    | Tested on                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Permission denied                                | Allow microphone, and the permission guide of the browser in use                                                 | Chromium (real permission, granted later), Firefox (stays denied), WebKit (simulated denial) |
| No microphone                                    | Retry, and a device picker once the browser lists microphones; the call uses a microphone once one is plugged in | Chromium, Firefox and WebKit (simulated missing device)                                      |
| Microphone in use, constraint, security, unknown | Retry and the device picker; security and unknown also show a checklist                                          | Unit specs only                                                                              |
| Page not on HTTPS, or no microphone capture      | None, only the reason                                                                                            | Unit specs only                                                                              |

The guide link opens Mozilla's guide on Firefox, Apple's on Safari, and
Google's on Chromium browsers.

Not tested: granting the microphone at runtime on Firefox (Playwright cannot),
real capture on WebKit (the spec replaces `getUserMedia` with a generated
tone), and any mobile browser. See [`e2e/README.md`](../e2e/README.md).
