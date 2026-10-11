import type {
  MailboxCreationWorkerRequest,
  MailboxCreationWorkerResponse,
} from './MailboxCreationWorkerMessages';

import { MailboxCreationProof } from './MailboxCreationProof';

self.onmessage = (event: MessageEvent<MailboxCreationWorkerRequest>) => {
  const { difficultyBits, id, mailboxId, postTokenHash, readTokenHash } =
    event.data;

  const response: MailboxCreationWorkerResponse = {
    creationNonce: MailboxCreationProof.mine(
      mailboxId,
      postTokenHash,
      readTokenHash,
      difficultyBits,
    ),
    id,
  };

  self.postMessage(response);
};
