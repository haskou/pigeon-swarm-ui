import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from './LoginIdentityProgressReporter';

export interface LoginIdentityPort {
  login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult>;
}
