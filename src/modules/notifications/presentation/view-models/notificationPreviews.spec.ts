import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { messageNotificationBody } from './notificationPreviews';

function imageAttachment(
  overrides: Partial<MessageAttachment> = {},
): MessageAttachment {
  return {
    cid: 'image-cid',
    contentType: 'image/webp',
    filename: 'photo.webp',
    size: 1024,
    ...overrides,
  };
}

describe(messageNotificationBody.name, () => {
  it('uses plaintext content for public messages', () => {
    expect(
      messageNotificationBody({
        plaintextPayload: JSON.stringify({
          content: 'Hola desde el canal publico',
        }),
        publicPlaintext: true,
      }),
    ).toBe('Hola desde el canal publico');
  });

  it('does not expose plaintext content for private messages', () => {
    expect(
      messageNotificationBody({
        plaintextPayload: JSON.stringify({ content: 'texto privado' }),
        publicPlaintext: false,
      }),
    ).toBe(copy.chat.newMessage);
  });

  it('summarizes one image attachment as a photo', () => {
    expect(
      messageNotificationBody({
        attachments: [imageAttachment()],
      }),
    ).toBe(copy.chat.sentPhoto);
  });

  it('summarizes multiple image attachments as an album', () => {
    expect(
      messageNotificationBody({
        attachments: [
          imageAttachment({ cid: 'image-1' }),
          imageAttachment({ cid: 'image-2', filename: 'second.png' }),
        ],
      }),
    ).toBe(copy.chat.sentAlbum);
  });

  it('summarizes unknown external attachments as a file', () => {
    expect(
      messageNotificationBody({
        attachmentExternalIdentifiers: ['bafy-file'],
      }),
    ).toBe(copy.chat.sentFile);
  });
});
