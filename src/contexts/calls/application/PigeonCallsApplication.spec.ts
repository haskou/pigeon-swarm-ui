import type { Session } from '../../../shared/domain/pigeonResources.types';
import type { CallResource } from '../domain/callSession.types';
import type { CallApplicationPort } from './ports/CallApplicationPort';

import { PigeonCallsApplication } from './PigeonCallsApplication';

describe(PigeonCallsApplication.name, () => {
  it('delegates call reads through the application port', async () => {
    const call = { id: 'call-1' } as unknown as CallResource;
    const get = jest
      .fn<Promise<CallResource>, [Session, string]>()
      .mockResolvedValue(call);
    const gateway = { get } as unknown as CallApplicationPort;
    const application = new PigeonCallsApplication(gateway);
    const session = {} as Session;

    await expect(application.get(session, 'call-1')).resolves.toBe(call);
    expect(get).toHaveBeenCalledWith(session, 'call-1');
  });
});
