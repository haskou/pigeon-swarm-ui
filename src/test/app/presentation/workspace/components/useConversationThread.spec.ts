import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationThreadState } from '../../../../../app/presentation/workspace/components/conversationThreadState';
import type {
  ChatMessage,
  ConversationResource,
  MessageResource,
  Session,
  StickerMessageReference,
} from '../../../../../shared/domain/pigeonResources.types';

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
    messages: { loadThread: jest.fn(), send: jest.fn() },
    stickers: { markUsed: jest.fn() },
  },
}));

const loadThread = jest.mocked(applicationContainer.messages.loadThread);
const send = jest.mocked(applicationContainer.messages.send);
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
  timestamp: 1000,
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

// Each render re-runs the hook against the same state cells, as a mounted
// component does. The thread state is the only useState cell.
function render() {
  mockCellIndex = 0;

  return useConversationThread({
    activeConversation: group,
    closeMessageContextMenu: jest.fn(),
    session,
    setMessages: jest.fn((update: SetStateAction<ChatMessage[]>) => update),
  });
}

async function openThread() {
  await render().open(rootMessage);

  return render();
}

function threadMessageIds(): string[] {
  const thread = mockCells[0]?.value as ConversationThreadState | null;

  return thread?.messages.map((message) => message.id) ?? [];
}

describe('useConversationThread sticker sends', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCells.length = 0;
    loadThread.mockResolvedValue({ messages: [] } as never);
    send.mockResolvedValue(sentMessage);
    markUsed.mockResolvedValue(undefined);
  });

  it('records sticker usage and keeps the sent sticker in the thread', async () => {
    const thread = await openThread();

    await thread.sendSticker(sticker);

    expect(markUsed).toHaveBeenCalledWith(session, sticker);
    expect(threadMessageIds()).toContain('sent-1');
  });

  it('keeps a delivered sticker send in the thread when sticker usage throws synchronously', async () => {
    markUsed.mockImplementation(() => {
      throw new Error('usage unavailable');
    });
    const thread = await openThread();

    await expect(thread.sendSticker(sticker)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    expect(threadMessageIds()).toContain('sent-1');
  });

  it('keeps a delivered sticker send in the thread when sticker usage rejects, with no unhandled rejection', async () => {
    markUsed.mockRejectedValue(new Error('usage unavailable'));
    const thread = await openThread();

    const unhandled = await captureUnhandledRejections(async () => {
      await thread.sendSticker(sticker);
    });

    expect(unhandled).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(threadMessageIds()).toContain('sent-1');
  });
});
