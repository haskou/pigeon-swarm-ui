/** What one MLS commit does to the leaves of a group, by identity. */
export type GroupMailboxRosterChange = Readonly<{
  /** The identity of each leaf the commit adds. */
  added: readonly string[];
  /** The identity whose leaf made the commit. */
  committer: string;
  /** The identity of each leaf in the tree the commit applies to. */
  holders: readonly string[];
  /** The identity of each leaf the commit removes. */
  removed: readonly string[];
}>;
