import type { Session } from '../../../identities/infrastructure/session/Session';

export interface PwaPushSubscriptionBackend {
  delete(session: Session, subscription: PushSubscriptionJSON): Promise<void>;
  findServer(): Promise<{ enabled: boolean; publicKey?: string }>;
  register(session: Session, subscription: PushSubscriptionJSON): Promise<void>;
}
