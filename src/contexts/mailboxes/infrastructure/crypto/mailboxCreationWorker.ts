import { MailboxCreationProof } from './MailboxCreationProof';
import type {
  MailboxCreationWorkerRequest,
  MailboxCreationWorkerResponse,
} from './MailboxCreationWorkerMessages';

self.onmessage = (event: MessageEvent<MailboxCreationWorkerRequest>) => {
  const { id, mailboxId, postTokenHash, readTokenHash } = event.data;

  const response: MailboxCreationWorkerResponse = {
    creationNonce: MailboxCreationProof.mine(
      mailboxId,
      postTokenHash,
      readTokenHash,
    ),
    id,
  };

  self.postMessage(response);
};
