import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';

import { resolvePageDeparture } from '../../../../../app/presentation/workspace/components/resolvePageDeparture';

const ME = 'identity-me';

function callWith(
  id: string,
  participants: Array<{ identityId: string; status: string }>,
): CallResource {
  return { id, participants } as unknown as CallResource;
}

describe('resolvePageDeparture', () => {
  it('does nothing without a tracked call', () => {
    expect(
      resolvePageDeparture({
        activeCall: null,
        currentIdentityId: ME,
        incomingCall: null,
      }),
    ).toBeNull();
  });

  it('declines the pending incoming call when the page is left while ringing', () => {
    expect(
      resolvePageDeparture({
        activeCall: null,
        currentIdentityId: ME,
        incomingCall: { call: { id: 'call-ringing' } },
      }),
    ).toEqual({ action: 'leave', callId: 'call-ringing', declined: true });
  });

  it.each(['one-to-one', 'group', 'community-voice'] as const)(
    'declines instead of ending or leaving a %s call the local participant has not joined',
    (kind) => {
      expect(
        resolvePageDeparture({
          activeCall: {
            call: callWith('call-a', [{ identityId: ME, status: 'ringing' }]),
            id: 'call-a',
            kind,
          },
          currentIdentityId: ME,
          incomingCall: null,
        }),
      ).toEqual({ action: 'leave', callId: 'call-a', declined: true });
    },
  );

  it('ends a joined one-to-one call', () => {
    expect(
      resolvePageDeparture({
        activeCall: {
          call: callWith('call-a', [
            { identityId: ME, status: 'joined' },
            { identityId: 'identity-b', status: 'ringing' },
          ]),
          id: 'call-a',
          kind: 'one-to-one',
        },
        currentIdentityId: ME,
        incomingCall: null,
      }),
    ).toEqual({ action: 'end', callId: 'call-a' });
  });

  it.each(['group', 'community-voice'] as const)(
    'leaves a joined %s call without declining',
    (kind) => {
      expect(
        resolvePageDeparture({
          activeCall: {
            call: callWith('call-a', [
              { identityId: ME, status: 'joined' },
              { identityId: 'identity-b', status: 'ringing' },
            ]),
            id: 'call-a',
            kind,
          },
          currentIdentityId: ME,
          incomingCall: null,
        }),
      ).toEqual({ action: 'leave', callId: 'call-a', declined: false });
    },
  );

  it('leaves an active call whose resource is not loaded yet without declining', () => {
    expect(
      resolvePageDeparture({
        activeCall: { call: undefined, id: 'call-a', kind: 'group' },
        currentIdentityId: ME,
        incomingCall: null,
      }),
    ).toEqual({ action: 'leave', callId: 'call-a', declined: false });
  });

  it('prefers the active call over a pending incoming call', () => {
    expect(
      resolvePageDeparture({
        activeCall: {
          call: callWith('call-a', [{ identityId: ME, status: 'joined' }]),
          id: 'call-a',
          kind: 'group',
        },
        currentIdentityId: ME,
        incomingCall: { call: { id: 'call-ringing' } },
      }),
    ).toEqual({ action: 'leave', callId: 'call-a', declined: false });
  });
});
