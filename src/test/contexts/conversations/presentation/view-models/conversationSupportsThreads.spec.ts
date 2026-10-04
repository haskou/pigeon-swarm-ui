import { conversationSupportsThreads } from '../../../../../contexts/conversations/presentation/view-models/conversationSupportsThreads';

describe(conversationSupportsThreads.name, () => {
  it('allows threads for group conversations', () => {
    expect(
      conversationSupportsThreads({
        id: 'group:conversation-1',
        type: 'group',
      }),
    ).toBe(true);
  });

  it('rejects threads for one-to-one conversations', () => {
    expect(
      conversationSupportsThreads({
        id: 'one-to-one:conversation-1',
        type: 'one-to-one',
      }),
    ).toBe(false);
  });

  it('trusts the type over a group-shaped id', () => {
    expect(
      conversationSupportsThreads({
        id: 'group:conversation-1',
        type: 'one-to-one',
      }),
    ).toBe(false);
  });
});
