/** A busy node asked for a stronger admission proof; the client re-mines. */
export type IdentityAdmissionProgress = {
  attempt: number;
  difficultyBits: number;
  maximumAttempts: number;
};
