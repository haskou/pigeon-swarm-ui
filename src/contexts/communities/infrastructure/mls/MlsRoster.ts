/** Who may hold a leaf, from the signed community roster (not from MLS). */
export type MlsRoster = () => Promise<ReadonlySet<string>>;
