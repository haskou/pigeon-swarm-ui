import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { PigeonCallParticipation } from '../../../../app/composition/calls/PigeonCallParticipation';
import { PigeonCallsApi } from '../../../../contexts/calls/infrastructure/http/PigeonCallsApi';

const session = { identity: { id: 'identity-a' } } as Session;

function build() {
  const api = mock<PigeonCallsApi>();
  const participation = new PigeonCallParticipation(
    api,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );

  return { api, participation };
}

describe(PigeonCallParticipation.name, () => {
  it.each([true, false])(
    'signs a page departure with declined=%s',
    async (declined) => {
      const { api, participation } = build();
      const before = Date.now();

      await participation.leaveOnPageDeparture(session, 'call-a', declined);

      expect(api.leaveOnPageDeparture).toHaveBeenCalledTimes(1);
      const [calledSession, callId, at, calledDeclined] =
        api.leaveOnPageDeparture.mock.calls[0]!;

      expect(calledSession).toBe(session);
      expect(callId).toBe('call-a');
      expect(at).toBeGreaterThanOrEqual(before);
      expect(calledDeclined).toBe(declined);
    },
  );

  it('ends on page departure without reading the call first', async () => {
    const { api, participation } = build();
    const before = Date.now();

    await participation.endOnPageDeparture(session, 'call-a');

    expect(api.endOnPageDeparture).toHaveBeenCalledTimes(1);
    const [calledSession, callId, at] = api.endOnPageDeparture.mock.calls[0]!;

    expect(calledSession).toBe(session);
    expect(callId).toBe('call-a');
    expect(at).toBeGreaterThanOrEqual(before);
    expect(api.get).not.toHaveBeenCalled();
  });
});
