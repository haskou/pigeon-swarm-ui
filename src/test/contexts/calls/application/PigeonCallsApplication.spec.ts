import type { CallResource } from '../../../../contexts/calls/domain/callSession.types';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonCallsApplication } from '../../../../contexts/calls/application/PigeonCallsApplication';

describe(PigeonCallsApplication.name, () => {
  it('delegates call reads through the application port', async () => {
    const call = { id: 'call-1' } as unknown as CallResource;
    const get = jest
      .fn<Promise<CallResource>, [Session, string]>()
      .mockResolvedValue(call);
    const application = new PigeonCallsApplication({
      getCall: { get },
    } as unknown as ConstructorParameters<typeof PigeonCallsApplication>[0]);
    const session = {} as Session;

    await expect(application.get(session, 'call-1')).resolves.toBe(call);
    expect(get).toHaveBeenCalledWith(session, 'call-1');
  });
});
