import type {
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/ports/LoginIdentityProgressReporter';

import { PigeonIdentityLoginApi } from './PigeonIdentityLoginApi';
import { PigeonIdentitySessionApi } from './PigeonIdentitySessionApi';
import { PigeonIdentityWorkspaceSessionApi } from './PigeonIdentityWorkspaceSessionApi';

describe(PigeonIdentityLoginApi.name, () => {
  it('hydrates an unlocked login session', async () => {
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const result = { conversations: [], session } as unknown as LoginResult;
    const progress = jest.fn() as unknown as LoginIdentityProgressReporter;
    const sessionApi = {
      unlock: jest.fn().mockResolvedValue(session),
    } as unknown as PigeonIdentitySessionApi;
    const workspace = {
      hydrate: jest.fn().mockResolvedValue(result),
    } as unknown as PigeonIdentityWorkspaceSessionApi;
    const login = new PigeonIdentityLoginApi(sessionApi, workspace);

    await expect(
      login.login('identity-1', 'password', progress, 'recovery-key'),
    ).resolves.toBe(result);

    expect(sessionApi.unlock).toHaveBeenCalledWith(
      'identity-1',
      'password',
      progress,
      'recovery-key',
    );
    expect(workspace.hydrate).toHaveBeenCalledWith(session, progress);
  });

  it('refreshes through the workspace session boundary', async () => {
    const session = {} as Session;
    const result = { conversations: [], session } as unknown as LoginResult;
    const workspace = {
      refresh: jest.fn().mockResolvedValue(result),
    } as unknown as PigeonIdentityWorkspaceSessionApi;
    const login = new PigeonIdentityLoginApi(
      {} as PigeonIdentitySessionApi,
      workspace,
    );

    await expect(login.refresh(session)).resolves.toBe(result);
    expect(workspace.refresh).toHaveBeenCalledWith(session);
  });
});
