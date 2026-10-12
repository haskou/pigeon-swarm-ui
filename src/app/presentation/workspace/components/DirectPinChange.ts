import type { DirectMessageTimelineChange } from '../../../../contexts/messages/presentation/view-models/DirectMessageTimelineChange';

export type DirectPinChange = Extract<
  DirectMessageTimelineChange,
  { kind: 'pin' }
>;
