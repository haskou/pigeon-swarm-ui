import { conversationSupportsThreads } from '../../../../../contexts/conversations/presentation/view-models/conversationSupportsThreads';

describe(conversationSupportsThreads.name, () => {
  it('allows threads for group conversations', () => {
    expect(
      conversationSupportsThreads({ id: 'conversation-1', type: 'group' }),
    ).toBe(true);
  });

  it('recognizes legacy group ids without an explicit type', () => {
    expect(conversationSupportsThreads({ id: 'group:conversation-1' })).toBe(
      true,
    );
  });

  it('rejects threads for one-to-one conversations', () => {
    expect(
      conversationSupportsThreads({
        id: 'one-to-one:conversation-1',
        type: 'one-to-one',
      }),
    ).toBe(false);
  });

  it('trusts an explicit one-to-one type over a legacy group-shaped id', () => {
    expect(
      conversationSupportsThreads({
        id: 'group:conversation-1',
        type: 'one-to-one',
      }),
    ).toBe(false);
  });

  it('rejects a one-to-one identifier even when the type is missing', () => {
    expect(
      conversationSupportsThreads({ id: 'one-to-one:conversation-1' }),
    ).toBe(false);
  });

  it('rejects a one-to-one conversation id even when the type is group', () => {
    expect(
      conversationSupportsThreads({
        conversationId: 'one-to-one:conversation-1',
        id: 'group:legacy-id',
        type: 'group',
      }),
    ).toBe(false);
  });
});
