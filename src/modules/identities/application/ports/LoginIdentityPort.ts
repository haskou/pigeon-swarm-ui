import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';

export interface LoginIdentityPort {
  login(identityId: string, password: string): Promise<LoginResult>;
}
