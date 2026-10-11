import type { CallParticipant } from '../../../../../contexts/calls/presentation/view-models/CallParticipant';

import { callAudioConnectionState } from '../../../../../contexts/calls/presentation/view-models/callAudioConnectionState';

const self = 'me';

function remote(
  identityId: string,
  overrides: Partial<CallParticipant> = {},
): CallParticipant {
  return {
    identityId,
    muted: false,
    name: identityId,
    ...overrides,
  };
}

describe('callAudioConnectionState', () => {
  it('reports connecting while a remote audio path is still negotiating', () => {
    expect(
      callAudioConnectionState(
        [
          remote('ana', {
            connectionState: 'connecting',
            iceState: 'checking',
          }),
        ],
        self,
      ),
    ).toBe('connecting');
  });

  it('reports reconnecting while a remote audio path is being restarted', () => {
    expect(
      callAudioConnectionState(
        [
          remote('ana', {
            connectionState: 'connected',
            iceState: 'connected',
            recoveryState: 'recovering',
          }),
        ],
        self,
      ),
    ).toBe('reconnecting');
  });

  it('reports failed when recovery is exhausted, even if another participant is connected', () => {
    expect(
      callAudioConnectionState(
        [
          remote('ana', {
            connectionPath: 'direct',
            connectionState: 'connected',
            iceState: 'connected',
          }),
          remote('ben', {
            connectionState: 'failed',
            iceState: 'failed',
            recoveryState: 'exhausted',
          }),
        ],
        self,
      ),
    ).toBe('failed');
  });

  it('reports relayed when every established path goes through a relay server', () => {
    expect(
      callAudioConnectionState(
        [
          remote('ana', {
            connectionPath: 'relay',
            connectionState: 'connected',
            iceState: 'completed',
          }),
        ],
        self,
      ),
    ).toBe('relayed');
  });

  it('reports nothing for a direct path', () => {
    expect(
      callAudioConnectionState(
        [
          remote('ana', {
            connectionPath: 'direct',
            connectionState: 'connected',
            iceState: 'completed',
          }),
        ],
        self,
      ),
    ).toBeUndefined();
  });

  it('reports nothing when a direct and a relayed path are mixed', () => {
    expect(
      callAudioConnectionState(
        [
          remote('ana', {
            connectionPath: 'direct',
            connectionState: 'connected',
          }),
          remote('ben', {
            connectionPath: 'relay',
            connectionState: 'connected',
          }),
        ],
        self,
      ),
    ).toBeUndefined();
  });

  it('ignores the local participant, declined, left, and missed participants', () => {
    expect(
      callAudioConnectionState(
        [
          remote(self, { recoveryState: 'exhausted' }),
          remote('ben', {
            recoveryState: 'exhausted',
            status: 'declined',
          }),
          remote('cam', { connectionState: 'connecting', status: 'left' }),
          remote('dia', { connectionState: 'connecting', status: 'missed' }),
        ],
        self,
      ),
    ).toBeUndefined();
  });

  it('reports nothing when no remote audio path has started yet', () => {
    expect(callAudioConnectionState([remote('ana')], self)).toBeUndefined();
  });

  it('does not report connecting for a peer that has closed', () => {
    expect(
      callAudioConnectionState(
        [remote('ana', { connectionState: 'closed', iceState: 'closed' })],
        self,
      ),
    ).toBeUndefined();
  });
});
