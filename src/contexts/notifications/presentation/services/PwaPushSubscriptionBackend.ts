import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface PwaPushSubscriptionBackend {
  delete(session: Session, subscription: PushSubscriptionJSON): Promise<void>;
  findServer(): Promise<{ enabled: boolean; publicKey?: string }>;
  register(session: Session, subscription: PushSubscriptionJSON): Promise<void>;
}
