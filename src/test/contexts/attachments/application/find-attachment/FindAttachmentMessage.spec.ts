import { NullObject } from '@haskou/value-objects';

import { FindAttachmentMessage } from '../../../../../contexts/attachments/application/find-attachment/messages/FindAttachmentMessage';

describe(FindAttachmentMessage.name, () => {
  it('translates public lookup primitives into domain values', () => {
    const message = new FindAttachmentMessage('external-1', false);

    expect(message.getExternalIdentifier().toString()).toBe('external-1');
    expect(message.getPublicationStrategy().isEncrypted()).toBe(false);
    expect(
      NullObject.isNullObject(
        message.getPublicationStrategy().getEncryptionNetworkId(),
      ),
    ).toBe(true);
  });

  it('translates encrypted lookup primitives into its publication strategy', () => {
    const message = new FindAttachmentMessage('external-1', true);

    expect(message.getPublicationStrategy().isEncrypted()).toBe(true);
  });

  it('rejects an empty external identifier', () => {
    const message = new FindAttachmentMessage(' ', false);

    expect(() => message.getExternalIdentifier()).toThrow(
      'Attachment external identifier is required.',
    );
  });
});
