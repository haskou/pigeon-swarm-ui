import type { RefObject } from 'react';

import type { RealtimeHandlers } from './RealtimeHandlers';

export type RealtimeSubscription = {
  handlersRef: RefObject<RealtimeHandlers>;
};
