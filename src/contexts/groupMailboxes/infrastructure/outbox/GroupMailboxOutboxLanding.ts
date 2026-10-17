/**
 * One copy of a message that landed in the recipient's inbox of the
 * generation whose secret has the fingerprint `generation`, exported at
 * MLS epoch `epoch` (decimal): kept while a rival commit could still make
 * this device forget that generation, so the copy is then sent again.
 */
export type GroupMailboxOutboxLanding = {
  readonly epoch: string;
  readonly generation: string;
  readonly identityId: string;
};
