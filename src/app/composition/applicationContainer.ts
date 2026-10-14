import { AttachmentCipher } from '../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { browserAttachmentWorkerFactory } from '../../contexts/attachments/infrastructure/crypto/browserAttachmentWorkerFactory';
import { ContactPinStore } from '../../contexts/identities/infrastructure/storage/ContactPinStore';
import { DeviceStorage } from '../../shared/infrastructure/storage/DeviceStorage';
import { PigeonHistoryBackup } from './backup/PigeonHistoryBackup';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonApplication } from './PigeonApplication';

export const applicationContainer = new PigeonApplication(
  new PigeonApiGateway(undefined, undefined, undefined, undefined, {
    attachmentCipher: AttachmentCipher.withWorker(
      browserAttachmentWorkerFactory,
    ),
  }),
);

export const contactPinStore = new ContactPinStore();

export const deviceStorage = new DeviceStorage();

export const historyBackup = new PigeonHistoryBackup(
  applicationContainer.identities,
  applicationContainer.directMessages,
  contactPinStore,
);
