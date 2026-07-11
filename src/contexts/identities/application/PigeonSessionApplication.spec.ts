import type {
  LoginResult,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { SessionApplicationPort } from './ports/SessionApplicationPort';

import { PigeonSessionApplication } from './PigeonSessionApplication';

describe(PigeonSessionApplication.name, () => {
  it('refreshes a session through the session port', async () => {
    const result = { conversations: [] } as unknown as LoginResult;
    const refreshSession = jest
      .fn<Promise<LoginResult>, [Session]>()
      .mockResolvedValue(result);
    const gateway = { refreshSession } as unknown as SessionApplicationPort;
    const application = new PigeonSessionApplication(gateway);
    const session = {} as Session;

    await expect(application.refresh(session)).resolves.toEqual(result);
    expect(refreshSession).toHaveBeenCalledWith(session);
  });
});
