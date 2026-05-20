import { AttachmentCipher } from '../../modules/attachments/infrastructure/crypto/attachmentCipher';
import { browserAttachmentWorkerFactory } from '../../modules/attachments/infrastructure/crypto/browserAttachmentWorkerFactory';
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
