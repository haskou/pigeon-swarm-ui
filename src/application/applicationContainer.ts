import { AttachmentCipher } from '../domain/attachments/AttachmentCipher';
import { browserAttachmentWorkerFactory } from '../domain/attachments/browserAttachmentWorkerFactory';
import { PigeonApiGateway } from '../infrastructure/pigeon-api/PigeonApiGateway';
import { PigeonApplication } from './PigeonApplication';

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
