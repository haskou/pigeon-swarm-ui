/** A private-use extension of an MLS GroupContext (RFC 9420, 17.3). */
export type MlsContextExtension = Readonly<{
  extensionData: Uint8Array;
  extensionType: number;
}>;
