import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface CreatePublicNetworkPort {
  createPublic(session?: Session): Promise<void>;
}
