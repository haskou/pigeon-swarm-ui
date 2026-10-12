import type { Session } from '../../../identities/infrastructure/session/Session';
import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';

export type AttachmentPublicationContext = {
  file: File;
  onProgress?: (progress: AttachmentProgress) => void;
  origins: (string | undefined)[];
  session: Session;
};
