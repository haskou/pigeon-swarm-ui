/** Stored form of `MlsTakenCommits`. */
export interface MlsTakenCommitsPrimitives {
  /** The epoch the group is in, as a decimal. */
  readonly epoch: string;
  /** The record id of the commit the group took, by the decimal epoch. */
  readonly commits: Readonly<Record<string, string>>;
}
