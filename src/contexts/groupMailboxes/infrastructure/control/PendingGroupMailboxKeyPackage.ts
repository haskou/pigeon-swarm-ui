/**
 * A key package request waiting for the peer's answer; `deviceCredential`
 * names the device asked when the peer is this identity.
 */
export type PendingGroupMailboxKeyPackage = {
  readonly conversationId: string;
  readonly deviceCredential?: string;
  readonly peerIdentityId: string;
  readonly reject: (error: Error) => void;
  readonly resolve: (keyPackage: Uint8Array) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};
