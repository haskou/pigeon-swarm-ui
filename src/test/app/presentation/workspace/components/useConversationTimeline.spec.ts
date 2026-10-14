import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationTimeline } from '../../../../../app/presentation/workspace/components/useConversationTimeline';

const mockEffects: Array<() => void> = [];

jest.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => void) => {
    mockEffects.push(effect);
  },
  useRef: <T>(initial: T) => ({ current: initial }),
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === 'function' ? (initial as () => T)() : initial,
    jest.fn(),
  ],
}));
jest.mock(
  '../../../../../app/presentation/workspace/components/useMessageViewport',
  () => ({
    useMessageViewport: () => ({
      bottomRef: { current: null },
      isScrolledNearBottom: () => false,
      jumpToLatestMessages: () => undefined,
      keepMessageBottomUntilRef: { current: false },
      lastScrollTopRef: { current: 0 },
      messageScrollAnchorRef: { current: null },
      scrollerRef: { current: null },
      scrollMessagesToBottom: jest.fn(),
    }),
  }),
);
jest.mock(
  '../../../../../app/presentation/workspace/components/useWorkspaceMessageHistory',
  () => ({
    useWorkspaceMessageHistory: () => ({ handleScroll: () => undefined }),
  }),
);
jest.mock(
  '../../../../../app/presentation/workspace/components/useWorkspaceResumeSync',
  () => ({ useWorkspaceResumeSync: jest.fn() }),
);
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    conversations: { markReadUntil: jest.fn() },
    directMessages: { markRead: jest.fn() },
  },
}));

const conversation = {
  id: 'conversation-1',
  participantIds: ['alice', 'bob'],
  type: 'one-to-one',
} as unknown as ConversationResource;
const group = {
  id: 'group-1',
  participantIds: ['alice', 'bob', 'carol'],
  type: 'group',
} as unknown as ConversationResource;
const session = { identity: { id: 'alice' } } as unknown as Session;
const message = {
  attachments: [],
  authorIdentityId: 'bob',
  content: 'hello',
  encrypted: false,
  id: 'message-1',
  mine: false,
  raw: { conversationId: 'conversation-1', id: 'message-1', type: 'sent' },
  reactions: [],
  timestamp: 1000,
} as unknown as ChatMessage;

function mountTimeline(activeConversation = conversation) {
  const onErrorChange = jest.fn<(error: null | string) => void>();

  mockEffects.length = 0;
  const timeline = useConversationTimeline({
    activeConversation,
    activeConversationReady: true,
    clearUnreadMessages: jest.fn(),
    onCommunitiesReload: () => Promise.resolve(),
    onConversationsChange: jest.fn(),
    onErrorChange,
    refreshConversations: () => Promise.resolve([]),
    sessionRef: { current: session },
    suppressMessageLoadsUntilRef: { current: 0 },
    workspaceMode: 'messages',
  });

  return { onErrorChange, timeline };
}

// Runs the mount effects, as React does after the first render.
function runEffects() {
  mockEffects.forEach((effect) => effect());
}

describe('useConversationTimeline', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(applicationContainer.conversations.markReadUntil)
      .mockResolvedValue(undefined);
  });

  it.each([
    ['one-to-one', conversation],
    ['group', group],
  ])(
    'opens an empty %s timeline for its mailbox sync to fill',
    (_type, activeConversation) => {
      const { onErrorChange, timeline } = mountTimeline(activeConversation);

      runEffects();

      expect(timeline.setMessages).toHaveBeenCalledTimes(1);
      expect(timeline.setMessages).toHaveBeenCalledWith([]);
      expect(onErrorChange).toHaveBeenCalledWith(null);
      expect(onErrorChange).not.toHaveBeenCalledWith(expect.any(String));
    },
  );

  it('hands a one-to-one read to the read use case with the open conversation', () => {
    const { timeline } = mountTimeline();

    timeline.markConversationReadUntil(conversation.id, [message]);

    expect(
      applicationContainer.conversations.markReadUntil,
    ).toHaveBeenCalledWith(session, conversation.id, message.id, conversation);
    expect(applicationContainer.directMessages.markRead).not.toHaveBeenCalled();
  });
});
