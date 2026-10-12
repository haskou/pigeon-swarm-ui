import type { DirectMessageBackgroundReadSyncInput } from './useDirectMessageBackgroundReadSync';

export type LatestInput = Omit<DirectMessageBackgroundReadSyncInput, 'session'>;
