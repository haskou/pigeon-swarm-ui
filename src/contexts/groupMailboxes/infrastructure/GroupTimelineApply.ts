import type { DirectMessageTimelineChange } from '../../messages/presentation/view-models/DirectMessageTimelineChange';

/** Receives the timeline changes a group read produced. */
export type GroupTimelineApply = (
  changes: DirectMessageTimelineChange[],
) => void;
