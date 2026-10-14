import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationThread } from '../../../../../app/presentation/workspace/components/ConversationThread';
import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';
import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';
import type { StickerMessageReference } from '../../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationThread } from '../../../../../app/presentation/workspace/components/useConversationThread';
import { captureUnhandledRejections } from '../../../../captureUnhandledRejections';

const mockCells: Array<{ value: unknown }> = [];
let mockCellIndex = 0;

jest.mock('react', () => ({
  useEffect: () => undefined,
  useState: <T>(initial: T) => {
    const index = mockCellIndex;

    mockCellIndex += 1;

    const cell = mockCells[index] ?? { value: initial };

    mockCells[index] = cell;

    const setValue = (update: unknown) => {
      cell.value =
        typeof update === 'function'
          ? (update as (current: unknown) => unknown)(cell.value)
          : update;
    };

    return [cell.value, setValue];
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    groupMessages: { delete: jest.fn(), edit: jest.fn(), send: jest.fn() },
    stickers: { markUsed: jest.fn() },
  },
}));

const send = jest.mocked(applicationContainer.groupMessages.send);
const groupEdit = jest.mocked(applicationContainer.groupMessages.edit);
const groupDelete = jest.mocked(applicationContainer.groupMessages.delete);
const markUsed = jest.mocked(applicationContainer.stickers.markUsed);

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const group = {
  id: 'group-1',
  networkId: 'network-1',
  type: 'group',
} as unknown as ConversationResource;
const rootMessage = {
  content: 'root',
  id: 'root-1',
  raw: {
    conversationId: 'group-1',
    id: 'root-1',
    type: 'sent',
  },
  timestamp: 1000,
} as unknown as ChatMessage;
const reply = {
  content: 'reply',
  id: 'reply-1',
  raw: {
    conversationId: 'group-1',
    id: 'reply-1',
    threadRootMessageId: 'root-1',
    type: 'sent',
  },
  threadRootMessageId: 'root-1',
  timestamp: 1500,
} as unknown as ChatMessage;
const unrelated = {
  content: 'other',
  id: 'other-1',
  raw: {
    conversationId: 'group-1',
    id: 'other-1',
    type: 'sent',
  },
  timestamp: 1600,
} as unknown as ChatMessage;
const sticker = {
  id: 'sticker-1',
  packId: 'pack-1',
} as unknown as StickerMessageReference;
const sentRaw = {
  conversationId: 'group-1',
  id: 'sent-1',
  type: 'sent',
} as unknown as MessageResource;
const sentMessage = {
  attachments: [],
  authorIdentityId: 'identity-1',
  content: '',
  encrypted: false,
  id: 'sent-1',
  mine: true,
  raw: sentRaw,
  reactions: [],
  timestamp: 2000,
} as unknown as ChatMessage;

const timeline: { messages: ChatMessage[] } = { messages: [] };
// A plain function, so jest.resetAllMocks keeps it applying updates.
function setMessages(update: SetStateAction<ChatMessage[]>): void {
  timeline.messages =
    typeof update === 'function' ? update(timeline.messages) : update;
}

// Each render re-runs the hook against the same state cells, as a mounted
// component does. The thread state is the only useState cell.
function render() {
  mockCellIndex = 0;

  return useConversationThread({
    activeConversation: group,
    closeMessageContextMenu: jest.fn(),
    messages: timeline.messages,
    session,
    setMessages,
  });
}

function openThread() {
  render().open(rootMessage);

  return render();
}

function currentThread(): ConversationThread | null {
  return mockCells[0]?.value as ConversationThread | null;
}

function threadMessageIds(): string[] {
  const thread = currentThread();

  return thread?.messages.map((message) => message.id) ?? [];
}

function resetThreadState() {
  jest.resetAllMocks();
  mockCells.length = 0;
  timeline.messages = [rootMessage, reply, unrelated];
  send.mockResolvedValue(sentMessage);
  markUsed.mockResolvedValue(undefined);
}

describe('useConversationThread', () => {
  beforeEach(resetThreadState);

  it('opens a thread from the replies already in the timeline', () => {
    openThread();

    expect(currentThread()).toEqual(
      expect.objectContaining({ root: rootMessage, state: 'ready' }),
    );
    expect(threadMessageIds()).toEqual(['reply-1']);
  });

  it('sends a thread reply through the group mailbox', async () => {
    const thread = openThread();

    await thread.send('hello', [], {});

    expect(send).toHaveBeenCalledWith(
      session,
      group,
      'hello',
      expect.objectContaining({
        previousMessageIds: ['reply-1'],
        replyToMessageId: 'root-1',
        threadRootMessageId: 'root-1',
      }),
    );
    expect(timeline.messages.map((message) => message.id)).toContain('sent-1');
    expect(threadMessageIds()).toContain('sent-1');
  });

  it('edits a thread reply through the group mailbox', async () => {
    const edited = {
      ...reply,
      content: 'changed',
      raw: { ...sentRaw, id: 'reply-1' },
    } as ChatMessage;

    groupEdit.mockResolvedValue(edited);
    render().open(rootMessage);
    render().startEditing(reply);
    const thread = render();

    await thread.edit('changed');

    expect(groupEdit).toHaveBeenCalledWith(
      session,
      group,
      'reply-1',
      'changed',
      {},
    );
    expect(currentThread()?.editingMessage).toBeNull();
  });

  it('deletes a thread reply through the group mailbox', async () => {
    groupDelete.mockResolvedValue(undefined);
    const thread = openThread();

    await thread.remove(reply);

    expect(groupDelete).toHaveBeenCalledWith(session, group, 'reply-1');
    expect(timeline.messages.map((message) => message.id)).not.toContain(
      'reply-1',
    );
    expect(threadMessageIds()).toEqual([]);
  });
});

describe('useConversationThread sticker sends', () => {
  beforeEach(resetThreadState);

  it('records sticker usage and keeps the sent sticker in the thread', async () => {
    const thread = openThread();

    await thread.sendSticker(sticker);

    expect(markUsed).toHaveBeenCalledWith(session, sticker);
    expect(threadMessageIds()).toContain('sent-1');
  });

  it('keeps a delivered sticker send in the thread when sticker usage throws synchronously', async () => {
    markUsed.mockImplementation(() => {
      throw new Error('usage unavailable');
    });
    const thread = openThread();

    await expect(thread.sendSticker(sticker)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    expect(threadMessageIds()).toContain('sent-1');
  });

  it('keeps a delivered sticker send in the thread when sticker usage rejects, with no unhandled rejection', async () => {
    markUsed.mockRejectedValue(new Error('usage unavailable'));
    const thread = openThread();

    const unhandled = await captureUnhandledRejections(async () => {
      await thread.sendSticker(sticker);
    });

    expect(unhandled).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(threadMessageIds()).toContain('sent-1');
  });
});
