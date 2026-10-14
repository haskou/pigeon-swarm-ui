import type { DirectMessageTimelineChange } from '../../messages/domain/DirectMessageTimelineChange';

/** Receives the timeline changes a group read produced. */
export type GroupTimelineApply = (
  changes: DirectMessageTimelineChange[],
) => void;
