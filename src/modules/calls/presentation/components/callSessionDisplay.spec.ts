import type { CallSession } from '../../domain/callSession.types';

import { callSessionSubtitle, callSessionTitle } from './callSessionDisplay';

describe('callSessionDisplay', () => {
  it('uses community and channel names for community voice calls', () => {
    const call = callSession({
      kind: 'community-voice',
      subtitle: 'Beta community',
      title: 'voice chat',
    });

    expect(callSessionTitle(call)).toBe('Beta community');
    expect(callSessionSubtitle(call)).toBe('voice chat');
  });

  it('keeps conversation titles for direct calls', () => {
    const call = callSession({
      kind: 'one-to-one',
      subtitle: '@den',
      title: 'Den',
    });

    expect(callSessionTitle(call)).toBe('Den');
    expect(callSessionSubtitle(call)).toBe('@den');
  });
});

function callSession(input: {
  kind: CallSession['kind'];
  subtitle?: string;
  title: string;
}): CallSession {
  return {
    cameraEnabled: false,
    currentIdentityId: 'identity-1',
    deafened: false,
    hasMicrophone: true,
    id: 'call-1',
    kind: input.kind,
    muted: false,
    noiseCancellationEnabled: false,
    participants: [
      { identityId: 'identity-1', muted: false, name: 'Hasko' },
      { identityId: 'identity-2', muted: false, name: 'Den' },
    ],
    participantVolumes: {},
    screenShareAudioEnabled: true,
    screenShareVolumes: {},
    screenSharing: false,
    startedAt: 1,
    status: 'live',
    subtitle: input.subtitle,
    title: input.title,
  };
}
