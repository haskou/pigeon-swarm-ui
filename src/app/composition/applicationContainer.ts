import { AttachmentCipher } from '../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { browserAttachmentWorkerFactory } from '../../contexts/attachments/infrastructure/crypto/browserAttachmentWorkerFactory';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonApplication } from './PigeonApplication';

export const applicationContainer = new PigeonApplication(
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
