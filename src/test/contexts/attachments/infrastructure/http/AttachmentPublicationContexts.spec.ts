import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { AttachmentPublisherExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentSourceExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentSourceExternalIdentifier';
import { AttachmentPublicationContexts } from '../../../../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';

describe(AttachmentPublicationContexts.name, () => {
  it('takes a registered publication context only once', () => {
    const contexts = new AttachmentPublicationContexts();
    const session = { identity: { id: 'identity-1' } } as Session;
    const file = new File(['content'], 'file.txt');
    const origins = ['https://node-a.example', undefined];

    contexts.register('source-1', 'identity-1', { file, origins, session });

    expect(
      contexts.take(
        AttachmentSourceExternalIdentifier.fromString('source-1'),
        AttachmentPublisherExternalIdentifier.fromString('identity-1'),
      ),
    ).toEqual({ file, origins, session });
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
      origins: [undefined],
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
