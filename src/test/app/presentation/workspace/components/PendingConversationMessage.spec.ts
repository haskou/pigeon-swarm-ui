import { PendingConversationMessage } from '../../../../../app/presentation/workspace/components/PendingConversationMessage';

describe(PendingConversationMessage.name, () => {
  const attachment = new File(['image'], 'photo.png', {
    type: 'image/png',
  });

  it('creates a pending message with local attachment previews', () => {
    const message = PendingConversationMessage.create({
      attachments: [attachment],
      authorIdentityId: 'identity-id',
      content: 'Look at this',
      id: 'pending-id',
      replyTarget: null,
      timestamp: 123,
    });

    expect(message).toMatchObject({
      authorIdentityId: 'identity-id',
      content: 'Look at this',
      deliveryStatus: 'pending',
      id: 'pending-id',
      mine: true,
      timestamp: 123,
    });
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toMatchObject({
      contentType: 'image/png',
      filename: 'photo.png',
      localFile: attachment,
    });
  });

  it('uses attachment names when an attachment-only message has no text', () => {
    const message = PendingConversationMessage.create({
      attachments: [attachment],
      authorIdentityId: 'identity-id',
      content: '',
      id: 'pending-id',
      replyTarget: null,
      timestamp: 123,
    });

    expect(message.content).toBe('photo.png');
  });

  it('keeps sticker messages textless', () => {
    const message = PendingConversationMessage.create({
      attachments: [],
      authorIdentityId: 'identity-id',
      content: 'ignored',
      id: 'pending-id',
      replyTarget: null,
      sticker: {
        assetCid: 'sticker-cid',
        packId: 'pack-id',
        stickerId: 'sticker-id',
      },
      timestamp: 123,
    });

    expect(message.content).toBe('');
    expect(message.sticker).toEqual({
      assetCid: 'sticker-cid',
      packId: 'pack-id',
      stickerId: 'sticker-id',
    });
  });
});
