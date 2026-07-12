import type { ChatMessage } from '../../../../../shared/domain/pigeonResources.types';

import { mergeChatMessages } from '../../../../../contexts/communities/presentation/components/communityWorkspaceHelpers';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'identity-1',
  content: 'original',
  encrypted: false,
  id: 'message-1',
  mine: true,
  raw: { id: 'message-1', type: 'sent' },
  reactions: [],
  timestamp: 100,
  ...overrides,
});

describe(mergeChatMessages.name, () => {
  it('preserves original content when merging an edited community message', () => {
    expect(
      mergeChatMessages(
        [message()],
        [
          message({
            content: 'edited',
            edited: true,
            editedAt: 200,
            timestamp: 100,
          }),
        ],
      )[0]?.originalContent,
    ).toBe('original');
  });

  it('keeps the first original content after repeated community edits', () => {
    const firstEdit = mergeChatMessages(
      [message()],
      [
        message({
          content: 'first edit',
          edited: true,
          editedAt: 200,
          timestamp: 100,
        }),
      ],
    );

    expect(
      mergeChatMessages(firstEdit, [
        message({
          content: 'second edit',
          edited: true,
          editedAt: 300,
          timestamp: 100,
        }),
      ])[0]?.originalContent,
    ).toBe('original');
  });
});
