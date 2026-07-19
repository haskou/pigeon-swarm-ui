import { ConversationDraftCollection } from '../../../../../app/presentation/workspace/components/ConversationDraftCollection';

describe(ConversationDraftCollection.name, () => {
  it('adds remote drafts that are missing locally', () => {
    expect(
      ConversationDraftCollection.mergeMissing({ local: 'local draft' }, [
        { content: 'remote draft', conversationId: 'remote' },
      ]),
    ).toEqual({ local: 'local draft', remote: 'remote draft' });
  });

  it('preserves the newer local draft', () => {
    expect(
      ConversationDraftCollection.mergeMissing(
        { conversation: 'local draft' },
        [{ content: 'remote draft', conversationId: 'conversation' }],
      ),
    ).toEqual({ conversation: 'local draft' });
  });

  it('does not mutate the local collection', () => {
    const local = { conversation: 'draft' };

    ConversationDraftCollection.mergeMissing(local, [
      { content: 'remote', conversationId: 'other' },
    ]);

    expect(local).toEqual({ conversation: 'draft' });
  });
});
