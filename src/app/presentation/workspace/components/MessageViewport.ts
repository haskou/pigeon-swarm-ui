import type { RefObject } from 'react';

import type { MessageScrollAnchorSnapshot } from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';

export type MessageViewport = {
  bottomRef: RefObject<HTMLDivElement | null>;
  isScrolledNearBottom: () => boolean;
  jumpToLatestMessages: () => void;
  keepMessageBottomUntilRef: RefObject<number>;
  lastScrollTopRef: RefObject<number>;
  messageScrollAnchorRef: RefObject<MessageScrollAnchorSnapshot | null>;
  scrollMessagesToBottom: (
    behavior?: ScrollBehavior,
    keepPinned?: boolean,
  ) => void;
  scrollerRef: RefObject<HTMLDivElement | null>;
};
