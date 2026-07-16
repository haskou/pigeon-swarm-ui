import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { AttachmentPublisherExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentSourceExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentSourceExternalIdentifier';
import { AttachmentPublicationContexts } from '../../../../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';

describe(AttachmentPublicationContexts.name, () => {
  it('takes a registered publication context only once', () => {
    const contexts = new AttachmentPublicationContexts();
    const session = { identity: { id: 'identity-1' } } as Session;
    const file = new File(['content'], 'file.txt');

    contexts.register('source-1', 'identity-1', { file, session });

    expect(
      contexts.take(
        AttachmentSourceExternalIdentifier.fromString('source-1'),
        AttachmentPublisherExternalIdentifier.fromString('identity-1'),
      ),
    ).toEqual({ file, session });
    expect(() =>
      contexts.take(
        AttachmentSourceExternalIdentifier.fromString('source-1'),
        AttachmentPublisherExternalIdentifier.fromString('identity-1'),
      ),
    ).toThrow('Attachment publication context was not found.');
  });

  it('does not expose a context to another publisher', () => {
    const contexts = new AttachmentPublicationContexts();

    contexts.register('source-1', 'identity-1', {
      file: new File(['content'], 'file.txt'),
      session: { identity: { id: 'identity-1' } } as Session,
    });

    expect(() =>
      contexts.take(
        AttachmentSourceExternalIdentifier.fromString('source-1'),
        AttachmentPublisherExternalIdentifier.fromString('identity-2'),
      ),
    ).toThrow('Attachment publication context was not found.');
  });
});
