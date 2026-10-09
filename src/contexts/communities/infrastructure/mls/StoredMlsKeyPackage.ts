export interface StoredMlsKeyPackage<TPrivate> {
  id: string;
  privatePackage: TPrivate;
  publicBytes: Uint8Array;
}
