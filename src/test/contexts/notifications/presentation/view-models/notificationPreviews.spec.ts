import type {
  MessageAttachment,
  MessageResource,
} from '../../../../../shared/domain/pigeonResources.types';

import {
  communityNotificationPreview,
  messageNotificationBody,
} from '../../../../../contexts/notifications/presentation/view-models/notificationPreviews';
import { copy } from '../../../../../shared/presentation/i18n/copy';

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
});

describe(communityNotificationPreview.name, () => {
  it('summarizes an encrypted image stored only in private blobs as a photo', () => {
    const message = {
      plaintextPayload: JSON.stringify({
        attachments: [
          {
            blobs: [{ blobId: 'blob-a', index: 0, size: 1024 }],
            contentType: 'image/webp',
            filename: 'photo.webp',
            size: 1024,
          },
        ],
      }),
    } as MessageResource;

    expect(
      communityNotificationPreview(
        [],
        'missing',
        'missing',
        undefined,
        {},
        message,
      ).body,
    ).toBe(copy.chat.sentPhoto);
  });
});
