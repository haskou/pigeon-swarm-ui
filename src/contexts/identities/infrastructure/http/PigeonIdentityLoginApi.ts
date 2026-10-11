import type {
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';

import { PigeonIdentitySessionApi } from './PigeonIdentitySessionApi';
import { PigeonIdentityWorkspaceSessionApi } from './PigeonIdentityWorkspaceSessionApi';

export class PigeonIdentityLoginApi {
  public constructor(
    private readonly session: PigeonIdentitySessionApi,
    private readonly workspace: PigeonIdentityWorkspaceSessionApi,
  ) {}

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    const session = await this.session.unlock(identityId, password, onProgress);

    return await this.workspace.hydrate(session, onProgress);
  }

  public async hydrate(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.workspace.hydrate(session, onProgress);
  }

  public async unlock(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<Session> {
    return await this.session.unlock(identityId, password, onProgress);
  }

  public async refreshSession(session: Session): Promise<LoginResult> {
    return await this.workspace.refresh(session);
  }
}
