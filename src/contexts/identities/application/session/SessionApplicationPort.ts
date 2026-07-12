import type {
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../login-identity/LoginIdentityProgressReporter';

export interface SessionApplicationPort {
  refreshSession(session: Session): Promise<LoginResult>;
  restoreRememberedSession(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult>;
}
