export type MailboxCreationWorkerRequest = {
  id: number;
  mailboxId: string;
  postTokenHash: string;
  readTokenHash: string;
};

export type MailboxCreationWorkerResponse = {
  creationNonce: string;
  id: number;
};
