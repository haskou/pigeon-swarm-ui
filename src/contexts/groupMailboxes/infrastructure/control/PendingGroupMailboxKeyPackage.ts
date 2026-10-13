/** A key package request waiting for the peer's answer. */
export type PendingGroupMailboxKeyPackage = {
  readonly conversationId: string;
  readonly peerIdentityId: string;
  readonly reject: (error: Error) => void;
  readonly resolve: (keyPackage: Uint8Array) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};
