export interface StoredMlsKeyPackage<TPrivate> {
  /** The group it was published for; absent on packages stored before. */
  groupId?: string;
  id: string;
  privatePackage: TPrivate;
  publicBytes: Uint8Array;
}
