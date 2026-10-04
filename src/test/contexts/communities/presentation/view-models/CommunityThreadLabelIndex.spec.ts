import type { CommunityThreadState } from '../../../../../contexts/communities/presentation/components/communityThreadState';
import type { ChatMessage } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityThreadLabelIndex } from '../../../../../contexts/communities/presentation/view-models/CommunityThreadLabelIndex';

function message(
  id: string,
  content: string,
  replyToMessageId?: string,
): ChatMessage {
  return {
    attachments: [],
    content,
    id,
    raw: { replyToMessageId },
    replyToMessageId,
  } as unknown as ChatMessage;
}

const panel = (root: ChatMessage) =>
  ({ root }) as unknown as CommunityThreadState;

describe('CommunityThreadLabelIndex', () => {
  describe('fromVisibleMessages', () => {
    it('labels only root messages from every source', () => {
      const labels = CommunityThreadLabelIndex.fromVisibleMessages({
        collectionMessages: [message('pinned', 'Pinned root')],
        messages: [message('root', 'First'), message('reply', 'x', 'root')],
        searchResultMessages: [message('found', 'Found root')],
        threadPanel: panel(message('open', 'Open root')),
      });

      expect(labels).toEqual({
        found: 'Found root',
        open: 'Open root',
        pinned: 'Pinned root',
        root: 'First',
      });
    });

    it('lets later sources override earlier ones for the same message', () => {
      const labels = CommunityThreadLabelIndex.fromVisibleMessages({
        collectionMessages: [],
        messages: [message('root', 'Old title')],
        searchResultMessages: [message('root', 'New title')],
        threadPanel: null,
      });

      expect(labels).toEqual({ root: 'New title' });
    });
  });

  describe('byRootMessageId', () => {
    it('overrides known labels with the current messages and open thread', () => {
      const labels = CommunityThreadLabelIndex.byRootMessageId({
        knownLabels: { open: 'stale', root: 'stale', untouched: 'kept' },
        messages: [message('root', 'Fresh'), message('reply', 'x', 'root')],
        threadPanel: panel(message('open', 'Opened')),
      });

      expect(labels).toEqual({
        open: 'Opened',
        root: 'Fresh',
        untouched: 'kept',
      });
    });

    it('does not mutate known labels', () => {
      const knownLabels = { root: 'stale' };

      CommunityThreadLabelIndex.byRootMessageId({
        knownLabels,
        messages: [message('root', 'Fresh')],
        threadPanel: null,
      });

      expect(knownLabels).toEqual({ root: 'stale' });
    });
  });
});
