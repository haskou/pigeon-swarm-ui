import { AttachmentCipher } from '../../modules/attachments/domain/attachmentCipher';
import { browserAttachmentWorkerFactory } from '../../modules/attachments/domain/browserAttachmentWorkerFactory';
import { PigeonApiGateway } from './pigeonApiGateway';
import { PigeonApplication } from './pigeonApplication';

export const pigeonApplication = new PigeonApplication(
  new PigeonApiGateway(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    new AttachmentCipher(browserAttachmentWorkerFactory),
  ),
);
