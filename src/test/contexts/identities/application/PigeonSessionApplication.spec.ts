import type { SessionApplicationPort } from '../../../../contexts/identities/application/ports/SessionApplicationPort';
import type {
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonSessionApplication } from '../../../../contexts/identities/application/PigeonSessionApplication';

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
