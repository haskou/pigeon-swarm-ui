import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/presentation/view-models/ChatMessage';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationTimeline } from '../../../../../app/presentation/workspace/components/useConversationTimeline';
import { useWorkspaceResumeSync } from '../../../../../app/presentation/workspace/components/useWorkspaceResumeSync';

jest.mock('react', () => ({
  startTransition: (run: () => void) => run(),
  useCallback: <T>(callback: T) => callback,
  useEffect: () => undefined,
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
    messages: { load: jest.fn() },
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
  const timeline = useConversationTimeline({
    activeConversation,
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

// The hook hands its real loadActiveMessages to the resume sync.
function loadActiveMessagesOf() {
  const input = jest.mocked(useWorkspaceResumeSync).mock.calls[0]?.[0];

  if (!input) throw new Error('useWorkspaceResumeSync was not mounted');

  return input.loadActiveMessages;
}

describe('useConversationTimeline', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(applicationContainer.conversations.markReadUntil)
      .mockResolvedValue(undefined);
    jest
      .mocked(applicationContainer.messages.load)
      .mockResolvedValue({ messages: [message], nextCursor: null } as never);
  });

  it('never reads the node message list for a one-to-one conversation', async () => {
    const { onErrorChange, timeline } = mountTimeline();

    await loadActiveMessagesOf()(conversation.id);

    expect(applicationContainer.messages.load).not.toHaveBeenCalled();
    expect(timeline.setMessages).toHaveBeenCalledTimes(1);
    expect(timeline.setMessages).toHaveBeenCalledWith([]);
    expect(onErrorChange).not.toHaveBeenCalledWith(expect.any(String));
  });

  it('keeps the mailbox timeline of a one-to-one conversation on resume', async () => {
    const { timeline } = mountTimeline();

    await loadActiveMessagesOf()(conversation.id);
    await loadActiveMessagesOf()(conversation.id);

    expect(timeline.setMessages).toHaveBeenCalledTimes(1);
    expect(applicationContainer.messages.load).not.toHaveBeenCalled();
  });

  it('marks a one-to-one conversation read through the mailbox, not read-until', () => {
    const { timeline } = mountTimeline();

    timeline.markConversationReadUntil(conversation.id, [message]);

    expect(applicationContainer.directMessages.markRead).toHaveBeenCalledWith(
      expect.anything(),
      conversation,
      message.id,
    );
    expect(
      applicationContainer.conversations.markReadUntil,
    ).not.toHaveBeenCalled();
  });

  it('loads a group timeline from the node and marks it read-until', async () => {
    const { timeline } = mountTimeline(group);

    await loadActiveMessagesOf()(group.id);

    expect(applicationContainer.messages.load).toHaveBeenCalledWith(
      session,
      group.id,
      null,
      expect.anything(),
    );
    expect(timeline.setMessages).toHaveBeenLastCalledWith([message]);
    expect(
      applicationContainer.conversations.markReadUntil,
    ).toHaveBeenCalledWith(session, group.id, message.id);
    expect(applicationContainer.directMessages.markRead).not.toHaveBeenCalled();
  });
});
