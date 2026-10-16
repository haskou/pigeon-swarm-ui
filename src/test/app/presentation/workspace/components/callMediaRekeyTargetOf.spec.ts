import type { CallMediaRekeyCall } from '../../../../../app/presentation/workspace/components/CallMediaRekeyCall';

import { callMediaRekeyTargetOf } from '../../../../../app/presentation/workspace/components/callMediaRekeyTargetOf';

const privateCommunityCall: CallMediaRekeyCall = {
  channelId: 'voice-a',
  communityId: 'community-a',
  id: 'call-1',
  kind: 'community-voice',
  mediaEncryption: { active: true },
};

describe(callMediaRekeyTargetOf.name, () => {
  it('rekeys an encrypted community call from its community channel', () => {
    expect(callMediaRekeyTargetOf(privateCommunityCall)).toEqual({
      callId: 'call-1',
      channelId: 'voice-a',
      communityId: 'community-a',
    });
  });

  it('never rekeys a public community call', () => {
    expect(
      callMediaRekeyTargetOf({
        ...privateCommunityCall,
        mediaEncryption: { active: false, reason: 'public-community' },
      }),
    ).toBeNull();
  });

  it.each(['one-to-one', 'group'] as const)(
    'never rekeys a %s conversation call, which keeps epoch 0',
    (kind) => {
      expect(
        callMediaRekeyTargetOf({
          ...privateCommunityCall,
          channelId: undefined,
          communityId: undefined,
          kind,
        }),
      ).toBeNull();
    },
  );

  it('stops rekeying once no call is active', () => {
    expect(callMediaRekeyTargetOf(null)).toBeNull();
  });
});
