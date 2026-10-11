export type MailboxCreationWorkerRequest = {
  id: number;
  mailboxId: string;
  postTokenHash: string;
  readTokenHash: string;
  difficultyBits: number;
};

export type MailboxCreationWorkerResponse = {
  creationNonce: string;
  id: number;
};
