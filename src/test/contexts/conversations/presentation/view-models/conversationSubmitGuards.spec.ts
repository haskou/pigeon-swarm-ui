import {
  canSubmitDirectConversation,
  canSubmitGroupConversation,
} from '../../../../../contexts/conversations/presentation/view-models/conversationSubmitGuards';

const readyDirect = {
  busy: false,
  contactBlocked: false,
  hasExistingConversation: false,
  hasNetwork: true,
  hasPeer: true,
  networksFailed: false,
  networksLoading: false,
};

const readyGroup = {
  busy: false,
  hasGroupName: true,
  hasNetwork: true,
  hasParticipants: true,
  networksFailed: false,
  networksLoading: false,
};

describe(canSubmitDirectConversation.name, () => {
  it('allows a direct conversation once a shared private network is chosen', () => {
    expect(canSubmitDirectConversation(readyDirect)).toBe(true);
  });

  it('blocks when no shared private network exists', () => {
    expect(
      canSubmitDirectConversation({ ...readyDirect, hasNetwork: false }),
    ).toBe(false);
  });

  it('blocks while the node network list is loading or failed', () => {
    expect(
      canSubmitDirectConversation({ ...readyDirect, networksLoading: true }),
    ).toBe(false);
    expect(
      canSubmitDirectConversation({ ...readyDirect, networksFailed: true }),
    ).toBe(false);
  });

  it('blocks without a peer, while busy, or for an existing or blocked contact', () => {
    expect(
      canSubmitDirectConversation({ ...readyDirect, hasPeer: false }),
    ).toBe(false);
    expect(canSubmitDirectConversation({ ...readyDirect, busy: true })).toBe(
      false,
    );
    expect(
      canSubmitDirectConversation({
        ...readyDirect,
        hasExistingConversation: true,
      }),
    ).toBe(false);
    expect(
      canSubmitDirectConversation({ ...readyDirect, contactBlocked: true }),
    ).toBe(false);
  });
});

describe(canSubmitGroupConversation.name, () => {
  it('allows a group once a shared private network is chosen', () => {
    expect(canSubmitGroupConversation(readyGroup)).toBe(true);
  });

  it('blocks when no shared private network exists', () => {
    expect(
      canSubmitGroupConversation({ ...readyGroup, hasNetwork: false }),
    ).toBe(false);
  });

  it('blocks while the node network list is loading or failed', () => {
    expect(
      canSubmitGroupConversation({ ...readyGroup, networksLoading: true }),
    ).toBe(false);
    expect(
      canSubmitGroupConversation({ ...readyGroup, networksFailed: true }),
    ).toBe(false);
  });

  it('blocks without a group name or participants, or while busy', () => {
    expect(
      canSubmitGroupConversation({ ...readyGroup, hasGroupName: false }),
    ).toBe(false);
    expect(
      canSubmitGroupConversation({ ...readyGroup, hasParticipants: false }),
    ).toBe(false);
    expect(canSubmitGroupConversation({ ...readyGroup, busy: true })).toBe(
      false,
    );
  });
});
