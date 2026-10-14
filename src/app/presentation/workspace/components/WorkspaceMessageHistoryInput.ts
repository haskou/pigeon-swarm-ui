import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';

import type { MessageScrollAnchorSnapshot } from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';
import type { WorkspaceMode } from './WorkspaceMode';

export type WorkspaceMessageHistoryInput = {
  isScrolledNearBottom: () => boolean;
  keepMessageBottomUntilRef: MutableRefObject<number>;
  lastScrollTopRef: MutableRefObject<number>;
  messageScrollAnchorRef: MutableRefObject<MessageScrollAnchorSnapshot | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  suppressMessageLoadsUntilRef: MutableRefObject<number>;
  workspaceMode: WorkspaceMode;
};
