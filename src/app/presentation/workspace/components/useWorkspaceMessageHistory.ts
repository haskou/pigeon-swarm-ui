import type { WorkspaceMessageHistory } from './WorkspaceMessageHistory';
import type { WorkspaceMessageHistoryInput } from './WorkspaceMessageHistoryInput';

export function useWorkspaceMessageHistory(
  input: WorkspaceMessageHistoryInput,
): WorkspaceMessageHistory {
  const handleScroll = (): void => {
    if (input.workspaceMode !== 'messages') return;

    const scrollTop = input.scrollerRef.current?.scrollTop ?? 0;
    const isScrollingUp = scrollTop < input.lastScrollTopRef.current;

    // eslint-disable-next-line no-param-reassign -- shared React ref
    input.lastScrollTopRef.current = scrollTop;

    if (Date.now() < input.suppressMessageLoadsUntilRef.current) return;

    if (input.isScrolledNearBottom()) {
      input.setNewMessageCount(0);
    } else {
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.keepMessageBottomUntilRef.current = 0;
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp) {
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.keepMessageBottomUntilRef.current = 0;
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.messageScrollAnchorRef.current = null;
    }
  };

  return { handleScroll };
}
