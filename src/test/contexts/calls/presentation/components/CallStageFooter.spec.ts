import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';

import { CallStageFooter } from '../../../../../contexts/calls/presentation/components/CallStageFooter';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const call: CallSession = {
  cameraEnabled: false,
  currentIdentityId: 'identity-1',
  deafened: false,
  hasMicrophone: true,
  id: 'call-1',
  kind: 'one-to-one',
  mediaEncryption: {
    active: true,
  },
  muted: false,
  noiseCancellationEnabled: true,
  participants: [{ identityId: 'identity-1', muted: false, name: 'Hasko' }],
  participantVolumes: {},
  screenShareAudioEnabled: true,
  screenShareQuality: 'auto',
  screenShareVolumes: {},
  screenSharing: false,
  startedAt: 1,
  status: 'live',
  title: 'Den',
};

describe(CallStageFooter.name, () => {
  it('offers no control that turns call encryption off', () => {
    const html = renderToStaticMarkup(
      createElement(CallStageFooter, {
        call,
        onEnd: jest.fn(),
        onToggleCamera: jest.fn(),
        onToggleDeafen: jest.fn(),
        onToggleMute: jest.fn(),
        onToggleNoiseCancellation: jest.fn(),
        onToggleScreenShare: jest.fn(),
      }),
    );

    expect(
      [...html.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]),
    ).toEqual([
      copy.calls.mute,
      copy.calls.deafen,
      copy.calls.camera,
      copy.calls.shareScreen,
      copy.calls.noiseCancellationOff,
      copy.calls.leave,
    ]);
  });
});
