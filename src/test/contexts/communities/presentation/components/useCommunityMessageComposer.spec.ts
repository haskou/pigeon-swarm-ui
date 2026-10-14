import type { SetStateAction } from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';
import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';
import type { StickerMessageReference } from '../../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useCommunityMessageComposer } from '../../../../../contexts/communities/presentation/components/useCommunityMessageComposer';
import { captureUnhandledRejections } from '../../../../captureUnhandledRejections';

const mockCells: Array<{ value: unknown }> = [];
let mockCellIndex = 0;
const mockRefs: Array<{ current: unknown }> = [];
let mockRefIndex = 0;

jest.mock('react', () => ({
  startTransition: (callback: () => void) => callback(),
  useEffect: () => undefined,
  useRef: <T>(initial: T) => {
    const index = mockRefIndex;

    mockRefIndex += 1;

    const ref = mockRefs[index] ?? { current: initial };

    mockRefs[index] = ref;

    return ref;
  },
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
jest.mock(
  '../../../../../contexts/attachments/presentation/hooks/useAttachmentDownload',
  () => ({
    useAttachmentDownload: () => ({
      loadAttachmentPreview: jest.fn(),
      openAttachment: jest.fn(),
    }),
  }),
);
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    attachments: { publish: jest.fn() },
    communities: { createChannelMessage: jest.fn() },
    mls: { encrypt: jest.fn() },
    stickers: { markUsed: jest.fn() },
  },
}));

const publish = jest.mocked(applicationContainer.attachments.publish);
const createChannelMessage = jest.mocked(
  applicationContainer.communities.createChannelMessage,
);
const markUsed = jest.mocked(applicationContainer.stickers.markUsed);

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const community = {
  id: 'community-1',
  networkId: 'network-1',
  visibility: 'public',
} as unknown as Community;
const sticker = {
  id: 'sticker-1',
  packId: 'pack-1',
} as unknown as StickerMessageReference;
const created = {
  channelId: 'channel-1',
  id: 'created-1',
  type: 'sent',
} as unknown as MessageResource;
const projected = {
  attachments: [],
  authorIdentityId: 'identity-1',
  content: '',
  deliveryStatus: 'sent',
  encrypted: false,
  id: 'created-1',
  mine: true,
  raw: created,
  reactions: [],
  timestamp: 2000,
} as unknown as ChatMessage;

let messagesState: ChatMessage[] = [];
const setMessages = (update: SetStateAction<ChatMessage[]>) => {
  messagesState = typeof update === 'function' ? update(messagesState) : update;
};

// Each render re-runs the hook against the same state and ref cells, as a
// mounted component does. sendQueueRef is the only useRef, so it is cell 0.
function render() {
  mockCellIndex = 0;
  mockRefIndex = 0;

  return useCommunityMessageComposer({
    community,
    currentPermissions: new Set(),
    draft: '',
    memberIdentities: {},
    messages: messagesState,
    owner: false,
    projectChannelMessage: jest.fn(() => Promise.resolve(projected)),
    scrollChannelToBottom: jest.fn(),
    scrollerRef: { current: null },
    selectedChannelId: 'channel-1',
    selectedChannelPolls: [],
    session,
    setDraft: jest.fn(),
    setMessages,
  });
}

async function drainSendQueue(): Promise<void> {
  await (mockRefs[0]?.current as Promise<void>);
}

function failedMessageIds(): string[] {
  return messagesState
    .filter((message) => message.deliveryStatus === 'failed')
    .map((message) => message.id);
}

describe('useCommunityMessageComposer channel sticker sends', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCells.length = 0;
    mockRefs.length = 0;
    messagesState = [];
    publish.mockResolvedValue([] as never);
    createChannelMessage.mockResolvedValue(created);
    markUsed.mockResolvedValue(undefined);
  });

  it('records sticker usage and keeps the delivered sticker in the channel', async () => {
    await render().handleSendChannelSticker(sticker);
    await drainSendQueue();

    expect(markUsed).toHaveBeenCalledWith(session, sticker);
    expect(render().error).toBeNull();
    expect(messagesState.map((message) => message.id)).toContain('created-1');
    expect(failedMessageIds()).toEqual([]);
  });

  it('keeps a delivered channel sticker send delivered when sticker usage throws synchronously', async () => {
    markUsed.mockImplementation(() => {
      throw new Error('usage unavailable');
    });

    const unhandled = await captureUnhandledRejections(async () => {
      await render().handleSendChannelSticker(sticker);
      await drainSendQueue();
    });

    expect(unhandled).toEqual([]);
    expect(createChannelMessage).toHaveBeenCalledTimes(1);
    expect(render().error).toBeNull();
    expect(failedMessageIds()).toEqual([]);
    expect(messagesState.map((message) => message.id)).toContain('created-1');
  });

  it('keeps a delivered channel sticker send delivered when sticker usage rejects, with no unhandled rejection', async () => {
    markUsed.mockRejectedValue(new Error('usage unavailable'));

    const unhandled = await captureUnhandledRejections(async () => {
      await render().handleSendChannelSticker(sticker);
      await drainSendQueue();
    });

    expect(unhandled).toEqual([]);
    expect(createChannelMessage).toHaveBeenCalledTimes(1);
    expect(render().error).toBeNull();
    expect(failedMessageIds()).toEqual([]);
    expect(messagesState.map((message) => message.id)).toContain('created-1');
  });
});
