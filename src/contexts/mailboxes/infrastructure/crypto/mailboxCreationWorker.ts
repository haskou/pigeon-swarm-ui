import { ProofOfWork } from '@haskou/pigeon-swarm-crypto';

import type {
  MailboxCreationWorkerRequest,
  MailboxCreationWorkerResponse,
} from './MailboxCreationWorkerMessages';

self.onmessage = (event: MessageEvent<MailboxCreationWorkerRequest>) => {
  const { difficultyBits, id, mailboxId, postTokenHash, readTokenHash } =
    event.data;

  const response: MailboxCreationWorkerResponse = {
    creationNonce: ProofOfWork.mailboxCreation(
      mailboxId,
      postTokenHash,
      readTokenHash,
    ).mintSync(difficultyBits),
    id,
  };

  self.postMessage(response);
};
