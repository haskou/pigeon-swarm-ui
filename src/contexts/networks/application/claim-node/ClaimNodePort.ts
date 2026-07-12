import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface ClaimNodePort {
  claim(session: Session): Promise<void>;
}
