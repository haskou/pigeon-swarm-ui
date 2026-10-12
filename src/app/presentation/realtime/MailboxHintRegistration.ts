import type { RealtimeMailboxSubscriptionInput } from '../../../shared/infrastructure/realtime/RealtimeGateway';

export type MailboxHintRegistration = {
  listeners: Set<() => void>;
  target: RealtimeMailboxSubscriptionInput;
};
