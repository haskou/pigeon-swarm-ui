import type { DirectMessageTimelineChange } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageTimelineChange';

export type DirectPinChange = Extract<
  DirectMessageTimelineChange,
  { kind: 'pin' }
>;
