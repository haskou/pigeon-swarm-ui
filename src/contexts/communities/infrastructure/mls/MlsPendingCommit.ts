/**
 * A commit this device made in a community MLS group, kept aside from
 * before it is published until the group has left the epoch it was made in.
 */
export interface MlsPendingCommit {
  /** The record id the commit is published under. */
  commitId: string;
  /** Base64 commit, as published: only a record carrying it is this one. */
  payload: string;
  /** The epoch the commit was made in. */
  epoch: number;
  /** Base64 group state the commit leads to. */
  state: string;
  /** The roster revision the commit binds. */
  frontier: string[];
  /** The welcome for the devices the commit adds, and who gets it. */
  welcome?: { payload: string; recipientIdentityIds: string[] };
}
