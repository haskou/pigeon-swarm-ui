import { AttachmentContentType } from '../../../../../contexts/attachments/domain/value-objects/AttachmentContentType';
import { AttachmentExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentFilename } from '../../../../../contexts/attachments/domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentId';
import { AttachmentPublisherExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentSourceExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentSourceExternalIdentifier';

describe('attachment metadata value objects', () => {
  it.each([
    ['id', () => AttachmentId.fromString('')],
    ['external identifier', () => AttachmentExternalIdentifier.fromString('')],
    ['filename', () => AttachmentFilename.fromString('')],
    ['content type', () => AttachmentContentType.fromString('')],
    [
      'publisher external identifier',
      () => AttachmentPublisherExternalIdentifier.fromString(''),
    ],
    [
      'source external identifier',
      () => AttachmentSourceExternalIdentifier.fromString(''),
    ],
  ])('rejects an empty %s', (_name, create) => {
    expect(create).toThrow();
  });
});
